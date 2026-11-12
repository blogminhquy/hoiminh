-- Tài khoản nhận tiền của chủ hội (kế hoạch 11/11/2026): tiền bán hàng của hội về thẳng tài khoản của chủ hội.
-- Mỗi hội một dòng; hội chưa có dòng thì chưa bật được thanh toán.
-- Viết IF NOT EXISTS để chạy lại được: migration này được áp dụng tay lên database thật trước khi merge.
CREATE TABLE IF NOT EXISTS "community_payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"bank_code" text NOT NULL,
	"account_number" text NOT NULL,
	"account_holder" text NOT NULL,
	"confirm_mode" text DEFAULT 'manual' NOT NULL,
	"webhook_token" text NOT NULL,
	"last_webhook_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_payout_accounts" ADD CONSTRAINT "community_payout_accounts_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_payout_accounts" ADD CONSTRAINT "community_payout_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_payout_accounts_community_uq" ON "community_payout_accounts" USING btree ("community_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_payout_accounts_token_uq" ON "community_payout_accounts" USING btree ("webhook_token");
--> statement-breakpoint
-- Bảng mới phải có policy như các bảng khác (0001_rls.sql chỉ chạy trên bảng lúc đó). Chỉ người của workspace hoặc
-- của hội đọc và ghi được; lúc tạo đơn cho người mua, máy chủ đọc bằng quyền bypass (người mua không cần thấy dòng này).
ALTER TABLE "community_payout_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON public.community_payout_accounts;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.community_payout_accounts FOR ALL
  USING (hoiminh_bypass() OR hoiminh_in_list('app.workspace_ids', workspace_id))
  WITH CHECK (hoiminh_bypass() OR hoiminh_in_list('app.workspace_ids', workspace_id));--> statement-breakpoint
-- Database thật: mọi bảng thuộc vai trò hoiminh_app của API. Migration áp dụng tay chạy bằng vai trò khác,
-- nên phải trao lại quyền sở hữu bảng mới, không thì riêng bảng này bị RLS chặn.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hoiminh_app') THEN
    ALTER TABLE public.community_payout_accounts OWNER TO hoiminh_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_payout_accounts TO hoiminh_app;
  END IF;
END $$;
