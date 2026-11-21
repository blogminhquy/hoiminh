// /v1/auth: đăng ký, đăng nhập, Google, làm mới, đăng xuất, xác minh email, quên/đặt lại mật khẩu.
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from '@hoiminh/contracts';
import { auth, loginLinks, SupabaseAuthProvider, requireUser, AppError } from '@hoiminh/core';
import { z } from 'zod';
import { body, parse, router } from '../lib/hono';
import { rateLimit } from '../middleware/rate-limit';
import { clearSessionCookies, readCookie, REFRESH_COOKIE, respondSession, wantsCookie } from '../lib/session-cookie';

export const authRoutes = router();

authRoutes.post('/register', rateLimit('auth'), async (c) => {
  const input = await parse(registerSchema, await body(c));
  const ctx = c.get('ctx');
  const ref = input.ref ?? getCookie(c.req.header('cookie'), 'hm_ref') ?? undefined;
  const session = await auth.register(ctx, c.get('app').auth, { ...input, ref }, { userAgent: c.req.header('user-agent') });
  return respondSession(c, session, 201);
});

authRoutes.post('/login', rateLimit('auth'), async (c) => {
  const input = await parse(loginSchema, await body(c));
  const session = await auth.login(c.get('ctx'), c.get('app').auth, input, { userAgent: c.req.header('user-agent') });
  // Tài khoản bật hai lớp: chưa có phiên, chỉ có vé bước hai.
  return 'twoFactorRequired' in session ? c.json(session) : respondSession(c, session);
});

/** Bước hai của đăng nhập: vé + mã từ ứng dụng xác thực (hoặc mã dự phòng). */
authRoutes.post('/2fa', rateLimit('auth'), async (c) => {
  const input = await parse(z.object({ ticket: z.string().min(10), code: z.string().min(6).max(20), remember: z.boolean().optional() }), await body(c));
  const session = await auth.verifyTwoFactor(c.get('ctx'), c.get('app').auth, input.ticket, input.code, input.remember ?? true, { userAgent: c.req.header('user-agent') });
  return respondSession(c, session);
});

authRoutes.post('/refresh', rateLimit('auth'), async (c) => {
  // Web gửi token làm mới bằng cookie; ứng dụng ngoài gửi trong body. Body có token thì dùng body
  // (cũng là đường chuyển phiên cũ trong localStorage sang cookie).
  const input = await parse(z.object({ refreshToken: z.string().min(10).optional() }), await body(c));
  const refreshToken = input.refreshToken ?? readCookie(c, REFRESH_COOKIE);
  if (!refreshToken) throw new AppError('unauthorized', 'Phiên đăng nhập đã hết, hãy đăng nhập lại');
  try {
    return respondSession(c, await auth.refresh(c.get('ctx'), c.get('app').auth, refreshToken));
  } catch (err) {
    if (wantsCookie(c)) clearSessionCookies(c);
    throw err;
  }
});

authRoutes.post('/logout', async (c) => {
  const sid = c.get('sessionId');
  if (sid) await auth.logout(c.get('ctx'), sid);
  clearSessionCookies(c);
  return c.json({ ok: true });
});

authRoutes.get('/google', (c) => {
  const provider = c.get('app').auth;
  const url = provider.googleAuthUrl(`${c.get('ctx').env.APP_URL}/auth/callback`);
  if (!url) throw new AppError('invalid_state', 'Đăng nhập Google cần cấu hình Supabase Auth (AUTH_PROVIDER=supabase)', 501);
  return c.json({ url });
});

authRoutes.post('/google/callback', async (c) => {
  const provider = c.get('app').auth;
  if (!(provider instanceof SupabaseAuthProvider)) throw new AppError('invalid_state', 'Đăng nhập Google cần Supabase Auth', 501);
  const { accessToken, name } = await parse(z.object({ accessToken: z.string().min(10), name: z.string().optional() }), await body(c));
  const identity = await provider.userFromToken(accessToken);
  if (!identity) throw new AppError('unauthorized', 'Token Google không hợp lệ');
  return respondSession(c, await auth.loginWithIdentity(c.get('ctx'), provider, { ...identity, name }, { ref: getCookie(c.req.header('cookie'), 'hm_ref') }));
});

authRoutes.post('/verify-email', async (c) => {
  const ctx = c.get('ctx');
  const { code } = await parse(verifyEmailSchema, await body(c));
  return c.json(await auth.verifyEmail(ctx, requireUser(ctx), code));
});

authRoutes.post('/resend-verification', rateLimit('auth'), async (c) => {
  const ctx = c.get('ctx');
  await auth.resendVerification(ctx, requireUser(ctx));
  return c.json({ ok: true });
});

authRoutes.post('/forgot-password', rateLimit('auth'), async (c) => {
  const { email } = await parse(forgotPasswordSchema, await body(c));
  const r = await auth.forgotPassword(c.get('ctx'), email);
  return c.json({ ok: true, ...(c.get('ctx').env.APP_ENV === 'test' ? r : {}) });
});

authRoutes.post('/reset-password', async (c) => {
  const input = await parse(resetPasswordSchema, await body(c));
  return respondSession(c, await auth.resetPassword(c.get('ctx'), c.get('app').auth, input.token, input.password, input.logoutOthers));
});

/**
 * Link đăng nhập một lần: người đang đăng nhập trong trình duyệt của Zalo, Facebook, Messenger lấy link, dán vào Safari
 * hoặc Chrome là vào thẳng tài khoản. Tạo link cần đang đăng nhập; đổi link lấy phiên thì không (đó là việc của link).
 */
authRoutes.post('/login-link', rateLimit('auth'), async (c) => c.json(await loginLinks.createLoginLink(c.get('ctx')), 201));
authRoutes.post('/login-link/consume', rateLimit('auth'), async (c) => {
  const { token } = await parse(z.object({ token: z.string().min(10).max(100) }), await body(c));
  return respondSession(c, await loginLinks.consumeLoginLink(c.get('ctx'), c.get('app').auth, token, { userAgent: c.req.header('user-agent') }));
});

function getCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const m = header.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
