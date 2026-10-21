// Biến phiên cho Row Level Security (0001_rls.sql).
//
// Policy `tenant_isolation` đọc bốn biến: app.user_id, app.workspace_ids, app.community_ids,
// app.bypass. Postgres chỉ giữ `SET LOCAL` trong phạm vi một transaction, nên mỗi request
// và mỗi job chạy trong một transaction có đặt sẵn bốn biến đó.
//
// Chính sách vẫn chưa *chặn* cho tới khi bật FORCE ROW LEVEL SECURITY (`pnpm db:rls on`),
// vì vai trò của API là chủ sở hữu bảng. Đặt biến ở đây là vô hại khi chưa bật và là điều
// kiện cần để bật được.
import { sql } from 'drizzle-orm';
import { DeferredSender } from '@hoiminh/email';
import { DeferredRealtime } from '../realtime';
import { communities } from '@hoiminh/db';
import { eq } from 'drizzle-orm';
import { raw } from './db';
import type { Actor, Ctx } from '../context';
import { DeferredQueue } from '../jobs/queue';
import { markScheduledEnqueued } from '../jobs/scheduled-state';

export interface TenantScope {
  userId: string | null;
  workspaceIds: string[];
  communityIds: string[];
  /** Tiến trình hệ thống (cron, webhook, queue) và super admin đi xuyên mọi tenant. */
  bypass: boolean;
}

export const SYSTEM_SCOPE: TenantScope = { userId: null, workspaceIds: [], communityIds: [], bypass: true };
export const ANON_SCOPE: TenantScope = { userId: null, workspaceIds: [], communityIds: [], bypass: false };

/**
 * Tenant mà actor được phép chạm tới.
 *
 * Lấy rộng có chủ ý: mọi workspace và mọi hội có quan hệ, không lọc theo trạng thái thành
 * viên. Quyền thật do service layer quyết định; RLS ở đây là lớp chặn cuối để một lỗi
 * truy vấn không làm lộ dữ liệu của tenant khác. Lọc chặt ở tầng này sẽ chặn nhầm những
 * đường hợp lệ (ví dụ người đã rời hội vẫn xem được hóa đơn cũ).
 */
export async function resolveScope(ctx: Ctx, actor: Actor = ctx.actor): Promise<TenantScope> {
  if (actor.type === 'system') return SYSTEM_SCOPE;
  if (actor.type === 'anonymous') return ANON_SCOPE;
  if (actor.type === 'user' && actor.isSuperAdmin) return { ...SYSTEM_SCOPE, userId: actor.userId };

  const userId = actor.userId;
  if (actor.type === 'api_key') {
    // API key gắn với đúng một workspace; hội của workspace đó là phạm vi của nó.
    const rows = await ctx.db.select({ id: communities.id }).from(communities).where(eq(communities.workspaceId, actor.workspaceId));
    return { userId, workspaceIds: [actor.workspaceId], communityIds: rows.map((r) => r.id), bypass: false };
  }

  // Một lượt đi về database thay vì bốn: mỗi request của người đăng nhập đều chạy câu này.
  const [row] = await raw<{ ws: string | null; cm: string | null }>(ctx.db, sql`
    with ws as (
      select id from workspaces where owner_user_id = ${userId}
      union
      select workspace_id from workspace_members where user_id = ${userId}
    )
    select
      (select string_agg(id::text, ',') from ws) as ws,
      (select string_agg(distinct id::text, ',') from (
        select community_id as id from community_members where user_id = ${userId}
        union
        select id from communities where workspace_id in (select id from ws)
      ) c) as cm`);
  const workspaceIds = row?.ws ? row.ws.split(',') : [];
  const communityIds = row?.cm ? row.cm.split(',') : [];
  return { userId, workspaceIds, communityIds, bypass: false };
}

/** Câu lệnh đặt bốn biến phiên trong transaction hiện tại. */
function setScopeSql(scope: TenantScope) {
  return sql`select
    set_config('app.user_id', ${scope.userId ?? ''}, true),
    set_config('app.workspace_ids', ${scope.workspaceIds.join(',')}, true),
    set_config('app.community_ids', ${scope.communityIds.join(',')}, true),
    set_config('app.bypass', ${scope.bypass ? 'on' : 'off'}, true)`;
}

async function runInScope<T>(ctx: Ctx, scope: TenantScope, fn: (scoped: Ctx) => Promise<T>): Promise<T> {
  // Email và message hàng đợi trong transaction chỉ được ghi nhận; gửi thật sau khi commit, để không giữ kết nối
  // database trong lúc chờ Resend, không đẩy vào Queue khi consumer có thể chạy trước commit, và để thao tác
  // bị hủy thì không gửi gì sai.
  const email = new DeferredSender(ctx.email);
  const queue = new DeferredQueue(ctx.queue);
  // Sự kiện thời gian thực (tin nhắn, thông báo mới) cũng chỉ đẩy sau commit. Scope lồng nhau thì
  // ctx.realtime đã là DeferredRealtime của scope ngoài, nên sự kiện chờ tới lần commit cuối.
  const realtime = ctx.realtime ? new DeferredRealtime(ctx.realtime) : undefined;
  // Scope lồng nhau: message đi vào DeferredQueue của scope ngoài, scope ngoài mới đẩy thật và đánh dấu enqueued.
  const nested = ctx.queue instanceof DeferredQueue;
  let result: T;
  try {
    result = await ctx.db.transaction(async (tx) => {
      await tx.execute(setScopeSql(scope));
      const scoped: Ctx = { ...ctx, db: tx as unknown as Ctx['db'], email, queue, ...(realtime ? { realtime } : {}) };
    // Handler của sự kiện phải chạy trong chính transaction này. Dùng kết nối gốc thì
    // Postgres không thấy biến phiên, còn PGlite (một kết nối) khóa chết chờ transaction.
      scoped.events = { on: ctx.events.on.bind(ctx.events), emit: (name, payload) => ctx.events.emit(name, payload, scoped) };
      return fn(scoped);
    });
  } catch (err) {
    realtime?.discard();
    const dropped = email.discard();
    if (dropped) ctx.log.warn('email.discarded_on_rollback', { count: dropped });
    const droppedJobs = queue.discard();
    if (droppedJobs) ctx.log.warn('queue.discarded_on_rollback', { count: droppedJobs });
    throw err;
  }
  await email.flush((m, err) => ctx.log.error('email.send_failed', { template: m.template, err: String(err) }));
  // Lỗi đẩy Queue chỉ ghi log: dòng DB (scheduled_jobs, webhook_deliveries) đã commit nên bộ quét sẽ đẩy lại.
  await queue.flush(
    (m, err) => ctx.log.error('queue.flush_failed', { name: m.name, err: String(err) }),
    nested ? undefined : async (m) => {
      if (m.name === 'scheduled.run') await markScheduledEnqueued(ctx.db, (m.payload as { jobId: string }).jobId, ctx.now());
    },
  );
  await realtime?.flush((err) => ctx.log.warn('realtime.publish_failed', { err: String(err) }));
  return result;
}

/**
 * Chạy `fn` trong một transaction có sẵn biến phiên của actor.
 *
 * Phạm vi được tính TRƯỚC khi vào transaction: các truy vấn tìm workspace và hội của
 * người dùng phải chạy ngoài phạm vi, nếu không chúng tự chặn chính mình.
 */
export async function withTenantScope<T>(ctx: Ctx, fn: (scoped: Ctx) => Promise<T>): Promise<T> {
  return runInScope(ctx, await resolveScope(ctx), fn);
}

/** Cho tiến trình hệ thống (cron, queue, webhook cổng thanh toán): bypass, không cần truy vấn. */
export async function withSystemScope<T>(ctx: Ctx, fn: (scoped: Ctx) => Promise<T>): Promise<T> {
  return runInScope(ctx, SYSTEM_SCOPE, fn);
}
