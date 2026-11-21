---
bump: patch
---

Đổi tên biến trong mẫu tin nhắn chào tự động sang tiếng Anh, viết liền, theo yêu cầu của chủ dự án. Không có migration.

### Thay đổi

- **Biến trong mẫu tin nhắn chào viết bằng tiếng Anh, viết liền.** `{{tên}}` thành `{{full_name}}`, `{{cộng đồng}}` thành `{{community_name}}`, `{{link bắt đầu}}` thành `{{start_link}}`, cùng kiểu với biến của Quy tắc tự động (`{{name}}`, `{{email}}`). `{{full_name}}` là họ tên đầy đủ của thành viên: tin nhắn chào nay viết "Chào Nguyễn Văn An" thay vì "Chào An" như biến `{{tên}}` trước đây. Mẫu chủ hội đã lưu bằng tên cũ vẫn gửi được, và trang Tiện ích hiện mẫu đó bằng tên mới; lần lưu kế tiếp database nhận tên mới. Hội tạo mới dùng mẫu mặc định với tên mới.
