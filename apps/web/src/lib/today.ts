// Trang "Hôm nay": dựng danh sách việc nhỏ trong ngày từ dữ liệu thật (bài đang học dở, sự kiện hôm nay,
// bài đang bàn luận, số việc đã làm trong ngày). Hàm thuần để test được, không gọi API ở đây.

export interface TodayActivity { since: string; lessonsDone: number; comments: number; posts: number }
export interface TodayLesson { lessonId: string; lessonTitle: string; courseTitle: string; durationSeconds: number | null }
export interface TodayEvent { id: string; title: string; startsAt: string; endsAt: string; live: boolean; registered: boolean }
export interface TodayPost { id: string; title: string; excerpt: string; commentCount: number; spaceName: string | null }

export type TodayAction =
  | { kind: 'link'; label: string; to: string; strong?: boolean }
  | { kind: 'register'; label: string; eventId: string };
export interface TodayTask { key: 'visit' | 'lesson' | 'event' | 'discuss'; title: string; hint: string; done: boolean; action?: TodayAction }

const VN_OFFSET_MS = 7 * 3_600_000;
/** Ngày (YYYY-MM-DD) theo giờ Việt Nam của một thời điểm. */
export function vnDay(at: Date | string): string {
  return new Date(new Date(at).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}
/** Giờ:phút theo giờ Việt Nam. */
export function vnTime(at: Date | string): string {
  return new Date(new Date(at).getTime() + VN_OFFSET_MS).toISOString().slice(11, 16);
}

const minutes = (seconds: number | null) => (seconds && seconds > 0 ? `${Math.max(1, Math.round(seconds / 60))} phút` : '');

/** Sự kiện của hôm nay chưa kết thúc, sớm nhất trước. */
export function pickTodayEvent(events: TodayEvent[], now: Date): TodayEvent | null {
  const today = vnDay(now);
  return events.filter((e) => vnDay(e.startsAt) === today && new Date(e.endsAt).getTime() > now.getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
}

/**
 * Bài để mời góp ý: ưu tiên câu hỏi chưa ai trả lời (chuyên mục "Hỏi đáp", 0 bình luận), không có thì bài nhiều bình luận nhất.
 * Bỏ bài của chính người xem.
 */
export function pickDiscussPost(posts: Array<TodayPost & { authorId?: string | null }>, viewerId: string | null): (TodayPost & { unanswered: boolean }) | null {
  const others = posts.filter((p) => !viewerId || p.authorId !== viewerId);
  const question = others.find((p) => p.commentCount === 0 && (p.spaceName ?? '').trim().toLowerCase() === 'hỏi đáp');
  if (question) return { ...question, unanswered: true };
  const hot = [...others].sort((a, b) => b.commentCount - a.commentCount)[0];
  return hot && hot.commentCount > 0 ? { ...hot, unanswered: false } : null;
}

/** Tên rút gọn cho một bài không có tiêu đề. */
const postName = (p: TodayPost) => (p.title.trim() || p.excerpt.trim()).slice(0, 70);

export function buildTodayTasks(input: {
  slug: string;
  activity: TodayActivity | null;
  lesson: TodayLesson | null;
  /** Khi chưa học dở bài nào: khóa đầu tiên mở được để bắt đầu. */
  startCourse: { id: string; title: string } | null;
  event: TodayEvent | null;
  discuss: (TodayPost & { unanswered: boolean }) | null;
}): TodayTask[] {
  const { slug, activity, lesson, startCourse, event, discuss } = input;
  const tasks: TodayTask[] = [{ key: 'visit', title: 'Ghé hội hôm nay', hint: 'Bạn đang ở đây rồi', done: true }];

  const learned = activity?.lessonsDone ?? 0;
  if (lesson) {
    tasks.push({
      key: 'lesson',
      title: learned > 0 ? `Đã học ${learned} bài hôm nay` : 'Học một bài',
      hint: [lesson.lessonTitle, minutes(lesson.durationSeconds)].filter(Boolean).join(' · '),
      done: learned > 0,
      action: { kind: 'link', label: learned > 0 ? 'Học tiếp' : 'Học', to: `/${slug}/bai/${lesson.lessonId}`, strong: learned === 0 },
    });
  } else if (startCourse) {
    tasks.push({ key: 'lesson', title: learned > 0 ? `Đã học ${learned} bài hôm nay` : 'Bắt đầu một khóa học', hint: startCourse.title, done: learned > 0, action: { kind: 'link', label: 'Xem khóa', to: `/${slug}/khoa-hoc/${startCourse.id}`, strong: learned === 0 } });
  }

  if (event) {
    const when = vnTime(event.startsAt);
    tasks.push({
      key: 'event',
      title: event.live ? 'Sự kiện đang diễn ra' : `Sự kiện lúc ${when}`,
      hint: event.registered && !event.live ? `${event.title} · đã bật nhắc` : event.title,
      done: event.registered && !event.live,
      action: event.live || event.registered
        ? { kind: 'link', label: event.live ? 'Vào phòng' : 'Xem', to: `/${slug}/su-kien/${event.id}`, strong: event.live }
        : { kind: 'register', label: 'Nhắc tôi', eventId: event.id },
    });
  } else if (discuss) {
    const joined = (activity?.comments ?? 0) + (activity?.posts ?? 0);
    tasks.push({
      key: 'discuss',
      title: joined > 0 ? 'Đã góp ý với hội hôm nay' : discuss.unanswered ? 'Trả lời một câu hỏi' : 'Góp một bình luận',
      hint: postName(discuss),
      done: joined > 0,
      action: { kind: 'link', label: joined > 0 ? 'Xem' : discuss.unanswered ? 'Trả lời' : 'Đọc', to: `/${slug}/bai-viet/${discuss.id}` },
    });
  }
  return tasks;
}

/** "Còn 3 bài, khoảng 28 phút là xong phần 1": phần chứa bài đang học, đếm các bài chưa xong và mở được. */
export function moduleRemaining(modules: Array<{ title: string; lessons: Array<{ id: string; done: boolean; locked: boolean; durationSeconds: number | null }> }>, lessonId: string): { index: number; title: string; lessons: number; seconds: number } | null {
  const index = modules.findIndex((m) => m.lessons.some((l) => l.id === lessonId));
  const m = modules[index];
  if (!m) return null;
  const left = m.lessons.filter((l) => !l.done && !l.locked);
  if (left.length === 0) return null;
  return { index: index + 1, title: m.title, lessons: left.length, seconds: left.reduce((s, l) => s + (l.durationSeconds ?? 0), 0) };
}
