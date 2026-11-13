// Bảng chuyển hội: mở từ tên hội ở đầu trang (máy tính và điện thoại). Chọn hội nào thì vào
// trang Hôm nay của hội đó (chủ hội và quản trị thấy Bàn điều khiển).
import { CommunityMark, T } from '@hoiminh/ui';
import { Compass, LayoutGrid, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function CommunitySwitcher({ current, onClose }: { current: string; onClose: () => void }) {
  const { communities } = useAuth();
  const owns = communities.some((c) => c.role === 'owner');
  // Đóng khi bấm ra ngoài hoặc nhấn Esc. Bấm vào chính nút mở (cùng khối cha với bảng) thì để nút tự đóng mở.
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (!box.current?.parentElement?.contains(e.target as Node)) close.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);
  return (
    <div ref={box} role="menu" className="community-switcher" onMouseLeave={onClose}>
      {communities.map((c) => (
        <Link key={c.id} role="menuitem" to={`/${c.slug}/hom-nay`} onClick={onClose} aria-current={c.slug === current ? 'true' : undefined} className="community-switcher-row">
          <CommunityMark mark={c.logoMark} color={c.logoColor} url={c.logoUrl} size={30} radius={8} />
          <span className="flex-grow min-w-0 truncate font-semibold">{c.name}</span>
          <span className="text-[14px] flex-shrink-0" style={{ color: T.sideMuted }}>{c.role === 'owner' ? 'Chủ hội' : c.role === 'admin' ? 'Quản trị' : ''}</span>
        </Link>
      ))}
      <div className="h-px my-1" style={{ background: 'rgba(255,255,255,0.12)' }} />
      <Link role="menuitem" to="/admin" onClick={onClose} className="community-switcher-row"><LayoutGrid size={18} /> Tất cả hội và gói Hội Mình</Link>
      {owns && <Link role="menuitem" to="/admin/tao-hoi" onClick={onClose} className="community-switcher-row"><Plus size={18} /> Tạo hội mới</Link>}
      <Link role="menuitem" to="/" onClick={onClose} className="community-switcher-row"><Compass size={18} /> Khám phá hội khác</Link>
    </div>
  );
}
