// SePay: chuyển khoản QR (VietQR) và webhook báo có. Xác thực bằng header Authorization: Apikey <key>.
import { timingSafeEqual } from '@hoiminh/config';
import { extractReference, type CheckoutInput, type CheckoutResult, type IncomingWebhook, type NormalizedEvent, type PaymentAdapter } from './types';

export interface SepayConfig {
  mode: 'sandbox' | 'production';
  apiKey: string;
  bankCode: string;
  bankAccount: string;
  accountHolder: string;
  qrTemplate: string;
}

const BANK_NAMES: Record<string, string> = { VCB: 'Vietcombank', TCB: 'Techcombank', MB: 'MB Bank', ACB: 'ACB', VTB: 'Vietinbank', BIDV: 'BIDV', TPB: 'TPBank', VPB: 'VPBank', STB: 'Sacombank', AGR: 'Agribank' };

/** Payload webhook SePay (theo tài liệu sepay.vn/webhooks). */
export interface SepayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  code: string | null;
  content: string;
  transferType: 'in' | 'out';
  transferAmount: number;
  accumulated: number;
  subAccount: string | null;
  referenceCode: string;
  description: string;
}

export class SepayAdapter implements PaymentAdapter {
  readonly provider = 'sepay' as const;
  readonly mode: 'sandbox' | 'production';
  constructor(private readonly cfg: SepayConfig) {
    this.mode = cfg.mode;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const des = input.reference;
    const qr = new URL('https://qr.sepay.vn/img');
    qr.searchParams.set('acc', this.cfg.bankAccount);
    qr.searchParams.set('bank', this.cfg.bankCode);
    qr.searchParams.set('amount', String(input.amountMinor));
    qr.searchParams.set('des', des);
    qr.searchParams.set('template', this.cfg.qrTemplate);
    return {
      provider: 'sepay',
      providerPaymentId: null,
      instruction: {
        kind: 'bank_qr',
        qrImageUrl: qr.toString(),
        bankName: BANK_NAMES[this.cfg.bankCode] ?? this.cfg.bankCode,
        bankCode: this.cfg.bankCode,
        accountNumber: this.cfg.bankAccount,
        accountHolder: this.cfg.accountHolder,
        amountMinor: input.amountMinor,
        transferContent: des,
      },
      raw: { qr: qr.toString() },
    };
  }

  async verifyWebhook(req: IncomingWebhook): Promise<boolean> {
    const auth = req.headers['authorization'] ?? req.headers['Authorization'] ?? '';
    const m = auth.match(/^Apikey\s+(.+)$/i);
    if (!m?.[1]) return false;
    return timingSafeEqual(m[1].trim(), this.cfg.apiKey);
  }

  parseWebhook(req: IncomingWebhook): NormalizedEvent | null {
    let p: SepayWebhookPayload;
    try {
      p = JSON.parse(req.rawBody) as SepayWebhookPayload;
    } catch {
      return null;
    }
    if (typeof p.id !== 'number' || typeof p.transferAmount !== 'number') return null;
    const reference = extractReference(`${p.code ?? ''} ${p.content ?? ''} ${p.description ?? ''}`);
    return {
      providerEventId: `sepay-${p.id}`,
      type: p.transferType === 'in' ? 'payment.succeeded' : 'ignored',
      reference,
      providerPaymentId: p.referenceCode ?? String(p.id),
      amountMinor: Math.round(p.transferAmount),
      currency: 'VND',
      transactionAt: p.transactionDate ? new Date(p.transactionDate.replace(' ', 'T') + '+07:00') : new Date(),
      bankContent: p.content ?? '',
      bankAccount: p.accountNumber,
      raw: p as unknown as Record<string, unknown>,
    };
  }

  async refund(): Promise<{ ok: boolean; providerRefundId: string | null; manual: boolean }> {
    // Chuyển khoản ngân hàng không hoàn tự động: chủ hội/admin chuyển lại thủ công, hệ thống ghi nhận.
    return { ok: true, providerRefundId: null, manual: true };
  }

  webhookResponse(ok: boolean): { status: number; body: unknown } {
    return { status: ok ? 200 : 401, body: { success: ok } };
  }
}
