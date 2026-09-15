// Thẻ tối "Gói nền tảng của bạn" + phần thanh toán gói (chọn tháng/năm, cổng) → POST /v1/checkout → /thanh-toan/:orderId.
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Chip, money, OptionCard, T } from '@hoiminh/ui';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { WorkspaceHome } from './WorkspaceHomeParts';

interface Plan { key: string; name: string; monthlyMinor: number; yearlyMinor: number; trialDays: number }
type Provider = 'sepay' | 'momo' | 'vnpay' | 'paypal';
const PROVIDERS: Array<[Provider, string]> = [['sepay', 'Chuyển khoản QR'], ['momo', 'MoMo'], ['vnpay', 'VNPAY'], ['paypal', 'PayPal']];

function PlanCheckout({ workspaceId, plan, initialCycle, onClose }: { workspaceId: string; plan: Plan | null; initialCycle: 'monthly' | 'yearly'; onClose: () => void }) {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>(initialCycle);
  const [provider, setProvider] = useState<Provider>('sepay');
  const m = useMutation({
    mutationFn: () => api.post<{ orderId: string }>('/v1/checkout', { target: { type: 'platform', workspaceId, cycle }, provider }),
    onSuccess: (r) => navigate(`/thanh-toan/${r.orderId}`),
  });
  const price = (c: 'monthly' | 'yearly') => (plan ? money(c === 'monthly' ? plan.monthlyMinor : plan.yearlyMinor) : '…');
  return (
    <div className="card flex flex-col gap-4" style={{ padding: '20px 24px' }}>
      <div className="flex items-center"><span className="font-semibold">Thanh toán gói Hội Mình</span><span className="flex-grow" /><button type="button" className="text-[13px] font-semibold" style={{ color: T.ink3 }} onClick={onClose}>Đóng</button></div>
      <div className="grid-2">
        <OptionCard on={cycle === 'monthly'} onClick={() => setCycle('monthly')} title="Theo tháng" sub={`${price('monthly')}/tháng · hủy bất cứ lúc nào`} />
        <OptionCard on={cycle === 'yearly'} onClick={() => setCycle('yearly')} title="Theo năm" sub={`${price('yearly')}/năm · 2 tháng miễn phí`} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Cách thanh toán</span>
        <div className="flex gap-2 flex-wrap">{PROVIDERS.map(([k, l]) => <Chip key={k} on={provider === k} onClick={() => setProvider(k)}>{l}</Chip>)}</div>
      </div>
      {m.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="muted text-[13px]">Quyền tạo nội dung mở lại ngay khi tiền về. Không thu phí giao dịch.</span>
        <span className="flex-grow" />
        <Button variant="primary" loading={m.isPending} disabled={!plan} onClick={() => m.mutate()}>Thanh toán {price(cycle)}</Button>
      </div>
    </div>
  );
}

export function PlanCard({ d, autoOpen }: { d: WorkspaceHome; autoOpen: boolean }) {
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api.get<Plan[]>('/v1/plans'), staleTime: 300_000 });
  const plan = plans.data?.[0] ?? null;
  const sub = d.platformSubscription;
  const ws = d.workspace;
  const [open, setOpen] = useState(autoOpen);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>(sub?.billingCycle === 'yearly' ? 'yearly' : 'monthly');
  if (!ws) return null;

  const trial = !sub || sub.status === 'trialing';
  const expired = sub?.status === 'expired' || sub?.status === 'past_due' || Boolean(ws.contentLockedAt);
  const end = sub?.currentPeriodEnd ?? ws.trialEndsAt;
  const title = trial ? 'Hội Mình · dùng thử' : `Hội Mình · gói ${sub.billingCycle === 'yearly' ? 'năm' : 'tháng'}`;
  const priceLine = plan ? (sub && !trial ? `${money(sub.billingCycle === 'yearly' ? plan.yearlyMinor : plan.monthlyMinor)}/${sub.billingCycle === 'yearly' ? 'năm' : 'tháng'}` : `${money(plan.monthlyMinor)}/tháng sau dùng thử`) : '';
  const dateLine = end ? (expired ? `hết hạn ${fmtDate(end)}` : trial ? `dùng thử đến ${fmtDate(end)}` : sub?.cancelAtPeriodEnd ? `kết thúc ${fmtDate(end)}` : `gia hạn ${fmtDate(end)}`) : '';
  const openWith = (c: 'monthly' | 'yearly') => { setCycle(c); setOpen(true); };

  return (
    <>
      <div className="card flex flex-col gap-2.5 flex-1" style={{ padding: '20px 24px', background: T.ink, color: T.surface, borderColor: T.ink }}>
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}><Sparkles size={16} />Gói nền tảng của bạn</div>
        <div className="serif text-[22px] font-extrabold">{title}</div>
        <div className="text-[13px]" style={{ color: expired ? T.accent : T.sideText }}>{[priceLine, dateLine, 'đầy đủ tính năng, không phí giao dịch'].filter(Boolean).join(' · ')}</div>
        <div className="text-[13px]" style={{ color: T.sideText }}>{d.totals.communities} hội · {d.totals.members} thành viên · không giới hạn</div>
        {expired && <div className="text-[13px]" style={{ color: T.accent }}>Gói đã hết hạn: tạo nội dung đang tạm khóa, dữ liệu vẫn được giữ. Thanh toán để mở lại.</div>}
        <div className="flex gap-2 pt-1 flex-wrap">
          <button type="button" className="btn btn-ghost btn-sm" style={{ background: 'transparent', color: T.surface, borderColor: 'rgba(255,253,249,0.3)' }} onClick={() => (open ? setOpen(false) : openWith(cycle))}>{open ? 'Đóng' : trial || expired ? 'Thanh toán gói' : 'Quản lý gói'}</button>
          {(trial || expired || sub?.billingCycle === 'monthly') && <button type="button" className="btn btn-primary btn-sm" onClick={() => openWith('yearly')}>{trial || expired ? 'Chọn gói năm · 2 tháng miễn phí' : 'Đổi sang gói năm · 2 tháng miễn phí'}</button>}
        </div>
      </div>
      {open && <PlanCheckout key={cycle} workspaceId={ws.id} plan={plan} initialCycle={cycle} onClose={() => setOpen(false)} />}
    </>
  );
}
