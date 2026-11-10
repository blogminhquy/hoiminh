// Trang "Hôm nay": mở app là thấy việc của riêng mình trong ngày. Ba việc nhỏ (ghé hội, học một bài,
// sự kiện hôm nay hoặc góp ý một bài), tiến độ khóa đang học nói bằng lời, sự kiện sắp tới và điều đang được bàn.
// Máy tính: hai cột (việc hôm nay và tiến độ bên trái; sự kiện, bàn luận bên phải). Điện thoại: một cột.
// Mọi dấu "đã xong" lấy từ dữ liệu thật: GET /v1/communities/:id/today, danh sách khóa học, sự kiện, bảng tin.
import { useQuery } from '@tanstack/react-query';
import { DateBlock, Prog, T } from '@hoiminh/ui';
import { Check, ChevronRight, MessageCircle, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FeedPost } from '@/components/post/PostCard';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useShell } from '@/lib/community';
import { fmtDuration, fmtLongDate, fmtTime } from '@/lib/format';
import { buildTodayTasks, moduleRemaining, pickDiscussPost, pickTodayEvent, type TodayActivity, type TodayTask } from '@/lib/today';
import { useRegister, type EventItem } from './EventParts';

interface CourseItem { id: string; title: string; status: string; percent: number; completedLessons: number; lessonCount: number; locked: boolean; completed: boolean }
interface CourseList { items: CourseItem[]; continue: { course: CourseItem; lesson: { id: string; title: string; durationSeconds: number | null } } | null }
interface CourseDetail { modules: Array<{ title: string; lessons: Array<{ id: string; done: boolean; locked: boolean; durationSeconds: number | null }> }> }

function TaskRow({ task }: { task: TodayTask }) {
  const reg = useRegister(task.action?.kind === 'register' ? task.action.eventId : '');
  const a = task.action;
  return (
    <div className="today-task">
      <span className={`today-ring${task.done ? ' done' : ''}`} aria-hidden="true">{task.done && <Check size={16} strokeWidth={3} />}</span>
      <span className="flex-grow min-w-0">
        <span className="block font-semibold text-[16px] leading-snug">{task.title}<span className="sr-only">{task.done ? ' (đã xong)' : ' (chưa xong)'}</span></span>
        <span className="block muted text-[14px] truncate">{task.hint}</span>
      </span>
      {a?.kind === 'link' && <Link to={a.to} className={`btn btn-sm flex-shrink-0 ${a.strong ? 'btn-gold' : 'btn-soft'}`}>{a.label}</Link>}
      {a?.kind === 'register' && <button type="button" className="btn btn-sm btn-soft flex-shrink-0" disabled={reg.isPending} onClick={() => reg.mutate(true)}>{a.label}</button>}
    </div>
  );
}

export default function Page() {
  const shell = useShell();
  const { user } = useAuth();
  const cid = shell.community.id;
  const slug = shell.community.slug;
  const tabs = shell.community.tabs;

  const today = useQuery({ queryKey: ['today', cid], queryFn: () => api.get<TodayActivity>(`/v1/communities/${cid}/today`) });
  const courses = useQuery({ queryKey: ['courses', cid], queryFn: () => api.get<CourseList>(`/v1/communities/${cid}/courses`), enabled: tabs.courses !== false });
  const events = useQuery({ queryKey: ['events', cid, 'upcoming', ''], queryFn: () => api.get<{ items: EventItem[] }>(`/v1/communities/${cid}/events?filter=upcoming`), enabled: tabs.events !== false });
  const feed = useQuery({ queryKey: ['feed', cid, 'today'], queryFn: () => api.get<{ items: FeedPost[] }>(`/v1/communities/${cid}/feed`), enabled: tabs.feed !== false });

  const cont = courses.data?.continue ?? null;
  const detail = useQuery({ queryKey: ['course', cont?.course.id], queryFn: () => api.get<CourseDetail>(`/v1/courses/${cont!.course.id}`), enabled: Boolean(cont) });

  const now = new Date();
  const allEvents = events.data?.items ?? [];
  const todayEvent = pickTodayEvent(allEvents, now);
  const posts = (feed.data?.items ?? []).filter((p) => p.moderationStatus !== 'pending');
  const discuss = pickDiscussPost(posts.map((p) => ({ id: p.id, title: p.title, excerpt: p.excerpt, commentCount: p.commentCount, spaceName: p.space?.name ?? null, authorId: p.author?.id ?? null })), user?.id ?? null);
  const startCourse = !cont ? courses.data?.items.find((c) => c.status === 'published' && !c.locked && !c.completed) ?? null : null;

  const tasks = buildTodayTasks({
    slug,
    activity: today.data ?? null,
    lesson: cont ? { lessonId: cont.lesson.id, lessonTitle: cont.lesson.title, courseTitle: cont.course.title, durationSeconds: cont.lesson.durationSeconds } : null,
    startCourse: startCourse ? { id: startCourse.id, title: startCourse.title } : null,
    event: todayEvent,
    discuss,
  });
  const done = tasks.filter((t) => t.done).length;
  const loading = today.isLoading || courses.isLoading || events.isLoading || feed.isLoading;
  const remaining = cont && detail.data ? moduleRemaining(detail.data.modules, cont.lesson.id) : null;
  const later = allEvents.filter((e) => e.id !== todayEvent?.id).slice(0, 2);
  const talking = [...posts].sort((a, b) => b.commentCount - a.commentCount).filter((p) => p.commentCount > 0 && p.id !== discuss?.id).slice(0, 3);

  return (
    <div className="two-col">
      <div className="main">
      <section className="card card-invert today-head">
        <span className="muted text-[14px]">{fmtLongDate(now)}</span>
        <h1 className="serif m-0 text-[26px] font-extrabold leading-tight">Chào {user?.name ?? 'bạn'}</h1>
        <div className="flex flex-col gap-2 pt-2">
          <span className="font-bold text-[17px]">{loading ? 'Đang xem hôm nay có gì…' : done === tasks.length ? `Xong cả ${tasks.length} việc hôm nay` : `Xong ${done} trên ${tasks.length} việc hôm nay`}</span>
          <div className="today-bar" role="progressbar" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={done} aria-label="Việc hôm nay"><i style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} /></div>
        </div>
      </section>

      <section className="card px-4 py-1" aria-label="Việc hôm nay">
        {tasks.map((t) => <TaskRow key={t.key} task={t} />)}
      </section>

      {cont && (
        <section className="card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex-grow min-w-0">
              <span className="block muted text-[13px] font-semibold uppercase tracking-[0.05em]">Khóa đang học</span>
              <span className="block font-bold text-[17px] truncate">{cont.course.title}</span>
            </span>
            <span className="serif text-[22px] font-extrabold flex-shrink-0" style={{ color: T.primaryText }}>{cont.course.percent}%</span>
          </div>
          <Prog value={cont.course.percent} height={8} />
          <p className="m-0 text-[15px]" style={{ color: T.ink2 }}>
            {remaining
              ? <>Còn <strong>{remaining.lessons} bài</strong>{remaining.seconds > 0 ? <>, khoảng <strong>{fmtDuration(remaining.seconds, true)}</strong></> : null} là xong phần {remaining.index}: {remaining.title}.</>
              : <>Đã xong {cont.course.completedLessons} trên {cont.course.lessonCount} bài.</>}
          </p>
          {/* Tên bài dài thì cắt bằng dấu ba chấm, không để chữ tràn ra ngoài nút. */}
          <Link to={`/${slug}/bai/${cont.lesson.id}`} className="btn btn-primary w-full sm:w-auto sm:self-start max-w-full min-w-0"><Play size={16} className="flex-shrink-0" /><span className="truncate">Học tiếp: {cont.lesson.title}</span></Link>
        </section>
      )}

      </div>
      <aside className="rail">
      {later.length > 0 && (
        <section className="card p-4 flex flex-col gap-1">
          <div className="flex items-center"><h2 className="m-0 font-bold text-[17px] flex-grow">Sự kiện sắp tới</h2><Link to={`/${slug}/su-kien`} className="text-[14px] font-semibold inline-flex items-center min-h-[44px]">Tất cả</Link></div>
          {later.map((e) => (
            <Link key={e.id} to={`/${slug}/su-kien/${e.id}`} className="flex items-center gap-3 py-2.5" style={{ color: T.ink, borderTop: `1px solid ${T.line}` }}>
              <DateBlock date={new Date(e.startsAt)} tone="teal" size={48} />
              <span className="flex-grow min-w-0"><span className="block font-semibold text-[15px] truncate">{e.title}</span><span className="block muted text-[14px]">{fmtTime(e.startsAt)}{e.registered ? ' · đã bật nhắc' : ''}</span></span>
              <ChevronRight size={20} style={{ color: T.ink3 }} />
            </Link>
          ))}
        </section>
      )}

      {talking.length > 0 && (
        <section className="card p-4 flex flex-col gap-1">
          <div className="flex items-center"><h2 className="m-0 font-bold text-[17px] flex-grow">Đang bàn luận</h2><Link to={`/${slug}/bang-tin`} className="text-[14px] font-semibold inline-flex items-center min-h-[44px]">Bảng tin</Link></div>
          {talking.map((p) => (
            <Link key={p.id} to={`/${slug}/bai-viet/${p.id}`} className="flex items-center gap-3 py-3" style={{ color: T.ink, borderTop: `1px solid ${T.line}` }}>
              <span className="flex-grow min-w-0"><span className="block font-semibold text-[15px] line-clamp-2">{p.title || p.excerpt}</span><span className="block muted text-[14px]">{p.author?.name}</span></span>
              <span className="muted text-[14px] inline-flex items-center gap-1 flex-shrink-0"><MessageCircle size={16} />{p.commentCount}</span>
            </Link>
          ))}
        </section>
      )}
      </aside>
    </div>
  );
}
