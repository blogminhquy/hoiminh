---
bump: patch
---

Thêm hai chỉ mục database để hạn mức dung lượng và bộ dọn ảnh, tệp tin nhắn chạy nhanh khi dữ liệu lớn, theo yêu cầu của chủ dự án ngày 27/11/2026. **Có migration** (`0023_file_community_message_media_indexes`): áp lên database thật trước khi merge.

### Thay đổi

- **Chỉ mục `files_community_idx`** trên `files.community_id`: cộng dung lượng tệp của một hội (hạn mức dung lượng theo gói, chạy mỗi lượt xin URL tải lên) không còn phải đọc cả bảng `files`.
- **Chỉ mục một phần `messages_live_media_idx`** trên `messages.created_at`, chỉ gồm tin chưa thu hồi còn ảnh tải lên hoặc tệp đính kèm: bộ dọn ảnh, tệp tin nhắn quá 30 ngày tìm thẳng tin tới hạn. Gỡ ảnh, tệp xong thì tin tự ra khỏi chỉ mục, nên chỉ mục luôn nhỏ dù bảng `messages` lớn.

## Quyết định

**Chỉ mục một phần cho bộ dọn ảnh, tệp tin nhắn** ({version}, chủ dự án yêu cầu ngày 27/11/2026). Chỉ mục thường trên `messages.created_at` vẫn phải lướt qua mọi tin cũ (phần lớn là tin chữ) mỗi đêm, và càng lâu càng chậm. Chỉ mục một phần với điều kiện `recalled_at is null and ((image_url is not null and media_kind is null) or file_url is not null)` chỉ giữ tin còn ảnh, tệp cần dọn. Điều kiện này phải khớp với truy vấn trong `expireMessageMedia` (`packages/core/src/services/messaging.ts`); đổi một bên thì đổi cả bên kia, không thì Postgres không dùng chỉ mục. Đã kiểm bằng `EXPLAIN` trên PGlite: truy vấn dọn dùng `messages_live_media_idx`, truy vấn cộng dung lượng dùng `files_community_idx`. Bảng hiện còn nhỏ nên `CREATE INDEX` thường (không `CONCURRENTLY`) chạy tức thì.
