#!/usr/bin/env node
// Tạo một cặp khóa VAPID cho thông báo đẩy (Web Push). Chạy một lần duy nhất cho mỗi môi trường:
//   node scripts/generate-vapid.mjs
// Rồi đặt hai giá trị in ra làm secret của Worker API:
//   pnpm --filter @hoiminh/api exec wrangler secret put VAPID_PUBLIC_KEY
//   pnpm --filter @hoiminh/api exec wrangler secret put VAPID_PRIVATE_KEY
// Đừng tạo lại khi đã có người bật thông báo: đổi khóa thì mọi thiết bị đã đăng ký phải bật lại.
// Khóa riêng không được đưa vào mã nguồn hay chat.
import { webcrypto as crypto } from 'node:crypto';

const b64url = (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publicKey = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
const { d: privateKey } = await crypto.subtle.exportKey('jwk', pair.privateKey);

console.log('VAPID_PUBLIC_KEY=' + publicKey);
console.log('VAPID_PRIVATE_KEY=' + privateKey);
