// Hệ thống · Thanh toán và đối soát (saPaymentsMain): cổng thanh toán + 3 thẻ số liệu; bảng đối soát chuyển khoản; tab giao dịch.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Chip, StatCard, T, money } from '@hoiminh/ui';
import { useState } from 'react';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { PaymentsTable, ProviderRow, ReconRow, type Payment, type Provider, type ReconItem } from './AdminPaymentsParts';

interface Recon { items: ReconItem[]; counts: Record<string, number>; pendingPayouts: { count: number; amountMinor: number }; holdingMinor: number }
type Tab = 'gateways' | 'transactions';
type ReconFilter = 'unmatched' | 'matched';

export default function Page() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('gateways');
  const [rf, setRf] = useState<ReconFilter>('unmatched');
  const providers = useQuery({ queryKey: ['admin', 'providers'], queryFn: () => api.get<Provider[]>('/v1/admin/providers') });
  const recon = useQuery({ queryKey: ['admin', 'reconciliation', rf], queryFn: () => api.get<Recon>(`/v1/admin/reconciliation?status=${rf}`), refetchInterval: 60_000 });
  const payments = useQuery({ queryKey: ['admin', 'payments'], queryFn: () => api.get<Payment[]>('/v1/admin/payments'), enabled: tab === 'transactions' });
  const counts = recon.data?.counts ?? {};
  const matched = counts.matched ?? 0;
  const unmatched = Object.entries(counts).filter(([k]) => k !== 'matched').reduce((a, [, v]) => a + v, 0);
  const dup = counts.duplicate ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="serif m-0 text-[28px] font-extrabold">Thanh toán</h1>
        <div className="flex gap-2 md:ml-3"><Chip on={tab === 'gateways'} onClick={() => setTab('gateways')}>Cổng và đối soát</Chip><Chip on={tab === 'transactions'} onClick={() => setTab('transactions')}>Giao dịch</Chip></div>
      </div>
      {tab === 'transactions' ? (
        <QueryState q={payments} rows={5}>{(rows) => <PaymentsTable rows={rows} />}</QueryState>
      ) : (
        <>
          <div className="flex gap-4 flex-col md:flex-row">
            <div className="card flex-[1.2_1_0] flex flex-col" style={{ padding: '18px 20px' }}>
              <div className="pb-1.5"><span className="font-semibold">Cổng thanh toán</span><div className="muted text-[13px]">Bật tắt toàn hệ thống, cấu hình khóa và webhook. Bí mật không hiện lại sau khi lưu.</div></div>
              <QueryState q={providers} rows={4}>{(list) => <>{list.map((p) => <ProviderRow key={p.provider} p={p} />)}</>}</QueryState>
            </div>
            <div className="flex-1 flex flex-col gap-3">
              <StatCard label="Đối soát" value={`${matched} / ${matched + unmatched}`} sub={unmatched ? `${unmatched} giao dịch chưa khớp` : 'tất cả đã khớp'} subColor={unmatched ? T.accentText : T.teal} />
              <StatCard label="Hoa hồng đang giữ" value={money(recon.data?.holdingMinor ?? 0)} sub="giải phóng theo hold 14/30 ngày" />
              <StatCard label="Yêu cầu rút tiền chờ duyệt" value={recon.data?.pendingPayouts.count ?? 0} sub={`tổng ${money(recon.data?.pendingPayouts.amountMinor ?? 0)} · chủ hội và nền tảng tự chuyển`} subColor={T.goldText} />
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="flex items-center px-5 py-3.5 gap-3 flex-wrap"><span className="font-semibold">Đối soát chuyển khoản</span><div className="flex gap-1.5"><Chip on={rf === 'matched'} onClick={() => setRf('matched')} style={{ height: 26, fontSize: 12 }}>Khớp · {matched}</Chip><Chip on={rf === 'unmatched'} onClick={() => setRf('unmatched')} style={{ height: 26, fontSize: 12 }}>Chưa khớp · {unmatched}</Chip><span className="chip" style={{ height: 26, fontSize: 12 }}>Trùng · {dup}</span></div><span className="flex-grow" /><span className="muted text-[12px]">Nguồn: webhook SePay, tự làm mới mỗi phút</span></div>
            <div className="table-scroll">
              <div className="grid gap-3 px-5 pb-2" style={{ gridTemplateColumns: '90px 1.1fr 1.6fr 1fr 1fr 1.2fr 1.4fr', minWidth: 900 }}>{['Giờ', 'Mã tham chiếu', 'Nội dung ngân hàng', 'Nhận được', 'Kỳ vọng', 'Trạng thái', ''].map((h, i) => <span key={i} className="th">{h}</span>)}</div>
              <QueryState q={recon} rows={3} isEmpty={(d) => d.items.length === 0} empty={{ title: rf === 'unmatched' ? 'Không có giao dịch chưa khớp' : 'Chưa có giao dịch đã khớp' }}>
                {(d) => <>{d.items.map((it) => <ReconRow key={it.id} it={it} onMatched={() => { void qc.invalidateQueries({ queryKey: ['admin'] }); }} />)}</>}
              </QueryState>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
