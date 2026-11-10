// /cai-dat. Máy tính: vào thẳng nhóm đầu (Hội). Điện thoại: danh sách 4 nhóm lớn, dễ chạm, kèm lối ra trang giới thiệu.
import { T } from '@hoiminh/ui';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useShell } from '@/lib/community';
import { settingsGroups } from './SettingsLayout';

/** Bề rộng từ đó khung Cài đặt hiện danh mục bên trái (khớp điểm gãy 900px trong styles.css). */
const WIDE = '(min-width: 901px)';

export default function Page() {
  const shell = useShell();
  const groups = settingsGroups(shell);
  if (typeof window !== 'undefined' && window.matchMedia(WIDE).matches) return <Navigate to={groups[0]!.tabs[0]!.to} replace />;
  return (
    <>
      <div><h1 className="serif m-0 text-[28px] font-extrabold">Cài đặt</h1><div className="muted text-[15px] truncate">{shell.community.name}</div></div>
      <nav className="card px-3 py-1 me-list" aria-label="Nhóm cài đặt">
        {groups.map((g) => (
          <Link key={g.key} to={g.tabs[0]!.to} className="me-row">
            <span className="ic">{g.icon}</span>
            <span className="flex-grow min-w-0"><span className="block">{g.label}</span><span className="block muted text-[14px] font-normal truncate">{g.hint}</span></span>
            <ChevronRight size={20} style={{ color: T.ink3 }} />
          </Link>
        ))}
      </nav>
      <Link to={`/${shell.community.slug}`} className="card me-row px-4"><span className="ic"><ExternalLink size={20} /></span><span className="flex-grow">Xem trang giới thiệu của hội</span><ChevronRight size={20} style={{ color: T.ink3 }} /></Link>
    </>
  );
}
