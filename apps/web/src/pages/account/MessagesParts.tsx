// Mảnh màn Tin nhắn (kiểu Zalo): dòng hội thoại có menu ghim/lưu trữ, bong bóng tin kèm hàng giờ gửi và thao tác bên dưới,
// và bảng "Thông tin hội thoại" bên phải (thao tác nhanh, thông tin thành viên, ảnh, tệp, link đã gửi).
import { MESSAGE_REACTIONS, type MessageReaction } from '@hoiminh/contracts';
import { Avatar, T, money } from '@hoiminh/ui';
import { Archive, ArchiveRestore, BookOpen, Calendar, Check, CheckCheck, ChevronDown, Copy, Download, FileText, Link2, MoreHorizontal, Pin, PinOff, Quote, Settings, Sparkles, Undo2, User, Users, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fileSizeLabel, linkParts, reactionSummary } from '@/lib/chat';
import { fmtDate, fmtTime, timeAgo } from '@/lib/format';

export interface Person { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null; lastSeenAt?: string | null }
export interface Conversation { id: string; other: Person; community: { id: string; name: string; slug: string } | null; preview: string | null; lastMessageAt: string | null; automated: boolean; unreadCount: number; pinned: boolean; archived: boolean; lastFromMe: boolean }
export interface ReplyRef { id: string; senderUserId: string; body: string; hasImage: boolean; fileName: string | null; recalled: boolean }
export interface MessageFile { name: string; sizeBytes: number }
export interface Message { id: string; senderUserId: string; body: string; imageUrl: string | null; automated: boolean; deliveredAt: string | null; readAt: string | null; createdAt: string; recalled: boolean; reactions: Record<string, string>; replyTo: ReplyRef | null; file: MessageFile | null; pending?: boolean }
export interface Panel { memberId: string; role: string; status: string; tier: { key: string; name: string; monthlyMinor: number | null } | null; joinedAt: string; learning: { title: string; percent: number } | null; referrer: string | null }

/** Thu hồi được trong 24 giờ (khớp RECALL_WINDOW_MS ở máy chủ; máy chủ vẫn là nơi quyết định). */
const RECALL_WINDOW_MS = 24 * 60 * 60_000;
/** Tin chỉ gồm 1 đến 3 biểu tượng cảm xúc thì hiện to, không khung (như Zalo). */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*\s*){1,3}$/u;

export const replySnippet = (r: { body: string; hasImage: boolean; fileName?: string | null; recalled: boolean }) => (r.recalled ? 'Tin nhắn đã được thu hồi' : r.body || (r.hasImage ? '[Hình ảnh]' : r.fileName ? `[Tệp] ${r.fileName}` : ''));

export function ConvoRow({ c, on, onClick, onPin, onArchive }: { c: Conversation; on: boolean; onClick: () => void; onPin: () => void; onArchive: () => void }) {
  const [menu, setMenu] = useState(false);
  const unread = c.unreadCount > 0;
  const prefix = c.automated ? 'Tự động · ' : c.lastFromMe ? 'Bạn: ' : '';
  const act = (fn: () => void) => () => { setMenu(false); fn(); };
  return (
    <div className={`chat-convo${on ? ' on' : ''}${menu ? ' menu-open' : ''}`}>
      <button type="button" className="chat-convo-main" onClick={onClick} aria-current={on ? 'true' : undefined}>
        <Avatar name={c.other.name} src={c.other.avatarUrl} color={c.other.coverColor ?? T.ink} size={48} />
        <span className="flex-grow min-w-0 flex flex-col">
          <span className="flex items-center gap-2">
            <span className="flex-grow truncate text-[15px]" style={{ fontWeight: unread ? 700 : 600 }}>{c.other.name}</span>
            <span className="chat-convo-time muted text-[13px] flex-shrink-0">{c.lastMessageAt ? timeAgo(c.lastMessageAt, true) : ''}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-[14px] flex-grow truncate" style={{ color: unread ? T.ink : T.ink3, fontWeight: unread ? 600 : 400 }}>{prefix}{c.preview ?? ''}</span>
            {c.pinned && <Pin size={14} className="flex-shrink-0" style={{ color: T.ink3 }} aria-label="Đã ghim" />}
            {unread && <span className="chat-badge" aria-label={`${c.unreadCount} tin chưa đọc`}>{c.unreadCount > 99 ? '99+' : c.unreadCount}</span>}
          </span>
          {c.community && <span className="muted text-[13px] truncate">{c.community.name}</span>}
        </span>
      </button>
      <button type="button" className="chat-convo-more" aria-label={`Thao tác với hội thoại ${c.other.name}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><MoreHorizontal size={18} /></button>
      {menu && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Đóng menu" onClick={() => setMenu(false)} />
          <div role="menu" className="chat-menu">
            <button type="button" role="menuitem" onClick={act(onPin)}>{c.pinned ? <PinOff size={16} /> : <Pin size={16} />}{c.pinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'}</button>
            <button type="button" role="menuitem" onClick={act(onArchive)}>{c.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}{c.archived ? 'Bỏ lưu trữ' : 'Lưu trữ hội thoại'}</button>
          </div>
        </>
      )}
    </div>
  );
}

/** Nội dung tin: link bấm được. Link trong chính Hội Mình mở ngay tại chỗ, link ngoài mở tab mới. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {linkParts(text).map((p, i) => {
        if (!p.href) return <span key={i}>{p.text}</span>;
        const u = new URL(p.href);
        return u.origin === window.location.origin
          ? <Link key={i} to={u.pathname + u.search + u.hash} className="chat-link">{p.text}</Link>
          : <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="chat-link">{p.text}</a>;
      })}
    </>
  );
}

export interface MessageItemProps {
  m: Message; mine: boolean; myId: string; other: Person;
  /** Tin đầu của một cụm tin liền nhau cùng người gửi (hiện ảnh đại diện). */
  first: boolean;
  /** Dòng trạng thái dưới tin cuối cùng của mình: Đang gửi, Đã gửi, Đã xem. */
  status: string | null; flash: boolean;
  /** Màn cảm ứng không có rê chuột: chạm vào tin để hiện thao tác, chạm lần nữa để ẩn. */
  active: boolean; onActivate: () => void;
  onReply: () => void; onReact: (emoji: MessageReaction | null) => void; onRecall: () => void; onJump: (id: string) => void; onImageLoad: () => void;
  /** Tải tệp đính kèm của tin này về máy. */
  onDownload: () => void;
}

export function MessageItem({ m, mine, myId, other, first, status, flash, active, onActivate, onReply, onReact, onRecall, onJump, onImageLoad, onDownload }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const myReaction = m.reactions[myId] as MessageReaction | undefined;
  const sum = reactionSummary(m.reactions);
  const canAct = !m.recalled && !m.pending;
  const canRecall = mine && canAct && Date.now() - new Date(m.createdAt).getTime() < RECALL_WINDOW_MS;
  const big = !m.recalled && !m.imageUrl && !m.file && !m.replyTo && EMOJI_ONLY.test(m.body);
  const copy = () => { void navigator.clipboard?.writeText(m.body).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  const react = (e: MessageReaction | null) => (ev: { currentTarget: HTMLElement }) => { ev.currentTarget.blur(); onReact(e); };
  return (
    <div id={`msg-${m.id}`} className={`chat-row${mine ? ' mine' : ''}${first ? ' first' : ''}${flash ? ' flash' : ''}${active ? ' active' : ''}`} onClick={onActivate}>
      {!mine && <span className="chat-avatar">{first && <Avatar name={other.name} src={other.avatarUrl} color={other.coverColor ?? T.ink} size={36} />}</span>}
      <div className="chat-body">
        {m.automated && first && <span className="tag" style={{ background: T.surface, color: T.ink3, border: `1px solid ${T.line}` }}><Sparkles size={12} />Tin nhắn chào tự động</span>}
        <div className={`chat-bubble${big ? ' big' : ''}${m.recalled ? ' recalled' : ''}${m.pending ? ' pending' : ''}`}>
          {m.recalled ? 'Tin nhắn đã được thu hồi' : (
            <>
              {m.replyTo && (
                <button type="button" className="chat-quote" onClick={() => onJump(m.replyTo!.id)}>
                  <b>{m.replyTo.senderUserId === myId ? 'Bạn' : other.name}</b>
                  <span>{replySnippet(m.replyTo)}</span>
                </button>
              )}
              {m.imageUrl && <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" className="chat-image"><img src={m.imageUrl} alt="Ảnh trong tin nhắn" onLoad={onImageLoad} /></a>}
              {m.file && (
                <button type="button" className="chat-file" disabled={m.pending} aria-label={`Tải tệp ${m.file.name}, ${fileSizeLabel(m.file.sizeBytes)}`} title="Tải về" onClick={onDownload}>
                  <i><FileText size={22} /></i>
                  <span className="min-w-0"><b>{m.file.name}</b><span>{fileSizeLabel(m.file.sizeBytes)}</span></span>
                  <Download size={18} className="flex-shrink-0" />
                </button>
              )}
              {m.body && <RichText text={m.body} />}
            </>
          )}
        </div>
        {/* Hàng dưới bong bóng: giờ gửi, trạng thái, cảm xúc đã thả; rê chuột (hoặc chạm vào tin) thì hiện thêm nút thao tác và thanh cảm xúc. */}
        <div className="chat-meta">
          <span className="chat-time">{fmtTime(m.createdAt)}</span>
          {status && <span className="chat-status">{status !== 'Đang gửi' && <CheckCheck size={14} />}{status}</span>}
          {sum.total > 0 && <span className="chat-react-sum" aria-label={`${sum.total} lượt cảm xúc`}>{sum.emojis.slice(0, 3).join(' ')}{sum.total > 1 && <b>{sum.total}</b>}</span>}
          {canAct && (
            <>
              <span className="chat-actions">
                <button type="button" aria-label="Trả lời" title="Trả lời" onClick={onReply}><Quote size={16} /></button>
                {m.body && <button type="button" aria-label="Sao chép nội dung" title={copied ? 'Đã sao chép' : 'Sao chép'} onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>}
                {canRecall && <button type="button" aria-label="Thu hồi tin nhắn" title="Thu hồi" onClick={onRecall}><Undo2 size={16} /></button>}
              </span>
              <span className="chat-react-bar" role="group" aria-label="Chọn cảm xúc">
                {MESSAGE_REACTIONS.map((e) => <button key={e} type="button" aria-label={`Thả cảm xúc ${e}`} aria-pressed={myReaction === e} onClick={react(myReaction === e ? null : e)}>{e}</button>)}
                {myReaction && <button type="button" className="clear" aria-label="Gỡ cảm xúc của bạn" title="Gỡ cảm xúc" onClick={react(null)}><X size={16} /></button>}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function DayDivider({ date }: { date: string }) {
  const d = new Date(date);
  const today = new Date();
  const label = d.toDateString() === today.toDateString() ? 'Hôm nay' : d.toDateString() === new Date(today.getTime() - 86_400_000).toDateString() ? 'Hôm qua' : fmtDate(d);
  return <div className="chat-day"><span>{label}</span></div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <details className="chat-sec" open><summary>{title}<ChevronDown size={18} /></summary><div className="chat-sec-body">{children}</div></details>;
}

export interface InfoPanelProps { other: Person; panel: Panel | null; community: { slug: string; name: string } | null; pinned: boolean; archived: boolean; images: string[]; files: Array<MessageFile & { id: string }>; links: string[]; onPin: () => void; onArchive: () => void; onDownload: (messageId: string) => void; onClose: () => void }

/** Bảng "Thông tin hội thoại": hàng thao tác nhanh, thông tin thành viên, ảnh và link đã gửi trong hội thoại. */
export function InfoPanel({ other, panel, community, pinned, archived, images, files, links, onPin, onArchive, onDownload, onClose }: InfoPanelProps) {
  const [allImages, setAllImages] = useState(false);
  const shown = allImages ? images : images.slice(0, 9);
  return (
    <aside className="chat-info" aria-label="Thông tin hội thoại">
      <div className="chat-head justify-center">
        <span className="font-bold text-[16px]">Thông tin hội thoại</span>
        <button type="button" className="chat-icon chat-info-close" aria-label="Đóng thông tin hội thoại" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="chat-info-scroll">
        <div className="flex flex-col items-center gap-1.5 text-center px-4 pt-5 pb-4">
          <Avatar name={other.name} src={other.avatarUrl} color={other.coverColor ?? T.ink} size={72} />
          <div className="font-bold text-[17px] mt-1" style={{ overflowWrap: 'anywhere' }}>{other.name}</div>
          <div className="muted text-[14px]">@{other.handle}</div>
          {panel?.tier && <span className="tag" style={{ background: T.goldSoft, color: T.goldText }}>{panel.tier.name}{panel.tier.monthlyMinor ? ` · ${money(panel.tier.monthlyMinor)}/tháng` : ''}</span>}
          <div className="chat-quick">
            <button type="button" onClick={onPin}><i>{pinned ? <PinOff size={20} /> : <Pin size={20} />}</i>{pinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'}</button>
            <Link to={`/u/${other.handle}`}><i><User size={20} /></i>Xem hồ sơ</Link>
            {panel && community && <Link to={`/${community.slug}/thanh-vien?q=${encodeURIComponent(other.handle)}`}><i><Settings size={20} /></i>Quản lý thành viên</Link>}
            <button type="button" onClick={onArchive}><i>{archived ? <ArchiveRestore size={20} /> : <Archive size={20} />}</i>{archived ? 'Bỏ lưu trữ' : 'Lưu trữ hội thoại'}</button>
          </div>
        </div>
        {panel && (
          <Section title="Thông tin thành viên">
            <div className="flex flex-col gap-2.5 text-[14px]" style={{ color: T.ink2 }}>
              {community && <div className="flex items-start gap-2.5"><Users size={18} className="flex-shrink-0 mt-0.5" /><span>{community.name}</span></div>}
              <div className="flex items-start gap-2.5"><Calendar size={18} className="flex-shrink-0 mt-0.5" /><span>Tham gia {fmtDate(panel.joinedAt)}</span></div>
              {panel.learning && <div className="flex items-start gap-2.5"><BookOpen size={18} className="flex-shrink-0 mt-0.5" /><span>Đang học: {panel.learning.title} · {panel.learning.percent}%</span></div>}
              {panel.referrer && <div className="flex items-start gap-2.5"><Users size={18} className="flex-shrink-0 mt-0.5" /><span>Giới thiệu bởi {panel.referrer}</span></div>}
            </div>
          </Section>
        )}
        <Section title="Ảnh">
          {images.length === 0 ? <div className="muted text-[14px]">Chưa có ảnh nào trong hội thoại này</div> : (
            <>
              <div className="chat-media">{shown.map((src) => <a key={src} href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt="Ảnh đã gửi trong hội thoại" loading="lazy" /></a>)}</div>
              {images.length > 9 && <button type="button" className="btn btn-ghost btn-sm w-full mt-3" onClick={() => setAllImages((v) => !v)}>{allImages ? 'Thu gọn' : `Xem tất cả ${images.length} ảnh`}</button>}
            </>
          )}
        </Section>
        <Section title="Tệp">
          {files.length === 0 ? <div className="muted text-[14px]">Chưa có tệp nào trong hội thoại này</div> : (
            <div className="flex flex-col gap-2">
              {files.slice(0, 8).map((f) => <button key={f.id} type="button" className="chat-linkrow text-left" aria-label={`Tải tệp ${f.name}`} onClick={() => onDownload(f.id)}><i><FileText size={18} /></i><span className="min-w-0"><b>{f.name}</b><span>{fileSizeLabel(f.sizeBytes)}</span></span></button>)}
            </div>
          )}
        </Section>
        <Section title="Link">
          {links.length === 0 ? <div className="muted text-[14px]">Chưa có link nào trong hội thoại này</div> : (
            <div className="flex flex-col gap-2">
              {links.slice(0, 6).map((href) => <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="chat-linkrow"><i><Link2 size={18} /></i><span className="min-w-0"><b>{new URL(href).hostname}</b><span>{href}</span></span></a>)}
            </div>
          )}
        </Section>
      </div>
    </aside>
  );
}
