---
bump: patch
---

Đăng ký hoặc đăng nhập từ trang của một hội thì xong là vào thẳng hội đó, theo yêu cầu của chủ dự án. Chỉ sửa giao diện web, không đổi máy chủ, không có migration.

### Sửa

- **Bấm "Tham gia hội" trên thanh đầu trang của một hội rồi đăng ký thì bị đưa về màn Tạo hội.** Nút này mở trang đăng ký trơn, không nhớ người đó đang xem hội nào. Nay nút mang theo hội đang xem (cả ở trang giới thiệu hội lẫn trang bán sản phẩm cho người ngoài), và nút "Đăng nhập" bên cạnh quay lại đúng chỗ: trang giới thiệu thì vào Bảng tin của hội, trang sản phẩm thì về lại sản phẩm đó.
- **Đăng ký từ nút "Tham gia" của hội xong vẫn phải bấm "Tham gia" lần nữa.** Trước đây xác minh email xong thì quay về trang giới thiệu và dừng ở đó. Nay trang tự làm tiếp việc của nút Tham gia: hội miễn phí vào luôn Bảng tin, hội có câu hỏi thì bảng câu hỏi tự mở, hội thu phí thì sang bước thanh toán. Hội chưa mở, đã đóng cổng, hoặc đang chờ duyệt thì trang giới thiệu báo đúng lý do như trước. Link "vào hội ngay" ở màn xác minh email cũng đi đường này.
- **Đăng ký hoặc đăng nhập bằng Google từ trang của một hội thì rơi về "Hội của tôi".** Trình duyệt rời hẳn trang để sang Google nên mất chỗ đang xem. Nay nơi cần về được cất tạm trong phiên trình duyệt và dùng lại đúng một lần khi Google trả về.

### Không đổi

- Đăng ký không từ hội nào (mở thẳng trang đăng ký, hoặc đi từ Bảng giá) vẫn vào màn Tạo hội như trước.

### Kỹ thuật

- `apps/web/src/lib/join-intent.ts`: tham số `?thamgia=1` trên trang giới thiệu hội, link đăng ký và đăng nhập có ngữ cảnh hội, đích cất qua bước Google (chỉ nhận đường dẫn trong trang). `AboutRail` đọc tham số, gỡ nó khỏi địa chỉ rồi chạy `onJoin` một lần; khách chưa đăng nhập mở link có tham số thì không có gì xảy ra.
- `PublicHeader` nhận thêm `join` (hội đang xem và nơi về sau đăng nhập); thiếu thì hai nút như cũ.
- Test: `apps/web/src/lib/join-intent.test.ts` (5 ca); E2E `01-dang-ky-tham-gia` kiểm bảng câu hỏi tự mở sau đăng ký, đăng ký từ thanh đầu trang vào thẳng Bảng tin, và thành viên đăng nhập từ trang hội vào Bảng tin.
- Phần Google chưa chạy thử được ở máy phát triển (đăng nhập Google chưa bật ở đó); phần cất và lấy đích có test đơn vị.
