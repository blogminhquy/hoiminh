import { describe, expect, it } from 'vitest';
import { buildTodayTasks, moduleRemaining, pickDiscussPost, pickTodayEvent, vnDay, vnTime, type TodayEvent } from './today';

const ev = (over: Partial<TodayEvent>): TodayEvent => ({ id: 'e1', title: 'Q&A tuần', startsAt: '2026-11-09T13:00:00Z', endsAt: '2026-11-09T14:30:00Z', live: false, registered: false, ...over });
const lesson = { lessonId: 'l2', lessonTitle: 'Ba con số quyết định lãi', courseTitle: 'Funnel Money Model', durationSeconds: 622 };
const none = { since: '', lessonsDone: 0, comments: 0, posts: 0 };

describe('ngày và giờ Việt Nam', () => {
  it('17:00 UTC đã là ngày hôm sau ở Việt Nam', () => {
    expect(vnDay('2026-11-09T16:59:00Z')).toBe('2026-11-09');
    expect(vnDay('2026-11-09T17:00:00Z')).toBe('2026-11-10');
    expect(vnTime('2026-11-09T13:00:00Z')).toBe('20:00');
  });
});

describe('pickTodayEvent', () => {
  const now = new Date('2026-11-09T05:00:00Z'); // 12:00 giờ Việt Nam
  it('chọn sự kiện hôm nay sớm nhất còn chưa kết thúc', () => {
    const list = [ev({ id: 'toi', startsAt: '2026-11-09T13:00:00Z', endsAt: '2026-11-09T14:00:00Z' }), ev({ id: 'chieu', startsAt: '2026-11-09T08:00:00Z', endsAt: '2026-11-09T09:00:00Z' })];
    expect(pickTodayEvent(list, now)?.id).toBe('chieu');
  });
  it('bỏ sự kiện đã kết thúc và sự kiện ngày khác', () => {
    const list = [ev({ id: 'sang', startsAt: '2026-11-09T01:00:00Z', endsAt: '2026-11-09T02:00:00Z' }), ev({ id: 'mai', startsAt: '2026-11-10T13:00:00Z', endsAt: '2026-11-10T14:00:00Z' })];
    expect(pickTodayEvent(list, now)).toBeNull();
  });
});

describe('pickDiscussPost', () => {
  const post = (id: string, commentCount: number, spaceName: string, authorId = 'khac') => ({ id, title: id, excerpt: '', commentCount, spaceName, authorId });
  it('ưu tiên câu hỏi chưa ai trả lời', () => {
    expect(pickDiscussPost([post('nong', 21, 'Chia sẻ'), post('hoi', 0, 'Hỏi đáp')], 'toi')).toMatchObject({ id: 'hoi', unanswered: true });
  });
  it('không có câu hỏi trống thì lấy bài nhiều bình luận nhất, bỏ bài của chính mình', () => {
    expect(pickDiscussPost([post('cua-toi', 50, 'Chia sẻ', 'toi'), post('nong', 21, 'Chia sẻ'), post('vua', 3, 'Nhật ký')], 'toi')).toMatchObject({ id: 'nong', unanswered: false });
  });
  it('không có gì đáng bàn thì trả null', () => {
    expect(pickDiscussPost([post('im', 0, 'Chia sẻ')], 'toi')).toBeNull();
  });
});

describe('buildTodayTasks', () => {
  it('chưa làm gì: ghé hội đã xong, học và sự kiện chưa xong', () => {
    const t = buildTodayTasks({ slug: 'minhquy', activity: none, lesson, startCourse: null, event: ev({}), discuss: null });
    expect(t.map((x) => [x.key, x.done])).toEqual([['visit', true], ['lesson', false], ['event', false]]);
    expect(t[1]!.action).toEqual({ kind: 'link', label: 'Học', to: '/minhquy/bai/l2', strong: true });
    expect(t[1]!.hint).toBe('Ba con số quyết định lãi · 10 phút');
    expect(t[2]!.title).toBe('Sự kiện lúc 20:00');
    expect(t[2]!.action).toEqual({ kind: 'register', label: 'Nhắc tôi', eventId: 'e1' });
  });
  it('học xong một bài trong ngày thì việc học được đánh dấu xong', () => {
    const t = buildTodayTasks({ slug: 'minhquy', activity: { ...none, lessonsDone: 2 }, lesson, startCourse: null, event: null, discuss: null });
    expect(t[1]).toMatchObject({ key: 'lesson', done: true, title: 'Đã học 2 bài hôm nay' });
  });
  it('đã đăng ký sự kiện chưa tới giờ thì xong; đang diễn ra thì mời vào phòng', () => {
    const reg = buildTodayTasks({ slug: 'minhquy', activity: none, lesson: null, startCourse: null, event: ev({ registered: true }), discuss: null });
    expect(reg[1]).toMatchObject({ key: 'event', done: true });
    const live = buildTodayTasks({ slug: 'minhquy', activity: none, lesson: null, startCourse: null, event: ev({ registered: true, live: true }), discuss: null });
    expect(live[1]).toMatchObject({ key: 'event', done: false, title: 'Sự kiện đang diễn ra' });
    expect(live[1]!.action).toMatchObject({ kind: 'link', label: 'Vào phòng', to: '/minhquy/su-kien/e1' });
  });
  it('không có sự kiện hôm nay thì việc thứ ba là góp ý, xong khi đã bình luận hoặc đăng bài', () => {
    const d = { id: 'p1', title: 'Chưa thấy khóa học mở?', excerpt: '', commentCount: 0, spaceName: 'Hỏi đáp', unanswered: true };
    const before = buildTodayTasks({ slug: 'minhquy', activity: none, lesson, startCourse: null, event: null, discuss: d });
    expect(before[2]).toMatchObject({ key: 'discuss', done: false, title: 'Trả lời một câu hỏi' });
    const after = buildTodayTasks({ slug: 'minhquy', activity: { ...none, comments: 1 }, lesson, startCourse: null, event: null, discuss: d });
    expect(after[2]).toMatchObject({ key: 'discuss', done: true });
  });
  it('hội không có khóa học, sự kiện hay bài viết thì chỉ còn việc ghé hội', () => {
    expect(buildTodayTasks({ slug: 'x', activity: none, lesson: null, startCourse: null, event: null, discuss: null })).toHaveLength(1);
  });
  it('chưa học dở bài nào thì mời bắt đầu khóa đầu tiên mở được', () => {
    const t = buildTodayTasks({ slug: 'x', activity: none, lesson: null, startCourse: { id: 'c1', title: 'Khóa nhập môn' }, event: null, discuss: null });
    expect(t[1]).toMatchObject({ key: 'lesson', title: 'Bắt đầu một khóa học', hint: 'Khóa nhập môn' });
  });
});

describe('moduleRemaining', () => {
  const modules = [
    { title: 'Tư duy mô hình tiền', lessons: [{ id: 'a', done: true, locked: false, durationSeconds: 490 }, { id: 'b', done: false, locked: false, durationSeconds: 622 }, { id: 'c', done: false, locked: false, durationSeconds: 465 }] },
    { title: 'Thiết kế Offer', lessons: [{ id: 'd', done: false, locked: true, durationSeconds: 600 }] },
  ];
  it('đếm bài chưa xong trong phần chứa bài đang học', () => {
    expect(moduleRemaining(modules, 'b')).toEqual({ index: 1, title: 'Tư duy mô hình tiền', lessons: 2, seconds: 1087 });
  });
  it('phần chỉ còn bài bị khóa hoặc không tìm thấy bài thì trả null', () => {
    expect(moduleRemaining(modules, 'd')).toBeNull();
    expect(moduleRemaining(modules, 'khong-co')).toBeNull();
  });
});
