// Tệp và ảnh: xin URL tải lên (presigned), ghi nhận sau khi tải xong, URL ký cho tệp riêng,
// và dọn tệp trên R2 khi ảnh bị gỡ (xem releaseFiles).
import { randomToken } from '@hoiminh/config';
import { validateUpload, webpKeyFor } from '@hoiminh/media';
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { files } from '@hoiminh/db';
import type { Ctx } from '../context';
import { AppError, conflict, invalid, notFound } from '../errors';
import { FILE_DELETE_JOB } from '../jobs/kinds';
import { scheduleJob } from '../jobs/scheduled';
import { raw } from '../lib/db';
import { requireUser } from '../permissions';

/** Bước 1: xin presigned URL. Ảnh bài viết/avatar là public; tài liệu khóa học, tệp số là private. */
export async function requestUpload(ctx: Ctx, input: { fileName: string; mimeType: string; sizeBytes: number; purpose: 'post_image' | 'avatar' | 'cover' | 'lesson_resource' | 'digital_product' | 'message_image' | 'comment_image'; communityId?: string | null; workspaceId?: string | null }) {
  const userId = requireUser(ctx);
  // Provider local ghi tệp bằng node:fs. Cloudflare Workers không có hệ tệp nên tệp "tải xong"
  // rồi biến mất ngay (đã xảy ra với avatar quản trị ngày 16/09). Chặn sớm và nói đúng nguyên nhân.
  if (ctx.media.kind === 'local' && ctx.env.APP_ENV === 'production') {
    throw new AppError('invalid_state', 'Chưa nối R2 nên không tải tệp lên được. Thêm [[r2_buckets]] binding FILES vào wrangler.toml của API (hoặc đặt 4 biến R2_*) rồi deploy lại.', 503);
  }
  const v = validateUpload(input.mimeType, input.sizeBytes);
  if (!v.ok) throw invalid(v.reason);
  if (['post_image', 'avatar', 'cover', 'message_image', 'comment_image'].includes(input.purpose) && v.kind !== 'image') throw invalid('Mục này chỉ nhận ảnh');
  const visibility = input.purpose === 'lesson_resource' || input.purpose === 'digital_product' ? 'private' : 'public';
  // Ảnh công khai lưu ở dạng WebP: tệp đã là WebP, hoặc máy chủ chuyển được JPEG/PNG lúc nhận tệp (xem route PUT /files/upload).
  const ext = visibility === 'public' && webpKeyFor(input.mimeType, ctx.media.convertsToWebp) ? 'webp' : input.fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'bin';
  const objectKey = `${visibility}/${input.purpose}/${new Date().toISOString().slice(0, 10)}/${randomToken(12)}.${ext}`;
  const presigned = await ctx.media.presignUpload(objectKey, input.mimeType);
  const [row] = await ctx.db.insert(files).values({ workspaceId: input.workspaceId ?? null, communityId: input.communityId ?? null, ownerUserId: userId, objectKey, url: visibility === 'public' ? ctx.media.getUrl(objectKey) : null, mimeType: input.mimeType, sizeBytes: input.sizeBytes, originalName: input.fileName, visibility, status: 'pending' }).returning();
  return { fileId: row!.id, upload: presigned, url: row!.url };
}

/**
 * Máy chủ vừa chuyển ảnh sang WebP lúc nhận tệp: ghi lại loại tệp và dung lượng thật đang nằm trong kho.
 * Chỉ đụng tới dòng còn `pending` (chưa xác nhận) của đúng object key đó.
 */
export async function recordStoredObject(ctx: Ctx, objectKey: string, stored: { mimeType: string; sizeBytes: number }): Promise<void> {
  await ctx.db.update(files).set({ mimeType: stored.mimeType, sizeBytes: stored.sizeBytes }).where(and(eq(files.objectKey, objectKey), eq(files.status, 'pending')));
}

/** Bước 2: xác nhận đã tải xong (kèm kích thước ảnh nếu có). */
export async function completeUpload(ctx: Ctx, fileId: string, meta: { width?: number | null; height?: number | null }) {
  const userId = requireUser(ctx);
  const [row] = await ctx.db.update(files).set({ status: 'ready', width: meta.width ?? null, height: meta.height ?? null }).where(and(eq(files.id, fileId), eq(files.ownerUserId, userId))).returning();
  if (!row) throw notFound();
  return { id: row.id, url: row.url, objectKey: row.objectKey, width: row.width, height: row.height, visibility: row.visibility };
}

/** URL ký cho tệp riêng (chủ sở hữu hoặc người có quyền xử lý ở service gọi). */
export async function signedUrl(ctx: Ctx, objectKey: string, ttl = 3600): Promise<string> {
  return ctx.media.getSignedUrl(objectKey, ttl);
}

// ---------------------------------------------------------------------------------------------
// Dọn tệp trên R2
//
// Xóa nhầm một tệp còn đang dùng là mất dữ liệu không lấy lại được, nên việc dọn đi theo bốn luật:
//  1. Chỉ xóa tệp mà mọi nơi trong FILE_REFERENCES đều đã hết trỏ tới (kể cả hàng xóa mềm).
//  2. Chỉ xóa tệp thuộc đúng chủ: do người dùng trong `ownerUserIds` tải lên, hoặc gắn với `communityId`.
//     Nhờ vậy avatar trỏ vào ảnh của người khác không kéo theo việc xóa ảnh đó.
//  3. Tìm tệp bằng khớp đúng `files.url` hoặc `files.id`, không bao giờ tự suy object key từ URL do client gửi.
//  4. Xóa dòng `files` và đặt việc xóa R2 vào hàng đợi trong CÙNG transaction với việc gỡ tham chiếu.
//     Giao dịch bị hủy thì cả hai cùng hủy; consumer của Queue xóa thật trên R2 ngay sau commit, tự thử lại khi R2 lỗi, và bộ quét cứu nếu Queue bỏ cuộc.
// ---------------------------------------------------------------------------------------------

export { FILE_DELETE_JOB };

/**
 * Mọi cột lưu tham chiếu tới tệp đã tải lên. `url`: bản sao của files.url (tài liệu riêng lưu object key);
 * `id`: files.id; `id-array`: mảng jsonb các files.id; `id-in-items`: mảng jsonb các object có khóa `fileId`.
 * Thêm cột mới lưu URL hoặc id tệp thì PHẢI thêm vào đây, không thì việc dọn R2 có thể xóa nhầm tệp đang dùng.
 * Test file-cleanup.test.ts quét schema và báo nếu có cột tên `*url*` hay `*file*` chưa được xếp loại.
 */
export const FILE_REFERENCES = [
  { table: 'users', column: 'avatar_url', kind: 'url' },
  { table: 'communities', column: 'logo_url', kind: 'url' },
  { table: 'communities', column: 'cover_url', kind: 'url' },
  { table: 'communities', column: 'about_media', kind: 'id-in-items' },
  { table: 'courses', column: 'cover_url', kind: 'url' },
  { table: 'products', column: 'cover_url', kind: 'url' },
  { table: 'products', column: 'digital_file_ids', kind: 'id-array' },
  { table: 'product_pages', column: 'cover_image_url', kind: 'url' },
  { table: 'comments', column: 'image_url', kind: 'url' },
  { table: 'messages', column: 'image_url', kind: 'url' },
  { table: 'post_images', column: 'url', kind: 'url' },
  { table: 'post_images', column: 'file_id', kind: 'id' },
  { table: 'lesson_resources', column: 'url', kind: 'url' },
  { table: 'lesson_resources', column: 'file_id', kind: 'id' },
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const distinct = (xs: ReadonlyArray<string | null | undefined> | undefined): string[] => [...new Set((xs ?? []).filter((x): x is string => Boolean(x)))];

/** Trong `ids`, những tệp mà còn ít nhất một dòng nào đó trỏ tới. */
async function stillReferenced(ctx: Ctx, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const checks = FILE_REFERENCES.map((r) => {
    const t = sql.identifier(r.table);
    const c = sql.identifier(r.column);
    if (r.kind === 'url') return sql`exists (select 1 from ${t} where ${c} in (f.url, f.object_key))`;
    if (r.kind === 'id') return sql`exists (select 1 from ${t} where ${c} = f.id)`;
    if (r.kind === 'id-in-items') return sql`exists (select 1 from ${t} where ${c} @> jsonb_build_array(jsonb_build_object('fileId', f.id::text)))`;
    return sql`exists (select 1 from ${t} where ${c} @> to_jsonb(f.id::text))`;
  });
  const rows = await raw<{ id: string }>(ctx.db, sql`select f.id from files f where f.id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)}) and (${sql.join(checks, sql` or `)})`);
  return new Set(rows.map((r) => r.id));
}

/** Xóa dòng `files` và xếp việc xóa R2 vào hàng đợi; gọi trong transaction của thao tác gỡ tham chiếu. */
async function dropFiles(ctx: Ctx, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const removed = await ctx.db.delete(files).where(inArray(files.id, ids)).returning({ objectKey: files.objectKey });
  if (removed.length) {
    // Ghi cùng transaction với việc gỡ tham chiếu (outbox); R2 chỉ bị xóa sau khi commit, vì message vào Queue sau commit.
    for (const r of removed) await scheduleJob(ctx, { kind: FILE_DELETE_JOB, payload: { objectKey: r.objectKey }, dedupeKey: `${FILE_DELETE_JOB}:${r.objectKey}`, runAt: ctx.now() });
  }
  return removed.length;
}

export interface ReleaseTarget {
  /** URL đang lưu ở cột nào đó (bản sao của files.url). Giá trị không khớp tệp nào bị bỏ qua. */
  urls?: ReadonlyArray<string | null | undefined>;
  fileIds?: ReadonlyArray<string | null | undefined>;
}
export interface ReleaseScope {
  /** Tệp do những người dùng này tải lên. */
  ownerUserIds?: ReadonlyArray<string | null | undefined>;
  /** Hoặc tệp gắn với hội này (lúc tải lên có truyền communityId). */
  communityId?: string | null;
}

/**
 * Giải phóng tệp vừa bị gỡ khỏi nơi dùng: nếu không còn nơi nào trỏ tới và tệp thuộc đúng phạm vi thì xóa dòng `files`
 * và xếp việc xóa trên R2 vào hàng đợi. Phải gọi SAU khi đã gỡ tham chiếu, trong cùng transaction.
 * Trả về số tệp đã giải phóng. Lưu ý: khi bật RLS thật, hàm này cần chạy với quyền bypass để thấy mọi bảng.
 */
export async function releaseFiles(ctx: Ctx, target: ReleaseTarget, scope: ReleaseScope): Promise<number> {
  const urls = distinct(target.urls);
  const ids = distinct(target.fileIds).filter((i) => UUID.test(i));
  const owners = distinct(scope.ownerUserIds);
  if ((!urls.length && !ids.length) || (!owners.length && !scope.communityId)) return 0;
  const candidates = await ctx.db
    .select({ id: files.id })
    .from(files)
    .where(and(or(urls.length ? inArray(files.url, urls) : undefined, ids.length ? inArray(files.id, ids) : undefined), or(owners.length ? inArray(files.ownerUserId, owners) : undefined, scope.communityId ? eq(files.communityId, scope.communityId) : undefined)));
  if (!candidates.length) return 0;
  const used = await stillReferenced(ctx, candidates.map((c) => c.id));
  return dropFiles(ctx, candidates.map((c) => c.id).filter((id) => !used.has(id)));
}

/** Người dùng bỏ một ảnh vừa tải lên mà chưa dùng (bấm X ở ô soạn bài, chọn ảnh khác trước khi lưu). */
export async function discardUpload(ctx: Ctx, fileId: string): Promise<void> {
  const userId = requireUser(ctx);
  if (!UUID.test(fileId)) throw notFound();
  const own = await ctx.db.query.files.findFirst({ where: and(eq(files.id, fileId), eq(files.ownerUserId, userId)), columns: { id: true } });
  if (!own) throw notFound();
  const released = await releaseFiles(ctx, { fileIds: [own.id] }, { ownerUserIds: [userId] });
  if (!released) throw conflict('Tệp đang được dùng nên không xóa được');
}

/**
 * Dọn tệp `pending` đã quá `olderThanHours` mà không ai dùng: đã xin URL tải lên nhưng không bao giờ xác nhận xong
 * (đóng tab, mất mạng giữa chừng). Tệp `ready` không quét ở đây vì không phân biệt được với ảnh đã dán URL vào Markdown.
 */
export async function sweepAbandonedUploads(ctx: Ctx, opts: { olderThanHours?: number; limit?: number } = {}): Promise<number> {
  const cutoff = new Date(ctx.now().getTime() - (opts.olderThanHours ?? 24) * 3_600_000);
  const stale = await ctx.db.select({ id: files.id }).from(files).where(and(eq(files.status, 'pending'), lt(files.createdAt, cutoff))).limit(opts.limit ?? 200);
  if (!stale.length) return 0;
  const used = await stillReferenced(ctx, stale.map((s) => s.id));
  return dropFiles(ctx, stale.map((s) => s.id).filter((id) => !used.has(id)));
}
