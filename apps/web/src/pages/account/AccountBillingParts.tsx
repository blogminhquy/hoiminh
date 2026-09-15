// Khối con của Gói và thanh toán: bảng lịch sử, hóa đơn in được, modal yêu cầu hoàn tiền.
import { Button, Modal, StatusTag, T, Textarea, money } from '@hoiminh/ui';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { fmtDate, fmtLongDate } from '@/lib/format';

export interface BillingHistoryRow {
  orderId: string; at: string; title: string; method: string; provider: string; amountMinor: number; status: string; invoiceNumber: string | null; targetType: string; refundable: boolean;
}

export const PROVIDER_LABEL: Record<string, string> = { sepay: 'Chuyển khoản QR', momo: 'MoMo', vnpay: 'VNPAY', paypal: 'PayPal' };
export function providerLabel(provider: string | null | undefined, method?: string): string {
  return PROVIDER_LABEL[provider ?? ''] ?? method ?? provider ?? '—';
}

const COLS = '1fr 2fr 1.2fr 1fr 1fr 150px';

export function HistoryTable({ rows, onInvoice, onRefund }: { rows: BillingHistoryRow[]; onInvoice: (r: BillingHistoryRow) => void; onRefund: (r: BillingHistoryRow) => void }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center px-5 py-4"><span className="font-semibold">Lịch sử thanh toán</span><span className="flex-grow" /><span className="muted text-[12px]">50 giao dịch gần nhất</span></div>
      <div className="table-scroll">
        <div style={{ minWidth: 760 }}>
          <div className="grid gap-3 px-5 pb-2" style={{ gridTemplateColumns: COLS }}>
            <span className="th">Ngày</span><span className="th">Nội dung</span><span className="th">Phương thức</span><span className="th">Số tiền</span><span className="th">Trạng thái</span><span />
          </div>
          {rows.length === 0 && <div className="muted text-[13px] px-5 py-6 text-center" style={{ borderTop: `1px solid ${T.line}` }}>Bạn chưa có giao dịch nào</div>}
          {rows.map((r) => (
            <div key={r.orderId} className="grid items-center gap-3 px-5 py-3 text-[13px]" style={{ gridTemplateColumns: COLS, borderTop: `1px solid ${T.line}` }}>
              <span className="muted">{fmtDate(r.at)}</span>
              <span className="truncate">{r.title || r.targetType}</span>
              <span className="muted">{providerLabel(r.provider, r.method)}</span>
              <span className="font-semibold">{money(r.amountMinor)}</span>
              <StatusTag status={r.status === 'paid' ? 'succeeded' : r.status} />
              <span className="flex gap-1.5 justify-end">
                {r.refundable && <Button size="sm" onClick={() => onRefund(r)}>Yêu cầu hoàn tiền</Button>}
                <Button size="sm" aria-label="Hóa đơn" icon={<FileText size={16} />} onClick={() => onInvoice(r)} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InvoiceModal({ row, buyer, onClose }: { row: BillingHistoryRow | null; buyer: { name: string; email: string }; onClose: () => void }) {
  return (
    <Modal open={row !== null} onClose={onClose} title="Hóa đơn" width={560} footer={row ? (
      <div className="flex gap-2 px-5 py-4 justify-end" style={{ borderTop: `1px solid ${T.line}` }}>
        <Button size="sm" onClick={onClose}>Đóng</Button>
        <Button size="sm" variant="dark" onClick={() => window.print()}>In hóa đơn</Button>
      </div>
    ) : undefined}>
      {row && (
        <div id="hoa-don" className="p-6 flex flex-col gap-4 text-[14px]">
          <style>{'@media print { body * { visibility: hidden; } #hoa-don, #hoa-don * { visibility: visible; } #hoa-don { position: absolute; left: 0; top: 0; width: 100%; } }'}</style>
          <div className="flex items-start gap-3">
            <div className="flex-grow">
              <div className="serif text-[20px] font-extrabold">Hội Mình</div>
              <div className="muted text-[12px]">Biên nhận thanh toán · không thu phí giao dịch</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{row.invoiceNumber ?? `HD-${row.orderId.slice(0, 8).toUpperCase()}`}</div>
              <div className="muted text-[12px]">{fmtLongDate(row.at)}</div>
            </div>
          </div>
          <div className="grid gap-2 pt-3" style={{ gridTemplateColumns: '130px 1fr', borderTop: `1px solid ${T.line}` }}>
            <span className="muted">Người mua</span><span>{buyer.name} · {buyer.email}</span>
            <span className="muted">Nội dung</span><span>{row.title || row.targetType}</span>
            <span className="muted">Phương thức</span><span>{providerLabel(row.provider, row.method)}</span>
            <span className="muted">Trạng thái</span><span>{row.status === 'refunded' ? 'Đã hoàn tiền' : 'Đã thanh toán'}</span>
            <span className="muted">Mã đơn</span><span style={{ fontFamily: 'Consolas, monospace' }}>{row.orderId}</span>
          </div>
          <div className="flex items-center pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
            <span className="font-semibold flex-grow">Tổng thanh toán</span>
            <span className="serif text-[22px] font-extrabold">{money(row.amountMinor)}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function RefundModal({ row, onClose, onSubmit, pending, error }: { row: BillingHistoryRow | null; onClose: () => void; onSubmit: (reason: string) => void; pending: boolean; error: string | null }) {
  const [reason, setReason] = useState('');
  return (
    <Modal open={row !== null} onClose={onClose} title="Yêu cầu hoàn tiền" width={520} footer={(
      <div className="flex gap-2 px-5 py-4 justify-end" style={{ borderTop: `1px solid ${T.line}` }}>
        <Button size="sm" onClick={onClose}>Hủy</Button>
        <Button size="sm" variant="primary" loading={pending} disabled={reason.trim().length < 3} onClick={() => onSubmit(reason.trim())}>Gửi yêu cầu</Button>
      </div>
    )}>
      <div className="p-5 flex flex-col gap-3">
        <div className="text-[13px]">Hoàn tiền cho <strong>{row?.title}</strong> · {money(row?.amountMinor)}. Áp dụng trong 7 ngày kể từ khi mua, chưa học quá nửa khóa.</div>
        <Textarea rows={3} value={reason} maxLength={500} placeholder="Lý do bạn muốn hoàn tiền" onChange={(e) => setReason(e.target.value)} />
        {error && <div className="text-[13px]" style={{ color: T.accentText }}>{error}</div>}
      </div>
    </Modal>
  );
}
