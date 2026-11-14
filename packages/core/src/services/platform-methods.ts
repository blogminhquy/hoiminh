// Cách thanh toán cho đơn mua gói Hội Mình (tiền về tài khoản của Hội Mình). Chỉ hiện cổng quản trị đang bật và đã có
// khóa thật; ở máy dev và test, cổng chưa có khóa vẫn dùng được qua trang mô phỏng. Quản trị chọn được cổng mặc định.
import { isLocalEnv, providersWithDefaultSecrets } from '@hoiminh/config';
import { PAYMENT_PROVIDERS, type PaymentProvider } from '@hoiminh/contracts';
import { providerAccounts } from '@hoiminh/db';
import { eq } from 'drizzle-orm';
import type { Ctx } from '../context';
import { envWithProviderAccounts } from '../lib/payment-accounts';
import { FLAG, isEnabled } from './feature-flags';

export interface PlatformMethods {
  methods: PaymentProvider[];
  defaultMethod: PaymentProvider | null;
}

/** Một cổng của Hội Mình dùng được không, và vì sao không (để quản trị biết cần làm gì). */
export type PlatformAvailability = 'ready' | 'disabled' | 'no_credentials' | 'flag_off';

/** Tình trạng từng cổng của Hội Mình: đang tắt, thiếu khóa thật, hay dùng được. */
export async function platformAvailability(ctx: Ctx, workspaceId: string | null): Promise<{ states: Record<PaymentProvider, PlatformAvailability>; chosenDefault: PaymentProvider | null }> {
  const rows = await ctx.db.query.providerAccounts.findMany({ where: eq(providerAccounts.scopeType, 'platform') });
  const env = await envWithProviderAccounts(ctx);
  const local = isLocalEnv(env.APP_ENV);
  // Ngoài máy dev, cổng còn dùng bí mật mặc định bị khóa hẳn (packages/payments): không được hiện cho người mua.
  const locked = new Set<PaymentProvider>(local ? [] : providersWithDefaultSecrets(env));
  const paypalFlag = await isEnabled(ctx, FLAG.paypal, { workspaceId });
  const states = {} as Record<PaymentProvider, PlatformAvailability>;
  for (const p of PAYMENT_PROVIDERS) {
    const row = rows.find((r) => r.provider === p);
    let state: PlatformAvailability = 'ready';
    if (row && !row.enabled) state = 'disabled';
    else if (p === 'paypal' && !local && !(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET)) state = 'no_credentials';
    else if (p === 'stripe' && !(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET)) state = 'no_credentials';
    else if (locked.has(p)) state = 'no_credentials';
    else if (p === 'paypal' && !paypalFlag) state = 'flag_off';
    states[p] = state;
  }
  const chosen = rows.find((r) => (r.configuration as { isDefault?: unknown }).isDefault === true)?.provider as PaymentProvider | undefined;
  return { states, chosenDefault: chosen ?? null };
}

/** Các cổng người mua gói Hội Mình thấy, và cổng chọn sẵn. */
export async function platformPaymentMethods(ctx: Ctx, workspaceId: string | null): Promise<PlatformMethods> {
  const { states, chosenDefault } = await platformAvailability(ctx, workspaceId);
  const methods = PAYMENT_PROVIDERS.filter((p) => states[p] === 'ready');
  return { methods, defaultMethod: chosenDefault && methods.includes(chosenDefault) ? chosenDefault : methods[0] ?? null };
}
