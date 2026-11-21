// Người chi trả hoa hồng (chủ hội / super admin): xem xét, đánh dấu đã trả, từ chối; affiliate hủy yêu cầu; link affiliate /r/:code; đếm lượt mở link ?ref=.
import { REF_PLATFORM_SCOPE, markPaidSchema, rejectWithdrawalSchema, joinRefs, scopeRefs } from '@hoiminh/contracts';
import { affiliate, withdrawals } from '@hoiminh/core';
import { body, parse, router } from '../lib/hono';
import { z } from 'zod';
import { readCookie } from '../lib/session-cookie';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

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

/**
 * Web báo một lượt mở link dạng `?ref=<mã>` (trang hội, trang sản phẩm, trang mở hội). Chỉ đếm lượt bấm, không ghi
 * người giới thiệu. Người xem chưa có mã khách `hm_vid` thì được cấp ở đây, để tải lại trang không bị đếm thêm.
 */
payerRoutes.post('/ref-clicks', rateLimit('write', { scope: 'ref-clicks' }), async (c) => {
  const ctx = c.get('ctx');
  const input = await parse(z.object({ code: z.string().trim().min(2).max(100), url: z.string().max(2000).optional(), referrer: z.string().max(2000).optional() }), await body(c));
  const known = readCookie(c, 'hm_vid');
  const visitorId = known && /^[a-zA-Z0-9-]{8,64}$/.test(known) ? known : crypto.randomUUID();
  const counted = await affiliate.recordLandingClick(ctx, input.code, { visitorId, ip: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? undefined, userAgent: c.req.header('user-agent') ?? undefined, landingUrl: input.url, referrer: input.referrer });
  if (visitorId !== known) c.header('Set-Cookie', `hm_vid=${visitorId}; Path=/; Max-Age=${365 * 86_400}; SameSite=Lax${ctx.env.APP_ENV === 'production' ? '; Secure' : ''}`, { append: true });
  return c.json({ counted });
});

/** Link affiliate: ghi click, đặt cookie attribution 30 ngày, chuyển tới đích. */
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
  // Cookie nhớ nhiều mã (mỗi hội, nền tảng một mã): mã vừa bấm lên đầu, các mã cũ giữ lại phía sau.
  const remembered = cookies.split(';').map((s) => s.trim()).find((s) => s.startsWith('hm_ref='))?.slice(7);
  let before = '';
  try { before = decodeURIComponent(remembered ?? ''); } catch { /* cookie hỏng: coi như chưa nhớ mã nào */ }
  // Link `/r/<mã>` không nằm ở trang của hội nào: mã chung bấm qua đây tính cho nền tảng (mã riêng thì phạm vi không có ý nghĩa).
  const refs = joinRefs(scopeRefs(c.req.param('code'), REF_PLATFORM_SCOPE), before) ?? c.req.param('code');
  c.header('Set-Cookie', `hm_ref=${encodeURIComponent(refs)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`, { append: true });
  c.header('Set-Cookie', `hm_vid=${visitorId}; Path=/; Max-Age=${365 * 86_400}; SameSite=Lax${secure}`, { append: true });
  return c.redirect(dest, 302);
});
