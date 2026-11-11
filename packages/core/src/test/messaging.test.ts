// Tin nhắn kiểu Zalo: trả lời trích dẫn, thả cảm xúc, thu hồi, ghim hội thoại, tin chỉ có ảnh, "Bạn: ..." ở dòng xem trước.
import { sendMessageSchema } from '@hoiminh/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import * as filesSvc from '../services/files';
import * as messaging from '../services/messaging';
import * as safety from '../services/safety';
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

/** Tải một tệp lên cho tin nhắn (xin URL, coi như đã PUT xong, xác nhận). */
async function uploadFor(ctx: Ctx, name: string, mimeType: string, sizeBytes: number, purpose: 'message_file' | 'digital_product' = 'message_file'): Promise<string> {
  const up = await filesSvc.requestUpload(ctx, { fileName: name, mimeType, sizeBytes, purpose });
  await filesSvc.completeUpload(ctx, up.fileId, {});
  return up.fileId;
}

describe('tin nhắn: tệp đính kèm, đã nhận, lưu trữ, chặn, báo cáo', () => {
  it('tệp đính kèm tối đa 5MB, chỉ tài liệu; chỉ gắn được tệp của chính mình tải cho tin nhắn', async () => {
    await expect(filesSvc.requestUpload(duy, { fileName: 'to.pdf', mimeType: 'application/pdf', sizeBytes: 5 * 1024 * 1024 + 1, purpose: 'message_file' })).rejects.toThrow(/tối đa 5MB/);
    await expect(filesSvc.requestUpload(duy, { fileName: 'anh.png', mimeType: 'image/png', sizeBytes: 1000, purpose: 'message_file' })).rejects.toThrow(/nút ảnh/);
    const fileId = await uploadFor(duy, 'Bảng giá 2026.pdf', 'application/pdf', 5 * 1024 * 1024);
    const sent = await messaging.send(duy, { conversationId: convoId, body: '', fileId });
    const view = (await thread(cong)).items.find((m) => m.id === sent.id)!;
    expect(view.file).toEqual({ name: 'Bảng giá 2026.pdf', sizeBytes: 5 * 1024 * 1024 });
    expect((await row(cong)).preview).toBe('[Tệp] Bảng giá 2026.pdf');
    // Tệp của người khác, hoặc tệp riêng tải cho mục khác (tệp số đã bán), không gắn vào tin nhắn được.
    await expect(messaging.send(cong, { conversationId: convoId, body: 'x', fileId })).rejects.toThrow(/Không tìm thấy tệp/);
    const product = await uploadFor(cong, 'ebook.pdf', 'application/pdf', 1000, 'digital_product');
    await expect(messaging.send(cong, { conversationId: convoId, body: 'x', fileId: product })).rejects.toThrow(/Không tìm thấy tệp/);
    // Link tải: chỉ hai người trong hội thoại, tải về với tên gốc.
    const link = await messaging.messageFileUrl(cong, sent.id);
    expect(link.name).toBe('Bảng giá 2026.pdf');
    expect(link.url).toContain('private/message_file/');
    expect(decodeURIComponent(link.url)).toContain('Bảng giá 2026.pdf');
    await expect(messaging.messageFileUrl(lan, sent.id)).rejects.toThrow();
    // Thu hồi: tệp biến khỏi tin, khỏi kho, và không còn lấy được link.
    await messaging.recallMessage(duy, sent.id);
    expect((await thread(cong)).items.find((m) => m.id === sent.id)!.file).toBeNull();
    await expect(messaging.messageFileUrl(cong, sent.id)).rejects.toThrow(/không có tệp/);
    expect(await app.ctx.db.query.files.findFirst({ where: (f, { eq }) => eq(f.id, fileId) })).toBeUndefined();
  });

  it('ba trạng thái: đã gửi, đã nhận (ứng dụng người nhận vừa hỏi), đã xem (mở hội thoại)', async () => {
    const sent = await messaging.send(duy, { conversationId: convoId, body: 'Ba trạng thái' });
    const mine = async () => (await thread(duy)).items.find((m) => m.id === sent.id)!;
    expect(await mine()).toMatchObject({ deliveredAt: null, readAt: null });
    await messaging.markDelivered(lan);
    expect((await mine()).deliveredAt).toBeNull();
    await messaging.markDelivered(cong);
    expect((await mine()).deliveredAt).toBeInstanceOf(Date);
    expect((await mine()).readAt).toBeNull();
    await thread(cong);
    expect((await mine()).readAt).toBeInstanceOf(Date);
  });

  it('hội thoại lưu trữ nằm ở bộ lọc "archived", bỏ lưu trữ thì trở lại; có tin mới cũng tự trở lại', async () => {
    await messaging.archiveConversation(cong, convoId);
    expect((await messaging.listConversations(cong, {})).items.some((c) => c.id === convoId)).toBe(false);
    const archived = await messaging.listConversations(cong, { filter: 'archived' });
    expect(archived.items.find((c) => c.id === convoId)).toMatchObject({ archived: true });
    expect((await thread(cong)).archived).toBe(true);
    await messaging.archiveConversation(cong, convoId, false);
    expect((await messaging.listConversations(cong, {})).items.some((c) => c.id === convoId)).toBe(true);
    expect((await messaging.listConversations(cong, { filter: 'archived' })).items).toHaveLength(0);
    await messaging.archiveConversation(cong, convoId);
    await messaging.send(duy, { conversationId: convoId, body: 'Tin mới sau khi lưu trữ' });
    expect((await messaging.listConversations(cong, {})).items.some((c) => c.id === convoId)).toBe(true);
    await expect(messaging.archiveConversation(lan, convoId)).rejects.toThrow();
  });

  it('chặn: hai bên không nhắn được cho nhau cho tới khi bỏ chặn', async () => {
    const duyId = await app.ids('user:duy');
    const congId = await app.ids('user:cong');
    await safety.blockUser(cong, duyId);
    await expect(messaging.send(duy, { conversationId: convoId, body: 'Còn đó không?' })).rejects.toThrow(/không thể nhắn tin/);
    await expect(messaging.send(cong, { conversationId: convoId, body: 'Mình chặn rồi' })).rejects.toThrow(/không thể nhắn tin/);
    await expect(messaging.send(duy, { recipientUserId: congId, body: 'Thử mở hội thoại mới' })).rejects.toThrow(/không thể nhắn tin/);
    expect((await thread(cong)).blocked).toEqual({ byMe: true, byThem: false });
    expect((await thread(duy)).blocked).toEqual({ byMe: false, byThem: true });
    await expect(safety.blockUser(cong, congId)).rejects.toThrow();
    // Người bị chặn không tự gỡ được; người chặn bỏ chặn thì nhắn lại bình thường.
    await safety.unblockUser(duy, congId);
    await expect(messaging.send(duy, { conversationId: convoId, body: 'x' })).rejects.toThrow(/không thể nhắn tin/);
    await safety.unblockUser(cong, duyId);
    await messaging.send(duy, { conversationId: convoId, body: 'Nhắn lại được rồi' });
    expect((await thread(cong)).blocked).toEqual({ byMe: false, byThem: false });
  });

  it('báo cáo tới quản trị hệ thống: một báo cáo mở cho mỗi cặp, quản trị xem và đánh dấu đã xử lý', async () => {
    const duyId = await app.ids('user:duy');
    const admin = await app.as('admin');
    const first = await safety.reportUser(cong, { userId: duyId, conversationId: convoId, reason: 'spam', detail: 'Gửi quảng cáo liên tục' });
    const again = await safety.reportUser(cong, { userId: duyId, reason: 'scam', detail: 'Đòi chuyển khoản' });
    expect(again.id).toBe(first.id);
    await expect(safety.reportUser(cong, { userId: await app.ids('user:cong'), reason: 'spam' })).rejects.toThrow();
    await expect(safety.listUserReports(cong)).rejects.toThrow();
    const list = await safety.listUserReports(admin, { status: 'open' });
    expect(list.open).toBe(1);
    expect(list.items[0]).toMatchObject({ id: first.id, reason: 'scam', reasonLabel: 'Lừa đảo', detail: 'Đòi chuyển khoản', reporter: { name: 'Công Trần' }, reported: { id: duyId } });
    const notes = await app.ctx.db.query.notifications.findMany({ where: (n, { eq }) => eq(n.kind, 'admin.user_report') });
    expect(notes.length).toBeGreaterThanOrEqual(1);
    await safety.resolveUserReport(admin, first.id);
    expect((await safety.listUserReports(admin, { status: 'open' })).items).toHaveLength(0);
    expect((await safety.reportUser(cong, { userId: duyId, reason: 'other' })).id).not.toBe(first.id);
  });
});
