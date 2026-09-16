// JWT phiên (HS256) và refresh token. Access token ngắn, refresh token băm trong auth_sessions.
import { randomToken, sha256Hex } from '@hoiminh/config';
import { SignJWT, jwtVerify } from 'jose';

export interface SessionClaims {
  sub: string;
  email: string;
  sid: string;
  sa: boolean;
}

const enc = new TextEncoder();

/** Ký access token. */
export async function signAccessToken(secret: string, claims: SessionClaims, ttlSeconds: number): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const token = await new SignJWT({ email: claims.email, sid: claims.sid, sa: claims.sa })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer('hoiminh')
    .setAudience('hoiminh-web')
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(enc.encode(secret));
  return { token, expiresAt };
}

/** Xác minh access token; trả null nếu sai/hết hạn. */
export async function verifyAccessToken(secret: string, token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, enc.encode(secret), { issuer: 'hoiminh', audience: 'hoiminh-web' });
    if (!payload.sub || typeof payload.sid !== 'string') return null;
    return { sub: payload.sub, email: String(payload.email ?? ''), sid: payload.sid, sa: Boolean(payload.sa) };
  } catch {
    return null;
  }
}

/**
 * Vé bước hai của đăng nhập: mật khẩu đã đúng nhưng chưa có phiên. Sống 5 phút,
 * audience riêng nên không dùng thay access token được.
 */
export async function signTwoFactorTicket(secret: string, userId: string, ttlSeconds = 300): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer('hoiminh')
    .setAudience('hoiminh-2fa')
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + ttlSeconds * 1000))
    .sign(enc.encode(secret));
}

/** Đọc vé bước hai; null nếu sai, hết hạn, hoặc là loại token khác. */
export async function verifyTwoFactorTicket(secret: string, token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, enc.encode(secret), { issuer: 'hoiminh', audience: 'hoiminh-2fa' });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** Tạo refresh token thô và bản băm để lưu. */
export async function newRefreshToken(): Promise<{ raw: string; hash: string }> {
  const raw = randomToken(32);
  return { raw, hash: await sha256Hex(raw) };
}

export const hashToken = sha256Hex;
