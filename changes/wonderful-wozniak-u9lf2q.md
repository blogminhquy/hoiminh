---
bump: minor
---

Trang bán của sản phẩm mở cho mọi người, để link sản phẩm (của affiliate, của chủ hội đem đi quảng cáo) đưa người lạ tới đúng sản phẩm. Theo yêu cầu của chủ dự án. Không có migration.

### Thay đổi

- **Ai cũng mở được trang bán của một sản phẩm**, kể cả người chưa đăng nhập và kể cả khi hội là hội kín. Trước đây người chưa đăng nhập bị đưa về trang đăng nhập, và người đã đăng nhập mà chưa vào hội bị đưa về trang giới thiệu hội, nên link sản phẩm không bao giờ tới được sản phẩm.
- Người ngoài của hội kín thấy trang bán trong khung trang công khai: đầu trang có dải "Sản phẩm của hội" kèm nút "Xem giới thiệu hội", không có thanh bên của hội. Lối quay lại dẫn về trang giới thiệu hội thay cho cửa hàng.
- Bấm "Mua ngay" mới phải đăng nhập hoặc đăng ký; xong thì quay lại đúng trang thanh toán của sản phẩm đó. Người ngoài mua lẻ như trước, không bị thêm vào hội.
- Bài xem thử và nút "Vào học" của người ngoài mở ở Khu học tập, vì họ không vào được bên trong hội.
- Mọi trang khác của hội kín (cửa hàng, bảng tin, khóa học, sự kiện, thành viên) vẫn đóng với người ngoài. Thành viên và khách xem hội mở thấy trang bán như cũ.

### Sửa

- Trang Affiliate bỏ dòng ghi chú "Trang sản phẩm chỉ mở cho người đã đăng nhập" vì không còn đúng.

## Quyết định

**Trang bán của sản phẩm là trang công khai, kể cả ở hội kín** ({version}, chủ dự án yêu cầu ngày 21/11/2026, nới mục về hội kín của bản 1.39.0). Hội kín vẫn chỉ lộ trang giới thiệu, nay thêm trang bán của từng sản phẩm đang bán: tên, giá, mô tả, mục lục khóa học, giảng viên. Lý do: trang bán là trang để bán hàng, người ngoài vốn mua lẻ được mà không cần vào hội (mục 37), và link sản phẩm của affiliate vô dụng nếu người lạ bấm vào lại rơi về trang đăng nhập. Máy chủ không đổi gì: `GET /v1/products/:id` và danh sách sản phẩm vốn đã trả cho người chưa đăng nhập, lớp chặn chỉ nằm ở `AppShell`. `isSalePage` (trong `lib/guest.ts`) nhận đúng dạng `/<hội>/cua-hang/<sản phẩm>`, không tính trang tạo và trang sửa. Người ngoài thấy trang bán trong khung trang công khai thay vì khung hội, để không có thanh bên dẫn tới các trang họ không vào được. Nội dung bài học vẫn theo quyền từng khóa.
