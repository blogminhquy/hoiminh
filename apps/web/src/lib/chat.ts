// Phần tính toán thuần của màn Tin nhắn (không đụng DOM): tách link, gom nhóm tin liền nhau, trạng thái truy cập, đếm cảm xúc.

export interface ChatMessageLike { senderUserId: string; createdAt: string; automated: boolean }

/** Một đoạn chữ thường hoặc một đường link trong nội dung tin nhắn. */
export interface TextPart { text: string; href?: string }

const URL_RE = /https?:\/\/[^\s<>"']+/g;
/** Dấu câu đứng sát cuối link ("...com." hay "...com)") không thuộc về link. */
const TRAILING = /[.,;:!?)\]}»”’]+$/;

/** Tách nội dung thành chữ và link để link bấm được (như Zalo), không dùng innerHTML. */
export function linkParts(text: string): TextPart[] {
  const out: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0];
    const url = raw.replace(TRAILING, '');
    const start = m.index ?? 0;
    if (!/^https?:\/\/[^/]/.test(url)) continue;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Mọi link trong một nội dung. */
export function linksIn(text: string): string[] {
  return linkParts(text).flatMap((p) => (p.href ? [p.href] : []));
}

const GROUP_GAP_MS = 5 * 60_000;
/** Hai tin liền nhau có thuộc cùng một cụm không: cùng người gửi, cùng ngày, cách nhau dưới 5 phút. */
export function sameGroup(a: ChatMessageLike | undefined, b: ChatMessageLike | undefined): boolean {
  if (!a || !b || a.senderUserId !== b.senderUserId || a.automated !== b.automated) return false;
  const ta = new Date(a.createdAt);
  const tb = new Date(b.createdAt);
  return ta.toDateString() === tb.toDateString() && Math.abs(tb.getTime() - ta.getTime()) < GROUP_GAP_MS;
}

/** Dòng trạng thái dưới tên: "Đang hoạt động" trong 5 phút gần nhất, còn lại "Truy cập ... trước". */
export function seenLabel(lastSeenAt: string | null | undefined, now = Date.now()): string {
  if (!lastSeenAt) return '';
  const t = new Date(lastSeenAt).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.floor((now - t) / 60_000);
  if (m < 5) return 'Đang hoạt động';
  if (m < 60) return `Truy cập ${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Truy cập ${h} giờ trước`;
  const d = Math.floor(h / 24);
  return d < 30 ? `Truy cập ${d} ngày trước` : '';
}

/** Cảm xúc trên một tin: các biểu tượng (nhiều nhất đứng trước) và tổng số lượt. */
export function reactionSummary(reactions: Record<string, string> | undefined): { emojis: string[]; total: number } {
  const count = new Map<string, number>();
  for (const e of Object.values(reactions ?? {})) count.set(e, (count.get(e) ?? 0) + 1);
  const emojis = [...count].sort((a, b) => b[1] - a[1]).map(([e]) => e);
  return { emojis, total: [...count.values()].reduce((s, n) => s + n, 0) };
}
