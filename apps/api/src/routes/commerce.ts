// Cửa hàng, sản phẩm, checkout, đơn hàng, hoàn tiền của chủ hội.
import { createCheckoutSchema, createProductSchema, guestCheckoutSchema, joinRefs, storeQuerySchema, updateProductSchema } from '@hoiminh/contracts';
import { checkout, guestCheckout, paymentsService, store } from '@hoiminh/core';
import { z } from 'zod';
import { body, parse, query, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

export const commerceRoutes = router();

commerceRoutes.get('/communities/:id/products', async (c) => {
  const q = await parse(storeQuerySchema, query(c));
  return c.json(await store.listProducts(c.get('ctx'), c.req.param('id'), q));
});
commerceRoutes.post('/communities/:id/products', requireAuth, async (c) => c.json(await store.createProduct(c.get('ctx'), c.req.param('id'), await parse(createProductSchema, await body(c))), 201));
commerceRoutes.get('/products/:id', async (c) => c.json(await store.getProduct(c.get('ctx'), c.req.param('id'))));
commerceRoutes.patch('/products/:id', requireAuth, async (c) => c.json(await store.updateProduct(c.get('ctx'), c.req.param('id'), await parse(updateProductSchema, await body(c)))));
commerceRoutes.delete('/products/:id', requireAuth, async (c) => {
  await store.deleteProduct(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
commerceRoutes.get('/products/:id/downloads', requireAuth, async (c) => c.json(await store.digitalDownloads(c.get('ctx'), c.req.param('id'))));

commerceRoutes.post('/checkout', requireAuth, rateLimit('write', { scope: 'checkout' }), async (c) => {
  const input = await parse(createCheckoutSchema, await body(c));
  const cookieRef = getCookie(c.req.header('cookie'), 'hm_ref');
  return c.json(await checkout.createCheckout(c.get('ctx'), { ...input, ref: joinRefs(input.ref, cookieRef) }), 201);
});
// Mua trước, tạo tài khoản sau: khách chưa đăng nhập mua bằng email. Trình duyệt nhận mã đơn (`guestToken`) và gửi lại
// (tham số `t`, hoặc header X-Order-Token) để xem đơn và báo đã chuyển khoản. Mã này vốn đã nằm trên địa chỉ trang đơn. Đếm theo IP và email như đăng ký, vì mỗi lượt có thể tạo tài khoản chờ.
commerceRoutes.post('/checkout/guest', rateLimit('auth'), async (c) => {
  const input = await parse(guestCheckoutSchema, await body(c));
  const cookieRef = getCookie(c.req.header('cookie'), 'hm_ref');
  return c.json(await guestCheckout.guestCheckout(c.get('ctx'), { ...input, ref: joinRefs(input.ref, cookieRef) }), 201);
});
const orderToken = (c: { req: { header: (name: string) => string | undefined; query: (name: string) => string | undefined } }) => c.req.query('t') || c.req.header('x-order-token') || '';
commerceRoutes.get('/guest-orders/:id', async (c) => c.json(await guestCheckout.guestOrderStatus(c.get('ctx'), c.req.param('id'), orderToken(c))));
commerceRoutes.post('/guest-orders/:id/processing', rateLimit('write', { scope: 'guest-processing' }), async (c) => c.json(await guestCheckout.guestMarkProcessing(c.get('ctx'), c.req.param('id'), orderToken(c))));
commerceRoutes.get('/orders/:id', requireAuth, async (c) => c.json(await checkout.orderStatus(c.get('ctx'), c.req.param('id'))));
commerceRoutes.post('/orders/:id/processing', requireAuth, async (c) => c.json(await checkout.markProcessing(c.get('ctx'), c.req.param('id'))));
commerceRoutes.post('/orders/:id/admin-refund', requireAuth, async (c) => {
  const { reason } = await parse(z.object({ reason: z.string().max(500).default('') }), await body(c));
  return c.json(await paymentsService.adminRefund(c.get('ctx'), c.req.param('id'), reason));
});

function getCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const m = header.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
