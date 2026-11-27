---
bump: minor
---

Mua trước, tạo tài khoản sau, theo yêu cầu của chủ dự án ngày 27/11/2026: ưu tiên dòng tiền, khách trả tiền trước rồi mới tạo tài khoản. Có migration `0024_guest_checkout` (bảng `account_claims`), phải áp lên database thật trước khi merge.

### Thêm

- **Mua khi chưa có tài khoản.** Ở trang thanh toán của hội (gói thành viên) và của sản phẩm, người chưa đăng nhập chỉ cần điền tên và email rồi trả tiền luôn, không phải đăng ký trước. Nút "Tham gia" của hội thu phí ở trang giới thiệu hội cũng đưa người chưa đăng nhập sang thẳng thanh toán. Email đã có tài khoản thì được mời đăng nhập để mua.
- **Tạo tài khoản ngay sau khi trả.** Trả xong (quét QR, cổng thanh toán báo về, hoặc chủ hội xác nhận), màn đơn hàng chuyển sang "Đã nhận thanh toán" kèm khung đặt mật khẩu. Đặt xong là đăng nhập và vào thẳng hội vừa mua.
- **Email có link tạo tài khoản.** Thay cho email "Thanh toán thành công" thường lệ, người mua chưa có tài khoản nhận email "Đã nhận thanh toán · Tạo tài khoản để vào <hội>", kèm mã đơn và nút "Tạo tài khoản và vào hội". Link là của riêng người đó, mở trang `/tao-tai-khoan`, đặt mật khẩu một lần là vào đúng hội đã mua (email coi như đã xác minh).
- **Nhắc tạo tài khoản.** Người đã trả tiền mà chưa tạo tài khoản được nhắc lại sau 1 ngày, 3 ngày và 7 ngày (cron hằng ngày, bước `pending_accounts`), rồi thôi. Đơn đã hoàn tiền thì không nhắc.
- **Lối thoát khi quên link.** Người mua chưa tạo tài khoản mà bấm "Quên mật khẩu" hoặc đăng ký lại bằng email đó thì nhận lại link tạo tài khoản. Đăng nhập thì được báo rõ "đã mua hàng nhưng chưa tạo mật khẩu" thay vì "sai mật khẩu". Đăng nhập bằng Google cùng email thì nhận luôn tài khoản và quyền đã mua.

### Thay đổi

- **Email "Chào mừng" khi vào hội** không gửi cho người chưa tạo tài khoản: email báo đã nhận tiền đã mời tạo tài khoản, link "Vào hội" lúc đó chưa vào được.

## Quyết định

**Mua trước, tạo tài khoản sau bằng tài khoản chờ** ({version}, chủ dự án yêu cầu ngày 27/11/2026). Mục tiêu là dòng tiền: bỏ bước đăng ký trước khi trả. Cách làm: khách chưa đăng nhập mua bằng email thì máy chủ tạo sẵn một tài khoản chờ mang email đó (chưa có mật khẩu nên không đăng nhập được, dòng `account_claims` còn `claimed_at` trống) và đứng tên đơn bằng tài khoản này. Nhờ vậy mọi bước sau khi trả tiền (mở quyền, vào hội, hoa hồng affiliate, báo chủ hội, đối soát, hoàn tiền) chạy y như đơn thường, không phải sửa luồng thanh toán. Mã trong link email và mã đơn trả cho trình duyệt đều là HMAC bằng `AUTH_JWT_SECRET`, không lưu trong database, nên gửi lại bao nhiêu lần vẫn là cùng một link. Chặn chiếm quyền: email đã có tài khoản thật phải đăng nhập để mua; email là tài khoản chờ đã có đơn trả tiền thì vẫn mua thêm được, nhưng chỉ tạo tài khoản được bằng link trong email (chứng minh là chủ hộp thư), không phải ngay trên trình duyệt vừa mua, vì ai cũng gõ được email của người khác vào ô mua. Tài khoản chờ chưa trả đồng nào (khách bỏ dở) thì không có gì phải giữ: đăng ký bình thường hoặc mua lại là nhận được. Gói Hội Mình cho hội vẫn cần đăng nhập bằng tài khoản chủ hội. Hàm `elevated` chuyển sang `packages/core/src/lib/elevated.ts` (automation-engine vẫn xuất lại) để phần xác thực dùng được mà không vòng import.
