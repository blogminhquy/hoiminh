// Khách xem hội mở (chưa là thành viên, có thể chưa đăng nhập): mở được trang nào trong hội và trang mở đầu là trang nào.
// Máy chủ mới là nơi quyết định khách đọc được gì; bảng ở đây chỉ để không đưa khách vào trang chắc chắn báo lỗi.

/** Các trang trong hội mà khách xem được: bảng tin, bài viết, khóa học, bài học, cửa hàng, sự kiện, thành viên. */
const GUEST_PAGES = /^(bang-tin|bai-viet\/[^/]+|khoa-hoc|khoa-hoc\/[^/]+|bai\/[^/]+|cua-hang|cua-hang\/[^/]+|su-kien|su-kien\/[^/]+|thanh-vien)\/?$/;
/** Trang tạo mới (viết bài, tạo khóa học, sản phẩm, sự kiện) trùng dạng đường dẫn với trang xem nên phải loại riêng. */
const CREATE_PAGES = /^(khoa-hoc|cua-hang|su-kien)\/moi\/?$/;

/** Khách có mở được đường dẫn này trong hội không. */
export function guestCanOpen(pathname: string, slug: string): boolean {
  const base = `/${slug}/`;
  if (!pathname.startsWith(base)) return false;
  const rest = pathname.slice(base.length);
  return GUEST_PAGES.test(rest) && !CREATE_PAGES.test(rest);
}

/** Trang mở đầu cho khách: tab đầu tiên hội đang bật; hội tắt hết thì về trang giới thiệu. */
export function guestHome(slug: string, tabs: Record<string, boolean>): string {
  if (tabs.feed !== false) return `/${slug}/bang-tin`;
  if (tabs.courses !== false) return `/${slug}/khoa-hoc`;
  if (tabs.events !== false) return `/${slug}/su-kien`;
  if (tabs.members !== false) return `/${slug}/thanh-vien`;
  return `/${slug}`;
}

/** Trang bán của một sản phẩm (`/<hội>/cua-hang/<sản phẩm>`), không tính trang tạo mới và trang sửa. */
const SALE_PAGE = /^cua-hang\/(?!moi\/?$)[^/]+\/?$/;

/**
 * Đường dẫn này có phải trang bán của một sản phẩm không. Trang bán là trang để bán hàng nên ai cũng mở được, kể cả
 * người chưa đăng nhập và kể cả khi hội đang là hội kín: link sản phẩm của affiliate phải đưa người lạ tới đúng sản
 * phẩm. Người ngoài mua lẻ được mà không cần vào hội; mọi trang khác của hội kín vẫn đóng.
 */
export function isSalePage(pathname: string, slug: string): boolean {
  const base = `/${slug}/`;
  return pathname.startsWith(base) && SALE_PAGE.test(pathname.slice(base.length));
}
