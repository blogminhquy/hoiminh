// Thông báo trong app + tùy chọn nhận thông báo.
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { communities, notificationPrefs, notifications, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { decodeCursor, paginate } from '../lib/pagination';
import { requireUser } from '../permissions';

export interface NotifyInput {
  userId: string;
  communityId?: string | null;
  kind: string;
  category?: 'all' | 'mention' | 'affiliate' | 'system' | 'payment' | 'event' | 'comment' | 'like' | 'post';
  title: string;
  body?: string;
  actorUserId?: string | null;
  link?: string | null;
  actionLabel?: string | null;
  data?: Record<string, unknown>;
}

/** Tạo thông báo, tôn trọng mức "off"/"mentions" theo hội (mục 67). */
export async function notify(ctx: Ctx, input: NotifyInput): Promise<void> {
  if (input.communityId) {
    const prefs = await ctx.db.query.notificationPrefs.findFirst({ where: eq(notificationPrefs.userId, input.userId) });
    const level = prefs?.perCommunity[input.communityId] ?? 'all';
    if (level === 'off') return;
    if (level === 'mentions' && input.category !== 'mention' && input.category !== 'payment' && input.category !== 'affiliate') return;
    if (input.category === 'like' && prefs && !prefs.likes) return;
  }
  await ctx.db.insert(notifications).values({
    userId: input.userId, communityId: input.communityId ?? null, kind: input.kind, category: input.category ?? 'all', title: input.title, body: input.body ?? '',
    actorUserId: input.actorUserId ?? null, link: input.link ?? null, actionLabel: input.actionLabel ?? null, data: input.data ?? {},
  });
}

/** Danh sách thông báo của tôi, lọc theo nhóm, phân trang cursor. */
export async function listNotifications(ctx: Ctx, q: { filter?: 'all' | 'unread' | 'mention' | 'affiliate' | 'system'; cursor?: string; limit?: number }) {
  const userId = requireUser(ctx);
  const limit = q.limit ?? 30;
  const c = decodeCursor(q.cursor);
  const conds = [eq(notifications.userId, userId)];
  if (q.filter === 'unread') conds.push(isNull(notifications.readAt));
  else if (q.filter === 'mention') conds.push(eq(notifications.category, 'mention'));
  else if (q.filter === 'affiliate') conds.push(eq(notifications.category, 'affiliate'));
  else if (q.filter === 'system') conds.push(or(eq(notifications.category, 'system'), eq(notifications.category, 'payment'))!);
  if (c) conds.push(or(lt(notifications.createdAt, new Date(c.at)), and(eq(notifications.createdAt, new Date(c.at)), lt(notifications.id, c.id)))!);
  const rows = await ctx.db
    .select({ n: notifications, actor: { id: users.id, name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor }, community: { name: communities.name, slug: communities.slug } })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorUserId))
    .leftJoin(communities, eq(communities.id, notifications.communityId))
    .where(and(...conds))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);
  const page = paginate(rows.map((r) => ({ ...r.n, actor: r.actor?.id ? r.actor : null, community: r.community })), limit);
  const [cnt] = await ctx.db.select({ unread: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return { ...page, unreadCount: cnt?.unread ?? 0 };
}

/** Đánh dấu đã đọc một hoặc tất cả. */
export async function markRead(ctx: Ctx, id?: string): Promise<void> {
  const userId = requireUser(ctx);
  const conds = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (id) conds.push(eq(notifications.id, id));
  await ctx.db.update(notifications).set({ readAt: ctx.now() }).where(and(...conds));
}

/** Đọc tùy chọn thông báo. */
export async function getPrefs(ctx: Ctx) {
  const userId = requireUser(ctx);
  const p = await ctx.db.query.notificationPrefs.findFirst({ where: eq(notificationPrefs.userId, userId) });
  return p ?? { userId, emailDigest: true, push: true, likes: false, perCommunity: {} as Record<string, 'all' | 'mentions' | 'off'>, updatedAt: ctx.now() };
}

/** Cập nhật tùy chọn thông báo (gộp per-community). */
export async function updatePrefs(ctx: Ctx, input: { emailDigest?: boolean; push?: boolean; likes?: boolean; perCommunity?: Record<string, 'all' | 'mentions' | 'off'> }) {
  const userId = requireUser(ctx);
  const current = await getPrefs(ctx);
  const next = { emailDigest: input.emailDigest ?? current.emailDigest, push: input.push ?? current.push, likes: input.likes ?? current.likes, perCommunity: { ...current.perCommunity, ...(input.perCommunity ?? {}) }, updatedAt: ctx.now() };
  await ctx.db.insert(notificationPrefs).values({ userId, ...next }).onConflictDoUpdate({ target: notificationPrefs.userId, set: next });
  return { userId, ...next };
}

/** Số badge xuyên hội: tin nhắn chưa đọc + thông báo chưa đọc (mục 193). */
export async function badges(ctx: Ctx): Promise<{ unreadNotifications: number; unreadMessages: number }> {
  const userId = requireUser(ctx);
  const [n] = await ctx.db.select({ c: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  const m = await raw(ctx.db, sql`select coalesce(sum(unread_count),0)::int as c from conversation_participants where user_id = ${userId}`);
  return { unreadNotifications: n?.c ?? 0, unreadMessages: Number((m[0] as { c: number } | undefined)?.c ?? 0) };
}
