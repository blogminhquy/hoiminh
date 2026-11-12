// Cài đặt · Nhận tiền (/:slug/cai-dat/nhan-tien). Tiền bán hàng của hội về thẳng tài khoản ngân hàng của chủ hội, không
// đi qua Hội Mình. Chủ hội nhập tài khoản và chọn cách xác nhận đơn: tự xác nhận (nối dịch vụ báo có của họ) hoặc tự
// bấm "Đã nhận tiền". Hội chưa cài thì các nút mua trong hội bị khóa. Cần quyền billing.manage.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, Select, T } from '@hoiminh/ui';
import { Check, Copy, Lock, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { shellKey, useCan, useShell } from '@/lib/community';
import { fmtDateTime } from '@/lib/format';
import { PendingOrders, payoutSetupKey, payoutSetupQuery, type ConfirmMode, type PayoutAccount, type PayoutSetup } from './PayoutParts';

interface Form { bankCode: string; accountNumber: string; accountHolder: string; confirmMode: ConfirmMode }
const MODES: Array<[ConfirmMode, string, string]> = [
  ['auto', 'Tự xác nhận', 'Nối dịch vụ báo có của bạn. Tiền về là đơn tự chuyển sang đã trả, người mua được mở quyền ngay.'],
  ['manual', 'Tôi tự bấm đã nhận tiền', 'Bạn kiểm tra tài khoản rồi bấm xác nhận từng đơn. Hợp khi mới bắt đầu, đơn còn ít.'],
];
const toForm = (a: PayoutAccount | null, banks: PayoutSetup['banks']): Form => ({ bankCode: a?.bankCode ?? banks[0]?.code ?? 'VCB', accountNumber: a?.accountNumber ?? '', accountHolder: a?.accountHolder ?? '', confirmMode: a?.confirmMode ?? 'manual' });

/** Địa chỉ báo có để dán vào dịch vụ báo biến động số dư của chủ hội (định dạng SePay). */
function WebhookBox({ communityId, account }: { communityId: string; account: PayoutAccount }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const rotate = useMutation({ mutationFn: () => api.post<PayoutAccount>(`/v1/communities/${communityId}/payout-account/rotate-webhook`, {}), onSuccess: () => void qc.invalidateQueries({ queryKey: payoutSetupKey(communityId) }) });
  const copy = () => { void navigator.clipboard.writeText(account.webhookUrl).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }, () => undefined); };
  return (
    <div className="card flex flex-col gap-3 p-5">
      <span className="font-bold text-[16px]">Nối dịch vụ báo có của bạn</span>
      <ol className="m-0 pl-5 flex flex-col gap-1.5 text-[15px] list-decimal" style={{ color: T.ink2 }}>
        <li>Mở dịch vụ báo biến động số dư bạn đang dùng cho tài khoản trên (hiện nhận định dạng của SePay).</li>
        <li>Tạo một webhook cho giao dịch tiền vào, dán địa chỉ bên dưới. Không cần chứng thực thêm: địa chỉ này là bí mật riêng của hội.</li>
        <li>Từ lần chuyển khoản sau, đơn có đúng nội dung và đủ tiền sẽ tự chuyển sang đã trả.</li>
      </ol>
      <div className="flex gap-2 items-center flex-wrap">
        <code className="flex-grow min-w-0 break-all rounded-[10px] px-3 py-2.5 text-[14px]" style={{ background: T.bg, flexBasis: 280 }}>{account.webhookUrl}</code>
        <Button size="sm" onClick={copy} icon={copied ? <Check size={16} /> : <Copy size={16} />}>{copied ? 'Đã sao chép' : 'Sao chép'}</Button>
      </div>
      <div className="flex items-center gap-3 flex-wrap text-[14px]" style={{ color: T.ink3 }}>
        <span className="flex-grow">{account.lastWebhookAt ? `Lần báo có gần nhất: ${fmtDateTime(account.lastWebhookAt)}.` : 'Chưa nhận được lần báo có nào. Trong lúc chờ, bạn vẫn bấm "Đã nhận tiền" được cho từng đơn.'}</span>
        <Button size="sm" loading={rotate.isPending} onClick={() => { if (window.confirm('Đổi địa chỉ báo có? Địa chỉ cũ ngừng nhận ngay, bạn cần dán địa chỉ mới vào dịch vụ báo có.')) rotate.mutate(); }} icon={<RefreshCw size={16} />}>Đổi địa chỉ</Button>
      </div>
      {rotate.isError && <span className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(rotate.error)}</span>}
    </div>
  );
}

function Setup({ d }: { d: PayoutSetup }) {
  const shell = useShell();
  const qc = useQueryClient();
  const cid = shell.community.id;
  const [f, setF] = useState<Form>(() => toForm(d.account, d.banks));
  const [savedOnce, setSavedOnce] = useState(false);
  // Tài khoản trên máy chủ đổi (lưu xong, người khác sửa) thì nạp lại ô nhập.
  useEffect(() => { setF(toForm(d.account, d.banks)); }, [d.account?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (p: Partial<Form>) => { setF((prev) => ({ ...prev, ...p })); setSavedOnce(false); };
  const save = useMutation({
    mutationFn: () => api.put<PayoutAccount>(`/v1/communities/${cid}/payout-account`, { ...f, accountNumber: f.accountNumber.replace(/\s/g, '') }),
    onSuccess: () => {
      setSavedOnce(true);
      void qc.invalidateQueries({ queryKey: payoutSetupKey(cid) });
      void qc.invalidateQueries({ queryKey: ['payout-settings', cid] });
      void qc.invalidateQueries({ queryKey: ['overview', cid] });
      void qc.invalidateQueries({ queryKey: shellKey(shell.community.slug) });
    },
  });
  const dirty = JSON.stringify(f) !== JSON.stringify(toForm(d.account, d.banks));
  const valid = /^\d{6,20}$/.test(f.accountNumber.replace(/\s/g, '')) && f.accountHolder.trim().length >= 3;
  return (
    <>
      <div className="flex items-start gap-3 rounded-[14px] px-4 py-3.5" role="status" style={{ background: d.ready ? T.tealSoft : T.goldSoft, color: d.ready ? T.tealText : T.goldText }}>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-2" style={{ background: d.ready ? T.teal : T.gold }} />
        <div className="flex flex-col">
          <span className="font-bold text-[16px]">{d.ready ? 'Hội đã mở thanh toán' : 'Hội chưa cài nhận tiền'}</span>
          <span className="text-[15px]">{d.ready ? `Tiền người mua chuyển về thẳng tài khoản ${d.account!.bankName} ${d.account!.accountNumber} của bạn.` : 'Các nút mua trong hội đang khóa. Nhập tài khoản nhận tiền của bạn để mở.'}</span>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex flex-col gap-4 w-full lg:flex-[1.3_1_0] min-w-0">
          <div className="card flex flex-col gap-3.5 p-5">
            <span className="font-bold text-[16px]">1. Tài khoản nhận tiền của bạn</span>
            <div className="grid-2">
              <Field label="Ngân hàng"><Select aria-label="Ngân hàng" value={f.bankCode} onChange={(e) => patch({ bankCode: e.target.value })}>{d.banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</Select></Field>
              <Field label="Số tài khoản"><Input inputMode="numeric" value={f.accountNumber} onChange={(e) => patch({ accountNumber: e.target.value.replace(/[^\d\s]/g, '').slice(0, 24) })} placeholder="Số tài khoản" /></Field>
            </div>
            <Field label="Tên chủ tài khoản"><Input value={f.accountHolder} onChange={(e) => patch({ accountHolder: e.target.value.toUpperCase().slice(0, 80) })} placeholder="Viết đúng như trên tài khoản ngân hàng" /></Field>
            <p className="m-0 text-[14px]" style={{ color: T.ink3 }}>Người mua thấy mã QR chuyển khoản tới đúng tài khoản này, kèm nội dung chuyển khoản có mã đơn. Hội Mình không giữ tiền và không thu phí trên doanh thu.</p>
          </div>
          <div className="card flex flex-col gap-3 p-5">
            <span className="font-bold text-[16px]">2. Xác nhận đơn</span>
            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Cách xác nhận đơn">
              {MODES.map(([k, name, desc]) => {
                const on = f.confirmMode === k;
                return (
                  <button key={k} type="button" role="radio" aria-checked={on} onClick={() => patch({ confirmMode: k })} className="flex items-start gap-3 text-left rounded-[14px] px-4 py-3.5" style={{ border: `1.5px solid ${on ? T.teal : T.line2}`, background: on ? T.tealSoft : T.surface }}>
                    <span className="w-5 h-5 rounded-full flex-shrink-0 inline-flex items-center justify-center mt-0.5" style={{ border: `2px solid ${on ? T.teal : T.line2}` }}>{on && <span className="w-2.5 h-2.5 rounded-full" style={{ background: T.teal }} />}</span>
                    <span className="flex flex-col"><span className="font-bold text-[16px]">{name}</span><span className="text-[14px]" style={{ color: T.ink2 }}>{desc}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {save.isError && <span className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</span>}
            {savedOnce && !dirty && <span className="text-[14px] inline-flex items-center gap-1.5" style={{ color: T.tealText }}><Check size={16} />Đã lưu.</span>}
            <span className="flex-grow" />
            <Button variant="primary" size="lg" disabled={!valid || (!dirty && d.ready)} loading={save.isPending} onClick={() => save.mutate()}>{d.ready ? 'Lưu thay đổi' : 'Lưu và mở thanh toán'}</Button>
          </div>
          {d.account && d.account.confirmMode === 'auto' && <WebhookBox communityId={cid} account={d.account} />}
        </div>
        <div className="flex flex-col gap-4 w-full lg:flex-1 min-w-0">
          <div className="card flex flex-col gap-3 p-5">
            <span className="font-bold text-[16px]">Người mua sẽ thấy</span>
            {d.ready
              ? <span className="btn btn-primary w-full" style={{ minHeight: 48, pointerEvents: 'none' }}>Lấy mã QR chuyển khoản</span>
              : <span className="btn btn-ghost w-full" style={{ minHeight: 48, pointerEvents: 'none', opacity: 0.7 }}><Lock size={16} />Hội chưa mở thanh toán</span>}
            <span className="text-[14px]" style={{ color: T.ink3 }}>{d.ready ? `Nút mua đã mở. Bấm vào, người mua thấy mã QR chuyển khoản tới tài khoản ${d.account!.accountHolder}.` : 'Nút mua bị khóa cho tới khi bạn cài nhận tiền.'}</span>
          </div>
          {d.ready && <PendingOrders communityId={cid} orders={d.pending} mode={d.account!.confirmMode} />}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  const shell = useShell();
  const can = useCan();
  const q = useQuery({ ...payoutSetupQuery(shell.community.id), enabled: can('billing.manage') });
  if (!can('billing.manage')) return <Navigate to={`/${shell.community.slug}/cai-dat`} replace />;
  return (
    <>
      <div>
        <h1 className="serif m-0 text-[28px] font-extrabold">Nhận tiền</h1>
        <div className="muted">Tiền bán hàng của hội về thẳng tài khoản của bạn, không đi qua Hội Mình. Hội Mình không thu phí trên doanh thu.</div>
      </div>
      <QueryState q={q} rows={4}>{(d) => <Setup d={d} />}</QueryState>
    </>
  );
}
