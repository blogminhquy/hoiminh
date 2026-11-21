---
bump: patch
---

Ô "Lượt bấm" ở trang Affiliate đếm được link dạng `?ref=`. Theo yêu cầu của chủ dự án. Không có migration.

### Sửa

- **Lượt bấm gần như luôn bằng 0.** Trước đây chỉ link dạng `/r/<mã>` mới ghi lượt bấm, trong khi mọi link trang Affiliate đưa ra (trang hội, trang sản phẩm, trang mở hội) đều là dạng `?ref=<mã>`. Nay mở link nào có `?ref=` cũng được đếm một lượt.
- Không đếm trùng: cùng một người xem mở lại hoặc tải lại trang trong 30 phút chỉ tính một lượt. Chính affiliate tự mở link của mình thì không tính. Mã không tồn tại, tài khoản affiliate hoặc chương trình đang tắt thì không tính.
- Cách tính người giới thiệu và hoa hồng không đổi: phần sửa này chỉ đếm lượt bấm.

## Quyết định

**Lượt bấm của link `?ref=` do web báo về, chỉ đếm, không ghi người giới thiệu** ({version}, chủ dự án yêu cầu ngày 21/11/2026). Trang nào mở kèm `?ref=` thì web gọi `POST /v1/ref-clicks`; `recordLandingClick` ghi một dòng `affiliate_clicks` và tăng `click_count`. Khác với `trackClick` của link `/r/<mã>`, hàm này không ghi dòng `affiliate_attributions`: người giới thiệu của link `?ref=` đã được tính theo các mã người xem mang theo lúc đăng ký và lúc vào hội (mục 78), ghi thêm ở đây sẽ làm lệch số đăng ký. Chống đếm trùng ở hai lớp: web nhớ các mã đã báo trong phiên trình duyệt, máy chủ bỏ qua lượt lặp trong 30 phút theo mã khách `hm_vid`, hoặc theo cặp địa chỉ mạng và trình duyệt khi người xem chặn cookie. Chấp nhận đếm thiếu khi hai người khác nhau dùng chung mạng và cùng loại trình duyệt mở cùng một mã trong 30 phút: thà đếm thiếu còn hơn để một người tải lại trang là đẩy được số. Đường dẫn có giới hạn tần suất nhóm `write` và không mở cho API key.
