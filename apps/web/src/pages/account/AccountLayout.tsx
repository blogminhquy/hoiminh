// Khung Tài khoản (accountNav trong build.mjs): nav 220px 8 mục bên trái, nội dung trang con bên phải.
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const THEME_KEY = 'hm_theme';
function readTheme(): 'light' | 'dark' {
  try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

function ThemeItem() {
  const [theme, setTheme] = useState<'light' | 'dark'>(readTheme);
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* bỏ qua */ }
  };
  return (
    <button type="button" onClick={toggle} className="settings-nav-item text-left flex items-center gap-2 w-full">
      <span className="flex-grow">Giao diện</span>
      <span className="muted text-[12px]">{theme === 'light' ? 'Sáng' : 'Tối · sắp có'}</span>
    </button>
  );
}

export default function Page() {
  const { pathname, hash } = useLocation();
  const isAccount = pathname === '/tai-khoan/ho-so' && hash === '#tai-khoan';
  const items: Array<{ label: string; to: string; on: boolean }> = [
    { label: 'Cộng đồng của tôi', to: '/admin', on: false },
    { label: 'Khu học tập', to: '/hoc', on: false },
    { label: 'Hồ sơ', to: '/tai-khoan/ho-so', on: pathname === '/tai-khoan/ho-so' && !isAccount },
    { label: 'Cộng sự', to: '/tai-khoan/cong-su', on: pathname.startsWith('/tai-khoan/cong-su') },
    { label: 'Tài khoản', to: '/tai-khoan/ho-so#tai-khoan', on: isAccount },
    { label: 'Thông báo', to: '/thong-bao', on: false },
    { label: 'Tin nhắn', to: '/tin-nhan', on: false },
    { label: 'Gói và thanh toán', to: '/tai-khoan/goi', on: pathname === '/tai-khoan/goi' },
  ];
  return (
    <div className="settings-page">
      <nav className="settings-nav" aria-label="Tài khoản">
        {items.map((it) => (
          <Link key={it.label} to={it.to} className={`settings-nav-item${it.on ? ' on' : ''}`}>{it.label}</Link>
        ))}
        <ThemeItem />
      </nav>
      <div className="settings-main">
        <Outlet />
      </div>
    </div>
  );
}
