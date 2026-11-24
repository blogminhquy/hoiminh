// Khung chủ hội: header có Hội của tôi, Gói bổ sung và Tài khoản (Nhà phát triển đã về Cài đặt của từng hội, Khám phá
// nằm trong bảng chuyển hội), nội dung 1120px giữa.
import { Logo, T } from '@hoiminh/ui';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AccountAvatarLink } from '@/components/AccountAvatarLink';
import { NotificationBell } from '@/components/NotificationBell';
import { LoadingBlock } from '@/components/QueryState';
import { ADDONS_PATH } from '@/lib/addons';
import { useAuth } from '@/lib/auth';

export function WorkspaceShell() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (!user && !loading) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (loading) return <div className="p-8"><LoadingBlock /></div>;
  // "Hội của tôi" sáng ở mọi trang con của /admin (tạo hội, gói), để người dùng luôn biết mình đang ở đâu,
  // trừ trang Gói bổ sung vì trang đó có mục riêng trên menu.
  const onAddons = location.pathname.startsWith(ADDONS_PATH);
  const item = (to: string, label: string, end = true, off = false) => (
    <NavLink to={to} end={end} className="px-3 py-2 rounded-lg font-medium text-[14px] whitespace-nowrap flex-shrink-0" style={({ isActive }) => ({ background: isActive && !off ? T.bg : 'transparent', color: isActive && !off ? T.ink : T.ink2 })}>{label}</NavLink>
  );
  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.bg }}>
      <header className="flex items-center gap-3 md:gap-5 px-4 md:px-16" style={{ height: 64, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
        <Link to="/admin" aria-label="Hội Mình" className="flex-shrink-0"><Logo size={26} markOnlyOnMobile /></Link>
        {/* Điện thoại: các mục nằm một hàng vuốt ngang, không xuống dòng làm vỡ đầu trang. */}
        <nav className="flex gap-1 ml-1 md:ml-3 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {item('/admin', 'Hội của tôi', false, onAddons)}
          {item(ADDONS_PATH, 'Gói bổ sung')}
          {item('/tai-khoan', 'Tài khoản')}
          {user?.isSuperAdmin && item('/he-thong', 'Hệ thống')}
        </nav>
        <span className="flex-grow" />
        <NotificationBell />
        <AccountAvatarLink user={user} />
      </header>
      <div className="flex-grow flex justify-center px-4 py-6 md:px-16 md:py-10">
        <div className="w-full flex flex-col gap-6" style={{ maxWidth: 1120 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
