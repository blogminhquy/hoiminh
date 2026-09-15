// Hàng đợi rút tiền cộng sự (queueRow/reviewPanel/historyRow trong build.mjs): chủ hội hoặc super admin xem xét, chuyển khoản tay rồi ghi mã tham chiếu.
import { Avatar, Button, StatusTag, T, money } from '@hoiminh/ui';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { ApiError, api, errorMessage } from '@/lib/api';
import { fmtDateTime, fmtDayMonth } from '@/lib/format';
import { PayoutReviewPanel, type ReviewData } from './PayoutReviewPanel';

export interface PayoutUser {
  name: string;
  email: string;
  avatarUrl?: string | null;
  coverColor?: string | null;
}
export interface PayoutRequest {
  id: string;
  amountMinor: number;
  maskedAccount: string;
  requestedAt: string;
  status: string;
  version: number;
  transferReference: string | null;
  rejectionReason: string | null;
  user: PayoutUser;
}

/** Khối vàng nhắc rằng Hội Mình không tự chuyển tiền: người chi trả tự chuyển khoản rồi ghi sổ. */
export function LedgerNotice({ who }: { who: string }) {
  return (
    <div className="flex gap-3 items-start px-4 py-3.5 rounded-xl text-[13px] leading-normal" style={{ background: T.goldSoft, color: T.goldDark }}>
      <span className="flex-shrink-0" style={{ color: T.goldText }}><ShieldCheck size={20} /></span>
      <div>
        <strong>Hội Mình không tự chuyển tiền cho cộng sự.</strong> {who} chuyển khoản bằng app ngân hàng của mình rồi ghi mã tham chiếu vào đây. Số dư cộng sự là sổ cái bất biến (ghi có, khóa, trả lại, ghi nợ, điều chỉnh), không sửa tay được.
      </div>
    </div>
  );
}

const QUEUE_COLS = '2fr 1fr 1.4fr 1fr 1fr 110px';
const HISTORY_COLS = '2fr 1fr 1fr 1fr 2fr';

function QueueRow({ w, open, onToggle, loading }: { w: PayoutRequest; open: boolean; onToggle: () => void; loading: boolean }) {
  return (
    <div className="grid items-center gap-3 px-5 py-3 text-[13px]" style={{ gridTemplateColumns: QUEUE_COLS, borderTop: `1px solid ${T.line}`, background: open ? T.goldSoft : undefined }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar name={w.user.name} src={w.user.avatarUrl} color={w.user.coverColor} size={32} />
        <div className="min-w-0">
          <div className="font-semibold truncate">{w.user.name}</div>
          <div className="muted text-[12px] truncate">{w.user.email}</div>
        </div>
      </div>
      <span className="font-bold">{money(w.amountMinor)}</span>
      <span className="muted">{w.maskedAccount}</span>
      <span className="muted">{fmtDateTime(w.requestedAt)}</span>
      <StatusTag status={w.status} />
      <Button size="sm" className="justify-self-end" onClick={onToggle} loading={loading}>{open ? 'Đóng' : 'Xem xét'}</Button>
    </div>
  );
}

function HistoryRow({ w }: { w: PayoutRequest }) {
  return (
    <div className="grid items-center gap-3 px-5 py-2.5 text-[13px]" style={{ gridTemplateColumns: HISTORY_COLS, borderTop: `1px solid ${T.line}` }}>
      <span className="font-medium truncate">{w.user.name}</span>
      <span className="font-semibold">{money(w.amountMinor)}</span>
      <span className="muted">{fmtDayMonth(w.requestedAt)}</span>
      <StatusTag status={w.status} />
      <span className="muted truncate">{w.status === 'paid' ? (w.transferReference ?? '—') : w.status === 'cancelled' ? 'Cộng sự tự hủy' : (w.rejectionReason ?? '—')}</span>
    </div>
  );
}

/** Bảng hàng đợi + panel xem xét dưới dòng + bảng đã xử lý gần đây. */
export function PayoutQueue({ queue, history, onChanged }: { queue: PayoutRequest[]; history: PayoutRequest[]; onChanged: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const reviewM = useMutation({
    mutationFn: (id: string) => api.post<ReviewData>(`/v1/withdrawals/${id}/review`),
    onSuccess: (data, id) => { setReview(data); setOpenId(id); setConflict(null); onChanged(); },
  });
  const onFail = (err: unknown) => {
    if (err instanceof ApiError && err.status === 409) setConflict('Yêu cầu vừa được người khác xử lý, tải lại');
    else setConflict(errorMessage(err));
  };
  const paidM = useMutation({
    mutationFn: (p: { id: string; transferReference: string; version: number }) => api.post(`/v1/withdrawals/${p.id}/paid`, { transferReference: p.transferReference, version: p.version }),
    onSuccess: () => { setOpenId(null); setReview(null); setConflict(null); onChanged(); },
    onError: onFail,
  });
  const rejectM = useMutation({
    mutationFn: (p: { id: string; reason: string; version: number }) => api.post(`/v1/withdrawals/${p.id}/reject`, { reason: p.reason, version: p.version }),
    onSuccess: () => { setOpenId(null); setReview(null); setConflict(null); onChanged(); },
    onError: onFail,
  });

  const toggle = (w: PayoutRequest) => {
    if (openId === w.id) { setOpenId(null); setReview(null); setConflict(null); return; }
    reviewM.mutate(w.id);
  };

  return (
    <>
      <div className="card overflow-hidden">
        <div className="table-scroll">
          <div style={{ minWidth: 760 }}>
            <div className="grid gap-3 px-5 py-3" style={{ gridTemplateColumns: QUEUE_COLS }}>
              <span className="th">Cộng sự</span><span className="th">Số tiền</span><span className="th">Tài khoản nhận</span><span className="th">Gửi lúc</span><span className="th">Trạng thái</span><span />
            </div>
            {queue.length === 0 && <div className="muted text-[13px] px-5 py-6 text-center" style={{ borderTop: `1px solid ${T.line}` }}>Không có yêu cầu rút nào đang chờ</div>}
            {queue.map((w) => (
              <div key={w.id}>
                <QueueRow w={w} open={openId === w.id} onToggle={() => toggle(w)} loading={reviewM.isPending && reviewM.variables === w.id} />
                {openId === w.id && review && (
                  <PayoutReviewPanel
                    data={review}
                    request={w}
                    conflict={conflict}
                    onReload={onChanged}
                    paying={paidM.isPending}
                    rejecting={rejectM.isPending}
                    onPaid={(transferReference) => paidM.mutate({ id: w.id, transferReference, version: review.withdrawal.version })}
                    onReject={(reason) => rejectM.mutate({ id: w.id, reason, version: review.withdrawal.version })}
                  />
                )}
              </div>
            ))}
            {reviewM.isError && <div className="text-[13px] px-5 py-3" style={{ color: T.accentText, borderTop: `1px solid ${T.line}` }}>{errorMessage(reviewM.error)}</div>}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center px-5 py-3.5"><span className="font-semibold">Đã xử lý gần đây</span></div>
        <div className="table-scroll">
          <div style={{ minWidth: 640 }}>
            <div className="grid gap-3 px-5 pb-2" style={{ gridTemplateColumns: HISTORY_COLS }}>
              <span className="th">Cộng sự</span><span className="th">Số tiền</span><span className="th">Ngày</span><span className="th">Trạng thái</span><span className="th">Mã tham chiếu / lý do</span>
            </div>
            {history.length === 0 && <div className="muted text-[13px] px-5 py-6 text-center" style={{ borderTop: `1px solid ${T.line}` }}>Chưa xử lý yêu cầu nào</div>}
            {history.map((w) => <HistoryRow key={w.id} w={w} />)}
          </div>
        </div>
      </div>
    </>
  );
}
