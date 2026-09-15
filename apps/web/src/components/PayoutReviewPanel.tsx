// Panel xem xét một yêu cầu rút (reviewPanel trong build.mjs): số tài khoản đầy đủ, QR VietQR, ô mã tham chiếu và lý do từ chối.
import { Button, Input, T, Tag, money } from '@hoiminh/ui';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import type { PayoutRequest } from './PayoutQueue';

export interface ReviewData {
  withdrawal: { id: string; status: string; version: number; amountMinor: number };
  user: { name: string; email: string; handle: string } | null;
  payout: { bankCode: string; bankName: string; accountNumber: string; accountHolder: string };
  suggestedContent: string;
  qrImageUrl: string;
}

/** Nút sao chép nhỏ cạnh mã; báo "Đã chép" trong 1,5 giây. */
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* trình duyệt không cho phép */ }
  };
  return (
    <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: done ? T.teal : T.ink3 }} aria-label={label ?? 'Sao chép'}>
      {done ? <Check size={14} /> : <Copy size={14} />}{label}
    </button>
  );
}

function Code({ children }: { children: string }) {
  return <code className="px-2 py-0.5 rounded-md" style={{ fontFamily: 'Consolas, monospace', background: T.bg }}>{children}</code>;
}

export function PayoutReviewPanel({ data, request, conflict, onReload, paying, rejecting, onPaid, onReject }: { data: ReviewData; request: PayoutRequest; conflict: string | null; onReload: () => void; paying: boolean; rejecting: boolean; onPaid: (transferReference: string) => void; onReject: (reason: string) => void }) {
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const amount = money(request.amountMinor);
  return (
    <div className="p-5 flex flex-col gap-4" style={{ borderTop: `1px solid ${T.line}`, background: T.surface }}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-grow min-w-0">
          <div className="font-bold text-[15px]">{request.user.name} · {amount}</div>
          <div className="muted text-[12px]">{request.user.email} · tiền đã bị khóa khỏi số dư có thể rút của cộng sự</div>
        </div>
        <Tag tone="teal"><Check size={11} />Đã mở số tài khoản · ghi vào nhật ký</Tag>
      </div>
      <div className="flex gap-5 flex-wrap">
        <div className="grid flex-grow content-start text-[14px]" style={{ gridTemplateColumns: '130px 1fr', rowGap: 10, columnGap: 12, minWidth: 260 }}>
          <span className="muted">Chủ tài khoản</span><span className="font-semibold">{data.payout.accountHolder}</span>
          <span className="muted">Ngân hàng</span><span>{data.payout.bankName}</span>
          <span className="muted">Số tài khoản</span><span className="inline-flex items-center gap-2"><Code>{data.payout.accountNumber}</Code><CopyButton text={data.payout.accountNumber} /></span>
          <span className="muted">Số tiền</span><span className="font-bold text-[16px]">{amount}</span>
          <span className="muted">Nội dung gợi ý</span><span className="inline-flex items-center gap-2"><Code>{data.suggestedContent}</Code><CopyButton text={data.suggestedContent} /></span>
        </div>
        <div className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl flex-shrink-0" style={{ border: `1px solid ${T.line2}`, background: T.bg }}>
          <img src={data.qrImageUrl} alt="Mã QR chuyển khoản" width={132} height={132} className="rounded-[10px]" style={{ background: T.surface, border: `1px solid ${T.line2}`, objectFit: 'contain' }} />
          <span className="muted text-[11px] text-center" style={{ maxWidth: 150 }}>Quét bằng app ngân hàng, đã điền sẵn số tiền và nội dung</span>
        </div>
      </div>
      {conflict && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-[10px] text-[13px]" style={{ background: T.accentSoft, color: T.accentText }}>
          <span className="flex-grow">{conflict}</span>
          <Button size="sm" onClick={onReload}>Tải lại</Button>
        </div>
      )}
      <div className="flex gap-4 items-end flex-wrap pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
        <div className="flex-1 flex flex-col gap-1.5" style={{ minWidth: 200 }}>
          <span className="text-[13px] font-semibold">Mã tham chiếu chuyển khoản</span>
          <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="FT26091412345" />
        </div>
        <Button variant="primary" icon={<Check size={16} />} loading={paying} disabled={ref.trim().length < 4} onClick={() => onPaid(ref.trim())}>Đã chuyển khoản</Button>
        <span className="hide-mobile" style={{ width: 1, height: 40, background: T.line }} />
        <div className="flex-1 flex flex-col gap-1.5" style={{ minWidth: 200 }}>
          <span className="text-[13px] font-semibold">Lý do từ chối</span>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sai số tài khoản" />
        </div>
        <Button loading={rejecting} disabled={reason.trim().length < 3} style={{ color: T.accentText }} onClick={() => onReject(reason.trim())}>Từ chối và hoàn về ví</Button>
      </div>
    </div>
  );
}
