// Test 4 adapter với payload mẫu theo đúng định dạng của từng cổng.
import { hmacHex } from '@hoiminh/config';
import { describe, expect, it } from 'vitest';
import { MomoAdapter, type MomoIpnPayload } from './momo';
import { PaypalAdapter } from './paypal';
import { SepayAdapter } from './sepay';
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
