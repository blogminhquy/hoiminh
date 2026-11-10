-- Tin nhắn kiểu Zalo: trả lời trích dẫn, thả cảm xúc, thu hồi, ghim hội thoại, và "Bạn: ..." ở dòng xem trước.
-- IF NOT EXISTS để chạy lại được: migration này được áp dụng tay lên database thật trước khi merge.
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "pinned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "last_message_sender_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reactions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "recalled_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Hội thoại đã có từ trước: điền người gửi tin cuối để dòng xem trước hiện đúng "Bạn: ...".
UPDATE "conversations" c SET "last_message_sender_id" = (SELECT m."sender_user_id" FROM "messages" m WHERE m."conversation_id" = c."id" ORDER BY m."created_at" DESC LIMIT 1) WHERE c."last_message_sender_id" IS NULL;
