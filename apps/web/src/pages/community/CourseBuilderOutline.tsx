// Cột trái Soạn khóa học: danh sách module/bài, kéo thả sắp xếp (HTML5 DnD), thêm module/bài, đổi tên module tại chỗ, nhập nhanh từ link.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { ChevronDown, ChevronRight, Download, GripVertical, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { fmtDuration } from '@/lib/format';
import { fetchVideoMeta, KIND_ICON, PLACEHOLDER_TITLE, type LessonKind } from './CourseBuilderParts';

export interface OutlineLesson { id: string; title: string; kind: LessonKind; durationSeconds: number | null; isPreview: boolean }
export interface OutlineModule { id: string; title: string; lessons: OutlineLesson[] }

function LessonItem({ l, on, onSelect, onDragStart, onDrop, onDelete }: { l: OutlineLesson; on: boolean; onSelect: () => void; onDragStart: () => void; onDrop: () => void; onDelete: () => void }) {
  const dur = l.kind === 'task' ? 'Bài tập' : l.kind === 'file' ? 'Tài liệu' : fmtDuration(l.durationSeconds);
  return (
    <div draggable onDragStart={onDragStart} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onDrop(); }} onClick={onSelect} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
      className="flex items-center gap-2.5 rounded-[10px] text-[13px] cursor-pointer" style={{ padding: '8px 10px 8px 6px', background: on ? T.accentSoft : 'transparent' }}>
      <span style={{ color: T.line2 }}><GripVertical size={14} /></span>
      <span className="w-6 h-6 rounded-md inline-flex items-center justify-center flex-shrink-0" style={{ background: on ? T.surface : T.bg, color: T.ink2 }}>{KIND_ICON[l.kind]}</span>
      <span className="flex-grow min-w-0 truncate" title={l.title} style={{ fontWeight: on ? 600 : 400 }}>{l.title}</span>
      {l.isPreview && <span className="tag" style={{ background: T.tealSoft, color: T.tealText, height: 18, padding: '0 5px', fontSize: 10 }}>Xem thử</span>}
      <span className="muted text-[11px]">{dur}</span>
      {on && <button type="button" aria-label="Xóa bài" title="Xóa bài" style={{ color: T.ink3 }} onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={14} /></button>}
    </div>
  );
}

export function Outline({ courseId, modules, selected, onSelect, onOpenImport, onModuleOpen, onLessonsRenamed }: { courseId: string; modules: OutlineModule[]; selected: string | null; onSelect: (id: string) => void; onOpenImport: () => void; onModuleOpen: (id: string | null) => void; onLessonsRenamed: (lessonIds: string[]) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Record<string, boolean>>(() => (modules[0] ? { [modules[0].id]: true } : {}));
  const [drag, setDrag] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['course', courseId] });
  const addModule = useMutation({ mutationFn: () => api.post<{ id: string }>(`/v1/courses/${courseId}/modules`, { title: `Module ${modules.length + 1}` }), onSuccess: (m) => { setOpen((o) => ({ ...o, [m.id]: true })); void refresh(); } });
  const addLesson = useMutation({
    mutationFn: (moduleId: string) => api.post<{ id: string }>(`/v1/courses/${courseId}/lessons`, { moduleId, title: 'Bài mới', kind: 'video' }),
    onSuccess: (l) => { onSelect(l.id); void refresh(); },
  });
  // Xóa bài / module: API đã có từ đầu nhưng không nút nào gọi, nên bài tạo nhầm phải xóa bằng SQL.
  const delLesson = useMutation({ mutationFn: (id: string) => api.del(`/v1/lessons/${id}`), onSuccess: () => void refresh() });
  const delModule = useMutation({ mutationFn: (id: string) => api.del(`/v1/modules/${id}`), onSuccess: () => void refresh() });
  // Đổi tên module tại chỗ: bấm vào tên hoặc nút bút chì, Enter hoặc bấm ra ngoài để lưu, Esc để hủy.
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const editCancelled = useRef(false);
  const renameModule = useMutation({ mutationFn: (v: { id: string; title: string }) => api.patch(`/v1/courses/${courseId}/modules/${v.id}`, { title: v.title }), onSuccess: () => void refresh() });
  const startEdit = (m: OutlineModule) => { editCancelled.current = false; setEditing({ id: m.id, title: m.title }); };
  const commitEdit = (m: OutlineModule) => {
    const title = editing?.title.trim() ?? '';
    setEditing(null);
    if (!editCancelled.current && title && title !== m.title) renameModule.mutate({ id: m.id, title });
  };
  const reorder = useMutation({ mutationFn: (mods: OutlineModule[]) => api.put(`/v1/courses/${courseId}/reorder`, { modules: mods.map((m, i) => ({ id: m.id, sortOrder: i, lessonIds: m.lessons.map((l) => l.id) })) }), onSuccess: () => void refresh() });
  // Bài nhập từ link trước đây mang tên tạm "Bài 1 · YouTube <mã video>": lấy tên thật, mô tả và thời lượng về một lượt.
  // Nội dung và thời lượng người soạn đã tự điền thì giữ nguyên.
  const placeholders = modules.flatMap((m) => m.lessons).filter((l) => PLACEHOLDER_TITLE.test(l.title));
  const rename = useMutation({
    mutationFn: async () => {
      const renamed: string[] = [];
      try {
        for (const l of placeholders) {
          const cur = (await api.get<{ lesson: { videoUrl: string | null; contentMd: string; durationSeconds: number | null } }>(`/v1/lessons/${l.id}`)).lesson;
          const meta = cur.videoUrl ? (await fetchVideoMeta(cur.videoUrl)).meta : null;
          if (!meta) continue;
          await api.patch(`/v1/courses/${courseId}/lessons/${l.id}`, { title: meta.title, ...(cur.contentMd.trim() ? {} : { contentMd: meta.description }), ...(cur.durationSeconds ? {} : { durationSeconds: meta.durationSeconds }) });
          qc.removeQueries({ queryKey: ['lesson', l.id] });
          renamed.push(l.id);
        }
      } finally {
        onLessonsRenamed(renamed);
      }
      return renamed.length;
    },
    onSettled: () => void refresh(),
  });
  const openModuleId = modules.find((m) => open[m.id])?.id ?? null;
  const total = modules.reduce((n, m) => n + m.lessons.length, 0);

  const moveLesson = (targetModule: string, beforeLessonId: string | null) => {
    if (!drag) return;
    const src = modules.find((m) => m.lessons.some((l) => l.id === drag));
    const lesson = src?.lessons.find((l) => l.id === drag);
    if (!src || !lesson || drag === beforeLessonId) return;
    const next = modules.map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== drag) }));
    const tgt = next.find((m) => m.id === targetModule);
    if (!tgt) return;
    const idx = beforeLessonId ? tgt.lessons.findIndex((l) => l.id === beforeLessonId) : tgt.lessons.length;
    tgt.lessons.splice(idx < 0 ? tgt.lessons.length : idx, 0, lesson);
    setDrag(null);
    reorder.mutate(next);
  };
  const toggle = (id: string) => { const now = !(open[id] ?? false); setOpen((o) => ({ ...o, [id]: now })); onModuleOpen(now ? id : null); };

  return (
    <div className="card w-full md:w-[340px] flex-shrink-0 p-2.5 flex flex-col gap-1">
      <div className="flex items-center" style={{ padding: '6px 8px 8px' }}><span className="font-semibold text-[13px] flex-grow">Nội dung · {modules.length} module · {total} bài</span><span className="muted text-[11px]">kéo để sắp xếp</span></div>
      {modules.map((m, i) => (
        <div key={m.id} className="flex flex-col gap-0.5" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); moveLesson(m.id, null); }}>
          <div className="flex items-center gap-2" style={{ padding: '10px 8px 6px' }}>
            <span style={{ color: T.line2 }}><GripVertical size={14} /></span>
            <button type="button" onClick={() => toggle(m.id)} style={{ color: T.ink3 }} aria-label="Gập/mở">{open[m.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
            {editing?.id === m.id ? (
              <input autoFocus aria-label="Tên module" maxLength={120} value={editing.title} onChange={(e) => setEditing({ id: m.id, title: e.target.value })} onFocus={(e) => e.target.select()} onBlur={() => commitEdit(m)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { editCancelled.current = true; e.currentTarget.blur(); } }}
                className="flex-grow min-w-0 font-bold text-[16px] md:text-[13px] rounded-md px-1.5" style={{ height: 30, background: T.surface, color: T.ink, border: `1px solid ${T.ink3}` }} />
            ) : (
              <button type="button" onClick={() => startEdit(m)} title="Bấm để đổi tên module" className="flex-grow min-w-0 font-bold text-[13px] truncate text-left">{i + 1}. {renameModule.isPending && renameModule.variables?.id === m.id ? renameModule.variables.title : m.title}</button>
            )}
            <span className="muted text-[11px]">{m.lessons.length} bài</span>
            <button type="button" onClick={() => startEdit(m)} style={{ color: T.ink3 }} aria-label="Đổi tên module" title="Đổi tên module"><Pencil size={14} /></button>
            <button type="button" onClick={() => addLesson.mutate(m.id)} style={{ color: T.ink3 }} aria-label="Thêm bài"><Plus size={14} /></button>
            <button type="button" onClick={() => { if (window.confirm(m.lessons.length ? `Xóa module "${m.title}" và ${m.lessons.length} bài trong đó?` : `Xóa module "${m.title}"?`)) delModule.mutate(m.id); }} style={{ color: T.ink3 }} aria-label="Xóa module" title="Xóa module"><Trash2 size={14} /></button>
          </div>
          {open[m.id] && m.lessons.map((l) => <LessonItem key={l.id} l={l} on={selected === l.id} onSelect={() => onSelect(l.id)} onDragStart={() => setDrag(l.id)} onDrop={() => moveLesson(m.id, l.id)} onDelete={() => { if (window.confirm(`Xóa bài "${l.title}"?`)) delLesson.mutate(l.id); }} />)}
        </div>
      ))}
      <div className="flex gap-1.5" style={{ padding: '8px 4px 2px' }}>
        <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={() => addModule.mutate()} disabled={addModule.isPending}><Plus size={14} />Module</button>
        <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={() => openModuleId && addLesson.mutate(openModuleId)} disabled={!openModuleId || addLesson.isPending}><Plus size={14} />Bài</button>
      </div>
      {renameModule.isError && <span className="text-[12px] px-2" style={{ color: T.accentText }}>{errorMessage(renameModule.error)}</span>}
      {(placeholders.length > 0 || rename.isSuccess || rename.isError) && (
        <div className="flex flex-col gap-1.5" style={{ padding: '6px 4px 2px' }}>
          {placeholders.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => rename.mutate()} disabled={rename.isPending}><Download size={14} />{rename.isPending ? 'Đang lấy từ YouTube…' : `Lấy tên từ YouTube cho ${placeholders.length} bài`}</button>}
          {rename.isSuccess && !rename.isPending && <span className="text-[12px] px-1" style={{ color: rename.data > 0 ? T.teal : T.accentText }}>{rename.data > 0 ? `Đã đổi tên ${rename.data} bài theo YouTube.` : 'Chưa lấy được tên từ YouTube. Video riêng tư hoặc YouTube không trả lời, thử lại sau.'}</span>}
          {rename.isError && <span className="text-[12px] px-1" style={{ color: T.accentText }}>{errorMessage(rename.error)}</span>}
        </div>
      )}
      <button type="button" onClick={onOpenImport} className="mt-auto px-3 py-2.5 rounded-[10px] text-[12px] flex gap-2 items-start text-left" style={{ background: T.bg, color: T.ink2 }}><Sparkles size={14} className="flex-shrink-0 mt-0.5" /><span>Có thể nhập nhanh từ danh sách link YouTube, mỗi link thành một bài, lấy luôn tên và mô tả.</span></button>
    </div>
  );
}
