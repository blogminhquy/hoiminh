// Thư viện khóa học: chip lọc, khối "Học tiếp", lưới thẻ khóa với % tiến độ và nhãn Premium/Nháp/Hoàn thành.
// Bìa thẻ theo tỷ lệ 16:9 để ảnh bìa hiện trọn; chỉ bìa màu (chưa có ảnh) mới in tên khóa lên bìa.
// Người quản lý khóa có nút ba chấm ở góc trên bên phải mỗi thẻ (CourseMenu): cài đặt, sắp thứ tự, nhân bản, đăng, xóa ngay tại thư viện.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Lock, Play, Plus } from 'lucide-react';
import { Chip, Prog, T } from '@hoiminh/ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useJoinGate, useShell } from '@/lib/community';
import { fmtDuration, timeAgo } from '@/lib/format';
import { CourseMenu, type CourseMenuActions } from './CourseMenu';

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

/** Đang học dở: đã có tiến độ và chưa xong, kể cả khóa Premium mà người dùng đang học phần miễn phí. */
const inProgress = (c: CourseItem) => c.status !== 'draft' && c.percent > 0 && !(c.completed || c.percent === 100);

/** Phần quản lý của một thẻ: chỉ truyền khi người xem được quản lý khóa học. */
interface CardManage { canMovePrev: boolean; canMoveNext: boolean; busy: boolean; actions: CourseMenuActions }

function CourseCard({ c, slug, manage }: { c: CourseItem; slug: string; manage?: CardManage }) {
  // Khách xem hội mở: khóa nào cũng còn khóa vì chưa là thành viên, lối mở là tham gia hội.
  const { guest } = useJoinGate();
  const s = state(c);
  const to = `/${slug}/khoa-hoc/${c.id}`;
  const meta = [`${c.lessonCount} bài`, fmtDuration(c.totalDurationSeconds, true), s === 'lock' ? 'dành cho Premium' : s === 'draft' ? 'chỉ bạn thấy' : `cập nhật ${timeAgo(c.updatedAt)}`].filter(Boolean).join(' · ');
  const continueTo = c.lastLessonId ? `/${slug}/bai/${c.lastLessonId}` : to;
  // Thẻ có nút ba chấm ở góc phải thì nhãn trạng thái dời sang trái; thẻ không cắt tràn để bảng menu thả ra ngoài được.
  const tagSide = manage ? 'left-3' : 'right-3';
  return (
    <div className="card relative flex flex-col">
      {manage && <CourseMenu title={c.title} status={c.status} to={to} canMovePrev={manage.canMovePrev} canMoveNext={manage.canMoveNext} busy={manage.busy} actions={manage.actions} />}
      <Link to={to} aria-label={c.title} className="relative flex items-end p-4 rounded-t-[15px] overflow-hidden" style={{ aspectRatio: '16 / 9', background: c.coverUrl ? `url(${c.coverUrl}) center/cover` : c.coverColor }}>
        {!c.coverUrl && <span className="serif text-[22px] font-extrabold leading-[1.15] max-w-[240px]" style={{ color: T.invertInk }}>{c.title}</span>}
        {s === 'lock' && <span className={`tag absolute top-3 ${tagSide}`} style={{ background: T.goldSoft, color: T.goldText }}><Lock size={11} /> Premium</span>}
        {s === 'draft' && <span className="tag absolute top-3 left-3" style={{ background: T.bg, color: T.ink3 }}>Nháp</span>}
        {s === 'done' && <span className={`tag absolute top-3 ${tagSide}`} style={{ background: T.tealSoft, color: T.tealText }}><BadgeCheck size={11} /> Hoàn thành</span>}
      </Link>
      <div className="px-4 pt-3.5 pb-4 flex flex-col gap-2.5 flex-grow">
        <Link to={to} className="font-semibold text-[15px]" style={{ color: T.ink }}>{c.title}</Link>
        <div className="muted text-[12px]">{meta}</div>
        <div className="flex-grow" />
        {s === 'lock' && guest ? (
          <Link to={`/${slug}`} className="btn btn-ghost btn-sm">Tham gia hội để học</Link>
        ) : s === 'lock' ? (
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
  const counts = { all: items.length, learning: items.filter(inProgress).length, done: items.filter((c) => state(c) === 'done').length, locked: items.filter((c) => state(c) === 'lock' && !inProgress(c)).length };
  const shown = items.filter((c) => filter === 'all' || (filter === 'learning' && inProgress(c)) || (filter === 'done' && state(c) === 'done') || (filter === 'locked' && state(c) === 'lock' && !inProgress(c)));
  const cont = q.data?.continue ?? null;

  // Quản lý khóa ngay tại thư viện (menu ba chấm trên thẻ).
  const qc = useQueryClient();
  const listKey = ['courses', shell.community.id];
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!notice?.ok) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['courses'] }); void qc.invalidateQueries({ queryKey: ['library'] }); };
  const fail = (e: unknown) => setNotice({ ok: false, text: errorMessage(e) });
  const order = useMutation({
    mutationFn: (courseIds: string[]) => api.put(`/v1/communities/${shell.community.id}/courses/order`, { courseIds }),
    // Đổi chỗ ngay trên màn hình, không chờ máy chủ; lỗi thì nạp lại thứ tự thật.
    onMutate: async (courseIds) => {
      setNotice(null);
      await qc.cancelQueries({ queryKey: listKey });
      qc.setQueryData<CourseList>(listKey, (d) => (d ? { ...d, items: courseIds.map((id) => d.items.find((c) => c.id === id)).filter((c): c is CourseItem => Boolean(c)) } : d));
    },
    onError: fail,
    onSettled: refresh,
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => api.post<{ id: string; title: string }>(`/v1/courses/${id}/duplicate`, {}),
    onSuccess: (copy) => { refresh(); setNotice({ ok: true, text: `Đã nhân bản thành "${copy.title}". Bản sao đang là nháp, chỉ bạn thấy.` }); },
    onError: fail,
  });
  const publish = useMutation({
    mutationFn: (v: { id: string; status: 'published' | 'draft' }) => api.patch(`/v1/courses/${v.id}`, { status: v.status }),
    onSuccess: (_r, v) => { refresh(); void qc.invalidateQueries({ queryKey: ['course', v.id] }); setNotice({ ok: true, text: v.status === 'published' ? 'Đã đăng khóa học.' : 'Đã gỡ khóa học về nháp, học viên không còn thấy.' }); },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/v1/courses/${id}`),
    onSuccess: () => { refresh(); setNotice({ ok: true, text: 'Đã xóa khóa học.' }); },
    onError: fail,
  });
  const busy = order.isPending || duplicate.isPending || publish.isPending || remove.isPending;
  /** Đổi chỗ với thẻ đứng cạnh trong danh sách đang hiện (kể cả khi đang lọc), rồi gửi thứ tự của cả thư viện. */
  const move = (id: string, dir: -1 | 1) => {
    const neighbor = shown[shown.findIndex((c) => c.id === id) + dir];
    if (!neighbor) return;
    const ids = items.map((c) => c.id).filter((x) => x !== id);
    ids.splice(ids.indexOf(neighbor.id) + (dir === 1 ? 1 : 0), 0, id);
    order.mutate(ids);
  };
  const copyLink = async (id: string) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/${slug}/khoa-hoc/${id}`); setNotice({ ok: true, text: 'Đã chép link khóa học.' }); } catch { setNotice({ ok: false, text: 'Trình duyệt không cho chép. Bạn mở trang khóa học rồi chép địa chỉ trên thanh trình duyệt.' }); }
  };
  const manageFor = (c: CourseItem, i: number): CardManage => ({
    canMovePrev: i > 0, canMoveNext: i < shown.length - 1, busy,
    actions: {
      onMove: (dir) => move(c.id, dir),
      onDuplicate: () => { setNotice(null); duplicate.mutate(c.id); },
      onPublish: (status) => { setNotice(null); publish.mutate({ id: c.id, status }); },
      onCopyLink: () => { void copyLink(c.id); },
      onDelete: () => { if (window.confirm(`Xóa khóa học "${c.title}"? Khóa sẽ biến mất khỏi thư viện của mọi học viên.`)) { setNotice(null); remove.mutate(c.id); } },
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <h1 className="serif m-0 text-[28px] font-extrabold page-title">Khóa học</h1>
          <div className="muted text-[13px]">{counts.all} khóa · bạn đã hoàn thành {counts.done}, đang học {counts.learning}</div>
        </div>
        <span className="flex-grow" />
        <div className="chip-row">
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
      {notice && <div role={notice.ok ? 'status' : 'alert'} className="card px-4 py-3 text-[15px] font-medium" style={notice.ok ? { background: T.tealSoft, color: T.tealText, borderColor: 'transparent' } : { background: T.accentSoft, color: T.accentText, borderColor: 'transparent' }}>{notice.text}</div>}
      <QueryState q={q} rows={3} isEmpty={(d) => d.items.length === 0} empty={{ title: 'Chưa có khóa học', hint: q.data?.canManage ? 'Tạo khóa học đầu tiên cho hội' : 'Chủ hội chưa đăng khóa học nào' }}>
        {() => (shown.length ? <div className="grid-3">{shown.map((c, i) => <CourseCard key={c.id} c={c} slug={slug} manage={q.data?.canManage ? manageFor(c, i) : undefined} />)}</div> : <div className="muted text-[13px] text-center py-8">Không có khóa nào trong mục này</div>)}
      </QueryState>
    </div>
  );
}
