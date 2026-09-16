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
import { communities, communityMembers, workspaceMembers, workspaces } from '@hoiminh/db';
import { eq, inArray } from 'drizzle-orm';
import type { Actor, Ctx } from '../context';

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

  const [wsOwned, wsMember, cmRows] = await Promise.all([
    ctx.db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerUserId, userId)),
    ctx.db.select({ id: workspaceMembers.workspaceId }).from(workspaceMembers).where(eq(workspaceMembers.userId, userId)),
    ctx.db.select({ id: communityMembers.communityId }).from(communityMembers).where(eq(communityMembers.userId, userId)),
  ]);
  const workspaceIds = [...new Set([...wsOwned.map((r) => r.id), ...wsMember.map((r) => r.id)])];
  const communityIds = new Set(cmRows.map((r) => r.id));
  if (workspaceIds.length) {
    // Chủ hội phải thấy mọi hội trong workspace của mình, kể cả hội chưa tham gia với tư cách thành viên.
    const owned = await ctx.db.select({ id: communities.id }).from(communities).where(inArray(communities.workspaceId, workspaceIds));
    for (const r of owned) communityIds.add(r.id);
  }
  return { userId, workspaceIds, communityIds: [...communityIds], bypass: false };
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
  return ctx.db.transaction(async (tx) => {
    await tx.execute(setScopeSql(scope));
    const scoped: Ctx = { ...ctx, db: tx as unknown as Ctx['db'] };
    // Handler của sự kiện phải chạy trong chính transaction này. Dùng kết nối gốc thì
    // Postgres không thấy biến phiên, còn PGlite (một kết nối) khóa chết chờ transaction.
    scoped.events = { on: ctx.events.on.bind(ctx.events), emit: (name, payload) => ctx.events.emit(name, payload, scoped) };
    return fn(scoped);
  });
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
