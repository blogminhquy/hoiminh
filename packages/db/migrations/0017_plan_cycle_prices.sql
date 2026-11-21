-- Chủ dự án yêu cầu ngày 21/11/2026: gói Hội Mình bán bốn kỳ (1 tháng, 3 tháng, 6 tháng, 1 năm), mỗi kỳ của mỗi gói
-- có giá riêng do quản trị nhập. Kỳ nào để giá 0 thì không bán và trang mua gói không hiện.
-- plans.cycle_prices: giá từng kỳ, đồng, dạng {"monthly": 0, "quarterly": 297000, "semiannual": 0, "yearly": 990000}.
-- Điền sẵn từ giá cũ để trang mua gói không đổi gì sau khi chạy: 3 tháng = 3 lần giá tháng, 1 năm = cột yearly_minor,
--   còn 1 tháng và 6 tháng là 0 (trước đây không bán) cho tới khi quản trị nhập giá.
-- Viết IF NOT EXISTS và chỉ điền dòng còn trống để chạy lại được: migration này được áp dụng tay lên database thật
--   trước khi merge. Mã cũ không đọc cột này nên thêm cột trước khi deploy là an toàn.
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "cycle_prices" jsonb;--> statement-breakpoint
UPDATE "plans" SET "cycle_prices" = jsonb_build_object('monthly', 0, 'quarterly', "monthly_minor" * 3, 'semiannual', 0, 'yearly', "yearly_minor") WHERE "cycle_prices" IS NULL;
