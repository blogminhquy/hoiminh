// Web Push tự viết (packages/core/src/lib/web-push.ts) phải khớp chuẩn, nếu không trình duyệt lặng lẽ bỏ thông báo.
// Bài này lấy một thư viện độc lập (http_ece, phía "trình duyệt") giải mã nội dung do mã của mình mã hóa, và kiểm chữ ký
// VAPID bằng khóa công khai.
import crypto from 'node:crypto';
import ece from 'http_ece';
import { decodeProtectedHeader, importJWK, jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';
import { b64urlDecode, b64urlEncode, buildPushRequest, encryptPushPayload, generateVapidKeys, vapidAuthorization, vapidConfigured } from '../lib/web-push';

/** Một "trình duyệt" giả: cặp khóa ECDH P-256 và bí mật xác thực 16 byte, như PushSubscription.getKey trả về. */
function browser() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh, authB64: b64urlEncode(auth), target: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', p256dh: b64urlEncode(ecdh.getPublicKey()), auth: b64urlEncode(auth) } };
}
const decrypt = (b: ReturnType<typeof browser>, body: Uint8Array) => ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: b.ecdh, authSecret: b.authB64 }).toString('utf8');

describe('mã hóa nội dung thông báo đẩy (RFC 8291, aes128gcm)', () => {
  it('thư viện độc lập phía trình duyệt giải mã ra đúng nội dung, kể cả tiếng Việt có dấu', async () => {
    const b = browser();
    const text = JSON.stringify({ title: 'Hội Mình: có người trả lời bình luận của bạn', body: 'Điền Phạm vừa trả lời: "Cảm ơn bạn nhé"', link: '/minhquy/bai-viet/1' });
    const body = await encryptPushPayload(b.target, new TextEncoder().encode(text));
    expect(decrypt(b, body)).toBe(text);
    // Phần đầu: 16 byte salt, 4 byte kích thước bản ghi (4096), 1 byte độ dài khóa (65), rồi khóa công khai của bên gửi.
    expect([...body.slice(16, 21)]).toEqual([0, 0, 0x10, 0, 65]);
    expect(body[21]).toBe(4);
  });

  it('mỗi lần mã hóa dùng salt và khóa tạm mới, nên hai bản mã của cùng một nội dung khác nhau', async () => {
    const b = browser();
    const payload = new TextEncoder().encode('cùng một nội dung');
    const [x, y] = await Promise.all([encryptPushPayload(b.target, payload), encryptPushPayload(b.target, payload)]);
    expect(Buffer.from(x).equals(Buffer.from(y))).toBe(false);
    expect(decrypt(b, x)).toBe('cùng một nội dung');
    expect(decrypt(b, y)).toBe('cùng một nội dung');
  });

  it('trình duyệt khác (khóa khác) không giải mã được', async () => {
    const a = browser();
    const other = browser();
    const body = await encryptPushPayload(a.target, new TextEncoder().encode('bí mật'));
    expect(() => decrypt({ ...other, authB64: a.authB64 }, body)).toThrow();
  });

  it('đăng ký hỏng (khóa sai độ dài) thì báo lỗi rõ thay vì gửi rác', async () => {
    await expect(encryptPushPayload({ p256dh: b64urlEncode(new Uint8Array(10)), auth: b64urlEncode(new Uint8Array(16)) }, new Uint8Array([1]))).rejects.toThrow(/không hợp lệ/);
  });
});

describe('VAPID (RFC 8292)', () => {
  it('tạo khóa đúng dạng; JWT ký ES256, aud là gốc của dịch vụ đẩy, kiểm được bằng khóa công khai', async () => {
    const keys = await generateVapidKeys();
    expect(b64urlDecode(keys.publicKey)).toHaveLength(65);
    expect(b64urlDecode(keys.privateKey)).toHaveLength(32);
    const vapid = { ...keys, subject: 'mailto:hotro@hoiminh.vn' };
    expect(vapidConfigured(vapid)).toBe(true);
    expect(vapidConfigured({ publicKey: '', privateKey: '' })).toBe(false);
    expect(vapidConfigured({ publicKey: 'khong-phai-khoa', privateKey: 'x' })).toBe(false);

    const header = await vapidAuthorization('https://web.push.apple.com/QGk3abc', vapid, new Date('2026-11-11T00:00:00Z'));
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(m[2]).toBe(keys.publicKey);
    expect(decodeProtectedHeader(m[1]!)).toMatchObject({ alg: 'ES256', typ: 'JWT' });
    const pub = b64urlDecode(keys.publicKey);
    const key = await importJWK({ kty: 'EC', crv: 'P-256', x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)) }, 'ES256');
    const { payload } = await jwtVerify(m[1]!, key, { currentDate: new Date('2026-11-11T01:00:00Z') });
    expect(payload).toMatchObject({ aud: 'https://web.push.apple.com', sub: 'mailto:hotro@hoiminh.vn' });
    expect(payload.exp! - payload.iat!).toBe(12 * 3600);
  });

  it('yêu cầu gửi có đủ header chuẩn và thân là nội dung đã mã hóa', async () => {
    const b = browser();
    const vapid = { ...(await generateVapidKeys()), subject: 'mailto:hotro@hoiminh.vn' };
    const req = await buildPushRequest(b.target, { title: 'Sắp tới giờ sự kiện', link: '/minhquy/su-kien/1' }, vapid, { ttlSeconds: 3600, urgency: 'high', topic: 'su-kien-1' });
    expect(req.endpoint).toBe(b.target.endpoint);
    expect(req.headers).toMatchObject({ 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '3600', Urgency: 'high', Topic: 'su-kien-1' });
    expect(req.headers.Authorization).toMatch(/^vapid t=.+, k=.+$/);
    expect(JSON.parse(decrypt(b, req.body))).toEqual({ title: 'Sắp tới giờ sự kiện', link: '/minhquy/su-kien/1' });
  });
});
