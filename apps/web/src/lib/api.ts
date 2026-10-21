// API client: gửi kèm cookie phiên, tự làm mới phiên khi 401, ném ApiError { code, message }.
import { compressForUpload, type UploadPurpose } from './image-compress';

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}
export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly details?: unknown) {
    super(message);
  }
}

// Production: web và API cùng một Worker, gọi cùng tên miền (không cần CORS). Dev: API chạy riêng ở cổng 8787.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || (import.meta.env.PROD ? '' : 'http://localhost:8787');
// Phiên đăng nhập nằm trong cookie httpOnly do API đặt: JavaScript không đọc được token, nên mã độc
// lọt vào trang cũng không lấy cắp được phiên. Header này báo API trả cookie thay vì token trong JSON.
const AUTH_MODE = { 'X-HM-Auth': 'cookie' } as const;

/** Có phiên đăng nhập không: đọc cờ `hm_li` (không chứa bí mật), không phải token. */
export function hasSession(): boolean {
  try { return /(?:^|;\s*)hm_li=1/.test(document.cookie); } catch { return false; }
}

// Bản cũ lưu token trong localStorage. Đổi một lần sang cookie rồi xóa, người đang đăng nhập không bị đăng xuất.
const LEGACY_ACCESS = 'hm_access';
const LEGACY_REFRESH = 'hm_refresh';
let migrating: Promise<void> | null = null;
export function migrateLegacySession(): Promise<void> {
  if (!migrating) {
    migrating = (async () => {
      let rt: string | null = null;
      try {
        rt = localStorage.getItem(LEGACY_REFRESH);
        localStorage.removeItem(LEGACY_ACCESS);
        localStorage.removeItem(LEGACY_REFRESH);
      } catch { return; }
      if (!rt) return;
      await fetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...AUTH_MODE }, body: JSON.stringify({ refreshToken: rt }), credentials: 'include' }).catch(() => null);
    })();
  }
  return migrating;
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...AUTH_MODE }, body: '{}', credentials: 'include' })
      .then((res) => res.ok, () => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

/** fetch tới API kèm cookie phiên (tải CSV, gọi không cần đọc JSON). */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, { ...init, headers: { ...AUTH_MODE, ...(init.headers as Record<string, string> | undefined) }, credentials: 'include' });
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = { ...AUTH_MODE };
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), credentials: 'include' });
  if (res.status === 401 && retry && hasSession() && !path.startsWith('/v1/auth/')) {
    if (await tryRefresh()) return request<T>(method, path, body, false);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const e = (data ?? {}) as Partial<ApiErrorShape>;
    throw new ApiError(e.code ?? 'internal_error', e.message ?? `Lỗi ${res.status}`, res.status, e.details);
  }
  return data as T;
}

export const api = {
  url: API_URL,
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
  /**
   * Bỏ ảnh vừa tải lên mà chưa dùng (bấm X, chọn ảnh khác trước khi lưu) để R2 không giữ tệp mồ côi.
   * Không ném lỗi: tệp đã được dùng thì server từ chối (409) và giữ nguyên, đó là kết quả đúng.
   */
  discardUpload: (fileId: string): Promise<void> => request<unknown>('DELETE', `/v1/files/${fileId}`).then(() => undefined, () => undefined),
  /** Tải tệp: nén ảnh (JPEG, cạnh dài tối đa 1200px, avatar 512px) → xin URL ký → PUT → xác nhận. Trả về { fileId, url }. */
  async upload(original: File, purpose: UploadPurpose, scope: { communityId?: string | null; workspaceId?: string | null } = {}): Promise<{ fileId: string; url: string | null; width: number | null; height: number | null }> {
    const file = await compressForUpload(original, purpose);
    const r = await request<{ fileId: string; upload: { url: string; headers: Record<string, string> }; url: string | null }>('POST', '/v1/files/upload-url', { fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, purpose, ...scope });
    const put = await fetch(r.upload.url, { method: 'PUT', headers: r.upload.headers, body: file });
    if (!put.ok) throw new ApiError('internal_error', 'Tải tệp thất bại', put.status);
    const dims = await imageSize(file).catch(() => ({ width: null, height: null }));
    const done = await request<{ id: string; url: string | null; width: number | null; height: number | null }>('POST', `/v1/files/${r.fileId}/complete`, dims);
    return { fileId: done.id, url: done.url, width: done.width, height: done.height };
  },
};

function imageSize(file: File): Promise<{ width: number | null; height: number | null }> {
  if (!file.type.startsWith('image/')) return Promise.resolve({ width: null, height: null });
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => resolve({ width: null, height: null });
    img.src = url;
  });
}

/** Thông điệp lỗi thân thiện. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Có lỗi xảy ra, thử lại nhé';
}
