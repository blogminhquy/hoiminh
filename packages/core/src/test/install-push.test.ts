// Cài ra màn hình chính và thông báo đẩy (kế hoạch 11/11/2026, mục 7), phần máy chủ:
// link đăng nhập một lần (chuyển từ trình duyệt trong Zalo, Facebook sang Safari hoặc Chrome) và gửi thông báo đẩy.
import crypto from 'node:crypto';
import ece from 'http_ece';
import { loginLinks as loginLinksTable, notificationPrefs, pushSubscriptions } from '@hoiminh/db';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authenticate } from '../auth/service';
import type { Ctx } from '../context';
import type { EnqueueOptions, JobMap, JobName, JobQueue } from '../jobs/queue';
import { b64urlEncode, generateVapidKeys } from '../lib/web-push';
import * as flags from '../services/feature-flags';
import * as loginLinks from '../services/login-links';
import { notify } from '../services/notifications';
import * as push from '../services/push';
import { createTestApp, type TestApp } from './setup';

class SpyQueue implements JobQueue {
  sent: Array<{ name: string; payload: unknown }> = [];
  async enqueue<K extends JobName>(name: K, payload: JobMap[K], _opts?: EnqueueOptions): Promise<void> {
    this.sent.push({ name, payload });
  }
}

let app: TestApp;
let DUY = '';
beforeAll(async () => {
  app = await createTestApp();
  DUY = await app.ids('user:duy');
}, 180_000);
afterAll(async () => {
  await app.close();
});

describe('link đăng nhập một lần', () => {
  const tokenOf = (url: string) => new URL(url).searchParams.get('token')!;

  it('chỉ người đang đăng nhập tạo được, cho chính mình; link trỏ tới /vao và hết hạn sau 10 phút', async () => {
    await expect(loginLinks.createLoginLink(app.anon())).rejects.toThrow();
    const r = await loginLinks.createLoginLink(await app.as('duy'));
    expect(r.url).toMatch(/\/vao\?token=[a-f0-9]{48}$/);
    expect(Math.round((r.expiresAt.getTime() - Date.now()) / 60_000)).toBe(10);
    // Máy chủ chỉ giữ bản băm của mã.
    const rows = await app.ctx.db.select().from(loginLinksTable).where(eq(loginLinksTable.userId, DUY));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).not.toContain(tokenOf(r.url));
  });

  it('người chưa đăng nhập mở link thì vào đúng tài khoản; dùng lại lần hai thì không được', async () => {
    const { url } = await loginLinks.createLoginLink(await app.as('duy'));
    const session = await loginLinks.consumeLoginLink(app.anon(), app.auth, tokenOf(url), { userAgent: 'Safari' });
    expect(session.user.email).toBe('duynguyen@gmail.com');
    expect((await authenticate(app.anon(), app.auth, session.accessToken))?.userId).toBe(DUY);
    expect(session.refreshToken).toBeTruthy();
    await expect(loginLinks.consumeLoginLink(app.anon(), app.auth, tokenOf(url))).rejects.toThrow(/không đúng hoặc đã hết hạn/);
  });

  it('link hết hạn, link bịa, mã sai định dạng đều báo cùng một lỗi', async () => {
    const { url } = await loginLinks.createLoginLink(await app.as('cong'));
    await app.ctx.db.execute(sql`update login_links set expires_at = now() - interval '1 minute' where user_id = ${await app.ids('user:cong')}`);
    for (const token of [tokenOf(url), 'a'.repeat(48), 'khong-phai-ma', '']) {
      await expect(loginLinks.consumeLoginLink(app.anon(), app.auth, token)).rejects.toThrow(/không đúng hoặc đã hết hạn/);
    }
  });

  it('mỗi người chỉ giữ ba link còn hiệu lực: tạo link thứ tư thì link cũ nhất bị hủy', async () => {
    const ctx = await app.as('hongkim');
    const first = tokenOf((await loginLinks.createLoginLink(ctx)).url);
    for (let i = 0; i < 3; i++) await loginLinks.createLoginLink(ctx);
    await expect(loginLinks.consumeLoginLink(app.anon(), app.auth, first)).rejects.toThrow();
    const rows = await app.ctx.db.select().from(loginLinksTable).where(eq(loginLinksTable.userId, await app.ids('user:hongkim')));
    expect(rows).toHaveLength(3);
  });
});

describe('công tắc bắt cài ra màn hình chính', () => {
  it('mặc định tắt; chỉ quản trị hệ thống bật tắt được', async () => {
    expect(await flags.isEnabled(app.system(), flags.FLAG.installGate)).toBe(false);
    await expect(flags.setFlag(await app.as('minhquy'), flags.FLAG.installGate, { enabled: true })).rejects.toThrow();
    await flags.setFlag(await app.as('admin'), flags.FLAG.installGate, { enabled: true });
    expect(await flags.isEnabled(app.system(), flags.FLAG.installGate)).toBe(true);
    await flags.setFlag(await app.as('admin'), flags.FLAG.installGate, { enabled: false });
  });
});

describe('thông báo đẩy', () => {
  /** Một thiết bị giả: cặp khóa của trình duyệt và endpoint của dịch vụ đẩy. */
  function device(name: string) {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const auth = b64urlEncode(crypto.randomBytes(16));
    return { ecdh, auth, sub: { endpoint: `https://fcm.googleapis.com/fcm/send/${name}`, keys: { p256dh: b64urlEncode(ecdh.getPublicKey()), auth } } };
  }
  const withVapid = async (base: Ctx, queue?: JobQueue): Promise<Ctx> => {
    const keys = await generateVapidKeys();
    return { ...base, env: { ...base.env, VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey }, ...(queue ? { queue } : {}) };
  };

  it('máy chủ chưa có khóa VAPID: thông báo đẩy tắt hẳn, tạo thông báo trong ứng dụng vẫn bình thường', async () => {
    const duy = await app.as('duy');
    expect(push.pushConfig(duy)).toEqual({ enabled: false, publicKey: null });
    await expect(push.subscribePush(duy, device('x').sub)).rejects.toThrow(/chưa bật thông báo đẩy/);
    const spy = new SpyQueue();
    await notify({ ...app.system(), queue: spy }, { userId: DUY, kind: 'test', title: 'Không có khóa' });
    expect(spy.sent).toHaveLength(0);
  });

  it('đăng ký thiết bị: chỉ nhận endpoint https của dịch vụ đẩy, không nhận địa chỉ nội bộ', async () => {
    const duy = await withVapid(await app.as('duy'));
    expect(push.pushConfig(duy).enabled).toBe(true);
    for (const endpoint of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://10.0.0.5/x', 'https://[::1]/x', 'khong-phai-url']) {
      await expect(push.subscribePush(duy, { ...device('bad').sub, endpoint })).rejects.toThrow(/không hợp lệ/);
    }
    await push.subscribePush(duy, device('dien-thoai-duy').sub, 'Mozilla/5.0 (iPhone)');
    expect(await push.pushDeviceCount(duy)).toBe(1);
    // Đăng ký lại cùng thiết bị không sinh dòng thứ hai.
    await push.subscribePush(duy, device('dien-thoai-duy').sub);
    expect(await push.pushDeviceCount(duy)).toBe(1);
  });

  it('có thông báo trong ứng dụng thì xếp job đẩy; người đã tắt "đẩy trên điện thoại" hoặc chưa có thiết bị thì không', async () => {
    const spy = new SpyQueue();
    const sys = await withVapid(app.system(), spy);
    await notify(sys, { userId: DUY, kind: 'comment', category: 'comment', title: 'Điền Phạm đã trả lời bình luận của bạn', body: 'Cảm ơn bạn', link: '/minhquy/bai-viet/1' });
    expect(spy.sent).toEqual([{ name: 'push.send', payload: { userId: DUY, title: 'Điền Phạm đã trả lời bình luận của bạn', body: 'Cảm ơn bạn', link: '/minhquy/bai-viet/1', tag: 'comment' } }]);
    // Người chưa đăng ký thiết bị nào.
    await notify(sys, { userId: await app.ids('user:cong'), kind: 'comment', title: 'x' });
    expect(spy.sent).toHaveLength(1);
    // Tắt "đẩy trên điện thoại" trong cài đặt thông báo.
    await app.ctx.db.insert(notificationPrefs).values({ userId: DUY, push: false }).onConflictDoUpdate({ target: notificationPrefs.userId, set: { push: false } });
    await notify(sys, { userId: DUY, kind: 'comment', title: 'y' });
    expect(spy.sent).toHaveLength(1);
    await app.ctx.db.update(notificationPrefs).set({ push: true }).where(eq(notificationPrefs.userId, DUY));
  });

  it('gửi tới từng thiết bị: nội dung mã hóa riêng cho thiết bị đó; dịch vụ đẩy báo 410 thì gỡ đăng ký', async () => {
    const kien = await withVapid(await app.as('kienbui'));
    const KIEN = await app.ids('user:kienbui');
    const live = device('may-con-song');
    const dead = device('may-da-go');
    await push.subscribePush(kien, live.sub);
    await push.subscribePush(kien, dead.sub);
    const calls: Array<{ url: string; headers: Record<string, string>; body: Uint8Array }> = [];
    const fakeFetch = (async (url: string, init: { headers: Record<string, string>; body: Uint8Array }) => {
      calls.push({ url, headers: init.headers, body: init.body });
      return new Response(null, { status: url.endsWith('may-da-go') ? 410 : 201 });
    }) as unknown as typeof fetch;
    const r = await push.sendPushToUser(kien, KIEN, { title: 'Sắp tới giờ sự kiện', body: 'Còn 15 phút', link: '/minhquy/su-kien/1', tag: 'event.reminder' }, fakeFetch);
    expect(r).toEqual({ sent: 1, removed: 1, failed: 0 });
    expect(calls).toHaveLength(2);
    const ok = calls.find((c) => c.url.endsWith('may-con-song'))!;
    expect(ok.headers).toMatchObject({ 'Content-Encoding': 'aes128gcm', TTL: '86400', Topic: 'eventreminder' });
    expect(ok.headers.Authorization).toMatch(/^vapid t=/);
    const text = ece.decrypt(Buffer.from(ok.body), { version: 'aes128gcm', privateKey: live.ecdh, authSecret: live.auth }).toString('utf8');
    expect(JSON.parse(text)).toEqual({ title: 'Sắp tới giờ sự kiện', body: 'Còn 15 phút', link: '/minhquy/su-kien/1', tag: 'event.reminder' });
    const left = await app.ctx.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, KIEN));
    expect(left.map((d) => d.endpoint)).toEqual([live.sub.endpoint]);
    expect(left[0]!.lastSuccessAt).toBeTruthy();
  });

  it('dịch vụ đẩy lỗi tạm thời thì đếm lỗi, chưa gỡ; tắt thông báo trên một thiết bị thì gỡ đúng thiết bị đó', async () => {
    const lan = await withVapid(await app.as('thulan'));
    const LAN = await app.ids('user:thulan');
    const d = device('may-lan');
    await push.subscribePush(lan, d.sub);
    const down = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    expect(await push.sendPushToUser(lan, LAN, { title: 't', body: '', link: null, tag: 'x' }, down)).toEqual({ sent: 0, removed: 0, failed: 1 });
    expect((await app.ctx.db.query.pushSubscriptions.findFirst({ where: eq(pushSubscriptions.userId, LAN) }))?.failureCount).toBe(1);
    await push.unsubscribePush(lan, d.sub.endpoint);
    expect(await push.pushDeviceCount(lan)).toBe(0);
  });
});
