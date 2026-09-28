// Phát hành web thủ công: đọc đúng bản đang chạy, chỉ super admin được đưa bản lên, gửi đúng yêu cầu Cloudflare.
import { loadEnv } from '@hoiminh/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Ctx } from '../context';
import { deployRelease, listReleases } from './releases';

const OLD = '11111111-aaaa-bbbb-cccc-000000000001';
const NEW = '22222222-aaaa-bbbb-cccc-000000000002';

function ctx(opts: { configured?: boolean; superAdmin?: boolean } = {}): Ctx {
  const env = loadEnv(opts.configured === false ? {} : { CF_RELEASE_API_TOKEN: 't', CF_RELEASE_ACCOUNT_ID: 'acc' });
  const inserts: unknown[] = [];
  return {
    env,
    actor: { type: 'user', userId: 'u1', isSuperAdmin: opts.superAdmin ?? true, email: 'a@b.c' },
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    db: { insert: () => ({ values: async (v: unknown) => { inserts.push(v); } }) },
    requestId: 'r1',
  } as unknown as Ctx;
}

function mockCloudflare() {
  let live = OLD;
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }), { status: 200 });
    if (url.includes('/versions')) {
      return ok({ items: [
        { id: OLD, number: 1, metadata: { created_on: '2026-09-20T00:00:00Z', source: 'wrangler' }, annotations: { 'workers/tag': 'v1.2.0-aaa' } },
        { id: NEW, number: 2, metadata: { created_on: '2026-09-26T00:00:00Z', source: 'wrangler' }, annotations: { 'workers/tag': 'v1.3.0-bbb', 'workers/message': 'Thêm trang phiên bản' } },
      ] });
    }
    if (url.endsWith('/deployments') && method === 'POST') {
      live = (JSON.parse(String(init.body)) as { versions: { version_id: string }[] }).versions[0]!.version_id;
      return ok({});
    }
    return ok({ deployments: [{ created_on: '2026-09-21T00:00:00Z', versions: [{ version_id: live, percentage: 100 }] }] });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('releases', () => {
  it('chưa cấu hình thì không gọi Cloudflare', async () => {
    const calls = mockCloudflare();
    const s = await listReleases(ctx({ configured: false }));
    expect(s.configured).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('liệt kê bản mới nhất lên đầu và đánh dấu bản đang chạy', async () => {
    mockCloudflare();
    const s = await listReleases(ctx());
    expect(s.versions.map((v) => v.id)).toEqual([NEW, OLD]);
    expect(s.liveVersionId).toBe(OLD);
    expect(s.versions.find((v) => v.live)?.tag).toBe('v1.2.0-aaa');
  });

  it('đưa bản mới lên chạy 100%', async () => {
    const calls = mockCloudflare();
    const s = await deployRelease(ctx(), NEW);
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/workers/scripts/hoiminh-web/deployments');
    expect(post?.body).toMatchObject({ strategy: 'percentage', versions: [{ version_id: NEW, percentage: 100 }] });
    expect(s.liveVersionId).toBe(NEW);
  });

  it('chỉ super admin được phát hành', async () => {
    mockCloudflare();
    await expect(deployRelease(ctx({ superAdmin: false }), NEW)).rejects.toThrow();
  });

  it('từ chối mã phiên bản lạ', async () => {
    mockCloudflare();
    await expect(deployRelease(ctx(), '../../x')).rejects.toThrow('không hợp lệ');
    await expect(deployRelease(ctx(), '33333333-0000-0000-0000-000000000000')).rejects.toThrow('Không tìm thấy');
  });
});
