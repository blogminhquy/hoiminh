// RBAC: role → permission, không có if role == admin rải rác trong code (mục 10).
import { and, eq } from 'drizzle-orm';
import { communities, communityMembers, workspaceMembers, workspaces } from '@hoiminh/db';
import type { Ctx } from './context';
import { forbidden, notFound, unauthorized } from './errors';

export type Permission =
  | 'community.read' | 'community.manage' | 'member.read' | 'member.manage' | 'post.create' | 'post.moderate' | 'post.broadcast'
  | 'course.read' | 'course.manage' | 'event.manage' | 'store.manage' | 'billing.manage' | 'revenue.read' | 'affiliates.manage'
  | 'settings.manage' | 'api.manage' | 'platform.admin' | 'message.send';

export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member' | 'guest';

const ROLE_PERMISSIONS: Record<CommunityRole, Permission[]> = {
  owner: ['community.read', 'community.manage', 'member.read', 'member.manage', 'post.create', 'post.moderate', 'post.broadcast', 'course.read', 'course.manage', 'event.manage', 'store.manage', 'billing.manage', 'revenue.read', 'affiliates.manage', 'settings.manage', 'api.manage', 'message.send'],
  admin: ['community.read', 'community.manage', 'member.read', 'member.manage', 'post.create', 'post.moderate', 'post.broadcast', 'course.read', 'course.manage', 'event.manage', 'store.manage', 'revenue.read', 'affiliates.manage', 'settings.manage', 'message.send'],
  moderator: ['community.read', 'member.read', 'post.create', 'post.moderate', 'course.read', 'event.manage', 'message.send'],
  member: ['community.read', 'member.read', 'post.create', 'course.read', 'message.send'],
  guest: [],
};

/** Map scope API key → permission. */
const SCOPE_PERMISSIONS: Record<string, Permission[]> = {
  'communities:read': ['community.read'], 'communities:write': ['community.manage', 'settings.manage'], 'members:read': ['member.read'],
  'members:write': ['member.manage'], 'posts:write': ['post.create', 'post.broadcast'], 'courses:read': ['course.read'], 'courses:write': ['course.manage'],
  'events:write': ['event.manage'], 'affiliates:read': ['revenue.read'], 'affiliates:manage': ['affiliates.manage'], 'messages:write': ['message.send'],
  'entitlements:write': ['member.manage'],
};

export function permissionsForRole(role: CommunityRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export interface CommunityAccess {
  communityId: string;
  workspaceId: string;
  role: CommunityRole;
  memberId: string | null;
  tierId: string | null;
  memberStatus: string | null;
  permissions: Set<Permission>;
}

/** Xác định vai trò của actor trong một hội (chủ workspace = owner; super admin = owner khi thao tác quản trị). */
export async function resolveCommunityAccess(ctx: Ctx, communityId: string): Promise<CommunityAccess> {
  const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId), columns: { id: true, workspaceId: true } });
  if (!community) throw notFound('Hội không tồn tại');
  const base: CommunityAccess = { communityId, workspaceId: community.workspaceId, role: 'guest', memberId: null, tierId: null, memberStatus: null, permissions: new Set() };
  if (ctx.actor.type === 'system') return { ...base, role: 'owner', permissions: new Set(ROLE_PERMISSIONS.owner) };
  if (ctx.actor.type === 'api_key') {
    if (ctx.actor.workspaceId !== community.workspaceId) return base;
    const perms = new Set<Permission>(ctx.actor.scopes.flatMap((s) => SCOPE_PERMISSIONS[s] ?? []));
    return { ...base, role: 'admin', permissions: perms };
  }
  if (ctx.actor.type !== 'user') return base;
  const userId = ctx.actor.userId;
  const [member, wsMember] = await Promise.all([
    ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)) }),
    ctx.db.query.workspaceMembers.findFirst({ where: and(eq(workspaceMembers.workspaceId, community.workspaceId), eq(workspaceMembers.userId, userId)) }),
  ]);
  let role: CommunityRole = 'guest';
  if (wsMember?.role === 'owner' || ctx.actor.isSuperAdmin) role = 'owner';
  else if (wsMember?.role === 'admin' || wsMember?.role === 'editor') role = 'admin';
  else if (member && (member.status === 'active' || member.status === 'cancelling')) role = member.role;
  const permissions = new Set(ROLE_PERMISSIONS[role]);
  if (member && member.status !== 'active' && member.status !== 'cancelling' && role === 'member') permissions.clear();
  return { ...base, role, memberId: member?.id ?? null, tierId: member?.tierId ?? null, memberStatus: member?.status ?? null, permissions };
}

/** Ném forbidden nếu không có quyền trong hội. */
export async function requireCommunityPermission(ctx: Ctx, communityId: string, permission: Permission): Promise<CommunityAccess> {
  if (ctx.actor.type === 'anonymous') throw unauthorized();
  const access = await resolveCommunityAccess(ctx, communityId);
  if (!access.permissions.has(permission)) throw forbidden();
  return access;
}

/** Quyền ở cấp workspace: chủ sở hữu hoặc quản trị workspace (hoặc super admin). */
export async function requireWorkspaceRole(ctx: Ctx, workspaceId: string, roles: Array<'owner' | 'admin' | 'editor'> = ['owner', 'admin']): Promise<void> {
  if (ctx.actor.type === 'system') return;
  if (ctx.actor.type === 'api_key') {
    if (ctx.actor.workspaceId === workspaceId) return;
    throw forbidden();
  }
  if (ctx.actor.type !== 'user') throw unauthorized();
  if (ctx.actor.isSuperAdmin) return;
  const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId), columns: { ownerUserId: true } });
  if (!ws) throw notFound('Workspace không tồn tại');
  if (ws.ownerUserId === ctx.actor.userId) return;
  const m = await ctx.db.query.workspaceMembers.findFirst({ where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, ctx.actor.userId)) });
  if (!m || !roles.includes(m.role)) throw forbidden();
}

/** Chỉ super admin (hoặc system). */
export function requireSuperAdmin(ctx: Ctx): void {
  if (ctx.actor.type === 'system') return;
  if (ctx.actor.type !== 'user') throw unauthorized();
  if (!ctx.actor.isSuperAdmin) throw forbidden('Chỉ quản trị hệ thống');
}

/** Bắt buộc là người dùng đăng nhập; trả về userId. */
export function requireUser(ctx: Ctx): string {
  if (ctx.actor.type === 'user' || ctx.actor.type === 'api_key') return ctx.actor.userId;
  throw unauthorized();
}
