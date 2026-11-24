---
bump: minor
---

Chia sẻ khóa học ngay ở thư viện khóa học: thẻ khóa có dòng nhỏ "Nhận 99.800đ khi chia sẻ", bấm vào chọn giới thiệu khóa học hoặc giới thiệu vào hội (chủ dự án yêu cầu). Không có migration.

### Thêm

- **Dòng "Nhận ... khi chia sẻ" trên thẻ khóa học.** Hội đang bật affiliate thì mỗi thẻ khóa đã đăng có một dòng chữ nhỏ, kín đáo dưới nút chính: khóa bán lẻ ghi số tiền nhận mỗi đơn ("Nhận 99.800đ khi chia sẻ"), khóa chỉ nằm trong hội ghi số tiền nhận mỗi tháng ("Nhận 39.800đ/tháng khi chia sẻ"). Chỉ số tiền có màu xanh. Khách chưa vào hội, hội chưa bật affiliate, khóa nháp thì không có dòng này.
- **Bảng chia sẻ hai lựa chọn.** Bấm dòng chia sẻ mở bảng có hai ô, mỗi ô có nút sao chép link và nút chia sẻ riêng: "Giới thiệu khóa học này" (link trang bán lẻ của khóa, nhận một lần cho mỗi người mua) và "Giới thiệu vào hội" (link trang giới thiệu hội, nhận hằng tháng khi người được mời đóng phí thành viên, kèm số tháng được tính và tổng tối đa). Khóa vừa bán lẻ vừa có trong Premium thì link khóa dẫn tới trang bán lẻ. Mọi chỗ ghi số tiền cụ thể, không ghi phần trăm.
- **Mục "Giới thiệu khóa học" trong menu ba chấm** của người quản lý khóa, mở cùng bảng chia sẻ.
- Số tiền hằng tháng tính trên gói thành viên rẻ nhất (gói bán theo năm thì chia đều ra tháng), để không hứa quá tay. Mức hoa hồng là mức riêng của người giới thiệu nếu chủ hội đã đặt, làm tròn xuống như lúc ghi hoa hồng thật.
- Màu "xanh tiền" mới trong bộ màu giao diện (`T.money`, `T.moneySoft`, `T.moneyText`), có cả giao diện tối.

## Quyết định

**Chia sẻ khóa học đặt ngay trên thẻ khóa, bằng một dòng chữ nhỏ ghi số tiền** ({version}, chủ dự án chốt ngày 23/11/2026). Danh sách "Chọn trang muốn chia sẻ" ở trang Affiliate dài ra theo số sản phẩm, người dùng khó chọn; chia sẻ ngay lúc đang xem khóa thì tự nhiên hơn. Dòng chữ nhỏ, chữ xám, chỉ số tiền màu xanh, để không có cảm giác ép người học đi bán hàng. Chữ là "Nhận X khi chia sẻ" (không dùng "Tặng bạn", dễ bị hiểu là quà hoặc mã giảm giá). Bảng chia sẻ luôn có hai lựa chọn khi có thể: giới thiệu khóa (tiền một lần) và giới thiệu vào hội (tiền hằng tháng). Xem thư viện chỉ tính số tiền, không tạo ví affiliate; ví chỉ được tạo khi người dùng mở bảng chia sẻ.
