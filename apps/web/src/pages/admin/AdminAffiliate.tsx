// Hệ thống · Cộng sự nền tảng (saAffiliateMain): 3 ô ví, hàng đợi rút (PayoutQueue), cấu hình hoa hồng toàn hệ thống, đối tác lớn với mức riêng.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Field, Input, Select, T, WalletBox, money } from '@hoiminh/ui';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LedgerNotice, PayoutQueue, type PayoutRequest } from '@/components/PayoutQueue';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { downloadFromApi } from '@/lib/download';

interface Partner { id: string; affiliate_code: string; commission_rate_bps: number | null; signup_count: number; paid_count: number; name: string; handle: string; avatar_url: string | null; cover_color: string | null }
interface Data { program: { id: string; commissionRateBps: number; commissionDurationMonths: number | null; holdDays: number; minWithdrawalMinor: number }; stats: { awaitingTransferMinor: number; awaitingCount: number; holdingMinor: number; paidThisMonthMinor: number; paidCountThisMonth: number }; partners: Partner[]; queue: PayoutRequest[]; history: PayoutRequest[] }

function ProgramForm({ p, onSaved }: { p: Data['program']; onSaved: () => void }) {
  const [f, setF] = useState({ commissionRateBps: p.commissionRateBps, commissionDurationMonths: p.commissionDurationMonths, holdDays: p.holdDays, minWithdrawalMinor: p.minWithdrawalMinor });
  useEffect(() => { setF({ commissionRateBps: p.commissionRateBps, commissionDurationMonths: p.commissionDurationMonths, holdDays: p.holdDays, minWithdrawalMinor: p.minWithdrawalMinor }); }, [p]);
  const m = useMutation({ mutationFn: () => api.patch('/v1/admin/affiliate', f), onSuccess: onSaved });
  return (
    <div className="card flex flex-col gap-3" style={{ padding: '18px 20px' }}>
      <span className="font-semibold">Hoa hồng toàn hệ thống</span>
      <Field label="Hoa hồng khi giới thiệu chủ hội"><div className="flex gap-2"><Select value={f.commissionRateBps} onChange={(e) => setF({ ...f, commissionRateBps: Number(e.target.value) })}>{[1000, 2000, 3000, 4000, 5000].map((b) => <option key={b} value={b}>{b / 100}%</option>)}</Select><Select value={f.commissionDurationMonths ?? 0} onChange={(e) => setF({ ...f, commissionDurationMonths: Number(e.target.value) || null })}><option value={0}>trọn đời</option>{[6, 12, 24].map((mth) => <option key={mth} value={mth}>{mth} tháng đầu</option>)}</Select></div></Field>
      <Field label="Thời gian giữ"><Select value={f.holdDays} onChange={(e) => setF({ ...f, holdDays: Number(e.target.value) })}>{[14, 30, 45, 60].map((d) => <option key={d} value={d}>{d} ngày</option>)}</Select></Field>
      <Field label="Mức rút tối thiểu"><Input type="number" min={0} step={50000} value={f.minWithdrawalMinor} onChange={(e) => setF({ ...f, minWithdrawalMinor: Number(e.target.value) })} right={<span className="muted text-[12px]">đ</span>} /></Field>
      {m.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</span>}
      <Button size="sm" variant="dark" className="self-start" loading={m.isPending} onClick={() => m.mutate()}>Lưu</Button>
    </div>
  );
}

function PartnerRow({ p, defaultBps, onSaved }: { p: Partner; defaultBps: number; onSaved: () => void }) {
  const m = useMutation({ mutationFn: (bps: number | null) => api.patch(`/v1/admin/affiliate/accounts/${p.id}`, { commissionRateBps: bps }), onSuccess: onSaved });
  return (
    <div className="flex items-center gap-2.5 px-5 py-2.5 text-[13px]" style={{ borderTop: `1px solid ${T.line}` }}>
      <Avatar name={p.name} src={p.avatar_url} color={p.cover_color ?? T.ink} size={28} />
      <span className="flex-grow font-medium truncate">{p.name}</span>
      <span className="muted whitespace-nowrap">{p.paid_count} chủ hội</span>
      <Select value={p.commission_rate_bps ?? 0} disabled={m.isPending} onChange={(e) => m.mutate(Number(e.target.value) || null)} style={{ height: 28, fontSize: 12, width: 'fit-content' }}><option value={0}>{defaultBps / 100}% · chung</option>{[3000, 4000, 5000, 6000].map((b) => <option key={b} value={b}>{b / 100}% · riêng</option>)}</Select>
    </div>
  );
}

export default function Page() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'affiliate'], queryFn: () => api.get<Data>('/v1/admin/affiliate') });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['admin', 'affiliate'] }); };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap"><div><h1 className="serif m-0 text-[28px] font-extrabold">Cộng sự nền tảng</h1><div className="muted text-[13px]">Người giới thiệu chủ hội mới cho Hội Mình. Cùng một cơ chế chi trả thủ công như chủ hội trả cộng sự trong hội.</div></div><span className="flex-grow" /><button type="button" className="btn btn-ghost btn-sm" onClick={() => void downloadFromApi('/v1/admin/affiliate/export.csv', 'cong-su-nen-tang.csv')}><Download size={14} />Xuất đối soát</button></div>
      <LedgerNotice who="Quản trị viên có quyền affiliates:manage" />
      <QueryState q={q} rows={5}>
        {(d) => (
          <div className="flex gap-4 flex-col md:flex-row">
            <div className="flex-[1.5_1_0] flex flex-col gap-3 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <WalletBox label="Chờ chuyển" value={money(d.stats.awaitingTransferMinor)} hint={`${d.stats.awaitingCount} yêu cầu`} strong />
                <WalletBox label={`Đang giữ ${d.program.holdDays} ngày`} value={money(d.stats.holdingMinor)} hint="hoa hồng chờ đối soát" />
                <WalletBox label="Đã trả tháng này" value={money(d.stats.paidThisMonthMinor)} hint={`${d.stats.paidCountThisMonth} lần chuyển khoản`} />
              </div>
              <PayoutQueue queue={d.queue} history={d.history} onChanged={refresh} />
            </div>
            <div className="flex-1 flex flex-col gap-3">
              <ProgramForm p={d.program} onSaved={refresh} />
              <div className="card overflow-hidden">
                <div className="flex items-center px-5 py-3.5 gap-2 flex-wrap"><span className="font-semibold">Đối tác lớn</span><span className="muted text-[12px]">hoa hồng riêng thắng mức chung</span></div>
                {d.partners.length === 0 && <div className="muted text-[13px] px-5 pb-4">Chưa có cộng sự nền tảng.</div>}
                {d.partners.map((p) => <PartnerRow key={p.id} p={p} defaultBps={d.program.commissionRateBps} onSaved={refresh} />)}
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}
