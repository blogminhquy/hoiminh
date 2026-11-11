// Gói Hội Mình (/admin/goi): một trang riêng, hai cột. Trái là gói đang dùng (trạng thái, hạn, giá, đang dùng bao nhiêu),
// phải là thanh toán (chu kỳ, cách trả, nút trả tiền ghi rõ số tiền) → POST /v1/checkout → /thanh-toan/:orderId. Điện thoại xếp một cột.
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Chip, money, OptionCard, Skeleton, T, Tag } from '@hoiminh/ui';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { fmtCount } from '@/lib/format';
import { pickPlan, planView, priceLabel, yearlySaving, type Cycle, type PlanPrice, type PlanView } from '@/lib/platform-plan';
import { WS_HOME_KEY, type WorkspaceHome } from './WorkspaceHomeParts';
import { PLANS_QUERY } from './WorkspacePlanCard';

type Provider = 'sepay' | 'momo' | 'vnpay' | 'paypal';
const PROVIDERS: Array<[Provider, string]> = [['sepay', 'Chuyển khoản QR'], ['momo', 'MoMo'], ['vnpay', 'VNPAY'], ['paypal', 'PayPal']];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-2.5" style={{ borderTop: `1px solid ${T.line}` }}>
      <span className="text-[13px]" style={{ color: T.sideText }}>{label}</span>
      <span className="flex-grow" />
      <span className="text-[14px] font-semibold text-right">{children}</span>
    </div>
  );
}

function CurrentPlan({ d, v, plan }: { d: WorkspaceHome; v: PlanView; plan: PlanPrice | null }) {
  const bad = v.state === 'locked' || v.state === 'overdue';
  return (
    <div className="card card-invert flex flex-col p-5 md:p-6">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}><Sparkles size={16} className="flex-shrink-0" />Gói của bạn</div>
      <div className="flex items-center gap-3 flex-wrap pt-2">
        <span className="serif text-[26px] font-extrabold leading-tight">{v.name}</span>
        <Tag tone={bad ? 'accent' : 'gold'}>{v.badge}</Tag>
      </div>
      {v.when && <div className="text-[14px] pt-1 first-letter:uppercase" style={{ color: T.sideText }}>{v.when}</div>}
      {v.warn && <div className="text-[13px] pt-2" style={{ color: T.gold }}>{v.warn}</div>}
      <div className="flex flex-col pt-4">
        <Row label={v.state === 'trial' ? 'Giá sau dùng thử' : 'Giá'}>{plan ? priceLabel(plan, v.cycle) : <Skeleton h={14} w={96} />}</Row>
        <Row label="Đang dùng">{fmtCount(d.totals.communities)} hội · {fmtCount(d.totals.members)} thành viên</Row>
      </div>
    </div>
  );
}

function Checkout({ workspaceId, plan, plansFailed, onRetry, initialCycle, renewing }: { workspaceId: string; plan: PlanPrice | null; plansFailed: boolean; onRetry: () => void; initialCycle: Cycle; renewing: boolean }) {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<Cycle>(initialCycle);
  const [provider, setProvider] = useState<Provider>('sepay');
  const m = useMutation({
    mutationFn: () => api.post<{ orderId: string }>('/v1/checkout', { target: { type: 'platform', workspaceId, cycle }, provider }),
    onSuccess: (r) => navigate(`/thanh-toan/${r.orderId}`),
  });
  const saving = plan ? yearlySaving(plan) : null;
  const total = plan ? money(cycle === 'yearly' ? plan.yearlyMinor : plan.monthlyMinor) : null;
  const price = (c: Cycle) => (plan ? priceLabel(plan, c) : <Skeleton h={14} w={110} />);

  return (
    <div className="card flex flex-col gap-5 p-5 md:p-6">
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Chu kỳ</span>
        <div className="grid-2">
          <OptionCard on={cycle === 'monthly'} onClick={() => setCycle('monthly')} title="Theo tháng" sub={price('monthly')} />
          <OptionCard on={cycle === 'yearly'} onClick={() => setCycle('yearly')} title={<>Theo năm{saving && <Tag tone="gold">{saving}</Tag>}</>} sub={price('yearly')} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Cách thanh toán</span>
        <div className="flex gap-2 flex-wrap">{PROVIDERS.map(([k, l]) => <Chip key={k} on={provider === k} onClick={() => setProvider(k)}>{l}</Chip>)}</div>
      </div>
      {plansFailed && (
        <div className="flex items-center gap-3 flex-wrap text-[13px]" style={{ color: T.accentText }}>
          <span className="flex-grow">Chưa tải được bảng giá nên chưa thanh toán được.</span>
          <Button size="sm" onClick={onRetry}>Thử lại</Button>
        </div>
      )}
      {m.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
      <div className="flex flex-col-reverse md:flex-row md:items-center gap-3 pt-5" style={{ borderTop: `1px solid ${T.line}` }}>
        <span className="muted text-[13px] flex-grow">{renewing ? 'Thời hạn mới được cộng nối vào ngày hết hạn hiện tại.' : 'Gói có hiệu lực ngay khi tiền về.'}</span>
        <Button variant="primary" size="lg" className="w-full md:w-auto" loading={m.isPending} disabled={!plan} onClick={() => m.mutate()}>{total ? `Thanh toán ${total}` : 'Thanh toán'}</Button>
      </div>
    </div>
  );
}

export default function Page() {
  const q = useQuery({ queryKey: WS_HOME_KEY, queryFn: () => api.get<WorkspaceHome>('/v1/me/workspace') });
  const plans = useQuery(PLANS_QUERY);
  return (
    <QueryState q={q} rows={4}>
      {(d) => {
        const ws = d.workspace;
        // Chưa có workspace thì chưa có gói nào để trả: về Hội của tôi, nơi có nút kích hoạt dùng thử.
        if (!ws) return <Navigate to="/admin" replace />;
        const plan = pickPlan(plans.data, ws.planKey);
        const v = planView({ sub: d.platformSubscription, trialEndsAt: ws.trialEndsAt, locked: Boolean(ws.contentLockedAt), now: new Date() });
        return (
          <>
            <div className="flex flex-col gap-2">
              <Link to="/admin" className="inline-flex items-center gap-1.5 text-[13px] self-start" style={{ color: T.ink3 }}><ChevronLeft size={16} />Hội của tôi</Link>
              <h1 className="serif m-0 text-[32px] font-extrabold">Gói Hội Mình</h1>
              <div className="muted">Một gói duy nhất: đầy đủ tính năng, không giới hạn số hội và thành viên, không phí giao dịch.</div>
            </div>
            <div className="plan-page">
              <CurrentPlan d={d} v={v} plan={plan} />
              <Checkout workspaceId={ws.id} plan={plan} plansFailed={!plan && !plans.isPending} onRetry={() => void plans.refetch()} initialCycle={v.cycle} renewing={v.state === 'active'} />
            </div>
          </>
        );
      }}
    </QueryState>
  );
}
