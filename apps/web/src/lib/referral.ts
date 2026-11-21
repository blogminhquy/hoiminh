// Mã giới thiệu (affiliate) đi theo người xem. Link có `?ref=` ở bất kỳ trang nào (hội, sản phẩm, đăng ký) đều được
// ghi nhớ 30 ngày, lượt bấm sau đè lượt bấm trước (last click). Đây chỉ là lượt bấm của người CHƯA có người giới
// thiệu: thành viên đã có người giới thiệu thì máy chủ luôn tính cho người đó, mã ghi nhớ ở đây không đổi được.
const COOKIE = 'hm_ref';
const DAYS = 30;

/** Đọc cookie theo tên. */
export function readCookie(name: string): string | null {
  try {
    const m = document.cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
  } catch {
    return null;
  }
}

/** Ghi nhớ mã giới thiệu vừa bấm. Chuỗi rỗng hoặc null thì bỏ qua, không xóa mã đang nhớ. */
export function rememberRef(code: string | null | undefined): void {
  const c = code?.trim();
  if (!c) return;
  try { document.cookie = `${COOKIE}=${encodeURIComponent(c)}; path=/; max-age=${DAYS * 86400}; samesite=lax`; } catch { /* trình duyệt chặn cookie: mã vẫn đi theo link */ }
}

/** Mã giới thiệu đang có hiệu lực với người xem: mã trên link trước, rồi tới mã đã ghi nhớ. */
export function currentRef(params?: URLSearchParams | null): string | null {
  return params?.get('ref')?.trim() || readCookie(COOKIE);
}

/** Lấy mã từ thứ người dùng dán vào: mã trần ("hv8k2") hoặc cả link có `?ref=`. */
export function refCodeOf(input: string): string {
  const text = input.trim();
  const fromLink = /[?&]ref=([^&#\s]+)/i.exec(text)?.[1];
  let code = fromLink ?? text;
  try { code = decodeURIComponent(code); } catch { /* giữ nguyên chuỗi gốc */ }
  return code.trim().toLowerCase();
}

/**
 * Hội đã đổi đường dẫn: địa chỉ đang mở dùng đường dẫn cũ thì trả về địa chỉ mới, giữ nguyên trang con, tham số
 * (kể cả `?ref=`) và dấu `#`. Đang đúng đường dẫn thì trả null.
 */
export function movedSlugPath(loc: { pathname: string; search: string; hash: string }, urlSlug: string | undefined, actualSlug: string): string | null {
  if (!urlSlug || urlSlug === actualSlug) return null;
  const prefix = `/${urlSlug}`;
  if (loc.pathname !== prefix && !loc.pathname.startsWith(`${prefix}/`)) return null;
  return `/${actualSlug}${loc.pathname.slice(prefix.length)}${loc.search}${loc.hash}`;
}
