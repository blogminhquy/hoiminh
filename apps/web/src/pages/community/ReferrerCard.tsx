// Thẻ "Người giới thiệu của bạn" trên trang Xếp hạng affiliate: thành viên xem ai đang nhận hoa hồng từ các lần
// thanh toán của mình và tự đổi sang người khác bằng mã giới thiệu, link giới thiệu hoặc email của người đó. Chỉ thành viên tự đổi được;
// bấm link của affiliate khác không làm đổi người giới thiệu.
import type { MyReferrer } from '@hoiminh/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Input, T } from '@hoiminh/ui';
import { UserCheck } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { refCodeOf } from '@/lib/referral';

export function ReferrerCard({ communityId }: { communityId: string }) {
  const qc = useQueryClient();
  const key = ['my-referrer', communityId];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<MyReferrer>(`/v1/communities/${communityId}/my-referrer`), retry: false });
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState('');
  const save = useMutation({
    mutationFn: () => api.put<MyReferrer>(`/v1/communities/${communityId}/my-referrer`, { code: refCodeOf(code) }),
    onSuccess: (d) => { qc.setQueryData(key, d); setEditing(false); setCode(''); },
  });
  const d = q.data;
  // Hội chưa bật affiliate và mình cũng chưa có người giới thiệu: không có gì để xem hay đổi.
  if (!d || (!d.enabled && !d.referrer)) return null;
  const r = d.referrer;
  return (
    <div className="card p-[18px] flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.primaryText }}><UserCheck size={16} />Người giới thiệu của bạn</div>
      {r ? (
        <>
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={r.name} src={r.avatarUrl} color={r.coverColor ?? T.ink} size={40} />
            <div className="min-w-0"><div className="font-semibold truncate">{r.name}</div><div className="muted text-[13px] truncate">@{r.handle} · mã {r.code}</div></div>
          </div>
          <div className="text-[14px] leading-[1.6]" style={{ color: T.ink2 }}>
            {r.active ? 'Mỗi lần bạn thanh toán trong hội này, hoa hồng tính cho người này.' : 'Tài khoản affiliate của người này đang tạm khóa nên chưa ai nhận hoa hồng từ bạn. Bạn có thể đổi sang người khác.'}
          </div>
        </>
      ) : (
        <div className="text-[14px] leading-[1.6]" style={{ color: T.ink2 }}>Bạn chưa có người giới thiệu. Nếu ai đó đã mời bạn vào hội, nhập mã, link giới thiệu hoặc email của họ để họ được nhận hoa hồng.</div>
      )}
      {d.enabled && !editing && <Button size="sm" className="self-start" onClick={() => { save.reset(); setEditing(true); }}>{r ? 'Đổi người giới thiệu' : 'Nhập người giới thiệu'}</Button>}
      {d.enabled && editing && (
        <form className="flex flex-col gap-2 pt-2.5" style={{ borderTop: `1px solid ${T.line}` }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) save.mutate(); }}>
          <Input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã, link hoặc email người giới thiệu" aria-label="Mã, link hoặc email người giới thiệu" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={{ fontSize: 16 }} />
          {save.isError && <div className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</div>}
          <div className="muted text-[13px] leading-[1.5]">Chỉ bạn tự đổi được. Sau khi đổi, hoa hồng các lần thanh toán sau tính cho người mới.</div>
          <div className="flex gap-2">
            <Button variant="dark" size="sm" loading={save.isPending} disabled={!code.trim()} onClick={() => save.mutate()}>Lưu</Button>
            <Button size="sm" onClick={() => { setEditing(false); setCode(''); }}>Hủy</Button>
          </div>
        </form>
      )}
    </div>
  );
}
