// Nhãn dán dùng chung cho mọi hội: khung chọn nhãn ở ô bình luận và ô chat đọc danh sách ở đây; quản trị hệ thống tạo bộ,
// tải nhãn lên, sửa từ khóa gợi ý, đổi thứ tự, bật tắt ở Hệ thống · Nhãn dán.
// Nhãn đã gửi lưu bản sao link ảnh trong bình luận hay tin nhắn, nên tắt bộ hay xóa nhãn không làm hỏng chỗ đã gửi:
// tệp ảnh chỉ bị dọn khỏi kho khi không còn bình luận, tin nhắn nào trỏ tới (xem FILE_REFERENCES trong files.ts).
import { and, asc, eq, inArray, max } from 'drizzle-orm';
import { files, stickerPacks, stickers } from '@hoiminh/db';
import type { Ctx } from '../context';
import { invalid, notFound } from '../errors';
import { requireSuperAdmin, requireUser } from '../permissions';
import { audit } from './audit';
import { releaseFiles } from './files';
import { gifEnabled } from './gifs';

export interface StickerView { id: string; url: string; keywords: string[]; width: number | null; height: number | null }
export interface StickerPackView { id: string; name: string; active: boolean; stickers: StickerView[] }

const view = (s: typeof stickers.$inferSelect): StickerView => ({ id: s.id, url: s.imageUrl, keywords: s.keywords, width: s.width, height: s.height });

async function loadPacks(ctx: Ctx, onlyActive: boolean): Promise<StickerPackView[]> {
  const packs = await ctx.db.query.stickerPacks.findMany({ where: onlyActive ? eq(stickerPacks.active, true) : undefined, orderBy: [asc(stickerPacks.sortOrder), asc(stickerPacks.createdAt)] });
  if (!packs.length) return [];
  const rows = await ctx.db.query.stickers.findMany({ where: inArray(stickers.packId, packs.map((p) => p.id)), orderBy: [asc(stickers.sortOrder), asc(stickers.createdAt)] });
  return packs.map((p) => ({ id: p.id, name: p.name, active: p.active, stickers: rows.filter((r) => r.packId === p.id).map(view) }));
}

/**
 * Các bộ đang bật cùng nhãn của từng bộ, cho khung chọn nhãn. Bộ chưa có nhãn nào thì bỏ qua.
 * `gifEnabled`: đã có khóa GIPHY chưa, để khung chọn biết có hiện tab GIF không.
 */
export async function listStickers(ctx: Ctx): Promise<{ packs: StickerPackView[]; gifEnabled: boolean }> {
  requireUser(ctx);
  return { packs: (await loadPacks(ctx, true)).filter((p) => p.stickers.length > 0), gifEnabled: gifEnabled(ctx) };
}

/** Nhãn để gửi: phải thuộc một bộ đang bật. Trả link ảnh để lưu vào bình luận hay tin nhắn. */
export async function resolveSticker(ctx: Ctx, stickerId: string): Promise<string> {
  const row = await ctx.db.select({ url: stickers.imageUrl }).from(stickers).innerJoin(stickerPacks, eq(stickerPacks.id, stickers.packId)).where(and(eq(stickers.id, stickerId), eq(stickerPacks.active, true))).then((r) => r[0]);
  if (!row) throw invalid('Nhãn dán này không còn dùng được');
  return row.url;
}

// ---- Quản trị hệ thống ----

export async function adminListPacks(ctx: Ctx): Promise<{ packs: StickerPackView[] }> {
  requireSuperAdmin(ctx);
  return { packs: await loadPacks(ctx, false) };
}

export async function createPack(ctx: Ctx, input: { name: string; active?: boolean }) {
  requireSuperAdmin(ctx);
  const top = await ctx.db.select({ m: max(stickerPacks.sortOrder) }).from(stickerPacks).then((r) => r[0]?.m ?? -1);
  const [row] = await ctx.db.insert(stickerPacks).values({ name: input.name, active: input.active ?? true, sortOrder: top + 1 }).returning();
  await audit(ctx, { action: 'sticker_pack.created', resourceType: 'sticker_pack', resourceId: row!.id, metadata: { name: input.name } });
  return row!;
}

export async function updatePack(ctx: Ctx, packId: string, input: { name?: string; active?: boolean }) {
  requireSuperAdmin(ctx);
  const [row] = await ctx.db.update(stickerPacks).set({ ...(input.name !== undefined ? { name: input.name } : {}), ...(input.active !== undefined ? { active: input.active } : {}), updatedAt: ctx.now() }).where(eq(stickerPacks.id, packId)).returning();
  if (!row) throw notFound();
  await audit(ctx, { action: 'sticker_pack.updated', resourceType: 'sticker_pack', resourceId: packId, metadata: input });
  return row;
}

/** Xóa cả bộ. Ảnh của các nhãn chỉ bị dọn khỏi kho khi không còn bình luận, tin nhắn nào dùng. */
export async function deletePack(ctx: Ctx, packId: string): Promise<void> {
  requireSuperAdmin(ctx);
  const rows = await ctx.db.delete(stickers).where(eq(stickers.packId, packId)).returning({ url: stickers.imageUrl });
  const [pack] = await ctx.db.delete(stickerPacks).where(eq(stickerPacks.id, packId)).returning();
  if (!pack) throw notFound();
  await releaseStickerFiles(ctx, rows.map((r) => r.url));
  await audit(ctx, { action: 'sticker_pack.deleted', resourceType: 'sticker_pack', resourceId: packId, metadata: { name: pack.name, stickers: rows.length } });
}

export async function reorderPacks(ctx: Ctx, ids: string[]): Promise<void> {
  requireSuperAdmin(ctx);
  for (const [i, id] of ids.entries()) await ctx.db.update(stickerPacks).set({ sortOrder: i }).where(eq(stickerPacks.id, id));
}

/**
 * Thêm nhãn vào bộ từ các ảnh vừa tải lên (purpose `sticker`). Chỉ nhận tệp ảnh công khai đã tải xong.
 * GIF và WebP động giữ nguyên chuyển động (máy chủ không chuyển GIF sang WebP).
 */
export async function addStickers(ctx: Ctx, packId: string, items: Array<{ fileId: string; keywords: string[] }>) {
  requireSuperAdmin(ctx);
  const pack = await ctx.db.query.stickerPacks.findFirst({ where: eq(stickerPacks.id, packId) });
  if (!pack) throw notFound();
  const found = await ctx.db.query.files.findMany({ where: inArray(files.id, items.map((i) => i.fileId)) });
  const byId = new Map(found.map((f) => [f.id, f]));
  for (const i of items) {
    const f = byId.get(i.fileId);
    if (!f || f.status !== 'ready' || f.visibility !== 'public' || !f.url || !f.mimeType.startsWith('image/')) throw invalid('Có ảnh chưa tải xong hoặc không phải ảnh, thử tải lại');
  }
  const top = await ctx.db.select({ m: max(stickers.sortOrder) }).from(stickers).where(eq(stickers.packId, packId)).then((r) => r[0]?.m ?? -1);
  const rows = await ctx.db.insert(stickers).values(items.map((i, n) => {
    const f = byId.get(i.fileId)!;
    return { packId, imageUrl: f.url!, keywords: i.keywords, width: f.width, height: f.height, sortOrder: top + 1 + n };
  })).returning();
  await ctx.db.update(stickerPacks).set({ updatedAt: ctx.now() }).where(eq(stickerPacks.id, packId));
  await audit(ctx, { action: 'sticker.added', resourceType: 'sticker_pack', resourceId: packId, metadata: { count: rows.length } });
  return { stickers: rows.map(view) };
}

export async function updateSticker(ctx: Ctx, stickerId: string, input: { keywords: string[] }) {
  requireSuperAdmin(ctx);
  const [row] = await ctx.db.update(stickers).set({ keywords: input.keywords, updatedAt: ctx.now() }).where(eq(stickers.id, stickerId)).returning();
  if (!row) throw notFound();
  return view(row);
}

export async function deleteSticker(ctx: Ctx, stickerId: string): Promise<void> {
  requireSuperAdmin(ctx);
  const [row] = await ctx.db.delete(stickers).where(eq(stickers.id, stickerId)).returning();
  if (!row) throw notFound();
  await releaseStickerFiles(ctx, [row.imageUrl]);
  await audit(ctx, { action: 'sticker.deleted', resourceType: 'sticker_pack', resourceId: row.packId, metadata: { stickerId } });
}

export async function reorderStickers(ctx: Ctx, packId: string, ids: string[]): Promise<void> {
  requireSuperAdmin(ctx);
  for (const [i, id] of ids.entries()) await ctx.db.update(stickers).set({ sortOrder: i }).where(and(eq(stickers.id, id), eq(stickers.packId, packId)));
}

/** Dọn ảnh nhãn đã xóa: tệp thuộc người đã tải lên, và chỉ xóa khi không còn chỗ nào dùng (releaseFiles tự kiểm). */
async function releaseStickerFiles(ctx: Ctx, urls: string[]): Promise<void> {
  const uploaded = urls.filter((u) => !u.startsWith('/'));
  if (!uploaded.length) return;
  const owners = await ctx.db.selectDistinct({ id: files.ownerUserId }).from(files).where(inArray(files.url, uploaded));
  await releaseFiles(ctx, { urls: uploaded }, { ownerUserIds: owners.map((o) => o.id) });
}
