import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { AccountAvatarLink } from './AccountAvatarLink';

const render = (avatarUrl: string | null) =>
  renderToStaticMarkup(
    <StaticRouter location="/">
      <AccountAvatarLink user={{ name: 'Minh Quý', avatarUrl }} />
    </StaticRouter>,
  );

describe('AccountAvatarLink', () => {
  it('avatar là link dẫn tới cài đặt hồ sơ', () => {
    const html = render(null);
    expect(html).toMatch(/^<a [^>]*href="\/tai-khoan\/ho-so"/);
    expect(html).toContain('aria-label="Cài đặt hồ sơ"');
  });

  it('hiện ảnh đại diện khi đã có', () => {
    expect(render('https://api.hoiminh.com/files/public/avatar/a.png')).toMatch(/background-image:url\(&quot;https:\/\/api\.hoiminh\.com\/files\/public\/avatar\/a\.png&quot;\)/);
  });

  it('chưa có ảnh thì hiện chữ cái đầu', () => {
    expect(render(null)).toContain('>MQ<');
  });
});
