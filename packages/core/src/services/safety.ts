// Chặn và báo cáo người dùng (mở từ menu ba chấm của khung chat).
// Chặn: hai bên không nhắn được cho nhau cho tới khi người chặn bỏ chặn. Báo cáo: tới quản trị hệ thống xem xét.
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { conversationParticipants, userBlocks, userReports, users, type UserReportReason } from '@hoiminh/db';
import type { Ctx } from '../context';
import { forbidden, notFound } from '../errors';
import { requireSuperAdmin, requireUser } from '../permissions';
import { notify } from './notifications';

export const REPORT_REASON_LABELS: Record<UserReportReason, string> = { spam: 'Spam, quảng cáo', harassment: 'Quấy rối, xúc phạm', scam: 'Lừa đảo', inappropriate: 'Nội dung không phù hợp', other: 'Lý do khác' };

async function requireOther(ctx: Ctx, targetUserId: string): Promise<{ me: string; name: string }> {
  const me = requireUser(ctx);
  if (targetUserId === me) throw forbidden('Không thể tự chặn hay báo cáo chính mình');
  const target = await ctx.db.query.users.findFirst({ where: eq(users.id, targetUserId), columns: { id: true, name: true } });
  if (!target) throw notFound('Không tìm thấy người dùng');
  return { me, name: target.name };
}

/** Chặn một người. Chặn lại người đã chặn thì không sao. */
export async function blockUser(ctx: Ctx, targetUserId: string): Promise<void> {
  const { me } = await requireOther(ctx, targetUserId);
  await ctx.db.insert(userBlocks).values({ blockerUserId: me, blockedUserId: targetUserId }).onConflictDoNothing();
}

export async function unblockUser(ctx: Ctx, targetUserId: string): Promise<void> {
  const me = requireUser(ctx);
  await ctx.db.delete(userBlocks).where(and(eq(userBlocks.blockerUserId, me), eq(userBlocks.blockedUserId, targetUserId)));
}

/** Giữa hai người có ai chặn ai không (nhìn từ phía `me`). */
export async function blockState(ctx: Ctx, me: string, other: string): Promise<{ byMe: boolean; byThem: boolean }> {
  const rows = await ctx.db.select({ blocker: userBlocks.blockerUserId }).from(userBlocks).where(or(and(eq(userBlocks.blockerUserId, me), eq(userBlocks.blockedUserId, other)), and(eq(userBlocks.blockerUserId, other), eq(userBlocks.blockedUserId, me))));
  return { byMe: rows.some((r) => r.blocker === me), byThem: rows.some((r) => r.blocker === other) };
}

/** Người gửi và bất kỳ ai trong `others` có chặn nhau không (chiều nào cũng tính). */
export async function anyBlockBetween(ctx: Ctx, senderUserId: string, others: string[]): Promise<boolean> {
  if (!others.length) return false;
  const [row] = await ctx.db.select({ one: sql<number>`1` }).from(userBlocks).where(or(and(eq(userBlocks.blockerUserId, senderUserId), inArray(userBlocks.blockedUserId, others)), and(inArray(userBlocks.blockerUserId, others), eq(userBlocks.blockedUserId, senderUserId)))).limit(1);
  return Boolean(row);
}

/** Báo cáo một người. Mỗi người chỉ có một báo cáo đang mở về cùng một người: báo lại thì cập nhật lý do. Báo cho mọi quản trị hệ thống. */
export async function reportUser(ctx: Ctx, input: { userId: string; conversationId?: string | null; reason: UserReportReason; detail?: string }): Promise<{ id: string }> {
  const { me, name } = await requireOther(ctx, input.userId);
  // Chỉ gắn hội thoại mà người báo cáo thật sự ở trong đó.
  const inConvo = input.conversationId ? await ctx.db.query.conversationParticipants.findFirst({ where: and(eq(conversationParticipants.conversationId, input.conversationId), eq(conversationParticipants.userId, me)), columns: { id: true } }) : null;
  const detail = (input.detail ?? '').trim().slice(0, 1000);
  const open = await ctx.db.query.userReports.findFirst({ where: and(eq(userReports.reporterUserId, me), eq(userReports.reportedUserId, input.userId), eq(userReports.status, 'open')) });
  if (open) {
    await ctx.db.update(userReports).set({ reason: input.reason, detail, conversationId: inConvo ? input.conversationId! : open.conversationId }).where(eq(userReports.id, open.id));
    return { id: open.id };
  }
  const [row] = await ctx.db.insert(userReports).values({ reporterUserId: me, reportedUserId: input.userId, conversationId: inConvo ? input.conversationId! : null, reason: input.reason, detail }).returning({ id: userReports.id });
  const admins = await ctx.db.select({ id: users.id }).from(users).where(eq(users.isSuperAdmin, true));
  for (const a of admins) await notify(ctx, { userId: a.id, kind: 'admin.user_report', category: 'system', title: `Có báo cáo mới về ${name}: ${REPORT_REASON_LABELS[input.reason]}`, link: '/he-thong/bao-cao' });
  return { id: row!.id };
}

/** Danh sách báo cáo người dùng cho quản trị hệ thống (mới nhất trước). */
export async function listUserReports(ctx: Ctx, q: { status?: 'open' | 'resolved' } = {}) {
  requireSuperAdmin(ctx);
  const reporter = alias(users, 'reporter');
  const reported = alias(users, 'reported');
  const rows = await ctx.db
    .select({ r: userReports, reporter: { id: reporter.id, name: reporter.name, email: reporter.email, handle: reporter.handle }, reported: { id: reported.id, name: reported.name, email: reported.email, handle: reported.handle, status: reported.status } })
    .from(userReports)
    .innerJoin(reporter, eq(reporter.id, userReports.reporterUserId))
    .innerJoin(reported, eq(reported.id, userReports.reportedUserId))
    .where(q.status ? eq(userReports.status, q.status) : sql`true`)
    .orderBy(desc(userReports.createdAt))
    .limit(200);
  const [open] = await ctx.db.select({ c: sql<number>`count(*)::int` }).from(userReports).where(eq(userReports.status, 'open'));
  return { items: rows.map((x) => ({ id: x.r.id, reason: x.r.reason, reasonLabel: REPORT_REASON_LABELS[x.r.reason], detail: x.r.detail, status: x.r.status, createdAt: x.r.createdAt, resolvedAt: x.r.resolvedAt, reporter: x.reporter, reported: x.reported })), open: open?.c ?? 0 };
}

/** Đánh dấu một báo cáo đã xử lý (việc khóa tài khoản làm ở trang Người dùng). */
export async function resolveUserReport(ctx: Ctx, reportId: string): Promise<void> {
  requireSuperAdmin(ctx);
  const actor = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  const done = await ctx.db.update(userReports).set({ status: 'resolved', resolvedAt: ctx.now(), resolvedByUserId: actor }).where(eq(userReports.id, reportId)).returning({ id: userReports.id });
  if (!done.length) throw notFound('Không tìm thấy báo cáo');
}
