// Gói của từng hội (kế hoạch 11/11/2026): tra bảng gói, gói đang có hiệu lực của một hội, trần thành viên, tính năng trả phí.
// Mọi chỗ cần hỏi "hội này được làm gì" đều đi qua đây, để luật chỉ nằm một nơi.
import { NO_PRICES, PLAN_CYCLES, PLAN_DEFAULTS, PLAN_FEATURES, PLAN_FEATURE_LABEL, PLAN_STORAGE, effectivePlanKey, formatBytes, isPlanKey, lowestPlanWith, nextPlanFor, nextPlanForStorage, type PlanDef, type PlanFeature, type PlanKey, type PlanPrices } from '@hoiminh/contracts';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { communities, files, users, workspaces, type plans } from '@hoiminh/db';
import type { Ctx } from '../context';
import { AppError, notFound } from '../errors';

type CommunityRow = typeof communities.$inferSelect;
type PlanRow = typeof plans.$inferSelect;

const amount = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

/**
 * Giá từng kỳ của một dòng bảng plans. Dòng có trước khi có `cycle_prices` chỉ bán 3 tháng (3 lần giá tháng) và
 * 1 năm (cột `yearly_minor`), đúng như lúc đó; 1 tháng và 6 tháng là 0 cho tới khi quản trị nhập giá.
 */
function pricesOf(row: PlanRow): PlanPrices {
  const saved = row.cyclePrices;
  if (!saved) return { monthly: 0, quarterly: amount(row.monthlyMinor * 3), semiannual: 0, yearly: amount(row.yearlyMinor) };
  const out = { ...NO_PRICES };
  for (const c of PLAN_CYCLES) out[c] = amount(saved[c]);
  return out;
}

/** Một dòng bảng plans thành định nghĩa gói. Thiếu trần trong `quotas` thì lấy trần mặc định của gói đó. */
function toDef(row: PlanRow, fallback: PlanDef): PlanDef {
  const cap = Object.prototype.hasOwnProperty.call(row.quotas, 'members') ? row.quotas.members ?? null : fallback.memberCap;
  return {
    key: fallback.key,
    name: row.name || fallback.name,
    prices: fallback.key === 'free' ? { ...NO_PRICES } : pricesOf(row),
    memberCap: cap,
    features: PLAN_FEATURES.filter((f) => row.features.includes(f)),
  };
}

/** Bảng bốn gói theo thứ bậc. Gói nào database chưa có dòng thì dùng giá trị mặc định, nên hệ thống luôn có đủ bốn gói. */
export async function planTable(ctx: Ctx): Promise<PlanDef[]> {
  const rows = await ctx.db.query.plans.findMany();
  return PLAN_DEFAULTS.map((d) => {
    const row = rows.find((r) => r.key === d.key);
    return row ? toDef(row, d) : { ...d, prices: { ...d.prices }, features: [...d.features] };
  });
}

export interface CommunityPlan extends PlanDef {
  /** Ngày hết hạn của gói trả phí đang dùng; gói Miễn phí thì null. */
  endsAt: Date | null;
  /** Gói đã mua gần nhất (kể cả khi đã hết hạn), để ghi "gói X đã hết hạn". */
  boughtKey: PlanKey;
  boughtEndsAt: Date | null;
  isFreeSlot: boolean;
  /** Hội không phải hội miễn phí của tài khoản và chưa có gói trả phí còn hạn: chưa hoạt động được. */
  needsPlan: boolean;
  members: number;
  /** Đã chạm trần thành viên (hoặc hội chưa có gói): không nhận thêm người mới. */
  full: boolean;
}

/** Gói đang có hiệu lực của một hội, tính theo thời điểm hiện tại (không chờ cron đổi trạng thái). */
export function planOfCommunity(c: Pick<CommunityRow, 'planKey' | 'planEndsAt' | 'isFreeSlot' | 'memberCount'>, table: PlanDef[], now: Date): CommunityPlan {
  const key = effectivePlanKey(c.planKey, c.planEndsAt, now);
  const def = table.find((p) => p.key === key) ?? table[0]!;
  const needsPlan = !c.isFreeSlot && key === 'free';
  return {
    ...def,
    endsAt: key === 'free' ? null : c.planEndsAt,
    boughtKey: isPlanKey(c.planKey) ? c.planKey : 'free',
    boughtEndsAt: c.planEndsAt,
    isFreeSlot: c.isFreeSlot,
    needsPlan,
    members: c.memberCount,
    full: needsPlan || (def.memberCap !== null && c.memberCount >= def.memberCap),
  };
}

export async function communityPlan(ctx: Ctx, communityId: string): Promise<CommunityPlan & { communityId: string; workspaceId: string }> {
  const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId), columns: { id: true, workspaceId: true, planKey: true, planEndsAt: true, isFreeSlot: true, memberCount: true } });
  if (!c) throw notFound('Hội không tồn tại');
  return { ...planOfCommunity(c, await planTable(ctx), ctx.now()), communityId: c.id, workspaceId: c.workspaceId };
}

const NEEDS_PLAN_MESSAGE = 'Hội này chưa có gói. Mỗi tài khoản có một hội miễn phí, hội thứ hai trở đi cần gói trả phí còn hạn. Dữ liệu vẫn được giữ.';

/** Chặn tạo nội dung ở hội chưa có gói (hội thứ hai chưa trả tiền hoặc đã hết hạn). Hội miễn phí và hội còn gói thì qua. */
export async function assertCommunityHasPlan(ctx: Ctx, communityId: string): Promise<void> {
  const p = await communityPlan(ctx, communityId);
  if (p.needsPlan) throw new AppError('plan_locked', NEEDS_PLAN_MESSAGE, undefined, { reason: 'needs_plan', communityId });
}

/** Lỗi chạm trần, kèm số liệu để giao diện mở màn nâng gói thay vì chỉ báo chữ. */
export function memberCapError(p: CommunityPlan, table: PlanDef[], communityId: string): AppError {
  if (p.needsPlan) return new AppError('plan_locked', NEEDS_PLAN_MESSAGE, undefined, { reason: 'needs_plan', communityId });
  const next = nextPlanFor(table, p.key, p.members);
  const message = `Hội đã đủ ${p.memberCap?.toLocaleString('vi-VN')} thành viên của gói ${p.name}.${next ? ` Nâng lên gói ${next.name} để nhận thêm người.` : ''}`;
  return new AppError('member_cap', message, undefined, { communityId, planKey: p.key, planName: p.name, cap: p.memberCap, members: p.members, nextPlanKey: next?.key ?? null, nextPlanName: next?.name ?? null });
}

/** Còn chỗ cho một thành viên mới không. */
export async function hasRoomForMember(ctx: Ctx, communityId: string): Promise<boolean> {
  return !(await communityPlan(ctx, communityId)).full;
}

/** Chặn thêm thành viên mới khi hội đã chạm trần của gói. Không xóa ai, chỉ không nhận thêm. */
export async function assertRoomForMember(ctx: Ctx, communityId: string): Promise<void> {
  const p = await communityPlan(ctx, communityId);
  if (p.full) throw memberCapError(p, await planTable(ctx), communityId);
}

/**
 * Tổng dung lượng tệp đang gắn với các hội (byte thật, ghi lúc API nhận tệp), tính cả tệp đang tải dở: tệp tải dở bỏ quá
 * vài giờ được bộ dọn xóa, còn trong lúc chờ thì vẫn giữ chỗ để nhiều lượt tải song song không cùng lọt qua trần.
 */
export async function storageUsedByCommunities(ctx: Ctx, communityIds: string[]): Promise<Map<string, number>> {
  if (communityIds.length === 0) return new Map();
  const rows = await ctx.db.select({ communityId: files.communityId, used: sql<string>`coalesce(sum(${files.sizeBytes}), 0)` }).from(files).where(inArray(files.communityId, communityIds)).groupBy(files.communityId);
  return new Map(rows.map((r) => [r.communityId!, Number(r.used)]));
}

/**
 * Chặn tệp mới khi hội đã dùng hết dung lượng của gói, hoặc tài liệu lớn hơn mức gói cho phép mỗi tệp. Giống trần thành
 * viên: không xóa gì, chỉ không nhận thêm, kèm gói nên nâng để giao diện mời nâng gói.
 */
export async function assertStorageRoom(ctx: Ctx, communityId: string, upload: { sizeBytes: number; kind: 'image' | 'document' }): Promise<void> {
  const p = await communityPlan(ctx, communityId);
  const limit = PLAN_STORAGE[p.key];
  const details = (extra: Record<string, unknown>, next: { key: string; name: string } | null) => ({ communityId, planKey: p.key, planName: p.name, nextPlanKey: next?.key ?? null, nextPlanName: next?.name ?? null, ...extra });
  if (upload.kind === 'document' && upload.sizeBytes > limit.documentMaxBytes) {
    const next = nextPlanForStorage(await planTable(ctx), p.key);
    throw new AppError('storage_quota', `Gói ${p.name} nhận tài liệu tối đa ${formatBytes(limit.documentMaxBytes)} mỗi tệp.${next ? ` Nâng lên gói ${next.name} để tải tệp lớn hơn.` : ''}`, undefined, details({ reason: 'file_size', maxBytes: limit.documentMaxBytes }, next));
  }
  const used = (await storageUsedByCommunities(ctx, [communityId])).get(communityId) ?? 0;
  if (used + upload.sizeBytes > limit.bytes) {
    const next = nextPlanForStorage(await planTable(ctx), p.key);
    throw new AppError('storage_quota', `Hội đã dùng ${formatBytes(used)} trên ${formatBytes(limit.bytes)} dung lượng tệp của gói ${p.name}. Ảnh và tệp đã có vẫn được giữ.${next ? ` Nâng lên gói ${next.name} để tải thêm.` : ' Gỡ bớt tệp không còn dùng để tải thêm.'}`, undefined, details({ reason: 'quota', usedBytes: used, capBytes: limit.bytes }, next));
  }
}

function featureError(feature: PlanFeature, table: PlanDef[], communityId: string | null): AppError {
  const from = lowestPlanWith(table, feature);
  const label = PLAN_FEATURE_LABEL[feature];
  return new AppError('plan_locked', from ? `${label} có từ gói ${from.name}. Nâng gói cho hội để dùng.` : `${label} chưa mở ở gói nào.`, undefined, { reason: 'feature', feature, requiredPlanKey: from?.key ?? null, requiredPlanName: from?.name ?? null, communityId });
}

/** Tính năng trả phí của một hội: gói đang có hiệu lực không bật thì chặn (403 plan_locked). */
export async function requirePlanFeature(ctx: Ctx, communityId: string, feature: PlanFeature): Promise<void> {
  const p = await communityPlan(ctx, communityId);
  if (!p.features.includes(feature)) throw featureError(feature, await planTable(ctx), communityId);
}

/** Hội có tính năng này không (không ném lỗi). */
export async function communityHasFeature(ctx: Ctx, communityId: string, feature: PlanFeature): Promise<boolean> {
  return (await communityPlan(ctx, communityId)).features.includes(feature);
}

/** Workspace có ít nhất một hội mà gói bật tính năng này không. Dùng cho thứ gắn với workspace (API key, webhook, quy tắc tự động). */
export async function workspaceHasFeature(ctx: Ctx, workspaceId: string, feature: PlanFeature): Promise<boolean> {
  const [table, rows] = await Promise.all([
    planTable(ctx),
    ctx.db.query.communities.findMany({ where: and(eq(communities.workspaceId, workspaceId), isNull(communities.deletedAt)), columns: { planKey: true, planEndsAt: true, isFreeSlot: true, memberCount: true } }),
  ]);
  const now = ctx.now();
  return rows.some((c) => planOfCommunity(c, table, now).features.includes(feature));
}

export async function requireWorkspaceFeature(ctx: Ctx, workspaceId: string, feature: PlanFeature): Promise<void> {
  if (!(await workspaceHasFeature(ctx, workspaceId, feature))) throw featureError(feature, await planTable(ctx), null);
}

/**
 * Tài khoản quản trị hệ thống tạo được bao nhiêu hội miễn phí cũng được (để thử nghiệm và dựng hội mẫu), không bị luật
 * "mỗi tài khoản một hội miễn phí". Xét theo chủ workspace, không theo người bấm tạo. Chủ dự án chốt ngày 23/11/2026.
 */
export async function ownerHasUnlimitedFree(ctx: Ctx, ownerUserId: string): Promise<boolean> {
  const u = await ctx.db.query.users.findFirst({ where: eq(users.id, ownerUserId), columns: { isSuperAdmin: true } });
  return u?.isSuperAdmin === true;
}

/** Tài khoản (chủ workspace) đã dùng hội miễn phí của mình chưa. Hội đã xóa hoặc đã lưu trữ thì không tính, để chủ hội làm lại từ đầu được. */
export async function ownerHasFreeCommunity(ctx: Ctx, ownerUserId: string): Promise<boolean> {
  const rows = await ctx.db
    .select({ id: communities.id })
    .from(communities)
    .innerJoin(workspaces, eq(workspaces.id, communities.workspaceId))
    .where(and(eq(workspaces.ownerUserId, ownerUserId), eq(communities.isFreeSlot, true), isNull(communities.deletedAt), ne(communities.status, 'archived')))
    .limit(1);
  return rows.length > 0;
}
