// Stripe: thanh toán thẻ quốc tế qua trang Stripe Checkout (Visa, Mastercard, ...). Tạo phiên bằng REST, webhook ký
// HMAC-SHA256 theo header Stripe-Signature. VND là tiền không có phần lẻ ở Stripe nên số tiền gửi đi đúng bằng số đồng.
import { hmacHex, isLocalEnv, timingSafeEqual } from '@hoiminh/config';
import type { CheckoutInput, CheckoutResult, IncomingWebhook, NormalizedEvent, PaymentAdapter, RefundInput } from './types';

export interface StripeConfig {
  mode: 'sandbox' | 'production';
  /** Khóa bí mật `sk_live_...` hoặc `sk_test_...`. */
  secretKey: string;
  /** Mã ký webhook `whsec_...` của địa chỉ webhook đã tạo trong Stripe. */
  webhookSecret: string;
  simulatorUrl?: string;
  appEnv: string;
}

/** Webhook cũ hơn chừng này (giây) bị từ chối, để không ai phát lại một webhook thật đã lộ. */
export const STRIPE_TOLERANCE_SECONDS = 300;

/** Khóa thử của Hội Mình cho máy dev và test: đi qua trang mô phỏng, không gọi Stripe. */
export const STRIPE_SIMULATOR_KEY_PREFIX = 'sk_test_hoiminh';

interface StripeEvent {
  id: string;
  type: string;
  created?: number;
  data?: { object?: Record<string, unknown> };
}

/** Mã hóa form kiểu Stripe: khóa lồng nhau viết bằng ngoặc vuông (`line_items[0][price_data][currency]`). */
export function stripeForm(params: Record<string, string | number>): string {
  return Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export class StripeAdapter implements PaymentAdapter {
  readonly provider = 'stripe' as const;
  readonly mode: 'sandbox' | 'production';
  constructor(private readonly cfg: StripeConfig, private readonly fetchImpl: typeof fetch = fetch, private readonly nowSeconds: () => number = () => Math.floor(Date.now() / 1000)) {
    this.mode = cfg.mode;
  }

  private get hasCredentials(): boolean {
    return this.cfg.secretKey.startsWith('sk_') && !this.cfg.secretKey.startsWith(STRIPE_SIMULATOR_KEY_PREFIX);
  }

  private headers(idempotencyKey?: string): Record<string, string> {
    return { Authorization: `Bearer ${this.cfg.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) };
  }

  /** Chuỗi được ký trong header Stripe-Signature: `<t>.<raw body>`. */
  static signedPayload(timestamp: number | string, rawBody: string): string {
    return `${timestamp}.${rawBody}`;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const reference = input.reference.replace(/\s/g, '');
    if (!this.hasCredentials && isLocalEnv(this.cfg.appEnv) && this.cfg.simulatorUrl) {
      const url = `${this.cfg.simulatorUrl}?provider=stripe&orderId=${encodeURIComponent(reference)}&amount=${input.amountMinor}&return=${encodeURIComponent(input.returnUrl)}`;
      return { provider: 'stripe', providerPaymentId: null, instruction: { kind: 'redirect', url }, raw: { simulated: true } };
    }
    if (!this.hasCredentials) throw new Error('Stripe chưa có khóa bí mật');
    const currency = input.currency.toLowerCase();
    const body = stripeForm({
      mode: 'payment',
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][unit_amount]': input.amountMinor,
      'line_items[0][price_data][product_data][name]': input.description.slice(0, 250),
      success_url: input.returnUrl,
      cancel_url: input.returnUrl,
      client_reference_id: reference,
      customer_email: input.customerEmail,
      'metadata[reference]': reference,
      'metadata[order_id]': input.orderId,
      'payment_intent_data[metadata][reference]': reference,
      'payment_intent_data[metadata][order_id]': input.orderId,
      locale: 'vi',
    });
    const res = await this.fetchImpl('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: this.headers(`checkout-${reference}`), body });
    const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
    if (!res.ok || !data.url || !data.id) throw new Error(`Stripe từ chối tạo phiên thanh toán: ${data.error?.message ?? res.status}`);
    return { provider: 'stripe', providerPaymentId: data.id, instruction: { kind: 'redirect', url: data.url }, raw: { id: data.id } };
  }

  async verifyWebhook(req: IncomingWebhook): Promise<boolean> {
    const header = req.headers['stripe-signature'];
    if (!header || !this.cfg.webhookSecret) return false;
    const parts = header.split(',').map((p) => p.trim().split('=') as [string, string | undefined]);
    const t = parts.find(([k]) => k === 't')?.[1];
    const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v ?? '');
    if (!t || !/^\d+$/.test(t) || !signatures.length) return false;
    if (Math.abs(this.nowSeconds() - Number(t)) > STRIPE_TOLERANCE_SECONDS) return false;
    const expected = await hmacHex(this.cfg.webhookSecret, StripeAdapter.signedPayload(t, req.rawBody));
    return signatures.some((s) => timingSafeEqual(expected, s));
  }

  parseWebhook(req: IncomingWebhook): NormalizedEvent | null {
    let e: StripeEvent;
    try {
      e = JSON.parse(req.rawBody) as StripeEvent;
    } catch {
      return null;
    }
    if (!e?.id || !e.type) return null;
    const o = e.data?.object ?? {};
    const meta = (o.metadata ?? {}) as Record<string, unknown>;
    const ref = String(o.client_reference_id ?? meta.reference ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
    const currency = String(o.currency ?? '').toUpperCase();
    const at = e.created ? new Date(e.created * 1000) : new Date();
    const base = { providerEventId: `stripe-${e.id}`, reference: ref, transactionAt: at, raw: e as unknown as Record<string, unknown> };
    // Chỉ tạo phiên bằng VND hoặc USD; tiền tệ khác nghĩa là sự kiện không phải của mình.
    if (currency !== 'VND' && currency !== 'USD') return { ...base, type: 'ignored', providerPaymentId: null, amountMinor: 0, currency: 'VND' };
    const cur = currency as 'VND' | 'USD';
    if (e.type === 'checkout.session.completed' || e.type === 'checkout.session.async_payment_succeeded') {
      // Phiên xong nhưng chưa có tiền (chuyển khoản chậm của Stripe): chờ sự kiện async_payment_succeeded.
      const type = o.payment_status === 'paid' || o.payment_status === 'no_payment_required' ? 'payment.succeeded' : 'ignored';
      return { ...base, type, providerPaymentId: typeof o.payment_intent === 'string' ? o.payment_intent : null, amountMinor: Number(o.amount_total ?? 0), currency: cur };
    }
    if (e.type === 'checkout.session.async_payment_failed' || e.type === 'checkout.session.expired') {
      return { ...base, type: 'payment.failed', providerPaymentId: typeof o.payment_intent === 'string' ? o.payment_intent : null, amountMinor: Number(o.amount_total ?? 0), currency: cur };
    }
    if (e.type === 'charge.refunded') {
      // `amount_refunded` là tổng đã hoàn của cả giao dịch, không phải của riêng lần này.
      return { ...base, type: 'payment.refunded', providerPaymentId: typeof o.payment_intent === 'string' ? o.payment_intent : null, amountMinor: Number(o.amount_refunded ?? 0), currency: cur, cumulative: true };
    }
    return { ...base, type: 'ignored', providerPaymentId: null, amountMinor: 0, currency: cur };
  }

  async refund(input: RefundInput): Promise<{ ok: boolean; providerRefundId: string | null; manual: boolean }> {
    if (!this.hasCredentials || !input.providerPaymentId?.startsWith('pi_')) return { ok: true, providerRefundId: null, manual: true };
    const res = await this.fetchImpl('https://api.stripe.com/v1/refunds', { method: 'POST', headers: this.headers(`refund-${input.providerPaymentId}-${input.amountMinor}-${input.reference}`), body: stripeForm({ payment_intent: input.providerPaymentId, amount: input.amountMinor, 'metadata[reference]': input.reference.replace(/\s/g, '') }) });
    const data = (await res.json()) as { id?: string; status?: string };
    return { ok: res.ok && (data.status === 'succeeded' || data.status === 'pending'), providerRefundId: data.id ?? null, manual: false };
  }

  webhookResponse(ok: boolean): { status: number; body: unknown } {
    return { status: ok ? 200 : 400, body: { received: ok } };
  }
}
