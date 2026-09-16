# CHANGELOG

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
