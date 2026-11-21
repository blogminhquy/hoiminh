---
bump: patch
---

Thông tin riêng của thành viên trong khung chat chỉ còn người quản lý hội thấy, theo yêu cầu của chủ dự án. Không có migration.

### Sửa

- **Ai trò chuyện cũng xem được tiến độ học và người giới thiệu của người kia.** Bảng "Thông tin hội thoại" trong Tin nhắn vốn làm cho chủ hội xem thành viên của mình, nhưng máy chủ trả đủ thông tin cho bất kỳ ai đang trò chuyện. Vì vậy một thành viên thường mở cuộc trò chuyện với thành viên khác (hoặc với chủ hội) là thấy tình trạng thành viên, giá gói, khóa đang học kèm phần trăm tiến độ, và người đã giới thiệu người đó. Nay chỉ chủ hội và quản trị của hội thấy các thông tin này.
- Người xem khác (thành viên thường, điều hành viên) chỉ còn thấy đúng những gì danh bạ thành viên của hội vốn đã cho mọi thành viên xem: vai trò, tên gói, ngày tham gia.

### Kỹ thuật

- `packages/core/src/services/messaging.ts`: `memberPanel` kiểm quyền `member.manage` của người xem trong hội của cuộc trò chuyện; không có quyền thì `status`, `tier.monthlyMinor`, `learning`, `referrer` là null. Giao diện vốn tự ẩn các dòng không có dữ liệu nên không phải sửa bố cục.
- Test: `packages/core/src/test/messaging.test.ts` thêm 2 ca (chủ hội thấy đủ, thành viên thường và chiều ngược lại chỉ thấy phần công khai, hội thoại không gắn hội thì không có thông tin thành viên).

## Quyết định

**Thông tin riêng của thành viên trong khung chat chỉ dành cho người quản lý thành viên** ({version}, chủ dự án yêu cầu ngày 22/11/2026). Mốc chọn là quyền `member.manage` (chủ hội, quản trị), không phải `member.read` mà thành viên nào cũng có. Phần người khác còn thấy lấy đúng theo danh bạ thành viên (`memberDirectory`): vai trò, tên gói, ngày tham gia. Giá gói tuy công khai ở trang giá của hội nhưng không gắn vào từng người khi người xem không quản lý hội.
