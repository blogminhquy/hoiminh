// Hệ thống · Hạ tầng: khóa nhập trên web được lưu mã hóa, không bao giờ trả lại nguyên văn, áp ngay vào
// App đang chạy, App dựng lại vẫn đọc được, xóa thì quay về secret của Worker.
import { providerAccounts } from '@hoiminh/db';
import { emailProviderLabel } from '@hoiminh/email';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import * as infra from '../services/infra';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
const KEY = 're_TestKey_1234567890abcd';

beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

describe('Hạ tầng: email Resend', () => {
  it('chưa lưu gì thì email chỉ ghi log, địa chỉ gửi là mặc định', async () => {
    const d = await infra.getInfra(await app.as('admin'));
    expect(d.email.provider).toBe('log');
    expect(d.email.fields.apiKey).toEqual({ source: 'none', value: null, hint: null });
    expect(d.email.fields.from!.source).toBe('default');
    expect(d.secrets.encryptionKey).toBe(true);
  });

  it('key sai định dạng bị từ chối trước khi lưu', async () => {
    await expect(infra.updateInfra(await app.as('admin'), 'email', { values: { apiKey: 'sk_live_abc' } })).rejects.toMatchObject({ code: 'validation_error' });
    await expect(infra.updateInfra(await app.as('admin'), 'email', { values: { from: 'khong-phai-email' } })).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('lưu key: chỉ trả 4 ký tự cuối, database lưu mã hóa, bộ gửi đổi sang Resend ngay', async () => {
    const d = await infra.updateInfra(await app.as('admin'), 'email', { values: { apiKey: KEY, from: 'Hội Mình <hello@hoiminh.com>' } });
    expect(d.email.fields.apiKey).toEqual({ source: 'saved', value: null, hint: '••••abcd' });
    expect(d.email.fields.from).toMatchObject({ source: 'saved', value: 'Hội Mình <hello@hoiminh.com>' });
    expect(JSON.stringify(d)).not.toContain(KEY);
    expect(d.email.provider).toBe('Resend');
    expect(emailProviderLabel(app.ctx.email)).toBe('Resend');
    expect(app.ctx.env.EMAIL_FROM).toBe('Hội Mình <hello@hoiminh.com>');

    const row = await app.ctx.db.query.providerAccounts.findFirst({ where: eq(providerAccounts.provider, 'infra_email') });
    expect(row?.credentialsEncrypted).toBeTruthy();
    expect(row!.credentialsEncrypted).not.toContain(KEY);
  });

  it('ô để trống thì giữ nguyên giá trị đã lưu', async () => {
    const d = await infra.updateInfra(await app.as('admin'), 'email', { values: { apiKey: '', from: 'Hội Mình <no-reply@hoiminh.com>' } });
    expect(d.email.fields.apiKey!.hint).toBe('••••abcd');
    expect(d.email.fields.from!.value).toBe('Hội Mình <no-reply@hoiminh.com>');
  });

  it('App dựng lại (như Worker mỗi request) vẫn đọc được key đã lưu', async () => {
    const fresh = await createApp({ env: app.ctx.infra!.base, db: app.ctx.db });
    expect(fresh.ctx.env.RESEND_API_KEY).toBe(KEY);
    expect(emailProviderLabel(fresh.ctx.email)).toBe('Resend');
    await fresh.close();
  });

  it('xóa key đã lưu thì quay về secret của Worker (ở đây là chưa có, nên chỉ ghi log)', async () => {
    const d = await infra.updateInfra(await app.as('admin'), 'email', { clear: ['apiKey', 'from'] });
    expect(d.email.fields.apiKey!.source).toBe('none');
    expect(d.email.fields.from!.source).toBe('default');
    expect(d.email.provider).toBe('log');
    expect(app.ctx.env.RESEND_API_KEY).toBe('');
  });
});

describe('Hạ tầng: phát hành web qua Cloudflare', () => {
  it('lưu token và Account ID thì phần phát hành được coi là đã cấu hình', async () => {
    const before = await infra.getInfra(await app.as('admin'));
    expect(before.release.configured).toBe(false);
    expect(before.release.fields.webScript).toMatchObject({ source: 'default', value: 'hoiminh-web' });
    await expect(infra.updateInfra(await app.as('admin'), 'release', { values: { accountId: 'khong-hop-le' } })).rejects.toMatchObject({ code: 'validation_error' });
    const d = await infra.updateInfra(await app.as('admin'), 'release', { values: { apiToken: 'cf_token_abcdefghijklmnopqrstuvwxyz', accountId: '0123456789abcdef0123456789abcdef' } });
    expect(d.release.configured).toBe(true);
    expect(d.release.fields.apiToken!.hint).toBe('••••wxyz');
    expect(d.release.fields.accountId!.value).toBe('0123456789abcdef0123456789abcdef');
  });
});

describe('Hạ tầng: quyền', () => {
  it('chỉ super admin xem và sửa được', async () => {
    await expect(infra.getInfra(await app.as('minhquy'))).rejects.toMatchObject({ code: 'forbidden' });
    await expect(infra.updateInfra(await app.as('minhquy'), 'email', { values: { apiKey: KEY } })).rejects.toMatchObject({ code: 'forbidden' });
  });
});
