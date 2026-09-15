// Thông báo (notificationsMain): chip lọc, danh sách nhóm theo ngày với icon loại, đánh dấu đã đọc; rail cài đặt nhanh + theo cộng đồng.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Chip, CommunityMark, Select, T, Toggle } from '@hoiminh/ui';
import { AtSign, Bell, BellOff, Calendar, CheckCheck, CircleDollarSign, Heart, Mail, Megaphone, MessageCircle, UserPlus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, timeAgo } from '@/lib/format';

interface Notif { id: string; kind: string; category: string; title: string; body: string | null; link: string | null; actionLabel: string | null; readAt: string | null; createdAt: string; actor: { name: string; avatarUrl: string | null; coverColor: string | null } | null; community: { name: string; slug: string } | null }
interface List { items: Notif[]; nextCursor: string | null; unreadCount: number }
interface Prefs { emailDigest: boolean; push: boolean; likes: boolean; perCommunity: Record<string, 'all' | 'mentions' | 'off'> }
type Filter = 'all' | 'unread' | 'mention' | 'affiliate' | 'system';
const FILTERS: Array<[Filter, string]> = [['all', 'Tất cả'], ['unread', 'Chưa đọc'], ['mention', 'Nhắc đến'], ['affiliate', 'Cộng sự'], ['system', 'Hệ thống']];
const ICON: Record<string, [ReactNode, string, string]> = { comment: [<MessageCircle size={12} key="c" />, T.tealSoft, T.tealText], affiliate: [<CircleDollarSign size={12} key="d" />, T.goldSoft, T.goldText], mention: [<AtSign size={12} key="a" />, T.accentSoft, T.accentText], event: [<Calendar size={12} key="e" />, T.tealSoft, T.tealText], payment: [<UserPlus size={12} key="u" />, T.goldSoft, T.goldText], post: [<Megaphone size={12} key="m" />, T.accentSoft, T.accentText], like: [<Heart size={12} key="h" />, T.accentSoft, T.accentText], system: [<Bell size={12} key="b" />, T.bg, T.ink2] };

function dayGroup(at: string): string {
  const d = new Date(at); const now = new Date();
  const diff = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  return diff <= 0 ? 'Hôm nay' : diff === 1 ? 'Hôm qua' : diff < 7 ? 'Tuần này' : 'Trước đó';
}

function Row({ n, onRead }: { n: Notif; onRead: () => void }) {
  const [icon, bg, fg] = ICON[n.category] ?? ICON.system!;
  const unread = !n.readAt;
  const inner = (
    <>
      <div className="relative flex-shrink-0"><Avatar name={n.actor?.name ?? 'HM'} src={n.actor?.avatarUrl} color={n.actor?.coverColor ?? T.ink3} size={40} /><span className="absolute -right-1.5 -bottom-1.5 w-[22px] h-[22px] rounded-full inline-flex items-center justify-center" style={{ background: bg, color: fg, border: `2px solid ${T.surface}` }}>{icon}</span></div>
      <div className="flex-grow min-w-0 flex flex-col gap-0.5"><div className="text-[14px] leading-[1.45]" style={{ color: T.ink }}>{n.title}{n.body ? <span style={{ color: T.ink2 }}>: {n.body}</span> : null}</div><div className="muted text-[12px]">{[n.community?.name, timeAgo(n.createdAt)].filter(Boolean).join(' · ')}</div></div>
      {n.actionLabel && n.link && <span className="btn btn-ghost btn-sm flex-shrink-0 hide-mobile">{n.actionLabel}</span>}
      <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: unread ? T.accent : 'transparent' }} />
    </>
  );
  const cls = 'flex gap-3.5 items-start px-5 py-3.5 text-left w-full';
  const style = { borderTop: `1px solid ${T.line}`, background: unread ? T.surface : T.bg };
  return n.link ? <Link to={n.link} className={cls} style={style} onClick={onRead}>{inner}</Link> : <button type="button" className={cls} style={style} onClick={onRead}>{inner}</button>;
}

export default function Page() {
  const qc = useQueryClient();
  const { communities } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const q = useQuery({ queryKey: ['notifications', filter], queryFn: () => api.get<List>(`/v1/me/notifications?filter=${filter}`) });
  const prefs = useQuery({ queryKey: ['notification-prefs'], queryFn: () => api.get<Prefs>('/v1/me/notifications/prefs') });
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); void qc.invalidateQueries({ queryKey: ['badges'] }); };
  const read = useMutation({ mutationFn: (id?: string) => api.post('/v1/me/notifications/read', id ? { id } : {}), onSuccess: invalidate });
  const savePrefs = useMutation({ mutationFn: (p: Partial<Prefs>) => api.put<Prefs>('/v1/me/notifications/prefs', p), onSuccess: (d) => qc.setQueryData(['notification-prefs'], d) });
  const p = prefs.data;
  return (
    <div className="two-col">
      <div className="main flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="serif m-0 text-[28px] font-extrabold">Thông báo</h1>
          <div className="flex gap-2 flex-wrap md:ml-3">{FILTERS.map(([k, l]) => <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{l}{k === 'unread' && q.data?.unreadCount ? ` · ${q.data.unreadCount}` : ''}</Chip>)}</div>
          <span className="flex-grow" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => read.mutate(undefined)} disabled={!q.data?.unreadCount}><CheckCheck size={14} />Đánh dấu tất cả đã đọc</button>
        </div>
        <QueryState q={q} rows={5} isEmpty={(d) => d.items.length === 0} empty={{ title: 'Không có thông báo', hint: 'Bình luận, nhắc đến, hoa hồng và sự kiện sẽ hiện ở đây' }}>
          {(d) => {
            let last = '';
            return (
              <div className="card overflow-hidden">
                {d.items.map((n) => { const g = dayGroup(n.createdAt); const head = g !== last; last = g; return <div key={n.id}>{head && <div className="th" style={{ padding: '12px 20px 8px' }}>{g}</div>}<Row n={n} onRead={() => { if (!n.readAt) read.mutate(n.id); }} /></div>; })}
              </div>
            );
          }}
        </QueryState>
      </div>
      <aside className="rail flex flex-col gap-4">
        <div className="card p-4 flex flex-col gap-3">
          <div className="font-semibold">Cài đặt nhanh</div>
          {p && ([['emailDigest', <Mail size={16} key="m" />, 'Email tổng hợp mỗi sáng'], ['push', <Bell size={16} key="b" />, 'Đẩy trên điện thoại'], ['likes', <Heart size={16} key="h" />, 'Báo khi có lượt thích']] as Array<['emailDigest' | 'push' | 'likes', ReactNode, string]>).map(([k, ic, l]) => <div key={k} className="flex items-center gap-2.5 text-[13px]"><span style={{ color: T.ink2 }}>{ic}</span><span className="flex-grow">{l}</span><Toggle on={p[k]} onChange={(v) => savePrefs.mutate({ [k]: v })} /></div>)}
        </div>
        <div className="card p-4 flex flex-col gap-2.5">
          <div className="font-semibold">Theo cộng đồng</div>
          {communities.map((c) => { const lvl = p?.perCommunity[c.id] ?? 'all'; return (
            <div key={c.id} className="flex items-center gap-2.5 text-[13px]"><CommunityMark mark={c.logoMark} color={c.logoColor} size={28} radius={8} /><span className="flex-grow truncate">{c.name}</span><Select value={lvl} onChange={(e) => savePrefs.mutate({ perCommunity: { [c.id]: e.target.value as 'all' | 'mentions' | 'off' } })} style={{ height: 28, fontSize: 12, width: 'fit-content' }}><option value="all">Tất cả</option><option value="mentions">Chỉ nhắc đến</option><option value="off">Tắt</option></Select><span style={{ color: lvl === 'off' ? T.ink3 : T.ink2 }}>{lvl === 'off' ? <BellOff size={16} /> : lvl === 'mentions' ? <AtSign size={16} /> : <Bell size={16} />}</span></div>
          ); })}
          {communities.length === 0 && <span className="muted text-[13px]">Bạn chưa tham gia hội nào.</span>}
          <span className="muted text-[12px]">Cập nhật lần cuối {p ? fmtDate(new Date()) : '…'}</span>
        </div>
      </aside>
    </div>
  );
}
