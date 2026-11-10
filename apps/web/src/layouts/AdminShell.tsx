// Khung quản trị hệ thống: sidebar màu sideDark với 5 nhóm (Tổng quan, Hội và người dùng, Tiền, Gói và tính năng,
// Hệ thống), hàng tab con trên nội dung, và ô lệnh "Bạn muốn làm gì?" (Ctrl K) thay ô tìm nhanh cũ.
import { BadgeCheck, House, KeyRound, Search, Users, Wallet } from 'lucide-react';
import { Logo, T, Tag } from '@hoiminh/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AccountAvatarLink } from '@/components/AccountAvatarLink';
import { CommandButton, CommandPalette, useCommandHotkey, type PaletteItem } from '@/components/CommandPalette';
import { LoadingBlock } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { adminCommands } from '@/lib/commands';
import { useVersionStatus } from '@/lib/version';

/** Năm nhóm của khu quản trị (trước là 11 mục). Nhóm có hơn một trang thì hiện hàng tab con ngay trên nội dung. Đường dẫn giữ nguyên. */
interface AdminGroup { key: string; label: string; icon: ReactNode; tabs: Array<{ label: string; to: string }> }
const GROUPS: AdminGroup[] = [
  { key: 'tong-quan', label: 'Tổng quan', icon: <House size={20} />, tabs: [{ label: 'Tổng quan', to: '/he-thong' }] },
  { key: 'hoi', label: 'Hội và người dùng', icon: <Users size={20} />, tabs: [{ label: 'Hội', to: '/he-thong/hoi' }, { label: 'Người dùng', to: '/he-thong/nguoi-dung' }, { label: 'Bị báo cáo', to: '/he-thong/ho-tro' }, { label: 'Báo cáo người dùng', to: '/he-thong/bao-cao' }] },
  { key: 'tien', label: 'Tiền', icon: <Wallet size={20} />, tabs: [{ label: 'Thanh toán và đối soát', to: '/he-thong/thanh-toan' }, { label: 'Cộng sự nền tảng', to: '/he-thong/cong-su' }] },
  { key: 'goi', label: 'Gói và tính năng', icon: <BadgeCheck size={20} />, tabs: [{ label: 'Gói nền tảng', to: '/he-thong/goi' }, { label: 'Tính năng', to: '/he-thong/tinh-nang' }] },
  { key: 'he-thong', label: 'Hệ thống', icon: <KeyRound size={20} />, tabs: [{ label: 'Hạ tầng và khóa', to: '/he-thong/ha-tang' }, { label: 'Phiên bản', to: '/he-thong/phien-ban' }, { label: 'Nhật ký', to: '/he-thong/nhat-ky' }] },
];
/** Nhóm chứa đường dẫn đang mở. */
export function adminGroupOf(pathname: string): AdminGroup {
  const path = pathname.replace(/\/+$/, '') || '/he-thong';
  return GROUPS.find((g) => g.tabs.some((t) => t.to !== '/he-thong' && (path === t.to || path.startsWith(`${t.to}/`)))) ?? GROUPS[0]!;
}

export function AdminShell() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { updateAvailable } = useVersionStatus();
  const health = useQuery({ queryKey: ['health'], queryFn: () => fetch(`${api.url}/health`).then((r) => r.json() as Promise<{ status: string; env: string }>), staleTime: 60_000 });
  const todo = useQuery({ queryKey: ['admin', 'overview', 30], queryFn: () => api.get<{ todo: { unmatched: number } }>('/v1/admin/overview?days=30'), enabled: Boolean(user?.isSuperAdmin), staleTime: 60_000 });
  const [command, setCommand] = useState(false);
  const toggleCommand = useCallback(() => setCommand((v) => !v), []);
  useCommandHotkey(toggleCommand, Boolean(user?.isSuperAdmin));
  const commands = useMemo(() => adminCommands(), []);
  // Gõ tên hội hoặc email: hai dòng cuối dẫn tới danh sách Hội, Người dùng đã lọc sẵn.
  const extra = useCallback((q: string): PaletteItem[] => (q.length < 2 ? [] : [
    { id: 'find-community', group: 'Tìm', label: `Tìm hội "${q}"`, to: `/he-thong/hoi?q=${encodeURIComponent(q)}`, icon: <Search size={18} /> },
    { id: 'find-user', group: 'Tìm', label: `Tìm người dùng "${q}"`, hint: 'Theo tên hoặc email', to: `/he-thong/nguoi-dung?q=${encodeURIComponent(q)}`, icon: <Search size={18} /> },
  ]), []);
  if (!user && !loading) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (loading) return <div className="p-8"><LoadingBlock /></div>;
  if (!user?.isSuperAdmin) return <Navigate to="/admin" replace />;
  const unmatched = todo.data?.todo.unmatched ?? 0;
  const group = adminGroupOf(location.pathname);
  const badge = (g: AdminGroup) => (g.key === 'tien' && unmatched ? <span className="text-[11px] font-semibold rounded-full px-[7px]" style={{ background: T.accent, color: T.invertInk }}>{unmatched}</span> : g.key === 'he-thong' && updateAvailable ? <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: T.accent }} /> : null);
  return (
    <div className="flex min-h-screen" style={{ background: T.bg }}>
      <aside className="app-sidebar flex flex-col flex-shrink-0 sticky top-0 h-screen" style={{ width: 264, background: T.sideDark, color: T.sideText, padding: '16px 12px' }}>
        <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-3.5" style={{ borderBottom: '1px solid rgba(255,253,249,0.08)' }}>
          <svg width="36" height="36" viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="9" cy="13" r="7" fill={T.gold} /><circle cx="17" cy="13" r="7" fill={T.teal} fillOpacity="0.85" /></svg>
          <div className="flex-grow"><div className="serif font-bold text-[14px]" style={{ color: T.invertInk }}>Hội Mình</div><div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}>Quản trị hệ thống</div></div>
        </div>
        <nav className="flex flex-col gap-0.5 pt-3" aria-label="Quản trị hệ thống">
          {GROUPS.map((g) => <Link key={g.key} to={g.tabs[0]!.to} aria-current={group.key === g.key ? 'page' : undefined} className={`nav-item${group.key === g.key ? ' on' : ''}`}>{g.icon}<span className="flex-grow">{g.label}</span>{badge(g)}</Link>)}
        </nav>
        <div className="flex-grow" />
        <div className="p-3 rounded-[10px] text-[12px] flex items-center gap-2" style={{ background: 'rgba(255,253,249,0.06)', color: T.sideText }}>
          <span className="w-2 h-2 rounded-full" style={{ background: health.data?.status === 'ok' ? T.teal : T.accent }} />
          {health.data?.status === 'ok' ? 'Hệ thống ổn định' : health.isLoading ? 'Đang kiểm tra…' : 'Cần kiểm tra API'}
        </div>
      </aside>
      <div className="flex-grow flex flex-col min-w-0">
        <header className="flex items-center gap-4 px-4 md:px-8" style={{ height: 64, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
          <span className="only-mobile"><Logo size={22} /></span>
          <span className="hidden md:flex" style={{ flex: '1 1 420px', minWidth: 0, maxWidth: 420 }}><CommandButton onOpen={() => setCommand(true)} /></span>
          <span className="flex-grow" />
          <span className="md:hidden"><CommandButton compact onOpen={() => setCommand(true)} /></span>
          <span className="hide-mobile"><Tag tone={health.data?.env === 'production' ? 'accent' : 'teal'}>Môi trường: {health.data?.env === 'production' ? 'Production' : (health.data?.env ?? '…')}</Tag></span>
          <Link to="/admin" className="btn btn-ghost btn-sm">Về Hội<span className="hide-mobile">&nbsp;của tôi</span></Link>
          <AccountAvatarLink user={user} />
        </header>
        {/* Điện thoại không có thanh bên: 5 nhóm thành một hàng chip. */}
        <nav className="admin-mobile-nav gap-1.5 overflow-x-auto px-4 py-2.5" aria-label="Nhóm quản trị" style={{ borderBottom: `1px solid ${T.line}`, background: T.surface }}>
          {GROUPS.map((g) => <Link key={g.key} to={g.tabs[0]!.to} aria-current={group.key === g.key ? 'page' : undefined} className={`chip flex-shrink-0${group.key === g.key ? ' on' : ''}`}>{g.label}{badge(g)}</Link>)}
        </nav>
        <div className="app-content flex-grow" style={{ padding: '28px 32px' }}>
          {group.tabs.length > 1 && (
            <nav className="section-tabs admin-tabs" aria-label={group.label}>
              {group.tabs.map((t) => <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'on' : '')}>{t.label}</NavLink>)}
            </nav>
          )}
          <Outlet />
        </div>
      </div>
      <CommandPalette open={command} onClose={() => setCommand(false)} commands={commands} extra={extra} placeholder="Gõ nơi muốn tới, tên hội hoặc email người dùng" />
    </div>
  );
}
