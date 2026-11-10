# CHANGELOG

## 1.18.0 - 2026-11-10

Đợt B của việc gom phần quản trị: chủ hội mở app là thấy Bàn điều khiển, phần quản lý gom từ 15 mục ở hai khung về 4 chỗ (Bàn điều khiển, Tiền, Cộng sự, Cài đặt).

### Tính năng

- **Bàn điều khiển thay trang Hôm nay cho chủ hội và quản trị** (`/:slug/hom-nay`). Một màn trả lời ba câu: có gì cần xử lý, hội đang chạy thế nào, tiền đang ở đâu. Mục "Cần xử lý" gom yêu cầu rút của cộng sự, người chờ duyệt vào hội, bài chờ duyệt và gói Hội Mình sắp hết hạn (còn từ 7 ngày trở xuống); không có gì thì ghi rõ "Mọi việc đã xong". Số liệu, biểu đồ doanh thu, danh sách hoàn thiện hội và hoạt động gần đây chuyển từ Cài đặt, Tổng quan về đây. Thành viên thường vẫn thấy trang Hôm nay như cũ.
- **Trang Tiền** (`/:slug/tien`) gom Doanh thu và Cài đặt, Thanh toán: số dư có thể rút, đang giữ, đã rút tháng này, nút Rút tiền, rồi số liệu theo kỳ và bảng giao dịch (hoàn tiền, xuất CSV).
- **Trang Cộng sự** (`/:slug/cong-su`) mở thẳng hàng đợi yêu cầu rút hoa hồng, việc chủ hội làm hằng ngày với cộng sự. Mức hoa hồng (việc đặt một lần) nằm ở Cài đặt.
- **Cài đặt còn 4 nhóm thay cho 10 mục**: Hội (thông tin, bảng tin và chuyên mục), Bán hàng (giá và gói), Cộng sự (mức hoa hồng), Tự động và kết nối (tiện ích, nhà phát triển). Trên điện thoại `/cai-dat` là danh sách 4 nhóm lớn, vào trong có nút quay lại.
- **Điện thoại**: tab đầu của thanh dưới thành "Quản lý" cho chủ hội, có ô lối tắt tới Thành viên, Tiền, Cộng sự, Cài đặt. Chạm tên hội ở đầu trang để chuyển hội (trước đây chỉ máy tính chuyển được).
- **Chủ hội đăng nhập xong vào thẳng Bàn điều khiển** của hội mình (trước: trang "Hội của tôi"). Đăng nhập bằng Google và đặt lại mật khẩu cũng theo cùng quy tắc.

### Thay đổi

- Thanh bên máy tính của chủ hội: "Bàn điều khiển" ở đầu, nhóm "Quản lý" gồm Tiền, Cộng sự, Cài đặt (trước: nhóm "Quản trị" gồm Cài đặt, Doanh thu).
- Khung "Hội của tôi" chỉ còn hai mục ở đầu trang: Hội của tôi và Tài khoản. Nhà phát triển chuyển vào Cài đặt của hội, Khám phá nằm trong bảng chuyển hội.
- Bỏ các mục trùng trong Cài đặt: Tổng quan (đã thành Bàn điều khiển), Khám phá, Mời thành viên, Thông báo. Bỏ bảng bật tắt cổng thanh toán ở trang Thanh toán vì trùng với phần "Cách khách thanh toán" trong Giá và gói.
- Đường dẫn cũ vẫn chạy: `/doanh-thu` và `/cai-dat/thanh-toan` chuyển sang `/tien`, `/cai-dat/cong-su/rut-tien` chuyển sang `/cong-su`.
- `/thanh-vien?trang-thai=pending` mở thẳng danh sách chờ duyệt.

### Sửa lỗi

- Trang yêu cầu rút của cộng sự tràn ngang ở khổ 820px (bốn ô số liệu bị ép vào một hàng).

## 1.17.1 - 2026-11-10

Đợt A của việc gom phần quản trị: sửa các lỗi tìm thấy khi rà soát 31 màn của chủ hội và quản trị hệ thống.

### Sửa lỗi

- **Trang Hội của tôi luôn ghi doanh thu 30 ngày là 0đ.** Truy vấn con so `community_id` với nhầm cột (Drizzle bỏ tên bảng khi chỉ select một bảng), nên không đơn nào khớp. Hội mẫu có 9.187.000đ trong 30 ngày vẫn hiện 0đ. Nay tính bằng một truy vấn gom nhóm, có test đối chiếu với trang Tổng quan.
- **Mục "Mời thành viên" trong Cài đặt bấm vào không mở gì.** `/thanh-vien?moi=1` nay mở sẵn khung mời.
- **Chủ hội trên điện thoại không có lối vào Cài đặt và Doanh thu của hội.** Trang Tôi có thêm hai mục này cho người có quyền.
- **Trang Hội của tôi, Nhà phát triển, Tạo hội tràn ngang trên điện thoại** (522px trên màn 390px) vì thanh mục ở đầu trang xuống dòng. Trang Nhật ký của quản trị hệ thống cũng tràn (509px).
- **Quản trị hệ thống đăng nhập xong bị đưa về trang Khám phá.** Nay vào thẳng khu quản trị khi tài khoản không có hội nào.
- Trang Hôm nay: nút "Học tiếp" bị cắt chữ khi tên bài dài.

## 1.17.0 - 2026-11-10

Giao diện "Sáng và rõ" trên máy tính: chữ dễ đọc, thanh bên chia nhóm như điện thoại, hết tràn ngang ở máy tính nhỏ.

### Giao diện

- **Chữ trên máy tính.** Không chữ nào dưới 14px, chữ nội dung 16px, nút và ô nhập cao 44px (trước: chữ nền 14px, nút 40px). Đo ở khổ 1360px trên 37 màn hình của thành viên, chủ hội và quản trị: trước đây 26 màn có hơn nửa lượng chữ nhỏ hơn 14px (cao nhất 83%); nay cao nhất là 17% và 34 màn từ 10% trở xuống, phần còn lại chủ yếu là tiêu đề cột viết hoa 13px.
- **Thanh bên** chia theo đúng nhóm của điện thoại: Hôm nay, Hội (Bảng tin, Sự kiện, Thành viên, Xếp hạng cộng sự), Học (Khóa học, Cửa hàng). Thêm nút "Viết bài" ở cuối thanh bên.
- **Trang Hôm nay** chia hai cột: việc hôm nay và tiến độ bên trái, sự kiện và bàn luận bên phải.
- **Bài học**: tiêu đề và nút cùng một hàng, nội dung bài nằm dưới và rộng đủ đọc (trước đây bị hai nút bóp còn khoảng 240px). Giáo trình chỉ đứng cạnh nội dung từ 1024px; hẹp hơn thì thu thành dòng "Danh sách bài".
- Trong thẻ nền tối (gói VIP, Premium, Học tiếp), liên kết và dấu tích màu ngọc sáng lên để đọc được.
- Khung quản trị hệ thống dùng màu thanh bên theo bảng màu mới.

### Tính năng

- **Đăng xuất trên máy tính**: nằm cuối nav Tài khoản (bản điện thoại đã có ở 1.16.0).

### Sửa lỗi

- Trang Cài đặt giá tràn ngang (thẻ VIP bị đẩy ra ngoài màn hình) ở mọi máy tính.
- Ở máy tính nhỏ (1024px) tràn ngang ở Bài học, Tài khoản / Cộng sự, Cài đặt tổng quan, Cài đặt cộng sự; ở 820px thêm Tin nhắn, Tạo sự kiện và mọi trang của chủ hội, quản trị do ô tìm kiếm ở đầu trang có bề rộng cố định.
- Ô tìm kiếm của khung quản trị bị vỡ (biểu tượng nằm trên dòng chữ).
- Nút "Đăng ký" ở dòng sự kiện lúc cùng hàng lúc xuống dòng.
- Trang Khám phá trên điện thoại lệch 10px ở đầu trang.

## 1.16.0 - 2026-11-09

Đợt 2 của trải nghiệm thành viên trên điện thoại: điều hướng gọn lại và trang Hôm nay.

### Tính năng

- **Trang Hôm nay** (`/:slug/hom-nay`), trang đích sau đăng nhập. Ba việc nhỏ trong ngày (ghé hội, học một bài, sự kiện hôm nay hoặc góp ý một bài) với dấu đã xong lấy từ dữ liệu thật; tiến độ khóa đang học nói bằng lời ("còn 4 bài, khoảng 30 phút là xong phần 1"); sự kiện sắp tới; bài đang được bàn luận. API mới `GET /v1/communities/:id/today` đếm bài học xong, bình luận và bài đăng trong ngày theo giờ Việt Nam.
- **Thanh dưới mới trên điện thoại**: Hôm nay, Học, nút viết bài, Hội, Tôi. Nhóm Hội có hàng tab con Bảng tin, Sự kiện, Thành viên, Xếp hạng; nhóm Học có Khóa học, Cửa hàng. Trước đây Sự kiện, Thành viên và Xếp hạng không có lối vào trên điện thoại.
- **Tìm kiếm trên điện thoại**: nút kính lúp ở đầu trang mở ô tìm trong bảng tin (trước đây ô tìm bị ẩn).
- **Trang Tôi** trên điện thoại là danh sách mục lớn: hồ sơ, thông báo, tin nhắn, khóa đã mua, cộng sự, gói và thanh toán, hội của tôi, giao diện. Các trang con có lối quay lại.
- **Nút Đăng xuất.** Trước đây không màn nào có.

### Sửa lỗi

- Ô tìm kiếm ghi "Tìm bài viết, khóa học, thành viên" nhưng chỉ lọc bài của bảng tin. Nay ghi đúng "Tìm trong bảng tin".
- Khu học tập (`/hoc`) của người đang ở trong hội mà chưa mua lẻ gì là một trang trống dù họ đang học khóa theo gói. Nay chỉ đường sang khóa học của từng hội. Đầu trang ở đây cũng không còn tràn ngang trên điện thoại.
- Giờ sự kiện dùng gạch nối thường ("20:00 - 21:30").

## 1.15.0 - 2026-11-09

Đợt 1 của việc làm lại trải nghiệm thành viên trên điện thoại: giao diện "Sáng và rõ", chữ dễ đọc, hết tràn ngang, bài học và đăng bài gọn lại.

### Giao diện

- **Bảng màu và bộ chữ mới.** Nền sáng, ngọc đậm là màu chính, cam chỉ dùng cho thứ cần chú ý, vàng cho Premium; một bộ chữ Be Vietnam Pro thay cho Montserrat và Open Sans. Giao diện tối đổi theo. Mọi cặp chữ trên nền đạt tương phản từ 4,5 (trước: nút chính 3,91, chữ mờ 3,34).
- **Chữ trên điện thoại.** Nội dung 16px, không chữ nào dưới 14px, nút và ô nhập cao từ 44px. Đo trên 22 màn hình của thành viên: phần chữ nhỏ hơn 14px giảm từ 31 đến 79% xuống còn 0 đến 3%.
- Hàng chip lọc ở Bảng tin, Khóa học, Cửa hàng là một hàng vuốt ngang trên điện thoại, không còn chiếm hai hàng.

### Bài học

- **Điện thoại: video lên đầu.** Trước đây phải cuộn qua cả danh sách bài mới tới video. Nay giáo trình thu thành dòng "Danh sách bài", bấm mới mở. Nút "Xong bài, sang bài tiếp" ghim ở đáy màn hình.

### Đăng bài

- **Khung soạn gọn lại**: ô viết, nút Ảnh, nút Đăng. Chuyên mục được chọn sẵn (mục đang xem, mục đăng lần trước, hoặc "Chia sẻ") và vẫn đổi được. Tiêu đề, nền màu, video, bình chọn, link và gửi email nằm sau nút "Thêm".
- Bỏ ba thứ không có tác dụng: chip "Mọi thành viên" (không bấm được), nút "Nhắc tên" (chỉ chèn ký tự @), nút "Đính kèm" (trùng nút Ảnh).

### Sửa lỗi

- **Ba trang tràn ngang trên điện thoại**: Thành viên (rộng 1.031px trên màn 390px), Tài khoản / Gói và thanh toán, Tài khoản / Cộng sự. Nội dung bị cắt và thanh tab trôi khỏi màn hình.
- Trang Khóa học ghi "đang học 0" ngay trên thẻ Học tiếp: khóa Premium đang học phần miễn phí bị xếp vào "Chưa mở". Nay đếm theo tiến độ thật.
- Số bài bị lặp ("1.2 1.2 Ba con số") khi tên bài đã tự có số.
- Xếp hạng cộng sự trên điện thoại hiện hạng 2 trước hạng 1.
- Giao diện tối: ảnh đại diện ở đầu trang là chữ trắng trên nền trắng.

## 1.14.1 - 2026-11-09

Đưa bản mới lên Cloudflare nhanh hơn và biết chắc trang thật đã chạy đúng bản đó.

### Deploy

- **Kiểm tra song song.** Typecheck, lint và test trước đây chạy nối tiếp trên một máy (gần 4 phút trong tổng 5 phút mỗi lần deploy). Nay chạy song song trên ba máy, cả ba xanh mới deploy. Hai Worker deploy trong cùng một job nên chỉ cài thư viện một lần.
- **Hỏi thẳng trang live sau khi deploy** (`infra/verify-live.mjs`): `/health` phải báo `ok` đúng số phiên bản, `/version.json` phải đúng commit vừa đẩy; hỏi lại mỗi 5 giây, tối đa 2 phút. Không khớp thì lần deploy báo đỏ thay vì xanh. Trước đây wrangler báo xong là coi như xong, nên từng có 4 lần deploy hỏng liên tiếp mà trang vẫn ở bản cũ.
- **Tóm tắt bằng tiếng Việt** ở trang của mỗi lần chạy: bản nào đã lên, hoặc dừng ở bước nào và trang live đang ra sao, kèm chỗ bấm Cập nhật hay Quay lui.
- **Migration.** Có secret `DATABASE_DIRECT_URL` trong GitHub thì workflow tự áp migration trước khi deploy. Chưa có thì cảnh báo rõ khi bản đang đẩy kèm migration mới, thay vì im lặng.
- `pnpm deploy` (deploy tay) in từng bước và cũng hỏi trang live ở cuối; thêm `--skip-verify`. Lệnh mới `pnpm deploy:check` chỉ hỏi trang live.

### Sửa lỗi

- `pnpm dev` dừng ngay trên máy sạch vì kéo theo `hoiminh-jobs` (wrangler đòi chuỗi kết nối Postgres cho Hyperdrive), trái với README. Nay `pnpm dev` chỉ chạy API và web như mô tả (API bản Node tự chạy cron); cần thử Worker jobs thì `pnpm dev:jobs`.

## 1.14.0 - 2026-10-21

Khu học tập cho người mua lẻ và link phòng họp sự kiện, chuyển từ PR #1 (phần còn giá trị) sang nền mới.

### Tính năng

- **Khu học tập `/hoc`.** Người chỉ mua khóa học hoặc tài liệu mà không tham gia hội nào giờ có chỗ học riêng: danh sách khóa và tài liệu đã sở hữu (mua lẻ, combo, gói, được tặng), tiến độ, nút học tiếp. API `GET /v1/me/library`. Bài học `/hoc/bai/:id` dùng chung trang với `/:slug/bai/:id`.
- **Mua lẻ không còn tự thêm vào hội.** Trước đây người mua bị đưa vào hội làm thành viên Tiêu chuẩn chỉ để có chỗ học, làm lệch số thành viên. Nay hội miễn phí đang mở cửa chỉ hiện lời mời để họ tự chọn.
- Sau khi thanh toán, người không phải thành viên được đưa về `/hoc` (trang trạng thái đơn, email, thông báo). Trang gốc `/` đưa người có 0 hội vào `/hoc`; người có 0 hội vẫn xem được hóa đơn ở `/tai-khoan/goi`.
- **Link phòng họp hiện ngay khi đăng ký sự kiện**, bỏ cửa "15 phút trước giờ" (danh sách sự kiện vốn đã trả link ngay, nên cửa này chỉ làm người đăng ký sớm tưởng lỗi). Link tùy chọn hiện nhãn "Phòng họp riêng".

### Sửa lỗi

- Danh sách sự kiện trả link phòng họp cho cả người **đã hủy** đăng ký. Nay chỉ người đang đăng ký và chủ hội thấy.

## 1.13.0 - 2026-10-21

Tin nhắn và thông báo thời gian thực bằng Durable Objects, thay cho việc mỗi trình duyệt hỏi máy chủ mỗi 15 giây.

### Hiệu năng

- **Bỏ polling 15 giây.** Trước đây mỗi người mở web hỏi số chưa đọc mỗi 15 giây, mở trang tin nhắn thì thêm danh sách hội thoại và nội dung hội thoại, cũng mỗi 15 giây. Đông người thì đây là tải database lớn nhất. Nay chỉ hỏi định kỳ khi kênh thời gian thực bị mất.
- **Durable Object `RealtimeHub`**, mỗi người dùng một hub (`idFromName(userId)`), giữ WebSocket của mọi tab và thiết bị (tối đa 20, quá thì đóng kết nối cũ nhất). Dùng WebSocket Hibernation nên kết nối im lặng không tốn phí chạy; ping 30 giây được Cloudflare tự trả "pong" mà không đánh thức hub.
- Có tin nhắn mới (`message.sent`) hay thông báo mới (`notify`) thì đẩy sự kiện tới hub của người nhận, **sau khi transaction commit** (giống email và hàng đợi): thao tác bị hủy thì không báo, nhiều thông báo cho cùng người trong một transaction chỉ báo một lần. Sự kiện chỉ nói "có gì mới ở đâu", không mang nội dung.
- `hoiminh-jobs` cũng đẩy được (binding trỏ sang class của `hoiminh-api`), nên thông báo từ cron (nhắc sự kiện, hoa hồng) hiện ngay.

### Bảo mật

- `/v1/realtime` cần đăng nhập (cookie phiên), chỉ nhận Origin của chính web (chặn cross-site WebSocket hijacking), mỗi người chỉ vào được hub của mình.

### Triển khai

- Lần đầu có Durable Object phải deploy bằng `wrangler deploy` (migration `v1-realtime`), không qua `wrangler versions upload`. Nếu đang để `RELEASE_MODE=manual` thì tạm bỏ biến đó cho lần deploy này.
- Chạy dev bằng Node (không có Durable Object): `/v1/realtime` trả 501, web tự quay về hỏi định kỳ như trước.

## 1.12.0 - 2026-10-20

Đăng nhập chuyển sang cookie httpOnly: token phiên không còn nằm trong localStorage, nên mã độc lọt vào trang (XSS) không lấy cắp được phiên để dùng ở nơi khác.

### Bảo mật

- **Cookie phiên httpOnly**: `hm_at` (token truy cập, Path=/) và `hm_rt` (token làm mới, chỉ gửi kèm `/v1/auth`), `SameSite=Lax`, `Secure` trên https. Thêm cờ `hm_li=1` không chứa bí mật để web biết có nên hỏi `/v1/me`; khách chưa đăng nhập không gọi gì thêm.
- **Chống CSRF**: request ghi (POST/PUT/PATCH/DELETE) dùng cookie phải có Origin (hoặc Referer) là chính web hoặc tên miền API, nếu không trả 403. Đây là lớp thứ hai sau SameSite=Lax.
- Web gửi `X-HM-Auth: cookie` nên nhận cookie và JSON không chứa token. Ứng dụng khác (API key, MCP, app sau này) không gửi header đó nên vẫn nhận token trong body và gọi bằng `Authorization: Bearer` như cũ.
- **Người đang đăng nhập không bị đăng xuất**: lần mở web đầu tiên sau khi cập nhật, phiên cũ trong localStorage được đổi sang cookie rồi xóa khỏi localStorage.
- Cache trang công khai và bộ giới hạn số lần gọi nhận ra người đăng nhập bằng cookie (trước đây chỉ nhìn header `Authorization`, nếu không sửa thì người đăng nhập sẽ nhận nhầm bản cache của khách).
- Đường máy-với-máy (webhook, trang mô phỏng, link cộng sự, tệp) bỏ qua cookie phiên.

### Kiểm tra

- 6 test API (cookie httpOnly, token trong body cho ứng dụng ngoài, CSRF, làm mới bằng cookie và đổi phiên cũ, cache, CORS), 3 test web, và e2e kiểm sau mỗi lần đăng nhập rằng JavaScript không thấy token.

## 1.11.1 - 2026-10-01

Lịch cron lạ không còn chạy nhầm bộ quét và xếp hạng. Phát hiện ngay sau khi gỡ cron phút ở 1.11.0.

### Sửa lỗi

- **Trigger cron cũ còn sót chạy nhầm việc nặng.** Sau khi gỡ `* * * * *` khỏi `wrangler.toml`, Cloudflare vẫn bắn trigger cũ thêm vài phút (API báo chỉ còn hai lịch, nhưng scheduler còn giữ bản cũ). `worker.ts` gán mọi lịch khác `0 18 * * *` cho `every_10_minutes`, nên bộ quét và chụp xếp hạng chạy mỗi phút trong lúc đó. Nay `cronNameFor` chỉ nhận đúng `*/10 * * * *` và `0 18 * * *`; lịch lạ chỉ ghi `cron.unknown_schedule` rồi bỏ qua, không mở kết nối DB. Có test đối chiếu với `wrangler.toml`.

### Cần biết khi vận hành

- Lần sau gỡ hoặc đổi một lịch cron, trigger cũ có thể còn bắn thêm vài phút sau deploy (lần này ít nhất 8 phút). Từ 1.11.1 nó vô hại vì bị bỏ qua.

## 1.11.0 - 2026-10-01

Việc chạy nền chuyển sang theo sự kiện: không còn cron quét mỗi phút, việc hẹn giờ chạy đúng thời điểm bằng hàng đợi, và gửi email hàng loạt không còn gửi lặp khi retry. Thiết kế ở `docs/BACKGROUND_JOBS_SPEC.md`, quyết định ở DECISIONS.md #35.

### Thay đổi

- **Bỏ cron `* * * * *` của `hoiminh-jobs`.** Cron chỉ còn `*/10` (xếp hạng cộng sự và bộ quét thưa) và `0 18 * * *` (hằng ngày). Mỗi bước cron chạy trong transaction riêng: bước này lỗi không rollback bước khác.
- **Hàng đợi an toàn với transaction.** Message chỉ vào Queue sau khi transaction commit (`DeferredQueue`, cùng kiểu `DeferredSender` của email), rollback thì bỏ. `enqueue` nhận `delaySeconds` (0..86400). Consumer phân loại lỗi (vĩnh viễn thì bỏ, tạm thời thì retry lùi dần 1, 5, 15, 60 phút theo `msg.attempts`), có consumer cho `hoiminh-jobs-dlq`, và `max_concurrency = 10` để không dồn kết nối lên Postgres.
- **Webhook ra ngoài** thất bại thì tự hẹn lần sau bằng delay của Queue (lịch 1, 5, 30, 120, 720 phút). Khóa dòng `FOR UPDATE SKIP LOCKED` và bỏ qua message đến sớm nên hai message trùng chỉ POST một lần. Webhook đã tạm dừng thì delivery kết thúc hẳn thay vì bị đẩy lại mãi.
- **Nhắc sự kiện** được hẹn ngay khi tạo hoặc sửa sự kiện. Job cũ tự vô hiệu khi sự kiện bị huỷ, gỡ nhãn nhắc hoặc đổi giờ.
- **Nhắc sự kiện và email broadcast chia lô 100 người**, khử trùng từng người qua bảng `job_recipients` trong transaction của job. Các lô là dòng `scheduled_jobs` nên Queue lỗi cũng không bỏ sót ai.
- **Hết hạn đơn và trạng thái sự kiện (live, ended) tính khi đọc**, không chờ cron. Webhook thanh toán đến muộn vẫn được nhận và cấp quyền vì tiền đã vào.
- **Welcome DM và xóa tệp R2** đi qua `scheduleJob`: job vào Queue sau commit nên R2 được xóa sau vài giây thay vì chờ cron phút (vẫn an toàn vì message chỉ mang id và consumer đọc lại dòng `scheduled_jobs`).
- **Bộ quét thưa** (cron 10 phút) đẩy job hẹn giờ sắp tới hạn vào Queue, cứu tin bị mất (quá hạn 30 phút) và webhook bị lọt, và dọn cờ hết hạn đơn, trạng thái sự kiện.
- Cron hằng ngày thêm dọn bảng job (`job_recipients` 30 ngày, `scheduled_jobs` done 30 ngày, failed 90 ngày) và đối soát nhắc cho sự kiện trong 3 ngày tới.

### Sửa lỗi

- Nhắc sự kiện vẫn gửi cho sự kiện đã huỷ.
- Sửa giờ sự kiện trong vòng 25 giờ trước giờ diễn ra không dời lời nhắc (khóa khử trùng cũ giữ nguyên giờ cũ).
- Nhắc và broadcast gửi cả danh sách trong một message nên retry gửi lặp cho người đầu danh sách.
- Đơn quá hạn vẫn hiện `pending` cho tới lần cron kế tiếp, và giao diện Checkout cứ poll tiếp tới lúc đó.

### Kỹ thuật

- Migration `0004_background_jobs` (chỉ thêm): cột `scheduled_jobs.enqueued_at`, bảng `job_recipients` (có RLS), ba index một phần cho `events` và `orders`. Đã áp lên Supabase ngày 2026-09-30; `deploy.yml` không chạy migration nên lần phát hành nào có migration đều phải áp trước.
- Thêm khoảng 100 test cho `packages/core` (hàng đợi, consumer, job hẹn giờ, bộ quét, webhook ra ngoài, nhắc sự kiện, broadcast, hết hạn đơn, trạng thái sự kiện, dọn bảng, cấu hình cron). Trước đây chưa có test nào cho webhook ra ngoài.
- Tài liệu: `docs/BACKGROUND_JOBS_SPEC.md`, `docs/BACKGROUND_JOBS_ROLLOUT.md`.

### Cần biết khi vận hành

- Email Resend lỗi không được gửi lại (hành vi có từ trước); `max_concurrency = 10` có thể làm lộ rõ hơn nếu Resend giới hạn tốc độ thấp. Cách kiểm tra nằm trong tài liệu rollout.
- Job hết lượt retry bị đánh dấu `failed` và không tự chạy lại; hướng dẫn đặt lại `pending` nằm trong tài liệu rollout.
- Giai đoạn chạy song song 7 ngày giữa cron phút và Queue được bỏ theo quyết định của chủ dự án; production lúc đó còn rỗng (0 sự kiện, 0 đơn, 0 job).

## 1.10.0 - 2026-09-29

Avatar hiện đúng ảnh và bấm được, ảnh nén trước khi đăng, ảnh bài viết không còn bị cắt, và tệp trên R2 được dọn khi ảnh bị gỡ.

### Sửa lỗi

- **Avatar không hiện ảnh.** `Avatar` vẽ ảnh bằng `background: url(...)` rút gọn, làm mất `background-size: cover` và `background-position: center` của `.avatar`. Ảnh lớn (avatar thật là PNG 1254×1254, 2 MB) bị vẽ nguyên cỡ trong vòng tròn 40px và chỉ lộ góc trên-trái, nên thành một vòng tròn xám. Nay dùng `background-image` cộng `no-repeat`, URL đặt trong dấu nháy. Ảnh hưởng mọi nơi có avatar: header, bài viết, bình luận, thành viên, xếp hạng.
- **Avatar ở khung Quản trị hệ thống không bấm được.** Nay avatar ở cả bốn khung (quản trị hệ thống, hội, chủ hội, trang công khai) là một link dùng chung tới Hồ sơ (`/tai-khoan/ho-so`), có chú thích khi rê chuột. Trước đây ba khung có link nhưng dẫn tới ba nơi khác nhau (Gói và thanh toán, Hội của tôi, Hồ sơ).
- **Bài chỉ có một ảnh bị cắt và phóng to.** Khung cố định rộng hết thẻ, cao 360px cắt ảnh bằng `object-cover`, nên ảnh vuông mất gần nửa chiều cao. Nay ảnh hiện nguyên vẹn đúng tỷ lệ, cao tối đa 360px, khung có sẵn tỷ lệ nên trang không nhảy khi ảnh tải xong. Bài nhiều ảnh giữ lưới cũ.

### Ảnh

- **Nén ảnh ngay trong trình duyệt trước khi tải lên** (`apps/web/src/lib/image-compress.ts`, gắn vào `api.upload` nên bài viết, bình luận, tin nhắn, ảnh bìa, avatar, logo hội đều qua đó): đổi sang JPEG chất lượng 82%, cạnh dài tối đa 1200px (avatar và logo hội 512px), không phóng to ảnh nhỏ, xoay đúng theo EXIF, PNG trong suốt đổ nền trắng. GIF (giữ chuyển động), tài liệu bài học và tệp số giữ nguyên. Giải mã lỗi thì tải ảnh gốc như cũ; nén xong mà nặng hơn ảnh gốc (và ảnh chưa cần thu nhỏ) thì giữ ảnh gốc. Thử trên trình duyệt: PNG 3000×2000 (8,4 MB) còn JPEG 1200×800 (37 KB). Đây là tối ưu phía người dùng: server vẫn nhận ảnh tối đa 10 MB như trước.
- **Dọn tệp trên R2 khi ảnh bị gỡ.** Trước đây không có chỗ nào xóa tệp: xóa bài, đổi avatar, hủy ảnh đều để tệp nằm lại R2 mãi. Nay các thao tác sau xóa dòng `files` và xếp việc xóa R2 vào hàng đợi `scheduled_jobs` (loại `file.delete`), cron mỗi phút xóa thật và tự thử lại tối đa 3 lần khi R2 lỗi:
  - Xóa bài viết và từ chối duyệt bài: ảnh của bài và ảnh trong bình luận của bài.
  - Xóa bình luận có ảnh.
  - Đổi hoặc gỡ avatar, logo hội, ảnh bìa hội; đổi ảnh bìa khóa học; xóa khóa học; xóa sản phẩm (ảnh bìa).
  - `DELETE /v1/files/:id`: chủ tệp bỏ ảnh vừa tải lên mà chưa dùng. Web gọi khi bấm X trên ảnh ở ô soạn bài và khi chọn ảnh khác cho avatar, logo, ảnh bìa trước khi lưu. Tệp đang được dùng thì trả 409 và giữ nguyên.
  - Cron hằng ngày dọn tệp `pending` quá 24 giờ mà không ai dùng (xin URL tải lên nhưng không bao giờ xác nhận).
- Tệp chỉ bị xóa khi không còn cột nào trỏ tới (danh sách `FILE_REFERENCES`, có test quét schema để không sót cột mới) và thuộc đúng chủ, nên avatar trỏ vào ảnh của người khác không kéo theo việc xóa ảnh đó. Xem DECISIONS mục 33.
- `R2Provider.delete` (đường tải thẳng qua S3) trước đây bỏ qua lỗi HTTP; nay ném lỗi (trừ 404) để job xóa thử lại.

### Kỹ thuật

- Thêm vitest cho `packages/ui` và `apps/web` (trước đây hai gói này chưa có test). 57 test mới: bộ nén ảnh (19), khung ảnh (5), link avatar (3), `Avatar` (4), 24 tình huống dọn R2 ở service, 1 luồng HTTP đầy đủ, `R2Provider.delete`.
- `createTestApp({ r2Bucket })` cho phép test service với R2 giả.

### Chưa làm

- Ảnh đã tải lên từ trước bản này không tự nén hay tự dọn. Avatar đang dùng vẫn nặng như cũ cho tới khi tải lại.
- Tệp tài liệu bài học và tệp số của sản phẩm không dọn: sản phẩm xóa mềm vẫn cho người đã mua tải (`digitalDownloads`).
- Tệp lưu trên đĩa khi chạy dev (`.data/files`) không bị xóa vì `LocalMediaProvider.delete` không làm gì. Chỉ ảnh hưởng máy dev.
- Xóa ảnh bìa khóa học bằng cách chọn màu chưa hoạt động từ trước (web gửi `coverFileId: undefined`), giữ nguyên.

## 1.9.2 - 2026-09-29

Hoàn tất chuyển sang hai Worker. Từ bản 1.7.0, mọi lần deploy đều dừng vì chưa có Worker `hoiminh-jobs`, nên trang live vẫn ở 1.6.0.

### Hạ tầng

- **Secret chỉ đặt một chỗ.** `hoiminh-jobs` đọc secret của `hoiminh-api` qua service binding (entrypoint `SharedEnv`, kênh nội bộ Cloudflare, không nhận request từ Internet). Đổi key ở `hoiminh-api` thì `hoiminh-jobs` dùng theo trong tối đa 5 phút. Token phát hành web không được chia sẻ.
- **Sửa hai lỗi chuyển đổi làm `hoiminh-jobs` không deploy được:** `hoiminh-api` vẫn giữ 3 lịch cron cũ (wrangler không tự gỡ khi cấu hình bỏ mục này, nay ghi rõ `crons = []`) và vẫn đang nhận hàng đợi (workflow gỡ trước khi deploy, job nằm chờ trong hàng đợi, không mất).
- Workflow chỉ kiểm tra secret của `hoiminh-api`. Tên miền `hoiminh.com` và `www` tự chuyển từ `hoiminh-web` sang `hoiminh-api` khi deploy, không cần gỡ tay.

## 1.9.1 - 2026-09-29

### Bảo mật

- **Email không còn chèn được HTML từ dữ liệu người dùng.** Mọi mẫu email trước đây đưa thẳng tên người dùng, tên hội, tiêu đề và trích đoạn bài, nội dung tin nhắn, lý do từ chối rút tiền vào HTML. Ai đặt tên dạng `<a href="...">` là gửi được link tùy ý trong email mang tên miền hoiminh.com. Giờ mọi giá trị đi qua `escapeHtml`; bản text của email vẫn hiện đúng chữ gốc.

### Sửa lỗi

- Email thử hiện đủ địa chỉ gửi (trước đây mất phần `<no-reply@hoiminh.com>` vì bị hiểu nhầm là thẻ HTML).
- Mẫu hoàn tiền: "3-7 ngày làm việc".

## 1.9.0 - 2026-09-28

Chặn spam và dò mật khẩu bằng bộ đếm chung của Cloudflare, bước 4 trong lộ trình chịu tải.

### Bảo mật

- **Giới hạn số lần gọi dùng Rate Limiting binding của Cloudflare** thay cho bộ đếm trong bộ nhớ. Bộ đếm cũ gần như không chặn được gì trên Workers vì mỗi bản Worker đếm riêng. Bốn nhóm, khai báo trong `apps/api/wrangler.toml`:
  - `api` 600 lần/phút cho toàn bộ `/v1`, chạy trước khi mở kết nối database nên request bị chặn không tốn gì.
  - `auth` 10 lần/phút cho đăng nhập, đăng ký, 2FA, quên mật khẩu, gửi lại mã.
  - `write` 20 lần/phút cho đăng bài, bình luận, thanh toán, đổi mật khẩu, thao tác 2FA.
  - `webhook` 1200 lần/phút cho webhook cổng thanh toán.
- **Khóa đếm không gộp nhầm người dùng**: mạng di động dùng chung IP cho rất nhiều máy, nên người đã đăng nhập được đếm theo tài khoản hoặc phiên; đăng nhập đếm theo IP cộng email, nên kẻ dò mật khẩu một tài khoản bị chặn mà người khác cùng IP vẫn vào được.
- Không còn tin header `x-forwarded-for` (ai cũng tự gửi được); chỉ dùng `cf-connecting-ip` do Cloudflare đặt. Bị chặn thì trả 429 kèm `Retry-After`.
- Test bắt hạn mức trong code luôn khớp với `wrangler.toml`.

## 1.8.0 - 2026-09-28

Giảm tải database, bước 3 trong lộ trình chịu tải: khi đông người, chỗ nghẽn đầu tiên là số kết nối database, không phải Worker.

### Hiệu năng

- **Email gửi sau khi transaction đóng.** Trước đây mỗi email (xác minh, mời thành viên, thanh toán, tin nhắn...) gọi Resend ngay giữa transaction của request, giữ một kết nối database suốt lúc chờ mạng. Nay email trong request hoặc job chỉ được ghi nhận (`DeferredSender`), commit xong mới gửi. Thao tác lỗi và bị hủy thì email không đi, trước đây vẫn đi. Email thử của quản trị vẫn gửi ngay để thấy kết quả.
- **Phạm vi quyền một truy vấn.** Mỗi request của người đăng nhập trước đây chạy bốn truy vấn để biết workspace và hội của họ; nay gộp thành một câu SQL, kết quả giống hệt (có test so với cách cũ).
- **Cache ở Cloudflare cho trang công khai**: khám phá hội, trang giới thiệu hội, bảng giá, hồ sơ công khai. Khách chưa đăng nhập nhận bản cache tối đa 60 giây, lượt trúng cache không mở transaction và không chạm database. Người đã đăng nhập và link có mã giới thiệu (`?ref=`) luôn đi thẳng. Header `x-hm-cache` cho biết HIT hay MISS.
- Đã rà index của các bảng đọc nhiều (bảng tin, bình luận, thông báo, tin nhắn, thành viên, đơn hàng, workspace): đều đã có, không cần migration.

## 1.7.0 - 2026-09-28

Gộp web và API vào một Worker, tách việc chạy nền sang Worker riêng, để chịu được lượng thành viên lớn và dễ quản lý hơn.

### Triển khai

- **`hoiminh-api` phục vụ cả giao diện lẫn API** ở `hoiminh.com`, `www.hoiminh.com`, `api.hoiminh.com`. File giao diện do Cloudflare trả thẳng (không chạy code, không tính phí request); chỉ `/v1`, `/webhooks`, `/pay`, `/r`, `/files`, `/health` mới chạy Worker. Bỏ Worker `hoiminh-web`.
- **`hoiminh-jobs` (`apps/jobs`) mới**: cron và hàng đợi job chạy riêng, việc nặng không làm chậm người đang dùng.
- Nút Cập nhật ở `/he-thong/phien-ban` giờ đưa web và API lên bản mới cùng lúc, không còn lệch bản.
- Workflow deploy kiểm tra hai Worker đã đủ secret bắt buộc trước khi deploy; thiếu thì dừng, web đang chạy giữ nguyên.
- Binding R2 `FILES` và `EMAIL_FROM` có ở cả hai Worker; workflow vẫn tự tạo bucket.
- Nâng wrangler của API lên v4.

### Bảo mật

- Web gọi API cùng tên miền. CORS chỉ mở cho chính web thay vì phản chiếu mọi origin kèm cookie.

## 1.6.0 - 2026-09-28

Trang **Hạ tầng và khóa** (`/he-thong/ha-tang`): đổi key dịch vụ ngay trên web, không phải vào Cloudflare đặt secret nữa.

### Quản trị hệ thống

- **Email (Resend)**: dán API key và địa chỉ gửi, lưu xong có hiệu lực ngay; nút Gửi email thử nằm cạnh để kiểm tra liền. Kèm hướng dẫn từng bước lấy key và xác minh tên miền.
- **Phát hành web (Cloudflare)**: token, Account ID, tên Worker web cho nút Cập nhật và Quay lui ở trang Phiên bản; nút Kiểm tra kết nối.
- **Lưu trữ tệp (R2)** và **Bí mật hệ thống** (database, AUTH_JWT_SECRET, ENCRYPTION_KEY): chỉ xem trạng thái. Ba bí mật này cố ý không sửa được trên web, vì sai một khóa là chính trang này không mở được.
- Mỗi ô cho biết giá trị đang dùng lấy từ đâu (nhập ở trang này, secret trên Cloudflare, mặc định, chưa có). Bí mật chỉ hiện 4 ký tự cuối; ô bí mật để trống là giữ nguyên; "Bỏ giá trị đã lưu" để quay về secret của Worker. Kiểm tra định dạng trước khi lưu (key Resend bắt đầu bằng `re_`, Account ID 32 ký tự).
- Mục mới "Hạ tầng và khóa" trong thanh bên và hàng chip trên điện thoại; khối Hạ tầng ở Tổng quan có liên kết sang. Chữ trên trang tối thiểu 16px.

### Kỹ thuật

- Khóa lưu mã hóa (`ENCRYPTION_KEY`) trong `provider_accounts` với provider `infra_email`, `infra_release`, như credential cổng thanh toán, nên không cần migration. `createApp` gộp khóa đã lưu vào `env` (ưu tiên hơn secret); Worker giữ bản giải mã trong isolate 30 giây.
- `SwitchableSender`: lưu key mới là bộ gửi email đổi ngay, không cần khởi động lại. Mọi thay đổi ghi nhật ký thao tác `infra.update` (chỉ tên ô, không ghi giá trị).
- API `GET /v1/admin/infra`, `PUT /v1/admin/infra/:section`, `POST /v1/admin/infra/release/test` (chỉ super admin). 8 test mới.

## 1.5.0 - 2026-09-28

Gộp đợt rà soát 20/09 (PR #3) vào main. Hai việc chính: nối R2 bằng binding của Worker (không cần secret), gắn Resend có kiểm chứng. Kèm theo là một loạt công tắc và nút "trông như xong" mà không có tác dụng. Mục "Tài khoản, Phiên bản" của đợt này không được giữ: phiên bản đã chuyển vào Quản trị hệ thống ở 1.3.0.

### Hạ tầng

- **R2 qua binding `FILES` của Worker.** Trên production, avatar tải ngày 16/09 được ghi `ready` nhưng URL không phát được: provider local ghi bằng `node:fs`, Worker không có hệ tệp. Nay chỉ cần `[[r2_buckets]]` trong `wrangler.toml` (workflow deploy tự tạo bucket) là tải ảnh, tài liệu, tệp số chạy; tệp đi qua API theo URL ký HMAC. Bốn biến `R2_*` thành tùy chọn (tải thẳng qua S3 cho tệp lớn); `R2_PUBLIC_BASE_URL` để phát ảnh public từ CDN.
- **Resend có kiểm chứng.** `RecordingSender` ghi email_logs cho mọi lần gửi (sent / failed / logged, id Resend, lỗi); nút "Gửi email thử" ở Hệ thống · Tổng quan; tab "Email hệ thống" ở Nhật ký; `/health` báo provider email và tệp đang dùng. `EMAIL_FROM` mặc định đổi sang hoiminh.com cho khớp tên miền.
- **Phiên bản một nguồn:** `APP_VERSION` trong @hoiminh/config, test bắt khớp package.json và mục đầu CHANGELOG. Trước đây root ghi 1.1.0, CHANGELOG 1.2.0, `/health` trả '1.0.0' cứng.
- **Migration production thiếu:** bảng `user_totp` (xác thực hai lớp, ghi "xong 16/09") chưa từng được tạo trên Supabase, nên bật hai lớp trên hoiminh.com sẽ lỗi. Đã áp 0002 và 0003 (cột `posts.moderation_status`) bằng vai trò `hoiminh_app`, ghi vào bảng migration của drizzle.

### Công tắc và nút có tác dụng thật

- Khóa học: "Bắt buộc học theo thứ tự", "Phải hoàn thành" (bài), "Nhỏ giọt" theo công tắc khóa, "Cộng sự nhận hoa hồng khi bán lẻ" đều được service đọc. Trước đây chỉ lưu.
- **Chứng nhận hoàn thành** (`/chung-nhan/:courseId/:userId`): trang công khai, in được, đọc từ course_progress; banner "Hoàn thành 100% để nhận chứng nhận" giờ là lời hứa thật. Thông báo hoàn thành khóa dẫn tới chứng nhận.
- **Duyệt bài thành viên mới** (Cài đặt · Bảng tin · N ngày đầu): bài của người mới vào trạng thái chờ duyệt, chỉ tác giả và người kiểm duyệt thấy; người kiểm duyệt nhận thông báo, bấm Duyệt / Từ chối ngay trên thẻ bài; tác giả được báo kết quả.
- Sự kiện: bỏ công tắc "Tự đăng bản ghi" (không có nguồn để tự lấy), thêm nút "Thêm bản ghi" cho người tổ chức.
- Xóa bài, xóa module trong Soạn khóa học; xóa bình luận. Thông báo có "Tải thêm". Mời thành viên xong danh sách làm mới ngay.
- `/he-thong/tinh-nang` và `/he-thong/ho-tro` có nội dung riêng thay vì trùng hai màn khác; ba cờ V2 ghi rõ "chưa có tác dụng". Đường dẫn hội hiện đúng tên miền đang chạy thay vì "hoiminh.vn".

## 1.4.0 - 2026-09-28

Vá các lỗi tiền và bảo mật trong đợt review 27/09, trước khi mở bán thật.

### Bảo mật

- **Production thiếu bí mật thì không khởi động**: `AUTH_JWT_SECRET` còn giá trị mặc định (hoặc ngắn hơn 32 ký tự) hay thiếu `ENCRYPTION_KEY` làm API dừng ngay với thông báo rõ, thay vì chạy tiếp bằng giá trị ai cũng biết.
- **Cổng thanh toán còn bí mật mặc định bị khóa** ở mọi môi trường ngoài dev/test: không tạo thanh toán, mọi webhook bị coi là sai chữ ký. Trang Tổng quan hệ thống hiện cảnh báo cổng nào đang khóa.
- **Trang mô phỏng thanh toán** chỉ mở ở dev/test (trước đây mở cả staging), thoát HTML mọi tham số, và chỉ chuyển hướng về chính web.
- **Hoàn đơn gói nền tảng** chỉ super admin làm được; API key của chủ hội không còn lọt qua.

### Thanh toán

- **PayPal chạy đúng**: đơn lưu số USD thực thu và webhook được so với số đó (trước đây so cent USD với đồng VND nên không bao giờ xác nhận). Tiền tệ khác USD bị bỏ qua. `CHECKOUT.ORDER.APPROVED` giờ gọi capture thay vì cấp quyền khi chưa thu được tiền; chỉ `PAYMENT.CAPTURE.COMPLETED` mới mở quyền. Hoàn tiền luôn gửi số tiền, để hoàn một phần không thành hoàn toàn bộ.
- **Credential nhập ở /he-thong/thanh-toan được dùng thật**, ưu tiên hơn biến môi trường. Để trống một ô là giữ nguyên, không xóa các ô đã lưu.
- **Xác nhận thanh toán không bị trùng**: cập nhật có điều kiện nên hai webhook đồng thời chỉ một cái cấp quyền, cộng LTV và tính hoa hồng. Số hóa đơn cấp dưới khóa giao dịch nên không trùng.
- **Hoàn tiền giữ chỗ số tiền trước khi gọi cổng**: không vượt số đã thu kể cả khi bấm hai lần cùng lúc, hoàn một phần được nhiều lần, webhook báo hoàn cho chính lần hoàn từ trang quản trị không bị ghi lần hai.
- Webhook của cổng khác không còn khớp được đơn của cổng khác (chỉ chuyển khoản SePay được khớp chéo, và chỉ với đơn VND). Thông báo thất bại đến muộn không lật được thanh toán đã thành công.

## 1.3.1 - 2026-09-28

### Sửa lỗi

- Trang **Hội của tôi** (`/admin`) báo "Có lỗi xảy ra, thử lại sau" trên production với mọi chủ hội đã có workspace. Nguyên nhân: câu tính doanh thu 30 ngày đặt thẳng một `Date` trong `sql\`...\``, mà drizzle tắt bộ chuyển ngày giờ của postgres-js nên driver nổ `TypeError` trước khi câu lệnh tới Postgres. PGlite ở local và trong test không bị nên không bắt được. Sửa ở tầng kết nối (`packages/db/src/client.ts`): mọi `Date` trong tham số đều đổi thành chuỗi ISO, nên các câu `sql` khác cũng không dính lỗi này.
- Test mới `postgres-dates.test.ts` chạy trên Postgres thật khi có `TEST_POSTGRES_URL`.

## 1.3.0 - 2026-09-27

Chuyển phần phiên bản từ nhãn nổi trên mọi màn hình vào Quản trị hệ thống, và cho super admin tự bấm để đưa bản mới lên cho mọi người.

### Triển khai

- Trang **Phiên bản** (`/he-thong/phien-ban`): xem bản đang chạy, danh sách bản đã tải lên Cloudflare, nút Cập nhật và Quay lui, lịch sử phiên bản thu gọn theo từng bản.
- API `GET /v1/admin/releases` và `POST /v1/admin/releases/:versionId/deploy` gọi Cloudflare Workers Versions, có ghi nhật ký thao tác.
- `deploy.yml` thêm chế độ `RELEASE_MODE=manual`: chỉ tải bản lên (`wrangler versions upload`), chờ admin phát hành.
- Người dùng thường tự nhận bản mới ở lần chuyển trang kế tiếp; lỗi tải chunk cũ sau deploy cũng tự nạp lại.

### Giao diện

- Bỏ nhãn phiên bản góc dưới màn hình và nhật ký "Máy này".
- Quản trị hệ thống dùng được trên điện thoại: hàng chip điều hướng thay cho thanh bên bị ẩn, header không còn tràn. Chủ hội là super admin thấy thêm mục "Hệ thống" ở thanh trên.
- Sửa số phiên bản trong `package.json` bị kẹt ở 1.1.0.

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
