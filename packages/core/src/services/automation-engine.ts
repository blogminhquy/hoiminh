// Bộ máy quy tắc tự động: liên hệ được gắn thẻ thì chạy các quy tắc của thẻ đó (cấp hội viên, mở khóa học, gửi email).
// Khách chưa có tài khoản thì quyền được GIỮ theo email (automation_grants.status = pending) và email mời kích hoạt
// đi kèm một link; bấm link, đặt mật khẩu một lần là quyền vào tài khoản. Gỡ thẻ hoặc hết hạn thì thu hồi đúng phần
// quy tắc đã cấp. Không sửa Entitlement Engine: entitlement ở đây mang nguồn `automation`, source_id là id dòng grant.
import { randomToken, sha256Hex } from '@hoiminh/config';
import type { AuthSession } from '@hoiminh/contracts';
import { templates } from '@hoiminh/email';
import { and, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import { automationGrants, automationRules, automationRuns, communities, communityMembers, communityTiers, contactClaims, contacts, courses, entitlements, users, workspaces, type AutomationAction, type AutomationActionResult, type AutomationTrigger } from '@hoiminh/db';
import type { AuthProvider } from '../auth/providers';
import { pendingClaimOf } from '../auth/claims';
import { claimPendingAccount, registerVerified } from '../auth/service';
import type { Ctx } from '../context';
import { forbidden, invalid } from '../errors';
import { elevated } from '../lib/elevated';
import { hasRoomForMember, workspaceHasFeature } from './plans';

type Contact = typeof contacts.$inferSelect;
type Grant = typeof automationGrants.$inferSelect;
type Rule = typeof automationRules.$inferSelect;
type User = typeof users.$inferSelect;

export const CLAIM_TTL_DAYS = 30;

export { elevated } from '../lib/elevated';

/** Tài khoản đủ điều kiện nhận quyền ngay: trùng email, đang hoạt động và email đã xác minh. */
async function verifiedUserFor(ctx: Ctx, email: string): Promise<User | null> {
  const user = await ctx.db.query.users.findFirst({ where: eq(users.email, email) });
  return user && user.status === 'active' && user.emailVerifiedAt ? user : null;
}

/** Tên dễ đọc của một quyền, dùng trong email và màn quản trị. */
export async function grantTitle(ctx: Ctx, g: Pick<Grant, 'kind' | 'communityId' | 'resourceId'>): Promise<string> {
  if (g.kind === 'course') {
    const course = await ctx.db.query.courses.findFirst({ where: eq(courses.id, g.resourceId), columns: { title: true } });
    return `Khóa học ${course?.title ?? '(đã xóa)'}`;
  }
  const [tier, community] = await Promise.all([
    ctx.db.query.communityTiers.findFirst({ where: eq(communityTiers.id, g.resourceId), columns: { name: true } }),
    g.communityId ? ctx.db.query.communities.findFirst({ where: eq(communities.id, g.communityId), columns: { name: true } }) : null,
  ]);
  return `Hội viên ${tier?.name ?? ''} của ${community?.name ?? '(hội đã xóa)'}`.replace(/\s+/g, ' ');
}

/**
 * Tên đứng ở đầu email gửi cho khách: tên hội gắn với quyền được cấp, không có thì hội đầu tiên của workspace.
 * Không dùng tên workspace vì đó là tên nội bộ ("Workspace của ..."), khách không nhận ra.
 */
export async function senderName(ctx: Ctx, workspaceId: string, communityId?: string | null): Promise<string> {
  const preferred = communityId ? await ctx.db.query.communities.findFirst({ where: and(eq(communities.id, communityId), eq(communities.workspaceId, workspaceId)), columns: { name: true } }) : null;
  if (preferred) return preferred.name;
  const first = await ctx.db.query.communities.findFirst({ where: and(eq(communities.workspaceId, workspaceId), isNull(communities.deletedAt)), columns: { name: true }, orderBy: (t, { asc }) => asc(t.createdAt) });
  if (first) return first.name;
  const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId), columns: { name: true } });
  return ws?.name ?? 'Hội Mình';
}

/** Ghi entitlement nguồn `automation` cho một grant (ghi đè nếu đã có, để chạy lại không sinh dòng trùng). */
async function writeEntitlement(ctx: Ctx, p: { userId: string; workspaceId: string; communityId: string | null; resourceType: 'tier' | 'course'; resourceId: string; grantId: string; expiresAt: Date | null }): Promise<void> {
  const existing = await ctx.db.query.entitlements.findFirst({ where: and(eq(entitlements.userId, p.userId), eq(entitlements.resourceType, p.resourceType), eq(entitlements.resourceId, p.resourceId), eq(entitlements.sourceType, 'automation'), eq(entitlements.sourceId, p.grantId)) });
  if (existing) {
    await ctx.db.update(entitlements).set({ status: 'active', revokedAt: null, expiresAt: p.expiresAt, updatedAt: ctx.now() }).where(eq(entitlements.id, existing.id));
    return;
  }
  await ctx.db.insert(entitlements).values({ userId: p.userId, workspaceId: p.workspaceId, communityId: p.communityId, resourceType: p.resourceType, resourceId: p.resourceId, sourceType: 'automation', sourceId: p.grantId, expiresAt: p.expiresAt });
}

interface ApplyResult { status: 'applied' | 'skipped'; detail: string; expiresAt: Date | null }

async function applyMembership(ctx: Ctx, g: Grant, user: User): Promise<ApplyResult> {
  const skip = (detail: string): ApplyResult => ({ status: 'skipped', detail, expiresAt: null });
  const [tier, community] = await Promise.all([
    ctx.db.query.communityTiers.findFirst({ where: eq(communityTiers.id, g.resourceId) }),
    g.communityId ? ctx.db.query.communities.findFirst({ where: eq(communities.id, g.communityId) }) : null,
  ]);
  if (!tier || !community || community.deletedAt) return skip('Hội hoặc gói không còn');
  const member = await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, community.id), eq(communityMembers.userId, user.id)) });
  if (member?.status === 'banned') return skip('Tài khoản đang bị chặn ở hội này');
  if (member && member.role !== 'member') return skip('Người này đang quản lý hội, giữ nguyên');
  const wasActive = Boolean(member && (member.status === 'active' || member.status === 'cancelling'));
  if (wasActive && member!.subscriptionId) return skip('Đang có gói trả phí riêng, giữ nguyên');
  // Người mới mà hội đã chạm trần thành viên của gói: không thêm, ghi rõ lý do để chủ hội thấy trong nhật ký chạy.
  if (!wasActive && !(await hasRoomForMember(ctx, community.id))) return skip('Hội đã đủ thành viên theo gói đang dùng, chưa thêm được người mới. Nâng gói rồi gắn lại thẻ để cấp lại.');
  const now = ctx.now();
  const expiresAt = g.durationDays ? new Date(now.getTime() + g.durationDays * 86_400_000) : null;
  const fromTierId = member?.tierId ?? null;
  const values = { tierId: tier.id, status: 'active' as const, churnedAt: null, updatedAt: now };
  let memberId: string;
  if (member) {
    await ctx.db.update(communityMembers).set(values).where(eq(communityMembers.id, member.id));
    memberId = member.id;
  } else {
    const [row] = await ctx.db.insert(communityMembers).values({ communityId: community.id, userId: user.id, role: 'member', source: 'direct', joinedAt: now, lastActiveAt: now, ...values }).returning();
    memberId = row!.id;
  }
  if (!wasActive) await ctx.db.update(communities).set({ memberCount: sql`${communities.memberCount} + 1` }).where(eq(communities.id, community.id));
  if (tier.key !== 'standard' && fromTierId !== tier.id) await ctx.db.update(communities).set({ paidMemberCount: sql`${communities.paidMemberCount} + 1` }).where(eq(communities.id, community.id));
  await ctx.db.update(entitlements).set({ status: 'revoked', revokedAt: now, updatedAt: now }).where(and(eq(entitlements.userId, user.id), eq(entitlements.communityId, community.id), eq(entitlements.resourceType, 'tier'), eq(entitlements.status, 'active')));
  await writeEntitlement(ctx, { userId: user.id, workspaceId: community.workspaceId, communityId: community.id, resourceType: 'tier', resourceId: tier.id, grantId: g.id, expiresAt });
  if (!wasActive) await ctx.events.emit('member.joined', { communityId: community.id, userId: user.id, memberId, source: 'direct', referredByAffiliateId: member?.referredByAffiliateId ?? null });
  if (fromTierId !== tier.id) await ctx.events.emit('member.tier_changed', { communityId: community.id, userId: user.id, memberId, fromTierId, toTierId: tier.id, reason: 'automation' });
  return { status: 'applied', detail: expiresAt ? `Đã vào hội, hạn dùng ${g.durationDays} ngày` : 'Đã vào hội', expiresAt };
}

async function applyCourse(ctx: Ctx, g: Grant, user: User): Promise<ApplyResult> {
  const course = await ctx.db.query.courses.findFirst({ where: eq(courses.id, g.resourceId), columns: { id: true, deletedAt: true, communityId: true, workspaceId: true } });
  if (!course || course.deletedAt) return { status: 'skipped', detail: 'Khóa học không còn', expiresAt: null };
  await writeEntitlement(ctx, { userId: user.id, workspaceId: course.workspaceId, communityId: course.communityId, resourceType: 'course', resourceId: course.id, grantId: g.id, expiresAt: null });
  return { status: 'applied', detail: 'Đã mở khóa học', expiresAt: null };
}

/** Đưa một quyền đang giữ vào tài khoản. */
async function applyGrant(ctx: Ctx, g: Grant, user: User): Promise<ApplyResult> {
  const r = g.kind === 'membership' ? await applyMembership(ctx, g, user) : await applyCourse(ctx, g, user);
  const now = ctx.now();
  await ctx.db.update(automationGrants).set({ status: r.status, detail: r.detail, grantedUserId: user.id, appliedAt: r.status === 'applied' ? now : null, expiresAt: r.expiresAt, revokedAt: null, updatedAt: now }).where(eq(automationGrants.id, g.id));
  return r;
}

/** Trả thành viên về gói mặc định (hội miễn phí, freemium) hoặc cho rời hội (hội thu phí), nếu họ vẫn ở đúng gói đã cấp. */
async function undoMembership(ctx: Ctx, g: Grant): Promise<void> {
  if (!g.communityId || !g.grantedUserId) return;
  const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, g.communityId) });
  const member = await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, g.communityId), eq(communityMembers.userId, g.grantedUserId)) });
  if (!community || !member || member.role !== 'member' || member.tierId !== g.resourceId || member.subscriptionId) return;
  if (member.status !== 'active' && member.status !== 'cancelling') return;
  const granted = await ctx.db.query.communityTiers.findFirst({ where: eq(communityTiers.id, g.resourceId), columns: { key: true } });
  const fallback = await ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, community.id), eq(communityTiers.isDefault, true)) });
  const keepMember = community.pricingMode === 'free' || community.pricingMode === 'freemium';
  const now = ctx.now();
  if (keepMember && fallback?.id === g.resourceId) return;
  await ctx.db.update(communityMembers).set(keepMember ? { tierId: fallback?.id ?? null, updatedAt: now } : { status: 'churned', tierId: null, churnedAt: now, updatedAt: now }).where(eq(communityMembers.id, member.id));
  if (!keepMember) await ctx.db.update(communities).set({ memberCount: sql`greatest(${communities.memberCount} - 1, 0)` }).where(eq(communities.id, community.id));
  if (granted && granted.key !== 'standard') await ctx.db.update(communities).set({ paidMemberCount: sql`greatest(${communities.paidMemberCount} - 1, 0)` }).where(eq(communities.id, community.id));
  await ctx.events.emit('member.tier_changed', { communityId: community.id, userId: member.userId, memberId: member.id, fromTierId: g.resourceId, toTierId: keepMember ? (fallback?.id ?? null) : null, reason: 'automation_revoked' });
  if (!keepMember) await ctx.events.emit('member.removed', { communityId: community.id, userId: member.userId, memberId: member.id });
}

/** Thu hồi một quyền: đang giữ thì bỏ, đã cấp thì gỡ entitlement và trả lại gói cũ. */
export async function revokeGrant(ctx: Ctx, g: Grant, status: 'revoked' | 'expired'): Promise<void> {
  const now = ctx.now();
  if (g.status === 'applied') {
    await ctx.db.update(entitlements).set({ status, revokedAt: now, updatedAt: now }).where(and(eq(entitlements.sourceType, 'automation'), eq(entitlements.sourceId, g.id), eq(entitlements.status, 'active')));
    if (g.kind === 'membership') await undoMembership(ctx, g);
  }
  await ctx.db.update(automationGrants).set({ status, detail: status === 'expired' ? 'Hết hạn dùng' : 'Đã thu hồi', revokedAt: now, updatedAt: now }).where(eq(automationGrants.id, g.id));
}

/** Tạo link kích hoạt mới cho liên hệ. Chỉ lưu bản băm; chuỗi gốc chỉ nằm trong email. */
export async function createClaim(ctx: Ctx, contact: Contact): Promise<string> {
  const token = randomToken(24);
  await ctx.db.insert(contactClaims).values({ workspaceId: contact.workspaceId, contactId: contact.id, tokenHash: await sha256Hex(token), expiresAt: new Date(ctx.now().getTime() + CLAIM_TTL_DAYS * 86_400_000) });
  return token;
}

export const activationUrl = (ctx: Ctx, token: string) => `${ctx.env.APP_URL}/kich-hoat?token=${token}`;
export const unsubscribeUrl = (ctx: Ctx, contact: Pick<Contact, 'unsubscribeToken'>) => `${ctx.env.API_URL}/webhooks/unsubscribe/${contact.unsubscribeToken}`;

/** Nơi khách vào xem một quyền đã cấp. */
async function grantLink(ctx: Ctx, g: Pick<Grant, 'kind' | 'communityId'>): Promise<string> {
  if (g.kind === 'membership' && g.communityId) {
    const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, g.communityId), columns: { slug: true } });
    if (c) return `${ctx.env.APP_URL}/${c.slug}/hom-nay`;
  }
  return `${ctx.env.APP_URL}/hoc`;
}

/** Thay biến {{name}}, {{email}}, {{tag}}, {{access_link}} trong tiêu đề và nội dung email. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, key: string) => vars[key.toLowerCase()] ?? whole);
}

interface ResolvedGrant { kind: 'membership' | 'course'; communityId: string | null; resourceId: string; durationDays: number | null }

/** Đổi một hành động cấp quyền thành tài nguyên cụ thể trong workspace; null nếu hội, gói hoặc khóa học không còn. */
async function resolveGrantAction(ctx: Ctx, workspaceId: string, a: AutomationAction): Promise<ResolvedGrant | null> {
  if (a.type === 'grant_membership') {
    const community = await ctx.db.query.communities.findFirst({ where: and(eq(communities.id, a.communityId), eq(communities.workspaceId, workspaceId)), columns: { id: true, deletedAt: true } });
    if (!community || community.deletedAt) return null;
    const tier = await ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, community.id), eq(communityTiers.key, a.tierKey)), columns: { id: true } });
    return tier ? { kind: 'membership', communityId: community.id, resourceId: tier.id, durationDays: a.durationDays ?? null } : null;
  }
  if (a.type === 'grant_course') {
    const course = await ctx.db.query.courses.findFirst({ where: and(eq(courses.id, a.courseId), eq(courses.workspaceId, workspaceId)), columns: { id: true, communityId: true, deletedAt: true } });
    return course && !course.deletedAt ? { kind: 'course', communityId: course.communityId, resourceId: course.id, durationDays: null } : null;
  }
  return null;
}

/** Chạy một quy tắc cho một liên hệ vừa được gắn thẻ. Trả về kết quả từng hành động (cũng được ghi vào nhật ký chạy). */
export async function runRule(ctx: Ctx, rule: Rule, contact: Contact, tagName: string): Promise<AutomationActionResult[]> {
  const results: AutomationActionResult[] = [];
  const user = await verifiedUserFor(ctx, contact.email);
  if (user && contact.linkedUserId !== user.id) await ctx.db.update(contacts).set({ linkedUserId: user.id, updatedAt: ctx.now() }).where(eq(contacts.id, contact.id));
  const pendingTitles: string[] = [];
  let appliedLink: string | null = null;
  let hasGrantAction = false;
  let senderCommunityId: string | null = null;
  for (const action of rule.actions) {
    if (action.type === 'send_email') continue;
    hasGrantAction = true;
    const target = await resolveGrantAction(ctx, rule.workspaceId, action);
    if (!target) { results.push({ type: action.type, status: 'failed', detail: 'Hội, gói hoặc khóa học trong quy tắc không còn' }); continue; }
    senderCommunityId ??= target.communityId;
    const existing = await ctx.db.query.automationGrants.findFirst({ where: and(eq(automationGrants.ruleId, rule.id), eq(automationGrants.contactId, contact.id), eq(automationGrants.kind, target.kind), eq(automationGrants.resourceId, target.resourceId)) });
    let grant: Grant;
    if (existing?.status === 'applied') {
      results.push({ type: action.type, status: 'skipped', detail: 'Đã cấp từ lần trước' });
      appliedLink ??= await grantLink(ctx, existing);
      continue;
    }
    if (existing) {
      [grant] = (await ctx.db.update(automationGrants).set({ status: 'pending', detail: '', durationDays: target.durationDays, communityId: target.communityId, revokedAt: null, expiresAt: null, updatedAt: ctx.now() }).where(eq(automationGrants.id, existing.id)).returning()) as [Grant];
    } else {
      [grant] = (await ctx.db.insert(automationGrants).values({ workspaceId: rule.workspaceId, ruleId: rule.id, contactId: contact.id, kind: target.kind, communityId: target.communityId, resourceId: target.resourceId, durationDays: target.durationDays }).returning()) as [Grant];
    }
    if (user) {
      const r = await applyGrant(ctx, grant, user);
      results.push({ type: action.type, status: r.status === 'applied' ? 'done' : 'skipped', detail: r.detail });
      if (r.status === 'applied') appliedLink ??= await grantLink(ctx, grant);
    } else {
      pendingTitles.push(await grantTitle(ctx, grant));
      results.push({ type: action.type, status: 'pending', detail: 'Giữ theo email, chờ khách bấm link kích hoạt' });
    }
  }

  const sender = await senderName(ctx, rule.workspaceId, senderCommunityId);
  const needsActivation = pendingTitles.length > 0;
  const accessLink = needsActivation ? activationUrl(ctx, await createClaim(ctx, contact)) : (appliedLink ?? ctx.env.APP_URL);
  const vars = { name: contact.name || 'bạn', email: contact.email, tag: tagName, access_link: accessLink };
  const unsub = unsubscribeUrl(ctx, contact);
  let linkDelivered = false;
  for (const action of rule.actions) {
    if (action.type !== 'send_email') continue;
    if (contact.unsubscribedAt) { results.push({ type: 'send_email', status: 'skipped', detail: 'Liên hệ đã ngừng nhận email' }); continue; }
    const cta = hasGrantAction ? { label: needsActivation ? 'Kích hoạt và vào xem' : 'Vào xem ngay', url: accessLink } : undefined;
    await ctx.email.send(templates.automationEmail(contact.email, { sender, subject: renderTemplate(action.subject, vars), body: renderTemplate(action.body, vars), cta, unsubscribeUrl: unsub }));
    linkDelivered = true;
    results.push({ type: 'send_email', status: 'done', detail: `Đã gửi tới ${contact.email}` });
  }
  // Quyền đang giữ mà chưa có email nào mang link kích hoạt (quy tắc không có bước gửi email, hoặc liên hệ đã ngừng
  // nhận email quảng bá): vẫn gửi thư mời kích hoạt, vì đây là thư giao hàng chứ không phải thư quảng bá.
  if (needsActivation && !linkDelivered) {
    await ctx.email.send(templates.activationInvite(contact.email, { sender, name: contact.name, items: pendingTitles, url: accessLink, unsubscribeUrl: unsub }));
    results.push({ type: 'activation_email', status: 'done', detail: `Đã gửi link kích hoạt tới ${contact.email}` });
  }
  await logRun(ctx, rule, contact.id, 'tag_added', results);
  return results;
}

async function logRun(ctx: Ctx, rule: Pick<Rule, 'id' | 'workspaceId'>, contactId: string, trigger: AutomationTrigger, results: AutomationActionResult[]): Promise<void> {
  await ctx.db.insert(automationRuns).values({ workspaceId: rule.workspaceId, ruleId: rule.id, contactId, trigger, results });
  if (trigger === 'tag_added') await ctx.db.update(automationRules).set({ runCount: sql`${automationRules.runCount} + 1`, lastRunAt: ctx.now() }).where(eq(automationRules.id, rule.id));
}

/** Liên hệ vừa được gắn thẻ: chạy mọi quy tắc đang bật của thẻ đó. */
export async function onTagAdded(ctx: Ctx, contact: Contact, tag: { id: string; name: string }): Promise<number> {
  const rules = await ctx.db.query.automationRules.findMany({ where: and(eq(automationRules.tagId, tag.id), eq(automationRules.enabled, true)), orderBy: (t, { asc }) => asc(t.createdAt) });
  // Tự động hóa là tính năng trả phí: workspace không còn hội nào có gói bật tự động hóa thì quy tắc ngừng chạy (quy tắc vẫn giữ).
  if (!rules.length || !(await workspaceHasFeature(ctx, rules[0]!.workspaceId, 'automation'))) return 0;
  for (const rule of rules) await runRule(ctx, rule, contact, tag.name);
  return rules.length;
}

/** Liên hệ vừa bị gỡ thẻ: quy tắc nào bật "gỡ thẻ thì thu hồi" sẽ thu hồi đúng phần nó đã cấp. */
export async function onTagRemoved(ctx: Ctx, contact: Contact, tag: { id: string; name: string }): Promise<number> {
  const rules = await ctx.db.query.automationRules.findMany({ where: and(eq(automationRules.tagId, tag.id), eq(automationRules.revokeOnTagRemoved, true)) });
  let revoked = 0;
  for (const rule of rules) {
    const grants = await ctx.db.query.automationGrants.findMany({ where: and(eq(automationGrants.ruleId, rule.id), eq(automationGrants.contactId, contact.id), inArray(automationGrants.status, ['pending', 'applied'])) });
    if (!grants.length) continue;
    const results: AutomationActionResult[] = [];
    for (const g of grants) {
      await revokeGrant(ctx, g, 'revoked');
      results.push({ type: g.kind === 'membership' ? 'grant_membership' : 'grant_course', status: 'revoked', detail: `Thu hồi: ${await grantTitle(ctx, g)}` });
      revoked++;
    }
    await logRun(ctx, rule, contact.id, 'tag_removed', results);
  }
  return revoked;
}

/** Đưa mọi quyền đang giữ theo email vào tài khoản vừa chứng minh được email đó (bấm link kích hoạt, xác minh email). */
export async function applyPendingGrantsForUser(ctx: Ctx, user: User): Promise<Grant[]> {
  const mine = await ctx.db.query.contacts.findMany({ where: eq(contacts.email, user.email.toLowerCase()) });
  if (!mine.length) return [];
  await ctx.db.update(contacts).set({ linkedUserId: user.id, updatedAt: ctx.now() }).where(and(inArray(contacts.id, mine.map((c) => c.id)), isNull(contacts.linkedUserId)));
  const pending = await ctx.db.query.automationGrants.findMany({ where: and(inArray(automationGrants.contactId, mine.map((c) => c.id)), eq(automationGrants.status, 'pending')) });
  const applied: Grant[] = [];
  for (const g of pending) if ((await applyGrant(ctx, g, user)).status === 'applied') applied.push(g);
  return applied;
}

async function findClaim(ctx: Ctx, token: string) {
  const claim = await ctx.db.query.contactClaims.findFirst({ where: and(eq(contactClaims.tokenHash, await sha256Hex(token)), gt(contactClaims.expiresAt, ctx.now())) });
  if (!claim) throw invalid('Link kích hoạt không hợp lệ hoặc đã hết hạn');
  const contact = await ctx.db.query.contacts.findFirst({ where: eq(contacts.id, claim.contactId) });
  if (!contact) throw invalid('Link kích hoạt không hợp lệ hoặc đã hết hạn');
  return { claim, contact };
}

/** Trang /kich-hoat đọc thông tin này: ai mời, mở những gì, người này đã có tài khoản chưa. */
export async function activationInfo(ctx: Ctx, token: string) {
  return elevated(ctx, async () => {
    const { claim, contact } = await findClaim(ctx, token);
    const [user, pending] = await Promise.all([
      ctx.db.query.users.findFirst({ where: eq(users.email, contact.email), columns: { id: true } }),
      ctx.db.query.automationGrants.findMany({ where: and(eq(automationGrants.contactId, contact.id), eq(automationGrants.status, 'pending')) }),
    ]);
    const items: string[] = [];
    for (const g of pending) items.push(await grantTitle(ctx, g));
    const sender = await senderName(ctx, contact.workspaceId, pending.find((g) => g.communityId)?.communityId);
    // Tài khoản chờ của người mua bằng email (chưa có mật khẩu) chưa tính là có tài khoản: trang kích hoạt hỏi đặt mật khẩu.
    const hasAccount = Boolean(user) && !(await pendingClaimOf(ctx, user!.id));
    return { email: contact.email, name: contact.name, sender, hasAccount, used: Boolean(claim.consumedAt), items };
  });
}

/**
 * Khách bấm link kích hoạt. Chưa có tài khoản: tạo tài khoản với mật khẩu vừa đặt (email coi như đã xác minh vì link
 * chỉ nằm trong hộp thư đó) và đăng nhập luôn. Đã có tài khoản: không tự đăng nhập hộ (tránh vượt qua xác thực hai
 * lớp), chỉ đưa quyền vào tài khoản rồi mời đăng nhập.
 */
export async function activate(ctx: Ctx, provider: AuthProvider, token: string, input: { name?: string; password?: string }, meta?: { userAgent?: string }): Promise<{ session: AuthSession | null; redirect: string; email: string; granted: string[] }> {
  return elevated(ctx, async () => {
    const { claim, contact } = await findClaim(ctx, token);
    let user = await ctx.db.query.users.findFirst({ where: eq(users.email, contact.email) });
    let session: AuthSession | null = null;
    if (user && user.status !== 'active') throw forbidden('Tài khoản đã bị tạm khóa');
    if (user && (await pendingClaimOf(ctx, user.id))) {
      // Email này đã mua ở hội khác mà chưa tạo tài khoản: đặt mật khẩu ở đây cũng là tạo tài khoản đó (link chứng minh email).
      if (claim.consumedAt) throw invalid('Link kích hoạt đã được dùng');
      if (!input.password || input.password.length < 8) throw invalid('Mật khẩu cần ít nhất 8 ký tự');
      const claimed = await claimPendingAccount(ctx, provider, user, { name: input.name ?? null, password: input.password, emailVerified: true }, meta);
      user = claimed.user;
      session = claimed.session;
    } else if (!user) {
      if (claim.consumedAt) throw invalid('Link kích hoạt đã được dùng');
      if (!input.password || input.password.length < 8) throw invalid('Mật khẩu cần ít nhất 8 ký tự');
      const name = (input.name ?? '').trim() || contact.name || contact.email.split('@')[0]!;
      const created = await registerVerified(ctx, provider, { email: contact.email, name, password: input.password }, meta);
      user = created.user;
      session = created.session;
    } else if (!user.emailVerifiedAt) {
      [user] = await ctx.db.update(users).set({ emailVerifiedAt: ctx.now(), updatedAt: ctx.now() }).where(eq(users.id, user.id)).returning();
    }
    await ctx.db.update(contactClaims).set({ consumedAt: ctx.now() }).where(and(eq(contactClaims.id, claim.id), isNull(contactClaims.consumedAt)));
    const applied = await applyPendingGrantsForUser(ctx, user!);
    const granted: string[] = [];
    for (const g of applied) granted.push(await grantTitle(ctx, g));
    const redirect = applied[0] ? (await grantLink(ctx, applied[0])).replace(ctx.env.APP_URL, '') : '/hoc';
    return { session, redirect, email: contact.email, granted };
  });
}

/** Cron hằng ngày: quyền có hạn dùng đã quá hạn thì thu hồi (hội viên về gói mặc định hoặc rời hội). */
export async function expireAutomationGrants(ctx: Ctx): Promise<number> {
  const due = await ctx.db.query.automationGrants.findMany({ where: and(eq(automationGrants.status, 'applied'), lt(automationGrants.expiresAt, ctx.now())), limit: 500 });
  for (const g of due) {
    await revokeGrant(ctx, g, 'expired');
    if (g.ruleId) await logRun(ctx, { id: g.ruleId, workspaceId: g.workspaceId }, g.contactId, 'expired', [{ type: g.kind === 'membership' ? 'grant_membership' : 'grant_course', status: 'revoked', detail: `Hết hạn: ${await grantTitle(ctx, g)}` }]);
  }
  return due.length;
}

/** Link "Ngừng nhận email" ở chân thư. Trả về tên người gửi để trang xác nhận nói rõ ngừng nhận từ ai. */
export async function unsubscribeContact(ctx: Ctx, token: string): Promise<{ sender: string } | null> {
  const contact = await ctx.db.query.contacts.findFirst({ where: eq(contacts.unsubscribeToken, token) });
  if (!contact) return null;
  if (!contact.unsubscribedAt) await ctx.db.update(contacts).set({ unsubscribedAt: ctx.now(), updatedAt: ctx.now() }).where(eq(contacts.id, contact.id));
  return { sender: await senderName(ctx, contact.workspaceId) };
}
