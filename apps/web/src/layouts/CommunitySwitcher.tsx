// Dropdown chuyển hội ở đầu thanh bên (mục 193).
import { CommunityMark, T } from '@hoiminh/ui';
import { Compass, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function CommunitySwitcher({ current, onClose }: { current: string; onClose: () => void }) {
  const { communities } = useAuth();
  return (
    <div className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-20 flex flex-col p-1.5" style={{ background: '#2E2823', boxShadow: '0 16px 40px rgba(0,0,0,0.4)' }} onMouseLeave={onClose}>
      {communities.map((c) => (
        <Link key={c.id} to={`/${c.slug}/bang-tin`} onClick={onClose} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{ background: c.slug === current ? 'rgba(255,253,249,0.10)' : 'transparent', color: T.invertInk }}>
          <CommunityMark mark={c.logoMark} color={c.logoColor} size={28} radius={8} />
          <span className="flex-grow min-w-0 truncate text-[13px] font-medium">{c.name}</span>
          <span className="text-[11px]" style={{ color: T.sideMuted }}>{c.role === 'owner' ? 'Chủ hội' : c.role === 'admin' ? 'Quản trị' : ''}</span>
        </Link>
      ))}
      <div className="h-px my-1" style={{ background: 'rgba(255,253,249,0.08)' }} />
      <Link to="/admin" onClick={onClose} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px]" style={{ color: T.sideText }}><LayoutGrid size={16} /> Hội của tôi</Link>
      <Link to="/kham-pha" onClick={onClose} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px]" style={{ color: T.sideText }}><Compass size={16} /> Khám phá hội khác</Link>
    </div>
  );
}
