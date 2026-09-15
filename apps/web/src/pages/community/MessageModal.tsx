// Modal nhắn tin nhanh: POST /v1/me/messages rồi chuyển tới hộp thư.
import { useMutation } from '@tanstack/react-query';
import { Button, Modal, T } from '@hoiminh/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';

export function MessageModal({ open, onClose, recipient, communityId }: { open: boolean; onClose: () => void; recipient: { id: string; name: string }; communityId: string }) {
  const navigate = useNavigate();
  const [body, setBody] = useState('');
  const send = useMutation({
    mutationFn: () => api.post('/v1/me/messages', { recipientUserId: recipient.id, communityId, body: body.trim() }),
    onSuccess: () => { onClose(); navigate('/tin-nhan'); },
  });
  return (
    <Modal open={open} onClose={onClose} title={`Nhắn tin cho ${recipient.name}`} width={520}>
      <div className="p-5 flex flex-col gap-3">
        <span className="input textarea"><textarea rows={4} autoFocus placeholder="Viết tin nhắn…" value={body} onChange={(e) => setBody(e.target.value)} /></span>
        {send.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(send.error)}</span>}
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={onClose}>Hủy</Button>
          <Button size="sm" variant="dark" loading={send.isPending} disabled={!body.trim()} onClick={() => send.mutate()}>Gửi</Button>
        </div>
      </div>
    </Modal>
  );
}
