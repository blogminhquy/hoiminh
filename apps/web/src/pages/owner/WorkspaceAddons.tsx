// Gói bổ sung (/admin/goi-bo-sung): phần chủ hội mua thêm ngoài gói của hội. Lúc này có tên miền riêng và email
// marketing, cả hai "Sắp ra mắt": chỉ giới thiệu, chưa có nút mua. Danh sách nằm ở lib/addons.ts.
// Vào từ menu đầu trang của khu chủ hội, từ nhóm Quản lý ở thanh bên của hội (kèm ?hoi=<slug> để có lối quay về hội),
// và từ ô lệnh.
import { T, Tag } from '@hoiminh/ui';
import { Check, ChevronLeft, Clock, Globe, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PLATFORM_ADDONS, addonStatusLabel, type AddonKey, type PlatformAddon } from '@/lib/addons';

const ICON: Record<AddonKey, ReactNode> = {
  custom_domain: <Globe size={24} aria-hidden="true" />,
  email_marketing: <Mail size={24} aria-hidden="true" />,
};

function AddonCard({ a }: { a: PlatformAddon }) {
  const soon = a.status === 'soon';
  return (
    <section className="card flex flex-col gap-4 p-5 md:p-6" aria-labelledby={`addon-${a.key}`} data-testid={`addon-${a.key}`}>
      <div className="flex items-start gap-3.5">
        <span className="inline-flex items-center justify-center rounded-[14px] flex-shrink-0" style={{ width: 52, height: 52, background: T.tealSoft, color: T.tealText }}>{ICON[a.key]}</span>
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id={`addon-${a.key}`} className="m-0 text-[20px] font-extrabold" style={{ color: T.ink }}>{a.name}</h2>
            <Tag tone={soon ? 'gold' : 'teal'}>{addonStatusLabel(a.status)}</Tag>
          </div>
          <p className="m-0 text-[16px] leading-[1.55]" style={{ color: T.ink2 }}>{a.summary}</p>
        </div>
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
        {a.points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-[16px] leading-[1.5]" style={{ color: T.ink }}>
            <Check size={18} className="flex-shrink-0 mt-0.5" style={{ color: T.tealText }} aria-hidden="true" />{p}
          </li>
        ))}
      </ul>
      {soon && (
        <div className="flex items-center gap-2.5 rounded-[12px] px-4 text-[15px] font-semibold" style={{ minHeight: 48, background: T.goldSoft, color: T.goldText }}>
          <Clock size={18} className="flex-shrink-0" aria-hidden="true" />Đang hoàn thiện. Khi ra mắt, bạn mua ngay tại trang này.
        </div>
      )}
    </section>
  );
}

export default function Page() {
  const [params] = useSearchParams();
  const hoi = params.get('hoi');
  return (
    <div className="w-full mx-auto flex flex-col gap-5" style={{ maxWidth: 880 }}>
      {hoi && <Link to={`/${hoi}/hom-nay`} className="inline-flex items-center gap-1 font-semibold text-[15px] self-start" style={{ color: T.ink2, minHeight: 44 }}><ChevronLeft size={18} />Về hội</Link>}
      <div className="flex flex-col gap-1.5">
        <h1 className="serif m-0 text-[28px] md:text-[32px] font-extrabold" style={{ color: T.ink }}>Gói bổ sung</h1>
        <p className="m-0 text-[16px] leading-[1.55]" style={{ color: T.ink2 }}>Mua thêm cho hội khi bạn cần, ngoài gói của hội. Gói của hội vẫn giữ nguyên, không phải đổi gói.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 items-stretch">
        {PLATFORM_ADDONS.map((a) => <AddonCard key={a.key} a={a} />)}
      </div>
    </div>
  );
}
