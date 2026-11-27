---
bump: minor
---

Ô bình luận và ô chat có emoji, ảnh, nhãn dán động, GIF, theo yêu cầu của chủ dự án. Có migration 0022 (bảng sticker_packs, stickers, cột media_kind của comments và messages, bộ nhãn khởi đầu).

### Thêm

- **Ô bình luận có thanh công cụ như Facebook:** emoji, đính kèm ảnh (chọn tệp hoặc dán thẳng vào ô, có xem trước), GIF, nhãn dán. Nhãn dán và GIF gửi ngay khi chọn; bình luận chỉ có ảnh, nhãn hay GIF thì không cần chữ.
- **Khung chọn chung cho ô bình luận và ô chat:** ba tab Nhãn dán, Emoji, GIF; tab nào cũng có mục Gần đây; hàng nút dưới đáy nhảy nhanh tới từng bộ nhãn, nhóm emoji. Emoji 2D chia 8 nhóm. Điện thoại: khung trượt từ đáy màn hình.
- **Gợi ý nhãn khi gõ (như Zalo):** gõ chữ trùng từ khóa của nhãn ("cảm ơn", "haha", "ok", gõ không dấu cũng được) thì dải nhãn gợi ý hiện ngay trên ô soạn; chạm là gửi nhãn thay cho chữ.
- **Bộ nhãn động khởi đầu "Mèo Mình"** (16 nhãn, hình vẽ gốc của Hội Mình, không chữ): chào, cảm ơn, ok, haha, huhu, yêu, wow, hả, giận, cố lên, tuyệt vời, ngủ ngon, xin lỗi, chúc mừng, đợi xíu, học bài. Nhãn chuyển động (SVG động, nhẹ, nét sắc, nền trong suốt cả ở chế độ tối).
- **GIF và nhãn dán động từ GIPHY:** tab GIF tìm ảnh động; tab Nhãn dán có ô tìm nhãn GIPHY và mục Thịnh hành. Cần API key GIPHY, nhập ở Hệ thống · Hạ tầng và khóa (có hướng dẫn lấy key); chưa có key thì tab GIF và phần GIPHY tự ẩn.
- **Hệ thống · Nhãn dán (/he-thong/nhan-dan):** tạo bộ nhãn, đổi tên, bật tắt, đổi thứ tự, xóa bộ; kéo thả nhiều ảnh một lúc để thêm nhãn (GIF, WebP động giữ nguyên chuyển động); gõ từ khóa gợi ý cho từng nhãn. Xóa nhãn hay tắt bộ không làm hỏng bình luận, tin nhắn đã gửi.

### Thay đổi

- **Ô chat:** bảng emoji cũ (24 emoji) thay bằng khung chọn chung; thêm nút nhãn dán và GIF; tin chỉ có một nhãn dán hiện không khung bong bóng. Danh sách hội thoại ghi [Nhãn dán], [GIF] cho tin chỉ có nhãn hay GIF.

## Quyết định

**Nhãn dán chỉ dùng nguồn hợp lệ** ({version}, chủ dự án yêu cầu ngày 27/11/2026). Chủ dự án muốn bộ Amy Bụng Bự của Zalo; bộ này có bản quyền của tác giả nên không chép về. Thay vào đó: bộ Mèo Mình tự vẽ, kho nhãn GIPHY (dùng qua API của GIPHY là hợp lệ), và trang quản lý để tải lên bộ đã mua quyền. Nhãn và GIF lưu bản sao link ảnh trong bình luận, tin nhắn (cột image_url, phân biệt bằng media_kind); GIF chỉ nhận id chữ số của GIPHY, máy chủ tự dựng link media.giphy.com nên không ai nhúng link ảnh lạ được.
