// Mảnh màn Tin nhắn: dòng hội thoại (convo), bong bóng (bubble), chấm online, chỉ báo đang gõ, panel thành viên bên phải.
import { Avatar, T, money } from '@hoiminh/ui';
import { Archive, BookOpen, Calendar, CheckCheck, Settings, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fmtDate, fmtTime, timeAgo } from '@/lib/format';

export interface Person { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null; online?: boolean }
export interface Conversation { id: string; other: Person; community: { id: string; name: string; slug: string } | null; preview: string | null; lastMessageAt: string | null; automated: boolean; unreadCount: number }
export interface Message { id: string; conversationId?: string; senderUserId: string; body: string; imageUrl: string | null; automated: boolean; readAt: string | null; createdAt: string }
export interface Panel { memberId: string; role: string; status: string; tier: { key: string; name: string; monthlyMinor: number | null } | null; joinedAt: string; learning: { title: string; percent: number } | null; referrer: string | null }

/** Avatar kèm chấm xanh khi người đó đang mở Hội Mình. */
export function PresenceAvatar({ person, size }: { person: Person; size: number }) {
  const dot = Math.max(9, Math.round(size * 0.28));
  return (
    <span className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
      <Avatar name={person.name} src={person.avatarUrl} color={person.coverColor ?? T.ink} size={size} />
      {person.online && (
        <span
          aria-label="Đang hoạt động"
          title="Đang hoạt động"
          className="absolute rounded-full"
          style={{ width: dot, height: dot, right: 0, bottom: 0, background: T.tealText ?? T.teal, border: `2px solid ${T.surface}` }}
        />
      )}
    </span>
  );
}

/** Ba chấm "đang gõ" ở cuối luồng tin. */
export function TypingBubble({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 self-start" aria-live="polite">
      <span className="px-4 py-3 rounded-2xl inline-flex gap-1 items-center" style={{ background: T.surface, border: `1px solid ${T.line}`, borderBottomLeftRadius: 4 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded-full typing-dot" style={{ width: 6, height: 6, background: T.ink3, animationDelay: `${i * 0.16}s` }} />
        ))}
      </span>
      <span className="muted text-[12px]">{name} đang gõ…</span>
    </div>
  );
}

export function ConvoRow({ c, on, onClick }: { c: Conversation; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex gap-3 items-start px-3.5 py-3 rounded-xl text-left w-full" style={{ background: on ? T.goldSoft : 'transparent' }}>
      <PresenceAvatar person={c.other} size={40} />
      <span className="flex-grow min-w-0 flex flex-col gap-0.5">
        <span className="flex items-center gap-2"><span className="font-semibold flex-grow truncate">{c.other.name}</span><span className="muted text-[12px] flex-shrink-0">{c.lastMessageAt ? timeAgo(c.lastMessageAt, true) : ''}</span></span>
        {c.community && <span className="muted text-[12px] truncate">{c.community.name}</span>}
        <span className="flex items-center gap-2"><span className="text-[13px] flex-grow truncate" style={{ color: c.unreadCount ? T.ink : T.ink2, fontWeight: c.unreadCount ? 600 : 400 }}>{c.automated && <span style={{ color: T.ink3 }}>Tự động · </span>}{c.preview ?? ''}</span>{c.unreadCount > 0 && <span className="min-w-[18px] h-[18px] rounded-full text-[11px] font-bold inline-flex items-center justify-center px-1.5" style={{ background: T.accent, color: T.surface }}>{c.unreadCount}</span>}</span>
      </span>
    </button>
  );
}

export function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  return (
    <div className="flex flex-col gap-1 max-w-[520px]" style={{ alignItems: mine ? 'flex-end' : 'flex-start', alignSelf: mine ? 'flex-end' : 'flex-start' }}>
      {m.automated && <span className="tag" style={{ background: T.bg, color: T.ink3, height: 20 }}><Sparkles size={12} />Tin nhắn chào tự động</span>}
      {m.imageUrl && <div className="p-2 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.line}` }}><img src={m.imageUrl} alt="" className="rounded-[10px] max-w-[240px]" /></div>}
      {m.body && <div className="px-4 py-3 rounded-2xl text-[14px] leading-[1.55] whitespace-pre-wrap break-words" style={mine ? { background: T.ink, color: T.surface, borderBottomRightRadius: 4 } : { background: T.surface, border: `1px solid ${T.line}`, borderBottomLeftRadius: 4 }}>{m.body}</div>}
      <span className="muted text-[11px] inline-flex items-center gap-1">{mine && <CheckCheck size={13} />}{mine ? (m.readAt ? 'Đã xem' : 'Đã gửi') + ' · ' : ''}{fmtTime(m.createdAt)}</span>
    </div>
  );
}

export function DayDivider({ date }: { date: string }) {
  const d = new Date(date);
  const today = new Date();
  const label = d.toDateString() === today.toDateString() ? 'Hôm nay' : d.toDateString() === new Date(today.getTime() - 86_400_000).toDateString() ? 'Hôm qua' : fmtDate(d);
  return <div className="flex items-center gap-3 text-[12px]" style={{ color: T.ink3 }}><span className="flex-grow h-px" style={{ background: T.line }} />{label}<span className="flex-grow h-px" style={{ background: T.line }} /></div>;
}

export function MemberPanel({ other, panel, community, onArchive }: { other: Person; panel: Panel | null; community: { slug: string } | null; onArchive: () => void }) {
  return (
    <aside className="card w-full md:w-[280px] p-5 flex flex-col gap-3.5 flex-shrink-0">
      <div className="flex flex-col items-center gap-2 text-center">
        <PresenceAvatar person={other} size={64} />
        <div className="font-bold text-[16px]">{other.name}</div>
        <div className="muted text-[13px]">@{other.handle}{other.online ? ' · đang hoạt động' : ''}</div>
        {panel?.tier && <span className="tag" style={{ background: T.goldSoft, color: T.goldText }}>{panel.tier.name}{panel.tier.monthlyMinor ? ` · ${money(panel.tier.monthlyMinor)}/tháng` : ''}</span>}
      </div>
      {panel && (
        <div className="flex flex-col gap-2 text-[13px] pt-3" style={{ color: T.ink2, borderTop: `1px solid ${T.line}` }}>
          <div className="flex items-center gap-2.5"><Calendar size={16} />Tham gia {fmtDate(panel.joinedAt)}</div>
          {panel.learning && <div className="flex items-center gap-2.5"><BookOpen size={16} />Đang học: {panel.learning.title} · {panel.learning.percent}%</div>}
          {panel.referrer && <div className="flex items-center gap-2.5"><Users size={16} />Giới thiệu bởi {panel.referrer}</div>}
        </div>
      )}
      <div className="flex flex-col gap-2 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
        <Link to={`/u/${other.handle}`} className="btn btn-ghost btn-sm justify-start"><Users size={14} />Xem hồ sơ</Link>
        {panel && community && <Link to={`/${community.slug}/thanh-vien?q=${encodeURIComponent(other.handle)}`} className="btn btn-ghost btn-sm justify-start"><Settings size={14} />Quản lý thành viên</Link>}
        <button type="button" className="btn btn-ghost btn-sm justify-start" onClick={onArchive}><Archive size={14} />Lưu trữ hội thoại</button>
      </div>
    </aside>
  );
}
