---
bump: patch
---

Database luôn có sẵn các cờ tính năng với giá trị mặc định, để không tính năng nào bị tắt ngầm vì thiếu dòng cờ. Theo yêu cầu của chủ dự án. Có migration `0020_feature_flags_mac_dinh` (chỉ thêm dữ liệu, không đổi bảng).

### Sửa

- **Trên web thật không ai mua được sản phẩm lẻ.** Bấm "Mua ngay" ở trang sản phẩm (kể cả trang mở từ link affiliate) bị báo "Cửa hàng đang tạm đóng trên toàn nền tảng". Nguyên nhân: hệ thống coi cờ tính năng nào thiếu dòng là đang tắt, mà dòng cờ `store` và `affiliate_leaderboard` trước giờ chỉ được tạo trong dữ liệu mẫu, database thật chưa từng có. Cùng nguyên nhân, mục Cửa hàng và bảng xếp hạng affiliate bị ẩn ở mọi hội. Ngày 22/11/2026 hai cờ đã được bật tay trên database thật theo yêu cầu của chủ dự án; migration này bảo đảm môi trường mới dựng cũng có sẵn đủ các cờ.

### Kỹ thuật

- Migration thêm đủ tám cờ đang dùng trong mã với đúng giá trị của dữ liệu mẫu: bật `store`, `affiliate_leaderboard`, `mcp`; tắt `realtime_chat`, `go_live`, `gamification`, `paypal`, `install_gate`. Dùng `ON CONFLICT DO NOTHING` nên dòng đã có (quản trị đã bật tắt ở trang Hệ thống) được giữ nguyên. Áp lên database thật là an toàn: hai cờ đã bật giữ nguyên, các cờ mới thêm đều tắt, đúng như hiện trạng thiếu dòng.
- Test: `packages/db/src/test/schema.test.ts` kiểm các cờ có sẵn ngay sau khi chạy migration, chưa cần dữ liệu mẫu.
