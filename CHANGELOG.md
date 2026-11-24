# CHANGELOG

## 1.54.0 - 2026-11-24

Giới thiệu khóa học ngay dưới tấm chứng nhận: người học vừa xong khóa có link giới thiệu kèm số tiền nhận được, link chứng nhận họ khoe cũng kèm mã giới thiệu; người được chia sẻ thấy lời mời học khóa (chủ dự án yêu cầu). Không có migration.

### Thêm

- **Khối "Khóa học giúp ích cho bạn? Giới thiệu cho bạn bè" dưới tấm chứng nhận.** Chỉ chính người học thấy, khi hội đang bật affiliate: hai ô như bảng chia sẻ ở thư viện khóa học, "Giới thiệu khóa học này" (link trang bán lẻ, số tiền nhận mỗi đơn) và "Giới thiệu vào hội" (link trang hội, số tiền nhận hằng tháng), mỗi ô có nút sao chép riêng.
- **Khoe chứng chỉ cũng là giới thiệu.** Link chứng nhận người học bấm Chia sẻ hay sao chép (nút dưới chứng chỉ và ô mã kiểm tra) kèm sẵn mã giới thiệu của họ và tên hội, để mã được tính cho chương trình của hội. Ảnh và bản in chứng chỉ vẫn in link gốc.
- **Lời mời học khóa cho người được chia sẻ.** Người khác mở trang chứng nhận thấy "Bạn cũng muốn học khóa này?" với tên khóa, giá và nút "Xem khóa học" (trang bán lẻ) hoặc "Xem hội". Không thấy gì về hoa hồng.
- Dữ liệu chứng nhận có thêm id hội và giá, đường dẫn trang bán lẻ của khóa.

## 1.53.1 - 2026-11-24

Bảng gói: mức lợi của kỳ dài luôn ghi bằng phần trăm, thẻ bảng giá ghi "Giới hạn N thành viên", làm nổi gói không giới hạn và đưa dòng có dấu tích lên đầu (chủ dự án yêu cầu). Không có migration.

### Thay đổi

- **Mức lợi của kỳ dài luôn ghi bằng phần trăm.** Trước đây giá tròn tháng thì ghi "tặng 2 tháng", lẻ thì ghi phần trăm, nên mỗi chỗ một kiểu. Nay mọi nơi (bảng giá trang tạo hội, nhãn cạnh tab kỳ hạn, bước chọn gói, màn nâng gói) đều ghi "tiết kiệm 17%" hoặc "tiết kiệm tới 33%". Số ngày còn lại của gói cũ khi nâng gói vẫn được cộng như cũ.
- **Bảng giá trang tạo hội.** Dòng thành viên thành một ô: gói có trần ghi "Giới hạn 5.000 thành viên", gói Không giới hạn là ô vàng có biểu tượng vô cực và chữ "Không giới hạn" to. Trong mỗi thẻ, các dòng có dấu tích đứng trước, dòng có ổ khóa xuống cuối. Các thẻ vẫn cao bằng nhau.

## 1.53.0 - 2026-11-24

Màn tạo hội: tài khoản quản trị hệ thống tạo hội miễn phí không giới hạn, bước "Gói" hiện cả gói Miễn phí (xám) và ưu tiên gói Chuyên nghiệp; tên miền riêng chỉ còn ở gói Không giới hạn (chủ dự án yêu cầu). Không có migration.

### Thêm

- **Tài khoản quản trị hệ thống tạo hội miễn phí không giới hạn.** Để thử nghiệm và dựng hội mẫu. Hội mới của quản trị luôn là hội miễn phí, hoạt động ngay, và hội miễn phí cũ vẫn giữ nguyên. Người dùng thường vẫn một hội miễn phí mỗi tài khoản.

### Thay đổi

- **Bước "Gói" khi tạo hội thứ hai trở đi.** Gói Miễn phí luôn hiện ở đầu nhưng xám, không chọn được, ghi rõ "Mỗi tài khoản chỉ được tạo 1 hội miễn phí" và hội đã dùng suất đó. Gói Chuyên nghiệp được chọn sẵn, có nhãn "Dành cho đa số", viền nổi và kê đủ tính năng. Dòng mô tả các gói đọc từ tính năng thật của gói, không còn viết cứng.
- **Tên miền riêng chỉ có ở gói Không giới hạn.** Gói Chuyên nghiệp còn tự động hóa, affiliate và API. Bảng gói mặc định và dữ liệu mẫu đổi theo. Hội đã gắn tên miền từ trước vẫn giữ tên miền, chỉ không gắn hoặc đổi được nữa khi gói không có tính năng này.

### Sửa

- **Hội miễn phí đã lưu trữ mà màn tạo hội vẫn coi là đã dùng suất miễn phí.** Máy chủ trả lại suất khi hội miễn phí bị lưu trữ, nhưng màn tạo hội vẫn ẩn gói Miễn phí. Nay hai bên tính giống nhau.

## 1.52.0 - 2026-11-24

Chia sẻ khóa học ngay ở thư viện khóa học: thẻ khóa có dòng nhỏ "Nhận 99.800đ khi chia sẻ", bấm vào chọn giới thiệu khóa học hoặc giới thiệu vào hội (chủ dự án yêu cầu). Không có migration.

### Thêm

- **Dòng "Nhận ... khi chia sẻ" trên thẻ khóa học.** Hội đang bật affiliate thì mỗi thẻ khóa đã đăng có một dòng chữ nhỏ, kín đáo dưới nút chính: khóa bán lẻ ghi số tiền nhận mỗi đơn ("Nhận 99.800đ khi chia sẻ"), khóa chỉ nằm trong hội ghi số tiền nhận mỗi tháng ("Nhận 39.800đ/tháng khi chia sẻ"). Chỉ số tiền có màu xanh. Khách chưa vào hội, hội chưa bật affiliate, khóa nháp thì không có dòng này.
- **Bảng chia sẻ hai lựa chọn.** Bấm dòng chia sẻ mở bảng có hai ô, mỗi ô có nút sao chép link và nút chia sẻ riêng: "Giới thiệu khóa học này" (link trang bán lẻ của khóa, nhận một lần cho mỗi người mua) và "Giới thiệu vào hội" (link trang giới thiệu hội, nhận hằng tháng khi người được mời đóng phí thành viên, kèm số tháng được tính và tổng tối đa). Khóa vừa bán lẻ vừa có trong Premium thì link khóa dẫn tới trang bán lẻ. Mọi chỗ ghi số tiền cụ thể, không ghi phần trăm.
- **Mục "Giới thiệu khóa học" trong menu ba chấm** của người quản lý khóa, mở cùng bảng chia sẻ.
- Số tiền hằng tháng tính trên gói thành viên rẻ nhất (gói bán theo năm thì chia đều ra tháng), để không hứa quá tay. Mức hoa hồng là mức riêng của người giới thiệu nếu chủ hội đã đặt, làm tròn xuống như lúc ghi hoa hồng thật.
- Màu "xanh tiền" mới trong bộ màu giao diện (`T.money`, `T.moneySoft`, `T.moneyText`), có cả giao diện tối.

## 1.51.2 - 2026-11-24

Bảng gói ở trang tạo hội: các thẻ cao bằng nhau, cùng một danh sách tính năng để so từng dòng (chủ dự án yêu cầu). Không có migration.

### Thay đổi

- **Bảng gói ở trang tạo hội (/tao-hoi/goi) đều nhau và rõ phần khóa, phần mở.** Bốn thẻ cao bằng nhau. Thẻ nào cũng liệt kê cùng các dòng theo cùng thứ tự (bán hàng và thu tiền, không phí trên doanh thu, tự động hóa, tên miền riêng, affiliate, API): dòng mở có dấu tích xanh, dòng khóa có ổ khóa và chữ mờ, nên các dòng thẳng hàng giữa các thẻ. Cuối thẻ ghi "Mở khóa từ gói ..." hoặc "Đủ mọi tính năng". Nhãn "Dành cho đa số" nằm vắt trên mép thẻ, không đẩy nội dung thẻ đó xuống.

## 1.51.1 - 2026-11-24

Ảnh bìa video YouTube ở trang học bài nét hơn (chủ dự án báo ảnh bị mờ). Không có migration.

### Sửa

- **Ảnh bìa video YouTube bị mờ ở trang học bài.** Trước lấy bản 480x360 của YouTube rồi kéo giãn ra khung rộng cả nghìn điểm ảnh nên mờ. Nay lấy bản 1280x720; video không có bản đó thì lùi về 640x480, cuối cùng mới là 480x360. Ảnh chỉ hiện khi đã tải được bản thật, không chớp ảnh xám.

## 1.51.0 - 2026-11-24

Nút "Sửa bài học" ngay trên trang học bài cho người có quyền soạn khóa học (chủ dự án yêu cầu). Không có migration.

### Thêm

- **Sửa nhanh bài học từ trang học.** Chủ hội và người được giao quyền soạn khóa học thấy nút "Sửa bài học" cạnh tiêu đề bài (máy tính: cùng hàng với "Bài tiếp theo" và "Đánh dấu hoàn thành"; điện thoại: ngay dưới tiêu đề). Bấm vào thì mở khung soạn khóa học ở đúng bài đang xem, module chứa bài được mở sẵn. Học viên không thấy nút này.
- Khung soạn khóa học nhận tham số `?bai=<id>` để mở sẵn một bài. Bài không còn trong khóa (link cũ, bài đã xóa) thì mở bài đầu tiên.

## 1.50.0 - 2026-11-24

Nút Tin nhắn ở đầu trang mở bảng tin nhắn nổi, cùng kiểu với bảng Thông báo (chủ dự án yêu cầu). Không có migration.

### Thêm

- **Bảng tin nhắn nổi.** Bấm nút Tin nhắn ở đầu trang thì hiện bảng các hội thoại ngay tại chỗ, không rời trang đang xem: máy tính là bảng thả dưới nút, điện thoại là bảng trượt từ đáy lên (như bảng Thông báo). Bảng có ô tìm theo tên, hai mục Tất cả và Chưa đọc, mỗi hội thoại hiện tên, tin mới nhất, thời gian, hội và số tin chưa đọc. Chạm một hội thoại thì mở thẳng hội thoại đó ở trang Tin nhắn. Còn tin chưa đọc thì bảng mở vào mục Chưa đọc.
- **Số tin chưa đọc trên nút Tin nhắn.** Trước chỉ có chấm đỏ, nay hiện số (quá 9 thì "9+"), giống số trên chuông.

### Thay đổi

- Cách mở, đóng bảng nổi (bấm ra ngoài, phím Esc, chuyển trang, khóa cuộn trên điện thoại) tách thành phần dùng chung cho chuông Thông báo và nút Tin nhắn. Mở bảng này thì bảng kia tự đóng.

## 1.49.1 - 2026-11-22

Database luôn có sẵn các cờ tính năng với giá trị mặc định, để không tính năng nào bị tắt ngầm vì thiếu dòng cờ. Theo yêu cầu của chủ dự án. Có migration `0020_feature_flags_mac_dinh` (chỉ thêm dữ liệu, không đổi bảng).

### Sửa

- **Trên web thật không ai mua được sản phẩm lẻ.** Bấm "Mua ngay" ở trang sản phẩm (kể cả trang mở từ link affiliate) bị báo "Cửa hàng đang tạm đóng trên toàn nền tảng". Nguyên nhân: hệ thống coi cờ tính năng nào thiếu dòng là đang tắt, mà dòng cờ `store` và `affiliate_leaderboard` trước giờ chỉ được tạo trong dữ liệu mẫu, database thật chưa từng có. Cùng nguyên nhân, mục Cửa hàng và bảng xếp hạng affiliate bị ẩn ở mọi hội. Ngày 22/11/2026 hai cờ đã được bật tay trên database thật theo yêu cầu của chủ dự án; migration này bảo đảm môi trường mới dựng cũng có sẵn đủ các cờ.

### Kỹ thuật

- Migration thêm đủ tám cờ đang dùng trong mã với đúng giá trị của dữ liệu mẫu: bật `store`, `affiliate_leaderboard`, `mcp`; tắt `realtime_chat`, `go_live`, `gamification`, `paypal`, `install_gate`. Dùng `ON CONFLICT DO NOTHING` nên dòng đã có (quản trị đã bật tắt ở trang Hệ thống) được giữ nguyên. Áp lên database thật là an toàn: hai cờ đã bật giữ nguyên, các cờ mới thêm đều tắt, đúng như hiện trạng thiếu dòng.
- Test: `packages/db/src/test/schema.test.ts` kiểm các cờ có sẵn ngay sau khi chạy migration, chưa cần dữ liệu mẫu.

## 1.49.0 - 2026-11-22

Học xong bài cuối của khóa thì ứng dụng tự chuyển sang màn chúc mừng, và tấm chứng chỉ được thiết kế lại để đáng đem khoe. Làm theo yêu cầu của chủ dự án ngày 21/11/2026. Không có migration.

### Thêm

- **Màn chúc mừng khi hoàn thành khóa học.** Bấm hoàn thành bài cuối cùng còn lại của một khóa thì ứng dụng tự chuyển sang trang chứng nhận ở chế độ chúc mừng: lời chúc có tên bạn và tên khóa, hoa giấy rơi vài giây, số bài và thời lượng đã học, rồi tới tấm chứng chỉ cùng lời mời khoe thành quả. Lời chúc chỉ hiện đúng một lần lúc vừa học xong; tải lại trang hay mở lại link thì chỉ còn trang chứng nhận bình thường. Máy đặt "giảm chuyển động" thì không có hoa giấy.
- **Khóa không cấp chứng nhận cũng được chúc mừng.** Học xong khóa tắt chứng nhận thì một bảng chúc mừng mở ngay trên trang học, có số bài, thời lượng và lối về trang khóa học.
- **Tải chứng chỉ thành ảnh.** Nút "Tải ảnh" lưu tấm chứng chỉ thành tệp PNG nét (2000 x 1414) để đăng Facebook, Zalo, LinkedIn. Ảnh giống hệt tấm đang xem, kể cả logo của hội; nếu logo không tải được thì ảnh dùng dấu chữ viết tắt của hội, việc tải ảnh không bị hỏng.
- **Chia sẻ chứng chỉ.** Trên điện thoại, nút "Chia sẻ" mở bảng chia sẻ của máy và gửi kèm ảnh chứng chỉ khi máy cho phép. Trên máy tính không có bảng chia sẻ thì nút thành "Sao chép link".
- **Lối vào "Xem chứng chỉ".** Khóa đã học xong và có cấp chứng nhận thì trang tổng quan khóa học và trang học đều có nút "Xem chứng chỉ" màu vàng dễ thấy, thay cho dòng chữ nhỏ ở cột bên.

### Thay đổi

- **Tấm chứng chỉ thiết kế lại.** Khổ A4 ngang, nền giấy ấm, khung viền kép có họa tiết ở bốn góc, logo và tên hội, dòng "CHỨNG NHẬN HOÀN THÀNH", tên học viên thật lớn, tên khóa, số bài và thời lượng, ngày hoàn thành, con dấu "Đã hoàn thành", chữ ký giảng viên, mã kiểm tra và địa chỉ kiểm tra. Tên dài tự co cỡ chữ hoặc xuống hai dòng, không tràn khung. Trên điện thoại tấm vẫn là khổ ngang thu nhỏ vừa màn hình.
- **Trang chứng nhận gọn hơn.** Dòng link kiểm tra dài được thay bằng ô link có nút sao chép và mã kiểm tra tách nhóm bốn ký tự. Người mở link để kiểm tra thấy ngay dòng "Chứng nhận hợp lệ" nêu rõ ai, khóa nào, ngày nào. Địa chỉ `/chung-nhan/...` giữ nguyên, link đã phát hành vẫn chạy.
- **In hoặc lưu PDF.** Bản in ra đúng một trang A4 ngang, chỉ có tấm chứng chỉ, không có nút và thanh điều hướng.
- **Ngày trên chứng chỉ.** Viết kiểu "22 tháng 11, 2026" theo giờ Việt Nam, nên ai mở link cũng thấy cùng một ngày.

### Sửa

- **Ngày hoàn thành không còn bị đổi.** Trước đây bấm hoàn thành lại một bài của khóa đã học xong thì ngày hoàn thành trên chứng nhận bị ghi đè thành ngày bấm lại. Nay ngày hoàn thành giữ nguyên; chỉ đổi khi khóa được thêm bài mới và bạn học xong lần nữa.

## 1.48.1 - 2026-11-22

Sửa lỗi video YouTube của bài học cứ phát ở 360p và chọn chất lượng không đổi gì, theo yêu cầu của chủ dự án ngày 21/11/2026. Không có migration.

### Sửa

- **Video YouTube của bài học không còn bị kẹt ở 360p, chọn chất lượng nào thì đổi đúng mức đó.** Trước đây YouTube tự chọn mức theo cỡ khung nhúng: trình phát cao khoảng 300px (laptop có cột giáo trình, điện thoại) nên chỉ được 240p hoặc 360p, nhìn mờ. Bấm Cài đặt, chọn 720p hay 1080p cũng không đổi gì, vì YouTube đã bỏ lệnh chọn chất lượng cho trình phát nhúng. Nay trang dựng khung YouTube đúng cỡ của mức muốn có rồi thu về vừa trình phát, nên YouTube phát đúng mức đó. Để "Tự động" thì video nét theo màn hình, thấp nhất 720p (mạng yếu YouTube vẫn tự hạ). Đổi chất lượng trong lúc phát thì video nạp lại ngay ở đúng chỗ đang xem, giữ tốc độ đang chọn; đổi lúc đang dừng thì áp dụng khi bấm phát. Mục Chất lượng không còn hiện các mức trên 4K.
- Các nền tảng khác (Vimeo, Bunny, Loom, Facebook, TikTok, Google Drive) và video YouTube ở bài viết, trang giới thiệu, trang sản phẩm dùng trình phát gốc của nền tảng, nút chọn chất lượng là của chính nền tảng đó nên không dính lỗi này. Không đổi gì ở các khung đó.

### Kiểm thử

- `apps/web/src/lib/youtube.test.ts`: mức muốn phát tới, hệ số phóng khung, cách nhận ra YouTube tính theo điểm ảnh thật, danh sách mức bỏ mức trên 4K.
- `e2e/helpers/youtube.ts`: YouTube giả nay chọn mức như YouTube thật (theo cỡ khung, bỏ qua lệnh chọn mức, khung nhỏ lại thì chỉ hạ mức khi nạp lại video). Chạy luồng 16 với trình phát cũ: để Tự động YouTube giả chỉ phát 240p, đúng như lỗi chủ dự án gặp.
- `e2e/tests/16-bai-hoc-video-youtube.spec.ts`: thêm hai luồng. Trình phát nhỏ trên máy tính: Tự động ra 720p, chọn 1080p rồi 360p trong lúc phát thì YouTube đổi đúng mức, khung YouTube to nhỏ thế nào tên video và dải "Video khác" vẫn ngoài vùng nhìn. Màn hình mật độ điểm ảnh 2: YouTube tính theo điểm ảnh thật thì trang tự thu khung lại, chọn 720p, 1080p, 360p đều ra đúng mức. Cả 6 luồng của tệp chạy qua trên Chromium.
- Chưa thử được với YouTube thật (máy chạy thử bị chặn mạng tới YouTube). Cần xem lại trên máy thật sau khi deploy: chọn 1080p rồi 360p, nhìn độ nét và nhãn mức đang phát trong mục Chất lượng.

## 1.48.0 - 2026-11-22

Ba việc theo yêu cầu của chủ dự án ngày 21/11/2026: mọi bộ lọc thời gian dùng chung một bảng lọc khoảng ngày đầy đủ; mục "Tiền" của hội thành "Quản lý đơn hàng" có hai tab Thống kê và Tất cả đơn hàng; nhãn trên thanh bên ghi rõ mục nào của hội, mục nào của cá nhân. Không có migration.

### Thêm

- **Bảng lọc khoảng ngày dùng chung.** Trang Quản lý đơn hàng, Bàn điều khiển của chủ hội và Tổng quan hệ thống bỏ các nút "Hôm nay / 30 ngày / Quý / Năm", thay bằng một bảng lọc có đủ các mốc: Hôm nay, Hôm qua, 7 ngày qua, 30 ngày qua, 90 ngày qua, Tháng trước, Đầu tuần đến nay, Đầu tháng đến nay, Từ trước đến nay. Bấm một mốc là số liệu đổi ngay. Muốn khoảng riêng thì gõ hai ô ngày (dạng ngày/tháng/năm, trên điện thoại gõ liền số cũng được) hoặc bấm ngày đầu rồi ngày cuối trên lịch, xong bấm Áp dụng. Nút mở bảng lọc luôn ghi tên mốc hoặc khoảng ngày đang xem, ví dụ "30 ngày qua" hoặc "08/10/2026 đến 20/11/2026".
- **Bảng lọc dễ bấm trên điện thoại.** Trên điện thoại bảng lọc trượt lên từ đáy màn hình, các mốc xếp hai cột, lịch hiện một tháng, chữ từ 15px và ô bấm cao từ 44px, không tràn ngang. Trên máy tính là bảng hai cột: mốc bên trái, hai tháng lịch bên phải. Dùng được bằng bàn phím: Esc đóng, Tab đi qua các nút, phím mũi tên đi giữa các ngày. Bấm ra ngoài thì đóng.
- **Trang Quản lý đơn hàng với hai tab.** Tab Thống kê có bộ lọc khoảng ngày, bốn ô số liệu (Tổng thu, Đã thu, Nợ affiliate, Hoàn tiền), số đơn đặt trong kỳ theo từng trạng thái, và phần tiền đã thu đến từ người giới thiệu so với phần còn lại. Tab Tất cả đơn hàng liệt kê mọi đơn của hội, đơn mới đặt nằm trên. Tab đang mở nằm trên địa chỉ nên tải lại trang hay gửi link vẫn mở đúng tab.
- **Lọc và tìm đơn hàng.** Tab Tất cả đơn hàng lọc được theo khoảng ngày đặt (mở sẵn 90 ngày qua, có Từ trước đến nay), theo trạng thái (Chờ xác nhận, Chờ thanh toán, Đã thanh toán, Hết hạn, Đã hoàn tiền), theo affiliate (có người giới thiệu hoặc không), và tìm theo tên người mua, tên sản phẩm hoặc mã đơn. Mỗi đơn hiện ngày giờ đặt, người mua, sản phẩm, mã đơn, cách thanh toán, số tiền, người giới thiệu kèm hoa hồng phải trả, và nhãn trạng thái có màu. Phía trên danh sách luôn có tổng số đơn và tổng giá trị của kết quả đang lọc. Danh sách tải từng 30 đơn, bấm "Xem thêm" để tải tiếp. Trên điện thoại mỗi đơn là một thẻ, không phải cuộn ngang.
- **Xác nhận và hoàn tiền ngay trên dòng đơn.** Đơn chuyển khoản đang chờ có nút "Đã nhận tiền" ngay trên dòng; đơn đã thanh toán có nút "Hoàn tiền".
- **Xuất CSV theo đúng bộ lọc.** Bản xuất lấy đủ mọi đơn khớp bộ lọc đang chọn (tới 5.000 đơn), không chỉ các đơn đang hiện trên màn hình, và có thêm cột mã đơn, ngày đặt, ngày trả, người giới thiệu, hoa hồng. Tên tệp mang khoảng ngày đã chọn.
- **API và MCP nhận khoảng ngày.** `GET /v1/communities/:id/revenue`, `/overview` và `GET /v1/admin/overview` nhận `from` và `to` dạng YYYY-MM-DD (ngày theo giờ Việt Nam, tính cả hai đầu); chỉ gửi `to` là lấy từ trước đến nay. Kết quả trả thêm `range` cho biết khoảng đã áp dụng. API mới `GET /v1/communities/:id/orders` liệt kê đơn hàng có lọc và phân trang, kèm lệnh MCP `list_orders`; các lệnh `get_revenue` và `get_community_overview` nhận thêm `from`, `to`.

### Thay đổi

- **"Tiền" đổi thành "Đơn hàng".** Mục trên thanh bên, ô tắt trên Bàn điều khiển, mục trong trang Tôi và ô lệnh nhanh đều ghi "Đơn hàng"; tiêu đề trang là "Quản lý đơn hàng". Địa chỉ trang giữ nguyên nên link trong email và thông báo cũ vẫn mở đúng. Chỉ chủ hội và quản trị của hội thấy mục này; thành viên thường không thấy và gọi API thì bị từ chối, như trước.
- **Phần cần xử lý ngay nằm trên cùng, gọn hơn.** Thông tin cách nhận tiền thu về một khối nhỏ. Khối "Đơn chờ bạn xác nhận" chỉ hiện khi có đơn đang chờ.
- **Nhãn ghi rõ của hội hay của cá nhân.** Nhóm Quản lý trên thanh bên ghi "Quản lý affiliate" và "Cài đặt hội" (trước là "Affiliate", "Cài đặt"); tiêu đề hai trang đó và nhóm lệnh trong ô lệnh nhanh đổi theo. Mục affiliate của riêng mỗi người trong trang Tôi và trang Tài khoản ghi "Affiliate của tôi".
- **"Hôm nay" là ngày lịch theo giờ Việt Nam.** Trước đây "Hôm nay" tính 24 giờ gần nhất, nên xem lúc 9 giờ sáng vẫn lẫn đơn của chiều hôm qua. Nay mọi mốc tính theo ngày lịch giờ Việt Nam: "Hôm nay" bắt đầu từ 00:00, "30 ngày qua" là 30 ngày lịch tính cả hôm nay. Biểu đồ doanh thu theo ngày cũng gom theo ngày giờ Việt Nam.
- **So sánh với kỳ trước dùng đúng khoảng liền trước.** Ở Bàn điều khiển, phần trăm tăng giảm so với khoảng liền trước có cùng số ngày. Chọn "Từ trước đến nay" thì không có kỳ trước nên không hiện phần tăng giảm.
- **Biểu đồ doanh thu gọn hơn với kỳ dài.** Kỳ trên 31 ngày thì gom vài ngày vào một cột (tiêu đề ghi rõ mỗi cột mấy ngày), để biểu đồ không vỡ trên điện thoại.
- **Số liệu "Đã thu 30 ngày" giữ nguyên**, không theo bộ lọc.

### Sửa

- **Bảng giao dịch và ô số liệu lệch nhau ở đầu kỳ.** Số liệu tính theo ngày trả tiền còn danh sách đơn gần đây của API doanh thu lọc theo ngày tạo đơn, nên đơn tạo hôm trước mà trả hôm nay có trong số liệu nhưng không có trong danh sách. Nay danh sách đó lọc theo đúng ngày đang hiện.
- **Dấu gạch ngang dài ở Tổng quan hệ thống.** Khoảng ngày của biểu đồ GMV viết bằng chữ "đến".

### Kỹ thuật

- `packages/contracts/src/date-range.ts`: phép tính ngày lịch giờ Việt Nam (`vnDay`, `shiftDay`, `daySpan`, `weekdayMon`), `dateRangeQuerySchema`, `revenueQuerySchema`, `resolveDayRange`. `packages/contracts/src/orders.ts`: trạng thái hiển thị của đơn và `ordersQuerySchema`. Tham số `days` cũ vẫn chạy (bản web cũ còn mở trong trình duyệt), nay là N ngày lịch gần nhất tính cả hôm nay.
- `packages/core/src/lib/period.ts`: `resolvePeriod` đổi khoảng ngày thành hai mốc thời gian và kỳ liền trước; `inSpan` dựng điều kiện SQL. `revenue.revenue`, `revenue.settingsOverview`, `admin.overview` dùng chung. `admin.overview` tính theo đồng hồ của ứng dụng thay cho `now()` của database.
- `packages/core/src/services/revenue.ts`: `listOrders` (quyền `revenue.read`, cùng quyền với doanh thu), phân trang bằng con trỏ giữ đủ phần triệu giây của thời điểm đặt đơn; `revenue.revenue` trả thêm `ordersByStatus` và `stats.referredMinor`. Chỉ đọc các bảng affiliate.
- `apps/web/src/lib/date-range.ts` (mốc, ô nhập ngày, lưới lịch, cột biểu đồ) và `apps/web/src/lib/orders.ts` là hàm thuần có test. `apps/web/src/components/DateRangePicker.tsx` là thành phần dùng chung; kiểu dáng ở `packages/ui/src/styles.css` (lớp `drp-*`, `order-*`).
- Test: `packages/core/src/test/date-range.test.ts`, `packages/core/src/test/orders-list.test.ts`, `apps/web/src/lib/date-range.test.ts`, `apps/web/src/lib/orders.test.ts`, thêm ca trong `apps/api/src/api.test.ts`; E2E 04 và 12 sửa theo nhãn mới và hai tab.

## 1.47.0 - 2026-11-22

Thành viên thấy Affiliate ngay trên thanh bên của hội, kèm phần trăm hoa hồng, và link giới thiệu với bảng xếp hạng về chung một trang, theo yêu cầu của chủ dự án ngày 21/11/2026. Không có migration.

### Thêm

- **Mục "Affiliate" trên thanh bên của hội, kèm phần trăm hoa hồng.** Thành viên của hội đang bật affiliate thấy mục "Affiliate" ở nhóm Hội, bên phải là mức hoa hồng của chính họ (ví dụ "40%"). Trước đây muốn lấy link phải vào Tài khoản, Affiliate nên khó tìm. Mục này hiện cả trên menu của điện thoại; thanh bên thu gọn thì còn biểu tượng.
- **Trang Affiliate của thành viên trong hội.** Trang `/<hội>/xep-hang` (địa chỉ cũ giữ nguyên) nay có tiêu đề "Affiliate", nói rõ quyền lợi bằng số thật ("Giới thiệu người vào <tên hội>, nhận 40% hoa hồng mỗi lần họ trả phí") và có hai tab. "Link của tôi" mở sẵn: chọn trang muốn chia sẻ, sao chép link, xem lượt bấm, đăng ký, trả phí, hai ô ví (Đang giữ, Có thể rút) và nút "Xem ví và rút tiền" sang trang ví đầy đủ. "Xếp hạng" là bảng xếp hạng như trước. Tab đang mở nằm trên địa chỉ (`?tab=link`, `?tab=xep-hang`). Thẻ "Người giới thiệu của bạn" vẫn ở trang này.
- **Đổi mã giới thiệu ngay trong trang Affiliate của hội.** Tab "Link của tôi" có nút "Đổi mã" như ở trang Affiliate của tôi (mỗi người đổi được một lần, một mã dùng cho mọi chương trình). Đổi xong thì link ở mọi ví, bảng xếp hạng và trang sản phẩm đổi theo.

### Thay đổi

- **Mục Affiliate không còn phụ thuộc bảng xếp hạng.** Trước đây thanh bên chỉ có mục "Xếp hạng affiliate", và mục đó biến mất khi bảng xếp hạng bị tắt (cờ `affiliate_leaderboard` của nền tảng tắt hoặc chưa được tạo, chủ hội tắt tab), dù chương trình affiliate của hội vẫn chạy. Nay mục "Affiliate" hiện khi người xem là thành viên, chương trình của hội đang bật và gói của hội có affiliate. Bảng xếp hạng bị tắt thì trang chỉ còn phần link, không báo lỗi. Chương trình tắt thì thành viên không thấy mục này.
- **Tab "Xếp hạng" theo đúng cài đặt của chủ hội.** Mở cho thành viên thì ai cũng thấy; chỉ cho affiliate thì hiện sau khi thành viên lấy link; ẩn thì chỉ người quản lý thấy, kèm dòng nhắc bảng đang tắt với thành viên.
- **Phân biệt với phần quản lý của chủ hội.** Mục của thành viên nằm ở nhóm Hội với biểu tượng phần trăm; mục quản lý chương trình của chủ hội vẫn ở nhóm Quản lý. Người quản lý có thêm nút "Quản lý chương trình" trên trang Affiliate.
- Ô lệnh của người quản lý: lệnh "Xếp hạng affiliate" đổi thành "Affiliate của hội: link và xếp hạng", hiện theo cùng điều kiện với mục trên thanh bên. Chip "Xếp hạng" ở trang quản lý affiliate mở thẳng tab Xếp hạng.
- Bảng xếp hạng: ô không có số liệu ghi "Ẩn" hoặc "Giữ hạng" thay cho dấu gạch.

### Kỹ thuật

- `packages/core/src/services/shell.ts`: khung hội trả thêm `affiliate` cho thành viên (`programId`, `enabled`, `rateBps` là mức riêng của tài khoản affiliate người xem nếu có, `durationMonths`, `hasAccount`, `leaderboardVisibility`); khách và hội chưa có chương trình nhận `null`. Chỉ đọc, không mở tài khoản affiliate. Test: `packages/core/src/test/shell-affiliate.test.ts`.
- `apps/web/src/lib/affiliate-nav.ts`: điều kiện hiện mục, điều kiện hiện tab Xếp hạng, tab đang mở theo địa chỉ. Test: `apps/web/src/lib/affiliate-nav.test.ts`.
- Ví chỉ tải khi mở tab "Link của tôi", vì gọi API ví là mở tài khoản affiliate cho người xem.

## 1.46.2 - 2026-11-22

Giữ chỗ nốt các đường dẫn hệ thống còn thiếu, để không hội nào đặt trùng rồi bị che mất trang. Theo yêu cầu của chủ dự án. Không có migration.

### Sửa

- **Bảy đường dẫn hệ thống chưa được giữ chỗ.** Một hội đặt đường dẫn là `chung-nhan`, `mcp`, `webhooks`, `pay`, `files`, `health` hoặc `icons` thì trang của hội bị phần khác của hệ thống trả lời thay: ví dụ `hoiminh.com/health` trả về dữ liệu kiểm tra máy chủ, `hoiminh.com/chung-nhan/...` mở trang chứng nhận. Nay bảy tên này không đặt làm đường dẫn hội được, khi tạo hội hoặc đổi đường dẫn sẽ báo "Đường dẫn này được hệ thống dùng, chọn tên khác". Đã kiểm trên database thật: chưa hội nào dùng các tên này (kể cả đường dẫn cũ đã đổi).

### Kỹ thuật

- `RESERVED_SLUGS` trong `packages/config/src/index.ts` thêm bảy tên trên.
- Test mới `packages/config/src/reserved-paths.test.ts` đọc thẳng ba nơi khai báo đường dẫn: route cấp cao nhất của web (`apps/web/src/app/router.tsx`), `run_worker_first` trong `apps/api/wrangler.toml`, và các thư mục trong `apps/web/public`. Thêm route hệ thống mới mà quên giữ chỗ thì test đỏ.

## 1.46.1 - 2026-11-22

Lời về hoàn tiền trên web, trong email và thông báo nay khớp với luật máy chủ đang chạy, theo yêu cầu của chủ dự án. Không đổi luật hoàn tiền, không có migration.

### Sửa

- **Hộp thoại "Yêu cầu hoàn tiền" ghi sai điều kiện.** Trang Gói và thanh toán ghi "chưa học quá nửa khóa" trong khi hệ thống chỉ cho hoàn khi xem chưa quá 20% nội dung. Nay ghi đúng: trong 7 ngày kể từ khi thanh toán, nếu là khóa học thì xem chưa quá 20%. Hộp thoại cũng nói rõ chuyện gì xảy ra sau khi bấm: đơn được ghi nhận hoàn ngay, quyền truy cập bị thu lại, tiền do người bán hoàn.
- **Trang sản phẩm thiếu điều kiện tiến độ.** Sản phẩm chưa có cam kết riêng hiện "Hoàn tiền trong 7 ngày", bỏ sót điều kiện 20% của khóa học. Nay khóa học hiện đủ điều kiện; combo và sản phẩm số (không bị xét tiến độ) hiện "Hoàn tiền trong 7 ngày kể từ khi thanh toán".
- **Email và thông báo hoàn tiền hứa "tiền về trong 3-7 ngày làm việc" cho mọi đơn.** Với đơn trả bằng chuyển khoản hoặc VNPAY, hệ thống không chuyển tiền được: chủ hội phải tự chuyển lại. Nay lời báo nói đúng tiền về bằng đường nào: cổng thanh toán tự hoàn về phương thức đã trả; hoặc chủ hội tự chuyển lại (kèm gợi ý nhắn chủ hội nếu chờ lâu); hoặc Hội Mình chuyển lại với đơn gói Hội Mình. Không còn hứa số ngày.

### Kỹ thuật

- Một nguồn cho luật và câu chữ ở `packages/contracts/src/commerce.ts`: `SELF_REFUND`, `selfRefundRule`, `selfRefundConditions`, `refundRouteNote`. Web, email và thông báo cùng lấy từ đây; test ở core kiểm `SELF_REFUND` khớp `BUSINESS.courseRefundDays` và `courseRefundMaxProgressPercent`.
- Sự kiện nội bộ `payment.refunded` mang thêm `route` (`gateway`, `seller_transfer`, `platform_transfer`), tính trong `applyRefund` từ kết quả hoàn và người nhận tiền của đơn. Dữ liệu gửi ra webhook của chủ hội không đổi.
- `templates.paymentRefunded` nhận thêm câu ghi chú. Cam kết mặc định khi tạo sản phẩm dùng chung `selfRefundRule('course')` (nội dung như cũ).
- Chưa sửa: dòng quyền lợi "Hoàn tiền 7 ngày nếu xem chưa quá 20%" ở trang thanh toán (`CheckoutConfigure.tsx`) vẫn hiện cho mọi loại sản phẩm; tệp đó đang được thiết kế lại ở một PR khác.

## 1.46.0 - 2026-11-22

Thiết kế lại cả luồng thanh toán của một hội theo yêu cầu của chủ dự án: trang chọn gói, màn mã QR chuyển khoản, và màn cảm ơn chờ xác nhận sau khi bấm "Tôi đã chuyển khoản". Chủ hội nay nhận email khi có người báo đã chuyển khoản và khi có đơn đã thanh toán. Không có migration, không đổi cách tính tiền hay cách tạo đơn.

### Thay đổi

- **Trang thanh toán của hội xếp một cột, từ trên xuống.** Trước đây trang chia hai cột hẹp lệch nhau, ô chọn thời hạn chật và vỡ chữ, nhãn "Rẻ hơn" nổi đè lên viền. Nay mọi thứ nằm trong một cột rộng (khoảng 660px trên máy tính, hết bề ngang trên điện thoại): tên hội và tên gói, Chọn thời hạn, Quyền lợi của gói, Cách thanh toán, Mã giảm giá, Tóm tắt đơn, rồi nút thanh toán. Mỗi thời hạn (1, 3, 12 tháng) là một hàng rộng: tên và nhãn "Rẻ hơn" nằm gọn bên trái, tổng tiền in đậm và giá quy ra mỗi tháng bên phải. Mỗi cách thanh toán cũng là một hàng cùng kiểu. Trang mua sản phẩm lẻ dùng cùng bố cục.
- **Điện thoại: tổng tiền và nút thanh toán ghim dưới đáy màn hình**, lúc nào cũng bấm được, cuộn hết trang thì thanh nằm lại cuối luồng nên không che dòng nào. Chữ lớn hơn (chữ thường từ 15px, tên lựa chọn và số tiền 17px), hàng bấm được cao từ 48px.
- **Màn mã QR chuyển khoản xếp một cột.** Tóm tắt đơn gọn trong một khối, "Tổng thanh toán" và số tiền nằm trên cùng một hàng, hạn giữ chỗ viết kiểu "19:16 ngày 21/11". Có ba bước hướng dẫn ngắn, mã QR to (đủ quét từ màn hình máy tính), rồi từng hàng rộng: Ngân hàng, Chủ tài khoản, Số tài khoản, Số tiền, Nội dung chuyển khoản. Ba hàng sau có nút "Sao chép" (bấm xong đổi thành "Đã sao chép"; số tiền chép ra số trơn không dấu chấm). Hàng nội dung chuyển khoản được làm nổi, câu lưu ý giữ đúng nội dung thành một khối nhắc riêng.
- **Chọn bằng bàn phím.** Hai nhóm lựa chọn (thời hạn, cách thanh toán) là nhóm radio đúng chuẩn: phím mũi tên chuyển và chọn hàng kế.

### Thêm

- **Nút "Lưu ảnh mã QR".** Người dùng điện thoại không tự quét được màn hình của mình, nên lưu ảnh mã về rồi chọn ảnh đó trong app ngân hàng. Nút chỉ hiện khi trình duyệt tải được ảnh về thật.
- **Màn cảm ơn và chờ xác nhận.** Sau khi bấm "Tôi đã chuyển khoản", người mua thấy một màn riêng thay vì chỉ một nút đổi chữ: lời cảm ơn, vòng xoay chờ và dòng nói rõ đang chờ gì (chủ hội kiểm tra tài khoản và xác nhận, hoặc ngân hàng báo về), tóm tắt đơn kèm nội dung chuyển khoản, và thẻ chủ hội (ảnh, tên, tên định danh) với nút "Nhắn tin cho chủ hội" để gửi ảnh chụp giao dịch khi chờ lâu. Chủ hội tắt nhận tin nhắn riêng thì thay bằng link xem hồ sơ. Có mục "Xem lại thông tin chuyển khoản" để mở lại mã QR, và nút "Về trang hội". Trang tự chuyển sang màn "Đã nhận thanh toán" khi đơn được xác nhận, với nút vào thẳng thứ vừa mua.
- **Email cho chủ hội khi có người báo đã chuyển khoản.** Ở đơn chủ hội tự xác nhận, người mua bấm "Tôi đã chuyển khoản" thì chủ hội nhận một email: ai mua, mua gì, số tiền, nội dung chuyển khoản cần đối chiếu, và nút mở trang Tiền của hội để xác nhận. Mỗi đơn chỉ gửi một lần.
- **Email cho chủ hội khi có đơn đã thanh toán.** Đơn của hội được thanh toán xong (ngân hàng hoặc cổng báo về, hoặc chủ hội bấm "Đã nhận tiền") thì chủ hội nhận một email báo đơn mới. Trước đây chủ hội chỉ có thông báo trong ứng dụng.

### Kỹ thuật

- Web: `apps/web/src/pages/community/CheckoutParts.tsx` (khung một cột, `RadioRows`, `RadioRow`, `Totals`, `BankQrCard`), `CheckoutConfigure.tsx`, `CheckoutOrder.tsx` (mới, tách màn của một đơn khỏi `Checkout.tsx`). Không đổi tham số gọi `POST /v1/checkout` hay cách truyền `ref`.
- Máy chủ: `GET /v1/orders/:id` trả thêm `targetType` và `seller` (hội và chủ hội của đơn, chỉ thông tin công khai trên hồ sơ: tên, tên định danh, ảnh, có nhận tin nhắn không; đơn mua gói Hội Mình thì `seller` là null). `markProcessing` cập nhật có điều kiện để hai lần bấm sát nhau chỉ báo chủ hội một lần.
- Email: hai mẫu mới `owner_transfer_reported` và `owner_order_paid` trong `packages/email/src/templates.ts`, gửi qua `ctx.email` như các email khác (lỗi gửi chỉ ghi log). Email đơn đã thanh toán nghe sự kiện `payment.succeeded` ở `packages/core/src/events/owner-emails.ts`, đăng ký trong `app.ts`.
- Test: `packages/core/src/test/owner-order-emails.test.ts`; E2E 03, 22, 24, 26 sửa theo vai trò radio và màn chờ mới.

## 1.45.0 - 2026-11-22

Thêm hai trang công khai Điều khoản sử dụng và Chính sách quyền riêng tư, theo báo lỗi của chủ dự án (mở `/dieu-khoan` và `/quyen-rieng-tu` thì hiện "Có lỗi xảy ra · Hội không tồn tại"). Chỉ sửa giao diện web và danh sách đường dẫn giữ chỗ, không có migration. Nội dung hai trang là BẢN NHÁP soạn theo cách sản phẩm đang chạy: chủ dự án (và luật sư nếu cần) đọc duyệt trước khi coi là chính thức.

### Thêm

- **Trang Điều khoản sử dụng (`/dieu-khoan`).** 15 phần viết bằng lời thường: ai là ai trên Hội Mình, tài khoản, tiền mua bán trong hội đi thẳng tới chủ hội (Hội Mình không giữ hộ, không thu phí giao dịch), hoàn tiền trong 7 ngày nếu xem chưa quá 20% nội dung, gói Hội Mình của chủ hội (trả trước theo kỳ, không tự trừ tiền, gia hạn, nâng gói, ngừng dùng), trách nhiệm của chủ hội, affiliate và hoa hồng, nội dung và hành vi bị cấm, báo cáo vi phạm và khóa tài khoản, luật áp dụng, liên hệ.
- **Trang Chính sách quyền riêng tư (`/quyen-rieng-tu`).** 11 phần: dữ liệu đang thu, dùng để làm gì, ai xem được, bên thứ ba nhận dữ liệu, cookie và bộ nhớ trình duyệt kèm thời hạn từng cái, thời gian lưu và cách bảo vệ, xóa tài khoản, quyền của bạn và cách thực hiện bằng chức năng đang có.
- **Cả hai trang** mở được khi chưa đăng nhập, có ngày cập nhật, mục lục bấm nhảy tới từng phần, các phần đánh số, và link sang trang còn lại ở cuối. Chữ thân bài 17px, giãn dòng 1.7, bề ngang phần chữ tối đa 720px, đọc gọn trên điện thoại.

### Sửa

- **Mở `/dieu-khoan` hoặc `/quyen-rieng-tu` thì hiện "Hội không tồn tại".** Hai địa chỉ này chưa có trang nên rơi vào trang của hội, và web đi tìm một hội có đường dẫn `dieu-khoan`. Nay là hai trang riêng.
- **Hai link ở ô "Tôi đồng ý với Điều khoản và Chính sách quyền riêng tư" của trang đăng ký.** Trước đây bấm vào thì rời trang đăng ký (mất chữ đã gõ) và ô đồng ý bị đánh dấu theo. Nay hai link mở trang ở thẻ mới, không đụng tới ô đồng ý.
- **Dòng "Điều khoản · Quyền riêng tư" ở chân khung đăng nhập, đăng ký** trước chỉ là chữ, nay là hai link.

### Thay đổi

- **Không hội nào đặt được đường dẫn `dieu-khoan` hay `quyen-rieng-tu`.** Hai tên này vào danh sách đường dẫn hệ thống giữ chỗ, áp dụng cả lúc tạo hội lẫn lúc đổi đường dẫn.

### Kỹ thuật

- Chữ của hai trang nằm trong tệp dữ liệu, tách khỏi giao diện: `apps/web/src/pages/public/legal/terms.ts`, `privacy.ts` và `contact.ts` (mảng các phần gồm đoạn văn, tiêu đề nhỏ, danh sách, ô lưu ý). `LegalDocument.tsx` dựng cả hai trang từ dữ liệu đó. Muốn sửa chữ thì sửa tệp dữ liệu và đổi ngày `updatedAt`.
- Email hỗ trợ ở mục Liên hệ để trống (`LEGAL_CONTACT_EMAIL` trong `contact.ts`) vì trong repo chưa có địa chỉ nào được xác nhận là hộp thư hỗ trợ thật. Điền một dòng là hiện trên cả hai trang.
- Route `/dieu-khoan` và `/quyen-rieng-tu` thêm vào nhóm trang công khai của `apps/web/src/app/router.tsx`; `RESERVED_SLUGS` trong `packages/config` thêm hai tên.
- Test: `apps/web/src/pages/public/legal/content.test.ts` (neo không trùng, link trỏ tới trang có trong router, không có gạch ngang dài, không sót chữ giữ chỗ), `packages/config/src/reserved-slugs.test.ts`, `packages/core/src/test/reserved-slugs.test.ts` (tạo hội, đổi đường dẫn, dữ liệu mẫu), E2E `29-dieu-khoan-quyen-rieng-tu`.
- Chưa kiểm được trên database thật xem có hội nào đang dùng hai đường dẫn này. Nếu có, hội đó phải đổi đường dẫn vì địa chỉ nay thuộc về trang pháp lý.

## 1.44.2 - 2026-11-22

Thông tin riêng của thành viên trong khung chat chỉ còn người quản lý hội thấy, theo yêu cầu của chủ dự án. Không có migration.

### Sửa

- **Ai trò chuyện cũng xem được tiến độ học và người giới thiệu của người kia.** Bảng "Thông tin hội thoại" trong Tin nhắn vốn làm cho chủ hội xem thành viên của mình, nhưng máy chủ trả đủ thông tin cho bất kỳ ai đang trò chuyện. Vì vậy một thành viên thường mở cuộc trò chuyện với thành viên khác (hoặc với chủ hội) là thấy tình trạng thành viên, giá gói, khóa đang học kèm phần trăm tiến độ, và người đã giới thiệu người đó. Nay chỉ chủ hội và quản trị của hội thấy các thông tin này.
- Người xem khác (thành viên thường, điều hành viên) chỉ còn thấy đúng những gì danh bạ thành viên của hội vốn đã cho mọi thành viên xem: vai trò, tên gói, ngày tham gia.

### Kỹ thuật

- `packages/core/src/services/messaging.ts`: `memberPanel` kiểm quyền `member.manage` của người xem trong hội của cuộc trò chuyện; không có quyền thì `status`, `tier.monthlyMinor`, `learning`, `referrer` là null. Giao diện vốn tự ẩn các dòng không có dữ liệu nên không phải sửa bố cục.
- Test: `packages/core/src/test/messaging.test.ts` thêm 2 ca (chủ hội thấy đủ, thành viên thường và chiều ngược lại chỉ thấy phần công khai, hội thoại không gắn hội thì không có thông tin thành viên).

## 1.44.1 - 2026-11-22

Bảng "Thông tin hội thoại" trong Tin nhắn gọn lại, theo góp ý của chủ dự án. Chỉ sửa giao diện web, không có migration.

### Thay đổi

- **Bảng thông tin hội thoại chỉ còn một nút "Xem chi tiết hồ sơ".** Bỏ hàng bốn nút tròn (Ghim hội thoại, Xem hồ sơ, Quản lý thành viên, Lưu trữ hội thoại). Nút "Quản lý thành viên" bị bỏ hẳn vì không hợp với một khung trò chuyện.
- **Ghim và lưu trữ hội thoại nằm ở menu ba chấm.** Menu ba chấm ở đầu khung chat nay có thêm "Ghim hội thoại" và "Lưu trữ hội thoại" (trước chỉ có ở menu ba chấm trên từng dòng của danh sách), nên đang mở một cuộc trò chuyện trên điện thoại vẫn ghim và lưu trữ được.

### Kỹ thuật

- `apps/web/src/pages/account/MessagesParts.tsx` (`InfoPanel` bỏ các prop ghim và lưu trữ), `MessagesMenus.tsx` (`ChatMenu` nhận thêm ghim và lưu trữ), `MessagesThread.tsx`; gỡ các lớp `.chat-quick` không còn dùng trong `packages/ui/src/styles.css`.
- E2E `17-tin-nhan-kieu-zalo` kiểm bảng thông tin chỉ có nút hồ sơ và menu ba chấm có ghim, lưu trữ.

## 1.44.0 - 2026-11-22

Bấm chuông thì hiện bảng thông báo nổi ngay tại chỗ thay vì nhảy sang trang Thông báo, và thông báo chưa đọc luôn đứng đầu, theo yêu cầu của chủ dự án. Không có migration, không đổi API.

### Thêm

- **Bảng thông báo nổi ở nút chuông.** Bấm chuông ở đầu trang (khung hội, Khu học tập, khung chủ hội) thì bảng thông báo mở ngay tại chỗ, không rời trang đang xem. Máy tính: bảng thả dưới nút chuông, danh sách cuộn bên trong. Điện thoại: bảng trượt từ đáy lên, rộng hết màn hình, có nút đóng. Đóng bằng Esc, bấm ra ngoài, hoặc khi chuyển trang.
- **Hai mục "Chưa đọc" và "Tất cả".** Còn thông báo chưa đọc thì bảng mở sẵn mục "Chưa đọc"; đọc hết rồi thì mở "Tất cả". Ở "Tất cả", cái chưa đọc đứng trước (có chấm, chữ đậm), cái đã đọc đứng sau và nhạt hơn. Ở "Chưa đọc" mà không còn gì thì hiện lời báo đã đọc hết kèm nút xem lại thông báo đã đọc.
- **Đánh dấu đã đọc từng cái.** Mỗi thông báo chưa đọc có nút tròn "Đánh dấu đã đọc" để đọc mà không phải mở. Bấm vào thông báo thì đánh dấu đã đọc, đóng bảng và đi tới nơi thông báo nhắc tới. Nút "Đánh dấu tất cả đã đọc" chỉ bật khi còn cái chưa đọc.
- **Nút "Cài đặt" trong bảng.** Dẫn thẳng tới phần cài đặt của trang Thông báo (`/thong-bao#cai-dat`): trang tự cuộn tới "Cài đặt nhanh" và "Theo cộng đồng", kể cả trên điện thoại nơi phần này nằm dưới danh sách. Trang Thông báo trên điện thoại cũng có nút "Cài đặt thông báo" ở đầu trang.

### Thay đổi

- **Chuông hiện số thông báo chưa đọc** thay cho chấm đỏ: 1 đến 9 hiện đúng số, nhiều hơn thì "9+". Đánh dấu đã đọc thì số trên chuông và danh sách đổi ngay lúc bấm, không chờ tải lại.
- **Trang Thông báo xếp cái chưa đọc lên đầu** (khối "Chưa đọc"), phần đã đọc nhạt hơn và chia theo ngày như trước. Trang và bảng nổi dùng chung một kiểu dòng thông báo.

### Sửa

- **Nút hành động trong dòng thông báo ("Vào học", "Trả lời", "Xem ví") bị lệch.** Trước đây chữ dính sát mép trên của nút, phía dưới thừa khoảng trống, và nút đứng lệch lên trên so với dòng. Nay chữ nằm chính giữa nút, nút cao 36px và nằm giữa dòng theo chiều dọc, không xuống dòng. Trên điện thoại và trong bảng nổi (chỗ hẹp), nút nằm dưới dòng chữ, căn trái, cao 44px, để chữ không bị ép thành cột hẹp; trước đây trên điện thoại nút này bị ẩn hẳn.

### Kỹ thuật

- Nguyên nhân nút lệch: thẻ nút mang cả lớp `btn` lẫn `hide-mobile`. `.hide-mobile { display: initial }` khai báo sau `.btn` trong `styles.css` nên đè mất `display: inline-flex` của `.btn`; nút thành một khối thường, `align-items` và `justify-content` hết tác dụng nên chữ nằm ở mép trên của khung cao 36px. Thêm nữa hàng dùng `align-items: flex-start` nên nút đứng ở đầu dòng thay vì giữa dòng. Nay nút không mang `hide-mobile`, khối chữ và nút nằm trong `.notif-content` (hàng ngang khi rộng, cột khi hẹp).

- `apps/web/src/components/NotificationBell.tsx` (chuông và bảng nổi), `apps/web/src/components/NotificationRow.tsx` (dòng thông báo dùng chung), thay ba link chuông ở `AppShell.tsx`, `LearnerShell.tsx`, `WorkspaceShell.tsx`.
- `apps/web/src/lib/notifications.ts`: logic thuần (nhãn số "9+", đích của thông báo, ghép "chưa đọc" với "tất cả" và bỏ trùng, chia khối, cập nhật bộ nhớ đệm khi đánh dấu đã đọc), có test trong `notifications.test.ts`. `apps/web/src/lib/use-notifications.ts`: truy vấn và thao tác đánh dấu đã đọc dùng chung.
- Thứ tự "chưa đọc trước" làm ở giao diện bằng hai danh sách sẵn có của API (`filter=unread` và `filter=all`); `listNotifications` ở máy chủ và phân trang cursor giữ nguyên.
- Kiểu dáng thêm vào `packages/ui/src/styles.css` (các lớp `.notif-*`).
- Test trình duyệt: `e2e/tests/29-bang-thong-bao.spec.ts` (mở bảng tại chỗ, số trên chuông, đánh dấu đã đọc, Esc và bấm ra ngoài, nút Cài đặt, bảng trượt trên điện thoại).

## 1.43.0 - 2026-11-22

Mỗi người tự chọn được một mã giới thiệu chung, dùng cho link của mọi chương trình mình làm affiliate, theo yêu cầu của chủ dự án. Có migration `0019_affiliate_user_codes` (thêm một bảng, không đổi dữ liệu cũ).

### Thêm

- **Đổi mã giới thiệu, một mã cho mọi nơi.** Ở trang Tài khoản, mục Affiliate, cạnh nút "Sao chép mã" có nút "Đổi mã". Bạn chọn một mã dễ nhớ (3 đến 20 ký tự, chữ không dấu và số, ví dụ `minhquy`) và mã đó dùng cho link Hội Mình lẫn link của mọi hội bạn làm affiliate. Mã không được trùng với mã của bất kỳ ai trên toàn nền tảng, không trùng tên định danh của người khác, và không dùng các tên dành cho hệ thống.
- **Mỗi người chỉ đổi được một lần.** Bảng đổi mã bắt xác nhận trước khi lưu. Lưu xong thì nút "Đổi mã" biến mất. Mã không hợp lệ hoặc đã có người dùng thì chưa mất lượt.
- **Link cũ không hỏng.** Link đã chia sẻ với mã cũ vẫn chạy và vẫn tính hoa hồng. Trang Affiliate ghi rõ mã cũ nào còn hiệu lực.
- **Thành viên chưa từng lấy link vẫn dùng được mã chung ở hội mình đang tham gia.** Ví affiliate của hội đó tự mở khi có người đầu tiên đi qua link, như lúc tự mở trang Affiliate.

### Thay đổi

- **Trang Affiliate trong Tài khoản nay tên là "Affiliate của tôi".** Để khỏi lẫn với phần quản lý chương trình affiliate của hội.

### Không đổi

- Luật tính hoa hồng giữ nguyên. Link mở ở trang của một hội (trang giới thiệu, trang sản phẩm) chỉ tính cho chương trình của hội đó; link mở ở trang nền tảng (trang chủ, trang mở hội) chỉ tính cho chương trình nền tảng. Người vào một hội mà chưa có người giới thiệu nền tảng thì người giới thiệu nền tảng vẫn mặc định là chủ hội.

### Kỹ thuật

- Bảng `affiliate_user_codes` (mỗi người một dòng, mã duy nhất), có RLS như các bảng khác. Mã riêng của từng tài khoản affiliate (`affiliate_accounts.affiliate_code`) không đổi.
- `packages/core/src/services/referral-codes.ts`: `setMyReferralCode`, `myReferralCode`, và `canonicalRefs` đổi mã chung thành mã riêng của đúng một chương trình ở cửa vào (`attachAttribution`, `accountForCodes`, `trackClick`, `recordLandingClick`), nên phần tính người giới thiệu và hoa hồng phía sau chạy như cũ.
- Mã trong cookie `hm_ref` và các trường `ref` nay có dạng `mã.phạm-vi` (phạm vi là trang mà link được mở, web tự gắn lúc ghi nhớ); mã không có phạm vi (cookie cũ, mã gõ tay) vẫn được nhận. Trường `ref` nới giới hạn từ 300 lên 700 ký tự.
- API: `GET` và `PUT /v1/me/referral-code`. Ví (`/v1/me/affiliate/:programId`) trả thêm `codeEditable`, `previousCode`.
- Test: `packages/core/src/test/referral-code.test.ts` (15 ca), bổ sung `apps/web/src/lib/referral.test.ts` và `affiliate-link.test.ts`. Các test hoa hồng sẵn có không sửa và vẫn qua.

## 1.42.0 - 2026-11-22

Rà soát toàn bộ MCP, API key và webhook theo yêu cầu của chủ dự án ngày 21/11/2026: đối chiếu từng route REST với bảng quyền của API key và bộ lệnh MCP, bổ sung những chỗ còn thiếu để trợ lý AI thêm, sửa, xóa được ở bài viết, bình luận, thành viên, affiliate, sự kiện, webhook và cài đặt. Bộ lệnh MCP từ 100 lên 121 lệnh. Kèm theo đó sửa link mời vào hội (lỗi tìm ra khi rà): mã mời trên link trước đây không được đọc lại. Không có migration.

### Thêm

- **Sửa bình luận.** Trước đây bình luận chỉ tạo, ghim và xóa được. Nay có `PATCH /v1/comments/:id` và lệnh `update_comment` (tác giả hoặc người kiểm duyệt sửa nội dung; ảnh, lượt thích, các trả lời giữ nguyên).
- **Thả cảm xúc qua API key.** Lệnh `toggle_reaction` thả, đổi, gỡ cảm xúc ở bài viết và bình luận dưới tên chủ hội.
- **Hủy sự kiện và xóa bản ghi.** Lệnh `cancel_event` (`DELETE /v1/events/:id`) đưa buổi sang trạng thái đã hủy: biến khỏi lịch, ngừng nhắc, dữ liệu còn nguyên; `update_event` với `status: "scheduled"` mở lại. Lệnh `delete_event_recording` gỡ một bản ghi khỏi mục Xem lại.
- **Quản lý từng affiliate.** Lệnh `list_affiliates` liệt kê affiliate của hội kèm mã, lượt bấm, số đơn, hoa hồng đang giữ, rút được, đã trả. Lệnh `update_affiliate` tạm khóa, mở lại hoặc đặt tỉ lệ hoa hồng riêng cho một affiliate. Lệnh `export_withdrawals_csv` xuất bảng đối soát.
- **Thu hồi khóa học đã cấp tay.** Lệnh `revoke_course` là chiều ngược của `grant_course`; quyền có do mua hoặc do gói không bị đụng tới.
- **Xuất thành viên ra CSV.** Lệnh `export_members_csv`.
- **Sửa, gửi thử, đổi secret webhook.** Lệnh `update_webhook` (đổi địa chỉ, đổi sự kiện, tạm dừng, bật lại webhook đã tự dừng vì lỗi), `test_webhook` (gửi sự kiện `ping` qua đúng đường giao thật), `rotate_webhook_secret`.
- **Ba sự kiện webhook mới.** `member.removed` (bị mời ra), `member.banned` (bị khóa), `affiliate.withdrawal_requested` (affiliate gửi yêu cầu rút, để trợ lý báo chủ hội xử lý ngay). Tổng cộng 15 sự kiện.
- **Cài đặt hội.** Lệnh `get_community_about` đọc trang giới thiệu (gồm câu hỏi tham gia đang đặt, trước đây chỉ ghi được mà không đọc lại được), `update_about_media` đặt bộ ảnh và video giới thiệu.
- **Tin nhắn và thông báo.** Lệnh `recall_message` (thu hồi tin đã gửi), `archive_conversation`, `mark_notifications_read`.
- **Lời mời đang chờ và thu hồi lời mời.** Khung "Mời thành viên" hiện danh sách lời mời chưa có người nhận (email, vai trò, ngày hết hạn) kèm nút Thu hồi. Qua API và MCP có `list_invites` và `revoke_invite`.
- **Việc lặt vặt còn thiếu lệnh.** `rotate_inbound_source` (đổi địa chỉ nguồn đồng bộ khi bị lộ), `delete_file` (bỏ tệp tải lên mà không dùng).

### Sửa

- **Link mời vào hội không có tác dụng.** Email mời chứa link `?invite=<mã>` nhưng không nơi nào đọc lại mã đó: người được mời vẫn phải trả lời câu hỏi và chờ duyệt như người lạ, mời với vai trò quản trị viên không trao quyền gì, và lời mời không bao giờ hết hạn hay được đánh dấu đã nhận. Nay người được mời mở link, đăng ký hoặc đăng nhập xong là vào thẳng hội: không chờ duyệt, không câu hỏi, vào được cả khi hội đã đóng cổng. Mời làm quản trị viên thì người đó nhận đúng vai trò quản trị (thành viên sẵn có được nâng lên). Lời mời gửi qua email dùng một lần trong 14 ngày và chỉ đúng email được mời, đã xác minh, mới nhận được; hết hạn, đã dùng, sai người hay đã thu hồi đều có lời báo rõ trên trang hội. Hội thu phí: được mời làm thành viên vẫn phải thanh toán.
- **Không hủy được sự kiện.** Tầng dịch vụ nhận `status` khi sửa sự kiện nhưng hợp đồng API bỏ trường này đi, nên không có đường nào (web, REST, MCP) hủy được một buổi. Nay `updateEventSchema` nhận `status` là `scheduled` hoặc `cancelled`.

## 1.41.3 - 2026-11-22

Trang bán của khóa học hiện lại ảnh bìa, theo báo lỗi của chủ dự án (trang mở từ link affiliate chỉ thấy nền màu). Không có migration, không cần sửa dữ liệu.

### Sửa

- **Trang bán và thẻ cửa hàng của khóa học mất ảnh bìa.** Lúc khóa học được đăng lần đầu, hệ thống tạo sản phẩm cửa hàng nhưng không chép ảnh bìa của khóa học sang, nên trang bán (nơi link affiliate dẫn tới) chỉ hiện nền màu dù khóa học đã có ảnh. Nay sản phẩm tạo ra mang luôn ảnh bìa của khóa học. Sản phẩm đã tạo từ trước cũng hiện ảnh ngay: trang bán và cửa hàng lấy ảnh của khóa học khi sản phẩm chưa có ảnh riêng.
- **Chữ tiêu đề đè lên ảnh bìa ở trang bán.** Có ảnh bìa thì trang bán không vẽ tiêu đề lên trên ảnh nữa, giống thẻ ở cửa hàng và trang khóa học. Tên sản phẩm vẫn nằm ngay bên dưới. Chưa có ảnh thì vẫn là nền màu kèm tiêu đề như trước.

### Kỹ thuật

- `packages/core/src/services/store.ts`: `createProduct` chép `courses.coverUrl` khi sản phẩm loại khóa học không tải ảnh riêng; `getProduct` và `listProducts` trả `coverUrl` của khóa học khi bản sao ở sản phẩm trống (hàm `coverOf`).
- Test: `packages/core/src/test/file-cleanup.test.ts` thêm ca đăng khóa học bán lẻ lần đầu, khách chưa đăng nhập đọc trang bán, và sản phẩm cũ có bản sao ảnh trống.

## 1.41.2 - 2026-11-22

Đăng ký hoặc đăng nhập từ trang của một hội thì xong là vào thẳng hội đó, theo yêu cầu của chủ dự án. Chỉ sửa giao diện web, không đổi máy chủ, không có migration.

### Sửa

- **Bấm "Tham gia hội" trên thanh đầu trang của một hội rồi đăng ký thì bị đưa về màn Tạo hội.** Nút này mở trang đăng ký trơn, không nhớ người đó đang xem hội nào. Nay nút mang theo hội đang xem (cả ở trang giới thiệu hội lẫn trang bán sản phẩm cho người ngoài), và nút "Đăng nhập" bên cạnh quay lại đúng chỗ: trang giới thiệu thì vào Bảng tin của hội, trang sản phẩm thì về lại sản phẩm đó.
- **Đăng ký từ nút "Tham gia" của hội xong vẫn phải bấm "Tham gia" lần nữa.** Trước đây xác minh email xong thì quay về trang giới thiệu và dừng ở đó. Nay trang tự làm tiếp việc của nút Tham gia: hội miễn phí vào luôn Bảng tin, hội có câu hỏi thì bảng câu hỏi tự mở, hội thu phí thì sang bước thanh toán. Hội chưa mở, đã đóng cổng, hoặc đang chờ duyệt thì trang giới thiệu báo đúng lý do như trước. Link "vào hội ngay" ở màn xác minh email cũng đi đường này.
- **Đăng ký hoặc đăng nhập bằng Google từ trang của một hội thì rơi về "Hội của tôi".** Trình duyệt rời hẳn trang để sang Google nên mất chỗ đang xem. Nay nơi cần về được cất tạm trong phiên trình duyệt và dùng lại đúng một lần khi Google trả về.

### Không đổi

- Đăng ký không từ hội nào (mở thẳng trang đăng ký, hoặc đi từ Bảng giá) vẫn vào màn Tạo hội như trước.

### Kỹ thuật

- `apps/web/src/lib/join-intent.ts`: tham số `?thamgia=1` trên trang giới thiệu hội, link đăng ký và đăng nhập có ngữ cảnh hội, đích cất qua bước Google (chỉ nhận đường dẫn trong trang). `AboutRail` đọc tham số, gỡ nó khỏi địa chỉ rồi chạy `onJoin` một lần; khách chưa đăng nhập mở link có tham số thì không có gì xảy ra.
- `PublicHeader` nhận thêm `join` (hội đang xem và nơi về sau đăng nhập); thiếu thì hai nút như cũ.
- Test: `apps/web/src/lib/join-intent.test.ts` (5 ca); E2E `01-dang-ky-tham-gia` kiểm bảng câu hỏi tự mở sau đăng ký, đăng ký từ thanh đầu trang của một hội thu phí sang thẳng bước thanh toán của hội đó, và thành viên đăng nhập từ trang hội vào Bảng tin.
- Phần Google chưa chạy thử được ở máy phát triển (đăng nhập Google chưa bật ở đó); phần cất và lấy đích có test đơn vị.

## 1.41.1 - 2026-11-21

Người vào hội được ghi chủ hội làm người giới thiệu nền tảng ngay cả khi hệ thống chưa có chương trình affiliate nền tảng. Theo yêu cầu của chủ dự án. Không có migration.

### Sửa

- **Người vào hội sớm bị bỏ sót người giới thiệu nền tảng.** Luật của bản 1.37.0: người vào một hội mà tài khoản chưa có người giới thiệu nền tảng thì chủ hội đó là người giới thiệu nền tảng. Nhưng luật này bỏ qua khi hệ thống chưa có chương trình affiliate nền tảng, mà chương trình chỉ được tạo lúc có người mở trang Affiliate lần đầu (bản 1.40.0). Ai vào hội trước thời điểm đó thì không được ghi, và về sau cũng không được ghi lại. Nay chương trình được tạo ngay ở lần đầu có người vào một hội.
- Chương trình nền tảng đang tạm dừng thì vẫn không ghi, như cũ.

## 1.41.0 - 2026-11-21

Trang bán của sản phẩm mở cho mọi người, để link sản phẩm (của affiliate, của chủ hội đem đi quảng cáo) đưa người lạ tới đúng sản phẩm. Theo yêu cầu của chủ dự án. Không có migration.

### Thay đổi

- **Ai cũng mở được trang bán của một sản phẩm**, kể cả người chưa đăng nhập và kể cả khi hội là hội kín. Trước đây người chưa đăng nhập bị đưa về trang đăng nhập, và người đã đăng nhập mà chưa vào hội bị đưa về trang giới thiệu hội, nên link sản phẩm không bao giờ tới được sản phẩm.
- Người ngoài của hội kín thấy trang bán trong khung trang công khai: đầu trang có dải "Sản phẩm của hội" kèm nút "Xem giới thiệu hội", không có thanh bên của hội. Lối quay lại dẫn về trang giới thiệu hội thay cho cửa hàng.
- Bấm "Mua ngay" mới phải đăng nhập hoặc đăng ký; xong thì quay lại đúng trang thanh toán của sản phẩm đó. Người ngoài mua lẻ như trước, không bị thêm vào hội.
- Bài xem thử và nút "Vào học" của người ngoài mở ở Khu học tập, vì họ không vào được bên trong hội.
- Mọi trang khác của hội kín (cửa hàng, bảng tin, khóa học, sự kiện, thành viên) vẫn đóng với người ngoài. Thành viên và khách xem hội mở thấy trang bán như cũ.

### Sửa

- Trang Affiliate bỏ dòng ghi chú "Trang sản phẩm chỉ mở cho người đã đăng nhập" vì không còn đúng.

## 1.40.1 - 2026-11-21

Ô "Lượt bấm" ở trang Affiliate đếm được link dạng `?ref=`. Theo yêu cầu của chủ dự án. Không có migration.

### Sửa

- **Lượt bấm gần như luôn bằng 0.** Trước đây chỉ link dạng `/r/<mã>` mới ghi lượt bấm, trong khi mọi link trang Affiliate đưa ra (trang hội, trang sản phẩm, trang mở hội) đều là dạng `?ref=<mã>`. Nay mở link nào có `?ref=` cũng được đếm một lượt.
- Không đếm trùng: cùng một người xem mở lại hoặc tải lại trang trong 30 phút chỉ tính một lượt. Chính affiliate tự mở link của mình thì không tính. Mã không tồn tại, tài khoản affiliate hoặc chương trình đang tắt thì không tính.
- Cách tính người giới thiệu và hoa hồng không đổi: phần sửa này chỉ đếm lượt bấm.

## 1.40.0 - 2026-11-21

Trang Tài khoản → Affiliate lấy được link giới thiệu của nền tảng, của từng hội và của từng sản phẩm. Theo yêu cầu của chủ dự án, sau khi web thật không lấy được link nào. Không có migration.

### Thêm

- **Lấy link theo ba bước.** Bước 1 chọn nơi muốn giới thiệu (Nền tảng Hội Mình, hoặc từng hội đang tham gia), bước 2 chọn trang muốn chia sẻ, bước 3 sao chép link. Phần chọn luôn hiện, kể cả khi chỉ có một chương trình; trước đây hàng chọn chỉ hiện khi có từ hai chương trình trở lên.
- **Link cho từng sản phẩm.** Trong một hội, ngoài trang giới thiệu hội còn chọn được từng khóa học, combo, sản phẩm số đang bán. Mỗi dòng ghi giá và hoa hồng ước tính. Nhiều sản phẩm thì có ô tìm. Trước đây link sản phẩm chỉ nằm trong trang bán của từng sản phẩm, và chỉ hiện sau khi đã từng mở trang Ví.
- **Link nền tảng có hai trang.** Trang mở hội (cho người muốn mở hội riêng) và trang chủ Hội Mình.
- **Nút "Sao chép link" lớn, link hiện đủ không bị cắt**, có thêm nút Chia sẻ trên điện thoại và nút sao chép riêng mã giới thiệu. Trình duyệt không cho sao chép tự động thì trang báo để người dùng tự nhấn giữ vào link.
- **Hội chưa bật affiliate vẫn hiện trong danh sách**, kèm lý do. Người quản lý hội có nút "Bật affiliate cho hội" dẫn thẳng tới Cài đặt · Affiliate; thành viên thì được báo là chủ hội chưa bật.
- Trang nhớ chương trình xem lần trước trên máy đó. Lần đầu thì mở hội mà bạn đã có ví, không có thì mở chương trình nền tảng.

### Sửa

- **Web thật không có chương trình affiliate nền tảng.** Dòng này trước đây chỉ có trong dữ liệu mẫu, nên không ai lấy được link nền tảng và trang Hệ thống · Affiliate nền tảng báo lỗi. Nay hệ thống tự tạo khi chưa có, với mức mặc định 40% trong 12 tháng đầu, giữ 30 ngày, rút tối thiểu 500.000đ. Quản trị hệ thống đổi mức ở trang Hệ thống · Affiliate nền tảng.
- **Màn "Chưa có chương trình affiliate" không có lối đi tiếp.** Người ở trong hội chưa bật affiliate chỉ thấy một dòng thông báo. Nay luôn có link nền tảng, và hội chưa bật có hướng dẫn đi tiếp.
- **Hội tắt affiliate thì ví biến mất.** Người đã có hoa hồng trong một hội vừa tắt chương trình không còn lối vào ví để rút. Nay hội đó vẫn nằm trong danh sách, ví vẫn xem và rút được, chỉ ẩn phần link.
- Đổi chương trình không còn tải lại cả trang.
- Mức hoa hồng trên ô chọn chương trình lấy theo mức riêng của tài khoản (nếu quản trị đã đặt), không chỉ mức chung.

## 1.39.1 - 2026-11-21

Sửa thẻ hội ở cột phải trang Bảng tin, theo báo lỗi của chủ dự án. Không có migration.

### Sửa

- **Ảnh bìa ở thẻ hội trên Bảng tin bị cắt và bị chồng chữ.** Trước đây thẻ ép ảnh bìa vào khung cao 120px nên ảnh bị cắt trên dưới, và in khẩu hiệu của hội bằng chữ trắng đè lên ảnh. Nay hội có ảnh bìa thì thẻ hiện trọn ảnh tỉ lệ 16:9, giống thẻ ở trang giới thiệu, và không chồng chữ lên ảnh nữa (tên hội đã có ngay bên dưới). Hội chưa có ảnh bìa thì vẫn là nền màu kèm khẩu hiệu như cũ.

## 1.39.0 - 2026-11-21

Thêm lựa chọn hội kín hay hội mở trong Cài đặt, theo yêu cầu của chủ dự án ngày 21/11/2026. Có migration database (`0018_community_visibility`): thêm cột `communities.visibility`, mặc định `private`, nên mọi hội đang có vẫn là hội kín như trước.

### Thêm

- **Hội kín hay hội mở.** Trong Cài đặt, mục Chung có thêm phần "Ai xem được bên trong hội" với hai thẻ để chọn: Hội kín (chỉ thành viên xem được bên trong) và Hội mở (ai cũng xem được, chỉ thành viên mới đăng bài, bình luận và học). Chạm một thẻ rồi bấm Lưu. Hội đang có và hội tạo mới mặc định là hội kín.
- **Khách xem được hội mở.** Với hội mở, người chưa vào hội (kể cả chưa đăng nhập) mở được Bảng tin, bài viết kèm bình luận, danh sách khóa học, Sự kiện, Thành viên và Cửa hàng ở chế độ chỉ xem. Đầu trang có dải "Bạn đang xem hội mở" kèm nút Tham gia hội. Bấm thả tim, bình luận, bình chọn, đăng ký sự kiện thì hiện lời mời tham gia thay vì báo lỗi.
- **Trang giới thiệu hội ghi rõ hội kín hay hội mở.** Hội mở có thêm nút "Xem trước bên trong", và các tab Bảng tin, Khóa học, Sự kiện, Thành viên không còn khóa với người chưa vào hội.
- **Ô lệnh của chủ hội** có thêm mục "Hội kín hay hội mở" dẫn thẳng tới chỗ cài đặt.

### Thay đổi

- **Danh bạ thành viên của hội mở** xem được mà không cần đăng nhập (tên, ảnh, giới thiệu ngắn; không có email). Hội kín vẫn chỉ thành viên xem được.

## 1.38.0 - 2026-11-21

Gói Hội Mình bán theo bốn kỳ với giá riêng từng kỳ, theo yêu cầu của chủ dự án ngày 21/11/2026. Thay luật "chỉ bán hai chu kỳ, giá 3 tháng và 1 năm tự tính từ giá tháng" của kế hoạch 11/11/2026. Có migration `0017_plan_cycle_prices`: thêm cột `plans.cycle_prices` (jsonb) và điền sẵn từ giá cũ, chạy lại được. **Áp dụng lên database thật trước khi merge.**

### Thêm

- **Bốn kỳ trả tiền: 1 tháng, 3 tháng, 6 tháng, 1 năm.** Số ngày của từng kỳ là 30, 90, 180, 365. Gia hạn nối tiếp và nâng gói tặng ngày còn lại vẫn như cũ, dùng được với mọi kỳ.
- **Quản trị nhập giá riêng cho từng kỳ của từng gói** ở Hệ thống, Gói nền tảng. Dưới mỗi ô có ghi giá quy ra mỗi tháng để dễ so.
- **Kỳ nào để giá 0 thì không bán.** Trang mua gói, bảng giá công khai và bước chọn gói khi tạo hội thứ hai chỉ hiện tab của kỳ có ít nhất một gói đang bán; gói không bán kỳ đang chọn thì không có thẻ ở kỳ đó. Gói để 0 ở cả bốn kỳ thì không hiện ở đâu để mua. Gọi thẳng API mua một kỳ có giá 0 cũng bị từ chối.
- **Lời mời tự tính theo giá đã nhập.** "Tặng 2 tháng" không còn viết cứng: mức lợi của kỳ dài tính so với kỳ ngắn nhất gói đang bán, ra số tháng tròn thì ghi "tặng N tháng", không thì ghi "tiết kiệm N%".

### Thay đổi

- **Sau khi cập nhật, trang mua gói chưa đổi gì.** Giá 3 tháng và 1 năm giữ nguyên con số đang bán; 1 tháng và 6 tháng để 0 (trước đây không bán) cho tới khi quản trị nhập giá.
- **Bảng gói có thêm hai luật kiểm tra khi lưu.** Trong một gói, kỳ dài hơn không được có tổng tiền thấp hơn kỳ ngắn hơn (bắt lỗi gõ thiếu một số 0). Gói cao hơn không được rẻ hơn gói thấp hơn ở kỳ mà cả hai cùng bán.
- **Bảng so sánh** có một dòng giá cho mỗi kỳ đang bán, gói không bán kỳ đó ghi "Không bán". Bỏ dòng "Giá niêm yết mỗi tháng".
- **Lời mời nâng gói** ghi "từ ... mỗi tháng" theo kỳ rẻ nhất, và không gợi ý gói đã ngừng bán.
- **Dãy tab kỳ hạn trên điện thoại** thu lề để bốn tab nằm gọn một hàng.
- API: `GET /v1/plans` và `GET /v1/admin/plans` trả `prices` (`monthly`, `quarterly`, `semiannual`, `yearly`) thay cho `monthlyMinor`; `PUT /v1/admin/plans` nhận `prices`; `POST /v1/checkout` cho gói nhận thêm `cycle` là `monthly` và `semiannual`. Số liệu gói trả `cycleCounts` thay cho `quarterlyCount`, `yearlyCount`.

## 1.37.1 - 2026-11-21

Đổi tên biến trong mẫu tin nhắn chào tự động sang tiếng Anh, viết liền, theo yêu cầu của chủ dự án. Không có migration.

### Thay đổi

- **Biến trong mẫu tin nhắn chào viết bằng tiếng Anh, viết liền.** `{{tên}}` thành `{{full_name}}`, `{{cộng đồng}}` thành `{{community_name}}`, `{{link bắt đầu}}` thành `{{start_link}}`, cùng kiểu với biến của Quy tắc tự động (`{{name}}`, `{{email}}`). `{{full_name}}` là họ tên đầy đủ của thành viên: tin nhắn chào nay viết "Chào Nguyễn Văn An" thay vì "Chào An" như biến `{{tên}}` trước đây. Mẫu chủ hội đã lưu bằng tên cũ vẫn gửi được, và trang Tiện ích hiện mẫu đó bằng tên mới; lần lưu kế tiếp database nhận tên mới. Hội tạo mới dùng mẫu mặc định với tên mới.

## 1.37.0 - 2026-11-21

Chốt cách tính link và cookie cho affiliate, tách rõ hai tầng: affiliate nền tảng và affiliate của từng hội. Theo yêu cầu của chủ dự án. Không có migration.

### Thay đổi

- **Hai tầng affiliate tính riêng.** Link của hội nào thì tính hoa hồng cho hội đó. Tầng nền tảng tính cho dịch vụ của nền tảng (gói Hội Mình). Một người giới thiệu được nhiều người, ở nhiều hội khác nhau.
- **Trong một hội thì tính lượt bấm cuối (last click), 30 ngày, cho tới lúc người đó vào hội.** Áp dụng cho cả người đã có tài khoản Hội Mình (đang ở hội khác). Đăng ký qua link của A rồi bấm link của B mới vào hội thì B được ghi nhận. Vào hội rồi thì người giới thiệu là cố định: người khác không giới thiệu tranh được nữa.
- **Thành viên đang ở trong hội thì link không tính cho từng đơn hàng.** Thành viên chưa có người giới thiệu mà bấm thêm link của ai đó rồi mua thì đơn đó không tính hoa hồng. Họ tự chọn người giới thiệu ở thẻ "Người giới thiệu của bạn" (mã, link hoặc email). Bản 1.36.0 còn tính trường hợp này; nay bỏ.
- **Tầng nền tảng ghi một lần rồi cố định.** Đăng ký tài khoản qua link nền tảng thì người chia sẻ link là người giới thiệu nền tảng; sau đó người khác giới thiệu không được tính nữa.
- **Người vào một hội thì người giới thiệu nền tảng mặc định là chủ hội đó.** Áp dụng khi tài khoản chưa có người giới thiệu nền tảng. Về sau người này mua gói Hội Mình thì hoa hồng nền tảng về chủ hội đã đưa họ về.
- **Cookie nhớ được nhiều mã.** Trước đây cookie chỉ nhớ một mã, nên bấm link của hội B là mất mã của hội A. Nay cookie nhớ tới 8 mã, mỗi hội (và nền tảng) tính mã mới nhất của chính mình. Một lượt đăng ký ghi được cả người giới thiệu nền tảng lẫn lượt bấm của từng hội.
- Trang giới thiệu hội chỉ hiện dòng "Bạn được ... giới thiệu" khi lượt giới thiệu đó thật sự được tính cho hội này.

### Sửa

- **Đăng ký bằng Google làm rơi mã giới thiệu.** Tài khoản tạo qua Google không được ghi người giới thiệu dù có cookie. Nay được tính như đăng ký bằng email.
- Mã giới thiệu của hội khác trên link không còn làm hiện sai tên người giới thiệu ở trang giới thiệu hội.

## 1.36.3 - 2026-11-21

Quản lý khóa học ngay tại thư viện Khóa học, không phải mở từng khóa mới tìm ra chỗ cài đặt. Bài học nhận thêm link Google Drive, phát ngay trong trang và chặn mở sang Drive. Theo yêu cầu của chủ dự án.

### Thêm

- **Bài học dùng link Google Drive.** Ở ô Video của màn Soạn bài học, dán link tệp Drive đang chia sẻ "Bất kỳ ai có đường liên kết" (dạng `drive.google.com/file/d/...`, `open?id=...`, `uc?id=...`). Tệp phát ngay trong trang bài học bằng khung xem trước của Drive, dùng được cho video và cả PDF. Link thư mục không nhận. Nhập nhanh từ danh sách link cũng nhận link Drive.
- **Chặn tải và chặn mở sang Drive.** Nút "Mở trong cửa sổ mới" của Drive (đường dẫn tới link gốc và nút tải về) bị vô hiệu: khung phát không cho mở cửa sổ mới, và có một lớp chắn đè lên đúng chỗ nút đó. Chuột phải trên khung bị tắt. Google không nhận được địa chỉ trang bài học.
- **Không gửi link gốc cho học viên.** Học viên chỉ nhận địa chỉ khung phát; link chia sẻ gốc và id tệp ở dạng trường riêng chỉ người quản lý khóa nhận. Tên bài tạm khi nhập nhanh link Drive không kèm id tệp.
- Khi dán link Drive, màn soạn bài hiện hai việc chủ khóa cần làm trên Drive: đặt quyền "Bất kỳ ai có đường liên kết" và tắt "Người xem có thể tải xuống".
- **Nút ba chấm ở góc trên bên phải mỗi thẻ khóa học.** Chỉ người quản lý khóa (chủ hội, quản trị viên) thấy. Bấm vào mở menu: Cài đặt khóa học, Soạn bài học, Xem trang khóa học, Đăng khóa học hoặc Gỡ về nháp, Chuyển lên trước, Chuyển ra sau, Nhân bản khóa học, Chép link khóa học, Xóa khóa học. Trên máy tính menu thả ngay dưới nút; trên điện thoại menu trượt lên từ đáy màn hình, hàng cao 48px, chữ 16px cho dễ bấm. Bấm ra ngoài hoặc phím Esc để đóng.
- **Sắp thứ tự thẻ khóa học.** "Chuyển lên trước" và "Chuyển ra sau" đổi chỗ thẻ với thẻ đứng cạnh, thấy ngay trên màn hình. Thứ tự này áp dụng cho mọi học viên của hội. Trước đây thư viện chỉ xếp theo ngày tạo, không đổi được.
- **Nhân bản khóa học.** Bản sao là nháp (chỉ người quản lý thấy), tên thêm "(bản sao)", đứng ngay sau khóa gốc, có đủ thông tin, cài đặt, chương, bài học và tài liệu đính kèm. Không chép tiến độ học viên, bình luận hay sản phẩm cửa hàng.
- Sau mỗi thao tác có một dòng báo kết quả ngay trên lưới thẻ (đã nhân bản, đã đăng, đã chép link, hoặc lý do không làm được, ví dụ khóa chưa có bài nên chưa đăng được). Xóa khóa học luôn hỏi lại trước khi xóa.
- Hai lệnh MCP mới cho trợ lý AI: `duplicate_course` và `reorder_courses` (phạm vi `courses:write`), nâng bộ lệnh lên 100.

### Thay đổi

- Với người quản lý khóa, nhãn "Hoàn thành" trên bìa thẻ dời sang góc trái để nhường góc phải cho nút ba chấm. Học viên vẫn thấy như cũ.

### Kỹ thuật

- API mới: `PUT /v1/communities/:id/courses/order` (thân `{ courseIds }`, khóa không có trong danh sách giữ thứ tự cũ và xếp sau) và `POST /v1/courses/:id/duplicate`. Cả hai cần quyền `course.manage`, đã thêm vào bảng luật API key.
- `packages/core/src/services/courses.ts`: `reorderCourses`, `duplicateCourse`. Giao diện: `apps/web/src/pages/community/CourseMenu.tsx`, lớp `.course-more`, `.course-menu` trong `packages/ui/src/styles.css`.
- Test: `packages/core/src/test/course-manage.test.ts` (6 test), thêm một test HTTP trong `apps/api/src/api.test.ts`.
- Google Drive: `parseDriveUrl`, `parseLessonVideoUrl` trong `packages/contracts/src/learning.ts` (tách khỏi `parseVideoUrl` nên bài viết, sự kiện, trang giới thiệu không nhận Drive), `apps/web/src/components/DrivePlayer.tsx`, `POST /v1/video/parse` nhận thêm `lesson: true`. Test: `packages/core/src/test/lesson-drive.test.ts` (23 test).
- Không có migration database (dùng cột `courses.sort_order` đã có sẵn; `video_provider` là cột chữ nên nhận thêm giá trị `gdrive`).

### Giới hạn cần biết

- **Không giấu được link Drive với người rành kỹ thuật.** Trình duyệt của học viên tải tệp thẳng từ Google, nên địa chỉ khung phát (có id tệp) vẫn đọc được trong công cụ nhà phát triển của trình duyệt. Phần chặn ở trên ngăn người dùng thông thường. Lớp chặn tải thật sự là cài đặt "Người xem có thể tải xuống" trên Drive: tắt mục đó thì có link cũng không tải được bằng nút của Drive.
- Phần chặn chưa thử được với Google Drive thật trên máy phát triển (máy đó không ra được Google). Cần mở một bài Drive trên bản chạy thật để xác nhận video phát bình thường và nút mở sang Drive không còn bấm được.

## 1.36.2 - 2026-11-21

Giảm CPU và số câu lệnh database của mỗi request, theo yêu cầu của chủ dự án sau khi rà soát giới hạn 10 ms CPU của gói Workers miễn phí. Không đổi tính năng, không đổi dữ liệu trả về, không có migration.

Số đo dưới đây lấy trên workerd chạy tại máy (cùng nhân với Cloudflare) với dữ liệu mẫu, tính CPU của cả tiến trình nên cao hơn con số Cloudflare tính. Dùng để so trước và sau, không phải số trên hệ thống thật.

### Thay đổi

- **Worker dựng bộ định tuyến một lần cho cả isolate, không dựng lại ở mỗi request.** Trước đây request nào cũng đăng ký lại hơn 350 route rồi biên dịch bộ định tuyến. Nay Hono app dùng chung, chỉ App (giữ kết nối Postgres) là tạo mới theo request. Mọi request nhẹ đi khoảng 1,2 ms CPU (`/health` từ 5,2 xuống 4,0 ms).
- **Trang danh sách khóa học hỏi quyền của cả danh sách trong một lượt.** Trước đây mỗi khóa tốn năm đến bảy câu lệnh để xét quyền (cấp thủ công, mua lẻ, combo, hạng thành viên). Với bốn khóa: từ 38 xuống 14 câu lệnh, CPU từ 16,3 xuống 7,7 ms. Người quản lý: từ 15 xuống 11 câu lệnh. Trang chi tiết khóa học và bài học bớt một câu lệnh nạp lại khóa học.
- **Khung hội gửi các truy vấn độc lập cùng lúc và gộp ba con số của thanh bên vào một câu lệnh.** Từ 23 xuống 21 câu lệnh, số lượt chờ database nối tiếp giảm khoảng một nửa, CPU từ 12,6 xuống 9,4 ms.

### Chưa giải quyết được bằng mã

- Đăng nhập (khoảng 19 ms CPU) và đăng ký (khoảng 43 ms) vẫn vượt 10 ms vì riêng bước băm mật khẩu PBKDF2 100.000 vòng đã tốn khoảng 13 ms. Không giảm số vòng vì đó là lớp bảo vệ mật khẩu. Hai đường này chỉ chạy ổn định trên gói Workers Paid.

## 1.36.1 - 2026-11-21

### Thêm

- **Chọn người giới thiệu bằng email.** Thẻ "Người giới thiệu của bạn" nay nhận ba thứ: mã giới thiệu, link giới thiệu, hoặc email đăng nhập của người đã mời mình. Email phải là của một thành viên đang ở trong hội. Người đó chưa từng lấy link affiliate thì được mở tài khoản affiliate luôn, để lượt giới thiệu vẫn được tính và hoa hồng vẫn vào ví của họ. Theo yêu cầu của chủ dự án. Không có migration.

## 1.36.0 - 2026-11-21

Affiliate theo luật "người giới thiệu cố định", và sửa hai lỗi chủ dự án báo: bấm thông báo thành viên mới ra "Hội không tồn tại", bấm thẻ khóa học ra "Bài học không tồn tại". Theo yêu cầu của chủ dự án.

### Thêm

- **Người giới thiệu cố định.** Thành viên đã có người giới thiệu thì mọi hoa hồng từ các lần thanh toán của họ trong hội (gói thành viên, gia hạn, sản phẩm cửa hàng) về đúng người đó. Bấm link của affiliate khác hay có cookie mới đều không đổi được. Luật này tính theo tài khoản thành viên lưu trên máy chủ, không phụ thuộc cookie còn hay mất.
- **Chưa có người giới thiệu thì lượt bấm cuối thắng (last click).** Người mới tính theo mã trên link lần này, không có thì theo lượt bấm gần nhất còn hạn. Tham gia hội hoặc thanh toán lần đầu qua link của ai thì người đó thành người giới thiệu cố định.
- **Thành viên tự đổi người giới thiệu.** Trang Xếp hạng affiliate có thẻ "Người giới thiệu của bạn": xem ai đang nhận hoa hồng từ mình, và nhập mã hoặc dán link của người khác để đổi. Đây là cách duy nhất để đổi. Người được chọn nhận thông báo, lần đổi ghi vào nhật ký. Không tự chọn mình, không nhận mã của hội khác. Hai đường dẫn mới `GET` và `PUT /v1/communities/:id/my-referrer`, chỉ dùng khi đăng nhập trên web (API key không gọi được).
- **Link affiliate dẫn tới trang nào cũng được ghi nhớ.** Trước đây chỉ trang giới thiệu hội ghi nhớ mã `?ref=`; link affiliate tới sản phẩm cửa hàng bị rơi mã. Nay mọi trang đều ghi nhớ.
- **Hội đổi đường dẫn thì đường dẫn cũ vẫn chạy.** Đường dẫn cũ được giữ lại (bảng `community_slug_aliases`), web tự chuyển sang đường dẫn mới và giữ nguyên trang đang mở cùng mã `?ref=`. Hội khác không lấy được đường dẫn cũ của hội mình; chính hội đó lấy lại được.

### Sửa

- **Bấm thông báo cũ ra "Hội không tồn tại".** Hội đổi đường dẫn thì thông báo, link mời và link affiliate đã chia sẻ trước đó đều chết. Nay các link đó dẫn về đúng hội.
- **Bấm thẻ khóa học ra "Bài học không tồn tại".** Xóa một bài (hoặc cả chương) mà có người đang học dở bài đó thì tiến độ của họ vẫn trỏ tới bài đã xóa. Nay xóa bài thì tiến độ tự bỏ trỏ (khóa ngoại `ON DELETE SET NULL`), thẻ khóa học dẫn về trang khóa học. Migration dọn luôn các dòng đang trỏ sai.
- **Thanh toán qua link của affiliate khác làm đổi người nhận hoa hồng.** Trước đây mã trên link đứng trước người giới thiệu đã ghi của thành viên. Nay ngược lại.
- **Quay lại hội làm mất người giới thiệu.** Thành viên rời hội rồi tham gia lại không qua link bị xóa người giới thiệu cũ. Nay giữ nguyên.
- **Tham gia hội bằng mã của hội khác vẫn được ghi nhận.** Mã không được kiểm thuộc chương trình nào, tài khoản affiliate bị khóa vẫn được gắn. Nay chỉ nhận mã đang hoạt động của chính hội đó.
- **Số "Trả phí" của affiliate đếm đôi với đơn gói thành viên.** Nay mỗi đơn đếm một lần.
- Link affiliate của hội (trang Ví, trang Xếp hạng) viết lại theo đường dẫn mới khi hội đổi đường dẫn.

### Lưu ý khi nâng cấp

- Có migration `0016_slug_aliases_lesson_fk`: thêm bảng `community_slug_aliases`, thêm khóa ngoại cho `course_progress.last_lesson_id` và dọn dòng trỏ sai. Áp dụng lên database thật trước khi merge.
- Hội đã đổi đường dẫn TRƯỚC bản này không có dòng nào trong bảng mới, nên sau khi áp dụng migration cần thêm tay đường dẫn cũ của hội đó (với hội Javiser: `agent-automation-cung-javis`).
- Chương trình affiliate nền tảng (giới thiệu chủ hội mua gói Hội Mình) không đổi: vẫn tính theo người giới thiệu lúc đăng ký tài khoản.

## 1.35.1 - 2026-11-17

### Thay đổi

- **Màn Nhà phát triển không còn nhắc tên Javis.** Javis là trợ lý riêng của chủ dự án, chủ hội khác đăng ký Hội Mình không có. Gợi ý tên key và lời giới thiệu MCP nay viết chung là "trợ lý AI" (Claude, Cursor hay trợ lý nào nói giao thức MCP). Chỉ đổi chữ, không đổi tính năng, không có migration.

## 1.35.0 - 2026-11-17

Cắm Hội Mình vào Javis (hoặc Claude, Cursor, bất kỳ trợ lý AI nào nói MCP) bằng một địa chỉ và một API key, để trợ lý điều khiển gần như toàn bộ việc quản lý hội. Rà soát lại lớp API key và MCP đã có, vá ba chỗ hỏng và hai lỗ hổng phân quyền. Theo yêu cầu của chủ dự án.

### Thêm

- **MCP từ xa ở `https://api.hoiminh.com/mcp`** (cũng chạy ở `https://hoiminh.com/mcp`). Trợ lý chỉ cần địa chỉ này và API key ở header `Authorization: Bearer hm_live_...`, không phải cài gì trên máy. Đã thử nối bằng thư viện MCP chính thức.
- **98 lệnh thay cho 10 lệnh cũ**, phủ các việc của chủ hội: xem và sửa thông tin hội, chuyên mục, tiện ích, câu hỏi tham gia; thành viên (lọc, hồ sơ, mời, duyệt, đổi vai trò và gói, khóa, cấp khóa học); bảng tin (đăng bài, thông báo, sửa, ghim, xóa, duyệt bài, bình luận); khóa học (khóa, chương, bài học, sắp xếp, xuất bản); sự kiện và bản ghi; sản phẩm cửa hàng; doanh thu, giá và gói thành viên, đơn chuyển khoản chờ xác nhận, hoàn tiền; affiliate và yêu cầu rút hoa hồng; thẻ, liên hệ, nguồn đồng bộ và quy tắc tự động; tin nhắn và thông báo; webhook gửi đi; tải ảnh và tệp lên.
- **Trợ lý chỉ thấy lệnh mà key của nó gọi được.** Key chỉ xem thì danh sách lệnh chỉ có lệnh xem. Lệnh xóa, hoàn tiền, đổi giá, khóa thành viên, xác nhận tiền được đánh dấu để trợ lý hỏi lại chủ hội trước khi làm.
- **Bảy phạm vi API key mới**: `posts:moderate`, `store:write`, `revenue:read`, `billing:manage`, `automation:manage`, `messages:read`, `webhooks:manage`. Trước đây không phạm vi nào mở được cửa hàng, giá gói, duyệt bài, nên API key không làm nổi các việc này.
- **Màn Nhà phát triển**: chọn phạm vi bằng danh sách có giải thích tiếng Việt thay cho hàng mã, có nút "Toàn quyền (cho trợ lý AI)" và "Chỉ xem". Khung MCP hiện địa chỉ để chép, bốn bước nối, và mẫu cấu hình.
- **Webhook gửi đi có thêm sự kiện bình luận mới (`comment.created`) và sự kiện bài đăng mới (`post.created`) nay kèm đủ nội dung.** Cả hai gửi nội dung Markdown, tác giả (tên, handle), đường dẫn mở bài trên web; bài đăng kèm chuyên mục, video, liên kết; bình luận kèm bài gốc và bình luận cha nếu là trả lời. Bên nhận (Javis, n8n) xử lý được ngay, không phải gọi lại API. Trường `viaApiKey` là `true` khi nội dung do chính API key tạo, để trợ lý tự trả lời bình luận không trả lời chính mình mãi. Trước đây `post.created` chỉ gửi id và tiêu đề, còn bình luận mới không gửi ra ngoài. Bài của thành viên mới còn chờ duyệt chỉ phát sự kiện sau khi được duyệt (như cũ).
- Màn Nhà phát triển: chọn sự kiện webhook bằng danh sách có giải thích tiếng Việt thay cho hàng mã.
- Hai đường dẫn mới cho API key: `GET /v1/communities/:id/orders/pending` (đơn chuyển khoản chờ xác nhận, không kèm tài khoản nhận tiền) và `GET /v1/communities/:id/orders/:orderId` (chủ hội tra một đơn của hội).

### Sửa

- **Lệnh `list_communities` luôn trả danh sách rỗng khi gọi bằng API key**, nên trợ lý không có id hội nào để gọi các lệnh khác: MCP cũ nhìn như chạy mà không làm được gì. Nay trả mọi hội của workspace.
- **Hướng dẫn MCP trên web chỉ sai**: `npx -y @hoiminh/mcp` không chạy được vì gói chưa từng được phát hành. Nay hướng dẫn nối bằng địa chỉ.
- **Chủ hội không tra được đơn của khách bằng API key**: `/v1/orders/:id` chỉ trả đơn của chính người mua.
- **Key có `posts:write` mà thiếu `communities:read` không đăng được bài** vì không đọc được danh sách chuyên mục.

### Bảo mật

- **API key mặc định bị chặn.** Key chỉ vào được đường dẫn có trong bảng `apps/api/src/middleware/api-key-access.ts` và đúng phạm vi. Trước bản này một key chỉ có `communities:read` vẫn gọi được toàn bộ `/v1/me/*` dưới tên chủ hội (đọc và gửi tin nhắn, sửa hồ sơ, bật tắt 2FA, yêu cầu rút tiền affiliate) vì các đường đó chỉ kiểm "ai đang gọi", không kiểm phạm vi.
- **Key không còn tự tạo được key khác.** Trước đây key bất kỳ gọi `POST /v1/workspaces/:id/api-keys` là tạo được key đủ mọi phạm vi. Nay quản lý API key chỉ làm được khi đăng nhập trên web, chặn ở cả bảng đường dẫn lẫn service.
- Không key nào (kể cả key toàn quyền) đổi được tài khoản nhận tiền, khóa cổng thanh toán, mật khẩu, 2FA, lưu trữ hội, hay vào quản trị hệ thống. Lượt bị chặn vẫn ghi vào nhật ký dùng key.

### Lưu ý khi nâng cấp

- **Key đã tạo trước bản này vẫn chạy với các đường dẫn quản lý hội như cũ**, nhưng không còn gọi được `/v1/me` (hồ sơ, hóa đơn, 2FA), `/v1/checkout` và các đường dẫn khác không có trong bảng. Tích hợp nào đang dựa vào các đường đó sẽ nhận 403 kèm câu giải thích.
- Bộ lệnh MCP đổi tên ba lệnh: `add_member` thành `invite_members`, `change_member_tier` thành `update_member`, `get_member_progress` thành `get_member`.
- Không có migration database.

### Kỹ thuật

- `apps/api/src/mcp/tools.ts` (bộ lệnh, dữ liệu vào lấy thẳng từ schema của `@hoiminh/contracts` qua `zod-to-json-schema`), `apps/api/src/mcp/server.ts` (JSON-RPC: `initialize`, `ping`, `tools/list`, `tools/call`, lô yêu cầu, thông báo), `apps/api/src/routes/mcp.ts` (route, kiểm cờ `mcp`). `/mcp` thêm vào `run_worker_first` của `wrangler.toml` và `NO_DB_PATHS`.
- `apps/mcp` (stdio) bỏ bản sao bộ lệnh, chỉ còn chuyển tiếp tới `/mcp`.
- `/v1/me/integration` trả thêm `scopes` của key đang dùng.
- Test: `apps/api/src/mcp.test.ts` (23 test) chạy thật các lệnh trên database mẫu, gồm cả luồng người mua tạo đơn, trợ lý xác nhận đã nhận tiền rồi hoàn tiền; kiểm từng đường dẫn nhạy cảm bị chặn với key toàn quyền; kiểm mỗi lệnh khớp một dòng trong bảng luật.

## 1.34.0 - 2026-11-14

Chủ hội cài được đủ sáu cách nhận tiền ở Cài đặt, Bán hàng, Nhận tiền: chuyển khoản QR (tự bấm xác nhận), QR tự động qua SePay, MoMo, VNPAY, PayPal và thẻ Visa, Mastercard qua Stripe. Người mua chỉ thấy cách chủ hội đã cài và đang bật, cách chủ hội đặt làm mặc định được chọn sẵn. Khung mua gói Hội Mình cũng chỉ còn hiện cổng quản trị đã cài. Theo yêu cầu của chủ dự án.

### Thêm

- **Màn Nhận tiền mới: sáu hàng, mỗi hàng một cách.** Mỗi hàng ghi rõ trạng thái (Chưa cài, Còn một bước, Đang bật, Đang tắt), có công tắc bật tắt, nút "Đặt làm mặc định" và nút "Cài đặt" mở khung cài ngay dưới hàng. Khung cài có hướng dẫn từng bước đúng tên mục trong trang quản lý của cổng đó.
- **MoMo, VNPAY, PayPal, Stripe của chính chủ hội.** Chủ hội dán khóa lấy từ trang quản lý của cổng (MoMo: Partner Code, Access Key, Secret Key; VNPAY: mã website và chuỗi bí mật; PayPal: Client ID, Secret, Webhook ID; Stripe: Secret key và Signing secret). Người mua trả qua cổng của chủ hội, tiền về thẳng tài khoản cổng của chủ hội, không qua Hội Mình. Cổng báo kết quả về địa chỉ riêng của từng cổng, đơn tự chuyển sang đã trả và người mua được mở quyền ngay.
- **PayPal và Stripe cài hai bước.** Hai cổng này chỉ cấp mã webhook sau khi đã dán địa chỉ webhook của hội vào trang của cổng, nên chủ hội lưu khóa API trước, Hội Mình hiện địa chỉ webhook, rồi chủ hội dán mã webhook. Cổng ở trạng thái "Còn một bước" thì người mua chưa thấy.
- **Thẻ quốc tế qua Stripe.** Trang thanh toán thẻ của Stripe, thu bằng VND. Khóa `sk_live_` là chạy thật, `sk_test_` là thử nghiệm.
- **Cách mặc định.** Bước thanh toán của hội chọn sẵn cách chủ hội đặt làm mặc định; cách đó bị tắt thì chọn sẵn cách đầu tiên còn bật. Khung "Người mua sẽ thấy" bên cạnh xem trước đúng các ô người mua thấy.
- **Bước thanh toán của hội.** Người mua thấy từng cách đang bật, đổi cách được ngay; nút đổi theo cách đã chọn ("Lấy mã QR chuyển khoản" hoặc "Thanh toán 149.000đ bằng MoMo"). Trang đơn có nút "Mở trang MoMo để thanh toán" (thẻ là "Mở trang thanh toán thẻ"); trả xong, cổng quay người mua về đúng trang đơn.
- **Hoàn tiền đơn trả qua cổng của chủ hội** đi qua đúng cổng đó (MoMo, PayPal, Stripe có hoàn tự động), không bao giờ qua cổng của Hội Mình. Chủ hội hoàn ngay trong trang của cổng thì quyền của người mua cũng được thu hồi.
- **Quản trị hệ thống, Thanh toán:** thêm dòng Stripe, nút "Đặt mặc định" cho cổng được chọn sẵn khi chủ hội mua gói, và dòng chữ cho biết vì sao một cổng không hiện cho người mua (đang tắt, chưa có khóa thật, cờ PayPal đang tắt).

### Thay đổi

- **Khung "Thanh toán gói Hội Mình" chỉ hiện cổng dùng được.** Trước đây luôn hiện đủ Chuyển khoản QR, MoMo, VNPAY, PayPal, kể cả cổng chưa có khóa thật hay đang tắt, bấm vào mới báo lỗi. Nay chỉ hiện cổng quản trị đang bật và đã có khóa thật, cổng mặc định được chọn sẵn.
- Hai cách chuyển khoản dùng chung một tài khoản ngân hàng nên mỗi lúc bật một cách: bật QR tự động qua SePay thì chuyển khoản tự bấm xác nhận tự tắt, và ngược lại. Người mua thấy một ô "Chuyển khoản QR".
- Tắt chuyển khoản QR mà vẫn giữ tài khoản đã nhập, bật lại không phải gõ lại. Hội cũ giữ nguyên là bật.
- "Đơn chờ bạn xác nhận" chỉ còn đơn chuyển khoản; đơn qua cổng tự xác nhận khi cổng báo về.
- Trang Tiền, Giá và gói, ô lệnh nhanh: ghi các cách người mua đang thấy thay cho chỉ "chuyển khoản"; nút "Tài khoản nhận tiền" thành "Cách nhận tiền".

### Kỹ thuật

- **Có migration `0015_owner_gateways`** (chạy lại được nhiều lần): bảng `community_payment_gateways` (mỗi hội một dòng cho mỗi cổng, khóa mã hóa bằng `ENCRYPTION_KEY`, mã bí mật của địa chỉ webhook, policy RLS theo workspace), cột `community_payout_accounts.enabled`, cột `communities.default_payment_method`. Phải áp lên database thật trước khi merge.
- Cổng thanh toán mới `stripe` (`packages/payments/src/stripe.ts`): tạo phiên Checkout bằng REST, kiểm chữ ký `Stripe-Signature` (HMAC-SHA256, từ chối chữ ký quá 5 phút), hoàn tiền qua `/v1/refunds`. Không dùng thư viện của Stripe để chạy được trên Cloudflare Workers.
- `packages/core/src/services/owner-gateways.ts`: lưu, gỡ cổng; `ownerPaymentMethods` (cách người mua thấy và cách chọn sẵn); nhận webhook ở `/webhooks/hoi/<mã>` (GET và POST vì VNPAY gọi IPN bằng GET); trang mô phỏng cho máy dev và test.
- `packages/core/src/services/platform-methods.ts`: cổng nào của Hội Mình dùng được cho đơn gói và vì sao không.
- API mới: `PUT`/`DELETE /v1/communities/:id/payment-gateways/:provider`, `PATCH /v1/communities/:id/payment-methods`, `POST /webhooks/stripe`, `GET|POST /webhooks/hoi/:token`. `PUT /v1/communities/:id/payout-account` nhận thêm `enabled`. `GET /v1/communities/:id/payout-account` trả thêm `gateways`, `methods`, `defaultMethod`. Khung hội trả thêm `paymentMethods`, `defaultPaymentMethod`, `bankConfirmMode`. `GET /v1/communities/:id/plan` trả thêm `payment`. `PATCH /v1/admin/providers/:provider` nhận `isDefault` và từ chối tên cổng lạ.
- `POST /v1/checkout`: `provider` không bắt buộc nữa, thiếu thì dùng cách mặc định. Cách không có trong danh sách thì trả `payment_error` kèm `reason: 'method_unavailable'` và danh sách cách dùng được.
- Biến môi trường mới (không bắt buộc): `STRIPE_MODE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` cho Stripe của Hội Mình. Để trống thì Stripe không hiện ở khung mua gói.
- Bộ khóa thử (`momo-sandbox...`, `vnpay-sandbox...`, `paypal-sandbox...`, `sk_test_hoiminh...`) đi qua trang mô phỏng `/pay/simulator/hoi/<mã>` ở máy dev và test; ở nơi khác máy chủ từ chối lưu các khóa này.
- Xem quyết định 72 trong `DECISIONS.md`.
- Test: payments `adapters.test.ts` thêm 5 ca Stripe; core `owner-gateways.test.ts` (18); web `payment-methods.test.ts` (4); e2e luồng 26 mới, luồng 6, 12, 22 cập nhật.

## 1.33.1 - 2026-11-13

Trang Khám phá nay chính là trang chủ: mở `hoiminh.com` là thấy ngay danh sách hội, không còn nhảy sang địa chỉ `/kham-pha` riêng. Theo yêu cầu của chủ dự án.

### Thay đổi

- **Trang chủ `/` hiện thẳng trang Khám phá.** Trước đây khách mở trang chủ bị chuyển sang `/kham-pha`. Logo, mục "Khám phá" ở đầu trang, "Khám phá hội khác" trong bảng chuyển hội và các nút "Khám phá" khác đều trỏ về trang chủ. Lọc danh mục và tìm kiếm chạy ngay trên trang chủ (`/?danh-muc=...`, `/?q=...`).
- **Địa chỉ cũ `/kham-pha` tự chuyển về trang chủ**, giữ nguyên bộ lọc, nên link đã lưu hoặc đã chia sẻ vẫn mở được.
- Người đã đăng nhập vừa mở app (gõ địa chỉ, bấm link ngoài, bấm biểu tượng ở màn hình chính) vẫn vào thẳng chỗ của mình như cũ: trang Hôm nay của hội, Khu học tập hoặc Hội của tôi. Bấm logo hay "Khám phá" trong app thì xem Khám phá ở trang chủ.

### Kỹ thuật

- `apps/web/src/pages/public/Home.tsx` quyết định: lượt tải đầu của tab (`location.key === 'default'`, không kèm bộ lọc) và đã đăng nhập thì chuyển về chỗ của người dùng, còn lại vẽ `Discovery`. Xem quyết định 71 trong `DECISIONS.md`.
- `kham-pha` vẫn nằm trong danh sách slug cấm đặt cho hội, vì địa chỉ này còn dùng để chuyển hướng.
- Test trình duyệt mới: `e2e/tests/25-trang-chu-kham-pha.spec.ts`.

## 1.33.0 - 2026-11-12

Chủ hội bán gói thành viên theo nhiều kỳ hạn (1 tháng, 3 tháng, 6 tháng, 12 tháng hoặc số tháng tự nhập) và chạy được khuyến mãi giảm giá, ngay ở Cài đặt, Bán hàng, Giá và gói. Trước đây mỗi gói chỉ có hai ô: giá tháng và giá năm.

### Thêm

- **Kỳ hạn của gói.** Mỗi gói trả phí có một bảng "mấy tháng, bao nhiêu tiền", tối đa 6 dòng. Bấm "+ 3 tháng", "+ 6 tháng", "+ 12 tháng" để thêm nhanh, hoặc "+ Kỳ khác" rồi gõ số tháng bất kỳ từ 1 đến 36. Dòng mới điền sẵn giá bằng mua lẻ từng tháng, chủ hội hạ xuống để khuyến khích mua dài; dưới mỗi dòng ghi giá quy ra mỗi tháng và phần trăm rẻ hơn kỳ ngắn nhất.
- **Khuyến mãi.** Một thẻ gồm công tắc bật tắt, phần trăm giảm (1 đến 90, có nút chọn nhanh 10, 20, 30, 50) và ngày hết. Để trống ngày hết thì chạy tới khi chủ hội tắt. Khuyến mãi áp cho mọi kỳ hạn và giá trả một lần; thẻ ghi luôn một ví dụ bằng giá thật của hội, và báo khi khuyến mãi đã hết hạn.
- **Người mua chọn kỳ hạn ở bước thanh toán.** Mỗi kỳ hạn một thẻ: giá gốc gạch đi khi đang giảm, giá phải trả, giá mỗi tháng và nhãn "Rẻ hơn N%" cho kỳ dài. Trang giới thiệu hội, thẻ Premium ở Bảng tin và thẻ "Rẻ hơn với Premium" ở trang khóa học ghi giá của kỳ ngắn nhất, có dòng "Đang giảm N% đến hết ngày ..." khi có khuyến mãi.
- Mua xong, gói được cấp đúng số tháng đã chọn. Mua tiếp khi gói còn hạn thì nối vào ngày hết hạn đang có. Trang Tài khoản, Gói và thanh toán và hồ sơ thành viên ghi "319.200đ/3 tháng" thay cho chỉ "tháng" hoặc "năm".

### Thay đổi

- Kiểu thu phí "Thu phí" ghi "Theo kỳ hạn 1, 3, 6, 12 tháng" thay cho "Theo tháng hoặc năm".
- Nút "Đổi sang năm" ở Tài khoản, Gói và thanh toán thành "Gia hạn hoặc đổi kỳ", mở bước thanh toán với đủ kỳ hạn hội đang bán.
- Hội thu phí theo kỳ hạn chỉ bán các kỳ hạn, hội "Trả một lần" chỉ bán gói trọn đời. Trước đây bước thanh toán hiện cả giá của kiểu thu phí chủ hội không còn nhìn thấy ở màn cài đặt.
- Hội đã tạo từ trước tự đổi dòng quyền lợi mặc định "Trở thành cộng sự" thành "Trở thành affiliate" và tên chương trình "Cộng sự <tên hội>" thành "Affiliate <tên hội>" (bản 1.32.2 chưa đổi dữ liệu đã lưu). Dòng chủ hội đã tự viết lại thì giữ nguyên.

### Kỹ thuật

- **Có migration `0014_membership_terms`** (chạy lại được nhiều lần): thêm `community_tiers.terms`, `communities.pricing_promo`, `subscriptions.period_months`; điền kỳ hạn của gói cũ từ giá tháng và giá năm đang có, điền số tháng của các gói đang chạy (năm là 12, còn lại là 1). Phải áp lên database thật trước khi merge.
- Kỳ hạn là nguồn chính của giá. Hai cột `monthly_minor`, `yearly_minor` vẫn được ghi theo kỳ 1 tháng và 12 tháng nên mã và báo cáo cũ đọc tiếp được. Đơn và gói vẫn giữ mã chu kỳ cũ (`yearly` cho 12 tháng, còn lại `monthly`), số tháng thật nằm ở `months` của đơn và `period_months` của gói.
- Giá sau khuyến mãi tính ở máy chủ khi tạo đơn (`applyPromo`), không tin số tiền từ trình duyệt; đơn ghi giá gốc và phần trăm đã giảm. Kỳ hạn hội không bán thì từ chối tạo đơn.
- API tạo đơn nhận thêm `months` cho gói thành viên; bản gọi cũ chỉ có `cycle` vẫn chạy (monthly là 1 tháng, yearly là 12 tháng). API lưu giá nhận thêm `terms` cho từng gói và `promo` (null là tắt, không gửi là giữ nguyên).
- Hàm tính dùng chung cho API và web nằm ở `packages/contracts/src/membership.ts`. Thêm `periodEndMonths` cạnh `periodEnd` thay vì sửa hàm cũ, vì `periodEnd` nằm trên đường xử lý thanh toán thành công.
- Test: 18 ca ở `packages/core/src/test/membership-terms.test.ts`, 5 ca ở `apps/web/src/lib/membership.test.ts`, và luồng trình duyệt `e2e/tests/24-ky-han-va-khuyen-mai.spec.ts`.
- Chưa làm: mã giảm giá do chủ hội tự tạo. Ô "Mã giảm giá" ở bước thanh toán đã có và máy chủ đã biết kiểm tra mã, nhưng chưa có màn để chủ hội tạo mã.

## 1.32.2 - 2026-11-12

Chữ "Cộng sự" trên toàn giao diện đổi thành "Affiliate", theo yêu cầu của chủ dự án. Chỉ đổi chữ, không đổi tính năng.

### Thay đổi

- **"Cộng sự" thành "Affiliate" ở mọi nơi người dùng đọc:** thanh bên và trang Affiliate của hội, Cài đặt, Affiliate, trang Tài khoản, Affiliate (ví và rút tiền), bảng Xếp hạng affiliate, bàn điều khiển, lời mời nâng gói, bảng gói, bảng lệnh nhanh, thông báo, email và phần Hệ thống, Affiliate nền tảng.
- Hội tạo mới có sẵn quyền lợi "Trở thành affiliate" ở gói Premium, và chương trình tên "Affiliate <tên hội>".
- Địa chỉ trang giữ nguyên (`/cong-su`, `/tai-khoan/cong-su`, `/cai-dat/cong-su`), nên link đã gửi cho thành viên vẫn mở được.

### Kỹ thuật

- Không đổi máy chủ, không có migration. Dữ liệu đã lưu không tự đổi: hội đã tạo từ trước vẫn giữ dòng quyền lợi "Trở thành cộng sự" và tên chương trình cũ cho tới khi chủ hội sửa.
- Chú thích trong mã, dữ liệu mẫu (seed), test và các màn thiết kế (`design/build.mjs`, dựng lại bằng `node design/build.mjs`) đổi cùng lúc. Nhật ký thay đổi cũ, `DECISIONS.md`, tài liệu kiến trúc và các migration đã chạy giữ nguyên chữ cũ.

## 1.32.1 - 2026-11-12

Màn Nhận tiền hướng dẫn chủ hội nối SePay từng bước và tự báo "Đã nối" khi nhận được tín hiệu đầu tiên, để chủ hội biết chắc đơn sẽ tự xác nhận mà không phải chờ tới đơn thật.

### Thay đổi

- **Hướng dẫn nối SePay bốn bước** (Cài đặt, Bán hàng, Nhận tiền, khi chọn "Tự xác nhận"): mở tài khoản SePay và thêm đúng tài khoản ngân hàng đã cài; tạo webhook cho sự kiện "Có tiền vào" rồi dán địa chỉ báo có của hội; chọn không xác thực và không bật mục bỏ qua giao dịch thiếu mã thanh toán; bấm "Gửi thử" trong SePay hoặc chuyển thử một khoản nhỏ. Trước đây chỉ có ba dòng chung chung, không nêu tên dịch vụ.
- **Dòng trạng thái kết nối.** Chưa nhận lần báo có nào thì ghi "Đang chờ tín hiệu đầu tiên từ SePay" và trang tự hỏi lại máy chủ 5 giây một lần; nhận được (kể cả lần "Gửi thử" của SePay) thì chuyển sang "Đã nối" kèm giờ của lần báo có gần nhất, không cần tải lại trang. Đổi địa chỉ báo có thì quay về trạng thái chờ.
- Lựa chọn "Tự xác nhận" ghi rõ là nối SePay, làm một lần khoảng 10 phút.

### Kỹ thuật

- Không đổi máy chủ, không có migration. Địa chỉ `/webhooks/bank/<mã>` vốn đã trả 200 và ghi `last_webhook_at` cho dữ liệu mẫu của SePay (mã giao dịch giả 0, không có mã đơn); nay có test giữ hành vi này.
- `apps/web/src/lib/payout-webhook.ts`: hàm thuần `webhookLink` và `webhookPollMs` quyết định trạng thái và việc tự hỏi lại.
- Test: web `payout-webhook.test.ts` (3), core `owner-payout.test.ts` thêm 1 trường hợp "Gửi thử", e2e luồng 22 gửi dữ liệu mẫu tới địa chỉ báo có và chờ dòng trạng thái đổi.

## 1.32.0 - 2026-11-11

Gói Hội Mình đổi theo kế hoạch 11/11/2026: bốn gói, mỗi gói cho một hội, hai chu kỳ 3 tháng và 1 năm, không còn dùng thử. Hội chạm trần thành viên của gói thì không nhận thêm người mới (không xóa ai), và bốn tính năng trả phí (tự động hóa, tên miền riêng, cộng sự, API) được khóa theo gói. Email thông báo của hội được thay bằng thông báo trong ứng dụng. Tiền bán hàng của hội về thẳng tài khoản ngân hàng của chủ hội, không còn đi qua Hội Mình. Trên điện thoại, thành viên có thể được yêu cầu thêm Hội Mình ra màn hình chính (quản trị hệ thống bật tắt, mặc định đang tắt) và nhận thông báo đẩy.

### Tính năng

- **Bốn gói cho từng hội.** Miễn phí (0đ, tối đa 100 thành viên), Khởi đầu (99.000đ mỗi tháng, 500), Chuyên nghiệp (299.000đ, 5.000, có tự động hóa, tên miền riêng, cộng sự, API), Không giới hạn (799.000đ, không giới hạn thành viên). Mọi gói đều bán hàng và thu tiền được, không thu phí trên doanh thu.
- **Hai chu kỳ: 3 tháng và 1 năm.** 3 tháng bằng 3 lần giá tháng (90 ngày), 1 năm bằng 10 lần giá tháng (365 ngày). Không còn gói 1 tháng.
- **Trang "Gói cho hội" (`/admin/goi?hoi=<đường dẫn hội>`):** thanh thành viên so với trần, hai tab chu kỳ, bốn thẻ gói, bảng so sánh. Tính năng của gói cao hơn vẫn hiện kèm ổ khóa và ghi "Có từ gói ...".
- **Nâng gói được tặng ngày.** Màn nâng gói ghi rõ số ngày mua, số ngày còn lại của gói cũ được tặng sang gói mới, tổng số ngày, ngày hết hạn và số tiền. Gia hạn cùng gói thì nối tiếp vào ngày hết hạn. Không mua được gói thấp hơn gói đang còn hạn, hay gói có trần thấp hơn số thành viên đang có.
- **Mỗi tài khoản một hội miễn phí.** Tạo hội thứ hai thì có thêm bước "Gói": chọn gói trả phí và chu kỳ, hội được tạo ở trạng thái chờ thanh toán và mở ngay khi tiền về.
- **Trần thành viên.** Hội đã đủ chỗ thì người mới vẫn xin vào được và nằm ở hàng chờ duyệt. Trang Thành viên có dải báo đủ chỗ; chủ hội bấm Duyệt thì thấy màn nâng gói thay vì duyệt. Người muốn trả tiền để vào hội đang đủ chỗ bị chặn trước khi thanh toán. Bàn điều khiển nhắc việc này trong "Cần xử lý".
- **Khóa tính năng trả phí.** Trong Cài đặt hội, các mục Nguồn đồng bộ, Quy tắc tự động, Liên hệ và thẻ, Mức hoa hồng, Nhà phát triển và ô Tên miền riêng vẫn hiện nhưng kèm ổ khóa; bấm vào thì thấy lời mời nâng gói. Máy chủ chặn thật ở mọi đường (trả lỗi `plan_locked`).
- **Bảng bốn gói của quản trị** (Hệ thống, Gói nền tảng): nhập giá mỗi tháng và trần thành viên, bật tắt bốn tính năng cho từng gói, giá 3 tháng và 1 năm tự tính, lưu cả bảng một lần.
- **Bảng giá công khai (`/tao-hoi/goi`)** hiện bốn gói, nút "Tạo hội miễn phí".
- **Chủ hội cài nhận tiền** (Cài đặt, Bán hàng, Nhận tiền): nhập ngân hàng, số tài khoản, tên chủ tài khoản. Người mua thấy mã QR chuyển khoản tới đúng tài khoản đó, kèm nội dung có mã đơn. Hội chưa cài thì các nút mua và nút tham gia hội thu phí bị khóa, ghi "Hội chưa mở thanh toán".
- **Hai cách xác nhận đơn.** "Tôi tự bấm đã nhận tiền": người mua bấm "Tôi đã chuyển khoản" thì chủ hội nhận thông báo, vào danh sách "Đơn chờ bạn xác nhận" bấm "Đã nhận tiền" là người mua được mở quyền ngay. "Tự xác nhận": chủ hội dán địa chỉ báo có riêng của hội vào dịch vụ báo biến động số dư của mình (định dạng SePay), tiền về đúng mã và đủ số là đơn tự chuyển sang đã trả.
- **Cài Hội Mình ra màn hình chính.** Hội Mình nay cài được như một ứng dụng: có biểu tượng riêng, mở toàn màn hình. Khi quản trị bật công tắc, thành viên đã đăng nhập dùng điện thoại, từ lần vào thứ hai, sẽ thấy màn hướng dẫn thay cho ứng dụng: iPhone có 3 bước của nút Chia sẻ; Android có nút "Cài ứng dụng" một lần bấm rồi mời bật thông báo. Lần vào đầu tiên, máy tính, các trang công khai, trang thanh toán và máy không cài được thì vẫn dùng bình thường.
- **Mở từ Zalo, Facebook, Messenger.** Trình duyệt trong các ứng dụng này không cài được, nên màn hướng dẫn ghi "Mở bằng Safari hoặc Chrome" kèm nút "Sao chép link đăng nhập". Dán link vào Safari hoặc Chrome là vào thẳng tài khoản, không gõ lại mật khẩu. Link dùng được một lần, trong 10 phút.
- **Thông báo đẩy ra điện thoại.** Mọi thông báo trong ứng dụng (trả lời bình luận, bài mới của chủ hội, nhắc sự kiện, đơn chờ xác nhận...) được đẩy ra điện thoại đã bật. Bật tắt ở trang Thông báo, dòng "Đẩy trên điện thoại"; dòng này nói rõ khi thiết bị chưa nhận được và vì sao. Hội Mình chỉ hỏi bật thông báo đúng lúc: ngay sau khi cài trên Android, hoặc sau khi bạn vừa bình luận, và không hỏi lại trong 14 ngày nếu bạn chọn "Để sau".
- **Công tắc toàn hệ thống** ở Hệ thống, Gói nền tảng: "Bắt cài ra màn hình chính trên điện thoại". Mặc định tắt. Quản trị hệ thống không bao giờ bị chặn, để luôn tắt được công tắc từ điện thoại.

### Thay đổi

- **Bỏ dùng thử.** Không còn 14 ngày dùng thử, không còn email nhắc dùng thử, không còn khóa cả tài khoản khi hết hạn. Hội miễn phí của tài khoản dùng vĩnh viễn; gói trả phí hết hạn thì hội tự về gói Miễn phí, thành viên và dữ liệu giữ nguyên.
- **Gói cũ 499.000đ ngừng bán.** Tài khoản đang trả gói cũ còn hạn thì mọi hội của tài khoản đó được gói Không giới hạn tới hết kỳ đã trả.
- **Bỏ thu tiền gói bằng link thanh toán ngoài** (thêm ở 1.31.0): bảng bốn gói chỉ thu qua thanh toán trong Hội Mình. Ba cột của tính năng này còn trong database, bật lại được nếu cần.
- **Tiền bán hàng không còn đi qua Hội Mình.** Bỏ "Có thể rút", "Đang giữ 14 ngày" và nút "Rút tiền" ở trang Tiền và Bàn điều khiển; thay bằng "Đã thu 30 ngày" và "Đơn chờ xác nhận". Đơn của hội (gói thành viên, sản phẩm) chỉ trả bằng chuyển khoản tới tài khoản chủ hội; MoMo, VNPAY, PayPal và tài khoản SePay của Hội Mình chỉ còn dùng cho đơn mua gói Hội Mình. Mục "Cách thanh toán" ở Giá và gói thành đường dẫn sang Nhận tiền.
- Đơn chủ hội tự bấm xác nhận được giữ 24 giờ (đơn khác vẫn 30 phút); chủ hội xác nhận được trong 7 ngày kể từ lúc đơn được tạo.
- Hoàn tiền đơn của hội: hệ thống ghi sổ và thu hồi quyền, chủ hội tự chuyển lại tiền cho người mua (như chuyển khoản trước đây).
- **Bỏ email thông báo của hội.** Công tắc "Gửi email cho tất cả thành viên" khi đăng bài nay là "Báo cho tất cả thành viên": mỗi thành viên nhận một thông báo trong ứng dụng, không còn email. Công tắc cùng tên ở màn tạo sự kiện được gỡ vì trước giờ bật lên không gửi gì. Email hệ thống giữ nguyên: xác minh tài khoản, đặt lại mật khẩu, biên nhận thanh toán, nhắc gia hạn gói, nhắc sự kiện.
- Email nhắc gia hạn gói ghi rõ tên hội và tên gói, gửi trước 7, 3, 1 ngày và một lần khi hết hạn.
- Thẻ "Gói nền tảng của bạn" ở Hội của tôi thành "Gói của các hội": mỗi hội một dòng.

### Kỹ thuật

- Migration `0011_plans_per_community`: thêm bốn dòng gói; `communities` có `plan_key`, `plan_ends_at`, `is_free_slot`; `platform_subscriptions` chuyển từ một dòng mỗi workspace sang một dòng mỗi hội (`community_id`); xóa trạng thái dùng thử và khóa của workspace. Chạy lại được. **Phải áp dụng lên database thật trước khi merge.**
- Migration `0012_owner_payout`: bảng `community_payout_accounts` (mỗi hội một dòng: ngân hàng, số tài khoản, tên chủ tài khoản, cách xác nhận, mã bí mật của địa chỉ báo có), có policy RLS theo workspace. Chạy lại được. **Cũng phải áp dụng lên database thật trước khi merge.**
- `packages/core/src/services/owner-payout.ts`: cài tài khoản, dựng mã VietQR, danh sách đơn chờ, `confirmOwnerOrder`, `handleOwnerBankWebhook`. Thanh toán của đơn hội mang `instruction.payee = 'owner'`; webhook của tài khoản Hội Mình và việc ghép tay ở đối soát không xác nhận được các đơn này.
- API mới: `GET/PUT /v1/communities/:id/payout-account`, `POST /v1/communities/:id/payout-account/rotate-webhook`, `POST /v1/communities/:id/orders/:orderId/confirm-received`, `POST /webhooks/bank/:token`. `GET /v1/communities/:id/payout` đổi dữ liệu trả về (bỏ số dư, thêm `ready`, `received30Minor`, `pendingCount`). Khung hội và trang giới thiệu trả thêm `paymentsReady`.
- Luật giá, chu kỳ, ngày tặng nằm ở `packages/contracts/src/plans.ts` (hàm thuần `planQuote`), API và web dùng chung.
- `packages/core/src/services/plans.ts`: gói đang có hiệu lực của một hội tính theo thời điểm hiện tại (không chờ cron), các hàm chặn `requirePlanFeature`, `assertRoomForMember`, `assertCommunityHasPlan`.
- API: `GET /v1/plans` trả bốn gói; `GET /v1/communities/:id/plan`; `PUT /v1/admin/plans` lưu cả bảng (thay `PATCH /v1/admin/plans/:key`); đích thanh toán `platform` nhận `communityId`, `planKey`, `cycle`; bỏ `GET /v1/workspaces/:id/platform`. Mã lỗi mới `member_cap` (409).
- Khung hội (`/shell`) trả thêm `plan` cho người quản lý hội.
- Ngày bắt đầu kỳ tính từ lúc gói được kích hoạt, không tính từ giờ giao dịch ngân hàng.
- Test: core `plans.test.ts` (17) và `owner-payout.test.ts` (8), web `platform-plan.test.ts` (10) và `owner-todo.test.ts`, e2e luồng 2, 3, 5, 6, 7, 9, 20, 21, 22.
- Migration `0013_install_gate_push`: bảng `push_subscriptions` (thiết bị đã bật thông báo đẩy) và `login_links` (link đăng nhập một lần, chỉ lưu mã băm), đều có policy RLS theo người dùng; thêm cờ `install_gate` (mặc định tắt). Chạy lại được.
- Thông báo đẩy tự viết bằng WebCrypto để chạy trên Cloudflare Workers (`packages/core/src/lib/web-push.ts`): mã hóa nội dung theo RFC 8291, xác thực máy chủ theo RFC 8292. Test đối chiếu với thư viện `http_ece` độc lập. Gửi qua hàng đợi (`push.send`); thiết bị dịch vụ đẩy báo đã chết thì tự gỡ.
- Cần hai secret mới cho thông báo đẩy: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, tạo bằng `node scripts/generate-vapid.mjs`. Thiếu thì không gửi thông báo đẩy, mọi thứ khác vẫn chạy.
- API mới: `GET /v1/me/push`, `POST /v1/me/push/subscribe`, `POST /v1/me/push/unsubscribe`, `POST /v1/auth/login-link`, `POST /v1/auth/login-link/consume`. `GET /v1/me` trả thêm `app` (công tắc bắt cài, khóa công khai của thông báo đẩy). Trang mới `/vao` nhận link đăng nhập một lần.
- Web: `manifest.webmanifest`, bộ biểu tượng, service worker `/sw.js` chỉ lo thông báo đẩy (không lưu đệm trang, nên cơ chế tự cập nhật phiên bản giữ nguyên). Luật của màn bắt cài là hàm thuần `gateScreen` (`apps/web/src/lib/install-gate.ts`).
- Test thêm: core `web-push.test.ts` (6), `install-push.test.ts` (10); web `install-gate.test.ts` (10); e2e luồng 23 (4 trường hợp).

## 1.31.2 - 2026-11-11

Ảnh bìa của hội hiện trọn ở trang Khám phá và trang Tạo hội, đúng khung 16:9 của ảnh chủ hội tải lên. Hội chưa có ảnh bìa thì thẻ ở Khám phá hiện ảnh đại diện (logo) thay cho ô màu trống.

### Sửa lỗi

- **Thẻ hội ở trang Khám phá cắt mất ảnh bìa.** Khung ảnh cao cố định 150px nên ảnh 16:9 chỉ còn một dải ở giữa. Nay khung theo đúng tỉ lệ 16:9 của ảnh bìa (ảnh nên từ 1280 x 720px), ảnh hiện trọn trên cả máy tính lẫn điện thoại.
- **Hội chưa có ảnh bìa hiện một ô màu trống ở Khám phá.** Nay hiện ảnh đại diện (logo vuông) của hội ở giữa nền màu; chưa có logo thì hiện chữ cái đầu.
- **Màn hình Tạo hội: tên hội đè lên ảnh bìa, không đọc được.** Hội có ảnh bìa thì ảnh hiện trọn 16:9, còn logo, tên hội, số thành viên và mô tả ngắn nằm ở dải riêng bên dưới ảnh; nhãn xanh ở góc không còn che ảnh. Hội chưa có ảnh bìa vẫn hiện nền màu kèm tên như trước.

### Kỹ thuật

- Tỉ lệ khung ảnh bìa gom về hằng `COVER_RATIO` trong `apps/web/src/pages/public/Discovery.tsx`, thẻ ở Khám phá và băng chuyền ở Tạo hội dùng chung.
- Ảnh bìa ở hai trang này là thẻ `img` (có `alt`, Khám phá tải lười) thay cho ảnh nền CSS.
- Dòng hướng dẫn ở Cài đặt chung, mục Ảnh bìa, ghi đúng những nơi ảnh hiện.

## 1.31.1 - 2026-11-11

Gói Hội Mình thiết lập được trọn vẹn trong quản trị hệ thống, kể cả khi database chưa có gói nào.

### Sửa lỗi

- **Database chưa có gói thì quản trị không làm gì được.** Database thật (tạo ngày 10/11) có bảng gói trống: chủ hội thấy giá "…", trang bảng giá công khai báo "Chưa có gói nào", người mới không bắt đầu dùng thử được, còn trang Hệ thống, Gói nền tảng hiện một thẻ toàn số 0 với nút "Sửa gói" bấm không ra gì. Nay trang này báo "Chưa có gói nào" và mở sẵn ô **Tạo gói**: tên, giá tháng, giá năm, ngày dùng thử (điền sẵn 499.000đ, 4.990.000đ, 14 ngày để kiểm tra lại) và cách thu tiền. Tạo xong là có thẻ gói và sửa tiếp được như thường.
- **Giá gói nhận cả số 0, số âm, số lẻ.** Nay giá tháng và giá năm phải là số nguyên lớn hơn 0, ngày dùng thử từ 0 tới 365, tên gói không để trống; áp dụng cho cả tạo lẫn sửa.

### Kỹ thuật

- `PATCH /v1/admin/plans/:key` tạo gói khi chưa có (cần đủ tên, giá tháng, giá năm), có rồi thì sửa. Chỉ tạo được khóa `hoiminh` (`PLATFORM_PLAN_KEY`): chưa có quyết định mở gói thứ hai. Ghi nhật ký `plan.create`. Không có migration.
- Test: core `plan-setup.test.ts` (7), e2e luồng 21.

## 1.31.0 - 2026-11-11

Gói Hội Mình thu tiền được bằng link thanh toán ngoài, do quản trị hệ thống chọn. Trang Gói Hội Mình (`/admin/goi`) được thiết kế lại thành một trang riêng, một cột dọc ở giữa, có hai tab chu kỳ và khung thanh toán bật lên. Trước đây phần thanh toán bung ra ngay trong hàng thẻ của "Hội của tôi", ép ba thẻ vào một hàng làm chữ xuống dòng từng từ và nút tràn ra ngoài thẻ.

### Tính năng

- **Chọn cách thu tiền gói Hội Mình** (Hệ thống, Gói nền tảng, "Sửa gói"): "Thanh toán trong Hội Mình" (chuyển khoản QR, MoMo, VNPAY, PayPal, như trước) hoặc "Link thanh toán ngoài". Chọn link ngoài thì nhập link cho gói tháng, gói năm; để trống chu kỳ nào thì chu kỳ đó không bán. Thẻ gói ghi rõ đang thu tiền theo cách nào.
- **Chủ hội ở chế độ link ngoài:** trang Gói Hội Mình chỉ hiện chu kỳ có link; nút thanh toán trên thẻ gói dẫn thẳng sang link đó (mở ở thẻ mới), không qua khung bật lên.
- **Link điền sẵn người trả.** Viết `{workspace_id}`, `{email}`, `{cycle}` vào link thì Hội Mình điền mã hội, email chủ hội, chu kỳ (`monthly` hoặc `yearly`) khi mở. Link không có `{workspace_id}` thì tự thêm `hm_ws` và `hm_cycle` vào cuối, để hệ thống ngoài luôn biết hội nào trả. Email chỉ được gửi đi khi link có ghi `{email}`.
- **Chưa có:** Hội Mình chưa tự kích hoạt gói khi khách trả qua link ngoài (phần nhận webhook từ hệ thống ngoài chưa xây). Ô cài đặt có ghi rõ điều này.

### Thay đổi

- **Gói Hội Mình là một trang riêng, một cột**, cả trên máy tính lẫn điện thoại, cùng kiểu với trang bảng giá công khai. Từ trên xuống: thẻ "Gói của bạn" (tên gói, nhãn trạng thái như "Còn 3 ngày", ngày hết hạn, số hội và thành viên), hai tab "Theo tháng" và "Theo năm", rồi thẻ gói ghi giá của tab đang chọn kèm bốn dòng quyền lợi. Có lối "Hội của tôi" để quay về.
- **Bấm nút trên thẻ gói thì khung thanh toán bật lên**: ghi lại gói và số tiền, chọn cách thanh toán bằng ô chọn một kiểu radio (chuyển khoản QR, MoMo, VNPAY, PayPal), một nút ghi rõ số tiền.
- **Thẻ "Gói nền tảng của bạn" ở Hội của tôi chỉ còn một nút** ("Thanh toán gói" khi đang dùng thử hoặc hết hạn, "Quản lý gói" khi gói đang chạy), bấm là sang trang gói. Thẻ không còn bung phần thanh toán ra tại chỗ, không còn hai nút "Đóng".
- **Mục "Hội của tôi" trên thanh đầu trang sáng ở mọi trang con** (Gói Hội Mình, Tạo hội). Trước đây vào các trang này thì không mục nào sáng.

### Sửa lỗi

- **Giá hiện "…/tháng" và nút "Thanh toán …" khi chưa có bảng giá.** Nay trong lúc tải hiện khung chờ; tải không được thì có dòng báo kèm nút "Thử lại", nút trên thẻ gói bị khóa cho tới khi có giá.
- **Thẻ gói ghi "dùng thử đến" một ngày đã qua.** Ngày hết hạn đã qua mà hội chưa bị khóa thì nay ghi "Đã hết hạn, hết hạn ngày..." kèm lời nhắc thanh toán để không bị khóa tạo nội dung.
- **Giá hiển thị lấy theo đúng gói của hội** (`planKey`), trùng với gói máy chủ dùng để tính tiền; trước đây lấy gói đầu danh sách.
- **"2 tháng miễn phí" của gói năm được tính từ giá thật** (12 tháng trừ giá năm), không còn ghi cứng; không chia chẵn theo tháng thì ghi số tiền tiết kiệm, gói năm không rẻ hơn thì không ghi gì.

### Kỹ thuật

- Trạng thái gói gom về một hàm thuần `planView` trong `apps/web/src/lib/platform-plan.ts` (có test), thẻ ở Hội của tôi và trang gói dùng chung.
- Trang mới `apps/web/src/pages/owner/WorkspacePlan.tsx`; lớp `.seg` trong `@hoiminh/ui` cho hai tab dạng viên thuốc.
- Migration `0010_plan_payment_link.sql`: thêm ba cột vào bảng `plans` (`payment_mode` mặc định `gateway`, `monthly_pay_url`, `yearly_pay_url`). Chỉ thêm cột, viết `IF NOT EXISTS`. **Phải áp dụng lên database thật trước khi đưa bản này lên chạy**, vì mọi truy vấn lấy gói đều đọc các cột này.
- `PATCH /v1/admin/plans/:key` nhận thêm `paymentMode`, `monthlyPayUrl`, `yearlyPayUrl`. Link phải là `https`, dài tối đa 500 ký tự; chế độ link mà không có link nào thì bị từ chối. `GET /v1/plans` trả thêm ba trường này.
- `POST /v1/checkout` với gói nền tảng bị từ chối khi gói đang ở chế độ link ngoài, để lựa chọn của quản trị không bị vượt qua bằng cách gọi thẳng API.
- Test e2e luồng 20: quản trị cài link, nút thanh toán của chủ hội dẫn thẳng sang link có mã hội, quản trị trả về như cũ.
- Test e2e luồng 6 đi qua trang mới: bấm liên kết "Thanh toán gói" ở `/admin`, sang `/admin/goi`, đổi tab năm rồi về tab tháng, mở khung thanh toán, thanh toán.

## 1.30.0 - 2026-11-11

Tin nhắn: gửi được tệp đính kèm (tối đa 5MB), có đủ ba trạng thái đã gửi, đã nhận, đã xem, có tab Lưu trữ, chặn và báo cáo người dùng; hàng thao tác dưới mỗi tin được xếp lại và khung chat không còn kéo ngang được.

### Tính năng

- **Đính kèm tệp trong tin nhắn, tối đa 5MB.** Nút kẹp giấy ở thanh công cụ của ô nhập, hoặc kéo thả tệp vào khung chat. Nhận PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), văn bản (.txt) và .zip. Tệp quá 5MB hoặc sai loại bị chặn ngay tại máy kèm lý do, máy chủ kiểm lại lần nữa lúc nhận tệp. Tin hiện thẻ tệp có tên và dung lượng; bấm là tải về với đúng tên gốc. Tệp là tệp riêng: chỉ hai người trong hội thoại lấy được link tải, link sống 5 phút. Bảng "Thông tin hội thoại" có thêm mục Tệp.
- **Ba trạng thái của tin mình gửi: Đã gửi, Đã nhận, Đã xem.** "Đã nhận" là khi ứng dụng của người nhận đã nhận được tin (họ đang mở Hội Mình ở bất kỳ trang nào), "Đã xem" là khi họ mở hội thoại.
- **Tab "Lưu trữ" trong danh sách hội thoại.** Hội thoại đã lưu trữ nằm ở đây (trước đây lưu trữ xong là không tìm lại được cho tới khi có tin mới). Bỏ lưu trữ từ menu ba chấm của dòng hội thoại hoặc từ bảng thông tin. Có tin mới thì hội thoại vẫn tự trở lại danh sách chính.
- **Menu ba chấm ở đầu khung chat: Xem hồ sơ, Chặn, Báo cáo.**
  - Chặn: hai bên không nhắn được cho nhau cho tới khi người chặn bỏ chặn. Ô nhập đổi thành dòng báo kèm nút Bỏ chặn.
  - Báo cáo: chọn lý do (spam, quấy rối, lừa đảo, nội dung không phù hợp, lý do khác) và mô tả thêm. Báo cáo tới quản trị hệ thống: có thông báo, và có trang mới **Hệ thống · Báo cáo người dùng** để xem, mở người bị báo cáo và đánh dấu đã xử lý.
- Thu hồi tin nhắn nay xóa luôn ảnh và tệp của tin đó khỏi kho lưu trữ (trước đây ảnh đã thu hồi vẫn mở được bằng link cũ).

### Thay đổi

- **Hàng dưới mỗi tin nhắn.** Giờ gửi nằm dưới bong bóng (không còn nằm trong bong bóng), kế đó là cảm xúc đã thả và trạng thái "Đã gửi", "Đã xem". Rê chuột vào tin thì các nút Trả lời, Sao chép, Thu hồi hiện ngay cạnh giờ gửi, dạng biểu tượng phẳng (trước đây là các nút tròn nằm bên hông bong bóng).
- **Thanh sáu cảm xúc hiện ngay khi rê chuột vào tin**, ở đầu bên kia của hàng: tin dài thì thanh nằm sát mép xa của bong bóng, tin ngắn thì nằm kế các nút thao tác. Bấm một biểu tượng để thả, bấm lại (hoặc nút X) để gỡ.
- **Bỏ nút thích ở góc dưới phải của bong bóng.** Không còn phải rê vào nút đó mới thấy thanh cảm xúc.
- **Bỏ nút thích nhanh trong ô nhập.** Góc phải ô nhập luôn là nút Gửi, mờ đi khi chưa gõ gì. Muốn gửi một lượt thích thì chọn 👍 trong bảng biểu tượng cảm xúc rồi gửi.
- Điện thoại và cột chat hẹp: chạm vào tin thì nút thao tác hiện cạnh giờ gửi, thanh cảm xúc hiện ở dòng ngay dưới; tin vừa chạm tự cuộn vào tầm nhìn.
- Bảng "Thông tin hội thoại" chỉ đứng thành cột thứ ba khi màn hình rộng từ 1536px (trước là 1280px). Ở màn hình laptop 1366px cột chat trước đây chỉ còn khoảng 420px; nay bảng trượt đè lên khi bấm mở, cột chat rộng 760px.
- Máy tính bảng dọc và cửa sổ hẹp hơn 1024px: mỗi lúc một màn như điện thoại (danh sách, rồi khung chat có nút quay lại). Trước đây ở 768px cột chat chỉ còn khoảng 200px.

### Sửa lỗi

- **Khung chat kéo ngang được sang phải làm vỡ khung.** Thanh cảm xúc ẩn của từng tin vẫn chiếm chỗ bên ngoài khung nên luồng tin có thanh cuộn ngang. Thanh cảm xúc nay nằm trong hàng dưới bong bóng, luồng tin không còn cuộn ngang.

### Cần làm khi triển khai

- Áp dụng migration `0009_message_files_blocks.sql` lên database thật trước khi merge (thêm cột tệp đính kèm và `delivered_at` cho tin nhắn, hai bảng `user_blocks` và `user_reports` kèm policy; chạy lại nhiều lần vẫn an toàn).

## 1.29.0 - 2026-11-11

Kéo thả để xếp ảnh trang giới thiệu, ảnh bìa hồ sơ kiểu Facebook, thanh menu bên trái thu gọn được, và mọi ô chọn (dropdown) dùng danh sách riêng theo màu chủ đề.

### Tính năng

- **Ảnh bìa hồ sơ.** Tài khoản, Hồ sơ: ảnh bìa nằm ngang ở đầu trang, ảnh đại diện tròn đè lên mép dưới, như trang cá nhân Facebook. Bấm "Chỉnh sửa ảnh bìa" ngay trên ảnh để tải ảnh lên, gỡ ảnh hoặc chọn màu nền dùng khi không có ảnh. Nút máy ảnh trên ảnh đại diện để đổi ảnh đại diện. Trước đây hồ sơ chỉ chọn được màu nền, không tải ảnh bìa được. Trang hồ sơ công khai hiện ảnh bìa này.
- **Kéo thả để đổi thứ tự ảnh và video trang giới thiệu** (Cài đặt, Hội, Thông tin). Nhấn giữ một ảnh nhỏ rồi kéo tới chỗ mới; dùng được bằng chuột lẫn ngón tay, vuốt để cuộn trang thì không bị tính là kéo. Bàn phím: Shift cùng phím mũi tên trái, phải. Hai nút "Lên trước", "Ra sau" được bỏ; "Đổi ảnh" (hoặc "Sửa link") và "Xóa" chuyển lên góc khung to.

- **Thu gọn thanh menu bên trái** (máy tính). Nút ở đầu thanh menu thu thanh từ 264px còn một dải biểu tượng 72px sát mép trái, nội dung trang rộng thêm; bấm lần nữa để mở ra. Khi thu gọn, rê chuột lên biểu tượng sẽ thấy tên mục, tên nhóm thành đường kẻ mảnh, hai nút "Viết bài" và "Mời thành viên" chỉ còn biểu tượng. Lựa chọn được nhớ trên máy. Áp dụng cho thanh menu của hội và của khu quản trị hệ thống; điện thoại vẫn dùng menu trượt như cũ.

### Thay đổi

- **Mọi ô chọn dùng danh sách do app tự vẽ**, theo màu chủ đề ở cả giao diện sáng lẫn tối: nền thẻ, mục đang chọn tô màu ngọc kèm dấu tích, mỗi dòng cao 42px cho dễ bấm trên điện thoại. Danh sách tự mở lên trên khi gần đáy màn hình và không bị thẻ hay khung bật lên cắt mất. Bàn phím: mũi tên, Home, End, Enter, Esc, gõ chữ cái đầu để nhảy tới mục (không cần gõ dấu). Áp dụng cho 29 chỗ, gồm cả đổi vai trò và gói ở trang Thành viên, chọn chuyên mục khi viết bài, chọn gói ở Giá và gói.
- **Thông báo, "Theo cộng đồng":** tên hội hiện đủ (dài thì xuống dòng), ô chọn mức thông báo nằm riêng một dòng bên dưới; ba lựa chọn ghi rõ là "Tất cả thông báo", "Chỉ khi nhắc đến tôi", "Tắt thông báo".

### Sửa lỗi

- **Giao diện tối: danh sách của ô chọn hiện nền trắng chữ nhạt, gần như không đọc được.** Danh sách gốc của trình duyệt không theo màu của app; nay đã thay bằng danh sách riêng.
- **Hồ sơ, "Liên kết": ô nhập địa chỉ bị đẩy ra ngoài thẻ**, vì ô chọn loại liên kết chiếm hết bề ngang. Nay ô chọn rộng cố định 140px, ô địa chỉ lấy phần còn lại; màn hình hẹp thì ô địa chỉ xuống dòng dưới.

### Kỹ thuật

- Migration `0008_user_cover.sql`: thêm cột `users.cover_url` (text, cho phép rỗng). Chỉ thêm cột. **Phải áp dụng lên database thật trước khi đưa bản này lên chạy**, vì mọi truy vấn lấy người dùng đều đọc cột này.
- `PATCH /v1/me` nhận thêm `coverFileId` (id tệp, hoặc null để gỡ). Đổi hoặc gỡ ảnh bìa thì tệp cũ trên R2 được dọn; `FILE_REFERENCES` có thêm `users.cover_url`.
- `Select` trong `@hoiminh/ui` giữ nguyên cách dùng (`value`, `defaultValue`, `onChange` đọc `e.target.value`, các thẻ `<option>` con) nên các trang không phải sửa. Trong `style`, ô chuẩn chỉ nhận phần bề ngang; `variant="chip"` cho ô dạng viên thuốc.
- Kéo thả viết bằng pointer events trong `apps/web/src/lib/use-drag-sort.ts`, không thêm thư viện.

## 1.28.0 - 2026-11-11

Nhập bài từ link YouTube lấy luôn tên bài, mô tả và thời lượng; ảnh bìa khóa học hiện trọn, không còn chữ đè lên; đổi được tên module ngay trong cột giáo trình.

### Tính năng

- **Nhập nhanh từ link YouTube lấy luôn tên, mô tả, thời lượng.** Trước đây mỗi bài mang tên tạm kiểu "Bài 1 · YouTube q1sMd3Pk90U". Nay tên bài là tên video (luôn lấy được, không cần cài gì). Mô tả của video vào phần nội dung bài và thời lượng được điền sẵn khi máy chủ có `YOUTUBE_API_KEY` (xem mục Kỹ thuật); chưa có key thì máy chủ thử đọc trang xem video, YouTube chặn thì bài chỉ có tên. Trong lúc nhập có dòng "Đang nhập bài 3/11". Link không nhận diện được thì được giữ lại trong ô kèm lời báo, không lặng lẽ bỏ qua; nhập đứt giữa chừng thì ô chỉ còn các link chưa nhập, bấm lại không tạo trùng bài.
- **Nút "Lấy tên từ YouTube cho N bài"** ở cột giáo trình, hiện khi khóa còn bài mang tên tạm từ lần nhập trước: một lần bấm là đổi hết sang tên thật, kèm mô tả và thời lượng. Nội dung và thời lượng đã tự điền thì giữ nguyên.
- **Nút "Lấy tên và mô tả từ YouTube"** trong khung soạn bài, hiện khi link video là YouTube: điền tên, mô tả (nếu bài chưa có nội dung) và thời lượng (nếu chưa điền) vào bản nháp, bấm "Lưu bài" để giữ.
- **Đổi tên module tại chỗ**: bấm vào tên module hoặc nút bút chì cạnh nó, gõ tên mới, Enter hoặc bấm ra ngoài để lưu, Esc để hủy. Trước đây module tạo ra mang tên "Module 1" và không có chỗ nào sửa.

### Thay đổi

- **Ảnh bìa khóa học không còn chữ đè lên.** Khóa đã có ảnh bìa thì thẻ khóa học, thẻ trong Cửa hàng và trang khóa học không in tên khóa lên ảnh nữa (tên vẫn nằm ngay dưới ảnh). Khóa chưa có ảnh, đang dùng bìa màu, vẫn in tên lên nền màu như cũ.
- **Bìa theo tỷ lệ 16:9** trên thẻ khóa học, thẻ Cửa hàng, thẻ xem trước khi tạo khóa và trang khóa học, nên ảnh bìa kiểu thumbnail YouTube hiện trọn, không bị cắt mất phần trên và dưới (trước đây bìa cao cố định 160 đến 220px).
- **Trang khóa học: bìa nằm trên cùng, nút quay lại nổi trên bìa.** Bỏ dòng "‹ Khóa học" mờ phía trên; nút quay lại là một nút tròn nền đặc có bóng ở góc trên trái bìa, đọc rõ trên mọi ảnh. Nhãn "Khóa học · Premium", tên khóa và dòng "N module · N bài" chuyển xuống dưới ảnh.
- Lưu bài trong khung soạn không còn làm tròn thời lượng thành phút chẵn khi ô "Thời lượng (phút)" không đổi (bài 12:34 lưu lại vẫn là 12:34, trước đây thành 13:00).
- Rê chuột lên tên bài trong cột giáo trình thì hiện đủ tên (tên video thường dài hơn chỗ hiển thị).
- **Khung soạn bài: khung video nằm trên, ô dán link nằm dưới.** Trước đây khung video nhỏ nằm cạnh ô dán link, chia khung soạn thành hai cột chật. Nay là một cột: video rộng theo khung soạn, dưới là ô link, dòng hướng dẫn và nút "Lấy tên và mô tả từ YouTube".

### Kỹ thuật

- API mới `POST /v1/video/meta` (cần đăng nhập): trả `{ embed, meta }`, `meta` gồm `title`, `description`, `durationSeconds`. Máy chủ chỉ gọi tới youtube.com và googleapis.com với mã video đã kiểm định dạng, không gọi theo link người dùng dán.
- **Secret tùy chọn `YOUTUBE_API_KEY`** (key của YouTube Data API v3, miễn phí 10.000 lượt mỗi ngày, mỗi video tốn 1 lượt): có key thì tên, mô tả, thời lượng lấy qua API chính thức. Đặt bằng `wrangler secret put YOUTUBE_API_KEY` ở Worker `hoiminh-api`. Key sai hoặc hết hạn mức thì ghi log `video_meta.youtube_api_failed` rồi lấy theo cách không cần key.
- Không có key: tên lấy từ oEmbed của YouTube, mô tả và thời lượng đọc từ trang xem video. Thử với YouTube thật từ máy chủ đặt ở trung tâm dữ liệu: oEmbed trả tên đúng, còn trang xem bị YouTube chuyển sang trang kiểm tra robot, nên không có key thì nhiều khả năng bài chỉ có tên. Không lấy được cả tên thì `meta` là null và bài giữ tên tạm.
- Đường dẫn này không mở transaction database (`NO_DB_PATHS` trong `apps/api/src/middleware/auth.ts`), để không giữ một kết nối database trong lúc chờ YouTube trả lời.

## 1.27.0 - 2026-11-10

Chủ hội tự sửa được ảnh và video của trang giới thiệu, ảnh bìa ở thẻ hội, và logo vuông hiện ở mọi nơi có tên hội.

### Tính năng

- **Ảnh và video trang giới thiệu** (Cài đặt, Hội, Thông tin). Bố cục giống chính trang giới thiệu: một khung to hiện mục đang chọn, bên dưới là hàng ảnh nhỏ, cuối hàng là hai ô "Thêm ảnh" và "Thêm video". Chủ hội và quản trị thêm tối đa 12 ảnh và video; chọn một ảnh nhỏ rồi bấm "Lên trước", "Ra sau", "Đổi ảnh" (hoặc "Sửa link") hay "Xóa". Mỗi thay đổi lưu ngay, không cần bấm "Lưu thay đổi". Chọn được nhiều ảnh một lượt. Video dùng link YouTube, Vimeo, Loom, TikTok, Facebook hoặc Bunny (không tải tệp video lên); link không nhận diện được thì báo ngay và không thêm.
- **Trang giới thiệu hiện đúng bộ ảnh và video đó.** Mục số 1 hiện đầu tiên. Ảnh hiện trọn, không bị cắt; video có nút phát, bấm là phát ngay trong trang; video YouTube có ảnh xem trước. Có nút mũi tên hai bên để lướt và hàng ảnh nhỏ bên dưới. Hội chưa thêm gì thì giữ như cũ: nền màu của hội kèm ảnh bìa ba khóa học đầu.
- **Ảnh bìa của hội** (cùng trang Cài đặt). Ảnh ngang 16:9, hiện ở thẻ hội bên phải trang giới thiệu và trên thẻ hội ở trang Khám phá. Chưa có ảnh thì thẻ vẫn hiện nền màu kèm tên hội.
- Chủ hội và quản trị mở trang giới thiệu sẽ thấy nút "Sửa ảnh và video" ở góc khung ảnh, dẫn thẳng tới mục đó trong Cài đặt. Hội chưa có ảnh nào thì có thêm một dòng nhắc (chỉ quản trị thấy).

### Sửa lỗi

- **Logo vuông đã tải lên nhưng nhiều nơi vẫn hiện hai chữ cái.** Nay logo hiện ở: mục "Hội tham gia" trong hồ sơ, bảng chuyển hội, trang Khám phá, cài đặt thông báo, Gói và thanh toán, thư viện khóa học, "Hội của tôi" (phần hội đã tham gia) và trang chứng nhận.
- Trang giới thiệu: bấm phát video giới thiệu phải bấm thêm một lần nữa trong khung video mới chạy. Nay bấm một lần là phát.
- Cài đặt, Thông tin: tải logo hỏng (tệp quá lớn, sai loại) không báo gì. Nay hiện lý do ngay dưới ô tải ảnh.

### Kỹ thuật

- Migration `0007_about_media.sql`: thêm cột `communities.about_media` (jsonb, mặc định mảng rỗng). Chỉ thêm cột, không đổi dữ liệu cũ. **Phải áp dụng lên database thật trước khi đưa bản này lên chạy.**
- API mới `PUT /v1/communities/:id/about-media` (quyền `settings.manage`), nhận đủ cả danh sách theo thứ tự. Ảnh bị bỏ khỏi danh sách thì tệp trên R2 được dọn; `FILE_REFERENCES` có thêm kiểu `id-in-items` để việc dọn tệp biết ảnh nào còn nằm trong bộ này.
- Khách chưa đăng nhập xem trang giới thiệu qua cache 60 giây (có từ trước), nên ảnh vừa đổi có thể mất tối đa một phút mới tới người lạ; chủ hội thấy ngay.

## 1.26.0 - 2026-11-10

Trang Tin nhắn làm lại theo cách dùng của Zalo: ba cột liền nhau lấp đầy màn hình, và các thao tác quen tay trên từng tin (trả lời, thả cảm xúc, thu hồi) cùng ghim hội thoại.

### Tính năng

- **Khung Tin nhắn lấp đầy màn hình.** Danh sách hội thoại, khung chat và bảng "Thông tin hội thoại" đứng liền nhau, cao đúng bằng phần màn hình dưới đầu trang, không còn khoảng trống bên dưới. Chỉ luồng tin và danh sách cuộn, cả trang đứng yên. Tin mới nhất nằm sát ô nhập như Zalo.
- **Trả lời trích dẫn.** Rê vào một tin (điện thoại: chạm vào tin) rồi bấm Trả lời: tin gốc hiện phía trên ô nhập và nằm trong tin trả lời; bấm vào phần trích dẫn thì khung chat cuộn tới tin gốc.
- **Thả cảm xúc** bằng sáu biểu tượng 👍 ❤️ 😆 😮 😭 😡. Bấm nút thích ở góc tin để thích nhanh, rê vào nút đó để chọn cảm xúc khác; mỗi người một cảm xúc trên một tin, đổi hoặc gỡ được.
- **Thu hồi tin nhắn** của chính mình trong 24 giờ sau khi gửi. Nội dung và ảnh bị xóa hẳn; hai bên chỉ còn thấy "Tin nhắn đã được thu hồi", kể cả ở phần trích dẫn và dòng xem trước trong danh sách.
- **Ghim hội thoại** lên đầu danh sách (từ menu ba chấm của từng dòng hoặc từ bảng thông tin). Ghim là của riêng mỗi người.
- **Ô nhập kiểu Zalo:** nhiều dòng, tự cao theo nội dung; Enter để gửi, Shift Enter để xuống dòng (điện thoại gửi bằng nút); thanh công cụ có gửi ảnh và bảng biểu tượng cảm xúc; dán ảnh từ bộ nhớ tạm hoặc kéo thả ảnh vào khung chat là gửi; chưa gõ gì thì nút gửi là nút thích nhanh. Tin hiện ngay với trạng thái "Đang gửi", rồi "Đã gửi", "Đã xem".
- **Link trong tin nhắn bấm được.** Link trong Hội Mình mở ngay tại chỗ, link ngoài mở tab mới. Tin nhắn chào tự động có link "Bắt đầu tại đây" nay bấm vào là tới.
- **Bảng "Thông tin hội thoại"** (bật tắt bằng nút ở góc phải khung chat): hàng thao tác nhanh (ghim, xem hồ sơ, quản lý thành viên, lưu trữ), thông tin thành viên, toàn bộ ảnh và link đã gửi trong hội thoại.
- Dưới tên người đang chat có trạng thái "Đang hoạt động" hoặc "Truy cập ... trước". Danh sách hội thoại hiện "Bạn: ..." khi tin cuối là của mình, và "[Hình ảnh]" khi tin cuối chỉ có ảnh.
- Tin liền nhau của cùng một người gom thành cụm, giờ gửi nằm trong bong bóng cuối cụm; tin chỉ gồm một đến ba biểu tượng cảm xúc hiện to, không khung.
- **Điện thoại:** vào Tin nhắn thấy danh sách trước; chạm một hội thoại thì khung chat chiếm trọn màn hình (ẩn thanh tab dưới để nhường chỗ cho ô nhập), có nút quay lại danh sách.

### Thay đổi

- Người gửi thấy "Đã xem" ngay khi người nhận mở hội thoại (qua kênh thời gian thực), không phải chờ lượt tải lại.
- Mở một hội thoại thì số chưa đọc trong danh sách và chấm đỏ ở đầu trang biến mất ngay.

### Sửa lỗi

- Điện thoại: trang Tin nhắn luôn tự mở hội thoại đầu tiên nên không bao giờ thấy danh sách, không chuyển được sang hội thoại khác, và tin của hội thoại đầu bị đánh dấu đã đọc dù chưa xem.
- Gửi ảnh không kèm chữ bị từ chối ("Dữ liệu không hợp lệ"). Nay tin chỉ có ảnh gửi được bình thường.
- Hội thoại dài hơn 200 tin chỉ hiện 200 tin cũ nhất, tin mới không hiện ra. Nay luôn hiện các tin mới nhất.
- Có tin mới hoặc thứ tự danh sách thay đổi làm khung chat tự nhảy sang hội thoại khác khi chưa chọn hội thoại nào.

### Cần làm khi triển khai

- Áp dụng migration `0006_message_actions.sql` lên database thật trước khi merge (thêm cột cho trả lời, cảm xúc, thu hồi, ghim; chạy lại nhiều lần vẫn an toàn).

## 1.25.0 - 2026-11-10

Safari tự đổi ảnh sang WebP ngay trên máy người dùng, nên việc chuyển ảnh không còn phụ thuộc hạn mức Cloudflare Images.

### Tính năng

- **Bộ mã hóa WebP riêng cho trình duyệt không tự xuất được WebP** (Safari trên iPhone và máy Mac). Trước đây các máy này gửi JPEG lên, máy chủ chuyển sang WebP bằng Cloudflare Images, mỗi ảnh tốn một lượt trong 5.000 lượt miễn phí mỗi tháng. Nay thứ tự khi tải ảnh lên là:
  1. Trình duyệt tự đổi sang WebP bằng canvas (Chrome, Edge, Firefox, Android), như trước.
  2. Không tự đổi được thì web dùng bộ mã hóa WebAssembly (libwebp, gói `@jsquash/webp`), vẫn chạy trên máy người dùng.
  3. Cả hai không được thì gửi JPEG, máy chủ chuyển bằng Cloudflare Images như trước.
- Bước 1 và 2 không tốn lượt chuyển đổi nào của Cloudflare, bao nhiêu người dùng cũng vậy. Cloudflare Images chỉ còn là lưới an toàn cho bước 3.
- Ảnh PNG nền trong suốt giữ được nền trong suốt ở cả ba bước.

### Thay đổi

- Bộ mã hóa chỉ được tải khi cần: Chrome, Edge, Firefox, Android không tải thêm gì. Safari tải một lần khoảng 130 KB (đã nén) ở ảnh đầu tiên, các ảnh sau dùng lại.
- Sau lần đầu thấy canvas không xuất được WebP, các ảnh sau bỏ qua lượt thử đó, đi thẳng tới bộ mã hóa.
- Bộ mã hóa tải hỏng (rớt mạng) thì ảnh đó đi theo bước 3, ảnh sau thử tải lại.
- Thêm thư viện `@jsquash/webp` cho `apps/web`. Không đổi gì ở máy chủ, database hay cấu hình Cloudflare.

### Đã kiểm

- Chạy mã thật trong Chromium, ép canvas trả PNG khi xin WebP để giả Safari, trên cả bản dev lẫn bản build: ảnh PNG 3000x2000 nặng 3,5 MB ra WebP 1200x800 nặng 165 KB, bằng đúng dung lượng Chrome tự nén; vùng trong suốt giữ nguyên; avatar ra 512px. Riêng bước mã hóa ảnh 1200x800 mất khoảng 140 ms (bản SIMD) và 200 ms (bản không SIMD) trên máy thử.
- Mở trang bình thường không tải tệp nào của bộ mã hóa.

### Chưa kiểm chứng được

- Chưa chạy trên Safari thật (máy thử chỉ có Chromium). Thời gian nén trên iPhone đời cũ chưa đo. Sau khi lên bản này, tải một ảnh từ iPhone và xem đường dẫn ảnh kết thúc bằng `.webp`.

## 1.24.0 - 2026-11-10

Video YouTube trong bài học chạy bằng trình phát riêng: người học không bấm sang YouTube được và không thấy video gợi ý.

### Tính năng

- **Trình phát riêng cho video YouTube của bài học.** Người học xem video ngay trong trang bài học. Tên video, logo YouTube, nút "Xem trên YouTube" không còn hiện, và bấm vào đâu trên video cũng không mở YouTube.
- **Không còn video gợi ý.** Dải "Video khác" khi tạm dừng nằm ngoài vùng nhìn. Gần hết video thì trang tự dừng và hiện nút "Xem lại", nên màn hình gợi ý cuối video của YouTube không kịp hiện.
- Các nút do trang tự dựng: phát và tạm dừng, thanh tua, lùi và tới 10 giây, âm lượng, Cài đặt, toàn màn hình. Thanh điều khiển tự ẩn khi đang phát.
- **Nút Cài đặt (bánh răng) có hai mục: Chất lượng và Tốc độ.** Chất lượng gồm "Tự động" và các mức video có (1080p, 720p, 480p, 360p...); để Tự động thì hiện kèm mức đang phát, ví dụ "Tự động (720p)". Mức đã chọn được nhớ ở máy cho các bài sau. Tốc độ từ 0,75x tới 2x. Các mức xếp một cột dọc như YouTube, mức đang chọn có dấu tích. Trên điện thoại bảng Cài đặt mở từ đáy màn hình, chạm ra ngoài là đóng.
- Phím tắt trên máy tính: Space hoặc K để phát và tạm dừng, mũi tên trái phải tua 5 giây, J và L tua 10 giây, M tắt tiếng, F toàn màn hình.
- Điện thoại: mỗi nút cao và rộng 44px, chạm lần đầu để gọi thanh điều khiển, chạm lần nữa để tạm dừng. Toàn màn hình xoay ngang trên Android; iPhone dùng kiểu phủ kín trang.
- Video dọc (link `/shorts/`) hiện trong khung 9:16.

### Thay đổi

- Chỉ áp dụng cho video YouTube ở trang bài học. Video từ Vimeo, Loom, Bunny, TikTok, Facebook giữ khung nhúng gốc của các nền tảng đó. Video giới thiệu ở trang bán hàng và ô xem trước trong trang soạn khóa học cũng giữ nguyên.
- Tạm dừng giữa chừng thì không có gì đè lên khung hình, để người học dừng lại đọc slide.
- Nếu trình duyệt chặn phát có tiếng, sau 4 giây video phát tắt tiếng và hiện nút "Chạm để bật tiếng".
- Video bị gỡ, để riêng tư hoặc bị chủ video tắt quyền nhúng thì hiện lời báo bằng tiếng Việt kèm nút "Thử lại", thay cho màn hình lỗi có link của YouTube.

### Kiểm thử

- `apps/web/src/lib/youtube.test.ts`: tham số nhúng, đồng hồ, danh sách tốc độ và chất lượng, ngưỡng dừng trước giây cuối.
- `e2e/tests/16-bai-hoc-video-youtube.spec.ts` chạy với YouTube giả (`e2e/helpers/youtube.ts`): bấm khắp mặt trình phát và đi Tab hết các nút mà không lượt nào vào được khung YouTube; link sang YouTube và dải "Video khác" nằm ngoài vùng nhìn ở cả video ngang lẫn video dọc; chọn chất lượng và tốc độ trong bảng Cài đặt; hết video hiện "Xem lại".
- Chưa chạy được với YouTube thật trong môi trường kiểm thử (máy chạy thử bị chặn mạng tới YouTube). Cần xem lại trên máy thật sau khi deploy, nhất là việc đổi chất lượng: YouTube không còn cam kết giữ lệnh này cho trình phát nhúng.

## 1.23.0 - 2026-11-10

Tên hội ra đầu trang cạnh ô tìm, logo Hội Mình thu về góc trên trái; điện thoại có menu trượt từ bên trái; dải chọn nền màu trong khung đăng bài được làm lại.

### Thay đổi

- **Đổi chỗ logo Hội Mình và tên hội** (máy tính, theo cách bố trí của Skool): logo Hội Mình nằm ở góc trên trái thanh bên; logo và tên hội đứng ở đầu trang, ngay cạnh ô tìm, bấm vào để chuyển hội. Tên hội hiện đủ chữ: khi đầu trang hẹp thì ô tìm co lại trước (tới 180px), hết chỗ mới cắt tên.
- Bảng chuyển hội rộng theo tên hội dài nhất (tối đa 440px) nên tên trong bảng không còn bị cắt; đóng được bằng cách bấm ra ngoài hoặc nhấn Esc (trước đây chỉ đóng khi rê chuột ra khỏi bảng).
- Dòng "N thành viên · N đang online" dưới tên hội ở thanh bên máy tính được bỏ; hai con số này vẫn có ở cột phải của Bảng tin và ở đầu menu trên điện thoại.
- **Điện thoại có nút mở menu ở đầu trang**: menu trượt ra từ bên trái, chứa đúng các mục của thanh bên trên máy tính (Hôm nay hoặc Bàn điều khiển, Bảng tin, Sự kiện, Thành viên, Xếp hạng, Khóa học, Cửa hàng, nhóm Quản lý của chủ hội, nút Viết bài và Mời thành viên). Đầu menu là hội đang mở kèm số thành viên; chạm vào đó để chuyển hội. Đóng bằng nút X, chạm ra ngoài, Esc, hoặc khi chọn một mục.
- **Nút "Viết bài" ghim ở đáy menu**: danh sách mục phía trên tự cuộn khi màn hình thấp, nút "Viết bài" luôn thấy. Thanh bên trên máy tính cũng vậy (trước đây màn hình thấp thì hai nút cuối bị đẩy ra ngoài, không cuộn tới được).
- Đầu trang trên điện thoại gọn lại: nút menu, tên hội (tối đa hai dòng nên hiện đủ chữ), tìm kiếm, tin nhắn, thông báo. Nút chuyển hội chuyển vào trong menu.
- Bỏ hàng tab con trên điện thoại (Bảng tin, Sự kiện, Thành viên, Xếp hạng; Khóa học, Cửa hàng) vì menu đã có đủ các mục này; trang hiện lại tiêu đề của chính nó. Thanh dưới bốn mục giữ nguyên.
- **Dải chọn nền màu trong khung đăng bài**: chín ô tròn (ô đầu là "Không nền", sau đó tám màu), ô đang chọn có dấu tích và vòng viền. Hẹp thì tự xuống dòng, không cuộn ngang. Bỏ ba nút "Aa", "X" và nút ảnh trong dải vì trùng việc với ô "Không nền" và nút "Ảnh" ở dưới.

### Sửa lỗi

- Vòng viền của ô nền màu đang chọn bị cắt ở mép trái và trên dưới (ô nằm trong vùng cuộn ngang nên phần viền ló ra ngoài bị che).
- Điện thoại 390px: nút "Đăng bài" trong khung đăng bài tràn ra ngoài mép khung khoảng 20px. Hai nút "Ảnh" và "Thêm" nay dùng lề hẹp hơn trên điện thoại.

## 1.22.0 - 2026-11-10

Bài viết trên Bảng tin mở trong khung bật lên kiểu Facebook, và cảm xúc có sáu loại thay cho một nút Thích.

### Tính năng

- **Khung bật lên cho bài viết.** Ở Bảng tin, bấm vào tiêu đề, ảnh, "Xem thêm", số bình luận hoặc nút Bình luận thì bài mở ngay trên Bảng tin. Đóng bằng nút X, phím Esc, bấm ra ngoài khung hoặc nút Quay lại của trình duyệt, và vẫn ở đúng chỗ đang đọc. Số bình luận trên thẻ bài cập nhật ngay khi đóng.
- **Ô viết bình luận ghim ở đáy khung.** Đầu khung (tên tác giả, nút X) và ô viết đứng yên; bài viết rồi tới các bình luận cuộn ở giữa. Ô viết là một dòng bo tròn, tự cao lên khi gõ nhiều; Enter để gửi, Shift Enter để xuống dòng (trên điện thoại gửi bằng nút mũi tên). Gửi xong, khung tự cuộn tới bình luận vừa gửi.
- **Sáu cảm xúc**: Thích, Yêu thích, Haha, Wow, Buồn, Phẫn nộ, cho cả bài viết lẫn bình luận. Bấm nút là Thích, bấm lần nữa là gỡ. Rê chuột lên nút (điện thoại: nhấn giữ) thì thanh cảm xúc bật ra để chọn; chọn loại khác là đổi, không cộng thêm lượt. Cạnh tổng số hiện ba cảm xúc nhiều nhất.
- Trên điện thoại khung phủ kín màn hình. Nút mở rộng ở góc trái khung dẫn tới trang riêng của bài (có mục lục và bài liên quan).

### Thay đổi

- Dưới mỗi bài là hàng nút như Facebook: Thích, Bình luận, và Chia sẻ (ở trang bài và trong khung). Nút Chia sẻ luôn chép địa chỉ trang riêng của bài.
- Bình luận gọn lại: bóng chữ ôm theo nội dung, cảm xúc hiện ở góc bóng chữ, bỏ khung thẻ bao quanh khi ở trong khung bật lên. Kiểu mới áp dụng cho cả thảo luận bài học và sự kiện.
- Bỏ nút "Lưu" dưới bài viết và ba biểu tượng ảnh, tệp, @ trong ô bình luận: các nút này chỉ để trang trí, bấm vào không lưu hay đính kèm được gì.
- Bài đang mở nằm trên địa chỉ (`/bang-tin?bai=<id>`), nên tải lại trang vẫn giữ khung. Trang riêng `/bai-viet/<id>` giữ nguyên cho link chia sẻ, thông báo và email.
- Các chỗ bấm trên thẻ bài vẫn là link thật: bấm giữa hoặc Ctrl bấm vẫn mở trang riêng ở tab mới.
- API `POST /v1/reactions/toggle` nhận thêm `reaction` (một trong sáu loại); bảng tin, bài viết và bình luận trả thêm `myReaction` và `reactionCounts`. Không cần migration: cột `reactions.reaction` đã có sẵn. Lượt thích cũ được tính là Thích.

## 1.21.3 - 2026-11-10

Sửa logo khó nhìn ở giao diện tối.

### Sửa lỗi

- **Chữ "Hội Mình" trên nền tối**: ở giao diện tối, chữ cạnh logo trên các trang Tạo hội (Chọn cách thanh toán...) và cột trái trang Đăng nhập, Đăng ký bị tối gần bằng màu nền nên gần như không đọc được. Nguyên nhân: logo dùng màu `surface`, mà `surface` ở giao diện tối là màu tối. Nay dùng màu chữ sáng dành cho nền tối (`invertInk`), rõ ở cả hai giao diện.
- Thêm kiểm thử cho màu chữ của logo (`packages/ui/src/components/layout.test.tsx`).

## 1.21.2 - 2026-11-10

Cơ sở dữ liệu chuyển từ Seoul về Singapore để gần người dùng Việt Nam hơn.

### Thay đổi

- **Database mới ở Singapore** (dự án Supabase "HoiMinh SG", vùng `ap-southeast-1`), thay cho dự án cũ ở Seoul. Mỗi lượt gọi API bớt được quãng đường Việt Nam tới Seoul, còn Việt Nam tới Singapore.
- `apps/api/wrangler.toml`: `[placement] region = "aws:ap-southeast-1"`, để phần xử lý tiếp tục chạy cạnh database. Bước "Kiểm tra trang live" giờ mong đợi `remote-SIN`.
- Hyperdrive `hoiminh-db` trỏ sang máy chủ database mới, giữ nguyên tài khoản và mật khẩu của `hoiminh_app`.
- Cách chuyển: cấu trúc bảng được dựng lại từ chính database cũ rồi so từng mục (cột, ràng buộc, chỉ mục, chính sách bảo mật, hàm: 1.731 mục khớp hết); dữ liệu chép thẳng giữa hai máy chủ rồi so số dòng và mã kiểm tra của cả 96 bảng.
- Dự án cũ ở Seoul được giữ lại vài ngày để quay lại được nếu cần.

## 1.21.1 - 2026-11-10

Sửa tải dữ liệu chậm trên bản chạy thật: Worker chạy cạnh cơ sở dữ liệu thay vì cạnh người dùng.

### Sửa lỗi

- **Mỗi lượt gọi dữ liệu mất 1 đến 3 giây.** Cơ sở dữ liệu (Supabase) đặt ở Seoul, còn Worker chạy ở điểm Cloudflare gần người dùng Việt Nam, nên mỗi câu truy vấn đi một vòng Việt Nam tới Seoul. Một lượt gọi API của người đăng nhập đi về database 17 đến 35 lượt (đếm bằng proxy đặt giữa API và PostgreSQL thật). Nay `apps/api/wrangler.toml` có `[placement] region = "aws:ap-northeast-2"`: Worker chạy ở trung tâm dữ liệu Cloudflare gần database nhất, người dùng chỉ chịu quãng đường xa một lần cho mỗi request.
- Đo tại chỗ với PostgreSQL thật, 12 lượt gọi mà trang Bàn điều khiển và trang Hôm nay dùng: khi mỗi vòng đi về mất 80ms (Worker xa database) tổng cộng 26,2 giây, lượt "khung hội" 2,8 giây; khi mỗi vòng mất 2ms (Worker cạnh database) tổng cộng 1,1 giây, lượt "khung hội" 0,12 giây. Con số thật trên hoiminh.com còn cộng thêm một lượt Việt Nam tới Seoul cho mỗi request.
- **Bớt 3 lượt đi về database ở mọi request của người đăng nhập** (17 còn 14 với `/v1/me`, 35 còn 32 với khung hội): bỏ câu hỏi danh mục kiểu mà postgres-js chạy trên mỗi kết nối mới (`fetch_types: false`), và lấy phiên cùng người dùng trong một câu khi xác minh token.

### Thay đổi

- Bước "Kiểm tra trang live" sau deploy in thêm nơi Worker đang chạy (header `cf-placement`): `remote-ICN` là đã chạy cạnh database ở Seoul.
## 1.21.0 - 2026-11-10

Thẻ và quy tắc tự động: landing bắn đơn về kèm thẻ, thẻ tự cho khách vào hội, mở khóa học hoặc gửi email. Khách chưa cần có tài khoản.

### Tính năng

- **Nguồn đồng bộ** (Cài đặt, nhóm Tự động và kết nối). Mỗi nguồn là một địa chỉ nhận dạng `https://api.hoiminh.com/webhooks/in/<khóa>` để dán vào phần Webhook của form đặt hàng trên landing (Webcake hoặc công cụ khác). Nhận JSON, form thường và cả thẻ gắn ngay trên địa chỉ (`?tag=paid`). Dữ liệu cần có email; thẻ lấy từ trường `tag` hoặc `tags`, thẻ cần gỡ lấy từ `remove_tag`.
- **Bắn thử rồi ghép trường.** Mỗi lượt nhận được ghi lại nguyên dữ liệu. Bên gửi đặt tên trường khác thường thì chủ hội mở lượt nhận gần nhất, chọn trường nào là email, trường nào là thẻ, rồi bấm Xử lý lại. Nguồn còn có ô "Thẻ luôn gắn" cho landing không truyền được trường thẻ.
- **Quy tắc tự động**: "KHI một người được gắn thẻ X THÌ ...". Ba việc làm được: cho vào hội (chọn hội, gói, thời hạn 30 ngày tới 1 năm hoặc không giới hạn), mở một khóa học, gửi email (biến `{{name}}`, `{{email}}`, `{{tag}}`, `{{access_link}}`). Một quy tắc gộp được nhiều việc. Có nhật ký chạy từng lượt.
- **Không bắt khách tạo tài khoản trước.** Khách chưa có tài khoản thì quyền được giữ theo email; email gửi đi có nút "Kích hoạt và vào xem" dẫn tới trang `/kich-hoat`, đặt mật khẩu một lần là vào được ngay. Khách đã có tài khoản (email đã xác minh) thì nhận quyền thẳng, không phải làm gì. Người tự đăng ký bằng đúng email đó thì nhận quyền ngay khi xác minh email.
- **Gỡ thẻ là thu hồi** (bật sẵn, tắt được theo từng quy tắc): dùng cho hoàn tiền. Hội viên có thời hạn tự hết hạn qua cron hằng ngày: về gói mặc định ở hội miễn phí và freemium, rời hội ở hội thu phí.
- **Liên hệ và thẻ**: danh sách người đã để lại email, thẻ của từng người, quyền đã cấp và quyền đang chờ kích hoạt; gắn và gỡ thẻ bằng tay (cũng chạy quy tắc, tiện để thử), gửi lại link kích hoạt, xóa liên hệ.
- Trang Thành viên lọc được theo thẻ và hiện thẻ dưới tên thành viên. Ô lệnh có thêm ba dòng: Nhận đơn từ landing, Quy tắc tự động theo thẻ, Liên hệ và thẻ.

### Thay đổi

- Thẻ, liên hệ, nguồn và quy tắc thuộc về không gian làm việc, nên dùng chung cho mọi hội của cùng một chủ. Mỗi việc trong quy tắc chỉ rõ hội hoặc khóa học đích.
- Tên thẻ được chuẩn hóa về chữ thường tiếng Anh không dấu, số, gạch dưới, gạch nối (`Paid FBAds` thành `paid_fbads`). Tên bảng, trường dữ liệu và biến email đều bằng tiếng Anh.
- Gửi lặp lại cùng một đơn là vô hại: thẻ đã có thì không gắn lại, quy tắc không chạy lần hai.
- Email của quy tắc đứng tên hội (không phải "Hội Mình"), chân thư có link "Ngừng nhận email". Người đã ngừng nhận vẫn nhận thư mời kích hoạt vì đó là thư giao hàng.
- Migration `0005_tag_automation.sql`: 9 bảng mới (`contacts`, `tags`, `contact_tags`, `inbound_sources`, `inbound_events`, `automation_rules`, `automation_runs`, `automation_grants`, `contact_claims`), có policy RLS theo workspace. Entitlement có thêm nguồn `automation`.
- `/kich-hoat` và `/hoc` vào danh sách đường dẫn không được đặt làm tên hội.

### Chưa kiểm chứng được

- Dạng dữ liệu thật mà Webcake gửi về chưa có tài liệu công khai, nên chưa thử được với landing thật. Vì thế mới có bước bắn thử rồi ghép trường. Lần đầu nối, cần đặt một đơn thử và xem lượt nhận.

## 1.20.0 - 2026-11-10

Ảnh tải lên hội luôn là WebP cỡ nhỏ, và nói rõ là không nhận tệp video.

### Tính năng

- **Mọi ảnh tải lên thành WebP**, cạnh dài tối đa 1200px (avatar và logo 512px), chất lượng 80. Áp dụng cho ảnh bài viết, bình luận, tin nhắn, ảnh bìa, avatar và logo. Đo với một ảnh chụp màn hình PNG 1360x860 nặng 176 KB: còn 51 KB sau khi nén (nhẹ hơn 71%).
  - Trình duyệt nén sang WebP ngay trên máy người dùng trước khi tải lên (Chrome, Edge, Firefox, Android).
  - Trình duyệt không tự xuất được WebP (Safari trên iPhone và máy Mac) thì gửi JPEG, máy chủ chuyển sang WebP bằng Cloudflare Images trước khi ghi vào R2. Đây là công nghệ trang tài liệu Cloudflare (viết bằng Astro) dùng cho ảnh của họ.
  - Ảnh PNG nền trong suốt giữ được nền trong suốt (trước đây đổi sang JPEG nên bị đổ nền trắng).
- **Không nhận tệp video ở bất kỳ mục nào.** Trước đây tệp video đã bị từ chối nhưng chỉ báo "Loại tệp không được hỗ trợ"; nay báo rõ "Không nhận tệp video. Hãy dán link video (YouTube, TikTok, Facebook…)". Video trong bài viết và bài học vẫn đưa vào bằng cách dán link như cũ.

### Thay đổi

- `apps/api/wrangler.toml` thêm binding `[images]` (tên `IMAGES`). Gói Cloudflare Images miễn phí cho 5.000 lượt chuyển đổi mỗi tháng. Chỉ ảnh tới máy chủ ở dạng JPEG hoặc PNG mới tốn một lượt; ảnh trình duyệt đã nén sẵn thành WebP thì không. Hết lượt hoặc Cloudflare từ chối thì ảnh lưu đúng dạng nhận được, lượt tải lên vẫn thành công.
- Ảnh GIF giữ nguyên để không mất chuyển động. Tài liệu bài học và tệp số (tệp riêng) không bị đụng tới.
- Ảnh đã tải lên trước bản này giữ nguyên định dạng cũ.

## 1.19.0 - 2026-11-10

Đợt C của việc gom phần quản trị: ô lệnh "Bạn muốn làm gì?" và khu quản trị hệ thống gom từ 11 mục về 5 nhóm.

### Tính năng

- **Ô lệnh "Bạn muốn làm gì?"** cho chủ hội, quản trị hội và quản trị hệ thống. Mở bằng ô ở đầu trang hoặc Ctrl K (Cmd K trên máy Mac), trên điện thoại là nút kính lúp. Gõ vài chữ không cần dấu ("moi thanh vien", "rut tien", "hoa hong"), bấm Enter là tới đúng màn. Danh sách gồm việc làm ngay (viết bài, mời thành viên, tạo khóa học, tạo sự kiện, trả hoa hồng, rút tiền, hoàn tiền), nơi đi tới và từng mục cài đặt, lọc theo quyền của người xem và theo tab hội đang bật. Gõ tên người hay từ khóa thì có thêm dòng "Tìm thành viên" và "Tìm trong bảng tin". Ô lệnh chỉ dẫn đường, không dùng AI.
- **Khu quản trị hệ thống còn 5 nhóm**: Tổng quan, Hội và người dùng (Hội, Người dùng, Bị báo cáo), Tiền (Thanh toán và đối soát, Cộng sự nền tảng), Gói và tính năng (Gói nền tảng, Tính năng), Hệ thống (Hạ tầng và khóa, Phiên bản, Nhật ký). Nhóm có nhiều trang thì có hàng tab con. Mọi đường dẫn cũ giữ nguyên.
- Ô lệnh của quản trị hệ thống tìm được hội và người dùng theo tên hoặc email, thay ô tìm nhanh cũ (vốn không có trên điện thoại).

### Thay đổi

- Người quản lý hội: ô "Tìm trong bảng tin" ở đầu trang thành ô lệnh; tìm trong bảng tin là một dòng trong ô lệnh. Thành viên thường giữ ô tìm như cũ.
- Tab Tính năng không còn hiện 3 cờ của tính năng chưa xây (tin nhắn thời gian thực, phát trực tiếp, điểm và cấp độ): bật hay tắt chưa đổi gì nên dễ gây hiểu nhầm. Trang Gói nền tảng bỏ bảng cờ bị lặp, thay bằng một dòng tóm tắt và lối sang tab Tính năng.
- `/thanh-vien?q=...` mở danh sách thành viên đã lọc sẵn. Danh sách Hội và Người dùng của quản trị hệ thống nhận từ khóa mới ngay cả khi đang đứng ở trang đó.

### Sửa lỗi

- Trang Cộng sự nền tảng tràn ngang ở khổ 820px.

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
