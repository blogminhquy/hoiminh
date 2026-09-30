CREATE TABLE IF NOT EXISTS "job_recipients" (
	"job_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_recipients_job_key_user_id_pk" PRIMARY KEY("job_key","user_id")
);
--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "enqueued_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_recipients_created_idx" ON "job_recipients" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_active_end_idx" ON "events" USING btree ("ends_at") WHERE "events"."status" in ('scheduled','live');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_scheduled_start_idx" ON "events" USING btree ("starts_at") WHERE "events"."status" = 'scheduled';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_pending_expiry_idx" ON "orders" USING btree ("expires_at") WHERE "orders"."status" = 'pending';