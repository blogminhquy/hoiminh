---
bump: minor
---

Affiliate ghi rõ nguồn traffic: mỗi lượt bấm link được phân loại nguồn, mỗi đơn có hoa hồng nối về lượt bấm đã dẫn tới nó. Chủ dự án yêu cầu ngày 27/11/2026. Có migration (`0025_affiliate_traffic_source`, chỉ thêm cột).

### Thêm

- **Nguồn của lượt bấm affiliate.** Mỗi lượt bấm link (`?ref=` và `/r/<mã>`) được xếp vào một nguồn: Facebook, Zalo, YouTube, TikTok, Instagram, Google, Email, Trong Hội Mình, Truy cập trực tiếp, Nguồn khác. Đọc từ trang giới thiệu, tham số các nền tảng tự gắn vào link (`fbclid`, `zarsrc`, `ttclid`, `gclid`, `utm_*`) và dấu hiệu trình duyệt trong ứng dụng Zalo, Facebook, TikTok (các ứng dụng này thường không gửi trang giới thiệu).
- **Mã chỗ đặt link của Hội Mình.** Link mang tham số `pl=<mã>` (ví dụ `pl=kham-pha.the-1`) được tính là nguồn "Trong Hội Mình" và lưu mã chỗ đặt, để sau này đo từng chỗ đặt link trên nền tảng.
- **Đơn nối về lượt bấm.** Lúc thanh toán, đơn lưu mã khách của trình duyệt (cookie `hm_vid`, máy chủ tự đọc, người mua không gửi được). Lúc tạo hoa hồng, đơn được nối về lượt bấm cuối của đúng affiliate từ trình duyệt đó (hoặc từ các trình duyệt đã gắn với tài khoản người mua) trong thời hạn cookie, và chép nguồn của lượt bấm. Đơn sau của cùng người mua với cùng affiliate giữ nguồn ban đầu.

### Thay đổi

- Địa chỉ trang đích và trang giới thiệu của lượt bấm được lưu tới 2.000 ký tự thay vì 500, để không mất tham số trên link.

## Quyết định

**Nguồn traffic của affiliate chỉ để báo cáo, không đổi người nhận hoa hồng** ({version}, chủ dự án yêu cầu ngày 27/11/2026). Người nhận hoa hồng vẫn theo luật mã giới thiệu đã có (người giới thiệu cố định, lượt bấm cuối trong 30 ngày). Lượt bấm được tìm riêng để biết đơn đến từ đâu, theo thứ tự: cùng trình duyệt đã mua, các trình duyệt đã gắn với tài khoản người mua, lượt bấm của đơn trước cùng affiliate. Lỗi khi tìm lượt bấm không làm hỏng việc tạo hoa hồng (đơn vẫn có hoa hồng, nguồn để trống). Mã khách đọc từ cookie ở route thanh toán chứ không nhận từ dữ liệu gửi lên, để người mua không tự gắn đơn vào lượt bấm khác. Không làm mã kênh tự đặt và báo cáo theo `utm_*` cho cộng sự (chủ dự án chốt: cộng sự phổ thông không cần, người làm chuyên nghiệp tự đo); nhưng địa chỉ trang đích được lưu nguyên tham số, nên sau này cần thì làm báo cáo trên dữ liệu đã có.
