# DECISIONS.md — Quyết định khi triển khai Hội Mình

Ghi lại các điểm kiến trúc chưa nói rõ và cách đã chọn (phương án đơn giản nhất), theo yêu cầu của prompt triển khai. Số mục tham chiếu tới `PLATFORM_ARCHITECTURE_V1_5_SIMPLE_SALES_UX.md`.

## Hạ tầng và chạy local

1. **PGlite cho local và test, PostgreSQL (Supabase) cho production.** `DATABASE_URL=pglite://./.data/hoiminh` là mặc định để `pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev` chạy từ máy sạch không cần cài Postgres. Cùng một bộ migration SQL (drizzle-kit) chạy trên cả hai. Lớp `raw()` trong core chuẩn hóa kết quả `execute()` giữa hai driver.
2. **API chạy trên Node khi dev, trên Cloudflare Workers khi deploy.** Hono là runtime-agnostic: `apps/api/src/node.ts` (tsx, cron bằng `setInterval`, hàng đợi in-memory) và `apps/api/src/worker.ts` (Queues + Cron Triggers). Cùng một `createHonoApp()`.
3. **Auth: hai provider cùng interface.** `AUTH_PROVIDER=local` (dev/test, PBKDF2 trong bảng `user_credentials`) và `AUTH_PROVIDER=supabase` (Supabase Auth giữ mật khẩu + Google OAuth qua GoTrue REST, service role để đổi mật khẩu). Phiên đăng nhập luôn là JWT HS256 do API ký + refresh token băm trong `auth_sessions`, để web/MCP không phụ thuộc token Supabase. Xác minh email bằng mã 6 số do API sinh (khớp màn hình OTP), gửi qua Resend.
4. **Media:** khi chưa cấu hình R2 thì `LocalMediaProvider` lưu tệp vào `.data/files` và phát qua `/files/*` (tệp riêng cần URL ký). Interface giống R2 nên đổi bằng biến môi trường.
5. **Email:** không có `RESEND_API_KEY` thì `LogSender` ghi vào `email_logs` và console; test đọc outbox này.
6. **Primitive mã hóa nằm trong `@hoiminh/config`** (`crypto.ts`) vì cả `db/seed` và `core` cần dùng; tránh vòng phụ thuộc db ↔ core.

## Thanh toán

7. **Sandbox không credential → trang mô phỏng.** MoMo/VNPAY/PayPal khi thiếu credential và `APP_ENV !== production` chuyển hướng tới `/pay/simulator` của API; trang này gửi IPN/webhook **được ký đúng bằng secret sandbox** về chính API, nên toàn bộ đường xử lý (verify → idempotent → entitlement) là đường chạy thật. Có credential thì gọi API thật của cổng. SePay luôn tạo QR thật (VietQR) và nhận webhook thật.
8. **Mã tham chiếu `HM XXXXX`** (5 ký tự, bỏ 0/O/1/I) vừa là `orders.reference` vừa là nội dung chuyển khoản. Webhook SePay tách mã bằng regex `HM\s?[A-Z0-9]{5,8}`; sai nội dung/thiếu mã/lệch tiền/trùng → ghi `reconciliation_items` để super admin ghép thủ công.
9. **Hoàn tiền chuyển khoản là thủ công** (adapter trả `manual: true`): hệ thống thu hồi entitlement, đảo hoa hồng và gửi email; chủ hội chuyển lại tiền ngoài hệ thống. MoMo/PayPal có API refund khi có credential.
10. **Số hóa đơn** tăng dần theo `max(...)+1` (`HM-YYYY-NNNN`).

## Affiliate (mục 201)

11. **Sổ cái:** `hold` khi gửi yêu cầu; khi trả: `release` + `debit` (số dư khả dụng không đổi, tiền rời ví); khi từ chối/hủy: `release`. Số dư = credit + release + adjustment − hold − debit, đúng công thức trong kiến trúc, không có cột balance.
12. Hoàn tiền sau khi hoa hồng đã vào ví → bút toán `adjustment` âm (không xóa lịch sử).
13. Attribution: last click wins qua cookie `hm_ref` (30 ngày) + `hm_vid`; ưu tiên `?ref=` truyền vào checkout, sau đó attribution còn hạn, sau đó `referred_by_affiliate_id` của thành viên.

## Sản phẩm và route

14. **Route web:** `/:slug` = trang giới thiệu hội (đích của link), `/:slug/bang-tin|khoa-hoc|...` = app thành viên, `/:slug/cai-dat/*` = cài đặt chủ hội, `/admin` = Hội của tôi (workspace), `/he-thong/*` = quản trị hệ thống, `/tai-khoan/*`, `/tin-nhan`, `/thong-bao`, `/u/:handle`. Slug hội bị cấm trùng route hệ thống (`RESERVED_SLUGS`).
15. **Khóa học có cả `workspace_id` và `community_id`** (mục 139 + yêu cầu mỗi bảng có tenant). `access_mode` đúng 4 lựa chọn của màn Tạo khóa học; bán lẻ tự tạo `products` + `product_pages` khi đăng.
16. Người ngoài hội mua lẻ sản phẩm của hội Freemium được thêm làm thành viên Tiêu chuẩn để có dashboard học (mục 153 để dashboard riêng cho V2).
17. **Xếp hạng cộng sự** tính lại mỗi 10 phút (cron) và ngay sau khi seed; tháng, quý và từ đầu.
18. **Welcome DM** dùng bảng `scheduled_jobs` (cron mỗi phút) để trễ N phút, chạy được cả trên Workers; tin nhắn polling 15 giây.
19. **RLS:** một policy `tenant_isolation` sinh tự động cho mọi bảng theo cột `workspace_id`/`community_id`/`user_id` + `app.bypass`; API production chạy dưới role `hoiminh_app`. Biến phiên được đặt trong transaction của từng request/job (`withTenantScope`, `withSystemScope`). Thi hành là một bước vận hành riêng (`pnpm db:rls on`) chứ không nằm trong migration: bật sai thì truy vấn trả rỗng chứ không báo lỗi, nên phải bật khi có người theo dõi. Phạm vi lấy rộng (mọi workspace và hội có quan hệ, không lọc theo trạng thái thành viên) vì quyền thật do service layer quyết định; RLS là lớp chặn cuối.
20. **Handler sự kiện nhận ngữ cảnh của bên phát** (`meta.ctx`) thay vì dùng kết nối gốc, nếu không thì chúng nằm ngoài transaction của request: trên Postgres là không thấy biến phiên, trên PGlite (một kết nối) là khóa chết. Cùng lý do, `AuthProvider` nhận executor của request.
21. **CSRF:** API dùng Bearer token trong header, không dùng cookie phiên, nên không cần CSRF token; cookie `hm_ref/hm_vid` chỉ là attribution.
22. **Rate limit** ở edge do Cloudflare (WAF rules) là chính; API có cửa sổ trượt trong bộ nhớ cho đăng nhập/đăng ký/webhook/đăng bài.
23. **Doanh thu chủ hội "Có thể rút"**: V1 không có API rút tiền chủ hội tự động (tiền về tài khoản Hội Mình rồi chuyển theo yêu cầu); màn Thanh toán hiển thị số dư/đang giữ 14 ngày và hướng dẫn liên hệ.
24. **Tin nhắn "Tài nguyên"** trong sidebar là tab ẩn mặc định (mục 191 cho phép hiện/ẩn), dẫn tới thư viện khóa học.
