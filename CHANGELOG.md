# CHANGELOG

## 1.1.0 — 2026-09-15

Việc V2 đầu tiên: tin nhắn chuyển từ polling sang thời gian thực.

### Tin nhắn thời gian thực
- `packages/core/src/realtime/hub.ts`: hub trong tiến trình (`ctx.realtime`) đẩy sự kiện theo `userId` và theo dõi ai đang mở phiên.
- `GET /v1/me/stream` (SSE): `message.new`, `message.read`, `conversation.typing`, `notification.new`, `badges.changed`, `presence.changed`; nhịp giữ kết nối 25 giây.
- `POST /v1/me/conversations/:id/typing` và `.../read`; `POST /v1/me/presence` trả danh sách người đang online.
- Web: `apps/web/src/lib/realtime.tsx` đọc luồng bằng `fetch` + `ReadableStream` (gắn được Bearer token), tự nối lại với backoff tới 30 giây.
- Màn Tin nhắn: tin mới hiện ngay, biên nhận "Đã xem", chỉ báo "đang gõ", chấm xanh online; badge tin nhắn và thông báo cập nhật theo sự kiện.
- Polling giữ nguyên làm dự phòng, giãn từ 15 giây lên 120 giây khi luồng đang mở.
- `GET /health` trả thêm `realtimeConnections`.

### Kiểm thử và công cụ
- 8 test hub và dịch vụ tin nhắn (`packages/core/src/test/realtime.test.ts`), 2 test SSE trong `apps/api/src/api.test.ts`, luồng e2e 08 với hai trình duyệt cùng lúc.
- `playwright.config.ts` nhận `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` để chạy trên máy đã có sẵn Chromium bản khác (khai báo `passThroughEnv` trong `turbo.json`).
- Sửa lỗi đua trong e2e 01: trang Xác minh email tự gửi khi đủ 6 số, nên không bấm nút nữa mà chỉ chờ chuyển trang.
- Sửa CI đỏ từ trước: job `check` chạy `pnpm test` kéo theo cả gói e2e nhưng không cài trình duyệt Playwright, nên mọi lần chạy đều hỏng. `pnpm test` giờ loại gói e2e (`--filter=!@hoiminh/e2e`), đúng như README mô tả; e2e vẫn chạy đủ ở job riêng đã cài trình duyệt.

## 1.0.0 — 2026-09-14

Bản triển khai đầu tiên của toàn bộ mã nguồn Hội Mình từ tài liệu kiến trúc V1.5 và bộ thiết kế 50 màn hình.

### Nền tảng
- Monorepo pnpm + Turborepo, TypeScript strict, ESLint, CI (typecheck, lint, test, build, e2e).
- `packages/db`: schema Drizzle 80+ bảng, migration SQL, Row Level Security theo tenant, seed dữ liệu mẫu khớp demo.
- `packages/core`: service layer dùng chung (web, REST, webhook, MCP), RBAC role → permission, event bus, hàng đợi, cron, entitlement engine, auth local/Supabase.
- `packages/payments`: adapter SePay, MoMo, VNPAY, PayPal với verify chữ ký, chuẩn hóa trạng thái, test payload mẫu.
- `packages/email` (Resend), `packages/media` (R2 / local), `packages/contracts` (Zod), `packages/config`, `packages/ui`.

### Ứng dụng
- `apps/api`: Hono REST `/v1`, webhook thanh toán idempotent, trang mô phỏng sandbox, `/r/:code` attribution, API key, webhook gửi đi ký HMAC, cron; chạy Node (dev) và Cloudflare Workers.
- `apps/web`: 50 màn hình theo thiết kế, responsive từ 390px, ba vai trò trên các route `/`, `/admin`, `/he-thong`.
- `apps/mcp`: 10 tool MCP gọi API bằng API key.
- `e2e`: Playwright 7 luồng nghiệp vụ (đăng ký → tham gia, Premium qua SePay, mua lẻ qua MoMo + hoàn tiền, cộng sự rút tiền, chủ hội tạo hội/khóa học/sự kiện, gói nền tảng, quản trị đối soát) tự khởi động API + web với DB riêng.

### Nghiệp vụ
- Pricing mode `free | freemium | subscription | one_time`, đóng cổng, tier Tiêu chuẩn/Premium/VIP.
- Checkout tier/sản phẩm/gói nền tảng; `payment.succeeded` → entitlement → email + thông báo.
- Hoàn tiền khóa học trong 7 ngày nếu xem chưa quá 20%.
- Affiliate hai tầng chi trả thủ công: sổ cái ví bất biến, hold/available/reversed, rút tiền có snapshot tài khoản mã hóa, xem xét với QR, mã tham chiếu, từ chối.
- Xếp hạng cộng sự theo snapshot 10 phút.
- Gói nền tảng một gói tháng/năm, dùng thử 14 ngày, nhắc 7/3/1 ngày, hết hạn khóa tạo nội dung.
- Quản trị hệ thống: đối soát chuyển khoản, ghép thủ công, bật/tắt cổng, khóa hội, nhật ký.
