---
bump: patch
---

Trang bán của khóa học hiện lại ảnh bìa, theo báo lỗi của chủ dự án (trang mở từ link affiliate chỉ thấy nền màu). Không có migration, không cần sửa dữ liệu.

### Sửa

- **Trang bán và thẻ cửa hàng của khóa học mất ảnh bìa.** Lúc khóa học được đăng lần đầu, hệ thống tạo sản phẩm cửa hàng nhưng không chép ảnh bìa của khóa học sang, nên trang bán (nơi link affiliate dẫn tới) chỉ hiện nền màu dù khóa học đã có ảnh. Nay sản phẩm tạo ra mang luôn ảnh bìa của khóa học. Sản phẩm đã tạo từ trước cũng hiện ảnh ngay: trang bán và cửa hàng lấy ảnh của khóa học khi sản phẩm chưa có ảnh riêng.
- **Chữ tiêu đề đè lên ảnh bìa ở trang bán.** Có ảnh bìa thì trang bán không vẽ tiêu đề lên trên ảnh nữa, giống thẻ ở cửa hàng và trang khóa học. Tên sản phẩm vẫn nằm ngay bên dưới. Chưa có ảnh thì vẫn là nền màu kèm tiêu đề như trước.

### Kỹ thuật

- `packages/core/src/services/store.ts`: `createProduct` chép `courses.coverUrl` khi sản phẩm loại khóa học không tải ảnh riêng; `getProduct` và `listProducts` trả `coverUrl` của khóa học khi bản sao ở sản phẩm trống (hàm `coverOf`).
- Test: `packages/core/src/test/file-cleanup.test.ts` thêm ca đăng khóa học bán lẻ lần đầu, khách chưa đăng nhập đọc trang bán, và sản phẩm cũ có bản sao ảnh trống.
