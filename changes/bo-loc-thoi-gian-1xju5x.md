---
bump: minor
---

Ba việc theo yêu cầu của chủ dự án ngày 21/11/2026: mọi bộ lọc thời gian dùng chung một bảng lọc khoảng ngày đầy đủ; mục "Tiền" của hội thành "Quản lý đơn hàng" có hai tab Thống kê và Tất cả đơn hàng; nhãn trên thanh bên ghi rõ mục nào của hội, mục nào của cá nhân. Không có migration.

### Thêm

- **Bảng lọc khoảng ngày dùng chung.** Trang Quản lý đơn hàng, Bàn điều khiển của chủ hội và Tổng quan hệ thống bỏ các nút "Hôm nay / 30 ngày / Quý / Năm", thay bằng một bảng lọc có đủ các mốc: Hôm nay, Hôm qua, 7 ngày qua, 30 ngày qua, 90 ngày qua, Tháng trước, Đầu tuần đến nay, Đầu tháng đến nay, Từ trước đến nay. Bấm một mốc là số liệu đổi ngay. Muốn khoảng riêng thì gõ hai ô ngày (dạng ngày/tháng/năm, trên điện thoại gõ liền số cũng được) hoặc bấm ngày đầu rồi ngày cuối trên lịch, xong bấm Áp dụng. Nút mở bảng lọc luôn ghi tên mốc hoặc khoảng ngày đang xem, ví dụ "30 ngày qua" hoặc "08/10/2026 đến 20/11/2026".
- **Bảng lọc dễ bấm trên điện thoại.** Trên điện thoại bảng lọc trượt lên từ đáy màn hình, các mốc xếp hai cột, lịch hiện một tháng, chữ từ 15px và ô bấm cao từ 44px, không tràn ngang. Trên máy tính là bảng hai cột: mốc bên trái, hai tháng lịch bên phải. Dùng được bằng bàn phím: Esc đóng, Tab đi qua các nút, phím mũi tên đi giữa các ngày. Bấm ra ngoài thì đóng.
- **Trang Quản lý đơn hàng với hai tab.** Tab Thống kê có bộ lọc khoảng ngày, bốn ô số liệu (Tổng thu, Đã thu, Nợ affiliate, Hoàn tiền), số đơn đặt trong kỳ theo từng trạng thái, và phần tiền đã thu đến từ người giới thiệu so với phần còn lại. Tab Tất cả đơn hàng liệt kê mọi đơn của hội, đơn mới đặt nằm trên. Tab đang mở nằm trên địa chỉ nên tải lại trang hay gửi link vẫn mở đúng tab.
- **Lọc và tìm đơn hàng.** Tab Tất cả đơn hàng lọc được theo khoảng ngày đặt (mở sẵn 90 ngày qua, có Từ trước đến nay), theo trạng thái (Chờ xác nhận, Chờ thanh toán, Đã thanh toán, Hết hạn, Đã hoàn tiền), theo affiliate (có người giới thiệu hoặc không), và tìm theo tên người mua, tên sản phẩm hoặc mã đơn. Mỗi đơn hiện ngày giờ đặt, người mua, sản phẩm, mã đơn, cách thanh toán, số tiền, người giới thiệu kèm hoa hồng phải trả, và nhãn trạng thái có màu. Phía trên danh sách luôn có tổng số đơn và tổng giá trị của kết quả đang lọc. Danh sách tải từng 30 đơn, bấm "Xem thêm" để tải tiếp. Trên điện thoại mỗi đơn là một thẻ, không phải cuộn ngang.
- **Xác nhận và hoàn tiền ngay trên dòng đơn.** Đơn chuyển khoản đang chờ có nút "Đã nhận tiền" ngay trên dòng; đơn đã thanh toán có nút "Hoàn tiền".
- **Xuất CSV theo đúng bộ lọc.** Bản xuất lấy đủ mọi đơn khớp bộ lọc đang chọn (tới 5.000 đơn), không chỉ các đơn đang hiện trên màn hình, và có thêm cột mã đơn, ngày đặt, ngày trả, người giới thiệu, hoa hồng. Tên tệp mang khoảng ngày đã chọn.
- **API và MCP nhận khoảng ngày.** `GET /v1/communities/:id/revenue`, `/overview` và `GET /v1/admin/overview` nhận `from` và `to` dạng YYYY-MM-DD (ngày theo giờ Việt Nam, tính cả hai đầu); chỉ gửi `to` là lấy từ trước đến nay. Kết quả trả thêm `range` cho biết khoảng đã áp dụng. API mới `GET /v1/communities/:id/orders` liệt kê đơn hàng có lọc và phân trang, kèm lệnh MCP `list_orders`; các lệnh `get_revenue` và `get_community_overview` nhận thêm `from`, `to`.

### Thay đổi

- **"Tiền" đổi thành "Đơn hàng".** Mục trên thanh bên, ô tắt trên Bàn điều khiển, mục trong trang Tôi và ô lệnh nhanh đều ghi "Đơn hàng"; tiêu đề trang là "Quản lý đơn hàng". Địa chỉ trang giữ nguyên nên link trong email và thông báo cũ vẫn mở đúng. Chỉ chủ hội và quản trị của hội thấy mục này; thành viên thường không thấy và gọi API thì bị từ chối, như trước.
- **Phần cần xử lý ngay nằm trên cùng, gọn hơn.** Thông tin cách nhận tiền thu về một khối nhỏ. Khối "Đơn chờ bạn xác nhận" chỉ hiện khi có đơn đang chờ.
- **Nhãn ghi rõ của hội hay của cá nhân.** Nhóm Quản lý trên thanh bên ghi "Quản lý affiliate" và "Cài đặt hội" (trước là "Affiliate", "Cài đặt"); tiêu đề hai trang đó và nhóm lệnh trong ô lệnh nhanh đổi theo. Mục affiliate của riêng mỗi người trong trang Tôi và trang Tài khoản ghi "Affiliate của tôi".
- **"Hôm nay" là ngày lịch theo giờ Việt Nam.** Trước đây "Hôm nay" tính 24 giờ gần nhất, nên xem lúc 9 giờ sáng vẫn lẫn đơn của chiều hôm qua. Nay mọi mốc tính theo ngày lịch giờ Việt Nam: "Hôm nay" bắt đầu từ 00:00, "30 ngày qua" là 30 ngày lịch tính cả hôm nay. Biểu đồ doanh thu theo ngày cũng gom theo ngày giờ Việt Nam.
- **So sánh với kỳ trước dùng đúng khoảng liền trước.** Ở Bàn điều khiển, phần trăm tăng giảm so với khoảng liền trước có cùng số ngày. Chọn "Từ trước đến nay" thì không có kỳ trước nên không hiện phần tăng giảm.
- **Biểu đồ doanh thu gọn hơn với kỳ dài.** Kỳ trên 31 ngày thì gom vài ngày vào một cột (tiêu đề ghi rõ mỗi cột mấy ngày), để biểu đồ không vỡ trên điện thoại.
- **Số liệu "Đã thu 30 ngày" giữ nguyên**, không theo bộ lọc.

### Sửa

- **Bảng giao dịch và ô số liệu lệch nhau ở đầu kỳ.** Số liệu tính theo ngày trả tiền còn danh sách đơn gần đây của API doanh thu lọc theo ngày tạo đơn, nên đơn tạo hôm trước mà trả hôm nay có trong số liệu nhưng không có trong danh sách. Nay danh sách đó lọc theo đúng ngày đang hiện.
- **Dấu gạch ngang dài ở Tổng quan hệ thống.** Khoảng ngày của biểu đồ GMV viết bằng chữ "đến".

### Kỹ thuật

- `packages/contracts/src/date-range.ts`: phép tính ngày lịch giờ Việt Nam (`vnDay`, `shiftDay`, `daySpan`, `weekdayMon`), `dateRangeQuerySchema`, `revenueQuerySchema`, `resolveDayRange`. `packages/contracts/src/orders.ts`: trạng thái hiển thị của đơn và `ordersQuerySchema`. Tham số `days` cũ vẫn chạy (bản web cũ còn mở trong trình duyệt), nay là N ngày lịch gần nhất tính cả hôm nay.
- `packages/core/src/lib/period.ts`: `resolvePeriod` đổi khoảng ngày thành hai mốc thời gian và kỳ liền trước; `inSpan` dựng điều kiện SQL. `revenue.revenue`, `revenue.settingsOverview`, `admin.overview` dùng chung. `admin.overview` tính theo đồng hồ của ứng dụng thay cho `now()` của database.
- `packages/core/src/services/revenue.ts`: `listOrders` (quyền `revenue.read`, cùng quyền với doanh thu), phân trang bằng con trỏ giữ đủ phần triệu giây của thời điểm đặt đơn; `revenue.revenue` trả thêm `ordersByStatus` và `stats.referredMinor`. Chỉ đọc các bảng affiliate.
- `apps/web/src/lib/date-range.ts` (mốc, ô nhập ngày, lưới lịch, cột biểu đồ) và `apps/web/src/lib/orders.ts` là hàm thuần có test. `apps/web/src/components/DateRangePicker.tsx` là thành phần dùng chung; kiểu dáng ở `packages/ui/src/styles.css` (lớp `drp-*`, `order-*`).
- Test: `packages/core/src/test/date-range.test.ts`, `packages/core/src/test/orders-list.test.ts`, `apps/web/src/lib/date-range.test.ts`, `apps/web/src/lib/orders.test.ts`, thêm ca trong `apps/api/src/api.test.ts`; E2E 04 và 12 sửa theo nhãn mới và hai tab.

## Quyết định

**Kỳ số liệu là ngày lịch theo giờ Việt Nam, tính cả hai đầu** ({version}, chủ dự án yêu cầu ngày 21/11/2026). Mọi bộ lọc thời gian của số liệu (đơn hàng, doanh thu, tổng quan) dùng khoảng ngày `from` đến `to` theo giờ Việt Nam (UTC+7), kỳ chạy từ 00:00 của ngày đầu tới hết ngày cuối. "N ngày qua" tính cả hôm nay. Tuần bắt đầu từ thứ Hai. "Từ trước đến nay" không có ngày đầu và không có so sánh với kỳ trước. Lý do: chủ hội đọc số theo ngày, cách tính 24 giờ gần nhất làm "Hôm nay" lẫn đơn của hôm qua.

**Danh sách đơn theo ngày đặt, tiền theo ngày trả** ({version}, phiên làm việc chọn ngày 21/11/2026 khi dựng trang Quản lý đơn hàng theo yêu cầu của chủ dự án). Tab Tất cả đơn hàng lọc và xếp theo thời điểm đặt đơn (không đổi sau khi đơn được trả, nên phân trang ổn định); các ô tiền ở tab Thống kê tính theo thời điểm trả. "Chờ xác nhận" dùng đúng điều kiện của khối "Đơn chờ bạn xác nhận": đơn chuyển khoản vào tài khoản chủ hội, chưa trả, trong 7 ngày, kể cả khi đã quá hạn giữ chỗ. Đơn qua cổng chưa trả là "Chờ thanh toán", quá hạn giữ chỗ là "Hết hạn".

**Bấm mốc là áp dụng ngay** ({version}, phiên làm việc chọn ngày 21/11/2026, chủ dự án chưa duyệt riêng điểm này). Trong bảng lọc khoảng ngày, bấm một mốc có sẵn thì áp dụng và đóng luôn; chỉ khoảng tự chọn mới cần bấm Áp dụng. Lý do: chủ dự án xem chủ yếu trên điện thoại, đổi kỳ chỉ nên tốn hai lần chạm.
