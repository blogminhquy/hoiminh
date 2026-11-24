---
bump: minor
---

Thêm trang Gói bổ sung cho chủ hội (tên miền riêng, email marketing, cả hai sắp ra mắt), bỏ tên miền riêng khỏi mọi gói, và thêm lời mời "Tạo hội của bạn, miễn phí" cho thành viên chưa làm chủ hội nào (chủ dự án yêu cầu). Không có migration.

### Thêm

- **Trang Gói bổ sung (`/admin/goi-bo-sung`).** Phần chủ hội mua thêm ngoài gói của hội. Lúc này có hai mục, đều ghi "Sắp ra mắt", chưa có nút mua: Tên miền riêng và Email marketing. Vào từ menu đầu trang của khu chủ hội (cạnh "Hội của tôi"), từ nhóm Quản lý ở thanh bên của hội (chỉ chủ hội thấy, có lối "Về hội"), và từ ô lệnh "Bạn muốn làm gì?".
- **Lời mời "Tạo hội của bạn, miễn phí".** Thành viên nào cũng có tài khoản Hội Mình, nên người chưa làm chủ hội nào thấy lời mời mở hội riêng ở: trang Tôi trên điện thoại, khung Tài khoản trên máy tính, Khu học tập (đóng được, nhớ trên máy) và chân thanh bên của hội. Bấm vào thì tới trang giới thiệu tạo hội. Chủ hội và người quản lý hội không thấy lời mời.

### Thay đổi

- **Tên miền riêng không còn thuộc gói nào.** Bảng gói ở trang tạo hội, trang gói của hội, màn nâng gói, bước Gói khi tạo hội và bảng gói của quản trị không còn dòng "Tên miền riêng". Trong Cài đặt hội, ô Tên miền riêng thay bằng nhãn "Sắp ra mắt" và lối sang Gói bổ sung; chưa gắn hay đổi được tên miền ở gói nào. Hội đã gắn tên miền từ trước vẫn giữ (hiện tên miền ở đó), và gỡ tên miền vẫn làm được. Ô lệnh "Tên miền riêng" nay đưa tới Gói bổ sung.
- Bảng gói đã lưu trên database còn ghi "Tên miền riêng" ở gói nào thì tự bỏ qua lúc đọc, quản trị không phải sửa tay.

## Quyết định

**Tên miền riêng và email marketing là gói bổ sung, không nằm trong gói của hội; thành viên chưa làm chủ hội được mời tạo hội** ({version}, chủ dự án chốt ngày 23/11/2026). Chủ dự án muốn xây nền tảng: hội nào cũng chạy trên địa chỉ của Hội Mình để thành viên thấy và tự mở hội của mình, nên tên miền riêng rời khỏi các gói và chuyển thành gói bổ sung, cùng chỗ với email marketing. Cả hai đang "Sắp ra mắt". Thay cho quyết định ở bản 1.53.0 (tên miền riêng chỉ ở gói Không giới hạn): `custom_domain` bỏ khỏi `PLAN_FEATURES`; dòng gói cũ trên database còn chữ này thì `planTable` lọc đi khi đọc. Máy chủ từ chối gắn hoặc đổi tên miền (`invalid_state`), vẫn cho giữ nguyên hay gỡ tên miền đã có. Lời mời tạo hội đặt ở những lúc thành viên đang thấy giá trị của một hội, chỉ hiện cho người chưa làm chủ hội nào.
