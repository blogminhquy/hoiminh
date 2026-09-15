// Tin nhắn thời gian thực (V2): hub đẩy đúng người, tin mới / đã xem / đang gõ / online chạy qua ctx.realtime.
import { and, eq } from 'drizzle-orm';
import { conversationParticipants } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRealtimeHub, type RealtimeEvent } from '../realtime/hub';
import * as messaging from '../services/messaging';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

/** Thu sự kiện của một người dùng cho tới khi test tự đóng. */
function collect(userId: string) {
  const events: RealtimeEvent[] = [];
  const off = app.ctx.realtime.subscribe(userId, (e) => events.push(e));
  return { events, off, of: (type: RealtimeEvent['type']) => events.filter((e) => e.type === type) };
}

describe('hub thời gian thực', () => {
  it('đẩy cho mọi phiên của người nhận, bỏ qua người không đăng ký, và không trùng id', () => {
    const hub = createRealtimeHub(() => {});
    const a1: RealtimeEvent[] = [];
    const a2: RealtimeEvent[] = [];
    const b: RealtimeEvent[] = [];
    const offA1 = hub.subscribe('a', (e) => a1.push(e));
    const offA2 = hub.subscribe('a', (e) => a2.push(e));
    hub.subscribe('b', (e) => b.push(e));
    expect(hub.connectionCount()).toBe(3);

    hub.publish(['a', 'a'], { type: 'badges.changed' });
    expect(a1.filter((e) => e.type === 'badges.changed')).toHaveLength(1);
    expect(a2.filter((e) => e.type === 'badges.changed')).toHaveLength(1);
    expect(b.filter((e) => e.type === 'badges.changed')).toHaveLength(0);

    // Chỉ khi phiên cuối cùng đóng mới coi là offline.
    offA1();
    expect(hub.isOnline('a')).toBe(true);
    offA2();
    expect(hub.isOnline('a')).toBe(false);
    expect(b.filter((e) => e.type === 'presence.changed' && e.userId === 'a' && !e.online)).toHaveLength(1);
    expect(hub.onlineAmong(['a', 'b', 'c'])).toEqual(['b']);
  });

  it('listener ném lỗi không chặn listener còn lại', () => {
    const hub = createRealtimeHub(() => {});
    const got: RealtimeEvent[] = [];
    hub.subscribe('a', () => { throw new Error('hỏng'); });
    hub.subscribe('a', (e) => got.push(e));
    hub.publish(['a'], { type: 'badges.changed' });
    expect(got).toHaveLength(1);
  });

  it('hủy đăng ký hai lần không làm sai số phiên', () => {
    const hub = createRealtimeHub(() => {});
    const off = hub.subscribe('a', () => {});
    hub.subscribe('a', () => {});
    off();
    off();
    expect(hub.connectionCount()).toBe(1);
    expect(hub.isOnline('a')).toBe(true);
  });
});

describe('tin nhắn thời gian thực', () => {
  it('gửi tin → người nhận nhận message.new và badges.changed ngay', async () => {
    const quy = await app.as('minhquy');
    const vu = await app.as('hoangvu');
    const vuId = vu.actor.type === 'user' ? vu.actor.userId : '';
    const inbox = collect(vuId);

    const msg = await messaging.send(quy, { recipientUserId: vuId, body: 'Chào Vũ, xem giúp anh đơn này nhé' });
    off(inbox);

    const news = inbox.of('message.new');
    expect(news).toHaveLength(1);
    const first = news[0]!;
    expect(first.type === 'message.new' && first.message.id).toBe(msg.id);
    expect(first.type === 'message.new' && first.message.body).toContain('Chào Vũ');
    expect(inbox.of('badges.changed').length).toBeGreaterThanOrEqual(1);
  });

  it('người kia đọc → người gửi nhận message.read, số chưa đọc về 0', async () => {
    const quy = await app.as('minhquy');
    const vu = await app.as('hoangvu');
    const quyId = quy.actor.type === 'user' ? quy.actor.userId : '';
    const vuId = vu.actor.type === 'user' ? vu.actor.userId : '';

    const msg = await messaging.send(quy, { recipientUserId: vuId, body: 'Đơn 249k đã về chưa em?' });
    const senderInbox = collect(quyId);
    const r = await messaging.markConversationRead(vu, msg.conversationId);
    off(senderInbox);

    expect(r.markedCount).toBeGreaterThanOrEqual(1);
    const reads = senderInbox.of('message.read');
    expect(reads).toHaveLength(1);
    expect(reads[0]!.type === 'message.read' && reads[0]!.byUserId).toBe(vuId);
    const part = await app.ctx.db.query.conversationParticipants.findFirst({ where: and(eq(conversationParticipants.conversationId, msg.conversationId), eq(conversationParticipants.userId, vuId)) });
    expect(part!.unreadCount).toBe(0);

    // Đọc lần hai không còn tin nào để đánh dấu, nên không phát thêm biên nhận.
    const again = collect(quyId);
    const r2 = await messaging.markConversationRead(vu, msg.conversationId);
    off(again);
    expect(r2.markedCount).toBe(0);
    expect(again.of('message.read')).toHaveLength(0);
  });

  it('đang gõ chỉ đến người kia, kèm hạn hiệu lực', async () => {
    const quy = await app.as('minhquy');
    const vu = await app.as('hoangvu');
    const quyId = quy.actor.type === 'user' ? quy.actor.userId : '';
    const vuId = vu.actor.type === 'user' ? vu.actor.userId : '';
    const msg = await messaging.send(quy, { recipientUserId: vuId, body: 'Alo' });

    const theirs = collect(vuId);
    const mine = collect(quyId);
    const t = await messaging.setTyping(quy, msg.conversationId);
    off(theirs);
    off(mine);

    expect(theirs.of('conversation.typing')).toHaveLength(1);
    expect(mine.of('conversation.typing')).toHaveLength(0);
    expect(t.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('người ngoài hội thoại không gõ và không đọc được', async () => {
    const quy = await app.as('minhquy');
    const vu = await app.as('hoangvu');
    const cong = await app.as('cong');
    const vuId = vu.actor.type === 'user' ? vu.actor.userId : '';
    const msg = await messaging.send(quy, { recipientUserId: vuId, body: 'Riêng tư' });
    await expect(messaging.setTyping(cong, msg.conversationId)).rejects.toThrow();
    await expect(messaging.markConversationRead(cong, msg.conversationId)).rejects.toThrow();
  });

  it('danh sách hội thoại và luồng tin gắn cờ online theo phiên đang mở', async () => {
    const quy = await app.as('minhquy');
    const vu = await app.as('hoangvu');
    const vuId = vu.actor.type === 'user' ? vu.actor.userId : '';
    const msg = await messaging.send(quy, { recipientUserId: vuId, body: 'Kiểm tra chấm xanh' });

    const offline = await messaging.listMessages(quy, msg.conversationId, {});
    expect(offline.other?.online).toBe(false);

    const session = collect(vuId);
    const online = await messaging.listMessages(quy, msg.conversationId, {});
    const convos = await messaging.listConversations(quy, {});
    off(session);

    expect(online.other?.online).toBe(true);
    expect(convos.items.find((c) => c.other.id === vuId)?.other.online).toBe(true);
  });
});

function off(c: { off: () => void }) {
  c.off();
}
