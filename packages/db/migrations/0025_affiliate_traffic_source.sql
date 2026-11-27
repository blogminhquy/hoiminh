-- Nguồn traffic của affiliate (chủ dự án yêu cầu ngày 27/11/2026). Mỗi lượt bấm ghi nguồn đã phân loại (Facebook, Zalo,
-- YouTube, trong Hội Mình...) và mã chỗ đặt link của Hội Mình; mỗi đơn có hoa hồng nối về lượt bấm đã dẫn tới nó và
-- chép nguồn của lượt bấm đó. Chỉ thêm cột, không đổi dữ liệu cũ: dòng cũ để null.
-- Viết IF NOT EXISTS để chạy lại được: migration này được áp dụng tay lên database thật trước khi merge.
ALTER TABLE "affiliate_clicks" ADD COLUMN IF NOT EXISTS "source" text;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD COLUMN IF NOT EXISTS "placement" text;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD COLUMN IF NOT EXISTS "click_id" uuid;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD COLUMN IF NOT EXISTS "source" text;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD COLUMN IF NOT EXISTS "placement" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_click_id_affiliate_clicks_id_fk" FOREIGN KEY ("click_id") REFERENCES "public"."affiliate_clicks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_conversions_click_idx" ON "affiliate_conversions" USING btree ("click_id");
