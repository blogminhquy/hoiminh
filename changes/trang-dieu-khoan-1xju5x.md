---
bump: minor
---

Thêm hai trang công khai Điều khoản sử dụng và Chính sách quyền riêng tư, theo báo lỗi của chủ dự án (mở `/dieu-khoan` và `/quyen-rieng-tu` thì hiện "Có lỗi xảy ra · Hội không tồn tại"). Chỉ sửa giao diện web và danh sách đường dẫn giữ chỗ, không có migration. Nội dung hai trang là BẢN NHÁP soạn theo cách sản phẩm đang chạy: chủ dự án (và luật sư nếu cần) đọc duyệt trước khi coi là chính thức.

### Thêm

- **Trang Điều khoản sử dụng (`/dieu-khoan`).** 15 phần viết bằng lời thường: ai là ai trên Hội Mình, tài khoản, tiền mua bán trong hội đi thẳng tới chủ hội (Hội Mình không giữ hộ, không thu phí giao dịch), hoàn tiền trong 7 ngày nếu xem chưa quá 20% nội dung, gói Hội Mình của chủ hội (trả trước theo kỳ, không tự trừ tiền, gia hạn, nâng gói, ngừng dùng), trách nhiệm của chủ hội, affiliate và hoa hồng, nội dung và hành vi bị cấm, báo cáo vi phạm và khóa tài khoản, luật áp dụng, liên hệ.
- **Trang Chính sách quyền riêng tư (`/quyen-rieng-tu`).** 11 phần: dữ liệu đang thu, dùng để làm gì, ai xem được, bên thứ ba nhận dữ liệu, cookie và bộ nhớ trình duyệt kèm thời hạn từng cái, thời gian lưu và cách bảo vệ, xóa tài khoản, quyền của bạn và cách thực hiện bằng chức năng đang có.
- **Cả hai trang** mở được khi chưa đăng nhập, có ngày cập nhật, mục lục bấm nhảy tới từng phần, các phần đánh số, và link sang trang còn lại ở cuối. Chữ thân bài 17px, giãn dòng 1.7, bề ngang phần chữ tối đa 720px, đọc gọn trên điện thoại.

### Sửa

- **Mở `/dieu-khoan` hoặc `/quyen-rieng-tu` thì hiện "Hội không tồn tại".** Hai địa chỉ này chưa có trang nên rơi vào trang của hội, và web đi tìm một hội có đường dẫn `dieu-khoan`. Nay là hai trang riêng.
- **Hai link ở ô "Tôi đồng ý với Điều khoản và Chính sách quyền riêng tư" của trang đăng ký.** Trước đây bấm vào thì rời trang đăng ký (mất chữ đã gõ) và ô đồng ý bị đánh dấu theo. Nay hai link mở trang ở thẻ mới, không đụng tới ô đồng ý.
- **Dòng "Điều khoản · Quyền riêng tư" ở chân khung đăng nhập, đăng ký** trước chỉ là chữ, nay là hai link.

### Thay đổi

- **Không hội nào đặt được đường dẫn `dieu-khoan` hay `quyen-rieng-tu`.** Hai tên này vào danh sách đường dẫn hệ thống giữ chỗ, áp dụng cả lúc tạo hội lẫn lúc đổi đường dẫn.

### Kỹ thuật

- Chữ của hai trang nằm trong tệp dữ liệu, tách khỏi giao diện: `apps/web/src/pages/public/legal/terms.ts`, `privacy.ts` và `contact.ts` (mảng các phần gồm đoạn văn, tiêu đề nhỏ, danh sách, ô lưu ý). `LegalDocument.tsx` dựng cả hai trang từ dữ liệu đó. Muốn sửa chữ thì sửa tệp dữ liệu và đổi ngày `updatedAt`.
- Email hỗ trợ ở mục Liên hệ để trống (`LEGAL_CONTACT_EMAIL` trong `contact.ts`) vì trong repo chưa có địa chỉ nào được xác nhận là hộp thư hỗ trợ thật. Điền một dòng là hiện trên cả hai trang.
- Route `/dieu-khoan` và `/quyen-rieng-tu` thêm vào nhóm trang công khai của `apps/web/src/app/router.tsx`; `RESERVED_SLUGS` trong `packages/config` thêm hai tên.
- Test: `apps/web/src/pages/public/legal/content.test.ts` (neo không trùng, link trỏ tới trang có trong router, không có gạch ngang dài, không sót chữ giữ chỗ), `packages/config/src/reserved-slugs.test.ts`, `packages/core/src/test/reserved-slugs.test.ts` (tạo hội, đổi đường dẫn, dữ liệu mẫu), E2E `29-dieu-khoan-quyen-rieng-tu`.
- Chưa kiểm được trên database thật xem có hội nào đang dùng hai đường dẫn này. Nếu có, hội đó phải đổi đường dẫn vì địa chỉ nay thuộc về trang pháp lý.

## Quyết định

**Chữ của hai trang pháp lý soạn theo mã đang chạy, không hứa điều sản phẩm chưa làm** ({version}, chủ dự án yêu cầu ngày 22/11/2026). Mỗi câu về tiền, hoàn tiền, hoa hồng, cookie, bên thứ ba đều đối chiếu với mã lúc viết; chỗ nào sản phẩm chưa có (tự xóa tài khoản, tự tải dữ liệu, tự đổi email, hộp thư hỗ trợ) thì trang nói thẳng là chưa có. Không trích số hiệu văn bản luật và không ghi thông tin pháp nhân vì repo không có nguồn nào xác nhận. Đổi luật trong mã (số ngày hoàn tiền, số ngày giữ hoa hồng, thời hạn cookie, thêm bên thứ ba) thì phải sửa chữ ở `legal/terms.ts`, `legal/privacy.ts` và đổi ngày cập nhật.
