// Tin nhắn 1-1: gửi (kèm trả lời trích dẫn, ảnh, tệp đính kèm), ba trạng thái đã gửi / đã nhận / đã xem, thả cảm xúc, thu hồi,
// ghim, lưu trữ và bỏ lưu trữ, tin nhắn chào tự động.
// Có kênh thời gian thực thì báo ngay cho hai bên; không có thì web hỏi lại mỗi 15 giây.
import { and, asc, desc, eq, gt, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { normalizeWelcomeTemplate, type MessageReaction } from '@hoiminh/contracts';
import { MESSAGE_FILE_MAX_BYTES, MESSAGE_FILE_PREFIX } from '@hoiminh/media';
import { communities, communityMembers, communityPlugins, communityTiers, conversationParticipants, conversations, courseProgress, courses, files, messages, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { forbidden, notFound } from '../errors';
import { requireUser } from '../permissions';
import { releaseFiles } from './files';
import { anyBlockBetween, blockState } from './safety';

const userCols = { id: users.id, name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor, lastSeenAt: users.lastSeenAt };

/** Dòng xem trước của tin chỉ có ảnh và của tin đã thu hồi. */
const IMAGE_PREVIEW = '[Hình ảnh]';
const FILE_PREVIEW = '[Tệp]';
const RECALLED_PREVIEW = 'Tin nhắn đã được thu hồi';
/** Thu hồi được trong 24 giờ sau khi gửi (như Zalo): đủ để sửa lỗi gửi nhầm, không đủ để xóa dấu vết cũ. */
export const RECALL_WINDOW_MS = 24 * 60 * 60_000;

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
export async function sendMessage(ctx: Ctx, input: { senderUserId: string; recipientUserId?: string; conversationId?: string; communityId?: string | null; body: string; imageUrl?: string | null; automated?: boolean; replyToId?: string | null; fileId?: string | null }) {
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
  // Đã chặn nhau (chiều nào cũng vậy) thì không nhắn được. Tin tự động của hệ thống không tính.
  if (!input.automated) {
    const peers = await ctx.db.query.conversationParticipants.findMany({ where: and(eq(conversationParticipants.conversationId, convo.id), ne(conversationParticipants.userId, input.senderUserId)), columns: { userId: true } });
    if (await anyBlockBetween(ctx, input.senderUserId, peers.map((p) => p.userId))) throw forbidden('Bạn không thể nhắn tin cho người này');
  }
  // Chỉ trả lời được tin trong chính hội thoại này (không trích dẫn chéo sang hội thoại của người khác).
  const replyTo = input.replyToId ? await ctx.db.query.messages.findFirst({ where: and(eq(messages.id, input.replyToId), eq(messages.conversationId, convo.id)), columns: { id: true } }) : null;
  if (input.replyToId && !replyTo) throw notFound('Tin nhắn được trả lời không còn trong hội thoại này');
  // Tệp đính kèm: phải là tệp do chính người gửi tải lên cho tin nhắn, đã tải xong, không quá 5MB.
  // Kiểm ở đây vì fileId do client gửi: không kiểm thì gắn được tệp riêng của người khác (tệp số đã bán) và lấy link tải.
  const file = input.fileId ? await ctx.db.query.files.findFirst({ where: and(eq(files.id, input.fileId), eq(files.ownerUserId, input.senderUserId), eq(files.status, 'ready')) }) : null;
  if (input.fileId && (!file || !file.objectKey.startsWith(MESSAGE_FILE_PREFIX) || file.sizeBytes > MESSAGE_FILE_MAX_BYTES)) throw notFound('Không tìm thấy tệp đính kèm đã tải lên');
  const [msg] = await ctx.db.insert(messages).values({ conversationId: convo.id, senderUserId: input.senderUserId, body: input.body, imageUrl: input.imageUrl ?? null, automated: input.automated ?? false, replyToId: replyTo?.id ?? null, fileUrl: file?.objectKey ?? null, fileName: file?.originalName ?? null, fileSize: file?.sizeBytes ?? null }).returning();
  const preview = input.body.slice(0, 120) || (input.imageUrl ? IMAGE_PREVIEW : file ? `${FILE_PREVIEW} ${file.originalName}`.slice(0, 120) : '');
  await ctx.db.update(conversations).set({ lastMessageAt: msg!.createdAt, lastMessagePreview: preview, lastMessageAutomated: input.automated ?? false, lastMessageSenderId: input.senderUserId, archivedAt: null }).where(eq(conversations.id, convo.id));
  await ctx.db.update(conversationParticipants).set({ unreadCount: sql`${conversationParticipants.unreadCount} + 1`, archivedAt: null }).where(and(eq(conversationParticipants.conversationId, convo.id), sql`${conversationParticipants.userId} <> ${input.senderUserId}`));
  await ctx.db.update(conversationParticipants).set({ lastReadAt: msg!.createdAt }).where(and(eq(conversationParticipants.conversationId, convo.id), eq(conversationParticipants.userId, input.senderUserId)));
  const others = await ctx.db.query.conversationParticipants.findMany({ where: and(eq(conversationParticipants.conversationId, convo.id), sql`${conversationParticipants.userId} <> ${input.senderUserId}`) });
  await ctx.events.emit('message.sent', { messageId: msg!.id, conversationId: convo.id, senderUserId: input.senderUserId, recipientUserIds: others.map((o) => o.userId), automated: input.automated ?? false });
  return msg!;
}

/** Người dùng gửi tin. */
export async function send(ctx: Ctx, input: { recipientUserId?: string; conversationId?: string; communityId?: string | null; body: string; imageUrl?: string | null; replyToId?: string | null; fileId?: string | null }) {
  const userId = requireUser(ctx);
  return sendMessage(ctx, { ...input, senderUserId: userId });
}

/** Danh sách hội thoại: người kia, hội, xem trước, chưa đọc, tự động. Hội thoại đã ghim đứng đầu. Bộ lọc `archived` là các hội thoại đã lưu trữ. */
export async function listConversations(ctx: Ctx, q: { filter?: 'all' | 'unread' | 'automated' | 'archived'; q?: string }) {
  const userId = requireUser(ctx);
  // Mở danh sách là ứng dụng của mình đã nhận các tin gửi tới: người gửi thấy "Đã nhận".
  await markDelivered(ctx);
  const mine = ctx.db.select({ id: conversationParticipants.conversationId }).from(conversationParticipants).where(eq(conversationParticipants.userId, userId));
  const rows = await ctx.db
    .select({ c: conversations, me: conversationParticipants, other: userCols, community: { id: communities.id, name: communities.name, slug: communities.slug } })
    .from(conversations)
    .innerJoin(conversationParticipants, and(eq(conversationParticipants.conversationId, conversations.id), eq(conversationParticipants.userId, userId)))
    .innerJoin(users, sql`${users.id} = (select user_id from conversation_participants p2 where p2.conversation_id = ${conversations.id} and p2.user_id <> ${userId} limit 1)`)
    .leftJoin(communities, eq(communities.id, conversations.communityId))
    .where(and(inArray(conversations.id, mine), q.filter === 'archived' ? sql`${conversationParticipants.archivedAt} is not null` : sql`${conversationParticipants.archivedAt} is null`, q.filter === 'unread' ? gt(conversationParticipants.unreadCount, 0) : q.filter === 'automated' ? eq(conversations.lastMessageAutomated, true) : sql`true`, q.q ? or(ilike(users.name, `%${q.q}%`), ilike(users.handle, `%${q.q}%`))! : sql`true`))
    .orderBy(sql`${conversationParticipants.pinnedAt} desc nulls last`, desc(conversations.lastMessageAt));
  const [unread] = await ctx.db.select({ c: sql<number>`count(*)::int` }).from(conversationParticipants).where(and(eq(conversationParticipants.userId, userId), gt(conversationParticipants.unreadCount, 0)));
  return { items: rows.map((r) => ({ id: r.c.id, other: r.other, community: r.community, preview: r.c.lastMessagePreview, lastMessageAt: r.c.lastMessageAt, automated: r.c.lastMessageAutomated, unreadCount: r.me.unreadCount, pinned: Boolean(r.me.pinnedAt), archived: Boolean(r.me.archivedAt), lastFromMe: r.c.lastMessageSenderId === userId })), unreadConversations: unread?.c ?? 0 };
}

type MessageRow = typeof messages.$inferSelect;
/** Tin nhắn trả về cho web. Tin đã thu hồi không mang nội dung, ảnh hay cảm xúc. */
function messageView(m: MessageRow, replies: Map<string, MessageRow>) {
  const recalled = Boolean(m.recalledAt);
  const r = m.replyToId ? replies.get(m.replyToId) : undefined;
  return {
    id: m.id, senderUserId: m.senderUserId, body: recalled ? '' : m.body, imageUrl: recalled ? null : m.imageUrl, automated: m.automated, deliveredAt: m.deliveredAt, readAt: m.readAt, createdAt: m.createdAt,
    // Chỉ tên và dung lượng: link tải lấy riêng lúc bấm (messageFileUrl), có hạn ngắn.
    file: !recalled && m.fileUrl ? { name: m.fileName ?? 'Tệp đính kèm', sizeBytes: m.fileSize ?? 0 } : null,
    recalled, reactions: recalled ? {} : m.reactions,
    replyTo: r ? { id: r.id, senderUserId: r.senderUserId, body: r.recalledAt ? '' : r.body.slice(0, 160), hasImage: !r.recalledAt && Boolean(r.imageUrl), fileName: r.recalledAt ? null : r.fileName, recalled: Boolean(r.recalledAt) } : null,
  };
}

/** Tin nhắn trong hội thoại: 200 tin mới nhất, xếp cũ trước (`after` = chỉ lấy tin sau thời điểm đó). Tự đánh dấu đã đọc. */
export async function listMessages(ctx: Ctx, conversationId: string, q: { after?: string; limit?: number }) {
  const userId = requireUser(ctx);
  const part = await ctx.db.query.conversationParticipants.findFirst({ where: and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)) });
  if (!part) throw forbidden();
  const conds = [eq(messages.conversationId, conversationId)];
  if (q.after) conds.push(gt(messages.createdAt, new Date(q.after)));
  const limit = Math.min(Math.max(q.limit ?? 200, 1), 500);
  // Không có `after` thì lấy các tin MỚI nhất (trước đây lấy 200 tin cũ nhất, hội thoại dài sẽ mất tin mới).
  const rows = q.after
    ? await ctx.db.query.messages.findMany({ where: and(...conds), orderBy: asc(messages.createdAt), limit })
    : (await ctx.db.query.messages.findMany({ where: and(...conds), orderBy: desc(messages.createdAt), limit })).reverse();
  const replyIds = [...new Set(rows.map((m) => m.replyToId).filter((v): v is string => Boolean(v)))];
  const replies = new Map((replyIds.length ? await ctx.db.query.messages.findMany({ where: and(eq(messages.conversationId, conversationId), inArray(messages.id, replyIds)) }) : []).map((m) => [m.id, m]));
  await ctx.db.update(conversationParticipants).set({ unreadCount: 0, lastReadAt: ctx.now() }).where(eq(conversationParticipants.id, part.id));
  const justRead = await ctx.db.update(messages).set({ readAt: ctx.now(), deliveredAt: sql`coalesce(${messages.deliveredAt}, ${ctx.now()})` }).where(and(eq(messages.conversationId, conversationId), sql`${messages.senderUserId} <> ${userId}`, sql`${messages.readAt} is null`)).returning({ senderUserId: messages.senderUserId });
  // Người gửi thấy "Đã xem" ngay, không phải chờ lượt hỏi lại.
  if (justRead.length) await publishTo(ctx, conversationId, [...new Set(justRead.map((m) => m.senderUserId))]);
  const convo = await ctx.db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  const other = await ctx.db.select({ u: userCols }).from(conversationParticipants).innerJoin(users, eq(users.id, conversationParticipants.userId)).where(and(eq(conversationParticipants.conversationId, conversationId), sql`${conversationParticipants.userId} <> ${userId}`)).then((r) => r[0]?.u ?? null);
  const panel = other && convo?.communityId ? await memberPanel(ctx, convo.communityId, other.id) : null;
  return { items: rows.map((m) => messageView(m, replies)), other, community: convo?.communityId ? await ctx.db.query.communities.findFirst({ where: eq(communities.id, convo.communityId), columns: { id: true, name: true, slug: true } }) : null, panel, pinned: Boolean(part.pinnedAt), archived: Boolean(part.archivedAt), blocked: other ? await blockState(ctx, userId, other.id) : { byMe: false, byThem: false } };
}

/** Báo "hội thoại này có thay đổi" qua kênh thời gian thực. Lỗi kênh không làm hỏng thao tác. */
async function publishTo(ctx: Ctx, conversationId: string, userIds: string[]): Promise<void> {
  await ctx.realtime?.publish(userIds, { type: 'message', conversationId }).catch((err) => ctx.log.warn('realtime.publish_failed', { err: String(err) }));
}
async function publishToAll(ctx: Ctx, conversationId: string): Promise<void> {
  const parts = await ctx.db.query.conversationParticipants.findMany({ where: eq(conversationParticipants.conversationId, conversationId), columns: { userId: true } });
  await publishTo(ctx, conversationId, parts.map((p) => p.userId));
}

/** Tin nhắn mà người đang đăng nhập được phép chạm vào (phải ở trong hội thoại). */
async function messageForMe(ctx: Ctx, messageId: string) {
  const userId = requireUser(ctx);
  const msg = await ctx.db.query.messages.findFirst({ where: eq(messages.id, messageId) });
  if (!msg) throw notFound('Không tìm thấy tin nhắn');
  const part = await ctx.db.query.conversationParticipants.findFirst({ where: and(eq(conversationParticipants.conversationId, msg.conversationId), eq(conversationParticipants.userId, userId)) });
  if (!part) throw forbidden();
  return { userId, msg };
}

/** Thả cảm xúc lên một tin (mỗi người một cảm xúc; `null` là gỡ). */
export async function reactToMessage(ctx: Ctx, messageId: string, emoji: MessageReaction | null) {
  const { userId, msg } = await messageForMe(ctx, messageId);
  if (msg.recalledAt) throw forbidden('Tin nhắn đã được thu hồi');
  // Sửa ngay trong câu lệnh để hai người thả cùng lúc không ghi đè nhau.
  await ctx.db.update(messages).set({ reactions: emoji ? sql`${messages.reactions} || jsonb_build_object(${userId}::text, ${emoji}::text)` : sql`${messages.reactions} - ${userId}::text` }).where(eq(messages.id, msg.id));
  await publishToAll(ctx, msg.conversationId);
}

/** Thu hồi tin của chính mình trong 24 giờ: xóa hẳn nội dung và ảnh, hai bên chỉ còn thấy "Tin nhắn đã được thu hồi". */
/** Link tải tệp đính kèm của một tin: chỉ người trong hội thoại lấy được, link sống 5 phút và tải về với đúng tên gốc. */
export async function messageFileUrl(ctx: Ctx, messageId: string): Promise<{ url: string; name: string }> {
  const { msg } = await messageForMe(ctx, messageId);
  if (msg.recalledAt || !msg.fileUrl) throw notFound('Tin nhắn này không có tệp đính kèm');
  const name = msg.fileName ?? 'tep-dinh-kem';
  return { url: await ctx.media.getSignedUrl(msg.fileUrl, 300, name), name };
}

/**
 * Đánh dấu "Đã nhận": mọi tin gửi tới mình mà ứng dụng của mình vừa biết tới (lúc hỏi số chưa đọc, lúc mở danh sách).
 * Chỉ quét các hội thoại đang có tin chưa đọc nên lượt hỏi bình thường không tốn gì. Báo cho người gửi qua kênh thời gian thực.
 */
export async function markDelivered(ctx: Ctx): Promise<void> {
  const userId = requireUser(ctx);
  const unread = ctx.db.select({ id: conversationParticipants.conversationId }).from(conversationParticipants).where(and(eq(conversationParticipants.userId, userId), gt(conversationParticipants.unreadCount, 0)));
  const got = await ctx.db.update(messages).set({ deliveredAt: ctx.now() }).where(and(isNull(messages.deliveredAt), ne(messages.senderUserId, userId), inArray(messages.conversationId, unread))).returning({ conversationId: messages.conversationId, senderUserId: messages.senderUserId });
  const byConversation = new Map<string, Set<string>>();
  for (const m of got) byConversation.set(m.conversationId, (byConversation.get(m.conversationId) ?? new Set()).add(m.senderUserId));
  for (const [conversationId, senders] of byConversation) await publishTo(ctx, conversationId, [...senders]);
}

export async function recallMessage(ctx: Ctx, messageId: string) {
  const { userId, msg } = await messageForMe(ctx, messageId);
  if (msg.senderUserId !== userId) throw forbidden('Chỉ thu hồi được tin của chính mình');
  if (msg.recalledAt) return;
  if (ctx.now().getTime() - msg.createdAt.getTime() > RECALL_WINDOW_MS) throw forbidden('Chỉ thu hồi được tin nhắn trong 24 giờ sau khi gửi');
  await ctx.db.update(messages).set({ recalledAt: ctx.now(), body: '', imageUrl: null, fileUrl: null, fileName: null, fileSize: null, reactions: {} }).where(eq(messages.id, msg.id));
  // Ảnh và tệp của tin đã thu hồi cũng xóa khỏi kho (nếu không còn nơi nào khác dùng), không thì ai giữ link cũ vẫn mở được.
  // Ảnh là tệp công khai (tìm theo URL); tệp đính kèm là tệp riêng, cột lưu object key nên phải tìm ra id của nó.
  const attached = msg.fileUrl ? await ctx.db.query.files.findFirst({ where: eq(files.objectKey, msg.fileUrl), columns: { id: true } }) : null;
  await releaseFiles(ctx, { urls: [msg.imageUrl], fileIds: [attached?.id] }, { ownerUserIds: [userId] });
  // Tin cuối bị thu hồi thì dòng xem trước trong danh sách cũng không còn lộ nội dung.
  await ctx.db.update(conversations).set({ lastMessagePreview: RECALLED_PREVIEW }).where(and(eq(conversations.id, msg.conversationId), eq(conversations.lastMessageAt, msg.createdAt)));
  await publishToAll(ctx, msg.conversationId);
}

/** Ghim / bỏ ghim hội thoại lên đầu danh sách (chỉ phía mình). */
export async function pinConversation(ctx: Ctx, conversationId: string, pinned: boolean) {
  const userId = requireUser(ctx);
  const done = await ctx.db.update(conversationParticipants).set({ pinnedAt: pinned ? ctx.now() : null }).where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId))).returning({ id: conversationParticipants.id });
  if (!done.length) throw forbidden();
}

/** Panel bên phải màn Tin nhắn: gói, ngày tham gia, đang học, giới thiệu bởi. */
async function memberPanel(ctx: Ctx, communityId: string, otherUserId: string) {
  const m = await ctx.db.select({ m: communityMembers, tier: { key: communityTiers.key, name: communityTiers.name, monthlyMinor: communityTiers.monthlyMinor } }).from(communityMembers).leftJoin(communityTiers, eq(communityTiers.id, communityMembers.tierId)).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, otherUserId))).then((r) => r[0]);
  if (!m) return null;
  const learning = await ctx.db.select({ title: courses.title, percent: courseProgress.percent }).from(courseProgress).innerJoin(courses, eq(courses.id, courseProgress.courseId)).where(and(eq(courseProgress.userId, otherUserId), eq(courses.communityId, communityId))).orderBy(desc(courseProgress.lastAccessedAt)).limit(1).then((r) => r[0] ?? null);
  const referrer = m.m.referredByAffiliateId ? await raw(ctx.db, sql`select u.name from affiliate_accounts a join users u on u.id = a.user_id where a.id = ${m.m.referredByAffiliateId}`).then((r) => (r[0] as { name: string } | undefined)?.name ?? null) : null;
  return { memberId: m.m.id, role: m.m.role, status: m.m.status, tier: m.tier, joinedAt: m.m.joinedAt, learning, referrer };
}

/** Lưu trữ / bỏ lưu trữ hội thoại (chỉ phía mình). Hội thoại đã lưu trữ nằm ở tab "Lưu trữ" và tự trở lại khi có tin mới. */
export async function archiveConversation(ctx: Ctx, conversationId: string, archived = true) {
  const userId = requireUser(ctx);
  const done = await ctx.db.update(conversationParticipants).set({ archivedAt: archived ? ctx.now() : null }).where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId))).returning({ id: conversationParticipants.id });
  if (!done.length) throw forbidden();
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
  const vars: Record<string, string> = { full_name: member.name.trim(), first_name: firstName, community_name: c.name, start_link: startLink };
  let body = normalizeWelcomeTemplate(cfg.template ?? 'Chào {{full_name}}, chào mừng bạn đến với {{community_name}}.').replace(/\{\{(\w+)\}\}/g, (whole, key: string) => vars[key] ?? whole);
  if (cfg.includeStartLink !== false && !body.includes(startLink)) body += `\n\nBắt đầu tại đây: ${startLink}`;
  await sendMessage(ctx, { senderUserId, recipientUserId: userId, communityId, body, automated: true });
  return true;
}
