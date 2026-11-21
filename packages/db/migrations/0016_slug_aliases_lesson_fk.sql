-- Hai lỗi chủ dự án báo ngày 21/11/2026: bấm thông báo "thành viên mới" ra "Hội không tồn tại", bấm thẻ khóa học ra
-- "Bài học không tồn tại".
-- community_slug_aliases: hội đổi đường dẫn thì đường dẫn cũ nằm lại đây. Link đã lưu và đã chia sẻ (thông báo, link
--   mời, link affiliate) vẫn dẫn về đúng hội, web tự chuyển sang đường dẫn mới.
-- course_progress.last_lesson_id: thêm khóa ngoại ON DELETE SET NULL. Trước đây xóa bài thì tiến độ vẫn trỏ tới bài đã
--   xóa, nút "Học tiếp" dẫn vào bài không còn. Dọn các dòng đang trỏ sai trước khi thêm khóa ngoại.
-- Viết IF NOT EXISTS để chạy lại được: migration này được áp dụng tay lên database thật trước khi merge.
CREATE TABLE IF NOT EXISTS "community_slug_aliases" (
	"slug" text PRIMARY KEY NOT NULL,
	"community_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_slug_aliases" ADD CONSTRAINT "community_slug_aliases_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_slug_aliases_community_idx" ON "community_slug_aliases" USING btree ("community_id");--> statement-breakpoint
UPDATE "course_progress" cp SET "last_lesson_id" = NULL
 WHERE cp."last_lesson_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "lessons" l WHERE l."id" = cp."last_lesson_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_last_lesson_id_lessons_id_fk" FOREIGN KEY ("last_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Bảng mới phải có policy như các bảng khác (0001_rls.sql chỉ chạy trên bảng lúc đó). Đường dẫn cũ là thông tin công
-- khai như chính đường dẫn của hội nên ai cũng đọc được; chỉ người trong hội (hoặc máy chủ, quyền bypass) ghi được.
ALTER TABLE "community_slug_aliases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON public.community_slug_aliases;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.community_slug_aliases FOR ALL
  USING (hoiminh_bypass() OR hoiminh_in_list('app.community_ids', community_id))
  WITH CHECK (hoiminh_bypass() OR hoiminh_in_list('app.community_ids', community_id));--> statement-breakpoint
DROP POLICY IF EXISTS public_read ON public.community_slug_aliases;--> statement-breakpoint
CREATE POLICY public_read ON public.community_slug_aliases FOR SELECT USING (true);--> statement-breakpoint
-- Database thật: mọi bảng thuộc vai trò hoiminh_app của API. Migration áp dụng tay chạy bằng vai trò khác,
-- nên phải trao lại quyền sở hữu bảng mới, không thì riêng bảng này bị RLS chặn.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hoiminh_app') THEN
    ALTER TABLE public.community_slug_aliases OWNER TO hoiminh_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_slug_aliases TO hoiminh_app;
  END IF;
END $$;
