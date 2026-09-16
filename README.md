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
| `pnpm db:admin <email> <mật khẩu> [tên]` | tạo (hoặc nâng) một tài khoản thành quản trị hệ thống — dùng khi database mới chưa có ai |
| `pnpm build` | build tất cả (web → `apps/web/dist`) |
| `pnpm deploy` | migrate Supabase → deploy Worker API → deploy Worker web (xem dưới) |

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
infra           deploy.mjs
.github         CI (kiểm tra) và Deploy (tự động lên Cloudflare khi đẩy lên main)
```

## Deploy Cloudflare + Supabase

1. **Supabase**: tạo project. Chuỗi kết nối pooler (cổng 6543) làm `DATABASE_URL`, kết nối trực tiếp (cổng 5432) làm `DATABASE_DIRECT_URL`. Nên tạo một role riêng cho ứng dụng thay vì dùng `postgres`:

   ```sql
   create role hoiminh_app with login password '<mật khẩu mạnh>';
   grant create, connect on database postgres to hoiminh_app;
   grant all on schema public to hoiminh_app;
   ```

   Chạy migration **bằng role đó** để nó sở hữu các bảng — chủ sở hữu không bị RLS chặn, giống môi trường local. Với pooler, username có dạng `hoiminh_app.<project-ref>`.

   Muốn đăng nhập Google thì bật Supabase Auth, điền `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` và đặt `AUTH_PROVIDER=supabase`; khi đó tài khoản tạo bằng `db:admin` hay `db:seed` không đăng nhập được nữa.
2. **Migration**: `DATABASE_DIRECT_URL=... pnpm db:migrate` (RLS bật tự động; API production nên dùng role `hoiminh_app` như trong `packages/db/migrations/0001_rls.sql`).
3. **Worker API**: `apps/api/wrangler.toml` đã khai báo queue `hoiminh-jobs`, Hyperdrive và cron (mỗi phút, 10 phút, hằng ngày). Đặt secret bằng `wrangler secret put` cho mọi biến trong `.env.example` (DATABASE_URL, AUTH_JWT_SECRET, ENCRYPTION_KEY, RESEND_API_KEY, R2_*, SEPAY_*, MOMO_*, VNPAY_*, PAYPAL_*). Deploy: `pnpm --filter @hoiminh/api run deploy` (phải có `run`, nếu không pnpm hiểu nhầm là lệnh `pnpm deploy` của nó).

   **Kết nối database trên Workers phải qua Hyperdrive.** Workers không cho dùng lại socket đã mở ở request khác, nên không được cache kết nối Postgres giữa các request — làm vậy thì API hỏng ngắt quãng (`Cannot perform I/O on behalf of a different request`). `worker.ts` dựng App mới mỗi request và lấy chuỗi kết nối từ binding `HYPERDRIVE`; Hyperdrive giữ pool phía Cloudflare nên bắt tay gần như không tốn gì. Tạo config: `wrangler hyperdrive create <tên> --connection-string="<kết nối trực tiếp cổng 5432>"` rồi điền `id` vào `[[hyperdrive]]`.
4. **Worker web**: `pnpm --filter @hoiminh/web build` rồi `pnpm --filter @hoiminh/web run deploy`. `apps/web/wrangler.toml` phục vụ `dist` bằng Worker static assets (`not_found_handling = "single-page-application"` lo route SPA, `public/_headers` lo cache) và tự tạo bản ghi DNS cho `hoiminh.com`, `www.hoiminh.com`. Biến build: `VITE_API_URL`, `VITE_APP_URL`.
5. **R2**: tạo bucket `hoiminh-files`, bật public access hoặc gắn domain, điền `R2_*`.
6. Hoặc chạy tất cả: `node infra/deploy.mjs` (bỏ bước bằng `--skip-migrate`, `--skip-api`, `--skip-web`).

Đã dựng sẵn trên tài khoản Cloudflare: Worker **hoiminh-web** phục vụ web ở `hoiminh.com` + `www.hoiminh.com`, Worker **hoiminh-api** ở `api.hoiminh.com`, hàng đợi `hoiminh-jobs` và `hoiminh-jobs-dlq`. Không dùng Cloudflare Pages: Worker tự tạo được bản ghi DNS cho tên miền riêng còn Pages thì phải thêm DNS bằng tay.

### Tài khoản quản trị đầu tiên

Database mới chưa có ai, mà nâng quyền quản trị thì phải có sẵn một quản trị. Sau khi `pnpm db:migrate`:

```bash
DATABASE_URL="<chuỗi kết nối Supabase>" pnpm db:admin "email@cua-ban.com" "mat-khau-manh" "Tên hiển thị"
```

Lệnh này tạo tài khoản mới (hoặc nâng tài khoản đã có), đặt mật khẩu, đánh dấu đã xác minh email và bật `is_super_admin`. Đăng nhập ở `/dang-nhap` rồi vào `/he-thong`; từ đó nâng quyền cho người khác bằng giao diện. Mật khẩu là PBKDF2 nên chỉ dùng được khi `AUTH_PROVIDER=local`.

### Row Level Security

Mỗi request và mỗi job chạy trong một transaction có đặt sẵn `app.user_id`, `app.workspace_ids`, `app.community_ids`, `app.bypass` (`packages/core/src/lib/tenant-scope.ts`), đúng bốn biến mà policy `tenant_isolation` trong `0001_rls.sql` đọc. Cron, hàng đợi và webhook cổng thanh toán chạy với `app.bypass = on`.

Policy vẫn **chưa chặn** cho tới khi bật thi hành, vì vai trò kết nối là chủ sở hữu bảng và Postgres cho chủ sở hữu đi qua RLS:

```bash
pnpm db:rls status   # xem bảng nào đã bật, bảng nào đang thi hành
pnpm db:rls on       # FORCE ROW LEVEL SECURITY trên mọi bảng
pnpm db:rls off      # tắt thi hành, policy vẫn còn
```

Bật trong lúc có người theo dõi log: nếu một đường chạy nào đó thiếu biến phiên thì truy vấn **không báo lỗi mà trả về rỗng**. `packages/db/src/test/rls.test.ts` dựng một vai trò không sở hữu bảng, bật FORCE rồi kiểm tra policy thật sự chặn đọc và ghi chéo tenant.

## Tự động deploy khi đẩy lên GitHub

`.github/workflows/deploy.yml` chạy mỗi khi có commit mới trên `main`: kiểm tra (typecheck · lint · test) → build web → `wrangler deploy`. Bấm **Actions → Deploy → Run workflow** để deploy lại bằng tay.

Cần đúng một secret do người dùng tự tạo (Claude/CLI không tạo được API token thay bạn):

1. Cloudflare → **My Profile → API Tokens → Create Token → Edit Cloudflare Workers**, chọn account `Blogminhquy@gmail.com's Account`.
2. Lưu vào GitHub:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo blogminhquy/hoiminh
```

Đã đặt sẵn trong repo: secret `CLOUDFLARE_ACCOUNT_ID`, biến `VITE_API_URL`, `VITE_APP_URL`. Đặt thêm biến `DEPLOY_API=true` (`gh variable set DEPLOY_API --body true`) khi Worker API đã có đủ secret trên Cloudflare, lúc đó workflow deploy luôn cả API.

Cách khác, không cần token: Cloudflare Dashboard → Workers & Pages → `hoiminh-web` → Settings → Build → **Connect to Git**. Khi đó Cloudflare tự build mỗi lần push (nhưng không chạy test trước).

## Nhãn phiên bản và nút cập nhật

Góc dưới bên trái mọi màn hình có nhãn `v1.1.0 · <commit>`. Bấm vào để mở bảng:

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

- REST: prefix `/v1`, xác thực `Authorization: Bearer <JWT>` hoặc API key `hm_live_…`/`hm_test_…` (tạo ở **Hội của tôi · Nhà phát triển**, `/admin/nha-phat-trien`). Lỗi trả `{ code, message }`.
- Webhook gửi đi: đăng ký URL + sự kiện ở **Hội của tôi · Nhà phát triển**; Hội Mình ký HMAC-SHA256 ở header `X-HoiMinh-Signature`, thử lại theo backoff, lịch sử 10 lần gửi gần nhất hiện ngay trong màn đó.
- MCP: `pnpm --filter @hoiminh/mcp start` với `HOIMINH_API_URL` và `HOIMINH_API_KEY`; 10 tool (danh sách hội, thành viên, đăng bài, tạo khóa học, sự kiện, doanh thu…).
