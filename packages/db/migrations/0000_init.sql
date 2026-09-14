CREATE TABLE IF NOT EXISTS "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"password_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"handle" text NOT NULL,
	"avatar_url" text,
	"cover_color" text DEFAULT '#D4593A',
	"bio" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"occupation" text DEFAULT '' NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"privacy" jsonb DEFAULT '{"publicProfile":true,"showProgress":true,"showCommunities":false,"allowMessages":true}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"auth_provider_id" text,
	"locale" text DEFAULT 'vi-VN' NOT NULL,
	"timezone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'kinh-doanh' NOT NULL,
	"logo_url" text,
	"logo_mark" text DEFAULT 'HM' NOT NULL,
	"logo_color" text DEFAULT '#D4593A' NOT NULL,
	"cover_url" text,
	"cover_color" text DEFAULT '#0E8E96' NOT NULL,
	"cover_tagline" text DEFAULT '' NOT NULL,
	"intro_video_url" text,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"pricing_mode" text DEFAULT 'freemium' NOT NULL,
	"doors_open" boolean DEFAULT true NOT NULL,
	"discoverable" boolean DEFAULT true NOT NULL,
	"custom_domain" text,
	"custom_domain_verified_at" timestamp with time zone,
	"enabled_providers" jsonb DEFAULT '["sepay","momo","vnpay"]'::jsonb NOT NULL,
	"tabs" jsonb DEFAULT '{"feed":true,"courses":true,"events":true,"members":true,"affiliate":true,"store":true,"about":true,"resources":false}'::jsonb NOT NULL,
	"require_space" boolean DEFAULT true NOT NULL,
	"moderate_new_members_days" integer DEFAULT 0 NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"paid_member_count" integer DEFAULT 0 NOT NULL,
	"locked_reason" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"email" text,
	"token" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_join_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"question" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"tier_id" uuid,
	"subscription_id" uuid,
	"referred_by_affiliate_id" uuid,
	"source" text DEFAULT 'direct' NOT NULL,
	"lifetime_value_cents" bigint DEFAULT 0 NOT NULL,
	"last_payment_at" timestamp with time zone,
	"next_renewal_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"level" integer DEFAULT 1 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"banned_at" timestamp with time zone,
	"churned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"plugin_key" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"monthly_minor" bigint,
	"yearly_minor" bigint,
	"one_time_minor" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_join_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_community_prefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"notification_level" text DEFAULT 'all' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan_key" text DEFAULT 'hoiminh' NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"content_locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"target_type" text DEFAULT 'post' NOT NULL,
	"target_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"content_md" text NOT NULL,
	"image_url" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"question" text NOT NULL,
	"multiple_choice" boolean DEFAULT false NOT NULL,
	"closes_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"file_id" uuid,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content_md" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"status_bg_key" text,
	"video_url" text,
	"link_url" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"broadcast" boolean DEFAULT false NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"last_comment_at" timestamp with time zone,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reaction" text DEFAULT 'like' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"post_permission" text DEFAULT 'everyone' NOT NULL,
	"color_key" text DEFAULT 'accent' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"entitlement_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"completed_lessons" integer DEFAULT 0 NOT NULL,
	"total_lessons" integer DEFAULT 0 NOT NULL,
	"percent" integer DEFAULT 0 NOT NULL,
	"last_lesson_id" uuid,
	"last_accessed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"community_id" uuid,
	"owner_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description_md" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"cover_color" text DEFAULT '#D4593A' NOT NULL,
	"intro_video_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"access_mode" text DEFAULT 'premium_and_store' NOT NULL,
	"price_minor" bigint,
	"compare_at_minor" bigint,
	"preview_first_module" boolean DEFAULT true NOT NULL,
	"affiliate_enabled" boolean DEFAULT true NOT NULL,
	"drip_enabled" boolean DEFAULT false NOT NULL,
	"certificate_enabled" boolean DEFAULT true NOT NULL,
	"sequential" boolean DEFAULT false NOT NULL,
	"hidden_from_store" boolean DEFAULT false NOT NULL,
	"lesson_count" integer DEFAULT 0 NOT NULL,
	"total_duration_seconds" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"watched_seconds" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"file_id" uuid,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"size_bytes" integer,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'video' NOT NULL,
	"video_provider" text,
	"video_external_id" text,
	"video_url" text,
	"content_md" text DEFAULT '' NOT NULL,
	"is_preview" boolean DEFAULT false NOT NULL,
	"drip_days" integer DEFAULT 0 NOT NULL,
	"require_complete" boolean DEFAULT false NOT NULL,
	"duration_seconds" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_question_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"title" text NOT NULL,
	"video_url" text NOT NULL,
	"video_provider" text,
	"video_external_id" text,
	"duration_seconds" integer,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"reminder_prefs" jsonb DEFAULT '["1h","start"]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"title" text NOT NULL,
	"recurrence" text DEFAULT 'weekly' NOT NULL,
	"cover_color" text DEFAULT '#0E8E96' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"series_id" uuid,
	"series_index" integer,
	"created_by_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description_md" text DEFAULT '' NOT NULL,
	"cover_color" text DEFAULT '#0E8E96' NOT NULL,
	"kind" text DEFAULT 'online' NOT NULL,
	"recurrence" text DEFAULT 'none' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
	"meeting_url" text,
	"meeting_provider" text,
	"location" text,
	"host_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capacity" integer,
	"access" text DEFAULT 'all_members' NOT NULL,
	"allow_questions" boolean DEFAULT true NOT NULL,
	"auto_publish_recording" boolean DEFAULT true NOT NULL,
	"reminders" jsonb DEFAULT '["1d","1h","start"]'::jsonb NOT NULL,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"registration_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bundle_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_product_id" uuid NOT NULL,
	"item_product_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"community_id" uuid,
	"code" text NOT NULL,
	"percent_off" integer,
	"amount_off_minor" bigint,
	"applies_to" text DEFAULT 'all' NOT NULL,
	"max_redemptions" integer,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"number" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"description" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"community_id" uuid,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"name" text NOT NULL,
	"cycle" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"community_id" uuid,
	"customer_user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"offer_id" uuid,
	"coupon_id" uuid,
	"subtotal_minor" bigint NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reference" text NOT NULL,
	"affiliate_account_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"request" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"community_id" uuid,
	"order_id" uuid NOT NULL,
	"customer_user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_id" text,
	"provider_raw_status" text,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text NOT NULL,
	"platform_fee_cents" bigint DEFAULT 0 NOT NULL,
	"refunded_minor" bigint DEFAULT 0 NOT NULL,
	"reference" text NOT NULL,
	"instruction" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"compare_at_minor" bigint,
	"currency" text DEFAULT 'VND' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"subheadline" text DEFAULT '' NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"cover_image_url" text,
	"intro_video_url" text,
	"benefits_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"faq_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"instructor_json" jsonb,
	"cta_text" text DEFAULT 'Mua ngay' NOT NULL,
	"guarantee" text DEFAULT '' NOT NULL,
	"sales_mode" text DEFAULT 'native' NOT NULL,
	"external_landing_url" text,
	"external_checkout_mode" text,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_pages_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"cover_color" text DEFAULT '#D4593A' NOT NULL,
	"course_id" uuid,
	"digital_file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_minor" bigint NOT NULL,
	"compare_at_minor" bigint,
	"currency" text DEFAULT 'VND' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"rating_avg_x10" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"launch_discount_ends_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'succeeded' NOT NULL,
	"provider_refund_id" text,
	"requested_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"community_id" uuid,
	"user_id" uuid NOT NULL,
	"tier_id" uuid,
	"offer_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"billing_cycle" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"provider" text,
	"provider_subscription_id" text,
	"last_order_id" uuid,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"community_id" uuid,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"granted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"scope_type" text DEFAULT 'platform' NOT NULL,
	"workspace_id" uuid,
	"mode" text DEFAULT 'sandbox' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"credentials_encrypted" text,
	"webhook_secret_encrypted" text,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_health_status" text DEFAULT 'unknown' NOT NULL,
	"last_health_at" timestamp with time zone,
	"consecutive_failures" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reconciliation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"bank_content" text DEFAULT '' NOT NULL,
	"bank_account" text,
	"reference_code" text,
	"amount_minor" bigint NOT NULL,
	"expected_minor" bigint,
	"currency" text DEFAULT 'VND' NOT NULL,
	"status" text DEFAULT 'unmatched' NOT NULL,
	"payment_id" uuid,
	"order_id" uuid,
	"webhook_event_id" uuid,
	"matched_by_user_id" uuid,
	"note" text,
	"transaction_at" timestamp with time zone DEFAULT now() NOT NULL,
	"matched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"processing_status" text DEFAULT 'received' NOT NULL,
	"error" text,
	"payment_id" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"last_read_at" timestamp with time zone,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid,
	"pair_key" text,
	"last_message_at" timestamp with time zone,
	"last_message_preview" text DEFAULT '' NOT NULL,
	"last_message_automated" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"image_url" text,
	"automated" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_prefs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email_digest" boolean DEFAULT true NOT NULL,
	"push" boolean DEFAULT true NOT NULL,
	"likes" boolean DEFAULT false NOT NULL,
	"per_community" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"community_id" uuid,
	"kind" text NOT NULL,
	"category" text DEFAULT 'all' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"actor_user_id" uuid,
	"link" text,
	"action_label" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"affiliate_code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"commission_rate_bps" integer,
	"click_count" integer DEFAULT 0 NOT NULL,
	"signup_count" integer DEFAULT 0 NOT NULL,
	"paid_count" integer DEFAULT 0 NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_account_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"visitor_id" text,
	"user_id" uuid,
	"source_click_id" uuid,
	"attributed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_account_id" uuid NOT NULL,
	"link_id" uuid,
	"visitor_id" text NOT NULL,
	"ip_hash" text,
	"user_agent_hash" text,
	"landing_url" text,
	"referrer" text,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversion_id" uuid,
	"affiliate_account_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"payment_id" uuid,
	"order_id" uuid,
	"rule_version" integer DEFAULT 1 NOT NULL,
	"base_minor" bigint NOT NULL,
	"rate_bps" integer NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_account_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"customer_user_id" uuid NOT NULL,
	"order_id" uuid,
	"subscription_id" uuid,
	"conversion_type" text NOT NULL,
	"gross_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"converted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_fraud_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_account_id" uuid NOT NULL,
	"conversion_id" uuid,
	"rule" text NOT NULL,
	"severity" text DEFAULT 'low' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_leaderboard_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"period_type" text NOT NULL,
	"period_key" text NOT NULL,
	"affiliate_account_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"referrals_count" integer DEFAULT 0 NOT NULL,
	"paid_count" integer DEFAULT 0 NOT NULL,
	"revenue_cents" bigint DEFAULT 0 NOT NULL,
	"commission_cents" bigint DEFAULT 0 NOT NULL,
	"rank_delta" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_account_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"slug" text NOT NULL,
	"destination_url" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_payout_profiles" (
	"affiliate_account_id" uuid PRIMARY KEY NOT NULL,
	"encrypted_payload" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"masked_account" text NOT NULL,
	"bank_code" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text NOT NULL,
	"community_id" uuid,
	"workspace_id" uuid,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"commission_rate_bps" integer DEFAULT 4000 NOT NULL,
	"commission_duration_months" integer,
	"hold_days" integer DEFAULT 14 NOT NULL,
	"min_withdrawal_minor" bigint DEFAULT 500000 NOT NULL,
	"cookie_days" integer DEFAULT 30 NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"allow_self_referral" boolean DEFAULT false NOT NULL,
	"leaderboard_visibility" text DEFAULT 'members' NOT NULL,
	"leaderboard_show_money" boolean DEFAULT true NOT NULL,
	"payer_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_wallet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_account_id" uuid NOT NULL,
	"commission_id" uuid,
	"withdrawal_id" uuid,
	"entry_type" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" text DEFAULT 'VND' NOT NULL,
	"idempotency_key" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_withdrawal_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_account_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" text DEFAULT 'VND' NOT NULL,
	"payout_snapshot_encrypted" text NOT NULL,
	"masked_account" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"transfer_reference" text,
	"rejection_reason" text,
	"reviewed_by_user_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_key_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status" integer NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"community_id" uuid,
	"actor_user_id" uuid,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"community_id" uuid,
	"owner_user_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"url" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"original_name" text NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"width" integer,
	"height" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "onboarding_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"community_id" uuid,
	"step_key" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plans" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"monthly_minor" bigint NOT NULL,
	"yearly_minor" bigint NOT NULL,
	"trial_days" integer DEFAULT 14 NOT NULL,
	"quotas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"plan_key" text NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"provider" text,
	"last_order_id" uuid,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text,
	"run_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"period" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_status" integer,
	"response_body" text,
	"next_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"community_id" uuid,
	"url" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secret_encrypted" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communities" ADD CONSTRAINT "communities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_join_questions" ADD CONSTRAINT "community_join_questions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_members" ADD CONSTRAINT "community_members_tier_id_community_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."community_tiers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_plugins" ADD CONSTRAINT "community_plugins_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_tiers" ADD CONSTRAINT "community_tiers_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_join_answers" ADD CONSTRAINT "member_join_answers_member_id_community_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."community_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_join_answers" ADD CONSTRAINT "member_join_answers_question_id_community_join_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."community_join_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_community_prefs" ADD CONSTRAINT "user_community_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_community_prefs" ADD CONSTRAINT "user_community_prefs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comments" ADD CONSTRAINT "comments_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "polls" ADD CONSTRAINT "polls_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_images" ADD CONSTRAINT "post_images_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spaces" ADD CONSTRAINT "spaces_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "courses" ADD CONSTRAINT "courses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "courses" ADD CONSTRAINT "courses_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "courses" ADD CONSTRAINT "courses_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_question_votes" ADD CONSTRAINT "event_question_votes_question_id_event_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."event_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_question_votes" ADD CONSTRAINT "event_question_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_questions" ADD CONSTRAINT "event_questions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_questions" ADD CONSTRAINT "event_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_recordings" ADD CONSTRAINT "event_recordings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_recordings" ADD CONSTRAINT "event_recordings_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_series" ADD CONSTRAINT "event_series_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_series_id_event_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."event_series"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_product_id_products_id_fk" FOREIGN KEY ("bundle_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_item_product_id_products_id_fk" FOREIGN KEY ("item_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupons" ADD CONSTRAINT "coupons_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupons" ADD CONSTRAINT "coupons_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offers" ADD CONSTRAINT "offers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offers" ADD CONSTRAINT "offers_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prices" ADD CONSTRAINT "prices_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_pages" ADD CONSTRAINT "product_pages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_pages" ADD CONSTRAINT "product_pages_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_webhook_event_id_webhook_events_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."webhook_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_matched_by_user_id_users_id_fk" FOREIGN KEY ("matched_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_accounts" ADD CONSTRAINT "affiliate_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_accounts" ADD CONSTRAINT "affiliate_accounts_program_id_affiliate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_attributions" ADD CONSTRAINT "affiliate_attributions_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_attributions" ADD CONSTRAINT "affiliate_attributions_program_id_affiliate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_attributions" ADD CONSTRAINT "affiliate_attributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_attributions" ADD CONSTRAINT "affiliate_attributions_source_click_id_affiliate_clicks_id_fk" FOREIGN KEY ("source_click_id") REFERENCES "public"."affiliate_clicks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_link_id_affiliate_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_conversion_id_affiliate_conversions_id_fk" FOREIGN KEY ("conversion_id") REFERENCES "public"."affiliate_conversions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_program_id_affiliate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_program_id_affiliate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_fraud_flags" ADD CONSTRAINT "affiliate_fraud_flags_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_leaderboard_snapshots" ADD CONSTRAINT "affiliate_leaderboard_snapshots_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_leaderboard_snapshots" ADD CONSTRAINT "affiliate_leaderboard_snapshots_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_payout_profiles" ADD CONSTRAINT "affiliate_payout_profiles_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_programs" ADD CONSTRAINT "affiliate_programs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_programs" ADD CONSTRAINT "affiliate_programs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_programs" ADD CONSTRAINT "affiliate_programs_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_wallet_entries" ADD CONSTRAINT "affiliate_wallet_entries_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_wallet_entries" ADD CONSTRAINT "affiliate_wallet_entries_commission_id_affiliate_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."affiliate_commissions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_withdrawal_requests" ADD CONSTRAINT "affiliate_withdrawal_requests_affiliate_account_id_affiliate_accounts_id_fk" FOREIGN KEY ("affiliate_account_id") REFERENCES "public"."affiliate_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_withdrawal_requests" ADD CONSTRAINT "affiliate_withdrawal_requests_program_id_affiliate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_withdrawal_requests" ADD CONSTRAINT "affiliate_withdrawal_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_key_logs" ADD CONSTRAINT "api_key_logs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "files" ADD CONSTRAINT "files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "files" ADD CONSTRAINT "files_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "files" ADD CONSTRAINT "files_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_plan_key_plans_key_fk" FOREIGN KEY ("plan_key") REFERENCES "public"."plans"("key") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_sessions_refresh_uq" ON "auth_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verifications_user_idx" ON "email_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "password_resets_token_uq" ON "password_resets" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_resets_user_idx" ON "password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_handle_uq" ON "users" USING btree ("handle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_auth_provider_idx" ON "users" USING btree ("auth_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "communities_slug_uq" ON "communities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communities_workspace_idx" ON "communities" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communities_discover_idx" ON "communities" USING btree ("discoverable","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_invites_token_uq" ON "community_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_invites_community_idx" ON "community_invites" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_join_questions_idx" ON "community_join_questions" USING btree ("community_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_members_uq" ON "community_members" USING btree ("community_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_members_user_idx" ON "community_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_members_status_idx" ON "community_members" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_members_affiliate_idx" ON "community_members" USING btree ("referred_by_affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_plugins_uq" ON "community_plugins" USING btree ("community_id","plugin_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_tiers_uq" ON "community_tiers" USING btree ("community_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_join_answers_uq" ON "member_join_answers" USING btree ("member_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_community_prefs_uq" ON "user_community_prefs" USING btree ("user_id","community_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_uq" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_uq" ON "workspaces" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_owner_idx" ON "workspaces" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_target_idx" ON "comments" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_parent_idx" ON "comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_author_idx" ON "comments" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "poll_options_poll_idx" ON "poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "poll_votes_uq" ON "poll_votes" USING btree ("poll_id","option_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "poll_votes_user_idx" ON "poll_votes" USING btree ("poll_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_images_post_idx" ON "post_images" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_feed_idx" ON "posts" USING btree ("community_id","pinned","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_space_idx" ON "posts" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_author_idx" ON "posts" USING btree ("author_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reactions_uq" ON "reactions" USING btree ("user_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_target_idx" ON "reactions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "spaces_uq" ON "spaces" USING btree ("community_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_enrollments_uq" ON "course_enrollments" USING btree ("course_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_modules_course_idx" ON "course_modules" USING btree ("course_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_progress_uq" ON "course_progress" USING btree ("course_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_progress_user_idx" ON "course_progress" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "courses_slug_uq" ON "courses" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courses_community_idx" ON "courses" USING btree ("community_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_progress_uq" ON "lesson_progress" USING btree ("lesson_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_progress_course_user_idx" ON "lesson_progress" USING btree ("course_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_resources_lesson_idx" ON "lesson_resources" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lessons_module_idx" ON "lessons" USING btree ("module_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lessons_course_idx" ON "lessons" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_question_votes_uq" ON "event_question_votes" USING btree ("question_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_questions_event_idx" ON "event_questions" USING btree ("event_id","vote_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_recordings_community_idx" ON "event_recordings" USING btree ("community_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_registrations_uq" ON "event_registrations" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_registrations_user_idx" ON "event_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_series_community_idx" ON "event_series" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_community_time_idx" ON "events" USING btree ("community_id","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_series_idx" ON "events" USING btree ("series_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bundle_items_uq" ON "bundle_items" USING btree ("bundle_product_id","item_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_uq" ON "coupons" USING btree ("community_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_number_uq" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_user_idx" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "offers_uq" ON "offers" USING btree ("resource_type","resource_id","cycle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offers_community_idx" ON "offers" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_reference_uq" ON "orders" USING btree ("reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_customer_idx" ON "orders" USING btree ("customer_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_community_idx" ON "orders" USING btree ("community_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_attempts_payment_idx" ON "payment_attempts" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_events_payment_idx" ON "payment_events" USING btree ("payment_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_reference_idx" ON "payments" USING btree ("reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_provider_idx" ON "payments" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_community_idx" ON "payments" USING btree ("community_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prices_offer_idx" ON "prices" USING btree ("offer_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_uq" ON "products" USING btree ("community_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_community_idx" ON "products" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_course_idx" ON "products" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_community_idx" ON "subscriptions" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_period_idx" ON "subscriptions" USING btree ("status","current_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entitlements_user_resource_idx" ON "entitlements" USING btree ("user_id","resource_type","resource_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entitlements_source_idx" ON "entitlements" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entitlements_community_idx" ON "entitlements" USING btree ("community_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_accounts_uq" ON "provider_accounts" USING btree ("provider","scope_type","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reconciliation_provider_tx_uq" ON "reconciliation_items" USING btree ("provider","provider_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reconciliation_status_idx" ON "reconciliation_items" USING btree ("status","transaction_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_event_uq" ON "webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_status_idx" ON "webhook_events" USING btree ("processing_status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_participants_uq" ON "conversation_participants" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_participants_user_idx" ON "conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_pair_uq" ON "conversations" USING btree ("pair_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_last_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_accounts_uq" ON "affiliate_accounts" USING btree ("user_id","program_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_accounts_code_uq" ON "affiliate_accounts" USING btree ("affiliate_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_attributions_user_idx" ON "affiliate_attributions" USING btree ("user_id","program_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_attributions_visitor_idx" ON "affiliate_attributions" USING btree ("visitor_id","program_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_clicks_account_idx" ON "affiliate_clicks" USING btree ("affiliate_account_id","clicked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_clicks_visitor_idx" ON "affiliate_clicks" USING btree ("visitor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_commissions_payment_uq" ON "affiliate_commissions" USING btree ("payment_id","rule_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_commissions_account_idx" ON "affiliate_commissions" USING btree ("affiliate_account_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_commissions_due_idx" ON "affiliate_commissions" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_conversions_account_idx" ON "affiliate_conversions" USING btree ("affiliate_account_id","converted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_conversions_customer_idx" ON "affiliate_conversions" USING btree ("customer_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_conversions_order_idx" ON "affiliate_conversions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_leaderboard_uq" ON "affiliate_leaderboard_snapshots" USING btree ("community_id","period_type","period_key","affiliate_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_leaderboard_rank_idx" ON "affiliate_leaderboard_snapshots" USING btree ("community_id","period_type","period_key","rank");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_links_slug_uq" ON "affiliate_links" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_links_account_idx" ON "affiliate_links" USING btree ("affiliate_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_programs_community_uq" ON "affiliate_programs" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_programs_scope_idx" ON "affiliate_programs" USING btree ("scope_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_wallet_entries_idem_uq" ON "affiliate_wallet_entries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_wallet_entries_account_idx" ON "affiliate_wallet_entries" USING btree ("affiliate_account_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_withdrawals_program_idx" ON "affiliate_withdrawal_requests" USING btree ("program_id","status","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_withdrawals_account_idx" ON "affiliate_withdrawal_requests" USING btree ("affiliate_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_key_logs_key_idx" ON "api_key_logs" USING btree ("api_key_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_hash_uq" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_workspace_idx" ON "api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_workspace_idx" ON "audit_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_to_idx" ON "email_logs" USING btree ("to_email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "files_object_key_uq" ON "files" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_owner_idx" ON "files" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_progress_uq" ON "onboarding_progress" USING btree ("workspace_id","community_id","step_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_subscriptions_workspace_uq" ON "platform_subscriptions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_subscriptions_period_idx" ON "platform_subscriptions" USING btree ("status","current_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_jobs_due_idx" ON "scheduled_jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scheduled_jobs_dedupe_uq" ON "scheduled_jobs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_usage_uq" ON "subscription_usage" USING btree ("workspace_id","metric","period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_pending_idx" ON "webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_idx" ON "webhook_deliveries" USING btree ("webhook_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_workspace_idx" ON "webhooks" USING btree ("workspace_id");