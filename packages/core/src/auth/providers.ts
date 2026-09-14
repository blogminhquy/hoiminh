// Nhà cung cấp xác thực: local (mật khẩu băm trong DB) và Supabase Auth (GoTrue REST + JWT).
import { hashPassword, verifyPassword } from '@hoiminh/config';
import { eq } from 'drizzle-orm';
import { userCredentials } from '@hoiminh/db';
import type { Database } from '@hoiminh/db';

export interface AuthIdentity {
  /** Id định danh ở provider (Supabase user id hoặc chính users.id với local). */
  providerUserId: string;
  email: string;
  emailVerified: boolean;
}

export interface AuthProvider {
  readonly kind: 'local' | 'supabase';
  /** Tạo danh tính mới với mật khẩu. */
  signUp(email: string, password: string, meta: { name: string; userId: string }): Promise<AuthIdentity>;
  /** Kiểm tra email + mật khẩu. */
  signIn(email: string, password: string, userId: string | null): Promise<AuthIdentity | null>;
  /** Đổi mật khẩu. */
  setPassword(providerUserId: string, password: string): Promise<void>;
  /** URL bắt đầu đăng nhập Google (null nếu không hỗ trợ). */
  googleAuthUrl(redirectTo: string): string | null;
  /** Bí mật ký JWT phiên (Supabase dùng JWT của Supabase, local dùng AUTH_JWT_SECRET). */
  readonly jwtSecret: string;
}

/** Local: chỉ dùng dev/test hoặc self-host không có Supabase. */
export class LocalAuthProvider implements AuthProvider {
  readonly kind = 'local' as const;
  constructor(private readonly db: Database, readonly jwtSecret: string) {}
  async signUp(email: string, password: string, meta: { name: string; userId: string }): Promise<AuthIdentity> {
    await this.db.insert(userCredentials).values({ userId: meta.userId, passwordHash: await hashPassword(password) }).onConflictDoUpdate({ target: userCredentials.userId, set: { passwordHash: await hashPassword(password) } });
    return { providerUserId: meta.userId, email, emailVerified: false };
  }
  async signIn(email: string, password: string, userId: string | null): Promise<AuthIdentity | null> {
    if (!userId) return null;
    const cred = await this.db.query.userCredentials.findFirst({ where: eq(userCredentials.userId, userId) });
    if (!cred || !(await verifyPassword(password, cred.passwordHash))) return null;
    return { providerUserId: userId, email, emailVerified: true };
  }
  async setPassword(providerUserId: string, password: string): Promise<void> {
    await this.db.update(userCredentials).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(userCredentials.userId, providerUserId));
  }
  googleAuthUrl(): string | null {
    return null;
  }
}

/** Supabase Auth qua GoTrue REST. Phiên của Hội Mình vẫn là JWT do API ký (mục 40), Supabase chỉ giữ mật khẩu và Google. */
export class SupabaseAuthProvider implements AuthProvider {
  readonly kind = 'supabase' as const;
  constructor(private readonly cfg: { url: string; anonKey: string; serviceRoleKey: string; jwtSecret: string }) {}
  get jwtSecret(): string {
    return this.cfg.jwtSecret;
  }
  private async call<T>(path: string, init: RequestInit & { admin?: boolean }): Promise<T> {
    const key = init.admin ? this.cfg.serviceRoleKey : this.cfg.anonKey;
    const res = await fetch(`${this.cfg.url}/auth/v1${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
    const data = (await res.json().catch(() => ({}))) as T & { msg?: string; error_description?: string; message?: string };
    if (!res.ok) throw new Error(data.msg ?? data.error_description ?? data.message ?? `Supabase Auth ${res.status}`);
    return data;
  }
  async signUp(email: string, password: string, meta: { name: string; userId: string }): Promise<AuthIdentity> {
    const data = await this.call<{ id: string; email: string; email_confirmed_at?: string }>('/admin/users', { method: 'POST', admin: true, body: JSON.stringify({ email, password, email_confirm: false, user_metadata: { name: meta.name, hoiminh_user_id: meta.userId } }) });
    return { providerUserId: data.id, email: data.email, emailVerified: Boolean(data.email_confirmed_at) };
  }
  async signIn(email: string, password: string): Promise<AuthIdentity | null> {
    try {
      const data = await this.call<{ user: { id: string; email: string; email_confirmed_at?: string } }>('/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
      return { providerUserId: data.user.id, email: data.user.email, emailVerified: Boolean(data.user.email_confirmed_at) };
    } catch {
      return null;
    }
  }
  async setPassword(providerUserId: string, password: string): Promise<void> {
    await this.call(`/admin/users/${providerUserId}`, { method: 'PUT', admin: true, body: JSON.stringify({ password }) });
  }
  googleAuthUrl(redirectTo: string): string {
    return `${this.cfg.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  }
  /** Lấy thông tin user Supabase từ access token (sau khi Google redirect về). */
  async userFromToken(accessToken: string): Promise<AuthIdentity | null> {
    try {
      const res = await fetch(`${this.cfg.url}/auth/v1/user`, { headers: { apikey: this.cfg.anonKey, Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return null;
      const u = (await res.json()) as { id: string; email: string; email_confirmed_at?: string; user_metadata?: { name?: string; full_name?: string } };
      return { providerUserId: u.id, email: u.email, emailVerified: Boolean(u.email_confirmed_at) };
    } catch {
      return null;
    }
  }
}
