---
bump: minor
---

Thành viên thấy Affiliate ngay trên thanh bên của hội, kèm phần trăm hoa hồng, và link giới thiệu với bảng xếp hạng về chung một trang, theo yêu cầu của chủ dự án ngày 21/11/2026. Không có migration.

### Thêm

- **Mục "Affiliate" trên thanh bên của hội, kèm phần trăm hoa hồng.** Thành viên của hội đang bật affiliate thấy mục "Affiliate" ở nhóm Hội, bên phải là mức hoa hồng của chính họ (ví dụ "40%"). Trước đây muốn lấy link phải vào Tài khoản, Affiliate nên khó tìm. Mục này hiện cả trên menu của điện thoại; thanh bên thu gọn thì còn biểu tượng.
- **Trang Affiliate của thành viên trong hội.** Trang `/<hội>/xep-hang` (địa chỉ cũ giữ nguyên) nay có tiêu đề "Affiliate", nói rõ quyền lợi bằng số thật ("Giới thiệu người vào <tên hội>, nhận 40% hoa hồng mỗi lần họ trả phí") và có hai tab. "Link của tôi" mở sẵn: chọn trang muốn chia sẻ, sao chép link, xem lượt bấm, đăng ký, trả phí, hai ô ví (Đang giữ, Có thể rút) và nút "Xem ví và rút tiền" sang trang ví đầy đủ. "Xếp hạng" là bảng xếp hạng như trước. Tab đang mở nằm trên địa chỉ (`?tab=link`, `?tab=xep-hang`). Thẻ "Người giới thiệu của bạn" vẫn ở trang này.
- **Đổi mã giới thiệu ngay trong trang Affiliate của hội.** Tab "Link của tôi" có nút "Đổi mã" như ở trang Affiliate của tôi (mỗi người đổi được một lần, một mã dùng cho mọi chương trình). Đổi xong thì link ở mọi ví, bảng xếp hạng và trang sản phẩm đổi theo.

### Thay đổi

- **Mục Affiliate không còn phụ thuộc bảng xếp hạng.** Trước đây thanh bên chỉ có mục "Xếp hạng affiliate", và mục đó biến mất khi bảng xếp hạng bị tắt (cờ `affiliate_leaderboard` của nền tảng tắt hoặc chưa được tạo, chủ hội tắt tab), dù chương trình affiliate của hội vẫn chạy. Nay mục "Affiliate" hiện khi người xem là thành viên, chương trình của hội đang bật và gói của hội có affiliate. Bảng xếp hạng bị tắt thì trang chỉ còn phần link, không báo lỗi. Chương trình tắt thì thành viên không thấy mục này.
- **Tab "Xếp hạng" theo đúng cài đặt của chủ hội.** Mở cho thành viên thì ai cũng thấy; chỉ cho affiliate thì hiện sau khi thành viên lấy link; ẩn thì chỉ người quản lý thấy, kèm dòng nhắc bảng đang tắt với thành viên.
- **Phân biệt với phần quản lý của chủ hội.** Mục của thành viên nằm ở nhóm Hội với biểu tượng phần trăm; mục quản lý chương trình của chủ hội vẫn ở nhóm Quản lý. Người quản lý có thêm nút "Quản lý chương trình" trên trang Affiliate.
- Ô lệnh của người quản lý: lệnh "Xếp hạng affiliate" đổi thành "Affiliate của hội: link và xếp hạng", hiện theo cùng điều kiện với mục trên thanh bên. Chip "Xếp hạng" ở trang quản lý affiliate mở thẳng tab Xếp hạng.
- Bảng xếp hạng: ô không có số liệu ghi "Ẩn" hoặc "Giữ hạng" thay cho dấu gạch.

### Kỹ thuật

- `packages/core/src/services/shell.ts`: khung hội trả thêm `affiliate` cho thành viên (`programId`, `enabled`, `rateBps` là mức riêng của tài khoản affiliate người xem nếu có, `durationMonths`, `hasAccount`, `leaderboardVisibility`); khách và hội chưa có chương trình nhận `null`. Chỉ đọc, không mở tài khoản affiliate. Test: `packages/core/src/test/shell-affiliate.test.ts`.
- `apps/web/src/lib/affiliate-nav.ts`: điều kiện hiện mục, điều kiện hiện tab Xếp hạng, tab đang mở theo địa chỉ. Test: `apps/web/src/lib/affiliate-nav.test.ts`.
- Ví chỉ tải khi mở tab "Link của tôi", vì gọi API ví là mở tài khoản affiliate cho người xem.

## Quyết định

**Affiliate của thành viên nằm trong hội, tách khỏi bảng xếp hạng** ({version}, chủ dự án yêu cầu ngày 21/11/2026). Mục "Affiliate" ở nhóm Hội trên thanh bên hiện theo chương trình affiliate của hội (đang bật, gói có affiliate), không theo cờ `affiliate_leaderboard` hay tab bảng xếp hạng: hai thứ đó nay chỉ quyết định tab "Xếp hạng" bên trong trang. `tabs.affiliate` của khung hội vì vậy chỉ còn nghĩa là "bảng xếp hạng". Địa chỉ `/<hội>/xep-hang` giữ nguyên vì link đã chia sẻ và thông báo đang dẫn tới đó. Trang ví đầy đủ (rút tiền, tài khoản nhận tiền, lịch sử) vẫn ở Tài khoản, Affiliate.
