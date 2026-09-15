// Chọn cách thanh toán (signupPlanBody trong build.mjs): toggle tháng/năm, thẻ gói từ /v1/plans, 7 dòng tính năng, dùng thử 14 ngày.
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, money, T } from '@hoiminh/ui';
import { Check } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SignupPage, withRef } from './SignupParts';

interface Plan { key: string; name: string; description: string; monthlyMinor: number; yearlyMinor: number; trialDays: number; features: string[] }

const DEFAULT_FEATURES: Array<Array<string | { b: string }>> = [
  [{ b: 'Không giới hạn' }, ' hội, thành viên, khóa học, video, sự kiện'],
  [{ b: 'Không thu phí giao dịch' }, ', bạn nhận đủ tiền thành viên trả'],
  ['Nhận tiền qua ', { b: 'chuyển khoản QR, MoMo, VNPAY' }, ', PayPal cho khách quốc tế'],
  ['Cộng sự và bảng xếp hạng cộng sự'],
  ['Cửa hàng bán khóa học, combo, tài liệu'],
  ['Tên miền riêng'],
  ['Tin nhắn chào tự động, tiện ích, API và webhook'],
];

function Feature({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[15px]">
      <span className="inline-flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 22, height: 22, background: '#1E8A5A', color: T.surface }}><Check size={13} /></span>
      <span>{children}</span>
    </div>
  );
}

export default function Page() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ref = params.get('ref');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly');
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api.get<Plan[]>('/v1/plans'), staleTime: 300_000 });
  const start = useMutation({
    mutationFn: () => api.post<{ id: string }>('/v1/me/workspace'),
    onSuccess: () => navigate('/admin/tao-hoi'),
  });
  const go = () => {
    if (!user) navigate(withRef('/dang-ky?next=%2Fadmin%2Ftao-hoi', ref));
    else start.mutate();
  };
  const seg = (k: 'monthly' | 'yearly', label: string) => (
    <button type="button" onClick={() => setCycle(k)} className="rounded-full" style={{ padding: '10px 36px', fontWeight: cycle === k ? 700 : 600, background: cycle === k ? T.surface : 'transparent', color: cycle === k ? T.ink : T.sideText }}>{label}</button>
  );

  return (
    <SignupPage>
      <div className="flex-grow flex flex-col items-center gap-6 px-4 md:px-16" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <h1 className="serif m-0 font-extrabold text-[30px] md:text-[40px]">Chọn cách thanh toán</h1>
        <div className="relative flex p-1 rounded-full" style={{ background: 'rgba(255,253,249,0.1)' }}>
          {seg('monthly', 'Theo tháng')}
          {seg('yearly', 'Theo năm')}
          <span className="tag absolute" style={{ top: -14, right: -8, background: '#1E8A5A', color: T.surface, height: 26, padding: '0 10px' }}>2 tháng miễn phí</span>
        </div>
        <QueryState q={plans} rows={1} isEmpty={(d) => d.length === 0} empty={{ title: 'Chưa có gói nào', hint: 'Hệ thống chưa mở bán gói nền tảng.' }}>
          {(list) => {
            const plan = list[0]!;
            const yearly = cycle === 'yearly';
            const features = plan.features.length ? plan.features.map((f) => [f]) : DEFAULT_FEATURES;
            return (
              <div className="w-full rounded-[20px] flex flex-col gap-[22px]" style={{ maxWidth: 560, background: '#2E2823', border: '1px solid rgba(255,253,249,0.08)', padding: '32px 24px' }}>
                <div className="flex items-baseline gap-3 justify-center flex-wrap">
                  <span className="serif text-[34px] font-extrabold">{plan.name || 'Hội Mình'}</span>
                  <span className="text-[22px] font-semibold">{yearly ? `${money(plan.yearlyMinor)}/năm` : `${money(plan.monthlyMinor)}/tháng`}</span>
                </div>
                <div className="text-center text-[13px] -mt-3.5" style={{ color: T.sideText }}>
                  {yearly ? `tương đương ${money(Math.round(plan.yearlyMinor / 12))}/tháng · gói tháng ${money(plan.monthlyMinor)}` : `gói năm ${money(plan.yearlyMinor)}, tiết kiệm ${money(Math.max(0, plan.monthlyMinor * 12 - plan.yearlyMinor))}`}
                </div>
                <div className="flex flex-col gap-3">
                  {features.map((parts, i) => <Feature key={i}>{parts.map((p, k) => (typeof p === 'string' ? <span key={k}>{p}</span> : <strong key={k}>{p.b}</strong>))}</Feature>)}
                </div>
                {start.isError && <div className="text-[13px] rounded-[10px] px-3.5 py-2.5" style={{ background: T.accentSoft, color: T.accentText }}>{errorMessage(start.error)}</div>}
                <Button variant="primary" loading={start.isPending} onClick={go} className="uppercase" style={{ height: 54, fontSize: 15, letterSpacing: '0.04em', borderRadius: 12 }}>Dùng thử {plan.trialDays || 14} ngày miễn phí</Button>
                <div className="text-center text-[13px]" style={{ color: T.sideMuted }}>Không cần thẻ. Hết dùng thử, thanh toán bằng chuyển khoản hoặc MoMo, hủy bất cứ lúc nào.</div>
              </div>
            );
          }}
        </QueryState>
      </div>
    </SignupPage>
  );
}
