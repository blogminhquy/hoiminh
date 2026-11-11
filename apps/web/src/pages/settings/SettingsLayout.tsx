// Khung Cài đặt hội: 4 nhóm thay cho 10 mục cũ (Hội, Bán hàng, Cộng sự, Tự động và kết nối). Nhóm có hơn một trang
// thì hiện hàng tab con ngay trên nội dung. Máy tính: danh mục bên trái. Điện thoại: /cai-dat là danh sách nhóm
// (SettingsHome), vào trang con thì có nút quay lại. Chỉ người có settings.manage hoặc billing.manage.
import { T } from '@hoiminh/ui';
import type { PlanFeature } from '@hoiminh/contracts';
import { ChevronLeft, ExternalLink, Handshake, Lock, Plug, Store, Tag } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { hasPlanFeature } from '@/components/PlanGate';
import { useCan, useShell, type Shell } from '@/lib/community';

export interface SettingsTab { label: string; to: string; /** Tính năng trả phí mà gói của hội chưa có: tab vẫn hiện, kèm ổ khóa. */ locked?: PlanFeature }
export interface SettingsGroup { key: string; label: string; hint: string; icon: ReactNode; tabs: SettingsTab[] }

/** Bốn nhóm cài đặt của một hội. Trang đầu của nhóm là tabs[0]. */
export function settingsGroups(shell: Shell): SettingsGroup[] {
  const base = `/${shell.community.slug}/cai-dat`;
  const lock = (f: PlanFeature) => (hasPlanFeature(shell, f) ? undefined : f);
  const connect: SettingsTab[] = [{ label: 'Tiện ích', to: `${base}/tien-ich` }, { label: 'Nguồn đồng bộ', to: `${base}/nguon-dong-bo`, locked: lock('automation') }, { label: 'Quy tắc tự động', to: `${base}/quy-tac`, locked: lock('automation') }, { label: 'Liên hệ và thẻ', to: `${base}/lien-he`, locked: lock('automation') }];
  // Khóa API và webhook thuộc về người đứng tên không gian làm việc.
  if (shell.viewer.role === 'owner') connect.push({ label: 'Nhà phát triển', to: `${base}/nha-phat-trien`, locked: lock('api') });
  return [
    { key: 'hoi', label: 'Hội', hint: 'Tên, logo, quy tắc, câu hỏi khi tham gia, chuyên mục', icon: <Store size={20} />, tabs: [{ label: 'Thông tin', to: `${base}/chung` }, { label: 'Bảng tin và chuyên mục', to: `${base}/bang-tin` }] },
    { key: 'ban-hang', label: 'Bán hàng', hint: 'Giá, gói thành viên, cách khách thanh toán', icon: <Tag size={20} />, tabs: [{ label: 'Giá và gói', to: `${base}/gia` }] },
    { key: 'cong-su', label: 'Cộng sự', hint: 'Mức hoa hồng, thời gian giữ, bảng xếp hạng', icon: <Handshake size={20} />, tabs: [{ label: 'Mức hoa hồng', to: `${base}/cong-su`, locked: lock('affiliate') }] },
    { key: 'ket-noi', label: 'Tự động và kết nối', hint: 'Tin nhắn chào, nhận đơn từ landing, thẻ và quy tắc tự động, khóa API', icon: <Plug size={20} />, tabs: connect },
  ];
}

export default function Page() {
  const shell = useShell();
  const can = useCan();
  const { pathname } = useLocation();
  const base = `/${shell.community.slug}`;
  if (!can('settings.manage') && !can('billing.manage')) return <Navigate to={`${base}/hom-nay`} replace />;
  const groups = settingsGroups(shell);
  const active = groups.find((g) => g.tabs.some((t) => pathname === t.to || pathname.startsWith(`${t.to}/`)));
  const atHome = pathname === `${base}/cai-dat` || pathname === `${base}/cai-dat/`;
  return (
    <div className="settings-page">
      {/* .account-nav: danh mục bên trái chỉ hiện trên máy tính, điện thoại dùng danh sách ở /cai-dat. */}
      <nav className="settings-nav account-nav" aria-label="Cài đặt">
        {groups.map((g) => <Link key={g.key} to={g.tabs[0]!.to} aria-current={active?.key === g.key ? 'page' : undefined} className={`settings-nav-item flex items-center gap-2${active?.key === g.key ? ' on' : ''}`}><span className="flex-grow">{g.label}</span>{g.tabs.every((t) => t.locked) && <Lock size={15} aria-label="Có ở gói cao hơn" />}</Link>)}
        <div className="h-px my-2" style={{ background: T.line }} />
        {shell.viewer.role === 'owner' && <Link to={`/admin/goi?hoi=${shell.community.slug}`} className="settings-nav-item flex items-center gap-2"><span className="flex-grow">Gói của hội</span><span className="text-[13px]" style={{ color: T.ink3 }}>{shell.plan?.needsPlan ? 'Chưa có' : shell.plan?.name}</span></Link>}
        <Link to={base} className="settings-nav-item flex items-center gap-2"><span className="flex-grow">Xem trang giới thiệu</span><ExternalLink size={16} /></Link>
      </nav>
      <div className="settings-main" style={{ maxWidth: 880 }}>
        {!atHome && <Link to={`${base}/cai-dat`} className="account-back items-center gap-1 font-semibold text-[15px] self-start"><ChevronLeft size={20} />Cài đặt</Link>}
        {active && active.tabs.length > 1 && (
          <nav className="chip-row" aria-label={active.label}>
            {active.tabs.map((t) => <NavLink key={t.to} to={t.to} className={({ isActive }) => `chip${isActive ? ' on' : ''}`}>{t.locked && <Lock size={14} aria-label="Có ở gói cao hơn" />}{t.label}</NavLink>)}
          </nav>
        )}
        <Outlet />
      </div>
    </div>
  );
}
