// Giữ "người này đang muốn vào hội nào" qua bước đăng ký, đăng nhập và Google, để xong là vào thẳng hội đó
// thay vì rơi về màn Tạo hội hay trang chủ.
//   - Trang giới thiệu hội nhận `?thamgia=1`: người đã đăng nhập thì tự chạy đúng việc của nút "Tham gia"
//     (hội miễn phí vào luôn Bảng tin, hội có câu hỏi thì mở bảng câu hỏi, hội thu phí thì sang thanh toán).
//   - Google rời khỏi trang rồi quay về /auth/callback, nên đích được cất tạm trong sessionStorage.

/** Tham số trên trang giới thiệu hội báo "vừa đăng ký hoặc đăng nhập xong, cho tôi vào hội". */
export const JOIN_PARAM = 'thamgia';

const AFTER_AUTH_KEY = 'hm_after_auth';

/** Chỉ nhận đường dẫn trong trang ("/..."), không nhận địa chỉ ngoài ("//evil.example", "https://..."). */
export function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : null;
}

/** Trang giới thiệu hội kèm ý định tham gia: đích sau khi đăng ký từ một hội. */
export function joinPath(slug: string): string {
  return `/${slug}?${JOIN_PARAM}=1`;
}

/** Link đăng ký từ trang của một hội. Mã giới thiệu (nếu có) đi kèm để màn đăng ký hiện đúng người giới thiệu. */
export function signupPathFor(slug: string, ref?: string | null): string {
  return `/dang-ky?hoi=${encodeURIComponent(slug)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`;
}

/** Link đăng nhập quay lại đúng chỗ. */
export function loginPathFor(next: string): string {
  return `/dang-nhap?next=${encodeURIComponent(next)}`;
}

/** Cất đích trước khi rời sang Google. Truyền null để xóa đích cũ, kẻo lần đăng nhập sau bị đưa nhầm chỗ. */
export function rememberAfterAuth(next: string | null | undefined): void {
  try {
    const safe = safeNext(next);
    if (safe) window.sessionStorage.setItem(AFTER_AUTH_KEY, safe);
    else window.sessionStorage.removeItem(AFTER_AUTH_KEY);
  } catch { /* trình duyệt chặn bộ nhớ phiên: bỏ qua, người dùng về đích mặc định */ }
}

/** Lấy đích đã cất và xóa luôn, để chỉ dùng một lần. */
export function takeAfterAuth(): string | null {
  try {
    const next = safeNext(window.sessionStorage.getItem(AFTER_AUTH_KEY));
    window.sessionStorage.removeItem(AFTER_AUTH_KEY);
    return next;
  } catch {
    return null;
  }
}
