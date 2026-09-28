# DECISIONS.md — Quyết định khi triển khai Hội Mình

Ghi lại các điểm kiến trúc chưa nói rõ và cách đã chọn (phương án đơn giản nhất), theo yêu cầu của prompt triển khai. Số mục tham chiếu tới `PLATFORM_ARCHITECTURE_V1_5_SIMPLE_SALES_UX.md`.

## Hạ tầng và chạy local

1. **PGlite cho local và test, PostgreSQL (Supabase) cho production.** `DATABASE_URL=pglite://./.data/hoiminh` là mặc định để `pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev` chạy từ máy sạch không cần cài Postgres. Cùng một bộ migration SQL (drizzle-kit) chạy trên cả hai. Lớp `raw()` trong core chuẩn hóa kết quả `execute()` giữa hai driver.
2. **API chạy trên Node khi dev, trên Cloudflare Workers khi deploy.** Hono là runtime-agnostic: `apps/api/src/node.ts` (tsx, cron bằng `setInterval`, hàng đợi in-memory) và `apps/api/src/worker.ts` (Queues + Cron Triggers). Cùng một `createHonoApp()`.
3. **Auth: hai provider cùng interface.** `AUTH_PROVIDER=local` (dev/test, PBKDF2 trong bảng `user_credentials`) và `AUTH_PROVIDER=supabase` (Supabase Auth giữ mật khẩu + Google OAuth qua GoTrue REST, service role để đổi mật khẩu). Phiên đăng nhập luôn là JWT HS256 do API ký + refresh token băm trong `auth_sessions`, để web/MCP không phụ thuộc token Supabase. Xác minh email bằng mã 6 số do API sinh (khớp màn hình OTP), gửi qua Resend.
4. **Media:** ba provider cùng interface. Trên Worker dùng **binding R2** (`R2BindingProvider`): tệp đi qua API theo URL ký HMAC rồi vào bucket, không cần secret, không cần CORS cho bucket; đủ 4 biến `R2_*` thì chuyển sang S3 tải thẳng (tệp lớn); dev dùng `LocalMediaProvider` ghi `.data/files`. Chọn binding làm mặc định vì đó là cách rẻ nhất để tải tệp *chạy thật* trên production (20/09: avatar tải ngày 16/09 đã mất vì provider local trên Worker không có đĩa).
5. **Email:** `RecordingSender` bọc bộ gửi thật và ghi `email_logs` cho mọi lần gửi, ghi bằng kết nối gốc và không chờ (chờ trong transaction của request trên PGlite là khóa chết), `App.close()` chờ flush. Không có `RESEND_API_KEY` thì bộ gửi trong là `LogSender`; test đọc outbox này. Quản trị kiểm chứng bằng "Gửi email thử".
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
22. **Rate limit** bằng Rate Limiting binding của Cloudflare (bộ đếm chung, `[[ratelimits]]`), bốn nhóm api/auth/write/webhook; ở Node và test rơi về bộ đếm trong bộ nhớ. Đếm theo tài khoản/phiên khi có, theo IP chỉ với khách vãng lai, vì mạng di động dùng chung IP (CGNAT). Bộ đếm của binding tính theo từng vùng Cloudflare và gần đúng, đủ để chặn spam; muốn chặn tuyệt đối thì thêm quy tắc WAF ở dashboard.
23. **Doanh thu chủ hội "Có thể rút"**: V1 không có API rút tiền chủ hội tự động (tiền về tài khoản Hội Mình rồi chuyển theo yêu cầu); màn Thanh toán hiển thị số dư/đang giữ 14 ngày và hướng dẫn liên hệ.
24. **Tin nhắn "Tài nguyên"** trong sidebar là tab ẩn mặc định (mục 191 cho phép hiện/ẩn), dẫn tới thư viện khóa học.
25. **Migration trên Supabase chạy bằng vai trò `hoiminh_app`** (chủ sở hữu bảng). Role `postgres` của Supabase không sở hữu bảng nên `ALTER TABLE` từ dashboard hay MCP bị từ chối; đã `grant hoiminh_app to postgres` (20/09) để `set role hoiminh_app` được khi cần áp tay. Sau khi áp tay phải ghi hash + `when` của journal vào `drizzle.__drizzle_migrations` để `pnpm db:migrate` không chạy lại; migration viết idempotent (`IF NOT EXISTS`) phòng trường hợp quên.
26. **Chứng nhận hoàn thành không có bảng riêng**: đọc thẳng `course_progress.completed_at` + cờ `courses.certificate_enabled`, trang `/chung-nhan/:courseId/:userId` công khai. Mã chứng nhận là hash ổn định của (khóa, người), không lưu.
27. **Duyệt bài thành viên mới** là cột `posts.moderation_status` ('approved' | 'pending'), không phải bảng hàng đợi: bảng tin lọc theo cột, người kiểm duyệt thấy bài chờ ngay trong bảng tin và bấm Duyệt / Từ chối tại chỗ. Từ chối = xóa mềm + thông báo lý do.
28. **Sự kiện không có "tự đăng bản ghi"**: không có nguồn nào để tự lấy bản ghi (Zoom/Meet không nối), nên công tắc bị bỏ khỏi giao diện; người tổ chức dán link bản ghi ở trang sự kiện. Cột `auto_publish_recording` vẫn còn trong schema, không đọc.
29. **Hai Worker thay vì ba**: `hoiminh-api` phục vụ cả giao diện (Worker static assets, file tĩnh không chạy code) lẫn API trên cùng tên miền, nên web và API luôn cùng phiên bản, bỏ được CORS và sau này dùng được cookie httpOnly. Cron và hàng đợi nằm ở `hoiminh-jobs` để việc nặng không chiếm tài nguyên của request người dùng. Chỗ nghẽn khi đông người là database, không phải số Worker. Giữ tên `hoiminh-api` để không mất secret đã đặt.
30. **Email gửi sau commit, không qua hàng đợi**: `runInScope` bọc bộ gửi bằng `DeferredSender`, gửi ngay sau khi transaction commit, vẫn trong request. Không đưa sang hàng đợi vì email xác minh và đặt lại mật khẩu phải tới ngay, và hàng đợi thêm một chỗ có thể trễ hoặc mất. Cái cần tránh chỉ là giữ kết nối database trong lúc chờ Resend.
31. **Cache công khai ngắn (60 giây) thay vì xóa cache khi sửa**: chỉ khách chưa đăng nhập nhận bản cache, nên chủ hội sửa xong thấy ngay. Không cần cơ chế xóa cache theo sự kiện, đổi lại khách vãng lai có thể thấy bản cũ tối đa một phút.
