// Soạn nội dung khóa học (courseBuilderMain): header trạng thái + Đăng, cột giáo trình, khung soạn bài (LessonForm).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, T } from '@hoiminh/ui';
import { Check, ChevronLeft, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useCan, useShell } from '@/lib/community';
import { timeAgo } from '@/lib/format';
import { BulkImportModal, LessonForm } from './CourseBuilderParts';
import { Outline, type OutlineModule } from './CourseBuilderOutline';

interface Course { id: string; title: string; status: 'draft' | 'published' | 'archived'; updatedAt: string; modules: OutlineModule[]; canManage: boolean }

export default function Page() {
  const shell = useShell();
  const can = useCan();
  const slug = shell.community.slug;
  const { courseId = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['course', courseId], queryFn: () => api.get<Course>(`/v1/courses/${courseId}`) });
  const [selected, setSelected] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [openModule, setOpenModule] = useState<string | null>(null);
  const publish = useMutation({
    mutationFn: (status: 'published' | 'draft') => api.patch(`/v1/courses/${courseId}`, { status }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['course', courseId] }); void qc.invalidateQueries({ queryKey: ['courses'] }); },
  });
  const first = q.data?.modules.flatMap((m) => m.lessons)[0]?.id ?? null;
  useEffect(() => { if (!selected && first) setSelected(first); }, [first, selected]);
  if (!can('course.manage')) return <Navigate to={`/${slug}/khoa-hoc`} replace />;

  return (
    <QueryState q={q} rows={5}>
      {(c) => {
        const pos = (() => {
          for (const [mi, m] of c.modules.entries()) { const li = m.lessons.findIndex((l) => l.id === selected); if (li >= 0) return { mi, li }; }
          return null;
        })();
        const modOpen = openModule ?? c.modules[0]?.id ?? null;
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Link to={`/${slug}/khoa-hoc/${c.id}/sua`} className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: T.ink3 }}><ChevronLeft size={16} />Thông tin khóa</Link>
              <span style={{ color: T.line2 }}>/</span>
              <h1 className="serif m-0 text-[22px] font-extrabold truncate">{c.title}</h1>
              <span className="tag" style={c.status === 'published' ? { background: T.tealSoft, color: T.tealText } : { background: T.bg, color: T.ink3 }}>{c.status === 'published' ? 'Đã đăng' : c.status === 'archived' ? 'Lưu trữ' : 'Nháp'}</span>
              <span className="muted text-[12px]">Đã lưu {timeAgo(c.updatedAt)}</span>
              <span className="flex-grow" />
              <Link to={`/${slug}/khoa-hoc/${c.id}`} className="btn btn-ghost btn-sm"><User size={14} />Xem như học viên</Link>
              {c.status === 'published'
                ? <Button size="sm" loading={publish.isPending} onClick={() => publish.mutate('draft')}>Gỡ về nháp</Button>
                : <Button size="sm" variant="primary" loading={publish.isPending} onClick={() => publish.mutate('published')}><Check size={14} />Đăng khóa học</Button>}
            </div>
            {publish.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(publish.error)}</div>}
            <div className="flex gap-5 flex-col md:flex-row">
              <Outline courseId={c.id} modules={c.modules} selected={selected} onSelect={setSelected} onOpenImport={() => setImportOpen(true)} onModuleOpen={setOpenModule} />
              <div className="card flex-grow min-w-0 flex flex-col overflow-hidden" style={{ padding: 0 }}>
                {selected && pos ? (
                  <LessonForm key={selected} courseId={c.id} lessonId={selected} communityId={shell.community.id} moduleIndex={pos.mi} lessonIndex={pos.li} previewUrl={`/${slug}/bai/${selected}`} />
                ) : (
                  <div className="p-8 text-center muted text-[13px]">Thêm module và bài học ở cột bên trái, hoặc nhập nhanh từ danh sách link YouTube.</div>
                )}
              </div>
            </div>
            <BulkImportModal open={importOpen} onClose={() => setImportOpen(false)} courseId={c.id} moduleId={modOpen} />
          </div>
        );
      }}
    </QueryState>
  );
}
