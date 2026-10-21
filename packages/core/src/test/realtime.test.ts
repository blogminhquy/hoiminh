// Thời gian thực: tin nhắn và thông báo mới được đẩy tới người nhận, chỉ sau khi transaction commit.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenantScope } from '../lib/tenant-scope';
import { DeferredRealtime, durableObjectRealtime, type RealtimeEvent } from '../realtime';
import * as messaging from '../services/messaging';
import { notify } from '../services/notifications';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
const published: Array<{ userId: string; event: RealtimeEvent }> = [];

beforeAll(async () => {
  app = await createTestApp();
  app.ctx.realtime = { publish: async (ids, event) => { for (const userId of ids) published.push({ userId, event }); } };
}, 180_000);
afterAll(async () => {
  await app.close();
});

describe('đẩy sự kiện thời gian thực', () => {
  it('tin nhắn mới tới người nhận và các thiết bị khác của người gửi, sau khi commit', async () => {
    published.length = 0;
    const duy = await app.as('duy');
    const cong = await app.ids('user:cong');
    let seenInside = -1;
    const msg = await withTenantScope(duy, async (scoped) => {
      const m = await messaging.send(scoped, { recipientUserId: cong, body: 'Chào bạn' });
      seenInside = published.length;
      return m;
    });
    expect(seenInside).toBe(0);
    const convoId = (msg as { conversationId: string }).conversationId;
    expect(published).toEqual(expect.arrayContaining([
      { userId: cong, event: { type: 'message', conversationId: convoId } },
      { userId: await app.ids('user:duy'), event: { type: 'message', conversationId: convoId } },
    ]));
  });

  it('nhiều thông báo cho cùng người trong một transaction chỉ báo một lần; hủy thì không báo', async () => {
    published.length = 0;
    const sys = app.system();
    const lan = await app.ids('user:thulan');
    await withTenantScope(sys, async (scoped) => {
      await notify(scoped, { userId: lan, kind: 'test', title: 'Một' });
      await notify(scoped, { userId: lan, kind: 'test', title: 'Hai' });
    });
    expect(published).toEqual([{ userId: lan, event: { type: 'notification' } }]);
    published.length = 0;
    await expect(withTenantScope(sys, async (scoped) => {
      await notify(scoped, { userId: lan, kind: 'test', title: 'Ba' });
      throw new Error('hủy');
    })).rejects.toThrow('hủy');
    expect(published).toHaveLength(0);
  });

  it('lỗi khi đẩy chỉ ghi log, không làm hỏng thao tác', async () => {
    const errors: unknown[] = [];
    const d = new DeferredRealtime({ publish: async () => { throw new Error('hub chết'); } });
    await d.publish(['a'], { type: 'notification' });
    await d.flush((e) => errors.push(e));
    expect(errors).toHaveLength(1);
  });

  it('bộ phát Durable Object gửi tới hub của từng người, mỗi người một lần', async () => {
    const calls: Array<{ name: string; body: string }> = [];
    const ns = { idFromName: (n: string) => n, get: (id: unknown) => ({ fetch: async (_u: string | Request, init?: RequestInit) => { calls.push({ name: String(id), body: String(init?.body) }); return new Response('{}'); } }) };
    await durableObjectRealtime(ns).publish(['u1', 'u2', 'u1'], { type: 'notification' });
    expect(calls.map((c) => c.name).sort()).toEqual(['u1', 'u2']);
    expect(JSON.parse(calls[0]!.body)).toEqual({ type: 'notification' });
  });

  it('gọi ngoài transaction mà hub lỗi thì thông báo vẫn được tạo', async () => {
    const ctx = { ...app.system(), realtime: { publish: async () => { throw new Error('hub chết'); } } };
    await expect(notify(ctx, { userId: await app.ids('user:thulan'), kind: 'test', title: 'Vẫn tạo' })).resolves.toBeUndefined();
  });
});
