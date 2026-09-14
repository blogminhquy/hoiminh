// Gói nền tảng, API key, webhook gửi đi, tệp, hồ sơ công khai, sức khỏe.
import { createApiKeySchema, createWebhookSchema } from '@hoiminh/contracts';
import { apiKeys, filesService, platformBilling, users, webhooksOut } from '@hoiminh/core';
import { LocalMediaProvider } from '@hoiminh/media';
import { z } from 'zod';
import { body, parse, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';

export const platformRoutes = router();

platformRoutes.get('/plans', async (c) => c.json(await platformBilling.listPlans(c.get('ctx'))));
platformRoutes.get('/users/:handle', async (c) => c.json(await users.publicProfile(c.get('ctx'), c.req.param('handle'))));
platformRoutes.get('/workspaces/:id/platform', requireAuth, async (c) => c.json(await platformBilling.platformStatus(c.get('ctx'), c.req.param('id'))));

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

const uploadSchema = z.object({ fileName: z.string().min(1).max(200), mimeType: z.string(), sizeBytes: z.number().int().positive(), purpose: z.enum(['post_image', 'avatar', 'cover', 'lesson_resource', 'digital_product', 'message_image', 'comment_image']), communityId: z.string().uuid().nullable().optional(), workspaceId: z.string().uuid().nullable().optional() });
platformRoutes.post('/files/upload-url', requireAuth, async (c) => c.json(await filesService.requestUpload(c.get('ctx'), await parse(uploadSchema, await body(c))), 201));
platformRoutes.post('/files/:id/complete', requireAuth, async (c) => c.json(await filesService.completeUpload(c.get('ctx'), c.req.param('id'), await parse(z.object({ width: z.number().nullable().optional(), height: z.number().nullable().optional() }), await body(c)))));

/** Lưu trữ tệp local (khi không cấu hình R2): PUT nhận tệp, GET phát tệp; URL riêng phải có chữ ký. */
export const localFilesRoutes = router();
const store = new Map<string, { bytes: Uint8Array; type: string }>();

localFilesRoutes.put('/upload/*', async (c) => {
  const ctx = c.get('ctx');
  const media = ctx.media;
  if (!(media instanceof LocalMediaProvider)) return c.json({ code: 'not_found', message: 'Không dùng lưu trữ local' }, 404);
  const key = c.req.path.replace(/^\/files\/upload\//, '');
  const u = new URL(c.req.url);
  if (!(await media.verify(key, u.searchParams.get('expires') ?? '', u.searchParams.get('sig') ?? ''))) return c.json({ code: 'forbidden', message: 'URL tải lên không hợp lệ' }, 403);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  await persist(key, bytes, c.req.header('content-type') ?? 'application/octet-stream');
  return c.json({ ok: true, key });
});
localFilesRoutes.get('/*', async (c) => {
  const ctx = c.get('ctx');
  const media = ctx.media;
  const key = c.req.path.replace(/^\/files\//, '');
  if (key.startsWith('private/')) {
    const u = new URL(c.req.url);
    if (!(media instanceof LocalMediaProvider) || !(await media.verify(key, u.searchParams.get('expires') ?? '', u.searchParams.get('sig') ?? ''))) return c.json({ code: 'forbidden', message: 'Tệp riêng cần URL ký' }, 403);
  }
  const f = await load(key);
  if (!f) return c.json({ code: 'not_found', message: 'Không có tệp' }, 404);
  const buf = f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength) as ArrayBuffer;
  return c.body(buf, 200, { 'Content-Type': f.type, 'Cache-Control': key.startsWith('private/') ? 'private, max-age=300' : 'public, max-age=31536000' });
});

async function persist(key: string, bytes: Uint8Array, type: string): Promise<void> {
  store.set(key, { bytes, type });
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.resolve(process.cwd(), '../../.data/files', key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    await fs.writeFile(file + '.type', type);
  } catch {
    /* môi trường không có fs (Worker): giữ trong bộ nhớ */
  }
}
async function load(key: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  const mem = store.get(key);
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
