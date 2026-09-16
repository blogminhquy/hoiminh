// Dịch vụ xác thực: đăng ký (ghi nhận người giới thiệu), đăng nhập, xác minh email, quên/đặt lại/đổi mật khẩu, phiên.
import { BUSINESS, randomCode, sha256Hex, timingSafeEqual } from '@hoiminh/config';
import { toSlug, type AuthSession, type AuthUser, type LoginInput, type RegisterInput } from '@hoiminh/contracts';
import { templates } from '@hoiminh/email';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { authSessions, emailVerifications, passwordResets, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { AppError, conflict, invalid, notFound, unauthorized } from '../errors';
import { hashToken, newRefreshToken, signAccessToken, signTwoFactorTicket, verifyAccessToken, verifyTwoFactorTicket } from './tokens';
import type { AuthProvider } from './providers';
import * as totp from './totp';

/** Mật khẩu đúng nhưng tài khoản bật hai lớp: cần thêm một bước nữa mới có phiên. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  ticket: string;
  remember: boolean;
}

const ACCESS_TTL_REMEMBER = 7 * 86_400;
const ACCESS_TTL_SHORT = 86_400;
const REFRESH_TTL_DAYS = 30;

export function toAuthUser(u: typeof users.$inferSelect): AuthUser {
  return { id: u.id, email: u.email, name: u.name, handle: u.handle, avatarUrl: u.avatarUrl, emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null, isSuperAdmin: u.isSuperAdmin, locale: u.locale, timezone: u.timezone };
}

/** Sinh handle duy nhất từ tên. */
export async function uniqueHandle(ctx: Ctx, name: string): Promise<string> {
  const base = toSlug(name).slice(0, 24) || 'thanh-vien';
  for (let i = 0; i < 50; i++) {
    const h = i === 0 ? base : `${base}-${i + 1}`;
    const exists = await ctx.db.query.users.findFirst({ where: eq(users.handle, h), columns: { id: true } });
    if (!exists) return h;
  }
  return `${base}-${randomCode(4).toLowerCase()}`;
}

async function issueSession(ctx: Ctx, provider: AuthProvider, user: typeof users.$inferSelect, remember: boolean, meta?: { userAgent?: string }): Promise<AuthSession> {
  const refresh = await newRefreshToken();
  const [session] = await ctx.db
    .insert(authSessions)
    .values({ userId: user.id, refreshTokenHash: refresh.hash, userAgent: meta?.userAgent ?? null, ipHash: ctx.ipHash ?? null, expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000) })
    .returning();
  const { token, expiresAt } = await signAccessToken(provider.jwtSecret, { sub: user.id, email: user.email, sid: session!.id, sa: user.isSuperAdmin }, remember ? ACCESS_TTL_REMEMBER : ACCESS_TTL_SHORT);
  await ctx.db.update(users).set({ lastSeenAt: ctx.now() }).where(eq(users.id, user.id));
  return { accessToken: token, refreshToken: refresh.raw, expiresAt: expiresAt.toISOString(), user: toAuthUser(user) };
}

/** Đăng ký tài khoản, gửi mã xác minh, phát user.registered (attribution cộng sự xử lý ở handler). */
export async function register(ctx: Ctx, provider: AuthProvider, input: RegisterInput, meta?: { userAgent?: string }): Promise<AuthSession> {
  const existing = await ctx.db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) throw conflict('Email đã được đăng ký, hãy đăng nhập');
  const handle = await uniqueHandle(ctx, input.name);
  const [user] = await ctx.db.insert(users).values({ email: input.email, name: input.name, handle }).returning();
  const identity = await provider.signUp(input.email, input.password, { name: input.name, userId: user!.id }, ctx.db);
  await ctx.db.update(users).set({ authProviderId: identity.providerUserId }).where(eq(users.id, user!.id));
  await sendVerificationCode(ctx, user!);
  await ctx.events.emit('user.registered', { userId: user!.id, email: user!.email, ref: input.ref ?? null, communitySlug: input.communitySlug ?? null });
  return issueSession(ctx, provider, { ...user!, authProviderId: identity.providerUserId }, true, meta);
}

/**
 * Đăng nhập email + mật khẩu. Tài khoản bật xác thực hai lớp thì chưa cấp phiên mà trả
 * về vé bước hai; web gọi tiếp `verifyTwoFactor` với mã từ ứng dụng.
 */
export async function login(ctx: Ctx, provider: AuthProvider, input: LoginInput, meta?: { userAgent?: string }): Promise<AuthSession | TwoFactorChallenge> {
  const user = await ctx.db.query.users.findFirst({ where: eq(users.email, input.email) });
  const identity = await provider.signIn(input.email, input.password, user?.id ?? null, ctx.db);
  if (!user || !identity) throw unauthorized('Email hoặc mật khẩu không đúng');
  if (user.status === 'suspended') throw new AppError('forbidden', 'Tài khoản đã bị tạm khóa');
  if (await totp.isEnabledFor(ctx, user.id)) {
    return { twoFactorRequired: true, ticket: await signTwoFactorTicket(provider.jwtSecret, user.id), remember: input.remember ?? true };
  }
  return issueSession(ctx, provider, user, input.remember ?? true, meta);
}

/** Bước hai: đổi vé + mã (từ ứng dụng hoặc mã dự phòng) lấy phiên đăng nhập. */
export async function verifyTwoFactor(ctx: Ctx, provider: AuthProvider, ticket: string, code: string, remember = true, meta?: { userAgent?: string }): Promise<AuthSession> {
  const userId = await verifyTwoFactorTicket(provider.jwtSecret, ticket);
  if (!userId) throw unauthorized('Phiên xác thực đã hết hạn, đăng nhập lại');
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || user.status !== 'active') throw unauthorized();
  await totp.verifyForLogin({ ...ctx, actor: { type: 'user', userId, isSuperAdmin: user.isSuperAdmin, email: user.email } }, userId, code);
  return issueSession(ctx, provider, user, remember, meta);
}

/** Đăng nhập bằng danh tính Supabase (sau Google OAuth): tạo user nếu chưa có. */
export async function loginWithIdentity(ctx: Ctx, provider: AuthProvider, identity: { providerUserId: string; email: string; name?: string; emailVerified: boolean }): Promise<AuthSession> {
  let user = await ctx.db.query.users.findFirst({ where: eq(users.email, identity.email.toLowerCase()) });
  if (!user) {
    const name = identity.name ?? identity.email.split('@')[0] ?? 'Thành viên';
    [user] = await ctx.db.insert(users).values({ email: identity.email.toLowerCase(), name, handle: await uniqueHandle(ctx, name), authProviderId: identity.providerUserId, emailVerifiedAt: identity.emailVerified ? ctx.now() : null }).returning();
    await ctx.events.emit('user.registered', { userId: user!.id, email: user!.email, ref: null, communitySlug: null });
  } else if (!user.authProviderId) {
    await ctx.db.update(users).set({ authProviderId: identity.providerUserId }).where(eq(users.id, user.id));
  }
  return issueSession(ctx, provider, user!, true);
}

/** Đổi refresh token lấy access token mới (xoay refresh). */
export async function refresh(ctx: Ctx, provider: AuthProvider, rawRefresh: string): Promise<AuthSession> {
  const hash = await hashToken(rawRefresh);
  const session = await ctx.db.query.authSessions.findFirst({ where: and(eq(authSessions.refreshTokenHash, hash), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, ctx.now())) });
  if (!session) throw unauthorized('Phiên hết hạn, đăng nhập lại');
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user || user.status !== 'active') throw unauthorized();
  await ctx.db.update(authSessions).set({ revokedAt: ctx.now() }).where(eq(authSessions.id, session.id));
  return issueSession(ctx, provider, user, true);
}

/** Đăng xuất: thu hồi phiên hiện tại. */
export async function logout(ctx: Ctx, sessionId: string): Promise<void> {
  await ctx.db.update(authSessions).set({ revokedAt: ctx.now() }).where(eq(authSessions.id, sessionId));
}

/** Xác minh access token → actor. Phiên bị thu hồi thì từ chối. */
export async function authenticate(ctx: Ctx, provider: AuthProvider, token: string): Promise<{ userId: string; sessionId: string; user: typeof users.$inferSelect } | null> {
  const claims = await verifyAccessToken(provider.jwtSecret, token);
  if (!claims) return null;
  const session = await ctx.db.query.authSessions.findFirst({ where: and(eq(authSessions.id, claims.sid), isNull(authSessions.revokedAt)), columns: { id: true } });
  if (!session) return null;
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, claims.sub) });
  if (!user || user.status !== 'active') return null;
  return { userId: user.id, sessionId: session.id, user };
}

/** Gửi mã 6 số xác minh email (15 phút). */
export async function sendVerificationCode(ctx: Ctx, user: typeof users.$inferSelect): Promise<void> {
  const code = ctx.env.APP_ENV === 'test' ? '482913' : randomCode(6, '0123456789');
  await ctx.db.insert(emailVerifications).values({ userId: user.id, codeHash: await sha256Hex(code), expiresAt: new Date(Date.now() + 15 * 60_000) });
  await ctx.email.send(templates.verifyCode(user.email, user.name, code));
}

/** Gửi lại mã xác minh. */
export async function resendVerification(ctx: Ctx, userId: string): Promise<void> {
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw notFound();
  if (user.emailVerifiedAt) return;
  await sendVerificationCode(ctx, user);
}

/** Xác minh mã 6 số. Tối đa 5 lần sai mỗi mã. */
export async function verifyEmail(ctx: Ctx, userId: string, code: string): Promise<AuthUser> {
  const rows = await ctx.db.query.emailVerifications.findMany({ where: and(eq(emailVerifications.userId, userId), isNull(emailVerifications.consumedAt), gt(emailVerifications.expiresAt, ctx.now())), orderBy: (t, { desc }) => desc(t.createdAt), limit: 3 });
  const hash = await sha256Hex(code);
  const match = rows.find((r) => r.attempts < 5 && timingSafeEqual(r.codeHash, hash));
  if (!match) {
    for (const r of rows) await ctx.db.update(emailVerifications).set({ attempts: r.attempts + 1 }).where(eq(emailVerifications.id, r.id));
    throw invalid('Mã không đúng hoặc đã hết hạn');
  }
  await ctx.db.update(emailVerifications).set({ consumedAt: ctx.now() }).where(eq(emailVerifications.id, match.id));
  const [user] = await ctx.db.update(users).set({ emailVerifiedAt: ctx.now() }).where(eq(users.id, userId)).returning();
  return toAuthUser(user!);
}

/** Quên mật khẩu: tạo token 30 phút và gửi link. Luôn trả về thành công để không lộ email. */
export async function forgotPassword(ctx: Ctx, email: string): Promise<{ token?: string }> {
  const user = await ctx.db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) return {};
  const raw = randomCode(40, 'abcdefghijklmnopqrstuvwxyz0123456789');
  await ctx.db.insert(passwordResets).values({ userId: user.id, tokenHash: await sha256Hex(raw), expiresAt: new Date(Date.now() + 30 * 60_000) });
  await ctx.email.send(templates.resetPassword(user.email, user.name, `${ctx.env.APP_URL}/dat-lai-mat-khau?token=${raw}`));
  return ctx.env.APP_ENV === 'test' ? { token: raw } : {};
}

/** Đặt mật khẩu mới bằng token, tùy chọn đăng xuất thiết bị khác. */
export async function resetPassword(ctx: Ctx, provider: AuthProvider, token: string, password: string, logoutOthers: boolean): Promise<AuthSession> {
  const row = await ctx.db.query.passwordResets.findFirst({ where: and(eq(passwordResets.tokenHash, await sha256Hex(token)), isNull(passwordResets.consumedAt), gt(passwordResets.expiresAt, ctx.now())) });
  if (!row) throw invalid('Link đặt lại không hợp lệ hoặc đã hết hạn');
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, row.userId) });
  if (!user) throw notFound();
  await provider.setPassword(user.authProviderId ?? user.id, password, ctx.db);
  await ctx.db.update(passwordResets).set({ consumedAt: ctx.now() }).where(eq(passwordResets.id, row.id));
  if (logoutOthers) await ctx.db.update(authSessions).set({ revokedAt: ctx.now() }).where(and(eq(authSessions.userId, user.id), isNull(authSessions.revokedAt)));
  return issueSession(ctx, provider, user, true);
}

/**
 * Đổi mật khẩu khi đang đăng nhập. Phải nhập đúng mật khẩu hiện tại; mặc định thu hồi mọi phiên khác
 * (phiên hiện tại giữ nguyên) để người lạ đang đăng nhập trên máy khác bị đẩy ra.
 */
export async function changePassword(
  ctx: Ctx,
  provider: AuthProvider,
  input: { currentPassword: string; newPassword: string; logoutOthers?: boolean },
  keepSessionId?: string,
): Promise<void> {
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  if (!userId) throw unauthorized();
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw notFound();
  const identity = await provider.signIn(user.email, input.currentPassword, user.id, ctx.db);
  if (!identity) throw invalid('Mật khẩu hiện tại không đúng');
  await provider.setPassword(user.authProviderId ?? user.id, input.newPassword, ctx.db);
  if (input.logoutOthers ?? true) {
    const where = keepSessionId
      ? and(eq(authSessions.userId, user.id), isNull(authSessions.revokedAt), ne(authSessions.id, keepSessionId))
      : and(eq(authSessions.userId, user.id), isNull(authSessions.revokedAt));
    await ctx.db.update(authSessions).set({ revokedAt: ctx.now() }).where(where);
  }
  await ctx.email.send(templates.passwordChanged(user.email, user.name));
}

export const TRIAL_DAYS = BUSINESS.platformTrialDays;
