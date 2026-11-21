// Email cho chủ hội theo sự kiện của đơn hàng. Tách khỏi handlers.ts để lỗi ở đây (tra người nhận, gửi email) không
// đụng tới việc cấp quyền, tính hoa hồng và email cho người mua: bus chạy từng handler riêng, handler này đăng ký sau
// nên chạy sau khi quyền đã được mở.
import { systemCtx, type AppContext, type Ctx } from '../context';
import { emailOwnerOfPaidOrder } from '../services/owner-payout';

/** Gắn handler email chủ hội vào bus. Gọi một lần khi khởi động, sau `registerHandlers`. */
export function registerOwnerEmailHandlers(app: AppContext): void {
  // Đơn của hội được thanh toán xong: chủ hội nhận một email. `payment.succeeded` chỉ phát một lần cho mỗi đơn
  // (confirmPayment cập nhật có điều kiện), nên email cũng chỉ gửi một lần.
  app.events.on('payment.succeeded', async (p, ev) => {
    const c = (ev.ctx as Ctx | undefined) ?? systemCtx(app);
    await emailOwnerOfPaidOrder(c, p.orderId);
  });
}
