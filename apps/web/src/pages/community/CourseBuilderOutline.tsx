// Cột trái Soạn khóa học: danh sách module/bài, kéo thả sắp xếp (HTML5 DnD), thêm module/bài, nhập nhanh từ link.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { ChevronDown, ChevronRight, GripVertical, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtDuration } from '@/lib/format';
import { KIND_ICON, type LessonKind } from './CourseBuilderParts';

export interface OutlineLesson { id: string; title: string; kind: LessonKind; durationSeconds: number | null; isPreview: boolean }
export interface OutlineModule { id: string; title: string; lessons: OutlineLesson[] }

function LessonItem({ l, on, onSelect, onDragStart, onDrop }: { l: OutlineLesson; on: boolean; onSelect: () => void; onDragStart: () => void; onDrop: () => void }) {
  const dur = l.kind === 'task' ? 'Bài tập' : l.kind === 'file' ? 'Tài liệu' : fmtDuration(l.durationSeconds);
  return (
    <div draggable onDragStart={onDragStart} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onDrop(); }} onClick={onSelect} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
      className="flex items-center gap-2.5 rounded-[10px] text-[13px] cursor-pointer" style={{ padding: '8px 10px 8px 6px', background: on ? T.accentSoft : 'transparent' }}>
      <span style={{ color: T.line2 }}><GripVertical size={14} /></span>
      <span className="w-6 h-6 rounded-md inline-flex items-center justify-center flex-shrink-0" style={{ background: on ? T.surface : T.bg, color: T.ink2 }}>{KIND_ICON[l.kind]}</span>
      <span className="flex-grow min-w-0 truncate" style={{ fontWeight: on ? 600 : 400 }}>{l.title}</span>
      {l.isPreview && <span className="tag" style={{ background: T.tealSoft, color: T.tealText, height: 18, padding: '0 5px', fontSize: 10 }}>Xem thử</span>}
      <span className="muted text-[11px]">{dur}</span>
    </div>
  );
}

export function Outline({ courseId, modules, selected, onSelect, onOpenImport, onModuleOpen }: { courseId: string; modules: OutlineModule[]; selected: string | null; onSelect: (id: string) => void; onOpenImport: () => void; onModuleOpen: (id: string | null) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Record<string, boolean>>(() => (modules[0] ? { [modules[0].id]: true } : {}));
  const [drag, setDrag] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['course', courseId] });
  const addModule = useMutation({ mutationFn: () => api.post<{ id: string }>(`/v1/courses/${courseId}/modules`, { title: `Module ${modules.length + 1}` }), onSuccess: (m) => { setOpen((o) => ({ ...o, [m.id]: true })); void refresh(); } });
  const addLesson = useMutation({
    mutationFn: (moduleId: string) => api.post<{ id: string }>(`/v1/courses/${courseId}/lessons`, { moduleId, title: 'Bài mới', kind: 'video' }),
    onSuccess: (l) => { onSelect(l.id); void refresh(); },
  });
  const reorder = useMutation({ mutationFn: (mods: OutlineModule[]) => api.put(`/v1/courses/${courseId}/reorder`, { modules: mods.map((m, i) => ({ id: m.id, sortOrder: i, lessonIds: m.lessons.map((l) => l.id) })) }), onSuccess: () => void refresh() });
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
            <span className="flex-grow font-bold text-[13px] truncate">{i + 1}. {m.title}</span>
            <span className="muted text-[11px]">{m.lessons.length} bài</span>
            <button type="button" onClick={() => addLesson.mutate(m.id)} style={{ color: T.ink3 }} aria-label="Thêm bài"><Plus size={14} /></button>
          </div>
          {open[m.id] && m.lessons.map((l) => <LessonItem key={l.id} l={l} on={selected === l.id} onSelect={() => onSelect(l.id)} onDragStart={() => setDrag(l.id)} onDrop={() => moveLesson(m.id, l.id)} />)}
        </div>
      ))}
      <div className="flex gap-1.5" style={{ padding: '8px 4px 2px' }}>
        <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={() => addModule.mutate()} disabled={addModule.isPending}><Plus size={14} />Module</button>
        <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={() => openModuleId && addLesson.mutate(openModuleId)} disabled={!openModuleId || addLesson.isPending}><Plus size={14} />Bài</button>
      </div>
      <button type="button" onClick={onOpenImport} className="mt-auto px-3 py-2.5 rounded-[10px] text-[12px] flex gap-2 items-start text-left" style={{ background: T.bg, color: T.ink2 }}><Sparkles size={14} className="flex-shrink-0 mt-0.5" /><span>Có thể nhập nhanh từ danh sách link YouTube, mỗi link thành một bài.</span></button>
    </div>
  );
}
