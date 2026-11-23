---
bump: minor
---

Màn tạo hội: tài khoản quản trị hệ thống tạo hội miễn phí không giới hạn, bước "Gói" hiện cả gói Miễn phí (xám) và ưu tiên gói Chuyên nghiệp; tên miền riêng chỉ còn ở gói Không giới hạn (chủ dự án yêu cầu). Không có migration.

### Thêm

- **Tài khoản quản trị hệ thống tạo hội miễn phí không giới hạn.** Để thử nghiệm và dựng hội mẫu. Hội mới của quản trị luôn là hội miễn phí, hoạt động ngay, và hội miễn phí cũ vẫn giữ nguyên. Người dùng thường vẫn một hội miễn phí mỗi tài khoản.

### Thay đổi

- **Bước "Gói" khi tạo hội thứ hai trở đi.** Gói Miễn phí luôn hiện ở đầu nhưng xám, không chọn được, ghi rõ "Mỗi tài khoản chỉ được tạo 1 hội miễn phí" và hội đã dùng suất đó. Gói Chuyên nghiệp được chọn sẵn, có nhãn "Dành cho đa số", viền nổi và kê đủ tính năng. Dòng mô tả các gói đọc từ tính năng thật của gói, không còn viết cứng.
- **Tên miền riêng chỉ có ở gói Không giới hạn.** Gói Chuyên nghiệp còn tự động hóa, affiliate và API. Bảng gói mặc định và dữ liệu mẫu đổi theo. Hội đã gắn tên miền từ trước vẫn giữ tên miền, chỉ không gắn hoặc đổi được nữa khi gói không có tính năng này.

### Sửa

- **Hội miễn phí đã lưu trữ mà màn tạo hội vẫn coi là đã dùng suất miễn phí.** Máy chủ trả lại suất khi hội miễn phí bị lưu trữ, nhưng màn tạo hội vẫn ẩn gói Miễn phí. Nay hai bên tính giống nhau.

## Quyết định

**Tài khoản quản trị hệ thống không bị giới hạn một hội miễn phí; tên miền riêng chỉ ở gói Không giới hạn** ({version}, chủ dự án chốt ngày 23/11/2026, sửa một phần mục 68). Luật "mỗi tài khoản một hội miễn phí" giữ cho người dùng thường. Tài khoản có `is_super_admin` (xét theo chủ workspace) thì hội nào tạo ra cũng là hội miễn phí và không lấy suất của hội cũ. Bước "Gói" khi tạo hội thứ hai vẫn hiện gói Miễn phí ở dạng khóa để người dùng hiểu luật, và chọn sẵn gói Chuyên nghiệp. Tên miền riêng chuyển hẳn lên gói Không giới hạn: đổi `PLAN_DEFAULTS` và dữ liệu mẫu; trên database thật, tính năng của gói nằm ở bảng `plans` nên quản trị tắt "Tên miền riêng" của gói Chuyên nghiệp ở Hệ thống > Gói. Hội đã gắn tên miền giữ nguyên (chỉ chặn khi gắn hoặc đổi).
