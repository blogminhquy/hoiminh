---
bump: patch
---

Người vào hội được ghi chủ hội làm người giới thiệu nền tảng ngay cả khi hệ thống chưa có chương trình affiliate nền tảng. Theo yêu cầu của chủ dự án. Không có migration.

### Sửa

- **Người vào hội sớm bị bỏ sót người giới thiệu nền tảng.** Luật của bản 1.37.0: người vào một hội mà tài khoản chưa có người giới thiệu nền tảng thì chủ hội đó là người giới thiệu nền tảng. Nhưng luật này bỏ qua khi hệ thống chưa có chương trình affiliate nền tảng, mà chương trình chỉ được tạo lúc có người mở trang Affiliate lần đầu (bản 1.40.0). Ai vào hội trước thời điểm đó thì không được ghi, và về sau cũng không được ghi lại. Nay chương trình được tạo ngay ở lần đầu có người vào một hội.
- Chương trình nền tảng đang tạm dừng thì vẫn không ghi, như cũ.

## Quyết định

**`defaultPlatformReferrer` tự tạo chương trình nền tảng khi chưa có** ({version}, chủ dự án yêu cầu ngày 21/11/2026, bổ sung mục 78). Hàm gọi `platformProgram` (tìm, chưa có thì tạo với mức mặc định) thay cho chỉ tìm. Đã cân nhắc để nguyên, vì trên web thật chương trình sẽ có ngay khi ai đó mở trang Affiliate; không chọn vì người vào hội trong khoảng trống đó mất người giới thiệu nền tảng vĩnh viễn (tầng nền tảng ghi một lần rồi cố định), và lỗi kiểu này không ai thấy. GitNexus xếp hàm ở mức rủi ro cao do nằm trên đường xử lý sự kiện `member.joined`; phần đổi chỉ là một lần ghi thêm ở lượt gọi đầu tiên, các lượt sau vẫn là một câu đọc như trước.
