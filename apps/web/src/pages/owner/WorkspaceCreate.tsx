// Tạo hội của bạn (wsCreateMain): Tên → Đường dẫn → Mô tả → Kiểu thu phí → Mẫu → Xong, thẻ 720px giữa trang.
// Mỗi tài khoản có một hội miễn phí. Tài khoản đã dùng suất đó thì có thêm bước "Gói": chọn gói trả phí và chu kỳ,
// hội được tạo ở trạng thái chờ thanh toán rồi chuyển thẳng sang màn thanh toán gói. Không có dùng thử.
// Bước "Gói" vẫn hiện gói Miễn phí (xám, không chọn được, ghi rõ chỉ một hội miễn phí) và chọn sẵn gói Chuyên nghiệp.
// Tài khoản quản trị hệ thống không bị giới hạn này: máy chủ báo freeSlotUsed = false nên đi luồng hội miễn phí.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, T, Textarea, money } from '@hoiminh/ui';
import { PLAN_FEATURE_LABEL, pickCycle, planPerMonth, planPrice, planSells, soldCycles, toSlug, type PlanCycle, type PlanDef, type PlanKey } from '@hoiminh/contracts';
import { Check, ChevronLeft, ChevronRight, Info, Lock } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { capLabel, cycleHint, cycleLabel, featureFrom, featureInline } from '@/lib/platform-plan';
import { WS_HOME_KEY, type WorkspaceHome } from './WorkspaceHomeParts';
import { Done, ModePicker, STEPS, SlugInput, StepBar, TemplatePicker, useSlugCheck, type PricingMode, type Template } from './WorkspaceCreateParts';
import { PLANS_QUERY } from './WorkspacePlanCard';

interface Draft { name: string; slug: string; slugTouched: boolean; shortDescription: string; pricingMode: PricingMode; template: Template; planKey: PlanKey; cycle: PlanCycle }
interface Created { id: string; slug: string; name: string; needsPlan: boolean }

const FREE_STEPS: readonly string[] = STEPS;
const PAID_STEPS: readonly string[] = [...STEPS.slice(0, 5), 'Gói', 'Xong'];

/**
 * Phần sau trần thành viên trên dòng gói, đọc từ tính năng thật của gói (quản trị bật tắt được ở Hệ thống > Gói):
 * gói có đủ mọi thứ của gói ngay dưới thì ghi "có mọi thứ của gói dưới, thêm ...", không thì kê các tính năng.
 */
function planExtra(plans: PlanDef[], p: PlanDef): string {
  const list = (fs: PlanDef['features']) => fs.map((f) => featureInline(f)).join(', ');
  const below = plans[plans.findIndex((x) => x.key === p.key) - 1];
  if (below && below.features.length && below.features.every((f) => p.features.includes(f))) {
    const added = p.features.filter((f) => !below.features.includes(f));
    return `, có mọi thứ của ${below.name}${added.length ? `, thêm ${list(added)}` : ''}`;
  }
  return p.features.length ? `, có ${list(p.features)}` : '';
}

/** Gói được chọn sẵn và làm nổi ở bước "Gói": gói hợp với đa số hội trả phí. */
const RECOMMENDED_PLAN: PlanKey = 'pro';

/**
 * Bước "Gói" của hội thứ hai trở đi. Gói Miễn phí đứng đầu nhưng xám và không chọn được (mỗi tài khoản một hội miễn phí,
 * đã dùng cho `freeHoi`). Sau đó là các gói trả phí bán kỳ đang chọn; gói Chuyên nghiệp có nhãn, viền nổi và kê đủ tính năng.
 */
function PlanStep({ plans, planKey, cycle, freeHoi, onPlan, onCycle }: { plans: PlanDef[]; planKey: PlanKey; cycle: PlanCycle; freeHoi: string | null; onPlan: (k: PlanKey) => void; onCycle: (c: PlanCycle) => void }) {
  const cycles = soldCycles(plans);
  const paid = plans.filter((p) => p.key !== 'free' && planSells(p, cycle));
  const free = plans.find((p) => p.key === 'free');
  if (!cycles.length) return <div className="text-[15px] rounded-[12px] px-4 py-3" style={{ background: T.goldSoft, color: T.goldText }}>Hội Mình hiện chưa mở bán gói trả phí nên chưa tạo thêm hội được. Bạn quay lại sau nhé.</div>;
  return (
    <div className="flex flex-col gap-4">
      <span className="font-semibold text-[16px]">Gói cho hội này</span>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Gói cho hội này">
        {free && (
          <div role="radio" aria-checked={false} aria-disabled="true" className="flex items-center gap-3 rounded-[14px] px-4 py-3.5" style={{ border: `1.5px dashed ${T.line2}`, background: T.bg, minHeight: 64 }}>
            <span className="w-5 h-5 flex-shrink-0 inline-flex items-center justify-center" style={{ color: T.ink3 }}><Lock size={18} /></span>
            <span className="flex flex-col flex-grow min-w-0" style={{ color: T.ink3 }}>
              <span className="font-bold text-[16px]">{free.name}<span className="sm:hidden"> · {money(0)}</span></span>
              <span className="text-[14px]">Mỗi tài khoản chỉ được tạo 1 hội miễn phí.{freeHoi ? ` Bạn đã dùng cho hội ${freeHoi}.` : ''}</span>
            </span>
            <span className="hidden sm:block font-bold text-[15px] whitespace-nowrap" style={{ color: T.ink3 }}>{money(0)}</span>
          </div>
        )}
        {paid.map((p) => {
          const on = p.key === planKey;
          const best = p.key === RECOMMENDED_PLAN;
          const extra = planExtra(plans, p);
          const border = on ? T.teal : best ? T.gold : T.line2;
          return (
            <button key={p.key} type="button" role="radio" aria-checked={on} onClick={() => onPlan(p.key)} className="relative flex items-center gap-3 text-left rounded-[14px] px-4" style={{ border: `${best ? 2 : 1.5}px solid ${border}`, background: on ? T.tealSoft : T.surface, minHeight: 64, paddingTop: best ? 20 : 14, paddingBottom: 14 }}>
              {/* Nhãn chỉ để nhìn; trình đọc màn hình đọc nó sau tên gói, để tên của lựa chọn vẫn bắt đầu bằng tên gói. */}
              {best && <span className="tag absolute" aria-hidden="true" style={{ top: -12, left: 16, background: T.gold, color: T.invertBg }}>Dành cho đa số</span>}
              <span className="w-5 h-5 rounded-full flex-shrink-0 inline-flex items-center justify-center self-start mt-0.5" style={{ border: `2px solid ${on ? T.teal : T.line2}` }}>{on && <span className="w-2.5 h-2.5 rounded-full" style={{ background: T.teal }} />}</span>
              <span className="flex flex-col flex-grow min-w-0 gap-0.5">
                <span className="font-bold text-[16px]">{p.name}{best && <span className="sr-only">, dành cho đa số</span>}</span>
                {/* Điện thoại: giá nằm ngay dưới tên gói, để chữ mô tả có đủ bề ngang. */}
                <span className="sm:hidden font-bold text-[15px]">{money(planPerMonth(p, cycle))}/tháng</span>
                {best ? (
                  <>
                    <span className="text-[14px]" style={{ color: T.ink3 }}>{capLabel(p.memberCap)}</span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                      {p.features.map((f) => <span key={f} className="inline-flex items-center gap-1 text-[14px] font-semibold" style={{ color: T.tealText }}><Check size={15} aria-hidden="true" />{PLAN_FEATURE_LABEL[f]}</span>)}
                    </span>
                  </>
                ) : <span className="text-[14px]" style={{ color: T.ink3 }}>{capLabel(p.memberCap)}{extra}</span>}
              </span>
              <span className="hidden sm:block font-bold text-[15px] whitespace-nowrap self-start mt-0.5">{money(planPerMonth(p, cycle))}/tháng</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[15px] font-semibold">Trả theo</span>
        <div className="seg" role="tablist" aria-label="Chu kỳ thanh toán">
          {cycles.map((c) => <button key={c} type="button" role="tab" aria-selected={cycle === c} className={cycle === c ? 'on' : undefined} onClick={() => onCycle(c)}>{cycleLabel(c)}</button>)}
        </div>
      </div>
      <span className="text-[14px]" style={{ color: T.ink3 }}>{cycleHint(plans, cycle)}</span>
    </div>
  );
}

export default function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const home = useQuery({ queryKey: WS_HOME_KEY, queryFn: () => api.get<WorkspaceHome>('/v1/me/workspace') });
  const plans = useQuery(PLANS_QUERY);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({ name: '', slug: '', slugTouched: false, shortDescription: '', pricingMode: 'freemium', template: 'course', planKey: RECOMMENDED_PLAN, cycle: 'quarterly' });
  const [created, setCreated] = useState<Created | null>(null);
  const check = useSlugCheck(d.slug);
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));
  // Tài khoản đã có hội miễn phí: hội này phải chọn gói trả phí và thanh toán ngay khi tạo.
  const paid = home.data?.freeSlotUsed === true;
  const freeHoi = home.data?.owned.find((c) => c.plan.isFreeSlot);
  const steps = paid ? PAID_STEPS : FREE_STEPS;
  const last = steps.length - 1; // bước "Xong"
  const createAt = last - 1; // bước cuối trước khi tạo
  // Chỉ bán kỳ có giá lớn hơn 0: kỳ đang chọn không còn bán thì lấy kỳ dài nhất đang bán, gói đang chọn không bán kỳ
  // đó thì lấy gói thấp nhất có bán.
  const cycle = pickCycle(soldCycles(plans.data ?? []), d.cycle) ?? d.cycle;
  const sellable = (plans.data ?? []).filter((p) => p.key !== 'free' && planSells(p, cycle));
  const picked = sellable.find((p) => p.key === d.planKey) ?? sellable[0];
  const total = picked ? money(planPrice(picked, cycle)) : '';
  const m = useMutation({
    mutationFn: () => api.post<Created>('/v1/communities', { name: d.name.trim(), slug: d.slug, shortDescription: d.shortDescription.trim(), pricingMode: d.pricingMode, template: d.template }),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: WS_HOME_KEY });
      // Hội chờ thanh toán: sang thẳng màn thanh toán gói đã chọn, khung chọn cách trả mở sẵn.
      if (c.needsPlan) navigate(picked ? `/admin/goi?hoi=${c.slug}&goi=${picked.key}&ky=${cycle}&tra=1` : `/admin/goi?hoi=${c.slug}`);
      else { setCreated(c); setStep(last); }
    },
  });

  const valid = [d.name.trim().length >= 3, d.slug.length >= 3 && check.data?.available === true, d.shortDescription.trim().length > 0, true, true, paid ? Boolean(picked) : true, true][step] ?? false;
  const next = () => { if (step === createAt) m.mutate(); else setStep((s) => Math.min(s + 1, last)); };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center flex flex-col gap-1.5">
        <h1 className="serif m-0 text-[32px] font-extrabold">{paid ? 'Tạo hội mới' : 'Tạo hội của bạn'}</h1>
        <div className="muted">{paid ? 'Điền thông tin hội, rồi chọn gói cho hội này.' : 'Sáu bước, xong trong 2 phút. Mọi thứ đổi được sau.'}</div>
      </div>
      {paid && (
        <div className="card w-full flex items-start gap-3 p-4" style={{ maxWidth: 720, background: T.goldSoft, borderColor: 'transparent' }}>
          <Info size={20} className="flex-shrink-0 mt-0.5" style={{ color: T.goldText }} />
          <div className="flex flex-col gap-0.5 text-[14px]" style={{ color: T.goldText }}>
            <span className="font-bold text-[15px]">Tài khoản của bạn đã có một hội miễn phí</span>
            <span>Mỗi tài khoản được một hội miễn phí{freeHoi ? ` (${freeHoi.name})` : ''}. Hội thứ hai trở đi cần chọn gói trả phí và thanh toán ngay khi tạo, không có dùng thử.</span>
          </div>
        </div>
      )}
      <StepBar current={step} steps={steps} />
      <div className="card w-full flex flex-col gap-5 p-6 md:p-8" style={{ maxWidth: 720 }}>
        {step === 0 && (
          <Field label="Tên hội" hint="Ngắn gọn, dễ nhớ. Ví dụ: AI Agent cho chủ shop">
            <Input autoFocus value={d.name} onChange={(e) => patch({ name: e.target.value, slug: d.slugTouched ? d.slug : toSlug(e.target.value) })} placeholder="Tên hội của bạn" />
          </Field>
        )}
        {step === 1 && (
          <Field label="Đường dẫn" hint={`Tên miền riêng trỏ được sau trong Cài đặt hội (có từ gói ${featureFrom(plans.data, 'custom_domain')})`}>
            <SlugInput value={d.slug} onChange={(v) => patch({ slug: v, slugTouched: true })} check={check} />
          </Field>
        )}
        {step === 2 && (
          <Field label="Hội này dành cho ai, giúp họ đạt gì?" hint="Hiện trên trang Khám phá và trang giới thiệu hội">
            <Textarea autoFocus value={d.shortDescription} maxLength={160} onChange={(e) => patch({ shortDescription: e.target.value })} style={{ minHeight: 88 }} placeholder="Chủ shop nhỏ muốn dựng trợ lý AI trả lời khách, chốt đơn và chăm sóc sau bán mà không cần thuê thêm người." />
          </Field>
        )}
        {step === 3 && (
          <Field label="Kiểu thu phí" hint="Chọn Freemium nếu chưa chắc, đổi được bất cứ lúc nào"><ModePicker value={d.pricingMode} onChange={(pricingMode) => patch({ pricingMode })} /></Field>
        )}
        {step === 4 && (
          <Field label="Mẫu khởi đầu" hint="Mẫu chỉ chọn sẵn tab và không gian, bạn sửa được toàn bộ"><TemplatePicker value={d.template} onChange={(template) => patch({ template })} /></Field>
        )}
        {paid && step === 5 && (
          plans.data
            ? <PlanStep plans={plans.data} planKey={picked?.key ?? d.planKey} cycle={cycle} freeHoi={freeHoi?.name ?? null} onPlan={(planKey) => patch({ planKey })} onCycle={(next) => patch({ cycle: next })} />
            : <div className="text-[14px]" style={{ color: T.accentText }}>{plans.isError ? 'Chưa tải được bảng gói. Tải lại trang để thử lại.' : 'Đang tải bảng gói...'}</div>
        )}
        {step === last && created && <Done slug={created.slug} name={created.name} />}
        {paid && step === createAt && picked && (
          <div className="flex items-baseline gap-3 rounded-[12px] px-4 py-3" style={{ background: T.bg }}>
            <span className="font-semibold">Gói {picked.name}, {cycleLabel(cycle)}</span>
            <span className="flex-grow" />
            <span className="serif text-[20px] font-extrabold">{total}</span>
          </div>
        )}
        {m.isError && <div className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
        {step < last && (
          <div className="flex items-center gap-3 pt-2 flex-wrap" style={{ borderTop: `1px solid ${T.line}` }}>
            <Button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ChevronLeft size={16} /> Quay lại</Button>
            <span className="flex-grow" />
            <span className="muted text-[13px] hide-mobile">{paid ? 'Hội được mở ngay khi tiền về' : 'Hội đầu tiên miễn phí, dùng vĩnh viễn'}</span>
            <Button variant="primary" disabled={!valid || home.isPending} loading={m.isPending} onClick={next}>{step === createAt ? (paid ? `Tạo hội và thanh toán ${total}` : 'Tạo hội') : 'Tiếp tục'} <ChevronRight size={16} /></Button>
          </div>
        )}
      </div>
    </div>
  );
}
