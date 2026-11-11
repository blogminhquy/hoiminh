-- Kế hoạch gói 11/11/2026: bốn gói, mỗi gói cho MỘT hội, hai chu kỳ (3 tháng, 1 năm), không còn dùng thử.
-- Trước đây: một gói 'hoiminh' gắn với workspace, có 14 ngày dùng thử, hết hạn thì khóa cả workspace.
-- Viết IF NOT EXISTS / ON CONFLICT để chạy lại được: migration này được áp dụng tay lên database thật trước khi merge.

-- 1. Bảng bốn gói với giá và trần đã chốt. Dòng đã có thì giữ nguyên (quản trị sửa ở Hệ thống, Gói nền tảng).
INSERT INTO "plans" ("key", "name", "description", "monthly_minor", "yearly_minor", "trial_days", "quotas", "features", "sort_order") VALUES
  ('free', 'Miễn phí', 'Dùng vĩnh viễn, bán hàng và thu tiền được.', 0, 0, 0, '{"members": 100}'::jsonb, '[]'::jsonb, 0),
  ('starter', 'Khởi đầu', 'Cho hội đang lớn.', 99000, 990000, 0, '{"members": 500}'::jsonb, '[]'::jsonb, 1),
  ('pro', 'Chuyên nghiệp', 'Có tự động hóa, tên miền riêng, cộng sự, API.', 299000, 2990000, 0, '{"members": 5000}'::jsonb, '["automation","custom_domain","affiliate","api"]'::jsonb, 2),
  ('unlimited', 'Không giới hạn', 'Không giới hạn thành viên, có mọi thứ của Chuyên nghiệp.', 799000, 7990000, 0, '{"members": null}'::jsonb, '["automation","custom_domain","affiliate","api"]'::jsonb, 3)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "trial_days" SET DEFAULT 0;--> statement-breakpoint

-- 2. Gói gắn với từng hội.
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "plan_key" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "plan_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "is_free_slot" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- 3. Mỗi tài khoản một hội miễn phí: lấy hội lâu nhất còn tồn tại của từng chủ. Chủ nào đã có hội miễn phí thì bỏ qua.
UPDATE "communities" c SET "is_free_slot" = true
WHERE c."id" IN (
  SELECT DISTINCT ON (w."owner_user_id") c2."id"
  FROM "communities" c2 JOIN "workspaces" w ON w."id" = c2."workspace_id"
  WHERE c2."deleted_at" IS NULL
  ORDER BY w."owner_user_id", c2."created_at" ASC, c2."id" ASC
)
AND NOT EXISTS (
  SELECT 1 FROM "communities" c3
  JOIN "workspaces" w3 ON w3."id" = c3."workspace_id"
  JOIN "workspaces" w ON w."id" = c."workspace_id"
  WHERE w3."owner_user_id" = w."owner_user_id" AND c3."is_free_slot" AND c3."deleted_at" IS NULL
);--> statement-breakpoint

-- 4. Kỳ trả tiền chuyển từ workspace sang hội.
ALTER TABLE "platform_subscriptions" ADD COLUMN IF NOT EXISTS "community_id" uuid;--> statement-breakpoint
DROP INDEX IF EXISTS "platform_subscriptions_workspace_uq";--> statement-breakpoint
-- Workspace đang trả gói cũ còn hạn: gói cũ không giới hạn số hội và thành viên, nên MỌI hội của workspace đó
-- được gói Không giới hạn tới hết kỳ đã trả. Không ai mất thứ đã trả tiền.
UPDATE "communities" c SET "plan_key" = 'unlimited', "plan_ends_at" = s."current_period_end"
FROM "platform_subscriptions" s
WHERE s."workspace_id" = c."workspace_id" AND s."community_id" IS NULL AND s."status" = 'active' AND s."current_period_end" > now() AND c."deleted_at" IS NULL;--> statement-breakpoint
INSERT INTO "platform_subscriptions" ("workspace_id", "community_id", "plan_key", "status", "billing_cycle", "current_period_start", "current_period_end", "provider", "last_order_id")
SELECT s."workspace_id", c."id", 'unlimited', 'active', CASE WHEN s."billing_cycle" = 'yearly' THEN 'yearly' ELSE 'quarterly' END, s."current_period_start", s."current_period_end", s."provider", s."last_order_id"
FROM "platform_subscriptions" s JOIN "communities" c ON c."workspace_id" = s."workspace_id"
WHERE s."community_id" IS NULL AND s."status" = 'active' AND s."current_period_end" > now() AND c."deleted_at" IS NULL;--> statement-breakpoint
-- Dòng cũ theo workspace (đã chép sang từng hội ở trên, hoặc là dùng thử, quá hạn, hết hạn) không còn nghĩa.
DELETE FROM "platform_subscriptions" WHERE "community_id" IS NULL;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ALTER COLUMN "community_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ALTER COLUMN "billing_cycle" SET DEFAULT 'quarterly';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_subscriptions_community_uq" ON "platform_subscriptions" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_subscriptions_workspace_idx" ON "platform_subscriptions" USING btree ("workspace_id");--> statement-breakpoint

-- 5. Bỏ dùng thử và bỏ khóa cả workspace: mọi workspace trở về hoạt động bình thường, dữ liệu giữ nguyên.
ALTER TABLE "workspaces" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
UPDATE "workspaces" SET "status" = 'active', "trial_ends_at" = NULL, "content_locked_at" = NULL WHERE "status" IN ('trial', 'past_due', 'locked') OR "trial_ends_at" IS NOT NULL OR "content_locked_at" IS NOT NULL;--> statement-breakpoint

-- 6. Gói cũ 499.000đ ngừng bán (giữ dòng để đơn hàng cũ còn tra được).
UPDATE "plans" SET "is_active" = false WHERE "key" = 'hoiminh';
