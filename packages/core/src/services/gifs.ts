// Ảnh động (GIF) và nhãn dán động nền trong (GIPHY Stickers) cho ô bình luận và ô chat, tìm qua GIPHY. Khóa GIPHY nhập ở Hệ thống · Hạ tầng (hoặc secret
// GIPHY_API_KEY của Worker); chưa có khóa thì tab GIF tự ẩn, mọi thứ khác chạy bình thường.
// Trình duyệt không gọi GIPHY trực tiếp: máy chủ gọi thay để khóa không lộ ra ngoài. Lúc gửi, người dùng chỉ gửi id GIF
// (chữ và số), máy chủ tự dựng link trên media.giphy.com, nên không ai nhúng được link ảnh lạ vào bình luận.
import type { Ctx } from '../context';
import { AppError } from '../errors';
import { requireUser } from '../permissions';

export interface GifItem { id: string; title: string; url: string; previewUrl: string; width: number; height: number }

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const LIMIT = 24;
const CACHE_MS = 5 * 60_000;
// Khóa GIPHY miễn phí giới hạn số lần gọi mỗi giờ: giữ kết quả trong isolate một lúc, nhiều người mở tab GIF cùng lúc
// hay gõ lại cùng từ khóa thì không phải gọi lại.
const cache = new Map<string, { at: number; items: GifItem[] }>();

/** Link GIF lưu vào bình luận / tin nhắn, dựng từ id đã kiểm định dạng (gifIdSchema). */
export function gifUrl(id: string): string {
  if (!/^[A-Za-z0-9]{4,64}$/.test(id)) throw new AppError('validation_error', 'GIF không hợp lệ', 400);
  return `https://media.giphy.com/media/${id}/200w.webp`;
}

export function gifEnabled(ctx: Ctx): boolean {
  return Boolean(ctx.env.GIPHY_API_KEY?.trim());
}

interface GiphyImage { url?: string; webp?: string; width?: string; height?: string }
interface GiphyGif { id: string; title?: string; images?: { fixed_width?: GiphyImage; fixed_width_small?: GiphyImage } }

function toItem(g: GiphyGif): GifItem | null {
  const fw = g.images?.fixed_width;
  if (!g.id || !fw) return null;
  const url = fw.webp || fw.url;
  if (!url) return null;
  const small = g.images?.fixed_width_small;
  return { id: g.id, title: (g.title ?? '').slice(0, 120), url, previewUrl: small?.webp || small?.url || url, width: Number(fw.width) || 200, height: Number(fw.height) || 200 };
}

/**
 * GIF (hoặc nhãn dán GIPHY khi `type` là 'stickers') đang thịnh hành (q trống) hoặc tìm theo từ khóa.
 * Chưa có khóa: enabled false, danh sách trống.
 */
export async function searchGifs(ctx: Ctx, q: string, opts: { fetch?: FetchLike; type?: 'gifs' | 'stickers' } = {}): Promise<{ enabled: boolean; items: GifItem[] }> {
  requireUser(ctx);
  if (!gifEnabled(ctx)) return { enabled: false, items: [] };
  const type = opts.type === 'stickers' ? 'stickers' : 'gifs';
  const query = q.trim().slice(0, 50);
  const key = `${type}:${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && ctx.now().getTime() - hit.at < CACHE_MS) return { enabled: true, items: hit.items };
  const params = new URLSearchParams({ api_key: ctx.env.GIPHY_API_KEY.trim(), limit: String(LIMIT), rating: 'g', ...(type === 'gifs' ? { bundle: 'messaging_non_clips' } : {}) });
  if (query) { params.set('q', query); params.set('lang', 'vi'); }
  const f: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init));
  let res: Response;
  try {
    res = await f(`https://api.giphy.com/v1/${type}/${query ? 'search' : 'trending'}?${params}`, { signal: AbortSignal.timeout(6000) });
  } catch (err) {
    ctx.log.warn('gifs.fetch_failed', { err: String(err) });
    throw new AppError('internal_error', 'Không tải được GIF, thử lại sau', 502);
  }
  if (!res.ok) {
    ctx.log.warn('gifs.giphy_error', { status: res.status });
    throw new AppError('internal_error', res.status === 401 || res.status === 403 ? 'Khóa GIPHY không dùng được, quản trị kiểm tra lại ở Hệ thống · Hạ tầng' : 'Không tải được GIF, thử lại sau', 502);
  }
  const body = (await res.json()) as { data?: GiphyGif[] };
  const items = (body.data ?? []).map(toItem).filter((x): x is GifItem => x !== null);
  cache.set(key, { at: ctx.now().getTime(), items });
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  return { enabled: true, items };
}

/** Xóa cache (cho test). */
export function clearGifCache(): void {
  cache.clear();
}
