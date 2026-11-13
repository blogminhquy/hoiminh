// Header trang công khai (trang chủ Khám phá, Giới thiệu hội): logo, Khám phá (đều về trang chủ "/"), Dành cho chủ hội, Đăng nhập / Tạo hội.
import { Logo, T } from '@hoiminh/ui';
import { Link, NavLink } from 'react-router-dom';
import { AccountAvatarLink } from '@/components/AccountAvatarLink';
import { useAuth } from '@/lib/auth';

export function PublicHeader({ cta }: { cta?: 'join' | 'create' }) {
  const { user } = useAuth();
  return (
    <header className="flex items-center gap-3 md:gap-6 px-4 md:px-16" style={{ height: 72, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
      <Link to="/" aria-label="Hội Mình" className="flex-shrink-0"><Logo size={28} markOnlyOnMobile /></Link>
      <nav className="hidden md:flex gap-6 font-medium" style={{ color: T.ink2 }}>
        <NavLink to="/" end style={({ isActive }) => ({ color: isActive ? T.ink : T.ink2 })}>Khám phá</NavLink>
        <Link to="/tao-hoi/goi">Bảng giá</Link>
        <Link to="/tao-hoi">Dành cho chủ hội</Link>
        {!user && <Link to="/dang-nhap">Đăng nhập</Link>}
      </nav>
      <span className="flex-grow" />
      {cta === 'join' && !user && <Link to="/dang-nhap" className="btn btn-ghost">Đăng nhập</Link>}
      {cta !== 'join' && <Link to="/tao-hoi" className="btn btn-primary">Tạo hội của bạn</Link>}
      {user ? <AccountAvatarLink user={user} /> : cta === 'join' ? <Link to="/dang-ky" className="btn btn-primary">Tham gia hội</Link> : null}
    </header>
  );
}
