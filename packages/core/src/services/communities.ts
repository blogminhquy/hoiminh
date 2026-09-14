// Hội: tạo (6 bước một màn), trang giới thiệu, cài đặt chung/giá/plugin/bảng tin/cộng sự, khám phá.
import { RESERVED_SLUGS } from '@hoiminh/config';
import type { CreateCommunityInput, UpdatePricingInput } from '@hoiminh/contracts';
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { affiliatePrograms, communities, communityJoinQuestions, communityMembers, communityPlugins, communityTiers, courses, offers, prices, spaces, users, workspaces } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { conflict, invalid, notFound } from '../errors';
import { requireCommunityPermission, requireUser, resolveCommunityAccess } from '../permissions';
import { audit } from './audit';
import { assertWorkspaceUnlocked, ensureWorkspace } from './workspaces';

const DEFAULT_SPACES: Array<[string, string, 'everyone' | 'admins_only' | 'premium', string]> = [['Thông báo', 'thong-bao', 'admins_only', 'accent'], ['Hỏi đáp', 'hoi-dap', 'everyone', 'teal'], ['Chia sẻ', 'chia-se', 'everyone', 'accent'], ['Nhật ký', 'nhat-ky', 'everyone', 'gold'], ['Câu chuyện', 'cau-chuyen', 'premium', 'gold']];

function markOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'HM';
}

/** Kiểm tra slug hợp lệ và chưa dùng. */
export async function assertSlugAvailable(ctx: Ctx, slug: string, exceptId?: string): Promise<void> {
  if (RESERVED_SLUGS.has(slug)) throw invalid('Đường dẫn này được hệ thống dùng, chọn tên khác');
  const row = await ctx.db.query.communities.findFirst({ where: eq(communities.slug, slug), columns: { id: true } });
  if (row && row.id !== exceptId) throw conflict('Đường dẫn đã có hội khác dùng');
}

/** Tạo hội mới với tier, chuyên mục, plugin mặc định và chương trình cộng sự (tắt). */
export async function createCommunity(ctx: Ctx, input: CreateCommunityInput) {
  const userId = requireUser(ctx);
  const ws = input.workspaceId ? await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, input.workspaceId) }) : await ensureWorkspace(ctx, userId);
  if (!ws) throw notFound('Workspace không tồn tại');
  await assertWorkspaceUnlocked(ctx, ws.id);
  await assertSlugAvailable(ctx, input.slug);
  const created = await ctx.db.transaction(async (tx) => {
    const [c] = await tx.insert(communities).values({ workspaceId: ws.id, name: input.name, slug: input.slug, shortDescription: input.shortDescription, description: input.description || input.shortDescription, category: input.category, logoMark: markOf(input.name), pricingMode: input.pricingMode, status: 'active', coverTagline: input.name }).returning();
    const hasFree = input.pricingMode === 'free' || input.pricingMode === 'freemium';
    const [standard] = await tx.insert(communityTiers).values({ communityId: c!.id, key: 'standard', name: 'Tiêu chuẩn', description: 'Mặc định khi tham gia', benefits: ['Đọc và đăng bài trên Bảng tin', 'Module 1 của mọi khóa học'], isDefault: hasFree, isActive: hasFree, sortOrder: 0 }).returning();
    const [premium] = await tx.insert(communityTiers).values({ communityId: c!.id, key: 'premium', name: 'Premium', description: 'Mở khóa toàn bộ', benefits: ['Mở khóa toàn bộ khóa học', 'Trở thành cộng sự', 'Q&A hàng tuần'], isDefault: !hasFree, isActive: input.pricingMode !== 'free', sortOrder: 1, monthlyMinor: input.pricingMode === 'one_time' ? null : (input.premiumMonthlyMinor ?? 249_000), yearlyMinor: input.pricingMode === 'one_time' ? null : (input.premiumYearlyMinor ?? 2_490_000), oneTimeMinor: input.pricingMode === 'one_time' ? (input.oneTimeMinor ?? 990_000) : null }).returning();
    await tx.insert(communityTiers).values({ communityId: c!.id, key: 'vip', name: 'VIP', description: 'Coaching 1-1', benefits: ['Coaching 1-1 hàng tuần'], isDefault: false, isActive: false, sortOrder: 2 });
    for (const [i, [name, slug, perm, color]] of DEFAULT_SPACES.entries()) await tx.insert(spaces).values({ communityId: c!.id, name, slug, postPermission: perm, colorKey: color, sortOrder: i });
    for (const [key, enabled] of [['welcome_dm', true], ['instant_approval', true], ['links', true], ['webhook', false], ['meta_pixel', false]] as const) {
      await tx.insert(communityPlugins).values({ communityId: c!.id, pluginKey: key, enabled, config: key === 'welcome_dm' ? { senderUserId: userId, template: 'Chào {{tên}}, chào mừng bạn đến với {{cộng đồng}}. Bạn bắt đầu ở mục “Bắt đầu tại đây” nhé, có gì cứ nhắn mình ở đây.', delayMinutes: 2, includeStartLink: true } : {} });
    }
    await tx.insert(affiliatePrograms).values({ scopeType: 'community', communityId: c!.id, workspaceId: ws.id, name: `Cộng sự ${input.name}`, status: 'paused', commissionRateBps: 4000, holdDays: 14, minWithdrawalMinor: 500_000, payerUserId: ws.ownerUserId });
    await tx.insert(communityMembers).values({ communityId: c!.id, userId: ws.ownerUserId, role: 'owner', status: 'active', tierId: premium!.id, level: 1 });
    await tx.update(communities).set({ memberCount: 1 }).where(eq(communities.id, c!.id));
    await syncTierOffers(tx as unknown as Ctx['db'], c!.id, ws.id, [standard!, premium!]);
    return c!;
  });
  await audit(ctx, { action: 'community.create', resourceType: 'community', resourceId: created.id, workspaceId: ws.id, communityId: created.id });
  return created;
}

/** Đồng bộ offer/giá cho từng tier (tháng, năm, một lần). */
async function syncTierOffers(db: Ctx['db'], communityId: string, workspaceId: string, tiers: Array<typeof communityTiers.$inferSelect>): Promise<void> {
  for (const t of tiers) {
    for (const [cycle, amount] of [['monthly', t.monthlyMinor], ['yearly', t.yearlyMinor], ['one_time', t.oneTimeMinor]] as const) {
      if (!amount) continue;
      const existing = await db.query.offers.findFirst({ where: and(eq(offers.resourceType, 'tier'), eq(offers.resourceId, t.id), eq(offers.cycle, cycle)) });
      const offerId = existing?.id ?? (await db.insert(offers).values({ workspaceId, communityId, resourceType: 'tier', resourceId: t.id, name: `${t.name} · ${cycle}`, cycle }).returning())[0]!.id;
      await db.update(prices).set({ isActive: false }).where(eq(prices.offerId, offerId));
      await db.insert(prices).values({ offerId, amountMinor: amount, isActive: true });
    }
  }
}

/** Hội theo slug (kể cả bản nháp cho chủ hội). */
export async function getCommunityBySlug(ctx: Ctx, slug: string) {
  const c = await ctx.db.query.communities.findFirst({ where: and(eq(communities.slug, slug), isNull(communities.deletedAt)) });
  if (!c) throw notFound('Hội không tồn tại');
  return c;
}

/** Dữ liệu trang giới thiệu hội (đích của link hội): công khai, kèm trạng thái của người xem nếu đã đăng nhập. */
export async function aboutPage(ctx: Ctx, slug: string, ref?: string | null) {
  const c = await getCommunityBySlug(ctx, slug);
  const [tiers, owner, courseList, members, questions] = await Promise.all([
    ctx.db.query.communityTiers.findMany({ where: and(eq(communityTiers.communityId, c.id), eq(communityTiers.isActive, true)), orderBy: asc(communityTiers.sortOrder) }),
    ctx.db.select({ u: users }).from(workspaces).innerJoin(users, eq(users.id, workspaces.ownerUserId)).where(eq(workspaces.id, c.workspaceId)).then((r) => r[0]?.u ?? null),
    ctx.db.query.courses.findMany({ where: and(eq(courses.communityId, c.id), eq(courses.status, 'published'), isNull(courses.deletedAt)), orderBy: asc(courses.sortOrder), columns: { id: true, title: true, slug: true, coverColor: true, coverUrl: true, lessonCount: true, accessMode: true, priceMinor: true } }),
    ctx.db.select({ u: { id: users.id, name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor } }).from(communityMembers).innerJoin(users, eq(users.id, communityMembers.userId)).where(and(eq(communityMembers.communityId, c.id), eq(communityMembers.status, 'active'))).orderBy(desc(communityMembers.lastActiveAt)).limit(6),
    ctx.db.query.communityJoinQuestions.findMany({ where: eq(communityJoinQuestions.communityId, c.id), orderBy: asc(communityJoinQuestions.sortOrder) }),
  ]);
  const access = ctx.actor.type === 'user' ? await resolveCommunityAccess(ctx, c.id) : null;
  let referrer: { name: string } | null = null;
  if (ref) {
    const r = await raw(ctx.db, sql`select u.name from affiliate_accounts a join users u on u.id = a.user_id where a.affiliate_code = ${ref} limit 1`);
    referrer = (r[0] as { name: string } | undefined) ?? null;
  }
  const onlineSince = new Date(ctx.now().getTime() - 15 * 60_000);
  const [online] = await ctx.db.select({ c: sql<number>`count(*)::int` }).from(communityMembers).where(and(eq(communityMembers.communityId, c.id), gte(communityMembers.lastActiveAt, onlineSince)));
  const premium = tiers.find((t) => t.key === 'premium');
  return {
    community: c, tiers, owner: owner ? { id: owner.id, name: owner.name, handle: owner.handle, avatarUrl: owner.avatarUrl, coverColor: owner.coverColor, bio: owner.bio } : null,
    courses: courseList, sampleMembers: members.map((m) => m.u), joinQuestions: questions, referrer,
    stats: { members: c.memberCount, online: online?.c ?? 0, courses: courseList.length, paid: c.paidMemberCount },
    viewer: access ? { role: access.role, memberStatus: access.memberStatus, tierId: access.tierId } : null,
    pricing: { mode: c.pricingMode, doorsOpen: c.doorsOpen, premiumMonthlyMinor: premium?.monthlyMinor ?? null, premiumYearlyMinor: premium?.yearlyMinor ?? null, oneTimeMinor: premium?.oneTimeMinor ?? null },
  };
}

/** Cài đặt · Chung. */
export async function updateGeneral(ctx: Ctx, communityId: string, input: { name?: string; slug?: string; shortDescription?: string; description?: string; category?: string; rules?: string[]; logoUrl?: string | null; coverUrl?: string | null; introVideoUrl?: string | null; customDomain?: string | null; discoverable?: boolean; links?: Array<{ label: string; url: string }> }) {
  await requireCommunityPermission(ctx, communityId, 'settings.manage');
  if (input.slug) await assertSlugAvailable(ctx, input.slug, communityId);
  const patch: Partial<typeof communities.$inferInsert> = { updatedAt: ctx.now() };
  for (const k of ['name', 'slug', 'shortDescription', 'description', 'category', 'rules', 'logoUrl', 'coverUrl', 'introVideoUrl', 'customDomain', 'discoverable', 'links'] as const) {
    if (input[k] !== undefined) (patch as Record<string, unknown>)[k] = input[k];
  }
  if (input.name) patch.logoMark = markOf(input.name);
  const [row] = await ctx.db.update(communities).set(patch).where(eq(communities.id, communityId)).returning();
  await audit(ctx, { action: 'community.update_general', resourceType: 'community', resourceId: communityId, communityId, metadata: { keys: Object.keys(patch) } });
  return row!;
}

/** Cài đặt · Giá và gói: đổi pricing mode, tier, cách thanh toán, đóng cổng, xếp thành viên trả phí cũ (mục 187). */
export async function updatePricing(ctx: Ctx, communityId: string, input: UpdatePricingInput) {
  const access = await requireCommunityPermission(ctx, communityId, 'billing.manage');
  const pendingSubs = await raw(ctx.db, sql`select count(*)::int as c from orders where community_id = ${communityId} and target_type = 'tier' and status = 'pending' and created_at > now() - interval '30 minutes'`);
  if (Number((pendingSubs[0] as { c: number }).c) > 0 && input.pricingMode !== (await getCommunityById(ctx, communityId)).pricingMode) throw conflict('Có thanh toán đang xử lý, đợi xong rồi đổi kiểu thu phí');
  await ctx.db.transaction(async (tx) => {
    await tx.update(communities).set({ pricingMode: input.pricingMode, doorsOpen: input.doorsOpen, enabledProviders: input.enabledProviders, updatedAt: ctx.now() }).where(eq(communities.id, communityId));
    const saved: Array<typeof communityTiers.$inferSelect> = [];
    for (const t of input.tiers) {
      const values = { communityId, key: t.key, name: t.name, description: t.description, benefits: t.benefits, isDefault: input.pricingMode === 'free' || input.pricingMode === 'freemium' ? t.key === 'standard' : t.key === 'premium', isActive: t.isActive, monthlyMinor: t.monthlyMinor ?? null, yearlyMinor: t.yearlyMinor ?? null, oneTimeMinor: t.oneTimeMinor ?? null, updatedAt: ctx.now() };
      const [row] = await tx.insert(communityTiers).values(values).onConflictDoUpdate({ target: [communityTiers.communityId, communityTiers.key], set: values }).returning();
      saved.push(row!);
    }
    await syncTierOffers(tx as unknown as Ctx['db'], communityId, access.workspaceId, saved);
    if (input.migrateExistingPaidToTierKey) {
      const target = saved.find((t) => t.key === input.migrateExistingPaidToTierKey);
      if (target) await tx.update(communityMembers).set({ tierId: target.id }).where(and(eq(communityMembers.communityId, communityId), sql`${communityMembers.lifetimeValueCents} > 0`));
    }
  });
  await audit(ctx, { action: 'community.update_pricing', resourceType: 'community', resourceId: communityId, communityId, metadata: { mode: input.pricingMode, doorsOpen: input.doorsOpen } });
  return pricingSettings(ctx, communityId);
}

/** Đọc màn Giá và gói. */
export async function pricingSettings(ctx: Ctx, communityId: string) {
  await requireCommunityPermission(ctx, communityId, 'settings.manage');
  const c = await getCommunityById(ctx, communityId);
  const tiers = await ctx.db.query.communityTiers.findMany({ where: eq(communityTiers.communityId, communityId), orderBy: asc(communityTiers.sortOrder) });
  const [paid] = await ctx.db.select({ c: sql<number>`count(*)::int` }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), sql`${communityMembers.lifetimeValueCents} > 0`));
  return { pricingMode: c.pricingMode, doorsOpen: c.doorsOpen, enabledProviders: c.enabledProviders, tiers, paidMembersCount: paid?.c ?? 0 };
}

export async function getCommunityById(ctx: Ctx, id: string) {
  const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, id) });
  if (!c) throw notFound('Hội không tồn tại');
  return c;
}

/** Plugins (Tiện ích). */
export async function listPlugins(ctx: Ctx, communityId: string) {
  await requireCommunityPermission(ctx, communityId, 'settings.manage');
  return ctx.db.query.communityPlugins.findMany({ where: eq(communityPlugins.communityId, communityId) });
}
export async function updatePlugin(ctx: Ctx, communityId: string, pluginKey: string, input: { enabled: boolean; config: Record<string, unknown> }) {
  await requireCommunityPermission(ctx, communityId, 'settings.manage');
  const existing = await ctx.db.query.communityPlugins.findFirst({ where: and(eq(communityPlugins.communityId, communityId), eq(communityPlugins.pluginKey, pluginKey)) });
  const config = { ...(existing?.config ?? {}), ...input.config };
  const [row] = await ctx.db.insert(communityPlugins).values({ communityId, pluginKey, enabled: input.enabled, config, updatedAt: ctx.now() }).onConflictDoUpdate({ target: [communityPlugins.communityId, communityPlugins.pluginKey], set: { enabled: input.enabled, config, updatedAt: ctx.now() } }).returning();
  await audit(ctx, { action: 'plugin.update', resourceType: 'community_plugin', resourceId: pluginKey, communityId, metadata: { enabled: input.enabled } });
  return row!;
}

/** Cài đặt · Bảng tin: tab, chuyên mục và quyền đăng. */
export async function feedSettings(ctx: Ctx, communityId: string) {
  await requireCommunityPermission(ctx, communityId, 'settings.manage');
  const c = await getCommunityById(ctx, communityId);
  const list = await ctx.db.query.spaces.findMany({ where: eq(spaces.communityId, communityId), orderBy: asc(spaces.sortOrder) });
  return { tabs: c.tabs, requireSpace: c.requireSpace, moderateNewMembersDays: c.moderateNewMembersDays, spaces: list };
}
export async function updateFeedSettings(ctx: Ctx, communityId: string, input: { tabs?: Record<string, boolean>; requireSpace?: boolean; moderateNewMembersDays?: number; spaces?: Array<{ id?: string; name: string; postPermission: 'everyone' | 'admins_only' | 'premium'; sortOrder: number }> }) {
  await requireCommunityPermission(ctx, communityId, 'settings.manage');
  const c = await getCommunityById(ctx, communityId);
  await ctx.db.transaction(async (tx) => {
    await tx.update(communities).set({ tabs: { ...c.tabs, ...(input.tabs ?? {}), feed: true, about: true }, requireSpace: input.requireSpace ?? c.requireSpace, moderateNewMembersDays: input.moderateNewMembersDays ?? c.moderateNewMembersDays, updatedAt: ctx.now() }).where(eq(communities.id, communityId));
    if (input.spaces) {
      const keep: string[] = [];
      for (const s of input.spaces) {
        const { toSlug } = await import('@hoiminh/contracts');
        if (s.id) {
          await tx.update(spaces).set({ name: s.name, postPermission: s.postPermission, sortOrder: s.sortOrder, updatedAt: ctx.now() }).where(and(eq(spaces.id, s.id), eq(spaces.communityId, communityId)));
          keep.push(s.id);
        } else {
          const [row] = await tx.insert(spaces).values({ communityId, name: s.name, slug: `${toSlug(s.name)}-${Date.now().toString(36).slice(-3)}`, postPermission: s.postPermission, sortOrder: s.sortOrder }).returning();
          keep.push(row!.id);
        }
      }
      const all = await tx.query.spaces.findMany({ where: eq(spaces.communityId, communityId), columns: { id: true, postCount: true } });
      const removable = all.filter((s) => !keep.includes(s.id) && s.postCount === 0).map((s) => s.id);
      if (removable.length) await tx.delete(spaces).where(inArray(spaces.id, removable));
    }
  });
  await audit(ctx, { action: 'community.update_feed', resourceType: 'community', resourceId: communityId, communityId });
  return feedSettings(ctx, communityId);
}

/** Câu hỏi khi tham gia (tối đa 3). */
export async function setJoinQuestions(ctx: Ctx, communityId: string, questions: Array<{ id?: string; question: string; required: boolean; sortOrder: number }>) {
  await requireCommunityPermission(ctx, communityId, 'settings.manage');
  if (questions.length > 3) throw invalid('Tối đa 3 câu hỏi');
  await ctx.db.delete(communityJoinQuestions).where(eq(communityJoinQuestions.communityId, communityId));
  if (questions.length) await ctx.db.insert(communityJoinQuestions).values(questions.map((q) => ({ communityId, question: q.question, required: q.required, sortOrder: q.sortOrder })));
  return ctx.db.query.communityJoinQuestions.findMany({ where: eq(communityJoinQuestions.communityId, communityId), orderBy: asc(communityJoinQuestions.sortOrder) });
}

/** Khám phá: hội công khai có bật discoverable, xếp theo hoạt động 7 ngày (mục 198). */
export async function discover(ctx: Ctx, q: { category?: string; search?: string; limit?: number }) {
  const conds = [eq(communities.discoverable, true), eq(communities.status, 'active'), isNull(communities.deletedAt)];
  if (q.category) conds.push(eq(communities.category, q.category));
  if (q.search) conds.push(sql`(${communities.name} ilike ${'%' + q.search + '%'} or ${communities.shortDescription} ilike ${'%' + q.search + '%'})`);
  const rows = await ctx.db
    .select({ c: communities, premium: communityTiers, activity: sql<number>`(select count(*)::int from posts p where p.community_id = ${communities.id} and p.created_at > now() - interval '7 days')` })
    .from(communities)
    .leftJoin(communityTiers, and(eq(communityTiers.communityId, communities.id), eq(communityTiers.key, 'premium')))
    .where(and(...conds))
    .orderBy(desc(sql`(select count(*) from posts p where p.community_id = ${communities.id} and p.created_at > now() - interval '7 days')`), desc(communities.memberCount))
    .limit(q.limit ?? 24);
  return rows.map((r) => ({ id: r.c.id, name: r.c.name, slug: r.c.slug, shortDescription: r.c.shortDescription, category: r.c.category, logoMark: r.c.logoMark, logoColor: r.c.logoColor, coverColor: r.c.coverColor, coverUrl: r.c.coverUrl, memberCount: r.c.memberCount, pricingMode: r.c.pricingMode, priceLabel: priceLabel(r.c.pricingMode, r.premium), activity7d: r.activity }));
}

function priceLabel(mode: string, premium: typeof communityTiers.$inferSelect | null): string {
  if (mode === 'free' || mode === 'freemium') return 'Miễn phí';
  if (mode === 'one_time') return premium?.oneTimeMinor ? `${premium.oneTimeMinor.toLocaleString('vi-VN')}đ trọn đời` : 'Trả một lần';
  if (premium?.monthlyMinor) return `${premium.monthlyMinor.toLocaleString('vi-VN')}đ/tháng`;
  if (premium?.yearlyMinor) return `${premium.yearlyMinor.toLocaleString('vi-VN')}đ/năm`;
  return 'Thu phí';
}

/** Lưu trữ hội (ẩn, giữ dữ liệu). */
export async function archiveCommunity(ctx: Ctx, communityId: string) {
  await requireCommunityPermission(ctx, communityId, 'community.manage');
  await ctx.db.update(communities).set({ status: 'archived', discoverable: false, updatedAt: ctx.now() }).where(eq(communities.id, communityId));
  await audit(ctx, { action: 'community.archive', resourceType: 'community', resourceId: communityId, communityId });
}
