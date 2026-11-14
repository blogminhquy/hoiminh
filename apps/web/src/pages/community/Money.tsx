// Tiền (/:slug/tien). Tiền bán hàng của hội về thẳng tài khoản của chủ hội, nên trang này không còn số dư hay nút rút.
// Trên cùng: hội đã cài nhận tiền chưa, đã thu 30 ngày, các đơn chờ chủ hội bấm "Đã nhận tiền". Dưới là số liệu theo kỳ
// và bảng giao dịch (hoàn tiền, xuất CSV). Phần trên cần quyền billing.manage, giao dịch cần quyền revenue.read.
import { useMutation, useQuery } from '@tanstack/react-query';
import { Chip, StatCard, StatusTag, T, money } from '@hoiminh/ui';
import { Clock, Download, Handshake, Lock, ShieldCheck, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { UserAvatar, type UserLite } from '@/components/UserLink';
import { api, errorMessage } from '@/lib/api';
import { useCan, useShell } from '@/lib/community';
import { fmtDate } from '@/lib/format';
import { BUYER_METHOD_NAME } from '@/lib/payment-methods';
import type { PaymentProvider } from '@hoiminh/contracts';
import { PendingOrders, payoutSetupQuery } from '@/pages/settings/PayoutParts';
import { AdminRefundModal, type RefundTarget } from './RevenueParts';

interface Payout { ready: boolean; account: { bankName: string; accountNumber: string; accountHolder: string; confirmMode: 'manual' | 'auto' } | null; /** Các cách người mua đang thấy. */ methods?: PaymentProvider[]; received30Minor: number; pendingCount: number; pendingMinor: number; affiliatePendingMinor: number; affiliatePendingCount: number; ownerName: string }
interface Tx { orderId: string; at: string; customer: UserLite; title: string; method: string; provider: string; amountMinor: number; commissionMinor: number; reversedCommissionMinor: number; status: string }
interface Revenue { stats: { grossMinor: number; txCount: number; netMinor: number; refundedMinor: number; refundCount: number; owedToAffiliatesMinor: number; referredCount: number }; items: Tx[] }
const RANGES: Array<[number, string]> = [[1, 'Hôm nay'], [30, '30 ngày'], [90, 'Quý'], [365, 'Năm']];
const PROVIDER: Record<string, string> = { sepay: 'Chuyển khoản', momo: 'MoMo', vnpay: 'VNPAY', paypal: 'PayPal' };

function toCsv(items: Tx[]): string {
  const rows = [['Ngày', 'Thành viên', 'Sản phẩm', 'Phương thức', 'Số tiền', 'Nợ affiliate', 'Trạng thái'], ...items.map((t) => [fmtDate(t.at), t.customer.name, t.title, PROVIDER[t.provider] ?? t.method, String(t.amountMinor), String(t.commissionMinor), t.status])];
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
}

/** Khối đầu trang: hội đã cài nhận tiền chưa, đã thu bao nhiêu, và các đơn đang chờ chủ hội xác nhận. */
function Balance() {
  const shell = useShell();
  const cid = shell.community.id;
  const q = useQuery({ queryKey: ['payout-settings', cid], queryFn: () => api.get<Payout>(`/v1/communities/${cid}/payout`) });
  const setup = useQuery(payoutSetupQuery(cid));
  const label = 'muted text-[13px] font-semibold uppercase tracking-[0.06em]';
  const settings = `/${shell.community.slug}/cai-dat/nhan-tien`;
  return (
    <QueryState q={q} rows={2}>
      {(d) => (
        <>
          <section className="card card-invert flex flex-col gap-4" style={{ padding: '20px 22px' }} aria-label="Nhận tiền">
            <div className="flex items-end gap-x-8 gap-y-4 flex-wrap">
              <div><div className={label}>Đã thu 30 ngày</div><div className="serif text-[30px] font-extrabold leading-tight">{money(d.received30Minor)}</div></div>
              <div><div className={label}>Đơn chờ xác nhận</div><div className="serif text-[22px] font-extrabold">{d.pendingCount}{d.pendingCount > 0 ? ` · ${money(d.pendingMinor)}` : ''}</div></div>
              <span className="flex-grow" />
              <Link to={settings} className="btn btn-gold w-full sm:w-auto"><Wallet size={18} />{d.ready ? 'Cách nhận tiền' : 'Cài nhận tiền'}</Link>
            </div>
            <div className="muted text-[14px] flex flex-col gap-1">
              {d.ready
                ? <span className="flex items-start gap-1.5"><ShieldCheck size={16} className="flex-shrink-0 mt-0.5" />{d.account ? `Người mua chuyển khoản thẳng tới ${d.account.bankName} ${d.account.accountNumber} (${d.account.accountHolder}). ` : ''}{(d.methods ?? []).some((m) => m !== 'sepay') ? `Người mua trả qua: ${(d.methods ?? []).map((m) => BUYER_METHOD_NAME[m]).join(', ')}, tiền về thẳng tài khoản của bạn. ` : ''}Hội Mình không giữ tiền và không thu phí trên doanh thu.</span>
                : <span className="flex items-start gap-1.5" style={{ color: T.gold }}><Lock size={16} className="flex-shrink-0 mt-0.5" />Hội chưa cài nhận tiền nên các nút mua đang khóa. Cài chuyển khoản QR hoặc một cổng thanh toán để mở.</span>}
              {d.ready && d.account && <span className="flex items-start gap-1.5"><Clock size={16} className="flex-shrink-0 mt-0.5" />{d.account.confirmMode === 'auto' ? 'Đơn tự xác nhận khi dịch vụ báo có của bạn gọi về.' : 'Bạn kiểm tra tài khoản rồi bấm "Đã nhận tiền" cho từng đơn.'}</span>}
            </div>
          </section>
          {d.ready && setup.data?.account && setup.data.pending.length > 0 && <PendingOrders communityId={cid} orders={setup.data.pending} mode={setup.data.account.confirmMode} />}
          {d.affiliatePendingCount > 0 && (
            <Link to={`/${shell.community.slug}/cong-su`} className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[15px] font-semibold" style={{ background: T.accentSoft, color: T.accentText }}>
              <Handshake size={18} className="flex-shrink-0" /><span className="flex-grow">{d.affiliatePendingCount} yêu cầu rút của affiliate đang chờ, cần chuyển {money(d.affiliatePendingMinor)}</span><span className="whitespace-nowrap">Xử lý</span>
            </Link>
          )}
        </>
      )}
    </QueryState>
  );
}

function Transactions() {
  const shell = useShell();
  const can = useCan();
  const [days, setDays] = useState(30);
  const [refund, setRefund] = useState<RefundTarget | null>(null);
  const q = useQuery({ queryKey: ['revenue', shell.community.id, days], queryFn: () => api.get<Revenue>(`/v1/communities/${shell.community.id}/revenue?days=${days}`) });
  const refundM = useMutation({
    mutationFn: (p: { orderId: string; reason: string }) => api.post(`/v1/orders/${p.orderId}/admin-refund`, { reason: p.reason }),
    onSuccess: () => { setRefund(null); void q.refetch(); },
  });
  const canRefund = can('billing.manage');
  const exportCsv = () => {
    if (!q.data) return;
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(q.data.items)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `doanh-thu-${shell.community.slug}-${days}d.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const cols = canRefund ? '90px 1.6fr 1.6fr 1.1fr 1.1fr 1.1fr 1fr 96px' : '90px 1.6fr 1.6fr 1.1fr 1.1fr 1.1fr 1fr';
  const heads = canRefund ? ['Ngày', 'Thành viên', 'Sản phẩm', 'Phương thức', 'Số tiền', 'Nợ affiliate', 'Trạng thái', ''] : ['Ngày', 'Thành viên', 'Sản phẩm', 'Phương thức', 'Số tiền', 'Nợ affiliate', 'Trạng thái'];
  const minW = canRefund ? 956 : 860;
  return (
    <>
      <div className="flex items-center gap-3 flex-wrap pt-1">
        <h2 className="m-0 font-bold text-[18px]">Doanh thu</h2>
        <div className="chip-row md:ml-2" style={{ width: 'auto' }}>{RANGES.map(([d, l]) => <Chip key={d} on={days === d} onClick={() => setDays(d)}>{l}</Chip>)}</div>
        <span className="flex-grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!q.data}><Download size={14} />Xuất CSV</button>
      </div>
      <QueryState q={q} rows={4}>
        {(d) => (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Tổng thu" value={money(d.stats.grossMinor)} sub={`${d.stats.txCount} giao dịch · không phí giao dịch`} />
              <StatCard label="Đã thu" value={money(d.stats.netMinor)} sub={d.stats.refundCount ? `sau ${d.stats.refundCount} hoàn tiền` : 'chưa có hoàn tiền'} subColor={T.teal} />
              <StatCard label="Nợ affiliate" value={money(d.stats.owedToAffiliatesMinor)} sub={`bạn tự chuyển khoản · ${d.stats.referredCount} giao dịch có giới thiệu`} subColor={T.goldText} />
              <StatCard label="Hoàn tiền" value={money(d.stats.refundedMinor)} sub={`${d.stats.refundCount} giao dịch`} subColor={T.ink3} />
            </div>
            <div className="card overflow-hidden table-scroll">
              <div className="grid gap-3 px-5 py-3" style={{ gridTemplateColumns: cols, minWidth: minW }}>{heads.map((h, i) => <span key={h || `c${i}`} className="th">{h}</span>)}</div>
              {d.items.length === 0 && <div className="muted text-[13px] text-center py-8">Chưa có giao dịch trong kỳ này</div>}
              {d.items.map((t) => (
                <div key={t.orderId} className="grid gap-3 items-center px-5 py-3 text-[13px]" style={{ gridTemplateColumns: cols, minWidth: minW, borderTop: `1px solid ${T.line}` }}>
                  <span className="muted">{fmtDate(t.at).slice(0, 5)}</span>
                  <div className="flex items-center gap-2 min-w-0"><UserAvatar user={t.customer} size={26} /><span className="font-medium truncate">{t.customer.name}</span></div>
                  <span className="truncate">{t.title}</span>
                  <span className="muted">{PROVIDER[t.provider] ?? (t.method || 'Khác')}</span>
                  <span className="font-semibold">{money(t.amountMinor)}</span>
                  <span className="font-semibold" style={{ color: T.goldText }}>{t.status === 'refunded' && t.reversedCommissionMinor ? `đảo ${money(t.reversedCommissionMinor)}` : money(t.commissionMinor)}</span>
                  <StatusTag status={t.status === 'paid' ? 'succeeded' : t.status} />
                  {canRefund && (
                    <span className="justify-self-end">
                      {t.status === 'paid' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRefund({ orderId: t.orderId, title: t.title, customerName: t.customer.name, amountMinor: t.amountMinor, commissionMinor: t.commissionMinor, provider: t.provider })}>Hoàn tiền</button>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </QueryState>
      <AdminRefundModal
        target={refund}
        onClose={() => setRefund(null)}
        pending={refundM.isPending}
        error={refundM.isError ? errorMessage(refundM.error) : null}
        onSubmit={(reason) => { if (refund) refundM.mutate({ orderId: refund.orderId, reason }); }}
      />
    </>
  );
}

export default function Page() {
  const shell = useShell();
  const can = useCan();
  const canBalance = can('billing.manage');
  const canTx = can('revenue.read');
  if (!canBalance && !canTx) return <Navigate to={`/${shell.community.slug}/hom-nay`} replace />;
  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 1080 }}>
      <div>
        <h1 className="serif m-0 text-[28px] font-extrabold">Tiền</h1>
        <div className="muted text-[15px]">Nhận tiền, đơn chờ xác nhận, giao dịch và hoàn tiền. Cách khách thanh toán chỉnh ở <Link to={`/${shell.community.slug}/cai-dat/gia`} className="font-semibold">Cài đặt, mục Bán hàng</Link>.</div>
      </div>
      {canBalance && <Balance />}
      {canTx && <Transactions />}
    </div>
  );
}
