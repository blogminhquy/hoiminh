ALTER TABLE "communities" ADD COLUMN "visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
-- Hội mở: người ngoài (kể cả chưa đăng nhập) đọc được bảng tin, sự kiện, danh bạ thành viên của hội đó.
-- Quyền thật vẫn do service quyết định (CommunityAccess.canView); policy dưới đây chỉ để khi bật FORCE ROW LEVEL
-- SECURITY thì các đường đọc này không trả về rỗng. Chỉ có SELECT: người ngoài không ghi được gì.
CREATE OR REPLACE FUNCTION hoiminh_open_community(value uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.communities c WHERE c.id = value AND c.visibility = 'public' AND c.status = 'active' AND c.deleted_at IS NULL)
$$;
--> statement-breakpoint
DROP POLICY IF EXISTS open_community_read ON public.posts;--> statement-breakpoint
CREATE POLICY open_community_read ON public.posts FOR SELECT USING (hoiminh_open_community(community_id));--> statement-breakpoint
DROP POLICY IF EXISTS open_community_read ON public.spaces;--> statement-breakpoint
CREATE POLICY open_community_read ON public.spaces FOR SELECT USING (hoiminh_open_community(community_id));--> statement-breakpoint
DROP POLICY IF EXISTS open_community_read ON public.comments;--> statement-breakpoint
CREATE POLICY open_community_read ON public.comments FOR SELECT USING (hoiminh_open_community(community_id));--> statement-breakpoint
DROP POLICY IF EXISTS open_community_read ON public.events;--> statement-breakpoint
CREATE POLICY open_community_read ON public.events FOR SELECT USING (hoiminh_open_community(community_id));--> statement-breakpoint
DROP POLICY IF EXISTS open_community_read ON public.community_members;--> statement-breakpoint
CREATE POLICY open_community_read ON public.community_members FOR SELECT USING (hoiminh_open_community(community_id));
