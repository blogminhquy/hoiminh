---
bump: minor
---

Bấm chuông thì hiện bảng thông báo nổi ngay tại chỗ thay vì nhảy sang trang Thông báo, và thông báo chưa đọc luôn đứng đầu, theo yêu cầu của chủ dự án. Không có migration, không đổi API.

### Thêm

- **Bảng thông báo nổi ở nút chuông.** Bấm chuông ở đầu trang (khung hội, Khu học tập, khung chủ hội) thì bảng thông báo mở ngay tại chỗ, không rời trang đang xem. Máy tính: bảng thả dưới nút chuông, danh sách cuộn bên trong. Điện thoại: bảng trượt từ đáy lên, rộng hết màn hình, có nút đóng. Đóng bằng Esc, bấm ra ngoài, hoặc khi chuyển trang.
- **Hai mục "Chưa đọc" và "Tất cả".** Còn thông báo chưa đọc thì bảng mở sẵn mục "Chưa đọc"; đọc hết rồi thì mở "Tất cả". Ở "Tất cả", cái chưa đọc đứng trước (có chấm, chữ đậm), cái đã đọc đứng sau và nhạt hơn. Ở "Chưa đọc" mà không còn gì thì hiện lời báo đã đọc hết kèm nút xem lại thông báo đã đọc.
- **Đánh dấu đã đọc từng cái.** Mỗi thông báo chưa đọc có nút tròn "Đánh dấu đã đọc" để đọc mà không phải mở. Bấm vào thông báo thì đánh dấu đã đọc, đóng bảng và đi tới nơi thông báo nhắc tới. Nút "Đánh dấu tất cả đã đọc" chỉ bật khi còn cái chưa đọc.
- **Nút "Cài đặt" trong bảng.** Dẫn thẳng tới phần cài đặt của trang Thông báo (`/thong-bao#cai-dat`): trang tự cuộn tới "Cài đặt nhanh" và "Theo cộng đồng", kể cả trên điện thoại nơi phần này nằm dưới danh sách. Trang Thông báo trên điện thoại cũng có nút "Cài đặt thông báo" ở đầu trang.

### Thay đổi

- **Chuông hiện số thông báo chưa đọc** thay cho chấm đỏ: 1 đến 9 hiện đúng số, nhiều hơn thì "9+". Đánh dấu đã đọc thì số trên chuông và danh sách đổi ngay lúc bấm, không chờ tải lại.
- **Trang Thông báo xếp cái chưa đọc lên đầu** (khối "Chưa đọc"), phần đã đọc nhạt hơn và chia theo ngày như trước. Trang và bảng nổi dùng chung một kiểu dòng thông báo.

### Sửa

- **Nút hành động trong dòng thông báo ("Vào học", "Trả lời", "Xem ví") bị lệch.** Trước đây chữ dính sát mép trên của nút, phía dưới thừa khoảng trống, và nút đứng lệch lên trên so với dòng. Nay chữ nằm chính giữa nút, nút cao 36px và nằm giữa dòng theo chiều dọc, không xuống dòng. Trên điện thoại và trong bảng nổi (chỗ hẹp), nút nằm dưới dòng chữ, căn trái, cao 44px, để chữ không bị ép thành cột hẹp; trước đây trên điện thoại nút này bị ẩn hẳn.

### Kỹ thuật

- Nguyên nhân nút lệch: thẻ nút mang cả lớp `btn` lẫn `hide-mobile`. `.hide-mobile { display: initial }` khai báo sau `.btn` trong `styles.css` nên đè mất `display: inline-flex` của `.btn`; nút thành một khối thường, `align-items` và `justify-content` hết tác dụng nên chữ nằm ở mép trên của khung cao 36px. Thêm nữa hàng dùng `align-items: flex-start` nên nút đứng ở đầu dòng thay vì giữa dòng. Nay nút không mang `hide-mobile`, khối chữ và nút nằm trong `.notif-content` (hàng ngang khi rộng, cột khi hẹp).

- `apps/web/src/components/NotificationBell.tsx` (chuông và bảng nổi), `apps/web/src/components/NotificationRow.tsx` (dòng thông báo dùng chung), thay ba link chuông ở `AppShell.tsx`, `LearnerShell.tsx`, `WorkspaceShell.tsx`.
- `apps/web/src/lib/notifications.ts`: logic thuần (nhãn số "9+", đích của thông báo, ghép "chưa đọc" với "tất cả" và bỏ trùng, chia khối, cập nhật bộ nhớ đệm khi đánh dấu đã đọc), có test trong `notifications.test.ts`. `apps/web/src/lib/use-notifications.ts`: truy vấn và thao tác đánh dấu đã đọc dùng chung.
- Thứ tự "chưa đọc trước" làm ở giao diện bằng hai danh sách sẵn có của API (`filter=unread` và `filter=all`); `listNotifications` ở máy chủ và phân trang cursor giữ nguyên.
- Kiểu dáng thêm vào `packages/ui/src/styles.css` (các lớp `.notif-*`).
- Test trình duyệt: `e2e/tests/29-bang-thong-bao.spec.ts` (mở bảng tại chỗ, số trên chuông, đánh dấu đã đọc, Esc và bấm ra ngoài, nút Cài đặt, bảng trượt trên điện thoại).

## Quyết định

**Bấm chuông mở bảng nổi, trang Thông báo là nơi xem đầy đủ và cài đặt** ({version}, chủ dự án yêu cầu ngày 21/11/2026). Xem thông báo là việc làm lướt nhiều lần trong ngày, không nên kéo người dùng rời trang đang xem. Bảng nổi lo việc đọc nhanh (chưa đọc đứng đầu, đánh dấu đã đọc từng cái hoặc tất cả); trang `/thong-bao` giữ lại cho việc xem đầy đủ theo bộ lọc và cài đặt, tới được bằng nút "Cài đặt" và link "Xem tất cả thông báo" trong bảng. Không làm chức năng xóa thông báo: chủ dự án nói không nhất thiết, đọc và chưa đọc rõ ràng là đủ. Thứ tự "chưa đọc trước" ghép ở giao diện từ hai danh sách của API thay vì đổi thứ tự ở máy chủ, để phân trang cursor theo thời gian không bị ảnh hưởng.
