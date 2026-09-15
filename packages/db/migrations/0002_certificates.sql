-- Chứng nhận hoàn thành khóa học (mục V1.5 "Certificate").
-- Tên người nhận, tên khóa và tên hội được chụp lại lúc cấp nên đổi tên về sau không làm đổi tờ đã cấp.
CREATE TABLE IF NOT EXISTS "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"community_id" uuid,
	"workspace_id" uuid,
	"recipient_name" text NOT NULL,
	"course_title" text NOT NULL,
	"issuer_name" text NOT NULL,
	"lesson_count" integer DEFAULT 0 NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "certificates_code_uq" ON "certificates" USING btree ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "certificates_course_user_uq" ON "certificates" USING btree ("course_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificates_user_idx" ON "certificates" USING btree ("user_id");
--> statement-breakpoint
-- RLS: chủ sở hữu đọc được của mình; tra cứu công khai theo mã đi qua tiến trình hệ thống (app.bypass).
ALTER TABLE "certificates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.certificates USING (hoiminh_bypass() OR hoiminh_is_user(user_id)) WITH CHECK (hoiminh_bypass() OR hoiminh_is_user(user_id));
