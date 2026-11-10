// Tin nhắn kiểu Zalo: trả lời trích dẫn, thả cảm xúc, thu hồi, ghim hội thoại, tin chỉ có ảnh, "Bạn: ..." ở dòng xem trước.
import { sendMessageSchema } from '@hoiminh/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import * as messaging from '../services/messaging';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let duy: Ctx;
let cong: Ctx;
let lan: Ctx;
let convoId: string;

beforeAll(async () => {
  app = await createTestApp();
  [duy, cong, lan] = await Promise.all([app.as('duy'), app.as('cong'), app.as('thulan')]);
  const first = await messaging.send(duy, { recipientUserId: await app.ids('user:cong'), body: 'Chào Công' });
  convoId = first.conversationId;
}, 180_000);
afterAll(async () => {
  await app.close();
});

const thread = (ctx: Ctx) => messaging.listMessages(ctx, convoId, {});
const row = async (ctx: Ctx) => (await messaging.listConversations(ctx, {})).items.find((c) => c.id === convoId)!;

describe('tin nhắn: trả lời, cảm xúc, thu hồi, ghim', () => {
  it('trả lời trích dẫn mang theo tin gốc; không trích dẫn được tin của hội thoại khác', async () => {
    const origin = (await thread(cong)).items[0]!;
    await messaging.send(cong, { conversationId: convoId, body: 'Chào Duy nhé', replyToId: origin.id });
    const last = (await thread(duy)).items.at(-1)!;
    expect(last.replyTo).toMatchObject({ id: origin.id, body: 'Chào Công', recalled: false });
    const other = await messaging.send(lan, { recipientUserId: await app.ids('user:duy'), body: 'Tin ở hội thoại khác' });
    await expect(messaging.send(cong, { conversationId: convoId, body: 'x', replyToId: other.id })).rejects.toThrow(/không còn trong hội thoại/);
  });

  it('dòng xem trước biết ai gửi tin cuối; tin chỉ có ảnh hiện [Hình ảnh]', async () => {
    expect((await row(cong)).lastFromMe).toBe(true);
    expect((await row(duy)).lastFromMe).toBe(false);
    await messaging.send(duy, { conversationId: convoId, body: '', imageUrl: 'https://example.com/a.png' });
    expect((await row(cong)).preview).toBe('[Hình ảnh]');
    expect(sendMessageSchema.safeParse({ body: '  ' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ body: '', imageFileId: '00000000-0000-4000-8000-000000000000' }).success).toBe(true);
  });

  it('mỗi người một cảm xúc trên một tin, đổi và gỡ được; người ngoài hội thoại bị chặn', async () => {
    const id = (await thread(duy)).items[0]!.id;
    await messaging.reactToMessage(cong, id, '❤️');
    await messaging.reactToMessage(duy, id, '👍');
    await messaging.reactToMessage(cong, id, '😆');
    const reactions = (await thread(duy)).items[0]!.reactions;
    expect(reactions).toEqual({ [await app.ids('user:cong')]: '😆', [await app.ids('user:duy')]: '👍' });
    await messaging.reactToMessage(cong, id, null);
    expect(Object.keys((await thread(duy)).items[0]!.reactions)).toEqual([await app.ids('user:duy')]);
    await expect(messaging.reactToMessage(lan, id, '👍')).rejects.toThrow();
  });

  it('thu hồi: chỉ tin của mình, trong 24 giờ; nội dung biến mất ở cả tin, trích dẫn và dòng xem trước', async () => {
    const mine = await messaging.send(duy, { conversationId: convoId, body: 'Gửi nhầm số tài khoản' });
    await messaging.send(cong, { conversationId: convoId, body: 'Số nào vậy?', replyToId: mine.id });
    await expect(messaging.recallMessage(cong, mine.id)).rejects.toThrow(/của chính mình/);
    await messaging.recallMessage(duy, mine.id);
    const items = (await thread(cong)).items;
    const recalled = items.find((m) => m.id === mine.id)!;
    expect(recalled).toMatchObject({ recalled: true, body: '', imageUrl: null, reactions: {} });
    expect(items.at(-1)!.replyTo).toMatchObject({ id: mine.id, body: '', recalled: true });
    await expect(messaging.reactToMessage(cong, mine.id, '👍')).rejects.toThrow(/thu hồi/);
    // Tin cuối bị thu hồi thì danh sách không còn lộ nội dung.
    const lastOne = await messaging.send(duy, { conversationId: convoId, body: 'Mật khẩu là 1234' });
    await messaging.recallMessage(duy, lastOne.id);
    expect((await row(cong)).preview).toBe('Tin nhắn đã được thu hồi');
    // Quá 24 giờ thì không thu hồi được nữa.
    const old = await messaging.send(duy, { conversationId: convoId, body: 'Tin cũ' });
    const later: Ctx = { ...duy, now: () => new Date(Date.now() + messaging.RECALL_WINDOW_MS + 60_000) };
    await expect(messaging.recallMessage(later, old.id)).rejects.toThrow(/24 giờ/);
  });

  it('ghim đưa hội thoại lên đầu danh sách của riêng người ghim', async () => {
    await messaging.send(lan, { recipientUserId: await app.ids('user:duy'), body: 'Tin mới hơn' });
    expect((await messaging.listConversations(duy, {})).items[0]!.id).not.toBe(convoId);
    await messaging.pinConversation(duy, convoId, true);
    const list = await messaging.listConversations(duy, {});
    expect(list.items[0]).toMatchObject({ id: convoId, pinned: true });
    expect((await thread(duy)).pinned).toBe(true);
    expect((await row(cong)).pinned).toBe(false);
    await messaging.pinConversation(duy, convoId, false);
    expect((await messaging.listConversations(duy, {})).items[0]!.id).not.toBe(convoId);
    await expect(messaging.pinConversation(lan, convoId, true)).rejects.toThrow();
  });

  it('hội thoại dài vẫn trả về các tin mới nhất', async () => {
    const recent = await messaging.listMessages(duy, convoId, { limit: 2 });
    expect(recent.items).toHaveLength(2);
    expect(recent.items.at(-1)!.body).toBe('Tin cũ');
  });
});
