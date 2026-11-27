-- Mua trước, tạo tài khoản sau (chủ dự án yêu cầu ngày 27/11/2026). Khách chưa đăng nhập mua bằng email: máy chủ tạo sẵn
-- tài khoản chờ (chưa có mật khẩu), sau khi trả tiền gửi link tạo tài khoản và nhắc lại nếu khách chưa làm.
-- Viết IF NOT EXISTS để chạy lại được: migration này được áp dụng tay lên database thật trước khi merge.
CREATE TABLE IF NOT EXISTS "account_claims" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid,
	"community_id" uuid,
	"claimed_at" timestamp with time zone,
	"reminders_sent" integer DEFAULT 0 NOT NULL,
	"last_emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_claims" ADD CONSTRAINT "account_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_claims" ADD CONSTRAINT "account_claims_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_claims" ADD CONSTRAINT "account_claims_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_claims_pending_idx" ON "account_claims" USING btree ("last_emailed_at") WHERE "account_claims"."claimed_at" is null;--> statement-breakpoint
-- Bảng mới phải có policy như các bảng khác (0001_rls.sql chỉ chạy trên bảng lúc đó): mỗi người chỉ thấy dòng của mình.
-- Khách mua khi chưa đăng nhập, bấm link trong email và job nhắc chạy bằng quyền bypass ở máy chủ.
ALTER TABLE "account_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON public.account_claims;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.account_claims FOR ALL
  USING (hoiminh_bypass() OR hoiminh_is_user(user_id))
  WITH CHECK (hoiminh_bypass() OR hoiminh_is_user(user_id));--> statement-breakpoint
-- Database thật: mọi bảng thuộc vai trò hoiminh_app của API. Migration áp dụng tay chạy bằng vai trò khác,
-- nên phải trao lại quyền sở hữu bảng mới, không thì riêng bảng này bị RLS chặn.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hoiminh_app') THEN
    ALTER TABLE public.account_claims OWNER TO hoiminh_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_claims TO hoiminh_app;
  END IF;
END $$;
