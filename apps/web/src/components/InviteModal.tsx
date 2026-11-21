// Mời thành viên: link giới thiệu hội + gửi lời mời qua email và danh sách lời mời đang chờ (quản trị); thành viên thường chỉ thấy link chia sẻ hội.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Modal, T } from '@hoiminh/ui';
import { Copy, Link as LinkIcon, Mail } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { fmtDayMonth } from '@/lib/format';

interface PendingInvite { id: string; email: string | null; role: 'admin' | 'member'; url: string; expiresAt: string; expired: boolean }

export function InviteModal({ open, onClose, communityId, slug, canInvite }: { open: boolean; onClose: () => void; communityId: string; slug: string; canInvite: boolean }) {
  const qc = useQueryClient();
  const [emails, setEmails] = useState('');
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/${slug}`;
  // Gửi xong thì danh sách thành viên (tab Đã mời) và số đếm phải đổi ngay, không chờ người dùng tải lại.
  const m = useMutation({ mutationFn: (list: string[]) => api.post<Array<{ email: string | null; url: string }>>(`/v1/communities/${communityId}/invites`, list.length ? { emails: list } : {}), onSuccess: () => { setEmails(''); void qc.invalidateQueries({ queryKey: ['invites', communityId] }); void qc.invalidateQueries({ queryKey: ['members', communityId] }); void qc.invalidateQueries({ queryKey: ['shell'] }); } });
  // Lời mời chưa có người nhận: chủ hội xem ai chưa vào, lời mời nào hết hạn, và thu hồi lời mời gửi nhầm.
  const pending = useQuery({ queryKey: ['invites', communityId], queryFn: () => api.get<{ items: PendingInvite[] }>(`/v1/communities/${communityId}/invites`), enabled: open && canInvite });
  const revoke = useMutation({ mutationFn: (id: string) => api.del(`/v1/communities/${communityId}/invites/${id}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['invites', communityId] }) });
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* bỏ qua */ }
  };
  return (
    <Modal open={open} onClose={onClose} title="Mời thành viên" width={560}>
      <div className="p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Link giới thiệu hội</span>
          <div className="input"><LinkIcon size={16} style={{ color: T.ink3 }} /><span className="flex-grow truncate">{shareUrl}</span><button type="button" onClick={() => void copy(shareUrl)} aria-label="Sao chép"><Copy size={16} style={{ color: T.ink3 }} /></button></div>
          <span className="muted text-[12px]">{copied ? 'Đã sao chép' : 'Người lạ mở link sẽ thấy trang giới thiệu hội trước'}</span>
        </div>
        {canInvite && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Gửi lời mời qua email</span>
            <span className="input textarea"><textarea rows={3} placeholder="Mỗi dòng một email" value={emails} onChange={(e) => setEmails(e.target.value)} /></span>
            <div className="flex items-center gap-2">
              <span className="muted text-[12px] flex-grow">{m.isError ? errorMessage(m.error) : m.data ? `Đã gửi ${m.data.length} lời mời` : 'Mỗi lời mời dùng một lần, có hiệu lực 14 ngày. Người được mời vào thẳng, không chờ duyệt.'}</span>
              <Button variant="primary" size="sm" icon={<Mail size={14} />} loading={m.isPending} disabled={!emails.trim()} onClick={() => m.mutate(emails.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))}>Gửi lời mời</Button>
            </div>
          </div>
        )}
        {canInvite && (pending.data?.items.length ?? 0) > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Lời mời đang chờ ({pending.data!.items.length})</span>
            <div className="flex flex-col" style={{ border: `1px solid ${T.line}`, borderRadius: 10, maxHeight: 220, overflowY: 'auto' }}>
              {pending.data!.items.map((inv, k) => (
                <div key={inv.id} className="flex items-center gap-2" style={{ padding: '10px 12px', borderTop: k ? `1px solid ${T.line}` : undefined }}>
                  <div className="flex-grow min-w-0">
                    <div className="text-[14px] truncate">{inv.email ?? 'Link mời chung'}{inv.role === 'admin' && <span className="font-semibold" style={{ color: T.goldText }}> · Quản trị viên</span>}</div>
                    <div className="text-[12px]" style={{ color: inv.expired ? T.accentText : T.ink3 }}>{inv.expired ? 'Đã hết hạn, hãy gửi lại' : `Hết hạn ngày ${fmtDayMonth(inv.expiresAt)}`}</div>
                  </div>
                  <Button size="sm" loading={revoke.isPending && revoke.variables === inv.id} onClick={() => revoke.mutate(inv.id)}>Thu hồi</Button>
                </div>
              ))}
            </div>
            {revoke.isError && <span className="text-[12px]" style={{ color: T.accentText }}>{errorMessage(revoke.error)}</span>}
          </div>
        )}
      </div>
    </Modal>
  );
}
