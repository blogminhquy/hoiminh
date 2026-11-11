// Gói Hội Mình (/admin/goi): một cột dọc ở giữa, cả trên máy tính. Từ trên xuống: gói đang dùng, hai tab chu kỳ
// (tháng, năm), thẻ gói với giá của tab đang chọn. Bấm nút trên thẻ thì khung thanh toán bật lên: chọn cách trả
// → POST /v1/checkout → /thanh-toan/:orderId. Khi quản trị cài gói thu tiền bằng link ngoài (Hệ thống, Gói nền tảng)
// thì nút trên thẻ dẫn thẳng sang link đó (không có khung bật lên), và chỉ hiện chu kỳ nào có link.
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Modal, money, OptionCard, Skeleton, T, Tag } from '@hoiminh/ui';
import { Check, ChevronLeft, ExternalLink, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtCount } from '@/lib/format';
import { externalPayUrl, payCycles, pickPlan, planView, yearlySaving, type Cycle, type PlanPrice, type PlanView } from '@/lib/platform-plan';
import { WS_HOME_KEY, type WorkspaceHome } from './WorkspaceHomeParts';
import { PLANS_QUERY } from './WorkspacePlanCard';

type Provider = 'sepay' | 'momo' | 'vnpay' | 'paypal';
const PROVIDERS: Array<[Provider, string]> = [['sepay', 'Chuyển khoản QR'], ['momo', 'MoMo'], ['vnpay', 'VNPAY'], ['paypal', 'PayPal']];
const CYCLE_NAME: Record<Cycle, string> = { monthly: 'tháng', yearly: 'năm' };
const FEATURES = [
  'Không giới hạn hội, thành viên, khóa học, sự kiện',
  'Không thu phí giao dịch',
  'Nhận tiền qua chuyển khoản QR, MoMo, VNPAY, PayPal',
  'Cộng sự, cửa hàng, tên miền riêng, API',
];

function CurrentPlan({ d, v }: { d: WorkspaceHome; v: PlanView }) {
  const bad = v.state === 'locked' || v.state === 'overdue';
  return (
    <div className="card card-invert flex flex-col gap-1.5 p-5">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}><Sparkles size={16} className="flex-shrink-0" />Gói của bạn</div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="serif text-[22px] font-extrabold leading-tight">{v.name}</span>
        <Tag tone={bad ? 'accent' : 'gold'}>{v.badge}</Tag>
      </div>
      <div className="text-[14px] first-letter:uppercase" style={{ color: T.sideText }}>{[v.when, `${fmtCount(d.totals.communities)} hội`, `${fmtCount(d.totals.members)} thành viên`].filter(Boolean).join(' · ')}</div>
      {v.warn && <div className="text-[13px]" style={{ color: T.gold }}>{v.warn}</div>}
    </div>
  );
}

function PayModal({ open, onClose, workspaceId, plan, cycle, renewing }: { open: boolean; onClose: () => void; workspaceId: string; plan: PlanPrice; cycle: Cycle; renewing: boolean }) {
  const navigate = useNavigate();
  const [provider, setProvider] = useState<Provider>('sepay');
  const m = useMutation({
    mutationFn: () => api.post<{ orderId: string }>('/v1/checkout', { target: { type: 'platform', workspaceId, cycle }, provider }),
    onSuccess: (r) => navigate(`/thanh-toan/${r.orderId}`),
  });
  const total = money(cycle === 'yearly' ? plan.yearlyMinor : plan.monthlyMinor);
  return (
    <Modal open={open} onClose={onClose} title="Thanh toán gói Hội Mình" width={480} footer={(
      <div className="flex flex-col gap-2.5 px-5 py-4" style={{ borderTop: `1px solid ${T.line}` }}>
        {m.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
        <Button variant="primary" size="lg" block loading={m.isPending} onClick={() => m.mutate()}>Thanh toán {total}</Button>
        <div className="muted text-[13px] text-center">{renewing ? 'Thời hạn mới được cộng nối vào ngày hết hạn hiện tại.' : 'Gói có hiệu lực ngay khi tiền về.'}</div>
      </div>
    )}>
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-baseline gap-3 rounded-[12px] px-4 py-3" style={{ background: T.bg }}>
          <span className="font-semibold">Gói theo {CYCLE_NAME[cycle]}</span>
          <span className="flex-grow" />
          <span className="serif text-[20px] font-extrabold">{total}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Cách thanh toán</span>
          <div className="grid-2">{PROVIDERS.map(([k, l]) => <OptionCard key={k} on={provider === k} onClick={() => setProvider(k)} title={l} />)}</div>
        </div>
      </div>
    </Modal>
  );
}

function PlanOffer({ workspaceId, plan, plansFailed, onRetry, v }: { workspaceId: string; plan: PlanPrice | null; plansFailed: boolean; onRetry: () => void; v: PlanView }) {
  const { user } = useAuth();
  const [picked, setCycle] = useState<Cycle>(v.cycle);
  const [paying, setPaying] = useState(false);
  // Link ngoài: chỉ bán chu kỳ nào quản trị đã cài link; chu kỳ đang chọn không còn bán thì lấy chu kỳ đầu.
  const cycles: Cycle[] = plan ? payCycles(plan) : ['monthly', 'yearly'];
  const cycle = cycles.includes(picked) ? picked : cycles[0] ?? picked;
  const saving = plan ? yearlySaving(plan) : null;
  const yearly = cycle === 'yearly';
  // Gói thu tiền bằng link ngoài: nút trên thẻ dẫn thẳng sang trang thanh toán đó, không qua khung bật lên.
  const external = plan?.paymentMode === 'link';
  const payUrl = plan ? externalPayUrl(plan, cycle, { workspaceId, email: user?.email ?? '' }) : null;
  const cta = `${v.needsPayment ? 'Thanh toán' : 'Gia hạn'} gói ${CYCLE_NAME[cycle]}`;
  const tab = (k: Cycle, label: string) => (
    <button type="button" role="tab" aria-selected={cycle === k} className={cycle === k ? 'on' : undefined} onClick={() => setCycle(k)}>{label}</button>
  );
  return (
    <>
      {cycles.length > 1 && (
        <div className="seg self-center" role="tablist" aria-label="Chu kỳ thanh toán">
          {tab('monthly', 'Theo tháng')}
          {tab('yearly', 'Theo năm')}
          {saving && <Tag tone="gold" className="seg-note">{saving}</Tag>}
        </div>
      )}
      <div className="card flex flex-col gap-5 p-5 md:p-7">
        <div className="flex flex-col gap-1">
          <span className="font-semibold" style={{ color: T.ink2 }}>Hội Mình</span>
          {plan ? (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="serif text-[38px] font-extrabold leading-tight">{money(yearly ? plan.yearlyMinor : plan.monthlyMinor)}</span>
              <span className="muted text-[15px]">/{CYCLE_NAME[cycle]}</span>
            </div>
          ) : <Skeleton h={44} w={200} />}
          {plan && <span className="muted text-[13px]">{yearly ? `Tương đương ${money(Math.round(plan.yearlyMinor / 12))}/tháng` : 'Trả theo từng tháng'}</span>}
        </div>
        <div className="flex flex-col gap-2.5">
          {FEATURES.map((f) => (
            <div key={f} className="flex items-start gap-2.5 text-[14px]">
              <Check size={18} className="flex-shrink-0 mt-0.5" style={{ color: T.teal }} />
              <span>{f}</span>
            </div>
          ))}
        </div>
        {plansFailed && (
          <div className="flex items-center gap-3 flex-wrap text-[13px]" style={{ color: T.accentText }}>
            <span className="flex-grow">Chưa tải được bảng giá nên chưa thanh toán được.</span>
            <Button size="sm" onClick={onRetry}>Thử lại</Button>
          </div>
        )}
        {plan && cycles.length === 0 && <div className="text-[13px]" style={{ color: T.accentText }}>Gói đang tạm ngừng nhận thanh toán. Liên hệ Hội Mình để được hỗ trợ.</div>}
        {external && payUrl ? (
          <div className="flex flex-col gap-2.5">
            <a href={payUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg w-full">{cta}<ExternalLink size={18} /></a>
            <div className="muted text-[13px] text-center">Trang thanh toán mở ở thẻ mới. Gói được kích hoạt sau khi Hội Mình ghi nhận thanh toán của bạn.</div>
          </div>
        ) : (
          <Button variant="primary" size="lg" block disabled={!plan || cycles.length === 0} onClick={() => setPaying(true)}>{cta}</Button>
        )}
      </div>
      {plan && !external && <PayModal open={paying} onClose={() => setPaying(false)} workspaceId={workspaceId} plan={plan} cycle={cycle} renewing={v.state === 'active'} />}
    </>
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
          <div className="w-full mx-auto flex flex-col gap-5" style={{ maxWidth: 560 }}>
            <Link to="/admin" className="inline-flex items-center gap-1.5 text-[13px] self-start" style={{ color: T.ink3 }}><ChevronLeft size={16} />Hội của tôi</Link>
            <div className="flex flex-col gap-1.5 text-center">
              <h1 className="serif m-0 text-[32px] font-extrabold">Gói Hội Mình</h1>
              <div className="muted">Một gói duy nhất, đầy đủ tính năng.</div>
            </div>
            <CurrentPlan d={d} v={v} />
            <PlanOffer workspaceId={ws.id} plan={plan} plansFailed={!plan && !plans.isPending} onRetry={() => void plans.refetch()} v={v} />
          </div>
        );
      }}
    </QueryState>
  );
}
