---
bump: minor
---

Chốt cách tính link và cookie cho affiliate, tách rõ hai tầng: affiliate nền tảng và affiliate của từng hội. Theo yêu cầu của chủ dự án. Không có migration.

### Thay đổi

- **Hai tầng affiliate tính riêng.** Link của hội nào thì tính hoa hồng cho hội đó. Tầng nền tảng tính cho dịch vụ của nền tảng (gói Hội Mình). Một người giới thiệu được nhiều người, ở nhiều hội khác nhau.
- **Trong một hội thì tính lượt bấm cuối (last click), 30 ngày, cho tới lúc người đó vào hội.** Áp dụng cho cả người đã có tài khoản Hội Mình (đang ở hội khác). Đăng ký qua link của A rồi bấm link của B mới vào hội thì B được ghi nhận. Vào hội rồi thì người giới thiệu là cố định: người khác không giới thiệu tranh được nữa.
- **Thành viên đang ở trong hội thì link không tính cho từng đơn hàng.** Thành viên chưa có người giới thiệu mà bấm thêm link của ai đó rồi mua thì đơn đó không tính hoa hồng. Họ tự chọn người giới thiệu ở thẻ "Người giới thiệu của bạn" (mã, link hoặc email). Bản 1.36.0 còn tính trường hợp này; nay bỏ.
- **Tầng nền tảng ghi một lần rồi cố định.** Đăng ký tài khoản qua link nền tảng thì người chia sẻ link là người giới thiệu nền tảng; sau đó người khác giới thiệu không được tính nữa.
- **Người vào một hội thì người giới thiệu nền tảng mặc định là chủ hội đó.** Áp dụng khi tài khoản chưa có người giới thiệu nền tảng. Về sau người này mua gói Hội Mình thì hoa hồng nền tảng về chủ hội đã đưa họ về.
- **Cookie nhớ được nhiều mã.** Trước đây cookie chỉ nhớ một mã, nên bấm link của hội B là mất mã của hội A. Nay cookie nhớ tới 8 mã, mỗi hội (và nền tảng) tính mã mới nhất của chính mình. Một lượt đăng ký ghi được cả người giới thiệu nền tảng lẫn lượt bấm của từng hội.
- Trang giới thiệu hội chỉ hiện dòng "Bạn được ... giới thiệu" khi lượt giới thiệu đó thật sự được tính cho hội này.

### Sửa

- **Đăng ký bằng Google làm rơi mã giới thiệu.** Tài khoản tạo qua Google không được ghi người giới thiệu dù có cookie. Nay được tính như đăng ký bằng email.
- Mã giới thiệu của hội khác trên link không còn làm hiện sai tên người giới thiệu ở trang giới thiệu hội.

## Quyết định

**Affiliate hai tầng: hội tính lượt bấm cuối cho tới lúc vào hội, nền tảng ghi một lần và mặc định về chủ hội; cookie 30 ngày nhớ nhiều mã** ({version}, chủ dự án chốt ngày 21/11/2026 qua ba lượt chỉnh, thay bước 2 của mục 74). Chủ dự án cân nhắc 14 hay 30 ngày và chọn 30. (a) Tầng hội, `resolveReferrer`: trước hết là người giới thiệu cố định của người đó trong hội này (dòng thành viên, hoặc đơn đã tính hoa hồng gần nhất với người mua lẻ). Chưa có và chưa ở trong hội thì tính lượt bấm cuối: mã của hội này trong các mã họ đang mang theo, rồi tới lượt bấm đã ghi lúc đăng ký nếu còn hạn 30 ngày. Hai bản nháp trước bị bác: bản đầu chỉ tính lúc đăng ký tài khoản (người đã có tài khoản được mời sang hội thì người mời mất công); bản hai để lượt đăng ký thắng lượt bấm sau đó (chủ dự án chốt "hội thì tính last click", nên đăng ký qua link của A rồi bấm link của B mới vào thì B được ghi nhận). Thành viên đang ở trong hội mà chưa có người giới thiệu thì bấm thêm link không được tính: link trả công cho việc đưa người mới vào hội, tính theo đơn thì affiliate đến sau chỉ cần gửi link trước kỳ gia hạn là lấy được khách. Với họ chỉ còn lượt bấm đã ghi lúc đăng ký còn hạn (giữ cho thành viên vào hội lúc chương trình còn tắt) và tự chọn (mục 76). (b) Tầng nền tảng ghi một lần rồi cố định, không hết hạn: mã nền tảng lúc đăng ký tài khoản (`attachAttribution`); chưa có thì lúc người đó vào một hội, người giới thiệu nền tảng mặc định là chủ hội đó (`defaultPlatformReferrer`, gọi từ sự kiện `member.joined`, nên phủ cả tham gia miễn phí, mua gói và được duyệt). Lý do: chủ hội là người đưa thành viên về Hội Mình, nên khi thành viên đó tự mở hội và mua gói thì công thuộc về chủ hội. Mã nền tảng bấm sau khi đã có tài khoản không được tính. (c) Cookie `hm_ref` chứa danh sách tối đa 8 mã cách nhau bằng dấu phẩy, mới bấm đứng trước (`refCodes` trong contracts); mỗi chương trình lấy mã mới nhất của chính nó. Cần danh sách vì một cookie một mã thì bấm link hội B xóa mất mã hội A. Chọn nhớ ở cookie thay vì ghi lượt bấm vào database cho người đã đăng nhập, để dòng attribution có `user_id` chỉ sinh ra ở hai chỗ đã nêu. Cột `affiliate_programs.cookie_days` vẫn là 30. Người rời hội rồi quay lại mà trước đó chưa có người giới thiệu thì được tính như người chưa ở trong hội.
