// Giao diện chung cho mọi cổng thanh toán (Payment Integration Layer, mục 34A).
import type { PaymentInstruction, PaymentProvider } from '@hoiminh/contracts';

export interface CheckoutInput {
  /** Mã tham chiếu duy nhất của đơn, cũng là nội dung chuyển khoản: "HM XXXXX". */
  reference: string;
  orderId: string;
  amountMinor: number;
  currency: 'VND' | 'USD';
  description: string;
  customerEmail: string;
  returnUrl: string;
  ipnUrl: string;
}

export interface CheckoutResult {
  provider: PaymentProvider;
  providerPaymentId: string | null;
  instruction: PaymentInstruction;
  raw: Record<string, unknown>;
}

export interface IncomingWebhook {
  headers: Record<string, string>;
  rawBody: string;
  query: Record<string, string>;
}

export type NormalizedEventType = 'payment.succeeded' | 'payment.failed' | 'payment.refunded' | 'ignored';

export interface NormalizedEvent {
  providerEventId: string;
  type: NormalizedEventType;
  /** Mã tham chiếu "HM XXXXX" tách được (chuẩn hóa không dấu cách). */
  reference: string | null;
  providerPaymentId: string | null;
  amountMinor: number;
  currency: 'VND' | 'USD';
  transactionAt: Date;
  /** Nội dung gốc từ ngân hàng (SePay) để đối soát. */
  bankContent?: string;
  bankAccount?: string;
  raw: Record<string, unknown>;
}

export interface RefundInput {
  providerPaymentId: string | null;
  reference: string;
  amountMinor: number;
  reason: string;
}

export interface PaymentAdapter {
  readonly provider: PaymentProvider;
  readonly mode: 'sandbox' | 'production';
  /** Tạo phiên thanh toán: QR hoặc URL chuyển hướng. */
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Kiểm tra chữ ký webhook. Không bao giờ tin dữ liệu từ return URL. */
  verifyWebhook(req: IncomingWebhook): Promise<boolean>;
  /** Chuẩn hóa payload webhook thành sự kiện nội bộ. */
  parseWebhook(req: IncomingWebhook): NormalizedEvent | null;
  /** Yêu cầu hoàn tiền (một số cổng chỉ hỗ trợ thủ công). */
  refund(input: RefundInput): Promise<{ ok: boolean; providerRefundId: string | null; manual: boolean }>;
  /** Phản hồi HTTP mà cổng mong đợi sau khi nhận webhook. */
  webhookResponse(ok: boolean): { status: number; body: unknown };
}

/** Chuẩn hóa mã tham chiếu: "hm 8k2qx" → "HM8K2QX". */
export function normalizeReference(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Tách mã "HM XXXXX" từ nội dung chuyển khoản tự do. */
export function extractReference(content: string): string | null {
  const m = content.toUpperCase().match(/HM\s?([A-Z0-9]{5,8})/);
  return m?.[1] ? `HM${m[1]}` : null;
}
