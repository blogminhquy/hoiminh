// Quản lý đơn hàng (/:slug/tien; địa chỉ giữ nguyên vì email và thông báo đang dẫn tới đây). Tiền bán hàng của hội về
// thẳng tài khoản của chủ hội, nên trang này không có số dư hay nút rút.
// Trên cùng, ngoài hai tab, là phần cần xử lý ngay: cách nhận tiền (gọn một khối) và các đơn chờ chủ hội bấm
// "Đã nhận tiền" (không có đơn chờ thì không chiếm chỗ). Dưới là hai tab, tab đang mở nằm trên địa chỉ (?tab=):
// Thống kê (số liệu theo kỳ) và Tất cả đơn hàng (danh sách có lọc, phân trang, xuất CSV). Xem OrdersParts.tsx.
// Khối trên cần quyền billing.manage, hai tab cần quyền revenue.read; thành viên thường không vào được trang này.
import { useQuery } from '@tanstack/react-query';
import { T, money } from '@hoiminh/ui';
import { Handshake, Lock, ShieldCheck, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useCan, useShell } from '@/lib/community';
import type { RangeChoice } from '@/lib/date-range';
import { ORDER_TABS, orderTabOf, type OrderFilters, type OrderTab } from '@/lib/orders';
import { BUYER_METHOD_NAME } from '@/lib/payment-methods';
import type { PaymentProvider } from '@hoiminh/contracts';
import { PendingOrders, payoutSetupQuery } from '@/pages/settings/PayoutParts';
import { OrdersTab, StatsTab } from './OrdersParts';

interface Payout { ready: boolean; account: { bankName: string; accountNumber: string; accountHolder: string; confirmMode: 'manual' | 'auto' } | null; /** Các cách người mua đang thấy. */ methods?: PaymentProvider[]; received30Minor: number; pendingCount: number; pendingMinor: number; affiliatePendingMinor: number; affiliatePendingCount: number; ownerName: string }

/** Phần cần xử lý ngay: hội đã cài nhận tiền chưa, đã thu bao nhiêu, và các đơn đang chờ chủ hội xác nhận. */
function Receiving() {
  const shell = useShell();
  const cid = shell.community.id;
  const q = useQuery({ queryKey: ['payout-settings', cid], queryFn: () => api.get<Payout>(`/v1/communities/${cid}/payout`) });
  const setup = useQuery(payoutSetupQuery(cid));
  const settings = `/${shell.community.slug}/cai-dat/nhan-tien`;
  return (
    <QueryState q={q} rows={1}>
      {(d) => (
        <>
          <section className="card flex flex-col gap-2" style={{ padding: '14px 18px' }} aria-label="Nhận tiền">
            <div className="flex items-center gap-x-6 gap-y-2 flex-wrap">
              <div className="flex items-baseline gap-2"><span className="muted text-[14px]">Đã thu 30 ngày</span><span className="serif text-[20px] font-extrabold">{money(d.received30Minor)}</span></div>
              <div className="flex items-baseline gap-2"><span className="muted text-[14px]">Đơn chờ xác nhận</span><span className="serif text-[20px] font-extrabold">{d.pendingCount}{d.pendingCount > 0 ? ` · ${money(d.pendingMinor)}` : ''}</span></div>
              <span className="flex-grow" />
              <Link to={settings} className={`btn btn-sm w-full sm:w-auto ${d.ready ? 'btn-ghost' : 'btn-gold'}`}><Wallet size={16} />{d.ready ? 'Cách nhận tiền' : 'Cài nhận tiền'}</Link>
            </div>
            {d.ready
              ? (
                <span className="muted text-[14px] flex items-start gap-1.5">
                  <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {d.account ? `Người mua chuyển khoản thẳng tới ${d.account.bankName} ${d.account.accountNumber} (${d.account.accountHolder}). ` : ''}
                    {(d.methods ?? []).some((m) => m !== 'sepay') ? `Người mua trả qua: ${(d.methods ?? []).map((m) => BUYER_METHOD_NAME[m]).join(', ')}, tiền về thẳng tài khoản của bạn. ` : ''}
                    {d.account ? (d.account.confirmMode === 'auto' ? 'Đơn tự xác nhận khi dịch vụ báo có của bạn gọi về. ' : 'Bạn kiểm tra tài khoản rồi bấm "Đã nhận tiền" cho từng đơn. ') : ''}
                    Hội Mình không giữ tiền và không thu phí trên doanh thu.
                  </span>
                </span>
              )
              : <span className="text-[14px] font-semibold flex items-start gap-1.5" style={{ color: T.goldText }}><Lock size={16} className="flex-shrink-0 mt-0.5" />Hội chưa cài nhận tiền nên các nút mua đang khóa. Cài chuyển khoản QR hoặc một cổng thanh toán để mở.</span>}
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

export default function Page() {
  const shell = useShell();
  const can = useCan();
  const canReceive = can('billing.manage');
  const canOrders = can('revenue.read');
  const [params, setParams] = useSearchParams();
  const tab = orderTabOf(params.get('tab'));
  // Bộ lọc của từng tab giữ ở đây để chuyển tab qua lại không mất. Thống kê mở sẵn 30 ngày, danh sách đơn mở sẵn 90 ngày.
  const [statsChoice, setStatsChoice] = useState<RangeChoice>({ preset: 'last30' });
  const [ordersChoice, setOrdersChoice] = useState<RangeChoice>({ preset: 'last90' });
  const [filters, setFilters] = useState<OrderFilters>({ status: '', affiliate: '', q: '' });
  if (!canReceive && !canOrders) return <Navigate to={`/${shell.community.slug}/hom-nay`} replace />;
  const open = (key: OrderTab) => setParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', key); return next; }, { replace: true });
  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 1080 }}>
      <div>
        <h1 className="serif m-0 text-[28px] font-extrabold">Quản lý đơn hàng</h1>
        <div className="muted text-[15px]">Đơn chờ xác nhận, thống kê doanh thu và mọi đơn của hội. Cách khách thanh toán chỉnh ở <Link to={`/${shell.community.slug}/cai-dat/gia`} className="font-semibold">Cài đặt hội, mục Bán hàng</Link>.</div>
      </div>
      {canReceive && <Receiving />}
      {canOrders && (
        <>
          <div className="seg order-tabs" role="tablist" aria-label="Quản lý đơn hàng">
            {ORDER_TABS.map((t) => (
              <button key={t.key} type="button" role="tab" id={`order-tab-${t.key}`} aria-selected={tab === t.key} aria-controls="order-tab-panel" tabIndex={tab === t.key ? 0 : -1} className={tab === t.key ? 'on' : ''} onClick={() => open(t.key)}
                onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const other = ORDER_TABS.find((x) => x.key !== t.key)!; open(other.key); document.getElementById(`order-tab-${other.key}`)?.focus(); } }}>
                {t.label}
              </button>
            ))}
          </div>
          <div id="order-tab-panel" role="tabpanel" aria-labelledby={`order-tab-${tab}`} className="flex flex-col gap-4">
            {tab === 'thong-ke'
              ? <StatsTab choice={statsChoice} onChoice={setStatsChoice} />
              : <OrdersTab choice={ordersChoice} onChoice={setOrdersChoice} filters={filters} onFilters={setFilters} />}
          </div>
        </>
      )}
    </div>
  );
}
