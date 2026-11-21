---
bump: minor
---

Rà soát toàn bộ MCP, API key và webhook theo yêu cầu của chủ dự án ngày 21/11/2026: đối chiếu từng route REST với bảng quyền của API key và bộ lệnh MCP, bổ sung những chỗ còn thiếu để trợ lý AI thêm, sửa, xóa được ở bài viết, bình luận, thành viên, affiliate, sự kiện, webhook và cài đặt. Bộ lệnh MCP từ 100 lên 119 lệnh. Không có migration.

### Thêm

- **Sửa bình luận.** Trước đây bình luận chỉ tạo, ghim và xóa được. Nay có `PATCH /v1/comments/:id` và lệnh `update_comment` (tác giả hoặc người kiểm duyệt sửa nội dung; ảnh, lượt thích, các trả lời giữ nguyên).
- **Thả cảm xúc qua API key.** Lệnh `toggle_reaction` thả, đổi, gỡ cảm xúc ở bài viết và bình luận dưới tên chủ hội.
- **Hủy sự kiện và xóa bản ghi.** Lệnh `cancel_event` (`DELETE /v1/events/:id`) đưa buổi sang trạng thái đã hủy: biến khỏi lịch, ngừng nhắc, dữ liệu còn nguyên; `update_event` với `status: "scheduled"` mở lại. Lệnh `delete_event_recording` gỡ một bản ghi khỏi mục Xem lại.
- **Quản lý từng affiliate.** Lệnh `list_affiliates` liệt kê affiliate của hội kèm mã, lượt bấm, số đơn, hoa hồng đang giữ, rút được, đã trả. Lệnh `update_affiliate` tạm khóa, mở lại hoặc đặt tỉ lệ hoa hồng riêng cho một affiliate. Lệnh `export_withdrawals_csv` xuất bảng đối soát.
- **Thu hồi khóa học đã cấp tay.** Lệnh `revoke_course` là chiều ngược của `grant_course`; quyền có do mua hoặc do gói không bị đụng tới.
- **Xuất thành viên ra CSV.** Lệnh `export_members_csv`.
- **Sửa, gửi thử, đổi secret webhook.** Lệnh `update_webhook` (đổi địa chỉ, đổi sự kiện, tạm dừng, bật lại webhook đã tự dừng vì lỗi), `test_webhook` (gửi sự kiện `ping` qua đúng đường giao thật), `rotate_webhook_secret`.
- **Ba sự kiện webhook mới.** `member.removed` (bị mời ra), `member.banned` (bị khóa), `affiliate.withdrawal_requested` (affiliate gửi yêu cầu rút, để trợ lý báo chủ hội xử lý ngay). Tổng cộng 15 sự kiện.
- **Cài đặt hội.** Lệnh `get_community_about` đọc trang giới thiệu (gồm câu hỏi tham gia đang đặt, trước đây chỉ ghi được mà không đọc lại được), `update_about_media` đặt bộ ảnh và video giới thiệu.
- **Tin nhắn và thông báo.** Lệnh `recall_message` (thu hồi tin đã gửi), `archive_conversation`, `mark_notifications_read`.
- **Việc lặt vặt còn thiếu lệnh.** `rotate_inbound_source` (đổi địa chỉ nguồn đồng bộ khi bị lộ), `delete_file` (bỏ tệp tải lên mà không dùng).

### Sửa

- **Không hủy được sự kiện.** Tầng dịch vụ nhận `status` khi sửa sự kiện nhưng hợp đồng API bỏ trường này đi, nên không có đường nào (web, REST, MCP) hủy được một buổi. Nay `updateEventSchema` nhận `status` là `scheduled` hoặc `cancelled`.

## Quyết định

**Rà soát MCP và API key: bổ sung cho đủ thêm, sửa, xóa; danh sách "chỉ làm trên web" giữ nguyên** ({version}, chủ dự án yêu cầu ngày 21/11/2026). Cách rà: liệt kê mọi route REST, đối chiếu với bảng `api-key-access.ts` và bộ lệnh `mcp/tools.ts`, mỗi chỗ thiếu rơi vào một trong ba loại. (a) Có route và có dòng trong bảng nhưng chưa có lệnh MCP: thêm lệnh. (b) Có route nhưng API key bị chặn dù việc đó thuộc phạm vi key đã có (thả cảm xúc, thu hồi tin nhắn, lưu trữ hội thoại, đánh dấu thông báo đã đọc): thêm dòng vào bảng và thêm lệnh. (c) Chưa có cả route (sửa bình luận, hủy sự kiện, xóa bản ghi, sửa và gửi thử webhook, quản lý từng affiliate, thu hồi khóa học): viết dịch vụ, route, dòng trong bảng, lệnh và test. Không thêm phạm vi mới: 19 phạm vi sẵn có đủ chứa mọi lệnh mới, nên key đã tạo dùng được ngay. Hủy sự kiện là đổi trạng thái chứ không xóa dòng, vì người đã đăng ký, câu hỏi và bản ghi gắn với buổi đó và hủy nhầm phải mở lại được. `update_affiliate` đánh dấu destructive vì tỉ lệ hoa hồng riêng là tiền; trần vẫn là 50% như chương trình chung. Gửi thử webhook dùng tên sự kiện `ping` nằm ngoài `WEBHOOK_EVENTS`: không ai đăng ký nhận `ping` được, chỉ sinh ra khi chủ hội chủ động gửi thử. Những việc mục 73 (c) cố ý không mở cho key nào vẫn đóng: quản lý API key, mật khẩu và 2FA, hồ sơ tài khoản chủ hội, tài khoản nhận tiền và khóa cổng thanh toán, phương thức thanh toán, đội ngũ quản trị workspace, lưu trữ hội, ví affiliate của chính chủ hội, `/v1/admin`. Phát hiện khi rà nhưng để việc riêng: mã mời trong link `?invite=` được ghi vào `community_invites` mà không nơi nào đọc lại (mời với vai trò admin không có tác dụng), nên chưa thêm lệnh liệt kê và thu hồi lời mời.
