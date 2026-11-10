// /v1/me: tài khoản, hồ sơ, badge, khu học tập, gói và thanh toán, hội của tôi, cộng sự (ví, rút tiền), thông báo, tin nhắn.
import { changePasswordSchema, notificationPrefsSchema, payoutProfileInputSchema, pinConversationSchema, reactMessageSchema, requestWithdrawalSchema, sendMessageSchema, updateProfileSchema, workspaceTeamInviteSchema } from '@hoiminh/contracts';
import { affiliate, auth, featureFlags, learner, messaging, notifications, paymentsService, shell, subscriptions, totp, users, withdrawals, workspaces, notFound, requireUser } from '@hoiminh/core';
import { files } from '@hoiminh/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { body, parse, query, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

export const meRoutes = router();
meRoutes.use('*', requireAuth);

meRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const u = await users.me(ctx);
  return c.json({ user: auth.toAuthUser(u), profile: u, communities: await shell.myCommunities(ctx) });
});

/** Trạng thái tích hợp cho MCP và các client dùng API key: MCP server hỏi lúc khởi động. */
meRoutes.get('/integration', async (c) => {
  const ctx = c.get('ctx');
  const workspaceId = ctx.actor.type === 'api_key' ? ctx.actor.workspaceId : null;
  return c.json({ workspaceId, mcpEnabled: await featureFlags.isEnabled(ctx, featureFlags.FLAG.mcp, { workspaceId }) });
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
meRoutes.post('/password', rateLimit('write'), async (c) => {
  const input = await parse(changePasswordSchema, await body(c));
  await auth.changePassword(c.get('ctx'), c.get('app').auth, input, c.get('sessionId'));
  return c.json({ ok: true });
});

// Xác thực hai lớp của chính mình.
const codeSchema = z.object({ code: z.string().min(6).max(20) });
meRoutes.get('/2fa', async (c) => c.json(await totp.status(c.get('ctx'))));
meRoutes.post('/2fa/start', rateLimit('write'), async (c) => c.json(await totp.startSetup(c.get('ctx'))));
meRoutes.post('/2fa/confirm', rateLimit('write'), async (c) => c.json(await totp.confirmSetup(c.get('ctx'), (await parse(codeSchema, await body(c))).code)));
meRoutes.post('/2fa/backup-codes', rateLimit('write'), async (c) => c.json(await totp.regenerateBackupCodes(c.get('ctx'), (await parse(codeSchema, await body(c))).code)));
meRoutes.post('/2fa/disable', rateLimit('write'), async (c) => {
  const input = await parse(z.object({ password: z.string().min(1) }), await body(c));
  await totp.disable(c.get('ctx'), c.get('app').auth, input.password);
  return c.json({ ok: true });
});

meRoutes.get('/badges', async (c) => c.json(await notifications.badges(c.get('ctx'))));
/** Khu học tập của người mua lẻ: khóa học và sản phẩm số đã sở hữu, không cần là thành viên hội nào. */
meRoutes.get('/library', async (c) => c.json(await learner.myLibrary(c.get('ctx'))));
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

// Tin nhắn (kênh thời gian thực, không có thì web hỏi lại mỗi 15 giây)
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
  if (!input.body && !imageUrl) throw notFound('Không tìm thấy ảnh đã tải lên');
  const msg = await messaging.send(ctx, { recipientUserId: input.recipientUserId, conversationId: input.conversationId, communityId: input.communityId ?? null, body: input.body, imageUrl, replyToId: input.replyToId ?? null });
  return c.json(msg, 201);
});
meRoutes.post('/messages/:id/reaction', async (c) => {
  const { emoji } = await parse(reactMessageSchema, await body(c));
  await messaging.reactToMessage(c.get('ctx'), c.req.param('id'), emoji);
  return c.json({ ok: true });
});
meRoutes.post('/messages/:id/recall', async (c) => {
  await messaging.recallMessage(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
meRoutes.post('/conversations/:id/pin', async (c) => {
  const { pinned } = await parse(pinConversationSchema, await body(c));
  await messaging.pinConversation(c.get('ctx'), c.req.param('id'), pinned);
  return c.json({ ok: true });
});

meRoutes.get('/id', (c) => c.json({ userId: requireUser(c.get('ctx')) }));
