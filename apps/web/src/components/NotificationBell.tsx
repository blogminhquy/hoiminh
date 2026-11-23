// Nút chuông ở đầu trang (dùng chung cho AppShell, LearnerShell, WorkspaceShell). Bấm vào thì mở bảng thông báo nổi ngay
// tại chỗ, không rời trang đang xem: máy tính là bảng thả dưới nút chuông, điện thoại là bảng trượt từ đáy lên.
// Trang /thong-bao vẫn còn, là nơi xem đầy đủ và cài đặt (nút "Cài đặt" của bảng dẫn tới đó). Cách mở, đóng bảng dùng chung
// với nút Tin nhắn (use-header-popover.ts).
import { Chip, ErrorBox, Skeleton, T } from '@hoiminh/ui';
import { Bell, CheckCheck, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '@/lib/api';
import { useBadges } from '@/lib/auth';
import { NOTIFICATIONS_PATH, NOTIFICATION_SETTINGS_PATH, bellLabel, defaultPanelTab, mergeUnreadFirst, notificationTarget, notifSections, unreadBadge, type Notif } from '@/lib/notifications';
import { useMarkRead, useNotificationPages } from '@/lib/use-notifications';
import { NotificationRow } from './NotificationRow';
import { useHeaderPopover } from './use-header-popover';

type Tab = 'unread' | 'all';

function Loading() {
  return (
    <div aria-busy="true" aria-label="Đang tải thông báo">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5" style={{ borderTop: i ? `1px solid ${T.line}` : undefined }}>
          <Skeleton h={40} w={40} className="rounded-full flex-shrink-0" />
          <div className="flex-grow flex flex-col gap-2"><Skeleton h={14} w="85%" /><Skeleton h={12} w="40%" /></div>
        </div>
      ))}
    </div>
  );
}

/** Phần trong của bảng. Chỉ được dựng khi bảng đang mở, nên danh sách chỉ tải lúc người dùng bấm chuông. */
function Panel({ tab, setTab, badgeCount, onClose, refocus }: { tab: Tab; setTab: (t: Tab) => void; badgeCount: number; onClose: (toBell?: boolean) => void; refocus: () => void }) {
  // Hai danh sách có sẵn của API: "chưa đọc" và "tất cả". Mục Tất cả ghép hai danh sách để cái chưa đọc đứng trước,
  // kể cả cái chưa đọc đã cũ, nằm ngoài trang đầu của danh sách "tất cả".
  const unreadQ = useNotificationPages('unread');
  const allQ = useNotificationPages('all');
  const read = useMarkRead();
  const unreadItems = unreadQ.data?.pages.flatMap((p) => p.items) ?? [];
  const allItems = allQ.data?.pages.flatMap((p) => p.items) ?? [];
  const count = unreadQ.data?.pages[0]?.unreadCount ?? allQ.data?.pages[0]?.unreadCount ?? badgeCount;

  const row = (n: Notif) => (
    <NotificationRow
      key={n.id}
      n={n}
      onOpen={() => { if (!n.readAt) read.mutate(n.id); if (notificationTarget(n)) onClose(); }}
      // Dòng vừa đọc có thể rời khỏi danh sách: đưa tiêu điểm về bảng để bàn phím không bị rơi ra ngoài.
      onMarkRead={() => { read.mutate(n.id); refocus(); }}
    />
  );
  // "Tải thêm" ở mục Tất cả tải trang kế của cả hai danh sách, để cái chưa đọc cũ hơn nữa cũng lên đầu.
  const more = (qs: Array<typeof allQ>) => qs.some((q) => q.hasNextPage) && (
    <div className="flex justify-center py-2" style={{ borderTop: `1px solid ${T.line}` }}>
      <button type="button" className="notif-link-btn" disabled={qs.some((q) => q.isFetchingNextPage)} onClick={() => { for (const q of qs) if (q.hasNextPage) void q.fetchNextPage(); }}>{qs.some((q) => q.isFetchingNextPage) ? 'Đang tải…' : 'Tải thêm'}</button>
    </div>
  );

  let body;
  if (tab === 'unread') {
    if (unreadQ.isLoading) body = <Loading />;
    else if (unreadQ.isError) body = <div className="p-4"><ErrorBox message={errorMessage(unreadQ.error)} onRetry={() => void unreadQ.refetch()} /></div>;
    else if (unreadItems.length === 0) {
      body = (
        <div className="notif-empty">
          <span className="notif-empty-ic"><CheckCheck size={22} /></span>
          <div className="font-semibold text-[16px]" style={{ color: T.ink }}>Bạn đã đọc hết thông báo</div>
          <div className="text-[14px]" style={{ color: T.ink3 }}>Có thông báo mới thì số sẽ hiện trên chuông.</div>
          <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => setTab('all')}>Xem thông báo đã đọc</button>
        </div>
      );
    } else body = <>{unreadItems.map(row)}{more([unreadQ])}</>;
  } else if (allQ.isLoading || unreadQ.isLoading) body = <Loading />;
  else if (allQ.isError) body = <div className="p-4"><ErrorBox message={errorMessage(allQ.error)} onRetry={() => void allQ.refetch()} /></div>;
  else {
    const sections = notifSections(mergeUnreadFirst(unreadItems, allItems));
    body = sections.length === 0 ? (
      <div className="notif-empty">
        <span className="notif-empty-ic"><Bell size={22} /></span>
        <div className="font-semibold text-[16px]" style={{ color: T.ink }}>Chưa có thông báo nào</div>
        <div className="text-[14px]" style={{ color: T.ink3 }}>Bình luận, nhắc đến, hoa hồng và sự kiện sẽ hiện ở đây.</div>
      </div>
    ) : (
      <>
        {sections.map((s) => <section key={s.key} aria-label={s.label}><div className="notif-section">{s.label}</div>{s.items.map(row)}</section>)}
        {more([allQ, unreadQ])}
      </>
    );
  }

  return (
    <>
      <div className="notif-head">
        <div className="notif-head-top flex items-center gap-1 flex-wrap">
          <h2 className="notif-heading">Thông báo</h2>
          <span className="flex-grow" />
          <button type="button" className="notif-link-btn" disabled={!count || read.isPending} onClick={() => { read.mutate(undefined); refocus(); }}><CheckCheck size={18} />Đánh dấu tất cả đã đọc</button>
          <button type="button" className="notif-close" aria-label="Đóng thông báo" onClick={() => onClose(true)}><X size={22} /></button>
        </div>
        <div className="flex items-center gap-2">
          <Chip on={tab === 'unread'} aria-pressed={tab === 'unread'} onClick={() => setTab('unread')}>Chưa đọc{count ? ` · ${count}` : ''}</Chip>
          <Chip on={tab === 'all'} aria-pressed={tab === 'all'} onClick={() => setTab('all')}>Tất cả</Chip>
          <span className="flex-grow" />
          <Link to={NOTIFICATION_SETTINGS_PATH} className="notif-link-btn" aria-label="Cài đặt thông báo" title="Cài đặt thông báo" onClick={() => onClose()}><Settings size={18} />Cài đặt</Link>
        </div>
      </div>
      <div className="notif-list">{body}</div>
      <div className="notif-foot"><Link to={NOTIFICATIONS_PATH} onClick={() => onClose()}>Xem tất cả thông báo</Link></div>
    </>
  );
}

export function NotificationBell() {
  const badges = useBadges();
  const [tab, setTab] = useState<Tab>('all');
  const { open, setOpen, close, wrap, trigger: bell, panel } = useHeaderPopover();
  const count = badges.data?.unreadNotifications ?? 0;
  const badge = unreadBadge(count);

  // Mỗi lần mở chọn lại mục: còn cái chưa đọc thì vào "Chưa đọc", hết rồi thì vào "Tất cả".
  const toggle = () => { if (!open) setTab(defaultPanelTab(count)); setOpen((v) => !v); };

  return (
    <div ref={wrap} className="notif-wrap">
      <button ref={bell} type="button" aria-label={bellLabel(count)} aria-haspopup="dialog" aria-expanded={open} onClick={toggle} className="relative w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ color: T.ink2, border: `1px solid ${T.line2}`, background: T.surface }}>
        <Bell size={20} />
        {badge && <span className="notif-count" aria-hidden="true">{badge}</span>}
      </button>
      {open && (
        <>
          {/* Nền mờ chỉ có trên điện thoại. Lối đóng cho bàn phím và trình đọc màn hình là nút X trong bảng và phím Esc. */}
          <div className="notif-backdrop" aria-hidden="true" onClick={() => close()} />
          <div ref={panel} role="dialog" aria-label="Thông báo" tabIndex={-1} className="notif-panel">
            <Panel tab={tab} setTab={setTab} badgeCount={count} onClose={close} refocus={() => panel.current?.focus()} />
          </div>
        </>
      )}
    </div>
  );
}
