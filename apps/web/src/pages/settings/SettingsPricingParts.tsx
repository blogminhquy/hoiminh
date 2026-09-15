// Mảnh Giá và gói: thẻ kiểu thu phí (modeCard) và thẻ gói (tierCard) có sửa giá, quyền lợi, bật/tắt.
import { Check, Plus, X } from 'lucide-react';
import { OptionCard, T, Toggle } from '@hoiminh/ui';

export type Mode = 'free' | 'freemium' | 'subscription' | 'one_time';
export interface Tier { id?: string; key: 'standard' | 'premium' | 'vip'; name: string; description: string; benefits: string[]; isDefault: boolean; isActive: boolean; monthlyMinor: number | null; yearlyMinor: number | null; oneTimeMinor: number | null }
export const MODES: Array<[Mode, string, string]> = [['free', 'Miễn phí', 'Ai cũng vào được'], ['subscription', 'Thu phí', 'Theo tháng hoặc năm'], ['freemium', 'Freemium', 'Vào miễn phí, nâng cấp gói'], ['one_time', 'Trả một lần', 'Truy cập trọn đời']];
export const DEFAULT_TIERS: Tier[] = [
  { key: 'standard', name: 'Tiêu chuẩn', description: 'Mặc định khi tham gia', benefits: ['Đọc và đăng bài trên Bảng tin', 'Module 1 của mọi khóa học'], isDefault: true, isActive: true, monthlyMinor: null, yearlyMinor: null, oneTimeMinor: null },
  { key: 'premium', name: 'Premium', description: '', benefits: ['Mở khóa toàn bộ khóa học', 'Trở thành cộng sự', 'Q&A hàng tuần'], isDefault: false, isActive: true, monthlyMinor: 249_000, yearlyMinor: 2_490_000, oneTimeMinor: null },
  { key: 'vip', name: 'VIP', description: '', benefits: ['Coaching 1-1 hàng tuần'], isDefault: false, isActive: false, monthlyMinor: 2_500_000, yearlyMinor: null, oneTimeMinor: null },
];

export function ModePicker({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">{MODES.map(([k, t, s]) => <OptionCard key={k} on={value === k} onClick={() => onChange(k)} title={t} sub={s} />)}</div>;
}

function PriceInput({ value, onChange, suffix, dark }: { value: number | null; onChange: (v: number | null) => void; suffix: string; dark: boolean }) {
  return (
    <label className="flex items-center gap-1.5 text-[12px]" style={{ color: dark ? T.sideText : T.ink3 }}>
      <input type="number" min={0} step={1000} value={value ?? ''} placeholder="—" onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} className="w-[110px] text-[14px] font-bold rounded-md px-2 py-1" style={{ background: dark ? 'rgba(255,253,249,0.1)' : T.bg, color: dark ? T.surface : T.ink, border: 0 }} />
      {suffix}
    </label>
  );
}

export function TierCard({ t, mode, onChange }: { t: Tier; mode: Mode; onChange: (t: Tier) => void }) {
  const dark = t.key === 'vip';
  const free = t.key === 'standard';
  const patch = (p: Partial<Tier>) => onChange({ ...t, ...p });
  const setBenefit = (i: number, v: string | null) => patch({ benefits: v === null ? t.benefits.filter((_, j) => j !== i) : t.benefits.map((b, j) => (j === i ? v : b)) });
  return (
    <div className="card flex-1 p-5 flex flex-col gap-3" style={dark ? { background: T.ink, color: T.surface, borderColor: T.ink } : undefined}>
      <div className="flex items-center justify-between gap-2"><input value={t.name} maxLength={40} onChange={(e) => patch({ name: e.target.value })} className="font-semibold text-[15px] bg-transparent min-w-0 flex-grow" style={{ color: 'inherit' }} />{!free && <Toggle on={t.isActive} onChange={(isActive) => patch({ isActive })} />}</div>
      {free ? <div><div className="serif text-[24px] font-bold">Miễn phí</div><div className="text-[12px]" style={{ color: T.ink3 }}>Mặc định khi tham gia</div></div> : (
        <div className="flex flex-col gap-1.5">
          {mode === 'one_time' ? <PriceInput value={t.oneTimeMinor} onChange={(oneTimeMinor) => patch({ oneTimeMinor })} suffix="đ một lần" dark={dark} /> : (
            <><PriceInput value={t.monthlyMinor} onChange={(monthlyMinor) => patch({ monthlyMinor })} suffix="đ / tháng" dark={dark} /><PriceInput value={t.yearlyMinor} onChange={(yearlyMinor) => patch({ yearlyMinor })} suffix="đ / năm" dark={dark} /></>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5 text-[13px]" style={{ color: dark ? T.sideText : T.ink2 }}>
        {t.benefits.map((b, i) => <div key={i} className="flex items-center gap-2"><span style={{ color: T.teal }}><Check size={14} /></span><input value={b} maxLength={120} onChange={(e) => setBenefit(i, e.target.value)} className="flex-grow bg-transparent min-w-0" style={{ color: 'inherit' }} /><button type="button" aria-label="Bỏ" onClick={() => setBenefit(i, null)} style={{ color: dark ? T.sideMuted : T.ink3 }}><X size={12} /></button></div>)}
        {t.benefits.length < 12 && <button type="button" className="flex items-center gap-2 text-left" style={{ color: T.teal }} onClick={() => patch({ benefits: [...t.benefits, ''] })}><Plus size={14} />Thêm quyền lợi</button>}
      </div>
    </div>
  );
}
