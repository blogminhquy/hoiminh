// TOTP theo RFC 6238 (HMAC-SHA1, 30 giây, 6 số) — chuẩn mà Google Authenticator,
// Microsoft Authenticator, 1Password và Authy đều dùng. Chỉ dùng Web Crypto nên chạy
// được cả trên Node lẫn Cloudflare Workers.
import { randomCode, timingSafeEqual } from './crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_PERIOD = 30;
export const TOTP_DIGITS = 6;

/** Base32 (RFC 4648, không padding) — định dạng mà app xác thực đọc được. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Bí mật mới: 20 byte ngẫu nhiên, đúng độ dài khuyến nghị của RFC 4226. */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/** Chuỗi otpauth:// để app xác thực quét mã QR hoặc nhập tay. */
export function totpUri(secret: string, account: string, issuer = 'Hội Mình'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const q = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD) });
  return `otpauth://totp/${label}?${q.toString()}`;
}

/** Mã 6 số tại một bước thời gian (counter = floor(epochSeconds / 30)). */
export async function totpCodeAt(secret: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret) as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new Uint8Array(8);
  // Counter là số nguyên 64-bit big-endian; JS an toàn tới 2^53 nên ghi 8 byte bằng BigInt.
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    msg[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg as BufferSource));
  const offset = sig[sig.length - 1]! & 0x0f;
  const bin = ((sig[offset]! & 0x7f) << 24) | ((sig[offset + 1]! & 0xff) << 16) | ((sig[offset + 2]! & 0xff) << 8) | (sig[offset + 3]! & 0xff);
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export interface TotpVerifyResult {
  ok: boolean;
  /** Bước thời gian đã khớp — lưu lại để cùng một mã không dùng được hai lần. */
  step: number;
}

/**
 * Kiểm tra mã. `window = 1` chấp nhận lệch một bước (±30 giây) cho đồng hồ máy khách lệch.
 * `minStep` chặn dùng lại mã vừa dùng.
 */
export async function verifyTotp(secret: string, code: string, opts: { at?: Date; window?: number; minStep?: number } = {}): Promise<TotpVerifyResult> {
  const digits = code.replace(/\D/g, '');
  if (digits.length !== TOTP_DIGITS) return { ok: false, step: 0 };
  const now = Math.floor((opts.at?.getTime() ?? Date.now()) / 1000 / TOTP_PERIOD);
  const window = opts.window ?? 1;
  for (let d = -window; d <= window; d++) {
    const step = now + d;
    if (opts.minStep !== undefined && step <= opts.minStep) continue;
    if (timingSafeEqual(await totpCodeAt(secret, step), digits)) return { ok: true, step };
  }
  return { ok: false, step: 0 };
}

/** Mã dự phòng: 10 mã, mỗi mã 10 ký tự chia hai nhóm cho dễ đọc. */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => `${randomCode(5)}-${randomCode(5)}`);
}

/** Chuẩn hóa mã dự phòng trước khi băm hoặc so sánh (bỏ gạch, khoảng trắng, viết hoa). */
export function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
