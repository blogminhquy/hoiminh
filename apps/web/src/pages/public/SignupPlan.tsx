// Bảng giá công khai (/tao-hoi/goi): các gói từ /v1/plans, tab kỳ hạn chỉ gồm kỳ đang bán (giá lớn hơn 0). Mỗi gói dùng cho một hội.
// Không có dùng thử: ai cũng bắt đầu bằng hội miễn phí (dùng vĩnh viễn), muốn nâng gói thì nâng trong trang quản lý hội.
// Các thẻ cao bằng nhau và cùng một danh sách tính năng (planFeatureRows): dòng nào mở có dấu tích, dòng nào khóa có ổ khóa;
// trong mỗi thẻ dòng có dấu tích lên đầu. Dòng thành viên là một ô nổi, gói không giới hạn nổi bật hơn. Cuối thẻ ghi gói mở khóa.
import { useQuery } from '@tanstack/react-query';
import { pickCycle, soldCycles, type PlanCycle, type PlanDef } from '@hoiminh/contracts';
import { T } from '@hoiminh/ui';
import { Check, Infinity as InfinityIcon, Lock, LockOpen, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { capHeadline, cycleLabel, cycleSaving, openRowsFirst, planFeatureRows, tierCards, type HoiPlan } from '@/lib/platform-plan';
import { SignupPage, withRef } from './SignupParts';

/** Người xem bảng giá chưa có hội nào: coi như đang ở gói Miễn phí để dựng bốn thẻ. */
const VISITOR: HoiPlan = { key: 'free', name: 'Miễn phí', memberCap: null, features: [], endsAt: null, daysLeft: 0, boughtKey: 'free', boughtEndsAt: null, isFreeSlot: true, needsPlan: false, full: false };
const CARD = { background: '#2E2823', border: '1px solid rgba(255,253,249,0.08)' };

export default function Page() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ref = params.get('ref');
  const [wanted, setCycle] = useState<PlanCycle>('yearly');
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api.get<PlanDef[]>('/v1/plans'), staleTime: 300_000 });
  // Chỉ hiện các kỳ đang bán. Kỳ đang chọn không còn bán thì lấy kỳ dài nhất đang bán.
  const cycles = soldCycles(plans.data ?? []);
  const cycle = pickCycle(cycles, wanted) ?? wanted;
  const longest = cycles.at(-1);
  const note = longest && plans.data ? cycleSaving(plans.data, longest) : '';
  const go = () => navigate(user ? '/admin/tao-hoi' : withRef('/dang-ky?next=%2Fadmin%2Ftao-hoi', ref));

  return (
    <SignupPage>
      <div className="flex-grow flex flex-col items-center gap-6 px-4 md:px-10" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="flex flex-col gap-2 text-center">
          <h1 className="serif m-0 font-extrabold text-[30px] md:text-[40px]">Bắt đầu miễn phí, nâng gói khi hội lớn</h1>
          <div className="text-[16px]" style={{ color: T.sideText }}>Mỗi gói dùng cho một hội. Không thu phí trên doanh thu ở bất kỳ gói nào.</div>
        </div>
        {cycles.length > 0 && (
        <div className="relative flex p-1 rounded-full" style={{ background: 'rgba(255,253,249,0.1)' }} role="tablist" aria-label="Chu kỳ thanh toán">
          {cycles.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={cycle === k} onClick={() => setCycle(k)} className="rounded-full" style={{ minHeight: 44, padding: cycles.length > 2 ? '0 16px' : '0 32px', fontSize: 15, fontWeight: cycle === k ? 700 : 600, background: cycle === k ? T.surface : 'transparent', color: cycle === k ? T.ink : T.sideText }}>{cycleLabel(k)}</button>
          ))}
          {note && <span className="tag absolute" style={{ top: -14, right: -8, background: '#1E8A5A', color: T.invertInk, height: 26, padding: '0 10px' }}>{note.charAt(0).toLocaleUpperCase('vi') + note.slice(1)}</span>}
        </div>
        )}
        <QueryState q={plans} rows={2}>
          {(list) => (
            <div className="grid gap-x-4 gap-y-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 w-full pt-3" style={{ maxWidth: 1180 }}>
              {tierCards(list, VISITOR, 0, cycle, new Date()).map((t) => {
                const def = list.find((p) => p.key === t.key);
                // Dòng có dấu tích lên đầu (chủ dự án chốt 23/11/2026). Số dòng thẻ nào cũng như nhau nên thẻ vẫn cao bằng nhau.
                const rows = def ? openRowsFirst(planFeatureRows(list, def)) : [];
                const lockedFrom = [...new Set(rows.filter((r) => !r.on && r.from).map((r) => r.from!))];
                return (
                  <div key={t.key} className="relative rounded-[18px] flex flex-col gap-4 p-5" style={{ ...CARD, ...(t.popular ? { borderColor: T.gold } : {}) }}>
                    {/* Nhãn nằm vắt trên mép thẻ, không chiếm dòng nào trong thẻ, để các thẻ giữ cùng nhịp dòng. */}
                    {t.popular && <span className="tag absolute" style={{ top: -13, left: 20, background: T.gold, color: T.invertBg }}>Dành cho đa số</span>}
                    <span className="text-[19px] font-extrabold">{t.name}</span>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="serif text-[30px] font-extrabold leading-tight">{t.price}</span>
                        <span className="text-[14px]" style={{ color: T.sideText }}>{t.per}</span>
                      </div>
                      {/* Chừa đủ hai dòng cho câu giá, để dòng thành viên và danh sách tính năng bắt đầu ngang nhau ở mọi thẻ. */}
                      <span className="text-[14px]" style={{ color: T.sideText, lineHeight: '22px', minHeight: 44 }}>{t.sub}</span>
                    </div>
                    {/* Dòng thành viên là một ô cao như nhau ở mọi thẻ (danh sách bên dưới bắt đầu ngang nhau). Gói không giới hạn
                        thì ô nền vàng, biểu tượng vô cực, để điểm mạnh nhất của gói nổi lên ngay. */}
                    {def?.memberCap === null ? (
                      <div className="flex items-center gap-2.5 rounded-[12px] px-3" style={{ minHeight: 56, background: T.gold, color: T.invertBg }}>
                        <InfinityIcon size={26} className="flex-shrink-0" strokeWidth={2.5} aria-hidden="true" />
                        <span className="flex flex-col leading-tight"><span className="text-[18px] font-extrabold">Không giới hạn</span><span className="text-[13px] font-semibold">thành viên</span></span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-[12px] px-3 text-[14px] font-semibold whitespace-nowrap" style={{ minHeight: 56, background: 'rgba(255,253,249,0.06)' }}><Users size={18} className="flex-shrink-0" style={{ color: T.gold }} aria-hidden="true" />{def ? capHeadline(def.memberCap) : t.cap}</div>
                    )}
                    <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
                      {rows.map((f) => (
                        <li key={f.text} className="flex items-start gap-2.5 text-[15px] leading-[1.45]" style={{ color: f.on ? T.invertInk : T.sideMuted }} title={f.on ? undefined : f.from ? `Có từ gói ${f.from}` : undefined}>
                          {f.on ? <Check size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#4CC38A' }} aria-hidden="true" /> : <Lock size={16} className="flex-shrink-0 mt-[3px]" aria-hidden="true" />}
                          <span><span className="sr-only">{f.on ? 'Có: ' : 'Khóa: '}</span>{f.text}{!f.on && f.from && <span className="sr-only">, có từ gói {f.from}</span>}</span>
                        </li>
                      ))}
                    </ul>
                    {/* Chân thẻ luôn chừa hai dòng chữ, để đường kẻ phía trên nằm cùng một độ cao ở mọi thẻ dù câu dài hay ngắn. */}
                    <div className="mt-auto pt-3 flex items-start gap-2 text-[14px] font-semibold" style={{ borderTop: '1px solid rgba(255,253,249,0.08)', color: lockedFrom.length ? T.gold : '#4CC38A', lineHeight: '22px', minHeight: 1 + 12 + 44 }}>
                      {lockedFrom.length ? <LockOpen size={16} className="flex-shrink-0 mt-[3px]" aria-hidden="true" /> : <Check size={16} className="flex-shrink-0 mt-[3px]" aria-hidden="true" />}
                      <span>{lockedFrom.length === 1 ? `Mở khóa từ gói ${lockedFrom[0]}` : lockedFrom.length ? 'Gói cao hơn mở các dòng khóa' : 'Đủ mọi tính năng'}</span>
                    </div>
                  </div>
                );
              })}
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
