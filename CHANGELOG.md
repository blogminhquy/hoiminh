# CHANGELOG

## 1.4.0 (2026-09-15)

Chứng nhận hoàn thành khóa học. Trước bản này hệ thống báo "Chứng nhận có tên bạn đã sẵn sàng" khi học viên hoàn thành khóa, nhưng không có gì được cấp: chỉ có một cờ bật/tắt trên bảng `courses`.

- Bảng `certificates` (migration `0002_certificates.sql`) lưu mã tra cứu, tên người nhận, tên khóa, tên hội và ngày cấp, chụp lại tại thời điểm cấp.
- `packages/core/src/services/certificates.ts`: cấp một lần khi tiến độ đạt 100% và khóa bật chứng nhận, tra cứu theo mã, danh sách chứng nhận của tôi.
- Handler `course.completed` cấp chứng nhận rồi mới gửi thông báo, thông báo dẫn thẳng tới tờ chứng nhận.
- API: `GET /v1/courses/:id/certificate`, `GET /v1/me/certificates`, và `GET /v1/certificates/:code` công khai không cần đăng nhập.
- Web: trang `/chung-nhan/:code` với một mẫu cố định, in được ra A4 ngang bằng trình duyệt. Trang khóa học thay câu hứa bằng đường dẫn tới tờ thật khi đã học xong.
- Kiểm thử: 9 test core, 1 test API, luồng e2e 10 đi từ học xong tới xem chứng nhận, kể cả khách chưa đăng nhập và trường hợp mã sai.

## 1.3.0 (2026-09-15)

Sự kiện: link phòng họp thay cho phát trực tiếp.

- Không làm hạ tầng phát trực tiếp. Sự kiện nhận link phòng họp có sẵn của chủ hội: Zoom, Google Meet, YouTube, Facebook hoặc link tùy chọn bất kỳ. Phần này vốn đã có trong V1, bản này chỉnh lại cách lộ link và bổ sung kiểm thử.
- **Đăng ký xong là thấy link ngay**, bỏ quy tắc giấu tới 15 phút trước giờ bắt đầu. Cửa 15 phút trước đây chỉ áp ở trang chi tiết, còn danh sách sự kiện vẫn trả link, nên nó không chặn được gì mà chỉ làm người đăng ký sớm tưởng hỏng.
- **Sửa lỗi:** người đã hủy đăng ký vẫn đọc được link ở danh sách sự kiện, vì chỗ đó không lọc `status <> 'cancelled'` như trang chi tiết. Nay hai nơi cùng một quy tắc.
- Link tùy chọn (không phải Zoom/Meet/YouTube/Facebook) hiện nhãn "Phòng họp riêng" thay vì "Trực tuyến"; ô nhập trên màn Tạo sự kiện cũng nhận ra và gắn nhãn.
- 5 test mới `packages/core/src/test/event-link.test.ts` (ba loại link, thấy link sau khi đăng ký, hủy thì mất link, chủ hội luôn thấy, đổi link thì đổi nhà cung cấp); e2e 05 kiểm nút "Vào phòng" trỏ đúng địa chỉ đã nhập.

## 1.2.0 (2026-09-15)

Việc V2 thứ hai: Khu học tập cho người mua lẻ (mục 153): một người có thể chỉ mua khóa học mà không tham gia hội nào.

### Khu học tập `/hoc`
- `packages/core/src/services/learner.ts`: `myLibrary` gom khóa học và tài liệu đã sở hữu từ **entitlement** (mua lẻ, combo, gói, được tặng), kèm tiến độ và bài học để học tiếp. Không đụng tới `community_members` nên chạy đúng với người có 0 hội.
- `GET /v1/me/library`; `GET /health` giữ nguyên.
- Web: khung riêng `layouts/LearnerShell.tsx` (không có thanh bên hội), trang `pages/learner/Library.tsx` với thẻ khóa học có tiến độ, lọc Đang học / Hoàn thành, tài liệu số tải về, và lời mời vào hội miễn phí.
- Trang Bài học dùng chung cho hai khung: `/hoc/bai/:lessonId` và `/:slug/bai/:lessonId` là cùng một trang, chọn khung qua `useOptionalShell()` và dựng link qua `useLearningLinks()`.

### Mua lẻ không còn bị tự thêm vào hội
- Bỏ đoạn tự `joinCommunity` trong handler `payment.succeeded`. Quyền học vốn nằm ở entitlement; tư cách thành viên giờ là lựa chọn của người mua.
- Sau khi trả tiền, người không phải thành viên được đưa về `/hoc` thay vì khung hội (`orderStatus.nextUrl`, email, thông báo trong app).
- Trang gốc `/` đưa người mua lẻ (không hội, có đồ đã mua) vào `/hoc`.
- `AccountShell`: `/tai-khoan/*`, `/tin-nhan`, `/thong-bao` dùng khung Khu học tập khi người dùng không có hội nào: trước đây `AppShell` đá họ về `/kham-pha`, nên người mua lẻ không xem được hóa đơn của chính mình.

### Kiểm thử
- 9 test `packages/core/src/test/learner.test.ts`: thư viện rỗng, mua lẻ, combo mở khóa con, tài liệu số, thu hồi khi hoàn tiền, entitlement hết hạn, gợi ý vào hội, sắp xếp theo tiến độ, và luồng thanh toán không tự thêm vào hội.
- 2 test API cho `/v1/me/library` và cổng tải tài liệu số.
- Luồng e2e 09: đăng ký → mua lẻ qua chuyển khoản → về `/hoc` → khung hội vẫn chặn → học bài ở `/hoc/bai/:id`.

## 1.1.0 (2026-09-15)

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
