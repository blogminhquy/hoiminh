-- Gói nền tảng: chọn cách thu tiền. 'gateway' = thanh toán trong Hội Mình (mặc định, như trước);
-- 'link' = mở link của hệ thống thanh toán ngoài, mỗi chu kỳ một link.
-- Viết IF NOT EXISTS để chạy lại được: migration này được áp dụng tay lên database thật trước khi merge.
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "payment_mode" text DEFAULT 'gateway' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "monthly_pay_url" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "yearly_pay_url" text;
