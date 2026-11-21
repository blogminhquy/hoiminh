---
bump: minor
---

Học xong bài cuối của khóa thì ứng dụng tự chuyển sang màn chúc mừng, và tấm chứng chỉ được thiết kế lại để đáng đem khoe. Làm theo yêu cầu của chủ dự án ngày 21/11/2026. Không có migration.

### Thêm

- **Màn chúc mừng khi hoàn thành khóa học.** Bấm hoàn thành bài cuối cùng còn lại của một khóa thì ứng dụng tự chuyển sang trang chứng nhận ở chế độ chúc mừng: lời chúc có tên bạn và tên khóa, hoa giấy rơi vài giây, số bài và thời lượng đã học, rồi tới tấm chứng chỉ cùng lời mời khoe thành quả. Lời chúc chỉ hiện đúng một lần lúc vừa học xong; tải lại trang hay mở lại link thì chỉ còn trang chứng nhận bình thường. Máy đặt "giảm chuyển động" thì không có hoa giấy.
- **Khóa không cấp chứng nhận cũng được chúc mừng.** Học xong khóa tắt chứng nhận thì một bảng chúc mừng mở ngay trên trang học, có số bài, thời lượng và lối về trang khóa học.
- **Tải chứng chỉ thành ảnh.** Nút "Tải ảnh" lưu tấm chứng chỉ thành tệp PNG nét (2000 x 1414) để đăng Facebook, Zalo, LinkedIn. Ảnh giống hệt tấm đang xem, kể cả logo của hội; nếu logo không tải được thì ảnh dùng dấu chữ viết tắt của hội, việc tải ảnh không bị hỏng.
- **Chia sẻ chứng chỉ.** Trên điện thoại, nút "Chia sẻ" mở bảng chia sẻ của máy và gửi kèm ảnh chứng chỉ khi máy cho phép. Trên máy tính không có bảng chia sẻ thì nút thành "Sao chép link".
- **Lối vào "Xem chứng chỉ".** Khóa đã học xong và có cấp chứng nhận thì trang tổng quan khóa học và trang học đều có nút "Xem chứng chỉ" màu vàng dễ thấy, thay cho dòng chữ nhỏ ở cột bên.

### Thay đổi

- **Tấm chứng chỉ thiết kế lại.** Khổ A4 ngang, nền giấy ấm, khung viền kép có họa tiết ở bốn góc, logo và tên hội, dòng "CHỨNG NHẬN HOÀN THÀNH", tên học viên thật lớn, tên khóa, số bài và thời lượng, ngày hoàn thành, con dấu "Đã hoàn thành", chữ ký giảng viên, mã kiểm tra và địa chỉ kiểm tra. Tên dài tự co cỡ chữ hoặc xuống hai dòng, không tràn khung. Trên điện thoại tấm vẫn là khổ ngang thu nhỏ vừa màn hình.
- **Trang chứng nhận gọn hơn.** Dòng link kiểm tra dài được thay bằng ô link có nút sao chép và mã kiểm tra tách nhóm bốn ký tự. Người mở link để kiểm tra thấy ngay dòng "Chứng nhận hợp lệ" nêu rõ ai, khóa nào, ngày nào. Địa chỉ `/chung-nhan/...` giữ nguyên, link đã phát hành vẫn chạy.
- **In hoặc lưu PDF.** Bản in ra đúng một trang A4 ngang, chỉ có tấm chứng chỉ, không có nút và thanh điều hướng.
- **Ngày trên chứng chỉ.** Viết kiểu "22 tháng 11, 2026" theo giờ Việt Nam, nên ai mở link cũng thấy cùng một ngày.

### Sửa

- **Ngày hoàn thành không còn bị đổi.** Trước đây bấm hoàn thành lại một bài của khóa đã học xong thì ngày hoàn thành trên chứng nhận bị ghi đè thành ngày bấm lại. Nay ngày hoàn thành giữ nguyên; chỉ đổi khi khóa được thêm bài mới và bạn học xong lần nữa.

## Quyết định

**Tấm chứng chỉ là một "cảnh" vẽ hai lần, không chụp màn hình** ({version}, chủ dự án yêu cầu ngày 21/11/2026). Tấm chứng chỉ được mô tả thành một danh sách hình và chữ trên khung 2000 x 1414. Trên màn hình và khi in, danh sách đó vẽ bằng SVG (nét ở mọi cỡ, bản in là hình véc tơ). Khi tải ảnh, cũng danh sách đó vẽ thẳng lên canvas rồi xuất PNG. Không dùng thư viện chụp DOM và không nhúng SVG vào ảnh, vì hai cách đó hay hỏng phông trên Safari của iPhone. Logo hội nằm ở tên miền của API nên được tải qua fetch có CORS (API tệp công khai đã trả header CORS cho chính trang web, không phải sửa máy chủ); tải không được thì vẽ dấu chữ viết tắt.

**Máy chủ báo "khóa vừa hoàn thành" đúng một lần** ({version}). `POST /v1/lessons/:id/complete` trả thêm `courseCompleted` (chỉ đúng ở lượt làm khóa chuyển từ chưa xong sang xong) và `certificateEnabled`. Giao diện dựa vào đó để chúc mừng, nên mở lại một bài của khóa đã xong không kích hoạt lại. Chứng nhận đọc thẳng từ tiến độ học được ghi trong chính lượt gọi đó, không chờ sự kiện, nên trang chứng nhận có dữ liệu ngay; màn chúc mừng vẫn tự thử lại vài lần cho chắc.

**Nút tải ảnh, chia sẻ, in dành cho mọi người mở link** ({version}). Trang chứng nhận vốn công khai để kiểm tra, và chủ chứng chỉ hay mở link ở máy chưa đăng nhập (trình duyệt trong Zalo, máy khác). Giấu nút với người chưa đăng nhập sẽ làm chính họ không tải được ảnh. Chỉ riêng lời chúc mừng là dành cho chính người học.
