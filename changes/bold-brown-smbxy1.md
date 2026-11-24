---
bump: minor
---

Thêm quản lý đối tác chính thức cho affiliate nền tảng: mỗi đối tác có % hoa hồng riêng và thời hạn nhận hoa hồng riêng (chủ dự án yêu cầu). Có migration: thêm bảng `platform_partners`.

### Thêm

- **Hệ thống · Đối tác (`/he-thong/doi-tac`).** Quản trị thêm đối tác bằng email tài khoản Hội Mình, đặt hoa hồng riêng (0-90%, để trống là theo mức chung) và thời hạn nhận hoa hồng riêng (theo mức chung, 6, 12, 24, 36 tháng đầu hoặc trọn đời), kèm ghi chú thỏa thuận. Mỗi đối tác có số liệu: lượt bấm link, chủ hội đăng ký, chủ hội đã trả tiền, doanh thu mang về, hoa hồng. Sửa điều khoản hay kết thúc hợp tác ngay trên thẻ đối tác; đối tác đã kết thúc nằm ở nhóm riêng và mở lại được bằng cách thêm lại. Có trong menu Tiền và ô lệnh.
- **Đối tác thấy điều khoản riêng.** Ở Affiliate của tôi, chương trình nền tảng của đối tác có khung "Đối tác chính thức của Hội Mình" ghi % và thời hạn riêng.

### Thay đổi

- **Thời hạn nhận hoa hồng của affiliate nền tảng theo từng đối tác.** Khi chủ hội trả tiền gói, hoa hồng của đối tác tính theo thời hạn riêng của họ (kể cả trọn đời); người không phải đối tác vẫn theo mức chung. Điều khoản mới chỉ áp dụng cho những lần trả tiền sau đó, hoa hồng đã ghi không đổi.
- **Trang Affiliate nền tảng.** Khung "Đối tác lớn" thành "Giới thiệu nhiều nhất", chỉ để xem, kèm lối sang trang Đối tác. % riêng chỉ còn chỉnh ở một chỗ là trang Đối tác.

## Quyết định

**Đối tác chính thức là một lớp trên affiliate nền tảng, không phải chương trình riêng** ({version}, chủ dự án chốt ngày 24/11/2026). Mỗi đối tác gắn với đúng một tài khoản affiliate nền tảng, nên link, mã giới thiệu, ví, rút tiền và đối soát đi chung đường với mọi affiliate. % riêng nằm ở `affiliate_accounts.commission_rate_bps` như trước (chỗ tính hoa hồng không đổi); bảng mới `platform_partners` giữ thời hạn riêng (`duration_mode`: theo mức chung, số tháng, trọn đời), ghi chú và trạng thái. Kết thúc hợp tác thì % và thời hạn về mức chung, dòng đối tác giữ lại để còn lịch sử. Chưa làm tặng gói cho hội của đối tác (chủ dự án để sau).
