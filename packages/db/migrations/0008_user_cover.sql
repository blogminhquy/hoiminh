-- Ảnh bìa hồ sơ người dùng (bản sao files.url); chưa có ảnh thì hồ sơ hiện nền màu cover_color.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cover_url" text;
