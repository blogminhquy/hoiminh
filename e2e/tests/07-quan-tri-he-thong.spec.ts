// Luồng 7: super admin xem tổng quan; chuyển khoản thiếu mã → đối soát → ghép thủ công → đơn paid; khóa một hội.
import { expect, test } from '@playwright/test';
import { API, USERS, apiJson, apiToken, login, sepayWebhook } from '../helpers';

test('đối soát ghép thủ công và khóa hội', async ({ page, request }) => {
  const member = await apiToken(request, USERS.member2);
  const shell = await apiJson<{ community: { id: string } }>(request, member, 'GET', '/v1/communities/by-slug/minhquy/shell');
  const session = await apiJson<{ orderId: string; reference: string; amountMinor: number }>(request, member, 'POST', '/v1/checkout', { target: { type: 'tier', communityId: shell.community.id, tierKey: 'premium', cycle: 'monthly' }, provider: 'sepay' });
  expect(await sepayWebhook(request, 'DUY NGUYEN chuyen tien hoc phi', session.amountMinor)).toBe(200);

  await login(page, USERS.admin);
  await page.goto('/he-thong');
  await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống' })).toBeVisible();
  await expect(page.getByText('GMV qua nền tảng')).toBeVisible();

  await page.goto('/he-thong/thanh-toan');
  await expect(page.getByText('Đối soát chuyển khoản')).toBeVisible();
  const row = page.locator('div', { hasText: 'DUY NGUYEN chuyen tien hoc phi' }).filter({ has: page.getByRole('button', { name: /Ghép/ }) }).last();
  await row.getByRole('button', { name: /Ghép/ }).click();
  await row.getByPlaceholder('HM XXXXX').fill(session.reference);
  await row.getByRole('button', { name: 'Ghép', exact: true }).click();
  await expect(page.locator('div', { hasText: 'DUY NGUYEN chuyen tien hoc phi' }).filter({ has: page.getByRole('button', { name: /Ghép/ }) })).toHaveCount(0);

  const order = await request.get(`${API}/v1/orders/${session.orderId}`, { headers: { Authorization: `Bearer ${member}` } });
  expect(((await order.json()) as { status: string }).status).toBe('paid');

  await page.goto('/he-thong/hoi');
  await expect(page.getByRole('heading', { name: 'Hội' })).toBeVisible();
  page.once('dialog', (d) => void d.accept('Nội dung bị báo cáo'));
  const target = page.locator('div', { hasText: 'Shopee 0 đồng' }).filter({ has: page.getByRole('button', { name: 'Khóa' }) }).last();
  await target.getByRole('button', { name: 'Khóa' }).click();
  await page.getByRole('button', { name: /Bị khóa/ }).click();
  await expect(page.getByText('Shopee 0 đồng').first()).toBeVisible();
});
