// Tạo hội của bạn (wsCreateMain): 6 bước Tên → Đường dẫn → Mô tả → Kiểu thu phí → Mẫu → Xong, thẻ 720px giữa trang.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, T, Textarea } from '@hoiminh/ui';
import { toSlug } from '@hoiminh/contracts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { WS_HOME_KEY } from './WorkspaceHomeParts';
import { Done, ModePicker, SlugInput, StepBar, TemplatePicker, useSlugCheck, type PricingMode, type Template } from './WorkspaceCreateParts';

interface Draft { name: string; slug: string; slugTouched: boolean; shortDescription: string; pricingMode: PricingMode; template: Template }
interface Created { id: string; slug: string; name: string }

export default function Page() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({ name: '', slug: '', slugTouched: false, shortDescription: '', pricingMode: 'freemium', template: 'course' });
  const [created, setCreated] = useState<Created | null>(null);
  const check = useSlugCheck(d.slug);
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));
  const m = useMutation({
    mutationFn: () => api.post<Created>('/v1/communities', { name: d.name.trim(), slug: d.slug, shortDescription: d.shortDescription.trim(), pricingMode: d.pricingMode, template: d.template }),
    onSuccess: (c) => { setCreated(c); setStep(5); void qc.invalidateQueries({ queryKey: WS_HOME_KEY }); },
  });

  const valid = [d.name.trim().length >= 3, d.slug.length >= 3 && check.data?.available === true, d.shortDescription.trim().length > 0, true, true, true][step] ?? false;
  const next = () => { if (step === 4) m.mutate(); else setStep((s) => Math.min(s + 1, 5)); };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center flex flex-col gap-1.5">
        <h1 className="serif m-0 text-[32px] font-extrabold">Tạo hội của bạn</h1>
        <div className="muted">Sáu bước, xong trong 2 phút. Mọi thứ đổi được sau.</div>
      </div>
      <StepBar current={step} />
      <div className="card w-full flex flex-col gap-5 p-6 md:p-8" style={{ maxWidth: 720 }}>
        {step === 0 && (
          <Field label="Tên hội" hint="Ngắn gọn, dễ nhớ. Ví dụ: AI Agent cho chủ shop">
            <Input autoFocus value={d.name} onChange={(e) => patch({ name: e.target.value, slug: d.slugTouched ? d.slug : toSlug(e.target.value) })} placeholder="Tên hội của bạn" />
          </Field>
        )}
        {step === 1 && (
          <Field label="Đường dẫn" hint="Có thể trỏ tên miền riêng sau trong Cài đặt">
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
        {step === 5 && created && <Done slug={created.slug} name={created.name} />}
        {m.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
        {step < 5 && (
          <div className="flex items-center gap-3 pt-2 flex-wrap" style={{ borderTop: `1px solid ${T.line}` }}>
            <Button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ChevronLeft size={16} /> Quay lại</Button>
            <span className="flex-grow" />
            <span className="muted text-[13px] hide-mobile">Gói Hội Mình: không giới hạn số hội</span>
            <Button variant="primary" disabled={!valid} loading={m.isPending} onClick={next}>{step === 4 ? 'Tạo hội' : 'Tiếp tục'} <ChevronRight size={16} /></Button>
          </div>
        )}
      </div>
    </div>
  );
}
