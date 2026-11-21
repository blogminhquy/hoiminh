import { describe, expect, it } from 'vitest';
import { NOTIFICATION_SETTINGS_PATH, applyRead, bellLabel, dayGroup, defaultPanelTab, mergeUnreadFirst, notifSections, notificationTarget, splitByRead, unreadAfterRead, unreadBadge, type Notif, type NotifPages } from './notifications';

const n = (id: string, createdAt: string, readAt: string | null = null, over: Partial<Notif> = {}): Notif => ({ id, kind: 'comment.created', category: 'comment', title: `Thông báo ${id}`, body: null, link: null, actionLabel: null, readAt, createdAt, actor: null, community: null, ...over });
const ids = (list: Notif[]) => list.map((x) => x.id);
const READ = '2026-11-20T00:00:00.000Z';

describe('unreadBadge', () => {
  it('không còn gì chưa đọc thì không hiện số', () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(undefined)).toBeNull();
    expect(unreadBadge(null)).toBeNull();
    expect(unreadBadge(-3)).toBeNull();
    expect(unreadBadge(Number.NaN)).toBeNull();
  });

  it('từ 1 đến 9 hiện đúng số, quá 9 thì "9+"', () => {
    expect(unreadBadge(1)).toBe('1');
    expect(unreadBadge(9)).toBe('9');
    expect(unreadBadge(10)).toBe('9+');
    expect(unreadBadge(248)).toBe('9+');
  });
});

describe('bellLabel và defaultPanelTab', () => {
  it('nhãn của nút chuông đọc số thật, không rút gọn', () => {
    expect(bellLabel(0)).toBe('Thông báo');
    expect(bellLabel(undefined)).toBe('Thông báo');
    expect(bellLabel(3)).toBe('Thông báo, 3 chưa đọc');
    expect(bellLabel(27)).toBe('Thông báo, 27 chưa đọc');
  });

  it('còn cái chưa đọc thì mở mục Chưa đọc, hết rồi thì mở Tất cả', () => {
    expect(defaultPanelTab(2)).toBe('unread');
    expect(defaultPanelTab(0)).toBe('all');
    expect(defaultPanelTab(undefined)).toBe('all');
  });
});

describe('notificationTarget', () => {
  it('link nội bộ là đích, giữ cả tham số và neo', () => {
    expect(notificationTarget({ link: '/kinh-doanh/bai-viet/p1' })).toBe('/kinh-doanh/bai-viet/p1');
    expect(notificationTarget({ link: ' /tai-khoan/cong-su?tab=vi#rut ' })).toBe('/tai-khoan/cong-su?tab=vi#rut');
  });

  it('không có link hoặc link không phải đường dẫn nội bộ thì không có đích', () => {
    expect(notificationTarget({ link: null })).toBeNull();
    expect(notificationTarget({ link: '' })).toBeNull();
    expect(notificationTarget({ link: 'https://example.com/x' })).toBeNull();
    expect(notificationTarget({ link: '//example.com/x' })).toBeNull();
    expect(notificationTarget({ link: '/\\example.com' })).toBeNull();
    expect(notificationTarget({ link: 'javascript:alert(1)' })).toBeNull();
  });

  it('nút cài đặt của bảng nổi dẫn tới neo cài đặt của trang Thông báo', () => {
    expect(NOTIFICATION_SETTINGS_PATH).toBe('/thong-bao#cai-dat');
  });
});

describe('mergeUnreadFirst', () => {
  it('chưa đọc đứng trước dù cũ hơn, mỗi phần mới nhất trước', () => {
    const unread = [n('u2', '2026-11-18T10:00:00Z'), n('u1', '2026-11-10T10:00:00Z')];
    const all = [n('r3', '2026-11-20T10:00:00Z', READ), n('r2', '2026-11-19T10:00:00Z', READ), n('u2', '2026-11-18T10:00:00Z'), n('r1', '2026-11-12T10:00:00Z', READ)];
    expect(ids(mergeUnreadFirst(unread, all))).toEqual(['u2', 'u1', 'r3', 'r2', 'r1']);
  });

  it('thông báo có ở cả hai danh sách chỉ hiện một lần', () => {
    const a = n('a', '2026-11-18T10:00:00Z');
    const merged = mergeUnreadFirst([a], [a, n('b', '2026-11-17T10:00:00Z', READ)]);
    expect(ids(merged)).toEqual(['a', 'b']);
  });

  it('hai danh sách lệch nhau: đã đọc ở một bên thì coi là đã đọc', () => {
    const stale = n('a', '2026-11-18T10:00:00Z');
    const fresh = n('a', '2026-11-18T10:00:00Z', READ);
    expect(mergeUnreadFirst([stale], [fresh])[0]?.readAt).toBe(READ);
    expect(mergeUnreadFirst([fresh], [stale])[0]?.readAt).toBe(READ);
    expect(ids(mergeUnreadFirst([stale, n('b', '2026-11-01T10:00:00Z')], [fresh]))).toEqual(['b', 'a']);
  });

  it('cái chưa đọc chỉ có trong danh sách "tất cả" (trang chưa đọc chưa tải tới) vẫn lên đầu', () => {
    const all = [n('r1', '2026-11-20T10:00:00Z', READ), n('u9', '2026-11-01T10:00:00Z')];
    expect(ids(mergeUnreadFirst([], all))).toEqual(['u9', 'r1']);
  });

  it('cùng thời điểm thì xếp theo id giảm dần như máy chủ, và không sửa mảng đầu vào', () => {
    const all = [n('a', '2026-11-18T10:00:00Z', READ), n('c', '2026-11-18T10:00:00Z', READ), n('b', '2026-11-18T10:00:00Z', READ)];
    const before = ids(all);
    expect(ids(mergeUnreadFirst([], all))).toEqual(['c', 'b', 'a']);
    expect(ids(all)).toEqual(before);
  });

  it('cả hai rỗng thì rỗng', () => {
    expect(mergeUnreadFirst([], [])).toEqual([]);
  });
});

describe('splitByRead và notifSections', () => {
  const now = new Date(2026, 10, 21, 12, 0, 0);
  const at = (daysAgo: number, hour = 9) => new Date(2026, 10, 21 - daysAgo, hour, 0, 0).toISOString();

  it('tách chưa đọc và đã đọc', () => {
    const parts = splitByRead([n('r', at(0), READ), n('u', at(3))]);
    expect(ids(parts.unread)).toEqual(['u']);
    expect(ids(parts.read)).toEqual(['r']);
  });

  it('dayGroup: hôm nay, hôm qua, tuần này, trước đó', () => {
    expect(dayGroup(at(0), now)).toBe('Hôm nay');
    expect(dayGroup(at(1, 23), now)).toBe('Hôm qua');
    expect(dayGroup(at(4), now)).toBe('Tuần này');
    expect(dayGroup(at(7), now)).toBe('Trước đó');
  });

  it('bảng nổi: một khối Chưa đọc rồi một khối Đã đọc', () => {
    const s = notifSections([n('r1', at(0), READ), n('u1', at(5)), n('r2', at(9), READ)]);
    expect(s.map((x) => [x.label, ids(x.items)])).toEqual([['Chưa đọc', ['u1']], ['Đã đọc', ['r1', 'r2']]]);
  });

  it('trang Thông báo: khối Chưa đọc đứng đầu, phần đã đọc chia theo ngày', () => {
    const s = notifSections([n('r1', at(0), READ), n('r0', at(0, 8), READ), n('u1', at(5)), n('r2', at(1), READ), n('r3', at(20), READ)], { byDay: true, now });
    expect(s.map((x) => [x.label, ids(x.items)])).toEqual([['Chưa đọc', ['u1']], ['Hôm nay', ['r1', 'r0']], ['Hôm qua', ['r2']], ['Trước đó', ['r3']]]);
    expect(new Set(s.map((x) => x.key)).size).toBe(s.length);
  });

  it('đã đọc hết thì không có khối Chưa đọc; không có gì thì không có khối nào', () => {
    expect(notifSections([n('r1', at(0), READ)]).map((x) => x.label)).toEqual(['Đã đọc']);
    expect(notifSections([])).toEqual([]);
    expect(notifSections([], { byDay: true, now })).toEqual([]);
  });
});

describe('applyRead', () => {
  const pages = (): NotifPages => ({
    pages: [
      { items: [n('a', '2026-11-20T10:00:00Z'), n('b', '2026-11-19T10:00:00Z', READ)], nextCursor: 'c1', unreadCount: 3 },
      { items: [n('c', '2026-11-18T10:00:00Z'), n('d', '2026-11-17T10:00:00Z')], nextCursor: null, unreadCount: 3 },
    ],
    pageParams: ['', 'c1'],
  });
  const AT = '2026-11-21T03:00:00.000Z';

  it('đọc một cái: chỉ cái đó nhận readAt, số chưa đọc giảm 1, con trỏ phân trang giữ nguyên', () => {
    const next = applyRead(pages(), 'all', 'c', AT)!;
    expect(next.pages.flatMap((p) => p.items).map((x) => [x.id, x.readAt])).toEqual([['a', null], ['b', READ], ['c', AT], ['d', null]]);
    expect(next.pages.map((p) => p.unreadCount)).toEqual([2, 2]);
    expect(next.pages.map((p) => p.nextCursor)).toEqual(['c1', null]);
    expect(next.pageParams).toEqual(['', 'c1']);
  });

  it('đọc hết: mọi cái chưa đọc nhận readAt, cái đã đọc giữ thời điểm cũ, số về 0', () => {
    const next = applyRead(pages(), 'all', undefined, AT)!;
    expect(next.pages.flatMap((p) => p.items).map((x) => x.readAt)).toEqual([AT, READ, AT, AT]);
    expect(next.pages.map((p) => p.unreadCount)).toEqual([0, 0]);
  });

  it('danh sách lọc "chưa đọc": cái vừa đọc rời khỏi danh sách', () => {
    const one = applyRead(pages(), 'unread', 'a', AT)!;
    expect(ids(one.pages.flatMap((p) => p.items))).toEqual(['b', 'c', 'd']);
    const all = applyRead(pages(), 'unread', undefined, AT)!;
    expect(ids(all.pages.flatMap((p) => p.items))).toEqual(['b']);
    expect(all.pages).toHaveLength(2);
  });

  it('không sửa dữ liệu gốc và chịu được bộ nhớ đệm trống', () => {
    const src = pages();
    applyRead(src, 'all', undefined, AT);
    expect(src.pages[0]?.items[0]?.readAt).toBeNull();
    expect(src.pages[0]?.unreadCount).toBe(3);
    expect(applyRead(undefined, 'all', 'a', AT)).toBeUndefined();
  });

  it('unreadAfterRead không xuống dưới 0', () => {
    expect(unreadAfterRead(5, 'x')).toBe(4);
    expect(unreadAfterRead(0, 'x')).toBe(0);
    expect(unreadAfterRead(5)).toBe(0);
  });
});
