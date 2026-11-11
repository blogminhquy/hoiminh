// Bàn điều khiển của chủ hội và quản trị: thay trang Hôm nay của thành viên. Một màn trả lời ba câu:
// có gì cần xử lý, hội đang chạy thế nào, tiền đang ở đâu. Mọi con số lấy từ API sẵn có (tổng quan, nhận tiền,
// danh sách thành viên, bảng tin, gói Hội Mình), phần nào người xem không có quyền thì không gọi và không hiện.
import { useQuery } from '@tanstack/react-query';
import { Avatar, Bars, Chip, DateBlock, Prog, StatCard, T, money } from '@hoiminh/ui';
import { BadgeCheck, Check, ChevronRight, FileClock, Handshake, Settings, Sparkles, UserPlus, Users, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { FeedPost } from '@/components/post/PostCard';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCan, useShell } from '@/lib/community';
import { fmtDate, fmtLongDate, fmtTime, timeAgo } from '@/lib/format';
import { buildOwnerTodos, type OwnerPlan, type OwnerTodo } from '@/lib/owner-todo';

interface Overview {
  stats: { newMembers: number; newMembersDeltaPct: number | null; revenueMinor: number; revenueDeltaPct: number | null; paying: number; premium: number; vip: number; churned: number; churnRatePct: number; posts: number };
  daily: Array<{ date: string; amountMinor: number }>; checklist: Array<{ key: string; label: string; done: boolean }>;
  activity: Array<{ kind: 'payment' | 'post' | 'join'; actor: string; actor_id: string; what: string | null; at: string }>;
}
interface Payout { ready: boolean; received30Minor: number; pendingCount: number; pendingMinor: number; affiliatePendingMinor: number; affiliatePendingCount: number }

const RANGES: Array<[number, string]> = [[7, '7 ngày'], [30, '30 ngày'], [90, 'Quý']];
const delta = (p: number | null) => (p === null ? 'kỳ trước chưa có dữ liệu' : `${p >= 0 ? '+' : ''}${p}% so với kỳ trước`);
const describe = (a: Overview['activity'][number]) => (a.kind === 'payment' ? <><strong>{a.actor}</strong> thanh toán {a.what ?? ''}</> : a.kind === 'post' ? <><strong>{a.actor}</strong> đăng bài {a.what ? `“${a.what}”` : ''}</> : <><strong>{a.actor}</strong> tham gia hội</>);
const TODO_ICON: Record<OwnerTodo['key'], ReactNode> = { plan: <Sparkles size={20} />, payout: <Wallet size={20} />, orders: <Wallet size={20} />, payouts: <Handshake size={20} />, members: <UserPlus size={20} />, posts: <FileClock size={20} /> };

function TodoRow({ todo }: { todo: OwnerTodo }) {
  return (
    <Link to={todo.to} className="today-task" style={{ color: T.ink }}>
      <span className="owner-todo-ic" data-urgent={todo.urgent || undefined} aria-hidden="true">{TODO_ICON[todo.key]}</span>
      <span className="flex-grow min-w-0">
        <span className="block font-semibold text-[16px] leading-snug">{todo.title}</span>
        <span className="block muted text-[14px] truncate">{todo.hint}</span>
      </span>
      <span className={`btn btn-sm flex-shrink-0 ${todo.urgent ? 'btn-primary' : 'btn-soft'}`}>{todo.label}</span>
    </Link>
  );
}

function Tile({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="card owner-tile"><span className="ic">{icon}</span><span className="flex-grow">{label}</span><ChevronRight size={18} style={{ color: T.ink3 }} /></Link>
  );
}

export default function Dashboard() {
  const shell = useShell();
  const can = useCan();
  const { user } = useAuth();
  const cid = shell.community.id;
  const base = `/${shell.community.slug}`;
  const [days, setDays] = useState(30);

  const canOverview = can('settings.manage');
  const canMoney = can('billing.manage');
  const overview = useQuery({ queryKey: ['overview', cid, days], queryFn: () => api.get<Overview>(`/v1/communities/${cid}/overview?days=${days}`), enabled: canOverview });
  const payout = useQuery({ queryKey: ['payout-settings', cid], queryFn: () => api.get<Payout>(`/v1/communities/${cid}/payout`), enabled: canMoney });
  const pending = useQuery({ queryKey: ['members', cid, 'pending-count'], queryFn: () => api.get<{ counts: Record<string, number> }>(`/v1/communities/${cid}/members?status=pending&limit=1`), enabled: can('member.manage') });
  const feed = useQuery({ queryKey: ['feed', cid, 'today'], queryFn: () => api.get<{ items: FeedPost[] }>(`/v1/communities/${cid}/feed`), enabled: can('post.moderate') && shell.community.tabs.feed !== false });
  // Gói của hội là việc của chủ hội (người trả tiền), quản trị được mời không cần thấy.
  const plan: OwnerPlan | null = shell.viewer.role === 'owner' ? shell.plan : null;
  const now = new Date();
  const todos = buildOwnerTodos({
    slug: shell.community.slug,
    now,
    affiliatePayouts: payout.data ? { count: payout.data.affiliatePendingCount, amountMinor: payout.data.affiliatePendingMinor } : null,
    payout: payout.data ? { ready: payout.data.ready, pendingCount: payout.data.pendingCount, pendingMinor: payout.data.pendingMinor, sells: shell.community.pricingMode !== 'free' || shell.community.tabs.store !== false } : null,
    pendingMembers: pending.data?.counts.pending ?? null,
    pendingPosts: feed.data ? feed.data.items.filter((p) => p.moderationStatus === 'pending').length : null,
    plan,
  });
  const loading = (canMoney && payout.isLoading) || pending.isLoading || feed.isLoading;
  const from = new Date(Date.now() - days * 86_400_000);

  return (
    <div className="two-col">
      <div className="main wide">
        <section className="card card-invert today-head">
          <span className="muted text-[14px]">{fmtLongDate(now)} · {shell.community.name}</span>
          <h1 className="serif m-0 text-[26px] font-extrabold leading-tight">Chào {user?.name ?? 'bạn'}</h1>
          <span className="font-bold text-[17px] pt-1">{loading ? 'Đang xem hôm nay có gì…' : todos.length ? `Có ${todos.length} việc cần xử lý` : 'Không có gì cần xử lý'}</span>
          {canMoney && payout.data && (
            <div className="owner-money">
              <div><span className="muted text-[14px] block">Đã thu 30 ngày</span><span className="serif text-[24px] font-extrabold">{money(payout.data.received30Minor)}</span></div>
              <div><span className="muted text-[14px] block">Đơn chờ xác nhận</span><span className="serif text-[24px] font-extrabold">{payout.data.pendingCount}</span></div>
              <Link to={payout.data.ready ? `${base}/tien` : `${base}/cai-dat/nhan-tien`} className="btn btn-gold btn-sm"><Wallet size={16} />{payout.data.ready ? 'Xem tiền' : 'Cài nhận tiền'}</Link>
            </div>
          )}
        </section>

        <section className="card px-4 py-1" aria-label="Cần xử lý">
          {todos.map((t) => <TodoRow key={t.key} todo={t} />)}
          {!loading && todos.length === 0 && (
            <div className="today-task">
              <span className="today-ring done" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
              <span className="flex-grow min-w-0"><span className="block font-semibold text-[16px]">Mọi việc đã xong</span><span className="block muted text-[14px]">Không có đơn chờ xác nhận, yêu cầu rút của cộng sự, người chờ duyệt hay bài chờ duyệt.</span></span>
            </div>
          )}
          {loading && todos.length === 0 && <div className="today-task muted text-[15px]">Đang kiểm tra…</div>}
        </section>

        <nav className="owner-tiles md:hidden" aria-label="Quản lý hội">
          <Tile to={`${base}/thanh-vien`} icon={<Users size={20} />} label="Thành viên" />
          {(canMoney || can('revenue.read')) && <Tile to={`${base}/tien`} icon={<Wallet size={20} />} label="Tiền" />}
          {can('affiliates.manage') && <Tile to={`${base}/cong-su`} icon={<Handshake size={20} />} label="Cộng sự" />}
          {canOverview && <Tile to={`${base}/cai-dat`} icon={<Settings size={20} />} label="Cài đặt" />}
        </nav>

        {canOverview && (
          <>
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <h2 className="m-0 font-bold text-[18px] flex-grow">Hội đang chạy thế nào</h2>
              <div className="flex gap-2">{RANGES.map(([d, l]) => <Chip key={d} on={days === d} onClick={() => setDays(d)}>{l}</Chip>)}</div>
            </div>
            <QueryState q={overview} rows={3}>
              {(d) => {
                const byDay = new Map(d.daily.map((x) => [x.date, x.amountMinor]));
                const series = Array.from({ length: days }, (_, i) => { const dt = new Date(from.getTime() + (i + 1) * 86_400_000); const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; return byDay.get(key) ?? 0; });
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard label="Doanh thu" value={money(d.stats.revenueMinor)} sub={delta(d.stats.revenueDeltaPct)} subColor={(d.stats.revenueDeltaPct ?? 0) >= 0 ? T.teal : T.accentText} />
                      <StatCard label="Thành viên mới" value={d.stats.newMembers} sub={delta(d.stats.newMembersDeltaPct)} subColor={(d.stats.newMembersDeltaPct ?? 0) >= 0 ? T.teal : T.accentText} />
                      <StatCard label="Đang trả phí" value={d.stats.paying} sub={`Premium ${d.stats.premium} · VIP ${d.stats.vip}`} />
                      <StatCard label="Tỷ lệ hủy" value={`${d.stats.churnRatePct}%`} sub={`${d.stats.churned} người hủy trong kỳ`} subColor={d.stats.churned > 0 ? T.accentText : undefined} />
                    </div>
                    <div className="card flex flex-col gap-3" style={{ padding: '18px 20px' }}>
                      <div className="flex items-center"><span className="font-semibold flex-grow">Doanh thu theo ngày</span><span className="muted text-[14px]">{fmtDate(from).slice(0, 5)} đến {fmtDate(now).slice(0, 5)}</span></div>
                      <Bars values={series} height={120} />
                    </div>
                  </>
                );
              }}
            </QueryState>
          </>
        )}
      </div>

      <aside className="rail">
        {canOverview && overview.data && (() => {
          const d = overview.data;
          const doneCount = d.checklist.filter((c) => c.done).length;
          return (
            <>
              {doneCount < d.checklist.length && (
                <section className="card p-4 flex flex-col gap-2.5">
                  <div className="flex items-center"><h2 className="m-0 font-bold text-[17px] flex-grow">Hoàn thiện hội</h2><span className="muted text-[14px]">{doneCount}/{d.checklist.length}</span></div>
                  <Prog value={(doneCount / Math.max(1, d.checklist.length)) * 100} />
                  {d.checklist.map((c) => <div key={c.key} className="flex items-center gap-2.5 text-[15px]" style={{ color: c.done ? T.ink3 : T.ink }}><span className="w-5 h-5 rounded-full inline-flex items-center justify-center flex-shrink-0" style={c.done ? { background: T.primary, color: T.onPrimary } : { border: `1.5px solid ${T.line2}` }}>{c.done && <Check size={12} />}</span><span style={{ textDecoration: c.done ? 'line-through' : undefined }}>{c.label}</span></div>)}
                </section>
              )}
              <section className="card p-4 flex flex-col gap-2.5">
                <h2 className="m-0 font-bold text-[17px]">Vừa diễn ra</h2>
                {d.activity.length === 0 && <span className="muted text-[15px]">Chưa có hoạt động.</span>}
                {d.activity.map((a, i) => <div key={`${a.kind}-${i}`} className="flex items-center gap-2.5 text-[15px]"><Avatar name={a.actor} size={30} /><span className="flex-grow min-w-0 truncate">{describe(a)}</span><span className="muted text-[14px] flex-shrink-0">{timeAgo(a.at, true)}</span></div>)}
              </section>
            </>
          );
        })()}

        {shell.upcomingEvents.length > 0 && (
          <section className="card p-4 flex flex-col gap-1">
            <div className="flex items-center"><h2 className="m-0 font-bold text-[17px] flex-grow">Sự kiện sắp tới</h2><Link to={`${base}/su-kien`} className="text-[14px] font-semibold inline-flex items-center min-h-[44px]">Tất cả</Link></div>
            {shell.upcomingEvents.slice(0, 2).map((e) => (
              <Link key={e.id} to={`${base}/su-kien/${e.id}`} className="flex items-center gap-3 py-2.5" style={{ color: T.ink, borderTop: `1px solid ${T.line}` }}>
                <DateBlock date={new Date(e.startsAt)} tone="teal" size={48} />
                <span className="flex-grow min-w-0"><span className="block font-semibold text-[15px] truncate">{e.title}</span><span className="block muted text-[14px]">{fmtTime(e.startsAt)}</span></span>
                <ChevronRight size={20} style={{ color: T.ink3 }} />
              </Link>
            ))}
          </section>
        )}

        <Link to={base} className="card p-4 flex items-center gap-3" style={{ color: T.ink }}>
          <BadgeCheck size={20} style={{ color: T.primaryText }} />
          <span className="flex-grow font-semibold text-[15px]">Xem trang giới thiệu của hội</span>
          <ChevronRight size={20} style={{ color: T.ink3 }} />
        </Link>
      </aside>
    </div>
  );
}
