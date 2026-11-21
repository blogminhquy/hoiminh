// Khung ứng dụng hội. Máy tính: sidebar 264px, thu gọn được thành dải biểu tượng 72px (logo Hội Mình ở góc trên trái) + header 64px (tên hội đứng cạnh ô tìm,
// bấm vào để chuyển hội). Điện thoại: header có nút mở menu, tên hội và tìm kiếm; menu trượt ra từ bên trái
// (MobileDrawer) chứa đúng các mục của thanh bên và chỗ chuyển hội; thanh dưới 4 mục (Hôm nay, Học, Hội, Tôi) với nút
// viết bài ở giữa. Chủ hội và quản trị: mục đầu là "Bàn điều khiển" (điện thoại: "Quản lý"), menu có thêm nhóm
// Quản lý (Tiền, Affiliate, Cài đặt), và ô tìm ở đầu trang thành ô lệnh "Bạn muốn làm gì?" (Ctrl K).
import { Bell, BookOpen, Calendar, ChevronsUpDown, FileText, Handshake, House, Info, LayoutDashboard, Lock, LogIn, Menu, MessageCircle, Pencil, Plus, Search, Settings, Store, Sun, Trophy, User, Users, Wallet, X } from 'lucide-react';
import { CommunityMark, Logo, T } from '@hoiminh/ui';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AccountAvatarLink } from '@/components/AccountAvatarLink';
import { CommandButton, useCommandHotkey } from '@/components/CommandPalette';
import { InviteModal } from '@/components/InviteModal';
import { PushPrompt } from '@/components/PushPrompt';
import { LoadingBlock } from '@/components/QueryState';
import { ErrorBox } from '@hoiminh/ui';
import { api, errorMessage } from '@/lib/api';
import { preferredCommunitySlug, rememberCommunitySlug, useAuth, useBadges } from '@/lib/auth';
import { canManage, isGuest, JoinGateProvider, ShellProvider, useShellQuery, type Shell } from '@/lib/community';
import { guestCanOpen, guestHome, isSalePage } from '@/lib/guest';
import { movedSlugPath } from '@/lib/referral';
import { useSidebarCollapsed } from '@/lib/sidebar';
import { CommunitySwitcher } from './CommunitySwitcher';
import { GuestBanner, JoinPrompt, SaleGuestBanner } from './GuestBits';
import { SidebarToggle } from './SidebarToggle';
import { OwnerCommandPalette } from './OwnerCommand';
import { PublicHeader } from './PublicHeader';

/** `collapsed`: thanh bên đang thu gọn, chỉ còn biểu tượng; tên mục hiện khi rê chuột và vẫn đọc được bằng trình đọc màn hình. */
function NavItem({ to, icon, label, extra, end, collapsed }: { to: string; icon: ReactNode; label: string; extra?: ReactNode; end?: boolean; collapsed?: boolean }) {
  return (
    <NavLink to={to} end={end} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} className={({ isActive }) => `nav-item${isActive ? ' on' : ''}`}>
      {icon}
      <span className="nav-label flex-grow">{label}</span>
      {extra !== undefined && extra !== null && <span className="nav-extra inline-flex items-center">{extra}</span>}
    </NavLink>
  );
}

/**
 * Các mục điều hướng của hội và hai nút cuối. Dùng chung cho thanh bên (máy tính) và menu trượt (điện thoại).
 * Danh sách mục tự cuộn khi màn hình thấp, còn nút "Viết bài" luôn ghim ở đáy. `pinInvite`: ghim cả nút
 * "Mời thành viên" (máy tính); menu điện thoại để nút đó cuộn theo danh sách cho đỡ chiếm chỗ.
 */
function SidebarNav({ shell, onInvite, pinInvite, collapsed }: { shell: Shell; onInvite: () => void; pinInvite?: boolean; collapsed?: boolean }) {
  const s = shell.community.slug;
  const perms = shell.viewer.permissions;
  const manage = canManage(shell);
  const tabs = shell.community.tabs;
  // Khách xem hội mở: chỉ các mục xem được, mục đầu là trang giới thiệu, nút cuối là "Tham gia hội".
  const guest = isGuest(shell);
  const canPost = tabs.feed !== false && !guest;
  const invite = <button type="button" className="btn w-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.10)', color: T.invertInk }} title={collapsed ? 'Mời thành viên' : undefined} aria-label={collapsed ? 'Mời thành viên' : undefined} onClick={onInvite}><Plus size={18} /><span className="nav-label">Mời thành viên</span></button>;
  // Hội tắt Bảng tin thì không có nút Viết bài: nút Mời thành viên lên chỗ ghim.
  const inviteInFoot = pinInvite || !canPost;
  return (
    <>
      <div className="side-scroll flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="flex flex-col gap-0.5 pt-3">
        {guest ? <NavItem collapsed={collapsed} to={`/${s}`} end icon={<Info size={20} />} label="Giới thiệu hội" /> : manage ? <NavItem collapsed={collapsed} to={`/${s}/hom-nay`} icon={<LayoutDashboard size={20} />} label="Bàn điều khiển" /> : <NavItem collapsed={collapsed} to={`/${s}/hom-nay`} icon={<Sun size={20} />} label="Hôm nay" />}
      </div>
      <div className="nav-group">Hội</div>
      <div className="flex flex-col gap-0.5">
        {tabs.feed !== false && <NavItem collapsed={collapsed} to={`/${s}/bang-tin`} icon={<House size={20} />} label="Bảng tin" />}
        {tabs.events !== false && <NavItem collapsed={collapsed} to={`/${s}/su-kien`} icon={<Calendar size={20} />} label="Sự kiện" extra={shell.stats.upcomingEvents > 0 ? <span className="text-[11px] font-semibold rounded-full px-[7px]" style={{ background: T.accent, color: T.invertInk }}>{shell.stats.upcomingEvents}</span> : undefined} />}
        {tabs.members !== false && <NavItem collapsed={collapsed} to={`/${s}/thanh-vien`} icon={<Users size={20} />} label="Thành viên" />}
        {tabs.affiliate !== false && !guest && <NavItem collapsed={collapsed} to={`/${s}/xep-hang`} icon={<Trophy size={20} />} label="Xếp hạng affiliate" />}
      </div>
      {(tabs.courses !== false || tabs.store !== false) && (
        <>
          <div className="nav-group">Học</div>
          <div className="flex flex-col gap-0.5">
            {tabs.courses !== false && <NavItem collapsed={collapsed} to={`/${s}/khoa-hoc`} icon={<BookOpen size={20} />} label="Khóa học" extra={shell.coursePercent !== null ? <span className="text-[12px] font-semibold" style={{ color: T.sideText }}>{shell.coursePercent}%</span> : undefined} />}
            {tabs.resources && <NavItem collapsed={collapsed} to={`/${s}/khoa-hoc`} icon={<FileText size={20} />} label="Tài nguyên" extra={shell.viewer.tier?.key === 'standard' ? <Lock size={16} style={{ color: T.sideMuted }} /> : undefined} />}
            {tabs.store !== false && <NavItem collapsed={collapsed} to={`/${s}/cua-hang`} icon={<Store size={20} />} label="Cửa hàng" />}
          </div>
        </>
      )}
      {manage && (
        <>
          <div className="nav-group">Quản lý</div>
          <div className="flex flex-col gap-0.5">
            {(perms.includes('billing.manage') || perms.includes('revenue.read')) && <NavItem collapsed={collapsed} to={`/${s}/tien`} icon={<Wallet size={20} />} label="Tiền" />}
            {perms.includes('affiliates.manage') && <NavItem collapsed={collapsed} to={`/${s}/cong-su`} icon={<Handshake size={20} />} label="Affiliate" end />}
            {(perms.includes('settings.manage') || perms.includes('billing.manage')) && <NavItem collapsed={collapsed} to={`/${s}/cai-dat`} icon={<Settings size={20} />} label="Cài đặt" />}
          </div>
        </>
      )}
      {!inviteInFoot && !guest && <div className="pt-4 pb-1">{invite}</div>}
      </div>
      <div className="flex flex-col gap-2 pt-3 flex-shrink-0">
        {canPost && <Link to={`/${s}/bang-tin/moi`} className="btn btn-gold w-full" title={collapsed ? 'Viết bài' : undefined} aria-label={collapsed ? 'Viết bài' : undefined}><Pencil size={18} /><span className="nav-label">Viết bài</span></Link>}
        {guest ? <Link to={`/${s}`} className="btn btn-gold w-full" title={collapsed ? 'Tham gia hội' : undefined} aria-label={collapsed ? 'Tham gia hội' : undefined}><Plus size={18} /><span className="nav-label">Tham gia hội</span></Link> : inviteInFoot && invite}
      </div>
    </>
  );
}

function Sidebar({ shell, onInvite }: { shell: Shell; onInvite: () => void }) {
  const [collapsed, toggle] = useSidebarCollapsed();
  return (
    <aside className="app-sidebar flex flex-col flex-shrink-0 sticky top-0 h-screen" data-collapsed={collapsed ? 'true' : undefined} style={{ background: T.side, color: T.sideText, padding: '16px 12px' }}>
      {/* Cao 48px cộng lề trên 16px: đường kẻ dưới logo thẳng hàng với đáy header 64px. */}
      <div className="side-head flex items-center justify-between pl-2 flex-shrink-0" style={{ height: 48, borderBottom: '1px solid rgba(255,253,249,0.08)' }}>
        <Link to="/" className="side-logo" aria-label="Hội Mình, khám phá hội"><Logo size={26} light /></Link>
        <SidebarToggle collapsed={collapsed} onToggle={toggle} />
      </div>
      <SidebarNav shell={shell} onInvite={onInvite} pinInvite collapsed={collapsed} />
    </aside>
  );
}

/**
 * Menu của điện thoại: trượt ra từ bên trái, chứa đúng các mục của thanh bên. Đầu menu là hội đang mở; người có từ hai
 * hội (hoặc đang quản lý hội) chạm vào đó để chuyển hội. Đóng bằng nút X, chạm ra ngoài, Esc, hoặc khi chọn một mục.
 */
function MobileDrawer({ shell, onInvite, onClose }: { shell: Shell; onInvite: () => void; onClose: () => void }) {
  const { communities } = useAuth();
  const [switching, setSwitching] = useState(false);
  const canSwitch = communities.length > 1 || canManage(shell);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, []);
  const c = shell.community;
  const who = (
    <>
      <CommunityMark mark={c.logoMark} color={c.logoColor} url={c.logoUrl} size={40} radius={12} />
      <span className="flex-grow min-w-0">
        <span className="block font-semibold text-[15px] leading-snug" style={{ color: T.invertInk, overflowWrap: 'anywhere' }}>{c.name}</span>
        <span className="block text-[13px] whitespace-nowrap" style={{ color: T.sideMuted }}>{shell.stats.members} thành viên · {shell.stats.online} online</span>
      </span>
    </>
  );
  return (
    <div className="app-drawer-backdrop" onClick={onClose}>
      {/* Chọn một mục (mọi link trong menu) là đóng menu, kể cả khi mục đó là trang đang mở. */}
      <aside role="dialog" aria-modal="true" aria-label="Menu hội" className="app-drawer flex flex-col" style={{ background: T.side, color: T.sideText }} onClick={(e) => { e.stopPropagation(); if ((e.target as HTMLElement).closest('a')) onClose(); }}>
        <div className="flex items-center justify-between flex-shrink-0 pl-2" style={{ height: 48 }}>
          <Link to="/" aria-label="Hội Mình, khám phá hội"><Logo size={26} light /></Link>
          <button type="button" aria-label="Đóng menu" onClick={onClose} className="w-11 h-11 rounded-[10px] flex items-center justify-center" style={{ color: T.sideText }}><X size={22} /></button>
        </div>
        <div className="relative flex-shrink-0 mt-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {canSwitch ? (
            <button type="button" aria-haspopup="menu" aria-expanded={switching} aria-label={`${c.name}, chuyển hội`} onClick={() => setSwitching((v) => !v)} className="w-full flex items-center gap-2.5 text-left p-2.5 min-h-[60px]">
              {who}
              <ChevronsUpDown size={18} className="flex-shrink-0" style={{ color: T.sideMuted }} />
            </button>
          ) : (
            <div className="flex items-center gap-2.5 p-2.5 min-h-[60px]">{who}</div>
          )}
          {switching && <CommunitySwitcher current={c.slug} onClose={() => setSwitching(false)} />}
        </div>
        <SidebarNav shell={shell} onInvite={() => { onClose(); onInvite(); }} />
      </aside>
    </div>
  );
}

function Header({ shell, onCommand, onMenu }: { shell: Shell; onCommand: () => void; onMenu: () => void }) {
  const { user } = useAuth();
  const badges = useBadges();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [switching, setSwitching] = useState(false);
  const slug = shell.community.slug;
  const manage = canManage(shell);
  const location = useLocation();
  // Khách xem hội mở: tên hội dẫn về trang mở đầu của khách; chưa đăng nhập thì chỗ tin nhắn, thông báo là nút Đăng nhập.
  const home = isGuest(shell) ? guestHome(slug, shell.community.tabs) : `/${slug}/hom-nay`;
  const dot = (n?: number) => (n ? <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: T.accent }} /> : null);
  const submit = () => { navigate(`/${slug}/bang-tin?q=${encodeURIComponent(q)}`); setSearching(false); };
  const iconBtn = { color: T.ink2, border: `1px solid ${T.line2}`, background: T.surface } as const;
  return (
    <>
      <header className="app-header flex items-center gap-2 md:gap-4 px-4 md:px-8 flex-shrink-0" style={{ height: 64, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
        {/* Điện thoại: nút mở menu, rồi tên hội (tối đa hai dòng để hiện đủ chữ). Chuyển hội nằm trong menu. */}
        <button type="button" aria-label="Mở menu" aria-haspopup="dialog" onClick={onMenu} className="md:hidden w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0" style={iconBtn}><Menu size={22} /></button>
        <Link to={home} className="flex md:hidden items-center min-w-0 flex-1">
          <span className="font-bold text-[15px] leading-[1.25] line-clamp-2" style={{ color: T.ink, overflowWrap: 'anywhere' }}>{shell.community.name}</span>
        </Link>
        {/* Máy tính: logo và tên hội đứng đầu header, cạnh ô tìm, bấm vào để chuyển hội. */}
        <div className="relative min-w-0 hidden md:flex">
          {user ? (
            <button type="button" aria-haspopup="menu" aria-expanded={switching} aria-label={`${shell.community.name}, chuyển hội`} onClick={() => setSwitching((v) => !v)} className="flex items-center gap-2.5 min-w-0 text-left min-h-[44px]">
              <CommunityMark mark={shell.community.logoMark} color={shell.community.logoColor} url={shell.community.logoUrl} size={36} radius={10} />
              <span className="font-bold text-[17px] truncate" style={{ color: T.ink }}>{shell.community.name}</span>
              <ChevronsUpDown size={18} className="flex-shrink-0" style={{ color: T.ink3 }} />
            </button>
          ) : (
            <Link to={home} className="flex items-center gap-2.5 min-w-0 min-h-[44px]">
              <CommunityMark mark={shell.community.logoMark} color={shell.community.logoColor} url={shell.community.logoUrl} size={36} radius={10} />
              <span className="font-bold text-[17px] truncate" style={{ color: T.ink }}>{shell.community.name}</span>
            </Link>
          )}
          {user && switching && <CommunitySwitcher current={slug} onClose={() => setSwitching(false)} />}
        </div>
        {/* Người quản lý có ô lệnh (làm việc, đi tới, cài đặt, tìm); thành viên giữ ô tìm trong bảng tin. */}
        {/* Hệ số co 100: khi header hẹp, ô tìm co trước (tới 180px), tên hội giữ đủ chữ lâu nhất có thể rồi mới cắt. */}
        {manage ? (
          <span className="hidden md:flex md:ml-2" style={{ flex: '1 100 420px', minWidth: 180, maxWidth: 420 }}><CommandButton onOpen={onCommand} /></span>
        ) : (
          <form className="input search md:ml-2" style={{ flex: '1 100 420px', minWidth: 180, maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <Search size={18} style={{ color: T.ink3 }} />
            <input placeholder="Tìm trong bảng tin…" aria-label="Tìm trong bảng tin" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
        )}
        <span className="hidden md:block flex-grow" />
        <div className="flex items-center gap-2 flex-shrink-0">
          {manage
            ? <span className="md:hidden"><CommandButton compact onOpen={onCommand} /></span>
            : <button type="button" aria-label="Tìm kiếm" aria-expanded={searching} onClick={() => setSearching((v) => !v)} className="md:hidden relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={iconBtn}>{searching ? <X size={20} /> : <Search size={20} />}</button>}
          {user ? (
            <>
              <Link to="/tin-nhan" aria-label="Tin nhắn" className="relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={iconBtn}><MessageCircle size={20} />{dot(badges.data?.unreadMessages)}</Link>
              <Link to="/thong-bao" aria-label="Thông báo" className="relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={iconBtn}><Bell size={20} />{dot(badges.data?.unreadNotifications)}</Link>
              <span className="hide-mobile"><AccountAvatarLink user={user} /></span>
            </>
          ) : <span className="hide-mobile"><Link to={`/dang-nhap?next=${encodeURIComponent(location.pathname + location.search)}`} className="btn btn-ghost">Đăng nhập</Link></span>}
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

/** Đường dẫn đang mở thuộc nhóm nào trên thanh dưới. Trang tài khoản, tin nhắn, thông báo thuộc "Tôi". Tiền, Affiliate, Cài đặt thuộc mục đầu (Quản lý). */
export function mobileSection(pathname: string, slug: string): 'today' | 'learn' | 'community' | 'me' | null {
  const base = `/${slug}/`;
  if (!pathname.startsWith(base)) return /^\/(tai-khoan|tin-nhan|thong-bao|u\/|hoc)/.test(pathname) ? 'me' : null;
  const rest = pathname.slice(base.length);
  if (/^(hom-nay|tien|cong-su|cai-dat|doanh-thu)(\/|$)/.test(rest)) return 'today';
  if (/^(khoa-hoc|bai\/|cua-hang)/.test(rest)) return 'learn';
  if (/^(bang-tin|bai-viet|su-kien|thanh-vien|xep-hang)/.test(rest)) return 'community';
  return null;
}

/** Đang mở một hội thoại trên trang Tin nhắn: điện thoại ẩn thanh tab dưới để khung chat chiếm trọn màn hình. */
export function inOpenChat(pathname: string, search: string): boolean {
  return pathname.replace(/\/+$/, '') === '/tin-nhan' && new URLSearchParams(search).has('c');
}

function MobileTabs({ shell }: { shell: Shell }) {
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const guest = isGuest(shell);
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
      {guest ? item('about', `/${slug}`, <Info size={22} />, 'Giới thiệu') : canManage(shell) ? item('today', `/${slug}/hom-nay`, <LayoutDashboard size={22} />, 'Quản lý') : item('today', `/${slug}/hom-nay`, <Sun size={22} />, 'Hôm nay')}
      {(t.courses !== false || t.store !== false) && item('learn', learnTo, <BookOpen size={22} />, 'Học')}
      {/* Khách xem hội mở: nút giữa là "Tham gia hội" (về trang giới thiệu) thay cho nút viết bài. */}
      {guest ? <Link to={`/${slug}`} aria-label="Tham gia hội" className="mobile-tab-plus"><Plus size={26} /></Link> : t.feed !== false && <Link to={`/${slug}/bang-tin/moi`} aria-label="Viết bài mới" className="mobile-tab-plus"><Plus size={26} /></Link>}
      {item('community', communityTo, <Users size={22} />, 'Hội')}
      {user ? item('me', '/tai-khoan', <User size={22} />, 'Tôi') : item('login', `/dang-nhap?next=${encodeURIComponent(pathname + search)}`, <LogIn size={22} />, 'Đăng nhập')}
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
  const [command, setCommand] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [joinAsk, setJoinAsk] = useState(false);
  const guestMode = Boolean(params.slug && shell.data && isGuest(shell.data));
  const joinGate = useMemo(() => ({ guest: guestMode, askJoin: () => setJoinAsk(true) }), [guestMode]);
  const toggleCommand = useCallback(() => setCommand((v) => !v), []);
  useCommandHotkey(toggleCommand, Boolean(shell.data && canManage(shell.data)));
  useEffect(() => { if (params.slug && shell.data?.viewer.isMember) rememberCommunitySlug(shell.data.community.slug); }, [params.slug, shell.data]);
  const communityId = shell.data?.community.id;
  useEffect(() => { if (communityId && user) void api.post(`/v1/communities/${communityId}/touch`).catch(() => null); }, [user, communityId]);
  const toLogin = <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (loading) return <div className="p-8"><LoadingBlock /></div>;
  // Người chưa đăng nhập chỉ vào được trang trong hội khi hội đó mở (xét ở dưới, sau khi có khung hội). Mọi trường hợp khác về trang đăng nhập.
  if (!user && !params.slug) return toLogin;
  if (!slug) {
    // Trang trong hội thì phải có hội. Còn Tài khoản, Tin nhắn, Thông báo, hồ sơ người khác là của
    // riêng người dùng — người chưa vào hội nào (vừa đăng ký, hoặc quản trị hệ thống) vẫn phải mở được.
    if (requireMember) return <Navigate to="/" replace />;
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
  if (shell.isError) return user ? <div className="p-8"><ErrorBox message={errorMessage(shell.error)} onRetry={() => void shell.refetch()} /></div> : toLogin;
  const data = shell.data!;
  // Hội đã đổi đường dẫn: link cũ (thông báo, link đã lưu) chuyển sang đường dẫn mới, giữ nguyên trang đang mở.
  const moved = movedSlugPath(location, params.slug, data.community.slug);
  if (moved) return <Navigate to={moved} replace />;
  // Hội mở: người chưa là thành viên (kể cả chưa đăng nhập) vào xem được các trang chỉ đọc. Hội kín thì như cũ:
  // chưa đăng nhập về trang đăng nhập, đã đăng nhập mà chưa vào hội về trang giới thiệu.
  const guest = isGuest(data);
  const openGuest = guest && Boolean(params.slug) && data.community.visibility === 'public' && data.viewer.canView;
  // Trang bán của sản phẩm mở cho mọi người, kể cả ở hội kín và khi chưa đăng nhập: link sản phẩm (của affiliate, của
  // chủ hội đem đi quảng cáo) phải đưa người lạ tới đúng sản phẩm. Người ngoài của hội kín thấy trang bán trong khung
  // trang công khai, không có thanh bên của hội.
  const saleGuest = guest && !openGuest && Boolean(params.slug) && isSalePage(location.pathname, data.community.slug);
  if (!user && !openGuest && !saleGuest) return toLogin;
  if (requireMember && guest && params.slug) {
    if (!openGuest && !saleGuest) return <Navigate to={`/${slug}`} replace />;
    if (openGuest && !guestCanOpen(location.pathname, data.community.slug)) return <Navigate to={guestHome(data.community.slug, data.community.tabs)} replace />;
  }
  if (saleGuest) {
    return (
      <ShellProvider value={data}>
        <div className="min-h-screen flex flex-col" style={{ background: T.bg }}>
          <PublicHeader cta="join" />
          <div className="flex justify-center px-4 md:px-16 pt-6 pb-12">
            <div className="w-full" style={{ maxWidth: 1120 }}>
              <SaleGuestBanner shell={data} />
              <Outlet />
            </div>
          </div>
        </div>
      </ShellProvider>
    );
  }
  return (
    <ShellProvider value={data}>
    <JoinGateProvider value={joinGate}>
      <div className="flex min-h-screen" style={{ background: T.bg }}>
        <Sidebar shell={data} onInvite={() => setInvite(true)} />
        <div className="flex-grow flex flex-col min-w-0">
          <Header shell={data} onCommand={() => setCommand(true)} onMenu={() => setDrawer(true)} />
          <div className="app-content flex-grow" style={{ padding: '28px 32px' }}>
            {openGuest && <GuestBanner shell={data} />}
            <Outlet />
          </div>
        </div>
        {/* Trang bài học có nút hoàn thành ghim ở đáy (.lesson-bar), nên ẩn thanh tab để hai thanh không chồng nhau. */}
        {/* Đang mở một hội thoại (/tin-nhan?c=...) cũng ẩn, như Zalo: nhường chỗ cho ô nhập tin nhắn. */}
        {!/\/bai\/[^/]+$/.test(location.pathname) && !inOpenChat(location.pathname, location.search) && <MobileTabs shell={data} />}
        {drawer && <MobileDrawer shell={data} onInvite={() => setInvite(true)} onClose={() => setDrawer(false)} />}
        {canManage(data) && <OwnerCommandPalette shell={data} open={command} onClose={() => setCommand(false)} />}
        <InviteModal open={invite} onClose={() => setInvite(false)} communityId={data.community.id} slug={data.community.slug} canInvite={data.viewer.permissions.includes('member.manage')} />
        {user && <PushPrompt />}
        {openGuest && <JoinPrompt shell={data} open={joinAsk} onClose={() => setJoinAsk(false)} />}
      </div>
    </JoinGateProvider>
    </ShellProvider>
  );
}
