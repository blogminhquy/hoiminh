# Hội Mình

Nền tảng cộng đồng, khóa học và thanh toán cho người Việt: một chủ hội, nhiều hội, bảng tin, khóa học video, sự kiện, cửa hàng, cộng sự (affiliate) và thanh toán qua chuyển khoản QR, MoMo, VNPAY, PayPal. Không thu phí giao dịch; chủ hội trả một gói nền tảng theo tháng hoặc năm.

Tài liệu kiến trúc: `PLATFORM_ARCHITECTURE_V1_5_SIMPLE_SALES_UX.md`. Thiết kế 50 màn hình: `design/hoi-minh-demo.html`. Quyết định triển khai: `DECISIONS.md`. Tiến trình: `docs/PROGRESS.md`.

## Chạy local (máy sạch, không cần Postgres)

Yêu cầu: Node 20.11+, pnpm 9 (`corepack enable` hoặc `npm i -g pnpm`).

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Mở http://localhost:5173 → Bảng tin của hội mẫu "Kinh Doanh Online Cùng AI" (`/minhquy/bang-tin`). API chạy tại http://localhost:8787 (`/health`). Cơ sở dữ liệu là PGlite nhúng trong `.data/hoiminh`; `pnpm db:reset` xóa và nạp lại dữ liệu mẫu.

Tài khoản mẫu (mật khẩu chung `hoiminh123`):

| Vai trò | Email | Vào đâu |
|---|---|---|
| Chủ hội | minhquy@gmail.com | `/admin`, `/minhquy/cai-dat` |
| Super admin | admin@hoiminh.vn | `/he-thong` |
| Cộng sự | hoangvu@gmail.com | `/tai-khoan/cong-su`, `/minhquy/xep-hang` |
| Thành viên Tiêu chuẩn | congtran@gmail.com | `/minhquy/bang-tin` |
| Chủ hội đang dùng thử | vy.english@gmail.com | `/admin` |

Không cần điền `.env` để chạy local. Muốn đổi cấu hình, sao chép `.env.example` thành `.env`.

Thanh toán ở local: SePay tạo QR VietQR thật nhưng không có tiền về; giả lập bằng cách gửi webhook (xem `e2e/helpers/index.ts`). MoMo/VNPAY/PayPal chưa có credential thì chuyển tới trang mô phỏng `/pay/simulator` của API, trang này gửi IPN ký đúng về API nên toàn bộ luồng xử lý là thật.

## Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm dev` | API (Node, tsx watch) + web (Vite) |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | kiểm tra kiểu, ESLint, Vitest (db, core, payments, email, media, api, mcp) |
| `pnpm test:e2e` | Playwright 9 luồng nghiệp vụ (tự khởi động API + web với DB riêng `.data/e2e`). Máy đã có sẵn Chromium bản khác: đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/đường/dẫn/chrome` để khỏi tải lại |
| `pnpm check` | typecheck + lint + test |
| `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:reset` · `pnpm db:generate` | migration, seed, reset PGlite, sinh migration từ schema |
| `pnpm build` | build tất cả (web → `apps/web/dist`) |
| `pnpm deploy` | migrate Supabase → deploy Worker API → deploy Pages (xem dưới) |

## Cấu trúc

```
apps/api        Hono REST /v1, webhook thanh toán, /r/:code, /files, /pay/simulator, cron; chạy Node (dev) hoặc Cloudflare Worker
apps/web        React 18 + Vite + Tailwind, 50 màn hình, route /:slug/*, /admin, /he-thong, /tai-khoan, /hoc (Khu học tập người mua lẻ)
apps/mcp        MCP server (stdio) gọi REST bằng API key hm_live_/hm_test_
packages/core   Service layer dùng chung (web, REST, webhook, MCP): auth, hội, thành viên, bài viết, khóa học, sự kiện, cửa hàng, checkout, entitlement, affiliate, rút tiền, tin nhắn, thông báo, gói nền tảng, admin
packages/db     Schema Drizzle, migration SQL (+ RLS), seed
packages/payments  Adapter SePay, MoMo, VNPAY, PayPal (verify chữ ký, chuẩn hóa sự kiện, hoàn tiền)
packages/contracts Zod schema + kiểu dùng chung
packages/config  Env schema, hằng số nghiệp vụ, crypto
packages/email   Resend (hoặc log khi không có key)
packages/media   R2 (hoặc lưu local .data/files)
packages/ui      Token, CSS, component theo thiết kế
e2e             Playwright
infra           deploy.mjs, wrangler.pages.toml
```

## Deploy Cloudflare + Supabase

1. **Supabase**: tạo project, bật Auth (Email + Google). Lấy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`. Chuỗi kết nối pooler (cổng 6543) làm `DATABASE_URL`, kết nối trực tiếp (cổng 5432) làm `DATABASE_DIRECT_URL`. Đặt `AUTH_PROVIDER=supabase`.
2. **Migration**: `DATABASE_DIRECT_URL=... pnpm db:migrate` (RLS bật tự động; API production nên dùng role `hoiminh_app` như trong `packages/db/migrations/0001_rls.sql`).
3. **Worker API**: `apps/api/wrangler.toml` đã khai báo queue `hoiminh-jobs` và cron (mỗi phút, 10 phút, hằng ngày). Đặt secret bằng `wrangler secret put` cho mọi biến trong `.env.example` (DATABASE_URL, AUTH_JWT_SECRET, ENCRYPTION_KEY, RESEND_API_KEY, R2_*, SEPAY_*, MOMO_*, VNPAY_*, PAYPAL_*). Deploy: `pnpm --filter @hoiminh/api deploy`.
4. **Pages web**: `pnpm --filter @hoiminh/web build` rồi `wrangler pages deploy apps/web/dist --project-name hoiminh-web` (tệp `apps/web/public/_redirects` xử lý SPA). Biến build: `VITE_API_URL`, `VITE_APP_URL`.
5. **R2**: tạo bucket `hoiminh-files`, bật public access hoặc gắn domain, điền `R2_*`.
6. Hoặc chạy tất cả: `node infra/deploy.mjs` (bỏ bước bằng `--skip-migrate`, `--skip-api`, `--skip-web`).

## Cấu hình cổng thanh toán

| Cổng | Biến | Webhook/IPN cần khai báo với cổng |
|---|---|---|
| SePay (chuyển khoản QR) | `SEPAY_API_KEY`, `SEPAY_BANK_CODE`, `SEPAY_BANK_ACCOUNT`, `SEPAY_ACCOUNT_HOLDER` | `POST https://api.<domain>/webhooks/sepay`, header `Authorization: Apikey <SEPAY_API_KEY>` |
| MoMo | `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_ENDPOINT` | IPN `POST /webhooks/momo` (HMAC-SHA256) |
| VNPAY | `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_ENDPOINT` | IPN `GET /webhooks/vnpay` (HMAC-SHA512) |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_USD_RATE` | `POST /webhooks/paypal` (verify-webhook-signature) |

Super admin có thể bật/tắt từng cổng và nhập credential trong `/he-thong/thanh-toan` (lưu mã hóa bằng `ENCRYPTION_KEY`). Nội dung chuyển khoản dạng `HM XXXXX`; giao dịch sai nội dung/thiếu mã/lệch tiền hiện ở bảng đối soát để ghép thủ công.

## API, webhook gửi đi, MCP

- REST: prefix `/v1`, xác thực `Authorization: Bearer <JWT>` hoặc API key `hm_live_…`/`hm_test_…` (tạo ở Hội của tôi · Tài khoản · API). Lỗi trả `{ code, message }`.
- Webhook gửi đi: đăng ký URL + scope ở `/v1/workspaces/:id/webhooks`; sự kiện ký HMAC-SHA256 header `X-HoiMinh-Signature`, thử lại theo backoff.
- MCP: `pnpm --filter @hoiminh/mcp start` với `HOIMINH_API_URL` và `HOIMINH_API_KEY`; 10 tool (danh sách hội, thành viên, đăng bài, tạo khóa học, sự kiện, doanh thu…).

## Tin nhắn thời gian thực

- `GET /v1/me/stream` là luồng SSE của người đang đăng nhập: `message.new`, `message.read`, `conversation.typing`, `notification.new`, `badges.changed`, `presence.changed`. Gửi tin vẫn dùng `POST /v1/me/messages`.
- Web đọc luồng bằng `fetch` + `ReadableStream` (`apps/web/src/lib/realtime.tsx`) để gắn được `Authorization: Bearer`, tự nối lại với backoff tới 30 giây. Mất luồng thì màn Tin nhắn quay lại polling 15 giây, không hỏng.
- Hai endpoint phụ: `POST /v1/me/conversations/:id/typing` (báo đang gõ, hết hạn 6 giây) và `POST /v1/me/conversations/:id/read` (đánh dấu đã đọc mà không tải lại cả luồng).
- `GET /health` trả thêm `realtimeConnections` — số phiên SSE đang mở của tiến trình đó.
- Hub nằm trong bộ nhớ tiến trình API, đúng cho một node. Chạy nhiều node hoặc trên Cloudflare Workers cần thay `createRealtimeHub()` bằng bản Durable Object / Redis pub/sub (DECISIONS.md mục 25); phần còn lại của mã không đổi.

## Khu học tập của người mua lẻ

- Một người có thể chỉ mua khóa học hoặc tài liệu mà **không tham gia hội nào**. Chỗ học của họ là `/hoc`, chạy ngoài khung hội.
- `GET /v1/me/library` trả khóa học và tài liệu đã sở hữu, kèm tiến độ và `resumeLessonId` để bấm vào học tiếp. Danh sách dựng từ entitlement, nên khóa mở nhờ tư cách thành viên (Premium/VIP) không nằm ở đây mà ở `/:slug/khoa-hoc`.
- Bài học `/hoc/bai/:lessonId` là cùng một trang với `/:slug/bai/:lessonId`, chỉ khác khung bao ngoài.
- Mua lẻ **không** tự thêm người mua vào hội. Nếu hội đang mở cửa và miễn phí, Khu học tập hiện lời mời để họ tự quyết.
- Người không có hội nào vẫn xem được hóa đơn và đơn hàng ở `/tai-khoan/goi` (khung tự chuyển sang Khu học tập).
