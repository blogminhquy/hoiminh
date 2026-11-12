// Ô lệnh "Bạn muốn làm gì?": danh sách việc có thể làm và nơi có thể tới, lọc theo quyền của người xem,
// tìm không cần gõ dấu. Hàm thuần để test được. Không có AI ở đây: gõ vài chữ, chọn một dòng, tới đúng màn.

export type CommandGroup = 'Làm ngay' | 'Đi tới' | 'Cài đặt' | 'Hệ thống';
export interface Command { id: string; group: CommandGroup; label: string; hint?: string; to: string; keywords?: string }
export interface CommandScope { slug: string; role: string; permissions: string[]; tabs: Record<string, boolean> }

/** Bỏ dấu tiếng Việt và viết thường, để "cai dat" khớp "Cài đặt". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

/** Lệnh của người quản lý một hội. Việc nào thiếu quyền hoặc hội đã tắt tab đó thì không có trong danh sách. */
export function ownerCommands(scope: CommandScope): Command[] {
  const b = `/${scope.slug}`;
  const can = (p: string) => scope.permissions.includes(p);
  const tab = (k: string) => scope.tabs[k] !== false;
  const settings = can('settings.manage');
  const money = can('billing.manage') || can('revenue.read');
  const list: Array<Command | false> = [
    tab('feed') && { id: 'post', group: 'Làm ngay', label: 'Viết bài', hint: 'Đăng lên bảng tin', to: `${b}/bang-tin/moi`, keywords: 'dang bai thong bao' },
    can('member.manage') && { id: 'invite', group: 'Làm ngay', label: 'Mời thành viên', hint: 'Gửi link mời hoặc nhập email', to: `${b}/thanh-vien?moi=1`, keywords: 'them nguoi link moi' },
    can('member.manage') && { id: 'approve', group: 'Làm ngay', label: 'Duyệt người chờ vào hội', to: `${b}/thanh-vien?trang-thai=pending`, keywords: 'cho duyet xin vao tu choi' },
    can('course.manage') && tab('courses') && { id: 'course', group: 'Làm ngay', label: 'Tạo khóa học', to: `${b}/khoa-hoc/moi`, keywords: 'them khoa bai hoc' },
    can('event.manage') && tab('events') && { id: 'event', group: 'Làm ngay', label: 'Tạo sự kiện', hint: 'Buổi trực tuyến hoặc gặp mặt', to: `${b}/su-kien/moi`, keywords: 'lich zoom livestream hop' },
    can('store.manage') && tab('store') && { id: 'product', group: 'Làm ngay', label: 'Thêm sản phẩm vào cửa hàng', to: `${b}/cua-hang/moi`, keywords: 'ban combo tai lieu' },
    can('affiliates.manage') && { id: 'payouts', group: 'Làm ngay', label: 'Trả hoa hồng cho affiliate', hint: 'Xử lý yêu cầu rút', to: `${b}/cong-su`, keywords: 'yeu cau rut chuyen khoan affiliate' },
    can('billing.manage') && { id: 'payout-account', group: 'Làm ngay', label: 'Cài tài khoản nhận tiền', hint: 'Tiền bán hàng về thẳng tài khoản của bạn', to: `${b}/cai-dat/nhan-tien`, keywords: 'rut tien ngan hang so tai khoan thanh toan qr' },
    can('billing.manage') && { id: 'confirm-orders', group: 'Làm ngay', label: 'Xác nhận đơn đã nhận tiền', to: `${b}/tien`, keywords: 'da nhan tien don cho chuyen khoan' },
    can('billing.manage') && { id: 'refund', group: 'Làm ngay', label: 'Hoàn tiền một giao dịch', to: `${b}/tien`, keywords: 'tra lai tien' },
    can('revenue.read') && { id: 'export-revenue', group: 'Làm ngay', label: 'Xuất giao dịch ra CSV', to: `${b}/tien`, keywords: 'doanh thu bao cao excel' },

    { id: 'go-home', group: 'Đi tới', label: 'Bàn điều khiển', to: `${b}/hom-nay`, keywords: 'tong quan hom nay viec can xu ly' },
    tab('feed') && { id: 'go-feed', group: 'Đi tới', label: 'Bảng tin', to: `${b}/bang-tin` },
    tab('events') && { id: 'go-events', group: 'Đi tới', label: 'Sự kiện', to: `${b}/su-kien`, keywords: 'lich' },
    tab('members') && { id: 'go-members', group: 'Đi tới', label: 'Thành viên', to: `${b}/thanh-vien`, keywords: 'danh sach nguoi' },
    tab('affiliate') && { id: 'go-rank', group: 'Đi tới', label: 'Xếp hạng affiliate', to: `${b}/xep-hang` },
    tab('courses') && { id: 'go-courses', group: 'Đi tới', label: 'Khóa học', to: `${b}/khoa-hoc` },
    tab('store') && { id: 'go-store', group: 'Đi tới', label: 'Cửa hàng', to: `${b}/cua-hang`, keywords: 'san pham' },
    money && { id: 'go-money', group: 'Đi tới', label: 'Tiền', hint: 'Đơn chờ xác nhận, doanh thu, giao dịch', to: `${b}/tien`, keywords: 'doanh thu thanh toan' },
    { id: 'go-about', group: 'Đi tới', label: 'Trang giới thiệu của hội', to: b, keywords: 'cong khai landing' },
    { id: 'go-messages', group: 'Đi tới', label: 'Tin nhắn', to: '/tin-nhan', keywords: 'chat' },
    { id: 'go-notifications', group: 'Đi tới', label: 'Thông báo', to: '/thong-bao' },
    { id: 'go-all', group: 'Đi tới', label: 'Tất cả hội của tôi', hint: 'Chuyển hội, tạo hội mới', to: '/admin', keywords: 'doi hoi khac' },
    { id: 'go-account', group: 'Đi tới', label: 'Tài khoản của tôi', hint: 'Hồ sơ, mật khẩu, đăng xuất', to: '/tai-khoan/ho-so' },

    settings && { id: 'set-general', group: 'Cài đặt', label: 'Đổi tên, logo, mô tả hội', to: `${b}/cai-dat/chung`, keywords: 'thong tin duong dan' },
    settings && { id: 'set-rules', group: 'Cài đặt', label: 'Quy tắc và câu hỏi khi tham gia', to: `${b}/cai-dat/chung`, keywords: 'noi quy' },
    settings && { id: 'set-domain', group: 'Cài đặt', label: 'Tên miền riêng', to: `${b}/cai-dat/chung`, keywords: 'domain' },
    settings && { id: 'set-spaces', group: 'Cài đặt', label: 'Chuyên mục và duyệt bài', to: `${b}/cai-dat/bang-tin`, keywords: 'bang tin quyen dang' },
    settings && { id: 'set-tabs', group: 'Cài đặt', label: 'Bật tắt các tab của hội', hint: 'Sự kiện, Cửa hàng, Xếp hạng…', to: `${b}/cai-dat/bang-tin`, keywords: 'an hien' },
    (settings || can('billing.manage')) && { id: 'set-pricing', group: 'Cài đặt', label: 'Giá và gói thành viên', to: `${b}/cai-dat/gia`, keywords: 'premium vip mien phi thu phi ban hang' },
    (settings || can('billing.manage')) && { id: 'set-providers', group: 'Cài đặt', label: 'Cách khách thanh toán', hint: 'Chuyển khoản QR, MoMo, VNPAY, PayPal', to: `${b}/cai-dat/gia`, keywords: 'cong thanh toan sepay' },
    settings && { id: 'set-affiliate', group: 'Cài đặt', label: 'Mức hoa hồng affiliate', to: `${b}/cai-dat/cong-su`, keywords: 'affiliate phan tram' },
    settings && { id: 'set-welcome', group: 'Cài đặt', label: 'Tin nhắn chào tự động', to: `${b}/cai-dat/tien-ich`, keywords: 'tien ich tu dong' },
    settings && { id: 'set-sources', group: 'Cài đặt', label: 'Nhận đơn từ landing', hint: 'Địa chỉ nhận cho form Webcake, kèm thẻ', to: `${b}/cai-dat/nguon-dong-bo`, keywords: 'nguon dong bo webhook webcake the tag' },
    settings && { id: 'set-automation', group: 'Cài đặt', label: 'Quy tắc tự động theo thẻ', hint: 'Gắn thẻ thì cho vào hội, mở khóa học, gửi email', to: `${b}/cai-dat/quy-tac`, keywords: 'automation tag kich hoat tu dong' },
    settings && { id: 'set-contacts', group: 'Cài đặt', label: 'Liên hệ và thẻ', hint: 'Người để lại email, gắn hoặc gỡ thẻ', to: `${b}/cai-dat/lien-he`, keywords: 'contact tag khach danh sach email' },
    settings && { id: 'set-pixel', group: 'Cài đặt', label: 'Pixel Facebook', to: `${b}/cai-dat/tien-ich`, keywords: 'quang cao meta' },
    settings && scope.role === 'owner' && { id: 'set-dev', group: 'Cài đặt', label: 'Khóa API và webhook', to: `${b}/cai-dat/nha-phat-trien`, keywords: 'nha phat trien mcp ket noi' },
    scope.role === 'owner' && { id: 'set-plan', group: 'Cài đặt', label: 'Gói của hội', hint: 'Xem gói, trần thành viên, gia hạn, nâng gói', to: `/admin/goi?hoi=${scope.slug}`, keywords: 'nen tang hoi minh nang cap tran thanh vien' },
  ];
  return list.filter((c): c is Command => Boolean(c));
}

/** Lệnh của quản trị hệ thống. */
export function adminCommands(): Command[] {
  const b = '/he-thong';
  return [
    { id: 'a-home', group: 'Hệ thống', label: 'Tổng quan hệ thống', to: b, keywords: 'gmv so lieu' },
    { id: 'a-communities', group: 'Hệ thống', label: 'Hội', hint: 'Tìm, khóa, mở khóa hội', to: `${b}/hoi` },
    { id: 'a-users', group: 'Hệ thống', label: 'Người dùng', to: `${b}/nguoi-dung`, keywords: 'tai khoan email' },
    { id: 'a-reported', group: 'Hệ thống', label: 'Hội bị báo cáo', to: `${b}/ho-tro`, keywords: 'ho tro khieu nai' },
    { id: 'a-user-reports', group: 'Hệ thống', label: 'Báo cáo người dùng', to: `${b}/bao-cao`, keywords: 'bao cao chan spam quay roi lua dao' },
    { id: 'a-payments', group: 'Hệ thống', label: 'Thanh toán và đối soát', hint: 'Ghép chuyển khoản thiếu mã', to: `${b}/thanh-toan`, keywords: 'giao dich sepay' },
    { id: 'a-affiliate', group: 'Hệ thống', label: 'Affiliate nền tảng', hint: 'Trả hoa hồng giới thiệu Hội Mình', to: `${b}/cong-su`, keywords: 'yeu cau rut' },
    { id: 'a-plans', group: 'Hệ thống', label: 'Gói nền tảng', hint: 'Giá, trần thành viên và tính năng của bốn gói', to: `${b}/goi` },
    { id: 'a-flags', group: 'Hệ thống', label: 'Bật tắt tính năng', to: `${b}/tinh-nang`, keywords: 'co feature flag' },
    { id: 'a-infra', group: 'Hệ thống', label: 'Hạ tầng và khóa', hint: 'Khóa cổng thanh toán, email, lưu trữ', to: `${b}/ha-tang`, keywords: 'api key cau hinh' },
    { id: 'a-versions', group: 'Hệ thống', label: 'Phiên bản', to: `${b}/phien-ban`, keywords: 'cap nhat release' },
    { id: 'a-logs', group: 'Hệ thống', label: 'Nhật ký và webhook', to: `${b}/nhat-ky`, keywords: 'log loi audit' },
    { id: 'a-my', group: 'Đi tới', label: 'Hội của tôi', to: '/admin' },
  ];
}

/**
 * Lọc và xếp hạng lệnh theo chữ đang gõ. Mọi từ đều phải có mặt (không cần dấu, không cần đúng thứ tự).
 * Khớp ở đầu tên lệnh đứng trước, rồi khớp trong tên, cuối cùng là khớp ở gợi ý và từ khóa. Ô trống thì trả nguyên danh sách.
 */
export function searchCommands(list: Command[], query: string): Command[] {
  const q = fold(query);
  if (!q) return list;
  const words = q.split(/\s+/);
  const scored: Array<{ c: Command; score: number; i: number }> = [];
  list.forEach((c, i) => {
    const label = fold(c.label);
    const rest = fold(`${c.hint ?? ''} ${c.keywords ?? ''}`);
    if (!words.every((w) => label.includes(w) || rest.includes(w))) return;
    const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : words.every((w) => label.includes(w)) ? 2 : 3;
    scored.push({ c, score, i });
  });
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((s) => s.c);
}
