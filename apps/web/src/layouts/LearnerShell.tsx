// Khung Khu học tập (V2, mục 153): dành cho người mua lẻ, có thể không thuộc hội nào.
// Cố tình KHÔNG dùng thanh bên hội như AppShell: người ở đây không có bảng tin, sự kiện hay cửa hàng để vào.
import { Avatar, Logo, T } from '@hoiminh/ui';
import { Bell, GraduationCap, MessageCircle, Receipt } from 'lucide-react';
import { createContext, useContext } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { useAuth } from '@/lib/auth';
import { useLiveBadges } from '@/lib/realtime';
import { AppShell } from './AppShell';

/** Bật khi đang ở trong Khu học tập: các trang dùng chung (Bài học) đổi link về `/hoc` thay vì khung hội. */
const LearnerModeContext = createContext(false);
export const useLearnerMode = () => useContext(LearnerModeContext);

/** Đường dẫn bài học và khóa học tùy khung đang đứng. */
export function useLearningLinks(slug: string | null) {
  const learner = useLearnerMode();
  return {
    learner,
    lesson: (lessonId: string) => (learner ? `/hoc/bai/${lessonId}` : `/${slug}/bai/${lessonId}`),
    course: (courseId: string) => (learner ? `/hoc` : `/${slug}/khoa-hoc/${courseId}`),
    courses: () => (learner ? '/hoc' : `/${slug}/khoa-hoc`),
  };
}

function Tab({ to, icon, label, dot }: { to: string; icon: React.ReactNode; label: string; dot?: number }) {
  return (
    <NavLink to={to} end className={({ isActive }) => `relative inline-flex items-center gap-2 px-3 h-9 rounded-[10px] text-[14px] font-semibold${isActive ? ' on' : ''}`} style={({ isActive }) => ({ color: isActive ? T.ink : T.ink2, background: isActive ? T.goldSoft : 'transparent' })}>
      {icon}
      <span className="hide-mobile">{label}</span>
      {dot ? <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: T.accent }} /> : null}
    </NavLink>
  );
}

export function LearnerShell() {
  const { user, loading } = useAuth();
  const badges = useLiveBadges();
  const location = useLocation();
  if (!user && !loading) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (loading) return <div className="p-8"><LoadingBlock /></div>;
  return (
    <LearnerModeContext.Provider value>
      <div className="flex flex-col min-h-screen" style={{ background: T.bg }}>
        <header className="flex items-center gap-3 px-4 md:px-8 flex-shrink-0" style={{ height: 64, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
          <Link to="/hoc" aria-label="Hội Mình"><Logo size={26} /></Link>
          <nav className="flex items-center gap-1 ml-3 md:ml-6" aria-label="Khu học tập">
            <Tab to="/hoc" icon={<GraduationCap size={18} />} label="Khu học tập" />
            <Tab to="/tai-khoan/goi" icon={<Receipt size={18} />} label="Đơn hàng" />
          </nav>
          <span className="flex-grow" />
          <div className="flex items-center gap-2">
            <Link to="/tin-nhan" aria-label="Tin nhắn" className="relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ color: T.ink2, border: `1px solid ${T.line2}`, background: T.surface }}><MessageCircle size={20} />{badges.data?.unreadMessages ? <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: T.accent }} /> : null}</Link>
            <Link to="/thong-bao" aria-label="Thông báo" className="relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ color: T.ink2, border: `1px solid ${T.line2}`, background: T.surface }}><Bell size={20} />{badges.data?.unreadNotifications ? <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: T.accent }} /> : null}</Link>
            <Link to="/tai-khoan/ho-so" aria-label="Tài khoản"><Avatar name={user?.name} src={user?.avatarUrl} color={T.ink} size={40} /></Link>
          </div>
        </header>
        <div className="flex-grow w-full mx-auto" style={{ maxWidth: 1120, padding: '28px 16px 48px' }}>
          <Outlet />
        </div>
      </div>
    </LearnerModeContext.Provider>
  );
}

/**
 * Khung cho các trang Tài khoản / Tin nhắn / Thông báo: dùng khung hội nếu người dùng có hội,
 * còn người mua lẻ (0 hội) thì dùng khung Khu học tập: nếu không họ sẽ bị AppShell đá về /kham-pha.
 */
export function AccountShell() {
  const { communities, loading } = useAuth();
  if (loading) return <div className="p-8"><LoadingBlock /></div>;
  return communities.length > 0 ? <AppShell requireMember={false} /> : <LearnerShell />;
}
