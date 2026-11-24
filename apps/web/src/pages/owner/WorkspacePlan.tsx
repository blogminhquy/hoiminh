// Gói cho hội (/admin/goi?hoi=<slug>): mỗi gói dùng cho một hội. Trang chọn gói có thanh thành viên so với trần,
// các tab kỳ hạn (1 tháng, 3 tháng, 6 tháng, 1 năm: chỉ hiện kỳ quản trị đang bán, tức giá lớn hơn 0), các thẻ gói
// bán kỳ đang chọn và bảng so sánh. Bấm một gói thì sang màn nâng gói
// (/admin/goi?hoi=<slug>&goi=<khóa gói>&ky=<chu kỳ>): số ngày mua, số ngày tặng từ gói cũ, ngày hết hạn, rồi
// khung chọn cách trả → POST /v1/checkout → /thanh-toan/:orderId. Không có dùng thử.
import { useMutation, useQuery } from '@tanstack/react-query';
import { isPlanKey, pickCycle, planCycleSchema, planCyclesOf, soldCycles, type PaymentProvider, type PlanCycle, type PlanDef, type PlanKey } from '@hoiminh/contracts';
import { Button, Modal, OptionCard, T, Tag } from '@hoiminh/ui';
import { Check, ChevronLeft, Lock, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { BUYER_METHOD_NAME, initialMethod } from '@/lib/payment-methods';
import { capView, compareRows, cycleHint, cycleLabel, cycleSaving, num, planBadge, tierCards, upgradeSummary, type HoiPlan, type TierCard } from '@/lib/platform-plan';
import { WS_HOME_KEY, type WorkspaceHome } from './WorkspaceHomeParts';

type Provider = PaymentProvider;

export interface PlanStatus {
  community: { id: string; name: string; slug: string; memberCount: number; status: string; isFreeSlot: boolean };
  plan: HoiPlan;
  cycle: PlanCycle | null;
  plans: PlanDef[];
  canBuy: boolean;
  /** Cách trả tiền gói: chỉ cổng quản trị đã cài và đang bật, cổng mặc định chọn sẵn. */
  payment?: { methods: Provider[]; defaultMethod: Provider | null };
}
export const planStatusQuery = (communityId: string) => ({ queryKey: ['community-plan', communityId], queryFn: () => api.get<PlanStatus>(`/v1/communities/${communityId}/plan`) });

const TONE = { gold: 'gold', accent: 'accent', teal: 'teal', muted: 'neutral' } as const;

const capitalize = (t: string) => t.charAt(0).toLocaleUpperCase('vi') + t.slice(1);

/** Các tab kỳ hạn đang bán. `note` là lời mời của kỳ dài nhất ("Tiết kiệm 17%"), ghi cạnh dãy tab. */
function CycleTabs({ cycles, cycle, onPick, note }: { cycles: PlanCycle[]; cycle: PlanCycle; onPick: (c: PlanCycle) => void; note?: string }) {
  return (
    <div className="seg" role="tablist" aria-label="Chu kỳ thanh toán">
      {cycles.map((c) => (
        <button key={c} type="button" role="tab" aria-selected={cycle === c} className={cycle === c ? 'on' : undefined} onClick={() => onPick(c)}>{cycleLabel(c)}</button>
      ))}
      {note && <Tag tone="gold" className="seg-note">{capitalize(note)}</Tag>}
    </div>
  );
}

/** Thẻ đầu trang: hội nào, đang ở gói gì, bao nhiêu thành viên so với trần. */
function HoiHeader({ s }: { s: PlanStatus }) {
  const badge = planBadge(s.plan);
  const cap = capView(s.community.memberCount, s.plan.needsPlan ? null : s.plan.memberCap);
  return (
    <div className="card flex flex-col md:flex-row gap-5 p-5 md:p-6">
      <div className="flex flex-col gap-1.5 md:w-[40%]">
        <span className="font-bold text-[18px]">{s.community.name}</span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px]" style={{ color: T.ink2 }}>{s.plan.needsPlan ? 'Chưa có gói' : `Gói ${s.plan.name}`}</span>
          <Tag tone={TONE[badge.tone]}>{badge.label}</Tag>
        </div>
        {badge.note && <span className="text-[14px]" style={{ color: badge.tone === 'accent' ? T.accentText : T.ink3 }}>{badge.note}</span>}
      </div>
      {!s.plan.needsPlan && (
        <div className="flex flex-col gap-2 flex-grow min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold">Thành viên</span>
            <span className="flex-grow" />
            <span className="text-[15px] font-bold">{cap.text}</span>
          </div>
          {s.plan.memberCap !== null && (
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: T.bg }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={cap.percent} aria-label="Thành viên so với trần của gói">
              <div className="h-full rounded-full" style={{ width: `${cap.percent}%`, background: cap.full ? T.accent : cap.percent >= 80 ? T.gold : T.teal }} />
            </div>
          )}
          <span className="text-[14px]" style={{ color: cap.full ? T.accentText : T.ink3 }}>{cap.note}</span>
        </div>
      )}
    </div>
  );
}

function Tier({ t, to, canBuy }: { t: TierCard; to: string; canBuy: boolean }) {
  return (
    <div className="card flex flex-col gap-4 p-5" style={t.popular ? { borderColor: T.gold, boxShadow: `0 0 0 1px ${T.gold}` } : undefined}>
      <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
        <span className="text-[18px] font-extrabold">{t.name}</span>
        {t.popular && <Tag tone="gold">Dành cho đa số</Tag>}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="serif text-[30px] font-extrabold leading-tight">{t.price}</span>
          <span className="muted text-[14px]">{t.per}</span>
        </div>
        <span className="text-[14px]" style={{ color: T.ink3 }}>{t.sub}</span>
      </div>
      <div className="flex items-center gap-2 text-[15px] font-semibold"><Users size={18} className="flex-shrink-0" style={{ color: T.teal }} />{t.cap}</div>
      {t.state === 'buy' && canBuy
        ? <Link to={to} className={`btn ${t.popular ? 'btn-primary' : 'btn-ghost'} w-full`} style={{ minHeight: 46 }}>{t.cta}</Link>
        : <button type="button" className="btn btn-ghost w-full" style={{ minHeight: 46 }} disabled>{t.state === 'buy' ? 'Chỉ chủ hội mua được' : t.cta}</button>}
      {t.reason && <span className="text-[14px]" style={{ color: T.goldText }}>{t.reason}</span>}
      <div className="flex flex-col gap-2.5 pt-1">
        {t.features.map((f) => (
          <div key={f.text} className="flex items-start gap-2.5 text-[14px]" style={{ color: f.on ? T.ink : T.ink3 }}>
            {f.on ? <Check size={18} className="flex-shrink-0 mt-0.5" style={{ color: T.teal }} /> : <Lock size={16} className="flex-shrink-0 mt-[3px]" />}
            <span>{f.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Compare({ plans }: { plans: PlanDef[] }) {
  const rows = compareRows(plans);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="serif m-0 text-[22px] font-extrabold">So sánh đầy đủ</h2>
      <div className="card table-scroll p-0">
        <table className="w-full text-[14px]" style={{ borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ background: T.bg }}>
              <th className="text-left font-semibold px-4 py-3">Mục</th>
              {plans.map((p) => <th key={p.key} className="text-left font-semibold px-4 py-3">{p.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={{ borderTop: `1px solid ${T.line}` }}>
                <td className="px-4 py-3" style={{ color: T.ink2 }}>{r.label}</td>
                {r.cells.map((c, i) => <td key={i} className="px-4 py-3 font-semibold" style={{ color: c.tone === 'on' ? T.tealText : c.tone === 'off' ? T.ink3 : T.ink }}>{c.text}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Chọn gói: thanh thành viên, các tab kỳ hạn đang bán, các thẻ gói bán kỳ đang chọn, ghi chú luật, bảng so sánh. */
function Choose({ s, cycles, cycle, setCycle, linkTo }: { s: PlanStatus; cycles: PlanCycle[]; cycle: PlanCycle; setCycle: (c: PlanCycle) => void; linkTo: (key: PlanKey) => string }) {
  const cards = tierCards(s.plans, s.plan, s.community.memberCount, cycle, new Date());
  const longest = cycles.at(-1);
  return (
    <>
      <HoiHeader s={s} />
      {cycles.length > 0
        ? (
          <div className="flex flex-col items-center gap-2.5 pt-2">
            <CycleTabs cycles={cycles} cycle={cycle} onPick={setCycle} note={longest ? cycleSaving(s.plans, longest) : ''} />
            <span className="text-[14px] text-center" style={{ color: T.ink3 }}>{cycleHint(s.plans, cycle)}</span>
          </div>
        )
        : <div className="text-[15px] rounded-[12px] px-4 py-3" style={{ background: T.goldSoft, color: T.goldText }}>Hội Mình hiện chưa mở bán gói trả phí. Bạn quay lại sau nhé.</div>}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 items-start">
        {cards.map((t) => <Tier key={t.key} t={t} to={linkTo(t.key)} canBuy={s.canBuy} />)}
      </div>
      <div className="flex flex-col gap-1.5 text-[14px]" style={{ color: T.ink3 }}>
        <span>Không có dùng thử: gói Miễn phí dùng vĩnh viễn, nâng lúc nào cũng được.</span>
        <span>Nâng gói thì số ngày còn lại của gói cũ được tặng sang gói mới.</span>
        <span>Mỗi tài khoản có một hội miễn phí. Hội thứ hai trở đi cần gói trả phí.</span>
      </div>
      <Compare plans={s.plans} />
    </>
  );
}

function PayModal({ open, onClose, s, target, cycle, price, note }: { open: boolean; onClose: () => void; s: PlanStatus; target: PlanDef; cycle: PlanCycle; price: string; note: string }) {
  const navigate = useNavigate();
  // Chỉ hiện cổng quản trị đã cài và đang bật; cổng mặc định được chọn sẵn.
  const methods = s.payment?.methods ?? [];
  const [picked, setPicked] = useState<Provider | null>(null);
  const provider = picked && methods.includes(picked) ? picked : initialMethod(methods, s.payment?.defaultMethod);
  const m = useMutation({
    mutationFn: () => api.post<{ orderId: string }>('/v1/checkout', { target: { type: 'platform', communityId: s.community.id, planKey: target.key, cycle }, provider: provider ?? undefined }),
    onSuccess: (r) => navigate(`/thanh-toan/${r.orderId}`),
  });
  return (
    <Modal open={open} onClose={onClose} title="Thanh toán gói Hội Mình" width={480} footer={(
      <div className="flex flex-col gap-2.5 px-5 py-4" style={{ borderTop: `1px solid ${T.line}` }}>
        {m.isError && <div className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
        <Button variant="primary" size="lg" block loading={m.isPending} disabled={!provider} onClick={() => m.mutate()}>Thanh toán {price}</Button>
        <div className="muted text-[13px] text-center">{note}</div>
      </div>
    )}>
      <div className="p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1 rounded-[12px] px-4 py-3" style={{ background: T.bg }}>
          <div className="flex items-baseline gap-3">
            <span className="font-semibold">Gói {target.name}, {cycleLabel(cycle)}</span>
            <span className="flex-grow" />
            <span className="serif text-[20px] font-extrabold">{price}</span>
          </div>
          <span className="muted text-[13px]">Cho hội {s.community.name}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold">Cách thanh toán</span>
          {methods.length
            ? <div className="grid-2" role="radiogroup" aria-label="Cách thanh toán">{methods.map((k) => <OptionCard key={k} on={provider === k} onClick={() => setPicked(k)} title={BUYER_METHOD_NAME[k]} />)}</div>
            : <div className="text-[14px] rounded-[12px] px-4 py-3" style={{ background: T.goldSoft, color: T.goldText }}>Hội Mình đang bảo trì cổng thanh toán, bạn quay lại sau ít phút nhé.</div>}
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, hint, value, strong, tone }: { label: string; hint?: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderTop: `1px solid ${T.line}` }}>
      <div className="flex flex-col min-w-0">
        <span className={strong ? 'font-bold text-[16px]' : 'text-[15px]'}>{label}</span>
        {hint && <span className="text-[13px]" style={{ color: T.ink3 }}>{hint}</span>}
      </div>
      <span className="flex-grow" />
      <span className={`${strong ? 'serif text-[20px] font-extrabold' : 'text-[15px] font-semibold'} whitespace-nowrap`} style={tone ? { color: tone } : undefined}>{value}</span>
    </div>
  );
}

/** Màn nâng gói: bảng tính ngày và tiền, nút thanh toán; bên cạnh là tình trạng mua được của từng gói với hội này. */
function Upgrade({ s, target, cycle, setCycle, backTo, linkTo, autoPay }: { s: PlanStatus; target: PlanDef; cycle: PlanCycle; setCycle: (c: PlanCycle) => void; backTo: string; linkTo: (key: PlanKey) => string; autoPay: boolean }) {
  // Vừa tạo hội thứ hai xong thì khung chọn cách trả mở sẵn (tham số tra=1), đỡ một lần bấm.
  const [paying, setPaying] = useState(autoPay);
  const now = new Date();
  const u = upgradeSummary(s.plan, target, s.community.memberCount, cycle, now);
  const cards = tierCards(s.plans, s.plan, s.community.memberCount, cycle, now);
  const state = s.plan.needsPlan ? 'chưa có gói' : s.plan.key === 'free' ? 'đang ở gói Miễn phí' : `đang ở gói ${s.plan.name}, còn ${s.plan.daysLeft} ngày`;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-[14px] self-start" style={{ color: T.ink3 }}><ChevronLeft size={16} />Các gói</Link>
        <h1 className="serif m-0 text-[28px] md:text-[32px] font-extrabold">{u.title}</h1>
        <div className="muted">{s.community.name} {state}.</div>
      </div>
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="card flex flex-col gap-4 p-5 md:p-6 w-full lg:flex-[1.3_1_0] min-w-0">
          <div className="self-start"><CycleTabs cycles={planCyclesOf(target)} cycle={cycle} onPick={setCycle} /></div>
          <div className="flex flex-col">
            <Row label={u.buyLabel} value={u.buyDays} />
            {u.carryLabel && <Row label={u.carryLabel} hint={u.carryHint} value={u.carryDays} tone={T.tealText} />}
            <Row label={`Dùng gói ${target.name}`} value={u.totalDays} />
            <Row label="Hết hạn ngày" value={u.endDate} />
            <Row label="Thanh toán hôm nay" value={u.price} strong />
          </div>
          {u.quote.ok && s.canBuy
            ? <Button variant="primary" size="lg" block onClick={() => setPaying(true)}>Thanh toán {u.price}</Button>
            : <div className="text-[14px] rounded-[12px] px-4 py-3" style={{ background: T.goldSoft, color: T.goldText }}>{!s.canBuy ? 'Chỉ chủ hội mua được gói.' : cards.find((c) => c.key === target.key)?.reason || 'Gói này chưa mua được cho hội.'}</div>}
          <p className="m-0 text-[14px]" style={{ color: T.ink3 }}>{u.note}</p>
        </div>
        <div className="flex flex-col gap-4 w-full lg:flex-1 min-w-0">
          <div className="card flex flex-col gap-1 p-5">
            <span className="font-bold text-[16px]">Các gói với hội này</span>
            <span className="text-[14px] pb-1" style={{ color: T.ink3 }}>Hội đang có {num(s.community.memberCount)} thành viên.</span>
            {cards.map((c) => {
              const here = c.key === target.key;
              const tag = c.state === 'blocked' ? (c.key === 'free' ? 'Tự về khi hết hạn' : 'Không mua được') : c.state === 'current' ? 'Đang dùng' : c.cta.startsWith('Gia hạn') ? 'Gia hạn' : c.cta.startsWith('Nâng') ? 'Nâng lên' : 'Chọn';
              const body = (
                <>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold" style={{ color: c.state === 'blocked' ? T.ink3 : T.ink }}>{c.name}</span>
                    <span className="text-[13px]" style={{ color: c.state === 'blocked' && c.key !== 'free' ? T.goldText : T.ink3 }}>{c.state === 'blocked' && c.key !== 'free' ? c.reason : c.cap}</span>
                  </div>
                  <span className="flex-grow" />
                  <Tag tone={c.state === 'blocked' ? 'neutral' : here ? 'gold' : 'teal'}>{here && c.state === 'buy' ? 'Đang chọn' : tag}</Tag>
                </>
              );
              return c.state === 'buy' && !here
                ? <Link key={c.key} to={linkTo(c.key)} className="flex items-center gap-3 py-2.5" style={{ borderTop: `1px solid ${T.line}`, color: T.ink }}>{body}</Link>
                : <div key={c.key} className="flex items-center gap-3 py-2.5" style={{ borderTop: `1px solid ${T.line}` }}>{body}</div>;
            })}
          </div>
          <div className="card flex flex-col gap-1.5 p-5 text-[14px]" style={{ color: T.ink2 }}>
            <span className="font-bold text-[15px]" style={{ color: T.ink }}>Về việc hạ gói</span>
            <span>Mua được gói thấp hơn khi hết kỳ đang trả, và khi số thành viên không vượt trần của gói đó.</span>
            <span>Số ngày tặng chỉ có khi đi lên gói cao hơn.</span>
          </div>
        </div>
      </div>
      <PayModal open={paying} onClose={() => setPaying(false)} s={s} target={target} cycle={cycle} price={u.price} note={u.note} />
    </>
  );
}

function PlanOf({ communityId, owned }: { communityId: string; owned: WorkspaceHome['owned'] }) {
  const [params, setParams] = useSearchParams();
  const q = useQuery(planStatusQuery(communityId));
  const cycleParam = planCycleSchema.safeParse(params.get('ky'));
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) if (v === null) next.delete(k); else next.set(k, v);
    setParams(next, { replace: true });
  };
  return (
    <QueryState q={q} rows={4}>
      {(s) => {
        // Chỉ các kỳ quản trị đang bán (giá lớn hơn 0) mới hiện. Kỳ mặc định: kỳ trên địa chỉ, rồi kỳ đang trả, chưa trả
        // lần nào thì 1 năm (rẻ hơn mỗi tháng); kỳ đó không còn bán thì lấy kỳ dài nhất đang bán.
        const wanted = [cycleParam.success ? cycleParam.data : null, s.cycle, 'yearly' as const];
        const cycles = soldCycles(s.plans);
        const cycle: PlanCycle = pickCycle(cycles, ...wanted) ?? 'yearly';
        const picked = params.get('goi') ?? '';
        const found = isPlanKey(picked) && picked !== 'free' ? s.plans.find((p) => p.key === picked) ?? null : null;
        // Gói không bán kỳ nào (mọi giá đều 0) thì không có màn mua: quay về danh sách gói.
        const targetCycle = found ? pickCycle(planCyclesOf(found), ...wanted) : null;
        const base = `/admin/goi?hoi=${s.community.slug}`;
        const linkTo = (key: PlanKey) => `${base}&goi=${key}&ky=${targetCycle ?? cycle}`;
        if (found && targetCycle) return <Upgrade s={s} target={found} cycle={targetCycle} setCycle={(c) => set({ ky: c })} backTo={`${base}&ky=${targetCycle}`} linkTo={linkTo} autoPay={params.get('tra') === '1' && s.canBuy} />;
        return (
          <>
            <div className="flex flex-col gap-2">
              <Link to="/admin" className="inline-flex items-center gap-1.5 text-[14px] self-start" style={{ color: T.ink3 }}><ChevronLeft size={16} />Hội của tôi</Link>
              <h1 className="serif m-0 text-[28px] md:text-[32px] font-extrabold">Gói cho hội của bạn</h1>
              <div className="muted">Mỗi gói dùng cho một hội. Không thu phí trên doanh thu ở bất kỳ gói nào.</div>
            </div>
            {owned.length > 1 && (
              <div className="chip-row" role="tablist" aria-label="Chọn hội">
                {owned.map((c) => (
                  <Link key={c.id} to={`/admin/goi?hoi=${c.slug}`} role="tab" aria-selected={c.id === communityId} className={`chip ${c.id === communityId ? 'on' : ''}`}>{c.name}</Link>
                ))}
              </div>
            )}
            <Choose s={s} cycles={cycles} cycle={cycle} setCycle={(c) => set({ ky: c })} linkTo={linkTo} />
          </>
        );
      }}
    </QueryState>
  );
}

export default function Page() {
  const [params] = useSearchParams();
  const q = useQuery({ queryKey: WS_HOME_KEY, queryFn: () => api.get<WorkspaceHome>('/v1/me/workspace') });
  return (
    <QueryState q={q} rows={4}>
      {(d) => {
        // Chưa có hội nào thì chưa có gì để chọn gói: về Hội của tôi để tạo hội đầu tiên.
        const hoi = d.owned.find((c) => c.slug === params.get('hoi')) ?? d.owned[0];
        if (!hoi) return <Navigate to="/admin" replace />;
        return (
          <div className="w-full mx-auto flex flex-col gap-5" style={{ maxWidth: 1180 }}>
            <PlanOf key={hoi.id} communityId={hoi.id} owned={d.owned} />
          </div>
        );
      }}
    </QueryState>
  );
}
