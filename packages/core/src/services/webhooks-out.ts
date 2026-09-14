// Webhook gửi đi: đăng ký URL theo workspace, ký HMAC-SHA256, giao qua hàng đợi, retry lùi dần 5 lần.
import { decryptJson, encryptJson, hmacHex, randomToken } from '@hoiminh/config';
import type { WebhookEventName } from '@hoiminh/contracts';
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { webhookDeliveries, webhooks } from '@hoiminh/db';
import type { Ctx } from '../context';
import { notFound } from '../errors';
import { requireWorkspaceRole } from '../permissions';
import { audit } from './audit';

const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

export async function createWebhook(ctx: Ctx, workspaceId: string, input: { url: string; events: WebhookEventName[]; description?: string; communityId?: string | null }) {
  await requireWorkspaceRole(ctx, workspaceId, ['owner', 'admin']);
  const secret = `whsec_${randomToken(24)}`;
  const [row] = await ctx.db.insert(webhooks).values({ workspaceId, communityId: input.communityId ?? null, url: input.url, description: input.description ?? '', events: input.events, secretEncrypted: await encryptJson({ secret }, ctx.env.ENCRYPTION_KEY, ctx.env.ENCRYPTION_KEY_VERSION) }).returning();
  await audit(ctx, { action: 'webhook.create', resourceType: 'webhook', resourceId: row!.id, workspaceId, metadata: { url: input.url, events: input.events } });
  return { id: row!.id, url: row!.url, events: row!.events, secret };
}

export async function listWebhooks(ctx: Ctx, workspaceId: string) {
  await requireWorkspaceRole(ctx, workspaceId, ['owner', 'admin']);
  const rows = await ctx.db.query.webhooks.findMany({ where: eq(webhooks.workspaceId, workspaceId), orderBy: desc(webhooks.createdAt) });
  const out = [];
  for (const w of rows) {
    const recent = await ctx.db.query.webhookDeliveries.findMany({ where: eq(webhookDeliveries.webhookId, w.id), orderBy: desc(webhookDeliveries.createdAt), limit: 10 });
    out.push({ id: w.id, url: w.url, description: w.description, events: w.events, status: w.status, failureCount: w.failureCount, createdAt: w.createdAt, recent: recent.map((d) => ({ id: d.id, eventName: d.eventName, status: d.status, attempt: d.attempt, responseStatus: d.responseStatus, createdAt: d.createdAt, deliveredAt: d.deliveredAt })) });
  }
  return out;
}

export async function deleteWebhook(ctx: Ctx, workspaceId: string, id: string) {
  await requireWorkspaceRole(ctx, workspaceId, ['owner', 'admin']);
  const rows = await ctx.db.delete(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.workspaceId, workspaceId))).returning({ id: webhooks.id });
  if (!rows.length) throw notFound();
  await audit(ctx, { action: 'webhook.delete', resourceType: 'webhook', resourceId: id, workspaceId });
}

/** Phát một sự kiện tới mọi webhook đang bật của workspace (đưa vào hàng đợi). */
export async function dispatch(ctx: Ctx, workspaceId: string | null, eventName: WebhookEventName, payload: Record<string, unknown>): Promise<number> {
  if (!workspaceId) return 0;
  const targets = await ctx.db.query.webhooks.findMany({ where: and(eq(webhooks.workspaceId, workspaceId), eq(webhooks.status, 'active')) });
  let n = 0;
  for (const w of targets) {
    if (!w.events.includes(eventName)) continue;
    const [d] = await ctx.db.insert(webhookDeliveries).values({ webhookId: w.id, eventName, eventId: crypto.randomUUID(), payload, nextAttemptAt: ctx.now() }).returning();
    await ctx.queue.enqueue('webhook.deliver', { deliveryId: d!.id });
    n++;
  }
  return n;
}

/** Giao một delivery: POST JSON ký X-HoiMinh-Signature = sha256=<hmac(timestamp.body)>. */
export async function deliver(ctx: Ctx, deliveryId: string, fetchImpl: typeof fetch = fetch): Promise<'delivered' | 'retry' | 'exhausted' | 'skipped'> {
  const d = await ctx.db.query.webhookDeliveries.findFirst({ where: eq(webhookDeliveries.id, deliveryId) });
  if (!d || d.status === 'delivered' || d.status === 'exhausted') return 'skipped';
  const w = await ctx.db.query.webhooks.findFirst({ where: eq(webhooks.id, d.webhookId) });
  if (!w || w.status !== 'active') return 'skipped';
  const { secret } = await decryptJson<{ secret: string }>(w.secretEncrypted, ctx.env.ENCRYPTION_KEY);
  const body = JSON.stringify({ id: d.eventId, event: d.eventName, createdAt: d.createdAt.toISOString(), data: d.payload });
  const ts = Math.floor(ctx.now().getTime() / 1000);
  const sig = await hmacHex(secret, `${ts}.${body}`);
  let status = 0;
  let text = '';
  try {
    const res = await fetchImpl(w.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HoiMinh-Event': d.eventName, 'X-HoiMinh-Delivery': d.id, 'X-HoiMinh-Timestamp': String(ts), 'X-HoiMinh-Signature': `sha256=${sig}` }, body, signal: AbortSignal.timeout(10_000) });
    status = res.status;
    text = (await res.text()).slice(0, 500);
  } catch (err) {
    text = err instanceof Error ? err.message : String(err);
  }
  const ok = status >= 200 && status < 300;
  const attempt = d.attempt + 1;
  if (ok) {
    await ctx.db.update(webhookDeliveries).set({ status: 'delivered', attempt, responseStatus: status, responseBody: text, deliveredAt: ctx.now() }).where(eq(webhookDeliveries.id, d.id));
    await ctx.db.update(webhooks).set({ failureCount: 0 }).where(eq(webhooks.id, w.id));
    return 'delivered';
  }
  const exhausted = attempt >= BACKOFF_MINUTES.length;
  await ctx.db.update(webhookDeliveries).set({ status: exhausted ? 'exhausted' : 'failed', attempt, responseStatus: status || null, responseBody: text, nextAttemptAt: exhausted ? null : new Date(ctx.now().getTime() + BACKOFF_MINUTES[attempt - 1]! * 60_000) }).where(eq(webhookDeliveries.id, d.id));
  await ctx.db.update(webhooks).set({ failureCount: sql`${webhooks.failureCount} + 1`, status: w.failureCount + 1 >= 20 ? 'paused' : 'active' }).where(eq(webhooks.id, w.id));
  return exhausted ? 'exhausted' : 'retry';
}

/** Cron: đưa các delivery thất bại đã đến giờ retry vào hàng đợi. */
export async function retryDue(ctx: Ctx): Promise<number> {
  const due = await ctx.db.query.webhookDeliveries.findMany({ where: and(inArray(webhookDeliveries.status, ['failed', 'pending']), lte(webhookDeliveries.nextAttemptAt, ctx.now())), limit: 200 });
  for (const d of due) await ctx.queue.enqueue('webhook.deliver', { deliveryId: d.id });
  return due.length;
}

/** Kiểm tra chữ ký ở phía nhận (tiện ích cho khách hàng tích hợp và test). */
export async function verifySignature(secret: string, timestamp: string, body: string, signature: string): Promise<boolean> {
  const expected = `sha256=${await hmacHex(secret, `${timestamp}.${body}`)}`;
  return expected === signature;
}
