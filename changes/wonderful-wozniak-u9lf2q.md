---
bump: minor
---

Trang Tài khoản → Affiliate lấy được link giới thiệu của nền tảng, của từng hội và của từng sản phẩm. Theo yêu cầu của chủ dự án, sau khi web thật không lấy được link nào. Không có migration.

### Thêm

- **Lấy link theo ba bước.** Bước 1 chọn nơi muốn giới thiệu (Nền tảng Hội Mình, hoặc từng hội đang tham gia), bước 2 chọn trang muốn chia sẻ, bước 3 sao chép link. Phần chọn luôn hiện, kể cả khi chỉ có một chương trình; trước đây hàng chọn chỉ hiện khi có từ hai chương trình trở lên.
- **Link cho từng sản phẩm.** Trong một hội, ngoài trang giới thiệu hội còn chọn được từng khóa học, combo, sản phẩm số đang bán. Mỗi dòng ghi giá và hoa hồng ước tính. Nhiều sản phẩm thì có ô tìm. Trước đây link sản phẩm chỉ nằm trong trang bán của từng sản phẩm, và chỉ hiện sau khi đã từng mở trang Ví.
- **Link nền tảng có hai trang.** Trang mở hội (cho người muốn mở hội riêng) và trang chủ Hội Mình.
- **Nút "Sao chép link" lớn, link hiện đủ không bị cắt**, có thêm nút Chia sẻ trên điện thoại và nút sao chép riêng mã giới thiệu. Trình duyệt không cho sao chép tự động thì trang báo để người dùng tự nhấn giữ vào link.
- **Hội chưa bật affiliate vẫn hiện trong danh sách**, kèm lý do. Người quản lý hội có nút "Bật affiliate cho hội" dẫn thẳng tới Cài đặt · Affiliate; thành viên thì được báo là chủ hội chưa bật.
- Trang nhớ chương trình xem lần trước trên máy đó. Lần đầu thì mở hội mà bạn đã có ví, không có thì mở chương trình nền tảng.

### Sửa

- **Web thật không có chương trình affiliate nền tảng.** Dòng này trước đây chỉ có trong dữ liệu mẫu, nên không ai lấy được link nền tảng và trang Hệ thống · Affiliate nền tảng báo lỗi. Nay hệ thống tự tạo khi chưa có, với mức mặc định 40% trong 12 tháng đầu, giữ 30 ngày, rút tối thiểu 500.000đ. Quản trị hệ thống đổi mức ở trang Hệ thống · Affiliate nền tảng.
- **Màn "Chưa có chương trình affiliate" không có lối đi tiếp.** Người ở trong hội chưa bật affiliate chỉ thấy một dòng thông báo. Nay luôn có link nền tảng, và hội chưa bật có hướng dẫn đi tiếp.
- **Hội tắt affiliate thì ví biến mất.** Người đã có hoa hồng trong một hội vừa tắt chương trình không còn lối vào ví để rút. Nay hội đó vẫn nằm trong danh sách, ví vẫn xem và rút được, chỉ ẩn phần link.
- Đổi chương trình không còn tải lại cả trang.
- Mức hoa hồng trên ô chọn chương trình lấy theo mức riêng của tài khoản (nếu quản trị đã đặt), không chỉ mức chung.

## Quyết định

**Chương trình affiliate nền tảng do hệ thống tự tạo, không qua migration** ({version}, chủ dự án yêu cầu ngày 21/11/2026). `platformProgram` (trong `affiliate-links.ts`) tìm chương trình nền tảng, chưa có thì ghi một dòng với id cố định và `onConflictDoNothing`, nên hai request cùng lúc không tạo ra hai chương trình. Không viết migration chèn dữ liệu vì đang có nhánh khác mang migration, và migration tạo trước mà merge sau sẽ bị database thật bỏ qua. Mức mặc định lấy theo dữ liệu mẫu và kiến trúc: 40% trong 12 tháng đầu, giữ 30 ngày. Người chi trả để trống: hàng đợi rút của nền tảng vốn xét theo quyền quản trị hệ thống, không theo cột này.

**Link sản phẩm là trang sản phẩm kèm `?ref=`, không tạo dòng link riêng** ({version}). Mã giới thiệu được ghi nhớ ở mọi trang, nên `linkTargets` chỉ ghép đường dẫn hiện tại của hội và sản phẩm với mã của affiliate, không ghi thêm vào bảng `affiliate_links`. Nhờ vậy hội đổi đường dẫn thì link mới lấy ra luôn đúng. Sản phẩm gắn khóa học đã tắt hoa hồng bán lẻ vẫn chọn được, có ghi rõ là không tính hoa hồng bán lẻ, vì người vào hội qua link đó vẫn được tính. Trang sản phẩm đòi đăng nhập nên người lạ bấm link sẽ đăng ký trước rồi mới tới sản phẩm; trang có ghi rõ điều này.

**Hội chưa bật affiliate vẫn nằm trong danh sách chương trình của tôi** ({version}). `myPrograms` trả thêm `enabled`, `canManage`, `hasAccount`. Giao diện không mở ví của một chương trình đang tắt nếu người dùng chưa có ví ở đó, vì mở ví là mở tài khoản affiliate.
