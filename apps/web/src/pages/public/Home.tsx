// Trang gốc "/": có hội → Bảng tin của hội hiện tại; người mua lẻ (không hội, có đồ đã mua) → Khu học tập;
// còn lại đã đăng nhập → Hội của tôi; chưa đăng nhập → Khám phá.
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { api } from '@/lib/api';
import { preferredCommunitySlug, useAuth } from '@/lib/auth';

interface LibraryCounts { counts: { courses: number; digital: number } }

export default function Page() {
  const { user, communities, loading } = useAuth();
  const slug = user ? preferredCommunitySlug(communities) : null;
  // Chỉ hỏi thư viện khi không có hội nào — người có hội đi thẳng vào bảng tin, không tốn thêm một lượt gọi.
  const library = useQuery({ queryKey: ['library'], queryFn: () => api.get<LibraryCounts>('/v1/me/library'), enabled: Boolean(user) && !loading && !slug });
  if (loading) return <div className="p-8"><LoadingBlock /></div>;
  if (user && slug) return <Navigate to={`/${slug}/bang-tin`} replace />;
  if (user) {
    if (library.isLoading) return <div className="p-8"><LoadingBlock /></div>;
    const owned = (library.data?.counts.courses ?? 0) + (library.data?.counts.digital ?? 0);
    return <Navigate to={owned > 0 ? '/hoc' : '/admin'} replace />;
  }
  return <Navigate to="/kham-pha" replace />;
}
