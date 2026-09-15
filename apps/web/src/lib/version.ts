// Phiên bản đang chạy và phiên bản đã deploy: đọc hằng số build, hỏi `/version.json`,
// ghi nhật ký các phiên bản máy này đã thấy, và nạp lại sạch khi có bản mới.
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import type { BuildInfo, DeployedVersion, ReleaseNote, ReleaseSection } from '../../scripts/version-plugin';

export type { BuildInfo, DeployedVersion, ReleaseNote, ReleaseSection };

declare const __HM_BUILD__: BuildInfo;

const FALLBACK: BuildInfo = {
  version: '0.0.0', buildId: 'dev', commit: '', shortCommit: 'local', branch: '',
  commitMessage: '', commitTime: null, buildTime: new Date().toISOString(), repoUrl: null, releases: [],
};

/** Thông tin build nhúng lúc đóng gói (Vite define). */
export const BUILD: BuildInfo = typeof __HM_BUILD__ === 'undefined' ? FALLBACK : __HM_BUILD__;

const LOG_KEY = 'hm_version_log';
const PENDING_KEY = 'hm_version_pending';
const LOG_MAX = 20;

export interface SeenVersion {
  buildId: string;
  version: string;
  shortCommit: string;
  seenAt: string;
}

export function readVersionLog(): SeenVersion[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SeenVersion[]).filter((e) => e && typeof e.buildId === 'string') : [];
  } catch {
    return [];
  }
}

/** Ghi phiên bản đang chạy vào nhật ký cục bộ (mới nhất lên đầu, không trùng buildId). */
export function recordCurrentVersion(): SeenVersion[] {
  const log = readVersionLog();
  if (log[0]?.buildId === BUILD.buildId) return log;
  const next = [
    { buildId: BUILD.buildId, version: BUILD.version, shortCommit: BUILD.shortCommit, seenAt: new Date().toISOString() },
    ...log.filter((e) => e.buildId !== BUILD.buildId),
  ].slice(0, LOG_MAX);
  try { localStorage.setItem(LOG_KEY, JSON.stringify(next)); } catch { /* bỏ qua khi không có localStorage */ }
  return next;
}

/** Hỏi phiên bản đang phục vụ trên Cloudflare. Trả null nếu không đọc được (offline, chưa deploy). */
export async function fetchDeployed(): Promise<DeployedVersion | null> {
  const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  // SPA fallback có thể trả index.html cho đường dẫn lạ — chỉ nhận JSON đúng dạng.
  if (!(res.headers.get('content-type') ?? '').includes('json')) return null;
  const data: unknown = await res.json().catch(() => null);
  if (!data || typeof data !== 'object' || typeof (data as DeployedVersion).buildId !== 'string') return null;
  return data as DeployedVersion;
}

/** Xóa cache trình duyệt rồi nạp lại để lấy bundle mới. */
export async function applyUpdate(targetBuildId?: string): Promise<void> {
  try { sessionStorage.setItem(PENDING_KEY, targetBuildId ?? ''); } catch { /* bỏ qua */ }
  try {
    if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch { /* bỏ qua */ }
  try {
    if ('serviceWorker' in navigator) await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
  } catch { /* bỏ qua */ }
  window.location.reload();
}

function pendingBuildId(): string | null {
  try { return sessionStorage.getItem(PENDING_KEY); } catch { return null; }
}

export interface VersionStatus {
  build: BuildInfo;
  deployed: DeployedVersion | null;
  updateAvailable: boolean;
  /** Đã bấm cập nhật cho đúng bản này mà nạp lại vẫn ra bản cũ → cần tải lại cứng. */
  stuck: boolean;
  checking: boolean;
  log: SeenVersion[];
  checkNow: () => void;
  update: () => void;
}

/** Theo dõi phiên bản trên máy chủ: hỏi lại mỗi 2 phút, khi quay lại tab, và khi bấm kiểm tra. */
export function useVersionStatus(): VersionStatus {
  const [log, setLog] = useState<SeenVersion[]>([]);
  useEffect(() => { setLog(recordCurrentVersion()); }, []);

  const q = useQuery({
    queryKey: ['app-version'],
    queryFn: fetchDeployed,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
    staleTime: 60_000,
  });

  const deployed = q.data ?? null;
  const updateAvailable = Boolean(deployed && deployed.buildId !== BUILD.buildId);
  const stuck = updateAvailable && pendingBuildId() === deployed?.buildId;
  const checkNow = useCallback(() => { void q.refetch(); }, [q]);
  const update = useCallback(() => { void applyUpdate(deployed?.buildId); }, [deployed]);

  return { build: BUILD, deployed, updateAvailable, stuck, checking: q.isFetching, log, checkNow, update };
}

/** Đường dẫn xem commit đang chạy trên GitHub. */
export function commitUrl(build: BuildInfo = BUILD): string | null {
  return build.repoUrl && build.commit ? `${build.repoUrl}/commit/${build.commit}` : null;
}
/** Trang chạy lại workflow deploy trên GitHub Actions. */
export function deployWorkflowUrl(build: BuildInfo = BUILD): string | null {
  return build.repoUrl ? `${build.repoUrl}/actions/workflows/deploy.yml` : null;
}
