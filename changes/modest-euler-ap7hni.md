---
bump: patch
---

Chặn tệp đội lốt khi tải lên và khi phát lại, theo yêu cầu của chủ dự án sau khi rà soát phần lưu tệp trên R2. Không có migration.

### Sửa

- **Tệp tải lên không còn đổi được loại so với lúc xin URL.** Trước đây chữ ký của URL tải lên chỉ khóa tên tệp và thời hạn, còn loại tệp lấy theo header người gửi tự đặt. Kẻ xấu có thể xin URL cho một "ảnh" rồi gửi lên một trang HTML, và trang đó được phát lại ngay trên tên miền Hội Mình, chạy mã bằng phiên đăng nhập của người bấm vào. Nay API chỉ nhận đúng loại đã khai lúc xin URL, và chỉ nhận khi tệp còn đang chờ (chưa xác nhận xong).
- **Kiểm vài byte đầu của tệp.** Ảnh phải đúng là JPEG, PNG, GIF hoặc WebP; PDF phải có dấu `%PDF-`; zip, Word, Excel, PowerPoint phải đúng là tệp zip; tệp văn bản phải là chữ UTF-8. Video đổi đuôi thành tài liệu hay trang web đội lốt ảnh đều bị từ chối.
- **Phát tệp kèm header chặn chạy mã.** Mọi tệp có `X-Content-Type-Options: nosniff`; mọi tệp trừ PDF có thêm `Content-Security-Policy: default-src 'none'; sandbox`. Tệp cũ lưu với loại lạ (trước khi có kiểm tra) được phát như tệp tải về, không mở trong trang.
- **Ghi dung lượng thật của mọi tệp.** Trước đây bảng `files` giữ con số client tự khai (trừ ảnh được chuyển sang WebP). Nay API ghi số byte thật nhận được, làm nền cho hạn mức dung lượng theo gói về sau.

### Thay đổi

- **Tài liệu tối đa 50MB một tệp** (trước là 100MB). 100MB chạm đúng giới hạn request của Cloudflare ở gói tên miền miễn phí, trong khi Worker đọc cả tệp vào bộ nhớ 128MB, nên tệp từ 80 đến 100MB lỗi lúc được lúc không. API từ chối sớm theo header `Content-Length`, trước khi đọc thân request. Ảnh vẫn 10MB, tệp đính kèm tin nhắn vẫn 5MB.

## Quyết định

**Tệp tải lên: tin byte thật, không tin lời khai của client; tài liệu tối đa 50MB** ({version}, chủ dự án đồng ý ngày 27/11/2026 sau khi rà soát phần lưu tệp). Loại tệp lấy từ dòng `files` tạo lúc xin URL (đã qua `validateUpload`), header `Content-Type` của lượt PUT phải trùng với loại đó, rồi vài byte đầu của tệp phải khớp loại. Đã cân nhắc và không làm: (a) đưa loại tệp vào chữ ký HMAC thay cho tra bảng `files`: vẫn phải tra bảng để ghi dung lượng thật, nên tra luôn một lần; (b) cấm hẳn tệp văn bản: giữ lại vì bài học hay đính kèm ghi chú, và đã có `nosniff` cùng CSP `sandbox` khi phát. Chế độ tải thẳng lên R2 qua S3 (đủ 4 biến `R2_*`, chưa bật ở production) đã khóa `Content-Type` trong chữ ký S3, nhưng không kiểm byte đầu và không ghi dung lượng thật; muốn bật chế độ này thì phải bổ sung bước kiểm sau khi tải. Về lâu dài nên phát tệp người dùng từ một tên miền riêng (như githubusercontent.com của GitHub) để một tệp độc không kéo cả hoiminh.com vào danh sách cảnh báo của trình duyệt.
