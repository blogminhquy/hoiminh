// Trang "Tôi" (/tai-khoan). Điện thoại: một danh sách mục lớn dễ chạm thay cho hàng tab vuốt ngang,
// kèm chọn giao diện và nút Đăng xuất. Máy tính: giữ bố cục cũ, vào thẳng Gói và thanh toán.
import { Avatar, T } from '@hoiminh/ui';
import { Bell, ChevronRight, GraduationCap, Handshake, LogOut, MessageCircle, Receipt, Settings, UserRound, UsersRound, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, useBadges } from '@/lib/auth';
import { useOptionalShell } from '@/lib/community';
import { ThemeChoices } from './AccountLayout';

/** Bề rộng từ đó khung Tài khoản hiện nav bên trái (khớp điểm gãy 900px trong styles.css). */
const WIDE = '(min-width: 901px)';

function Row({ to, icon, label, hint, badge }: { to: string; icon: ReactNode; label: string; hint?: string; badge?: number }) {
  return (
    <Link to={to} className="me-row">
      <span className="ic">{icon}</span>
      <span className="flex-grow min-w-0"><span className="block">{label}</span>{hint && <span className="block muted text-[14px] font-normal truncate">{hint}</span>}</span>
      {badge ? <span className="text-[14px] font-bold rounded-full px-2 min-w-[26px] text-center" style={{ background: T.accent, color: T.invertInk }}>{badge}</span> : null}
      <ChevronRight size={20} style={{ color: T.ink3 }} />
    </Link>
  );
}

export default function Page() {
  const { user, communities, logout } = useAuth();
  const badges = useBadges();
  const navigate = useNavigate();
  // Người có quyền quản trị hội đang mở: lối vào Cài đặt và Doanh thu (trên điện thoại không có thanh bên).
  const shell = useOptionalShell();
  const perms = shell?.viewer.permissions ?? [];
  const canSettings = perms.includes('settings.manage');
  const canRevenue = perms.includes('revenue.read');
  if (typeof window !== 'undefined' && window.matchMedia(WIDE).matches) return <Navigate to="/tai-khoan/goi" replace />;
  const owns = communities.some((c) => c.role === 'owner');
  return (
    <div className="flex flex-col gap-4">
      <Link to={user?.handle ? `/u/${user.handle}` : '/tai-khoan/ho-so'} className="card p-4 flex items-center gap-3.5" style={{ color: T.ink }}>
        <Avatar name={user?.name} src={user?.avatarUrl} color={T.side} size={56} />
        <span className="flex-grow min-w-0"><span className="block serif font-extrabold text-[20px] truncate">{user?.name}</span><span className="block muted text-[14px] truncate">{user?.handle ? `@${user.handle} · ` : ''}Xem trang cá nhân</span></span>
        <ChevronRight size={20} style={{ color: T.ink3 }} />
      </Link>

      {shell && (canSettings || canRevenue) && (
        <nav className="card px-3 py-1 me-list" aria-label={`Quản lý ${shell.community.name}`}>
          {canSettings && <Row to={`/${shell.community.slug}/cai-dat`} icon={<Settings size={20} />} label="Cài đặt hội" hint={shell.community.name} />}
          {canRevenue && <Row to={`/${shell.community.slug}/doanh-thu`} icon={<Wallet size={20} />} label="Doanh thu" hint="Giao dịch, hoàn tiền" />}
        </nav>
      )}

      <nav className="card px-3 py-1 me-list" aria-label="Tôi">
        <Row to="/tai-khoan/ho-so" icon={<UserRound size={20} />} label="Hồ sơ và tài khoản" hint="Tên, ảnh, mật khẩu, xác thực hai lớp" />
        <Row to="/thong-bao" icon={<Bell size={20} />} label="Thông báo" badge={badges.data?.unreadNotifications} />
        <Row to="/tin-nhan" icon={<MessageCircle size={20} />} label="Tin nhắn" badge={badges.data?.unreadMessages} />
        <Row to="/hoc" icon={<GraduationCap size={20} />} label="Khóa và tài liệu đã mua" />
        <Row to="/tai-khoan/cong-su" icon={<Handshake size={20} />} label="Cộng sự" hint="Link giới thiệu, hoa hồng, rút tiền" />
        <Row to="/tai-khoan/goi" icon={<Receipt size={20} />} label="Gói và thanh toán" hint="Gói đang dùng, hóa đơn" />
        <Row to="/admin" icon={<UsersRound size={20} />} label={owns ? 'Hội tôi quản lý' : 'Hội của tôi'} hint={`${communities.length} hội`} />
      </nav>

      <div className="card p-4 flex flex-col gap-2.5">
        <span className="font-semibold text-[16px]">Giao diện</span>
        <ThemeChoices />
      </div>

      <button type="button" className="card me-row px-4" style={{ color: T.accentText }} onClick={() => { void logout().then(() => navigate('/dang-nhap')); }}>
        <span className="ic" style={{ background: T.accentSoft, color: T.accentText }}><LogOut size={20} /></span>
        <span className="flex-grow">Đăng xuất</span>
      </button>
    </div>
  );
}
