CREATE TABLE IF NOT EXISTS "job_recipients" (
	"job_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_recipients_job_key_user_id_pk" PRIMARY KEY("job_key","user_id")
);
--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN IF NOT EXISTS "enqueued_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_recipients_created_idx" ON "job_recipients" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_active_end_idx" ON "events" USING btree ("ends_at") WHERE "events"."status" in ('scheduled','live');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_scheduled_start_idx" ON "events" USING btree ("starts_at") WHERE "events"."status" = 'scheduled';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_pending_expiry_idx" ON "orders" USING btree ("expires_at") WHERE "orders"."status" = 'pending';
--> statement-breakpoint
-- Bảng mới phải có policy như các bảng khác (0001_rls.sql chỉ chạy trên bảng lúc đó). Chỉ tiến trình hệ thống (bypass) ghi bảng này.
ALTER TABLE "job_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON public.job_recipients;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.job_recipients FOR ALL
  USING (hoiminh_bypass() OR hoiminh_is_user(user_id))
  WITH CHECK (hoiminh_bypass() OR hoiminh_is_user(user_id));
