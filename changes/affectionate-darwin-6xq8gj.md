---
bump: minor
---

Thêm lựa chọn hội kín hay hội mở trong Cài đặt, theo yêu cầu của chủ dự án ngày 21/11/2026. Có migration database (`0018_community_visibility`): thêm cột `communities.visibility`, mặc định `private`, nên mọi hội đang có vẫn là hội kín như trước.

### Thêm

- **Hội kín hay hội mở.** Trong Cài đặt, mục Chung có thêm phần "Ai xem được bên trong hội" với hai thẻ để chọn: Hội kín (chỉ thành viên xem được bên trong) và Hội mở (ai cũng xem được, chỉ thành viên mới đăng bài, bình luận và học). Chạm một thẻ rồi bấm Lưu. Hội đang có và hội tạo mới mặc định là hội kín.
- **Khách xem được hội mở.** Với hội mở, người chưa vào hội (kể cả chưa đăng nhập) mở được Bảng tin, bài viết kèm bình luận, danh sách khóa học, Sự kiện, Thành viên và Cửa hàng ở chế độ chỉ xem. Đầu trang có dải "Bạn đang xem hội mở" kèm nút Tham gia hội. Bấm thả tim, bình luận, bình chọn, đăng ký sự kiện thì hiện lời mời tham gia thay vì báo lỗi.
- **Trang giới thiệu hội ghi rõ hội kín hay hội mở.** Hội mở có thêm nút "Xem trước bên trong", và các tab Bảng tin, Khóa học, Sự kiện, Thành viên không còn khóa với người chưa vào hội.
- **Ô lệnh của chủ hội** có thêm mục "Hội kín hay hội mở" dẫn thẳng tới chỗ cài đặt.

### Thay đổi

- **Danh bạ thành viên của hội mở** xem được mà không cần đăng nhập (tên, ảnh, giới thiệu ngắn; không có email). Hội kín vẫn chỉ thành viên xem được.

## Quyết định

**Hội mở chỉ mở phần đọc, quyền của thành viên giữ nguyên** ({version}, chủ dự án yêu cầu ngày 21/11/2026). `resolveCommunityAccess` có hơn hai chục nơi gọi và nhiều nơi dùng quyền `community.read` để hiểu là "đã là thành viên" (thả tim, bình chọn, đăng ký sự kiện, lấy link affiliate). Vì vậy không cấp `community.read` cho người ngoài. Thay vào đó `CommunityAccess` có thêm trường `canView`: đúng khi người xem có `community.read`, hoặc khi hội để chế độ mở và đang hoạt động (hội nháp, bị khóa, đã lưu trữ thì không). Chỉ các đường đọc dùng `canView`: bảng tin, bài viết, bình luận của bài viết và sự kiện, danh sách khóa học, lịch và trang sự kiện, danh bạ thành viên. Mọi đường ghi vẫn kiểm `permissions` như cũ. Người ngoài không nhận: nội dung bài học (vẫn theo quyền từng khóa, bài xem thử thì xem được), thảo luận trong bài học, bản ghi sự kiện, bảng xếp hạng affiliate, trang Hôm nay, danh sách quản trị thành viên.

**Policy database cho hội mở** ({version}). Migration thêm hàm `hoiminh_open_community` và policy chỉ đọc `open_community_read` trên `posts`, `spaces`, `comments`, `events`, `community_members`. Production hiện chưa bật FORCE ROW LEVEL SECURITY nên policy này chưa có tác dụng. Khi bật, cần rà thêm các bảng phụ mà người ngoài đọc qua hội mở (ảnh bài viết, bình chọn, cảm xúc, đăng ký sự kiện) trước khi bật.
