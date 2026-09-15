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
| `pnpm test:e2e` | Playwright 7 luồng nghiệp vụ (tự khởi động API + web với DB riêng `.data/e2e`) |
| `pnpm check` | typecheck + lint + test |
| `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:reset` · `pnpm db:generate` | migration, seed, reset PGlite, sinh migration từ schema |
| `pnpm build` | build tất cả (web → `apps/web/dist`) |
| `pnpm deploy` | migrate Supabase → deploy Worker API → deploy Pages (xem dưới) |

## Cấu trúc

```
apps/api        Hono REST /v1, webhook thanh toán, /r/:code, /files, /pay/simulator, cron; chạy Node (dev) hoặc Cloudflare Worker
apps/web        React 18 + Vite + Tailwind, 50 màn hình, route /:slug/*, /admin, /he-thong, /tai-khoan
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
.github         CI (kiểm tra) và Deploy (tự động lên Cloudflare khi đẩy lên main)
```

## Deploy Cloudflare + Supabase

1. **Supabase**: tạo project, bật Auth (Email + Google). Lấy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`. Chuỗi kết nối pooler (cổng 6543) làm `DATABASE_URL`, kết nối trực tiếp (cổng 5432) làm `DATABASE_DIRECT_URL`. Đặt `AUTH_PROVIDER=supabase`.
2. **Migration**: `DATABASE_DIRECT_URL=... pnpm db:migrate` (RLS bật tự động; API production nên dùng role `hoiminh_app` như trong `packages/db/migrations/0001_rls.sql`).
3. **Worker API**: `apps/api/wrangler.toml` đã khai báo queue `hoiminh-jobs` và cron (mỗi phút, 10 phút, hằng ngày). Đặt secret bằng `wrangler secret put` cho mọi biến trong `.env.example` (DATABASE_URL, AUTH_JWT_SECRET, ENCRYPTION_KEY, RESEND_API_KEY, R2_*, SEPAY_*, MOMO_*, VNPAY_*, PAYPAL_*). Deploy: `pnpm --filter @hoiminh/api deploy`.
4. **Pages web**: `pnpm --filter @hoiminh/web build` rồi `wrangler pages deploy apps/web/dist --project-name hoiminh-web` (tệp `apps/web/public/_redirects` xử lý SPA). Biến build: `VITE_API_URL`, `VITE_APP_URL`.
5. **R2**: tạo bucket `hoiminh-files`, bật public access hoặc gắn domain, điền `R2_*`.
6. Hoặc chạy tất cả: `node infra/deploy.mjs` (bỏ bước bằng `--skip-migrate`, `--skip-api`, `--skip-web`).

Đã dựng sẵn: project Pages **hoiminh-web** → https://hoiminh-web.pages.dev (nhánh production `main`).

## Tự động deploy khi đẩy lên GitHub

`.github/workflows/deploy.yml` chạy mỗi khi có commit mới trên `main`: kiểm tra (typecheck · lint · test) → build web → `wrangler pages deploy`. Bấm **Actions → Deploy → Run workflow** để deploy lại bằng tay.

Cần đúng một secret do người dùng tự tạo (Claude/CLI không tạo được API token thay bạn):

1. Cloudflare → **My Profile → API Tokens → Create Token → Edit Cloudflare Workers** (thêm quyền *Cloudflare Pages: Edit*), chọn account `Blogminhquy@gmail.com's Account`.
2. Lưu vào GitHub:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo blogminhquy/hoiminh
```

Đã đặt sẵn trong repo: secret `CLOUDFLARE_ACCOUNT_ID`, biến `VITE_API_URL`, `VITE_APP_URL`, `CF_PAGES_PROJECT`. Đặt thêm biến `DEPLOY_API=true` (`gh variable set DEPLOY_API --body true`) khi Worker API đã có đủ secret trên Cloudflare, lúc đó workflow deploy luôn cả API.

Cách khác, không cần token: Cloudflare Dashboard → Workers & Pages → `hoiminh-web` → Settings → Builds → **Connect to Git**, chọn repo `blogminhquy/hoiminh`, build command `pnpm --filter @hoiminh/web build`, output `apps/web/dist`. Khi đó Cloudflare tự build mỗi lần push (nhưng không chạy test trước).

## Nhãn phiên bản và nút cập nhật

Góc dưới bên trái mọi màn hình có nhãn `v1.0.0 · <commit>`. Bấm vào để mở bảng:

- **Đang chạy** — phiên bản, nhánh, giờ build, commit message của bản trình duyệt đang mở.
- **Máy chủ** — phiên bản đang phục vụ trên Cloudflare, đọc từ `/version.json` (hỏi lại mỗi 2 phút và mỗi lần quay lại tab).
- **Cập nhật ngay** — hiện khi hai bên lệch nhau; xóa cache trình duyệt rồi nạp lại để lấy bản mới. Khi có bản mới, nhãn đổi sang màu cam "Có bản mới".
- **Lịch sử phiên bản** — đọc từ `CHANGELOG.md` lúc build, nên viết CHANGELOG là đủ, không cần sửa code.
- **Máy này** — nhật ký các phiên bản trình duyệt này đã dùng (lưu ở localStorage, tối đa 20 dòng).
- Super admin thấy thêm liên kết tới commit trên GitHub và trang chạy lại workflow deploy.

Thông tin build do `apps/web/scripts/version-plugin.ts` sinh ra lúc đóng gói (`__HM_BUILD__` + `dist/version.json`); `apps/web/public/_headers` giữ `version.json` và `index.html` không bị cache.

## Cấu hình cổng thanh toán

| Cổng | Biến | Webhook/IPN cần khai báo với cổng |
|---|---|---|
| SePay (chuyển khoản QR) | `SEPAY_API_KEY`, `SEPAY_BANK_CODE`, `SEPAY_BANK_ACCOUNT`, `SEPAY_ACCOUNT_HOLDER` | `POST https://api.hoiminh.com/webhooks/sepay`, header `Authorization: Apikey <SEPAY_API_KEY>` |
| MoMo | `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_ENDPOINT` | IPN `POST /webhooks/momo` (HMAC-SHA256) |
| VNPAY | `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_ENDPOINT` | IPN `GET /webhooks/vnpay` (HMAC-SHA512) |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_USD_RATE` | `POST /webhooks/paypal` (verify-webhook-signature) |

Super admin có thể bật/tắt từng cổng và nhập credential trong `/he-thong/thanh-toan` (lưu mã hóa bằng `ENCRYPTION_KEY`). Nội dung chuyển khoản dạng `HM XXXXX`; giao dịch sai nội dung/thiếu mã/lệch tiền hiện ở bảng đối soát để ghép thủ công.

## API, webhook gửi đi, MCP

- REST: prefix `/v1`, xác thực `Authorization: Bearer <JWT>` hoặc API key `hm_live_…`/`hm_test_…` (tạo ở Hội của tôi · Tài khoản · API). Lỗi trả `{ code, message }`.
- Webhook gửi đi: đăng ký URL + scope ở `/v1/workspaces/:id/webhooks`; sự kiện ký HMAC-SHA256 header `X-HoiMinh-Signature`, thử lại theo backoff.
- MCP: `pnpm --filter @hoiminh/mcp start` với `HOIMINH_API_URL` và `HOIMINH_API_KEY`; 10 tool (danh sách hội, thành viên, đăng bài, tạo khóa học, sự kiện, doanh thu…).
