# Đóng góp cho Hội Mình

Cảm ơn bạn đã quan tâm. Kho này đang ở giai đoạn kiến trúc và thiết kế, nên đóng góp có giá trị nhất lúc này là góp ý nghiệp vụ, phát hiện mâu thuẫn trong tài liệu, và sửa hoặc thêm màn hình thiết kế.

## Cách góp ý

1. Mở **Issue** với tiêu đề ngắn, nêu rõ mục nào trong `PLATFORM_ARCHITECTURE_V1_5_SIMPLE_SALES_UX.md` hoặc màn hình nào trong demo bạn đang nói tới.
2. Nếu đề xuất thay đổi kiến trúc, viết dưới dạng một mục mới ở cuối file theo đúng phong cách các mục hiện có: tiêu đề `# <số>. <tên>`, khối `text` cho schema, và phần **Build ngay / Để sau**. Không sửa mục cũ; mục có số lớn hơn thắng.

## Sửa thiết kế

- Mọi màn hình sinh từ `design/build.mjs`. Sửa ở đó, không sửa tay các file `.dc.html` hay `hoi-minh-demo.html`.
- Dựng lại bằng:

```bash
node design/build.mjs
```

- Giữ đúng token màu và font đã có trong `T` và `helmet`. Icon dùng Lucide: tải file SVG gốc vào `design/icons/` và khai báo trong `L`.
- Thêm màn hình mới: viết một hằng `<tên>Main`, đăng ký trong `SCREENS` với `key`, `file`, `title`, `group`, rồi thêm vào `rows` để xếp lên canvas. Nối điều hướng bằng thuộc tính `data-go="<key>"`.
- Không dùng emoji làm icon, không thêm phí giao dịch, không thêm gói nền tảng thứ hai khi chưa có quyết định.

## Pull request

- Một PR cho một việc. Mô tả ngắn gọn thay đổi gì và vì sao.
- Chạy `node design/build.mjs` trước khi gửi nếu có sửa thiết kế, và đính kèm ảnh chụp màn hình liên quan.

## Ngôn ngữ

Tài liệu và giao diện bằng tiếng Việt. Tên biến và mã bằng tiếng Anh.
