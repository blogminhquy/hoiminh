// /v1/admin: quản trị hệ thống (super admin).
import { adminCommunityActionSchema, adminMatchReconciliationSchema, adminProviderUpdateSchema, adminUserActionSchema } from '@hoiminh/contracts';
import { admin, affiliate, featureFlags, platformBilling, requireSuperAdmin, withdrawals } from '@hoiminh/core';
import { affiliatePrograms } from '@hoiminh/db';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { body, csv, parse, query, router, type Ctx$ } from '../lib/hono';
import { requireAuth } from '../middleware/auth';

export const adminRoutes = router();
adminRoutes.use('*', requireAuth, async (c, next) => {
  requireSuperAdmin(c.get('ctx'));
  await next();
});

adminRoutes.get('/overview', async (c) => c.json(await admin.overview(c.get('ctx'), query(c).days ? Number(query(c).days) : 30)));
adminRoutes.get('/communities', async (c) => c.json(await admin.listCommunities(c.get('ctx'), { status: query(c).status as 'active', q: query(c).q, limit: query(c).limit ? Number(query(c).limit) : undefined })));
adminRoutes.post('/communities/:id/action', async (c) => {
  const input = await parse(adminCommunityActionSchema, await body(c));
  await admin.communityAction(c.get('ctx'), c.req.param('id'), input.action, input.reason);
  return c.json({ ok: true });
});
adminRoutes.get('/users', async (c) => c.json(await admin.listUsers(c.get('ctx'), { q: query(c).q, status: query(c).status as 'active', limit: query(c).limit ? Number(query(c).limit) : undefined })));
adminRoutes.post('/users/:id/action', async (c) => {
  const input = await parse(adminUserActionSchema, await body(c));
  await admin.userAction(c.get('ctx'), c.req.param('id'), input.action, input.reason);
  return c.json({ ok: true });
});
adminRoutes.get('/providers', async (c) => c.json(await admin.listProviders(c.get('ctx'))));
adminRoutes.patch('/providers/:provider', async (c) => c.json(await admin.updateProvider(c.get('ctx'), c.req.param('provider') as 'sepay', await parse(adminProviderUpdateSchema, await body(c)))));
adminRoutes.get('/reconciliation', async (c) => c.json(await admin.reconciliation(c.get('ctx'), { status: query(c).status as 'matched', limit: query(c).limit ? Number(query(c).limit) : undefined })));
adminRoutes.post('/reconciliation/:id/match', async (c) => {
  const { paymentReference } = await parse(adminMatchReconciliationSchema, await body(c));
  return c.json(await admin.matchReconciliation(c.get('ctx'), c.req.param('id'), paymentReference));
});
adminRoutes.get('/payments', async (c) => c.json(await admin.listPayments(c.get('ctx'), { status: query(c).status, provider: query(c).provider, limit: query(c).limit ? Number(query(c).limit) : undefined })));
adminRoutes.get('/logs', async (c) => c.json(await admin.logs(c.get('ctx'), { kind: query(c).kind as 'audit', limit: query(c).limit ? Number(query(c).limit) : undefined })));
adminRoutes.get('/plans', async (c) => c.json(await platformBilling.planStats(c.get('ctx'))));
adminRoutes.patch('/plans/:key', async (c) => c.json(await platformBilling.updatePlan(c.get('ctx'), c.req.param('key'), await parse(z.object({ name: z.string().optional(), monthlyMinor: z.number().int().optional(), yearlyMinor: z.number().int().optional(), trialDays: z.number().int().optional(), description: z.string().optional() }), await body(c)))));
adminRoutes.get('/flags', async (c) => c.json(await featureFlags.listFlags(c.get('ctx'))));
adminRoutes.put('/flags/:key', async (c) => c.json(await featureFlags.setFlag(c.get('ctx'), c.req.param('key'), await parse(z.object({ enabled: z.boolean().optional(), description: z.string().optional(), rules: z.object({ workspaceIds: z.array(z.string()).optional(), planKeys: z.array(z.string()).optional(), percent: z.number().optional() }).optional() }), await body(c)))));

// Cộng sự nền tảng
async function platformProgram(c: Ctx$) {
  const p = await c.get('ctx').db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.scopeType, 'platform') });
  if (!p) throw new Error('Chưa có chương trình cộng sự nền tảng');
  return p;
}
adminRoutes.get('/affiliate', async (c) => {
  const ctx = c.get('ctx');
  const program = await platformProgram(c);
  const stats = await affiliate.programStats(ctx, program.id);
  const partners = (await ctx.db.execute(sql`select a.id, a.affiliate_code, a.commission_rate_bps, a.signup_count, a.paid_count, u.name, u.handle, u.avatar_url, u.cover_color from affiliate_accounts a join users u on u.id = a.user_id where a.program_id = ${program.id} order by a.paid_count desc limit 10`)) as unknown;
  return c.json({ program, stats, partners: Array.isArray(partners) ? partners : ((partners as { rows?: unknown[] }).rows ?? []), ...(await withdrawals.payoutQueue(ctx, program.id)) });
});
adminRoutes.patch('/affiliate', async (c) => {
  const ctx = c.get('ctx');
  const program = await platformProgram(c);
  const input = await parse(z.object({ commissionRateBps: z.number().int().min(0).max(10000).optional(), commissionDurationMonths: z.number().int().nullable().optional(), holdDays: z.number().int().min(0).max(120).optional(), minWithdrawalMinor: z.number().int().optional() }), await body(c));
  const [row] = await ctx.db.update(affiliatePrograms).set({ ...input, updatedAt: new Date() }).where(eq(affiliatePrograms.id, program.id)).returning();
  return c.json(row);
});
adminRoutes.patch('/affiliate/accounts/:id', async (c) => {
  const ctx = c.get('ctx');
  const { commissionRateBps } = await parse(z.object({ commissionRateBps: z.number().int().min(0).max(10000).nullable() }), await body(c));
  const { affiliateAccounts } = await import('@hoiminh/db');
  const [row] = await ctx.db.update(affiliateAccounts).set({ commissionRateBps, updatedAt: new Date() }).where(eq(affiliateAccounts.id, c.req.param('id'))).returning();
  return c.json(row);
});
adminRoutes.get('/affiliate/export.csv', async (c) => csv(c, await withdrawals.exportPayoutsCsv(c.get('ctx'), (await platformProgram(c)).id), 'cong-su-nen-tang.csv'));
