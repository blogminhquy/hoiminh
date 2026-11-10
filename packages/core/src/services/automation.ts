// Thẻ và quy tắc tự động, phần quản lý: nguồn đồng bộ (địa chỉ nhận dữ liệu từ landing), nhật ký nhận, liên hệ, thẻ,
// quy tắc "KHI gắn thẻ X THÌ ...". Dữ liệu thuộc workspace nên dùng chung cho mọi hội của cùng một chủ; quyền vào
// đây là settings.manage của hội đang mở. Bộ máy chạy quy tắc nằm ở automation-engine.ts.
import { randomToken } from '@hoiminh/config';
import { and, desc, eq, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { automationGrants, automationRules, automationRuns, communities, communityTiers, contactTags, contacts, courses, inboundEvents, inboundSources, tags, users, type AutomationAction, type InboundMapping } from '@hoiminh/db';
import type { Ctx } from '../context';
import { conflict, invalid, notFound } from '../errors';
import { extractInbound, flattenPayload, normalizeTagName } from '../lib/inbound-payload';
import { decodeCursor, paginate } from '../lib/pagination';
import { requireCommunityPermission } from '../permissions';
import { audit } from './audit';
import { activationUrl, createClaim, grantTitle, onTagAdded, onTagRemoved, revokeGrant, senderName, unsubscribeUrl } from './automation-engine';
import { templates } from '@hoiminh/email';

type Contact = typeof contacts.$inferSelect;
type Source = typeof inboundSources.$inferSelect;

const EMPTY_MAPPING: InboundMapping = { emailPath: '', namePath: '', phonePath: '', tagPath: '', removeTagPath: '', defaultTags: [] };
const MAX_ACTIONS = 6;

/** Người gọi phải có quyền cài đặt ở hội đang mở; trả về workspace chứa dữ liệu thẻ. */
async function workspaceFor(ctx: Ctx, communityId: string): Promise<string> {
  return (await requireCommunityPermission(ctx, communityId, 'settings.manage')).workspaceId;
}

const sourceUrl = (ctx: Ctx, token: string) => `${ctx.env.API_URL}/webhooks/in/${token}`;
const sourceView = (ctx: Ctx, s: Source) => ({ id: s.id, name: s.name, status: s.status, url: sourceUrl(ctx, s.token), mapping: { ...EMPTY_MAPPING, ...s.mapping }, receivedCount: s.receivedCount, lastReceivedAt: s.lastReceivedAt, createdAt: s.createdAt });

// ---------- Liên hệ và thẻ (dùng chung cho webhook nhận và thao tác tay) ----------

/** Tạo hoặc cập nhật liên hệ theo email trong workspace. Tên, số điện thoại mới (khác rỗng) ghi đè bản cũ. */
export async function upsertContact(ctx: Ctx, workspaceId: string, input: { email: string; name?: string; phone?: string }): Promise<Contact> {
  const email = input.email.trim().toLowerCase();
  const existing = await ctx.db.query.contacts.findFirst({ where: and(eq(contacts.workspaceId, workspaceId), eq(contacts.email, email)) });
  const user = await ctx.db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (existing) {
    const patch = { name: input.name?.trim() || existing.name, phone: input.phone?.trim() || existing.phone, linkedUserId: existing.linkedUserId ?? user?.id ?? null };
    if (patch.name === existing.name && patch.phone === existing.phone && patch.linkedUserId === existing.linkedUserId) return existing;
    const [row] = await ctx.db.update(contacts).set({ ...patch, updatedAt: ctx.now() }).where(eq(contacts.id, existing.id)).returning();
    return row!;
  }
  const [row] = await ctx.db.insert(contacts).values({ workspaceId, email, name: input.name?.trim() ?? '', phone: input.phone?.trim() ?? '', linkedUserId: user?.id ?? null, unsubscribeToken: randomToken(16) }).returning();
  return row!;
}

async function ensureTag(ctx: Ctx, workspaceId: string, rawName: string) {
  const name = normalizeTagName(rawName);
  if (!name) throw invalid('Tên thẻ chỉ gồm chữ không dấu, số, gạch dưới và gạch nối, ví dụ: paid');
  const existing = await ctx.db.query.tags.findFirst({ where: and(eq(tags.workspaceId, workspaceId), eq(tags.name, name)) });
  if (existing) return existing;
  const [row] = await ctx.db.insert(tags).values({ workspaceId, name }).returning();
  return row!;
}

/** Gắn thẻ cho liên hệ. Thẻ đã có thì không làm gì; thẻ mới thì chạy các quy tắc của thẻ đó. */
export async function tagContact(ctx: Ctx, contact: Contact, rawName: string, source: 'inbound' | 'manual', sourceId: string | null = null): Promise<{ tag: string; added: boolean; rulesRun: number }> {
  const tag = await ensureTag(ctx, contact.workspaceId, rawName);
  const has = await ctx.db.query.contactTags.findFirst({ where: and(eq(contactTags.contactId, contact.id), eq(contactTags.tagId, tag.id)), columns: { id: true } });
  if (has) return { tag: tag.name, added: false, rulesRun: 0 };
  await ctx.db.insert(contactTags).values({ workspaceId: contact.workspaceId, contactId: contact.id, tagId: tag.id, source, sourceId });
  return { tag: tag.name, added: true, rulesRun: await onTagAdded(ctx, contact, tag) };
}

/** Gỡ thẻ khỏi liên hệ. Liên hệ đang có thẻ đó thì thu hồi phần các quy tắc của thẻ đã cấp. */
export async function untagContact(ctx: Ctx, contact: Contact, rawName: string): Promise<{ tag: string; removed: boolean; revoked: number }> {
  const name = normalizeTagName(rawName);
  const tag = name ? await ctx.db.query.tags.findFirst({ where: and(eq(tags.workspaceId, contact.workspaceId), eq(tags.name, name)) }) : null;
  if (!tag) return { tag: name, removed: false, revoked: 0 };
  const rows = await ctx.db.delete(contactTags).where(and(eq(contactTags.contactId, contact.id), eq(contactTags.tagId, tag.id))).returning({ id: contactTags.id });
  if (!rows.length) return { tag: tag.name, removed: false, revoked: 0 };
  return { tag: tag.name, removed: true, revoked: await onTagRemoved(ctx, contact, tag) };
}

// ---------- Webhook nhận ----------

/**
 * Xử lý một lượt dữ liệu của một nguồn: tìm email và thẻ, lưu liên hệ, gắn và gỡ thẻ, ghi nhật ký nhận.
 * Gửi lặp lại cùng dữ liệu là vô hại: thẻ đã có thì không gắn lại nên quy tắc không chạy lần hai.
 */
async function processPayload(ctx: Ctx, source: Source, payload: Record<string, unknown>, eventId: string | null) {
  const x = extractInbound(payload, source.mapping);
  let status: 'processed' | 'failed' = 'processed';
  let detail = '';
  let contact: Contact | null = null;
  const added: string[] = [];
  const removed: string[] = [];
  if (!x.email) {
    status = 'failed';
    detail = 'Chưa tìm thấy email trong dữ liệu. Chọn đúng trường email ở phần Ghép trường rồi bấm Xử lý lại.';
  } else {
    contact = await upsertContact(ctx, source.workspaceId, { email: x.email, name: x.name, phone: x.phone });
    // Id của dòng nhật ký làm nguồn của thẻ; lượt nhận mới chưa có id thì ghi sau.
    for (const t of x.tags) if ((await tagContact(ctx, contact, t, 'inbound', eventId)).added) added.push(t);
    for (const t of x.removeTags) if ((await untagContact(ctx, contact, t)).removed) removed.push(t);
    const parts = [added.length ? `Gắn thẻ: ${added.join(', ')}` : '', removed.length ? `Gỡ thẻ: ${removed.join(', ')}` : ''].filter(Boolean);
    detail = parts.join('. ') || (x.tags.length ? 'Liên hệ đã có sẵn các thẻ này, không chạy lại quy tắc' : 'Đã lưu liên hệ. Dữ liệu không có thẻ nào');
  }
  const values = { status, detail, email: x.email, tagsAdded: added, tagsRemoved: removed, contactId: contact?.id ?? null };
  let id = eventId;
  if (id) await ctx.db.update(inboundEvents).set(values).where(eq(inboundEvents.id, id));
  else id = (await ctx.db.insert(inboundEvents).values({ workspaceId: source.workspaceId, sourceId: source.id, payload, ...values }).returning({ id: inboundEvents.id }))[0]!.id;
  return { eventId: id, status, detail, email: x.email, tagsAdded: added, tagsRemoved: removed };
}

/** Điểm vào của /webhooks/in/:token (chạy dưới quyền hệ thống). Khóa sai thì 404, nguồn tạm dừng thì nhận nhưng bỏ qua. */
export async function receiveInbound(ctx: Ctx, token: string, payload: Record<string, unknown>, opts: { ping?: boolean } = {}) {
  const source = await ctx.db.query.inboundSources.findFirst({ where: eq(inboundSources.token, token) });
  if (!source) throw notFound('Địa chỉ nhận không tồn tại hoặc đã đổi');
  if (opts.ping) return { ok: true, status: 'ready' as const, detail: `Địa chỉ nhận của nguồn "${source.name}" đang hoạt động. Gửi dữ liệu bằng POST.`, email: null, tagsAdded: [], tagsRemoved: [] };
  await ctx.db.update(inboundSources).set({ receivedCount: sql`${inboundSources.receivedCount} + 1`, lastReceivedAt: ctx.now() }).where(eq(inboundSources.id, source.id));
  if (source.status !== 'active') {
    await ctx.db.insert(inboundEvents).values({ workspaceId: source.workspaceId, sourceId: source.id, payload, status: 'ignored', detail: 'Nguồn đang tạm dừng' });
    return { ok: true, status: 'ignored' as const, detail: 'Nguồn đang tạm dừng', email: null, tagsAdded: [], tagsRemoved: [] };
  }
  const r = await processPayload(ctx, source, payload, null);
  return { ok: true, status: r.status, detail: r.detail, email: r.email, tagsAdded: r.tagsAdded, tagsRemoved: r.tagsRemoved };
}

// ---------- Nguồn đồng bộ ----------

export async function listSources(ctx: Ctx, communityId: string) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const rows = await ctx.db.query.inboundSources.findMany({ where: eq(inboundSources.workspaceId, workspaceId), orderBy: desc(inboundSources.createdAt) });
  return rows.map((s) => sourceView(ctx, s));
}

export async function createSource(ctx: Ctx, communityId: string, input: { name: string }) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const [row] = await ctx.db.insert(inboundSources).values({ workspaceId, name: input.name.trim(), token: randomToken(20), mapping: EMPTY_MAPPING }).returning();
  await audit(ctx, { action: 'automation.source_create', resourceType: 'inbound_source', resourceId: row!.id, workspaceId, communityId, metadata: { name: row!.name } });
  return sourceView(ctx, row!);
}

async function ownSource(ctx: Ctx, workspaceId: string, sourceId: string): Promise<Source> {
  const s = await ctx.db.query.inboundSources.findFirst({ where: and(eq(inboundSources.id, sourceId), eq(inboundSources.workspaceId, workspaceId)) });
  if (!s) throw notFound('Nguồn không tồn tại');
  return s;
}

export async function updateSource(ctx: Ctx, communityId: string, sourceId: string, input: { name?: string; status?: 'active' | 'paused'; mapping?: Partial<InboundMapping> }) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const s = await ownSource(ctx, workspaceId, sourceId);
  const mapping = input.mapping ? { ...EMPTY_MAPPING, ...s.mapping, ...input.mapping, defaultTags: (input.mapping.defaultTags ?? s.mapping.defaultTags ?? []).map(normalizeTagName).filter(Boolean).slice(0, 10) } : s.mapping;
  const [row] = await ctx.db.update(inboundSources).set({ name: input.name?.trim() || s.name, status: input.status ?? s.status, mapping, updatedAt: ctx.now() }).where(eq(inboundSources.id, s.id)).returning();
  return sourceView(ctx, row!);
}

/** Đổi địa chỉ nhận (khi địa chỉ cũ bị lộ). Địa chỉ cũ ngừng hoạt động ngay. */
export async function rotateSourceToken(ctx: Ctx, communityId: string, sourceId: string) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const s = await ownSource(ctx, workspaceId, sourceId);
  const [row] = await ctx.db.update(inboundSources).set({ token: randomToken(20), updatedAt: ctx.now() }).where(eq(inboundSources.id, s.id)).returning();
  await audit(ctx, { action: 'automation.source_rotate', resourceType: 'inbound_source', resourceId: s.id, workspaceId, communityId });
  return sourceView(ctx, row!);
}

export async function deleteSource(ctx: Ctx, communityId: string, sourceId: string) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const s = await ownSource(ctx, workspaceId, sourceId);
  await ctx.db.delete(inboundSources).where(eq(inboundSources.id, s.id));
  await audit(ctx, { action: 'automation.source_delete', resourceType: 'inbound_source', resourceId: s.id, workspaceId, communityId, metadata: { name: s.name } });
}

/** Nhật ký nhận gần đây của một nguồn, kèm dữ liệu đã trải phẳng để chọn trường. */
export async function listSourceEvents(ctx: Ctx, communityId: string, sourceId: string, limit = 20) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const s = await ownSource(ctx, workspaceId, sourceId);
  const rows = await ctx.db.query.inboundEvents.findMany({ where: eq(inboundEvents.sourceId, s.id), orderBy: desc(inboundEvents.createdAt), limit: Math.min(limit, 50) });
  return rows.map((e) => ({ id: e.id, status: e.status, detail: e.detail, email: e.email, tagsAdded: e.tagsAdded, tagsRemoved: e.tagsRemoved, createdAt: e.createdAt, fields: flattenPayload(e.payload) }));
}

/** Chạy lại một lượt đã nhận với cách ghép trường hiện tại (sau khi chủ hội chọn đúng trường email, thẻ). */
export async function reprocessEvent(ctx: Ctx, communityId: string, eventId: string) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const e = await ctx.db.query.inboundEvents.findFirst({ where: and(eq(inboundEvents.id, eventId), eq(inboundEvents.workspaceId, workspaceId)) });
  if (!e) throw notFound('Không tìm thấy lượt nhận');
  const s = await ownSource(ctx, workspaceId, e.sourceId);
  const r = await processPayload(ctx, s, e.payload, e.id);
  return { status: r.status, detail: r.detail, email: r.email, tagsAdded: r.tagsAdded, tagsRemoved: r.tagsRemoved };
}

// ---------- Thẻ và liên hệ (màn quản trị) ----------

export async function listTags(ctx: Ctx, communityId: string) {
  const workspaceId = await workspaceFor(ctx, communityId);
  // Ghi rõ "tags"."id" trong truy vấn con: Drizzle bỏ tên bảng khi vẽ cột ở danh sách select của truy vấn một bảng,
  // và "id" trần trong truy vấn con sẽ thành id của bảng bên trong.
  return ctx.db
    .select({ id: tags.id, name: tags.name, createdAt: tags.createdAt, contactCount: sql<number>`(select count(*)::int from contact_tags ct where ct.tag_id = "tags"."id")`, ruleCount: sql<number>`(select count(*)::int from automation_rules r where r.tag_id = "tags"."id")` })
    .from(tags)
    .where(eq(tags.workspaceId, workspaceId))
    .orderBy(tags.name);
}

export async function listContacts(ctx: Ctx, communityId: string, q: { q?: string; tag?: string; cursor?: string; limit?: number }) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const limit = Math.min(q.limit ?? 30, 100);
  const conds = [eq(contacts.workspaceId, workspaceId)];
  const term = q.q?.trim();
  if (term) conds.push(or(ilike(contacts.email, `%${term}%`), ilike(contacts.name, `%${term}%`), ilike(contacts.phone, `%${term}%`))!);
  const tagName = q.tag ? normalizeTagName(q.tag) : '';
  if (tagName) conds.push(sql`exists (select 1 from contact_tags ct join tags t on t.id = ct.tag_id where ct.contact_id = ${contacts.id} and t.name = ${tagName})`);
  const c = decodeCursor(q.cursor);
  if (c) conds.push(or(lt(contacts.createdAt, new Date(c.at)), and(eq(contacts.createdAt, new Date(c.at)), lt(contacts.id, c.id)))!);
  const rows = await ctx.db.select().from(contacts).where(and(...conds)).orderBy(desc(contacts.createdAt), desc(contacts.id)).limit(limit + 1);
  const page = paginate(rows, limit);
  const ids = page.items.map((r) => r.id);
  const [tagRows, grantRows, total] = await Promise.all([
    ids.length ? ctx.db.select({ contactId: contactTags.contactId, id: tags.id, name: tags.name }).from(contactTags).innerJoin(tags, eq(tags.id, contactTags.tagId)).where(inArray(contactTags.contactId, ids)).orderBy(tags.name) : [],
    ids.length ? ctx.db.query.automationGrants.findMany({ where: and(inArray(automationGrants.contactId, ids), inArray(automationGrants.status, ['pending', 'applied'])) }) : [],
    ctx.db.select({ c: sql<number>`count(*)::int` }).from(contacts).where(eq(contacts.workspaceId, workspaceId)),
  ]);
  const grants: Array<{ contactId: string; id: string; kind: 'membership' | 'course'; status: string; expiresAt: Date | null; title: string }> = [];
  for (const g of grantRows) grants.push({ contactId: g.contactId, id: g.id, kind: g.kind, status: g.status, expiresAt: g.expiresAt, title: await grantTitle(ctx, g) });
  return {
    total: total[0]?.c ?? 0,
    nextCursor: page.nextCursor,
    items: page.items.map((r) => ({
      id: r.id, email: r.email, name: r.name, phone: r.phone, hasAccount: Boolean(r.linkedUserId), unsubscribed: Boolean(r.unsubscribedAt), createdAt: r.createdAt,
      tags: tagRows.filter((t) => t.contactId === r.id).map((t) => ({ id: t.id, name: t.name })),
      grants: grants.filter((g) => g.contactId === r.id).map(({ contactId: _c, ...g }) => g),
    })),
  };
}

async function ownContact(ctx: Ctx, workspaceId: string, contactId: string): Promise<Contact> {
  const c = await ctx.db.query.contacts.findFirst({ where: and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)) });
  if (!c) throw notFound('Liên hệ không tồn tại');
  return c;
}

/** Thêm liên hệ bằng tay (hoặc thử quy tắc mà không cần landing): lưu liên hệ rồi gắn các thẻ đã chọn. */
export async function createContact(ctx: Ctx, communityId: string, input: { email: string; name?: string; phone?: string; tags?: string[] }) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const contact = await upsertContact(ctx, workspaceId, input);
  const results = [];
  for (const t of input.tags ?? []) results.push(await tagContact(ctx, contact, t, 'manual'));
  await audit(ctx, { action: 'automation.contact_create', resourceType: 'contact', resourceId: contact.id, workspaceId, communityId, metadata: { tags: input.tags ?? [] } });
  return { id: contact.id, email: contact.email, tags: results };
}

export async function addContactTag(ctx: Ctx, communityId: string, contactId: string, tag: string) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const r = await tagContact(ctx, await ownContact(ctx, workspaceId, contactId), tag, 'manual');
  await audit(ctx, { action: 'automation.tag_add', resourceType: 'contact', resourceId: contactId, workspaceId, communityId, metadata: { tag: r.tag } });
  return r;
}

export async function removeContactTag(ctx: Ctx, communityId: string, contactId: string, tag: string) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const r = await untagContact(ctx, await ownContact(ctx, workspaceId, contactId), tag);
  await audit(ctx, { action: 'automation.tag_remove', resourceType: 'contact', resourceId: contactId, workspaceId, communityId, metadata: { tag: r.tag } });
  return r;
}

/** Xóa liên hệ: thu hồi mọi quyền quy tắc đã cấp cho liên hệ đó rồi xóa. Tài khoản Hội Mình (nếu có) không bị đụng tới. */
export async function deleteContact(ctx: Ctx, communityId: string, contactId: string) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const contact = await ownContact(ctx, workspaceId, contactId);
  const live = await ctx.db.query.automationGrants.findMany({ where: and(eq(automationGrants.contactId, contact.id), inArray(automationGrants.status, ['pending', 'applied'])) });
  for (const g of live) await revokeGrant(ctx, g, 'revoked');
  await ctx.db.delete(contacts).where(eq(contacts.id, contact.id));
  await audit(ctx, { action: 'automation.contact_delete', resourceType: 'contact', resourceId: contact.id, workspaceId, communityId, metadata: { email: contact.email, revoked: live.length } });
}

/** Gửi lại link kích hoạt cho liên hệ còn quyền đang giữ. */
export async function resendActivation(ctx: Ctx, communityId: string, contactId: string): Promise<{ ok: true; token?: string }> {
  const workspaceId = await workspaceFor(ctx, communityId);
  const contact = await ownContact(ctx, workspaceId, contactId);
  const pending = await ctx.db.query.automationGrants.findMany({ where: and(eq(automationGrants.contactId, contact.id), eq(automationGrants.status, 'pending')) });
  if (!pending.length) throw conflict('Liên hệ này không còn quyền nào chờ kích hoạt');
  const token = await createClaim(ctx, contact);
  const items: string[] = [];
  for (const g of pending) items.push(await grantTitle(ctx, g));
  const sender = await senderName(ctx, workspaceId, pending.find((g) => g.communityId)?.communityId);
  await ctx.email.send(templates.activationInvite(contact.email, { sender, name: contact.name, items, url: activationUrl(ctx, token), unsubscribeUrl: unsubscribeUrl(ctx, contact) }));
  // Môi trường test trả luôn khóa để kiểm thử đi hết luồng mà không cần đọc hộp thư.
  return { ok: true, ...(ctx.env.APP_ENV === 'test' ? { token } : {}) };
}

// ---------- Quy tắc ----------

/** Hội, gói và khóa học của workspace, để màn soạn quy tắc chọn đích. */
export async function ruleOptions(ctx: Ctx, communityId: string) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const [cs, courseRows] = await Promise.all([
    ctx.db.query.communities.findMany({ where: and(eq(communities.workspaceId, workspaceId), isNull(communities.deletedAt)), columns: { id: true, name: true, slug: true }, orderBy: communities.name }),
    ctx.db.query.courses.findMany({ where: and(eq(courses.workspaceId, workspaceId), isNull(courses.deletedAt)), columns: { id: true, title: true, communityId: true, status: true }, orderBy: courses.title }),
  ]);
  const tiers = cs.length ? await ctx.db.query.communityTiers.findMany({ where: and(inArray(communityTiers.communityId, cs.map((c) => c.id)), eq(communityTiers.isActive, true)), orderBy: communityTiers.sortOrder }) : [];
  return {
    communities: cs.map((c) => ({ ...c, tiers: tiers.filter((t) => t.communityId === c.id).map((t) => ({ key: t.key, name: t.name })) })),
    courses: courseRows,
  };
}

/** Kiểm tra từng hành động: đích phải thuộc workspace và người soạn phải quản lý được thành viên ở hội đích. */
async function validateActions(ctx: Ctx, workspaceId: string, actions: AutomationAction[]): Promise<AutomationAction[]> {
  if (!actions.length) throw invalid('Quy tắc cần ít nhất một việc để làm');
  if (actions.length > MAX_ACTIONS) throw invalid(`Mỗi quy tắc tối đa ${MAX_ACTIONS} việc`);
  const out: AutomationAction[] = [];
  for (const a of actions) {
    if (a.type === 'grant_membership') {
      const community = await ctx.db.query.communities.findFirst({ where: and(eq(communities.id, a.communityId), eq(communities.workspaceId, workspaceId), isNull(communities.deletedAt)), columns: { id: true } });
      if (!community) throw invalid('Hội được chọn không thuộc không gian làm việc này');
      await requireCommunityPermission(ctx, community.id, 'member.manage');
      const tier = await ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, community.id), eq(communityTiers.key, a.tierKey)), columns: { id: true } });
      if (!tier) throw invalid('Hội này không có gói đã chọn');
      out.push({ type: 'grant_membership', communityId: community.id, tierKey: a.tierKey, durationDays: a.durationDays ?? null });
    } else if (a.type === 'grant_course') {
      const course = await ctx.db.query.courses.findFirst({ where: and(eq(courses.id, a.courseId), eq(courses.workspaceId, workspaceId), isNull(courses.deletedAt)), columns: { id: true, communityId: true } });
      if (!course) throw invalid('Khóa học được chọn không thuộc không gian làm việc này');
      if (course.communityId) await requireCommunityPermission(ctx, course.communityId, 'member.manage');
      out.push({ type: 'grant_course', courseId: course.id });
    } else {
      out.push({ type: 'send_email', subject: a.subject.trim(), body: a.body.trim() });
    }
  }
  return out;
}

/** Mô tả ngắn từng hành động bằng tên thật của hội, gói, khóa học. */
async function describeActions(ctx: Ctx, actions: AutomationAction[]): Promise<string[]> {
  const out: string[] = [];
  for (const a of actions) {
    if (a.type === 'send_email') { out.push(`Gửi email "${a.subject}"`); continue; }
    if (a.type === 'grant_course') { out.push(`Mở ${(await grantTitle(ctx, { kind: 'course', communityId: null, resourceId: a.courseId })).replace(/^Khóa học/, 'khóa học')}`); continue; }
    const [c, tier] = await Promise.all([
      ctx.db.query.communities.findFirst({ where: eq(communities.id, a.communityId), columns: { name: true } }),
      ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, a.communityId), eq(communityTiers.key, a.tierKey)), columns: { name: true } }),
    ]);
    out.push(`Cho vào hội ${c?.name ?? '(đã xóa)'}, gói ${tier?.name ?? a.tierKey}${a.durationDays ? `, ${a.durationDays} ngày` : ''}`);
  }
  return out;
}

export async function listRules(ctx: Ctx, communityId: string) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const rows = await ctx.db.select({ r: automationRules, tag: tags.name }).from(automationRules).innerJoin(tags, eq(tags.id, automationRules.tagId)).where(eq(automationRules.workspaceId, workspaceId)).orderBy(desc(automationRules.createdAt));
  const out = [];
  for (const { r, tag } of rows) out.push({ id: r.id, name: r.name, tag, actions: r.actions, summary: await describeActions(ctx, r.actions), enabled: r.enabled, revokeOnTagRemoved: r.revokeOnTagRemoved, runCount: r.runCount, lastRunAt: r.lastRunAt, createdAt: r.createdAt });
  return out;
}

export interface RuleInput { name: string; tag: string; actions: AutomationAction[]; enabled?: boolean; revokeOnTagRemoved?: boolean }

export async function createRule(ctx: Ctx, communityId: string, input: RuleInput) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const actions = await validateActions(ctx, workspaceId, input.actions);
  const tag = await ensureTag(ctx, workspaceId, input.tag);
  const [row] = await ctx.db.insert(automationRules).values({ workspaceId, name: input.name.trim(), tagId: tag.id, actions, enabled: input.enabled ?? true, revokeOnTagRemoved: input.revokeOnTagRemoved ?? true }).returning();
  await audit(ctx, { action: 'automation.rule_create', resourceType: 'automation_rule', resourceId: row!.id, workspaceId, communityId, metadata: { name: row!.name, tag: tag.name, actions: actions.map((a) => a.type) } });
  return { id: row!.id };
}

async function ownRule(ctx: Ctx, workspaceId: string, ruleId: string) {
  const r = await ctx.db.query.automationRules.findFirst({ where: and(eq(automationRules.id, ruleId), eq(automationRules.workspaceId, workspaceId)) });
  if (!r) throw notFound('Quy tắc không tồn tại');
  return r;
}

export async function updateRule(ctx: Ctx, communityId: string, ruleId: string, input: Partial<RuleInput>) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const r = await ownRule(ctx, workspaceId, ruleId);
  const patch: Partial<typeof automationRules.$inferInsert> = { updatedAt: ctx.now() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.actions) patch.actions = await validateActions(ctx, workspaceId, input.actions);
  if (input.tag !== undefined) patch.tagId = (await ensureTag(ctx, workspaceId, input.tag)).id;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.revokeOnTagRemoved !== undefined) patch.revokeOnTagRemoved = input.revokeOnTagRemoved;
  await ctx.db.update(automationRules).set(patch).where(eq(automationRules.id, r.id));
  await audit(ctx, { action: 'automation.rule_update', resourceType: 'automation_rule', resourceId: r.id, workspaceId, communityId, metadata: { fields: Object.keys(input) } });
  return { id: r.id };
}

/** Xóa quy tắc. Quyền đã cấp cho khách vẫn giữ nguyên (muốn thu hồi thì gỡ thẻ trước khi xóa). */
export async function deleteRule(ctx: Ctx, communityId: string, ruleId: string) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const r = await ownRule(ctx, workspaceId, ruleId);
  // Quyền còn đang giữ theo email mà quy tắc đã mất thì không còn ai chịu trách nhiệm: bỏ luôn.
  await ctx.db.update(automationGrants).set({ status: 'revoked', detail: 'Quy tắc đã bị xóa', revokedAt: ctx.now(), updatedAt: ctx.now() }).where(and(eq(automationGrants.ruleId, r.id), eq(automationGrants.status, 'pending')));
  await ctx.db.delete(automationRules).where(eq(automationRules.id, r.id));
  await audit(ctx, { action: 'automation.rule_delete', resourceType: 'automation_rule', resourceId: r.id, workspaceId, communityId, metadata: { name: r.name } });
}

/** Nhật ký chạy gần đây của mọi quy tắc trong workspace (hoặc của một quy tắc). */
export async function listRuns(ctx: Ctx, communityId: string, q: { ruleId?: string; limit?: number } = {}) {
  const workspaceId = await workspaceFor(ctx, communityId);
  const conds = [eq(automationRuns.workspaceId, workspaceId)];
  if (q.ruleId) conds.push(eq(automationRuns.ruleId, q.ruleId));
  return ctx.db
    .select({ id: automationRuns.id, ruleId: automationRuns.ruleId, rule: automationRules.name, email: contacts.email, trigger: automationRuns.trigger, results: automationRuns.results, createdAt: automationRuns.createdAt })
    .from(automationRuns)
    .innerJoin(automationRules, eq(automationRules.id, automationRuns.ruleId))
    .innerJoin(contacts, eq(contacts.id, automationRuns.contactId))
    .where(and(...conds))
    .orderBy(desc(automationRuns.createdAt))
    .limit(Math.min(q.limit ?? 30, 100));
}

/** Thẻ của một nhóm email trong workspace, cho cột Thẻ ở trang Thành viên. */
export async function tagsByEmail(ctx: Ctx, workspaceId: string, emails: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const list = [...new Set(emails.map((e) => e.toLowerCase()))];
  if (!list.length) return out;
  const rows = await ctx.db.select({ email: contacts.email, name: tags.name }).from(contactTags).innerJoin(contacts, eq(contacts.id, contactTags.contactId)).innerJoin(tags, eq(tags.id, contactTags.tagId)).where(and(eq(contacts.workspaceId, workspaceId), inArray(contacts.email, list))).orderBy(tags.name);
  for (const r of rows) out.set(r.email, [...(out.get(r.email) ?? []), r.name]);
  return out;
}
