// Tài khoản · Gói và thanh toán (accountBillingMain): gói đang dùng (đổi kỳ, hủy/tiếp tục), trọn đời, phương thức, lịch sử + hóa đơn + hoàn tiền.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CommunityMark, T, money } from '@hoiminh/ui';
import { QrCode } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { HistoryTable, InvoiceModal, RefundModal, providerLabel, type BillingHistoryRow } from './AccountBillingParts';

interface CommunityLite { id: string; name: string; slug: string; logoMark: string; logoColor: string }
interface Sub { id: string; status: 'active' | 'cancelling' | 'past_due'; billingCycle: 'monthly' | 'yearly'; amountMinor: number; currentPeriodEnd: string; cancelAtPeriodEnd: boolean; provider: string | null; community: CommunityLite | null; tier: { name: string; key: string } | null }
interface Billing { subscriptions: Sub[]; lifetime: Array<{ orderId: string; community: CommunityLite | null; amountMinor: number; paidAt: string | null }>; history: BillingHistoryRow[] }

function SubRow({ s, onToggle, pending }: { s: Sub; onToggle: () => void; pending: boolean }) {
  const cycle = s.billingCycle === 'yearly' ? 'năm' : 'tháng';
  const ending = s.status === 'cancelling' || s.cancelAtPeriodEnd;
  return (
    <div className="flex items-center gap-4 py-4 flex-wrap" style={{ borderTop: `1px solid ${T.line}` }}>
      {s.community && <CommunityMark mark={s.community.logoMark} color={s.community.logoColor} size={44} radius={12} />}
      <div className="flex-grow flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold">{s.community?.name ?? 'Hội Mình'}</span><span className="tag" style={{ background: T.goldSoft, color: T.goldText }}>{s.tier?.name ?? 'Gói'}</span>{s.status === 'past_due' && <span className="tag" style={{ background: T.accentSoft, color: T.accentText }}>Quá hạn</span>}</div>
        <div className="muted text-[13px]">{money(s.amountMinor)}/{cycle} · {ending ? `kết thúc ${fmtDate(s.currentPeriodEnd)}` : `gia hạn ${fmtDate(s.currentPeriodEnd)}`} · {providerLabel(s.provider)}</div>
      </div>
      {s.community && s.billingCycle === 'monthly' && !ending && <Link to={`/${s.community.slug}/thanh-toan?tier=${s.tier?.key ?? 'premium'}&cycle=yearly`} className="btn btn-ghost btn-sm">Đổi sang năm</Link>}
      <button type="button" className="btn btn-ghost btn-sm" style={{ color: ending ? T.teal : T.accentText }} disabled={pending} onClick={onToggle}>{ending ? 'Tiếp tục gia hạn' : 'Hủy gia hạn'}</button>
    </div>
  );
}

export default function Page() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['billing'], queryFn: () => api.get<Billing>('/v1/me/billing') });
  const [invoice, setInvoice] = useState<BillingHistoryRow | null>(null);
  const [refund, setRefund] = useState<BillingHistoryRow | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['billing'] });
  const toggle = useMutation({ mutationFn: (s: Sub) => api.post(`/v1/me/subscriptions/${s.id}/${s.status === 'cancelling' || s.cancelAtPeriodEnd ? 'resume' : 'cancel'}`, {}), onSuccess: () => void refresh() });
  const refundM = useMutation({ mutationFn: (p: { orderId: string; reason: string }) => api.post(`/v1/me/orders/${p.orderId}/refund`, { reason: p.reason }), onSuccess: () => { setRefund(null); void refresh(); } });
  return (
    <>
      <div><h1 className="serif m-0 text-[28px] font-extrabold">Gói và thanh toán</h1><div className="muted text-[13px]">Các gói bạn đang trả, cách trả và hóa đơn</div></div>
      {toggle.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(toggle.error)}</div>}
      <QueryState q={q} rows={4}>
        {(d) => (
          <>
            <div className="card flex flex-col" style={{ padding: '20px 24px' }}>
              <span className="font-semibold pb-2">Gói đang dùng</span>
              {d.subscriptions.length === 0 && d.lifetime.length === 0 && <div className="muted text-[13px] py-2">Bạn chưa trả phí gói nào. Khám phá hội và nâng cấp khi cần.</div>}
              {d.subscriptions.map((s) => <SubRow key={s.id} s={s} pending={toggle.isPending} onToggle={() => toggle.mutate(s)} />)}
              {d.lifetime.map((l) => (
                <div key={l.orderId} className="flex items-center gap-4 py-4" style={{ borderTop: `1px solid ${T.line}` }}>
                  {l.community && <CommunityMark mark={l.community.logoMark} color={l.community.logoColor} size={44} radius={12} />}
                  <div className="flex-grow"><div className="flex items-center gap-2"><span className="font-semibold">{l.community?.name}</span><span className="tag" style={{ background: T.goldSoft, color: T.goldText }}>Trọn đời</span></div><div className="muted text-[13px]">Đã trả {money(l.amountMinor)} · không cần gia hạn</div></div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const r = d.history.find((h) => h.orderId === l.orderId); if (r) setInvoice(r); }}>Hóa đơn</button>
                </div>
              ))}
            </div>
            <div className="card flex flex-col gap-3" style={{ padding: '20px 24px' }}>
              <span className="font-semibold">Phương thức thanh toán</span>
              <div className="muted text-[13px]">Mỗi lần thanh toán bạn chọn chuyển khoản QR, MoMo, VNPAY hoặc PayPal. Hội Mình không lưu thẻ hay số tài khoản của bạn.</div>
              <div className="muted text-[12px] flex items-center gap-1.5"><QrCode size={14} />Chuyển khoản QR không cần lưu, mỗi kỳ bạn sẽ nhận nhắc thanh toán trước 3 ngày</div>
            </div>
            <HistoryTable rows={d.history} onInvoice={setInvoice} onRefund={setRefund} />
          </>
        )}
      </QueryState>
      <InvoiceModal row={invoice} buyer={{ name: user?.name ?? '', email: user?.email ?? '' }} onClose={() => setInvoice(null)} />
      <RefundModal row={refund} onClose={() => setRefund(null)} pending={refundM.isPending} error={refundM.isError ? errorMessage(refundM.error) : null} onSubmit={(reason) => { if (refund) refundM.mutate({ orderId: refund.orderId, reason }); }} />
    </>
  );
}
