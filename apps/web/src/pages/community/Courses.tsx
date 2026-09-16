// Thư viện khóa học: chip lọc, khối "Học tiếp", lưới thẻ khóa với % tiến độ và nhãn Premium/Nháp/Hoàn thành.
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Lock, Play, Plus } from 'lucide-react';
import { Chip, Prog, T } from '@hoiminh/ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useShell } from '@/lib/community';
import { fmtDuration, timeAgo } from '@/lib/format';

interface CourseItem {
  id: string; title: string; coverColor: string; coverUrl: string | null; status: 'draft' | 'published' | 'archived'; accessMode: string; lessonCount: number; totalDurationSeconds: number; updatedAt: string; priceMinor: number | null;
  percent: number; completedLessons: number; lastLessonId: string | null; lastAccessedAt: string | null; locked: boolean; lockReason: string | null; completed: boolean;
}
interface CourseList { items: CourseItem[]; continue: { course: CourseItem; lesson: { id: string; title: string; durationSeconds: number | null } } | null; canManage: boolean }
type Filter = 'all' | 'learning' | 'done' | 'locked';

function state(c: CourseItem): 'lock' | 'draft' | 'done' | 'learning' | 'new' {
  if (c.status === 'draft') return 'draft';
  if (c.locked) return 'lock';
  if (c.completed || c.percent === 100) return 'done';
  return c.percent > 0 ? 'learning' : 'new';
}

function CourseCard({ c, slug }: { c: CourseItem; slug: string }) {
  const s = state(c);
  const to = `/${slug}/khoa-hoc/${c.id}`;
  const meta = [`${c.lessonCount} bài`, fmtDuration(c.totalDurationSeconds, true), s === 'lock' ? 'dành cho Premium' : s === 'draft' ? 'chỉ bạn thấy' : `cập nhật ${timeAgo(c.updatedAt)}`].filter(Boolean).join(' · ');
  const continueTo = c.lastLessonId ? `/${slug}/bai/${c.lastLessonId}` : to;
  return (
    <div className="card overflow-hidden flex flex-col">
      <Link to={to} className="relative h-[160px] flex items-end p-4" style={{ background: c.coverUrl ? `url(${c.coverUrl}) center/cover` : c.coverColor }}>
        <span className="serif text-[22px] font-extrabold leading-[1.15] max-w-[240px]" style={{ color: T.invertInk }}>{c.title}</span>
        {s === 'lock' && <span className="tag absolute top-3 right-3" style={{ background: T.goldSoft, color: T.goldText }}><Lock size={11} /> Premium</span>}
        {s === 'draft' && <span className="tag absolute top-3 left-3" style={{ background: T.bg, color: T.ink3 }}>Nháp</span>}
        {s === 'done' && <span className="tag absolute top-3 right-3" style={{ background: T.tealSoft, color: T.tealText }}><BadgeCheck size={11} /> Hoàn thành</span>}
      </Link>
      <div className="px-4 pt-3.5 pb-4 flex flex-col gap-2.5 flex-grow">
        <Link to={to} className="font-semibold text-[15px]" style={{ color: T.ink }}>{c.title}</Link>
        <div className="muted text-[12px]">{meta}</div>
        <div className="flex-grow" />
        {s === 'lock' ? (
          <Link to={c.lockReason === 'store' || c.accessMode === 'store_only' ? `/${slug}/cua-hang` : `/${slug}/thanh-toan?tier=premium&cycle=monthly`} className="btn btn-ghost btn-sm">Nâng cấp để mở</Link>
        ) : s === 'draft' ? (
          <Link to={`${to}/soan`} className="btn btn-ghost btn-sm">Tiếp tục soạn</Link>
        ) : (
          <>
            <div className="flex items-center gap-2.5"><Prog value={c.percent} className="flex-grow" /><span className="text-[12px] font-semibold" style={{ color: c.percent === 100 ? T.teal : T.ink2 }}>{c.percent}%</span></div>
            <Link to={s === 'done' ? to : continueTo} className={`btn btn-sm ${s === 'learning' ? 'btn-dark' : 'btn-ghost'}`}>{s === 'done' ? 'Xem lại' : s === 'learning' ? 'Tiếp tục' : 'Bắt đầu học'}</Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  const shell = useShell();
  const slug = shell.community.slug;
  const [filter, setFilter] = useState<Filter>('all');
  const q = useQuery({ queryKey: ['courses', shell.community.id], queryFn: () => api.get<CourseList>(`/v1/communities/${shell.community.id}/courses`) });
  const items = q.data?.items ?? [];
  const counts = { all: items.length, learning: items.filter((c) => state(c) === 'learning').length, done: items.filter((c) => state(c) === 'done').length, locked: items.filter((c) => state(c) === 'lock').length };
  const shown = items.filter((c) => filter === 'all' || (filter === 'learning' && state(c) === 'learning') || (filter === 'done' && state(c) === 'done') || (filter === 'locked' && state(c) === 'lock'));
  const cont = q.data?.continue ?? null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <h1 className="serif m-0 text-[28px] font-extrabold page-title">Khóa học</h1>
          <div className="muted text-[13px]">{counts.all} khóa · bạn đã hoàn thành {counts.done}, đang học {counts.learning}</div>
        </div>
        <span className="flex-grow" />
        <div className="flex gap-2 flex-wrap">
          <Chip on={filter === 'all'} onClick={() => setFilter('all')}>Tất cả · {counts.all}</Chip>
          <Chip on={filter === 'learning'} onClick={() => setFilter('learning')}>Đang học · {counts.learning}</Chip>
          <Chip on={filter === 'done'} onClick={() => setFilter('done')}>Hoàn thành · {counts.done}</Chip>
          <Chip on={filter === 'locked'} onClick={() => setFilter('locked')}>Chưa mở · {counts.locked}</Chip>
        </div>
        {q.data?.canManage && <Link to={`/${slug}/khoa-hoc/moi`} className="btn btn-primary btn-sm" style={{ height: 36 }}><Plus size={16} /> Tạo khóa học</Link>}
      </div>
      {cont && (
        <div className="card card-invert px-5 py-4 flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ background: cont.course.coverUrl ? `url(${cont.course.coverUrl}) center/cover` : cont.course.coverColor }} />
          <div className="flex-grow min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}>Học tiếp</div>
            <div className="font-bold text-[16px] truncate">{cont.lesson.title}</div>
            <div className="text-[13px]" style={{ color: T.sideText }}>{cont.course.title}{cont.lesson.durationSeconds ? ` · ${fmtDuration(cont.lesson.durationSeconds)}` : ''}{cont.course.lastAccessedAt ? ` · bạn dừng ${timeAgo(cont.course.lastAccessedAt)}` : ''}</div>
          </div>
          <Link to={`/${slug}/bai/${cont.lesson.id}`} className="btn btn-primary"><Play size={16} /> Tiếp tục</Link>
        </div>
      )}
      <QueryState q={q} rows={3} isEmpty={(d) => d.items.length === 0} empty={{ title: 'Chưa có khóa học', hint: q.data?.canManage ? 'Tạo khóa học đầu tiên cho hội' : 'Chủ hội chưa đăng khóa học nào' }}>
        {() => (shown.length ? <div className="grid-3">{shown.map((c) => <CourseCard key={c.id} c={c} slug={slug} />)}</div> : <div className="muted text-[13px] text-center py-8">Không có khóa nào trong mục này</div>)}
      </QueryState>
    </div>
  );
}
