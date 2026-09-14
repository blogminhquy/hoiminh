# Hội Mình

Nền tảng cộng đồng, khóa học và thanh toán cho người dạy và người bán tại Việt Nam, kiểu Skool nhưng thu tiền bằng chuyển khoản QR, MoMo, VNPAY và không thu phí giao dịch.

Kho này hiện chứa **tài liệu kiến trúc, bộ thiết kế giao diện và prompt triển khai**. Mã nguồn sản phẩm sẽ được xây từ chính các tài liệu này. Mọi người đều có thể góp ý và đóng góp.

## Có gì trong kho

| Đường dẫn | Nội dung |
|---|---|
| `PLATFORM_ARCHITECTURE_V1_5_SIMPLE_SALES_UX.md` | Kiến trúc và nghiệp vụ, 202 mục: multi-tenant, thanh toán qua adapter, entitlement, affiliate chi trả thủ công, pricing mode, plugin, cửa hàng, xếp hạng cộng sự, gói nền tảng. Mục có số lớn hơn thắng khi mâu thuẫn. |
| `design/hoi-minh-demo.html` | Demo giao diện 50 màn hình, mở thẳng bằng trình duyệt, bấm chuyển màn hình được. Chia theo ba vai trò: quản trị hệ thống, chủ hội, thành viên. |
| `design/build.mjs` | Nguồn của bộ thiết kế: token màu, font, icon, markup từng màn hình. Chạy `node design/build.mjs` để dựng lại demo. |
| `design/*.dc.html` | Từng màn hình dưới dạng artboard. |
| `design/icons/` | Icon Lucide (giấy phép ISC) được nhúng vào thiết kế. |
| `PROMPT_BUILD_HOIMINH.md` | Prompt chi tiết để AI hoặc đội kỹ sư triển khai toàn bộ mã nguồn theo đúng kiến trúc và thiết kế. |

## Xem demo

Tải `design/hoi-minh-demo.html` và mở bằng trình duyệt. Cần mạng để tải font Google. Chuyển màn hình bằng menu ở thanh trên, phím mũi tên, hoặc bấm vào thanh bên, biểu tượng tin nhắn, thông báo, avatar và các nút trong màn hình.

## Ba vai trò

- **Quản trị hệ thống**: quản lý hội, người dùng, cổng thanh toán, đối soát, gói nền tảng, cộng sự nền tảng.
- **Chủ hội**: tạo nhiều hội, cài đặt giá và gói, khóa học, sự kiện, thành viên, nhận tiền, doanh thu, duyệt rút tiền cho cộng sự.
- **Thành viên**: miễn phí hoặc trả phí, học, đăng bài, sự kiện, mua trong cửa hàng, làm cộng sự.

## Quyết định lớn đã chốt

- PostgreSQL trên Supabase, Cloudflare Pages và Workers, R2 cho tệp, video chỉ nhúng ngoài, Resend cho email hệ thống.
- Không thu phí giao dịch. Một gói nền tảng duy nhất cho chủ hội, trả theo tháng hoặc năm, dùng thử 14 ngày.
- Affiliate ở cả hai tầng chi trả thủ công: người chi trả chuyển khoản ngoài hệ thống rồi ghi mã tham chiếu, hệ thống giữ sổ cái bất biến.
- Bảng xếp hạng cộng sự thay cho bảng xếp hạng hoạt động.
- Không xây landing page builder; trang bán theo trường cố định.

## Đóng góp

Xem `CONTRIBUTING.md`. Góp ý về kiến trúc, thiết kế hoặc nghiệp vụ đều mở issue hoặc pull request. Dữ liệu, tên, số liệu trong demo là dữ liệu mẫu.

## Giấy phép

MIT. Icon Lucide theo giấy phép ISC của dự án Lucide.
