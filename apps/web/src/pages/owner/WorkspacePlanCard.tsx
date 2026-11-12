// Thẻ tối "Gói của các hội" ở Hội của tôi: mỗi hội một dòng (gói đang dùng, hạn, số thành viên so với trần) và dẫn
// sang trang chọn gói của hội đó (/admin/goi?hoi=<slug>). Gói gắn với từng hội, không còn một gói chung cho cả tài khoản.
import type { PlanDef } from '@hoiminh/contracts';
import { T } from '@hoiminh/ui';
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { capView, planBadge } from '@/lib/platform-plan';
import type { WorkspaceHome } from './WorkspaceHomeParts';

export const PLANS_QUERY = { queryKey: ['plans'], queryFn: () => api.get<PlanDef[]>('/v1/plans'), staleTime: 300_000 } as const;

export function PlanCard({ d }: { d: WorkspaceHome }) {
  if (!d.owned.length) return null;
  return (
    <div className="card card-invert flex flex-col gap-2.5 flex-1" style={{ padding: '20px 24px' }}>
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}><Sparkles size={16} className="flex-shrink-0" />Gói của các hội</div>
      <div className="text-[13px]" style={{ color: T.sideText }}>Mỗi gói dùng cho một hội. Không thu phí trên doanh thu.</div>
      <div className="flex flex-col">
        {d.owned.map((c) => {
          const badge = planBadge(c.plan);
          const warn = badge.tone === 'accent' || badge.tone === 'gold' || c.plan.full;
          const cap = c.plan.needsPlan ? '' : capView(c.memberCount, c.plan.memberCap).text;
          return (
            <Link key={c.id} to={`/admin/goi?hoi=${c.slug}`} className="flex items-center gap-3 py-2.5" style={{ borderTop: '1px solid rgba(255,253,249,0.14)', color: T.invertInk }}>
              <div className="flex flex-col min-w-0 flex-grow">
                <span className="font-semibold truncate">{c.name}</span>
                <span className="text-[13px]" style={{ color: warn ? T.gold : T.sideText }}>{[c.plan.needsPlan ? badge.label : `Gói ${c.plan.name}`, c.plan.needsPlan ? '' : badge.label, cap, c.plan.full && !c.plan.needsPlan ? 'đã đủ chỗ' : ''].filter(Boolean).join(' · ')}</span>
              </div>
              <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: T.gold }}>{c.plan.needsPlan ? 'Thanh toán' : c.plan.key === 'free' ? 'Nâng gói' : 'Xem gói'}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
