// Trang chủ "/" chính là trang Khám phá (không còn địa chỉ /kham-pha riêng).
// Riêng người đã đăng nhập vừa mở app (gõ địa chỉ, bấm link ngoài, biểu tượng màn hình chính) thì được đưa thẳng về chỗ của mình:
// có hội → trang Hôm nay của hội hiện tại; người mua lẻ (không hội, có đồ đã mua) → Khu học tập; còn lại → Hội của tôi.
// Bấm logo hay "Khám phá" trong app thì vẫn xem được trang Khám phá ở "/".
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { api } from '@/lib/api';
import { preferredCommunitySlug, useAuth } from '@/lib/auth';
import Discovery from './Discovery';

interface LibraryCounts { counts: { courses: number; digital: number } }

/**
 * Lượt tải trang đầu tiên của tab (React Router đặt key 'default'), tức là người dùng vừa mở app chứ không bấm link trong app.
 * Link Khám phá có sẵn bộ lọc (?danh-muc, ?q) thì không tính: người mở link đó muốn xem đúng danh sách ấy.
 */
export function isAppEntry(location: { key: string; search: string }): boolean {
  if (location.key !== 'default') return false;
  const params = new URLSearchParams(location.search);
  return !params.has('danh-muc') && !params.has('q');
}

export default function Page() {
  const { user, communities, loading } = useAuth();
  const entering = isAppEntry(useLocation());
  const slug = user ? preferredCommunitySlug(communities) : null;
  // Chỉ hỏi thư viện khi vừa mở app mà không có hội nào, người có hội đi thẳng vào trang Hôm nay, không tốn thêm một lượt gọi.
  const library = useQuery({ queryKey: ['library'], queryFn: () => api.get<LibraryCounts>('/v1/me/library'), enabled: entering && Boolean(user) && !loading && !slug });
  if (!entering) return <Discovery />;
  if (loading) return <div className="p-8"><LoadingBlock /></div>;
  if (!user) return <Discovery />;
  if (slug) return <Navigate to={`/${slug}/hom-nay`} replace />;
  if (user.isSuperAdmin) return <Navigate to="/he-thong" replace />;
  if (library.isLoading) return <div className="p-8"><LoadingBlock /></div>;
  const owned = (library.data?.counts.courses ?? 0) + (library.data?.counts.digital ?? 0);
  return <Navigate to={owned > 0 ? '/hoc' : '/admin'} replace />;
}
