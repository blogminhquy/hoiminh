# Tiến trình triển khai Hội Mình

Wiki ngắn để phiên làm việc sau biết đã làm đến đâu mà **không phải đọc lại code**. Cập nhật cuối mỗi phần việc, commit cùng code.

Quy ước làm việc: code xong phần nào → `git add -A && git commit && git push origin main` ngay. Tra cứu code bằng GitNexus (`gitnexus query/context/impact`, MCP đã cấu hình cho Claude Code) thay vì đọc cả file.

## Trạng thái tổng (cập nhật 2026-09-15)

| Khối | Trạng thái | Test |
|---|---|---|
| Scaffold monorepo, config, contracts | ✅ xong | typecheck xanh |
| `packages/db` schema + migration + RLS + seed | ✅ xong | 5 test xanh |
| `packages/core` service layer (auth, hội, thành viên, bài viết, khóa học, sự kiện, cửa hàng, checkout, thanh toán, entitlement, affiliate, rút tiền, tin nhắn, thông báo, gói nền tảng, admin, doanh thu, API key, webhook) | ✅ xong | 21 test flows xanh (đủ 7 luồng mục 6) |
| **V2** Tin nhắn thời gian thực (hub SSE, tin mới, đã xem, đang gõ, online, badge sống) | ✅ xong | 8 test core + 2 test api + e2e 08 |
| **V2** Khu học tập người mua lẻ (`/hoc`: thư viện theo entitlement, bài học ngoài khung hội, bỏ tự thêm vào hội) | ✅ xong | 9 test core + 2 test api + e2e 09 |
| `packages/payments` SePay/MoMo/VNPAY/PayPal | ✅ xong | 9 test xanh |
| `packages/email`, `packages/media` | ✅ xong | 2 + 3 test xanh |
| `apps/api` Hono REST + webhook + cron + worker + SSE `/v1/me/stream` | ✅ xong | 13 test tích hợp xanh |
| `apps/mcp` 10 tool | ✅ xong | 2 test xanh |
| `packages/ui` token + component + CSS | ✅ xong | — |
| `apps/web` nền (router 50 route, layouts, API client, auth, shell hội, PostCard/PhotoGrid/PollBox/CommentThread) | ✅ xong | — |
| `apps/web` 50 trang | ✅ xong (đủ 50 route, typecheck + lint + build xanh) | — |
| `e2e` Playwright 9 luồng (10 test) | ✅ xanh (`pnpm test:e2e`, ~2,5 phút) | 10 passed |
| README.md, DECISIONS.md, CHANGELOG.md | ✅ xong | — |
| `pnpm check` toàn repo | ✅ typecheck + lint + 77 test Vitest xanh | - |

## Bảng ánh xạ 50 màn hình (mục 5) → file → kiểm thử

Tất cả trang nằm trong `apps/web/src/pages`. "e2e" = luồng Playwright trong `e2e/tests` đi qua màn này; "api" = test tích hợp `apps/api/src/api.test.ts`; "core" = `packages/core/src/test/flows.test.ts`.

| # | Màn hình (build.mjs) | Route | File | Kiểm thử |
|---|---|---|---|---|
| 1 | Bảng tin (feed) | `/:slug/bang-tin` | community/Feed.tsx | e2e 01, api |
| 2 | Tạo bài viết (compose) | `/:slug/bang-tin/moi` | community/Composer.tsx (+Parts) | core L5 |
| 3 | Chi tiết bài viết (post) | `/:slug/bai-viet/:postId` | community/PostDetail.tsx (+Parts), components/CommentThread | core |
| 4 | Thư viện khóa học (courses) | `/:slug/khoa-hoc` | community/Courses.tsx | e2e 02 |
| 5 | Chi tiết khóa học (course) | `/:slug/khoa-hoc/:courseId` | community/CourseOverview.tsx (+Parts, LessonParts) | core L5 |
| 6 | Bài học đã trả phí (classroom) | `/:slug/bai/:lessonId`, `/hoc/bai/:lessonId` | community/Classroom.tsx | core L2, e2e 09 |
| 7 | Bài học miễn phí bị khóa (classroom-free) | `/:slug/bai/:lessonId` | community/Classroom.tsx (LockedPlayer) | core L2 |
| 8 | Cửa hàng (store) | `/:slug/cua-hang` | community/Store.tsx | e2e 03 |
| 9 | Chi tiết sản phẩm (product) | `/:slug/cua-hang/:productSlug` | community/ProductDetail.tsx (+Parts) | core L3 |
| 10 | Sự kiện (events) | `/:slug/su-kien` | community/Events.tsx, EventParts.tsx | core L5, event-link |
| 11 | Chi tiết sự kiện (event) | `/:slug/su-kien/:eventId` | community/EventDetail.tsx | e2e 05, event-link |
| 12 | Xếp hạng cộng sự (affiliate) | `/:slug/xep-hang` | community/Leaderboard.tsx | e2e 04, core L4 |
| 13 | Tin nhắn (messages) | `/tin-nhan` | account/Messages.tsx (+Parts) | core L1 (welcome DM), realtime, e2e 08 |
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

Ngoài 50 màn: Hệ thống · Người dùng `/he-thong/nguoi-dung` (admin/AdminUsers.tsx), Nhật ký và webhook `/he-thong/nhat-ky` (admin/AdminLogs.tsx), Google callback `/auth/callback`, và **Khu học tập `/hoc`** (learner/Library.tsx + LibraryParts.tsx, khung layouts/LearnerShell.tsx): màn V2 cho người mua lẻ, e2e 09.

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
| 8 (V2). Tin nhắn thời gian thực: tin mới, đang gõ, đã xem giữa hai phiên | ✅ `realtime.test.ts` | 08-tin-nhan-thoi-gian-thuc |
| 9 (V2). Mua lẻ không vào hội → Khu học tập → học bài | ✅ `learner.test.ts` | 09-mua-le-khu-hoc-tap |

## Đã kiểm chứng
- Clone sạch từ GitHub (2026-09-15): `pnpm install --frozen-lockfile && pnpm db:migrate && pnpm db:seed` chạy được, mở http://localhost:5173 thấy Bảng tin hội mẫu sau khi đăng nhập.
- `pnpm test:e2e` 10 passed; `pnpm test` 77 passed; `pnpm typecheck`, `pnpm lint` xanh; `pnpm --filter @hoiminh/web build` OK.
- Máy chạy thử có Chromium bản khác bản Playwright tải về: đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (đã khai báo `passThroughEnv` trong turbo.json) rồi chạy `pnpm test:e2e` bình thường.

## Việc kế tiếp
1. Deploy thật lên Cloudflare + Supabase khi có credential (README mục Deploy); chạy `pnpm db:migrate` với `DATABASE_DIRECT_URL`.
2. Điền credential SePay/MoMo/VNPAY/PayPal thật trong `/he-thong/thanh-toan` và bật production.
3. Phát trực tiếp: **không làm** (quyết định của chủ dự án). Sự kiện dùng link phòng họp sẵn có: Zoom, Google Meet hoặc link tùy chọn (DECISIONS mục 36-38).
4. Trước khi chạy nhiều node API hoặc chuyển API sang Cloudflare Workers: thay hub thời gian thực trong bộ nhớ bằng Durable Object hoặc Redis pub/sub (chỉ đổi `createRealtimeHub()` trong `packages/core/src/app.ts`, xem DECISIONS.md mục 25).

## Ghi chú kỹ thuật cần nhớ
- PATH trong PowerShell phải nạp lại: `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") + ";$env:APPDATA\npm"`. Bash: `export PATH="$PATH:/c/Program Files/nodejs:/c/Users/Admin/AppData/Roaming/npm"`.
- Tài khoản seed: mật khẩu chung `hoiminh123`; `minhquy@gmail.com` (chủ hội `minhquy`), `admin@hoiminh.vn` (super admin), `hoangvu@gmail.com` (cộng sự, mã `hv8k2`), `congtran@gmail.com` (thành viên thường).
- OTP xác minh email ở `APP_ENV=test` luôn là `482913`.
- Link phòng họp sự kiện: `meeting_url` + `meeting_provider` trong bảng `events`; nhận diện nhà cung cấp ở `packages/core/src/services/events.ts` (`meetingProvider`), nhãn hiển thị ở `apps/web/src/pages/community/EventParts.tsx` (`PROVIDER_LABEL`). Đăng ký xong là thấy link, hủy thì mất.
- Khu học tập: dịch vụ `packages/core/src/services/learner.ts` (`myLibrary`), API `GET /v1/me/library`, web `apps/web/src/pages/learner/` + `layouts/LearnerShell.tsx`. Thư viện dựng từ **entitlement**, không từ `community_members`: khóa mở nhờ tier vẫn nằm ở khung hội. Người mua lẻ không còn bị tự thêm vào hội (DECISIONS mục 30).
- Tin nhắn thời gian thực: hub ở `packages/core/src/realtime/hub.ts` (`ctx.realtime`), SSE ở `apps/api/src/routes/stream.ts`, client ở `apps/web/src/lib/realtime.tsx`. Kiểm nhanh: `curl -N -H "Authorization: Bearer <token>" http://localhost:8787/v1/me/stream` phải thấy `event: ready`, và `GET /health` trả `realtimeConnections` tăng lên.
- Webhook SePay test: `POST /webhooks/sepay` header `Authorization: Apikey <SEPAY_API_KEY>`; nội dung chứa `HM XXXXX`.
