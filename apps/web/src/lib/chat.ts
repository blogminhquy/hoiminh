// Phần tính toán thuần của màn Tin nhắn (không đụng DOM): tách link, gom nhóm tin liền nhau, trạng thái truy cập, đếm cảm xúc,
// kiểm tệp đính kèm trước khi tải lên, trạng thái đã gửi / đã nhận / đã xem, hạn tự xóa của ảnh và tệp.
import { MESSAGE_MEDIA_TTL_DAYS, messageMediaDaysLeft } from '@hoiminh/contracts';

/** Dòng báo đầu hội thoại: ảnh và tệp trong tin nhắn riêng tự xóa sau 30 ngày (máy chủ là nơi xóa thật). */
export const MEDIA_TTL_NOTICE = `Ảnh và tệp trong tin nhắn tự xóa sau ${MESSAGE_MEDIA_TTL_DAYS} ngày. Tải về nếu cần giữ.`;

/** Nhãn hạn ở dưới một ảnh hoặc tệp đã gửi: "Tự xóa sau 23 ngày", ngày cuối là "Tự xóa hôm nay". */
export function mediaTtlLabel(createdAt: string, now: Date = new Date()): string {
  const days = messageMediaDaysLeft(createdAt, now);
  return days <= 0 ? 'Tự xóa hôm nay' : `Tự xóa sau ${days} ngày`;
}

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

/** Tệp đính kèm trong tin nhắn tối đa 5MB (khớp MESSAGE_FILE_MAX_BYTES ở máy chủ; máy chủ vẫn kiểm lại). */
export const MESSAGE_FILE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Loại tệp đính kèm nhận được, tra theo đuôi tệp: trình duyệt báo loại tệp không ổn định
 * (zip trên Windows là application/x-zip-compressed, máy không cài Office thì .docx không có loại).
 */
const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
/** Giá trị `accept` của ô chọn tệp đính kèm (ảnh cũng chọn được ở đây, sẽ đi đường gửi ảnh). */
export const ATTACHMENT_ACCEPT = [...Object.keys(ATTACHMENT_TYPES).map((e) => `.${e}`), 'image/*'].join(',');

/** Kiểm tệp trước khi tải lên: đúng loại và không quá 5MB. Trả về loại tệp chuẩn để gửi cho máy chủ. */
export function checkAttachment(file: { name: string; size: number }): { ok: true; mimeType: string } | { ok: false; reason: string } {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const mimeType = ATTACHMENT_TYPES[ext];
  if (!mimeType) return { ok: false, reason: 'Loại tệp này chưa gửi được. Tệp đính kèm nhận PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), văn bản (.txt) và .zip.' };
  if (file.size > MESSAGE_FILE_MAX_BYTES) return { ok: false, reason: `Tệp nặng ${fileSizeLabel(file.size)}, vượt giới hạn 5MB của tệp đính kèm.` };
  if (file.size === 0) return { ok: false, reason: 'Tệp trống, không gửi được.' };
  return { ok: true, mimeType };
}

/** 820 KB, 1,2 MB: dung lượng tệp viết theo kiểu Việt Nam (dấu phẩy thập phân). */
export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${Math.max(bytes, 0)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Ba trạng thái của tin mình gửi (cộng "Đang gửi" lúc chưa lên tới máy chủ). */
export function deliveryStatus(m: { pending?: boolean; deliveredAt: string | null; readAt: string | null }): 'Đang gửi' | 'Đã gửi' | 'Đã nhận' | 'Đã xem' {
  if (m.pending) return 'Đang gửi';
  if (m.readAt) return 'Đã xem';
  return m.deliveredAt ? 'Đã nhận' : 'Đã gửi';
}

/** Đường dẫn trang Tin nhắn, và đường dẫn mở thẳng một hội thoại trên trang đó. */
export const MESSAGES_PATH = '/tin-nhan';
export const conversationPath = (id: string): string => `${MESSAGES_PATH}?c=${encodeURIComponent(id)}`;

/** Dòng xem trước của một hội thoại (danh sách ở trang Tin nhắn và bảng nổi ở nút Tin nhắn): tin tự động hay tin mình gửi có tiền tố. */
export function convoPreview(c: { automated: boolean; lastFromMe: boolean; preview: string | null }): string {
  const prefix = c.automated ? 'Tự động · ' : c.lastFromMe ? 'Bạn: ' : '';
  return `${prefix}${c.preview ?? ''}`;
}

/** Nhãn đọc cho trình đọc màn hình của nút Tin nhắn, kèm số tin chưa đọc thật (không rút gọn thành "9+"). */
export function messagesButtonLabel(count: number | null | undefined): string {
  const n = Math.floor(Number(count ?? 0));
  return Number.isFinite(n) && n > 0 ? `Tin nhắn, ${n} tin chưa đọc` : 'Tin nhắn';
}
