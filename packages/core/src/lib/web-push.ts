// Web Push tự viết bằng WebCrypto (chạy được trên Cloudflare Workers, không cần thư viện Node):
// - Mã hóa nội dung theo RFC 8291 (aes128gcm): chỉ trình duyệt của người nhận giải mã được, dịch vụ đẩy không đọc được.
// - Xác thực máy chủ gửi theo RFC 8292 (VAPID): một JWT ký ES256 bằng khóa riêng của Hội Mình.
import { base64Decode, base64Encode } from '@hoiminh/config';
import { SignJWT, importJWK } from 'jose';

export interface PushTarget { endpoint: string; p256dh: string; auth: string }
export interface VapidKeys { publicKey: string; privateKey: string; subject: string }
export interface PushRequest { endpoint: string; headers: Record<string, string>; body: Uint8Array }

const enc = new TextEncoder();
/** TypeScript mới phân biệt mảng byte trên ArrayBuffer và SharedArrayBuffer; WebCrypto nhận cả hai, nên ép kiểu ở một chỗ. */
const buf = (u: Uint8Array) => u as unknown as BufferSource;

export function b64urlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlDecode(text: string): Uint8Array {
  const s = text.replace(/-/g, '+').replace(/_/g, '/');
  return base64Decode(s + '='.repeat((4 - (s.length % 4)) % 4));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** HKDF-SHA256 (trích rồi mở rộng) ra `length` byte. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) }, key, length * 8));
}

/** Khóa VAPID hợp lệ: khóa công khai là điểm P-256 không nén (65 byte), khóa riêng 32 byte, đều ở dạng base64url. */
export function vapidConfigured(v: Partial<VapidKeys> | null | undefined): v is VapidKeys {
  if (!v?.publicKey || !v.privateKey) return false;
  try {
    return b64urlDecode(v.publicKey).length === 65 && b64urlDecode(v.privateKey).length === 32;
  } catch {
    return false;
  }
}

/** JWT VAPID cho một dịch vụ đẩy (aud là gốc của endpoint), hạn 12 giờ. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now = new Date()): Promise<string> {
  const pub = b64urlDecode(vapid.publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), d: vapid.privateKey };
  const key = await importJWK(jwk, 'ES256');
  const iat = Math.floor(now.getTime() / 1000);
  const jwt = await new SignJWT({ aud: new URL(endpoint).origin, sub: vapid.subject || 'mailto:hotro@hoiminh.vn' })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setIssuedAt(iat)
    .setExpirationTime(iat + 12 * 3600)
    .sign(key);
  return `vapid t=${jwt}, k=${vapid.publicKey}`;
}

/** Mã hóa nội dung cho một thiết bị (RFC 8291). `salt` và `localKeys` chỉ truyền vào trong test để kết quả lặp lại được. */
export async function encryptPushPayload(target: Pick<PushTarget, 'p256dh' | 'auth'>, payload: Uint8Array, opts: { salt?: Uint8Array; localKeys?: CryptoKeyPair } = {}): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(target.p256dh);
  const authSecret = b64urlDecode(target.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error('Đăng ký thông báo đẩy không hợp lệ');
  const local = opts.localKeys ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']));
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', buf(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['encrypt']);
  // 0x02 đánh dấu đây là bản ghi cuối (và duy nhất); không độn thêm.
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce), tagLength: 128 }, key, buf(concat(payload, new Uint8Array([2])))));
  const recordSize = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/** Dựng yêu cầu HTTP gửi một thông báo đẩy tới một thiết bị. Người gọi tự `fetch` để test thay được. */
export async function buildPushRequest(target: PushTarget, data: unknown, vapid: VapidKeys, opts: { ttlSeconds?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string; now?: Date } = {}): Promise<PushRequest> {
  const body = await encryptPushPayload(target, enc.encode(JSON.stringify(data)));
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(target.endpoint, vapid, opts.now),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(opts.ttlSeconds ?? 86_400),
    Urgency: opts.urgency ?? 'normal',
  };
  if (opts.topic) headers.Topic = opts.topic;
  return { endpoint: target.endpoint, headers, body };
}

/** Tạo một cặp khóa VAPID mới (dùng một lần khi cài đặt, xem scripts/generate-vapid.mjs). */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: b64urlEncode(pub), privateKey: jwk.d! };
}
