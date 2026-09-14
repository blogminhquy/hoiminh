// API client: gắn Bearer token, tự làm mới phiên khi 401, ném ApiError { code, message }.
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

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';
const KEY_ACCESS = 'hm_access';
const KEY_REFRESH = 'hm_refresh';

export const tokens = {
  get access(): string | null {
    try { return localStorage.getItem(KEY_ACCESS); } catch { return null; }
  },
  get refresh(): string | null {
    try { return localStorage.getItem(KEY_REFRESH); } catch { return null; }
  },
  set(access: string | null, refresh: string | null): void {
    try {
      if (access) localStorage.setItem(KEY_ACCESS, access); else localStorage.removeItem(KEY_ACCESS);
      if (refresh) localStorage.setItem(KEY_REFRESH, refresh); else localStorage.removeItem(KEY_REFRESH);
    } catch { /* bỏ qua khi không có localStorage */ }
  },
};

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const rt = tokens.refresh;
      if (!rt) return false;
      const res = await fetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) });
      if (!res.ok) { tokens.set(null, null); return false; }
      const data = (await res.json()) as { accessToken: string; refreshToken: string | null };
      tokens.set(data.accessToken, data.refreshToken);
      return true;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const at = tokens.access;
  if (at) headers.Authorization = `Bearer ${at}`;
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), credentials: 'include' });
  if (res.status === 401 && retry && tokens.refresh && !path.startsWith('/v1/auth/')) {
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
  /** Tải tệp: xin URL ký → PUT → xác nhận. Trả về { fileId, url }. */
  async upload(file: File, purpose: 'post_image' | 'avatar' | 'cover' | 'lesson_resource' | 'digital_product' | 'message_image' | 'comment_image', scope: { communityId?: string | null; workspaceId?: string | null } = {}): Promise<{ fileId: string; url: string | null; width: number | null; height: number | null }> {
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
