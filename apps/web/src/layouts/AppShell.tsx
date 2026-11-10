// Khung ứng dụng hội. Máy tính: sidebar 264px + header 64px. Điện thoại: header gọn có tìm kiếm, thanh dưới 4 mục
// (Hôm nay, Học, Hội, Tôi) với nút viết bài ở giữa, và hàng tab con cho nhóm Hội (Bảng tin, Sự kiện, Thành viên,
// Xếp hạng) và nhóm Học (Khóa học, Cửa hàng).
import { Bell, BookOpen, Calendar, ChevronDown, FileText, House, Lock, MessageCircle, Pencil, Plus, Search, Settings, Store, Sun, Trophy, User, Users, Wallet, X } from 'lucide-react';
import { CommunityMark, Logo, T } from '@hoiminh/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AccountAvatarLink } from '@/components/AccountAvatarLink';
import { InviteModal } from '@/components/InviteModal';
import { LoadingBlock } from '@/components/QueryState';
import { ErrorBox } from '@hoiminh/ui';
import { api, errorMessage } from '@/lib/api';
import { preferredCommunitySlug, rememberCommunitySlug, useAuth, useBadges } from '@/lib/auth';
import { ShellProvider, useShellQuery, type Shell } from '@/lib/community';
import { CommunitySwitcher } from './CommunitySwitcher';
import { PublicHeader } from './PublicHeader';

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
            <span className="block font-semibold text-[14px] truncate" style={{ color: T.invertInk }}>{shell.community.name}</span>
            <span className="block text-[12px]" style={{ color: T.sideMuted }}>{shell.stats.members} thành viên · {shell.stats.online} đang online</span>
          </span>
          <ChevronDown size={18} style={{ color: T.sideMuted }} />
        </button>
        {switching && <CommunitySwitcher current={s} onClose={() => setSwitching(false)} />}
      </div>
      <div className="flex flex-col gap-0.5 pt-3">
        <NavItem to={`/${s}/hom-nay`} icon={<Sun size={20} />} label="Hôm nay" />
      </div>
      <div className="nav-group">Hội</div>
      <div className="flex flex-col gap-0.5">
        {tabs.feed !== false && <NavItem to={`/${s}/bang-tin`} icon={<House size={20} />} label="Bảng tin" />}
        {tabs.events !== false && <NavItem to={`/${s}/su-kien`} icon={<Calendar size={20} />} label="Sự kiện" extra={shell.stats.upcomingEvents > 0 ? <span className="text-[11px] font-semibold rounded-full px-[7px]" style={{ background: T.accent, color: T.invertInk }}>{shell.stats.upcomingEvents}</span> : undefined} />}
        {tabs.members !== false && <NavItem to={`/${s}/thanh-vien`} icon={<Users size={20} />} label="Thành viên" />}
        {tabs.affiliate !== false && <NavItem to={`/${s}/xep-hang`} icon={<Trophy size={20} />} label="Xếp hạng cộng sự" />}
      </div>
      {(tabs.courses !== false || tabs.store !== false) && (
        <>
          <div className="nav-group">Học</div>
          <div className="flex flex-col gap-0.5">
            {tabs.courses !== false && <NavItem to={`/${s}/khoa-hoc`} icon={<BookOpen size={20} />} label="Khóa học" extra={shell.coursePercent !== null ? <span className="text-[12px] font-semibold" style={{ color: T.sideText }}>{shell.coursePercent}%</span> : undefined} />}
            {tabs.resources && <NavItem to={`/${s}/khoa-hoc`} icon={<FileText size={20} />} label="Tài nguyên" extra={shell.viewer.tier?.key === 'standard' ? <Lock size={16} style={{ color: T.sideMuted }} /> : undefined} />}
            {tabs.store !== false && <NavItem to={`/${s}/cua-hang`} icon={<Store size={20} />} label="Cửa hàng" />}
          </div>
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
      <div className="flex flex-col gap-2">
        {tabs.feed !== false && <Link to={`/${s}/bang-tin/moi`} className="btn btn-gold w-full"><Pencil size={18} />Viết bài</Link>}
        <button type="button" className="btn w-full" style={{ background: 'rgba(255,255,255,0.10)', color: T.invertInk }} onClick={onInvite}><Plus size={18} />Mời thành viên</button>
      </div>
    </aside>
  );
}

function Header({ shell }: { shell: Shell }) {
  const { user } = useAuth();
  const badges = useBadges();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const slug = shell.community.slug;
  const dot = (n?: number) => (n ? <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: T.accent }} /> : null);
  const submit = () => { navigate(`/${slug}/bang-tin?q=${encodeURIComponent(q)}`); setSearching(false); };
  const iconBtn = { color: T.ink2, border: `1px solid ${T.line2}`, background: T.surface } as const;
  return (
    <>
      <header className="app-header flex items-center gap-2 md:gap-4 px-4 md:px-8 flex-shrink-0" style={{ height: 64, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
        <Link to="/kham-pha" className="hide-mobile"><Logo size={26} /></Link>
        <Link to={`/${slug}/hom-nay`} className="flex md:hidden items-center gap-2 min-w-0 flex-1">
          <CommunityMark mark={shell.community.logoMark} color={shell.community.logoColor} url={shell.community.logoUrl} size={32} />
          <span className="font-semibold text-[14px] truncate" style={{ color: T.ink }}>{shell.community.name}</span>
        </Link>
        <form className="input search ml-6" style={{ flex: '1 1 420px', minWidth: 0, maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Search size={18} style={{ color: T.ink3 }} />
          <input placeholder="Tìm trong bảng tin…" aria-label="Tìm trong bảng tin" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <span className="hidden md:block flex-grow" />
        <div className="flex items-center gap-2 flex-shrink-0">
          <button type="button" aria-label="Tìm kiếm" aria-expanded={searching} onClick={() => setSearching((v) => !v)} className="md:hidden relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={iconBtn}>{searching ? <X size={20} /> : <Search size={20} />}</button>
          <Link to="/tin-nhan" aria-label="Tin nhắn" className="relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={iconBtn}><MessageCircle size={20} />{dot(badges.data?.unreadMessages)}</Link>
          <Link to="/thong-bao" aria-label="Thông báo" className="relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={iconBtn}><Bell size={20} />{dot(badges.data?.unreadNotifications)}</Link>
          <span className="hide-mobile"><AccountAvatarLink user={user} /></span>
        </div>
      </header>
      {searching && (
        <form className="md:hidden px-4 py-2.5" style={{ background: T.surface, borderBottom: `1px solid ${T.line}` }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="input"><Search size={18} style={{ color: T.ink3 }} />
            <input autoFocus type="search" enterKeyHint="search" placeholder="Tìm trong bảng tin…" aria-label="Tìm trong bảng tin" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </form>
      )}
    </>
  );
}

/** Đường dẫn đang mở thuộc nhóm nào trên thanh dưới. Trang tài khoản, tin nhắn, thông báo thuộc "Tôi". */
export function mobileSection(pathname: string, slug: string): 'today' | 'learn' | 'community' | 'me' | null {
  const base = `/${slug}/`;
  if (!pathname.startsWith(base)) return /^\/(tai-khoan|tin-nhan|thong-bao|u\/|hoc)/.test(pathname) ? 'me' : null;
  const rest = pathname.slice(base.length);
  if (rest.startsWith('hom-nay')) return 'today';
  if (/^(khoa-hoc|bai\/|cua-hang)/.test(rest)) return 'learn';
  if (/^(bang-tin|bai-viet|su-kien|thanh-vien|xep-hang)/.test(rest)) return 'community';
  return null;
}

/** Hàng tab con trên điện thoại: chỉ hiện ở các trang danh sách của nhóm Hội và nhóm Học. */
function MobileSectionTabs({ shell }: { shell: Shell }) {
  const { pathname } = useLocation();
  const s = shell.community.slug;
  const tabs = shell.community.tabs;
  const groups: Array<Array<[string, string, boolean]>> = [
    [[`/${s}/bang-tin`, 'Bảng tin', tabs.feed !== false], [`/${s}/su-kien`, 'Sự kiện', tabs.events !== false], [`/${s}/thanh-vien`, 'Thành viên', tabs.members !== false], [`/${s}/xep-hang`, 'Xếp hạng', tabs.affiliate !== false]],
    [[`/${s}/khoa-hoc`, 'Khóa học', tabs.courses !== false], [`/${s}/cua-hang`, 'Cửa hàng', tabs.store !== false]],
  ];
  const group = groups.find((g) => g.some(([to]) => pathname === to || pathname === `${to}/moi`))?.filter(([, , on]) => on);
  if (!group || group.length < 2) return null;
  return (
    <nav className="md:hidden section-tabs" aria-label="Mục con">
      {group.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'on' : '')}>{label}</NavLink>)}
    </nav>
  );
}

function MobileTabs({ shell }: { shell: Shell }) {
  const { pathname } = useLocation();
  const slug = shell.community.slug;
  const t = shell.community.tabs;
  const active = mobileSection(pathname, slug);
  const learnTo = t.courses !== false ? `/${slug}/khoa-hoc` : `/${slug}/cua-hang`;
  const communityTo = t.feed !== false ? `/${slug}/bang-tin` : t.events !== false ? `/${slug}/su-kien` : `/${slug}/thanh-vien`;
  const item = (key: string, to: string, icon: ReactNode, label: string) => (
    <Link key={key} to={to} aria-current={active === key ? 'page' : undefined} className={`mobile-tab${active === key ? ' on' : ''}`}>{icon}{label}</Link>
  );
  return (
    <nav className="mobile-tabs" aria-label="Điều hướng chính">
      {item('today', `/${slug}/hom-nay`, <Sun size={22} />, 'Hôm nay')}
      {(t.courses !== false || t.store !== false) && item('learn', learnTo, <BookOpen size={22} />, 'Học')}
      {t.feed !== false && <Link to={`/${slug}/bang-tin/moi`} aria-label="Viết bài mới" className="mobile-tab-plus"><Plus size={26} /></Link>}
      {item('community', communityTo, <Users size={22} />, 'Hội')}
      {item('me', '/tai-khoan', <User size={22} />, 'Tôi')}
    </nav>
  );
}

/** Khung hội: đọc slug từ route (/:slug/...) hoặc dùng hội hiện tại cho các trang tài khoản. */
export function AppShell({ requireMember = true }: { requireMember?: boolean }) {
  const params = useParams();
  const { user, communities, loading } = useAuth();
  const location = useLocation();
  const slug = params.slug ?? preferredCommunitySlug(communities);
  const shell = useShellQuery(slug);
  const [invite, setInvite] = useState(false);
  useEffect(() => { if (params.slug && shell.data?.viewer.isMember) rememberCommunitySlug(params.slug); }, [params.slug, shell.data]);
  const communityId = shell.data?.community.id;
  useEffect(() => { if (communityId && user) void api.post(`/v1/communities/${communityId}/touch`).catch(() => null); }, [user, communityId]);
  if (!user && !loading) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (loading) return <div className="p-8"><LoadingBlock /></div>;
  if (!slug) {
    // Trang trong hội thì phải có hội. Còn Tài khoản, Tin nhắn, Thông báo, hồ sơ người khác là của
    // riêng người dùng — người chưa vào hội nào (vừa đăng ký, hoặc quản trị hệ thống) vẫn phải mở được.
    if (requireMember) return <Navigate to="/kham-pha" replace />;
    return (
      <div className="flex flex-col min-h-screen" style={{ background: T.bg }}>
        <PublicHeader />
        <div className="app-content flex-grow" style={{ padding: '28px 32px' }}>
          <Outlet />
        </div>
      </div>
    );
  }
  if (shell.isLoading) return <div className="p-8"><LoadingBlock /></div>;
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
            <MobileSectionTabs shell={data} />
            <Outlet />
          </div>
        </div>
        {/* Trang bài học có nút hoàn thành ghim ở đáy (.lesson-bar), nên ẩn thanh tab để hai thanh không chồng nhau. */}
        {!/\/bai\/[^/]+$/.test(location.pathname) && <MobileTabs shell={data} />}
        <InviteModal open={invite} onClose={() => setInvite(false)} communityId={data.community.id} slug={data.community.slug} canInvite={data.viewer.permissions.includes('member.manage')} />
      </div>
    </ShellProvider>
  );
}
