// Primitive mã hóa dùng chung (WebCrypto, chạy được trên Node và Cloudflare Workers):
// băm mật khẩu PBKDF2, mã hóa AES-GCM cho dữ liệu nhạy cảm, SHA-256, HMAC, id ổn định.

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 dạng hex. */
export async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(input)));
}

/** HMAC (SHA-256 hoặc SHA-512) dạng hex. */
export async function hmacHex(secret: string, message: string, algo: 'SHA-256' | 'SHA-512' = 'SHA-256'): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: algo }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** So sánh chuỗi thời gian hằng, tránh timing attack. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Chuỗi ngẫu nhiên an toàn, bảng chữ không gây nhầm (không có 0/O/1/I). */
export function randomCode(length: number, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** Token ngẫu nhiên dạng hex (32 byte mặc định). */
export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Băm mật khẩu bằng PBKDF2-SHA256, 100k vòng. Kết quả: pbkdf2$<iter>$<salt>$<hash>. */
export async function hashPassword(password: string, iterations = 100_000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(new Uint8Array(hash))}`;
}

/** Kiểm tra mật khẩu với chuỗi băm. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, iterStr, saltB64, hashB64] = stored.split('$');
  if (algo !== 'pbkdf2' || !iterStr || !saltB64 || !hashB64) return false;
  const hash = await pbkdf2(password, fromB64(saltB64), Number(iterStr));
  return timingSafeEqual(toB64(new Uint8Array(hash)), hashB64);
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

async function aesKey(keyB64: string): Promise<CryptoKey> {
  const raw = keyB64 ? fromB64(keyB64) : new Uint8Array(32);
  if (raw.length !== 32) throw new Error('ENCRYPTION_KEY phải là 32 byte base64');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Mã hóa JSON bằng AES-256-GCM. Kết quả: v<version>.<iv>.<ciphertext> (base64). */
export async function encryptJson(value: unknown, keyB64: string, version = 1): Promise<string> {
  const key = await aesKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return `v${version}.${toB64(iv)}.${toB64(new Uint8Array(ct))}`;
}

/** Giải mã chuỗi do encryptJson tạo. */
export async function decryptJson<T = unknown>(payload: string, keyB64: string): Promise<T> {
  const [, ivB64, ctB64] = payload.split('.');
  if (!ivB64 || !ctB64) throw new Error('Payload mã hóa không hợp lệ');
  const key = await aesKey(keyB64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, fromB64(ctB64));
  return JSON.parse(dec.decode(pt)) as T;
}

/** Che số tài khoản: "Vietcombank ••••4521". */
export function maskAccount(bankName: string, accountNumber: string): string {
  return `${bankName} ••••${accountNumber.slice(-4)}`;
}

/** Id uuid ổn định từ một chuỗi (dùng cho seed và test). */
export async function stableId(seed: string): Promise<string> {
  const h = await sha256Hex(`hoiminh:${seed}`);
  const hex = h.slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16] ?? '0', 16) % 4] ?? '8';
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

export { toB64 as base64Encode, fromB64 as base64Decode, toHex as hexEncode };
