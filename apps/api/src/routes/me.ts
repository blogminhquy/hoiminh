// /v1/me: tài khoản, hồ sơ, badge, gói và thanh toán, hội của tôi, cộng sự (ví, rút tiền), thông báo, tin nhắn.
import { changePasswordSchema, notificationPrefsSchema, payoutProfileInputSchema, requestWithdrawalSchema, sendMessageSchema, updateProfileSchema, workspaceTeamInviteSchema } from '@hoiminh/contracts';
import { affiliate, auth, messaging, notifications, paymentsService, shell, subscriptions, users, withdrawals, workspaces, requireUser } from '@hoiminh/core';
import { files } from '@hoiminh/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { body, parse, query, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/common';

export const meRoutes = router();
meRoutes.use('*', requireAuth);

meRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const u = await users.me(ctx);
  return c.json({ user: auth.toAuthUser(u), profile: u, communities: await shell.myCommunities(ctx) });
});
meRoutes.patch('/', async (c) => {
  const input = await parse(updateProfileSchema, await body(c));
  const ctx = c.get('ctx');
  let avatarUrl: string | null | undefined;
  if (input.avatarFileId !== undefined) {
    avatarUrl = input.avatarFileId ? ((await ctx.db.query.files.findFirst({ where: eq(files.id, input.avatarFileId) }))?.url ?? null) : null;
  }
  return c.json(await users.updateProfile(ctx, { ...input, avatarUrl }));
});
meRoutes.post('/password', rateLimit({ windowMs: 60_000, max: 10 }), async (c) => {
  const input = await parse(changePasswordSchema, await body(c));
  await auth.changePassword(c.get('ctx'), c.get('app').auth, input, c.get('sessionId'));
  return c.json({ ok: true });
});

meRoutes.get('/badges', async (c) => c.json(await notifications.badges(c.get('ctx'))));
meRoutes.get('/communities', async (c) => c.json(await shell.myCommunities(c.get('ctx'))));
meRoutes.get('/workspace', async (c) => c.json(await workspaces.myWorkspaceHome(c.get('ctx'))));
meRoutes.post('/workspace', async (c) => c.json(await workspaces.ensureWorkspace(c.get('ctx')), 201));
meRoutes.post('/workspace/team', async (c) => {
  const input = await parse(workspaceTeamInviteSchema.extend({ workspaceId: z.string().uuid() }), await body(c));
  return c.json(await workspaces.inviteTeamMember(c.get('ctx'), input.workspaceId, input.email, input.role));
});

meRoutes.get('/billing', async (c) => c.json(await subscriptions.myBilling(c.get('ctx'))));
meRoutes.post('/subscriptions/:id/cancel', async (c) => {
  await subscriptions.cancelSubscription(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
meRoutes.post('/subscriptions/:id/resume', async (c) => {
  await subscriptions.resumeSubscription(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
meRoutes.post('/orders/:id/refund', async (c) => {
  const { reason } = await parse(z.object({ reason: z.string().max(500).default('') }), await body(c));
  return c.json(await paymentsService.requestRefund(c.get('ctx'), c.req.param('id'), reason));
});

// Cộng sự của tôi
meRoutes.get('/affiliate/programs', async (c) => c.json(await affiliate.myPrograms(c.get('ctx'))));
meRoutes.get('/affiliate/:programId', async (c) => {
  const ctx = c.get('ctx');
  const wallet = await affiliate.myWallet(ctx, c.req.param('programId'));
  const history = await withdrawals.myWithdrawals(ctx, c.req.param('programId'));
  return c.json({ ...wallet, withdrawals: history.map((w) => ({ ...w, payoutSnapshotEncrypted: undefined })) });
});
meRoutes.put('/affiliate/:programId/payout-profile', async (c) => {
  const input = await parse(payoutProfileInputSchema, await body(c));
  return c.json(await withdrawals.setPayoutProfile(c.get('ctx'), c.req.param('programId'), input));
});
meRoutes.post('/affiliate/:programId/withdrawals', async (c) => {
  const input = await parse(requestWithdrawalSchema.omit({ programId: true }), await body(c));
  const w = await withdrawals.requestWithdrawal(c.get('ctx'), c.req.param('programId'), input.amountMinor);
  return c.json({ ...w, payoutSnapshotEncrypted: undefined }, 201);
});

// Thông báo
meRoutes.get('/notifications', async (c) => {
  const q = query(c);
  return c.json(await notifications.listNotifications(c.get('ctx'), { filter: q.filter as 'all', cursor: q.cursor, limit: q.limit ? Number(q.limit) : undefined }));
});
meRoutes.post('/notifications/read', async (c) => {
  const { id } = await parse(z.object({ id: z.string().uuid().optional() }), await body(c));
  await notifications.markRead(c.get('ctx'), id);
  return c.json({ ok: true });
});
meRoutes.get('/notifications/prefs', async (c) => c.json(await notifications.getPrefs(c.get('ctx'))));
meRoutes.put('/notifications/prefs', async (c) => c.json(await notifications.updatePrefs(c.get('ctx'), await parse(notificationPrefsSchema, await body(c)))));

// Tin nhắn (polling 15 giây)
meRoutes.get('/conversations', async (c) => {
  const q = query(c);
  return c.json(await messaging.listConversations(c.get('ctx'), { filter: q.filter as 'all', q: q.q }));
});
meRoutes.get('/conversations/:id/messages', async (c) => {
  const q = query(c);
  return c.json(await messaging.listMessages(c.get('ctx'), c.req.param('id'), { after: q.after, limit: q.limit ? Number(q.limit) : undefined }));
});
meRoutes.post('/conversations/:id/archive', async (c) => {
  await messaging.archiveConversation(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
meRoutes.post('/messages', async (c) => {
  const input = await parse(sendMessageSchema, await body(c));
  const ctx = c.get('ctx');
  let imageUrl: string | null = null;
  if (input.imageFileId) imageUrl = (await ctx.db.query.files.findFirst({ where: eq(files.id, input.imageFileId) }))?.url ?? null;
  const msg = await messaging.send(ctx, { recipientUserId: input.recipientUserId, conversationId: input.conversationId, communityId: input.communityId ?? null, body: input.body, imageUrl });
  return c.json(msg, 201);
});

meRoutes.get('/id', (c) => c.json({ userId: requireUser(c.get('ctx')) }));
