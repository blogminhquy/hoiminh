// Mảnh Giá và gói: thẻ kiểu thu phí (modeCard), thẻ gói (tierCard) có sửa kỳ hạn, giá, quyền lợi, bật/tắt, và thẻ khuyến mãi.
import { MAX_TIER_TERMS, SUGGESTED_TERM_MONTHS, applyPromo, normalizeTerms, perMonth, promoActive, termSavingPercent, type PricingPromo, type TierTerm } from '@hoiminh/contracts';
import { Check, Plus, Tag, X } from 'lucide-react';
import { OptionCard, T, Toggle, money } from '@hoiminh/ui';

export type Mode = 'free' | 'freemium' | 'subscription' | 'one_time';
export interface Tier { id?: string; key: 'standard' | 'premium' | 'vip'; name: string; description: string; benefits: string[]; isDefault: boolean; isActive: boolean; monthlyMinor: number | null; yearlyMinor: number | null; oneTimeMinor: number | null; /** Các kỳ hạn đang bán: số tháng và giá. Dòng chưa nhập giá (0) không được lưu. */ terms: TierTerm[] }
export const MODES: Array<[Mode, string, string]> = [['free', 'Miễn phí', 'Ai cũng vào được'], ['subscription', 'Thu phí', 'Theo kỳ hạn 1, 3, 6, 12 tháng'], ['freemium', 'Freemium', 'Vào miễn phí, nâng cấp gói'], ['one_time', 'Trả một lần', 'Truy cập trọn đời']];
export const DEFAULT_TIERS: Tier[] = [
  { key: 'standard', name: 'Tiêu chuẩn', description: 'Mặc định khi tham gia', benefits: ['Đọc và đăng bài trên Bảng tin', 'Module 1 của mọi khóa học'], isDefault: true, isActive: true, monthlyMinor: null, yearlyMinor: null, oneTimeMinor: null, terms: [] },
  { key: 'premium', name: 'Premium', description: '', benefits: ['Mở khóa toàn bộ khóa học', 'Trở thành affiliate', 'Q&A hàng tuần'], isDefault: false, isActive: true, monthlyMinor: 249_000, yearlyMinor: 2_490_000, oneTimeMinor: null, terms: [{ months: 1, amountMinor: 249_000 }, { months: 12, amountMinor: 2_490_000 }] },
  { key: 'vip', name: 'VIP', description: '', benefits: ['Coaching 1-1 hàng tuần'], isDefault: false, isActive: false, monthlyMinor: 2_500_000, yearlyMinor: null, oneTimeMinor: null, terms: [{ months: 1, amountMinor: 2_500_000 }] },
];

export function ModePicker({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">{MODES.map(([k, t, s]) => <OptionCard key={k} on={value === k} onClick={() => onChange(k)} title={t} sub={s} />)}</div>;
}

function PriceInput({ value, onChange, suffix, dark }: { value: number | null; onChange: (v: number | null) => void; suffix: string; dark: boolean }) {
  return (
    <label className="flex items-center gap-1.5 text-[13px]" style={{ color: dark ? T.sideText : T.ink3 }}>
      <input type="number" inputMode="numeric" min={0} step={1000} value={value ?? ''} placeholder="0" onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} className="w-[120px] text-[15px] font-bold rounded-md px-2 py-1.5" style={{ background: dark ? 'rgba(255,253,249,0.1)' : T.bg, color: dark ? T.surface : T.ink, border: 0 }} />
      {suffix}
    </label>
  );
}

/** Số tháng gợi ý cho dòng "kỳ khác": số nhỏ nhất chưa dùng. */
function nextFreeMonths(terms: TierTerm[]): number {
  const used = new Set(terms.map((t) => t.months));
  for (let m = 2; m <= 36; m++) if (!used.has(m)) return m;
  return 1;
}

/**
 * Bảng kỳ hạn của một gói: mỗi dòng là "mấy tháng, bao nhiêu tiền". Thêm nhanh 1, 3, 6, 12 tháng hoặc tự nhập số tháng.
 * Dòng mới được điền sẵn giá bằng giá mua lẻ từng tháng, chủ hội hạ xuống để khuyến khích mua dài.
 */
function TermsEditor({ terms, onChange, dark }: { terms: TierTerm[]; onChange: (t: TierTerm[]) => void; dark: boolean }) {
  const valid = normalizeTerms(terms);
  const base = valid[0];
  const set = (i: number, p: Partial<TierTerm>) => onChange(terms.map((t, j) => (j === i ? { ...t, ...p } : t)));
  const add = (months: number) => onChange([...terms, { months, amountMinor: base ? Math.round((base.amountMinor / base.months) * months) : 0 }]);
  const used = new Set(terms.map((t) => t.months));
  const quick = SUGGESTED_TERM_MONTHS.filter((m) => !used.has(m));
  const soft = dark ? T.sideText : T.ink3;
  const field = { background: dark ? 'rgba(255,253,249,0.1)' : T.bg, color: dark ? T.surface : T.ink, border: 0 } as const;
  return (
    <div className="flex flex-col gap-2">
      {terms.length === 0 && <div className="text-[13px]" style={{ color: soft }}>Chưa có kỳ hạn nào. Thêm ít nhất một kỳ để bán gói này.</div>}
      {terms.map((t, i) => {
        const dup = terms.findIndex((x) => x.months === t.months) !== i;
        const saving = t.amountMinor > 0 ? termSavingPercent(valid, t.months) : 0;
        return (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-[13px]" style={{ color: soft }}>
              <input type="number" inputMode="numeric" min={1} max={36} aria-label="Số tháng" value={t.months} onChange={(e) => set(i, { months: Math.min(36, Math.max(1, Math.round(Number(e.target.value) || 1))) })} className="w-[46px] text-[15px] font-bold rounded-md px-1.5 py-1.5 text-center" style={field} />
              tháng
              <input type="number" inputMode="numeric" min={0} step={1000} aria-label={`Giá ${t.months} tháng`} value={t.amountMinor || ''} placeholder="0" onChange={(e) => set(i, { amountMinor: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className="w-[112px] text-[15px] font-bold rounded-md px-2 py-1.5 ml-1" style={field} />
              đ
              <button type="button" aria-label={`Bỏ kỳ ${t.months} tháng`} className="ml-auto p-1" onClick={() => onChange(terms.filter((_, j) => j !== i))} style={{ color: dark ? T.sideMuted : T.ink3 }}><X size={14} /></button>
            </div>
            {dup ? <div className="text-[12px]" style={{ color: T.accentText }}>Trùng số tháng với dòng trên, chỉ dòng sau được lưu.</div>
              : t.amountMinor > 0 && t.months > 1 ? <div className="text-[12px]" style={{ color: soft }}>{money(perMonth(t))} mỗi tháng{saving > 0 ? <span style={{ color: T.teal }}> · rẻ hơn {saving}%</span> : null}</div> : null}
          </div>
        );
      })}
      {terms.length < MAX_TIER_TERMS && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {quick.map((m) => <button key={m} type="button" className="tag" style={{ background: dark ? 'rgba(255,253,249,0.12)' : T.bg, color: dark ? T.surface : T.ink2 }} onClick={() => add(m)}>+ {m} tháng</button>)}
          <button type="button" className="tag" style={{ background: 'transparent', color: T.teal }} onClick={() => add(nextFreeMonths(terms))}>+ Kỳ khác</button>
        </div>
      )}
    </div>
  );
}

export function TierCard({ t, mode, onChange }: { t: Tier; mode: Mode; onChange: (t: Tier) => void }) {
  const dark = t.key === 'vip';
  const free = t.key === 'standard';
  const patch = (p: Partial<Tier>) => onChange({ ...t, ...p });
  const setBenefit = (i: number, v: string | null) => patch({ benefits: v === null ? t.benefits.filter((_, j) => j !== i) : t.benefits.map((b, j) => (j === i ? v : b)) });
  return (
    <div className={`card flex-1 min-w-[260px] p-5 flex flex-col gap-3${dark ? ' card-invert' : ''}`}>
      <div className="flex items-center justify-between gap-2"><input value={t.name} maxLength={40} onChange={(e) => patch({ name: e.target.value })} className="font-semibold text-[15px] bg-transparent min-w-0 flex-grow" style={{ color: 'inherit' }} />{!free && <Toggle label={`Bán gói ${t.name}`} on={t.isActive} onChange={(isActive) => patch({ isActive })} />}</div>
      {free ? <div><div className="serif text-[24px] font-bold">Miễn phí</div><div className="text-[12px]" style={{ color: T.ink3 }}>Mặc định khi tham gia</div></div>
        : mode === 'one_time' ? <PriceInput value={t.oneTimeMinor} onChange={(oneTimeMinor) => patch({ oneTimeMinor })} suffix="đ một lần" dark={dark} />
          : <TermsEditor terms={t.terms} onChange={(terms) => patch({ terms })} dark={dark} />}
      <div className="flex flex-col gap-1.5 text-[13px]" style={{ color: dark ? T.sideText : T.ink2 }}>
        {t.benefits.map((b, i) => <div key={i} className="flex items-center gap-2"><span style={{ color: T.teal }}><Check size={14} /></span><input value={b} maxLength={120} onChange={(e) => setBenefit(i, e.target.value)} className="flex-grow bg-transparent min-w-0" style={{ color: 'inherit' }} /><button type="button" aria-label="Bỏ" onClick={() => setBenefit(i, null)} style={{ color: dark ? T.sideMuted : T.ink3 }}><X size={12} /></button></div>)}
        {t.benefits.length < 12 && <button type="button" className="flex items-center gap-2 text-left" style={{ color: T.teal }} onClick={() => patch({ benefits: [...t.benefits, ''] })}><Plus size={14} />Thêm quyền lợi</button>}
      </div>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Ngày hết khuyến mãi (ISO) sang giá trị ô chọn ngày, theo giờ máy người dùng. */
const toDateInput = (iso: string | null): string => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
/** Ô chọn ngày sang ISO: khuyến mãi chạy tới hết ngày đó. */
const fromDateInput = (v: string): string | null => { const [y, m, d] = v.split('-').map(Number); return y && m && d ? new Date(y, m - 1, d, 23, 59, 59).toISOString() : null; };

/**
 * Thẻ khuyến mãi: một công tắc, một con số phần trăm, một ngày hết (có thể bỏ trống). Giảm cho mọi kỳ hạn và giá trả một lần.
 * `sample` là một giá đang bán để ghi ví dụ "399.000đ còn 319.200đ".
 */
export function PromoCard({ promo, onChange, sample }: { promo: PricingPromo | null; onChange: (p: PricingPromo | null) => void; sample: { label: string; amountMinor: number } | null }) {
  const now = new Date();
  const expired = Boolean(promo) && !promoActive(promo, now);
  return (
    <div className="card flex flex-col gap-3" style={{ padding: '16px 20px' }}>
      <div className="flex items-center gap-2.5">
        <Tag size={18} className="flex-shrink-0" />
        <div className="flex flex-col flex-grow min-w-0">
          <span className="font-semibold">Khuyến mãi</span>
          <span className="muted text-[14px]">Giảm giá mọi kỳ hạn của gói trả phí. Người mua thấy giá gốc gạch đi và giá mới.</span>
        </div>
        <Toggle label="Bật khuyến mãi" on={Boolean(promo)} onChange={(on) => onChange(on ? { percentOff: 20, endsAt: null } : null)} />
      </div>
      {promo && (
        <div className="flex flex-col gap-3 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
          <div className="flex items-center gap-2 flex-wrap text-[14px]">
            <span>Giảm</span>
            <input type="number" inputMode="numeric" min={1} max={90} aria-label="Phần trăm giảm" value={promo.percentOff} onChange={(e) => onChange({ ...promo, percentOff: Math.min(90, Math.max(1, Math.round(Number(e.target.value) || 1))) })} className="w-[64px] text-[15px] font-bold rounded-md px-2 py-1.5 text-center" style={{ background: T.bg, color: T.ink, border: 0 }} />
            <span>%</span>
            {[10, 20, 30, 50].map((n) => <button key={n} type="button" className="tag" style={{ background: promo.percentOff === n ? T.ink : T.bg, color: promo.percentOff === n ? T.surface : T.ink2 }} onClick={() => onChange({ ...promo, percentOff: n })}>{n}%</button>)}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[14px]">
            <span>Đến hết ngày</span>
            <input type="date" aria-label="Ngày hết khuyến mãi" value={toDateInput(promo.endsAt)} onChange={(e) => onChange({ ...promo, endsAt: fromDateInput(e.target.value) })} className="text-[15px] rounded-md px-2 py-1.5" style={{ background: T.bg, color: T.ink, border: 0 }} />
            {promo.endsAt ? <button type="button" className="text-[13px] underline" style={{ color: T.ink3 }} onClick={() => onChange({ ...promo, endsAt: null })}>Bỏ ngày hết</button> : <span className="muted text-[13px]">Để trống thì chạy tới khi bạn tắt</span>}
          </div>
          {expired && <div className="px-3 py-2 rounded-lg text-[13px]" style={{ background: T.goldSoft, color: T.goldDark }}>Khuyến mãi này đã hết hạn, người mua đang trả giá gốc. Chọn ngày mới hoặc tắt đi.</div>}
          {!expired && sample && <div className="text-[13px]" style={{ color: T.ink2 }}>Ví dụ: {sample.label} <span className="line-through muted">{money(sample.amountMinor)}</span> còn <strong>{money(applyPromo(sample.amountMinor, promo, now).payMinor)}</strong></div>}
        </div>
      )}
    </div>
  );
}
