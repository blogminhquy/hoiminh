// Doanh thu (revenueMain): chip kỳ, 4 thẻ số liệu, bảng giao dịch (ngày, thành viên, sản phẩm, phương thức, số tiền, nợ cộng sự, trạng thái), xuất CSV.
import { useQuery } from '@tanstack/react-query';
import { Chip, StatCard, StatusTag, T, money } from '@hoiminh/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { UserAvatar, type UserLite } from '@/components/UserLink';
import { api } from '@/lib/api';
import { useCan, useShell } from '@/lib/community';
import { fmtDate } from '@/lib/format';

interface Tx { orderId: string; at: string; customer: UserLite; title: string; method: string; provider: string; amountMinor: number; commissionMinor: number; reversedCommissionMinor: number; status: string }
interface Revenue { stats: { grossMinor: number; txCount: number; netMinor: number; refundedMinor: number; refundCount: number; owedToAffiliatesMinor: number; referredCount: number }; items: Tx[] }
const RANGES: Array<[number, string]> = [[1, 'Hôm nay'], [30, '30 ngày'], [90, 'Quý'], [365, 'Năm']];
const PROVIDER: Record<string, string> = { sepay: 'Chuyển khoản', momo: 'MoMo', vnpay: 'VNPAY', paypal: 'PayPal' };

function toCsv(items: Tx[]): string {
  const rows = [['Ngày', 'Thành viên', 'Sản phẩm', 'Phương thức', 'Số tiền', 'Nợ cộng sự', 'Trạng thái'], ...items.map((t) => [fmtDate(t.at), t.customer.name, t.title, PROVIDER[t.provider] ?? t.method, String(t.amountMinor), String(t.commissionMinor), t.status])];
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
}

export default function Page() {
  const shell = useShell();
  const can = useCan();
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ['revenue', shell.community.id, days], queryFn: () => api.get<Revenue>(`/v1/communities/${shell.community.id}/revenue?days=${days}`), enabled: can('revenue.read') });
  if (!can('revenue.read')) return <Navigate to={`/${shell.community.slug}/bang-tin`} replace />;
  const exportCsv = () => {
    if (!q.data) return;
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(q.data.items)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `doanh-thu-${shell.community.slug}-${days}d.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const cols = '90px 1.6fr 1.6fr 1.1fr 1.1fr 1.1fr 1fr';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="serif m-0 text-[28px] font-extrabold">Doanh thu</h1>
        <div className="flex gap-2 md:ml-3">{RANGES.map(([d, l]) => <Chip key={d} on={days === d} onClick={() => setDays(d)}>{l}</Chip>)}</div>
        <span className="flex-grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!q.data}><Download size={14} />Xuất CSV</button>
      </div>
      <QueryState q={q} rows={4}>
        {(d) => (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Tổng thu" value={money(d.stats.grossMinor)} sub={`${d.stats.txCount} giao dịch · không phí giao dịch`} />
              <StatCard label="Đã vào số dư" value={money(d.stats.netMinor)} sub={d.stats.refundCount ? `sau ${d.stats.refundCount} hoàn tiền` : 'chưa có hoàn tiền'} subColor={T.teal} />
              <StatCard label="Nợ cộng sự" value={money(d.stats.owedToAffiliatesMinor)} sub={`bạn tự chuyển khoản · ${d.stats.referredCount} giao dịch có giới thiệu`} subColor={T.goldText} />
              <StatCard label="Hoàn tiền" value={money(d.stats.refundedMinor)} sub={`${d.stats.refundCount} giao dịch`} subColor={T.ink3} />
            </div>
            <div className="card overflow-hidden table-scroll">
              <div className="grid gap-3 px-5 py-3" style={{ gridTemplateColumns: cols, minWidth: 860 }}>{['Ngày', 'Thành viên', 'Sản phẩm', 'Phương thức', 'Số tiền', 'Nợ cộng sự', 'Trạng thái'].map((h) => <span key={h} className="th">{h}</span>)}</div>
              {d.items.length === 0 && <div className="muted text-[13px] text-center py-8">Chưa có giao dịch trong kỳ này</div>}
              {d.items.map((t) => (
                <div key={t.orderId} className="grid gap-3 items-center px-5 py-3 text-[13px]" style={{ gridTemplateColumns: cols, minWidth: 860, borderTop: `1px solid ${T.line}` }}>
                  <span className="muted">{fmtDate(t.at).slice(0, 5)}</span>
                  <div className="flex items-center gap-2 min-w-0"><UserAvatar user={t.customer} size={26} /><span className="font-medium truncate">{t.customer.name}</span></div>
                  <span className="truncate">{t.title}</span>
                  <span className="muted">{PROVIDER[t.provider] ?? t.method ?? '—'}</span>
                  <span className="font-semibold">{money(t.amountMinor)}</span>
                  <span className="font-semibold" style={{ color: T.goldText }}>{t.status === 'refunded' && t.reversedCommissionMinor ? `đảo ${money(t.reversedCommissionMinor)}` : money(t.commissionMinor)}</span>
                  <StatusTag status={t.status === 'paid' ? 'succeeded' : t.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
