// Chi tiết khóa học: bìa, tiến độ, tab Nội dung/Tài liệu/Thảo luận/Về khóa học, module gập/mở, rail tiến độ và giảng viên.
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, ChevronRight, Check, MessageCircle, Pencil, Play, Settings } from 'lucide-react';
import { Prog, T } from '@hoiminh/ui';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { UserAvatar, type UserLite } from '@/components/UserLink';
import { api } from '@/lib/api';
import { useShell } from '@/lib/community';
import { fmtDuration, timeAgo } from '@/lib/format';
import { Markdown } from '@/lib/markdown';
import { InstructorCard, Learners, ProgressRing, ResourceList, type Owner, type Resource } from './CourseOverviewParts';
import { LessonRow, lessonState, type ModuleLite } from './LessonParts';

interface Discussion { id: string; contentMd: string; createdAt: string; replyCount: number; author: UserLite; lesson: { id: string; title: string } }
interface Course {
  id: string; title: string; shortDescription: string; descriptionMd: string; coverColor: string; coverUrl: string | null; accessMode: string; lessonCount: number; totalDurationSeconds: number; certificateEnabled: boolean; status: string;
  owner: Owner | null; modules: ModuleLite[]; progress: { completedLessons: number; totalLessons: number; percent: number; lastLessonId: string | null; lastAccessedAt: string | null } | null;
  access: { allowed: boolean; reason: string | null }; canManage: boolean; resources: Resource[]; discussions: Discussion[]; learners: { total: number; completed: number }; product: { id: string; priceMinor: number; slug: string } | null;
}
type Tab = 'content' | 'resources' | 'discussion' | 'about';

const accessLabel: Record<string, string> = { premium: 'Premium', all_members: 'Mọi thành viên', store_only: 'Cửa hàng', premium_and_store: 'Premium' };

function ModuleBlock({ m, n, slug, open, onToggle }: { m: ModuleLite; n: number; slug: string; open: boolean; onToggle: () => void }) {
  const done = m.lessons.filter((l) => l.done).length;
  const total = m.lessons.length;
  const mins = fmtDuration(m.lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0), true);
  const tone = total && done === total ? { background: T.tealSoft, color: T.tealText } : done > 0 ? { background: T.accentSoft, color: T.accentText } : { background: T.bg, color: T.ink3 };
  return (
    <div style={{ borderTop: `1px solid ${T.line}` }}>
      <button type="button" onClick={onToggle} className="flex items-center gap-3.5 w-full text-left px-5 py-3.5" aria-expanded={open}>
        <span className="w-[34px] h-[34px] rounded-[10px] inline-flex items-center justify-center serif font-extrabold flex-shrink-0" style={tone}>{total && done === total ? <Check size={16} /> : n}</span>
        <div className="flex-grow min-w-0"><div className="font-semibold truncate">{m.title}</div><div className="muted text-[12px]">{total} bài{mins ? ` · ${mins}` : ''}</div></div>
        <div className="hide-mobile flex items-center gap-2.5 w-40"><Prog value={total ? (done / total) * 100 : 0} className="flex-grow" /><span className="muted text-[12px] w-8 text-right">{done}/{total}</span></div>
        <span style={{ color: T.ink3 }}>{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 pb-3 pr-5 pl-5 md:pl-[68px]">
          {m.lessons.map((l, i) => <LessonRow key={l.id} lesson={l} state={lessonState(l)} to={`/${slug}/bai/${l.id}`} index={`${n}.${i + 1}`} />)}
        </div>
      )}
    </div>
  );
}

function Body({ c, slug }: { c: Course; slug: string }) {
  const [tab, setTab] = useState<Tab>('content');
  const firstLesson = c.modules.flatMap((m) => m.lessons)[0];
  const current = c.modules.flatMap((m) => m.lessons).find((l) => l.current);
  const initialOpen = c.modules.findIndex((m) => m.lessons.some((l) => l.current || !l.done));
  const [open, setOpen] = useState<Set<string>>(new Set(c.modules[initialOpen >= 0 ? initialOpen : 0]?.id ? [c.modules[initialOpen >= 0 ? initialOpen : 0]!.id] : []));
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pct = c.progress?.percent ?? 0;
  const startTo = c.progress?.lastLessonId ? `/${slug}/bai/${c.progress.lastLessonId}` : firstLesson ? `/${slug}/bai/${firstLesson.id}` : `/${slug}/khoa-hoc/${c.id}/soan`;
  const tabs: Array<[Tab, string]> = [['content', 'Nội dung'], ['resources', `Tài liệu · ${c.resources.length}`], ['discussion', `Thảo luận · ${c.discussions.length}`], ['about', 'Về khóa học']];
  const remaining = fmtDuration(Math.round(c.totalDurationSeconds * (1 - pct / 100)), true);
  return (
    <>
      <div className="card overflow-hidden">
        <div className="h-[220px] flex items-end p-6 relative" style={{ background: c.coverUrl ? `url(${c.coverUrl}) center/cover` : c.coverColor }}>
          <span className="tag absolute top-5 left-6" style={{ background: 'rgba(255,253,249,0.2)', color: T.surface, height: 26, padding: '0 10px' }}>Khóa học · {accessLabel[c.accessMode] ?? c.accessMode}</span>
          <div style={{ color: T.surface }}>
            <div className="serif text-[34px] font-extrabold leading-[1.1]">{c.title}</div>
            <div className="text-[14px] mt-1.5 opacity-85">{c.modules.length} module · {c.lessonCount} bài · {fmtDuration(c.totalDurationSeconds, true)}{c.owner ? ` · ${c.owner.name}` : ''}</div>
          </div>
        </div>
        <div className="px-6 py-5 flex items-center gap-5 flex-wrap">
          <div className="flex-grow flex flex-col gap-2 min-w-[200px]">
            <div className="flex items-center gap-2.5 text-[13px]"><span className="font-semibold">Tiến độ {pct}%</span><span className="muted">· {c.progress?.completedLessons ?? 0}/{c.lessonCount} bài{remaining && pct < 100 ? ` · còn khoảng ${remaining}` : ''}</span></div>
            <Prog value={pct} height={8} />
            {current && <div className="muted text-[12px]">Đang ở bài <strong style={{ color: T.ink }}>{current.title}</strong>{c.progress?.lastAccessedAt ? ` · học lần cuối ${timeAgo(c.progress.lastAccessedAt)}` : ''}</div>}
          </div>
          {c.canManage && (
            <>
              <Link to={`/${slug}/khoa-hoc/${c.id}/soan`} className="btn btn-ghost"><Pencil size={16} /> Soạn nội dung</Link>
              <Link to={`/${slug}/khoa-hoc/${c.id}/sua`} className="btn btn-ghost" aria-label="Sửa thông tin"><Settings size={16} /> Sửa thông tin</Link>
            </>
          )}
          {(c.access.allowed || firstLesson?.isPreview) && <Link to={startTo} className="btn btn-primary btn-lg"><Play size={16} /> {pct > 0 ? 'Tiếp tục học' : 'Bắt đầu học'}</Link>}
          {!c.access.allowed && !c.canManage && <Link to={c.product ? `/${slug}/thanh-toan?product=${c.product.id}` : `/${slug}/thanh-toan?tier=premium&cycle=monthly`} className="btn btn-primary btn-lg">Nâng cấp để mở</Link>}
        </div>
      </div>
      <div className="flex gap-5 overflow-x-auto" style={{ borderBottom: `1px solid ${T.line}` }}>
        {tabs.map(([k, label]) => <button key={k} type="button" onClick={() => setTab(k)} className="py-2.5 px-0.5 text-[14px] whitespace-nowrap" style={{ borderBottom: `2px solid ${tab === k ? T.ink : 'transparent'}`, fontWeight: tab === k ? 700 : 500, color: tab === k ? T.ink : T.ink2 }}>{label}</button>)}
      </div>
      {tab === 'content' && (
        <div className="card overflow-hidden">
          <div className="flex items-center px-5 py-3.5"><span className="font-semibold">Nội dung khóa học</span><span className="flex-grow" /><button type="button" className="text-[13px] font-semibold" style={{ color: T.teal }} onClick={() => setOpen(open.size === c.modules.length ? new Set() : new Set(c.modules.map((m) => m.id)))}>{open.size === c.modules.length ? 'Gập tất cả' : 'Mở tất cả'}</button></div>
          {c.modules.length === 0 && <div className="muted text-[13px] px-5 pb-4">Khóa học chưa có nội dung</div>}
          {c.modules.map((m, i) => <ModuleBlock key={m.id} m={m} n={i + 1} slug={slug} open={open.has(m.id)} onToggle={() => toggle(m.id)} />)}
        </div>
      )}
      {tab === 'resources' && <ResourceList resources={c.resources} />}
      {tab === 'about' && <div className="card px-6 py-5">{c.descriptionMd ? <Markdown md={c.descriptionMd} /> : <span className="muted text-[13px]">{c.shortDescription || 'Chưa có mô tả'}</span>}</div>}
      {(tab === 'content' || tab === 'discussion') && (
        <div className="card px-6 py-[22px] flex flex-col gap-3">
          <div className="flex items-center"><span className="font-bold text-[16px]">Thảo luận gần đây trong khóa</span></div>
          {c.discussions.length === 0 && <span className="muted text-[13px]">Chưa có thảo luận nào</span>}
          {c.discussions.map((d) => (
            <div key={d.id} className="flex gap-3 items-start pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
              <UserAvatar user={d.author} size={32} />
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 text-[13px] flex-wrap"><span className="font-semibold">{d.author.name}</span><Link to={`/${slug}/bai/${d.lesson.id}`} className="tag" style={{ background: T.bg, color: T.ink2, height: 18, padding: '0 6px', fontSize: 11 }}>{d.lesson.title}</Link><span className="muted">· {timeAgo(d.createdAt)}</span></div>
                <div className="text-[14px] mt-0.5 line-clamp-2">{d.contentMd}</div>
              </div>
              <span className="muted text-[12px] inline-flex items-center gap-1 flex-shrink-0"><MessageCircle size={14} /> {d.replyCount}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function Page() {
  const { courseId = '' } = useParams();
  const shell = useShell();
  const slug = shell.community.slug;
  const q = useQuery({ queryKey: ['course', courseId], queryFn: () => api.get<Course>(`/v1/courses/${courseId}`), enabled: Boolean(courseId) });
  const c = q.data;
  const watched = c ? c.modules.flatMap((m) => m.lessons).filter((l) => l.done).reduce((s, l) => s + (l.durationSeconds ?? 0), 0) : 0;
  return (
    <div className="two-col">
      <div className="main" style={{ gap: 20 }}>
        <Link to={`/${slug}/khoa-hoc`} className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: T.ink3 }}><ChevronLeft size={16} /> Khóa học</Link>
        <QueryState q={q} rows={2}>{(d) => <Body c={d} slug={slug} />}</QueryState>
      </div>
      {c && (
        <aside className="rail">
          <ProgressRing percent={c.progress?.percent ?? 0} doneLessons={c.progress?.completedLessons ?? 0} watchedSeconds={watched} lastAccessedAt={c.progress?.lastAccessedAt ?? null} certificate={c.certificateEnabled} courseId={c.id} />
          <ResourceList resources={c.resources} />
          <InstructorCard owner={c.owner} communityId={shell.community.id} />
          <Learners total={c.learners.total} completed={c.learners.completed} sample={c.discussions.map((d) => d.author).filter((u, i, a) => a.findIndex((x) => x.handle === u.handle) === i).slice(0, 6)} />
        </aside>
      )}
    </div>
  );
}
