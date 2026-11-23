---
bump: minor
---

Giới thiệu khóa học ngay dưới tấm chứng nhận: người học vừa xong khóa có link giới thiệu kèm số tiền nhận được, link chứng nhận họ khoe cũng kèm mã giới thiệu; người được chia sẻ thấy lời mời học khóa (chủ dự án yêu cầu). Không có migration.

### Thêm

- **Khối "Khóa học giúp ích cho bạn? Giới thiệu cho bạn bè" dưới tấm chứng nhận.** Chỉ chính người học thấy, khi hội đang bật affiliate: hai ô như bảng chia sẻ ở thư viện khóa học, "Giới thiệu khóa học này" (link trang bán lẻ, số tiền nhận mỗi đơn) và "Giới thiệu vào hội" (link trang hội, số tiền nhận hằng tháng), mỗi ô có nút sao chép riêng.
- **Khoe chứng chỉ cũng là giới thiệu.** Link chứng nhận người học bấm Chia sẻ hay sao chép (nút dưới chứng chỉ và ô mã kiểm tra) kèm sẵn mã giới thiệu của họ và tên hội, để mã được tính cho chương trình của hội. Ảnh và bản in chứng chỉ vẫn in link gốc.
- **Lời mời học khóa cho người được chia sẻ.** Người khác mở trang chứng nhận thấy "Bạn cũng muốn học khóa này?" với tên khóa, giá và nút "Xem khóa học" (trang bán lẻ) hoặc "Xem hội". Không thấy gì về hoa hồng.
- Dữ liệu chứng nhận có thêm id hội và giá, đường dẫn trang bán lẻ của khóa.

## Quyết định

**Trang chứng nhận lấy link giới thiệu ngay khi chính người học mở** ({version}, chủ dự án yêu cầu ngày 23/11/2026). Khác với thư viện khóa học (chỉ tạo ví affiliate khi người dùng bấm mở bảng chia sẻ), ở trang chứng nhận của chính mình máy chủ tạo ví ngay để link chứng nhận kèm sẵn mã: người học vừa xong khóa là lúc muốn khoe nhất, và họ thường bấm Chia sẻ ngay. Chỉ làm khi hội đang bật affiliate và có tiền để nhận. Link chứng nhận kèm `hoi=<slug>` vì trang chứng nhận không nằm dưới đường dẫn của hội.
