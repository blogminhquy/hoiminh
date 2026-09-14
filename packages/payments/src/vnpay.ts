// VNPAY: redirect tới cổng với chữ ký HMAC-SHA512, IPN xác minh vnp_SecureHash.
import { hmacHex, timingSafeEqual } from '@hoiminh/config';
import type { CheckoutInput, CheckoutResult, IncomingWebhook, NormalizedEvent, PaymentAdapter } from './types';

export interface VnpayConfig {
  mode: 'sandbox' | 'production';
  tmnCode: string;
  hashSecret: string;
  endpoint: string;
  simulatorUrl?: string;
  appEnv: string;
}

/** Sắp xếp tham số theo key và encode kiểu VNPAY (dấu cách → +). */
export function vnpQueryString(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k]!).replace(/%20/g, '+')}`)
    .join('&');
}

function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const t = new Date(d.getTime() + 7 * 3_600_000);
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}${p(t.getUTCHours())}${p(t.getUTCMinutes())}${p(t.getUTCSeconds())}`;
}

export class VnpayAdapter implements PaymentAdapter {
  readonly provider = 'vnpay' as const;
  readonly mode: 'sandbox' | 'production';
  constructor(private readonly cfg: VnpayConfig) {
    this.mode = cfg.mode;
  }

  private get hasCredentials(): boolean {
    return Boolean(this.cfg.tmnCode && this.cfg.hashSecret && !this.cfg.hashSecret.startsWith('vnpay-sandbox'));
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const now = new Date();
    const params: Record<string, string> = {
      vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: this.cfg.tmnCode, vnp_Amount: String(input.amountMinor * 100), vnp_CurrCode: 'VND',
      vnp_TxnRef: input.reference.replace(/\s/g, ''), vnp_OrderInfo: input.description, vnp_OrderType: 'other', vnp_Locale: 'vn',
      vnp_ReturnUrl: input.returnUrl, vnp_IpAddr: '127.0.0.1', vnp_CreateDate: fmt(now), vnp_ExpireDate: fmt(new Date(now.getTime() + 30 * 60_000)),
    };
    const qs = vnpQueryString(params);
    const hash = await hmacHex(this.cfg.hashSecret, qs, 'SHA-512');
    if (!this.hasCredentials && this.cfg.appEnv !== 'production' && this.cfg.simulatorUrl) {
      const url = `${this.cfg.simulatorUrl}?provider=vnpay&orderId=${encodeURIComponent(params.vnp_TxnRef!)}&amount=${input.amountMinor}&return=${encodeURIComponent(input.returnUrl)}`;
      return { provider: 'vnpay', providerPaymentId: null, instruction: { kind: 'redirect', url }, raw: { simulated: true, params } };
    }
    return { provider: 'vnpay', providerPaymentId: null, instruction: { kind: 'redirect', url: `${this.cfg.endpoint}?${qs}&vnp_SecureHash=${hash}` }, raw: { params } };
  }

  async verifyWebhook(req: IncomingWebhook): Promise<boolean> {
    const q = { ...req.query };
    const given = q['vnp_SecureHash'];
    if (!given) return false;
    delete q['vnp_SecureHash'];
    delete q['vnp_SecureHashType'];
    const expected = await hmacHex(this.cfg.hashSecret, vnpQueryString(q), 'SHA-512');
    return timingSafeEqual(expected.toLowerCase(), given.toLowerCase());
  }

  parseWebhook(req: IncomingWebhook): NormalizedEvent | null {
    const q = req.query;
    if (!q['vnp_TxnRef']) return null;
    const ok = q['vnp_ResponseCode'] === '00' && (q['vnp_TransactionStatus'] ?? '00') === '00';
    return {
      providerEventId: `vnpay-${q['vnp_TransactionNo'] ?? q['vnp_TxnRef']}-${q['vnp_ResponseCode']}`,
      type: ok ? 'payment.succeeded' : 'payment.failed',
      reference: q['vnp_TxnRef'].toUpperCase().replace(/[^A-Z0-9]/g, ''),
      providerPaymentId: q['vnp_TransactionNo'] ?? null,
      amountMinor: Math.round(Number(q['vnp_Amount'] ?? 0) / 100),
      currency: 'VND',
      transactionAt: parseVnpDate(q['vnp_PayDate']),
      raw: q,
    };
  }

  async refund(): Promise<{ ok: boolean; providerRefundId: string | null; manual: boolean }> {
    return { ok: true, providerRefundId: null, manual: true };
  }

  webhookResponse(ok: boolean): { status: number; body: unknown } {
    return { status: 200, body: ok ? { RspCode: '00', Message: 'Confirm Success' } : { RspCode: '97', Message: 'Invalid signature' } };
  }
}

function parseVnpDate(s?: string): Date {
  if (!s || s.length !== 14) return new Date();
  return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}+07:00`);
}
