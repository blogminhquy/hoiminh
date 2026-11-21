// Tab "Xếp hạng" của trang Affiliate trong hội: chip kỳ, bục top 3, bảng hạng. Dữ liệu do trang cha tải
// (GET /v1/communities/:id/leaderboard) vì cột phải của trang cũng dùng chung.
import type { UseQueryResult } from '@tanstack/react-query';
import { Avatar, Chip, T, money } from '@hoiminh/ui';
import type { ReactNode } from 'react';
import { QueryState } from '@/components/QueryState';
import { ApiError } from '@/lib/api';
import { timeAgo } from '@/lib/format';

interface Row { rank: number; user: { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null }; referrals: number; paid: number; revenueMinor: number | null; commissionMinor: number | null; rankDelta: number; isMe: boolean }
export interface Board { items: Row[]; computedAt: string | null; period: string; program: { id: string; commissionRateBps: number; holdDays: number; minWithdrawalMinor: number; showMoney: boolean; enabled: boolean }; me: { affiliateCode: string; link: string; clicks: number; signups: number; paid: number; rank: number | null } | null; stats: { activeAffiliates: number; referredRevenueShare: number } }
export type Period = 'month' | 'quarter' | 'all';

const now = new Date();
const PERIODS: Array<[Period, string]> = [['month', `Tháng ${now.getMonth() + 1}`], ['quarter', `Quý ${Math.floor(now.getMonth() / 3) + 1}`], ['all', 'Từ đầu']];
const COLS = '56px 2fr 1fr 1fr 1.2fr 1.2fr 80px';

function Podium({ r, first, showMoney, order = '' }: { r: Row; first?: boolean; showMoney: boolean; order?: string }) {
  return (
    <div className={`card flex-1 p-5 flex flex-col items-center gap-2 text-center${first ? ' card-invert' : ''} ${order}`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-extrabold serif" style={{ background: first ? T.gold : T.bg, color: first ? T.ink : T.ink2 }}>{r.rank}</div>
      <Avatar name={r.user.name} src={r.user.avatarUrl} color={r.user.coverColor ?? T.ink} size={56} />
      <div className="font-bold text-[16px]">{r.user.name}{r.isMe && <span className="font-medium" style={{ color: first ? T.sideText : T.ink3 }}> (bạn)</span>}</div>
      <div className="text-[13px]" style={{ color: first ? T.sideText : T.ink2 }}>{r.referrals} người giới thiệu · {r.paid} trả phí</div>
      {showMoney && r.commissionMinor !== null && <><div className="serif text-[22px] font-extrabold pt-1">{money(r.commissionMinor)}</div><div className="text-[12px]" style={{ color: first ? T.sideText : T.ink3 }}>hoa hồng kỳ này</div></>}
    </div>
  );
}

function Trend({ d }: { d: number }) {
  const label = d === 0 ? 'Giữ hạng' : d > 0 ? `+${d}` : String(d);
  return <span className="text-[12px] font-semibold" style={{ color: d > 0 ? T.teal : d === 0 ? T.ink3 : T.accentText }}>{label}</span>;
}

/**
 * `q` là truy vấn bảng xếp hạng của kỳ đang chọn. Máy chủ từ chối (403) khi chủ hội vừa ẩn bảng hoặc chỉ mở cho
 * affiliate: lúc đó hiện lời giải thích kèm lối đi tiếp (`fallback`), không coi là lỗi.
 */
export function RankBoard({ q, period, onPeriod, note, fallback }: { q: UseQueryResult<Board>; period: Period; onPeriod: (p: Period) => void; note?: ReactNode; fallback?: ReactNode }) {
  const denied = q.isError && q.error instanceof ApiError && q.error.status === 403;
  if (denied) {
    return (
      <div className="card p-6 flex flex-col items-start gap-2.5">
        <div className="font-semibold text-[16px]">Bảng xếp hạng chưa mở với bạn</div>
        <div className="text-[14px]" style={{ color: T.ink2 }}>{q.error instanceof ApiError ? q.error.message : 'Chủ hội đang tắt bảng xếp hạng.'}</div>
        {fallback}
      </div>
    );
  }
  const myRank = q.data?.me?.rank ?? null;
  return (
    <>
      <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
        <div className="chip-row" role="group" aria-label="Kỳ xếp hạng">{PERIODS.map(([k, l]) => <Chip key={k} className="min-h-[44px] md:min-h-0" on={period === k} aria-pressed={period === k} onClick={() => onPeriod(k)}>{l}</Chip>)}</div>
        <span className="flex-grow" />
        <span className="muted text-[13px]">{myRank !== null && `Bạn đang ở hạng ${myRank}`}{myRank !== null && q.data?.computedAt ? ' · ' : ''}{q.data?.computedAt && `Cập nhật ${timeAgo(q.data.computedAt)}`}</span>
      </div>
      {note}
      <QueryState q={q} rows={4} isEmpty={(d) => d.items.length === 0} empty={{ title: 'Chưa có xếp hạng kỳ này', hint: 'Bảng cập nhật 10 phút một lần khi có hoa hồng phát sinh' }}>
        {(d) => {
          const [a, b, c] = d.items;
          const rest = d.items.slice(3);
          return (
            <>
              <div className="flex gap-4 flex-col sm:flex-row sm:items-end">
                {/* Máy tính: bục 2-1-3. Điện thoại xếp dọc nên phải theo đúng thứ hạng 1-2-3. */}
                {b && <Podium r={b} order="order-2 sm:order-1" showMoney={d.program.showMoney} />}
                {a && <Podium r={a} first order="order-1 sm:order-2" showMoney={d.program.showMoney} />}
                {c && <Podium r={c} order="order-3" showMoney={d.program.showMoney} />}
              </div>
              {rest.length > 0 && (
                <div className="card overflow-hidden table-scroll">
                  <div className="grid gap-3 px-5 py-3" style={{ gridTemplateColumns: COLS, minWidth: 640 }}><span className="th">Hạng</span><span className="th">Affiliate</span><span className="th">Giới thiệu</span><span className="th">Trả phí</span><span className="th">Doanh thu</span><span className="th">Hoa hồng</span><span className="th">So kỳ trước</span></div>
                  {rest.map((r) => (
                    <div key={r.user.id} className="grid gap-3 items-center px-5 py-3" style={{ gridTemplateColumns: COLS, minWidth: 640, borderTop: `1px solid ${T.line}`, background: r.isMe ? T.goldSoft : undefined }}>
                      <span className="font-bold" style={{ color: T.ink2 }}>{r.rank}</span>
                      <div className="flex items-center gap-2.5 min-w-0"><Avatar name={r.user.name} src={r.user.avatarUrl} color={r.user.coverColor ?? T.ink} size={32} /><div className="min-w-0"><div className="font-semibold truncate">{r.user.name}{r.isMe && <span className="muted font-medium"> (bạn)</span>}</div><div className="muted text-[12px]">@{r.user.handle}</div></div></div>
                      <span>{r.referrals}</span><span>{r.paid}</span>
                      <span>{r.revenueMinor === null ? 'Ẩn' : money(r.revenueMinor)}</span>
                      <span className="font-semibold">{r.commissionMinor === null ? 'Ẩn' : money(r.commissionMinor)}</span>
                      <Trend d={r.rankDelta} />
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        }}
      </QueryState>
    </>
  );
}
