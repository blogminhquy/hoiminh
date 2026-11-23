---
bump: minor
---

Nút "Sửa bài học" ngay trên trang học bài cho người có quyền soạn khóa học (chủ dự án yêu cầu). Không có migration.

### Thêm

- **Sửa nhanh bài học từ trang học.** Chủ hội và người được giao quyền soạn khóa học thấy nút "Sửa bài học" cạnh tiêu đề bài (máy tính: cùng hàng với "Bài tiếp theo" và "Đánh dấu hoàn thành"; điện thoại: ngay dưới tiêu đề). Bấm vào thì mở khung soạn khóa học ở đúng bài đang xem, module chứa bài được mở sẵn. Học viên không thấy nút này.
- Khung soạn khóa học nhận tham số `?bai=<id>` để mở sẵn một bài. Bài không còn trong khóa (link cũ, bài đã xóa) thì mở bài đầu tiên.
