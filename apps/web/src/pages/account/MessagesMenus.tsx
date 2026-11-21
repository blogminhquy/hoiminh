// Menu ba chấm ở đầu khung chat (xem hồ sơ, ghim, lưu trữ, chặn / bỏ chặn, báo cáo) và hộp thoại báo cáo người dùng.
// Chặn: hai bên không nhắn được cho nhau cho tới khi người chặn bỏ chặn. Báo cáo: gửi tới quản trị hệ thống.
import { useMutation } from '@tanstack/react-query';
import { USER_REPORT_REASONS } from '@hoiminh/contracts';
import { Modal, T } from '@hoiminh/ui';
import { Archive, ArchiveRestore, Ban, Flag, MoreHorizontal, Pin, PinOff, User } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import type { Person } from './MessagesParts';

type Reason = (typeof USER_REPORT_REASONS)[number];
const REASON_LABELS: Record<Reason, string> = { spam: 'Spam, quảng cáo', harassment: 'Quấy rối, xúc phạm', scam: 'Lừa đảo', inappropriate: 'Nội dung không phù hợp', other: 'Lý do khác' };

export function ChatMenu({ other, blockedByMe, pinned, archived, onPin, onArchive, onBlock, onReport }: { other: Person; blockedByMe: boolean; pinned: boolean; archived: boolean; onPin: () => void; onArchive: () => void; onBlock: (block: boolean) => void; onReport: () => void }) {
  const [open, setOpen] = useState(false);
  const firstName = other.name.trim().split(/\s+/).pop() ?? other.name;
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div className="relative flex-shrink-0">
      <button type="button" className={`chat-icon${open ? ' on' : ''}`} aria-label={`Thao tác với ${other.name}`} aria-haspopup="menu" aria-expanded={open} title="Thêm thao tác" onClick={() => setOpen((v) => !v)}><MoreHorizontal size={20} /></button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Đóng menu" onClick={() => setOpen(false)} />
          <div role="menu" className="chat-menu" style={{ top: 46, right: 0 }}>
            <Link role="menuitem" to={`/u/${other.handle}`} onClick={() => setOpen(false)}><User size={16} />Xem hồ sơ</Link>
            <button type="button" role="menuitem" onClick={pick(onPin)}>{pinned ? <PinOff size={16} /> : <Pin size={16} />}{pinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'}</button>
            <button type="button" role="menuitem" onClick={pick(onArchive)}>{archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}{archived ? 'Bỏ lưu trữ' : 'Lưu trữ hội thoại'}</button>
            <div role="separator" style={{ height: 1, margin: '6px 4px', background: T.line }} />
            <button type="button" role="menuitem" onClick={pick(() => onBlock(!blockedByMe))}><Ban size={16} />{blockedByMe ? `Bỏ chặn ${firstName}` : `Chặn ${firstName}`}</button>
            <button type="button" role="menuitem" style={{ color: T.accentText }} onClick={pick(onReport)}><Flag size={16} />Báo cáo {firstName}</button>
          </div>
        </>
      )}
    </div>
  );
}

export function ReportDialog({ other, conversationId, open, onClose }: { other: Person; conversationId: string; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState<Reason>('spam');
  const [detail, setDetail] = useState('');
  const report = useMutation({ mutationFn: () => api.post('/v1/me/reports', { userId: other.id, conversationId, reason, detail }) });
  const close = () => { report.reset(); setDetail(''); setReason('spam'); onClose(); };
  return (
    <Modal open={open} onClose={close} title={`Báo cáo ${other.name}`} width={480}>
      {report.isSuccess ? (
        <div className="p-5 flex flex-col gap-4">
          <div className="text-[15px]">Đã gửi báo cáo. Quản trị viên Hội Mình sẽ xem xét và xử lý. Nếu không muốn nhận tin từ người này nữa, bạn có thể chặn họ từ menu ba chấm.</div>
          <div className="flex justify-end"><button type="button" className="btn btn-primary" onClick={close}>Đóng</button></div>
        </div>
      ) : (
        <form className="p-5 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); report.mutate(); }}>
          <fieldset className="flex flex-col gap-1 m-0 p-0 border-0">
            <legend className="font-semibold text-[15px] mb-2 p-0">Vì sao bạn báo cáo người này?</legend>
            {USER_REPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-3 min-h-[44px] cursor-pointer text-[15px]">
                <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                {REASON_LABELS[r]}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1.5 text-[15px]">
            <span className="font-semibold">Mô tả thêm (không bắt buộc)</span>
            <span className="input textarea"><textarea rows={3} maxLength={1000} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Chuyện gì đã xảy ra?" /></span>
          </label>
          {report.isError && <div className="text-[14px]" role="alert" style={{ color: T.accentText }}>{errorMessage(report.error)}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={close}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={report.isPending}>{report.isPending ? 'Đang gửi…' : 'Gửi báo cáo'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
