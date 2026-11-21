// Một dòng thông báo, dùng chung cho bảng nổi ở nút chuông và trang /thong-bao để hai nơi trình bày như nhau:
// chưa đọc có chấm, chữ đậm và nút "Đánh dấu đã đọc"; đã đọc thì chữ nhạt hơn. Kiểu dáng ở styles.css (.notif-row).
import { Avatar, T } from '@hoiminh/ui';
import { AtSign, Bell, Calendar, Check, CircleDollarSign, Heart, Megaphone, MessageCircle, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { timeAgo } from '@/lib/format';
import { notificationTarget, type Notif } from '@/lib/notifications';

const ICON: Record<string, [ReactNode, string, string]> = { comment: [<MessageCircle size={12} key="c" />, T.tealSoft, T.tealText], affiliate: [<CircleDollarSign size={12} key="d" />, T.goldSoft, T.goldText], mention: [<AtSign size={12} key="a" />, T.accentSoft, T.accentText], event: [<Calendar size={12} key="e" />, T.tealSoft, T.tealText], payment: [<UserPlus size={12} key="u" />, T.goldSoft, T.goldText], post: [<Megaphone size={12} key="m" />, T.accentSoft, T.accentText], like: [<Heart size={12} key="h" />, T.accentSoft, T.accentText], system: [<Bell size={12} key="b" />, T.bg, T.ink2] };

/**
 * `onOpen` chạy khi bấm vào dòng (nơi gọi đánh dấu đã đọc, đóng bảng nổi nếu có); có đích thì dòng là link nên trình duyệt
 * tự chuyển trang. `onMarkRead` là nút nhỏ bên phải của dòng chưa đọc: đọc mà không phải mở. `showAction` hiện nhãn
 * hành động ("Xem ví", "Duyệt") trên máy tính, dành cho trang đầy đủ.
 */
export function NotificationRow({ n, onOpen, onMarkRead, showAction }: { n: Notif; onOpen: () => void; onMarkRead: () => void; showAction?: boolean }) {
  const [icon, bg, fg] = ICON[n.category] ?? ICON.system!;
  const unread = !n.readAt;
  const target = notificationTarget(n);
  const inner = (
    <>
      <span className="notif-dot" aria-hidden="true" />
      <span className="relative flex-shrink-0 notif-avatar">
        <Avatar name={n.actor?.name ?? 'HM'} src={n.actor?.avatarUrl} color={n.actor?.coverColor ?? T.ink3} size={40} />
        <span className="absolute -right-1.5 -bottom-1.5 w-[22px] h-[22px] rounded-full inline-flex items-center justify-center" style={{ background: bg, color: fg, border: `2px solid ${T.surface}` }}>{icon}</span>
      </span>
      <span className="flex-grow min-w-0 flex flex-col gap-0.5">
        <span className="notif-title">{n.title}{n.body ? <span className="notif-body">: {n.body}</span> : null}</span>
        <span className="notif-meta">{unread && <span className="sr-only">Chưa đọc. </span>}{[timeAgo(n.createdAt), n.community?.name].filter(Boolean).join(' · ')}</span>
      </span>
      {showAction && n.actionLabel && target && <span className="btn btn-ghost btn-sm flex-shrink-0 hide-mobile">{n.actionLabel}</span>}
    </>
  );
  return (
    <div className={`notif-row${unread ? ' unread' : ''}`}>
      {target
        ? <Link to={target} className="notif-row-main" onClick={onOpen}>{inner}</Link>
        : <button type="button" className="notif-row-main" onClick={onOpen}>{inner}</button>}
      {unread && <button type="button" className="notif-row-read" aria-label="Đánh dấu đã đọc" title="Đánh dấu đã đọc" onClick={onMarkRead}><span><Check size={18} /></span></button>}
    </div>
  );
}
