// Người chi trả hoa hồng (chủ hội / super admin): xem xét, đánh dấu đã trả, từ chối; cộng sự hủy yêu cầu; link cộng sự /r/:code.
import { markPaidSchema, rejectWithdrawalSchema } from '@hoiminh/contracts';
import { affiliate, withdrawals } from '@hoiminh/core';
import { body, parse, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';

export const payerRoutes = router();

payerRoutes.post('/withdrawals/:id/review', requireAuth, async (c) => c.json(await withdrawals.reviewWithdrawal(c.get('ctx'), c.req.param('id'))));
payerRoutes.post('/withdrawals/:id/paid', requireAuth, async (c) => {
  const input = await parse(markPaidSchema, await body(c));
  const w = await withdrawals.markPaid(c.get('ctx'), c.req.param('id'), input.transferReference, input.version);
  return c.json({ ...w, payoutSnapshotEncrypted: undefined });
});
payerRoutes.post('/withdrawals/:id/reject', requireAuth, async (c) => {
  const input = await parse(rejectWithdrawalSchema, await body(c));
  const w = await withdrawals.rejectWithdrawal(c.get('ctx'), c.req.param('id'), input.reason, input.version);
  return c.json({ ...w, payoutSnapshotEncrypted: undefined });
});
payerRoutes.post('/withdrawals/:id/cancel', requireAuth, async (c) => c.json(await withdrawals.cancelWithdrawal(c.get('ctx'), c.req.param('id'))));

/** Link cộng sự: ghi click, đặt cookie attribution 30 ngày, chuyển tới đích. */
export const refRoutes = router();
refRoutes.get('/:code', async (c) => {
  const ctx = c.get('ctx');
  const cookies = c.req.header('cookie') ?? '';
  const existingVid = cookies.split(';').map((s) => s.trim()).find((s) => s.startsWith('hm_vid='))?.slice(7);
  const visitorId = existingVid || crypto.randomUUID();
  const r = await affiliate.trackClick(ctx, c.req.param('code'), { visitorId, ip: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? undefined, userAgent: c.req.header('user-agent') ?? undefined, landingUrl: c.req.url, referrer: c.req.header('referer') ?? undefined });
  const dest = r?.destinationUrl ?? ctx.env.APP_URL;
  const maxAge = (r?.cookieDays ?? 30) * 86_400;
  const secure = ctx.env.APP_ENV === 'production' ? '; Secure' : '';
  c.header('Set-Cookie', `hm_ref=${encodeURIComponent(c.req.param('code'))}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`, { append: true });
  c.header('Set-Cookie', `hm_vid=${visitorId}; Path=/; Max-Age=${365 * 86_400}; SameSite=Lax${secure}`, { append: true });
  return c.redirect(dest, 302);
});
