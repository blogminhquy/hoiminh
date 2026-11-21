---
bump: minor
---

Mỗi người tự chọn được một mã giới thiệu chung, dùng cho link của mọi chương trình mình làm affiliate, theo yêu cầu của chủ dự án. Có migration `0019_affiliate_user_codes` (thêm một bảng, không đổi dữ liệu cũ).

### Thêm

- **Đổi mã giới thiệu, một mã cho mọi nơi.** Ở trang Tài khoản, mục Affiliate, cạnh nút "Sao chép mã" có nút "Đổi mã". Bạn chọn một mã dễ nhớ (3 đến 20 ký tự, chữ không dấu và số, ví dụ `minhquy`) và mã đó dùng cho link Hội Mình lẫn link của mọi hội bạn làm affiliate. Mã không được trùng với mã của bất kỳ ai trên toàn nền tảng, không trùng tên định danh của người khác, và không dùng các tên dành cho hệ thống.
- **Mỗi người chỉ đổi được một lần.** Bảng đổi mã bắt xác nhận trước khi lưu. Lưu xong thì nút "Đổi mã" biến mất. Mã không hợp lệ hoặc đã có người dùng thì chưa mất lượt.
- **Link cũ không hỏng.** Link đã chia sẻ với mã cũ vẫn chạy và vẫn tính hoa hồng. Trang Affiliate ghi rõ mã cũ nào còn hiệu lực.
- **Thành viên chưa từng lấy link vẫn dùng được mã chung ở hội mình đang tham gia.** Ví affiliate của hội đó tự mở khi có người đầu tiên đi qua link, như lúc tự mở trang Affiliate.

### Thay đổi

- **Trang Affiliate trong Tài khoản nay tên là "Affiliate của tôi".** Để khỏi lẫn với phần quản lý chương trình affiliate của hội.

### Không đổi

- Luật tính hoa hồng giữ nguyên. Link mở ở trang của một hội (trang giới thiệu, trang sản phẩm) chỉ tính cho chương trình của hội đó; link mở ở trang nền tảng (trang chủ, trang mở hội) chỉ tính cho chương trình nền tảng. Người vào một hội mà chưa có người giới thiệu nền tảng thì người giới thiệu nền tảng vẫn mặc định là chủ hội.

### Kỹ thuật

- Bảng `affiliate_user_codes` (mỗi người một dòng, mã duy nhất), có RLS như các bảng khác. Mã riêng của từng tài khoản affiliate (`affiliate_accounts.affiliate_code`) không đổi.
- `packages/core/src/services/referral-codes.ts`: `setMyReferralCode`, `myReferralCode`, và `canonicalRefs` đổi mã chung thành mã riêng của đúng một chương trình ở cửa vào (`attachAttribution`, `accountForCodes`, `trackClick`, `recordLandingClick`), nên phần tính người giới thiệu và hoa hồng phía sau chạy như cũ.
- Mã trong cookie `hm_ref` và các trường `ref` nay có dạng `mã.phạm-vi` (phạm vi là trang mà link được mở, web tự gắn lúc ghi nhớ); mã không có phạm vi (cookie cũ, mã gõ tay) vẫn được nhận. Trường `ref` nới giới hạn từ 300 lên 700 ký tự.
- API: `GET` và `PUT /v1/me/referral-code`. Ví (`/v1/me/affiliate/:programId`) trả thêm `codeEditable`, `previousCode`.
- Test: `packages/core/src/test/referral-code.test.ts` (15 ca), bổ sung `apps/web/src/lib/referral.test.ts` và `affiliate-link.test.ts`. Các test hoa hồng sẵn có không sửa và vẫn qua.

## Quyết định

**Một mã giới thiệu chung cho mỗi người, tính theo trang mở link** ({version}, chủ dự án yêu cầu ngày 21/11/2026). Chủ dự án chọn "một mã chung mọi nơi, mỗi người sửa một lần" thay cho việc sửa riêng mã của từng chương trình. Mã chung không tự nói nó thuộc chương trình nào, nên chương trình được xác định bằng trang mà link được mở: trang của hội thì là chương trình hội đó, trang khác là nền tảng. Chọn cách này để giữ nguyên luật đã chốt (link của hội không tự tính người giới thiệu nền tảng; mặc định nền tảng vẫn là chủ hội đầu tiên). Mã riêng cũ được giữ làm định danh bên trong và vẫn nhận trên link, nên không phải chuyển đổi dữ liệu và link đã chia sẻ không hỏng.
