// Test 5 adapter với payload mẫu theo đúng định dạng của từng cổng.
import { hmacHex, loadEnv } from '@hoiminh/config';
import { describe, expect, it } from 'vitest';
import { MomoAdapter, type MomoIpnPayload } from './momo';
import { PaypalAdapter } from './paypal';
import { SepayAdapter } from './sepay';
import { StripeAdapter } from './stripe';
import { createPaymentRouter } from './index';
import { extractReference, normalizeReference } from './types';
import { VnpayAdapter, vnpQueryString } from './vnpay';

describe('reference', () => {
  it('tách mã HM từ nội dung chuyển khoản tự do', () => {
    expect(extractReference('NGUYEN VAN A ck HM8K2QX')).toBe('HM8K2QX');
    expect(extractReference('PHAM D HM 4TT9A')).toBe('HM4TT9A');
    expect(extractReference('TRAN THI B chuyen tien')).toBeNull();
    expect(normalizeReference('hm 8k2qx')).toBe('HM8K2QX');
  });
});

describe('SePay', () => {
  const sepay = new SepayAdapter({ mode: 'sandbox', apiKey: 'test-key', bankCode: 'VCB', bankAccount: '0071000123456', accountHolder: 'HOI MINH JSC', qrTemplate: 'compact' });
  const payload = { id: 92704, gateway: 'Vietcombank', transactionDate: '2026-09-14 09:03:11', accountNumber: '0071000123456', code: null, content: 'NGUYEN NGOC DIEN chuyen tien HM 8K2QX', transferType: 'in', transferAmount: 249000, accumulated: 19077000, subAccount: null, referenceCode: 'MBVCB.3278907687', description: '' };

  it('tạo QR VietQR với nội dung HM', async () => {
    const r = await sepay.createCheckout({ reference: 'HM8K2QX', orderId: 'o', amountMinor: 249000, currency: 'VND', description: 'Premium', customerEmail: 'a@b.vn', returnUrl: 'http://x', ipnUrl: 'http://y' });
    expect(r.instruction.kind).toBe('bank_qr');
    if (r.instruction.kind === 'bank_qr') {
      expect(r.instruction.qrImageUrl).toContain('des=HM8K2QX');
      expect(r.instruction.qrImageUrl).toContain('amount=249000');
    }
  });
  it('xác thực header Apikey', async () => {
    expect(await sepay.verifyWebhook({ headers: { authorization: 'Apikey test-key' }, rawBody: JSON.stringify(payload), query: {} })).toBe(true);
    expect(await sepay.verifyWebhook({ headers: { authorization: 'Apikey sai' }, rawBody: '{}', query: {} })).toBe(false);
  });
  it('chuẩn hóa webhook báo có', () => {
    const e = sepay.parseWebhook({ headers: {}, rawBody: JSON.stringify(payload), query: {} });
    expect(e?.type).toBe('payment.succeeded');
    expect(e?.reference).toBe('HM8K2QX');
    expect(e?.amountMinor).toBe(249000);
    expect(e?.providerEventId).toBe('sepay-92704');
  });
});

describe('MoMo', () => {
  const cfg = { mode: 'sandbox' as const, partnerCode: 'MOMOTEST', accessKey: 'F8BBA842ECF85', secretKey: 'K951B6PE1waDMi640xX08PD3vg6EkVlz', endpoint: 'https://test-payment.momo.vn', appEnv: 'test' };
  const momo = new MomoAdapter(cfg);
  it('IPN đúng chữ ký', async () => {
    const p: MomoIpnPayload = { partnerCode: 'MOMOTEST', orderId: 'HM8K2QX', requestId: 'HM8K2QX-1', amount: 249000, orderInfo: 'Premium', orderType: 'momo_wallet', transId: 2147483647, resultCode: 0, message: 'Successful.', payType: 'qr', responseTime: 1757836991000, extraData: '', signature: '' };
    p.signature = await hmacHex(cfg.secretKey, MomoAdapter.ipnSignatureString(cfg.accessKey, p));
    const req = { headers: {}, rawBody: JSON.stringify(p), query: {} };
    expect(await momo.verifyWebhook(req)).toBe(true);
    const e = momo.parseWebhook(req);
    expect(e?.type).toBe('payment.succeeded');
    expect(e?.reference).toBe('HM8K2QX');
    p.signature = 'abc';
    expect(await momo.verifyWebhook({ ...req, rawBody: JSON.stringify(p) })).toBe(false);
  });
  it('resultCode khác 0 là thất bại', () => {
    const e = momo.parseWebhook({ headers: {}, rawBody: JSON.stringify({ orderId: 'HM1', transId: 1, resultCode: 1006, amount: 1 }), query: {} });
    expect(e?.type).toBe('payment.failed');
  });
});

describe('VNPAY', () => {
  const secret = 'RAOEXHYVSDDIIENYWSLDIIZTANXUXZFJ';
  const vnpay = new VnpayAdapter({ mode: 'sandbox', tmnCode: 'HOIMINH1', hashSecret: secret, endpoint: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html', appEnv: 'test' });
  it('IPN đúng chữ ký SHA512 trên tham số sắp xếp', async () => {
    const q: Record<string, string> = { vnp_Amount: '249000000', vnp_BankCode: 'NCB', vnp_BankTranNo: 'VNP14234567', vnp_CardType: 'ATM', vnp_OrderInfo: 'Premium thang', vnp_PayDate: '20260914090311', vnp_ResponseCode: '00', vnp_TmnCode: 'HOIMINH1', vnp_TransactionNo: '14234567', vnp_TransactionStatus: '00', vnp_TxnRef: 'HM8K2QX' };
    q.vnp_SecureHash = await hmacHex(secret, vnpQueryString(q), 'SHA-512');
    expect(await vnpay.verifyWebhook({ headers: {}, rawBody: '', query: q })).toBe(true);
    const e = vnpay.parseWebhook({ headers: {}, rawBody: '', query: q });
    expect(e?.type).toBe('payment.succeeded');
    expect(e?.amountMinor).toBe(2490000);
    expect(e?.reference).toBe('HM8K2QX');
    expect(await vnpay.verifyWebhook({ headers: {}, rawBody: '', query: { ...q, vnp_Amount: '1' } })).toBe(false);
  });
  it('tạo URL redirect có vnp_SecureHash', async () => {
    const r = await vnpay.createCheckout({ reference: 'HM 8K2QX', orderId: 'o', amountMinor: 249000, currency: 'VND', description: 'Premium', customerEmail: 'a@b.vn', returnUrl: 'http://x', ipnUrl: 'http://y' });
    expect(r.instruction.kind).toBe('redirect');
    if (r.instruction.kind === 'redirect') expect(r.instruction.url).toContain('vnp_SecureHash=');
  });
});

describe('PayPal', () => {
  it('quy đổi USD và chuẩn hóa webhook capture', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ access_token: 't', verification_status: 'SUCCESS' }), { status: 200 });
    };
    const pp = new PaypalAdapter({ mode: 'sandbox', clientId: 'id', clientSecret: 'secret', webhookId: 'wh', usdRate: 25000, appEnv: 'test' }, fetchImpl);
    expect(pp.toUsdCents(249000)).toBe(996);
    const body = { id: 'WH-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', create_time: '2026-09-14T02:03:11Z', resource: { id: 'CAP-1', custom_id: 'HM8K2QX', amount: { value: '9.96', currency_code: 'USD' } } };
    const req = { headers: { 'paypal-transmission-id': 'x' }, rawBody: JSON.stringify(body), query: {} };
    expect(await pp.verifyWebhook(req)).toBe(true);
    expect(calls.some((c) => c.includes('verify-webhook-signature'))).toBe(true);
    const e = pp.parseWebhook(req);
    expect(e?.type).toBe('payment.succeeded');
    expect(e?.reference).toBe('HM8K2QX');
    expect(e?.amountMinor).toBe(996);
  });
});

describe('PayPal hai bước', () => {
  const body = (event_type: string, currency = 'USD') => ({ id: 'WH-2', event_type, resource: { id: 'ORDER-1', purchase_units: [{ custom_id: 'HM8K2QX', amount: { value: '9.96', currency_code: currency } }] } });
  const req = (b: unknown) => ({ headers: {}, rawBody: JSON.stringify(b), query: {} });

  it('ORDER.APPROVED chỉ là đã duyệt, chưa phải đã trả; tiền tệ lạ bị bỏ qua', () => {
    const pp = new PaypalAdapter({ mode: 'sandbox', clientId: 'id', clientSecret: 'secret', webhookId: 'wh', usdRate: 25000, appEnv: 'test' });
    expect(pp.parseWebhook(req(body('CHECKOUT.ORDER.APPROVED')))?.type).toBe('payment.approved');
    expect(pp.parseWebhook(req(body('PAYMENT.CAPTURE.COMPLETED', 'EUR')))?.type).toBe('ignored');
  });

  it('capture gọi đúng API, order đã capture trước đó vẫn tính là xong', async () => {
    const calls: string[] = [];
    let captured = false;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/capture')) {
        if (captured) return new Response(JSON.stringify({ details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] }), { status: 422 });
        captured = true;
        return new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 201 });
      }
      return new Response(JSON.stringify({ access_token: 't' }), { status: 200 });
    };
    const pp = new PaypalAdapter({ mode: 'sandbox', clientId: 'id', clientSecret: 'secret', webhookId: 'wh', usdRate: 25000, appEnv: 'test' }, fetchImpl);
    expect(await pp.capture('ORDER-1')).toEqual({ ok: true });
    expect(await pp.capture('ORDER-1')).toEqual({ ok: true });
    expect(calls.filter((c) => c.includes('/v2/checkout/orders/ORDER-1/capture'))).toHaveLength(2);
  });

  it('hoàn tiền luôn gửi số tiền, để hoàn một phần không thành hoàn toàn bộ', async () => {
    let sent: unknown = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes('/refund')) {
        sent = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ id: 'RF-1', status: 'COMPLETED' }), { status: 201 });
      }
      return new Response(JSON.stringify({ access_token: 't' }), { status: 200 });
    };
    const pp = new PaypalAdapter({ mode: 'sandbox', clientId: 'id', clientSecret: 'secret', webhookId: 'wh', usdRate: 25000, appEnv: 'test' }, fetchImpl);
    const r = await pp.refund({ providerPaymentId: 'CAP-1', reference: 'HM 8K2QX', amountMinor: 250, reason: 'một phần' });
    expect(r.ok).toBe(true);
    expect(sent).toMatchObject({ amount: { value: '2.50', currency_code: 'USD' } });
  });
});

describe('Stripe', () => {
  const NOW = 1_794_600_000;
  const cfg = { mode: 'sandbox' as const, secretKey: 'sk_test_51Abc', webhookSecret: 'whsec_test_secret', appEnv: 'test' };
  const session = (over: Record<string, unknown> = {}) => ({ id: 'evt_1', type: 'checkout.session.completed', created: NOW, data: { object: { id: 'cs_test_1', client_reference_id: 'HM8K2QX', amount_total: 249000, currency: 'vnd', payment_status: 'paid', payment_intent: 'pi_1', metadata: { reference: 'HM8K2QX' }, ...over } } });
  const signed = async (body: unknown, t = NOW, secret = cfg.webhookSecret) => {
    const rawBody = JSON.stringify(body);
    return { headers: { 'stripe-signature': `t=${t},v1=${await hmacHex(secret, StripeAdapter.signedPayload(t, rawBody))}` }, rawBody, query: {} };
  };

  it('tạo phiên Checkout bằng VND: số tiền đúng bằng số đồng, có mã đơn để khớp', async () => {
    let sent = '';
    let headers: Record<string, string> = {};
    const fetchImpl: typeof fetch = async (_input, init) => {
      sent = String(init?.body);
      headers = init?.headers as Record<string, string>;
      return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 });
    };
    const stripe = new StripeAdapter(cfg, fetchImpl, () => NOW);
    const r = await stripe.createCheckout({ reference: 'HM 8K2QX', orderId: 'o1', amountMinor: 249000, currency: 'VND', description: 'Premium', customerEmail: 'a@b.vn', returnUrl: 'http://x/thanh-toan/o1', ipnUrl: 'http://y' });
    expect(r).toMatchObject({ provider: 'stripe', providerPaymentId: 'cs_test_1', instruction: { kind: 'redirect', url: 'https://checkout.stripe.com/c/pay/cs_test_1' } });
    const form = new URLSearchParams(sent);
    expect(form.get('line_items[0][price_data][currency]')).toBe('vnd');
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('249000');
    expect(form.get('client_reference_id')).toBe('HM8K2QX');
    expect(form.get('payment_intent_data[metadata][reference]')).toBe('HM8K2QX');
    expect(headers.Authorization).toBe('Bearer sk_test_51Abc');
  });

  it('webhook đúng chữ ký thì nhận; sai khóa, sửa nội dung, quá 5 phút thì từ chối', async () => {
    const stripe = new StripeAdapter(cfg, fetch, () => NOW);
    const req = await signed(session());
    expect(await stripe.verifyWebhook(req)).toBe(true);
    expect(await stripe.verifyWebhook(await signed(session(), NOW, 'whsec_khac'))).toBe(false);
    expect(await stripe.verifyWebhook({ ...req, rawBody: req.rawBody.replace('249000', '1000') })).toBe(false);
    expect(await stripe.verifyWebhook(await signed(session(), NOW - 301))).toBe(false);
    expect(await stripe.verifyWebhook({ ...req, headers: {} })).toBe(false);
  });

  it('chuẩn hóa sự kiện: đã trả, chưa có tiền, thất bại, hoàn tiền (tổng đã hoàn)', () => {
    const stripe = new StripeAdapter(cfg);
    const parse = (b: unknown) => stripe.parseWebhook({ headers: {}, rawBody: JSON.stringify(b), query: {} });
    expect(parse(session())).toMatchObject({ type: 'payment.succeeded', reference: 'HM8K2QX', amountMinor: 249000, currency: 'VND', providerPaymentId: 'pi_1', providerEventId: 'stripe-evt_1' });
    expect(parse(session({ payment_status: 'unpaid' }))?.type).toBe('ignored');
    expect(parse({ ...session(), type: 'checkout.session.async_payment_succeeded' })?.type).toBe('payment.succeeded');
    expect(parse({ ...session(), type: 'checkout.session.expired' })?.type).toBe('payment.failed');
    expect(parse(session({ currency: 'eur' }))?.type).toBe('ignored');
    expect(parse({ id: 'evt_2', type: 'charge.refunded', created: NOW, data: { object: { payment_intent: 'pi_1', amount_refunded: 100000, currency: 'vnd', metadata: {} } } })).toMatchObject({ type: 'payment.refunded', providerPaymentId: 'pi_1', amountMinor: 100000, cumulative: true, reference: null });
  });

  it('khóa thử của Hội Mình ở máy dev đi qua trang mô phỏng, không gọi Stripe', async () => {
    const stripe = new StripeAdapter({ ...cfg, secretKey: 'sk_test_hoiminh_e2e', simulatorUrl: 'http://api/pay/simulator' }, async () => { throw new Error('không được gọi Stripe'); });
    const r = await stripe.createCheckout({ reference: 'HM 8K2QX', orderId: 'o1', amountMinor: 249000, currency: 'VND', description: 'Premium', customerEmail: 'a@b.vn', returnUrl: 'http://x', ipnUrl: 'http://y' });
    expect(r.instruction).toMatchObject({ kind: 'redirect', url: expect.stringContaining('http://api/pay/simulator?provider=stripe&orderId=HM8K2QX&amount=249000') });
    const staging = new StripeAdapter({ ...cfg, secretKey: 'sk_test_hoiminh_e2e', appEnv: 'staging', simulatorUrl: 'http://api/pay/simulator' });
    await expect(staging.createCheckout({ reference: 'HM 1', orderId: 'o', amountMinor: 1, currency: 'VND', description: '', customerEmail: '', returnUrl: '', ipnUrl: '' })).rejects.toThrow(/khóa/);
  });

  it('hoàn tiền gọi API refunds với payment_intent và số tiền', async () => {
    let sent = '';
    const fetchImpl: typeof fetch = async (_input, init) => {
      sent = String(init?.body);
      return new Response(JSON.stringify({ id: 're_1', status: 'succeeded' }), { status: 200 });
    };
    const stripe = new StripeAdapter(cfg, fetchImpl);
    expect(await stripe.refund({ providerPaymentId: 'pi_1', reference: 'HM 8K2QX', amountMinor: 50000, reason: 'x' })).toEqual({ ok: true, providerRefundId: 're_1', manual: false });
    expect(new URLSearchParams(sent).get('amount')).toBe('50000');
    expect(await stripe.refund({ providerPaymentId: 'cs_test_1', reference: 'HM 8K2QX', amountMinor: 1, reason: 'x' })).toMatchObject({ manual: true });
  });
});

describe('Cổng dùng bí mật mặc định', () => {
  it('ngoài máy dev bị khóa: không tạo thanh toán, webhook đúng khóa mặc định vẫn bị từ chối', async () => {
    const env = loadEnv({ APP_ENV: 'staging' });
    const router = createPaymentRouter(env, 'http://localhost/pay/simulator');
    const req = { headers: { authorization: `Apikey ${env.SEPAY_API_KEY}` }, rawBody: '{}', query: {} };
    expect(await router.get('sepay').verifyWebhook(req)).toBe(false);
    await expect(router.get('momo').createCheckout({ reference: 'HM 1', orderId: 'o', amountMinor: 1, currency: 'VND', description: '', customerEmail: '', returnUrl: '', ipnUrl: '' })).rejects.toThrow(/khóa/);
    const real = createPaymentRouter(loadEnv({ APP_ENV: 'staging', SEPAY_API_KEY: 'khoa-that' }), '');
    expect(await real.get('sepay').verifyWebhook({ ...req, headers: { authorization: 'Apikey khoa-that' } })).toBe(true);
  });

  it('ở dev và test vẫn dùng được như trước', async () => {
    const env = loadEnv({ APP_ENV: 'test' });
    const router = createPaymentRouter(env, '');
    expect(await router.get('sepay').verifyWebhook({ headers: { authorization: `Apikey ${env.SEPAY_API_KEY}` }, rawBody: '{}', query: {} })).toBe(true);
  });
});

describe('Production thiếu bí mật', () => {
  it('dừng khởi động khi AUTH_JWT_SECRET mặc định hoặc thiếu ENCRYPTION_KEY', () => {
    expect(() => loadEnv({ APP_ENV: 'production' })).toThrow(/AUTH_JWT_SECRET/);
    expect(() => loadEnv({ APP_ENV: 'production', AUTH_JWT_SECRET: 'x'.repeat(40) })).toThrow(/ENCRYPTION_KEY/);
    expect(() => loadEnv({ APP_ENV: 'production', AUTH_JWT_SECRET: 'x'.repeat(40), ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' })).not.toThrow();
  });
});
