// Lấy tên, mô tả và thời lượng của một video YouTube để điền sẵn khi nhập bài học từ link.
// Không cần API key: tên lấy từ oEmbed (ổn định), mô tả và thời lượng đọc từ trang xem video.
// YouTube không trả trang xem (chặn máy chủ, video riêng tư) thì vẫn có tên, mô tả để trống.
import { parseVideoUrl, type VideoEmbed } from '@hoiminh/contracts';

export interface VideoMeta {
  title: string;
  description: string;
  durationSeconds: number | null;
}
export interface VideoMetaResult {
  embed: VideoEmbed | null;
  meta: VideoMeta | null;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const TITLE_MAX = 160;
const DESCRIPTION_MAX = 50_000;
/** Khối videoDetails nằm gọn trong khoảng này kể từ chỗ bắt đầu (mô tả tối đa 5.000 ký tự, có thể phình ra khi escape). */
const DETAILS_WINDOW = 80_000;
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
  // Bỏ qua trang hỏi đồng ý cookie của YouTube ở châu Âu.
  Cookie: 'SOCS=CAI; CONSENT=YES+1',
};

/** Giá trị chuỗi JSON của khóa `key` xuất hiện đầu tiên trong `text`. */
function jsonString(text: string, key: string): string | null {
  const m = new RegExp(`"${key}":\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(text);
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function metaContent(html: string, attr: string, name: string): string | null {
  const m = new RegExp(`<meta[^>]+${attr}="${name}"[^>]+content="([^"]*)"`, 'i').exec(html);
  return m?.[1] ? decodeEntities(m[1]) : null;
}

/** "PT1H2M3S" → giây. */
function isoDuration(s: string | null): number | null {
  const m = s ? /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(s) : null;
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : null;
}

/** Đọc tên, mô tả, thời lượng từ HTML trang xem video. Trường nào không thấy thì trả null. */
export function parseYoutubePage(html: string, videoId: string): { title: string | null; description: string | null; durationSeconds: number | null } {
  const at = html.indexOf(`"videoDetails":{"videoId":"${videoId}"`);
  if (at >= 0) {
    // Trong videoDetails: videoId, title, lengthSeconds, keywords, ..., shortDescription.
    const details = html.slice(at, at + DETAILS_WINDOW);
    const seconds = Number(/"lengthSeconds":"(\d+)"/.exec(details)?.[1] ?? 0);
    return { title: jsonString(details, 'title'), description: jsonString(details, 'shortDescription'), durationSeconds: seconds > 0 ? seconds : null };
  }
  // Không có videoDetails (YouTube đòi đăng nhập): mô tả đầy đủ vẫn có thể nằm trong phần dữ liệu trang.
  const attributed = /"attributedDescription":\{"content":"((?:[^"\\]|\\.)*)"/.exec(html);
  let description: string | null = null;
  if (attributed) {
    try {
      description = JSON.parse(`"${attributed[1]}"`) as string;
    } catch {
      description = null;
    }
  }
  return { title: metaContent(html, 'name', 'title') ?? metaContent(html, 'property', 'og:title'), description, durationSeconds: isoDuration(metaContent(html, 'itemprop', 'duration')) };
}

/**
 * Mô tả YouTube là chữ thường, còn bài học hiển thị bằng Markdown. Giữ nguyên chữ, chỉ tách dòng kẻ
 * (--- hoặc ===) khỏi dòng chữ ngay trên nó, nếu không Markdown biến dòng chữ đó thành tiêu đề.
 */
export function descriptionToMarkdown(text: string): string {
  const out: string[] = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*(-+|=+)\s*$/.test(line) && out.length && out[out.length - 1] !== '') out.push('');
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, DESCRIPTION_MAX);
}

async function fetchOembedTitle(f: FetchLike, videoId: string, signal: AbortSignal): Promise<string | null> {
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await f(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { title?: unknown } | null;
  return typeof data?.title === 'string' ? data.title : null;
}

async function fetchPage(f: FetchLike, videoId: string, signal: AbortSignal) {
  const res = await f(`https://www.youtube.com/watch?v=${videoId}`, { headers: BROWSER_HEADERS, signal });
  if (!res.ok) return null;
  return parseYoutubePage(await res.text(), videoId);
}

/**
 * Nhận diện link video và, với YouTube, lấy tên, mô tả, thời lượng.
 * Chỉ gọi tới youtube.com với id đã kiểm định dạng, nên link dán vào không điều khiển được máy chủ gọi đi đâu.
 * `meta` là null khi không phải YouTube hoặc không lấy được tên (video riêng tư, đã xóa, YouTube không trả lời).
 */
export async function fetchVideoMeta(rawUrl: string, opts: { fetch?: FetchLike; timeoutMs?: number } = {}): Promise<VideoMetaResult> {
  const embed = parseVideoUrl(rawUrl);
  if (!embed || embed.provider !== 'youtube') return { embed, meta: null };
  const f: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init));
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 6000);
  const [oembedTitle, page] = await Promise.all([
    fetchOembedTitle(f, embed.externalId, signal).catch(() => null),
    fetchPage(f, embed.externalId, signal).catch(() => null),
  ]);
  const title = (oembedTitle ?? page?.title ?? '').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
  if (!title) return { embed, meta: null };
  return { embed, meta: { title, description: descriptionToMarkdown(page?.description ?? ''), durationSeconds: page?.durationSeconds ?? null } };
}
