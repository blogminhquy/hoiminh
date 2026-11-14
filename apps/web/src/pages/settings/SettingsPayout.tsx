// Cài đặt · Nhận tiền (/:slug/cai-dat/nhan-tien). Tiền bán hàng của hội về thẳng chủ hội, không đi qua Hội Mình. Chủ
// hội cài một hoặc nhiều cách: chuyển khoản QR (tự bấm xác nhận), QR tự động qua SePay, MoMo, VNPAY, PayPal, thẻ qua
// Stripe. Người mua chỉ thấy cách đã cài và đang bật; cách mặc định được chọn sẵn. Hội chưa cài cách nào thì các nút
// mua trong hội bị khóa. Cần quyền billing.manage.
import { useQuery } from '@tanstack/react-query';
import { Radio, T } from '@hoiminh/ui';
import { Lock } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { useCan, useShell } from '@/lib/community';
import { BUYER_METHOD_NAME, buyerSummary } from '@/lib/payment-methods';
import { webhookPollMs } from '@/lib/payout-webhook';
import { MethodList } from './PayoutMethods';
import { PendingOrders, payoutSetupQuery, type PayoutSetup } from './PayoutParts';

/** Xem trước bước thanh toán: người mua thấy đúng các cách đang bật, cách mặc định được chọn sẵn. */
function BuyerPreview({ d }: { d: PayoutSetup }) {
  return (
    <div className="card flex flex-col gap-3 p-5" aria-label="Người mua sẽ thấy" role="region">
      <span className="font-bold text-[16px]">Người mua sẽ thấy</span>
      {d.methods.length ? (
        <>
          <div className="flex flex-col gap-2">
            {d.methods.map((m) => (
              <div key={m} className="flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ border: `1.5px solid ${m === d.defaultMethod ? T.primary : T.line2}`, background: m === d.defaultMethod ? T.primarySoft : T.surface }}>
                <Radio on={m === d.defaultMethod} />
                <span className="font-semibold text-[15px] flex-grow">{BUYER_METHOD_NAME[m]}</span>
                {m === d.defaultMethod && d.methods.length > 1 && <span className="text-[13px] font-semibold" style={{ color: T.primaryText }}>Chọn sẵn</span>}
              </div>
            ))}
          </div>
          <span className="text-[14px]" style={{ color: T.ink3 }}>Nút mua đã mở. Người mua đổi sang cách khác được ngay ở bước thanh toán.</span>
        </>
      ) : (
        <>
          <span className="btn btn-ghost w-full" style={{ minHeight: 48, pointerEvents: 'none', opacity: 0.7 }}><Lock size={16} />Hội chưa mở thanh toán</span>
          <span className="text-[14px]" style={{ color: T.ink3 }}>Nút mua bị khóa cho tới khi bạn cài ít nhất một cách nhận tiền.</span>
        </>
      )}
    </div>
  );
}

function Setup({ d }: { d: PayoutSetup }) {
  const shell = useShell();
  return (
    <>
      <div className="flex items-start gap-3 rounded-[14px] px-4 py-3.5" role="status" style={{ background: d.ready ? T.tealSoft : T.goldSoft, color: d.ready ? T.tealText : T.goldText }}>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-2" style={{ background: d.ready ? T.teal : T.gold }} />
        <div className="flex flex-col">
          <span className="font-bold text-[16px]">{d.ready ? 'Hội đã mở thanh toán' : 'Hội chưa cài nhận tiền'}</span>
          <span className="text-[15px]">{d.ready ? `Người mua đang thấy: ${buyerSummary(d)}.` : 'Các nút mua đang khóa. Cài ít nhất một cách nhận tiền bên dưới để mở.'}</span>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex flex-col gap-4 w-full lg:flex-[1.4_1_0] min-w-0">
          <MethodList d={d} />
        </div>
        <div className="flex flex-col gap-4 w-full lg:flex-1 min-w-0">
          <BuyerPreview d={d} />
          {d.account && <PendingOrders communityId={shell.community.id} orders={d.pending} mode={d.account.confirmMode} />}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  const shell = useShell();
  const can = useCan();
  // Trong lúc chờ lần báo có đầu tiên của SePay, tự hỏi lại để dòng trạng thái chuyển sang "Đã nối" mà không cần tải lại trang.
  const q = useQuery({ ...payoutSetupQuery(shell.community.id), enabled: can('billing.manage'), refetchInterval: (query) => webhookPollMs(query.state.data?.account?.enabled ? query.state.data.account : null) });
  if (!can('billing.manage')) return <Navigate to={`/${shell.community.slug}/cai-dat`} replace />;
  return (
    <>
      <div>
        <h1 className="serif m-0 text-[28px] font-extrabold">Nhận tiền</h1>
        <div className="muted">Tiền bán hàng của hội về thẳng tài khoản và cổng thanh toán của bạn, không đi qua Hội Mình. Hội Mình không thu phí trên doanh thu.</div>
      </div>
      <QueryState q={q} rows={4}>{(d) => <Setup d={d} />}</QueryState>
    </>
  );
}
