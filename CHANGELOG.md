# CHANGELOG

## 1.9.0 - 2026-09-28

Chặn spam và dò mật khẩu bằng bộ đếm chung của Cloudflare, bước 4 trong lộ trình chịu tải.

### Bảo mật

- **Giới hạn số lần gọi dùng Rate Limiting binding của Cloudflare** thay cho bộ đếm trong bộ nhớ. Bộ đếm cũ gần như không chặn được gì trên Workers vì mỗi bản Worker đếm riêng. Bốn nhóm, khai báo trong `apps/api/wrangler.toml`:
  - `api` 600 lần/phút cho toàn bộ `/v1`, chạy trước khi mở kết nối database nên request bị chặn không tốn gì.
  - `auth` 10 lần/phút cho đăng nhập, đăng ký, 2FA, quên mật khẩu, gửi lại mã.
  - `write` 20 lần/phút cho đăng bài, bình luận, thanh toán, đổi mật khẩu, thao tác 2FA.
  - `webhook` 1200 lần/phút cho webhook cổng thanh toán.
- **Khóa đếm không gộp nhầm người dùng**: mạng di động dùng chung IP cho rất nhiều máy, nên người đã đăng nhập được đếm theo tài khoản hoặc phiên; đăng nhập đếm theo IP cộng email, nên kẻ dò mật khẩu một tài khoản bị chặn mà người khác cùng IP vẫn vào được.
- Không còn tin header `x-forwarded-for` (ai cũng tự gửi được); chỉ dùng `cf-connecting-ip` do Cloudflare đặt. Bị chặn thì trả 429 kèm `Retry-After`.
- Test bắt hạn mức trong code luôn khớp với `wrangler.toml`.

## 1.8.0 - 2026-09-28

Giảm tải database, bước 3 trong lộ trình chịu tải: khi đông người, chỗ nghẽn đầu tiên là số kết nối database, không phải Worker.

### Hiệu năng

- **Email gửi sau khi transaction đóng.** Trước đây mỗi email (xác minh, mời thành viên, thanh toán, tin nhắn...) gọi Resend ngay giữa transaction của request, giữ một kết nối database suốt lúc chờ mạng. Nay email trong request hoặc job chỉ được ghi nhận (`DeferredSender`), commit xong mới gửi. Thao tác lỗi và bị hủy thì email không đi, trước đây vẫn đi. Email thử của quản trị vẫn gửi ngay để thấy kết quả.
- **Phạm vi quyền một truy vấn.** Mỗi request của người đăng nhập trước đây chạy bốn truy vấn để biết workspace và hội của họ; nay gộp thành một câu SQL, kết quả giống hệt (có test so với cách cũ).
- **Cache ở Cloudflare cho trang công khai**: khám phá hội, trang giới thiệu hội, bảng giá, hồ sơ công khai. Khách chưa đăng nhập nhận bản cache tối đa 60 giây, lượt trúng cache không mở transaction và không chạm database. Người đã đăng nhập và link có mã giới thiệu (`?ref=`) luôn đi thẳng. Header `x-hm-cache` cho biết HIT hay MISS.
- Đã rà index của các bảng đọc nhiều (bảng tin, bình luận, thông báo, tin nhắn, thành viên, đơn hàng, workspace): đều đã có, không cần migration.

## 1.7.0 - 2026-09-28

Gộp web và API vào một Worker, tách việc chạy nền sang Worker riêng, để chịu được lượng thành viên lớn và dễ quản lý hơn.

### Triển khai

- **`hoiminh-api` phục vụ cả giao diện lẫn API** ở `hoiminh.com`, `www.hoiminh.com`, `api.hoiminh.com`. File giao diện do Cloudflare trả thẳng (không chạy code, không tính phí request); chỉ `/v1`, `/webhooks`, `/pay`, `/r`, `/files`, `/health` mới chạy Worker. Bỏ Worker `hoiminh-web`.
- **`hoiminh-jobs` (`apps/jobs`) mới**: cron và hàng đợi job chạy riêng, việc nặng không làm chậm người đang dùng.
- Nút Cập nhật ở `/he-thong/phien-ban` giờ đưa web và API lên bản mới cùng lúc, không còn lệch bản.
- Workflow deploy kiểm tra hai Worker đã đủ secret bắt buộc trước khi deploy; thiếu thì dừng, web đang chạy giữ nguyên.
- Binding R2 `FILES` và `EMAIL_FROM` có ở cả hai Worker; workflow vẫn tự tạo bucket.
- Nâng wrangler của API lên v4.

### Bảo mật

- Web gọi API cùng tên miền. CORS chỉ mở cho chính web thay vì phản chiếu mọi origin kèm cookie.

## 1.6.0 - 2026-09-28

Trang **Hạ tầng và khóa** (`/he-thong/ha-tang`): đổi key dịch vụ ngay trên web, không phải vào Cloudflare đặt secret nữa.

### Quản trị hệ thống

- **Email (Resend)**: dán API key và địa chỉ gửi, lưu xong có hiệu lực ngay; nút Gửi email thử nằm cạnh để kiểm tra liền. Kèm hướng dẫn từng bước lấy key và xác minh tên miền.
- **Phát hành web (Cloudflare)**: token, Account ID, tên Worker web cho nút Cập nhật và Quay lui ở trang Phiên bản; nút Kiểm tra kết nối.
- **Lưu trữ tệp (R2)** và **Bí mật hệ thống** (database, AUTH_JWT_SECRET, ENCRYPTION_KEY): chỉ xem trạng thái. Ba bí mật này cố ý không sửa được trên web, vì sai một khóa là chính trang này không mở được.
- Mỗi ô cho biết giá trị đang dùng lấy từ đâu (nhập ở trang này, secret trên Cloudflare, mặc định, chưa có). Bí mật chỉ hiện 4 ký tự cuối; ô bí mật để trống là giữ nguyên; "Bỏ giá trị đã lưu" để quay về secret của Worker. Kiểm tra định dạng trước khi lưu (key Resend bắt đầu bằng `re_`, Account ID 32 ký tự).
- Mục mới "Hạ tầng và khóa" trong thanh bên và hàng chip trên điện thoại; khối Hạ tầng ở Tổng quan có liên kết sang. Chữ trên trang tối thiểu 16px.

### Kỹ thuật

- Khóa lưu mã hóa (`ENCRYPTION_KEY`) trong `provider_accounts` với provider `infra_email`, `infra_release`, như credential cổng thanh toán, nên không cần migration. `createApp` gộp khóa đã lưu vào `env` (ưu tiên hơn secret); Worker giữ bản giải mã trong isolate 30 giây.
- `SwitchableSender`: lưu key mới là bộ gửi email đổi ngay, không cần khởi động lại. Mọi thay đổi ghi nhật ký thao tác `infra.update` (chỉ tên ô, không ghi giá trị).
- API `GET /v1/admin/infra`, `PUT /v1/admin/infra/:section`, `POST /v1/admin/infra/release/test` (chỉ super admin). 8 test mới.

## 1.5.0 - 2026-09-28

Gộp đợt rà soát 20/09 (PR #3) vào main. Hai việc chính: nối R2 bằng binding của Worker (không cần secret), gắn Resend có kiểm chứng. Kèm theo là một loạt công tắc và nút "trông như xong" mà không có tác dụng. Mục "Tài khoản, Phiên bản" của đợt này không được giữ: phiên bản đã chuyển vào Quản trị hệ thống ở 1.3.0.

### Hạ tầng

- **R2 qua binding `FILES` của Worker.** Trên production, avatar tải ngày 16/09 được ghi `ready` nhưng URL không phát được: provider local ghi bằng `node:fs`, Worker không có hệ tệp. Nay chỉ cần `[[r2_buckets]]` trong `wrangler.toml` (workflow deploy tự tạo bucket) là tải ảnh, tài liệu, tệp số chạy; tệp đi qua API theo URL ký HMAC. Bốn biến `R2_*` thành tùy chọn (tải thẳng qua S3 cho tệp lớn); `R2_PUBLIC_BASE_URL` để phát ảnh public từ CDN.
- **Resend có kiểm chứng.** `RecordingSender` ghi email_logs cho mọi lần gửi (sent / failed / logged, id Resend, lỗi); nút "Gửi email thử" ở Hệ thống · Tổng quan; tab "Email hệ thống" ở Nhật ký; `/health` báo provider email và tệp đang dùng. `EMAIL_FROM` mặc định đổi sang hoiminh.com cho khớp tên miền.
- **Phiên bản một nguồn:** `APP_VERSION` trong @hoiminh/config, test bắt khớp package.json và mục đầu CHANGELOG. Trước đây root ghi 1.1.0, CHANGELOG 1.2.0, `/health` trả '1.0.0' cứng.
- **Migration production thiếu:** bảng `user_totp` (xác thực hai lớp, ghi "xong 16/09") chưa từng được tạo trên Supabase, nên bật hai lớp trên hoiminh.com sẽ lỗi. Đã áp 0002 và 0003 (cột `posts.moderation_status`) bằng vai trò `hoiminh_app`, ghi vào bảng migration của drizzle.

### Công tắc và nút có tác dụng thật

- Khóa học: "Bắt buộc học theo thứ tự", "Phải hoàn thành" (bài), "Nhỏ giọt" theo công tắc khóa, "Cộng sự nhận hoa hồng khi bán lẻ" đều được service đọc. Trước đây chỉ lưu.
- **Chứng nhận hoàn thành** (`/chung-nhan/:courseId/:userId`): trang công khai, in được, đọc từ course_progress; banner "Hoàn thành 100% để nhận chứng nhận" giờ là lời hứa thật. Thông báo hoàn thành khóa dẫn tới chứng nhận.
- **Duyệt bài thành viên mới** (Cài đặt · Bảng tin · N ngày đầu): bài của người mới vào trạng thái chờ duyệt, chỉ tác giả và người kiểm duyệt thấy; người kiểm duyệt nhận thông báo, bấm Duyệt / Từ chối ngay trên thẻ bài; tác giả được báo kết quả.
- Sự kiện: bỏ công tắc "Tự đăng bản ghi" (không có nguồn để tự lấy), thêm nút "Thêm bản ghi" cho người tổ chức.
- Xóa bài, xóa module trong Soạn khóa học; xóa bình luận. Thông báo có "Tải thêm". Mời thành viên xong danh sách làm mới ngay.
- `/he-thong/tinh-nang` và `/he-thong/ho-tro` có nội dung riêng thay vì trùng hai màn khác; ba cờ V2 ghi rõ "chưa có tác dụng". Đường dẫn hội hiện đúng tên miền đang chạy thay vì "hoiminh.vn".

## 1.4.0 - 2026-09-28

Vá các lỗi tiền và bảo mật trong đợt review 27/09, trước khi mở bán thật.

### Bảo mật

- **Production thiếu bí mật thì không khởi động**: `AUTH_JWT_SECRET` còn giá trị mặc định (hoặc ngắn hơn 32 ký tự) hay thiếu `ENCRYPTION_KEY` làm API dừng ngay với thông báo rõ, thay vì chạy tiếp bằng giá trị ai cũng biết.
- **Cổng thanh toán còn bí mật mặc định bị khóa** ở mọi môi trường ngoài dev/test: không tạo thanh toán, mọi webhook bị coi là sai chữ ký. Trang Tổng quan hệ thống hiện cảnh báo cổng nào đang khóa.
- **Trang mô phỏng thanh toán** chỉ mở ở dev/test (trước đây mở cả staging), thoát HTML mọi tham số, và chỉ chuyển hướng về chính web.
- **Hoàn đơn gói nền tảng** chỉ super admin làm được; API key của chủ hội không còn lọt qua.

### Thanh toán

- **PayPal chạy đúng**: đơn lưu số USD thực thu và webhook được so với số đó (trước đây so cent USD với đồng VND nên không bao giờ xác nhận). Tiền tệ khác USD bị bỏ qua. `CHECKOUT.ORDER.APPROVED` giờ gọi capture thay vì cấp quyền khi chưa thu được tiền; chỉ `PAYMENT.CAPTURE.COMPLETED` mới mở quyền. Hoàn tiền luôn gửi số tiền, để hoàn một phần không thành hoàn toàn bộ.
- **Credential nhập ở /he-thong/thanh-toan được dùng thật**, ưu tiên hơn biến môi trường. Để trống một ô là giữ nguyên, không xóa các ô đã lưu.
- **Xác nhận thanh toán không bị trùng**: cập nhật có điều kiện nên hai webhook đồng thời chỉ một cái cấp quyền, cộng LTV và tính hoa hồng. Số hóa đơn cấp dưới khóa giao dịch nên không trùng.
- **Hoàn tiền giữ chỗ số tiền trước khi gọi cổng**: không vượt số đã thu kể cả khi bấm hai lần cùng lúc, hoàn một phần được nhiều lần, webhook báo hoàn cho chính lần hoàn từ trang quản trị không bị ghi lần hai.
- Webhook của cổng khác không còn khớp được đơn của cổng khác (chỉ chuyển khoản SePay được khớp chéo, và chỉ với đơn VND). Thông báo thất bại đến muộn không lật được thanh toán đã thành công.

## 1.3.1 - 2026-09-28

### Sửa lỗi

- Trang **Hội của tôi** (`/admin`) báo "Có lỗi xảy ra, thử lại sau" trên production với mọi chủ hội đã có workspace. Nguyên nhân: câu tính doanh thu 30 ngày đặt thẳng một `Date` trong `sql\`...\``, mà drizzle tắt bộ chuyển ngày giờ của postgres-js nên driver nổ `TypeError` trước khi câu lệnh tới Postgres. PGlite ở local và trong test không bị nên không bắt được. Sửa ở tầng kết nối (`packages/db/src/client.ts`): mọi `Date` trong tham số đều đổi thành chuỗi ISO, nên các câu `sql` khác cũng không dính lỗi này.
- Test mới `postgres-dates.test.ts` chạy trên Postgres thật khi có `TEST_POSTGRES_URL`.

## 1.3.0 - 2026-09-27

Chuyển phần phiên bản từ nhãn nổi trên mọi màn hình vào Quản trị hệ thống, và cho super admin tự bấm để đưa bản mới lên cho mọi người.

### Triển khai

- Trang **Phiên bản** (`/he-thong/phien-ban`): xem bản đang chạy, danh sách bản đã tải lên Cloudflare, nút Cập nhật và Quay lui, lịch sử phiên bản thu gọn theo từng bản.
- API `GET /v1/admin/releases` và `POST /v1/admin/releases/:versionId/deploy` gọi Cloudflare Workers Versions, có ghi nhật ký thao tác.
- `deploy.yml` thêm chế độ `RELEASE_MODE=manual`: chỉ tải bản lên (`wrangler versions upload`), chờ admin phát hành.
- Người dùng thường tự nhận bản mới ở lần chuyển trang kế tiếp; lỗi tải chunk cũ sau deploy cũng tự nạp lại.

### Giao diện

- Bỏ nhãn phiên bản góc dưới màn hình và nhật ký "Máy này".
- Quản trị hệ thống dùng được trên điện thoại: hàng chip điều hướng thay cho thanh bên bị ẩn, header không còn tràn. Chủ hội là super admin thấy thêm mục "Hệ thống" ở thanh trên.
- Sửa số phiên bản trong `package.json` bị kẹt ở 1.1.0.

## 1.2.0 — 2026-09-16

Đóng bốn khoản nợ trong đợt rà soát 15/09: cờ tính năng không nối vào đâu, không có nút hoàn tiền cho chủ hội, xác thực hai lớp và giao diện tối mới chỉ là chữ "sắp có", và RLS có policy nhưng không có biến phiên.

### Bảo mật

- **Xác thực hai lớp (TOTP)**: RFC 6238 viết bằng Web Crypto (chạy cả Node lẫn Workers), bảng `user_totp` với bí mật mã hóa và mã dự phòng băm, `last_step` chặn dùng lại mã. Đăng nhập tách hai bước bằng vé JWT sống 5 phút; nhận cả mã 6 số lẫn mã dự phòng dùng một lần. Bật cần một mã đúng, tắt cần mật khẩu, cả hai đều gửi email và ghi nhật ký.
- **Row Level Security giờ có đường bật thật**: mỗi request và mỗi job chạy trong transaction có `app.user_id` / `app.workspace_ids` / `app.community_ids` / `app.bypass`. Thi hành bật bằng `pnpm db:rls on` (FORCE ROW LEVEL SECURITY), tách khỏi migration vì bật sai thì truy vấn trả rỗng chứ không báo lỗi. Test mới dựng vai trò không sở hữu bảng để chứng minh policy chặn thật.
- Hai thay đổi kiến trúc bắt buộc đi kèm: handler sự kiện nhận ngữ cảnh của bên phát thay vì kết nối gốc, và `AuthProvider` nhận executor của request. Không có chúng thì handler và kiểm tra mật khẩu nằm ngoài transaction — trên Postgres là không thấy biến phiên, trên PGlite là khóa chết.

### Nghiệp vụ

- **Cờ tính năng chặn thật, không chỉ hiển thị**: `store` ẩn tab Cửa hàng và chặn mua sản phẩm, `affiliate_leaderboard` ẩn tab Xếp hạng, `paypal` chặn chọn PayPal khi thanh toán, `mcp` khiến MCP server không khởi động. Sửa hai nhãn cờ trước đây dùng sai khóa nên hiện tên kỹ thuật.
- **Chủ hội hoàn tiền được một đơn** ngay trong Doanh thu, có cảnh báo trước về thu hồi quyền truy cập, đảo hoa hồng cộng sự và việc phải tự chuyển khoản lại.

### Giao diện

- **Giao diện tối** cho toàn bộ 50 màn: token trỏ tới biến CSS nên đổi theo giao diện, `HEX` giữ mã màu thật cho những chỗ màu bị lưu xuống database và cho thuộc tính SVG. Chọn Sáng / Tối / Theo máy trong Tài khoản.

## 1.1.0 — 2026-09-15

Đưa web và API lên Cloudflare ở tên miền hoiminh.com, tự động deploy khi đẩy code lên GitHub, thêm nhãn phiên bản kèm nút cập nhật, và bổ sung màn đổi mật khẩu.

### Triển khai
- Web chạy bằng Worker static assets (`apps/web/wrangler.toml`) ở `hoiminh.com` + `www.hoiminh.com`; Worker API ở `api.hoiminh.com`. Không dùng Cloudflare Pages vì Worker tự tạo được bản ghi DNS cho tên miền riêng. Route SPA do `not_found_handling = "single-page-application"` lo, thay cho `public/_redirects` đã bỏ.
- Sửa `packages/db/src/migrate.ts`: `fileURLToPath(import.meta.url)` ở cấp module làm Worker nổ ngay lúc khởi động (mã lỗi 10021) — trước đó API chưa từng deploy lên Workers được.
- Sửa `apps/api/src/worker.ts`: không cache App giữa các request nữa. Kết nối Postgres là một socket mà Workers cấm dùng lại socket của request khác ("Cannot perform I/O on behalf of a different request"), nên API hỏng ngắt quãng — cứ vài request lại 500. Mỗi request dựng App mới, kết nối qua **Hyperdrive** (`[[hyperdrive]]` trong `wrangler.toml`) để Cloudflare giữ pool.
- Database production: Supabase + role `hoiminh_app` (sở hữu bảng nên RLS không chặn, giống môi trường local).
- Sửa e2e luồng 4: `getByText('Chủ tài khoản')` khớp cả dòng từ chối "Sai tên chủ tài khoản…" trong bảng lịch sử.
- `pnpm db:admin <email> <mật khẩu> [tên]`: tạo hoặc nâng một tài khoản thành quản trị hệ thống, dùng cho database mới chưa có ai.
- `AUTH_PROVIDER` của Worker đổi sang `local` (mật khẩu PBKDF2 trong DB) vì chưa bật Supabase Auth.
- `.github/workflows/deploy.yml`: push lên `main` → typecheck · lint · test → build web → `wrangler deploy`; chạy tay được ở tab Actions. Deploy Worker API bật bằng biến `DEPLOY_API=true`.
- `apps/web/public/_headers`: `version.json` và `index.html` không cache, tài nguyên có vân tay cache một năm.

### Màn hình còn thiếu, bổ sung sau đợt rà soát
- **Cửa hàng · Sản phẩm mới** (`/:slug/cua-hang/moi`, sửa ở `/:slug/cua-hang/:slug/sua`): tạo **sản phẩm số** (tải tệp, người mua nhận link ký hạn 15 phút) và **combo** (gộp nhiều sản phẩm lẻ). Trước đây `store.createProduct` chỉ gọi được qua API — giao diện chỉ tạo được khóa học, nên hai loại sản phẩm còn lại trong kiến trúc không dùng được.
- **Tải tệp sản phẩm số**: người đã mua giờ thấy danh sách tệp ở trang sản phẩm. Trước đây nút "Tải về" ở Cửa hàng trỏ về chính trang sản phẩm, mà trang đó không có chỗ tải — trả tiền xong không nhận được hàng.
- **Hội của tôi · Nhà phát triển** (`/admin/nha-phat-trien`, kiến trúc mục 13): tạo và thu hồi API key theo phạm vi, đăng ký webhook gửi đi kèm lịch sử gửi, hướng dẫn nối MCP. Ba endpoint `/v1/workspaces/:id/api-keys` và `/v1/workspaces/:id/webhooks` đã có sẵn nhưng không màn nào gọi — nghĩa là MCP (10 tool) không ai dùng được vì không tạo nổi key.
- **Cài đặt · Chung · Câu hỏi khi xin vào hội**: trang giới thiệu hội đã hiển thị và bắt trả lời, nhưng chủ hội không có chỗ nào đặt câu hỏi.
- Ô tìm kiếm trên header quản trị hệ thống trước đây là ô chết (không state, không handler); nay Enter đưa tới danh sách Hội hoặc Người dùng kèm từ khóa.
- `pnpm dev` hỏng: turbo chạy cả `@hoiminh/mcp`, gói này thoát ngay vì thiếu `HOIMINH_API_KEY` và kéo sập cả lệnh. Đã lọc gói mcp ra khỏi `dev`.

### Tài khoản
- **Đổi mật khẩu ngay trong Hồ sơ** (`/tai-khoan/ho-so`, neo `#mat-khau`): nhập mật khẩu hiện tại, mật khẩu mới, nhập lại; mặc định đăng xuất khỏi các thiết bị khác còn phiên đang dùng thì giữ. Trước đây người đã đăng nhập không có cách nào đổi mật khẩu — chỉ có luồng quên mật khẩu qua email, mà email thì cần Resend.
- API mới `POST /v1/me/password` (`auth.changePassword`): bắt buộc đúng mật khẩu hiện tại, chặn đặt lại trùng mật khẩu cũ, thu hồi phiên khác, gửi email báo đã đổi.
- Sửa `AppShell`: người chưa tham gia hội nào bị đá về Khám phá khi mở Tài khoản, Tin nhắn, Thông báo, hồ sơ người khác. Nay các trang đó dùng khung công khai, không cần hội.

### Phiên bản trên giao diện
- Nhãn `v<phiên bản> · <commit>` cố định ở góc dưới bên trái mọi màn hình.
- Tự đối chiếu với `/version.json` mỗi 2 phút và mỗi lần quay lại tab; lệch nhau thì nhãn đổi màu "Có bản mới" kèm nút **Cập nhật ngay** (xóa cache trình duyệt rồi nạp lại).
- Bảng chi tiết: phiên bản đang chạy, nhánh, giờ build, commit message, phiên bản trên máy chủ, lịch sử phiên bản đọc từ CHANGELOG, nhật ký các bản máy này đã dùng.
- Super admin thấy thêm liên kết commit trên GitHub và trang chạy lại workflow deploy.
- `apps/web/scripts/version-plugin.ts` sinh `__HM_BUILD__` và `dist/version.json` lúc đóng gói (đọc package.json, git, CHANGELOG; nhận biến của GitHub Actions và Cloudflare).

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
