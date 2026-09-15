// Mời thành viên: link mời dùng nhiều lần + gửi email (quản trị); thành viên thường thấy link chia sẻ hội.
import { useMutation } from '@tanstack/react-query';
import { Button, Modal, T } from '@hoiminh/ui';
import { Copy, Link as LinkIcon, Mail } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';

export function InviteModal({ open, onClose, communityId, slug, canInvite }: { open: boolean; onClose: () => void; communityId: string; slug: string; canInvite: boolean }) {
  const [emails, setEmails] = useState('');
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/${slug}`;
  const m = useMutation({ mutationFn: (list: string[]) => api.post<Array<{ email: string | null; url: string }>>(`/v1/communities/${communityId}/invites`, list.length ? { emails: list } : {}) });
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
              <span className="muted text-[12px] flex-grow">{m.isError ? errorMessage(m.error) : m.data ? `Đã gửi ${m.data.length} lời mời` : 'Link mời có hiệu lực 14 ngày'}</span>
              <Button variant="primary" size="sm" icon={<Mail size={14} />} loading={m.isPending} disabled={!emails.trim()} onClick={() => m.mutate(emails.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))}>Gửi lời mời</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
