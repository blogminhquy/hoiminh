---
description: Rà soát toàn dự án tìm phần chưa triển khai hoặc trông như xong mà không chạy, rồi triển khai nốt
---

Rà soát toàn bộ dự án Hội Mình, tìm những phần **chưa triển khai** hoặc **trông như đã xong nhưng thực tế không chạy**, rồi triển khai nốt.

## Nguyên tắc quan trọng nhất

**Không tin bất kỳ tài liệu nào trong repo nói rằng một phần đã xong.** `docs/PROGRESS.md`, `CHANGELOG.md` và các dấu ✅ trong đó là tuyên bố của phiên làm việc trước, không phải bằng chứng. Mỗi lần trước đây đều có thứ được đánh dấu xong nhưng thật ra hỏng:

- RLS có đủ 89 policy, nhưng service layer không hề gọi `set_config` cho `app.user_id` / `app.workspace_ids` / `app.community_ids` → policy chưa bao giờ có tác dụng.
- API Hono đầy đủ route, nhưng Worker nổ ngay lúc khởi động vì `fileURLToPath(import.meta.url)` ở cấp module → chưa từng deploy lên Cloudflare được.
- Sau khi deploy được thì API vẫn 500 ngắt quãng vì cache kết nối Postgres giữa các request.
- Màn "Tài khoản" tồn tại, nhưng người chưa vào hội nào bị `AppShell` đá về Khám phá → không mở nổi.
- Không hề có endpoint đổi mật khẩu, dù giao diện ghi "xác thực hai lớp trong Tài khoản".

**Kết luận: kiểm bằng cách chạy, không phải bằng cách đọc.** Một phát hiện chỉ được ghi vào báo cáo khi có bằng chứng — kết quả lệnh, mã HTTP, ảnh chụp màn hình, hoặc test đỏ.

## Nguồn đối chiếu

Theo thứ tự ưu tiên khi hai nguồn mâu thuẫn:

1. `PLATFORM_ARCHITECTURE_V1_5_SIMPLE_SALES_UX.md` — nguồn sự thật về nghiệp vụ.
2. `design/hoi-minh-demo.html` — 50 màn hình, là chuẩn giao diện.
3. `DECISIONS.md` — những gì đã chốt là làm hay không làm.
4. `docs/PROGRESS.md` — chỉ dùng làm bản đồ để biết chỗ nào mà tìm, **không** dùng làm bằng chứng.

## Bốn tầng cần soi

Với mỗi khối nghiệp vụ (hội, thành viên, bài viết, khóa học, sự kiện, cửa hàng, thanh toán, entitlement, cộng sự, rút tiền, tin nhắn, thông báo, gói nền tảng, quản trị hệ thống, API key, webhook gửi đi, MCP):

1. **Có trong tài liệu mà không có trong code.** Tính năng được mô tả nhưng không tìm thấy nơi cài đặt.
2. **Có trong code mà không nối vào đâu.** Service viết rồi nhưng không route nào gọi; route có nhưng không màn nào gọi; nút bấm có nhưng `onClick` rỗng; trang có nhưng không link nào trỏ tới; chữ "sắp có" / "coming soon" / `TODO` / `disabled` nằm trên tính năng lẽ ra phải chạy.
3. **Có nối nhưng không chạy trên môi trường thật.** Chạy được ở local với PGlite không chứng minh được gì — Cloudflare Workers và Supabase khác hẳn. Phải thử trên production.
4. **Có chạy nhưng không ai kiểm.** Luồng tiền, phân quyền, idempotency webhook mà không có test là nợ kỹ thuật, ghi vào báo cáo.

## Cách kiểm trên môi trường thật

Bắt buộc, không được bỏ qua:

- Mở `https://hoiminh.com` bằng công cụ trình duyệt, đăng nhập bằng tài khoản quản trị thật và **đi hết từng luồng như người dùng**: tạo hội, đăng bài, tạo khóa học, tạo sự kiện, thêm sản phẩm, đặt giá, mời thành viên, checkout, xem `/he-thong`.
- Mỗi màn: mở được không, có gọi API không, có báo lỗi ở console không, lưu có thật sự lưu không.
- Gọi thẳng `https://api.hoiminh.com` cho các endpoint không có giao diện.
- Xem log Worker bằng `wrangler tail` khi nghi ngờ — lỗi 500 thường không hiện gì trên giao diện.
- Kiểm cả trên màn hình hẹp 390px, vì thiết kế cam kết responsive.

## Những chỗ đã biết là còn thiếu

Đừng tốn thời gian tìm lại, nhưng **phải kiểm chứng lại mức độ hỏng** rồi xử lý:

- **R2 chưa cấu hình** → `packages/media` rơi về lưu trên đĩa, mà Worker không có đĩa nên mọi thao tác tải ảnh/video hỏng. Đây nhiều khả năng là lỗi chặn nghiêm trọng nhất còn lại.
- **Resend chưa cấu hình** → toàn bộ email (xác minh, mời, nhắc sự kiện, hoàn tiền, hoa hồng) chỉ ghi log.
- **RLS chưa có tác dụng** (xem trên). Quyết định: hoặc làm cho nó chạy thật, hoặc gỡ bỏ và ghi rõ lý do — đừng để một lớp bảo mật giả.
- **Cổng thanh toán chưa có credential thật**, đang chạy sandbox.
- **Xác thực hai lớp** ghi "sắp có" trong màn Tài khoản.
- **Giao diện tối** ghi "Tối · sắp có" trong nav Tài khoản.
- Việc V2 theo kiến trúc: tin nhắn thời gian thực, phát trực tiếp, dashboard cho người mua lẻ ngoài hội.

## Ràng buộc kỹ thuật phải tuân thủ

- **Cloudflare Workers**: không cache kết nối Postgres (hay bất cứ thứ gì giữ socket) ở cấp module — Workers cấm dùng lại I/O giữa các request. Không đụng hệ tệp ở cấp module (`import.meta.url`, `fileURLToPath`). Kết nối DB đi qua binding `HYPERDRIVE`.
- Deploy: `pnpm --filter @hoiminh/api run deploy` và `pnpm --filter @hoiminh/web run deploy` — thiếu chữ `run` thì pnpm hiểu nhầm là lệnh của nó.
- **GitNexus chưa index dự án này** (MCP đang gắn với repo khác). Đừng gọi `impact` / `detect_changes`, dùng `grep` và `Glob`.
- Trước khi commit: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` phải xanh hết.
- Mỗi phần việc một commit riêng kèm mô tả **vì sao**, không gộp thành một commit khổng lồ.
- Đổi schema thì phải sinh migration (`pnpm db:generate`) rồi chạy trên Supabase, không sửa tay database.

## Cách làm việc

**Bước 1 — Rà soát và báo cáo trước.** Đừng sửa gì cho tới khi có bảng đầy đủ. Mỗi dòng gồm: phần nào, thuộc tầng nào trong bốn tầng trên, bằng chứng cụ thể, mức nghiêm trọng, ước lượng công.

Xếp theo thứ tự:
1. **Chặn người dùng thật** — có người dùng là hỏng ngay.
2. **Trông như xong mà hỏng** — nguy hiểm nhất vì không ai biết.
3. **Chưa làm nhưng tài liệu cam kết có.**
4. **Thiếu test ở chỗ có tiền hoặc có phân quyền.**
5. **Nice-to-have.**

**Bước 2 — Triển khai.** Tự làm thẳng những phần đã rõ ràng: lỗi, thiếu endpoint, thiếu màn, thiếu test, chỗ nối hỏng. Với những phần cần quyết định sản phẩm (chọn cách làm), tốn tiền (mua dịch vụ), hoặc đụng tới tiền thật của người dùng — **dừng lại hỏi trước**, đừng tự quyết.

**Bước 3 — Kiểm chứng.** Mỗi phần làm xong phải thử lại trên production và ghi bằng chứng. Cập nhật `docs/PROGRESS.md` và `CHANGELOG.md` theo đúng những gì đã **kiểm chứng được**, không phải theo những gì đã viết code.

Nếu phát hiện điều gì mâu thuẫn với chính bản hướng dẫn này, cứ nói ra — nó được viết dựa trên hiểu biết tại một thời điểm và có thể đã cũ.
