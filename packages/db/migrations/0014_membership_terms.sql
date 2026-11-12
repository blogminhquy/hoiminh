-- Kỳ hạn và khuyến mãi của gói thành viên (chủ dự án yêu cầu 12/11/2026): chủ hội bán gói theo 1 tháng hoặc số tháng
-- khác nhau, và đặt được một đợt giảm giá.
-- community_tiers.terms: danh sách kỳ hạn [{months, amountMinor}]. Hai cột monthly_minor và yearly_minor vẫn giữ, là bản
--   sao của kỳ 1 tháng và 12 tháng, để mọi chỗ đang đọc hai cột đó chạy như cũ.
-- communities.pricing_promo: {percentOff, endsAt} hoặc null.
-- subscriptions.period_months: số tháng của kỳ đang trả.
-- Viết IF NOT EXISTS và chỉ điền dòng còn trống để chạy lại được: migration này được áp dụng tay lên database thật trước khi merge.
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "pricing_promo" jsonb;--> statement-breakpoint
ALTER TABLE "community_tiers" ADD COLUMN IF NOT EXISTS "terms" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "period_months" integer;--> statement-breakpoint

-- Gói đã có giá tháng hoặc giá năm: chép thành kỳ 1 tháng và kỳ 12 tháng. Gói đã có kỳ hạn thì giữ nguyên.
UPDATE "community_tiers" SET "terms" =
  (CASE WHEN COALESCE("monthly_minor", 0) > 0 THEN jsonb_build_array(jsonb_build_object('months', 1, 'amountMinor', "monthly_minor")) ELSE '[]'::jsonb END)
  || (CASE WHEN COALESCE("yearly_minor", 0) > 0 THEN jsonb_build_array(jsonb_build_object('months', 12, 'amountMinor', "yearly_minor")) ELSE '[]'::jsonb END)
WHERE "terms" = '[]'::jsonb AND (COALESCE("monthly_minor", 0) > 0 OR COALESCE("yearly_minor", 0) > 0);--> statement-breakpoint

-- Subscription cũ: kỳ theo năm là 12 tháng, còn lại là 1 tháng.
UPDATE "subscriptions" SET "period_months" = CASE WHEN "billing_cycle" = 'yearly' THEN 12 ELSE 1 END WHERE "period_months" IS NULL;--> statement-breakpoint

-- Đổi chữ "cộng sự" thành "affiliate" (bản 1.32.2) ở hai chỗ dữ liệu mặc định do hệ thống tự điền khi tạo hội:
-- dòng quyền lợi "Trở thành cộng sự" của gói, và tên chương trình "Cộng sự <tên hội>". Chữ chủ hội tự gõ khác đi thì không đụng.
UPDATE "community_tiers" SET "benefits" = replace("benefits"::text, '"Trở thành cộng sự"', '"Trở thành affiliate"')::jsonb
WHERE "benefits"::text LIKE '%"Trở thành cộng sự"%';--> statement-breakpoint
UPDATE "affiliate_programs" SET "name" = 'Affiliate ' || substr("name", length('Cộng sự ') + 1) WHERE "name" LIKE 'Cộng sự %';
