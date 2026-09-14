# PROMPT: Triển khai toàn bộ mã nguồn Hội Mình trong một lượt

Sao chép toàn bộ khối dưới đây làm prompt. Đặt hai file tham chiếu cùng thư mục làm việc trước khi chạy:

- `PLATFORM_ARCHITECTURE_V1_5_SIMPLE_SALES_UX.md` (kiến trúc, 202 mục)
- `design/hoi-minh-demo.html` và `design/build.mjs` (50 màn hình đã thiết kế, token màu, font, icon)

---

Bạn là kỹ sư trưởng, được giao xây **toàn bộ** sản phẩm Hội Mình trong một phiên làm việc liên tục, không dừng lại hỏi. Đọc kỹ hai nguồn sự thật trước khi viết bất kỳ dòng mã nào, rồi làm theo đúng thứ tự ở mục 9 cho tới khi mọi tiêu chí ở mục 10 đạt. Nếu gặp điểm chưa rõ, tự chọn phương án đơn giản nhất, ghi vào `DECISIONS.md` và đi tiếp.

## 1. Sản phẩm

Hội Mình là nền tảng SaaS cộng đồng + khóa học + thanh toán cho thị trường Việt Nam, kiểu Skool. Ba vai trò:

1. **Quản trị hệ thống** (super admin, chính là tôi): quản lý toàn bộ hội, người dùng, cổng thanh toán, đối soát, gói nền tảng, cộng sự nền tảng.
2. **Chủ hội** (owner): một tài khoản tạo nhiều hội (workspace → nhiều community), cài đặt, giá và gói, tạo khóa học, sự kiện, quản lý thành viên, nhận tiền, doanh thu, duyệt rút tiền cho cộng sự.
3. **Thành viên**: miễn phí hoặc trả phí (Freemium là mặc định), học, đăng bài, sự kiện, mua trong cửa hàng, làm cộng sự.

Nguồn sự thật:

- **Kiến trúc và nghiệp vụ**: `PLATFORM_ARCHITECTURE_V1_5_SIMPLE_SALES_UX.md`. Tuân theo toàn bộ, đặc biệt các mục 56–99 (nền tảng), 100–137 (affiliate), 138–161 (course commerce), 162–185 (product page và UX), 186–202 (V1.5: pricing mode, member admin, plugin, cài đặt, welcome DM, composer, cửa hàng, discovery, xếp hạng cộng sự, affiliate chi trả thủ công, gói nền tảng). Khi mục sau mâu thuẫn mục trước, **mục có số lớn hơn thắng**.
- **Giao diện**: `design/hoi-minh-demo.html` là bản demo 50 màn hình bấm chuyển được; `design/build.mjs` chứa token màu (`T`), font, icon Lucide, và markup từng màn hình. Tái tạo giao diện **đúng theo bản này**: bảng màu giấy ấm (`#F7F3EC`), thanh bên nâu tối (`#25201B`), nhấn cam đất (`#D4593A`) và xanh ngọc (`#0E8E96`), tiêu đề Montserrat 700–800, chữ Open Sans, icon `lucide-react`. Không tự nghĩ ra giao diện khác.

## 2. Quyết định đã chốt, không được đổi

- Modular monolith, multi-tenant: `users → workspaces → communities → community_members`.
- **PostgreSQL trên Supabase** (schema thuần SQL, không phụ thuộc Supabase-specific ngoài Auth). Supabase Auth cho đăng nhập email và Google.
- **Cloudflare Pages + Workers** cho web và API. **Cloudflare R2** cho ảnh và tệp, ảnh phát qua signed URL khi cần riêng tư.
- Video: **chỉ nhúng ngoài** (YouTube, TikTok, Facebook, Loom, Vimeo, Bunny). Dán link, tự nhận diện provider, không upload video.
- Email hệ thống: **Resend**. Email marketing: không làm, chỉ có lớp tích hợp (adapter) để sau.
- Thanh toán qua **Payment Integration Layer** với adapter: **SePay (chuyển khoản QR, webhook báo có), MoMo, VNPAY, PayPal**. V1 bắt buộc chạy thật SePay và MoMo; VNPAY và PayPal có adapter đủ interface, chạy ở chế độ sandbox.
- **Không thu phí giao dịch.** Tiền thành viên trả về đủ cho chủ hội. Doanh thu Hội Mình chỉ từ gói nền tảng.
- **Gói nền tảng duy nhất** cho chủ hội, đầy đủ tính năng, hai chu kỳ **tháng** và **năm** (năm = 10 tháng), dùng thử 14 ngày không cần thẻ. Bảng `plans` vẫn thiết kế để thêm gói thấp hơn sau.
- Pricing mode của một hội: `free | freemium | subscription | one_time` (mặc định `freemium`, tier `standard` miễn phí + `premium` tháng/năm), có "đóng cổng".
- **Affiliate chi trả thủ công** ở cả hai tầng (mục 201): sổ cái ví bất biến (`credit | hold | release | debit | adjustment`), hoa hồng `pending → available` sau hold days (hội: 14, nền tảng: 30), `reversed` khi hoàn tiền; thông tin ngân hàng mã hóa, che bớt; yêu cầu rút có snapshot, `requested → reviewing → paid | rejected`, `requested → cancelled`; người chi trả chuyển khoản ngoài hệ thống rồi nhập mã tham chiếu. Hội Mình không bao giờ tự chuyển tiền.
- **Bỏ bảng xếp hạng hoạt động**, thay bằng **xếp hạng cộng sự** theo snapshot 10 phút (mục 200).
- Không xây landing page builder. Trang bán chuẩn theo trường cố định (mục 163–165), có `sales_mode = native | external_landing`.
- Bài viết dùng **Markdown** (heading, đậm, nghiêng, danh sách, trích dẫn, ảnh giữa bài). Nhiều ảnh hiện lưới kiểu Facebook (1 lớn + 3 nhỏ + "+N"), mở ra thì đọc như blog. Status ngắn dưới 130 ký tự không ảnh được chọn **nền màu** từ 8 nền mẫu trong `STATUS_BGS`.
- Tin nhắn V1 **không realtime**: polling 15 giây, đủ để chạy tin nhắn chào tự động.
- Mọi hành động đi qua **một service layer** dùng chung cho Web, REST API, webhook và MCP. Không có logic nghiệp vụ trong route handler hay component.

## 3. Kỹ thuật

- Monorepo **pnpm + Turborepo**, TypeScript strict toàn bộ.
- `apps/web`: React 18 + Vite + React Router + TanStack Query, Tailwind với token lấy từ `design/build.mjs`, `lucide-react`. Một web app phục vụ cả ba vai trò theo route `/`, `/admin`, `/he-thong`.
- `apps/api`: Hono trên Cloudflare Workers, Zod cho validate, Drizzle ORM cho PostgreSQL (qua Supabase connection pooler), Cloudflare Queues cho job, Cron Triggers cho lịch.
- `apps/mcp`: MCP server (TypeScript SDK) gọi cùng service layer qua API key.
- `packages/`: `db` (schema Drizzle + migration SQL), `core` (service layer, domain, events), `contracts` (Zod schema và type dùng chung), `ui` (component từ design), `payments` (adapter), `email` (template + Resend), `media` (R2), `config`.
- `infra/`: `wrangler.toml` cho từng app, script deploy, `.env.example` đầy đủ.
- Test: Vitest cho `core`, `payments`, `db`; Playwright cho 6 luồng chính ở mục 10.
- Đa ngôn ngữ: giao diện tiếng Việt, khóa i18n sẵn để thêm tiếng Anh.
- Múi giờ hiển thị theo người dùng, lưu UTC. Tiền lưu `amount_minor` (đồng), currency `VND` mặc định, `USD` cho PayPal.

## 4. Dữ liệu

Triển khai đầy đủ các bảng đã nêu trong kiến trúc, tối thiểu:

`users, workspaces, workspace_members, communities, community_members (status: active|cancelling|churned|banned|pending, tier_id, lifetime_value_cents, referred_by_affiliate_id, last_active_at), community_tiers, community_join_questions, member_join_answers, community_plugins, user_community_prefs, spaces (chuyên mục), posts (markdown, status_bg_key, broadcast), post_images, comments (lồng nhau, pinned), reactions, polls, poll_options, poll_votes, courses (status draft|published|archived, access_mode), course_modules, lessons (video_provider, video_external_id, content_md, is_preview, drip_days), lesson_resources, lesson_progress, course_progress, events (series_id, kind, recurrence, access), event_registrations, event_questions, event_question_votes, event_recordings, products (course|bundle|digital), bundle_items, product_pages, offers, prices, coupons, orders, order_items, payments, payment_attempts, payment_events, refunds, subscriptions, invoices, provider_accounts, webhook_events (provider_event_id UNIQUE), reconciliation_items, entitlements, conversations, messages, notifications, notification_prefs, affiliate_programs, affiliate_accounts, affiliate_links, affiliate_clicks, affiliate_attributions, affiliate_conversions, affiliate_commissions, affiliate_wallet_entries (idempotency_key UNIQUE), affiliate_payout_profiles (encrypted_payload, masked_account), affiliate_withdrawal_requests (version, payout_snapshot_encrypted), affiliate_leaderboard_snapshots, plans, platform_subscriptions, subscription_usage, api_keys (key_hash, scopes), webhooks, webhook_deliveries, files, audit_logs, feature_flags, onboarding_progress.`

Mọi bảng nghiệp vụ có `workspace_id` hoặc `community_id`. Bật Row Level Security theo tenant. Soft delete ở posts, comments, courses, products. Index cho mọi khóa ngoại và các truy vấn liệt kê.

## 5. Màn hình phải có (khớp 50 màn trong demo)

**Công khai**: Trang giới thiệu hội (đích của link hội), Khám phá, Đăng nhập, Đăng ký (có ghi nhận người giới thiệu), Quên mật khẩu, Đã gửi link, Đặt mật khẩu mới, Xác minh email.

**Chủ hội**: Trang đăng ký hội, Chọn gói tháng/năm, Hội của tôi, Tạo hội của bạn (6 bước một màn), Tạo khóa học, Soạn nội dung khóa học, Tạo sự kiện, Quản trị thành viên (bộ lọc, modal 4 tab: thành viên, khóa học, thanh toán, câu hỏi), Cài đặt: Tổng quan, Chung (đường dẫn, tên miền riêng), Giá và gói, Cộng sự (cấu hình), Cộng sự · Yêu cầu rút (hàng đợi, xem xét, QR chuyển khoản, mã tham chiếu, từ chối), Tiện ích (plugin), Bảng tin (tab, chuyên mục, quyền đăng), Thanh toán (số dư, tài khoản nhận, cách khách trả, lịch sử rút), Doanh thu.

**Thành viên**: Bảng tin (chuyên mục, ghim, status có nền, lưới ảnh), Tạo bài viết (nền cho status ngắn), Chi tiết bài viết và bình luận, Thư viện khóa học, Chi tiết khóa học, Bài học (đã trả phí), Bài học (miễn phí, bị khóa, mời nâng cấp), Cửa hàng, Chi tiết sản phẩm, Sự kiện, Chi tiết sự kiện (câu hỏi gửi trước và bình chọn), Xếp hạng cộng sự, Tin nhắn, Thông báo, Hồ sơ thành viên, Chỉnh sửa hồ sơ, Tài khoản · Gói và thanh toán, Tài khoản · Cộng sự (ví, tài khoản nhận tiền, rút tiền, lịch sử), Trang thanh toán (tháng/năm, mã giảm, QR chuyển khoản, MoMo, VNPAY, PayPal), Bảng tin trên điện thoại (responsive, 5 tab dưới).

**Quản trị hệ thống**: Tổng quan, Hội, Người dùng, Thanh toán và đối soát (bật tắt cổng, sandbox/production, sức khỏe webhook, bảng đối soát), Gói nền tảng, Cộng sự nền tảng, Nhật ký và webhook.

Mọi màn hình phải responsive, tối thiểu 390px, và giữ đúng bố cục hai cột 740 + 312 ở màn rộng như demo.

## 6. Luồng nghiệp vụ phải chạy thật

1. Đăng ký → xác minh email → vào hội từ link `hoiminh.vn/<slug>` (trang giới thiệu trước) → tham gia miễn phí → tin nhắn chào tự động sau N phút.
2. Nâng cấp Premium: checkout → SePay sinh QR với nội dung `HM <mã>` → webhook báo có → verify chữ ký → `payment.succeeded` → entitlement → mở khóa khóa học → email + thông báo, tất cả dưới 60 giây, idempotent theo `provider_event_id`.
3. Mua lẻ khóa học hoặc combo trong Cửa hàng, hoàn tiền trong 7 ngày nếu xem chưa quá 20%.
4. Cộng sự: bấm link → cookie attribution 30 ngày → đăng ký → trả phí → hoa hồng `pending` → cron chuyển `available` sau hold → cộng sự nhập tài khoản → yêu cầu rút ≥ 500.000đ → chủ hội mở số tài khoản (audit) → nhập mã tham chiếu → `paid`; hoặc từ chối → `release`. Hoàn tiền trong hold → `reversed`.
5. Chủ hội: tạo hội → chọn Freemium → tạo khóa học nháp → soạn 1 module → đăng → tạo sự kiện lặp hằng tuần → thành viên đăng ký → nhắc 1 giờ trước → bản ghi vào Xem lại.
6. Gói nền tảng: dùng thử 14 ngày → nhắc 7, 3, 1 ngày → trả tháng hoặc năm qua chuyển khoản hoặc MoMo → hết hạn thì khóa tạo nội dung, không xóa dữ liệu.
7. Quản trị hệ thống: đối soát chuyển khoản sai nội dung, ghép thủ công; tắt một cổng thanh toán; khóa một hội bị báo cáo.

## 7. API, webhook, MCP

- REST `/v1/...` theo resource, phân trang cursor, lỗi chuẩn `{code, message}`, rate limit ở edge.
- API key theo workspace: hiện raw một lần, lưu hash, scope, revoke, log.
- Webhook gửi đi: `member.joined, member.tier_changed, payment.succeeded, payment.refunded, subscription.cancelled, lesson.completed, course.completed, post.created, event.registered, affiliate.commission_available, affiliate.withdrawal_paid`, ký HMAC, retry lùi dần.
- MCP tools: `list_communities, create_post, add_member, change_member_tier, create_course, create_event, get_member_progress, send_announcement, list_withdrawals, mark_withdrawal_paid`.

## 8. Bảo mật và vận hành

RLS theo tenant, RBAC role → permission (không `if role == admin`), CSRF, mã hóa credential và thông tin ngân hàng bằng khóa trong secret, signed URL cho tệp riêng, audit log cho mọi hành động quản trị và tiền, idempotency cho webhook và ghi sổ, backup Supabase hằng ngày, health endpoint, log có request id, feature flags trong DB.

## 9. Thứ tự làm, không bỏ bước

1. Scaffold monorepo, config, CI (lint, typecheck, test), `.env.example`.
2. `packages/db`: schema + migration + seed (1 super admin, 1 chủ hội "Minh Quý" với hội "Kinh Doanh Online Cùng AI" Freemium, 4 khóa học, 30 thành viên, 6 sự kiện, 6 sản phẩm, 5 cộng sự có dữ liệu ví, đúng dữ liệu mẫu trong demo).
3. `packages/core`: service layer + event bus + permission + entitlement + payment service + affiliate ledger, kèm test.
4. `packages/payments`: 4 adapter, verify chữ ký, chuẩn hóa status, xử lý webhook idempotent, test bằng payload mẫu thật của từng cổng.
5. `apps/api`: route, auth, webhook nhận, queue consumer, cron (hold release, leaderboard snapshot, event reminder, trial reminder, churn).
6. `packages/ui` + `apps/web`: dựng đúng 50 màn hình theo demo, nối API, trạng thái loading, rỗng, lỗi.
7. `apps/mcp`, webhook gửi đi, API key.
8. Playwright cho 7 luồng ở mục 6. Sửa cho tới khi xanh.
9. `README.md` (chạy local, deploy Cloudflare, cấu hình từng cổng thanh toán), `DECISIONS.md`, `CHANGELOG.md`.

## 10. Tiêu chí hoàn thành

- `pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev` chạy được từ máy sạch, mở `http://localhost:5173` thấy Bảng tin với dữ liệu seed.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` đều xanh.
- 50 màn hình có trong route, giao diện khớp demo về bố cục, màu, font, icon.
- 7 luồng ở mục 6 chạy end-to-end với SePay sandbox và MoMo sandbox.
- Không có `TODO`, không có mock trong đường chạy chính, không có logic nghiệp vụ ngoài `packages/core`.
- Mỗi file dưới 400 dòng; component dưới 200 dòng; mọi hàm public có JSDoc ngắn bằng tiếng Việt.

Làm liên tục đến khi xong toàn bộ. Sau mỗi bước ở mục 9, in một dòng tóm tắt và đi tiếp. Kết thúc bằng bảng đối chiếu: từng màn hình và từng luồng ở mục 5, 6 với đường dẫn file tương ứng và trạng thái test.
