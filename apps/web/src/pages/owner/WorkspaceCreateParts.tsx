// Mảnh màn "Tạo hội của bạn": thanh bước, ô đường dẫn có kiểm tra, thẻ kiểu thu phí, thẻ mẫu, màn hoàn tất.
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { OptionCard, T } from '@hoiminh/ui';
import { toSlug } from '@hoiminh/contracts';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

export const STEPS = ['Tên', 'Đường dẫn', 'Mô tả', 'Kiểu thu phí', 'Mẫu', 'Xong'] as const;
export type PricingMode = 'free' | 'freemium' | 'subscription' | 'one_time';
export type Template = 'course' | 'coaching' | 'membership' | 'blank';
export const MODES: Array<[PricingMode, string, string]> = [['free', 'Miễn phí', 'Ai cũng vào'], ['freemium', 'Freemium', 'Vào miễn phí, có gói nâng cấp'], ['subscription', 'Thu phí', 'Trả mới vào được'], ['one_time', 'Trả một lần', 'Trọn đời']];
export const TEMPLATES: Array<[Template, string, string]> = [['course', 'Khóa học', 'Bảng tin + thư viện khóa học, phù hợp bán khóa'], ['coaching', 'Coaching', 'Sự kiện, Q&A hằng tuần và cửa hàng'], ['membership', 'Membership', 'Bảng tin là trung tâm, thu phí tháng'], ['blank', 'Trống', 'Tự bật tab bạn cần trong Cài đặt']];

export function StepBar({ current }: { current: number }) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {STEPS.map((s, i) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: i <= current ? T.ink : T.ink3 }}>
          <span className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center" style={i <= current ? { background: T.ink, color: T.surface } : { border: `1.5px solid ${T.line2}` }}>{i < current ? <Check size={12} /> : i + 1}</span>
          {s}
          {i < STEPS.length - 1 && <span className="w-6 h-px self-center ml-2 hide-mobile" style={{ background: T.line2 }} />}
        </span>
      ))}
    </div>
  );
}

export function useSlugCheck(slug: string) {
  return useQuery({
    queryKey: ['slug-available', slug],
    queryFn: () => api.post<{ available: boolean; reason?: string }>('/v1/communities/slug-available', { slug }),
    enabled: slug.length >= 3,
    staleTime: 10_000,
  });
}

export function SlugInput({ value, onChange, check }: { value: string; onChange: (v: string) => void; check: ReturnType<typeof useSlugCheck> }) {
  const ok = check.data?.available === true;
  const bad = check.data?.available === false;
  return (
    <div className="input" style={{ color: T.ink }}>
      <span className="muted">hoiminh.vn/</span>
      <input value={value} onChange={(e) => onChange(toSlug(e.target.value))} placeholder="ten-hoi" className="flex-grow" />
      {ok && <span style={{ color: T.teal }}><Check size={16} /></span>}
      {bad && <span className="text-[12px] font-semibold" style={{ color: T.accentText }}>{check.data?.reason ?? 'Đã có người dùng'}</span>}
    </div>
  );
}

export function ModePicker({ value, onChange }: { value: PricingMode; onChange: (m: PricingMode) => void }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">{MODES.map(([k, t, s]) => <OptionCard key={k} on={value === k} onClick={() => onChange(k)} title={t} sub={s} />)}</div>;
}

export function TemplatePicker({ value, onChange }: { value: Template; onChange: (m: Template) => void }) {
  return <div className="grid-2">{TEMPLATES.map(([k, t, s]) => <OptionCard key={k} on={value === k} onClick={() => onChange(k)} title={t} sub={s} />)}</div>;
}

export function Done({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center py-4">
      <span className="w-14 h-14 rounded-full inline-flex items-center justify-center" style={{ background: T.tealSoft, color: T.tealText }}><Check size={28} /></span>
      <div className="serif text-[24px] font-extrabold">{name} đã sẵn sàng</div>
      <div className="muted text-[14px]">Đường dẫn hội: <strong style={{ color: T.ink }}>hoiminh.vn/{slug}</strong>. Hội đang ở trạng thái nháp cho tới khi bạn đăng bài đầu tiên hoặc mở cổng trong Cài đặt.</div>
      <div className="flex gap-2 flex-wrap justify-center pt-2">
        <Link to={`/${slug}/cai-dat`} className="btn btn-ghost">Cài đặt hội</Link>
        <Link to={`/${slug}/bang-tin`} className="btn btn-primary">Vào hội</Link>
      </div>
    </div>
  );
}
