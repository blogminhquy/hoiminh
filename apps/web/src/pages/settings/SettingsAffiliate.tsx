// Cài đặt · Cộng sự (affiliateSettingsMain): mức hoa hồng, thời gian giữ, mức rút tối thiểu; bảng xếp hạng; thẻ tối số liệu tháng.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field, Input, Radio, SaveBar, Select, T, Toggle, money } from '@hoiminh/ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LedgerNotice } from '@/components/PayoutQueue';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useShell } from '@/lib/community';
import { AffiliateTabs } from './AffiliateTabs';

interface Program { id: string; status: 'active' | 'paused'; commissionRateBps: number; holdDays: number; minWithdrawalMinor: number; leaderboardVisibility: 'members' | 'affiliates_only' | 'hidden'; leaderboardShowMoney: boolean }
interface Stats { activeAffiliates: number; paidThisMonthMinor: number; awaitingTransferMinor: number; awaitingCount: number; holdingMinor: number; referredRevenueShare: number }
interface Settings { program: Program; stats: Stats }
interface Form { enabled: boolean; commissionRateBps: number; holdDays: number; minWithdrawalMinor: number; leaderboardVisibility: Program['leaderboardVisibility']; leaderboardShowMoney: boolean }
const RATES: Array<[number, string]> = [[0, 'Tắt'], [1000, '10%'], [2000, '20%'], [3000, '30%'], [4000, '40% · khuyên dùng'], [5000, '50%']];
const VIS: Array<[Form['leaderboardVisibility'], string]> = [['members', 'Mọi thành viên thấy'], ['affiliates_only', 'Chỉ người đã lấy link'], ['hidden', 'Tắt bảng xếp hạng']];

export default function Page() {
  const shell = useShell();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['affiliate-settings', shell.community.id], queryFn: () => api.get<Settings>(`/v1/communities/${shell.community.id}/affiliate`) });
  const [f, setF] = useState<Form | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data && !f) { const p = q.data.program; setF({ enabled: p.status === 'active', commissionRateBps: p.commissionRateBps, holdDays: p.holdDays, minWithdrawalMinor: p.minWithdrawalMinor, leaderboardVisibility: p.leaderboardVisibility, leaderboardShowMoney: p.leaderboardShowMoney }); } }, [q.data, f]);
  const save = useMutation({ mutationFn: () => api.put(`/v1/communities/${shell.community.id}/affiliate`, f), onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); void qc.invalidateQueries({ queryKey: ['affiliate-settings'] }); } });
  if (!f || !q.data) return <LoadingBlock rows={4} />;
  const s = q.data.stats;
  const patch = (p: Partial<Form>) => setF({ ...f, ...p });
  return (
    <>
      <SaveBar title="Cộng sự" sub="Thưởng cho thành viên giới thiệu bạn bè bằng hoa hồng định kỳ" saving={save.isPending} saved={saved} onSave={() => save.mutate()} onCancel={() => setF(null)} />
      <AffiliateTabs slug={shell.community.slug} active="config" awaiting={s.awaitingCount} affiliates={s.activeAffiliates} />
      <LedgerNotice who="Bạn" />
      {save.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</div>}
      <div className="flex gap-4 flex-col md:flex-row">
        <div className="card flex-[1.4_1_0] p-6 flex flex-col gap-[18px]">
          <Field label="Mức hoa hồng" hint="Tính trên mỗi kỳ thanh toán của người được giới thiệu">
            <div className="flex flex-col gap-2">{RATES.map(([bps, l]) => { const on = bps === 0 ? !f.enabled : f.enabled && f.commissionRateBps === bps; return <button key={bps} type="button" onClick={() => (bps === 0 ? patch({ enabled: false }) : patch({ enabled: true, commissionRateBps: bps }))} className="flex items-center gap-2.5 text-[14px] text-left" style={{ fontWeight: on ? 600 : 400 }}><Radio on={on} />{l}</button>; })}</div>
          </Field>
          <Field label="Thời gian giữ hoa hồng" hint="Để xử lý hoàn tiền trước khi cộng sự được rút"><Select value={f.holdDays} onChange={(e) => patch({ holdDays: Number(e.target.value) })} style={{ width: 220 }}>{[7, 14, 30].map((d) => <option key={d} value={d}>{d} ngày</option>)}</Select></Field>
          <Field label="Mức rút tối thiểu" hint="Cộng sự chỉ gửi được yêu cầu rút từ mức này"><Input type="number" min={0} step={50000} value={f.minWithdrawalMinor} onChange={(e) => patch({ minWithdrawalMinor: Math.max(0, Number(e.target.value)) })} right={<span className="muted text-[12px]">đ</span>} style={{ width: 220 }} /></Field>
        </div>
        <div className="flex-1 flex flex-col gap-4">
          <div className="card p-5 flex flex-col gap-3.5">
            <span className="font-semibold">Bảng xếp hạng cộng sự</span>
            {VIS.map(([k, l]) => <button key={k} type="button" onClick={() => patch({ leaderboardVisibility: k })} className="flex items-center gap-2.5 text-[14px] text-left"><Radio on={f.leaderboardVisibility === k} />{l}</button>)}
            <div className="flex items-center gap-2.5 text-[14px] pt-3" style={{ borderTop: `1px solid ${T.line}` }}><span className="flex-grow">Hiện số tiền doanh thu và hoa hồng</span><Toggle on={f.leaderboardShowMoney} onChange={(leaderboardShowMoney) => patch({ leaderboardShowMoney })} /></div>
          </div>
          <div className="card p-5 flex flex-col gap-2.5" style={{ background: T.ink, color: T.surface, borderColor: T.ink }}>
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}>Tháng này</span>
            <div className="flex gap-5"><div><div className="serif text-[22px] font-extrabold">{s.activeAffiliates}</div><div className="text-[12px]" style={{ color: T.sideText }}>cộng sự có phát sinh</div></div><div><div className="serif text-[22px] font-extrabold">{s.referredRevenueShare}%</div><div className="text-[12px]" style={{ color: T.sideText }}>doanh thu từ giới thiệu</div></div></div>
            <div className="text-[13px]" style={{ color: T.sideText }}>Đã trả: {money(s.paidThisMonthMinor)} · chờ bạn chuyển: {money(s.awaitingTransferMinor)} · đang giữ: {money(s.holdingMinor)}</div>
            {s.awaitingCount > 0 && <Link to={`/${shell.community.slug}/cai-dat/cong-su/rut-tien`} className="btn btn-primary btn-sm self-start">Xử lý {s.awaitingCount} yêu cầu rút</Link>}
          </div>
        </div>
      </div>
    </>
  );
}
