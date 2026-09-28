// Khung Tài khoản (accountNav trong build.mjs): nav 220px 8 mục bên trái, nội dung trang con bên phải.
import { THEME_KEY, applyTheme, readTheme, type ThemeChoice } from '@hoiminh/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const CHOICES: Array<{ key: ThemeChoice; label: string; icon: typeof Sun }> = [
  { key: 'light', label: 'Sáng', icon: Sun },
  { key: 'dark', label: 'Tối', icon: Moon },
  { key: 'system', label: 'Theo máy', icon: Monitor },
];

/** Chọn giao diện: lưu vào localStorage của máy này, áp dụng ngay không cần tải lại. */
function ThemeItem() {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const pick = (next: ThemeChoice) => {
    setTheme(next);
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* chế độ riêng tư: vẫn đổi cho phiên này */ }
  };
  return (
    <div className="settings-nav-item flex flex-col gap-2" style={{ cursor: 'default' }}>
      <span>Giao diện</span>
      <div className="flex gap-1.5" role="radiogroup" aria-label="Giao diện">
        {CHOICES.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" role="radio" aria-checked={theme === key} onClick={() => pick(key)} className={`chip${theme === key ? ' on' : ''}`} style={{ height: 28, fontSize: 12, padding: '0 10px' }}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  const { pathname, hash } = useLocation();
  const isAccount = pathname === '/tai-khoan/ho-so' && hash === '#tai-khoan';
  const items: Array<{ label: string; to: string; on: boolean }> = [
    { label: 'Cộng đồng của tôi', to: '/admin', on: false },
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
