// Lời mời vào hội: link `?invite=` chủ hội gửi phải được đọc lại thật. Người được mời đăng ký từ link đó thì vào thẳng
// hội (không bảng câu hỏi, không chờ duyệt); chủ hội thấy lời mời đang chờ ở khung mời và thu hồi được, thu hồi xong
// link báo không còn hiệu lực.
import { expect, test } from '@playwright/test';
import { apiJson, apiToken, login, uniqueEmail, USERS } from '../helpers';

interface Community { id: string; slug: string }
interface PendingInvite { id: string; email: string | null; role: string; url: string }

async function communityId(request: Parameters<typeof apiToken>[0], token: string): Promise<string> {
  const list = await apiJson<Community[]>(request, token, 'GET', '/v1/me/communities');
  return list.find((c) => c.slug === 'minhquy')!.id;
}

test('người được mời mở link, đăng ký xong vào thẳng hội: không bảng câu hỏi, không bấm tham gia lần nữa', async ({ page, request }) => {
  const email = uniqueEmail('duocmoi');
  const owner = await apiToken(request, USERS.owner);
  const id = await communityId(request, owner);
  const [sent] = await apiJson<Array<{ email: string; url: string }>>(request, owner, 'POST', `/v1/communities/${id}/invites`, { emails: [email] });
  const link = new URL(sent!.url);
  expect(link.searchParams.get('invite')).toBeTruthy();

  await page.goto(link.pathname + link.search);
  await expect(page.getByText('Bạn được chủ hội mời vào hội này')).toBeVisible();
  await page.getByRole('button', { name: 'Nhận lời mời và vào hội' }).click();
  await expect(page).toHaveURL(/dang-ky/);

  await page.getByPlaceholder('Nguyễn Minh Quý').fill('Người Được Mời');
  await page.getByPlaceholder('ban@email.com').fill(email);
  await page.locator('input[type="password"]').fill('matkhau-e2e-123');
  await page.getByText(/Tôi đồng ý với/).click();
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page).toHaveURL(/xac-minh-email/);
  await page.getByLabel('Số thứ 1').click();
  await page.keyboard.type('482913');

  // Hội này có câu hỏi tham gia (bài 01 phải điền mới vào được). Người được mời thì vào thẳng Bảng tin.
  await expect(page).toHaveURL(/\/minhquy\/bang-tin/, { timeout: 25_000 });
  await expect(page.getByText('Lộ trình Funnel Money Model 2026').first()).toBeVisible();

  // Lời mời đã nhận không còn ở danh sách đang chờ, và thành viên mới mang nguồn "được mời".
  const waiting = await apiJson<{ items: PendingInvite[] }>(request, owner, 'GET', `/v1/communities/${id}/invites`);
  expect(waiting.items.some((i) => i.email === email)).toBe(false);
  const found = await apiJson<{ items: Array<{ email: string; source: string; status: string; role: string }> }>(request, owner, 'GET', `/v1/communities/${id}/members?q=${encodeURIComponent(email)}`);
  expect(found.items[0]).toMatchObject({ source: 'invite', status: 'active', role: 'member' });
});

test('chủ hội gửi lời mời ở khung mời, thấy ở danh sách đang chờ, thu hồi thì link báo không còn hiệu lực', async ({ page, request, browser }) => {
  const email = uniqueEmail('thuhoi');
  await login(page, USERS.owner);
  await page.goto('/minhquy/thanh-vien?moi=1');
  const modal = page.getByRole('dialog').or(page.locator('.modal'));
  await modal.getByPlaceholder('Mỗi dòng một email').fill(email);
  await modal.getByRole('button', { name: 'Gửi lời mời' }).click();
  await expect(modal.getByText('Đã gửi 1 lời mời')).toBeVisible();
  const row = modal.locator('div').filter({ hasText: email }).filter({ has: page.getByRole('button', { name: 'Thu hồi' }) }).last();
  await expect(row).toBeVisible();

  const owner = await apiToken(request, USERS.owner);
  const id = await communityId(request, owner);
  const waiting = await apiJson<{ items: PendingInvite[] }>(request, owner, 'GET', `/v1/communities/${id}/invites`);
  const link = new URL(waiting.items.find((i) => i.email === email)!.url);

  await row.getByRole('button', { name: 'Thu hồi' }).click();
  await expect(modal.getByText(email)).toHaveCount(0);

  // Người cầm link đã bị thu hồi (chưa đăng nhập) thấy lời báo rõ ràng và nút tham gia thường.
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(link.pathname + link.search);
  await expect(guestPage.getByText('Lời mời không còn hiệu lực')).toBeVisible();
  await expect(guestPage.getByRole('button', { name: /Tham gia miễn phí/ }).first()).toBeVisible();
  await guest.close();
});
