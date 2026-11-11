// Thông báo đẩy (Web Push): lưu đăng ký của từng thiết bị, gửi thông báo khi có thông báo trong ứng dụng.
// Tắt hẳn khi máy chủ chưa có cặp khóa VAPID. Thiết bị nào dịch vụ đẩy báo đã chết (404, 410) thì gỡ đăng ký.
import { and, eq, sql } from 'drizzle-orm';
import { notificationPrefs, pushSubscriptions } from '@hoiminh/db';
import type { Ctx } from '../context';
import { invalid } from '../errors';
import { buildPushRequest, vapidConfigured, type VapidKeys } from '../lib/web-push';
import { requireUser } from '../permissions';

/** Mỗi người tối đa chừng này thiết bị nhận thông báo đẩy; đăng ký thêm thì thiết bị cũ nhất bị thay. */
export const MAX_PUSH_DEVICES = 10;

export interface PushPayload { title: string; body: string; link: string | null; tag: string }

function vapidOf(ctx: Ctx): VapidKeys | null {
  const v = { publicKey: ctx.env.VAPID_PUBLIC_KEY, privateKey: ctx.env.VAPID_PRIVATE_KEY, subject: ctx.env.VAPID_SUBJECT };
  return vapidConfigured(v) ? v : null;
}

/** Máy chủ có gửi được thông báo đẩy không, và khóa công khai để trình duyệt đăng ký. */
export function pushConfig(ctx: Ctx): { enabled: boolean; publicKey: string | null } {
  const v = vapidOf(ctx);
  return { enabled: Boolean(v), publicKey: v?.publicKey ?? null };
}

/** Chỉ nhận endpoint https của dịch vụ đẩy; chặn địa chỉ nội bộ để máy chủ không bị lợi dụng gọi vào mạng riêng. */
function checkEndpoint(endpoint: string): void {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw invalid('Đăng ký thông báo đẩy không hợp lệ');
  }
  const host = url.hostname.toLowerCase();
  const local = host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':');
  if (url.protocol !== 'https:' || local || endpoint.length > 1000) throw invalid('Đăng ký thông báo đẩy không hợp lệ');
}

/** Trình duyệt vừa được cấp quyền thông báo: lưu đăng ký của thiết bị này cho người đang đăng nhập. */
export async function subscribePush(ctx: Ctx, input: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string | null) {
  const userId = requireUser(ctx);
  if (!vapidOf(ctx)) throw invalid('Máy chủ chưa bật thông báo đẩy');
  checkEndpoint(input.endpoint);
  const values = { userId, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null, failureCount: 0 };
  // Cùng một thiết bị đổi người đăng nhập thì đăng ký chuyển sang người mới (endpoint là duy nhất).
  await ctx.db.insert(pushSubscriptions).values({ endpoint: input.endpoint, ...values }).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
  await ctx.db.execute(sql`delete from push_subscriptions where user_id = ${userId} and id not in (select id from push_subscriptions where user_id = ${userId} order by created_at desc limit ${MAX_PUSH_DEVICES})`);
  await ctx.db.insert(notificationPrefs).values({ userId, push: true }).onConflictDoUpdate({ target: notificationPrefs.userId, set: { push: true, updatedAt: ctx.now() } });
  return { subscribed: true };
}

/** Người dùng tắt thông báo đẩy trên thiết bị này. */
export async function unsubscribePush(ctx: Ctx, endpoint: string) {
  const userId = requireUser(ctx);
  await ctx.db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  return { subscribed: false };
}

/** Người này có thiết bị nào đang nhận thông báo đẩy không. */
export async function pushDeviceCount(ctx: Ctx): Promise<number> {
  const userId = requireUser(ctx);
  const rows = await ctx.db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  return rows.length;
}

/**
 * Sau khi tạo một thông báo trong ứng dụng: nếu máy chủ bật thông báo đẩy và người nhận chưa tắt "đẩy trên điện thoại"
 * thì xếp một job gửi. Job chỉ chạy sau khi giao dịch hiện tại đã ghi xong, nên không đẩy cho thông báo bị hủy.
 */
export async function queuePush(ctx: Ctx, userId: string, payload: PushPayload): Promise<void> {
  if (!vapidOf(ctx)) return;
  const prefs = await ctx.db.query.notificationPrefs.findFirst({ where: eq(notificationPrefs.userId, userId), columns: { push: true } });
  if (prefs && !prefs.push) return;
  const device = await ctx.db.query.pushSubscriptions.findFirst({ where: eq(pushSubscriptions.userId, userId), columns: { id: true } });
  if (!device) return;
  await ctx.queue.enqueue('push.send', { userId, ...payload });
}

/** Gửi một thông báo tới mọi thiết bị của một người. Trả về số thiết bị nhận được và số đăng ký đã gỡ. */
export async function sendPushToUser(ctx: Ctx, userId: string, payload: PushPayload, fetchImpl: typeof fetch = fetch): Promise<{ sent: number; removed: number; failed: number }> {
  const vapid = vapidOf(ctx);
  if (!vapid) return { sent: 0, removed: 0, failed: 0 };
  const devices = await ctx.db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, userId) });
  let sent = 0, removed = 0, failed = 0;
  for (const d of devices) {
    try {
      const req = await buildPushRequest(d, { title: payload.title, body: payload.body, link: payload.link ?? '/thong-bao', tag: payload.tag }, vapid, { ttlSeconds: 86_400, topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined });
      const res = await fetchImpl(req.endpoint, { method: 'POST', headers: req.headers, body: req.body as unknown as BodyInit, signal: AbortSignal.timeout(10_000) });
      if (res.status === 404 || res.status === 410) {
        // Người dùng đã gỡ ứng dụng hoặc thu hồi quyền: đăng ký này không bao giờ dùng lại được.
        await ctx.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, d.id));
        removed++;
      } else if (res.ok) {
        await ctx.db.update(pushSubscriptions).set({ failureCount: 0, lastSuccessAt: ctx.now() }).where(eq(pushSubscriptions.id, d.id));
        sent++;
      } else {
        throw new Error(`Dịch vụ đẩy trả ${res.status}`);
      }
    } catch (err) {
      failed++;
      ctx.log.warn('push.send_failed', { subscriptionId: d.id, err: String(err) });
      // Thiết bị hỏng liên tục thì gỡ, để không gọi mãi một địa chỉ chết.
      if (d.failureCount + 1 >= 10) {
        await ctx.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, d.id));
        removed++;
      } else await ctx.db.update(pushSubscriptions).set({ failureCount: d.failureCount + 1 }).where(eq(pushSubscriptions.id, d.id));
    }
  }
  return { sent, removed, failed };
}
