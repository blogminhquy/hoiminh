// /v1/auth: đăng ký, đăng nhập, Google, làm mới, đăng xuất, xác minh email, quên/đặt lại mật khẩu.
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from '@hoiminh/contracts';
import { auth, SupabaseAuthProvider, requireUser, AppError } from '@hoiminh/core';
import { z } from 'zod';
import { body, parse, router } from '../lib/hono';
import { rateLimit } from '../middleware/common';

export const authRoutes = router();

authRoutes.post('/register', rateLimit({ windowMs: 60_000, max: 10 }), async (c) => {
  const input = await parse(registerSchema, await body(c));
  const ctx = c.get('ctx');
  const ref = input.ref ?? getCookie(c.req.header('cookie'), 'hm_ref') ?? undefined;
  const session = await auth.register(ctx, c.get('app').auth, { ...input, ref }, { userAgent: c.req.header('user-agent') });
  return c.json(session, 201);
});

authRoutes.post('/login', rateLimit({ windowMs: 60_000, max: 20 }), async (c) => {
  const input = await parse(loginSchema, await body(c));
  const session = await auth.login(c.get('ctx'), c.get('app').auth, input, { userAgent: c.req.header('user-agent') });
  return c.json(session);
});

/** Bước hai của đăng nhập: vé + mã từ ứng dụng xác thực (hoặc mã dự phòng). */
authRoutes.post('/2fa', rateLimit({ windowMs: 60_000, max: 10 }), async (c) => {
  const input = await parse(z.object({ ticket: z.string().min(10), code: z.string().min(6).max(20), remember: z.boolean().optional() }), await body(c));
  const session = await auth.verifyTwoFactor(c.get('ctx'), c.get('app').auth, input.ticket, input.code, input.remember ?? true, { userAgent: c.req.header('user-agent') });
  return c.json(session);
});

authRoutes.post('/refresh', async (c) => {
  const { refreshToken } = await parse(z.object({ refreshToken: z.string().min(10) }), await body(c));
  return c.json(await auth.refresh(c.get('ctx'), c.get('app').auth, refreshToken));
});

authRoutes.post('/logout', async (c) => {
  const sid = c.get('sessionId');
  if (sid) await auth.logout(c.get('ctx'), sid);
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
  return c.json(await auth.loginWithIdentity(c.get('ctx'), provider, { ...identity, name }));
});

authRoutes.post('/verify-email', async (c) => {
  const ctx = c.get('ctx');
  const { code } = await parse(verifyEmailSchema, await body(c));
  return c.json(await auth.verifyEmail(ctx, requireUser(ctx), code));
});

authRoutes.post('/resend-verification', rateLimit({ windowMs: 60_000, max: 3 }), async (c) => {
  const ctx = c.get('ctx');
  await auth.resendVerification(ctx, requireUser(ctx));
  return c.json({ ok: true });
});

authRoutes.post('/forgot-password', rateLimit({ windowMs: 60_000, max: 5 }), async (c) => {
  const { email } = await parse(forgotPasswordSchema, await body(c));
  const r = await auth.forgotPassword(c.get('ctx'), email);
  return c.json({ ok: true, ...(c.get('ctx').env.APP_ENV === 'test' ? r : {}) });
});

authRoutes.post('/reset-password', async (c) => {
  const input = await parse(resetPasswordSchema, await body(c));
  return c.json(await auth.resetPassword(c.get('ctx'), c.get('app').auth, input.token, input.password, input.logoutOthers));
});

function getCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const m = header.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
