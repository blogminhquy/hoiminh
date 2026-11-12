// Link đăng nhập một lần. Người đang đăng nhập trong trình duyệt của Zalo, Facebook, Messenger (nơi không cài được ra
// màn hình chính) lấy link này, dán vào Safari hoặc Chrome và vào thẳng tài khoản, không phải gõ lại mật khẩu.
// Link là quyền vào tài khoản nên: chỉ người đang đăng nhập tạo được cho chính mình, hạn ngắn, dùng đúng một lần,
// máy chủ chỉ giữ bản băm.
import { randomToken, sha256Hex } from '@hoiminh/config';
import type { AuthSession } from '@hoiminh/contracts';
import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import { loginLinks, users } from '@hoiminh/db';
import type { AuthProvider } from '../auth/providers';
import { issueSession } from '../auth/service';
import type { Ctx } from '../context';
import { invalid } from '../errors';
import { requireUser } from '../permissions';
import { audit } from './audit';
import { elevated } from './automation-engine';

export const LOGIN_LINK_TTL_MINUTES = 10;
/** Mỗi người chỉ có chừng này link còn hiệu lực cùng lúc; tạo thêm thì link cũ nhất bị hủy. */
const MAX_ACTIVE_LINKS = 3;

export const loginLinkUrl = (ctx: Ctx, token: string) => `${ctx.env.APP_URL}/vao?token=${token}`;

/** Tạo link đăng nhập một lần cho chính người đang đăng nhập. */
export async function createLoginLink(ctx: Ctx): Promise<{ url: string; expiresAt: Date }> {
  const userId = requireUser(ctx);
  const now = ctx.now();
  await ctx.db.delete(loginLinks).where(and(eq(loginLinks.userId, userId), lt(loginLinks.expiresAt, now)));
  await ctx.db.execute(sql`delete from login_links where user_id = ${userId} and consumed_at is null and id not in (select id from login_links where user_id = ${userId} and consumed_at is null order by created_at desc limit ${MAX_ACTIVE_LINKS - 1})`);
  const token = randomToken(24);
  const expiresAt = new Date(now.getTime() + LOGIN_LINK_TTL_MINUTES * 60_000);
  await ctx.db.insert(loginLinks).values({ userId, tokenHash: await sha256Hex(token), expiresAt });
  await audit(ctx, { action: 'auth.login_link_create', resourceType: 'user', resourceId: userId });
  return { url: loginLinkUrl(ctx, token), expiresAt };
}

/** Đổi link lấy một phiên đăng nhập mới. Link sai, hết hạn hoặc đã dùng thì báo cùng một lỗi. */
export async function consumeLoginLink(ctx: Ctx, provider: AuthProvider, token: string, meta?: { userAgent?: string }): Promise<AuthSession> {
  // Người mở link chưa đăng nhập ở trình duyệt này, nên policy RLS không cho đọc bảng link: mã trong link là bằng chứng.
  return elevated(ctx, async () => {
    const bad = () => invalid('Link đăng nhập không đúng hoặc đã hết hạn. Mở lại Hội Mình ở nơi bạn đang đăng nhập để lấy link mới.');
    if (!/^[a-f0-9]{48}$/.test(token)) throw bad();
    // Đánh dấu đã dùng bằng một câu cập nhật có điều kiện: hai trình duyệt mở cùng lúc thì chỉ một bên vào được.
    const [row] = await ctx.db.update(loginLinks).set({ consumedAt: ctx.now() }).where(and(eq(loginLinks.tokenHash, await sha256Hex(token)), isNull(loginLinks.consumedAt), gt(loginLinks.expiresAt, ctx.now()))).returning();
    if (!row) throw bad();
    const user = await ctx.db.query.users.findFirst({ where: eq(users.id, row.userId) });
    if (!user || user.status !== 'active') throw bad();
    await audit(ctx, { action: 'auth.login_link_use', resourceType: 'user', resourceId: user.id });
    return issueSession(ctx, provider, user, true, meta);
  });
}
