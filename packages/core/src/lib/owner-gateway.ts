// Dựng adapter cho cổng thanh toán riêng của chủ hội (MoMo, VNPAY, PayPal, Stripe) từ khóa chủ hội đã lưu. Tách riêng
// thành tệp nhỏ để dịch vụ thanh toán (hoàn tiền) và dịch vụ cổng của chủ hội cùng dùng mà không nhập vòng lẫn nhau.
import { decryptJson } from '@hoiminh/config';
import type { OwnerGateway } from '@hoiminh/contracts';
import type { communityPaymentGateways } from '@hoiminh/db';
import { MomoAdapter, PaypalAdapter, StripeAdapter, STRIPE_SIMULATOR_KEY_PREFIX, VnpayAdapter, type PaymentAdapter } from '@hoiminh/payments';
import type { Ctx } from '../context';

export type GatewayRow = typeof communityPaymentGateways.$inferSelect;

/** Địa chỉ cổng của chủ hội gọi về khi có giao dịch. Mã trong địa chỉ xác định đúng hội và đúng cổng. */
export const gatewayWebhookUrl = (ctx: Ctx, token: string) => `${ctx.env.API_URL}/webhooks/hoi/${token}`;
/** Trang mô phỏng của cổng chủ hội (chỉ máy dev và test, với bộ khóa thử bên dưới). */
export const gatewaySimulatorUrl = (ctx: Ctx, token: string) => `${ctx.env.API_URL}/pay/simulator/hoi/${token}`;

/**
 * Bộ khóa thử của Hội Mình: ô nào bắt đầu bằng tiền tố này thì adapter đi qua trang mô phỏng thay vì gọi cổng thật.
 * Chỉ dùng được ở máy dev và khi chạy test; ở nơi khác máy chủ từ chối lưu các khóa này.
 */
export const SIMULATOR_KEYS: Record<OwnerGateway, { field: string; prefix: string }> = {
  momo: { field: 'accessKey', prefix: 'momo-sandbox' },
  vnpay: { field: 'hashSecret', prefix: 'vnpay-sandbox' },
  paypal: { field: 'clientId', prefix: 'paypal-sandbox' },
  stripe: { field: 'secretKey', prefix: STRIPE_SIMULATOR_KEY_PREFIX },
};

export const isSimulatorCredentials = (provider: OwnerGateway, creds: Record<string, string>) => (creds[SIMULATOR_KEYS[provider].field] ?? '').startsWith(SIMULATOR_KEYS[provider].prefix);

/** Khóa đã lưu của một cổng (giải mã). */
export async function gatewayCredentials(ctx: Ctx, g: GatewayRow): Promise<Record<string, string>> {
  return decryptJson<Record<string, string>>(g.credentialsEncrypted, ctx.env.ENCRYPTION_KEY);
}

/** Adapter của cổng chủ hội, dùng khóa của chính chủ hội. */
export async function ownerGatewayAdapter(ctx: Ctx, g: GatewayRow): Promise<PaymentAdapter> {
  const c = await gatewayCredentials(ctx, g);
  const simulatorUrl = gatewaySimulatorUrl(ctx, g.webhookToken);
  const appEnv = ctx.env.APP_ENV;
  const live = g.mode === 'production';
  switch (g.provider) {
    case 'momo':
      return new MomoAdapter({ mode: g.mode, partnerCode: c.partnerCode ?? '', accessKey: c.accessKey ?? '', secretKey: c.secretKey ?? '', endpoint: live ? 'https://payment.momo.vn' : 'https://test-payment.momo.vn', simulatorUrl, appEnv });
    case 'vnpay':
      return new VnpayAdapter({ mode: g.mode, tmnCode: c.tmnCode ?? '', hashSecret: c.hashSecret ?? '', endpoint: live ? 'https://pay.vnpay.vn/vpcpay.html' : 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html', simulatorUrl, appEnv });
    case 'paypal':
      return new PaypalAdapter({ mode: g.mode, clientId: c.clientId ?? '', clientSecret: c.clientSecret ?? '', webhookId: c.webhookId ?? '', usdRate: ctx.env.PAYPAL_USD_RATE, simulatorUrl, appEnv });
    case 'stripe':
      return new StripeAdapter({ mode: g.mode, secretKey: c.secretKey ?? '', webhookSecret: c.webhookSecret ?? '', simulatorUrl, appEnv });
  }
}
