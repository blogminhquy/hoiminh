// Thẻ và quy tắc tự động.
//  - /v1/communities/:id/automation/*: màn quản trị (nguồn đồng bộ, liên hệ, thẻ, quy tắc, nhật ký), cần settings.manage.
//  - /v1/activation/:token: trang kích hoạt khách bấm từ email, không cần đăng nhập (link chính là bằng chứng).
//  - /webhooks/in/:token: địa chỉ nhận dữ liệu từ landing (Webcake...), máy gọi máy, khóa nằm trong địa chỉ.
//  - /webhooks/unsubscribe/:token: link "Ngừng nhận email" ở chân thư.
import { activateSchema, automationRuleSchema, contactCreateSchema, contactFilterSchema, inboundSourceSchema, inboundSourceUpdateSchema, tagNameSchema } from '@hoiminh/contracts';
import { AppError, automation, automationEngine } from '@hoiminh/core';
import { z } from 'zod';
import { body, parse, query, router, type Ctx$ } from '../lib/hono';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { respondSession } from '../lib/session-cookie';

export const automationRoutes = router();
automationRoutes.use('/:id/automation/*', requireAuth);

const cid = (c: Ctx$) => c.req.param('id')!;

automationRoutes.get('/:id/automation/options', async (c) => c.json(await automation.ruleOptions(c.get('ctx'), cid(c))));

automationRoutes.get('/:id/automation/sources', async (c) => c.json(await automation.listSources(c.get('ctx'), cid(c))));
automationRoutes.post('/:id/automation/sources', async (c) => c.json(await automation.createSource(c.get('ctx'), cid(c), await parse(inboundSourceSchema, await body(c))), 201));
automationRoutes.patch('/:id/automation/sources/:sourceId', async (c) => c.json(await automation.updateSource(c.get('ctx'), cid(c), c.req.param('sourceId'), await parse(inboundSourceUpdateSchema, await body(c)))));
automationRoutes.post('/:id/automation/sources/:sourceId/rotate', async (c) => c.json(await automation.rotateSourceToken(c.get('ctx'), cid(c), c.req.param('sourceId'))));
automationRoutes.delete('/:id/automation/sources/:sourceId', async (c) => {
  await automation.deleteSource(c.get('ctx'), cid(c), c.req.param('sourceId'));
  return c.json({ ok: true });
});
automationRoutes.get('/:id/automation/sources/:sourceId/events', async (c) => c.json(await automation.listSourceEvents(c.get('ctx'), cid(c), c.req.param('sourceId'))));
automationRoutes.post('/:id/automation/events/:eventId/reprocess', async (c) => c.json(await automation.reprocessEvent(c.get('ctx'), cid(c), c.req.param('eventId'))));

automationRoutes.get('/:id/automation/tags', async (c) => c.json(await automation.listTags(c.get('ctx'), cid(c))));
automationRoutes.get('/:id/automation/contacts', async (c) => c.json(await automation.listContacts(c.get('ctx'), cid(c), await parse(contactFilterSchema, query(c)))));
automationRoutes.post('/:id/automation/contacts', async (c) => c.json(await automation.createContact(c.get('ctx'), cid(c), await parse(contactCreateSchema, await body(c))), 201));
automationRoutes.delete('/:id/automation/contacts/:contactId', async (c) => {
  await automation.deleteContact(c.get('ctx'), cid(c), c.req.param('contactId'));
  return c.json({ ok: true });
});
automationRoutes.post('/:id/automation/contacts/:contactId/tags', async (c) => {
  const { tag } = await parse(z.object({ tag: tagNameSchema }), await body(c));
  return c.json(await automation.addContactTag(c.get('ctx'), cid(c), c.req.param('contactId'), tag));
});
automationRoutes.delete('/:id/automation/contacts/:contactId/tags/:tag', async (c) => c.json(await automation.removeContactTag(c.get('ctx'), cid(c), c.req.param('contactId'), c.req.param('tag'))));
automationRoutes.post('/:id/automation/contacts/:contactId/resend-activation', async (c) => c.json(await automation.resendActivation(c.get('ctx'), cid(c), c.req.param('contactId'))));

automationRoutes.get('/:id/automation/rules', async (c) => c.json(await automation.listRules(c.get('ctx'), cid(c))));
automationRoutes.post('/:id/automation/rules', async (c) => c.json(await automation.createRule(c.get('ctx'), cid(c), await parse(automationRuleSchema, await body(c))), 201));
automationRoutes.patch('/:id/automation/rules/:ruleId', async (c) => c.json(await automation.updateRule(c.get('ctx'), cid(c), c.req.param('ruleId'), await parse(automationRuleSchema.partial(), await body(c)))));
automationRoutes.delete('/:id/automation/rules/:ruleId', async (c) => {
  await automation.deleteRule(c.get('ctx'), cid(c), c.req.param('ruleId'));
  return c.json({ ok: true });
});
automationRoutes.get('/:id/automation/runs', async (c) => c.json(await automation.listRuns(c.get('ctx'), cid(c), { ruleId: query(c).ruleId })));

/** Trang kích hoạt: xem link mở những gì, rồi đặt mật khẩu (người mới) hoặc nhận quyền vào tài khoản sẵn có. */
export const activationRoutes = router();
activationRoutes.get('/:token', async (c) => c.json(await automationEngine.activationInfo(c.get('ctx'), c.req.param('token'))));
activationRoutes.post('/:token', rateLimit('auth'), async (c) => {
  const input = await parse(activateSchema, await body(c));
  const r = await automationEngine.activate(c.get('ctx'), c.get('app').auth, c.req.param('token'), input, { userAgent: c.req.header('user-agent') });
  // Người mới được đăng nhập luôn: respondSession đặt cookie phiên vào phản hồi sắp trả.
  const session = r.session ? ((await respondSession(c, r.session).json()) as Record<string, unknown>) : null;
  return c.json({ session, needsLogin: !r.session, redirect: r.redirect, email: r.email, granted: r.granted });
});

const MAX_BODY = 64_000;

/** Gom dữ liệu gửi về thành một object: tham số trên địa chỉ + thân JSON, form hoặc multipart. */
async function readPayload(c: Ctx$): Promise<Record<string, unknown>> {
  const fromQuery = query(c);
  if (c.req.method === 'GET') return fromQuery;
  const type = (c.req.header('content-type') ?? '').toLowerCase();
  let data: unknown = {};
  if (type.includes('multipart/form-data')) {
    const form = await c.req.parseBody();
    data = Object.fromEntries(Object.entries(form).filter(([, v]) => typeof v === 'string'));
  } else {
    const text = await c.req.text();
    if (text.length > MAX_BODY) throw new AppError('validation_error', 'Dữ liệu gửi về quá lớn (tối đa 64KB)', 413);
    if (text.trim()) {
      if (type.includes('application/x-www-form-urlencoded')) data = Object.fromEntries(new URLSearchParams(text));
      else {
        try {
          data = JSON.parse(text);
        } catch {
          data = text.includes('=') ? Object.fromEntries(new URLSearchParams(text)) : { raw: text.slice(0, 2000) };
        }
      }
    }
  }
  if (Array.isArray(data)) data = { items: data };
  if (data === null || typeof data !== 'object') data = { value: data };
  return { ...fromQuery, ...(data as Record<string, unknown>) };
}

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function simplePage(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{font-family:'Open Sans',system-ui,sans-serif;background:#F7F3EC;color:#1F1B17;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box}.card{background:#FFFDF9;border:1px solid #E8E1D6;border-radius:16px;padding:28px;max-width:440px;width:100%;font-size:17px;line-height:1.6}h1{font-size:22px;margin:0 0 8px}p{color:#5C554D;margin:0 0 16px}button{display:block;width:100%;height:48px;border:0;border-radius:10px;font-weight:600;font-size:16px;cursor:pointer;background:#1F1B17;color:#fff}</style></head><body><div class="card"><h1>${esc(title)}</h1>${bodyHtml}</div></body></html>`;
}

export const inboundRoutes = router();
inboundRoutes.use('*', rateLimit('webhook', { scope: 'inbound' }));

for (const method of ['get', 'post'] as const) {
  inboundRoutes[method]('/in/:token', async (c) => {
    const payload = await readPayload(c);
    // Mở địa chỉ bằng trình duyệt (GET không kèm dữ liệu) chỉ để kiểm tra địa chỉ còn sống, không ghi nhật ký.
    const ping = c.req.method === 'GET' && Object.keys(payload).length === 0;
    return c.json(await automation.receiveInbound(c.get('ctx'), c.req.param('token'), payload, { ping }));
  });
}

// Hộp thư và máy quét link hay tự mở link trong email: GET chỉ hiện nút xác nhận, bấm nút (POST) mới ngừng nhận.
inboundRoutes.get('/unsubscribe/:token', (c) => c.html(simplePage('Ngừng nhận email?', '<p>Bấm nút dưới đây để không nhận email quảng bá từ người gửi này nữa. Thư giao quyền truy cập bạn đã mua vẫn được gửi.</p><form method="post"><button type="submit">Ngừng nhận email</button></form>')));
inboundRoutes.post('/unsubscribe/:token', async (c) => {
  const r = await automationEngine.unsubscribeContact(c.get('ctx'), c.req.param('token'));
  if (!r) return c.html(simplePage('Link không còn hiệu lực', '<p>Không tìm thấy địa chỉ email ứng với link này.</p>'), 404);
  return c.html(simplePage('Đã ngừng nhận email', `<p>Bạn sẽ không nhận email quảng bá từ <strong>${esc(r.sender)}</strong> nữa.</p>`));
});
