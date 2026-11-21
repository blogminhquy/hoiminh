// Thông báo (notificationsMain): nơi xem đầy đủ và cài đặt. Chip lọc, danh sách với cái chưa đọc đứng đầu rồi phần đã đọc
// chia theo ngày, đánh dấu đã đọc; rail cài đặt nhanh + theo cộng đồng (neo #cai-dat, nút "Cài đặt" của bảng nổi ở chuông dẫn tới).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Chip, CommunityMark, Select, T, Toggle } from '@hoiminh/ui';
import { AtSign, Bell, BellOff, CheckCheck, Heart, Mail, Settings } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { NotificationRow } from '@/components/NotificationRow';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { SETTINGS_ANCHOR, mergeUnreadFirst, notifSections, type NotifFilter, type NotifList } from '@/lib/notifications';
import { disablePush, enablePush, pushEnabledHere, pushPermission, pushSupported } from '@/lib/pwa';
import { useMarkRead, useNotificationPages } from '@/lib/use-notifications';

interface Prefs { emailDigest: boolean; push: boolean; likes: boolean; perCommunity: Record<string, 'all' | 'mentions' | 'off'> }
const FILTERS: Array<[NotifFilter, string]> = [['all', 'Tất cả'], ['unread', 'Chưa đọc'], ['mention', 'Nhắc đến'], ['affiliate', 'Affiliate'], ['system', 'Hệ thống']];

/**
 * Dòng "Đẩy trên điện thoại". Thông báo đẩy gắn với từng thiết bị: bật ở đây là xin quyền của trình duyệt và đăng ký
 * thiết bị này; tắt là gỡ thiết bị này và ngừng đẩy cho tài khoản. Thiết bị không nhận được thì nói rõ vì sao.
 */
function PushRow({ on, save }: { on: boolean; save: (v: boolean) => void }) {
  const { app } = useAuth();
  const [here, setHere] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { void pushEnabledHere().then(setHere, () => setHere(false)); }, []);
  const available = app.push.enabled && Boolean(app.push.publicKey) && pushSupported();
  const why = !app.push.enabled ? 'Hệ thống chưa bật thông báo đẩy.'
    : !pushSupported() ? 'Trình duyệt này chưa nhận được thông báo đẩy. Trên iPhone, hãy thêm Hội Mình vào màn hình chính rồi mở từ biểu tượng đó.'
    : pushPermission() === 'denied' ? 'Bạn đã chặn thông báo của Hội Mình trên trình duyệt này. Mở cài đặt của trình duyệt để cho phép lại.'
    : on && here === false ? 'Thiết bị này chưa bật. Gạt lại công tắc để bật trên thiết bị này.'
    : null;
  const change = async (v: boolean) => {
    setNote(null);
    if (!v) { setBusy(true); await disablePush().catch(() => null); setBusy(false); setHere(false); save(false); return; }
    setBusy(true);
    const r = await enablePush(app.push.publicKey!).catch(() => 'denied' as const);
    setBusy(false);
    if (r === 'enabled') { setHere(true); save(true); setNote('Đã bật trên thiết bị này.'); } else setNote(r === 'denied' ? 'Chưa bật được vì trình duyệt không cho phép thông báo.' : 'Thiết bị này chưa nhận được thông báo đẩy.');
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5 text-[14px]"><span style={{ color: T.ink2 }}><Bell size={16} /></span><span className="flex-grow">Đẩy trên điện thoại</span><Toggle on={on && here === true} label="Đẩy trên điện thoại" disabled={busy || !available || pushPermission() === 'denied'} onChange={(v) => void change(v)} /></div>
      {(note ?? why) && <span className="text-[13px]" role="status" style={{ color: T.ink3, paddingLeft: 26 }}>{note ?? why}</span>}
    </div>
  );
}

export default function Page() {
  const qc = useQueryClient();
  const location = useLocation();
  const { communities } = useAuth();
  const [filter, setFilter] = useState<NotifFilter>('all');
  // Phân trang theo cursor: trước đây chỉ đọc trang đầu, quá 30 thông báo là không xem được nữa.
  const pages = useNotificationPages(filter);
  // Ở "Tất cả", cái chưa đọc phải đứng đầu kể cả khi đã cũ (nằm ngoài các trang đang tải), nên tải thêm danh sách
  // "chưa đọc" rồi ghép lại, đúng cách bảng nổi ở chuông đang làm.
  const unreadPages = useNotificationPages('unread', filter === 'all');
  const withUnread = filter === 'all';
  const loaded = pages.data?.pages.flatMap((p) => p.items);
  const items = loaded ? mergeUnreadFirst(withUnread ? unreadPages.data?.pages.flatMap((p) => p.items) ?? [] : [], loaded) : undefined;
  const hasMore = Boolean(pages.hasNextPage || (withUnread && unreadPages.hasNextPage));
  const loadingMore = pages.isFetchingNextPage || (withUnread && unreadPages.isFetchingNextPage);
  const loadMore = () => { if (pages.hasNextPage) void pages.fetchNextPage(); if (withUnread && unreadPages.hasNextPage) void unreadPages.fetchNextPage(); };
  const q = { ...pages, isLoading: pages.isLoading || (withUnread && unreadPages.isLoading), data: items ? { items, nextCursor: pages.data?.pages.at(-1)?.nextCursor ?? null, unreadCount: pages.data?.pages[0]?.unreadCount ?? 0 } : undefined } as unknown as UseQueryResult<NotifList>;
  const prefs = useQuery({ queryKey: ['notification-prefs'], queryFn: () => api.get<Prefs>('/v1/me/notifications/prefs') });
  const read = useMarkRead();
  const savePrefs = useMutation({ mutationFn: (p: Partial<Prefs>) => api.put<Prefs>('/v1/me/notifications/prefs', p), onSuccess: (d) => qc.setQueryData(['notification-prefs'], d) });
  const p = prefs.data;

  // Vào bằng /thong-bao#cai-dat (nút "Cài đặt" của bảng nổi): cuộn tới phần cài đặt. Trên điện thoại phần này nằm dưới
  // danh sách, mà danh sách tải xong mới đủ chiều cao, nên cuộn thêm một lần sau khi tải xong rồi thôi (đổi bộ lọc về
  // sau không kéo người dùng xuống lại).
  const settings = useRef<HTMLElement>(null);
  const scrolledFor = useRef('');
  const listLoading = q.isLoading;
  useEffect(() => {
    if (location.hash !== `#${SETTINGS_ANCHOR}` || scrolledFor.current === location.key) return;
    settings.current?.scrollIntoView({ block: 'start' });
    settings.current?.focus({ preventScroll: true });
    if (!listLoading) scrolledFor.current = location.key;
  }, [location.hash, location.key, listLoading]);

  return (
    <div className="two-col">
      <div className="main flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="serif m-0 text-[28px] font-extrabold">Thông báo</h1>
          <div className="flex gap-2 flex-wrap md:ml-3">{FILTERS.map(([k, l]) => <Chip key={k} on={filter === k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}{k === 'unread' && q.data?.unreadCount ? ` · ${q.data.unreadCount}` : ''}</Chip>)}</div>
          <span className="flex-grow" />
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => read.mutate(undefined)} disabled={!q.data?.unreadCount || read.isPending}><CheckCheck size={14} />Đánh dấu tất cả đã đọc</button>
            {/* Bố cục một cột (điện thoại, máy tính bảng): phần cài đặt nằm dưới danh sách, nút này đưa xuống đó. */}
            <Link to={`#${SETTINGS_ANCHOR}`} className="btn btn-ghost btn-sm notif-settings-jump" aria-label="Cài đặt thông báo"><Settings size={16} />Cài đặt</Link>
          </div>
        </div>
        <QueryState q={q} rows={5} isEmpty={(d) => d.items.length === 0} empty={filter === 'unread' ? { title: 'Bạn đã đọc hết thông báo', hint: 'Bấm "Tất cả" để xem lại các thông báo đã đọc' } : { title: 'Không có thông báo', hint: 'Bình luận, nhắc đến, hoa hồng và sự kiện sẽ hiện ở đây' }}>
          {(d) => (
            <div className="card overflow-hidden">
              {notifSections(d.items, { byDay: true }).map((s) => (
                <section key={s.key} aria-label={s.label}>
                  <div className="th" style={{ padding: '12px 20px 8px' }}>{s.label}</div>
                  {s.items.map((n) => <NotificationRow key={n.id} n={n} showAction onOpen={() => { if (!n.readAt) read.mutate(n.id); }} onMarkRead={() => read.mutate(n.id)} />)}
                </section>
              ))}
              {hasMore && <div className="flex justify-center py-3" style={{ borderTop: `1px solid ${T.line}` }}><button type="button" className="btn btn-ghost btn-sm" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Đang tải…' : 'Tải thêm'}</button></div>}
            </div>
          )}
        </QueryState>
      </div>
      <aside ref={settings} id={SETTINGS_ANCHOR} tabIndex={-1} aria-label="Cài đặt thông báo" className="rail flex flex-col gap-4" style={{ scrollMarginTop: 16, outline: 0 }}>
        <div className="card p-4 flex flex-col gap-3">
          <div className="font-semibold">Cài đặt nhanh</div>
          {p && ([['emailDigest', <Mail size={16} key="m" />, 'Email tổng hợp mỗi sáng'], ['likes', <Heart size={16} key="h" />, 'Báo khi có lượt thích']] as Array<['emailDigest' | 'likes', ReactNode, string]>).map(([k, ic, l]) => <div key={k} className="flex items-center gap-2.5 text-[14px]"><span style={{ color: T.ink2 }}>{ic}</span><span className="flex-grow">{l}</span><Toggle on={p[k]} label={l} onChange={(v) => savePrefs.mutate({ [k]: v })} /></div>)}
          {p && <PushRow on={p.push} save={(v) => savePrefs.mutate({ push: v })} />}
        </div>
        <div className="card p-4 flex flex-col gap-2.5">
          <div className="font-semibold">Theo cộng đồng</div>
          {communities.map((c) => { const lvl = p?.perCommunity[c.id] ?? 'all'; return (
            <div key={c.id} className="flex flex-col gap-2 text-[14px]" style={{ paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
              {/* Tên hội hiện đủ, dài thì xuống dòng; ô chọn mức thông báo nằm riêng một dòng bên dưới. */}
              <div className="flex items-start gap-2.5">
                <CommunityMark mark={c.logoMark} color={c.logoColor} url={c.logoUrl} size={32} radius={9} />
                <span className="flex-grow min-w-0 font-semibold leading-[1.4]" style={{ overflowWrap: 'anywhere', paddingTop: 5 }}>{c.name}</span>
                <span className="flex-shrink-0" style={{ color: lvl === 'off' ? T.ink3 : T.ink2, paddingTop: 7 }}>{lvl === 'off' ? <BellOff size={18} /> : lvl === 'mentions' ? <AtSign size={18} /> : <Bell size={18} />}</span>
              </div>
              <Select value={lvl} aria-label={`Thông báo từ ${c.name}`} onChange={(e) => savePrefs.mutate({ perCommunity: { [c.id]: e.target.value as 'all' | 'mentions' | 'off' } })}><option value="all">Tất cả thông báo</option><option value="mentions">Chỉ khi nhắc đến tôi</option><option value="off">Tắt thông báo</option></Select>
            </div>
          ); })}
          {communities.length === 0 && <span className="muted text-[13px]">Bạn chưa tham gia hội nào.</span>}
          <span className="muted text-[12px]">Cập nhật lần cuối {p ? fmtDate(new Date()) : '…'}</span>
        </div>
      </aside>
    </div>
  );
}
