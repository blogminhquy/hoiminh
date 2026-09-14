// Payment Integration Layer: router chọn adapter theo provider, tất cả đi qua cùng interface.
import type { Env } from '@hoiminh/config';
import type { PaymentProvider } from '@hoiminh/contracts';
import { MomoAdapter } from './momo';
import { PaypalAdapter } from './paypal';
import { SepayAdapter } from './sepay';
import type { PaymentAdapter } from './types';
import { VnpayAdapter } from './vnpay';

export * from './types';
export { SepayAdapter } from './sepay';
export { MomoAdapter } from './momo';
export { VnpayAdapter, vnpQueryString } from './vnpay';
export { PaypalAdapter } from './paypal';

export type PaymentRouter = {
  get(provider: PaymentProvider): PaymentAdapter;
  all(): PaymentAdapter[];
};

/** Tạo router adapter từ biến môi trường. `simulatorUrl` là trang mô phỏng của API cho sandbox không credential. */
export function createPaymentRouter(env: Env, simulatorUrl: string): PaymentRouter {
  const adapters: Record<PaymentProvider, PaymentAdapter> = {
    sepay: new SepayAdapter({ mode: env.SEPAY_MODE, apiKey: env.SEPAY_API_KEY, bankCode: env.SEPAY_BANK_CODE, bankAccount: env.SEPAY_BANK_ACCOUNT, accountHolder: env.SEPAY_ACCOUNT_HOLDER, qrTemplate: env.SEPAY_QR_TEMPLATE }),
    momo: new MomoAdapter({ mode: env.MOMO_MODE, partnerCode: env.MOMO_PARTNER_CODE, accessKey: env.MOMO_ACCESS_KEY, secretKey: env.MOMO_SECRET_KEY, endpoint: env.MOMO_ENDPOINT, simulatorUrl, appEnv: env.APP_ENV }),
    vnpay: new VnpayAdapter({ mode: env.VNPAY_MODE, tmnCode: env.VNPAY_TMN_CODE, hashSecret: env.VNPAY_HASH_SECRET, endpoint: env.VNPAY_ENDPOINT, simulatorUrl, appEnv: env.APP_ENV }),
    paypal: new PaypalAdapter({ mode: env.PAYPAL_MODE, clientId: env.PAYPAL_CLIENT_ID, clientSecret: env.PAYPAL_CLIENT_SECRET, webhookId: env.PAYPAL_WEBHOOK_ID, usdRate: env.PAYPAL_USD_RATE, simulatorUrl, appEnv: env.APP_ENV }),
  };
  return { get: (p) => adapters[p], all: () => Object.values(adapters) };
}
