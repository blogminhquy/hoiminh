import { describe, expect, it } from 'vitest';
import { LogSender, RecordingSender, ResendSender, emailProviderLabel, escapeHtml, templates } from './index';

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
  it('giá trị do người dùng nhập được mã hóa: không chèn được thẻ hay link vào email', () => {
    const evil = 'Hacker <a href="https://lua-dao.example">Bấm nhận quà</a>';
    const all = [
      templates.welcomeMember('a@b.vn', evil, evil, 'https://hoiminh.com/x'),
      templates.newMessage('a@b.vn', evil, evil, 'https://hoiminh.com/x'),
      templates.planReminder('a@b.vn', evil, evil, evil, 3, 'https://hoiminh.com/x'),
      templates.withdrawalRejected('a@b.vn', evil, '1đ', evil),
      templates.invite('a@b.vn', evil, evil, 'https://hoiminh.com/x'),
      templates.ownerTransferReported('a@b.vn', { ownerName: evil, buyerName: evil, item: evil, community: evil, amount: '1đ', reference: 'HM ABCDE', url: 'https://hoiminh.com/x/tien' }),
      templates.ownerOrderPaid('a@b.vn', { ownerName: evil, buyerName: evil, item: evil, community: evil, amount: '1đ', reference: 'HM ABCDE', url: 'https://hoiminh.com/x/tien' }),
    ];
    for (const m of all) {
      expect(m.html).not.toContain('<a href="https://lua-dao.example"');
      expect(m.html).toContain('&lt;a href=&quot;https://lua-dao.example&quot;&gt;');
    }
    // Bản text giữ nguyên chữ gốc, không lộ &lt; &amp;.
    expect(all[1]!.text).toContain('Hacker <a href="https://lua-dao.example">Bấm nhận quà</a>');
  });
  it('email thử hiện đủ địa chỉ gửi, kể cả phần <email>', () => {
    const m = templates.testEmail('a@b.vn', 'An', { env: 'production', from: 'Hội Mình <no-reply@hoiminh.com>', sentAt: 'now' });
    expect(m.html).toContain('Gửi từ: Hội Mình &lt;no-reply@hoiminh.com&gt;');
    expect(m.text).toContain('Gửi từ: Hội Mình <no-reply@hoiminh.com>');
  });
  it('chữ tiếng Việt và ký hiệu thường không bị đổi', () => {
    expect(escapeHtml('Kinh Doanh Online Cùng AI · 499.000đ')).toBe('Kinh Doanh Online Cùng AI · 499.000đ');
    expect(escapeHtml(`Tom & Jerry's "hội"`)).toBe('Tom &amp; Jerry&#39;s &quot;hội&quot;');
    const m = templates.paymentSucceeded('a@b.vn', 'Minh Quý', 'Khóa học AI', '499.000đ', 'https://hoiminh.com/x?a=1&b=2');
    expect(m.html).toContain('Chào Minh Quý, chúng tôi đã nhận <strong>499.000đ</strong> cho <strong>Khóa học AI</strong>');
    expect(m.html).toContain('href="https://hoiminh.com/x?a=1&amp;b=2"');
  });
});
