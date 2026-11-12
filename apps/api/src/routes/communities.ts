// /v1/communities: tạo, trang giới thiệu, khung hội, tham gia, cài đặt (chung, giá, tiện ích, bảng tin, câu hỏi, affiliate, thanh toán), tổng quan, doanh thu.
import { affiliateSettingsSchema, createCommunitySchema, feedSettingsSchema, joinCommunitySchema, joinQuestionSchema, leaderboardQuerySchema, payoutAccountInputSchema, updateAboutMediaSchema, updateCommunityGeneralSchema, updatePluginSchema, updatePricingSchema } from '@hoiminh/contracts';
import { affiliate, communities, members, ownerPayout, revenue, shell, withdrawals } from '@hoiminh/core';
import { files } from '@hoiminh/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { body, csv, parse, query, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

export const communityRoutes = router();

communityRoutes.get('/discover', async (c) => {
  const q = query(c);
  return c.json(await communities.discover(c.get('ctx'), { category: q.category, search: q.q, limit: q.limit ? Number(q.limit) : undefined }));
});
communityRoutes.post('/', requireAuth, async (c) => c.json(await communities.createCommunity(c.get('ctx'), await parse(createCommunitySchema, await body(c))), 201));
communityRoutes.get('/by-slug/:slug', async (c) => c.json(await communities.aboutPage(c.get('ctx'), c.req.param('slug'), query(c).ref ?? null)));
communityRoutes.get('/by-slug/:slug/shell', async (c) => c.json(await shell.communityShell(c.get('ctx'), c.req.param('slug'))));
communityRoutes.post('/by-slug/:slug/join', requireAuth, async (c) => {
  const input = await parse(joinCommunitySchema, await body(c));
  return c.json(await members.joinCommunity(c.get('ctx'), c.req.param('slug'), input));
});
communityRoutes.post('/slug-available', async (c) => {
  const { slug } = await parse(z.object({ slug: z.string() }), await body(c));
  try {
    await communities.assertSlugAvailable(c.get('ctx'), slug);
    return c.json({ available: true });
  } catch (err) {
    return c.json({ available: false, reason: (err as Error).message });
  }
});

// Cài đặt (chủ hội)
communityRoutes.patch('/:id/general', requireAuth, async (c) => {
  const input = await parse(updateCommunityGeneralSchema, await body(c));
  const ctx = c.get('ctx');
  const logoUrl = input.logoFileId === undefined ? undefined : input.logoFileId ? ((await ctx.db.query.files.findFirst({ where: eq(files.id, input.logoFileId) }))?.url ?? null) : null;
  const coverUrl = input.coverFileId === undefined ? undefined : input.coverFileId ? ((await ctx.db.query.files.findFirst({ where: eq(files.id, input.coverFileId) }))?.url ?? null) : null;
  return c.json(await communities.updateGeneral(ctx, c.req.param('id'), { ...input, logoUrl, coverUrl }));
});
communityRoutes.put('/:id/about-media', requireAuth, async (c) => c.json({ items: await communities.updateAboutMedia(c.get('ctx'), c.req.param('id'), await parse(updateAboutMediaSchema, await body(c))) }));
communityRoutes.get('/:id/pricing', requireAuth, async (c) => c.json(await communities.pricingSettings(c.get('ctx'), c.req.param('id'))));
communityRoutes.put('/:id/pricing', requireAuth, async (c) => c.json(await communities.updatePricing(c.get('ctx'), c.req.param('id'), await parse(updatePricingSchema, await body(c)))));
communityRoutes.get('/:id/plugins', requireAuth, async (c) => c.json(await communities.listPlugins(c.get('ctx'), c.req.param('id'))));
communityRoutes.put('/:id/plugins/:key', requireAuth, async (c) => c.json(await communities.updatePlugin(c.get('ctx'), c.req.param('id'), c.req.param('key'), await parse(updatePluginSchema, await body(c)))));
communityRoutes.get('/:id/feed-settings', requireAuth, async (c) => c.json(await communities.feedSettings(c.get('ctx'), c.req.param('id'))));
communityRoutes.put('/:id/feed-settings', requireAuth, async (c) => c.json(await communities.updateFeedSettings(c.get('ctx'), c.req.param('id'), await parse(feedSettingsSchema, await body(c)))));
communityRoutes.put('/:id/join-questions', requireAuth, async (c) => {
  const { questions } = await parse(z.object({ questions: z.array(joinQuestionSchema).max(3) }), await body(c));
  return c.json(await communities.setJoinQuestions(c.get('ctx'), c.req.param('id'), questions));
});
communityRoutes.post('/:id/archive', requireAuth, async (c) => {
  await communities.archiveCommunity(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
communityRoutes.get('/:id/overview', requireAuth, async (c) => c.json(await revenue.settingsOverview(c.get('ctx'), c.req.param('id'), { days: query(c).days ? Number(query(c).days) : undefined })));
communityRoutes.get('/:id/revenue', requireAuth, async (c) => c.json(await revenue.revenue(c.get('ctx'), c.req.param('id'), { days: query(c).days ? Number(query(c).days) : undefined })));
/** Nhận tiền của chủ hội: tài khoản ngân hàng, cách xác nhận đơn, đơn chờ xác nhận. */
communityRoutes.get('/:id/payout-account', requireAuth, async (c) => c.json(await ownerPayout.payoutSetup(c.get('ctx'), c.req.param('id'))));
communityRoutes.put('/:id/payout-account', requireAuth, async (c) => c.json(await ownerPayout.savePayoutAccount(c.get('ctx'), c.req.param('id'), await parse(payoutAccountInputSchema, await body(c)))));
communityRoutes.post('/:id/payout-account/rotate-webhook', requireAuth, async (c) => c.json(await ownerPayout.rotatePayoutWebhook(c.get('ctx'), c.req.param('id'))));
communityRoutes.post('/:id/orders/:orderId/confirm-received', requireAuth, rateLimit('write', { scope: 'confirm-received' }), async (c) => c.json(await ownerPayout.confirmOwnerOrder(c.get('ctx'), c.req.param('id'), c.req.param('orderId'))));
communityRoutes.get('/:id/payout', requireAuth, async (c) => c.json(await revenue.payoutSettings(c.get('ctx'), c.req.param('id'))));
communityRoutes.put('/:id/providers', requireAuth, async (c) => {
  const { enabledProviders } = await parse(z.object({ enabledProviders: z.array(z.enum(['sepay', 'momo', 'vnpay', 'paypal'])) }), await body(c));
  return c.json(await revenue.updateEnabledProviders(c.get('ctx'), c.req.param('id'), enabledProviders));
});

// Affiliate: cấu hình, xếp hạng, hàng đợi rút
communityRoutes.get('/:id/affiliate', requireAuth, async (c) => c.json(await affiliate.programSettings(c.get('ctx'), c.req.param('id'))));
communityRoutes.put('/:id/affiliate', requireAuth, async (c) => c.json(await affiliate.updateProgram(c.get('ctx'), c.req.param('id'), await parse(affiliateSettingsSchema, await body(c)))));
communityRoutes.get('/:id/leaderboard', async (c) => {
  const { period } = await parse(leaderboardQuerySchema, query(c));
  return c.json(await affiliate.leaderboard(c.get('ctx'), c.req.param('id'), period));
});
communityRoutes.get('/:id/affiliate/payouts', requireAuth, async (c) => {
  const ctx = c.get('ctx');
  const s = await affiliate.programSettings(ctx, c.req.param('id'));
  return c.json({ program: s.program, stats: s.stats, ...(await withdrawals.payoutQueue(ctx, s.program.id)) });
});
communityRoutes.get('/:id/affiliate/payouts/export.csv', requireAuth, async (c) => {
  const ctx = c.get('ctx');
  const s = await affiliate.programSettings(ctx, c.req.param('id'));
  return csv(c, await withdrawals.exportPayoutsCsv(ctx, s.program.id), 'doi-soat-cong-su.csv');
});
