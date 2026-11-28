// Mua trước, tạo tài khoản sau (chủ dự án yêu cầu ngày 27/11/2026): khách chưa có tài khoản vẫn trả tiền được ngay, chỉ
// cần email và tên. Trả xong thì tạo tài khoản ngay trên màn thanh toán, hoặc bằng link trong email (kèm nhắc lại nếu
// chưa làm). Luật về tài khoản chờ, mã link và email nhắc nằm ở auth/claims.ts.
//
// Máy chủ tạo sẵn một tài khoản chờ mang email đó (chưa có mật khẩu, không đăng nhập được) và đứng tên đơn bằng tài khoản
// này, nên mọi bước sau khi trả tiền (mở quyền, vào hội, hoa hồng, báo chủ hội, đối soát) chạy y như đơn thường.
//
// Chặn chiếm quyền: email đã có tài khoản thật thì phải đăng nhập để mua. Email là tài khoản chờ đã có đơn trả tiền thì
// vẫn mua thêm được, nhưng chỉ tạo tài khoản được bằng link trong email (chứng minh là chủ hộp thư), không phải ngay trên
// trình duyệt vừa mua, vì ai cũng gõ được email của người khác vào ô mua.
import type { AuthSession, CheckoutSession, ClaimAccountInput, GuestCheckoutInput } from '@hoiminh/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import { accountClaims, communities, orders, users } from '@hoiminh/db';
import type { AuthProvider } from '../auth/providers';
import { claimPendingAccount, uniqueHandle } from '../auth/service';
import { isOrderToken, landingOf, latestPaidOrder, orderToken, userIdFromClaimToken } from '../auth/claims';
import type { Ctx } from '../context';
import { AppError, forbidden, invalid, notFound } from '../errors';
import { elevated } from '../lib/elevated';
import { createCheckout, markProcessing, orderStatus } from './checkout';

type User = typeof users.$inferSelect;

/** Ngữ cảnh đứng tên người mua: các hàm checkout sẵn có đọc người mua từ actor. */
const asBuyer = (ctx: Ctx, user: User): Ctx => ({ ...ctx, actor: { type: 'user', userId: user.id, isSuperAdmin: false, email: user.email } });

/** Tài khoản của email này: tạo tài khoản chờ nếu chưa có. Email đã có tài khoản thật thì báo đăng nhập. */
async function buyerFor(ctx: Ctx, email: string, name: string): Promise<{ user: User; created: boolean }> {
  const existing = await ctx.db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    const claim = await ctx.db.query.accountClaims.findFirst({ where: and(eq(accountClaims.userId, existing.id), isNull(accountClaims.claimedAt)), columns: { userId: true } });
    if (!claim || existing.status !== 'active') throw new AppError('conflict', 'Email này đã có tài khoản Hội Mình. Bạn đăng nhập để mua tiếp nhé.', undefined, { reason: 'account_exists', email });
    return { user: existing, created: false };
  }
  // Hai lượt mua cùng lúc bằng một email mới: lượt sau không chèn được (email là duy nhất) thì dùng tài khoản lượt trước vừa tạo.
  const [row] = await ctx.db.insert(users).values({ email, name, handle: await uniqueHandle(ctx, name) }).onConflictDoNothing({ target: users.email }).returning();
  if (row) return { user: row, created: true };
  return buyerFor(ctx, email, name);
}

/** Mua khi chưa đăng nhập. Trả thêm `guestToken`: trình duyệt giữ mã này để theo dõi đơn và tạo tài khoản sau khi trả. */
/** `opts.visitorId`: mã khách của trình duyệt, chuyển tiếp cho createCheckout (xem ở đó). */
export async function guestCheckout(ctx: Ctx, input: GuestCheckoutInput, opts: { visitorId?: string | null } = {}): Promise<CheckoutSession & { guestToken: string | null }> {
  const { email, name, ...rest } = input;
  // Đang đăng nhập thì mua như thường bằng tài khoản đó.
  if (ctx.actor.type === 'user') return { ...(await createCheckout(ctx, rest, { visitorId: opts.visitorId })), guestToken: null };
  if (rest.target.type === 'platform') throw invalid('Mua gói Hội Mình cho hội thì đăng nhập bằng tài khoản chủ hội nhé');
  return elevated(ctx, async () => {
    const { user, created } = await buyerFor(ctx, email, name);
    const session = await createCheckout(asBuyer(ctx, user), rest, { visitorId: opts.visitorId, returnUrl: async (orderId) => `${ctx.env.APP_URL}/thanh-toan/${orderId}?g=${await orderToken(ctx, orderId)}` });
    const order = await ctx.db.query.orders.findFirst({ where: eq(orders.id, session.orderId), columns: { communityId: true } });
    if (created) {
      await ctx.db.insert(accountClaims).values({ userId: user.id, orderId: session.orderId, communityId: order?.communityId ?? null }).onConflictDoNothing();
    } else if (!(await latestPaidOrder(ctx, user.id))) {
      // Tài khoản chờ chưa có đơn nào trả tiền (lần trước bỏ dở): không có gì phải giữ, trình duyệt mua lần này được tạo tài khoản.
      await ctx.db.update(accountClaims).set({ orderId: session.orderId, communityId: order?.communityId ?? null }).where(and(eq(accountClaims.userId, user.id), isNull(accountClaims.claimedAt)));
    }
    return { ...session, guestToken: await orderToken(ctx, session.orderId) };
  });
}

/** Đơn và người mua của một mã đơn. Mã sai thì báo không có đơn, như mọi đơn không phải của mình. */
async function guestOrder(ctx: Ctx, orderId: string, token: string): Promise<{ user: User }> {
  if (!(await isOrderToken(ctx, orderId, token))) throw notFound('Đơn không tồn tại');
  const o = await ctx.db.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { customerUserId: true } });
  const user = o ? await ctx.db.query.users.findFirst({ where: eq(users.id, o.customerUserId) }) : null;
  if (!user) throw notFound('Đơn không tồn tại');
  return { user };
}

/** Tài khoản của người mua, cho màn đơn hàng biết bước tiếp theo sau khi trả tiền. */
async function accountState(ctx: Ctx, user: User, orderId: string) {
  const claim = await ctx.db.query.accountClaims.findFirst({ where: eq(accountClaims.userId, user.id) });
  const pending = Boolean(claim && !claim.claimedAt);
  return {
    email: user.email,
    name: user.name,
    /** Đã có tài khoản thật (đã đặt mật khẩu): đăng nhập để vào. */
    hasAccount: !pending,
    /** Trình duyệt này đặt mật khẩu được ngay (chính đơn này tạo ra tài khoản chờ). Không thì tạo bằng link trong email. */
    canCreateHere: pending && claim?.orderId === orderId,
  };
}

/** Trạng thái đơn cho trình duyệt đã mua khi chưa đăng nhập (giữ mã đơn), kèm tình trạng tài khoản. */
export async function guestOrderStatus(ctx: Ctx, orderId: string, token: string) {
  return elevated(ctx, async () => {
    const { user } = await guestOrder(ctx, orderId, token);
    const status = await orderStatus(asBuyer(ctx, user), orderId);
    return { ...status, account: await accountState(ctx, user, orderId) };
  });
}

/** Người mua chưa đăng nhập bấm "Tôi đã chuyển khoản". */
export async function guestMarkProcessing(ctx: Ctx, orderId: string, token: string) {
  return elevated(ctx, async () => {
    const { user } = await guestOrder(ctx, orderId, token);
    const status = await markProcessing(asBuyer(ctx, user), orderId);
    return { ...status, account: await accountState(ctx, user, orderId) };
  });
}

/** Ai đang tạo tài khoản và bằng chứng nào: link trong email (đã chứng minh email) hay mã đơn của trình duyệt vừa mua. */
async function resolveClaim(ctx: Ctx, input: Pick<ClaimAccountInput, 'token' | 'orderId' | 'orderToken'>): Promise<{ user: User; viaEmail: boolean }> {
  if (input.token) {
    const userId = await userIdFromClaimToken(ctx, input.token);
    const user = userId ? await ctx.db.query.users.findFirst({ where: eq(users.id, userId) }) : null;
    if (!user) throw invalid('Link tạo tài khoản không đúng. Bạn mở lại nút trong email nhé.');
    return { user, viaEmail: true };
  }
  if (!input.orderId || !input.orderToken) throw invalid('Thiếu link tạo tài khoản');
  const { user } = await guestOrder(ctx, input.orderId, input.orderToken);
  const claim = await ctx.db.query.accountClaims.findFirst({ where: eq(accountClaims.userId, user.id) });
  if (claim && !claim.claimedAt && claim.orderId !== input.orderId) {
    throw forbidden(`Email ${user.email} đã có đơn mua trước đó, nên tài khoản phải tạo bằng link trong email để chắc chắn là chủ hộp thư. Bạn mở email "Tạo tài khoản và vào hội" nhé.`);
  }
  return { user, viaEmail: false };
}

/** Trang /tao-tai-khoan đọc thông tin này: email nào, đã mua gì ở đâu, đã tạo tài khoản chưa. */
export async function claimInfo(ctx: Ctx, input: Pick<ClaimAccountInput, 'token' | 'orderId' | 'orderToken'>) {
  return elevated(ctx, async () => {
    const { user } = await resolveClaim(ctx, input);
    const claim = await ctx.db.query.accountClaims.findFirst({ where: eq(accountClaims.userId, user.id) });
    const order = await latestPaidOrder(ctx, user.id);
    const community = order?.communityId ? await ctx.db.query.communities.findFirst({ where: eq(communities.id, order.communityId), columns: { name: true, slug: true } }) : null;
    return {
      email: user.email,
      name: user.name,
      claimed: !claim || Boolean(claim.claimedAt),
      item: order ? ((order.metadata as { title?: string }).title ?? null) : null,
      place: community?.name ?? null,
      paid: Boolean(order),
    };
  });
}

/** Đặt mật khẩu cho tài khoản chờ, đăng nhập luôn và đưa về đúng hội vừa mua. */
export async function claimAccount(ctx: Ctx, provider: AuthProvider, input: ClaimAccountInput & { ref?: string | null }, meta?: { userAgent?: string }): Promise<{ session: AuthSession; redirect: string; email: string }> {
  return elevated(ctx, async () => {
    const { user, viaEmail } = await resolveClaim(ctx, input);
    const claim = await ctx.db.query.accountClaims.findFirst({ where: eq(accountClaims.userId, user.id) });
    if (!claim || claim.claimedAt) throw new AppError('conflict', `Bạn đã tạo tài khoản cho ${user.email} rồi. Đăng nhập bằng email này nhé.`, undefined, { reason: 'already_claimed', email: user.email });
    const { session } = await claimPendingAccount(ctx, provider, user, { name: input.name ?? null, password: input.password, emailVerified: viaEmail, ref: input.ref ?? null }, meta);
    const redirect = await landingOf(ctx, await latestPaidOrder(ctx, user.id), user.id);
    return { session, redirect, email: user.email };
  });
}
