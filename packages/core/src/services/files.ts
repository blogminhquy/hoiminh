// Tệp và ảnh: xin URL tải lên (presigned), ghi nhận sau khi tải xong, URL ký cho tệp riêng.
import { randomToken } from '@hoiminh/config';
import { validateUpload } from '@hoiminh/media';
import { and, eq } from 'drizzle-orm';
import { files } from '@hoiminh/db';
import type { Ctx } from '../context';
import { invalid, notFound } from '../errors';
import { requireUser } from '../permissions';

/** Bước 1: xin presigned URL. Ảnh bài viết/avatar là public; tài liệu khóa học, tệp số là private. */
export async function requestUpload(ctx: Ctx, input: { fileName: string; mimeType: string; sizeBytes: number; purpose: 'post_image' | 'avatar' | 'cover' | 'lesson_resource' | 'digital_product' | 'message_image' | 'comment_image'; communityId?: string | null; workspaceId?: string | null }) {
  const userId = requireUser(ctx);
  const v = validateUpload(input.mimeType, input.sizeBytes);
  if (!v.ok) throw invalid(v.reason);
  if (['post_image', 'avatar', 'cover', 'message_image', 'comment_image'].includes(input.purpose) && v.kind !== 'image') throw invalid('Mục này chỉ nhận ảnh');
  const visibility = input.purpose === 'lesson_resource' || input.purpose === 'digital_product' ? 'private' : 'public';
  const ext = input.fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'bin';
  const objectKey = `${visibility}/${input.purpose}/${new Date().toISOString().slice(0, 10)}/${randomToken(12)}.${ext}`;
  const presigned = await ctx.media.presignUpload(objectKey, input.mimeType);
  const [row] = await ctx.db.insert(files).values({ workspaceId: input.workspaceId ?? null, communityId: input.communityId ?? null, ownerUserId: userId, objectKey, url: visibility === 'public' ? ctx.media.getUrl(objectKey) : null, mimeType: input.mimeType, sizeBytes: input.sizeBytes, originalName: input.fileName, visibility, status: 'pending' }).returning();
  return { fileId: row!.id, upload: presigned, url: row!.url };
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
