-- Cài ra màn hình chính và thông báo đẩy (kế hoạch 11/11/2026, mục 7).
-- login_links: link đăng nhập một lần để chuyển từ trình duyệt trong Zalo, Facebook, Messenger sang Safari hoặc Chrome.
-- push_subscriptions: đăng ký nhận thông báo đẩy của từng thiết bị.
-- Thêm dòng công tắc "install_gate" (mặc định TẮT) để quản trị hệ thống bật tắt được ở Hệ thống, Gói nền tảng.
-- Viết IF NOT EXISTS / ON CONFLICT để chạy lại được: migration này được áp dụng tay lên database thật trước khi merge.
CREATE TABLE IF NOT EXISTS "login_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "login_links" ADD CONSTRAINT "login_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "login_links_token_uq" ON "login_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_links_user_idx" ON "login_links" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_uq" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");
--> statement-breakpoint
-- Bảng mới phải có policy như các bảng khác (0001_rls.sql chỉ chạy trên bảng lúc đó): mỗi người chỉ thấy dòng của mình.
-- Đổi link lấy phiên (người chưa đăng nhập) và gửi thông báo đẩy (job nền) chạy bằng quyền bypass ở máy chủ.
ALTER TABLE "login_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON public.login_links;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.login_links FOR ALL
  USING (hoiminh_bypass() OR hoiminh_is_user(user_id))
  WITH CHECK (hoiminh_bypass() OR hoiminh_is_user(user_id));--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON public.push_subscriptions;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.push_subscriptions FOR ALL
  USING (hoiminh_bypass() OR hoiminh_is_user(user_id))
  WITH CHECK (hoiminh_bypass() OR hoiminh_is_user(user_id));--> statement-breakpoint
INSERT INTO "feature_flags" ("key", "description", "enabled", "rules") VALUES
  ('install_gate', 'Bắt thành viên đã đăng nhập trên điện thoại cài Hội Mình ra màn hình chính (từ lần vào thứ hai)', false, '{}'::jsonb)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
-- Database thật: mọi bảng thuộc vai trò hoiminh_app của API. Migration áp dụng tay chạy bằng vai trò khác,
-- nên phải trao lại quyền sở hữu hai bảng mới, không thì riêng hai bảng này bị RLS chặn.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hoiminh_app') THEN
    ALTER TABLE public.login_links OWNER TO hoiminh_app;
    ALTER TABLE public.push_subscriptions OWNER TO hoiminh_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_links, public.push_subscriptions TO hoiminh_app;
  END IF;
END $$;
