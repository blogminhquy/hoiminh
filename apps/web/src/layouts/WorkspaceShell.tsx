// Khung chủ hội (wsShell trong build.mjs): header với Hội của tôi / Nhà phát triển / Khám phá / Tài khoản, nội dung 1120px giữa.
import { Bell } from 'lucide-react';
import { Avatar, Logo, T } from '@hoiminh/ui';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { useAuth, useBadges } from '@/lib/auth';

export function WorkspaceShell() {
  const { user, loading } = useAuth();
  const badges = useBadges();
  const location = useLocation();
  if (!user && !loading) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (loading) return <div className="p-8"><LoadingBlock /></div>;
  const item = (to: string, label: string) => (
    <NavLink to={to} end className="px-3 py-2 rounded-lg font-medium text-[14px]" style={({ isActive }) => ({ background: isActive ? T.bg : 'transparent', color: isActive ? T.ink : T.ink2 })}>{label}</NavLink>
  );
  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.bg }}>
      <header className="flex items-center gap-3 md:gap-5 px-4 md:px-16" style={{ height: 64, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
        <Link to="/admin"><Logo size={26} /></Link>
        <nav className="flex gap-1 ml-1 md:ml-3">
          {item('/admin', 'Hội của tôi')}
          {item('/admin/nha-phat-trien', 'Nhà phát triển')}
          {item('/kham-pha', 'Khám phá')}
          {item('/tai-khoan/goi', 'Tài khoản')}
        </nav>
        <span className="flex-grow" />
        <Link to="/thong-bao" aria-label="Thông báo" className="relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ color: T.ink2, border: `1px solid ${T.line2}`, background: T.surface }}>
          <Bell size={20} />
          {badges.data?.unreadNotifications ? <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: T.accent }} /> : null}
        </Link>
        <Link to="/tai-khoan/ho-so" aria-label="Tài khoản"><Avatar name={user?.name} src={user?.avatarUrl} color={T.ink} size={40} /></Link>
      </header>
      <div className="flex-grow flex justify-center px-4 py-6 md:px-16 md:py-10">
        <div className="w-full flex flex-col gap-6" style={{ maxWidth: 1120 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
