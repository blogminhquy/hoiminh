// Tài khoản chờ của người mua trước, tạo tài khoản sau (chủ dự án yêu cầu ngày 27/11/2026).
//
// Khách chưa đăng nhập mua bằng email: máy chủ tạo sẵn một tài khoản chưa có mật khẩu mang email đó (dòng account_claims
// còn `claimed_at` null). Đơn, quyền truy cập, hoa hồng chạy y như đơn thường. Trả tiền xong khách nhận email có link
// riêng để đặt mật khẩu và vào thẳng hội vừa mua; chưa làm thì được nhắc lại sau 1, 3 và 7 ngày.
//
// Hai loại mã, đều là HMAC bằng AUTH_JWT_SECRET nên không phải lưu và gửi lại bao nhiêu lần vẫn là cùng một link:
// - mã tạo tài khoản (trong email): `<userId>.<chữ ký>`. Bấm được link nghĩa là chủ hộp thư, nên email coi như đã xác minh.
// - mã đơn (trình duyệt vừa mua giữ): xem trạng thái đơn, báo đã chuyển khoản, và đặt mật khẩu ngay trên màn thanh toán
//   nếu chính đơn này tạo ra tài khoản chờ.
import { hmacHex, timingSafeEqual } from '@hoiminh/config';
import { formatMoney } from '@hoiminh/contracts';
import { templates } from '@hoiminh/email';
import { and, desc, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { accountClaims, communities, communityMembers, orders, users } from '@hoiminh/db';
import type { Ctx } from '../context';

type User = typeof users.$inferSelect;
type Order = typeof orders.$inferSelect;
export type AccountClaim = typeof accountClaims.$inferSelect;

/** Khoảng cách (ngày) giữa các email: nhắc lần 1 sau 1 ngày, lần 2 sau 3 ngày, lần 3 sau 7 ngày kể từ email báo đã nhận tiền. */
export const CLAIM_REMINDER_GAPS_DAYS = [1, 2, 4] as const;

const SIG_LENGTH = 40;
const sign = async (ctx: Ctx, purpose: string, id: string) => (await hmacHex(ctx.env.AUTH_JWT_SECRET, `hoiminh:${purpose}:${id}`)).slice(0, SIG_LENGTH);

/** Mã trong link tạo tài khoản gửi qua email. */
export async function claimToken(ctx: Ctx, userId: string): Promise<string> {
  return `${userId}.${await sign(ctx, 'account-claim', userId)}`;
}

/** Id người dùng của một mã tạo tài khoản, hoặc null nếu mã sai. */
export async function userIdFromClaimToken(ctx: Ctx, token: string): Promise<string | null> {
  const m = /^([0-9a-f-]{36})\.([0-9a-f]{40})$/.exec(token);
  if (!m) return null;
  return timingSafeEqual(await sign(ctx, 'account-claim', m[1]!), m[2]!) ? m[1]! : null;
}

/** Mã đơn trả cho trình duyệt vừa mua khi chưa đăng nhập. */
export async function orderToken(ctx: Ctx, orderId: string): Promise<string> {
  return sign(ctx, 'guest-order', orderId);
}

export async function isOrderToken(ctx: Ctx, orderId: string, token: string): Promise<boolean> {
  return /^[0-9a-f]{40}$/.test(token) && timingSafeEqual(await orderToken(ctx, orderId), token);
}

export const claimUrl = (ctx: Ctx, token: string) => `${ctx.env.APP_URL}/tao-tai-khoan?token=${token}`;

/** Dòng tài khoản chờ (chưa đặt mật khẩu) của người dùng này, hoặc null. Gọi trong `elevated` khi người gọi chưa đăng nhập. */
export async function pendingClaimOf(ctx: Ctx, userId: string): Promise<AccountClaim | null> {
  return (await ctx.db.query.accountClaims.findFirst({ where: and(eq(accountClaims.userId, userId), isNull(accountClaims.claimedAt)) })) ?? null;
}

/** Đơn đã trả gần nhất (chưa hoàn) của người này: email nói đúng món vừa mua, tạo tài khoản xong thì vào đúng chỗ. */
export async function latestPaidOrder(ctx: Ctx, userId: string): Promise<Order | null> {
  return (await ctx.db.query.orders.findFirst({ where: and(eq(orders.customerUserId, userId), eq(orders.status, 'paid')), orderBy: desc(orders.paidAt) })) ?? null;
}

/** Trang vào sau khi tạo tài khoản, cùng luật với `nextUrl` của màn đơn hàng. */
export async function landingOf(ctx: Ctx, order: Order | null, userId: string): Promise<string> {
  if (!order) return '/hoc';
  const meta = order.metadata as { communitySlug?: string; productSlug?: string };
  if (!meta.communitySlug) return '/hoc';
  if (order.targetType === 'tier') return `/${meta.communitySlug}/khoa-hoc`;
  // Người mua lẻ không phải thành viên: về Khu học tập, vì khung hội sẽ chặn họ ở cửa.
  const member = order.communityId
    ? await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, order.communityId), eq(communityMembers.userId, userId), inArray(communityMembers.status, ['active', 'cancelling'])), columns: { id: true } })
    : null;
  return member ? `/${meta.communitySlug}/cua-hang/${meta.productSlug ?? ''}` : '/hoc';
}

/**
 * Gửi email có link tạo tài khoản. `paid`: email báo đã nhận tiền (thay cho email thanh toán thành công thường lệ);
 * `reminder`: email nhắc, đếm thêm một lần; `resend`: khách tự xin lại (quên mật khẩu, đăng ký trùng email), không đếm.
 * Không có đơn nào đã trả thì không gửi gì và trả về false.
 */
export async function sendClaimEmail(ctx: Ctx, user: User, mode: 'paid' | 'reminder' | 'resend', paidOrder?: Order): Promise<boolean> {
  const order = paidOrder ?? (await latestPaidOrder(ctx, user.id));
  if (!order) return false;
  const claim = await pendingClaimOf(ctx, user.id);
  if (!claim) return false;
  const community = order.communityId ? await ctx.db.query.communities.findFirst({ where: eq(communities.id, order.communityId), columns: { name: true } }) : null;
  const meta = order.metadata as { title?: string };
  const reminder = mode === 'paid' ? 0 : mode === 'reminder' ? claim.remindersSent + 1 : Math.max(1, claim.remindersSent);
  await ctx.email.send(templates.accountClaim(user.email, {
    name: user.name,
    item: meta.title ?? 'đơn hàng',
    place: community?.name ?? 'Hội Mình',
    amount: mode === 'paid' ? formatMoney(order.totalMinor, order.currency as 'VND') : null,
    reference: order.reference,
    url: claimUrl(ctx, await claimToken(ctx, user.id)),
    reminder,
  }));
  if (mode !== 'resend') await ctx.db.update(accountClaims).set({ lastEmailedAt: ctx.now(), remindersSent: mode === 'reminder' ? reminder : claim.remindersSent }).where(eq(accountClaims.userId, user.id));
  return true;
}

/**
 * Cron hằng ngày: người đã trả tiền mà chưa tạo tài khoản thì nhắc lại, tối đa ba lần (sau 1, 3, 7 ngày). Cron chạy mỗi
 * ngày một lần nên cho lệch nửa ngày: trả lúc 20 giờ thì 18 giờ hôm sau đã tính là đủ một ngày.
 */
export async function remindPendingAccounts(ctx: Ctx): Promise<number> {
  const rows = await ctx.db.query.accountClaims.findMany({ where: and(isNull(accountClaims.claimedAt), isNotNull(accountClaims.lastEmailedAt), lt(accountClaims.remindersSent, CLAIM_REMINDER_GAPS_DAYS.length)), limit: 500, orderBy: (t, { asc }) => asc(t.lastEmailedAt) });
  const now = ctx.now().getTime();
  let sent = 0;
  for (const r of rows) {
    if (!r.lastEmailedAt || r.remindersSent >= CLAIM_REMINDER_GAPS_DAYS.length) continue;
    const gap = CLAIM_REMINDER_GAPS_DAYS[r.remindersSent]! * 86_400_000 - 12 * 3_600_000;
    if (now - r.lastEmailedAt.getTime() < gap) continue;
    const user = await ctx.db.query.users.findFirst({ where: eq(users.id, r.userId) });
    if (!user || user.status !== 'active') continue;
    // Đơn đã hoàn hết thì không còn gì để vào: sendClaimEmail không gửi.
    if (await sendClaimEmail(ctx, user, 'reminder')) sent++;
  }
  return sent;
}
