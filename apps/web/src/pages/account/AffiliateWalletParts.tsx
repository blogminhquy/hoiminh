// Mảnh Ví cộng sự: form tài khoản nhận tiền (mã hóa), form rút, bảng lịch sử rút, bảng hoa hồng gần đây.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { VIETNAM_BANKS } from '@hoiminh/contracts';
import { Button, Field, Input, Select, StatusTag, T, money } from '@hoiminh/ui';
import { Download, ShieldCheck, Wallet } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar, type UserLite } from '@/components/UserLink';
import { api, errorMessage } from '@/lib/api';
import { fmtDate } from '@/lib/format';

export interface Withdrawal { id: string; amountMinor: number; maskedAccount: string; status: string; transferReference: string | null; rejectionReason: string | null; requestedAt: string }
export interface Commission { id: string; customer: UserLite; title: string; baseMinor: number; amountMinor: number; status: string; availableAt: string | null; reversedAt: string | null; paidAt: string | null }

export function PayoutProfileCard({ programId, maskedAccount, bankCode, onSaved }: { programId: string; maskedAccount: string | null; bankCode: string | null; onSaved: () => void }) {
  const [edit, setEdit] = useState(!maskedAccount);
  const [f, setF] = useState({ bankCode: bankCode ?? 'VCB', accountNumber: '', accountHolder: '' });
  const m = useMutation({ mutationFn: () => api.put(`/v1/me/affiliate/${programId}/payout-profile`, f), onSuccess: () => { setEdit(false); onSaved(); } });
  const bank = VIETNAM_BANKS.find((b) => b.code === bankCode);
  return (
    <div className="card flex-1 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2"><Wallet size={18} /><span className="font-semibold">Tài khoản nhận tiền</span></div>
      {!edit && maskedAccount ? (
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-[10px]" style={{ background: T.bg }}><span className="w-10 h-7 rounded-md inline-flex items-center justify-center text-[9px] font-extrabold" style={{ background: '#1B5E3B', color: T.surface }}>{bankCode}</span><div className="flex-grow"><div className="font-semibold">{bank?.name ?? bankCode} {maskedAccount}</div></div><Button size="sm" onClick={() => setEdit(true)}>Đổi tài khoản</Button></div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <Field label="Ngân hàng"><Select value={f.bankCode} onChange={(e) => setF({ ...f, bankCode: e.target.value })}>{VIETNAM_BANKS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</Select></Field>
          <Field label="Số tài khoản"><Input inputMode="numeric" value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value.replace(/\D/g, '') })} placeholder="Chỉ số, 6–20 ký tự" /></Field>
          <Field label="Chủ tài khoản" hint="Viết không dấu, đúng như trên app ngân hàng"><Input value={f.accountHolder} onChange={(e) => setF({ ...f, accountHolder: e.target.value.toUpperCase() })} placeholder="NGUYEN VAN A" /></Field>
          {m.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</span>}
          <div className="flex gap-2">{maskedAccount && <Button size="sm" onClick={() => setEdit(false)}>Hủy</Button>}<Button size="sm" variant="dark" loading={m.isPending} disabled={f.accountNumber.length < 6 || f.accountHolder.length < 3} onClick={() => m.mutate()}>Lưu tài khoản</Button></div>
        </div>
      )}
      <div className="muted text-[12px] flex items-center gap-1.5"><ShieldCheck size={14} />Được mã hóa khi lưu, chỉ hiện 4 số cuối. Chủ hội chỉ mở xem khi xử lý yêu cầu rút.</div>
    </div>
  );
}

export function WithdrawCard({ programId, availableMinor, minWithdrawalMinor, hasProfile, payerName, onDone }: { programId: string; availableMinor: number; minWithdrawalMinor: number; hasProfile: boolean; payerName: string; onDone: () => void }) {
  const [amount, setAmount] = useState(String(Math.max(0, availableMinor)));
  const m = useMutation({ mutationFn: () => api.post(`/v1/me/affiliate/${programId}/withdrawals`, { amountMinor: Number(amount) }), onSuccess: onDone });
  const n = Number(amount) || 0;
  const ok = hasProfile && n >= minWithdrawalMinor && n <= availableMinor;
  return (
    <div className="card flex-1 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2"><Download size={18} /><span className="font-semibold">Rút tiền</span><span className="muted text-[12px] ml-auto">tối thiểu {money(minWithdrawalMinor)}</span></div>
      <div className="input font-semibold text-[16px]" style={{ height: 44, color: T.ink }}><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className="flex-grow min-w-0" /><span className="muted font-medium">đ</span></div>
      {m.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</span>}
      <Button variant="primary" loading={m.isPending} disabled={!ok} onClick={() => m.mutate()}>Gửi yêu cầu rút</Button>
      <div className="muted text-[12px]">{hasProfile ? `${payerName} chuyển khoản trong 3 ngày làm việc. Bạn có thể hủy khi yêu cầu còn ở trạng thái Chờ duyệt.` : 'Thêm tài khoản nhận tiền trước khi gửi yêu cầu.'}</div>
    </div>
  );
}

export function WithdrawalsTable({ rows, onChanged }: { rows: Withdrawal[]; onChanged: () => void }) {
  const qc = useQueryClient();
  const cancel = useMutation({ mutationFn: (id: string) => api.post(`/v1/withdrawals/${id}/cancel`, {}), onSuccess: () => { onChanged(); void qc.invalidateQueries({ queryKey: ['wallet'] }); } });
  const cols = '1fr 1fr 1.4fr 1fr 1.6fr 100px';
  return (
    <div className="card overflow-hidden table-scroll">
      <div className="flex items-center px-5 py-3.5"><span className="font-semibold">Lịch sử rút tiền</span></div>
      <div className="grid gap-3 px-5 pb-2" style={{ gridTemplateColumns: cols, minWidth: 720 }}>{['Ngày', 'Số tiền', 'Tài khoản', 'Trạng thái', 'Mã tham chiếu / lý do', ''].map((h, i) => <span key={i} className="th">{h}</span>)}</div>
      {rows.length === 0 && <div className="muted text-[13px] px-5 pb-4">Chưa có yêu cầu rút nào.</div>}
      {rows.map((w) => <div key={w.id} className="grid gap-3 items-center px-5 py-2.5 text-[13px]" style={{ gridTemplateColumns: cols, minWidth: 720, borderTop: `1px solid ${T.line}` }}><span className="muted">{fmtDate(w.requestedAt)}</span><span className="font-semibold">{money(w.amountMinor)}</span><span className="muted">{w.maskedAccount}</span><StatusTag status={w.status} /><span className="muted">{w.transferReference ?? w.rejectionReason ?? '—'}</span><span className="justify-self-end">{w.status === 'requested' && <Button size="sm" loading={cancel.isPending} onClick={() => cancel.mutate(w.id)}>Hủy yêu cầu</Button>}</span></div>)}
    </div>
  );
}

export function CommissionsTable({ rows }: { rows: Commission[] }) {
  const cols = '2fr 1.2fr 1fr 1fr 1fr 1.2fr';
  const unlock = (c: Commission) => (c.status === 'reversed' ? `Hoàn tiền ${c.reversedAt ? fmtDate(c.reversedAt) : ''}` : c.status === 'paid' ? (c.paidAt ? fmtDate(c.paidAt) : 'Đã trả') : c.availableAt ? fmtDate(c.availableAt) : '—');
  return (
    <div className="card overflow-hidden table-scroll">
      <div className="flex items-center px-5 py-3.5 flex-wrap gap-2"><span className="font-semibold">Hoa hồng gần đây</span><span className="muted text-[12px]">chỉ phát sinh khi người được giới thiệu trả phí</span></div>
      <div className="grid gap-3 px-5 pb-2" style={{ gridTemplateColumns: cols, minWidth: 720 }}>{['Người được giới thiệu', 'Gói', 'Gốc', 'Hoa hồng', 'Trạng thái', 'Mở khóa'].map((h) => <span key={h} className="th">{h}</span>)}</div>
      {rows.length === 0 && <div className="muted text-[13px] px-5 pb-4">Chưa có hoa hồng. Chia sẻ link của bạn để bắt đầu.</div>}
      {rows.map((c) => <div key={c.id} className="grid gap-3 items-center px-5 py-2.5 text-[13px]" style={{ gridTemplateColumns: cols, minWidth: 720, borderTop: `1px solid ${T.line}` }}><div className="flex items-center gap-2 min-w-0"><UserAvatar user={c.customer} size={26} /><span className="font-medium truncate">{c.customer.name}</span></div><span className="muted truncate">{c.title}</span><span className="muted">{money(c.baseMinor)}</span><span className="font-semibold">{money(c.amountMinor)}</span><StatusTag status={c.status} /><span className="muted">{unlock(c)}</span></div>)}
    </div>
  );
}
