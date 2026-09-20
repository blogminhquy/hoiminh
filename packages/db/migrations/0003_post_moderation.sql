-- Duyệt bài thành viên mới (Cài đặt · Bảng tin · moderate_new_members_days): 'approved' | 'pending'.
-- IF NOT EXISTS vì cột đã được thêm tay trên Supabase ngày 20/09 trước khi migrator chạy tới đây.
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'approved' NOT NULL;
