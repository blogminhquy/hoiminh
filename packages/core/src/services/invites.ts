// Lời mời vào hội: đọc lại mã trên link `?invite=`, xét còn dùng được không, đánh dấu đã nhận, liệt kê và thu hồi.
// Tạo lời mời nằm ở members.ts (`invite`); tệp này tách riêng để cả members.ts lẫn communities.ts cùng dùng mà không vòng import.
import { and, desc, eq, isNull } from 'drizzle-orm';
import { communities, communityInvites, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { conflict, invalidState, notFound } from '../errors';
import { requireCommunityPermission } from '../permissions';
import { audit } from './audit';
import { elevated } from './automation-engine';

type Invite = typeof communityInvites.$inferSelect;

/**
 * `valid`: dùng được. `not_found`: mã sai hoặc đã bị thu hồi. `expired`: quá 14 ngày. `used`: lời mời gửi qua email đã có
 * người nhận. `wrong_email`: người đang đăng nhập không phải địa chỉ được mời. `unverified_email`: đúng địa chỉ nhưng chưa
 * xác minh email, nên chưa chứng minh được hộp thư là của mình.
 */
export type InviteState = 'valid' | 'not_found' | 'expired' | 'used' | 'wrong_email' | 'unverified_email';

const MESSAGES: Record<Exclude<InviteState, 'valid'>, string> = {
  not_found: 'Lời mời không còn hiệu lực. Hãy nhờ chủ hội gửi lời mời mới.',
  expired: 'Lời mời đã hết hạn (mỗi lời mời dùng được 14 ngày). Hãy nhờ chủ hội gửi lời mời mới.',
  used: 'Lời mời này đã được dùng rồi.',
  wrong_email: 'Lời mời này gửi cho một địa chỉ email khác. Hãy đăng nhập bằng đúng email đã nhận lời mời.',
  unverified_email: 'Hãy xác minh email của bạn trước khi nhận lời mời.',
};

export interface InviteViewer { email: string; emailVerifiedAt: Date | null }

/**
 * Lời mời này dùng được với người đang xem không. Khách chưa đăng nhập (`viewer` rỗng) chỉ xét hạn và đã dùng hay chưa;
 * địa chỉ email được kiểm lúc họ đăng nhập xong và bấm tham gia. Link mời chung (không gắn email) dùng được nhiều lần tới khi hết hạn.
 */
export function inviteState(inv: Pick<Invite, 'email' | 'expiresAt' | 'acceptedAt'> | null | undefined, now: Date, viewer?: InviteViewer | null): InviteState {
  if (!inv) return 'not_found';
  if (inv.email && inv.acceptedAt) return 'used';
  if (inv.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (inv.email && viewer) {
    if (inv.email.trim().toLowerCase() !== viewer.email.trim().toLowerCase()) return 'wrong_email';
    if (!viewer.emailVerifiedAt) return 'unverified_email';
  }
  return 'valid';
}

/** Vai trò lời mời trao: chỉ `admin` và `member`; giá trị lạ trong bảng coi như `member`, không bao giờ trao hơn. */
export function inviteRole(inv: Pick<Invite, 'role'>): 'admin' | 'member' {
  return inv.role === 'admin' ? 'admin' : 'member';
}

/**
 * Người cầm link chưa thuộc hội nên policy RLS theo hội không cho đọc bảng lời mời; chính mã bí mật trên link là bằng chứng
 * họ được phép, nên đọc bằng quyền hệ thống (cùng cách với link kích hoạt của tự động hóa). Luôn lọc theo đúng hội.
 */
async function findInvite(ctx: Ctx, communityId: string, token: string): Promise<Invite | null> {
  const clean = token.trim();
  if (!clean || clean.length > 64) return null;
  return (await elevated(ctx, () => ctx.db.query.communityInvites.findFirst({ where: and(eq(communityInvites.token, clean), eq(communityInvites.communityId, communityId)) }))) ?? null;
}

async function viewerOf(ctx: Ctx): Promise<InviteViewer | null> {
  if (ctx.actor.type !== 'user') return null;
  return (await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.actor.userId), columns: { email: true, emailVerifiedAt: true } })) ?? null;
}

/** Cho trang giới thiệu hội: lời mời trên link còn dùng được không, trao vai trò gì, và câu giải thích khi không dùng được. */
export async function invitePreview(ctx: Ctx, communityId: string, token: string): Promise<{ state: InviteState; role: 'admin' | 'member'; message: string | null }> {
  const inv = await findInvite(ctx, communityId, token);
  const state = inviteState(inv, ctx.now(), await viewerOf(ctx));
  return { state, role: inv ? inviteRole(inv) : 'member', message: state === 'valid' ? null : MESSAGES[state] };
}

/** Lời mời dùng được cho người đang đăng nhập, hoặc ném lỗi nói rõ vì sao không. Gọi lúc tham gia hội. */
export async function requireUsableInvite(ctx: Ctx, communityId: string, token: string): Promise<Invite> {
  const inv = await findInvite(ctx, communityId, token);
  const state = inviteState(inv, ctx.now(), await viewerOf(ctx));
  if (state !== 'valid' || !inv) throw invalidState(MESSAGES[state === 'valid' ? 'not_found' : state]);
  return inv;
}

/**
 * Ghi nhận lời mời đã được nhận. Lời mời gửi qua email chỉ dùng một lần: điều kiện `accepted_at is null` nằm ngay trong câu
 * UPDATE, nên hai lượt bấm cùng lúc chỉ một lượt qua. Link mời chung không đánh dấu, dùng tiếp được tới khi hết hạn.
 */
export async function acceptInvite(ctx: Ctx, inv: Invite): Promise<void> {
  if (!inv.email) return;
  const rows = await elevated(ctx, () => ctx.db.update(communityInvites).set({ acceptedAt: ctx.now() }).where(and(eq(communityInvites.id, inv.id), isNull(communityInvites.acceptedAt))).returning({ id: communityInvites.id }));
  if (!rows.length) throw conflict(MESSAGES.used);
}

/** Lời mời chưa có người nhận của hội (kể cả đã hết hạn, để chủ hội biết mà gửi lại), mới nhất trước. */
export async function listInvites(ctx: Ctx, communityId: string) {
  await requireCommunityPermission(ctx, communityId, 'member.manage');
  const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId), columns: { slug: true } });
  if (!c) throw notFound();
  const rows = await ctx.db
    .select({ inv: communityInvites, inviter: users.name })
    .from(communityInvites)
    .leftJoin(users, eq(users.id, communityInvites.invitedByUserId))
    .where(and(eq(communityInvites.communityId, communityId), isNull(communityInvites.acceptedAt)))
    .orderBy(desc(communityInvites.createdAt))
    .limit(200);
  const now = ctx.now().getTime();
  return {
    items: rows.map(({ inv, inviter }) => ({
      id: inv.id, email: inv.email, role: inviteRole(inv), url: `${ctx.env.APP_URL}/${c.slug}?invite=${inv.token}`,
      expiresAt: inv.expiresAt, expired: inv.expiresAt.getTime() <= now, createdAt: inv.createdAt, invitedBy: inviter ?? null,
    })),
  };
}

/** Thu hồi một lời mời chưa có người nhận: link của nó ngừng dùng được ngay. */
export async function revokeInvite(ctx: Ctx, communityId: string, inviteId: string): Promise<void> {
  await requireCommunityPermission(ctx, communityId, 'member.manage');
  const rows = await ctx.db.delete(communityInvites).where(and(eq(communityInvites.id, inviteId), eq(communityInvites.communityId, communityId), isNull(communityInvites.acceptedAt))).returning({ id: communityInvites.id, role: communityInvites.role });
  if (!rows.length) throw notFound('Không tìm thấy lời mời đang chờ này');
  await audit(ctx, { action: 'member.invite_revoke', resourceType: 'community', resourceId: communityId, communityId, metadata: { inviteId, role: rows[0]!.role } });
}
