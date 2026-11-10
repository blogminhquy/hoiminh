-- Bộ ảnh và video của trang giới thiệu hội: mảng { id, kind, url, fileId } theo thứ tự hiển thị.
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "about_media" jsonb DEFAULT '[]'::jsonb NOT NULL;
