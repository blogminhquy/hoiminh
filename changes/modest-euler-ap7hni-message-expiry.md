---
bump: minor
---

Ảnh và tệp trong tin nhắn riêng tự xóa sau 30 ngày, theo yêu cầu của chủ dự án ngày 27/11/2026, để tin nhắn không thành kho chứa tệp. Ảnh và tệp trong hội (bài viết, bình luận, khóa học, cửa hàng) vẫn giữ vĩnh viễn. Không có migration.

### Thêm

- **Ảnh và tệp trong tin nhắn tự xóa sau 30 ngày.** Mỗi đêm (01:00 giờ Việt Nam) hệ thống gỡ ảnh và tệp người dùng tải lên trong tin nhắn đã quá 30 ngày, rồi xóa khỏi kho nếu không còn nơi nào khác dùng. Chữ của tin nhắn giữ nguyên. Nhãn dán và GIF không bị xóa. Ảnh, tệp gửi trước ngày 01/12/2026 được tính 30 ngày kể từ ngày đó, để không ai mất đồ đột ngột.
- **Báo trước trong khung tin nhắn.** Đầu mỗi hội thoại có dòng "Ảnh và tệp trong tin nhắn tự xóa sau 30 ngày. Tải về nếu cần giữ."; cạnh giờ gửi của mỗi ảnh, tệp có nhãn "Tự xóa sau N ngày"; nút gửi ảnh và đính kèm tệp ghi rõ thời hạn.
- **Ảnh, tệp đã hết hạn hiện rõ ràng.** Thay cho ô ảnh hỏng là "Ảnh đã hết hạn"; tệp vẫn ghi tên và "Tệp đã hết hạn", bấm không tải được. Tin trả lời vẫn hiện "[Hình ảnh]" khi trích ảnh đã hết hạn. Bảng "Thông tin hội thoại" không liệt kê tệp đã hết hạn.

## Quyết định

**Ảnh và tệp trong tin nhắn riêng tự xóa sau 30 ngày, ảnh và tệp trong hội giữ vĩnh viễn** ({version}, chủ dự án yêu cầu ngày 27/11/2026). Mục đích chính là chặn lạm dụng tin nhắn làm kho chứa tệp và giữ ít dữ liệu nhạy cảm (ảnh chuyển khoản, giấy tờ) hơn; tiền R2 tiết kiệm được không đáng kể. Không cần migration: hạn tính từ `messages.created_at`; ảnh hết hạn ghi `media_kind = 'expired'` và gỡ `image_url`; tệp hết hạn gỡ `file_url`, giữ `file_name`, `file_size`. Việc xóa đi qua `releaseFiles` trong cùng transaction với việc gỡ tham chiếu, nên tệp còn được nơi khác dùng thì không bị xóa trên R2. Ngày bắt đầu tính hạn là hằng số `MESSAGE_MEDIA_EXPIRY_START` (01/12/2026): tính năng ra mắt sau ngày đó thì đổi thành ngày ra mắt. Bước cron `messageMedia` chạy riêng, mỗi lần tối đa 1.000 tin, còn tồn thì lần sau làm tiếp; truy vấn quét theo `created_at` chưa có chỉ mục riêng, khi bảng `messages` lớn thì nên thêm.
