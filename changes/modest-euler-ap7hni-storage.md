---
bump: minor
---

Hạn mức dung lượng tệp theo gói của từng hội, theo yêu cầu của chủ dự án ngày 27/11/2026. Không có migration.

### Thêm

- **Dung lượng tệp theo gói.** Mỗi hội có trần tổng dung lượng ảnh và tệp: Miễn phí 1 GB, Khởi đầu 10 GB, Chuyên nghiệp 50 GB, Không giới hạn 200 GB (mức dùng hợp lý). Tài liệu lớn nhất mỗi tệp: 20 MB ở gói Miễn phí, 50 MB ở các gói trả phí. Chạm trần thì giống trần thành viên: không xóa gì, ảnh và tệp đã có vẫn giữ, chỉ không tải thêm được, kèm lời mời nâng lên gói kế tiếp (lỗi `storage_quota`, mã 409).
- **Ảnh trong bình luận tính vào dung lượng của hội.** Khung bình luận gửi kèm hội đang mở khi tải ảnh.
- **Trang gói của hội hiện "Dung lượng tệp".** Dưới số thành viên có thêm thanh dung lượng đã dùng so với trần của gói, và mức tài liệu lớn nhất mỗi tệp.

### Thay đổi

- **Tệp gắn với hội phải do người trong hội tải lên.** Người ngoài hội không gắn được tệp vào hội đó (403), để không ai làm đầy dung lượng của hội khác bằng tệp rác.
- **Tài liệu bài học và tệp sản phẩm số phải nói rõ thuộc hội nào** (`communityId`). Giao diện vốn đã gửi; API key và MCP thiếu thì nhận lỗi rõ ràng.
- **Tệp gửi lên không được lớn hơn dung lượng đã khai lúc xin URL.** Trần theo gói xét trên con số khai, nên con số đó phải đúng. Trình duyệt luôn khai đúng kích thước của chính tệp nó gửi.

## Quyết định

**Hạn mức dung lượng tệp theo gói của hội** ({version}, chủ dự án chốt ngày 27/11/2026). R2 tính khoảng 390đ mỗi GB mỗi tháng và không tính băng thông, nên hạn mức để chặn lạm dụng chứ không để tiết kiệm. Bảng nằm ở `PLAN_STORAGE` (`packages/contracts/src/plans.ts`), chưa sửa được ở Hệ thống. Dung lượng đã dùng là tổng `files.size_bytes` (byte thật, ghi lúc API nhận tệp) của các tệp gắn với hội, tính cả tệp đang tải dở để nhiều lượt tải song song không cùng lọt qua trần; tệp tải dở bỏ quá vài giờ đã có bộ dọn xóa. Ảnh trong bình luận tính vào dung lượng của hội (khung bình luận gửi `communityId` của hội đang mở). Không tính tệp riêng của người dùng (avatar, tệp tin nhắn). Máy chủ chưa bắt buộc `communityId` với ảnh bài viết và ảnh bình luận (ảnh nhỏ, đã nén WebP), chỉ bắt buộc với tài liệu bài học và tệp sản phẩm. Chỉ mục cho `files.community_id` thêm ở PR riêng có migration.
