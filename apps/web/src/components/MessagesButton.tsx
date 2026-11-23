// Nút Tin nhắn ở đầu trang (AppShell, LearnerShell), cùng kiểu với nút chuông Thông báo: bấm vào thì mở bảng tin nhắn nổi
// ngay tại chỗ, không rời trang đang xem. Máy tính là bảng thả dưới nút, điện thoại là bảng trượt từ đáy lên.
// Bảng liệt kê các hội thoại (tìm theo tên, lọc Tất cả / Chưa đọc); chạm một hội thoại thì mở thẳng hội thoại đó ở trang
// /tin-nhan, nơi nhắn tin đầy đủ. Danh sách dùng chung bộ nhớ đệm với trang Tin nhắn (khóa ['conversations', lọc, từ khóa]).
import { Avatar, Chip, ErrorBox, Skeleton, T } from '@hoiminh/ui';
import { useQuery } from '@tanstack/react-query';
import { CheckCheck, MessageCircle, Pin, Search, SquareArrowOutUpRight, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { useBadges } from '@/lib/auth';
import { MESSAGES_PATH, conversationPath, convoPreview, messagesButtonLabel } from '@/lib/chat';
import { timeAgo } from '@/lib/format';
import { defaultPanelTab, unreadBadge } from '@/lib/notifications';
import { usePollInterval } from '@/lib/realtime';
import type { Conversation } from '@/pages/account/MessagesParts';
import { useHeaderPopover } from './use-header-popover';

type Tab = 'unread' | 'all';
interface ConvoList { items: Conversation[]; unreadConversations: number }

function Loading() {
  return (
    <div aria-busy="true" aria-label="Đang tải tin nhắn">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${T.line}` : undefined }}>
          <Skeleton h={48} w={48} className="rounded-full flex-shrink-0" />
          <div className="flex-grow flex flex-col gap-2"><Skeleton h={14} w="55%" /><Skeleton h={12} w="80%" /></div>
        </div>
      ))}
    </div>
  );
}

/** Một hội thoại trong bảng: chưa đọc có chấm, tên đậm, dòng xem trước đậm và số tin chưa đọc. */
function ConvoItem({ c }: { c: Conversation }) {
  const unread = c.unreadCount > 0;
  return (
    <Link to={conversationPath(c.id)} className={`msgpop-row${unread ? ' unread' : ''}`}>
      <span className="msgpop-dot" aria-hidden="true" />
      <Avatar name={c.other.name} src={c.other.avatarUrl} color={c.other.coverColor ?? T.ink} size={48} />
      <span className="flex-grow min-w-0 flex flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="msgpop-name flex-grow truncate">{c.other.name}</span>
          <span className="msgpop-time flex-shrink-0">{c.lastMessageAt ? timeAgo(c.lastMessageAt, true) : ''}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="msgpop-preview flex-grow truncate">{unread && <span className="sr-only">Chưa đọc. </span>}{convoPreview(c)}</span>
          {c.pinned && <Pin size={14} className="flex-shrink-0" style={{ color: T.ink3 }} aria-label="Đã ghim" />}
          {unread && <span className="chat-badge" aria-label={`${c.unreadCount} tin chưa đọc`}>{c.unreadCount > 99 ? '99+' : c.unreadCount}</span>}
        </span>
        {c.community && <span className="msgpop-community truncate">{c.community.name}</span>}
      </span>
    </Link>
  );
}

/** Phần trong của bảng. Chỉ được dựng khi bảng đang mở, nên danh sách chỉ tải lúc người dùng bấm nút. */
function Panel({ tab, setTab, onClose }: { tab: Tab; setTab: (t: Tab) => void; onClose: (toTrigger?: boolean) => void }) {
  const [search, setSearch] = useState('');
  const refetchInterval = usePollInterval(15_000);
  const q = useQuery({
    queryKey: ['conversations', tab, search],
    queryFn: () => api.get<ConvoList>(`/v1/me/conversations?filter=${tab}${search ? `&q=${encodeURIComponent(search)}` : ''}`),
    refetchInterval,
  });
  // Số trên mục Chưa đọc là số hội thoại còn tin chưa đọc (số trên nút là số tin).
  const unreadConvos = q.data?.unreadConversations;

  let body;
  if (q.isLoading) body = <Loading />;
  else if (q.isError) body = <div className="p-4"><ErrorBox message={errorMessage(q.error)} onRetry={() => void q.refetch()} /></div>;
  else if (!q.data?.items.length) {
    body = search ? (
      <div className="notif-empty">
        <span className="notif-empty-ic"><Search size={22} /></span>
        <div className="font-semibold text-[16px]" style={{ color: T.ink }}>Không có hội thoại nào khớp</div>
        <div className="text-[14px]" style={{ color: T.ink3 }}>Thử đổi từ khóa, hoặc tìm ở mục Tất cả.</div>
      </div>
    ) : tab === 'unread' ? (
      <div className="notif-empty">
        <span className="notif-empty-ic"><CheckCheck size={22} /></span>
        <div className="font-semibold text-[16px]" style={{ color: T.ink }}>Bạn đã đọc hết tin nhắn</div>
        <div className="text-[14px]" style={{ color: T.ink3 }}>Có tin nhắn mới thì số sẽ hiện trên nút Tin nhắn.</div>
        <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => setTab('all')}>Xem tất cả hội thoại</button>
      </div>
    ) : (
      <div className="notif-empty">
        <span className="notif-empty-ic"><MessageCircle size={22} /></span>
        <div className="font-semibold text-[16px]" style={{ color: T.ink }}>Chưa có tin nhắn</div>
        <div className="text-[14px]" style={{ color: T.ink3 }}>Nhắn cho thành viên từ trang hồ sơ hoặc danh sách thành viên.</div>
      </div>
    );
  } else body = q.data.items.map((c) => <ConvoItem key={c.id} c={c} />);

  return (
    <>
      <div className="notif-head">
        <div className="notif-head-top flex items-center gap-1 flex-wrap">
          <h2 className="notif-heading">Tin nhắn</h2>
          <span className="flex-grow" />
          <Link to={MESSAGES_PATH} className="notif-link-btn" onClick={() => onClose()}><SquareArrowOutUpRight size={18} />Mở trang Tin nhắn</Link>
          <button type="button" className="notif-close" aria-label="Đóng tin nhắn" onClick={() => onClose(true)}><X size={22} /></button>
        </div>
        <label className="input msgpop-search"><Search size={18} style={{ color: T.ink3 }} /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên" aria-label="Tìm hội thoại theo tên" className="flex-grow min-w-0" /></label>
        <div className="flex items-center gap-2">
          <Chip on={tab === 'all'} aria-pressed={tab === 'all'} onClick={() => setTab('all')}>Tất cả</Chip>
          <Chip on={tab === 'unread'} aria-pressed={tab === 'unread'} onClick={() => setTab('unread')}>Chưa đọc{unreadConvos ? ` · ${unreadConvos}` : ''}</Chip>
        </div>
      </div>
      <div className="notif-list">{body}</div>
      <div className="notif-foot"><Link to={MESSAGES_PATH} onClick={() => onClose()}>Xem tất cả tin nhắn</Link></div>
    </>
  );
}

export function MessagesButton() {
  const badges = useBadges();
  const [tab, setTab] = useState<Tab>('all');
  const { open, setOpen, close, wrap, trigger, panel } = useHeaderPopover();
  const count = badges.data?.unreadMessages ?? 0;
  const badge = unreadBadge(count);

  // Như nút chuông: còn tin chưa đọc thì mở vào "Chưa đọc", hết rồi thì vào "Tất cả".
  const toggle = () => { if (!open) setTab(defaultPanelTab(count)); setOpen((v) => !v); };

  return (
    <div ref={wrap} className="notif-wrap">
      <button ref={trigger} type="button" aria-label={messagesButtonLabel(count)} aria-haspopup="dialog" aria-expanded={open} onClick={toggle} className="relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ color: T.ink2, border: `1px solid ${T.line2}`, background: T.surface }}>
        <MessageCircle size={20} />
        {badge && <span className="notif-count" aria-hidden="true">{badge}</span>}
      </button>
      {open && (
        <>
          {/* Nền mờ chỉ có trên điện thoại. Lối đóng cho bàn phím và trình đọc màn hình là nút X trong bảng và phím Esc. */}
          <div className="notif-backdrop" aria-hidden="true" onClick={() => close()} />
          <div ref={panel} role="dialog" aria-label="Tin nhắn" tabIndex={-1} className="notif-panel">
            <Panel tab={tab} setTab={setTab} onClose={close} />
          </div>
        </>
      )}
    </div>
  );
}
