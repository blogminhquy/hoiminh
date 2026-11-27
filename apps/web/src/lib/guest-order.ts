// Mua trước, tạo tài khoản sau: người chưa đăng nhập mua bằng email. Máy chủ trả một mã đơn cho trình duyệt; mã này đi
// trên địa chỉ trang đơn (`/thanh-toan/<đơn>?g=<mã>`, cổng thanh toán đưa về đúng địa chỉ đó) và được nhớ trong trình duyệt,
// để xem đơn, báo đã chuyển khoản và đặt mật khẩu ngay sau khi trả. Hàm thuần để test được.

const KEY_PREFIX = 'hm_guest_order:';
const TOKEN = /^[0-9a-f]{40}$/;

/** Trang của một đơn mua khi chưa đăng nhập. */
export function guestOrderPath(orderId: string, token: string): string {
  return `/thanh-toan/${orderId}?g=${token}`;
}

/** Nhớ mã đơn trong trình duyệt (trình duyệt chặn bộ nhớ thì thôi: mã vẫn nằm trên địa chỉ trang). */
export function rememberGuestToken(orderId: string, token: string, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try { storage?.setItem(KEY_PREFIX + orderId, token); } catch { /* bỏ qua */ }
}

/** Mã đơn của trang đang mở: trên địa chỉ trước, không có thì mã đã nhớ. Mã sai dạng thì coi như không có. */
export function guestTokenFor(orderId: string, fromUrl: string | null, storage: Pick<Storage, 'getItem'> | null = safeStorage()): string | null {
  if (fromUrl && TOKEN.test(fromUrl)) return fromUrl;
  try {
    const saved = storage?.getItem(KEY_PREFIX + orderId) ?? null;
    return saved && TOKEN.test(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Email nhìn có vẻ đúng để bật nút mua. Máy chủ mới là nơi kiểm tra thật. */
export function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

/** Lỗi "email này đã có tài khoản": giao diện mời đăng nhập thay vì chỉ báo lỗi. */
export function isAccountExists(err: unknown): boolean {
  const e = err as { code?: string; details?: { reason?: string } } | null;
  return e?.code === 'conflict' && e.details?.reason === 'account_exists';
}

/** Mật khẩu đủ điều kiện như ở trang đăng ký: ít nhất 8 ký tự, có chữ và số. */
export function passwordReady(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw);
}

function safeStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}
