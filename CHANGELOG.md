# CHANGELOG

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
