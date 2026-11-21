// Hai tab của trang Quản lý đơn hàng (/:slug/tien).
// Thống kê: bộ lọc khoảng ngày, bốn ô số liệu, số đơn theo trạng thái, doanh thu qua affiliate so với phần còn lại.
// Tất cả đơn hàng: mọi đơn của hội, mới đặt nhất trước, lọc theo khoảng ngày đặt, trạng thái, affiliate và ô tìm;
// tải từng trang bằng nút "Xem thêm"; xuất CSV theo đúng bộ lọc. Máy tính là bảng, điện thoại mỗi đơn một thẻ.
import { ORDER_VIEW_STATUS_LABEL, vnDay, type OrderViewStatus } from '@hoiminh/contracts';
import { Button, ErrorBox, Input, Prog, Select, StatCard, T, Tag, money } from '@hoiminh/ui';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DateRangePicker } from '@/components/DateRangePicker';
import { LoadingBlock, QueryState } from '@/components/QueryState';
import { UserAvatar } from '@/components/UserLink';
import { api, errorMessage } from '@/lib/api';
import { useCan, useShell } from '@/lib/community';
import { choiceRange, rangeFileSuffix, rangeQuery, type RangeChoice } from '@/lib/date-range';
import { saveBlob, toCsvBlob } from '@/lib/download';
import { fmtDate, fmtTime } from '@/lib/format';
import { ORDER_AFFILIATE_FILTERS, ORDER_STATUS_FILTERS, ORDER_STATUS_ORDER, ORDER_STATUS_TONE, commissionOf, orderCsvRows, orderMethod, ordersQuery, type OrderFilters, type OrderItem, type OrdersPage } from '@/lib/orders';
import { payoutSetupKey } from '@/pages/settings/PayoutParts';
import { AdminRefundModal, type RefundTarget } from './RevenueParts';

interface Revenue {
  stats: { grossMinor: number; txCount: number; netMinor: number; refundedMinor: number; refundCount: number; owedToAffiliatesMinor: number; referredCount: number; referredMinor?: number };
  ordersByStatus?: Record<OrderViewStatus, number>;
}

/** Mỗi lần tải thêm từng này đơn; bản xuất CSV lấy đủ kết quả đang lọc (tới giới hạn của API). */
const PAGE_ROWS = 30;
const EXPORT_ROWS = 5000;
const when = (iso: string) => `${fmtDate(iso)} ${fmtTime(iso)}`;

function StatusTag({ status }: { status: OrderViewStatus }) {
  return <Tag tone={ORDER_STATUS_TONE[status]}>{ORDER_VIEW_STATUS_LABEL[status]}</Tag>;
}

/** Tab Thống kê: tiền tính theo ngày trả, số đơn theo trạng thái tính trên các đơn đặt trong kỳ. */
export function StatsTab({ choice, onChoice }: { choice: RangeChoice; onChoice: (next: RangeChoice) => void }) {
  const shell = useShell();
  // Khoảng ngày theo giờ Việt Nam, tính cả hai đầu. Mốc bấm nhanh tính lại theo ngày hôm nay mỗi lần vẽ.
  const range = choiceRange(choice, vnDay(new Date()));
  const q = useQuery({ queryKey: ['revenue', shell.community.id, range.from, range.to], queryFn: () => api.get<Revenue>(`/v1/communities/${shell.community.id}/revenue?${rangeQuery(range)}&limit=1`) });
  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="m-0 font-bold text-[18px]">Doanh thu</h2>
        <DateRangePicker value={choice} onChange={onChoice} className="md:ml-2" />
      </div>
      <QueryState q={q} rows={3}>
        {(d) => {
          const counts = d.ordersByStatus;
          const totalOrders = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
          const referred = d.stats.referredMinor;
          const direct = referred === undefined ? 0 : Math.max(0, d.stats.netMinor - referred);
          const share = referred !== undefined && d.stats.netMinor > 0 ? Math.round((referred / d.stats.netMinor) * 100) : 0;
          return (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Tổng thu" value={money(d.stats.grossMinor)} sub={`${d.stats.txCount} giao dịch · không phí giao dịch`} />
                <StatCard label="Đã thu" value={money(d.stats.netMinor)} sub={d.stats.refundCount ? `sau ${d.stats.refundCount} hoàn tiền` : 'chưa có hoàn tiền'} subColor={T.teal} />
                <StatCard label="Nợ affiliate" value={money(d.stats.owedToAffiliatesMinor)} sub={`bạn tự chuyển khoản · ${d.stats.referredCount} giao dịch có giới thiệu`} subColor={T.goldText} />
                <StatCard label="Hoàn tiền" value={money(d.stats.refundedMinor)} sub={`${d.stats.refundCount} giao dịch`} subColor={T.ink3} />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {counts && (
                  <section className="card flex flex-col gap-1" style={{ padding: '16px 18px' }} aria-label="Đơn đặt trong kỳ">
                    <div className="flex items-baseline gap-2 pb-1"><h3 className="m-0 font-bold text-[16px] flex-grow">Đơn đặt trong kỳ</h3><span className="font-bold text-[16px]">{totalOrders} đơn</span></div>
                    {ORDER_STATUS_ORDER.filter((s) => s !== 'cancelled' || counts[s] > 0).map((s) => (
                      <div key={s} className="flex items-center gap-3 min-h-[40px] text-[15px]" style={{ borderTop: `1px solid ${T.line}` }}>
                        <StatusTag status={s} />
                        <span className="flex-grow" />
                        <span className="font-semibold">{counts[s]} đơn</span>
                      </div>
                    ))}
                  </section>
                )}
                {referred !== undefined && (
                  <section className="card flex flex-col gap-3" style={{ padding: '16px 18px' }} aria-label="Doanh thu qua affiliate">
                    <h3 className="m-0 font-bold text-[16px]">Doanh thu qua affiliate</h3>
                    <div className="flex flex-col gap-1.5 text-[15px]">
                      <div className="flex items-baseline gap-3"><span className="flex-grow">Có người giới thiệu · {d.stats.referredCount} đơn</span><span className="font-bold">{money(referred)}</span></div>
                      <Prog value={share} height={8} />
                    </div>
                    <div className="flex flex-col gap-1.5 text-[15px]">
                      <div className="flex items-baseline gap-3"><span className="flex-grow">Không qua affiliate</span><span className="font-bold">{money(direct)}</span></div>
                      <Prog value={d.stats.netMinor > 0 ? 100 - share : 0} height={8} />
                    </div>
                    <span className="muted text-[14px]">{d.stats.netMinor > 0 ? `${share}% số tiền đã thu trong kỳ đến từ người giới thiệu.` : 'Chưa có tiền đã thu trong kỳ này.'}</span>
                  </section>
                )}
              </div>
            </>
          );
        }}
      </QueryState>
    </>
  );
}

/** Tab Tất cả đơn hàng. Bộ lọc do trang giữ để chuyển tab qua lại không mất. */
export function OrdersTab({ choice, onChoice, filters, onFilters }: { choice: RangeChoice; onChoice: (next: RangeChoice) => void; filters: OrderFilters; onFilters: (next: OrderFilters) => void }) {
  const shell = useShell();
  const can = useCan();
  const qc = useQueryClient();
  const cid = shell.community.id;
  const canManage = can('billing.manage');
  const range = choiceRange(choice, vnDay(new Date()));
  // Ô tìm: chờ người dùng ngừng gõ một chút rồi mới gọi API.
  const [text, setText] = useState(filters.q);
  useEffect(() => {
    if (text === filters.q) return;
    const timer = setTimeout(() => onFilters({ ...filters, q: text }), 300);
    return () => clearTimeout(timer);
  }, [text, filters, onFilters]);
  const [refund, setRefund] = useState<RefundTarget | null>(null);

  const base = `/v1/communities/${cid}/orders`;
  const key = ordersQuery(range, filters);
  const list = useInfiniteQuery({
    queryKey: ['orders', cid, key],
    queryFn: ({ pageParam }) => api.get<OrdersPage>(`${base}?${ordersQuery(range, filters, { limit: PAGE_ROWS, cursor: pageParam || undefined })}`),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const first = list.data?.pages[0];
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['orders', cid] });
    void qc.invalidateQueries({ queryKey: ['revenue', cid] });
    void qc.invalidateQueries({ queryKey: ['payout-settings', cid] });
    void qc.invalidateQueries({ queryKey: payoutSetupKey(cid) });
  };
  const confirm = useMutation({ mutationFn: (orderId: string) => api.post(`${base}/${orderId}/confirm-received`, {}), onSuccess: refresh });
  const refundM = useMutation({
    mutationFn: (p: { orderId: string; reason: string }) => api.post(`/v1/orders/${p.orderId}/admin-refund`, { reason: p.reason }),
    onSuccess: () => { setRefund(null); refresh(); },
  });
  // Bản xuất theo đúng bộ lọc đang chọn và lấy đủ kết quả, không chỉ các đơn đang hiện trên màn hình.
  const exportM = useMutation({
    mutationFn: async () => {
      const all = await api.get<OrdersPage>(`${base}?${ordersQuery(range, filters, { limit: EXPORT_ROWS })}`);
      saveBlob(toCsvBlob(orderCsvRows(all.items, when)), `don-hang-${shell.community.slug}-${rangeFileSuffix(range)}.csv`);
    },
  });
  const filtered = Boolean(filters.status || filters.affiliate || filters.q.trim());

  return (
    <>
      <div className="order-filters">
        <DateRangePicker value={choice} onChange={onChoice} />
        <Select aria-label="Lọc theo trạng thái" value={filters.status} onChange={(e) => onFilters({ ...filters, status: e.target.value as OrderFilters['status'] })}>
          {ORDER_STATUS_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </Select>
        <Select aria-label="Lọc theo affiliate" value={filters.affiliate} onChange={(e) => onFilters({ ...filters, affiliate: e.target.value as OrderFilters['affiliate'] })}>
          {ORDER_AFFILIATE_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </Select>
        <Input className="order-search" type="search" left={<Search size={18} style={{ color: T.ink3 }} aria-hidden />} placeholder="Tìm người mua, sản phẩm, mã đơn" aria-label="Tìm đơn hàng" maxLength={100} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-[15px] flex-grow" role="status">
          {first ? <><strong>{first.total} đơn</strong> · tổng giá trị <strong>{money(first.totalMinor)}</strong>{filtered ? ' theo bộ lọc đang chọn' : ''}</> : <span className="muted">Đang đếm đơn…</span>}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportM.mutate()} disabled={!first || first.total === 0 || exportM.isPending}><Download size={16} />{exportM.isPending ? 'Đang xuất…' : 'Xuất CSV'}</button>
      </div>
      {exportM.isError && <div role="alert" className="text-[14px] font-semibold" style={{ color: T.accentText }}>Chưa xuất được CSV: {errorMessage(exportM.error)}</div>}
      {first && first.total > EXPORT_ROWS && <div className="muted text-[14px]">Bản xuất CSV lấy tối đa {EXPORT_ROWS} đơn mới nhất của kết quả. Thu hẹp khoảng ngày để xuất phần còn lại.</div>}
      {confirm.isError && <div role="alert" className="text-[14px] font-semibold" style={{ color: T.accentText }}>{errorMessage(confirm.error)}</div>}
      {list.isLoading && <LoadingBlock rows={4} />}
      {list.isError && <ErrorBox message={errorMessage(list.error)} onRetry={() => void list.refetch()} />}
      {first && (
          <div className="card order-list" role="list" aria-label="Đơn hàng">
            <div className="order-head" aria-hidden="true">{['Ngày đặt', 'Người mua', 'Sản phẩm', 'Số tiền', 'Người giới thiệu', 'Trạng thái', ''].map((h, i) => <span key={h || `c${i}`} className="th">{h}</span>)}</div>
            {rows.length === 0 && <div className="muted text-[15px] text-center py-10 px-4">{filtered ? 'Không có đơn nào khớp bộ lọc. Thử bỏ bớt điều kiện hoặc mở rộng khoảng ngày.' : 'Chưa có đơn nào trong khoảng ngày này.'}</div>}
            {rows.map((o) => <OrderRow key={o.orderId} order={o} canManage={canManage} confirming={confirm.isPending && confirm.variables === o.orderId} onConfirm={() => confirm.mutate(o.orderId)} onRefund={() => setRefund({ orderId: o.orderId, title: o.title, customerName: o.customer.name, amountMinor: o.amountMinor, commissionMinor: o.commissionMinor, provider: o.provider })} />)}
          </div>
      )}
      {first && rows.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <span className="muted text-[14px]">Đang hiện {rows.length} trên {first.total} đơn</span>
          {list.hasNextPage && <Button onClick={() => void list.fetchNextPage()} loading={list.isFetchingNextPage}>Xem thêm</Button>}
        </div>
      )}
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

function OrderRow({ order: o, canManage, confirming, onConfirm, onRefund }: { order: OrderItem; canManage: boolean; confirming: boolean; onConfirm: () => void; onRefund: () => void }) {
  const commission = commissionOf(o);
  // Hoa hồng chỉ phát sinh khi đơn đã trả: đơn còn chờ hoặc hết hạn thì chưa có số để hiện.
  const settled = o.status === 'paid' || o.status === 'refunded';
  return (
    <div className="order-row" role="listitem">
      <div className="oc-when"><span>{fmtDate(o.createdAt)}</span> <span className="muted">{fmtTime(o.createdAt)}</span></div>
      <div className="oc-buyer"><UserAvatar user={o.customer} size={28} className="flex-shrink-0" /><span className="font-medium">{o.customer.name}</span></div>
      <div className="oc-what"><span className="font-semibold">{o.title}</span><span className="muted">Mã {o.reference} · {orderMethod(o)}</span></div>
      <div className="oc-amount font-bold">{money(o.amountMinor)}</div>
      <div className="oc-aff">
        {o.hasAffiliate
          ? <><span><span className="oc-label">Người giới thiệu: </span>{o.affiliateName ?? 'Affiliate đã gỡ'}</span><span style={{ color: T.goldText }}>{commission.reversed ? `đã đảo hoa hồng ${money(commission.minor)}` : settled ? `hoa hồng ${money(commission.minor)}` : 'hoa hồng tính khi đơn trả xong'}</span></>
          : <span className="muted"><span className="oc-label">Người giới thiệu: </span>Không có</span>}
      </div>
      <div className="oc-status">
        <StatusTag status={o.status} />
        {o.buyerSaysPaid && o.canConfirm && <span className="oc-note" style={{ color: T.goldText }}>Người mua báo đã chuyển</span>}
      </div>
      <div className="oc-act">
        {canManage && o.canConfirm && <Button variant="primary" size="sm" loading={confirming} onClick={onConfirm} aria-label={`Đã nhận tiền đơn ${o.reference}`}>Đã nhận tiền</Button>}
        {canManage && o.status === 'paid' && <button type="button" className="btn btn-ghost btn-sm" onClick={onRefund} aria-label={`Hoàn tiền đơn ${o.reference}`}>Hoàn tiền</button>}
      </div>
    </div>
  );
}
