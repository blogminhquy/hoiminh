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
| Chủ hội | minhquy@gmail.com | `/minhquy/hom-nay` (Bàn điều khiển), `/minhquy/tien`, `/minhquy/cai-dat`, `/admin` |
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
| `pnpm test:e2e` | Playwright các luồng nghiệp vụ, gồm luồng thành viên trên điện thoại 390px (tự khởi động API + web với DB riêng `.data/e2e`) |
| `pnpm check` | typecheck + lint + test |
| `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:reset` · `pnpm db:generate` | migration, seed, reset PGlite, sinh migration từ schema |
| `pnpm db:admin <email> <mật khẩu> [tên]` | tạo (hoặc nâng) một tài khoản thành quản trị hệ thống — dùng khi database mới chưa có ai |
| `pnpm build` | build tất cả (web → `apps/web/dist`) |
| `pnpm deploy` | deploy tay: migrate Supabase → build giao diện → deploy `hoiminh-api` → deploy `hoiminh-jobs` → hỏi trang live (xem dưới) |
| `pnpm deploy:check` | hỏi trang live: `/health` có `ok` không, đang chạy bản nào |
| `pnpm dev:jobs` | chạy Worker `hoiminh-jobs` bằng wrangler (cần Postgres local cho Hyperdrive); `pnpm dev` không cần tới nó |

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
3. **Hai Worker** (xem mục "Hai Worker" bên dưới): `hoiminh-api` (`apps/api`) phục vụ cả giao diện lẫn API, `hoiminh-jobs` (`apps/jobs`) chạy cron và hàng đợi. Secret chỉ đặt ở `hoiminh-api` bằng `wrangler secret put <TÊN>` trong `apps/api` (danh sách ở cuối `apps/api/wrangler.toml`); `hoiminh-jobs` tự đọc lại qua service binding. Deploy: build giao diện trước (`pnpm --filter @hoiminh/web build`), rồi `pnpm --filter @hoiminh/api run deploy`, rồi `pnpm --filter @hoiminh/jobs run deploy` (phải có `run`, nếu không pnpm hiểu nhầm là lệnh `pnpm deploy` của nó).

   **Kết nối database trên Workers phải qua Hyperdrive.** Workers không cho dùng lại socket đã mở ở request khác, nên không được cache kết nối Postgres giữa các request; làm vậy thì API hỏng ngắt quãng (`Cannot perform I/O on behalf of a different request`). `createWorkerApp` (`packages/core/src/worker-app.ts`) dựng App mới mỗi request và lấy chuỗi kết nối từ binding `HYPERDRIVE`; Hyperdrive giữ pool phía Cloudflare nên bắt tay gần như không tốn gì. Tạo config: `wrangler hyperdrive create <tên> --connection-string="<kết nối trực tiếp cổng 5432>"` rồi điền `id` vào `[[hyperdrive]]` của cả hai Worker.
4. **R2**: chỉ cần binding `FILES` trong `wrangler.toml` của cả hai Worker (đã khai báo, workflow deploy tự chạy `wrangler r2 bucket create hoiminh-files`). Tệp đi qua API (`PUT /files/upload/<key>` theo URL ký, `GET /files/<key>`) rồi vào bucket, không cần secret. Tùy chọn: gắn domain public cho bucket rồi đặt `R2_PUBLIC_BASE_URL` để ảnh public phát thẳng từ CDN; hoặc điền đủ 4 biến `R2_*` để trình duyệt tải thẳng lên R2 qua S3 (tệp rất lớn).
5. **Resend**: ở Resend → Domains → thêm `hoiminh.com` và tạo các bản ghi DNS nó yêu cầu (trên Cloudflare DNS), chờ "Verified"; tạo API key rồi nhập ở `/he-thong/ha-tang` (hoặc `wrangler secret put RESEND_API_KEY` trong `apps/api`). Địa chỉ gửi là `EMAIL_FROM` (mặc định `no-reply@hoiminh.com`, phải cùng tên miền đã xác minh). Kiểm chứng bằng nút **Gửi email thử** ở `/he-thong` (kết quả hiện ngay, mọi email đều ghi ở `/he-thong/nhat-ky` tab Email hệ thống).
6. Hoặc chạy tất cả: `node infra/deploy.mjs` (bỏ bước bằng `--skip-migrate`, `--skip-jobs`, `--skip-verify`). Bước cuối hỏi trang live xem đã chạy đúng bản vừa đẩy chưa.

Kiểm tra nhanh hạ tầng đã nối chưa: `curl https://api.hoiminh.com/health` trả `email` (Resend hay log), `media` (R2 (binding), R2 (S3) hay đĩa local) và `version`.

### Hai Worker

| Worker | Thư mục | Làm gì | Tên miền |
|---|---|---|---|
| `hoiminh-api` | `apps/api` | Giao diện (file tĩnh từ `apps/web/dist`) và API | `hoiminh.com`, `www.hoiminh.com`, `api.hoiminh.com` |
| `hoiminh-jobs` | `apps/jobs` | Hàng đợi `hoiminh-jobs` (việc nền theo sự kiện, gồm job hẹn giờ) và cron thưa (10 phút, 01:00 giờ Việt Nam) | không có |

- File giao diện do Cloudflare trả thẳng, không chạy code và không tính phí request. Chỉ các đường dẫn trong `run_worker_first` (`/v1/*`, `/webhooks/*`, `/pay/*`, `/r/*`, `/files/*`, `/health`) mới vào Worker. Thêm route API ở tiền tố mới thì phải thêm vào danh sách này.
- Web gọi API cùng tên miền nên không cần CORS. CORS chỉ mở cho `APP_URL` và bản `www`.
- `api.hoiminh.com` giữ lại cho webhook cổng thanh toán và API key của chủ hội.
- Tên `hoiminh-api` giữ nguyên để không mất các secret đã đặt, dù giờ nó phục vụ cả web.
- Nút Cập nhật ở `/he-thong/phien-ban` phát hành `hoiminh-api`, nên web và API luôn lên bản mới cùng lúc.
- Secret chỉ đặt ở `hoiminh-api`. `hoiminh-jobs` gọi entrypoint `SharedEnv` của `hoiminh-api` (binding `SHARED_ENV`, kênh nội bộ Cloudflare) để lấy secret, cache 5 phút. Secret đặt riêng cho `hoiminh-jobs` (nếu có) được ưu tiên. Vì vậy `hoiminh-api` luôn phải deploy trước.

**Chuyển từ ba Worker cũ sang hai Worker (làm một lần, 1.9.2):** workflow Deploy tự làm hết.

1. Gỡ `hoiminh-api` khỏi vai trò nhận hàng đợi `hoiminh-jobs` (job nằm chờ trong hàng đợi, không mất).
2. Deploy `hoiminh-api`: `crons = []` gỡ 3 lịch cron cũ; tên miền `hoiminh.com` và `www` tự chuyển từ `hoiminh-web` sang (wrangler chạy ngoài terminal thì tự ghi đè tên miền đang gắn Worker khác).
3. Deploy `hoiminh-jobs`: Worker được tạo mới, nhận cron và hàng đợi, lấy secret từ `hoiminh-api`.

Sau đó, không bắt buộc: xóa Worker `hoiminh-web` (không còn tên miền nào) và biến `VITE_API_URL`, `DEPLOY_API` trong GitHub, Settings, Variables.

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

`.github/workflows/deploy.yml` chạy mỗi khi có commit mới trên `main`, mất khoảng 3 đến 4 phút:

1. **Kiểm tra**: typecheck, lint, test chạy song song trên ba máy. Một việc đỏ là dừng, trang live giữ nguyên.
2. **Đưa lên Cloudflare**: kiểm tra `hoiminh-api` đã đủ secret bắt buộc (`infra/check-secrets.sh`), áp migration (xem dưới), build giao diện, deploy `hoiminh-api`, rồi deploy `hoiminh-jobs`.
3. **Hỏi trang live** (`infra/verify-live.mjs`): `/health` phải báo `ok` đúng số phiên bản và `/version.json` phải đúng commit vừa đẩy, hỏi lại mỗi 5 giây trong tối đa 2 phút. Không khớp thì lần chạy báo đỏ.

Kết quả viết bằng tiếng Việt ở trang tóm tắt của lần chạy (**Actions, Deploy**, bấm vào lần chạy): bản nào đã lên, hoặc dừng ở bước nào và trang live đang ra sao. Bấm **Actions, Deploy, Run workflow** để deploy lại bằng tay. Muốn tự hỏi trang live bất cứ lúc nào: `pnpm deploy:check`.

**Migration.** Đặt secret `DATABASE_DIRECT_URL` (kết nối trực tiếp Supabase, cổng 5432, role `hoiminh_app`) thì workflow tự chạy `pnpm db:migrate` trước khi deploy:

```bash
gh secret set DATABASE_DIRECT_URL --repo blogminhquy/hoiminh
```

Chưa đặt thì workflow không đụng tới database; bản nào kèm migration mới sẽ có cảnh báo vàng nhắc áp tay bằng `DATABASE_DIRECT_URL=... pnpm db:migrate`. Migration phải tương thích với bản đang chạy, vì nó được áp trước khi code mới lên.

Cần đúng một secret do người dùng tự tạo (Claude/CLI không tạo được API token thay bạn):

1. Cloudflare, **My Profile, API Tokens, Create Token, Edit Cloudflare Workers**, chọn account `Blogminhquy@gmail.com's Account`.
2. Lưu vào GitHub:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo blogminhquy/hoiminh
```

Đã đặt sẵn trong repo: secret `CLOUDFLARE_ACCOUNT_ID`, biến `VITE_APP_URL`.

## Hạ tầng và khóa

Super admin đổi key dịch vụ ở **Quản trị hệ thống, Hạ tầng và khóa** (`/he-thong/ha-tang`), không cần `wrangler secret put`:

- **Email (Resend)**: API key và địa chỉ gửi, nút Gửi email thử.
- **Phát hành web (Cloudflare)**: token (quyền Workers Scripts: Edit), Account ID, tên Worker web.
- **R2** và **bí mật hệ thống** (database, `AUTH_JWT_SECRET`, `ENCRYPTION_KEY`): chỉ xem. Ba bí mật này vẫn đặt bằng secret của Worker, vì sai một khóa là trang quản trị không mở được để sửa.

Khóa nhập trên web được mã hóa bằng `ENCRYPTION_KEY`, lưu trong bảng `provider_accounts`, và được ưu tiên hơn secret cùng tên trên Worker. Bỏ giá trị đã lưu thì quay về secret. Đổi `ENCRYPTION_KEY` thì phải nhập lại các khóa này (và credential cổng thanh toán).

## Phiên bản và phát hành

Không còn nhãn phiên bản trên mọi màn hình. Mọi thứ nằm ở **Quản trị hệ thống, Phiên bản** (`/he-thong/phien-ban`), chỉ super admin thấy:

- **Bản đang chạy**: phiên bản, nhánh, giờ build, commit của trình duyệt đang mở, so với `/version.json` trên Cloudflare.
- **Phát hành**: danh sách 15 bản gần nhất đã tải lên Cloudflare. Bấm **Cập nhật** để đưa một bản lên chạy 100% cho mọi người, bấm **Quay lui** ở bản cũ hơn khi có lỗi. Mỗi lần bấm được ghi vào nhật ký thao tác (`release.deploy`).
- **Lịch sử phiên bản**: đọc từ `CHANGELOG.md` lúc build, nên viết CHANGELOG là đủ.

Người dùng thường không thấy gì: khi máy chủ có bản mới, trình duyệt tự nạp lại ở lần chuyển trang kế tiếp (không mất nội dung đang gõ dở), và nếu chunk cũ đã bị xóa sau deploy thì cũng tự nạp lại một lần.

Bật phát hành thủ công (admin bấm mới lên bản mới):

1. Tạo token Cloudflare chỉ có quyền **Workers Scripts: Edit**.
2. `cd apps/api && wrangler secret put CF_RELEASE_API_TOKEN` và `wrangler secret put CF_RELEASE_ACCOUNT_ID` (Worker được phát hành mặc định là `hoiminh-api`, đổi bằng `CF_RELEASE_WEB_SCRIPT`).
3. GitHub, Settings, Variables: đặt `RELEASE_MODE=manual`. Từ đó `deploy.yml` chạy `wrangler versions upload --tag v<phiên bản>-<commit>` thay cho `wrangler deploy`. Riêng bản nào thêm hoặc đổi Durable Object (`[[migrations]]` trong `apps/api/wrangler.toml`) thì phải deploy bằng `wrangler deploy`: tạm bỏ `RELEASE_MODE` cho lần đó.

Chưa đặt `RELEASE_MODE` thì vẫn như cũ: đẩy lên `main` là web tự lên bản mới. API Worker luôn deploy thẳng, nên thay đổi API phải tương thích ngược với bản web đang chạy.

Số phiên bản có một nguồn: `APP_VERSION` trong `packages/config/src/version.ts`; test bắt nó khớp `package.json` gốc và mục đầu CHANGELOG. Thông tin build do `apps/web/scripts/version-plugin.ts` sinh lúc đóng gói (`__HM_BUILD__` + `dist/version.json`); `apps/web/public/_headers` giữ `version.json` và `index.html` không bị cache.

## Cấu hình cổng thanh toán

| Cổng | Biến | Webhook/IPN cần khai báo với cổng |
|---|---|---|
| SePay (chuyển khoản QR) | `SEPAY_API_KEY`, `SEPAY_BANK_CODE`, `SEPAY_BANK_ACCOUNT`, `SEPAY_ACCOUNT_HOLDER` | `POST https://api.hoiminh.com/webhooks/sepay`, header `Authorization: Apikey <SEPAY_API_KEY>` |
| MoMo | `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_ENDPOINT` | IPN `POST /webhooks/momo` (HMAC-SHA256) |
| VNPAY | `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_ENDPOINT` | IPN `GET /webhooks/vnpay` (HMAC-SHA512) |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_USD_RATE` | `POST /webhooks/paypal` (verify-webhook-signature) |

Super admin có thể bật/tắt từng cổng và nhập credential trong `/he-thong/thanh-toan` (lưu mã hóa bằng `ENCRYPTION_KEY`). Nội dung chuyển khoản dạng `HM XXXXX`; giao dịch sai nội dung/thiếu mã/lệch tiền hiện ở bảng đối soát để ghép thủ công.

## Khu học tập của người mua lẻ

- Một người có thể chỉ mua khóa học hoặc tài liệu mà không tham gia hội nào. Chỗ học của họ là `/hoc`, chạy ngoài khung hội.
- `GET /v1/me/library` trả khóa học và tài liệu đã sở hữu, kèm tiến độ và `resumeLessonId`. Danh sách dựng từ entitlement, nên khóa mở nhờ tư cách thành viên (Premium/VIP) nằm ở `/:slug/khoa-hoc`, không ở đây.
- Mua lẻ không tự thêm người mua vào hội. Hội miễn phí đang mở cửa thì Khu học tập hiện lời mời để họ tự quyết.

## API, webhook gửi đi, MCP

- REST: prefix `/v1`, xác thực `Authorization: Bearer <JWT>` (web dùng cookie httpOnly `hm_at` thay cho header, gửi `X-HM-Auth: cookie` khi đăng nhập) hoặc API key `hm_live_…`/`hm_test_…` (tạo ở **Hội của tôi · Nhà phát triển**, `/admin/nha-phat-trien`). Lỗi trả `{ code, message }`.
- Webhook gửi đi: đăng ký URL + sự kiện ở **Hội của tôi · Nhà phát triển**; Hội Mình ký HMAC-SHA256 ở header `X-HoiMinh-Signature`, thử lại theo backoff, lịch sử 10 lần gửi gần nhất hiện ngay trong màn đó.
- MCP: `pnpm --filter @hoiminh/mcp start` với `HOIMINH_API_URL` và `HOIMINH_API_KEY`; 10 tool (danh sách hội, thành viên, đăng bài, tạo khóa học, sự kiện, doanh thu…).
