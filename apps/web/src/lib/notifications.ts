// Logic thuần của phần thông báo, dùng chung cho bảng nổi ở nút chuông và trang /thong-bao:
// nhãn số trên chuông, đích của một thông báo, ghép danh sách để cái chưa đọc đứng trước, và cập nhật bộ nhớ đệm
// ngay khi đánh dấu đã đọc. Không đụng tới React hay mạng nên test được trên Node.

export interface Notif {
  id: string;
  kind: string;
  category: string;
  title: string;
  body: string | null;
  link: string | null;
  actionLabel: string | null;
  readAt: string | null;
  createdAt: string;
  actor: { name: string; avatarUrl: string | null; coverColor: string | null } | null;
  community: { name: string; slug: string } | null;
}
export interface NotifList { items: Notif[]; nextCursor: string | null; unreadCount: number }
export type NotifFilter = 'all' | 'unread' | 'mention' | 'affiliate' | 'system';
/** Dữ liệu của một danh sách phân trang cursor trong bộ nhớ đệm (cùng hình với InfiniteData của TanStack Query). */
export interface NotifPages { pages: NotifList[]; pageParams: unknown[] }

export const NOTIFICATIONS_PATH = '/thong-bao';
/** Neo của phần cài đặt trên trang Thông báo: nút bánh răng ở bảng nổi dẫn tới đây. */
export const SETTINGS_ANCHOR = 'cai-dat';
export const NOTIFICATION_SETTINGS_PATH = `${NOTIFICATIONS_PATH}#${SETTINGS_ANCHOR}`;

/** Số hiện trên nút chuông: không còn gì chưa đọc thì không hiện, quá 9 thì "9+". */
export function unreadBadge(count: number | null | undefined): string | null {
  const n = Math.floor(Number(count ?? 0));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 9 ? '9+' : String(n);
}

/** Nhãn đọc cho trình đọc màn hình của nút chuông, kèm số chưa đọc thật (không rút gọn thành "9+"). */
export function bellLabel(count: number | null | undefined): string {
  const n = Math.floor(Number(count ?? 0));
  return Number.isFinite(n) && n > 0 ? `Thông báo, ${n} chưa đọc` : 'Thông báo';
}

/** Mở bảng nổi thì vào mục nào trước: còn cái chưa đọc thì "Chưa đọc", hết rồi thì "Tất cả". */
export function defaultPanelTab(unreadCount: number | null | undefined): 'unread' | 'all' {
  return unreadBadge(unreadCount) ? 'unread' : 'all';
}

/**
 * Đích của một thông báo: đường dẫn trong ứng dụng để chuyển tới khi bấm. Thông báo không có link, hoặc link không phải
 * đường dẫn nội bộ (địa chỉ ngoài, "//máy-khác", "javascript:") thì không có đích: bấm vào chỉ đánh dấu đã đọc.
 */
export function notificationTarget(n: Pick<Notif, 'link'>): string | null {
  const link = n.link?.trim();
  if (!link || !link.startsWith('/') || link.startsWith('//') || link.includes('\\')) return null;
  return link;
}

/** Cùng thứ tự với máy chủ: mới nhất trước, cùng thời điểm thì id lớn hơn trước. */
const newestFirst = (a: Notif, b: Notif): number => {
  const ta = Date.parse(a.createdAt) || 0;
  const tb = Date.parse(b.createdAt) || 0;
  return ta === tb ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : tb - ta;
};

/** Tách thành chưa đọc và đã đọc, mỗi phần mới nhất đứng trước. */
export function splitByRead(items: Notif[]): { unread: Notif[]; read: Notif[] } {
  const unread = items.filter((n) => !n.readAt).sort(newestFirst);
  const read = items.filter((n) => n.readAt).sort(newestFirst);
  return { unread, read };
}

/**
 * Ghép danh sách "chưa đọc" với danh sách "tất cả" thành một danh sách: cái chưa đọc đứng trước, cái đã đọc đứng sau,
 * mỗi phần mới nhất trước, mỗi thông báo chỉ hiện một lần. Hai danh sách tải ở hai thời điểm nên có thể lệch nhau: một
 * thông báo đã đọc ở bên nào thì coi là đã đọc (không có thao tác nào đưa thông báo về lại chưa đọc).
 */
export function mergeUnreadFirst(unread: Notif[], all: Notif[]): Notif[] {
  const byId = new Map<string, Notif>();
  for (const n of [...unread, ...all]) {
    const seen = byId.get(n.id);
    if (!seen || (!seen.readAt && n.readAt)) byId.set(n.id, n);
  }
  const parts = splitByRead([...byId.values()]);
  return [...parts.unread, ...parts.read];
}

/** Nhóm theo ngày cho phần đã đọc ở trang Thông báo. */
export function dayGroup(at: string, now: Date = new Date()): string {
  const d = new Date(at);
  const diff = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  return diff <= 0 ? 'Hôm nay' : diff === 1 ? 'Hôm qua' : diff < 7 ? 'Tuần này' : 'Trước đó';
}

export interface NotifSection { key: string; label: string; items: Notif[] }

/**
 * Chia danh sách thành các khối để hiện: khối "Chưa đọc" đứng đầu (nếu có), rồi phần đã đọc. `byDay` thì phần đã đọc
 * chia tiếp theo ngày (trang Thông báo); không thì gom một khối "Đã đọc" (bảng nổi, vốn ngắn).
 */
export function notifSections(items: Notif[], opts: { byDay?: boolean; now?: Date } = {}): NotifSection[] {
  const { unread, read } = splitByRead(items);
  const out: NotifSection[] = [];
  if (unread.length > 0) out.push({ key: 'unread', label: 'Chưa đọc', items: unread });
  if (!opts.byDay) {
    if (read.length > 0) out.push({ key: 'read', label: 'Đã đọc', items: read });
    return out;
  }
  for (const n of read) {
    const label = dayGroup(n.createdAt, opts.now);
    const last = out.at(-1);
    if (last && last.key === `read:${label}`) last.items.push(n);
    else out.push({ key: `read:${label}`, label, items: [n] });
  }
  return out;
}

/** Số chưa đọc sau khi đánh dấu đã đọc: có `id` là đọc một cái (chỉ gọi cho cái đang chưa đọc), không có là đọc hết. */
export function unreadAfterRead(count: number, id?: string): number {
  return id ? Math.max(0, count - 1) : 0;
}

/**
 * Cập nhật một danh sách trong bộ nhớ đệm ngay khi bấm đánh dấu đã đọc, không chờ máy chủ trả lời: thông báo được đọc
 * nhận `readAt`, số chưa đọc giảm theo. Riêng danh sách lọc "chưa đọc" thì bỏ hẳn cái vừa đọc ra. Con trỏ phân trang
 * giữ nguyên, nên bấm "Tải thêm" sau đó vẫn tải đúng trang kế.
 */
export function applyRead<D extends NotifPages>(data: D | undefined, filter: NotifFilter, id: string | undefined, at: string): D | undefined {
  if (!data) return data;
  const hit = (n: Notif) => !n.readAt && (id === undefined || n.id === id);
  // `unreadCount` là số chưa đọc của cả tài khoản (không theo bộ lọc), nên danh sách nào cũng trừ như nhau.
  const pages = data.pages.map((p) => ({
    ...p,
    items: filter === 'unread' ? p.items.filter((n) => !hit(n)) : p.items.map((n) => (hit(n) ? { ...n, readAt: at } : n)),
    unreadCount: unreadAfterRead(p.unreadCount, id),
  }));
  return { ...data, pages };
}
