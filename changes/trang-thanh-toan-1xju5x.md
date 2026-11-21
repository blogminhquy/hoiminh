---
bump: minor
---

Thiết kế lại cả luồng thanh toán của một hội theo yêu cầu của chủ dự án: trang chọn gói, màn mã QR chuyển khoản, và màn cảm ơn chờ xác nhận sau khi bấm "Tôi đã chuyển khoản". Chủ hội nay nhận email khi có người báo đã chuyển khoản và khi có đơn đã thanh toán. Không có migration, không đổi cách tính tiền hay cách tạo đơn.

### Thay đổi

- **Trang thanh toán của hội xếp một cột, từ trên xuống.** Trước đây trang chia hai cột hẹp lệch nhau, ô chọn thời hạn chật và vỡ chữ, nhãn "Rẻ hơn" nổi đè lên viền. Nay mọi thứ nằm trong một cột rộng (khoảng 660px trên máy tính, hết bề ngang trên điện thoại): tên hội và tên gói, Chọn thời hạn, Quyền lợi của gói, Cách thanh toán, Mã giảm giá, Tóm tắt đơn, rồi nút thanh toán. Mỗi thời hạn (1, 3, 12 tháng) là một hàng rộng: tên và nhãn "Rẻ hơn" nằm gọn bên trái, tổng tiền in đậm và giá quy ra mỗi tháng bên phải. Mỗi cách thanh toán cũng là một hàng cùng kiểu. Trang mua sản phẩm lẻ dùng cùng bố cục.
- **Điện thoại: tổng tiền và nút thanh toán ghim dưới đáy màn hình**, lúc nào cũng bấm được, cuộn hết trang thì thanh nằm lại cuối luồng nên không che dòng nào. Chữ lớn hơn (chữ thường từ 15px, tên lựa chọn và số tiền 17px), hàng bấm được cao từ 48px.
- **Màn mã QR chuyển khoản xếp một cột.** Tóm tắt đơn gọn trong một khối, "Tổng thanh toán" và số tiền nằm trên cùng một hàng, hạn giữ chỗ viết kiểu "19:16 ngày 21/11". Có ba bước hướng dẫn ngắn, mã QR to (đủ quét từ màn hình máy tính), rồi từng hàng rộng: Ngân hàng, Chủ tài khoản, Số tài khoản, Số tiền, Nội dung chuyển khoản. Ba hàng sau có nút "Sao chép" (bấm xong đổi thành "Đã sao chép"; số tiền chép ra số trơn không dấu chấm). Hàng nội dung chuyển khoản được làm nổi, câu lưu ý giữ đúng nội dung thành một khối nhắc riêng.
- **Chọn bằng bàn phím.** Hai nhóm lựa chọn (thời hạn, cách thanh toán) là nhóm radio đúng chuẩn: phím mũi tên chuyển và chọn hàng kế.

### Thêm

- **Nút "Lưu ảnh mã QR".** Người dùng điện thoại không tự quét được màn hình của mình, nên lưu ảnh mã về rồi chọn ảnh đó trong app ngân hàng. Nút chỉ hiện khi trình duyệt tải được ảnh về thật.
- **Màn cảm ơn và chờ xác nhận.** Sau khi bấm "Tôi đã chuyển khoản", người mua thấy một màn riêng thay vì chỉ một nút đổi chữ: lời cảm ơn, vòng xoay chờ và dòng nói rõ đang chờ gì (chủ hội kiểm tra tài khoản và xác nhận, hoặc ngân hàng báo về), tóm tắt đơn kèm nội dung chuyển khoản, và thẻ chủ hội (ảnh, tên, tên định danh) với nút "Nhắn tin cho chủ hội" để gửi ảnh chụp giao dịch khi chờ lâu. Chủ hội tắt nhận tin nhắn riêng thì thay bằng link xem hồ sơ. Có mục "Xem lại thông tin chuyển khoản" để mở lại mã QR, và nút "Về trang hội". Trang tự chuyển sang màn "Đã nhận thanh toán" khi đơn được xác nhận, với nút vào thẳng thứ vừa mua.
- **Email cho chủ hội khi có người báo đã chuyển khoản.** Ở đơn chủ hội tự xác nhận, người mua bấm "Tôi đã chuyển khoản" thì chủ hội nhận một email: ai mua, mua gì, số tiền, nội dung chuyển khoản cần đối chiếu, và nút mở trang Tiền của hội để xác nhận. Mỗi đơn chỉ gửi một lần.
- **Email cho chủ hội khi có đơn đã thanh toán.** Đơn của hội được thanh toán xong (ngân hàng hoặc cổng báo về, hoặc chủ hội bấm "Đã nhận tiền") thì chủ hội nhận một email báo đơn mới. Trước đây chủ hội chỉ có thông báo trong ứng dụng.

### Kỹ thuật

- Web: `apps/web/src/pages/community/CheckoutParts.tsx` (khung một cột, `RadioRows`, `RadioRow`, `Totals`, `BankQrCard`), `CheckoutConfigure.tsx`, `CheckoutOrder.tsx` (mới, tách màn của một đơn khỏi `Checkout.tsx`). Không đổi tham số gọi `POST /v1/checkout` hay cách truyền `ref`.
- Máy chủ: `GET /v1/orders/:id` trả thêm `targetType` và `seller` (hội và chủ hội của đơn, chỉ thông tin công khai trên hồ sơ: tên, tên định danh, ảnh, có nhận tin nhắn không; đơn mua gói Hội Mình thì `seller` là null). `markProcessing` cập nhật có điều kiện để hai lần bấm sát nhau chỉ báo chủ hội một lần.
- Email: hai mẫu mới `owner_transfer_reported` và `owner_order_paid` trong `packages/email/src/templates.ts`, gửi qua `ctx.email` như các email khác (lỗi gửi chỉ ghi log). Email đơn đã thanh toán nghe sự kiện `payment.succeeded` ở `packages/core/src/events/owner-emails.ts`, đăng ký trong `app.ts`.
- Test: `packages/core/src/test/owner-order-emails.test.ts`; E2E 03, 22, 24, 26 sửa theo vai trò radio và màn chờ mới.

## Quyết định

**Chủ hội của một đơn là chủ không gian làm việc của hội** ({version}, chủ dự án yêu cầu ngày 21/11/2026). Màn chờ xác nhận và hai email mới cần biết "chủ hội" là ai. Chọn `workspaces.ownerUserId`, vì thông báo trong ứng dụng "có người báo đã chuyển khoản" và "có đơn đã thanh toán" đang gửi cho đúng người này; email đi theo đúng người nhận thông báo. Hai email là email giao dịch (chủ hội phải xử lý đơn) nên luôn gửi, không phụ thuộc mức thông báo của hội trong cài đặt của chủ hội.

**Trang thanh toán ghim tổng tiền và nút dưới đáy trên điện thoại** ({version}, chủ dự án yêu cầu ngày 21/11/2026). Dùng `position: sticky` thay vì `fixed`: thanh vẫn thuộc luồng trang nên cuộn tới cuối thì nằm lại đúng chỗ, không cần chừa khoảng trống và không che nội dung. Trang thanh toán nằm ngoài khung hội nên không có thanh điều hướng dưới để đè lên.
