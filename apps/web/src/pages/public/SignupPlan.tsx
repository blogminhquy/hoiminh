// Bảng giá công khai (/tao-hoi/goi): bốn gói từ /v1/plans, hai tab chu kỳ (3 tháng, 1 năm). Mỗi gói dùng cho một hội.
// Không có dùng thử: ai cũng bắt đầu bằng hội miễn phí (dùng vĩnh viễn), muốn nâng gói thì nâng trong trang quản lý hội.
import { useQuery } from '@tanstack/react-query';
import type { PlanCycle, PlanDef } from '@hoiminh/contracts';
import { T } from '@hoiminh/ui';
import { Check, Lock, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CYCLES, cycleLabel, tierCards, type HoiPlan } from '@/lib/platform-plan';
import { SignupPage, withRef } from './SignupParts';

/** Người xem bảng giá chưa có hội nào: coi như đang ở gói Miễn phí để dựng bốn thẻ. */
const VISITOR: HoiPlan = { key: 'free', name: 'Miễn phí', memberCap: null, features: [], endsAt: null, daysLeft: 0, boughtKey: 'free', boughtEndsAt: null, isFreeSlot: true, needsPlan: false, full: false };
const CARD = { background: '#2E2823', border: '1px solid rgba(255,253,249,0.08)' };

export default function Page() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ref = params.get('ref');
  const [cycle, setCycle] = useState<PlanCycle>('yearly');
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api.get<PlanDef[]>('/v1/plans'), staleTime: 300_000 });
  const go = () => navigate(user ? '/admin/tao-hoi' : withRef('/dang-ky?next=%2Fadmin%2Ftao-hoi', ref));

  return (
    <SignupPage>
      <div className="flex-grow flex flex-col items-center gap-6 px-4 md:px-10" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="flex flex-col gap-2 text-center">
          <h1 className="serif m-0 font-extrabold text-[30px] md:text-[40px]">Bắt đầu miễn phí, nâng gói khi hội lớn</h1>
          <div className="text-[16px]" style={{ color: T.sideText }}>Mỗi gói dùng cho một hội. Không thu phí trên doanh thu ở bất kỳ gói nào.</div>
        </div>
        <div className="relative flex p-1 rounded-full" style={{ background: 'rgba(255,253,249,0.1)' }} role="tablist" aria-label="Chu kỳ thanh toán">
          {CYCLES.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={cycle === k} onClick={() => setCycle(k)} className="rounded-full" style={{ minHeight: 44, padding: '0 32px', fontSize: 15, fontWeight: cycle === k ? 700 : 600, background: cycle === k ? T.surface : 'transparent', color: cycle === k ? T.ink : T.sideText }}>{cycleLabel(k)}</button>
          ))}
          <span className="tag absolute" style={{ top: -14, right: -8, background: '#1E8A5A', color: T.invertInk, height: 26, padding: '0 10px' }}>Tặng 2 tháng</span>
        </div>
        <QueryState q={plans} rows={2}>
          {(list) => (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 items-start w-full" style={{ maxWidth: 1180 }}>
              {tierCards(list, VISITOR, 0, cycle, new Date()).map((t) => (
                <div key={t.key} className="rounded-[18px] flex flex-col gap-4 p-5" style={{ ...CARD, ...(t.popular ? { borderColor: T.gold } : {}) }}>
                  <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
                    <span className="text-[19px] font-extrabold">{t.name}</span>
                    {t.popular && <span className="tag" style={{ background: T.gold, color: T.invertBg }}>Dành cho đa số</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="serif text-[30px] font-extrabold leading-tight">{t.price}</span>
                      <span className="text-[14px]" style={{ color: T.sideText }}>{t.per}</span>
                    </div>
                    <span className="text-[14px]" style={{ color: T.sideText }}>{t.sub}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[15px] font-semibold"><Users size={18} className="flex-shrink-0" style={{ color: T.gold }} />{t.cap}</div>
                  <div className="flex flex-col gap-2.5">
                    {t.features.map((f) => (
                      <div key={f.text} className="flex items-start gap-2.5 text-[14px]" style={{ color: f.on ? T.invertInk : T.sideMuted }}>
                        {f.on ? <Check size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#4CC38A' }} /> : <Lock size={16} className="flex-shrink-0 mt-[3px]" />}
                        <span>{f.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </QueryState>
        <button type="button" onClick={go} className="btn btn-primary w-full uppercase" style={{ maxWidth: 560, height: 56, fontSize: 16, letterSpacing: '0.04em', borderRadius: 12 }}>Tạo hội miễn phí</button>
        <div className="flex flex-col gap-1 text-center text-[14px]" style={{ color: T.sideMuted }}>
          <span>Không cần thẻ, không có dùng thử: gói Miễn phí dùng vĩnh viễn, bán hàng và thu tiền được ngay.</span>
          <span>Mỗi tài khoản có một hội miễn phí. Hội thứ hai trở đi cần gói trả phí.</span>
        </div>
      </div>
    </SignupPage>
  );
}
