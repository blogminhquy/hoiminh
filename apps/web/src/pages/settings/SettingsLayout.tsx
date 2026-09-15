// Khung Cài đặt hội (settingsNav trong build.mjs): nav 220px 10 mục, nội dung tối đa 880px. Chỉ người có settings.manage.
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useCan, useShell } from '@/lib/community';

export default function Page() {
  const shell = useShell();
  const can = useCan();
  const base = `/${shell.community.slug}`;
  if (!can('settings.manage') && !can('billing.manage')) return <Navigate to={`${base}/bang-tin`} replace />;
  const items: Array<{ label: string; to: string; end?: boolean }> = [
    { label: 'Tổng quan', to: `${base}/cai-dat`, end: true },
    { label: 'Khám phá', to: `${base}` },
    { label: 'Mời thành viên', to: `${base}/thanh-vien?moi=1` },
    { label: 'Chung', to: `${base}/cai-dat/chung` },
    { label: 'Giá và gói', to: `${base}/cai-dat/gia` },
    { label: 'Cộng sự (Affiliate)', to: `${base}/cai-dat/cong-su` },
    { label: 'Tiện ích', to: `${base}/cai-dat/tien-ich` },
    { label: 'Bảng tin', to: `${base}/cai-dat/bang-tin` },
    { label: 'Thông báo', to: `/thong-bao` },
    { label: 'Thanh toán', to: `${base}/cai-dat/thanh-toan` },
  ];
  return (
    <div className="settings-page">
      <nav className="settings-nav" aria-label="Cài đặt">
        {items.map((it) => <NavLink key={it.label} to={it.to} end={it.end} className={({ isActive }) => `settings-nav-item${isActive && it.to.startsWith(`${base}/cai-dat`) ? ' on' : ''}`}>{it.label}</NavLink>)}
      </nav>
      <div className="settings-main" style={{ maxWidth: 880 }}>
        <Outlet />
      </div>
    </div>
  );
}
