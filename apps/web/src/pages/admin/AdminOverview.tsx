// Hệ thống · Tổng quan (saOverviewMain): chip kỳ, 5 thẻ số liệu, GMV theo ngày + tỷ trọng cổng, khối Cần xử lý, hội mới.
import { useQuery } from '@tanstack/react-query';
import { Bars, Chip, CommunityMark, StatCard, T, money } from '@hoiminh/ui';
import { BadgeCheck, ExternalLink, Users, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { fmtCount, fmtDate, fmtShortMoney } from '@/lib/format';

interface Overview {
  totals: { users: number; usersNew: number; communities: number; communitiesNew: number; gmvMinor: number; platformRevenueMinor: number; failedPayments: number; totalPayments: number };
  todo: { unmatched: number; webhookFailures: number; reported: number; trialsEnding: number };
  daily: Array<{ date: string; amountMinor: number }>; byProvider: Array<{ provider: string; amountMinor: number }>;
  recentCommunities: Array<{ id: string; name: string; slug: string; logoMark: string; logoColor: string; logoUrl: string | null; pricingMode: string; memberCount: number; ownerName: string; workspaceStatus: string }>;
}
const RANGES: Array<[number, string]> = [[1, 'Hôm nay'], [30, '30 ngày'], [90, 'Quý']];
const PROVIDER: Record<string, string> = { sepay: 'Chuyển khoản QR', momo: 'MoMo', vnpay: 'VNPAY', paypal: 'PayPal' };
const MODE: Record<string, string> = { free: 'Miễn phí', freemium: 'Freemium', subscription: 'Thu phí', one_time: 'Trọn đời' };

function Todo({ icon, bg, fg, text, action, to }: { icon: ReactNode; bg: string; fg: string; text: string; action: string; to: string }) {
  return <div className="flex items-center gap-2.5 text-[13px]"><span className="w-7 h-7 rounded-lg inline-flex items-center justify-center flex-shrink-0" style={{ background: bg, color: fg }}>{icon}</span><span className="flex-grow">{text}</span><Link to={to} className="text-[12px] font-semibold whitespace-nowrap" style={{ color: T.teal }}>{action}</Link></div>;
}

export default function Page() {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ['admin', 'overview', days], queryFn: () => api.get<Overview>(`/v1/admin/overview?days=${days}`) });
  const from = new Date(Date.now() - days * 86_400_000);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap"><h1 className="serif m-0 text-[28px] font-extrabold">Tổng quan hệ thống</h1><span className="flex-grow" /><div className="flex gap-2">{RANGES.map(([d, l]) => <Chip key={d} on={days === d} onClick={() => setDays(d)}>{l}</Chip>)}</div></div>
      <QueryState q={q} rows={5}>
        {(d) => {
          const byDay = new Map(d.daily.map((x) => [x.date, x.amountMinor]));
          const series = Array.from({ length: days }, (_, i) => { const dt = new Date(from.getTime() + (i + 1) * 86_400_000); return byDay.get(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`) ?? 0; });
          const totalProv = d.byProvider.reduce((a, b) => a + b.amountMinor, 0) || 1;
          const failPct = d.totals.totalPayments ? Math.round((d.totals.failedPayments / d.totals.totalPayments) * 1000) / 10 : 0;
          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label="Người dùng" value={fmtCount(d.totals.users)} sub={`+${fmtCount(d.totals.usersNew)} trong kỳ`} subColor={T.teal} />
                <StatCard label="Hội đang hoạt động" value={fmtCount(d.totals.communities)} sub={`+${d.totals.communitiesNew} hội mới`} subColor={T.teal} />
                <StatCard label="GMV qua nền tảng" value={fmtShortMoney(d.totals.gmvMinor)} sub="tổng tiền thành viên đã trả" />
                <StatCard label="Doanh thu Hội Mình" value={fmtShortMoney(d.totals.platformRevenueMinor)} sub="từ gói tháng và năm · không phí giao dịch" subColor={T.teal} />
                <StatCard label="Thanh toán lỗi" value={d.totals.failedPayments} sub={`${failPct}% giao dịch · cần xem ${d.todo.unmatched}`} subColor={T.accentText} />
              </div>
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="card flex-[1.6_1_0] flex flex-col gap-3" style={{ padding: '18px 20px' }}>
                  <div className="flex items-center"><span className="font-semibold">GMV theo ngày</span><span className="flex-grow" /><span className="muted text-[12px]">{fmtDate(from).slice(0, 5)} – {fmtDate(new Date()).slice(0, 5)}</span></div>
                  <Bars values={series} height={150} />
                  <div className="flex gap-4 text-[12px] muted flex-wrap">{d.byProvider.length ? d.byProvider.map((p) => <span key={p.provider}>{PROVIDER[p.provider] ?? p.provider} {Math.round((p.amountMinor / totalProv) * 100)}%</span>) : <span>Chưa có thanh toán trong kỳ</span>}</div>
                </div>
                <div className="card flex-1 flex flex-col gap-2.5" style={{ padding: '18px 20px' }}>
                  <span className="font-semibold">Cần xử lý</span>
                  <Todo icon={<Wallet size={14} />} bg={T.accentSoft} fg={T.accentText} text={`${d.todo.unmatched} giao dịch chuyển khoản chưa khớp nội dung`} action="Đối soát" to="/he-thong/thanh-toan" />
                  <Todo icon={<ExternalLink size={14} />} bg={T.accentSoft} fg={T.accentText} text={`Webhook thất bại ${d.todo.webhookFailures} lần trong 24 giờ`} action="Xem log" to="/he-thong/nhat-ky" />
                  <Todo icon={<Users size={14} />} bg={T.goldSoft} fg={T.goldText} text={`${d.todo.reported} hội bị báo cáo nội dung`} action="Xem" to="/he-thong/ho-tro" />
                  <Todo icon={<BadgeCheck size={14} />} bg={T.tealSoft} fg={T.tealText} text={`${d.todo.trialsEnding} hội sắp hết 14 ngày dùng thử`} action="Nhắc thanh toán" to="/he-thong/hoi" />
                </div>
              </div>
              <div className="card overflow-hidden table-scroll">
                <div className="flex items-center px-5 py-3.5"><span className="font-semibold">Hội mới nhất</span><span className="flex-grow" /><Link to="/he-thong/hoi" className="text-[13px] font-semibold" style={{ color: T.teal }}>Tất cả hội</Link></div>
                {d.recentCommunities.map((c) => (
                  <div key={c.id} className="grid gap-3 items-center px-5 py-2.5 text-[13px]" style={{ gridTemplateColumns: '2fr 1.4fr 0.8fr 0.8fr 1fr', minWidth: 640, borderTop: `1px solid ${T.line}` }}>
                    <div className="flex items-center gap-2.5 min-w-0"><CommunityMark mark={c.logoMark} color={c.logoColor} url={c.logoUrl} size={32} radius={9} /><Link to={`/${c.slug}`} className="font-semibold truncate" style={{ color: T.ink }}>{c.name}</Link></div>
                    <span className="truncate">{c.ownerName}</span>
                    <span className="tag" style={{ background: c.workspaceStatus === 'active' ? T.goldSoft : T.bg, color: c.workspaceStatus === 'active' ? T.goldText : T.ink2, width: 'fit-content' }}>{c.workspaceStatus === 'active' ? 'Trả phí' : 'Dùng thử'}</span>
                    <span>{c.memberCount}</span>
                    <span className="muted">{MODE[c.pricingMode] ?? c.pricingMode}</span>
                  </div>
                ))}
              </div>
              <div className="muted text-[12px]">GMV kỳ này {money(d.totals.gmvMinor)} · doanh thu nền tảng {money(d.totals.platformRevenueMinor)}</div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
