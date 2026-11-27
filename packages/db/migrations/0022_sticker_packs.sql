CREATE TABLE IF NOT EXISTS "sticker_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stickers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "media_kind" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "media_kind" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stickers" ADD CONSTRAINT "stickers_pack_id_sticker_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."sticker_packs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sticker_packs_order_idx" ON "sticker_packs" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stickers_pack_idx" ON "stickers" USING btree ("pack_id","sort_order");--> statement-breakpoint
-- Bảng mới phải có policy như các bảng khác (0001_rls.sql chỉ chạy trên bảng lúc đó). Nhãn dán dùng chung cho mọi hội:
-- ai cũng đọc được (khung chọn nhãn, bình luận ở hội mở); chỉ tiến trình hệ thống và quản trị (bypass) thêm, sửa, xóa.
ALTER TABLE "sticker_packs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stickers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON public.sticker_packs;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.sticker_packs FOR ALL USING (hoiminh_bypass()) WITH CHECK (hoiminh_bypass());--> statement-breakpoint
DROP POLICY IF EXISTS public_read ON public.sticker_packs;--> statement-breakpoint
CREATE POLICY public_read ON public.sticker_packs FOR SELECT USING (true);--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON public.stickers;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.stickers FOR ALL USING (hoiminh_bypass()) WITH CHECK (hoiminh_bypass());--> statement-breakpoint
DROP POLICY IF EXISTS public_read ON public.stickers;--> statement-breakpoint
CREATE POLICY public_read ON public.stickers FOR SELECT USING (true);--> statement-breakpoint
-- Database thật: mọi bảng thuộc vai trò hoiminh_app của API. Migration áp dụng tay chạy bằng vai trò khác,
-- nên phải trao lại quyền sở hữu bảng mới, không thì hai bảng này bị RLS chặn.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hoiminh_app') THEN
    ALTER TABLE public.sticker_packs OWNER TO hoiminh_app;
    ALTER TABLE public.stickers OWNER TO hoiminh_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticker_packs TO hoiminh_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.stickers TO hoiminh_app;
  END IF;
END $$;--> statement-breakpoint
-- Bộ nhãn động khởi đầu "Mèo Mình": hình vẽ gốc của Hội Mình (SVG động nằm trong apps/web/public/stickers/meo-minh,
-- nguồn ở scripts/stickers). Quản trị sửa từ khóa, thứ tự, tắt bộ hay thêm bộ mới ở Hệ thống · Nhãn dán.
INSERT INTO "sticker_packs" ("id", "name", "active", "sort_order") VALUES ('7a3e9c10-5b2d-4c1e-9f00-000000000001', 'Mèo Mình', true, 0) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "stickers" ("id", "pack_id", "image_url", "keywords", "width", "height", "sort_order") VALUES
  ('7a3e9c10-5b2d-4c1e-9f01-000000000001', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/chao.svg', '["chào", "xin chào", "hello", "hi", "chào cả nhà", "chào mọi người"]'::jsonb, 240, 240, 0),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000002', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/cam-on.svg', '["cảm ơn", "cám ơn", "thanks", "thank you", "cảm ơn nhiều"]'::jsonb, 240, 240, 1),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000003', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/ok.svg', '["ok", "oke", "okay", "được", "đồng ý"]'::jsonb, 240, 240, 2),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000004', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/haha.svg', '["haha", "hihi", "hehe", "cười", "buồn cười"]'::jsonb, 240, 240, 3),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000005', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/huhu.svg', '["huhu", "hu hu", "khóc", "buồn"]'::jsonb, 240, 240, 4),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000006', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/yeu.svg', '["yêu", "thương", "love", "yêu quá", "tim"]'::jsonb, 240, 240, 5),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000007', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/wow.svg', '["wow", "ồ", "trời ơi", "bất ngờ", "ghê"]'::jsonb, 240, 240, 6),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000008', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/hoi.svg', '["hả", "ủa", "gì vậy", "sao vậy", "hả?"]'::jsonb, 240, 240, 7),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000009', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/gian.svg', '["giận", "tức", "bực", "giận rồi"]'::jsonb, 240, 240, 8),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000010', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/co-len.svg', '["cố lên", "cố gắng", "fighting", "cố lên nào"]'::jsonb, 240, 240, 9),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000011', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/tuyet.svg', '["tuyệt", "tuyệt vời", "giỏi", "xuất sắc", "đỉnh"]'::jsonb, 240, 240, 10),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000012', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/ngu-ngon.svg', '["ngủ ngon", "buồn ngủ", "ngủ", "good night"]'::jsonb, 240, 240, 11),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000013', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/xin-loi.svg', '["xin lỗi", "sorry"]'::jsonb, 240, 240, 12),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000014', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/chuc-mung.svg', '["chúc mừng", "mừng quá", "congrats", "yeah"]'::jsonb, 240, 240, 13),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000015', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/doi-xiu.svg', '["đợi", "chờ", "đợi xíu", "chờ chút"]'::jsonb, 240, 240, 14),
  ('7a3e9c10-5b2d-4c1e-9f01-000000000016', '7a3e9c10-5b2d-4c1e-9f00-000000000001', '/stickers/meo-minh/hoc-bai.svg', '["học", "học bài", "học thôi", "học nào"]'::jsonb, 240, 240, 15)
ON CONFLICT ("id") DO NOTHING;
