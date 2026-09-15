// Khối bình chọn trong bài viết: chọn 1 hoặc nhiều, thanh % kết quả, gửi bình chọn.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, T } from '@hoiminh/ui';
import { useState } from 'react';
import { api } from '@/lib/api';

export interface Poll {
  id: string;
  question: string;
  multipleChoice: boolean;
  closesAt: string | null;
  options: Array<{ id: string; label: string; voteCount: number }>;
  myVotes: string[];
  totalVotes: number;
}

export function PollBox({ poll, disabled }: { poll: Poll; disabled?: boolean }) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string[]>(poll.myVotes);
  const closed = poll.closesAt ? new Date(poll.closesAt) < new Date() : false;
  const voted = poll.myVotes.length > 0;
  const m = useMutation({
    mutationFn: () => api.post<Poll>(`/v1/polls/${poll.id}/vote`, { optionIds: picked }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['feed'] }); void qc.invalidateQueries({ queryKey: ['post'] }); },
  });
  const toggle = (id: string) => setPicked((p) => (poll.multipleChoice ? (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]) : [id]));
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: T.bg }}>
      <div className="font-semibold">{poll.question}</div>
      {poll.options.map((o) => {
        const p = poll.totalVotes ? Math.round((o.voteCount / poll.totalVotes) * 100) : 0;
        const on = picked.includes(o.id);
        return (
          <button key={o.id} type="button" disabled={disabled || closed} onClick={() => toggle(o.id)} className="relative overflow-hidden rounded-[10px] text-left px-3 py-2 text-[13px]" style={{ background: T.surface, border: `1.5px solid ${on ? T.accent : T.line2}` }}>
            {(voted || closed) && <span className="absolute inset-y-0 left-0" style={{ width: `${p}%`, background: T.tealSoft }} />}
            <span className="relative flex items-center gap-2">
              <span className="flex-grow">{o.label}</span>
              {(voted || closed) && <span className="muted">{p}%</span>}
            </span>
          </button>
        );
      })}
      <div className="flex items-center gap-2 pt-1">
        <span className="muted text-[12px] flex-grow">{poll.totalVotes} bình chọn{closed ? ' · đã đóng' : poll.closesAt ? ` · đóng ${new Date(poll.closesAt).toLocaleDateString('vi-VN')}` : ''}</span>
        {!closed && !disabled && <Button size="sm" variant="dark" loading={m.isPending} disabled={!picked.length} onClick={() => m.mutate()}>{voted ? 'Đổi bình chọn' : 'Bình chọn'}</Button>}
      </div>
    </div>
  );
}
