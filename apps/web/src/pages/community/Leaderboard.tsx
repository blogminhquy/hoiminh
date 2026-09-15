// Xếp hạng cộng sự (affiliateMain): chip kỳ, bục top 3, bảng hạng; rail link của bạn + số liệu, cách tính, tổng cộng sự kỳ này.
import { useQuery } from '@tanstack/react-query';
import { Avatar, Chip, Prog, T, money } from '@hoiminh/ui';
import { Check, Clock, Copy, Link as LinkIcon, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { ApiError, api } from '@/lib/api';
import { useShell } from '@/lib/community';
import { timeAgo } from '@/lib/format';

interface Row { rank: number; user: { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null }; referrals: number; paid: number; revenueMinor: number | null; commissionMinor: number | null; rankDelta: number; isMe: boolean }
interface Board { items: Row[]; computedAt: string | null; period: string; program: { commissionRateBps: number; holdDays: number; minWithdrawalMinor: number; showMoney: boolean; enabled: boolean }; me: { affiliateCode: string; link: string; clicks: number; signups: number; paid: number; rank: number | null } | null; stats: { activeAffiliates: number; referredRevenueShare: number } }
type Period = 'month' | 'quarter' | 'all';

const now = new Date();
const PERIODS: Array<[Period, string]> = [['month', `Tháng ${now.getMonth() + 1}`], ['quarter', `Quý ${Math.floor(now.getMonth() / 3) + 1}`], ['all', 'Từ đầu']];

function Podium({ r, first, showMoney }: { r: Row; first?: boolean; showMoney: boolean }) {
  return (
    <div className="card flex-1 p-5 flex flex-col items-center gap-2 text-center" style={first ? { background: T.ink, color: T.surface, borderColor: T.ink } : undefined}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-extrabold serif" style={{ background: first ? T.gold : T.bg, color: first ? T.ink : T.ink2 }}>{r.rank}</div>
      <Avatar name={r.user.name} src={r.user.avatarUrl} color={r.user.coverColor ?? T.ink} size={56} />
      <div className="font-bold text-[16px]">{r.user.name}</div>
      <div className="text-[13px]" style={{ color: first ? T.sideText : T.ink2 }}>{r.referrals} người giới thiệu · {r.paid} trả phí</div>
      {showMoney && r.commissionMinor !== null && <><div className="serif text-[22px] font-extrabold pt-1">{money(r.commissionMinor)}</div><div className="text-[12px]" style={{ color: first ? T.sideText : T.ink3 }}>hoa hồng kỳ này</div></>}
    </div>
  );
}

function Trend({ d }: { d: number }) {
  const label = d === 0 ? '—' : d > 0 ? `+${d}` : String(d);
  return <span className="text-[12px] font-semibold" style={{ color: d > 0 ? T.teal : d === 0 ? T.ink3 : T.accentText }}>{label}</span>;
}

export default function Page() {
  const shell = useShell();

  const [period, setPeriod] = useState<Period>('month');
  const [copied, setCopied] = useState(false);
  const q = useQuery({ queryKey: ['leaderboard', shell.community.id, period], queryFn: () => api.get<Board>(`/v1/communities/${shell.community.id}/leaderboard?period=${period}`), retry: false });
  const denied = q.isError && q.error instanceof ApiError && q.error.status === 403;
  const copy = (link: string) => { void navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  const cols = '56px 2fr 1fr 1fr 1.2fr 1.2fr 80px';
  return (
    <div className="two-col">
      <div className="main flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="serif m-0 text-[28px] font-extrabold">Xếp hạng cộng sự</h1>
          <div className="flex gap-2 md:ml-3">{PERIODS.map(([k, l]) => <Chip key={k} on={period === k} onClick={() => setPeriod(k)}>{l}</Chip>)}</div>
          <span className="flex-grow" />
          {q.data?.computedAt && <span className="muted text-[13px]">Cập nhật {timeAgo(q.data.computedAt)}</span>}
        </div>
        {denied ? (
          <div className="card p-8 text-center flex flex-col items-center gap-2"><div className="font-semibold">{q.error instanceof ApiError ? q.error.message : 'Bảng xếp hạng chưa mở'}</div><div className="muted text-[13px]">Vào Tài khoản · Cộng sự để lấy link giới thiệu của bạn.</div><Link to="/tai-khoan/cong-su" className="btn btn-dark btn-sm mt-1">Ví cộng sự</Link></div>
        ) : (
          <QueryState q={q} rows={4} isEmpty={(d) => d.items.length === 0} empty={{ title: 'Chưa có xếp hạng kỳ này', hint: 'Bảng cập nhật 10 phút một lần khi có hoa hồng phát sinh' }}>
            {(d) => {
              const [a, b, c] = d.items;
              const rest = d.items.slice(3);
              return (
                <>
                  <div className="flex gap-4 flex-col sm:flex-row sm:items-end">
                    {b && <Podium r={b} showMoney={d.program.showMoney} />}
                    {a && <Podium r={a} first showMoney={d.program.showMoney} />}
                    {c && <Podium r={c} showMoney={d.program.showMoney} />}
                  </div>
                  {rest.length > 0 && (
                    <div className="card overflow-hidden table-scroll">
                      <div className="grid gap-3 px-5 py-3" style={{ gridTemplateColumns: cols, minWidth: 640 }}><span className="th">Hạng</span><span className="th">Cộng sự</span><span className="th">Giới thiệu</span><span className="th">Trả phí</span><span className="th">Doanh thu</span><span className="th">Hoa hồng</span><span className="th">So kỳ trước</span></div>
                      {rest.map((r) => (
                        <div key={r.user.id} className="grid gap-3 items-center px-5 py-3" style={{ gridTemplateColumns: cols, minWidth: 640, borderTop: `1px solid ${T.line}`, background: r.isMe ? T.goldSoft : undefined }}>
                          <span className="font-bold" style={{ color: T.ink2 }}>{r.rank}</span>
                          <div className="flex items-center gap-2.5 min-w-0"><Avatar name={r.user.name} src={r.user.avatarUrl} color={r.user.coverColor ?? T.ink} size={32} /><div className="min-w-0"><div className="font-semibold truncate">{r.user.name}{r.isMe && <span className="muted font-medium"> (bạn)</span>}</div><div className="muted text-[12px]">@{r.user.handle}</div></div></div>
                          <span>{r.referrals}</span><span>{r.paid}</span>
                          <span>{r.revenueMinor === null ? '—' : money(r.revenueMinor)}</span>
                          <span className="font-semibold">{r.commissionMinor === null ? '—' : money(r.commissionMinor)}</span>
                          <Trend d={r.rankDelta} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            }}
          </QueryState>
        )}
      </div>
      <aside className="rail flex flex-col gap-4">
        <div className="card p-[18px] flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.accent }}><LinkIcon size={16} />Link của bạn</div>
          {q.data?.me ? (
            <>
              <div className="input text-[13px]" style={{ height: 40, color: T.ink }}><span className="flex-grow truncate">{q.data.me.link.replace(/^https?:\/\//, '')}</span><button type="button" aria-label="Sao chép" onClick={() => copy(q.data?.me?.link ?? '')} style={{ color: copied ? T.teal : T.ink3 }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div>
              <div className="flex gap-2"><button type="button" className="btn btn-dark flex-1" onClick={() => copy(q.data?.me?.link ?? '')}>{copied ? 'Đã sao chép' : 'Sao chép link'}</button><Link to="/tai-khoan/cong-su" className="btn btn-ghost">Ví và rút tiền</Link></div>
              <div className="grid grid-cols-3 gap-2 pt-2.5" style={{ borderTop: `1px solid ${T.line}` }}>{[[q.data.me.clicks, 'Lượt bấm'], [q.data.me.signups, 'Đăng ký'], [q.data.me.paid, 'Trả phí']].map(([v, l]) => <div key={String(l)} className="text-center"><div className="font-bold text-[18px]">{v}</div><div className="muted text-[12px]">{l}</div></div>)}</div>
            </>
          ) : (
            <><div className="muted text-[13px]">Bạn chưa là cộng sự của hội này.</div><Link to="/tai-khoan/cong-su" className="btn btn-dark btn-sm self-start">Lấy link cộng sự</Link></>
          )}
        </div>
        {q.data && (
          <div className="card p-4 flex flex-col gap-2.5">
            <div className="font-semibold">Cách tính</div>
            {[[<Wallet size={16} key="w" />, `Hoa hồng ${q.data.program.commissionRateBps / 100}% mỗi kỳ thanh toán`], [<Clock size={16} key="c" />, `Giữ ${q.data.program.holdDays} ngày, rồi gửi yêu cầu rút từ ${money(q.data.program.minWithdrawalMinor)}`], [<Wallet size={16} key="w2" />, 'Chủ hội chuyển khoản trong 3 ngày làm việc'], [<ShieldCheck size={16} key="s" />, 'Không tính tự giới thiệu và hoàn tiền'], [<Users size={16} key="u" />, 'Xếp hạng theo hoa hồng đã duyệt trong kỳ']].map(([ic, t], i) => <div key={i} className="flex items-center gap-2.5 text-[13px]" style={{ color: T.ink2 }}>{ic}{t}</div>)}
          </div>
        )}
        {q.data && (
          <div className="card p-4 flex flex-col gap-2">
            <div className="font-semibold">Tổng cộng sự kỳ này</div>
            <div className="flex items-baseline gap-2"><span className="serif text-[26px] font-extrabold">{q.data.stats.activeAffiliates}</span><span className="muted text-[13px]">cộng sự có phát sinh</span></div>
            <Prog value={Math.round(q.data.stats.referredRevenueShare * 100)} />
            <div className="muted text-[12px]">{Math.round(q.data.stats.referredRevenueShare * 100)}% doanh thu kỳ này đến từ giới thiệu</div>
          </div>
        )}
      </aside>
    </div>
  );
}
