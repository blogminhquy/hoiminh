// Phiên bản đang chạy và phiên bản đã deploy: đọc hằng số build, hỏi `/version.json`,
// nạp lại sạch khi có bản mới (người dùng thường: tự động ở lần chuyển trang kế tiếp).
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import type { BuildInfo, DeployedVersion, ReleaseNote, ReleaseSection } from '../../scripts/version-plugin';

export type { BuildInfo, DeployedVersion, ReleaseNote, ReleaseSection };

declare const __HM_BUILD__: BuildInfo;

const FALLBACK: BuildInfo = {
  version: '0.0.0', buildId: 'dev', commit: '', shortCommit: 'local', branch: '',
  commitMessage: '', commitTime: null, buildTime: new Date().toISOString(), repoUrl: null, releases: [],
};

/** Thông tin build nhúng lúc đóng gói (Vite define). */
export const BUILD: BuildInfo = typeof __HM_BUILD__ === 'undefined' ? FALLBACK : __HM_BUILD__;

const PENDING_KEY = 'hm_version_pending';

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
  checkNow: () => void;
  update: () => void;
}

/** Theo dõi phiên bản trên máy chủ: hỏi lại mỗi 2 phút, khi quay lại tab, và khi bấm kiểm tra. */
export function useVersionStatus(): VersionStatus {
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

  return { build: BUILD, deployed, updateAvailable, stuck, checking: q.isFetching, checkNow, update };
}

/** Đường dẫn xem commit đang chạy trên GitHub. */
export function commitUrl(build: BuildInfo = BUILD): string | null {
  return build.repoUrl && build.commit ? `${build.repoUrl}/commit/${build.commit}` : null;
}
/** Trang chạy lại workflow deploy trên GitHub Actions. */
export function deployWorkflowUrl(build: BuildInfo = BUILD): string | null {
  return build.repoUrl ? `${build.repoUrl}/actions/workflows/deploy.yml` : null;
}

/** Router tối thiểu cần để nghe chuyển trang (khớp `createBrowserRouter`). */
interface RouterLike {
  state: { location: { key: string } };
  subscribe: (fn: (state: { location: { key: string } }) => void) => () => void;
}

/**
 * Tự lên bản mới mà không làm mất việc đang dở: khi máy chủ đã có bản khác, nạp lại ngay ở lần
 * chuyển trang kế tiếp. Chunk cũ bị xóa sau deploy làm import động lỗi, nên lỗi đó cũng kích hoạt nạp lại.
 */
export function useAutoUpdate(router: RouterLike): void {
  const { deployed, updateAvailable, stuck } = useVersionStatus();
  const target = deployed?.buildId;

  useEffect(() => {
    if (!updateAvailable || stuck) return;
    const startKey = router.state.location.key;
    return router.subscribe((state) => {
      if (state.location.key !== startKey) void applyUpdate(target);
    });
  }, [router, updateAvailable, stuck, target]);

  useEffect(() => {
    const onPreloadError = (e: Event) => {
      // Chỉ thử một lần mỗi phiên để không lặp vô hạn khi lỗi không phải do deploy.
      try { if (sessionStorage.getItem('hm_preload_reload')) return; sessionStorage.setItem('hm_preload_reload', '1'); } catch { return; }
      e.preventDefault();
      window.location.reload();
    };
    window.addEventListener('vite:preloadError', onPreloadError);
    // Chạy ổn một lúc thì cho phép thử lại ở lần deploy sau.
    const t = window.setTimeout(() => { try { sessionStorage.removeItem('hm_preload_reload'); } catch { /* bỏ qua */ } }, 15_000);
    return () => { window.removeEventListener('vite:preloadError', onPreloadError); window.clearTimeout(t); };
  }, []);
}
