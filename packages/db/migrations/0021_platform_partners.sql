CREATE TABLE IF NOT EXISTS "platform_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_account_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"duration_mode" text DEFAULT 'program' NOT NULL,
	"commission_duration_months" integer,
	"note" text,
	"created_by_user_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_partners" ADD CONSTRAINT "platform_partners_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_partners" ADD CONSTRAINT "platform_partners_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_partners_account_uq" ON "platform_partners" USING btree ("affiliate_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_partners_status_idx" ON "platform_partners" USING btree ("status");--> statement-breakpoint
-- Bảng mới phải có policy như các bảng khác (0001_rls.sql chỉ chạy trên bảng lúc đó). Đối tác là việc của quản trị hệ
-- thống: chỉ tiến trình hệ thống và quản trị (bypass) đọc ghi; chính đối tác đọc được dòng của mình (qua tài khoản
-- affiliate của họ) để trang ví hiện điều khoản riêng.
ALTER TABLE "platform_partners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON public.platform_partners;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.platform_partners FOR ALL
  USING (hoiminh_bypass())
  WITH CHECK (hoiminh_bypass());--> statement-breakpoint
DROP POLICY IF EXISTS own_read ON public.platform_partners;--> statement-breakpoint
CREATE POLICY own_read ON public.platform_partners FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.affiliate_accounts a WHERE a.id = platform_partners.affiliate_account_id AND hoiminh_is_user(a.user_id)));--> statement-breakpoint
-- Database thật: mọi bảng thuộc vai trò hoiminh_app của API. Migration áp dụng tay chạy bằng vai trò khác,
-- nên phải trao lại quyền sở hữu bảng mới, không thì riêng bảng này bị RLS chặn.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hoiminh_app') THEN
    ALTER TABLE public.platform_partners OWNER TO hoiminh_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_partners TO hoiminh_app;
  END IF;
END $$;
