// Trang gốc "/": đã đăng nhập và có hội → Bảng tin của hội hiện tại; chưa đăng nhập → Khám phá.
import { Navigate } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { preferredCommunitySlug, useAuth } from '@/lib/auth';

export default function Page() {
  const { user, communities, loading } = useAuth();
  if (loading) return <div className="p-8"><LoadingBlock /></div>;
  const slug = user ? preferredCommunitySlug(communities) : null;
  if (user && slug) return <Navigate to={`/${slug}/bang-tin`} replace />;
  if (user) return <Navigate to="/admin" replace />;
  return <Navigate to="/kham-pha" replace />;
}
