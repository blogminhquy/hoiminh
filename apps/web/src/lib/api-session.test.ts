// Phiên đăng nhập bằng cookie: web chỉ đọc cờ hm_li, và phiên cũ trong localStorage được đổi sang cookie một lần rồi xóa.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function fakeStorage(init: Record<string, string>) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), dump: () => Object.fromEntries(m) };
}

describe('phiên bằng cookie', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('hasSession chỉ dựa vào cờ hm_li', async () => {
    vi.stubGlobal('document', { cookie: 'a=1; hm_li=1' });
    const { hasSession } = await import('./api');
    expect(hasSession()).toBe(true);
    vi.stubGlobal('document', { cookie: 'hm_lix=1' });
    expect(hasSession()).toBe(false);
  });

  it('phiên cũ trong localStorage đổi sang cookie một lần rồi bị xóa', async () => {
    const storage = fakeStorage({ hm_access: 'old-at', hm_refresh: 'old-rt-1234567890' });
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response('{}', { status: 200 }); }));
    const { migrateLegacySession } = await import('./api');
    await migrateLegacySession();
    await migrateLegacySession();
    expect(storage.dump()).toEqual({});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toMatch(/\/v1\/auth\/refresh$/);
    expect((calls[0]!.init.headers as Record<string, string>)['X-HM-Auth']).toBe('cookie');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ refreshToken: 'old-rt-1234567890' });
  });

  it('không có phiên cũ thì không gọi gì', async () => {
    vi.stubGlobal('localStorage', fakeStorage({}));
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const { migrateLegacySession } = await import('./api');
    await migrateLegacySession();
    expect(f).not.toHaveBeenCalled();
  });
});
