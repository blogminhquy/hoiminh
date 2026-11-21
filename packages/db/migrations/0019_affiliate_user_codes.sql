-- Mã giới thiệu chung của một người (chủ dự án yêu cầu ngày 21/11/2026): mỗi người tự chọn một mã, dùng cho link của
-- mọi chương trình mình làm affiliate, không trùng với mã của ai khác, và chỉ đặt được một lần (mỗi người một dòng,
-- đã ghi thì không sửa). Mã riêng của từng tài khoản affiliate giữ nguyên nên link đã chia sẻ không hỏng.
-- Viết IF NOT EXISTS để chạy lại được: migration này được áp dụng tay lên database thật trước khi merge.
CREATE TABLE IF NOT EXISTS "affiliate_user_codes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_user_codes" ADD CONSTRAINT "affiliate_user_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_user_codes_code_uq" ON "affiliate_user_codes" USING btree ("code");--> statement-breakpoint
-- Bảng mới phải có policy như các bảng khác (0001_rls.sql chỉ chạy trên bảng lúc đó). Mã giới thiệu nằm trên link công
-- khai nên ai cũng đọc được (máy chủ phải tra mã cho cả người chưa đăng nhập); chỉ chính chủ (hoặc máy chủ, quyền
-- bypass) ghi được dòng của mình.
ALTER TABLE "affiliate_user_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON public.affiliate_user_codes;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.affiliate_user_codes FOR ALL
  USING (hoiminh_bypass() OR hoiminh_is_user(user_id))
  WITH CHECK (hoiminh_bypass() OR hoiminh_is_user(user_id));--> statement-breakpoint
DROP POLICY IF EXISTS public_read ON public.affiliate_user_codes;--> statement-breakpoint
CREATE POLICY public_read ON public.affiliate_user_codes FOR SELECT USING (true);--> statement-breakpoint
-- Database thật: mọi bảng thuộc vai trò hoiminh_app của API. Migration áp dụng tay chạy bằng vai trò khác,
-- nên phải trao lại quyền sở hữu bảng mới, không thì riêng bảng này bị RLS chặn.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hoiminh_app') THEN
    ALTER TABLE public.affiliate_user_codes OWNER TO hoiminh_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_user_codes TO hoiminh_app;
  END IF;
END $$;
