// Khung quản trị hệ thống (saShell trong build.mjs): sidebar #14110E, nhóm Vận hành / Cấu hình / Giám sát.
import { BadgeCheck, FileText, House, MessageCircle, Search, Settings, Trophy, User, Users, Wallet } from 'lucide-react';
import { Avatar, Logo, T, Tag } from '@hoiminh/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Ô tìm nhanh: Enter đưa tới danh sách Hội hoặc Người dùng kèm từ khóa (đoán theo có dấu @ hay không). */
function AdminSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const go = () => {
    const term = q.trim();
    if (!term) return;
    const to = term.includes('@') ? '/he-thong/nguoi-dung' : '/he-thong/hoi';
    navigate(`${to}?q=${encodeURIComponent(term)}`);
  };
  return (
    <form className="input search hide-mobile" style={{ width: 420 }} onSubmit={(e) => { e.preventDefault(); go(); }}>
      <Search size={18} style={{ color: T.ink3 }} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm hội, người dùng, giao dịch, email…" className="flex-grow min-w-0" />
    </form>
  );
}

function Item({ to, icon, label, extra, end }: { to: string; icon: ReactNode; label: string; extra?: ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' on' : ''}`}>{icon}<span className="flex-grow">{label}</span>{extra}</NavLink>
  );
}

export function AdminShell() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const health = useQuery({ queryKey: ['health'], queryFn: () => fetch(`${api.url}/health`).then((r) => r.json() as Promise<{ status: string; env: string }>), staleTime: 60_000 });
  const todo = useQuery({ queryKey: ['admin', 'overview', 30], queryFn: () => api.get<{ todo: { unmatched: number } }>('/v1/admin/overview?days=30'), enabled: Boolean(user?.isSuperAdmin), staleTime: 60_000 });
  if (!user && !loading) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (loading) return <div className="p-8"><LoadingBlock /></div>;
  if (!user?.isSuperAdmin) return <Navigate to="/admin" replace />;
  const unmatched = todo.data?.todo.unmatched ?? 0;
  return (
    <div className="flex min-h-screen" style={{ background: T.bg }}>
      <aside className="app-sidebar flex flex-col flex-shrink-0 sticky top-0 h-screen" style={{ width: 264, background: '#14110E', color: T.sideText, padding: '16px 12px' }}>
        <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-3.5" style={{ borderBottom: '1px solid rgba(255,253,249,0.08)' }}>
          <svg width="36" height="36" viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="9" cy="13" r="7" fill={T.accent} /><circle cx="17" cy="13" r="7" fill={T.teal} fillOpacity="0.85" /></svg>
          <div className="flex-grow"><div className="serif font-bold text-[14px]" style={{ color: T.invertInk }}>Hội Mình</div><div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}>Quản trị hệ thống</div></div>
        </div>
        <div className="nav-group">Vận hành</div>
        <div className="flex flex-col gap-0.5">
          <Item to="/he-thong" end icon={<House size={20} />} label="Tổng quan" />
          <Item to="/he-thong/hoi" icon={<Users size={20} />} label="Hội" />
          <Item to="/he-thong/nguoi-dung" icon={<User size={20} />} label="Người dùng" />
          <Item to="/he-thong/thanh-toan" icon={<Wallet size={20} />} label="Thanh toán" extra={unmatched ? <span className="text-[11px] font-semibold rounded-full px-[7px]" style={{ background: T.accent, color: T.invertInk }}>{unmatched}</span> : undefined} />
        </div>
        <div className="nav-group">Cấu hình</div>
        <div className="flex flex-col gap-0.5">
          <Item to="/he-thong/goi" icon={<BadgeCheck size={20} />} label="Gói nền tảng" />
          <Item to="/he-thong/cong-su" icon={<Trophy size={20} />} label="Cộng sự nền tảng" />
          <Item to="/he-thong/tinh-nang" icon={<Settings size={20} />} label="Tính năng và giới hạn" />
        </div>
        <div className="nav-group">Giám sát</div>
        <div className="flex flex-col gap-0.5">
          <Item to="/he-thong/nhat-ky" icon={<FileText size={20} />} label="Nhật ký và webhook" />
          <Item to="/he-thong/ho-tro" icon={<MessageCircle size={20} />} label="Hỗ trợ và khiếu nại" />
        </div>
        <div className="flex-grow" />
        <div className="p-3 rounded-[10px] text-[12px] flex items-center gap-2" style={{ background: 'rgba(255,253,249,0.06)', color: T.sideText }}>
          <span className="w-2 h-2 rounded-full" style={{ background: health.data?.status === 'ok' ? T.teal : T.accent }} />
          {health.data?.status === 'ok' ? 'Hệ thống ổn định' : health.isLoading ? 'Đang kiểm tra…' : 'Cần kiểm tra API'}
        </div>
      </aside>
      <div className="flex-grow flex flex-col min-w-0">
        <header className="flex items-center gap-4 px-4 md:px-8" style={{ height: 64, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
          <span className="only-mobile"><Logo size={22} /></span>
          <AdminSearch />
          <span className="flex-grow" />
          <Tag tone={health.data?.env === 'production' ? 'accent' : 'teal'}>Môi trường: {health.data?.env === 'production' ? 'Production' : (health.data?.env ?? '…')}</Tag>
          <Link to="/admin" className="btn btn-ghost btn-sm">Về Hội của tôi</Link>
          <Avatar name={user.name} src={user.avatarUrl} color={T.ink} size={40} />
        </header>
        <div className="app-content flex-grow" style={{ padding: '28px 32px' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
