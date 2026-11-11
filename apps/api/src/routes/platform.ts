// Gói nền tảng, API key, webhook gửi đi, tệp, hồ sơ công khai, sức khỏe.
import { createApiKeySchema, createWebhookSchema } from '@hoiminh/contracts';
import { apiKeys, filesService, platformBilling, users, webhooksOut } from '@hoiminh/core';
import { ProxiedMediaProvider, attachmentDisposition, maxBytesForKey, webpTarget } from '@hoiminh/media';
import { z } from 'zod';
import { body, parse, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';

export const platformRoutes = router();

platformRoutes.get('/plans', async (c) => c.json(await platformBilling.listPlans(c.get('ctx'))));
platformRoutes.get('/users/:handle', async (c) => c.json(await users.publicProfile(c.get('ctx'), c.req.param('handle'))));
/** Gói của một hội: gói đang dùng, số thành viên so với trần, bảng gói để chọn (trang Gói cho hội). */
platformRoutes.get('/communities/:id/plan', requireAuth, async (c) => c.json(await platformBilling.communityPlanStatus(c.get('ctx'), c.req.param('id'))));

platformRoutes.get('/workspaces/:id/api-keys', requireAuth, async (c) => c.json(await apiKeys.listApiKeys(c.get('ctx'), c.req.param('id'))));
platformRoutes.post('/workspaces/:id/api-keys', requireAuth, async (c) => c.json(await apiKeys.createApiKey(c.get('ctx'), c.req.param('id'), await parse(createApiKeySchema, await body(c))), 201));
platformRoutes.delete('/workspaces/:id/api-keys/:keyId', requireAuth, async (c) => {
  await apiKeys.revokeApiKey(c.get('ctx'), c.req.param('id'), c.req.param('keyId'));
  return c.json({ ok: true });
});
platformRoutes.get('/workspaces/:id/webhooks', requireAuth, async (c) => c.json(await webhooksOut.listWebhooks(c.get('ctx'), c.req.param('id'))));
platformRoutes.post('/workspaces/:id/webhooks', requireAuth, async (c) => c.json(await webhooksOut.createWebhook(c.get('ctx'), c.req.param('id'), await parse(createWebhookSchema.extend({ communityId: z.string().uuid().nullable().optional() }), await body(c))), 201));
platformRoutes.delete('/workspaces/:id/webhooks/:webhookId', requireAuth, async (c) => {
  await webhooksOut.deleteWebhook(c.get('ctx'), c.req.param('id'), c.req.param('webhookId'));
  return c.json({ ok: true });
});

const uploadSchema = z.object({ fileName: z.string().min(1).max(200), mimeType: z.string(), sizeBytes: z.number().int().positive(), purpose: z.enum(['post_image', 'avatar', 'cover', 'lesson_resource', 'digital_product', 'message_image', 'message_file', 'comment_image']), communityId: z.string().uuid().nullable().optional(), workspaceId: z.string().uuid().nullable().optional() });
platformRoutes.post('/files/upload-url', requireAuth, async (c) => c.json(await filesService.requestUpload(c.get('ctx'), await parse(uploadSchema, await body(c))), 201));
/** Bỏ ảnh vừa tải lên mà chưa dùng (chủ tệp; tệp đang được dùng thì 409). */
platformRoutes.delete('/files/:id', requireAuth, async (c) => {
  await filesService.discardUpload(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
platformRoutes.post('/files/:id/complete', requireAuth, async (c) => c.json(await filesService.completeUpload(c.get('ctx'), c.req.param('id'), await parse(z.object({ width: z.number().nullable().optional(), height: z.number().nullable().optional() }), await body(c)))));

/**
 * Tệp đi qua API (binding R2 trên Worker, hoặc đĩa local khi dev): PUT nhận tệp theo URL ký,
 * GET phát tệp; tệp riêng (`private/`) phải có chữ ký còn hạn. Với R2 qua S3 thì trình duyệt
 * nói thẳng với R2, các route này trả 404.
 */
export const localFilesRoutes = router();
const memory = new Map<string, { bytes: Uint8Array; type: string }>();

function proxied(c: { get(k: 'ctx'): { media: unknown } }): ProxiedMediaProvider | null {
  const m = c.get('ctx').media;
  return m instanceof ProxiedMediaProvider ? m : null;
}

localFilesRoutes.put('/upload/*', async (c) => {
  const media = proxied(c);
  if (!media) return c.json({ code: 'not_found', message: 'Tệp không đi qua API ở cấu hình này' }, 404);
  const key = c.req.path.replace(/^\/files\/upload\//, '');
  const u = new URL(c.req.url);
  if (!(await media.verify(key, u.searchParams.get('expires') ?? '', u.searchParams.get('sig') ?? ''))) return c.json({ code: 'forbidden', message: 'URL tải lên không hợp lệ hoặc đã hết hạn' }, 403);
  const type = c.req.header('content-type') ?? 'application/octet-stream';
  let bytes: Uint8Array = new Uint8Array(await c.req.arrayBuffer());
  // Dung lượng khai lúc xin URL là do client tự báo; ở đây mới là byte thật, nên giới hạn 5MB của tệp đính kèm tin nhắn phải kiểm lại.
  const cap = maxBytesForKey(key);
  if (cap !== null && bytes.byteLength > cap) return c.json({ code: 'validation_error', message: `Tệp vượt ${Math.round(cap / 1024 / 1024)}MB` }, 413);
  let stored = type;
  // Ảnh công khai còn là JPEG/PNG (trình duyệt không đổi được sang WebP, client cũ, gọi API trực tiếp): chuyển sang WebP trước khi ghi vào kho.
  // Không chuyển được (hết hạn mức Images, ảnh hỏng) thì lưu đúng tệp nhận được, lượt tải lên vẫn thành công.
  const target = media.images ? webpTarget(key, type) : null;
  if (target && media.images) {
    const webp = await media.images.toWebp(bytes, target);
    if (webp) { bytes = webp; stored = 'image/webp'; }
  }
  if (media.store) await media.store.put(key, bytes, stored);
  else await persistLocal(key, bytes, stored);
  if (stored !== type) await filesService.recordStoredObject(c.get('ctx'), key, { mimeType: stored, sizeBytes: bytes.byteLength });
  return c.json({ ok: true, key, bytes: bytes.byteLength, contentType: stored });
});
localFilesRoutes.get('/*', async (c) => {
  const media = proxied(c);
  if (!media) return c.json({ code: 'not_found', message: 'Tệp không đi qua API ở cấu hình này' }, 404);
  const key = c.req.path.replace(/^\/files\//, '');
  const isPrivate = key.startsWith('private/');
  if (isPrivate) {
    const u = new URL(c.req.url);
    if (!(await media.verify(key, u.searchParams.get('expires') ?? '', u.searchParams.get('sig') ?? ''))) return c.json({ code: 'forbidden', message: 'Tệp riêng cần URL ký còn hạn' }, 403);
  }
  const cache = isPrivate ? 'private, max-age=300' : 'public, max-age=31536000, immutable';
  // ?download=<tên>: tải về với tên gốc thay vì mở trong tab (tệp đính kèm tin nhắn).
  const download = new URL(c.req.url).searchParams.get('download');
  const disposition: Record<string, string> = download ? { 'Content-Disposition': attachmentDisposition(download) } : {};
  if (media.store) {
    const obj = await media.store.get(key);
    if (!obj) return c.json({ code: 'not_found', message: 'Không có tệp' }, 404);
    const headers: Record<string, string> = { 'Content-Type': obj.contentType, 'Cache-Control': cache, ...disposition };
    if (obj.size !== null) headers['Content-Length'] = String(obj.size);
    if (obj.etag) headers.ETag = obj.etag;
    return c.body(obj.body as ReadableStream, 200, headers);
  }
  const f = await loadLocal(key);
  if (!f) return c.json({ code: 'not_found', message: 'Không có tệp' }, 404);
  const buf = f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength) as ArrayBuffer;
  return c.body(buf, 200, { 'Content-Type': f.type, 'Cache-Control': cache, ...disposition });
});

async function persistLocal(key: string, bytes: Uint8Array, type: string): Promise<void> {
  memory.set(key, { bytes, type });
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.resolve(process.cwd(), '../../.data/files', key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    await fs.writeFile(file + '.type', type);
  } catch {
    /* môi trường không có fs: giữ trong bộ nhớ (chỉ để test) */
  }
}
async function loadLocal(key: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  const mem = memory.get(key);
  if (mem) return mem;
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.resolve(process.cwd(), '../../.data/files', key);
    const bytes = new Uint8Array(await fs.readFile(file));
    const type = await fs.readFile(file + '.type', 'utf8').catch(() => 'application/octet-stream');
    return { bytes, type };
  } catch {
    return null;
  }
}
