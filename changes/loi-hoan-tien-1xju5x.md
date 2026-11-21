---
bump: patch
---

Lời về hoàn tiền trên web, trong email và thông báo nay khớp với luật máy chủ đang chạy, theo yêu cầu của chủ dự án. Không đổi luật hoàn tiền, không có migration.

### Sửa

- **Hộp thoại "Yêu cầu hoàn tiền" ghi sai điều kiện.** Trang Gói và thanh toán ghi "chưa học quá nửa khóa" trong khi hệ thống chỉ cho hoàn khi xem chưa quá 20% nội dung. Nay ghi đúng: trong 7 ngày kể từ khi thanh toán, nếu là khóa học thì xem chưa quá 20%. Hộp thoại cũng nói rõ chuyện gì xảy ra sau khi bấm: đơn được ghi nhận hoàn ngay, quyền truy cập bị thu lại, tiền do người bán hoàn.
- **Trang sản phẩm thiếu điều kiện tiến độ.** Sản phẩm chưa có cam kết riêng hiện "Hoàn tiền trong 7 ngày", bỏ sót điều kiện 20% của khóa học. Nay khóa học hiện đủ điều kiện; combo và sản phẩm số (không bị xét tiến độ) hiện "Hoàn tiền trong 7 ngày kể từ khi thanh toán".
- **Email và thông báo hoàn tiền hứa "tiền về trong 3-7 ngày làm việc" cho mọi đơn.** Với đơn trả bằng chuyển khoản hoặc VNPAY, hệ thống không chuyển tiền được: chủ hội phải tự chuyển lại. Nay lời báo nói đúng tiền về bằng đường nào: cổng thanh toán tự hoàn về phương thức đã trả; hoặc chủ hội tự chuyển lại (kèm gợi ý nhắn chủ hội nếu chờ lâu); hoặc Hội Mình chuyển lại với đơn gói Hội Mình. Không còn hứa số ngày.

### Kỹ thuật

- Một nguồn cho luật và câu chữ ở `packages/contracts/src/commerce.ts`: `SELF_REFUND`, `selfRefundRule`, `selfRefundConditions`, `refundRouteNote`. Web, email và thông báo cùng lấy từ đây; test ở core kiểm `SELF_REFUND` khớp `BUSINESS.courseRefundDays` và `courseRefundMaxProgressPercent`.
- Sự kiện nội bộ `payment.refunded` mang thêm `route` (`gateway`, `seller_transfer`, `platform_transfer`), tính trong `applyRefund` từ kết quả hoàn và người nhận tiền của đơn. Dữ liệu gửi ra webhook của chủ hội không đổi.
- `templates.paymentRefunded` nhận thêm câu ghi chú. Cam kết mặc định khi tạo sản phẩm dùng chung `selfRefundRule('course')` (nội dung như cũ).
- Chưa sửa: dòng quyền lợi "Hoàn tiền 7 ngày nếu xem chưa quá 20%" ở trang thanh toán (`CheckoutConfigure.tsx`) vẫn hiện cho mọi loại sản phẩm; tệp đó đang được thiết kế lại ở một PR khác.
