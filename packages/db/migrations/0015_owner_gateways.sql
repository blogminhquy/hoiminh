-- Cổng thanh toán riêng của chủ hội (chủ dự án yêu cầu 14/11/2026): ngoài chuyển khoản QR, chủ hội cài được MoMo,
-- VNPAY, PayPal và Stripe (thẻ quốc tế) bằng khóa của chính mình. Người mua chỉ thấy cách đã cài và đang bật, và cách
-- chủ hội chọn làm mặc định được chọn sẵn.
-- community_payment_gateways: mỗi hội một dòng cho mỗi cổng; khóa bí mật mã hóa, địa chỉ webhook riêng của từng cổng.
-- community_payout_accounts.enabled: bật tắt cách chuyển khoản QR mà không xóa tài khoản đã nhập. Hội cũ giữ nguyên là bật.
-- communities.default_payment_method: cách thanh toán chọn sẵn cho người mua (null là cách đầu tiên đang bật).
-- Viết IF NOT EXISTS để chạy lại được: migration này được áp dụng tay lên database thật trước khi merge.
CREATE TABLE IF NOT EXISTS "community_payment_gateways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"mode" text DEFAULT 'production' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"credentials_encrypted" text NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"webhook_token" text NOT NULL,
	"last_webhook_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "default_payment_method" text;--> statement-breakpoint
ALTER TABLE "community_payout_accounts" ADD COLUMN IF NOT EXISTS "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_payment_gateways" ADD CONSTRAINT "community_payment_gateways_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_payment_gateways" ADD CONSTRAINT "community_payment_gateways_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_payment_gateways_uq" ON "community_payment_gateways" USING btree ("community_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_payment_gateways_token_uq" ON "community_payment_gateways" USING btree ("webhook_token");
--> statement-breakpoint
-- Bảng mới phải có policy như các bảng khác (0001_rls.sql chỉ chạy trên bảng lúc đó). Chỉ người của workspace đọc và
-- ghi được; lúc tạo đơn cho người mua và lúc cổng gọi webhook về, máy chủ đọc bằng quyền bypass.
ALTER TABLE "community_payment_gateways" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON public.community_payment_gateways;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.community_payment_gateways FOR ALL
  USING (hoiminh_bypass() OR hoiminh_in_list('app.workspace_ids', workspace_id))
  WITH CHECK (hoiminh_bypass() OR hoiminh_in_list('app.workspace_ids', workspace_id));--> statement-breakpoint
-- Database thật: mọi bảng thuộc vai trò hoiminh_app của API. Migration áp dụng tay chạy bằng vai trò khác,
-- nên phải trao lại quyền sở hữu bảng mới, không thì riêng bảng này bị RLS chặn.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hoiminh_app') THEN
    ALTER TABLE public.community_payment_gateways OWNER TO hoiminh_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_payment_gateways TO hoiminh_app;
  END IF;
END $$;
