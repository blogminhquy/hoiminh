CREATE TABLE IF NOT EXISTS "platform_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_account_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"duration_mode" text DEFAULT 'program' NOT NULL,
	"commission_duration_months" integer,
	"note" text,
	"created_by_user_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_partners" ADD CONSTRAINT "platform_partners_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_partners" ADD CONSTRAINT "platform_partners_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_partners_account_uq" ON "platform_partners" USING btree ("affiliate_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_partners_status_idx" ON "platform_partners" USING btree ("status");