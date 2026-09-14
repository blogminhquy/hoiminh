-- Row Level Security theo tenant (mục 9, 40).
-- API chạy dưới vai trò hoiminh_app (không phải superuser) và đặt các biến phiên trong transaction:
--   app.user_id        uuid người dùng hiện tại
--   app.workspace_ids  danh sách workspace_id người dùng có quyền, ngăn cách bằng dấu phẩy
--   app.community_ids  danh sách community_id người dùng là thành viên
--   app.bypass         'on' cho tiến trình hệ thống (cron, webhook, super admin)
-- Ở PGlite/local, kết nối là superuser nên RLS không chặn; ở Supabase dùng vai trò hoiminh_app.
CREATE OR REPLACE FUNCTION hoiminh_setting(name text) RETURNS text
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting(name, true), '') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hoiminh_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT COALESCE(hoiminh_setting('app.bypass'), 'off') = 'on' $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hoiminh_in_list(name text, value uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT value IS NOT NULL AND value::text = ANY(string_to_array(COALESCE(hoiminh_setting(name), ''), ','))
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hoiminh_is_user(value uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT value IS NOT NULL AND value::text = hoiminh_setting('app.user_id') $$;
--> statement-breakpoint
DO $$
DECLARE
  t record;
  has_ws boolean;
  has_cm boolean;
  has_user boolean;
  expr text;
BEGIN
  FOR t IN
    SELECT c.relname AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT LIKE '\_\_%' AND c.relname <> 'drizzle_migrations'
  LOOP
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t.name AND column_name='workspace_id') INTO has_ws;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t.name AND column_name='community_id') INTO has_cm;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t.name AND column_name='user_id') INTO has_user;

    expr := 'hoiminh_bypass()';
    IF has_ws THEN expr := expr || ' OR hoiminh_in_list(''app.workspace_ids'', workspace_id)'; END IF;
    IF has_cm THEN expr := expr || ' OR hoiminh_in_list(''app.community_ids'', community_id)'; END IF;
    IF has_user THEN expr := expr || ' OR hoiminh_is_user(user_id)'; END IF;
    -- Bảng không có cột tenant (plans, feature_flags, users…) chỉ mở cho bypass hoặc đọc công khai do service quyết định.
    IF NOT has_ws AND NOT has_cm AND NOT has_user THEN expr := expr || ' OR true'; END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t.name);
    EXECUTE format('CREATE POLICY tenant_isolation ON public.%I FOR ALL USING (%s) WITH CHECK (%s)', t.name, expr, expr);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE POLICY public_read ON public.communities FOR SELECT USING (status = 'active' AND deleted_at IS NULL);
--> statement-breakpoint
CREATE POLICY public_read ON public.community_tiers FOR SELECT USING (is_active);
--> statement-breakpoint
CREATE POLICY public_read ON public.products FOR SELECT USING (status = 'published' AND deleted_at IS NULL);
--> statement-breakpoint
CREATE POLICY public_read ON public.product_pages FOR SELECT USING (status = 'published');
--> statement-breakpoint
CREATE POLICY public_read ON public.courses FOR SELECT USING (status = 'published' AND deleted_at IS NULL);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hoiminh_app') THEN
    BEGIN
      CREATE ROLE hoiminh_app NOLOGIN;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Không đủ quyền tạo role hoiminh_app, bỏ qua';
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hoiminh_app') THEN
    GRANT USAGE ON SCHEMA public TO hoiminh_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hoiminh_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hoiminh_app;
  END IF;
END $$;
