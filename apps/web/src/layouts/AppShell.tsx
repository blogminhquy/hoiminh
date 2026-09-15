// Khung ứng dụng hội (desktop 264px sidebar + header 64px; mobile: header tối + 5 tab dưới). Khớp shell() trong design/build.mjs.
import { Bell, BookOpen, Calendar, ChevronDown, FileText, House, Lock, MessageCircle, Plus, Search, Settings, Store, Trophy, User, Users, Wallet } from 'lucide-react';
import { Avatar, Button, CommunityMark, Logo, T } from '@hoiminh/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { InviteModal } from '@/components/InviteModal';
import { LoadingBlock } from '@/components/QueryState';
import { ErrorBox } from '@hoiminh/ui';
import { errorMessage } from '@/lib/api';
import { currentCommunitySlug, rememberCommunitySlug, useAuth, useBadges } from '@/lib/auth';
import { ShellProvider, useShellQuery, type Shell } from '@/lib/community';
import { CommunitySwitcher } from './CommunitySwitcher';

function NavItem({ to, icon, label, extra, end }: { to: string; icon: ReactNode; label: string; extra?: ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' on' : ''}`}>
      {icon}
      <span className="flex-grow">{label}</span>
      {extra}
    </NavLink>
  );
}

function Sidebar({ shell, onInvite }: { shell: Shell; onInvite: () => void }) {
  const s = shell.community.slug;
  const manage = shell.viewer.permissions.includes('settings.manage') || shell.viewer.permissions.includes('revenue.read');
  const [switching, setSwitching] = useState(false);
  const tabs = shell.community.tabs;
  return (
    <aside className="app-sidebar flex flex-col flex-shrink-0 sticky top-0 h-screen" style={{ width: 264, background: T.side, color: T.sideText, padding: '16px 12px' }}>
      <div className="relative">
        <button type="button" onClick={() => setSwitching((v) => !v)} className="w-full flex items-center gap-2.5 text-left px-2 pt-1.5 pb-3.5" style={{ borderBottom: '1px solid rgba(255,253,249,0.08)' }}>
          <CommunityMark mark={shell.community.logoMark} color={shell.community.logoColor} url={shell.community.logoUrl} size={40} radius={12} />
          <span className="flex-grow min-w-0">
            <span className="block font-semibold text-[14px] truncate" style={{ color: T.surface }}>{shell.community.name}</span>
            <span className="block text-[12px]" style={{ color: T.sideMuted }}>{shell.stats.members} thành viên · {shell.stats.online} đang online</span>
          </span>
          <ChevronDown size={18} style={{ color: T.sideMuted }} />
        </button>
        {switching && <CommunitySwitcher current={s} onClose={() => setSwitching(false)} />}
      </div>
      <div className="nav-group">Cộng đồng</div>
      <div className="flex flex-col gap-0.5">
        {tabs.feed !== false && <NavItem to={`/${s}/bang-tin`} icon={<House size={20} />} label="Bảng tin" />}
        {tabs.members !== false && <NavItem to={`/${s}/thanh-vien`} icon={<Users size={20} />} label="Thành viên" />}
        {tabs.events !== false && <NavItem to={`/${s}/su-kien`} icon={<Calendar size={20} />} label="Sự kiện" extra={shell.stats.upcomingEvents > 0 ? <span className="text-[11px] font-semibold rounded-full px-[7px]" style={{ background: T.accent, color: T.surface }}>{shell.stats.upcomingEvents}</span> : undefined} />}
        {tabs.affiliate !== false && <NavItem to={`/${s}/xep-hang`} icon={<Trophy size={20} />} label="Xếp hạng cộng sự" />}
      </div>
      <div className="nav-group">Học tập</div>
      <div className="flex flex-col gap-0.5">
        {tabs.courses !== false && <NavItem to={`/${s}/khoa-hoc`} icon={<BookOpen size={20} />} label="Khóa học" extra={shell.coursePercent !== null ? <span className="text-[12px] font-semibold" style={{ color: T.teal }}>{shell.coursePercent}%</span> : undefined} />}
        {tabs.resources && <NavItem to={`/${s}/khoa-hoc?tab=tai-nguyen`} icon={<FileText size={20} />} label="Tài nguyên" extra={shell.viewer.tier?.key === 'standard' ? <Lock size={16} style={{ color: T.sideMuted }} /> : undefined} />}
      </div>
      {tabs.store !== false && (
        <>
          <div className="nav-group">Mua sắm</div>
          <div className="flex flex-col gap-0.5"><NavItem to={`/${s}/cua-hang`} icon={<Store size={20} />} label="Cửa hàng" /></div>
        </>
      )}
      {manage && (
        <>
          <div className="nav-group">Quản trị</div>
          <div className="flex flex-col gap-0.5">
            <NavItem to={`/${s}/cai-dat`} icon={<Settings size={20} />} label="Cài đặt" />
            <NavItem to={`/${s}/doanh-thu`} icon={<Wallet size={20} />} label="Doanh thu" />
          </div>
        </>
      )}
      <div className="flex-grow" />
      <Button variant="primary" block icon={<Plus size={18} />} onClick={onInvite}>Mời thành viên</Button>
    </aside>
  );
}

function Header({ shell }: { shell: Shell }) {
  const { user } = useAuth();
  const badges = useBadges();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const dot = (n?: number) => (n ? <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: T.accent }} /> : null);
  return (
    <header className="app-header flex items-center gap-4 px-4 md:px-8 flex-shrink-0" style={{ height: 64, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
      <Link to="/kham-pha" className="hide-mobile"><Logo size={26} /></Link>
      <Link to={`/${shell.community.slug}/bang-tin`} className="only-mobile inline-flex items-center gap-2 min-w-0">
        <CommunityMark mark={shell.community.logoMark} color={shell.community.logoColor} url={shell.community.logoUrl} size={32} />
        <span className="font-semibold text-[14px] truncate" style={{ color: T.ink }}>{shell.community.name}</span>
      </Link>
      <form className="input search ml-6" style={{ width: 420 }} onSubmit={(e) => { e.preventDefault(); navigate(`/${shell.community.slug}/bang-tin?q=${encodeURIComponent(q)}`); }}>
        <Search size={18} style={{ color: T.ink3 }} />
        <input placeholder="Tìm bài viết, khóa học, thành viên…" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <span className="flex-grow" />
      <div className="flex items-center gap-2">
        <Link to="/tin-nhan" aria-label="Tin nhắn" className="relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ color: T.ink2, border: `1px solid ${T.line2}`, background: T.surface }}><MessageCircle size={20} />{dot(badges.data?.unreadMessages)}</Link>
        <Link to="/thong-bao" aria-label="Thông báo" className="relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ color: T.ink2, border: `1px solid ${T.line2}`, background: T.surface }}><Bell size={20} />{dot(badges.data?.unreadNotifications)}</Link>
        <Link to="/tai-khoan/goi" aria-label="Tài khoản"><Avatar name={user?.name} src={user?.avatarUrl} color={T.ink} size={40} /></Link>
      </div>
    </header>
  );
}

function MobileTabs({ slug }: { slug: string }) {
  const items = [[`/${slug}/bang-tin`, <House size={22} key="h" />, 'Bảng tin'], [`/${slug}/khoa-hoc`, <BookOpen size={22} key="b" />, 'Khóa học'], [`/${slug}/cua-hang`, <Store size={22} key="s" />, 'Cửa hàng'], ['/tin-nhan', <MessageCircle size={22} key="m" />, 'Tin nhắn'], ['/tai-khoan/goi', <User size={22} key="u" />, 'Tôi']] as const;
  return (
    <nav className="mobile-tabs">
      {items.map(([to, icon, label]) => (
        <NavLink key={to} to={to} className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold" style={({ isActive }) => ({ color: isActive ? T.accent : T.ink3 })}>{icon}{label}</NavLink>
      ))}
    </nav>
  );
}

/** Khung hội: đọc slug từ route (/:slug/...) hoặc dùng hội hiện tại cho các trang tài khoản. */
export function AppShell({ requireMember = true }: { requireMember?: boolean }) {
  const params = useParams();
  const { user, communities, loading } = useAuth();
  const location = useLocation();
  const slug = params.slug ?? currentCommunitySlug(communities[0]?.slug ?? null);
  const shell = useShellQuery(slug);
  const [invite, setInvite] = useState(false);
  useEffect(() => { if (params.slug && shell.data?.viewer.isMember) rememberCommunitySlug(params.slug); }, [params.slug, shell.data]);
  useEffect(() => { if (slug && user) void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8787'}/v1/communities/${shell.data?.community.id}/touch`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('hm_access') ?? ''}` } }).catch(() => null); }, [slug, user, shell.data?.community.id]);
  if (!user && !loading) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (!slug) return <Navigate to="/kham-pha" replace />;
  if (shell.isLoading || loading) return <div className="p-8"><LoadingBlock /></div>;
  if (shell.isError) return <div className="p-8"><ErrorBox message={errorMessage(shell.error)} onRetry={() => void shell.refetch()} /></div>;
  const data = shell.data!;
  if (requireMember && !data.viewer.isMember && params.slug) return <Navigate to={`/${slug}`} replace />;
  return (
    <ShellProvider value={data}>
      <div className="flex min-h-screen" style={{ background: T.bg }}>
        <Sidebar shell={data} onInvite={() => setInvite(true)} />
        <div className="flex-grow flex flex-col min-w-0">
          <Header shell={data} />
          <div className="app-content flex-grow" style={{ padding: '28px 32px' }}>
            <Outlet />
          </div>
        </div>
        <MobileTabs slug={data.community.slug} />
        <InviteModal open={invite} onClose={() => setInvite(false)} communityId={data.community.id} slug={data.community.slug} canInvite={data.viewer.permissions.includes('member.manage')} />
      </div>
    </ShellProvider>
  );
}
