// Lớp học (classroomMain / classroomFreeMain): breadcrumb + tiến độ, giáo trình 360px bên trái, player/nội dung, tài liệu, thảo luận.
// Dưới 1024px: video lên đầu, giáo trình thu thành một dòng "Danh sách bài" bấm mới mở. Điện thoại: nút hoàn thành ghim ở đáy màn hình.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Prog, T } from '@hoiminh/ui';
import { Check, ChevronDown, ChevronLeft, ChevronRight, FileText, List, Lock } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CommentThread } from '@/components/CommentThread';
import { DrivePlayer } from '@/components/DrivePlayer';
import { QueryState } from '@/components/QueryState';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { api } from '@/lib/api';
import { isPremium, useOptionalShell } from '@/lib/community';
import { useLearningLinks } from '@/layouts/LearnerShell';
import { Markdown } from '@/lib/markdown';
import { isVerticalVideoUrl } from '@/lib/youtube';
import { LessonRow, ModuleHead, lessonState, moduleMeta, type LessonLite, type ModuleLite } from './LessonParts';

interface LessonDto {
  lesson: { id: string; title: string; kind: 'video' | 'text' | 'task' | 'file'; contentMd: string; durationSeconds: number | null; videoUrl: string | null };
  embed: { provider: string; externalId: string; embedUrl: string } | null; locked: boolean; sequentialLocked: boolean; dripLocked: boolean; dripUnlocksAt: string | null; lockReason: string | null;
  course: { id: string; title: string; lessonCount: number; communitySlug: string | null; modules: ModuleLite[]; progress: { completedLessons: number; totalLessons: number; percent: number } | null; accessMode: string; product: { id: string; priceMinor: number; slug: string } | null };
  prev: LessonLite | null; next: LessonLite | null; resources: Array<{ id: string; name: string; url: string }>; done: boolean;
}

function Curriculum({ d, lessonHref, className = '' }: { d: LessonDto; lessonHref: (id: string) => string; className?: string }) {
  const currentModule = d.course.modules.find((m) => m.lessons.some((l) => l.id === d.lesson.id))?.id;
  const [open, setOpen] = useState<Record<string, boolean>>(currentModule ? { [currentModule]: true } : {});
  const lockedCount = d.course.modules.flatMap((m) => m.lessons).filter((l) => l.locked).length;
  let noticeShown = false;
  return (
    <div className={`card w-full lg:w-[360px] flex-shrink-0 p-2 flex-col overflow-hidden ${className}`}>
      {d.course.modules.map((m, mi) => {
        const isOpen = open[m.id] ?? false;
        const showNotice = lockedCount > 0 && !noticeShown && m.lessons.some((l) => l.locked);
        if (showNotice) noticeShown = true;
        return (
          <div key={m.id}>
            {showNotice && <div className="mx-1 mt-2 px-3.5 py-3 rounded-xl flex items-center gap-2.5 text-[13px] font-semibold" style={{ background: T.goldSoft, color: T.goldText }}><Lock size={16} />{lockedCount} bài còn lại dành cho Premium</div>}
            <ModuleHead title={`${mi + 1}. ${m.title}`} meta={moduleMeta(m)} open={isOpen} onToggle={() => setOpen((o) => ({ ...o, [m.id]: !isOpen }))} />
            {isOpen && <div className="flex flex-col gap-0.5 px-1">{m.lessons.map((l, li) => <LessonRow key={l.id} lesson={l} state={lessonState(l, d.lesson.id)} to={lessonHref(l.id)} index={`${mi + 1}.${li + 1}`} />)}</div>}
          </div>
        );
      })}
    </div>
  );
}

function LockedPlayer({ d, slug, courseHref }: { d: LessonDto; slug: string; courseHref: string }) {
  const store = d.course.accessMode === 'store_only' || d.lockReason === 'store';
  const to = store ? (d.course.product ? `/${slug}/cua-hang/${d.course.product.slug}` : `/${slug}/cua-hang`) : `/${slug}/thanh-toan?tier=premium&cycle=monthly`;
  const remaining = d.course.modules.flatMap((m) => m.lessons).filter((l) => l.locked).length;
  return (
    <div className="relative rounded-2xl overflow-hidden flex items-center justify-center p-4" style={{ aspectRatio: '16 / 9', background: T.player }}>
      <div className="card relative flex flex-col items-center text-center gap-3 p-6 w-full" style={{ maxWidth: 460 }}>
        <span className="w-12 h-12 rounded-full inline-flex items-center justify-center" style={{ background: T.goldSoft, color: T.goldText }}><Lock size={22} /></span>
        <div className="serif text-[20px] font-extrabold leading-[1.3]">{d.sequentialLocked ? 'Học xong bài trước để mở bài này' : d.dripLocked ? 'Bài này mở theo lịch' : store ? 'Bài này nằm trong khóa bán lẻ' : 'Bài này nằm trong gói Premium'}</div>
        <div className="text-[14px]" style={{ color: T.ink2 }}>{d.sequentialLocked ? 'Khóa này yêu cầu học theo thứ tự. Bấm "Đánh dấu hoàn thành" ở bài trước rồi quay lại.' : d.dripLocked ? `Bài sẽ mở sau khi bạn học được một thời gian trong khóa.` : `Mở khóa ${remaining} bài còn lại, tài nguyên, Q&A hằng tuần${store ? '' : ' và quyền làm affiliate'}.`}</div>
        {!d.dripLocked && !d.sequentialLocked && <div className="flex gap-2 pt-1 flex-wrap justify-center"><Link to={to} className="btn btn-primary">{store ? 'Mua khóa học' : 'Nâng cấp Premium'}</Link><Link to={courseHref} className="btn btn-ghost">Xem quyền lợi</Link></div>}
        <span className="muted text-[12px]">Hủy bất cứ lúc nào · thanh toán bằng chuyển khoản, MoMo, VNPAY</span>
      </div>
    </div>
  );
}

export default function Page() {
  // Trang này chạy ở hai khung: trong hội (/:slug/bai/:id) và ở Khu học tập của người mua lẻ (/hoc/bai/:id).
  const shell = useOptionalShell();
  const { lessonId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => api.get<LessonDto>(`/v1/lessons/${lessonId}`) });
  const slug = shell?.community.slug ?? q.data?.course.communitySlug ?? '';
  const links = useLearningLinks(slug);
  const [listOpen, setListOpen] = useState(false);
  const complete = useMutation({
    mutationFn: () => api.post<{ percent: number; nextLessonId: string | null }>(`/v1/lessons/${lessonId}/complete`, {}),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ['lesson'] }); void qc.invalidateQueries({ queryKey: ['courses'] }); void qc.invalidateQueries({ queryKey: ['library'] }); if (r.nextLessonId) navigate(links.lesson(r.nextLessonId)); },
  });
  return (
    <QueryState q={q} rows={5}>
      {(d) => {
        const p = d.course.progress;
        const free = Boolean(shell) && !isPremium(shell!) && shell!.viewer.role === 'member';
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 md:gap-4 flex-wrap">
              <Link to={links.courses()} className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: T.ink3 }}><ChevronLeft size={16} />{links.learner ? 'Khu học tập' : 'Khóa học'}</Link>
              <span className="hide-mobile" style={{ color: T.line2 }}>/</span>
              <Link to={links.course(d.course.id)} className="serif text-[17px] md:text-[22px] font-bold truncate min-w-0" style={{ color: T.ink }}>{d.course.title}</Link>
              {free && <span className="tag hide-mobile" style={{ background: T.bg, color: T.ink2 }}>Bạn đang ở gói {shell!.viewer.tier?.name ?? 'Tiêu chuẩn'}</span>}
              <span className="flex-grow" />
              <div className="flex items-center gap-3 w-full md:w-[300px]"><span className="muted text-[13px] whitespace-nowrap">{p ? `${p.completedLessons}/${p.totalLessons} bài · ${p.percent}%` : `${d.course.lessonCount} bài`}</span><Prog value={p?.percent ?? 0} className="flex-grow" /></div>
            </div>
            {/* Giáo trình chỉ đứng cạnh nội dung từ 1024px; hẹp hơn thì thu thành dòng "Danh sách bài" như điện thoại. */}
            <div className="flex gap-6 flex-col lg:flex-row">
              <Curriculum d={d} lessonHref={links.lesson} className="hidden lg:flex" />
              <div className="flex-grow flex flex-col gap-4 min-w-0">
                {d.locked ? <LockedPlayer d={d} slug={slug} courseHref={links.course(d.course.id)} /> : d.embed?.provider === 'youtube' ? (
                  // YouTube: trình phát riêng, không bấm sang YouTube được và không hiện video gợi ý. Nền tảng khác giữ khung nhúng gốc.
                  <YouTubePlayer key={d.embed.externalId} videoId={d.embed.externalId} title={d.lesson.title} vertical={isVerticalVideoUrl(d.lesson.videoUrl)} />
                ) : d.embed?.provider === 'gdrive' ? (
                  // Google Drive: khung xem trước của Drive, chặn mở sang Drive (nơi có link gốc và nút tải về).
                  <DrivePlayer key={d.lesson.id} src={d.embed.embedUrl} title={d.lesson.title} />
                ) : d.embed ? (
                  <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '16 / 9', background: T.player }}><iframe src={d.embed.embedUrl} title={d.lesson.title} className="absolute inset-0 w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
                ) : null}
                {/* Tiêu đề và nút cùng một hàng; nội dung bài nằm ở hàng dưới để không bị nút bóp hẹp. */}
                <div className="flex items-start gap-4 flex-wrap">
                  <h1 className="serif m-0 text-[24px] font-bold flex-1 min-w-[240px]" style={{ color: d.locked ? T.ink3 : T.ink }}>{d.lesson.title}</h1>
                  {!d.locked && (
                    <div className="hidden md:flex gap-2 flex-wrap">
                      {d.next && <Link to={links.lesson(d.next.id)} className="btn btn-ghost">Bài tiếp theo <ChevronRight size={16} /></Link>}
                      <Button variant="primary" loading={complete.isPending} disabled={d.done} onClick={() => complete.mutate()}><Check size={18} />{d.done ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}</Button>
                    </div>
                  )}
                </div>
                {d.locked ? <p className="m-0 text-[14px]" style={{ color: T.ink3, maxWidth: 620 }}>Nội dung xem trước: {d.lesson.contentMd}</p> : <div style={{ maxWidth: 760 }}><Markdown md={d.lesson.contentMd} /></div>}
                {/* Điện thoại: giáo trình nằm dưới nội dung bài, mặc định thu gọn để video và bài đọc lên đầu. */}
                <div className="lg:hidden flex flex-col gap-2">
                  <button type="button" onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen} className="card flex items-center gap-3 w-full text-left px-4 min-h-[56px]">
                    <List size={20} style={{ color: T.ink2 }} />
                    <span className="flex-grow font-semibold text-[15px]">Danh sách bài ({d.course.lessonCount})</span>
                    {listOpen ? <ChevronDown size={20} style={{ color: T.ink3 }} /> : <ChevronRight size={20} style={{ color: T.ink3 }} />}
                  </button>
                  {listOpen && <Curriculum d={d} lessonHref={links.lesson} className="flex" />}
                </div>
                {d.resources.length > 0 && <div className="flex gap-2.5 flex-wrap">{d.resources.map((r) => <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="chip"><FileText size={16} />{r.name}</a>)}</div>}
                {!d.locked && <CommentThread targetType="lesson" targetId={d.lesson.id} title={(n) => <>Thảo luận bài học <span className="muted font-medium">· {n}</span></>} placeholder="Đặt câu hỏi về bài này…" />}
                {d.prev && !d.locked && <Link to={links.lesson(d.prev.id)} className="text-[13px] inline-flex items-center gap-1" style={{ color: T.ink3 }}><ChevronLeft size={14} />Bài trước: {d.prev.title}</Link>}
                {d.locked && free && <div className="card px-5 py-4 flex items-center gap-3.5 text-[13px]" style={{ color: T.ink2 }}><span className="flex-grow">Bạn đã học xong các bài miễn phí. Có câu hỏi về nội dung thì đăng ở Bảng tin, chủ hội trả lời trong 24 giờ.</span><Link to={`/${slug}/bang-tin`} className="btn btn-ghost btn-sm">Đến Hỏi đáp</Link></div>}
              </div>
            </div>
            {!d.locked && (
              <>
                <div className="md:hidden h-[76px]" aria-hidden="true" />
                <div className="md:hidden lesson-bar">
                  {d.done ? (
                    d.next ? <Link to={links.lesson(d.next.id)} className="btn btn-primary btn-lg w-full">Bài tiếp theo <ChevronRight size={18} /></Link>
                      : <Link to={links.course(d.course.id)} className="btn btn-ghost btn-lg w-full"><Check size={18} />Đã hoàn thành, về khóa học</Link>
                  ) : (
                    <Button variant="primary" size="lg" block loading={complete.isPending} onClick={() => complete.mutate()}><Check size={18} />{d.next ? 'Xong bài, sang bài tiếp' : 'Đánh dấu hoàn thành'}</Button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}
