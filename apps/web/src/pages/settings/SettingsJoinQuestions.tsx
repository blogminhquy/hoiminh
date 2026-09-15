// Cài đặt · Chung: câu hỏi người lạ phải trả lời khi xin vào hội (tối đa 3, khớp PUT /join-questions).
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, T, Toggle } from '@hoiminh/ui';
import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';

export interface JoinQuestion { id?: string; question: string; required: boolean; sortOrder: number }
const MAX = 3;

export function JoinQuestionsCard({ communityId, slug, initial }: { communityId: string; slug: string; initial: JoinQuestion[] }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<JoinQuestion[] | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (rows === null && initial.length >= 0) setRows(initial.map((r, i) => ({ ...r, sortOrder: i }))); }, [initial, rows]);

  const save = useMutation({
    mutationFn: () => api.put<JoinQuestion[]>(`/v1/communities/${communityId}/join-questions`, { questions: (rows ?? []).filter((r) => r.question.trim()).map((r, i) => ({ question: r.question.trim(), required: r.required, sortOrder: i })) }),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); void qc.invalidateQueries({ queryKey: ['about', slug] }); },
  });

  const list = rows ?? [];
  const patch = (i: number, p: Partial<JoinQuestion>) => setRows(list.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <div className="card p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold">Câu hỏi khi xin vào hội</span>
        {saved && <span className="text-[13px] font-semibold" style={{ color: T.teal }}>Đã lưu</span>}
        <span className="flex-grow" />
        <Button size="sm" disabled={list.length >= MAX} onClick={() => setRows([...list, { question: '', required: true, sortOrder: list.length }])}><Plus size={14} />Thêm câu hỏi</Button>
      </div>
      <span className="muted text-[12px]">Hiện ở trang giới thiệu hội khi người lạ bấm Tham gia. Tối đa {MAX} câu — hỏi ít thì người ta mới điền.</span>
      {list.length === 0 && <span className="muted text-[13px]">Chưa có câu hỏi nào. Người lạ bấm Tham gia là vào thẳng.</span>}
      {list.map((r, i) => (
        <div key={i} className="flex items-center gap-3 px-3.5 py-2 rounded-[10px] flex-wrap" style={{ background: T.bg }}>
          <span className="font-bold" style={{ color: T.ink3 }}>{i + 1}</span>
          <input
            value={r.question}
            maxLength={200}
            placeholder="Bạn đang làm gì và muốn đạt được điều gì?"
            onChange={(e) => patch(i, { question: e.target.value })}
            className="flex-grow text-[14px] bg-transparent min-w-0"
          />
          <Toggle on={r.required} label={`Bắt buộc câu ${i + 1}`} onChange={(v) => patch(i, { required: v })} />
          <span className="muted text-[12px]">Bắt buộc</span>
          <button type="button" aria-label={`Xóa câu hỏi ${i + 1}`} onClick={() => setRows(list.filter((_, j) => j !== i))} style={{ color: T.ink3 }}><X size={16} /></button>
        </div>
      ))}
      {save.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</span>}
      <div className="flex"><span className="flex-grow" /><Button size="sm" variant="dark" loading={save.isPending} onClick={() => save.mutate()}>Lưu câu hỏi</Button></div>
    </div>
  );
}
