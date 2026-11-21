// Webhook ra ngoài qua Queue: giao ngay sau commit, thất bại thì tự hẹn lần sau bằng delay của Queue (không cần cron phút),
// không giao trùng, hết lượt thì dừng.
import { eq, sql } from 'drizzle-orm';
import { webhookDeliveries, webhooks } from '@hoiminh/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import type { EnqueueOptions, JobMap, JobName, JobQueue } from '../jobs/queue';
import { runSweep } from '../jobs/sweep';
import { withSystemScope } from '../lib/tenant-scope';
import { createWebhook, deliver, dispatch, rotateWebhookSecret, sendTestEvent, updateWebhook, verifySignature } from '../services/webhooks-out';
import { createTestApp, type TestApp } from './setup';

class SpyQueue implements JobQueue {
  sent: Array<{ name: string; payload: unknown; opts?: EnqueueOptions }> = [];
  async enqueue<K extends JobName>(name: K, payload: JobMap[K], opts?: EnqueueOptions): Promise<void> {
    this.sent.push({ name, payload, opts });
  }
}

let app: TestApp;
let workspaceId: string;
beforeAll(async () => {
  app = await createTestApp();
  workspaceId = await app.ids('workspace:minhquy');
}, 180_000);
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await app.ctx.db.delete(webhookDeliveries);
  await app.ctx.db.delete(webhooks);
});

const okFetch = (calls: string[]) => (async (url: string | URL | Request) => {
  calls.push(String(url));
  return new Response('ok', { status: 200 });
}) as typeof fetch;
const badFetch = (calls: string[], status = 500) => (async (url: string | URL | Request) => {
  calls.push(String(url));
  return new Response('loi', { status });
}) as typeof fetch;
const throwingFetch = (calls: string[]) => (async (url: string | URL | Request) => {
  calls.push(String(url));
  throw new Error('ECONNRESET');
}) as typeof fetch;

/** Tạo webhook + một delivery đang chờ giao, dùng hàng đợi ghi lại. */
async function setup(): Promise<{ deliveryId: string; spy: SpyQueue; ctx: Ctx }> {
  const spy = new SpyQueue();
  const ctx: Ctx = { ...app.system(), queue: spy };
  await createWebhook(ctx, workspaceId, { url: 'https://khach.example/hook', events: ['member.joined'] });
  await dispatch(ctx, workspaceId, 'member.joined', { userId: 'u1' });
  const [d] = await app.ctx.db.select().from(webhookDeliveries);
  spy.sent = [];
  return { deliveryId: d!.id, spy, ctx };
}
const makeDue = (id: string) => app.ctx.db.execute(sql`update webhook_deliveries set next_attempt_at = now() - interval '1 minute' where id = ${id}`);
const delivery = (id: string) => app.ctx.db.query.webhookDeliveries.findFirst({ where: eq(webhookDeliveries.id, id) });
const deliverInScope = (ctx: Ctx, id: string, f: typeof fetch) => withSystemScope(ctx, (c) => deliver(c, id, f));

describe('dispatch', () => {
  it('ghi delivery và chỉ đẩy webhook.deliver vào Queue sau khi commit', async () => {
    const spy = new SpyQueue();
    const ctx: Ctx = { ...app.system(), queue: spy };
    await createWebhook(ctx, workspaceId, { url: 'https://khach.example/hook', events: ['member.joined'] });
    const n = await withSystemScope(ctx, async (c) => {
      const count = await dispatch(c, workspaceId, 'member.joined', { userId: 'u1' });
      expect(spy.sent).toHaveLength(0);
      return count;
    });
    expect(n).toBe(1);
    expect(spy.sent).toHaveLength(1);
    const [d] = await app.ctx.db.select().from(webhookDeliveries);
    expect(spy.sent[0]).toMatchObject({ name: 'webhook.deliver', payload: { deliveryId: d!.id } });
    expect(spy.sent[0]!.opts?.delaySeconds ?? 0).toBe(0);
  });
});

describe('deliver: thất bại thì hẹn lần sau bằng Queue delay', () => {
  it('lần 1 thất bại: ghi DB và đẩy lại sau 1 phút', async () => {
    const { deliveryId, spy, ctx } = await setup();
    const calls: string[] = [];
    expect(await deliverInScope(ctx, deliveryId, badFetch(calls))).toBe('retry');
    const d = await delivery(deliveryId);
    expect(d).toMatchObject({ status: 'failed', attempt: 1, responseStatus: 500 });
    expect(d!.nextAttemptAt!.getTime() - Date.now()).toBeGreaterThan(50_000);
    expect(spy.sent).toHaveLength(1);
    expect(spy.sent[0]).toMatchObject({ name: 'webhook.deliver', payload: { deliveryId }, opts: { delaySeconds: 60 } });
  });

  it('các lần sau lùi dần 5, 30, 120 phút; lần thứ 5 thất bại thì dừng và không đẩy nữa', async () => {
    const { deliveryId, spy, ctx } = await setup();
    const delays: Array<number | undefined> = [];
    for (let i = 0; i < 4; i++) {
      await makeDue(deliveryId);
      spy.sent = [];
      expect(await deliverInScope(ctx, deliveryId, badFetch([]))).toBe('retry');
      delays.push(spy.sent[0]?.opts?.delaySeconds);
    }
    expect(delays).toEqual([60, 300, 1800, 7200]);
    await makeDue(deliveryId);
    spy.sent = [];
    expect(await deliverInScope(ctx, deliveryId, badFetch([]))).toBe('exhausted');
    expect(spy.sent).toHaveLength(0);
    const d = await delivery(deliveryId);
    expect(d).toMatchObject({ status: 'exhausted', attempt: 5, nextAttemptAt: null });
  });

  it('khách không trả lời (lỗi mạng) cũng chỉ là một lần thất bại, không ném lỗi ra consumer', async () => {
    const { deliveryId, spy, ctx } = await setup();
    expect(await deliverInScope(ctx, deliveryId, throwingFetch([]))).toBe('retry');
    expect(spy.sent[0]!.opts?.delaySeconds).toBe(60);
    expect((await delivery(deliveryId))!.responseBody).toMatch(/ECONNRESET/);
  });

  it('lần retry thành công thì dừng: delivered, không đẩy thêm, đếm lỗi về 0', async () => {
    const { deliveryId, spy, ctx } = await setup();
    await deliverInScope(ctx, deliveryId, badFetch([]));
    await makeDue(deliveryId);
    spy.sent = [];
    expect(await deliverInScope(ctx, deliveryId, okFetch([]))).toBe('delivered');
    expect(spy.sent).toHaveLength(0);
    expect(await delivery(deliveryId)).toMatchObject({ status: 'delivered', attempt: 2 });
    const [w] = await app.ctx.db.select().from(webhooks);
    expect(w!.failureCount).toBe(0);
  });

  it('message đẩy sau commit: chưa commit thì Queue chưa thấy delay', async () => {
    const { deliveryId, spy, ctx } = await setup();
    await withSystemScope(ctx, async (c) => {
      await deliver(c, deliveryId, badFetch([]));
      expect(spy.sent).toHaveLength(0);
    });
    expect(spy.sent).toHaveLength(1);
  });
});

describe('deliver: không giao trùng', () => {
  it('delivery đã delivered thì bỏ qua, không POST', async () => {
    const { deliveryId, ctx } = await setup();
    await deliverInScope(ctx, deliveryId, okFetch([]));
    const calls: string[] = [];
    expect(await deliverInScope(ctx, deliveryId, okFetch(calls))).toBe('skipped');
    expect(calls).toHaveLength(0);
  });

  it('message tới sớm (trùng với message hẹn giờ) khi chưa tới lần thử kế thì bỏ qua, không POST', async () => {
    const { deliveryId, ctx } = await setup();
    await deliverInScope(ctx, deliveryId, badFetch([]));
    const calls: string[] = [];
    expect(await deliverInScope(ctx, deliveryId, okFetch(calls))).toBe('skipped');
    expect(calls).toHaveLength(0);
    expect((await delivery(deliveryId))!.attempt).toBe(1);
  });

  it('hai message trùng chạy đồng thời thì chỉ POST một lần', async () => {
    const { deliveryId, ctx } = await setup();
    const calls: string[] = [];
    const [a, b] = await Promise.all([deliverInScope(ctx, deliveryId, okFetch(calls)), deliverInScope(ctx, deliveryId, okFetch(calls))]);
    expect([a, b].sort()).toEqual(['delivered', 'skipped']);
    expect(calls).toHaveLength(1);
  });

  it('webhook đã bị tắt thì không POST và delivery kết thúc hẳn (exhausted), không bị quét đẩy lại mãi', async () => {
    const { deliveryId, spy, ctx } = await setup();
    await app.ctx.db.update(webhooks).set({ status: 'paused' });
    const calls: string[] = [];
    expect(await deliverInScope(ctx, deliveryId, okFetch(calls))).toBe('skipped');
    expect(calls).toHaveLength(0);
    expect(await delivery(deliveryId)).toMatchObject({ status: 'exhausted', nextAttemptAt: null });
    expect(spy.sent).toHaveLength(0);
    const swept = await withSystemScope({ ...app.system(), queue: spy }, (c) => runSweep(c));
    expect(swept.webhookRequeued).toBe(0);
  });
});

describe('sửa, gửi thử, đổi secret', () => {
  /** Ghi lại header và thân của lượt POST để kiểm chữ ký. */
  const recordingFetch = (seen: Array<{ headers: Record<string, string>; body: string }>) => (async (_url: string | URL | Request, init?: RequestInit) => {
    seen.push({ headers: init?.headers as Record<string, string>, body: String(init?.body) });
    return new Response('ok', { status: 200 });
  }) as typeof fetch;

  it('gửi thử đi đúng đường giao thật: sự kiện ping, có chữ ký kiểm được bằng secret của webhook', async () => {
    const spy = new SpyQueue();
    const ctx: Ctx = { ...app.system(), queue: spy };
    const hook = await createWebhook(ctx, workspaceId, { url: 'https://khach.example/hook', events: ['member.joined'] });
    const { deliveryId } = await sendTestEvent(ctx, workspaceId, hook.id);
    expect(spy.sent).toEqual([{ name: 'webhook.deliver', payload: { deliveryId }, opts: undefined }]);
    const seen: Array<{ headers: Record<string, string>; body: string }> = [];
    expect(await deliverInScope(ctx, deliveryId, recordingFetch(seen))).toBe('delivered');
    expect(seen[0]!.headers['X-HoiMinh-Event']).toBe('ping');
    expect(JSON.parse(seen[0]!.body)).toMatchObject({ event: 'ping', data: { test: true, webhookId: hook.id } });
    expect(await verifySignature(hook.secret, seen[0]!.headers['X-HoiMinh-Timestamp']!, seen[0]!.body, seen[0]!.headers['X-HoiMinh-Signature']!)).toBe(true);
  });

  it('đổi secret: lượt gửi sau ký bằng secret mới, secret cũ không còn khớp', async () => {
    const ctx: Ctx = { ...app.system(), queue: new SpyQueue() };
    const hook = await createWebhook(ctx, workspaceId, { url: 'https://khach.example/hook', events: ['member.joined'] });
    const fresh = await rotateWebhookSecret(ctx, workspaceId, hook.id);
    expect(fresh.secret).not.toBe(hook.secret);
    const { deliveryId } = await sendTestEvent(ctx, workspaceId, hook.id);
    const seen: Array<{ headers: Record<string, string>; body: string }> = [];
    await deliverInScope(ctx, deliveryId, recordingFetch(seen));
    const h = seen[0]!.headers;
    expect(await verifySignature(fresh.secret, h['X-HoiMinh-Timestamp']!, seen[0]!.body, h['X-HoiMinh-Signature']!)).toBe(true);
    expect(await verifySignature(hook.secret, h['X-HoiMinh-Timestamp']!, seen[0]!.body, h['X-HoiMinh-Signature']!)).toBe(false);
  });

  it('webhook tự tạm dừng vì lỗi: bật lại thì xóa bộ đếm lỗi và nhận sự kiện trở lại; đổi danh sách sự kiện có hiệu lực ngay', async () => {
    const ctx: Ctx = { ...app.system(), queue: new SpyQueue() };
    const hook = await createWebhook(ctx, workspaceId, { url: 'https://khach.example/hook', events: ['member.joined'] });
    await app.ctx.db.update(webhooks).set({ status: 'paused', failureCount: 20 }).where(eq(webhooks.id, hook.id));
    expect(await dispatch(ctx, workspaceId, 'member.joined', { userId: 'u1' })).toBe(0);
    await expect(sendTestEvent(ctx, workspaceId, hook.id)).rejects.toThrow(/tạm dừng/);
    expect(await updateWebhook(ctx, workspaceId, hook.id, { status: 'active' })).toMatchObject({ status: 'active', failureCount: 0, url: 'https://khach.example/hook' });
    expect(await dispatch(ctx, workspaceId, 'member.joined', { userId: 'u1' })).toBe(1);
    await updateWebhook(ctx, workspaceId, hook.id, { events: ['member.banned'], url: 'https://khach.example/moi' });
    expect(await dispatch(ctx, workspaceId, 'member.joined', { userId: 'u1' })).toBe(0);
    expect(await dispatch(ctx, workspaceId, 'member.banned', { userId: 'u1' })).toBe(1);
    await expect(updateWebhook(ctx, crypto.randomUUID(), hook.id, { status: 'paused' })).rejects.toThrow();
  });
});
