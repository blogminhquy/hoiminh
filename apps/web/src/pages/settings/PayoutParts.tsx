// Mảnh dùng chung của phần Nhận tiền (Cài đặt, Nhận tiền và trang Quản lý đơn hàng): kiểu dữ liệu, truy vấn, danh sách đơn chờ
// chủ hội xác nhận với nút "Đã nhận tiền". Tiền bán hàng của hội về thẳng tài khoản của chủ hội, không qua Hội Mình.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, T, money } from '@hoiminh/ui';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { GatewayState } from '@/lib/payment-methods';
import type { PaymentProvider } from '@hoiminh/contracts';

export type ConfirmMode = 'manual' | 'auto';
export interface PayoutAccount { bankCode: string; bankName: string; accountNumber: string; accountHolder: string; confirmMode: ConfirmMode; /** Người mua có thấy cách chuyển khoản QR không. */ enabled: boolean; webhookUrl: string; lastWebhookAt: string | null; updatedAt: string }
export interface PendingOrder { orderId: string; title: string; amountMinor: number; reference: string; buyerName: string; buyerEmail: string; createdAt: string; buyerSaysPaid: boolean }
export interface PayoutSetup {
  /** Có ít nhất một cách nhận tiền đang bật: nút mua trong hội đã mở. */
  ready: boolean;
  account: PayoutAccount | null;
  /** Cổng riêng của chủ hội: MoMo, VNPAY, PayPal, Stripe. */
  gateways: GatewayState[];
  /** Các cách người mua đang thấy, và cách được chọn sẵn. */
  methods: PaymentProvider[];
  defaultMethod: PaymentProvider | null;
  banks: Array<{ code: string; name: string }>;
  received30Minor: number;
  pending: PendingOrder[];
}

export const payoutSetupKey = (communityId: string) => ['payout-account', communityId] as const;
export const payoutSetupQuery = (communityId: string) => ({ queryKey: payoutSetupKey(communityId), queryFn: () => api.get<PayoutSetup>(`/v1/communities/${communityId}/payout-account`) });

/** Các đơn người mua đã tạo mà chủ hội chưa xác nhận đã nhận tiền. Bấm "Đã nhận tiền" là người mua được mở quyền ngay. */
export function PendingOrders({ communityId, orders, mode }: { communityId: string; orders: PendingOrder[]; mode: ConfirmMode }) {
  const qc = useQueryClient();
  // Đơn vừa xác nhận xong được giữ lại trên màn hình (danh sách tải lại sẽ không còn chứa nó), để chủ hội thấy rõ kết quả.
  const [done, setDone] = useState<PendingOrder[]>([]);
  const confirm = useMutation({
    mutationFn: (orderId: string) => api.post(`/v1/communities/${communityId}/orders/${orderId}/confirm-received`, {}),
    onSuccess: (_r, orderId) => {
      const order = orders.find((o) => o.orderId === orderId);
      if (order) setDone((d) => [...d.filter((x) => x.orderId !== orderId), order]);
      void qc.invalidateQueries({ queryKey: payoutSetupKey(communityId) });
      void qc.invalidateQueries({ queryKey: ['payout-settings', communityId] });
      void qc.invalidateQueries({ queryKey: ['revenue', communityId] });
      void qc.invalidateQueries({ queryKey: ['orders', communityId] });
    },
  });
  const isDone = (id: string) => done.some((d) => d.orderId === id);
  const waiting = orders.filter((o) => !isDone(o.orderId));
  const rows = [...waiting, ...done];
  if (!rows.length) {
    return (
      <div className="card flex flex-col gap-1 p-5">
        <span className="font-bold text-[16px]">Đơn chờ bạn xác nhận</span>
        <span className="text-[15px]" style={{ color: T.ink3 }}>{mode === 'auto' ? 'Chưa có đơn nào đang chờ. Tiền về là đơn tự chuyển sang đã trả.' : 'Chưa có đơn nào đang chờ. Khi có người mua, đơn sẽ hiện ở đây để bạn bấm xác nhận.'}</span>
      </div>
    );
  }
  return (
    <section className="card flex flex-col gap-1 p-5" aria-label="Đơn chờ bạn xác nhận">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-bold text-[16px]">Đơn chờ bạn xác nhận</span>
        <span className="text-[14px]" style={{ color: T.ink3 }}>{waiting.length} đơn</span>
      </div>
      <span className="text-[14px] pb-1" style={{ color: T.ink3 }}>Kiểm tra tài khoản ngân hàng, thấy đúng số tiền và nội dung chuyển khoản thì bấm "Đã nhận tiền".{mode === 'auto' ? ' Đơn tự xác nhận khi dịch vụ báo có gọi về; nút này dùng khi dịch vụ đó bị trễ.' : ''}</span>
      {confirm.isError && <div className="text-[14px] py-1" style={{ color: T.accentText }}>{errorMessage(confirm.error)}</div>}
      {rows.map((o) => (
        <div key={o.orderId} className="flex items-center gap-3 flex-wrap py-3" style={{ borderTop: `1px solid ${T.line}` }}>
          <div className="flex flex-col min-w-0 flex-grow" style={{ flexBasis: 240 }}>
            <div className="flex items-baseline gap-3">
              <span className="font-semibold truncate">{o.title}</span>
              <span className="flex-grow" />
              <span className="font-bold whitespace-nowrap">{money(o.amountMinor)}</span>
            </div>
            <span className="text-[14px]" style={{ color: T.ink3 }}>{o.buyerName} · nội dung chuyển khoản <strong style={{ color: T.ink }}>{o.reference}</strong> · {timeAgo(o.createdAt)}</span>
            {o.buyerSaysPaid && <span className="text-[14px] font-semibold" style={{ color: T.goldText }}>Người mua báo đã chuyển khoản</span>}
          </div>
          {isDone(o.orderId)
            ? <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: T.tealText }}><Check size={16} />Đã xác nhận, người mua đã được mở quyền</span>
            : <Button variant="primary" size="sm" loading={confirm.isPending && confirm.variables === o.orderId} onClick={() => confirm.mutate(o.orderId)} aria-label={`Đã nhận tiền đơn ${o.reference}`}>Đã nhận tiền</Button>}
        </div>
      ))}
    </section>
  );
}
