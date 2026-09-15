// Cài đặt · Cộng sự · Yêu cầu rút (affiliatePayoutsMain): 4 ô ví, hàng đợi xem xét (PayoutQueue), lịch sử, xuất đối soát.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WalletBox, money } from '@hoiminh/ui';
import { LedgerNotice, PayoutQueue, type PayoutRequest } from '@/components/PayoutQueue';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useShell } from '@/lib/community';
import { downloadFromApi } from '@/lib/download';
import { AffiliateTabs } from './AffiliateTabs';

interface Payouts { program: { id: string; holdDays: number }; stats: { activeAffiliates: number; paidThisMonthMinor: number; paidCountThisMonth: number; awaitingTransferMinor: number; awaitingCount: number; holdingMinor: number; owedMinor: number }; queue: PayoutRequest[]; history: PayoutRequest[] }

export default function Page() {
  const shell = useShell();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['payouts', shell.community.id], queryFn: () => api.get<Payouts>(`/v1/communities/${shell.community.id}/affiliate/payouts`) });
  return (
    <>
      <div className="flex items-center gap-4 flex-wrap">
        <div><h1 className="serif m-0 text-[28px] font-extrabold">Yêu cầu rút của cộng sự</h1><div className="muted text-[13px]">Bạn chuyển khoản, hệ thống ghi sổ</div></div>
        <span className="flex-grow" />
        <AffiliateTabs slug={shell.community.slug} active="payouts" awaiting={q.data?.stats.awaitingCount} affiliates={q.data?.stats.activeAffiliates} />
      </div>
      <LedgerNotice who="Bạn" />
      <QueryState q={q} rows={4}>
        {(d) => (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <WalletBox label="Chờ bạn chuyển" value={money(d.stats.awaitingTransferMinor)} hint={`${d.stats.awaitingCount} yêu cầu · xử lý trong 3 ngày làm việc`} strong />
              <WalletBox label="Đã trả tháng này" value={money(d.stats.paidThisMonthMinor)} hint={`${d.stats.paidCountThisMonth} lần chuyển khoản`} />
              <WalletBox label={`Đang giữ ${d.program.holdDays} ngày`} value={money(d.stats.holdingMinor)} hint="chưa được rút, chờ hết hạn hoàn tiền" />
              <WalletBox label="Tổng nợ cộng sự" value={money(d.stats.owedMinor)} hint="chờ chuyển + có thể rút chưa yêu cầu" />
            </div>
            <PayoutQueue queue={d.queue} history={d.history} onChanged={() => { void qc.invalidateQueries({ queryKey: ['payouts'] }); void qc.invalidateQueries({ queryKey: ['affiliate-settings'] }); }} />
            <button type="button" className="muted text-[12px] text-left" onClick={() => void downloadFromApi(`/v1/communities/${shell.community.id}/affiliate/payouts/export.csv`, `doi-soat-cong-su-${shell.community.slug}.csv`)}>Xuất đối soát CSV</button>
          </>
        )}
      </QueryState>
    </>
  );
}
