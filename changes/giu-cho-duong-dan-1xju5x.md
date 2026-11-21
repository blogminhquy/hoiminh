---
bump: patch
---

Giữ chỗ nốt các đường dẫn hệ thống còn thiếu, để không hội nào đặt trùng rồi bị che mất trang. Theo yêu cầu của chủ dự án. Không có migration.

### Sửa

- **Bảy đường dẫn hệ thống chưa được giữ chỗ.** Một hội đặt đường dẫn là `chung-nhan`, `mcp`, `webhooks`, `pay`, `files`, `health` hoặc `icons` thì trang của hội bị phần khác của hệ thống trả lời thay: ví dụ `hoiminh.com/health` trả về dữ liệu kiểm tra máy chủ, `hoiminh.com/chung-nhan/...` mở trang chứng nhận. Nay bảy tên này không đặt làm đường dẫn hội được, khi tạo hội hoặc đổi đường dẫn sẽ báo "Đường dẫn này được hệ thống dùng, chọn tên khác". Đã kiểm trên database thật: chưa hội nào dùng các tên này (kể cả đường dẫn cũ đã đổi).

### Kỹ thuật

- `RESERVED_SLUGS` trong `packages/config/src/index.ts` thêm bảy tên trên.
- Test mới `packages/config/src/reserved-paths.test.ts` đọc thẳng ba nơi khai báo đường dẫn: route cấp cao nhất của web (`apps/web/src/app/router.tsx`), `run_worker_first` trong `apps/api/wrangler.toml`, và các thư mục trong `apps/web/public`. Thêm route hệ thống mới mà quên giữ chỗ thì test đỏ.
