// Lời mời vào hội: link chủ hội gửi có dạng `/<slug>?invite=<mã>`. Mã phải sống qua bước đăng ký, xác minh email và
// đăng nhập (kể cả khi người được mời mở email ở một tab khác), nên được nhớ theo từng hội trong localStorage cho tới
// khi dùng xong hoặc máy chủ báo không còn dùng được.

export const INVITE_PARAM = 'invite';
const KEY = 'hm_invite:';
const TOKEN = /^[A-Za-z0-9_-]{8,64}$/;

/** Trạng thái lời mời máy chủ trả về ở trang giới thiệu hội (khớp `InviteState` của máy chủ). */
export interface InviteInfo {
  state: 'valid' | 'not_found' | 'expired' | 'used' | 'wrong_email' | 'unverified_email';
  role: 'admin' | 'member';
  message: string | null;
}

function clean(token: string | null | undefined): string | null {
  const t = token?.trim();
  return t && TOKEN.test(t) ? t : null;
}

/** Nhớ mã mời của một hội. Mã rỗng hoặc sai dạng thì bỏ qua, không xóa mã đã nhớ. */
export function rememberInvite(slug: string, token: string | null | undefined): void {
  const t = clean(token);
  if (!slug || !t) return;
  try { window.localStorage.setItem(KEY + slug.toLowerCase(), t); } catch { /* trình duyệt chặn bộ nhớ: mã vẫn đi theo link */ }
}

/** Mã mời người xem đang mang theo cho hội này: mã trên link trước, rồi tới mã đã nhớ. */
export function inviteFor(slug: string, params?: URLSearchParams | null): string | null {
  const fromLink = clean(params?.get(INVITE_PARAM));
  if (fromLink) return fromLink;
  try { return clean(window.localStorage.getItem(KEY + slug.toLowerCase())); } catch { return null; }
}

/** Quên mã mời của hội: đã dùng xong, hoặc máy chủ báo mã hết hạn, đã dùng, đã bị thu hồi. */
export function forgetInvite(slug: string): void {
  try { window.localStorage.removeItem(KEY + slug.toLowerCase()); } catch { /* bỏ qua */ }
}

/** Mã này không bao giờ dùng lại được nữa, nhớ tiếp chỉ làm trang hiện mãi lời báo lỗi. */
export function inviteIsDead(invite: InviteInfo | null | undefined): boolean {
  return invite?.state === 'not_found' || invite?.state === 'expired' || invite?.state === 'used';
}

/**
 * Lời mời đổi được gì cho người đang xem:
 *  - `join`: bấm là vào thẳng hội (không chờ duyệt, không câu hỏi, vào được cả khi hội đóng cổng).
 *  - `promote`: đã ở trong hội, bấm là nhận vai trò quản trị viên.
 *  - `pay`: được mời làm thành viên của hội thu phí, vẫn phải thanh toán như mọi người.
 *  - `none`: không có lời mời dùng được, hoặc người xem đã có đủ quyền lời mời trao.
 */
export function inviteEffect(invite: InviteInfo | null | undefined, v: { member: boolean; role: string | null | undefined; paid: boolean }): 'join' | 'promote' | 'pay' | 'none' {
  if (invite?.state !== 'valid') return 'none';
  if (v.member) return invite.role === 'admin' && (v.role === 'member' || v.role === 'moderator') ? 'promote' : 'none';
  if (invite.role === 'admin') return 'join';
  return v.paid ? 'pay' : 'join';
}
