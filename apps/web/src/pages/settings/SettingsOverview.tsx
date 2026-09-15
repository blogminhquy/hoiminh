// Cài đặt · Tổng quan (overviewMain): chip kỳ, 4 thẻ số liệu, cột doanh thu theo ngày, checklist hoàn thiện, hoạt động gần đây.
import { useQuery } from '@tanstack/react-query';
import { Avatar, Bars, Chip, Prog, StatCard, T, money } from '@hoiminh/ui';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useShell } from '@/lib/community';
import { fmtDate, timeAgo } from '@/lib/format';

interface Overview {
  stats: { newMembers: number; newMembersDeltaPct: number | null; revenueMinor: number; revenueDeltaPct: number | null; paying: number; premium: number; vip: number; churned: number; churnRatePct: number; posts: number };
  daily: Array<{ date: string; amountMinor: number }>; checklist: Array<{ key: string; label: string; done: boolean }>;
  activity: Array<{ kind: 'payment' | 'post' | 'join'; actor: string; actor_id: string; what: string | null; at: string }>;
}
const RANGES: Array<[number, string]> = [[7, '7 ngày'], [30, '30 ngày'], [90, 'Quý']];
const delta = (p: number | null) => (p === null ? 'kỳ trước chưa có dữ liệu' : `${p >= 0 ? '+' : ''}${p}% so với kỳ trước`);
const describe = (a: Overview['activity'][number]) => (a.kind === 'payment' ? <><strong>{a.actor}</strong> thanh toán {a.what ?? ''}</> : a.kind === 'post' ? <><strong>{a.actor}</strong> đăng bài {a.what ? `“${a.what}”` : ''}</> : <><strong>{a.actor}</strong> tham gia hội</>);

export default function Page() {
  const shell = useShell();
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ['overview', shell.community.id, days], queryFn: () => api.get<Overview>(`/v1/communities/${shell.community.id}/overview?days=${days}`) });
  const from = new Date(Date.now() - days * 86_400_000);
  return (
    <>
      <div className="flex items-center gap-3 flex-wrap"><h1 className="serif m-0 text-[28px] font-extrabold">Tổng quan</h1><span className="flex-grow" /><div className="flex gap-2">{RANGES.map(([d, l]) => <Chip key={d} on={days === d} onClick={() => setDays(d)}>{l}</Chip>)}</div></div>
      <QueryState q={q} rows={4}>
        {(d) => {
          const doneCount = d.checklist.filter((c) => c.done).length;
          const byDay = new Map(d.daily.map((x) => [x.date, x.amountMinor]));
          const series = Array.from({ length: days }, (_, i) => { const dt = new Date(from.getTime() + (i + 1) * 86_400_000); const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; return byDay.get(key) ?? 0; });
          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Thành viên mới" value={d.stats.newMembers} sub={delta(d.stats.newMembersDeltaPct)} subColor={(d.stats.newMembersDeltaPct ?? 0) >= 0 ? T.teal : T.accentText} />
                <StatCard label="Doanh thu" value={money(d.stats.revenueMinor)} sub={delta(d.stats.revenueDeltaPct)} subColor={(d.stats.revenueDeltaPct ?? 0) >= 0 ? T.teal : T.accentText} />
                <StatCard label="Đang trả phí" value={d.stats.paying} sub={`Premium ${d.stats.premium} · VIP ${d.stats.vip}`} />
                <StatCard label="Tỷ lệ hủy" value={`${d.stats.churnRatePct}%`} sub={`${d.stats.churned} người hủy trong kỳ`} subColor={T.accentText} />
              </div>
              <div className="card flex flex-col gap-3" style={{ padding: '18px 20px' }}>
                <div className="flex items-center"><span className="font-semibold">Doanh thu theo ngày</span><span className="flex-grow" /><span className="muted text-[12px]">{fmtDate(from).slice(0, 5)} – {fmtDate(new Date()).slice(0, 5)}</span></div>
                <Bars values={series} height={120} />
                <div className="flex justify-between muted text-[11px]"><span>{fmtDate(from).slice(0, 5)}</span><span>{fmtDate(new Date(from.getTime() + (days / 2) * 86_400_000)).slice(0, 5)}</span><span>{fmtDate(new Date()).slice(0, 5)}</span></div>
              </div>
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="card flex-1 flex flex-col gap-2.5" style={{ padding: '18px 20px' }}>
                  <div className="flex items-center"><span className="font-semibold">Hoàn thiện cộng đồng</span><span className="flex-grow" /><span className="muted text-[12px]">{doneCount}/{d.checklist.length}</span></div>
                  <Prog value={(doneCount / Math.max(1, d.checklist.length)) * 100} />
                  {d.checklist.map((c) => <div key={c.key} className="flex items-center gap-2.5 text-[13px]" style={{ color: c.done ? T.ink3 : T.ink }}><span className="w-5 h-5 rounded-full inline-flex items-center justify-center" style={c.done ? { background: T.teal, color: '#fff' } : { border: `1.5px solid ${T.line2}` }}>{c.done && <Check size={12} />}</span><span style={{ textDecoration: c.done ? 'line-through' : undefined }}>{c.label}</span></div>)}
                </div>
                <div className="card flex-1 flex flex-col gap-2.5" style={{ padding: '18px 20px' }}>
                  <span className="font-semibold">Hoạt động gần đây</span>
                  {d.activity.length === 0 && <span className="muted text-[13px]">Chưa có hoạt động.</span>}
                  {d.activity.map((a, i) => <div key={`${a.kind}-${i}`} className="flex items-center gap-2.5 text-[13px]"><Avatar name={a.actor} size={28} /><span className="flex-grow min-w-0 truncate">{describe(a)}</span><span className="muted text-[12px] flex-shrink-0">{timeAgo(a.at, true)}</span></div>)}
                </div>
              </div>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
