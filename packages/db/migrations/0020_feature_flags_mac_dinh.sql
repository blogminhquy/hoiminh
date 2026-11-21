-- Tạo sẵn các cờ tính năng với giá trị mặc định (chủ dự án yêu cầu ngày 22/11/2026).
-- Thiếu dòng cờ thì hệ thống coi cờ đó là TẮT. Trước đây các dòng này chỉ có trong dữ liệu mẫu, nên database thật
-- thiếu `store` và `affiliate_leaderboard`: không ai mua được sản phẩm lẻ ("Cửa hàng đang tạm đóng trên toàn nền
-- tảng"), mục Cửa hàng và bảng xếp hạng affiliate bị ẩn ở mọi hội. Giá trị lấy đúng theo dữ liệu mẫu.
-- ON CONFLICT DO NOTHING: dòng đã có (do quản trị bật tắt ở trang Hệ thống, hoặc đã bật tay trên database thật ngày
-- 22/11/2026) thì giữ nguyên, migration không ghi đè lựa chọn của quản trị.
INSERT INTO "feature_flags" ("key", "description", "enabled", "rules") VALUES
  ('store', 'Cửa hàng trong hội', true, '{}'::jsonb),
  ('affiliate_leaderboard', 'Bảng xếp hạng affiliate', true, '{}'::jsonb),
  ('mcp', 'MCP cho AI', true, '{}'::jsonb),
  ('realtime_chat', 'Tin nhắn thời gian thực', false, '{}'::jsonb),
  ('go_live', 'Phát trực tiếp trong hội', false, '{}'::jsonb),
  ('gamification', 'Điểm và cấp độ hoạt động (mục 65, để sau)', false, '{}'::jsonb),
  ('paypal', 'Cổng PayPal', false, '{}'::jsonb),
  ('install_gate', 'Bắt thành viên đã đăng nhập trên điện thoại cài Hội Mình ra màn hình chính (từ lần vào thứ hai)', false, '{}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
