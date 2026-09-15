// Tin nhắn thời gian thực (V2): hội thoại 1-1, gửi, đọc, đang gõ, trạng thái online, lưu trữ, tin nhắn chào tự động.
// Đẩy qua ctx.realtime (SSE /v1/me/stream); polling vẫn giữ làm phương án dự phòng khi trình duyệt không giữ được luồng.
import { and, asc, desc, eq, gt, ilike, inArray, or, sql } from 'drizzle-orm';
import { communities, communityMembers, communityPlugins, communityTiers, conversationParticipants, conversations, courseProgress, courses, messages, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { forbidden, notFound } from '../errors';
import { requireUser } from '../permissions';

const userCols = { id: users.id, name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor, lastSeenAt: users.lastSeenAt };

/** Lấy hoặc tạo hội thoại 1-1. */
export async function getOrCreateConversation(ctx: Ctx, a: string, b: string, communityId: string | null) {
  const pairKey = [a, b].sort().join(':');
  const existing = await ctx.db.query.conversations.findFirst({ where: eq(conversations.pairKey, pairKey) });
  if (existing) return existing;
  const [c] = await ctx.db.insert(conversations).values({ communityId, pairKey }).onConflictDoNothing().returning();
  if (!c) return (await ctx.db.query.conversations.findFirst({ where: eq(conversations.pairKey, pairKey) }))!;
  await ctx.db.insert(conversationParticipants).values([{ conversationId: c.id, userId: a }, { conversationId: c.id, userId: b }]);
  return c;
}

/** Gửi tin nhắn (người dùng hoặc hệ thống thay mặt chủ hội với automated = true). */
export async function sendMessage(ctx: Ctx, input: { senderUserId: string; recipientUserId?: string; conversationId?: string; communityId?: string | null; body: string; imageUrl?: string | null; automated?: boolean }) {
  let convo = input.conversationId ? await ctx.db.query.conversations.findFirst({ where: eq(conversations.id, input.conversationId) }) : null;
  if (!convo) {
    if (!input.recipientUserId) throw notFound('Cần người nhận');
    if (input.recipientUserId === input.senderUserId) throw forbidden('Không thể tự nhắn cho mình');
    const recipient = await ctx.db.query.users.findFirst({ where: eq(users.id, input.recipientUserId) });
    if (!recipient) throw notFound('Người nhận không tồn tại');
    if (!recipient.privacy.allowMessages && !input.automated) {
      const isStaff = input.communityId ? await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, input.senderUserId), inArray(communityMembers.role, ['owner', 'admin', 'moderator'])) }) : null;
      if (!isStaff) throw forbidden('Người này không nhận tin nhắn từ thành viên khác');
    }
    convo = await getOrCreateConversation(ctx, input.senderUserId, input.recipientUserId, input.communityId ?? null);
  } else {
    const part = await ctx.db.query.conversationParticipants.findFirst({ where: and(eq(conversationParticipants.conversationId, convo.id), eq(conversationParticipants.userId, input.senderUserId)) });
    if (!part) throw forbidden();
  }
  const [msg] = await ctx.db.insert(messages).values({ conversationId: convo.id, senderUserId: input.senderUserId, body: input.body, imageUrl: input.imageUrl ?? null, automated: input.automated ?? false }).returning();
  await ctx.db.update(conversations).set({ lastMessageAt: msg!.createdAt, lastMessagePreview: input.body.slice(0, 120), lastMessageAutomated: input.automated ?? false, archivedAt: null }).where(eq(conversations.id, convo.id));
  await ctx.db.update(conversationParticipants).set({ unreadCount: sql`${conversationParticipants.unreadCount} + 1`, archivedAt: null }).where(and(eq(conversationParticipants.conversationId, convo.id), sql`${conversationParticipants.userId} <> ${input.senderUserId}`));
  await ctx.db.update(conversationParticipants).set({ lastReadAt: msg!.createdAt }).where(and(eq(conversationParticipants.conversationId, convo.id), eq(conversationParticipants.userId, input.senderUserId)));
  const others = await ctx.db.query.conversationParticipants.findMany({ where: and(eq(conversationParticipants.conversationId, convo.id), sql`${conversationParticipants.userId} <> ${input.senderUserId}`) });
  await ctx.events.emit('message.sent', { messageId: msg!.id, conversationId: convo.id, senderUserId: input.senderUserId, recipientUserIds: others.map((o) => o.userId), automated: input.automated ?? false });
  return msg!;
}

/** Người dùng gửi tin. */
export async function send(ctx: Ctx, input: { recipientUserId?: string; conversationId?: string; communityId?: string | null; body: string; imageUrl?: string | null }) {
  const userId = requireUser(ctx);
  return sendMessage(ctx, { ...input, senderUserId: userId });
}

/** Danh sách hội thoại: người kia, hội, xem trước, chưa đọc, tự động. */
export async function listConversations(ctx: Ctx, q: { filter?: 'all' | 'unread' | 'automated'; q?: string }) {
  const userId = requireUser(ctx);
  const mine = ctx.db.select({ id: conversationParticipants.conversationId }).from(conversationParticipants).where(eq(conversationParticipants.userId, userId));
  const rows = await ctx.db
    .select({ c: conversations, me: conversationParticipants, other: userCols, community: { id: communities.id, name: communities.name, slug: communities.slug } })
    .from(conversations)
    .innerJoin(conversationParticipants, and(eq(conversationParticipants.conversationId, conversations.id), eq(conversationParticipants.userId, userId)))
    .innerJoin(users, sql`${users.id} = (select user_id from conversation_participants p2 where p2.conversation_id = ${conversations.id} and p2.user_id <> ${userId} limit 1)`)
    .leftJoin(communities, eq(communities.id, conversations.communityId))
    .where(and(inArray(conversations.id, mine), sql`${conversationParticipants.archivedAt} is null`, q.filter === 'unread' ? gt(conversationParticipants.unreadCount, 0) : q.filter === 'automated' ? eq(conversations.lastMessageAutomated, true) : sql`true`, q.q ? or(ilike(users.name, `%${q.q}%`), ilike(users.handle, `%${q.q}%`))! : sql`true`))
    .orderBy(desc(conversations.lastMessageAt));
  const [unread] = await ctx.db.select({ c: sql<number>`count(*)::int` }).from(conversationParticipants).where(and(eq(conversationParticipants.userId, userId), gt(conversationParticipants.unreadCount, 0)));
  return { items: rows.map((r) => ({ id: r.c.id, other: { ...r.other, online: ctx.realtime.isOnline(r.other.id) }, community: r.community, preview: r.c.lastMessagePreview, lastMessageAt: r.c.lastMessageAt, automated: r.c.lastMessageAutomated, unreadCount: r.me.unreadCount })), unreadConversations: unread?.c ?? 0 };
}

/** Tin nhắn trong hội thoại (polling với `after` = thời điểm tin cuối đã có). Tự đánh dấu đã đọc. */
export async function listMessages(ctx: Ctx, conversationId: string, q: { after?: string; limit?: number }) {
  const userId = requireUser(ctx);
  const part = await ctx.db.query.conversationParticipants.findFirst({ where: and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)) });
  if (!part) throw forbidden();
  const conds = [eq(messages.conversationId, conversationId)];
  if (q.after) conds.push(gt(messages.createdAt, new Date(q.after)));
  const rows = await ctx.db.query.messages.findMany({ where: and(...conds), orderBy: asc(messages.createdAt), limit: q.limit ?? 200 });
  await markConversationRead(ctx, conversationId, userId);
  const convo = await ctx.db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  const other = await ctx.db.select({ u: userCols }).from(conversationParticipants).innerJoin(users, eq(users.id, conversationParticipants.userId)).where(and(eq(conversationParticipants.conversationId, conversationId), sql`${conversationParticipants.userId} <> ${userId}`)).then((r) => r[0]?.u ?? null);
  const panel = other && convo?.communityId ? await memberPanel(ctx, convo.communityId, other.id) : null;
  return { items: rows, other: other ? { ...other, online: ctx.realtime.isOnline(other.id) } : null, community: convo?.communityId ? await ctx.db.query.communities.findFirst({ where: eq(communities.id, convo.communityId), columns: { id: true, name: true, slug: true } }) : null, panel };
}

/** Panel bên phải màn Tin nhắn: gói, ngày tham gia, đang học, giới thiệu bởi. */
async function memberPanel(ctx: Ctx, communityId: string, otherUserId: string) {
  const m = await ctx.db.select({ m: communityMembers, tier: { key: communityTiers.key, name: communityTiers.name, monthlyMinor: communityTiers.monthlyMinor } }).from(communityMembers).leftJoin(communityTiers, eq(communityTiers.id, communityMembers.tierId)).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, otherUserId))).then((r) => r[0]);
  if (!m) return null;
  const learning = await ctx.db.select({ title: courses.title, percent: courseProgress.percent }).from(courseProgress).innerJoin(courses, eq(courses.id, courseProgress.courseId)).where(and(eq(courseProgress.userId, otherUserId), eq(courses.communityId, communityId))).orderBy(desc(courseProgress.lastAccessedAt)).limit(1).then((r) => r[0] ?? null);
  const referrer = m.m.referredByAffiliateId ? await raw(ctx.db, sql`select u.name from affiliate_accounts a join users u on u.id = a.user_id where a.id = ${m.m.referredByAffiliateId}`).then((r) => (r[0] as { name: string } | undefined)?.name ?? null) : null;
  return { memberId: m.m.id, role: m.m.role, status: m.m.status, tier: m.tier, joinedAt: m.m.joinedAt, learning, referrer };
}

/** Đánh dấu đã đọc: xóa số chưa đọc, đóng dấu readAt và báo biên nhận cho người kia. */
export async function markConversationRead(ctx: Ctx, conversationId: string, forUserId?: string) {
  const userId = forUserId ?? requireUser(ctx);
  const part = await ctx.db.query.conversationParticipants.findFirst({ where: and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)) });
  if (!part) throw forbidden();
  const readAt = ctx.now();
  await ctx.db.update(conversationParticipants).set({ unreadCount: 0, lastReadAt: readAt }).where(eq(conversationParticipants.id, part.id));
  const updated = await ctx.db.update(messages).set({ readAt }).where(and(eq(messages.conversationId, conversationId), sql`${messages.senderUserId} <> ${userId}`, sql`${messages.readAt} is null`)).returning({ id: messages.id });
  if (updated.length) ctx.realtime.publish(await otherParticipantIds(ctx, conversationId, userId), { type: 'message.read', conversationId, byUserId: userId, readAt: readAt.toISOString() });
  return { readAt, markedCount: updated.length };
}

/** Thời gian một lượt "đang gõ" còn hiệu lực (giây). Client gửi lại trước khi hết hạn. */
export const TYPING_TTL_SECONDS = 6;

/** Báo "đang gõ" cho người kia. Không lưu DB — chỉ đẩy qua hub. */
export async function setTyping(ctx: Ctx, conversationId: string) {
  const userId = requireUser(ctx);
  const part = await ctx.db.query.conversationParticipants.findFirst({ where: and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)) });
  if (!part) throw forbidden();
  const expiresAt = new Date(ctx.now().getTime() + TYPING_TTL_SECONDS * 1000);
  ctx.realtime.publish(await otherParticipantIds(ctx, conversationId, userId), { type: 'conversation.typing', conversationId, byUserId: userId, expiresAt: expiresAt.toISOString() });
  return { expiresAt };
}

/** Id những người còn lại trong hội thoại. */
export async function otherParticipantIds(ctx: Ctx, conversationId: string, exceptUserId: string): Promise<string[]> {
  const rows = await ctx.db.query.conversationParticipants.findMany({ where: and(eq(conversationParticipants.conversationId, conversationId), sql`${conversationParticipants.userId} <> ${exceptUserId}`), columns: { userId: true } });
  return rows.map((r) => r.userId);
}

/** Lưu trữ hội thoại (chỉ phía mình). */
export async function archiveConversation(ctx: Ctx, conversationId: string) {
  const userId = requireUser(ctx);
  await ctx.db.update(conversationParticipants).set({ archivedAt: ctx.now() }).where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)));
}

/** Tin nhắn chào tự động (mục 194): render template, gửi thay mặt chủ hội với flag automated. */
export async function sendWelcomeDm(ctx: Ctx, communityId: string, userId: string): Promise<boolean> {
  const plugin = await ctx.db.query.communityPlugins.findFirst({ where: and(eq(communityPlugins.communityId, communityId), eq(communityPlugins.pluginKey, 'welcome_dm')) });
  if (!plugin?.enabled) return false;
  const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId) });
  const member = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!c || !member) return false;
  const cfg = plugin.config as { senderUserId?: string; template?: string; includeStartLink?: boolean };
  const owner = await raw(ctx.db, sql`select owner_user_id from workspaces where id = ${c.workspaceId}`).then((r) => (r[0] as { owner_user_id: string }).owner_user_id);
  const senderUserId = cfg.senderUserId ?? owner;
  if (senderUserId === userId) return false;
  const already = await raw(ctx.db, sql`select 1 from messages m join conversations c on c.id = m.conversation_id where c.pair_key = ${[senderUserId, userId].sort().join(':')} and m.automated = true limit 1`);
  if (already.length) return false;
  const firstName = member.name.trim().split(/\s+/).pop() ?? member.name;
  const startLink = `${ctx.env.APP_URL}/${c.slug}/bang-tin`;
  let body = (cfg.template ?? 'Chào {{tên}}, chào mừng bạn đến với {{cộng đồng}}.').replace(/\{\{\s*tên\s*\}\}/g, firstName).replace(/\{\{\s*first_name\s*\}\}/g, firstName).replace(/\{\{\s*cộng đồng\s*\}\}/g, c.name).replace(/\{\{\s*community_name\s*\}\}/g, c.name).replace(/\{\{\s*link bắt đầu\s*\}\}/g, startLink).replace(/\{\{\s*start_link\s*\}\}/g, startLink);
  if (cfg.includeStartLink !== false && !body.includes(startLink)) body += `\n\nBắt đầu tại đây: ${startLink}`;
  await sendMessage(ctx, { senderUserId, recipientUserId: userId, communityId, body, automated: true });
  return true;
}
