// PayPal: tạo order USD qua REST (sandbox), webhook xác minh bằng API verify-webhook-signature.
import type { CheckoutInput, CheckoutResult, IncomingWebhook, NormalizedEvent, PaymentAdapter, RefundInput } from './types';

export interface PaypalConfig {
  mode: 'sandbox' | 'production';
  clientId: string;
  clientSecret: string;
  webhookId: string;
  usdRate: number;
  simulatorUrl?: string;
  appEnv: string;
}

export class PaypalAdapter implements PaymentAdapter {
  readonly provider = 'paypal' as const;
  readonly mode: 'sandbox' | 'production';
  constructor(private readonly cfg: PaypalConfig, private readonly fetchImpl: typeof fetch = fetch) {
    this.mode = cfg.mode;
  }

  private get base(): string {
    return this.cfg.mode === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }
  private get hasCredentials(): boolean {
    return Boolean(this.cfg.clientId && this.cfg.clientSecret);
  }

  /** Quy đổi VND → USD (cent) theo tỷ giá cấu hình, làm tròn lên cent. */
  toUsdCents(amountVnd: number): number {
    return Math.ceil((amountVnd * 100) / this.cfg.usdRate - 1e-9);
  }

  private async token(): Promise<string> {
    const res = await this.fetchImpl(`${this.base}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${this.cfg.clientId}:${this.cfg.clientSecret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const usdCents = input.currency === 'USD' ? input.amountMinor : this.toUsdCents(input.amountMinor);
    const value = (usdCents / 100).toFixed(2);
    if (!this.hasCredentials && this.cfg.appEnv !== 'production' && this.cfg.simulatorUrl) {
      const url = `${this.cfg.simulatorUrl}?provider=paypal&orderId=${encodeURIComponent(input.reference)}&amount=${usdCents}&return=${encodeURIComponent(input.returnUrl)}`;
      return { provider: 'paypal', providerPaymentId: null, instruction: { kind: 'redirect', url }, raw: { simulated: true, usd: value } };
    }
    const res = await this.fetchImpl(`${this.base}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: input.reference, custom_id: input.reference, description: input.description, amount: { currency_code: 'USD', value } }], application_context: { return_url: input.returnUrl, cancel_url: input.returnUrl, brand_name: 'Hội Mình', user_action: 'PAY_NOW' } }),
    });
    const data = (await res.json()) as { id: string; links?: Array<{ rel: string; href: string }> };
    const approve = data.links?.find((l) => l.rel === 'approve')?.href;
    if (!approve) throw new Error('PayPal không trả về link phê duyệt');
    return { provider: 'paypal', providerPaymentId: data.id, instruction: { kind: 'redirect', url: approve }, raw: data as unknown as Record<string, unknown> };
  }

  async verifyWebhook(req: IncomingWebhook): Promise<boolean> {
    if (!this.hasCredentials) {
      // Sandbox không credential: chấp nhận webhook do trang mô phỏng của chính API gửi kèm header nội bộ.
      return req.headers['x-hoiminh-simulator'] === 'paypal' && this.cfg.appEnv !== 'production';
    }
    const h = req.headers;
    const res = await this.fetchImpl(`${this.base}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_algo: h['paypal-auth-algo'], cert_url: h['paypal-cert-url'], transmission_id: h['paypal-transmission-id'], transmission_sig: h['paypal-transmission-sig'], transmission_time: h['paypal-transmission-time'], webhook_id: this.cfg.webhookId, webhook_event: JSON.parse(req.rawBody) }),
    });
    const data = (await res.json()) as { verification_status?: string };
    return data.verification_status === 'SUCCESS';
  }

  parseWebhook(req: IncomingWebhook): NormalizedEvent | null {
    let e: { id: string; event_type: string; create_time?: string; resource?: { id?: string; custom_id?: string; amount?: { value: string; currency_code: string }; purchase_units?: Array<{ custom_id?: string; reference_id?: string; amount?: { value: string } }> } };
    try {
      e = JSON.parse(req.rawBody);
    } catch {
      return null;
    }
    if (!e?.id || !e.event_type) return null;
    const r = e.resource ?? {};
    const unit = r.purchase_units?.[0];
    const reference = (r.custom_id ?? unit?.custom_id ?? unit?.reference_id ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
    const value = Number(r.amount?.value ?? unit?.amount?.value ?? 0);
    const type = e.event_type === 'PAYMENT.CAPTURE.COMPLETED' || e.event_type === 'CHECKOUT.ORDER.APPROVED' ? 'payment.succeeded' : e.event_type === 'PAYMENT.CAPTURE.REFUNDED' ? 'payment.refunded' : e.event_type === 'PAYMENT.CAPTURE.DENIED' ? 'payment.failed' : 'ignored';
    return { providerEventId: `paypal-${e.id}`, type, reference, providerPaymentId: r.id ?? null, amountMinor: Math.round(value * 100), currency: 'USD', transactionAt: e.create_time ? new Date(e.create_time) : new Date(), raw: e as unknown as Record<string, unknown> };
  }

  async refund(input: RefundInput): Promise<{ ok: boolean; providerRefundId: string | null; manual: boolean }> {
    if (!this.hasCredentials || !input.providerPaymentId) return { ok: true, providerRefundId: null, manual: true };
    const res = await this.fetchImpl(`${this.base}/v2/payments/captures/${input.providerPaymentId}/refund`, { method: 'POST', headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ note_to_payer: input.reason }) });
    const data = (await res.json()) as { id?: string; status?: string };
    return { ok: data.status === 'COMPLETED' || data.status === 'PENDING', providerRefundId: data.id ?? null, manual: false };
  }

  webhookResponse(ok: boolean): { status: number; body: unknown } {
    return { status: ok ? 200 : 400, body: { received: ok } };
  }
}
