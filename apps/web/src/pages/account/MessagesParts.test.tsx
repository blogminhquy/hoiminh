import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { MessageItem, type Message } from './MessagesParts';

const other = { id: 'u2', name: 'Công Trần', handle: 'cong-tran', avatarUrl: null, coverColor: null };
const base: Message = { id: 'm1', senderUserId: 'u2', body: '', imageUrl: null, automated: false, deliveredAt: null, readAt: null, createdAt: new Date().toISOString(), recalled: false, reactions: {}, replyTo: null, file: null };
const noop = () => undefined;
const renderMessage = (m: Partial<Message>) =>
  renderToStaticMarkup(
    <StaticRouter location="/">
      <MessageItem m={{ ...base, ...m }} mine={false} myId="u1" other={other} first status={null} flash={false} active={false} onActivate={noop} onReply={noop} onReact={noop} onRecall={noop} onJump={noop} onImageLoad={noop} onDownload={noop} />
    </StaticRouter>,
  );

describe('MessageItem: ảnh và tệp tự xóa sau 30 ngày', () => {
  it('ảnh và tệp đang có kèm nhãn hạn tự xóa; nhãn dán, GIF và tin chữ thì không', () => {
    expect(renderMessage({ imageUrl: 'https://api.test/files/public/message_image/a.webp' })).toMatch(/Tự xóa sau \d+ ngày/);
    expect(renderMessage({ file: { name: 'Hợp đồng.pdf', sizeBytes: 2048 } })).toMatch(/Tự xóa sau \d+ ngày/);
    expect(renderMessage({ imageUrl: 'https://cdn.test/s.webp', mediaKind: 'sticker' })).not.toContain('Tự xóa');
    expect(renderMessage({ body: 'Chào bạn' })).not.toContain('Tự xóa');
  });
  it('ảnh, tệp đã hết hạn: hiện thay thế rõ ràng, tệp giữ tên nhưng không còn nút tải', () => {
    const img = renderMessage({ body: 'Ảnh hóa đơn', imageExpired: true });
    expect(img).toContain('Ảnh đã hết hạn');
    expect(img).toContain('Ảnh hóa đơn');
    expect(img).not.toContain('Tự xóa');
    const file = renderMessage({ file: { name: 'Hợp đồng.pdf', sizeBytes: 2048, expired: true } });
    expect(file).toContain('Hợp đồng.pdf');
    expect(file).toContain('Tệp đã hết hạn');
    expect(file).not.toContain('aria-label="Tải tệp');
  });
});
