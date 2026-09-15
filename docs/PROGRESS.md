# Tiến trình triển khai Hội Mình

Wiki ngắn để phiên làm việc sau biết đã làm đến đâu mà **không phải đọc lại code**. Cập nhật cuối mỗi phần việc, commit cùng code.

Quy ước làm việc: code xong phần nào → `git add -A && git commit && git push origin main` ngay. Tra cứu code bằng GitNexus (`gitnexus query/context/impact`, MCP đã cấu hình cho Claude Code) thay vì đọc cả file.

## Trạng thái tổng (cập nhật 2026-09-15)

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
| `apps/web` trang | 🟡 **đang làm** (xem bảng dưới) | chưa typecheck toàn bộ |
| `e2e` Playwright 7 luồng | ⬜ chưa | — |
| README.md | ⬜ chưa (DECISIONS.md, CHANGELOG.md đã có) | — |
| `pnpm check` toàn repo (typecheck + lint + test) | ⬜ chưa chạy sau khi có web | — |

## Trang web (`apps/web/src/pages`)

Ký hiệu: ✅ có file và đã typecheck · 🟡 có file, chưa typecheck · ⬜ chưa có (router đã trỏ tới tên file này).

| Nhóm | Trang (route) | File | Trạng thái |
|---|---|---|---|
| public | Khám phá `/kham-pha` | public/Discovery.tsx | 🟡 |
| public | Đăng nhập / Đăng ký / Quên MK / Đã gửi / Đặt lại / Xác minh / Callback | public/Login, Register, ForgotPassword, ForgotSent, ResetPassword, VerifyEmail, AuthCallback (+AuthParts) | 🟡 |
| public | Tạo hội landing `/tao-hoi`, chọn gói `/tao-hoi/goi` | public/SignupLanding, SignupPlan (+SignupParts) | 🟡 |
| public | Trang giới thiệu hội `/:slug` | public/CommunityAbout (+Parts, +Rail) | 🟡 |
| owner | Hội của tôi `/admin`, `/admin/goi` | owner/WorkspaceHome.tsx | ⬜ (đã có WorkspaceHomeParts, WorkspacePlanCard) |
| owner | Tạo hội `/admin/tao-hoi` | owner/WorkspaceCreate.tsx | ⬜ |
| community | Bảng tin, soạn bài `/:slug/bang-tin[/moi]` | community/Feed, Composer (+Parts) | 🟡 |
| community | Bài viết `/:slug/bai-viet/:postId` | community/PostDetail (+Parts) | 🟡 |
| community | Khóa học, tạo/sửa | community/Courses, CourseCreate (+Parts), CourseOverview (+Parts) | 🟡 |
| community | Soạn khóa học `/khoa-hoc/:id/soan` | community/CourseBuilder.tsx | ⬜ (đã có CourseBuilderParts) |
| community | Lớp học `/bai/:lessonId` | community/Classroom.tsx | ⬜ (đã có LessonParts) |
| community | Cửa hàng, chi tiết sản phẩm | community/Store, ProductDetail | ⬜ |
| community | Sự kiện, tạo/sửa, chi tiết | community/Events, EventCreate, EventDetail | ⬜ |
| community | Xếp hạng cộng sự | community/Leaderboard | ⬜ |
| community | Thành viên | community/Members (+Parts, +Extra, MessageModal) | 🟡 |
| community | Doanh thu | community/Revenue | ⬜ |
| community | Checkout `/:slug/thanh-toan`, `/thanh-toan/:orderId` | community/Checkout | ⬜ |
| settings | Layout + Tổng quan/Chung/Giá/Cộng sự/Rút tiền/Tiện ích/Bảng tin/Thanh toán | settings/SettingsLayout, SettingsOverview, SettingsGeneral, SettingsPricing, SettingsAffiliate, SettingsAffiliatePayouts, SettingsPlugins, SettingsFeed, SettingsPayout | ⬜ (đã có components/PayoutQueue, PayoutReviewPanel, EditorBits) |
| account | Tin nhắn, Thông báo, Hồ sơ công khai | account/Messages, Notifications, Profile | ⬜ |
| account | Sửa hồ sơ, Gói của tôi, Ví cộng sự | account/AccountLayout, ProfileEdit (+Parts) ✅ · AccountBilling ⬜ (có Parts) · AffiliateWallet ⬜ | 🟡/⬜ |
| admin | Tổng quan, Hội, Người dùng, Thanh toán, Gói/Tính năng, Cộng sự, Nhật ký | admin/AdminOverview, AdminCommunities, AdminUsers, AdminPayments, AdminPlans, AdminAffiliate, AdminLogs | ⬜ |

## Việc kế tiếp (theo thứ tự)
1. Viết các trang ⬜ ở trên (đọc markup tương ứng trong `design/build.mjs`, brief API trong `docs/PAGES_BRIEF.md`).
2. `pnpm --filter @hoiminh/web typecheck` + `pnpm lint` → sửa.
3. e2e Playwright (`e2e/`): config webServer api 8787 (pglite memory, APP_ENV=test) + web 5173; 7 luồng.
4. README.md; chạy `pnpm check`, `pnpm test:e2e`; kiểm tra clean install; bảng ánh xạ màn hình/luồng → file → test.

## Ghi chú kỹ thuật cần nhớ
- PATH trong PowerShell phải nạp lại: `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") + ";$env:APPDATA\npm"`. Bash: `export PATH="$PATH:/c/Program Files/nodejs:/c/Users/Admin/AppData/Roaming/npm"`.
- Tài khoản seed: mật khẩu chung `hoiminh123`; `minhquy@gmail.com` (chủ hội `minhquy`), `admin@hoiminh.vn` (super admin), `hoangvu@gmail.com` (cộng sự, mã `hv8k2`), `congtran@gmail.com` (thành viên thường).
- OTP xác minh email ở `APP_ENV=test` luôn là `482913`.
- Webhook SePay test: `POST /webhooks/sepay` header `Authorization: Apikey <SEPAY_API_KEY>`; nội dung chứa `HM XXXXX`.
