# Tiến trình triển khai Hội Mình

Wiki ngắn để phiên làm việc sau biết đã làm đến đâu mà **không phải đọc lại code**. Cập nhật cuối mỗi phần việc, commit cùng code.

Quy ước làm việc: code xong phần nào → `git add -A && git commit && git push origin main` ngay. Tra cứu code bằng GitNexus (`gitnexus query/context/impact`, MCP đã cấu hình cho Claude Code) thay vì đọc cả file.

## Trạng thái tổng (cập nhật 2026-09-16)

| Khối | Trạng thái | Test |
|---|---|---|
| Scaffold monorepo, config, contracts | ✅ xong | typecheck xanh |
| `packages/db` schema + migration + RLS + seed | ✅ xong | 5 test xanh |
| `packages/core` service layer (auth, hội, thành viên, bài viết, khóa học, sự kiện, cửa hàng, checkout, thanh toán, entitlement, affiliate, rút tiền, tin nhắn, thông báo, gói nền tảng, admin, doanh thu, API key, webhook) | ✅ xong | 21 test flows xanh (đủ 7 luồng mục 6) |
| `packages/payments` SePay/MoMo/VNPAY/PayPal | ✅ xong | 9 test xanh |
| `packages/email`, `packages/media` | ✅ xong | 2 + 3 test xanh |
| `apps/api` Hono REST + webhook + cron + worker | ✅ xong | 9 test tích hợp xanh |
| `apps/mcp` 10 tool | ✅ xong | 2 test xanh |
| `packages/ui` token + component + CSS | ✅ xong | — |
| `apps/web` nền (router 50 route, layouts, API client, auth, shell hội, PostCard/PhotoGrid/PollBox/CommentThread) | ✅ xong | — |
| `apps/web` 50 trang | ✅ xong (đủ 50 route, typecheck + lint + build xanh) | — |
| `e2e` Playwright 7 luồng (8 test) | ✅ xanh (`pnpm test:e2e`, ~1 phút) | 8 passed |
| Xác thực hai lớp (TOTP) | ✅ xong 16/09 | 5 test service + thử tay qua API và trình duyệt |
| Giao diện tối | ✅ xong 16/09 | xem tay trên 4 màn chính |
| RLS: biến phiên + công tắc thi hành | ✅ xong 16/09 | 5 test dưới vai trò không sở hữu bảng |
| README.md, DECISIONS.md, CHANGELOG.md | ✅ xong | — |
| `pnpm check` toàn repo | ✅ typecheck + lint + 57 test Vitest xanh | — |

## Bảng ánh xạ 50 màn hình (mục 5) → file → kiểm thử

Tất cả trang nằm trong `apps/web/src/pages`. "e2e" = luồng Playwright trong `e2e/tests` đi qua màn này; "api" = test tích hợp `apps/api/src/api.test.ts`; "core" = `packages/core/src/test/flows.test.ts`.

| # | Màn hình (build.mjs) | Route | File | Kiểm thử |
|---|---|---|---|---|
| 1 | Bảng tin (feed) | `/:slug/bang-tin` | community/Feed.tsx | e2e 01, api |
| 2 | Tạo bài viết (compose) | `/:slug/bang-tin/moi` | community/Composer.tsx (+Parts) | core L5 |
| 3 | Chi tiết bài viết (post) | `/:slug/bai-viet/:postId` | community/PostDetail.tsx (+Parts), components/CommentThread | core |
| 4 | Thư viện khóa học (courses) | `/:slug/khoa-hoc` | community/Courses.tsx | e2e 02 |
| 5 | Chi tiết khóa học (course) | `/:slug/khoa-hoc/:courseId` | community/CourseOverview.tsx (+Parts, LessonParts) | core L5 |
| 6 | Bài học đã trả phí (classroom) | `/:slug/bai/:lessonId` | community/Classroom.tsx | core L2 |
| 7 | Bài học miễn phí bị khóa (classroom-free) | `/:slug/bai/:lessonId` | community/Classroom.tsx (LockedPlayer) | core L2 |
| 8 | Cửa hàng (store) | `/:slug/cua-hang` | community/Store.tsx | e2e 03 |
| 9 | Chi tiết sản phẩm (product) | `/:slug/cua-hang/:productSlug` | community/ProductDetail.tsx (+Parts) | core L3 |
| 10 | Sự kiện (events) | `/:slug/su-kien` | community/Events.tsx, EventParts.tsx | core L5 |
| 11 | Chi tiết sự kiện (event) | `/:slug/su-kien/:eventId` | community/EventDetail.tsx | e2e 05 |
| 12 | Xếp hạng cộng sự (affiliate) | `/:slug/xep-hang` | community/Leaderboard.tsx | e2e 04, core L4 |
| 13 | Tin nhắn (messages) | `/tin-nhan` | account/Messages.tsx (+Parts) | core L1 (welcome DM) |
| 14 | Thông báo (notifications) | `/thong-bao` | account/Notifications.tsx | core |
| 15 | Hồ sơ thành viên (profile) | `/u/:handle` | account/Profile.tsx | api |
| 16 | Tài khoản · Hồ sơ (profile-edit) | `/tai-khoan/ho-so` | account/ProfileEdit.tsx (+Parts), AccountLayout.tsx | — |
| 17 | Tài khoản · Cộng sự (my-affiliate) | `/tai-khoan/cong-su[/:programId]` | account/AffiliateWallet.tsx (+Parts) | e2e 04 |
| 18 | Tài khoản · Gói và thanh toán (account) | `/tai-khoan/goi` | account/AccountBilling.tsx (+Parts) | e2e 03 |
| 19 | Thanh toán (checkout) | `/:slug/thanh-toan`, `/thanh-toan/:orderId` | community/Checkout.tsx, CheckoutConfigure.tsx, CheckoutParts.tsx | e2e 02, 03, 06 |
| 20 | Tạo hội của bạn · đăng ký (signup) | `/tao-hoi` | public/SignupLanding.tsx (+SignupParts) | — |
| 21 | Chọn gói tháng/năm (signup-plan) | `/tao-hoi/goi` | public/SignupPlan.tsx | — |
| 22 | Hội của tôi (ws-home) | `/admin`, `/admin/goi` | owner/WorkspaceHome.tsx (+Parts, PlanCard) | e2e 05, 06 |
| 23 | Tạo hội (ws-create) | `/admin/tao-hoi` | owner/WorkspaceCreate.tsx (+Parts) | e2e 05 |
| 24 | Tạo sự kiện (event-create) | `/:slug/su-kien/moi`, `/:eventId/sua` | community/EventCreate.tsx (+Parts) | e2e 05 |
| 25 | Tạo khóa học (course-create) | `/:slug/khoa-hoc/moi`, `/:courseId/sua` | community/CourseCreate.tsx (+Parts) | e2e 05 |
| 26 | Soạn nội dung khóa học (course-builder) | `/:slug/khoa-hoc/:courseId/soan` | community/CourseBuilder.tsx, CourseBuilderOutline.tsx (+Parts) | e2e 05 |
| 27 | Quản trị thành viên (members) | `/:slug/thanh-vien` | community/Members.tsx (+Parts, +Extra) | api, core |
| 28 | Cài đặt · Tổng quan (s-overview) | `/:slug/cai-dat` | settings/SettingsOverview.tsx, SettingsLayout.tsx | — |
| 29 | Cài đặt · Chung (s-general) | `/:slug/cai-dat/chung` | settings/SettingsGeneral.tsx | — |
| 30 | Cài đặt · Giá và gói (settings) | `/:slug/cai-dat/gia` | settings/SettingsPricing.tsx (+Parts) | core L5 |
| 31 | Cài đặt · Cộng sự (s-affiliate) | `/:slug/cai-dat/cong-su` | settings/SettingsAffiliate.tsx, AffiliateTabs.tsx | core L4 |
| 32 | Cài đặt · Yêu cầu rút (s-affiliate-payouts) | `/:slug/cai-dat/cong-su/rut-tien` | settings/SettingsAffiliatePayouts.tsx, components/PayoutQueue, PayoutReviewPanel | e2e 04 |
| 33 | Cài đặt · Tiện ích (s-plugins) | `/:slug/cai-dat/tien-ich` | settings/SettingsPlugins.tsx | core L1 |
| 34 | Cài đặt · Bảng tin (s-feed) | `/:slug/cai-dat/bang-tin` | settings/SettingsFeed.tsx | — |
| 35 | Cài đặt · Thanh toán (s-payout) | `/:slug/cai-dat/thanh-toan` | settings/SettingsPayout.tsx | core L7 |
| 36 | Doanh thu (revenue) | `/:slug/doanh-thu` | community/Revenue.tsx | — |
| 37 | Hệ thống · Tổng quan (sa-overview) | `/he-thong` | admin/AdminOverview.tsx | e2e 07, api |
| 38 | Hệ thống · Hội (sa-communities) | `/he-thong/hoi`, `/he-thong/ho-tro` | admin/AdminCommunities.tsx | e2e 07 |
| 39 | Hệ thống · Thanh toán và đối soát (sa-payments) | `/he-thong/thanh-toan` | admin/AdminPayments.tsx (+Parts) | e2e 07, core L7 |
| 40 | Hệ thống · Cộng sự nền tảng (sa-affiliate) | `/he-thong/cong-su` | admin/AdminAffiliate.tsx | — |
| 41 | Hệ thống · Gói nền tảng (sa-plans) | `/he-thong/goi`, `/he-thong/tinh-nang` | admin/AdminPlans.tsx | — |
| 42 | Bảng tin trên điện thoại (mobile) | `/:slug/bang-tin` @390px | layouts/AppShell.tsx (mobile tabs) + Feed | — |
| 43 | Trang giới thiệu hội (about) | `/:slug` | public/CommunityAbout.tsx (+Parts, +Rail) | e2e 01, api |
| 44 | Đăng nhập (login) | `/dang-nhap` | public/Login.tsx | e2e 01–07 |
| 45 | Đăng ký (register) | `/dang-ky` | public/Register.tsx | e2e 01 |
| 46 | Quên mật khẩu (forgot) | `/quen-mat-khau` | public/ForgotPassword.tsx | core L1 |
| 47 | Đã gửi link (forgot-sent) | `/quen-mat-khau/da-gui` | public/ForgotSent.tsx | — |
| 48 | Đặt mật khẩu mới (reset-password) | `/dat-lai-mat-khau` | public/ResetPassword.tsx | core L1 |
| 49 | Xác minh email (verify-email) | `/xac-minh-email` | public/VerifyEmail.tsx | e2e 01 |
| 50 | Khám phá (discovery) | `/kham-pha` | public/Discovery.tsx | — |

Ngoài 50 màn: Hệ thống · Người dùng `/he-thong/nguoi-dung` (admin/AdminUsers.tsx), Nhật ký và webhook `/he-thong/nhat-ky` (admin/AdminLogs.tsx), Google callback `/auth/callback`.

## Bảng ánh xạ 7 luồng (mục 6)

| Luồng | Core (`flows.test.ts`) | E2E (`e2e/tests`) |
|---|---|---|
| 1. Đăng ký → xác minh → tham gia miễn phí → tin nhắn chào | ✅ | 01-dang-ky-tham-gia |
| 2. Nâng cấp Premium qua SePay, idempotent, mở khóa | ✅ | 02-premium-sepay |
| 3. Mua lẻ qua MoMo và hoàn tiền 7 ngày | ✅ | 03-cua-hang-momo-hoan-tien |
| 4. Cộng sự: hold → available → rút → xem xét → trả/từ chối | ✅ | 04-cong-su-rut-tien |
| 5. Chủ hội tạo hội → khóa học → sự kiện lặp | ✅ | 05-chu-hoi-tao-hoi-khoa-hoc-su-kien |
| 6. Gói nền tảng dùng thử → trả → hết hạn khóa | ✅ | 06-goi-nen-tang |
| 7. Quản trị hệ thống: đối soát, tắt cổng, khóa hội | ✅ | 07-quan-tri-he-thong |

## Đã kiểm chứng
- Clone sạch từ GitHub (2026-09-15): `pnpm install --frozen-lockfile && pnpm db:migrate && pnpm db:seed` chạy được, mở http://localhost:5173 thấy Bảng tin hội mẫu sau khi đăng nhập.
- `pnpm test:e2e` 8 passed; `pnpm test` 51 passed; `pnpm typecheck`, `pnpm lint` xanh; `pnpm --filter @hoiminh/web build` OK.
- Deploy Cloudflare Pages (2026-09-15): project `hoiminh-web`, https://hoiminh-web.pages.dev mở được trang đăng nhập, `/version.json` trả `Cache-Control: no-store` đúng như `_headers`, nhãn phiên bản hiện `v1.0.0 · 53033d0` ở góc dưới bên trái.
- Nhãn phiên bản: thử đổi `dist/version.json` sang buildId khác → nhãn chuyển sang "Có bản mới" màu cam, bảng chi tiết hiện phiên bản máy chủ và nút **Cập nhật ngay**; tab "Máy này" ghi đúng các bản đã dùng.
- Production (2026-09-15): https://hoiminh.com và https://www.hoiminh.com phục vụ bằng Worker static assets, https://api.hoiminh.com bằng Worker + Hyperdrive → Supabase (84 bảng, 89 policy). `/health` trả `db: ok`; 12/12 lần đăng nhập liên tiếp trả 200 sau khi bỏ cache App giữa các request. Đăng nhập trên trình duyệt bằng `minhquy1711@gmail.com` vào được `/he-thong` với quyền super admin.

## Rà soát 2026-09-15 (lệnh `/ra-soat`)

Tìm theo bốn tầng: có tài liệu mà không có code · có code mà không nối · có nối mà không chạy thật · có chạy mà không có test.

| Phát hiện | Tầng | Xử lý |
|---|---|---|
| Không có màn tạo sản phẩm số / combo (chỉ tạo được khóa học) | code có, không nối | ✅ thêm `/:slug/cua-hang/moi` + `/sua` |
| Mua sản phẩm số xong không tải được tệp | nối hỏng | ✅ khối tải tệp ở trang sản phẩm |
| API key + webhook gửi đi không có màn nào (kiến trúc mục 13) | tài liệu có, code không | ✅ `/admin/nha-phat-trien` |
| Chủ hội không đặt được câu hỏi khi xin vào hội | code có, không nối | ✅ trong Cài đặt · Chung |
| `pnpm dev` hỏng vì gói mcp thoát ngay | có chạy, không ai kiểm | ✅ lọc mcp khỏi `dev` |
| Ô tìm kiếm header quản trị là ô chết | code có, không nối | ✅ Enter → Hội / Người dùng kèm `?q=` |
| `feature-flags.isEnabled` không ai gọi — super admin bật/tắt cờ không có tác dụng gì | code có, không nối | ✅ 16/09: cờ chặn ở service (store, affiliate_leaderboard, paypal, mcp) |
| `POST /orders/:id/admin-refund` không có nút nào gọi | code có, không nối | ✅ 16/09: nút Hoàn tiền ở Doanh thu |
| Xác thực hai lớp, giao diện tối ghi "sắp có" | tài liệu có, code không | ✅ 16/09: TOTP đầy đủ; giao diện tối cho cả 50 màn |
| R2 chưa cấu hình nên tải ảnh/video hỏng trên Worker | nối, không chạy thật | ⏳ cần credential |
| RLS có 89 policy nhưng service không đặt biến phiên | nối, không chạy thật | ✅ 16/09: biến phiên đặt trong mọi request/job; bật thi hành bằng `pnpm db:rls on` |

## Việc kế tiếp

Cần tài khoản của chủ dự án, không ai làm thay được:

1. **Deploy tự động đang đỏ**: thiếu secret `CLOUDFLARE_API_TOKEN`. Tạo token ở Cloudflare (My Profile → API Tokens → Edit Cloudflare Workers) rồi `gh secret set CLOUDFLARE_API_TOKEN --repo blogminhquy/hoiminh`; bật deploy API bằng `gh variable set DEPLOY_API --body true`. Chưa có thì bản trên hoiminh.com vẫn là build tay.
2. **R2**: tạo bucket `hoiminh-files`, điền `R2_*` — chưa có thì tải ảnh/video hỏng trên Worker vì `packages/media` rơi về lưu trên đĩa mà Worker không có đĩa.
3. **Email**: `RESEND_API_KEY` — chưa có thì email xác minh, mời thành viên, nhắc sự kiện chỉ ghi log.
4. Điền credential SePay/MoMo/VNPAY/PayPal thật trong `/he-thong/thanh-toan` và bật production.
5. Đổi mật khẩu tài khoản quản trị `minhquy1711@gmail.com` (đang là mật khẩu tạm) ở `/tai-khoan/ho-so`.

Quyết định vận hành:

6. **Bật thi hành RLS**: `pnpm db:rls status` để xem, `pnpm db:rls on` để bật. Biến phiên đã được đặt ở mọi request và job, test `packages/db/src/test/rls.test.ts` chứng minh policy chặn thật dưới vai trò không sở hữu bảng. Bật khi có người theo dõi log: đường chạy nào thiếu biến phiên sẽ trả rỗng chứ không báo lỗi.
7. Việc V2 theo kiến trúc: tin nhắn thời gian thực, phát trực tiếp, dashboard riêng cho người mua lẻ ngoài hội.

## Bẫy đã gặp khi viết e2e

Hai lần CI đỏ mà máy local xanh, cùng một kiểu: test đua với chính giao diện.

- **Selector khớp-chứa.** `getByText('Chủ tài khoản')` trúng luôn dòng từ chối "Sai tên chủ tài khoản…" ở bảng lịch sử. Chỉ lộ khi bảng kịp render đúng lúc assert. Dùng `{ exact: true }` cho nhãn ngắn.
- **Bấm nút trên form tự gửi.** `VerifyEmail` tự gọi API khi đủ 6 số; bấm thêm nút "Xác minh" thì gặp nút disabled rồi phần tử bị gỡ khỏi DOM, click treo tới hết 90 giây. Guard `isEnabled()` không cứu được vì trạng thái đổi ngay sau khi kiểm. Với form tự gửi thì chỉ nhập rồi chờ kết quả.
- Nhớ là **retry của Playwright dùng lại database cũ** (`webServer` chỉ reset một lần mỗi lần chạy). Test nào tiêu tài nguyên có hạn — ví dụ rút hết tiền trong ví — thì lần chạy lại chắc chắn hỏng.

## Ghi chú kỹ thuật cần nhớ
- PATH trong PowerShell phải nạp lại: `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") + ";$env:APPDATA\npm"`. Bash: `export PATH="$PATH:/c/Program Files/nodejs:/c/Users/Admin/AppData/Roaming/npm"`.
- Tài khoản seed: mật khẩu chung `hoiminh123`; `minhquy@gmail.com` (chủ hội `minhquy`), `admin@hoiminh.vn` (super admin), `hoangvu@gmail.com` (cộng sự, mã `hv8k2`), `congtran@gmail.com` (thành viên thường).
- OTP xác minh email ở `APP_ENV=test` luôn là `482913`.
- Webhook SePay test: `POST /webhooks/sepay` header `Authorization: Apikey <SEPAY_API_KEY>`; nội dung chứa `HM XXXXX`.
