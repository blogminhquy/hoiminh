// Cổng thanh toán theo cấu hình của super admin: credential nhập ở /he-thong/thanh-toan (lưu mã hóa trong
// provider_accounts) được ưu tiên hơn biến môi trường. Cổng nào chưa nhập credential thì giữ nguyên biến môi trường.
import { decryptJson, type Env } from '@hoiminh/config';
import type { PaymentProvider } from '@hoiminh/contracts';
import { providerAccounts } from '@hoiminh/db';
import { createPaymentRouter, type PaymentRouter } from '@hoiminh/payments';
import { eq } from 'drizzle-orm';
import type { Ctx } from '../context';

/** Tên ô trong form quản trị → biến môi trường tương ứng. */
const FIELDS: Record<PaymentProvider, Record<string, keyof Env>> = {
  sepay: { apiKey: 'SEPAY_API_KEY', bankCode: 'SEPAY_BANK_CODE', bankAccount: 'SEPAY_BANK_ACCOUNT', accountHolder: 'SEPAY_ACCOUNT_HOLDER' },
  momo: { partnerCode: 'MOMO_PARTNER_CODE', accessKey: 'MOMO_ACCESS_KEY', secretKey: 'MOMO_SECRET_KEY' },
  vnpay: { tmnCode: 'VNPAY_TMN_CODE', hashSecret: 'VNPAY_HASH_SECRET' },
  paypal: { clientId: 'PAYPAL_CLIENT_ID', clientSecret: 'PAYPAL_CLIENT_SECRET', webhookId: 'PAYPAL_WEBHOOK_ID' },
};
const MODE: Record<PaymentProvider, keyof Env> = { sepay: 'SEPAY_MODE', momo: 'MOMO_MODE', vnpay: 'VNPAY_MODE', paypal: 'PAYPAL_MODE' };

/** Gộp credential đã lưu vào biến môi trường. Chỉ cổng có credential mới lấy luôn chế độ sandbox/production đã chọn. */
export async function envWithProviderAccounts(ctx: Ctx): Promise<Env> {
  const rows = await ctx.db.query.providerAccounts.findMany({ where: eq(providerAccounts.scopeType, 'platform') });
  const merged: Record<string, unknown> = { ...ctx.env };
  let changed = false;
  for (const row of rows) {
    if (!row.credentialsEncrypted) continue;
    const provider = row.provider as PaymentProvider;
    const fields = FIELDS[provider];
    if (!fields) continue;
    let creds: Record<string, string>;
    try {
      creds = await decryptJson<Record<string, string>>(row.credentialsEncrypted, ctx.env.ENCRYPTION_KEY);
    } catch (err) {
      ctx.log.error('payments.credentials_unreadable', { provider, err: String(err) });
      continue;
    }
    for (const [field, key] of Object.entries(fields)) {
      const v = creds[field]?.trim();
      if (v) merged[key] = v;
    }
    merged[MODE[provider]] = row.mode;
    changed = true;
  }
  return changed ? (merged as Env) : ctx.env;
}

/** Router cổng thanh toán cho request hiện tại. Không có credential nào trong database thì dùng router dựng sẵn. */
export async function paymentsFor(ctx: Ctx): Promise<PaymentRouter> {
  const env = await envWithProviderAccounts(ctx);
  return env === ctx.env ? ctx.payments : createPaymentRouter(env, `${env.API_URL}/pay/simulator`);
}
