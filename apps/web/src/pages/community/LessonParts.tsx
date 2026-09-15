// Dòng bài học (done/now/todo/lock) và đầu module gập/mở, dùng chung cho Khóa học và Lớp học.
import { T } from '@hoiminh/ui';
import { Check, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fmtDuration } from '@/lib/format';

export interface LessonLite { id: string; title: string; kind: 'video' | 'text' | 'task' | 'file'; durationSeconds: number | null; isPreview: boolean; done: boolean; locked: boolean; current: boolean }
export interface ModuleLite { id: string; title: string; lessons: LessonLite[] }
export type LessonState = 'done' | 'now' | 'todo' | 'lock';

export function lessonState(l: LessonLite, currentId?: string): LessonState {
  if (l.locked) return 'lock';
  if (currentId ? l.id === currentId : l.current) return 'now';
  return l.done ? 'done' : 'todo';
}

export function durLabel(l: LessonLite): string {
  if (l.locked) return 'Premium';
  if (l.kind === 'task') return 'Bài tập';
  if (l.kind === 'file') return 'Tài liệu';
  return fmtDuration(l.durationSeconds) || (l.kind === 'text' ? 'Bài đọc' : '');
}

function Mark({ state }: { state: LessonState }) {
  if (state === 'done') return <span className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center flex-shrink-0" style={{ background: T.teal, color: '#fff' }}><Check size={14} /></span>;
  if (state === 'now') return <span className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center flex-shrink-0" style={{ border: `2px solid ${T.accent}` }}><span className="w-2 h-2 rounded-full" style={{ background: T.accent }} /></span>;
  if (state === 'lock') return <span className="w-[22px] h-[22px] inline-flex items-center justify-center flex-shrink-0" style={{ color: T.ink3 }}><Lock size={16} /></span>;
  return <span className="w-[22px] h-[22px] rounded-full inline-block flex-shrink-0" style={{ border: `1.5px solid ${T.line2}` }} />;
}

export function LessonRow({ lesson, state, to, index }: { lesson: LessonLite; state: LessonState; to: string; index?: string }) {
  const on = state === 'now';
  return (
    <Link to={to} className="flex items-center gap-3 px-3 py-2.5 rounded-[10px]" style={{ background: on ? T.accentSoft : 'transparent', color: state === 'lock' ? T.ink3 : T.ink }}>
      <Mark state={state} />
      <span className="flex-grow text-[14px] min-w-0 truncate" style={{ fontWeight: on ? 600 : 400 }}>{index ? `${index} ` : ''}{lesson.title}</span>
      <span className="muted text-[12px] flex-shrink-0">{durLabel(lesson)}</span>
    </Link>
  );
}

export function ModuleHead({ title, meta, open, onToggle }: { title: string; meta: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="flex items-center gap-2.5 w-full text-left" style={{ padding: '14px 12px 8px' }} aria-expanded={open}>
      <span style={{ color: T.ink3 }}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      <span className="flex-grow font-semibold min-w-0 truncate">{title}</span>
      <span className="muted text-[12px] flex-shrink-0">{meta}</span>
    </button>
  );
}

export function moduleMeta(m: ModuleLite): string {
  const done = m.lessons.filter((l) => l.done).length;
  const n = m.lessons.length;
  if (n && done === n) return `${n} bài · hoàn thành`;
  if (done > 0) return `${n} bài · ${done}/${n}`;
  return `${n} bài`;
}
