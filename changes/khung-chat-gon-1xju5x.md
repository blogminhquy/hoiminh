---
bump: patch
---

Bảng "Thông tin hội thoại" trong Tin nhắn gọn lại, theo góp ý của chủ dự án. Chỉ sửa giao diện web, không có migration.

### Thay đổi

- **Bảng thông tin hội thoại chỉ còn một nút "Xem chi tiết hồ sơ".** Bỏ hàng bốn nút tròn (Ghim hội thoại, Xem hồ sơ, Quản lý thành viên, Lưu trữ hội thoại). Nút "Quản lý thành viên" bị bỏ hẳn vì không hợp với một khung trò chuyện.
- **Ghim và lưu trữ hội thoại nằm ở menu ba chấm.** Menu ba chấm ở đầu khung chat nay có thêm "Ghim hội thoại" và "Lưu trữ hội thoại" (trước chỉ có ở menu ba chấm trên từng dòng của danh sách), nên đang mở một cuộc trò chuyện trên điện thoại vẫn ghim và lưu trữ được.

### Kỹ thuật

- `apps/web/src/pages/account/MessagesParts.tsx` (`InfoPanel` bỏ các prop ghim và lưu trữ), `MessagesMenus.tsx` (`ChatMenu` nhận thêm ghim và lưu trữ), `MessagesThread.tsx`; gỡ các lớp `.chat-quick` không còn dùng trong `packages/ui/src/styles.css`.
- E2E `17-tin-nhan-kieu-zalo` kiểm bảng thông tin chỉ có nút hồ sơ và menu ba chấm có ghim, lưu trữ.
