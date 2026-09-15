// Tạo khóa học (/khoa-hoc/moi) và sửa thông tin khóa (/khoa-hoc/:courseId/sua): một màn, 4 bước chip, rail xem trước.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, ErrorBox, T, Tag } from '@hoiminh/ui';
import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb } from '@/components/EditorBits';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useCan, useShell } from '@/lib/community';
import { AccessBlock, AdvancedBlock, CourseRail, EMPTY_COURSE, InfoBlock, type CourseForm } from './CourseCreateParts';

interface CourseDto extends Omit<CourseForm, 'introVideoUrl' | 'coverFileId'> { id: string; introVideoUrl: string | null; lessonCount: number; status: string }
const STEPS = ['1 · Thông tin', '2 · Quyền truy cập', '3 · Nội dung', '4 · Đăng'];

function toForm(c: CourseDto): CourseForm {
  return { ...EMPTY_COURSE, title: c.title, shortDescription: c.shortDescription, descriptionMd: c.descriptionMd, coverUrl: c.coverUrl, coverColor: c.coverColor, introVideoUrl: c.introVideoUrl ?? '', accessMode: c.accessMode, priceMinor: c.priceMinor, compareAtMinor: c.compareAtMinor, previewFirstModule: c.previewFirstModule, affiliateEnabled: c.affiliateEnabled, dripEnabled: c.dripEnabled, certificateEnabled: c.certificateEnabled, sequential: c.sequential, hiddenFromStore: c.hiddenFromStore };
}
function toBody(f: CourseForm) {
  const sells = f.accessMode === 'store_only' || f.accessMode === 'premium_and_store';
  return { title: f.title.trim(), shortDescription: f.shortDescription.trim(), descriptionMd: f.descriptionMd, coverFileId: f.coverFileId ?? undefined, coverColor: f.coverColor, introVideoUrl: f.introVideoUrl.trim() || null, accessMode: f.accessMode, priceMinor: sells ? f.priceMinor : null, compareAtMinor: sells ? f.compareAtMinor : null, previewFirstModule: f.previewFirstModule, affiliateEnabled: f.affiliateEnabled, dripEnabled: f.dripEnabled, certificateEnabled: f.certificateEnabled, sequential: f.sequential, hiddenFromStore: f.hiddenFromStore };
}

export default function Page() {
  const { courseId } = useParams();
  const shell = useShell();
  const can = useCan();
  const existing = useQuery({ queryKey: ['course', courseId], queryFn: () => api.get<CourseDto>(`/v1/courses/${courseId}`), enabled: Boolean(courseId) });
  if (!can('course.manage')) return <Empty title="Bạn không có quyền" hint="Chỉ quản trị viên mới tạo được khóa học" />;
  if (courseId && existing.isLoading) return <LoadingBlock />;
  if (courseId && existing.isError) return <ErrorBox message={errorMessage(existing.error)} onRetry={() => void existing.refetch()} />;
  return <CourseEditor key={courseId ?? 'new'} slug={shell.community.slug} communityId={shell.community.id} course={existing.data ?? null} />;
}

function CourseEditor({ slug, communityId, course }: { slug: string; communityId: string; course: CourseDto | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState<CourseForm>(course ? toForm(course) : EMPTY_COURSE);
  const [provider, setProvider] = useState<string | null | undefined>(course?.introVideoUrl ? 'youtube' : undefined);
  const [uploading, setUploading] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const dirty = useRef(false);
  const patch = (p: Partial<CourseForm>) => { dirty.current = true; setF((prev) => ({ ...prev, ...p })); };
  const base = `/${slug}/khoa-hoc`;

  useEffect(() => {
    const url = f.introVideoUrl.trim();
    if (!url) { setProvider(undefined); return; }
    const t = setTimeout(() => { void api.post<{ embed: { provider: string } | null }>('/v1/video/parse', { url }).then((r) => setProvider(r.embed?.provider ?? null)).catch(() => setProvider(null)); }, 500);
    return () => clearTimeout(t);
  }, [f.introVideoUrl]);

  const save = useMutation({
    mutationFn: () => course ? api.patch<CourseDto>(`/v1/courses/${course.id}`, toBody(f)) : api.post<CourseDto>(`/v1/communities/${communityId}/courses`, toBody(f)),
    onSuccess: (c) => { setErr(null); setSavedAt(new Date()); dirty.current = false; void qc.invalidateQueries({ queryKey: ['course', c.id] }); void qc.invalidateQueries({ queryKey: ['courses', communityId] }); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const valid = f.title.trim().length >= 3;
  const saveDraft = () => save.mutateAsync().then((c) => { if (!course) navigate(`${base}/${c.id}/sua`, { replace: true }); }).catch(() => null);
  const next = () => save.mutateAsync().then((c) => navigate(`${base}/${c.id}/soan`)).catch(() => null);

  // Tự lưu khi đang sửa khóa đã có, sau 2 giây không gõ.
  useEffect(() => {
    if (!course || !dirty.current || !valid) return;
    const t = setTimeout(() => { if (!save.isPending) save.mutate(); }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, course, valid]);

  const onCover = async (file: File) => {
    setUploading(true);
    try { const r = await api.upload(file, 'cover', { communityId }); patch({ coverFileId: r.fileId, coverUrl: r.url }); } catch (e) { setErr(errorMessage(e)); } finally { setUploading(false); }
  };

  return (
    <div className="two-col">
      <div className="main">
        <Breadcrumb to={base} label="Khóa học" title={course ? 'Sửa khóa học' : 'Tạo khóa học'}>
          <Tag tone="neutral">{course ? (savedAt ? `Nháp · đã lưu ${savedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Nháp · tự lưu') : 'Nháp'}</Tag>
          <span className="flex-grow" />
          <Button size="sm" loading={save.isPending} disabled={!valid} onClick={() => void saveDraft()}>Lưu nháp</Button>
          <Button size="sm" variant="dark" disabled={!valid} loading={save.isPending} onClick={() => void next()}>Tiếp tục: soạn nội dung <ChevronRight size={14} /></Button>
        </Breadcrumb>
        <div className="flex gap-2 flex-wrap">
          {STEPS.map((t, i) => <span key={t} className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full" style={{ padding: '6px 12px', ...(i < 2 ? { background: T.ink, color: T.surface } : { background: T.bg, color: T.ink3 }) }}>{t}</span>)}
        </div>
        {err && <div className="card px-4 py-3 text-[13px]" style={{ color: T.accentText, borderColor: T.accentSoft }}>{err}</div>}
        <InfoBlock f={f} patch={patch} provider={provider} onCover={(file) => void onCover(file)} uploading={uploading} />
        <AccessBlock f={f} patch={patch} />
        <AdvancedBlock f={f} patch={patch} />
      </div>
      <aside className="rail"><CourseRail f={f} lessonCount={course?.lessonCount ?? 0} provider={provider} /></aside>
    </div>
  );
}
