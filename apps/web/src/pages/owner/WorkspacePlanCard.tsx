// Thẻ tối "Gói nền tảng của bạn" ở Hội của tôi: tóm tắt trạng thái gói và một nút dẫn sang trang /admin/goi.
// Việc chọn chu kỳ và thanh toán nằm cả ở trang đó (WorkspacePlan.tsx), thẻ này không bung thêm gì ra.
import { useQuery } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { fmtCount } from '@/lib/format';
import { pickPlan, planView, priceLabel, type PlanPrice } from '@/lib/platform-plan';
import type { WorkspaceHome } from './WorkspaceHomeParts';

export const PLANS_QUERY = { queryKey: ['plans'], queryFn: () => api.get<PlanPrice[]>('/v1/plans'), staleTime: 300_000 } as const;

export function PlanCard({ d }: { d: WorkspaceHome }) {
  const plans = useQuery(PLANS_QUERY);
  const ws = d.workspace;
  if (!ws) return null;
  const plan = pickPlan(plans.data, ws.planKey);
  const v = planView({ sub: d.platformSubscription, trialEndsAt: ws.trialEndsAt, locked: Boolean(ws.contentLockedAt), now: new Date() });
  const bad = v.state === 'locked' || v.state === 'overdue';
  const price = plan ? (v.state === 'trial' ? `sau đó ${priceLabel(plan, 'monthly')}` : priceLabel(plan, v.cycle)) : '';

  return (
    <div className="card card-invert flex flex-col gap-2.5 flex-1" style={{ padding: '20px 24px' }}>
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}><Sparkles size={16} className="flex-shrink-0" />Gói nền tảng của bạn</div>
      <div className="serif text-[22px] font-extrabold">Hội Mình · {v.name.toLocaleLowerCase('vi')}</div>
      <div className="text-[13px]" style={{ color: bad ? T.gold : T.sideText }}>{[v.badge, v.when, price].filter(Boolean).join(' · ')}</div>
      <div className="text-[13px]" style={{ color: T.sideText }}>{fmtCount(d.totals.communities)} hội · {fmtCount(d.totals.members)} thành viên · không giới hạn</div>
      {bad && <div className="text-[13px]" style={{ color: T.gold }}>{v.warn}</div>}
      <span className="flex-grow" />
      <div className="pt-1">
        {v.needsPayment
          ? <Link to="/admin/goi" className="btn btn-primary btn-sm">Thanh toán gói</Link>
          : <Link to="/admin/goi" className="btn btn-ghost btn-sm" style={{ background: 'transparent', color: T.invertInk, borderColor: 'rgba(255,253,249,0.3)' }}>Quản lý gói</Link>}
      </div>
    </div>
  );
}
