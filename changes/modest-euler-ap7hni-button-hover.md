---
bump: patch
---

Sửa chữ của nút bị chìm vào nền khi rê chuột, và làm rõ trạng thái rê chuột, bấm, chọn bằng bàn phím của các nút, theo yêu cầu của chủ dự án ngày 27/11/2026. Không có migration.

### Sửa

- **Chữ của nút không còn chìm vào nền khi rê chuột.** Quy tắc chung cho link (`a:hover`, đổi chữ sang xanh đậm) đè lên màu chữ của các nút làm bằng link, như nút "Tạo hội của bạn": chữ xanh đậm nằm trên nền xanh ngọc. Nút đen ("Đăng bài") và, ở giao diện tối, nút vàng ("Nâng gói") còn khó đọc hơn. Nay quy tắc đó chỉ áp cho link chữ, nút giữ đúng màu chữ của nó.

### Thay đổi

- **Rê chuột vào nút thấy rõ hơn.** Nút xanh, đen, vàng và nút nhạt đậm nền lên rõ ràng (trước đây chỉ tối đi 4%, gần như không thấy); nút viền có nền xám nhẹ và viền đậm hơn. Màu chữ giữ nguyên, đủ tương phản ở cả giao diện sáng và tối.
- **Bấm nút thấy nút nhích xuống**, và dùng bàn phím (phím Tab) thì nút đang chọn có viền rõ.
