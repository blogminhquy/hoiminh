import { describe, expect, it } from 'vitest';
import { LogSender, RecordingSender, ResendSender, emailProviderLabel, templates } from './index';

describe('email', () => {
  it('mẫu xác minh chứa mã và bản text', () => {
    const m = templates.verifyCode('a@b.vn', 'An', '482913');
    expect(m.subject).toContain('482913');
    expect(m.html).toContain('482913');
    expect(m.text).toContain('Xác minh email');
  });
  it('LogSender ghi vào outbox', async () => {
    const s = new LogSender();
    const r = await s.send(templates.welcomeMember('a@b.vn', 'An', 'Hội X', 'http://x'));
    expect(r.status).toBe('logged');
    expect(s.outbox).toHaveLength(1);
  });
  it('RecordingSender ghi kết quả mọi lần gửi và không vỡ khi ghi lỗi', async () => {
    const seen: string[] = [];
    const s = new RecordingSender(new LogSender(), (m, r) => { seen.push(`${m.template}:${r.status}`); });
    await s.send(templates.testEmail('a@b.vn', 'An', { env: 'test', from: 'x', sentAt: 'now' }));
    await s.flush();
    expect(seen).toEqual(['test_email:logged']);
    expect(emailProviderLabel(s)).toBe('log');
    const broken = new RecordingSender(new LogSender(), () => { throw new Error('db down'); });
    expect((await broken.send(templates.verifyCode('a@b.vn', 'An', '1'))).status).toBe('logged');
    await broken.flush();
    expect(emailProviderLabel(new ResendSender('k', 'f'))).toBe('Resend');
  });
});
