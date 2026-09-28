// Phát hành web thủ công: GitHub Actions chỉ tải bản mới lên Cloudflare (`wrangler versions upload`),
// super admin xem danh sách phiên bản và bấm "Cập nhật" để đưa một bản lên chạy 100% (cũng dùng để quay lui).
import type { Ctx } from '../context';
import { AppError } from '../errors';
import { requireSuperAdmin } from '../permissions';
import { audit } from './audit';

const CF_API = 'https://api.cloudflare.com/client/v4';

export interface ReleaseVersion {
  id: string;
  number: number | null;
  tag: string | null;
  message: string | null;
  createdAt: string | null;
  source: string | null;
  live: boolean;
}

export interface ReleaseState {
  configured: boolean;
  script: string;
  liveVersionId: string | null;
  liveSince: string | null;
  versions: ReleaseVersion[];
}

interface CfVersion {
  id: string;
  number?: number;
  metadata?: { created_on?: string; source?: string };
  annotations?: Record<string, string | undefined>;
}
interface CfDeployment {
  created_on?: string;
  versions?: { version_id: string; percentage: number }[];
}

function config(ctx: Ctx) {
  const { CF_RELEASE_API_TOKEN: token, CF_RELEASE_ACCOUNT_ID: accountId, CF_RELEASE_WEB_SCRIPT: script } = ctx.env;
  return { token, accountId, script, configured: Boolean(token && accountId) };
}

async function cf<T>(ctx: Ctx, path: string, init: RequestInit = {}): Promise<T> {
  const { token, accountId, script } = config(ctx);
  const res = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/${script}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const data = (await res.json().catch(() => null)) as { success?: boolean; result?: T; errors?: { message?: string }[] } | null;
  if (!res.ok || !data?.success) {
    const msg = data?.errors?.map((e) => e.message).filter(Boolean).join('; ') || `HTTP ${res.status}`;
    ctx.log.error('releases.cloudflare_failed', { path, status: res.status, msg });
    throw new AppError('internal_error', `Cloudflare từ chối yêu cầu: ${msg}`, 502);
  }
  return data.result as T;
}

/** Bản đang chạy = bản chiếm nhiều phần trăm nhất ở lần deploy mới nhất. */
function liveOf(deployments: CfDeployment[]): { id: string | null; since: string | null } {
  const latest = [...deployments].sort((a, b) => (b.created_on ?? '').localeCompare(a.created_on ?? ''))[0];
  const top = [...(latest?.versions ?? [])].sort((a, b) => b.percentage - a.percentage)[0];
  return { id: top?.version_id ?? null, since: latest?.created_on ?? null };
}

export async function listReleases(ctx: Ctx): Promise<ReleaseState> {
  requireSuperAdmin(ctx);
  const { configured, script } = config(ctx);
  if (!configured) return { configured, script, liveVersionId: null, liveSince: null, versions: [] };
  const [versions, deployments] = await Promise.all([
    cf<{ items?: CfVersion[] }>(ctx, '/versions?page=1&per_page=15'),
    cf<{ deployments?: CfDeployment[] }>(ctx, '/deployments'),
  ]);
  const live = liveOf(deployments.deployments ?? []);
  return {
    configured,
    script,
    liveVersionId: live.id,
    liveSince: live.since,
    versions: (versions.items ?? [])
      .map((v) => ({
        id: v.id,
        number: v.number ?? null,
        tag: v.annotations?.['workers/tag'] ?? null,
        message: v.annotations?.['workers/message'] ?? null,
        createdAt: v.metadata?.created_on ?? null,
        source: v.metadata?.source ?? null,
        live: v.id === live.id,
      }))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
  };
}

/** Đưa một phiên bản lên chạy 100%. Chọn bản cũ hơn bản đang chạy chính là quay lui. */
export async function deployRelease(ctx: Ctx, versionId: string): Promise<ReleaseState> {
  requireSuperAdmin(ctx);
  if (!config(ctx).configured) throw new AppError('invalid_state', 'Chưa cấu hình token Cloudflare cho phát hành', 409);
  if (!/^[0-9a-f-]{8,64}$/i.test(versionId)) throw new AppError('validation_error', 'Mã phiên bản không hợp lệ', 422);
  const before = await listReleases(ctx);
  const target = before.versions.find((v) => v.id === versionId);
  if (!target) throw new AppError('not_found', 'Không tìm thấy phiên bản này trong 15 bản gần nhất', 404);
  if (target.live) return before;
  await cf(ctx, '/deployments', {
    method: 'POST',
    body: JSON.stringify({
      strategy: 'percentage',
      versions: [{ version_id: versionId, percentage: 100 }],
      annotations: { 'workers/message': `Phát hành ${target.tag ?? versionId.slice(0, 8)} từ trang quản trị` },
    }),
  });
  await audit(ctx, {
    action: 'release.deploy',
    resourceType: 'web_release',
    resourceId: versionId,
    metadata: { tag: target.tag, from: before.liveVersionId },
  });
  return listReleases(ctx);
}
