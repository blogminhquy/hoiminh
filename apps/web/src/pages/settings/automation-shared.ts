// Kiểu và hàm dùng chung cho ba trang Nguồn đồng bộ, Quy tắc tự động, Liên hệ và thẻ.
export interface SourceMapping { emailPath: string; namePath: string; phonePath: string; tagPath: string; removeTagPath: string; defaultTags: string[] }
export interface Source { id: string; name: string; status: 'active' | 'paused'; url: string; mapping: SourceMapping; receivedCount: number; lastReceivedAt: string | null; createdAt: string }
export interface SourceEvent { id: string; status: 'processed' | 'ignored' | 'failed'; detail: string; email: string | null; tagsAdded: string[]; tagsRemoved: string[]; createdAt: string; fields: Record<string, string> }

export type RuleAction =
  | { type: 'grant_membership'; communityId: string; tierKey: 'standard' | 'premium' | 'vip'; durationDays: number | null }
  | { type: 'grant_course'; courseId: string }
  | { type: 'send_email'; subject: string; body: string };
export interface Rule { id: string; name: string; tag: string; actions: RuleAction[]; summary: string[]; enabled: boolean; revokeOnTagRemoved: boolean; runCount: number; lastRunAt: string | null }
export interface RuleOptions { communities: Array<{ id: string; name: string; slug: string; tiers: Array<{ key: 'standard' | 'premium' | 'vip'; name: string }> }>; courses: Array<{ id: string; title: string; communityId: string | null; status: string }> }
export interface RuleRun { id: string; ruleId: string; rule: string; email: string; trigger: 'tag_added' | 'tag_removed' | 'expired'; results: Array<{ type: string; status: string; detail: string }>; createdAt: string }

export interface TagRow { id: string; name: string; contactCount: number; ruleCount: number }
export interface ContactRow { id: string; email: string; name: string; phone: string; hasAccount: boolean; unsubscribed: boolean; createdAt: string; tags: Array<{ id: string; name: string }>; grants: Array<{ id: string; kind: 'membership' | 'course'; status: 'pending' | 'applied'; expiresAt: string | null; title: string }> }
export interface ContactsPage { total: number; nextCursor: string | null; items: ContactRow[] }

/** Tên thẻ như máy chủ sẽ lưu: chữ thường không dấu, số, gạch dưới, gạch nối. Hiện ngay dưới ô nhập để chủ hội thấy trước. */
export function normalizeTag(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 60);
}

/** Chuỗi "paid, vip" thành danh sách thẻ đã chuẩn hóa, bỏ trùng. */
export function splitTags(raw: string): string[] {
  return [...new Set(raw.split(/[,;\n]/).map(normalizeTag).filter(Boolean))];
}

/**
 * Các trường chọn được từ một lượt dữ liệu đã trải phẳng. Phần tử mảng (`tags.0`, `tags.1`) gộp về trường cha (`tags`)
 * vì chọn trường thẻ là chọn cả danh sách.
 */
export function fieldChoices(fields: Record<string, string>): Array<{ path: string; sample: string }> {
  const out = new Map<string, string>();
  for (const [path, value] of Object.entries(fields)) {
    const parent = path.replace(/\.\d+$/, '');
    out.set(parent, out.has(parent) ? `${out.get(parent)}, ${value}` : value);
  }
  return [...out.entries()].map(([path, sample]) => ({ path, sample: sample.length > 48 ? `${sample.slice(0, 48)}…` : sample }));
}

export const TRIGGER_LABEL: Record<RuleRun['trigger'], string> = { tag_added: 'Gắn thẻ', tag_removed: 'Gỡ thẻ', expired: 'Hết hạn' };
export const RESULT_LABEL: Record<string, string> = { done: 'Xong', pending: 'Chờ kích hoạt', skipped: 'Bỏ qua', failed: 'Lỗi', revoked: 'Đã thu hồi' };
