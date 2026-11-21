// Mã giới thiệu (affiliate) đi theo người xem. Link có `?ref=` ở bất kỳ trang nào (hội, sản phẩm, đăng ký) đều được
// ghi nhớ 30 ngày. Cookie nhớ NHIỀU mã (mới bấm đứng trước), vì một người có thể được nhiều affiliate giới thiệu tới
// nhiều hội khác nhau và tới nền tảng: mỗi hội chỉ tính mã của hội đó, mã mới nhất của hội đó thắng (last click).
// Máy chủ tính các mã này ở hai lúc: lúc đăng ký tài khoản mới (cả nền tảng lẫn hội), và lúc một tài khoản đã có vào
// một hội mình chưa ở (chỉ mã của hội đó). Thành viên đang ở trong hội rồi thì mã ở đây không đổi được gì, kể cả lúc
// mua hàng; muốn có hoặc đổi người giới thiệu thì tự chọn ở trang Xếp hạng affiliate.
import { joinRefs, refCodes } from '@hoiminh/contracts';
import { api } from './api';

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

/** Ghi nhớ mã giới thiệu vừa bấm: lên đầu danh sách, các mã đã nhớ giữ lại phía sau. Chuỗi rỗng hoặc null thì bỏ qua. */
export function rememberRef(code: string | null | undefined): void {
  const fresh = joinRefs(code);
  if (!fresh) return;
  const all = joinRefs(fresh, readCookie(COOKIE)) ?? fresh;
  try { document.cookie = `${COOKIE}=${encodeURIComponent(all)}; path=/; max-age=${DAYS * 86400}; samesite=lax`; } catch { /* trình duyệt chặn cookie: mã vẫn đi theo link */ }
}

const REPORTED = 'hm_ref_reported';

/**
 * Báo máy chủ một lượt mở link `?ref=<mã>` để ô "Lượt bấm" của affiliate đếm được (trước đây chỉ link `/r/<mã>` mới
 * đếm). Mỗi mã chỉ báo một lần trong một phiên trình duyệt, nên đi lại giữa các trang hay tải lại không báo thêm; máy
 * chủ còn lọc lần nữa theo người xem. Lỗi mạng thì bỏ qua: đếm lượt bấm không được phép làm hỏng trang.
 */
export function reportRefClick(ref: string | null | undefined): void {
  const code = refCodes(ref)[0];
  if (!code) return;
  try {
    const done = (sessionStorage.getItem(REPORTED) ?? '').split(',');
    if (done.includes(code)) return;
    sessionStorage.setItem(REPORTED, [...done.filter(Boolean), code].slice(-20).join(','));
  } catch { /* chế độ riêng tư chặn sessionStorage: vẫn báo, máy chủ tự lọc lượt lặp */ }
  void api.post('/v1/ref-clicks', { code, url: window.location.href.slice(0, 2000), referrer: document.referrer.slice(0, 2000) || undefined }).catch(() => { /* bỏ qua */ });
}

/** Các mã giới thiệu người xem đang mang theo, cách nhau bằng dấu phẩy: mã trên link trước, rồi tới các mã đã nhớ. */
export function currentRef(params?: URLSearchParams | null): string | null {
  return joinRefs(params?.get('ref'), readCookie(COOKIE)) ?? null;
}

/** Chuẩn hóa thứ người dùng dán vào: link có `?ref=` thì lấy mã trong link; mã trần ("hv8k2") hoặc email thì bỏ khoảng trắng và viết thường. */
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
