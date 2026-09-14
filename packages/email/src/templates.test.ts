import { describe, expect, it } from 'vitest';
import { LogSender, templates } from './index';

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
});
