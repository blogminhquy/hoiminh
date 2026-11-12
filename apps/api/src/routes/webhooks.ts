// Webhook nhận từ cổng thanh toán (không cần đăng nhập, verify chữ ký trong service) + trang mô phỏng cho sandbox không credential.
import { hmacHex, isLocalEnv, type Env } from '@hoiminh/config';
import { ownerPayout, paymentsService, AppError } from '@hoiminh/core';
import { MomoAdapter, vnpQueryString } from '@hoiminh/payments';
import { query, router, type Ctx$ } from '../lib/hono';
import { rateLimit } from '../middleware/rate-limit';

export const webhookRoutes = router();
webhookRoutes.use('*', rateLimit('webhook', { scope: 'webhook' }));

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
// Dịch vụ báo có của chủ hội (định dạng SePay) gọi về địa chỉ riêng của từng hội; mã trong địa chỉ là bí mật.
webhookRoutes.post('/bank/:token', async (c) => {
  const r = await ownerPayout.handleOwnerBankWebhook(c.get('ctx'), c.req.param('token'), await incoming(c));
  return c.json(r.body as Record<string, unknown>, r.status as 200);
});
// VNPAY gọi IPN bằng GET với query string; return URL của trình duyệt không được tin (chỉ để hiển thị).
webhookRoutes.get('/vnpay', async (c) => {
  const r = await paymentsService.handleWebhook(c.get('ctx'), 'vnpay', await incoming(c));
  return c.json(r.body as Record<string, unknown>, r.status as 200);
});
webhookRoutes.post('/vnpay', async (c) => {
  const r = await paymentsService.handleWebhook(c.get('ctx'), 'vnpay', await incoming(c));
  return c.json(r.body as Record<string, unknown>, r.status as 200);
});

/** Thoát ký tự HTML: mọi giá trị từ query string đều do người lạ kiểm soát. */
function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/** Chỉ quay về chính web của mình; đường dẫn lạ (trang giả mạo) thì về trang chủ. */
function safeReturn(env: Env, value: unknown): string {
  try {
    const url = new URL(String(value ?? ''), env.APP_URL);
    return url.origin === new URL(env.APP_URL).origin ? url.toString() : env.APP_URL;
  } catch {
    return env.APP_URL;
  }
}

/** Trang này đánh dấu đơn "đã thanh toán" mà không cần tiền thật: chỉ mở ở máy dev và khi chạy test. */
function requireLocal(env: Env): void {
  if (!isLocalEnv(env.APP_ENV)) throw new AppError('not_found', 'Không có trang này');
}

/** Trang mô phỏng thanh toán cho sandbox không có credential (chỉ ở dev và test). */
export const simulatorRoutes = router();
simulatorRoutes.get('/', (c) => {
  const env = c.get('ctx').env;
  requireLocal(env);
  const q = query(c);
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Mô phỏng ${esc(q.provider)}</title><style>body{font-family:'Open Sans',system-ui,sans-serif;background:#F7F3EC;color:#1F1B17;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:#FFFDF9;border:1px solid #E8E1D6;border-radius:16px;padding:32px;max-width:420px;width:100%}h1{font-family:Montserrat,sans-serif;font-size:22px;margin:0 0 8px}p{color:#5C554D}button{display:block;width:100%;margin-top:12px;height:44px;border:0;border-radius:10px;font-weight:600;font-size:15px;cursor:pointer}.ok{background:#D4593A;color:#fff}.no{background:#F7F3EC;color:#1F1B17}</style></head><body><div class="card"><h1>Sandbox ${esc(String(q.provider ?? '').toUpperCase())}</h1><p>Đây là trang mô phỏng vì chưa cấu hình credential thật. Số tiền: <strong>${esc(Number(q.amount).toLocaleString('vi-VN'))}</strong> · Đơn: <strong>${esc(q.orderId)}</strong></p><form method="post" action="/pay/simulator/confirm"><input type="hidden" name="provider" value="${esc(q.provider)}"><input type="hidden" name="orderId" value="${esc(q.orderId)}"><input type="hidden" name="amount" value="${esc(q.amount)}"><input type="hidden" name="requestId" value="${esc(q.requestId)}"><input type="hidden" name="return" value="${esc(safeReturn(env, q.return))}"><button class="ok" name="result" value="success">Thanh toán thành công</button><button class="no" name="result" value="fail">Thanh toán thất bại</button></form></div></body></html>`;
  return c.html(html);
});
simulatorRoutes.post('/confirm', async (c) => {
  const ctx = c.get('ctx');
  const env = ctx.env;
  requireLocal(env);
  const form = await c.req.parseBody();
  const provider = String(form.provider);
  const orderId = String(form.orderId);
  const amount = Number(form.amount);
  const success = form.result === 'success';
  const ret = safeReturn(env, form.return);
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
