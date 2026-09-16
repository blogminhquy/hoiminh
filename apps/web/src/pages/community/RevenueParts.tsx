// Phần phụ của Doanh thu: hộp thoại chủ hội hoàn tiền một đơn (POST /v1/orders/:id/admin-refund).
import { Button, Modal, T, Textarea, money } from '@hoiminh/ui';
import { useState } from 'react';

export interface RefundTarget {
  orderId: string;
  title: string;
  customerName: string;
  amountMinor: number;
  commissionMinor: number;
  provider: string;
}

/**
 * Hoàn tiền do chủ hội chủ động, khác với yêu cầu của thành viên (không giới hạn 7 ngày,
 * không xét tiến độ học). Với chuyển khoản, hệ thống chỉ ghi sổ và thu hồi quyền truy cập —
 * tiền phải tự chuyển lại, nên nói thẳng điều đó trước khi bấm.
 */
export function AdminRefundModal({ target, onClose, onSubmit, pending, error }: { target: RefundTarget | null; onClose: () => void; onSubmit: (reason: string) => void; pending: boolean; error: string | null }) {
  const [reason, setReason] = useState('');
  const manual = target?.provider === 'sepay';
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title="Hoàn tiền đơn này"
      width={520}
      footer={(
        <div className="flex gap-2 px-5 py-4 justify-end" style={{ borderTop: `1px solid ${T.line}` }}>
          <Button size="sm" onClick={onClose}>Hủy</Button>
          <Button size="sm" variant="primary" loading={pending} disabled={reason.trim().length < 3} onClick={() => onSubmit(reason.trim())}>Xác nhận hoàn tiền</Button>
        </div>
      )}
    >
      <div className="p-5 flex flex-col gap-3">
        <div className="text-[13px]">
          Hoàn <strong>{money(target?.amountMinor)}</strong> cho <strong>{target?.customerName}</strong> · {target?.title}
        </div>
        <ul className="text-[13px] muted flex flex-col gap-1 pl-4" style={{ listStyle: 'disc' }}>
          <li>Thành viên mất quyền truy cập phần đã mua ngay lập tức.</li>
          {(target?.commissionMinor ?? 0) > 0 && <li>Hoa hồng {money(target?.commissionMinor)} của cộng sự sẽ bị đảo khỏi ví.</li>}
          <li>{manual ? 'Chuyển khoản: hệ thống chỉ ghi sổ, bạn phải tự chuyển lại tiền cho khách.' : 'Cổng thanh toán sẽ được gọi để hoàn tiền tự động nếu đã có credential.'}</li>
          <li>Thao tác này không hoàn tác được và được ghi vào nhật ký.</li>
        </ul>
        <Textarea rows={3} value={reason} maxLength={500} placeholder="Lý do hoàn tiền (lưu vào nhật ký và gửi cho khách)" onChange={(e) => setReason(e.target.value)} />
        {error && <div className="text-[13px]" style={{ color: T.accentText }}>{error}</div>}
      </div>
    </Modal>
  );
}
