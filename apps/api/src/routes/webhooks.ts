// Webhook nhận từ cổng thanh toán (không cần đăng nhập, verify chữ ký trong service) + trang mô phỏng cho sandbox không credential.
import { hmacHex } from '@hoiminh/config';
import { paymentsService, AppError } from '@hoiminh/core';
import { MomoAdapter, vnpQueryString } from '@hoiminh/payments';
import { query, router, type Ctx$ } from '../lib/hono';
import { rateLimit } from '../middleware/common';

export const webhookRoutes = router();
webhookRoutes.use('*', rateLimit({ windowMs: 60_000, max: 600, key: () => 'webhook' }));

async function incoming(c: Ctx$) {
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  return { headers, rawBody: c.req.method === 'GET' ? '' : await c.req.text(), query: query(c) };
}

for (const provider of ['sepay', 'momo', 'paypal'] as const) {
  webhookRoutes.post(`/${provider}`, async (c) => {
    const r = await paymentsService.handleWebhook(c.get('ctx'), provider, await incoming(c));
    return r.body === null ? c.body(null, r.status as 204) : c.json(r.body as Record<string, unknown>, r.status as 200);
  });
}
// VNPAY gọi IPN bằng GET với query string; return URL của trình duyệt không được tin (chỉ để hiển thị).
webhookRoutes.get('/vnpay', async (c) => {
  const r = await paymentsService.handleWebhook(c.get('ctx'), 'vnpay', await incoming(c));
  return c.json(r.body as Record<string, unknown>, r.status as 200);
});
webhookRoutes.post('/vnpay', async (c) => {
  const r = await paymentsService.handleWebhook(c.get('ctx'), 'vnpay', await incoming(c));
  return c.json(r.body as Record<string, unknown>, r.status as 200);
});

/** Trang mô phỏng thanh toán cho sandbox không có credential (chỉ ngoài production). */
export const simulatorRoutes = router();
simulatorRoutes.get('/', (c) => {
  const env = c.get('ctx').env;
  if (env.APP_ENV === 'production') throw new AppError('not_found', 'Không có trang này');
  const q = query(c);
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Mô phỏng ${q.provider}</title><style>body{font-family:'Open Sans',system-ui,sans-serif;background:#F7F3EC;color:#1F1B17;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:#FFFDF9;border:1px solid #E8E1D6;border-radius:16px;padding:32px;max-width:420px;width:100%}h1{font-family:Montserrat,sans-serif;font-size:22px;margin:0 0 8px}p{color:#5C554D}button{display:block;width:100%;margin-top:12px;height:44px;border:0;border-radius:10px;font-weight:600;font-size:15px;cursor:pointer}.ok{background:#D4593A;color:#fff}.no{background:#F7F3EC;color:#1F1B17}</style></head><body><div class="card"><h1>Sandbox ${String(q.provider).toUpperCase()}</h1><p>Đây là trang mô phỏng vì chưa cấu hình credential thật. Số tiền: <strong>${Number(q.amount).toLocaleString('vi-VN')}</strong> · Đơn: <strong>${q.orderId}</strong></p><form method="post" action="/pay/simulator/confirm"><input type="hidden" name="provider" value="${q.provider}"><input type="hidden" name="orderId" value="${q.orderId}"><input type="hidden" name="amount" value="${q.amount}"><input type="hidden" name="requestId" value="${q.requestId ?? ''}"><input type="hidden" name="return" value="${q.return ?? ''}"><button class="ok" name="result" value="success">Thanh toán thành công</button><button class="no" name="result" value="fail">Thanh toán thất bại</button></form></div></body></html>`;
  return c.html(html);
});
simulatorRoutes.post('/confirm', async (c) => {
  const ctx = c.get('ctx');
  const env = ctx.env;
  if (env.APP_ENV === 'production') throw new AppError('not_found', 'Không có trang này');
  const form = await c.req.parseBody();
  const provider = String(form.provider);
  const orderId = String(form.orderId);
  const amount = Number(form.amount);
  const success = form.result === 'success';
  const ret = String(form.return || env.APP_URL);
  if (provider === 'momo') {
    const p = { partnerCode: env.MOMO_PARTNER_CODE, orderId, requestId: String(form.requestId || orderId), amount, orderInfo: 'Hoi Minh', orderType: 'momo_wallet', transId: Date.now(), resultCode: success ? 0 : 1006, message: success ? 'Successful.' : 'Cancelled', payType: 'qr', responseTime: Date.now(), extraData: '', signature: '' };
    p.signature = await hmacHex(env.MOMO_SECRET_KEY, MomoAdapter.ipnSignatureString(env.MOMO_ACCESS_KEY, p));
    await paymentsService.handleWebhook(ctx, 'momo', { headers: {}, rawBody: JSON.stringify(p), query: {} });
  } else if (provider === 'vnpay') {
    const q: Record<string, string> = { vnp_Amount: String(amount * 100), vnp_BankCode: 'NCB', vnp_OrderInfo: 'Hoi Minh', vnp_PayDate: new Date().toISOString().replace(/\D/g, '').slice(0, 14), vnp_ResponseCode: success ? '00' : '24', vnp_TmnCode: env.VNPAY_TMN_CODE, vnp_TransactionNo: String(Date.now()), vnp_TransactionStatus: success ? '00' : '02', vnp_TxnRef: orderId };
    q.vnp_SecureHash = await hmacHex(env.VNPAY_HASH_SECRET, vnpQueryString(q), 'SHA-512');
    await paymentsService.handleWebhook(ctx, 'vnpay', { headers: {}, rawBody: '', query: q });
  } else if (provider === 'paypal') {
    const body = { id: `WH-SIM-${Date.now()}`, event_type: success ? 'PAYMENT.CAPTURE.COMPLETED' : 'PAYMENT.CAPTURE.DENIED', create_time: new Date().toISOString(), resource: { id: `CAP-${Date.now()}`, custom_id: orderId, amount: { value: (amount / 100).toFixed(2), currency_code: 'USD' } } };
    await paymentsService.handleWebhook(ctx, 'paypal', { headers: { 'x-hoiminh-simulator': 'paypal' }, rawBody: JSON.stringify(body), query: {} });
  }
  return c.redirect(ret);
});
