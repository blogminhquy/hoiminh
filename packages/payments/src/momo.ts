// MoMo: tạo giao dịch ví (captureWallet) và IPN có chữ ký HMAC-SHA256.
import { hmacHex, timingSafeEqual } from '@hoiminh/config';
import type { CheckoutInput, CheckoutResult, IncomingWebhook, NormalizedEvent, PaymentAdapter, RefundInput } from './types';

export interface MomoConfig {
  mode: 'sandbox' | 'production';
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  endpoint: string;
  /** Khi không có credential thật ở môi trường không phải production, dùng trang mô phỏng của API. */
  simulatorUrl?: string;
  appEnv: string;
}

/** Payload IPN MoMo v2. */
export interface MomoIpnPayload {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: number;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number;
  extraData: string;
  signature: string;
}

export class MomoAdapter implements PaymentAdapter {
  readonly provider = 'momo' as const;
  readonly mode: 'sandbox' | 'production';
  constructor(private readonly cfg: MomoConfig) {
    this.mode = cfg.mode;
  }

  private get hasCredentials(): boolean {
    return Boolean(this.cfg.accessKey && this.cfg.secretKey && !this.cfg.accessKey.startsWith('momo-sandbox'));
  }

  /** Chuỗi ký khi tạo giao dịch (thứ tự tham số theo tài liệu MoMo). */
  static createSignatureString(p: { accessKey: string; amount: number; extraData: string; ipnUrl: string; orderId: string; orderInfo: string; partnerCode: string; redirectUrl: string; requestId: string; requestType: string }): string {
    return `accessKey=${p.accessKey}&amount=${p.amount}&extraData=${p.extraData}&ipnUrl=${p.ipnUrl}&orderId=${p.orderId}&orderInfo=${p.orderInfo}&partnerCode=${p.partnerCode}&redirectUrl=${p.redirectUrl}&requestId=${p.requestId}&requestType=${p.requestType}`;
  }

  /** Chuỗi ký của IPN. */
  static ipnSignatureString(accessKey: string, p: MomoIpnPayload): string {
    return `accessKey=${accessKey}&amount=${p.amount}&extraData=${p.extraData}&message=${p.message}&orderId=${p.orderId}&orderInfo=${p.orderInfo}&orderType=${p.orderType}&partnerCode=${p.partnerCode}&payType=${p.payType}&requestId=${p.requestId}&responseTime=${p.responseTime}&resultCode=${p.resultCode}&transId=${p.transId}`;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const requestId = `${input.reference}-${Date.now()}`;
    const body = {
      partnerCode: this.cfg.partnerCode, partnerName: 'Hội Mình', storeId: 'hoiminh', requestId, amount: input.amountMinor, orderId: input.reference,
      orderInfo: input.description, redirectUrl: input.returnUrl, ipnUrl: input.ipnUrl, lang: 'vi', requestType: 'captureWallet', autoCapture: true, extraData: '',
      signature: '',
    };
    body.signature = await hmacHex(this.cfg.secretKey, MomoAdapter.createSignatureString({ accessKey: this.cfg.accessKey, amount: body.amount, extraData: body.extraData, ipnUrl: body.ipnUrl, orderId: body.orderId, orderInfo: body.orderInfo, partnerCode: body.partnerCode, redirectUrl: body.redirectUrl, requestId, requestType: body.requestType }));

    if (!this.hasCredentials && this.cfg.appEnv !== 'production' && this.cfg.simulatorUrl) {
      // Sandbox không có credential: trang mô phỏng của API sẽ gửi IPN đã ký bằng secret sandbox.
      const url = `${this.cfg.simulatorUrl}?provider=momo&orderId=${encodeURIComponent(input.reference)}&amount=${input.amountMinor}&requestId=${encodeURIComponent(requestId)}&return=${encodeURIComponent(input.returnUrl)}`;
      return { provider: 'momo', providerPaymentId: requestId, instruction: { kind: 'redirect', url }, raw: { simulated: true, request: body } };
    }
    const res = await fetch(`${this.cfg.endpoint}/v2/gateway/api/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json()) as { resultCode: number; payUrl?: string; deeplink?: string; message?: string };
    if (data.resultCode !== 0 || !data.payUrl) throw new Error(`MoMo từ chối tạo giao dịch: ${data.message ?? data.resultCode}`);
    return { provider: 'momo', providerPaymentId: requestId, instruction: { kind: 'redirect', url: data.payUrl, deeplink: data.deeplink }, raw: data as unknown as Record<string, unknown> };
  }

  async verifyWebhook(req: IncomingWebhook): Promise<boolean> {
    const p = safeJson<MomoIpnPayload>(req.rawBody);
    if (!p?.signature || p.partnerCode !== this.cfg.partnerCode) return false;
    const expected = await hmacHex(this.cfg.secretKey, MomoAdapter.ipnSignatureString(this.cfg.accessKey, p));
    return timingSafeEqual(expected, p.signature);
  }

  parseWebhook(req: IncomingWebhook): NormalizedEvent | null {
    const p = safeJson<MomoIpnPayload>(req.rawBody);
    if (!p?.orderId) return null;
    return {
      providerEventId: `momo-${p.transId}-${p.resultCode}`,
      type: p.resultCode === 0 ? 'payment.succeeded' : p.resultCode === 1006 || p.resultCode === 1005 ? 'payment.failed' : 'payment.failed',
      reference: p.orderId.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      providerPaymentId: String(p.transId),
      amountMinor: Number(p.amount),
      currency: 'VND',
      transactionAt: p.responseTime ? new Date(Number(p.responseTime)) : new Date(),
      raw: p as unknown as Record<string, unknown>,
    };
  }

  async refund(input: RefundInput): Promise<{ ok: boolean; providerRefundId: string | null; manual: boolean }> {
    if (!this.hasCredentials || !input.providerPaymentId) return { ok: true, providerRefundId: null, manual: true };
    const requestId = `rf-${input.reference}-${Date.now()}`;
    const raw = `accessKey=${this.cfg.accessKey}&amount=${input.amountMinor}&description=${input.reason}&orderId=${requestId}&partnerCode=${this.cfg.partnerCode}&requestId=${requestId}&transId=${input.providerPaymentId}`;
    const signature = await hmacHex(this.cfg.secretKey, raw);
    const res = await fetch(`${this.cfg.endpoint}/v2/gateway/api/refund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partnerCode: this.cfg.partnerCode, orderId: requestId, requestId, amount: input.amountMinor, transId: Number(input.providerPaymentId), lang: 'vi', description: input.reason, signature }) });
    const data = (await res.json()) as { resultCode: number; transId?: number };
    return { ok: data.resultCode === 0, providerRefundId: data.transId ? String(data.transId) : null, manual: false };
  }

  webhookResponse(ok: boolean): { status: number; body: unknown } {
    return { status: ok ? 204 : 400, body: null };
  }
}

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
