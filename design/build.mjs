// Generator for the Hội Mình design canvas artboards.
// Run: node build.mjs  -> writes *.dc.html + canvas.json next to this file.
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// ---------- tokens ----------
const T = {
  bg: '#F7F3EC', surface: '#FFFDF9', ink: '#1F1B17', ink2: '#5C554D', ink3: '#8C8478',
  line: '#E8E1D6', line2: '#E3DCD0', accent: '#D4593A', accentSoft: '#FBE9E2',
  teal: '#0E8E96', tealSoft: '#DDF1F1', side: '#25201B', sideText: '#CFC6B8', sideMuted: '#8C8478',
  gold: '#C89B3C', goldSoft: '#F8EFD9',
};

// ---------- icons (stroke, 24 grid) ----------
const ic = (d, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
// Lucide icons (ISC license, https://lucide.dev) — official SVG sources in ./icons, inlined at build time.
const lucideInner = (name) => readFileSync(join(here, 'icons', name + '.svg'), 'utf8')
  .replace(/^[\s\S]*?>\s*(?=<)/, '').replace(/<\/svg>\s*$/, '').replace(/\s*\n\s*/g, '');
const L = {
  home: 'house', users: 'users', calendar: 'calendar', trophy: 'trophy', book: 'book-open', lock: 'lock', store: 'store',
  settings: 'settings', wallet: 'wallet', search: 'search', bell: 'bell', chat: 'message-circle', heart: 'heart', pin: 'pin',
  plus: 'plus', image: 'image', link: 'link', play: 'play', poll: 'chart-column', check: 'check', down: 'chevron-down',
  right: 'chevron-right', ext: 'external-link', filter: 'list-filter', download: 'download', mail: 'mail', x: 'x',
  more: 'ellipsis', clock: 'clock', file: 'file-text', qr: 'qr-code', spark: 'sparkles', shield: 'shield-check',
  video: 'video', globe: 'globe', back: 'chevron-left', user: 'user', send: 'send', paperclip: 'paperclip',
  checkcheck: 'check-check', at: 'at-sign', megaphone: 'megaphone', badge: 'badge-check', archive: 'archive',
  dollar: 'circle-dollar-sign', copy: 'copy', userplus: 'user-plus', belloff: 'bell-off', mailopen: 'mail-open',
};
const I = Object.fromEntries(Object.entries(L).map(([k, n]) => [k, (s) => ic(lucideInner(n), s)]));

// ---------- base document ----------
const helmet = `
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&amp;family=Open+Sans:wght@400;500;600;700&amp;display=swap">
  <style>
    body { margin: 0; background: ${T.bg}; color: ${T.ink}; font-family: 'Open Sans', 'Segoe UI', system-ui, sans-serif; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
    a { color: ${T.teal}; text-decoration: none; } a:hover { color: #0B6F75; }
    * { box-sizing: border-box; }
    .serif { letter-spacing: -0.01em; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; padding: 0 16px; border-radius: 10px; font-weight: 600; font-size: 14px; border: 1px solid transparent; white-space: nowrap; }
    .btn-primary { background: ${T.accent}; color: #FFFDF9; }
    .btn-ghost { background: ${T.surface}; border-color: ${T.line2}; color: ${T.ink}; }
    .btn-dark { background: ${T.ink}; color: #FFFDF9; }
    .btn-sm { height: 32px; padding: 0 12px; font-size: 13px; border-radius: 8px; }
    .chip { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid ${T.line2}; background: ${T.surface}; font-size: 13px; font-weight: 500; color: ${T.ink2}; white-space: nowrap; }
    .chip.on { background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink}; }
    .tag { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .card { background: ${T.surface}; border: 1px solid ${T.line}; border-radius: 16px; }
    .nav-item { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border-radius: 10px; color: ${T.sideText}; font-weight: 500; font-size: 14px; }
    .nav-item.on { background: rgba(255,253,249,0.10); color: #FFFDF9; }
    .nav-group { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: ${T.sideMuted}; font-weight: 600; padding: 18px 12px 6px; }
    .avatar { border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-weight: 600; color: #FFFDF9; flex-shrink: 0; }
    .muted { color: ${T.ink3}; }
    .input { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 14px; border: 1px solid ${T.line2}; border-radius: 10px; background: ${T.surface}; color: ${T.ink3}; font-size: 14px; }
    .th { font-size: 12px; font-weight: 600; color: ${T.ink3}; text-transform: uppercase; letter-spacing: 0.06em; }
    .row { display: flex; align-items: center; }
    .stack { display: flex; flex-direction: column; }
    .prog { height: 6px; border-radius: 999px; background: ${T.line}; overflow: hidden; }
    .prog > div { height: 100%; border-radius: 999px; background: ${T.teal}; }
    .md { font-size: 16px; line-height: 1.75; color: ${T.ink}; }
    .md p { margin: 0 0 16px; }
    .md h2 { font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 24px; line-height: 1.3; margin: 32px 0 12px; letter-spacing: -0.01em; }
    .md h3 { font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 19px; line-height: 1.35; margin: 24px 0 10px; }
    .md strong { font-weight: 700; color: ${T.ink}; }
    .md em { font-style: italic; }
    .md ul, .md ol { margin: 0 0 16px; padding-left: 24px; }
    .md li { margin: 4px 0; }
    .md li::marker { color: ${T.accent}; font-weight: 700; }
    .md blockquote { margin: 20px 0; padding: 14px 20px; border-left: 3px solid ${T.accent}; background: ${T.accentSoft}; border-radius: 0 12px 12px 0; color: ${T.ink2}; font-style: italic; }
    .md code { font-family: Consolas, 'Courier New', monospace; font-size: 14px; background: ${T.bg}; padding: 2px 6px; border-radius: 6px; }
    .md hr { border: 0; border-top: 1px solid ${T.line}; margin: 28px 0; }
    .md figure { margin: 20px 0; }
    .md figcaption { font-size: 13px; color: ${T.ink3}; text-align: center; padding-top: 8px; }
    .md a { font-weight: 600; text-decoration: underline; text-decoration-color: ${T.tealSoft}; text-underline-offset: 3px; }
  </style>
</helmet>`;

const doc = (body, extra = '') => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
${helmet}
${body}
</x-dc>${extra}
</body>
</html>
`;

const avatar = (initials, bg, size = 36, fs = 13) =>
  `<div class="avatar" style="width: ${size}px; height: ${size}px; background: ${bg}; font-size: ${fs}px;">${initials}</div>`;

// ---------- app shell (desktop 1440x960) ----------
let DEMO = false;
function shell({ active, main, height = 960 }) {
  const nav = (key, icon, label, extra = '') =>
    `<div class="nav-item${active === key ? ' on' : ''}" data-go="${key}" style="display: flex; align-items: center; gap: 10px;">${icon}<span style="flex-grow: 1;">${label}</span>${extra}</div>`;
  const lockBadge = `<span style="color: ${T.sideMuted};">${I.lock(16)}</span>`;
  return `
<div style="${DEMO ? 'width: 100%; min-height: 100vh;' : `width: 1440px; height: ${height}px;`} display: flex; background: ${T.bg}; overflow: ${DEMO ? 'visible' : 'hidden'};">
  <!-- Sidebar -->
  <aside style="width: 264px; ${DEMO ? 'height: 100vh; position: sticky; top: 0;' : `height: ${height}px;`} background: ${T.side}; color: ${T.sideText}; display: flex; flex-direction: column; padding: 16px 12px; flex-shrink: 0;">
    <div style="display: flex; align-items: center; gap: 10px; padding: 6px 8px 14px; border-bottom: 1px solid rgba(255,253,249,0.08);">
      <div style="width: 40px; height: 40px; border-radius: 12px; background: ${T.accent}; display: flex; align-items: center; justify-content: center; color: #FFFDF9; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 18px;">KD</div>
      <div style="flex-grow: 1; min-width: 0;">
        <div style="color: #FFFDF9; font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Kinh Doanh Online Cùng AI</div>
        <div style="font-size: 12px; color: ${T.sideMuted};">234 thành viên · 12 đang online</div>
      </div>
      <span style="color: ${T.sideMuted};" data-go="ws-home">${I.down(18)}</span>
    </div>

    <div class="nav-group">Cộng đồng</div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      ${nav('feed', I.home(20), 'Bảng tin')}
      ${nav('members', I.users(20), 'Thành viên')}
      ${nav('events', I.calendar(20), 'Sự kiện', `<span style="font-size: 11px; font-weight: 600; background: ${T.accent}; color: #FFFDF9; border-radius: 999px; padding: 1px 7px;">2</span>`)}
      ${nav('affiliate', I.trophy(20), 'Xếp hạng cộng sự')}
    </div>

    <div class="nav-group">Học tập</div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      ${nav('courses', I.book(20), 'Khóa học', `<span style="font-size: 12px; color: ${T.teal}; font-weight: 600;">27%</span>`)}
      ${nav('resources', I.file(20), 'Tài nguyên', lockBadge)}
    </div>

    <div class="nav-group">Mua sắm</div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      ${nav('store', I.store(20), 'Cửa hàng')}
    </div>

    <div class="nav-group">Quản trị</div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      ${nav('settings', I.settings(20), 'Cài đặt')}
      ${nav('revenue', I.wallet(20), 'Doanh thu')}
    </div>

    <div style="flex-grow: 1;"></div>
    <div class="btn btn-primary" style="width: 100%;">${I.plus(18)}Mời thành viên</div>
  </aside>

  <!-- Main -->
  <div style="flex-grow: 1; display: flex; flex-direction: column; min-width: 0;">
    <header style="height: 64px; display: flex; align-items: center; gap: 16px; padding: 0 32px; border-bottom: 1px solid ${T.line}; background: ${T.surface};">
      <div style="display: flex; align-items: center; gap: 8px; color: ${T.ink}; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 20px;">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="9" cy="13" r="7" fill="${T.accent}"></circle><circle cx="17" cy="13" r="7" fill="${T.teal}" fill-opacity="0.85"></circle></svg>
        Hội Mình
      </div>
      <div class="input" style="width: 420px; margin-left: 24px;">${I.search(18)}<span>Tìm bài viết, khóa học, thành viên…</span></div>
      <div style="flex-grow: 1;"></div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="position: relative; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: ${T.ink2}; border: 1px solid ${T.line2}; background: ${T.surface};" data-go="messages">${I.chat(20)}<span style="position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 999px; background: ${T.accent};"></span></div>
        <div style="position: relative; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: ${T.ink2}; border: 1px solid ${T.line2}; background: ${T.surface};" data-go="notifications">${I.bell(20)}<span style="position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 999px; background: ${T.accent};"></span></div>
        <span data-go="account">${avatar('MQ', T.ink, 40, 14)}</span>
      </div>
    </header>
    <div style="flex-grow: 1; overflow: ${DEMO ? 'visible' : 'hidden'}; padding: 28px 32px;">
      ${main}
    </div>
  </div>
</div>`;
}

// ---------- Ảnh kiểu Facebook: 1 ảnh lớn + hàng nhỏ, thừa thì +N ----------
const photo = (bg, h, extra = '') => `<div style="height: ${h}; border-radius: 10px; background: ${bg}; display: flex; align-items: center; justify-content: center; color: rgba(255,253,249,0.6); position: relative; overflow: hidden;${extra}">${I.image(28)}</div>`;
const fbGrid = (colors) => {
  const n = colors.length;
  if (n === 1) return photo(colors[0], '360px');
  if (n === 2) return `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px;">${photo(colors[0], '260px')}${photo(colors[1], '260px')}</div>`;
  if (n === 3) return `<div style="display: flex; flex-direction: column; gap: 6px;">${photo(colors[0], '300px')}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px;">${photo(colors[1], '160px')}${photo(colors[2], '160px')}</div></div>`;
  const rest = n - 4;
  return `<div style="display: flex; flex-direction: column; gap: 6px;">${photo(colors[0], '320px')}<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px;">${photo(colors[1], '140px')}${photo(colors[2], '140px')}${photo(colors[3], '140px', rest > 0 ? '' : '')}${rest > 0 ? '' : ''}</div></div>`.replace(/(<div style="height: 140px;[^>]*>[\s\S]*?<\/div>)(\s*<\/div><\/div>)$/, (m, last, tail) => rest > 0 ? last.replace('</div>', `<span style="position: absolute; inset: 0; background: rgba(31,27,23,0.55); color: #FFFDF9; display: flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 26px;">+${rest}</span></div>`) + tail : m);
};

// ---------- Nền cho status ngắn (dưới 130 ký tự, không ảnh) ----------
const STATUS_BGS = [
  { key: 'dat', css: 'linear-gradient(135deg, #D4593A 0%, #B23A6E 100%)', fg: '#FFFDF9' },
  { key: 'ngoc', css: 'linear-gradient(135deg, #0E8E96 0%, #1F4E79 100%)', fg: '#FFFDF9' },
  { key: 'nau', css: '#25201B', fg: '#F2C46B' },
  { key: 'vang', css: 'linear-gradient(135deg, #E0B458 0%, #D4593A 100%)', fg: '#1F1B17' },
  { key: 'tim', css: 'linear-gradient(135deg, #5C3E7A 0%, #3E5C7A 100%)', fg: '#FFFDF9' },
  { key: 'la', css: 'linear-gradient(135deg, #5C7A3E 0%, #0E8E96 100%)', fg: '#FFFDF9' },
  { key: 'giay', css: 'radial-gradient(#DDD4C4 1.2px, transparent 1.2px) 0 0 / 18px 18px, #F7F3EC', fg: '#1F1B17' },
  { key: 'hoang', css: 'linear-gradient(160deg, #F2C46B 0%, #D4593A 55%, #6B2D3A 100%)', fg: '#FFFDF9' },
];
const statusBg = (text, bg, h = '240px', size = '28px') => `<div style="min-height: ${h}; border-radius: 14px; background: ${bg.css}; color: ${bg.fg}; display: flex; align-items: center; justify-content: center; text-align: center; padding: 32px 40px; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: ${size}; line-height: 1.3; letter-spacing: -0.01em; text-wrap: balance;">${text}</div>`;
const swatch = (bg, on = false) => `<span style="width: 40px; height: 40px; border-radius: 10px; background: ${bg.css}; display: inline-block; flex-shrink: 0; ${on ? `outline: 2.5px solid ${T.ink}; outline-offset: 2px;` : `border: 1px solid rgba(31,27,23,0.08);`}"></span>`;

// ---------- Main.dc.html : Bảng tin ----------
const postCard = ({ pinned, cat, catBg, catFg, name, initials, avBg, level, time, title, excerpt, likes, comments, extra = '' }) => `
<article class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 12px;${pinned ? ` border-color: ${T.gold};` : ''}">
  <div style="display: flex; align-items: center; gap: 12px;">
    <span data-go="profile" style="display: inline-flex;">${avatar(initials, avBg, 40, 14)}</span>
    <div style="flex-grow: 1;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 600;" data-go="profile">${name}</span>
        <span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E; height: 20px; padding: 0 6px;">Cấp ${level}</span>
        <span class="muted" style="font-size: 13px;">· ${time}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${T.ink3};">
        <span class="tag" style="background: ${catBg}; color: ${catFg};">${cat}</span>
        ${pinned ? `<span style="display: inline-flex; align-items: center; gap: 4px; color: #8A6A1E; font-weight: 600; font-size: 12px;">${I.pin(14)}Đã ghim</span>` : ''}
      </div>
    </div>
    <span style="color: ${T.ink3};">${I.more(20)}</span>
  </div>
  <h2 class="serif" style="margin: 0; font-size: 20px; line-height: 1.3; font-weight: 700; color: ${T.ink};" data-go="post">${title}</h2>
  <p style="margin: 0; color: ${T.ink2}; font-size: 14px; line-height: 1.6;">${excerpt}</p>
  ${extra}
  <div style="display: flex; align-items: center; gap: 20px; padding-top: 6px; border-top: 1px solid ${T.line}; color: ${T.ink2}; font-size: 13px; font-weight: 500;">
    <span style="display: inline-flex; align-items: center; gap: 6px;">${I.heart(18)}${likes}</span>
    <span style="display: inline-flex; align-items: center; gap: 6px;">${I.chat(18)}${comments} bình luận</span>
    <span style="flex-grow: 1;"></span>
    <span class="muted">Bình luận mới nhất 2 giờ trước</span>
  </div>
</article>`;

const statusCard = ({ name, initials, avBg, level, time, cat, catBg, catFg, text, bg, likes, comments }) => `
<article class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 12px;">
  <div style="display: flex; align-items: center; gap: 12px;">
    <span data-go="profile" style="display: inline-flex;">${avatar(initials, avBg, 40, 14)}</span>
    <div style="flex-grow: 1;">
      <div style="display: flex; align-items: center; gap: 8px;"><span style="font-weight: 600;" data-go="profile">${name}</span><span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E; height: 20px; padding: 0 6px;">Cấp ${level}</span><span class="muted" style="font-size: 13px;">· ${time}</span></div>
      <div style="font-size: 13px;"><span class="tag" style="background: ${catBg}; color: ${catFg};">${cat}</span></div>
    </div>
    <span style="color: ${T.ink3};">${I.more(20)}</span>
  </div>
  <div data-go="post">${statusBg(text, bg)}</div>
  <div style="display: flex; align-items: center; gap: 20px; padding-top: 6px; border-top: 1px solid ${T.line}; color: ${T.ink2}; font-size: 13px; font-weight: 500;">
    <span style="display: inline-flex; align-items: center; gap: 6px;">${I.heart(18)}${likes}</span>
    <span style="display: inline-flex; align-items: center; gap: 6px;">${I.chat(18)}${comments} bình luận</span>
  </div>
</article>`;

const feedMain = `
<div style="display: flex; gap: 32px; height: 100%;">
  <div style="width: 740px; display: flex; flex-direction: column; gap: 16px;">
    <div style="display: flex; align-items: flex-end; justify-content: space-between;">
      <h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 700;">Bảng tin</h1>
      <div style="display: flex; gap: 8px;">
        <span class="chip on">Tất cả</span>
        <span class="chip">Thông báo</span>
        <span class="chip">Hỏi đáp</span>
        <span class="chip">Chia sẻ</span>
        <span class="chip">Nhật ký</span>
        <span class="chip">Câu chuyện</span>
      </div>
    </div>

    <!-- Composer -->
    <div class="card" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; align-items: center; gap: 12px;" data-go="compose">
        ${avatar('MQ', T.ink, 40, 14)}
        <div style="flex-grow: 1; font-size: 15px; color: ${T.ink3};">Chia sẻ điều gì đó với cộng đồng…</div>
        <span style="width: 32px; height: 32px; border-radius: 9px; background: ${STATUS_BGS[0].css}; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 13px;">Aa</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px; color: ${T.ink2};">
        <span style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">${I.image(20)}</span>
        <span style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">${I.link(20)}</span>
        <span style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">${I.video(20)}</span>
        <span style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">${I.poll(20)}</span>
        <span style="flex-grow: 1;"></span>
        <span class="chip">Chọn chuyên mục ${I.down(14)}</span>
        <span class="btn btn-dark btn-sm" style="height: 36px; margin-left: 8px;">Đăng bài</span>
      </div>
    </div>

    ${postCard({
      pinned: true, cat: 'Thông báo', catBg: T.accentSoft, catFg: '#9C3A21',
      name: 'Minh Quý', initials: 'MQ', avBg: T.ink, level: 7, time: '2 ngày trước',
      title: 'Lộ trình Funnel Money Model 2026: bắt đầu từ đâu?',
      excerpt: 'Chào cả nhà. Tuần này mình mở lại toàn bộ module 1 cho thành viên miễn phí. Ai mới vào hãy học 5 bài đầu trước rồi đặt câu hỏi ở mục Hỏi đáp, mình và các cộng sự trả lời trong 24 giờ.',
      likes: 24, comments: 8,
    })}

    ${statusCard({ name: 'Kiên Bùi', initials: 'KB', avBg: '#5C7A3E', level: 1, time: '40 phút trước', cat: 'Chia sẻ', catBg: T.accentSoft, catFg: '#9C3A21', text: 'Vừa học xong module 1. Tối nay ai cùng làm bài tập Offer Canvas không?', bg: STATUS_BGS[1], likes: 6, comments: 3 })}

    ${postCard({
      pinned: false, cat: 'Hỏi đáp', catBg: T.tealSoft, catFg: '#0B6F75',
      name: 'Công Trần', initials: 'CT', avBg: '#7A5C3E', level: 1, time: '3 giờ trước',
      title: 'Mới thanh toán Premium nhưng chưa thấy khóa học mở?',
      excerpt: 'Mình vừa chuyển khoản gói tháng lúc 9 giờ sáng, đã nhận email xác nhận nhưng vào mục Khóa học vẫn thấy khóa. Cần chờ bao lâu ạ?',
      likes: 3, comments: 2,
      extra: `<div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; background: ${T.tealSoft}; color: #0B6F75; font-size: 13px; font-weight: 500;">${I.check(16)}Quản trị viên đã trả lời · Quyền truy cập được mở tự động sau khi ngân hàng báo có</div>`,
    })}

    ${postCard({
      pinned: false, cat: 'Nhật ký', catBg: T.goldSoft, catFg: '#8A6A1E',
      name: 'Điền Phạm Ngọc', initials: 'ĐN', avBg: T.teal, level: 2, time: 'Hôm qua',
      title: 'Ngày 3: đơn đầu tiên từ funnel affiliate',
      excerpt: 'Sau khi làm lại lead magnet theo bài 2.3, mình chạy 200k tiền ads và có 41 email, 1 đơn 490k. Chưa lãi nhưng tự tin hơn nhiều. Dưới đây là toàn bộ số liệu, ảnh chụp dashboard và 3 điều mình rút ra… <a href="#" data-go="post" style="font-weight: 600;">Xem thêm</a>',
      likes: 17, comments: 6,
      extra: `<div data-go="post">${fbGrid(['#7A5C3E', '#0E8E96', '#D4593A', '#3E5C7A', '#5C3E7A', '#C89B3C'])}</div>`,
    })}
  </div>

  <!-- Right rail -->
  <aside style="width: 312px; display: flex; flex-direction: column; gap: 16px;">
    <div class="card" style="overflow: hidden;">
      <div style="height: 120px; background: ${T.teal}; display: flex; align-items: flex-end; padding: 16px;"><span class="serif" style="color: #FFFDF9; font-size: 22px; font-weight: 700; line-height: 1.1;">Doanh nghiệp<br>một người</span></div>
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
        <div style="font-weight: 600; font-size: 16px;">Kinh Doanh Online Cùng AI</div>
        <div class="muted" style="font-size: 13px;">hoiminh.vn/minhquy</div>
        <p style="margin: 0; color: ${T.ink2}; font-size: 13px;">Ứng dụng AI xây dựng doanh nghiệp một người. Học theo lộ trình, hỏi là có người trả lời.</p>
        <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding-top: 6px; border-top: 1px solid ${T.line};">
          <div style="text-align: center;"><div style="font-weight: 700; font-size: 18px;">234</div><div class="muted" style="font-size: 12px;">Thành viên</div></div>
          <div style="text-align: center;"><div style="font-weight: 700; font-size: 18px;">12</div><div class="muted" style="font-size: 12px;">Online</div></div>
          <div style="text-align: center;"><div style="font-weight: 700; font-size: 18px;">2</div><div class="muted" style="font-size: 12px;">Quản trị</div></div>
        </div>
      </div>
    </div>

    <div class="card" style="padding: 18px; background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink}; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 8px; color: ${T.gold}; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;">${I.spark(16)}Gói Premium</div>
      <div class="serif" style="font-size: 19px; font-weight: 700; line-height: 1.3;">Mở khóa toàn bộ khóa học và trở thành cộng sự</div>
      <div style="font-size: 13px; color: ${T.sideText};">249.000đ/tháng · hủy bất cứ lúc nào</div>
      <div class="btn btn-primary" style="width: 100%; margin-top: 4px;" data-go="checkout">Nâng cấp ngay</div>
    </div>

    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
      <div style="font-weight: 600;" data-go="event">Sự kiện sắp tới</div>
      <div style="display: flex; gap: 12px; align-items: center;">
        <div style="width: 44px; text-align: center; border-radius: 8px; background: ${T.accentSoft}; padding: 4px 0;"><div style="font-size: 11px; font-weight: 600; color: #9C3A21;">T4</div><div style="font-size: 18px; font-weight: 700; color: #9C3A21; line-height: 1;">17</div></div>
        <div><div style="font-weight: 500; font-size: 13px;">Q&amp;A tuần: Funnel Money Model</div><div class="muted" style="font-size: 12px;">20:00 · Zoom</div></div>
      </div>
      <div style="display: flex; gap: 12px; align-items: center;">
        <div style="width: 44px; text-align: center; border-radius: 8px; background: ${T.tealSoft}; padding: 4px 0;"><div style="font-size: 11px; font-weight: 600; color: #0B6F75;">T7</div><div style="font-size: 18px; font-weight: 700; color: #0B6F75; line-height: 1;">20</div></div>
        <div><div style="font-weight: 500; font-size: 13px;">Workshop: AI Agent cho người bán hàng</div><div class="muted" style="font-size: 12px;">09:00 · Trực tiếp</div></div>
      </div>
    </div>
  </aside>
</div>`;

// ---------- Classroom.dc.html : Bài học ----------
const lessonRow = (label, state, dur) => {
  const marks = {
    done: `<span style="width: 22px; height: 22px; border-radius: 999px; background: ${T.teal}; color: #fff; display: inline-flex; align-items: center; justify-content: center;">${I.check(14)}</span>`,
    now: `<span style="width: 22px; height: 22px; border-radius: 999px; border: 2px solid ${T.accent}; display: inline-flex; align-items: center; justify-content: center;"><span style="width: 8px; height: 8px; border-radius: 999px; background: ${T.accent};"></span></span>`,
    todo: `<span style="width: 22px; height: 22px; border-radius: 999px; border: 1.5px solid ${T.line2}; display: inline-block;"></span>`,
    lock: `<span style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; color: ${T.ink3};">${I.lock(16)}</span>`,
  };
  const on = state === 'now';
  return `<div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px;${on ? ` background: ${T.accentSoft};` : ''}">${marks[state]}<span style="flex-grow: 1; font-size: 14px;${on ? ' font-weight: 600;' : ''}${state === 'lock' ? ` color: ${T.ink3};` : ''}">${label}</span><span class="muted" style="font-size: 12px;">${dur}</span></div>`;
};
const moduleHead = (title, meta, open) => `<div style="display: flex; align-items: center; gap: 10px; padding: 14px 12px 8px;"><span style="color: ${T.ink3};">${open ? I.down(16) : I.right(16)}</span><span style="flex-grow: 1; font-weight: 600;">${title}</span><span class="muted" style="font-size: 12px;">${meta}</span></div>`;

const classroomMain = `
<div style="display: flex; flex-direction: column; gap: 20px; height: 100%;">
  <div style="display: flex; align-items: center; gap: 16px;">
    <span data-go="courses" style="display: inline-flex; align-items: center; gap: 6px; color: ${T.ink3}; font-size: 13px;">${I.back(16)}Khóa học</span>
    <span style="color: ${T.line2};">/</span>
    <span class="serif" style="font-size: 22px; font-weight: 700;" data-go="course">Funnel Money Model 2026</span>
    <span style="flex-grow: 1;"></span>
    <div style="display: flex; align-items: center; gap: 12px; width: 300px;"><span class="muted" style="font-size: 13px; white-space: nowrap;">7/26 bài · 27%</span><div class="prog" style="flex-grow: 1;"><div style="width: 27%;"></div></div></div>
  </div>

  <div style="display: flex; gap: 24px; flex-grow: 1; min-height: 0;">
    <!-- Curriculum -->
    <div class="card" style="width: 360px; padding: 8px; overflow: hidden; display: flex; flex-direction: column;">
      ${moduleHead('1. Tư duy mô hình tiền', '5 bài · hoàn thành', false)}
      ${moduleHead('2. Thiết kế Offer', '6 bài · 2/6', true)}
      <div style="display: flex; flex-direction: column; gap: 2px; padding: 0 4px;">
        ${lessonRow('2.1 Khách hàng thực sự mua gì', 'done', '09:12')}
        ${lessonRow('2.2 Ba lớp giá trị của một offer', 'done', '11:04')}
        ${lessonRow('2.3 Viết offer bằng công thức giá trị', 'now', '12:41')}
        ${lessonRow('2.4 Định giá theo kết quả', 'todo', '08:55')}
        ${lessonRow('2.5 Bảo hành và đảo ngược rủi ro', 'todo', '07:30')}
        ${lessonRow('2.6 Bài tập: Offer Canvas của bạn', 'todo', 'Bài tập')}
      </div>
      ${moduleHead('3. Lead magnet và Tripwire', '7 bài', false)}
      ${moduleHead('4. Scale bằng cộng sự affiliate', '8 bài', false)}
      <div style="display: flex; flex-direction: column; gap: 2px; padding: 0 4px;">
        ${lessonRow('4.1 Thiết kế hoa hồng 50%', 'lock', 'Premium')}
      </div>
    </div>

    <!-- Player -->
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 16px; min-width: 0;">
      <div style="position: relative; aspect-ratio: 16 / 9; border-radius: 16px; background: #171310; overflow: hidden; display: flex; align-items: center; justify-content: center;">
        <div style="width: 72px; height: 72px; border-radius: 999px; background: ${T.accent}; color: #FFFDF9; display: flex; align-items: center; justify-content: center;">${I.play(30)}</div>
        <span style="position: absolute; left: 16px; bottom: 14px; font-size: 12px; color: rgba(255,253,249,0.7);">Nhúng từ YouTube · 12:41</span>
      </div>
      <div style="display: flex; align-items: flex-start; gap: 16px;">
        <div style="flex-grow: 1;">
          <h1 class="serif" style="margin: 0 0 6px; font-size: 24px; font-weight: 700;">2.3 Viết offer bằng công thức giá trị</h1>
          <p style="margin: 0; color: ${T.ink2}; font-size: 14px; max-width: 620px;">Kết quả mơ ước × xác suất đạt được, chia cho thời gian và công sức. Bài này đi qua từng vế với ví dụ của một người bán khóa học AI cho chủ shop nhỏ.</p>
        </div>
        <div style="display: flex; gap: 8px; flex-shrink: 0;">
          <span class="btn btn-ghost">Bài tiếp theo ${I.right(16)}</span>
          <span class="btn btn-primary">${I.check(18)}Đánh dấu hoàn thành</span>
        </div>
      </div>
      <div style="display: flex; gap: 10px;">
        <span class="chip">${I.file(16)}Offer Canvas.pdf</span>
        <span class="chip">${I.file(16)}Prompt AI viết offer.txt</span>
      </div>
      <div class="card" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 12px;">
        <div style="font-weight: 600;">Thảo luận bài học <span class="muted" style="font-weight: 500;">· 6</span></div>
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          ${avatar('HK', '#7A5C3E', 32, 12)}
          <div><div style="font-size: 13px;"><span style="font-weight: 600;">Hồng Kim</span> <span class="muted">· 5 giờ trước</span></div><div style="font-size: 14px; color: ${T.ink2};">Vế “thời gian” nên tính theo ngày hay theo số buổi học ạ?</div></div>
        </div>
        <div class="input" style="height: 44px;">${I.chat(18)}<span>Đặt câu hỏi về bài này…</span></div>
      </div>
    </div>
  </div>
</div>`;

// ---------- Members.dc.html : Quản trị thành viên + modal ----------
const memberRow = (initials, bg, name, handle, plan, planBg, planFg, joined, active) => `
<div style="display: grid; grid-template-columns: 1.9fr 1fr 1fr 1fr 1.5fr; align-items: center; gap: 16px; padding: 12px 20px; border-top: 1px solid ${T.line};">
  <div style="display: flex; align-items: center; gap: 12px;" data-go="profile">${avatar(initials, bg, 36, 13)}<div><div style="font-weight: 600;">${name}</div><div class="muted" style="font-size: 12px;">@${handle}</div></div></div>
  <span class="tag" style="background: ${planBg}; color: ${planFg}; width: fit-content;">${plan}</span>
  <span style="font-size: 13px; color: ${T.ink2};">${joined}</span>
  <span style="font-size: 13px; color: ${T.ink2};">${active}</span>
  <div style="display: flex; gap: 6px; justify-content: flex-end;"><span class="btn btn-ghost btn-sm">${I.chat(14)}Nhắn tin</span><span class="btn btn-ghost btn-sm">${I.settings(14)}Quản lý</span></div>
</div>`;

const membersMain = `
<div style="display: flex; flex-direction: column; gap: 16px; height: 100%; position: relative;">
  <div style="display: flex; align-items: center; gap: 16px;">
    <h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 700;">Thành viên</h1>
    <div style="display: flex; gap: 8px; margin-left: 12px;">
      <span class="chip on">Đang hoạt động · 231</span>
      <span class="chip">Đang hủy · 3</span>
      <span class="chip">Đã rời · 12</span>
      <span class="chip">Bị chặn · 1</span>
    </div>
    <span style="flex-grow: 1;"></span>
    <span class="btn btn-ghost">${I.filter(18)}Lọc</span>
    <span class="btn btn-ghost">${I.download(18)}Xuất CSV</span>
    <span class="btn btn-primary">${I.plus(18)}Mời</span>
  </div>
  <div class="input" style="width: 380px;">${I.search(18)}<span>Tìm theo tên, email, @tên…</span></div>

  <div class="card" style="overflow: hidden;">
    <div style="display: grid; grid-template-columns: 1.9fr 1fr 1fr 1fr 1.5fr; gap: 16px; padding: 12px 20px;">
      <span class="th">Thành viên</span><span class="th">Gói</span><span class="th">Tham gia</span><span class="th">Hoạt động</span><span></span>
    </div>
    ${memberRow('CT', '#7A5C3E', 'Công Trần', 'cong-tran', 'Miễn phí', T.bg, T.ink2, '13/09/2026', '14 giờ trước')}
    ${memberRow('DN', '#3E5C7A', 'Duy Nguyễn', 'duy-nguyen', 'Miễn phí', T.bg, T.ink2, '13/09/2026', '15 giờ trước')}
    ${memberRow('ĐN', T.teal, 'Điền Phạm Ngọc', 'dien-pham-ngoc', 'Premium', T.goldSoft, '#8A6A1E', '13/09/2026', '3 giờ trước')}
    ${memberRow('HK', '#7A5C3E', 'Hồng Kim', 'hong-kim', 'Premium', T.goldSoft, '#8A6A1E', '11/09/2026', 'Hôm qua')}
    ${memberRow('KB', '#5C7A3E', 'Kiên Bùi', 'kien-bui', 'Miễn phí', T.bg, T.ink2, '10/09/2026', '4 ngày trước')}
    ${memberRow('HV', T.accent, 'Hoàng Vũ', 'hoang-vu', 'Cộng sự', T.tealSoft, '#0B6F75', '02/08/2026', '1 giờ trước')}
  </div>

  <!-- Modal overlay -->
  <div style="position: absolute; inset: -28px -32px; background: rgba(31,27,23,0.45); display: flex; align-items: center; justify-content: center;">
    <div class="card" style="width: 760px; overflow: hidden; box-shadow: 0 24px 60px rgba(31,27,23,0.25);">
      <div style="display: flex; align-items: center; gap: 14px; padding: 18px 24px; border-bottom: 1px solid ${T.line};">
        ${avatar('ĐN', T.teal, 44, 15)}
        <div style="flex-grow: 1;"><div style="font-weight: 600; font-size: 16px;">Điền Phạm Ngọc</div><div class="muted" style="font-size: 13px;">Quản lý thành viên</div></div>
        <span style="color: ${T.ink3};">${I.x(20)}</span>
      </div>
      <div style="display: flex; min-height: 420px;">
        <div style="width: 200px; padding: 16px 12px; border-right: 1px solid ${T.line}; display: flex; flex-direction: column; gap: 2px;">
          <div style="padding: 10px 12px; border-radius: 10px; background: ${T.goldSoft}; font-weight: 600;">Thành viên</div>
          <div style="padding: 10px 12px; border-radius: 10px; color: ${T.ink2};">Khóa học</div>
          <div style="padding: 10px 12px; border-radius: 10px; color: ${T.ink2};">Thanh toán</div>
          <div style="padding: 10px 12px; border-radius: 10px; color: ${T.ink2};">Câu hỏi khi tham gia</div>
        </div>
        <div style="flex-grow: 1; padding: 24px 28px; display: flex; flex-direction: column; gap: 14px;">
          <div style="display: grid; grid-template-columns: 120px 1fr; row-gap: 12px; column-gap: 12px; font-size: 14px;">
            <span class="muted">Email</span><span>ngocdien1221@gmail.com</span>
            <span class="muted">Vai trò</span><span>Thành viên <a href="#">(đổi)</a></span>
            <span class="muted">Gói</span><span style="display: inline-flex; align-items: center; gap: 8px;"><span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E;">Premium</span><a href="#">(đổi)</a></span>
          </div>
          <div style="border-top: 1px solid ${T.line}; padding-top: 14px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; font-size: 14px;">
            <div style="display: flex; align-items: center; gap: 10px; color: ${T.ink2};">${I.calendar(18)}Tham gia 13/09/2026</div>
            <div style="display: flex; align-items: center; gap: 10px; color: ${T.ink2};">${I.wallet(18)}249.000đ/tháng · qua chuyển khoản</div>
            <div style="display: flex; align-items: center; gap: 10px; color: ${T.ink2};">${I.clock(18)}Gia hạn sau 29 ngày</div>
            <div style="display: flex; align-items: center; gap: 10px; color: ${T.ink2};">${I.trophy(18)}Giá trị trọn đời 249.000đ</div>
            <div style="display: flex; align-items: center; gap: 10px; color: ${T.ink2};">${I.users(18)}Giới thiệu bởi Hoàng Vũ</div>
            <div style="display: flex; align-items: center; gap: 10px; color: ${T.ink2};">${I.qr(18)}Lần cuối: 13/09 · 249.000đ · thành công</div>
          </div>
          <div style="flex-grow: 1;"></div>
          <div style="display: flex; gap: 8px; border-top: 1px solid ${T.line}; padding-top: 14px;">
            <span class="btn btn-ghost btn-sm">Xóa khỏi nhóm</span>
            <span class="btn btn-ghost btn-sm">Chặn</span>
            <span class="btn btn-ghost btn-sm" style="color: #9C3A21;">Hủy đăng ký</span>
            <span style="flex-grow: 1;"></span>
            <span class="btn btn-dark btn-sm">${I.chat(14)}Nhắn tin</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

// ---------- Pricing.dc.html : Cài đặt · Giá và gói ----------
const settingsNav = (active) => {
  const items = [['Tổng quan', 's-overview'], ['Khám phá', ''], ['Mời thành viên', ''], ['Chung', 's-general'], ['Giá và gói', 'settings'], ['Cộng sự (Affiliate)', 's-affiliate'], ['Tiện ích', 's-plugins'], ['Bảng tin', 's-feed'], ['Thông báo', ''], ['Thanh toán', 's-payout']];
  return `<div style="width: 220px; display: flex; flex-direction: column; gap: 2px; flex-shrink: 0;">${items.map(([t, go]) => `<div data-go="${go}" style="padding: 10px 14px; border-radius: 10px;${t === active ? ` background: ${T.goldSoft}; font-weight: 600;` : ` color: ${T.ink2};`}">${t}</div>`).join('')}</div>`;
};
const modeCard = (title, sub, on) => `<div style="flex: 1 1 0; min-height: 80px; padding: 16px; border-radius: 12px; border: 1.5px solid ${on ? T.accent : T.line2}; background: ${on ? T.accentSoft : T.surface}; display: flex; flex-direction: column; gap: 4px;"><div style="display: flex; align-items: center; gap: 8px;"><span style="width: 18px; height: 18px; border-radius: 999px; border: 2px solid ${on ? T.accent : T.line2}; display: inline-flex; align-items: center; justify-content: center;">${on ? `<span style="width: 8px; height: 8px; border-radius: 999px; background: ${T.accent};"></span>` : ''}</span><span style="font-weight: 600;">${title}</span></div><span class="muted" style="font-size: 12px; padding-left: 26px;">${sub}</span></div>`;
const tierCard = (name, price, sub, benefits, dark = false, toggle = '') => `<div class="card" style="flex: 1 1 0; padding: 20px; display: flex; flex-direction: column; gap: 12px;${dark ? ` background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink};` : ''}">
  <div style="display: flex; align-items: center; justify-content: space-between;"><span style="font-weight: 600; font-size: 15px;">${name}</span>${toggle}</div>
  <div><div class="serif" style="font-size: 24px; font-weight: 700;">${price}</div><div style="font-size: 12px; color: ${dark ? T.sideText : T.ink3};">${sub}</div></div>
  <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: ${dark ? T.sideText : T.ink2};">${benefits.map((b) => `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: ${T.teal};">${I.check(14)}</span>${b}</div>`).join('')}<div style="display: flex; align-items: center; gap: 8px; color: ${T.teal};">${I.plus(14)}Thêm quyền lợi</div></div>
</div>`;

const pricingMain = `
<div style="display: flex; gap: 32px; height: 100%;">
  ${settingsNav('Giá và gói')}
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 20px; max-width: 880px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 700;">Giá và gói</h1>
      <span style="flex-grow: 1;"></span>
      <span class="btn btn-ghost btn-sm">${I.lock(14)}Đóng cổng</span>
      <span class="btn btn-ghost btn-sm">${I.globe(14)}Xem trước</span>
      <span class="btn btn-dark btn-sm">Lưu thay đổi</span>
    </div>

    <div style="display: flex; gap: 10px;">
      ${modeCard('Miễn phí', 'Ai cũng vào được', false)}
      ${modeCard('Thu phí', 'Theo tháng hoặc năm', false)}
      ${modeCard('Freemium', 'Vào miễn phí, nâng cấp gói', true)}
      ${modeCard('Trả một lần', 'Truy cập trọn đời', false)}
    </div>

    <div style="display: flex; gap: 16px;">
      ${tierCard('Tiêu chuẩn', 'Miễn phí', 'Mặc định khi tham gia', ['Đọc và đăng bài trên Bảng tin', 'Module 1 của mọi khóa học'])}
      ${tierCard('Premium', '249.000đ', 'mỗi tháng · hoặc 2.490.000đ/năm', ['Mở khóa toàn bộ khóa học', 'Trở thành cộng sự, hoa hồng 50%', 'Q&amp;A hàng tuần'])}
      ${tierCard('VIP', '2.500.000đ', 'mỗi tháng', ['Coaching 1-1 hàng tuần', 'Coaching nhóm hàng tuần'], true, `<span style="width: 40px; height: 22px; border-radius: 999px; background: ${T.teal}; position: relative; display: inline-block;"><span style="position: absolute; top: 3px; right: 3px; width: 16px; height: 16px; border-radius: 999px; background: #fff;"></span></span>`)}
    </div>

    <div class="card" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; align-items: center; gap: 10px;"><span style="font-weight: 600;">Cách thanh toán</span><span class="muted" style="font-size: 13px;">Người mua tự chọn ở bước thanh toán</span></div>
      <div style="display: flex; gap: 8px;">
        <span class="chip on">${I.qr(14)}Chuyển khoản QR</span>
        <span class="chip on">MoMo</span>
        <span class="chip on">VNPAY</span>
        <span class="chip">PayPal (quốc tế)</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: ${T.ink2}; padding-top: 12px; border-top: 1px solid ${T.line};">${I.users(16)}14 thành viên trả phí từ trước sẽ được xếp vào gói <strong style="color: ${T.ink};">Premium</strong> <a href="#">(đổi)</a></div>
    </div>
  </div>
</div>`;

// ---------- Store.dc.html : Cửa hàng ----------
const product = ({ coverBg, coverText, type, name, desc, price, old, off, owned = false, combo = false }) => `
<div class="card" style="overflow: hidden; display: flex; flex-direction: column;">
  <div data-go="product" style="position: relative; height: 170px; background: ${coverBg}; display: flex; align-items: flex-end; padding: 16px;">
    <span class="serif" style="color: #FFFDF9; font-size: 22px; font-weight: 700; line-height: 1.15; max-width: 240px;">${coverText}</span>
    ${off ? `<span class="tag" style="position: absolute; top: 12px; right: 12px; background: ${T.ink}; color: #FFFDF9;">-${off}%</span>` : ''}
    ${combo ? `<span class="tag" style="position: absolute; top: 12px; left: 12px; background: ${T.gold}; color: #1F1B17;">Combo</span>` : ''}
  </div>
  <div style="padding: 16px; display: flex; flex-direction: column; gap: 8px; flex-grow: 1;">
    <div class="muted" style="font-size: 12px;">${type}</div>
    <div style="font-weight: 600; font-size: 16px;" data-go="product">${name}</div>
    <div style="font-size: 13px; color: ${T.ink2};">${desc}</div>
    <div style="flex-grow: 1;"></div>
    <div style="display: flex; align-items: center; gap: 10px; padding-top: 8px;">
      ${owned
        ? `<span style="display: inline-flex; align-items: center; gap: 6px; color: ${T.teal}; font-weight: 600;">${I.check(16)}Đã sở hữu</span><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">Vào học</span>`
        : `<span style="font-weight: 700; font-size: 18px;">${price}</span>${old ? `<span class="muted" style="text-decoration: line-through; font-size: 13px;">${old}</span>` : ''}<span style="flex-grow: 1;"></span><span class="btn btn-primary btn-sm" data-go="checkout">Mua</span>`}
    </div>
  </div>
</div>`;

const storeMain = `
<div style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
  <div style="display: flex; align-items: flex-end; gap: 16px;">
    <div><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 700;">Cửa hàng</h1><div class="muted" style="font-size: 13px;">Sản phẩm số · truy cập trọn đời</div></div>
    <span style="flex-grow: 1;"></span>
    <div style="display: flex; gap: 8px;"><span class="chip on">Tất cả · 14</span><span class="chip">Khóa học · 11</span><span class="chip">Combo · 2</span><span class="chip">Tài liệu · 1</span></div>
    <div class="input" style="width: 200px;">${I.search(18)}<span>Tìm sản phẩm…</span></div>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px;">
    ${product({ coverBg: T.ink, coverText: 'Combo 9 khóa học', type: 'Combo · 9 khóa học · 41 giờ', name: 'Combo Kinh doanh AI trọn bộ', desc: 'Sở hữu toàn bộ khóa học hiện có và các khóa ra mắt trong 12 tháng tới.', price: '5.000.000đ', old: '9.000.000đ', off: 44, combo: true })}
    ${product({ coverBg: T.accent, coverText: 'Funnel Money Model 2026', type: 'Khóa học video · 31 bài · 6,6 giờ', name: 'Funnel Money Model 2026', desc: 'Thiết kế offer, lead magnet và tripwire để hoàn vốn quảng cáo sớm.', price: '1.000.000đ', old: '1.686.000đ', off: 41 })}
    ${product({ coverBg: T.teal, coverText: 'Facebook Ads 2026', type: 'Khóa học video · 55 bài · 9,5 giờ', name: 'Facebook Ads chuyển đổi 2026', desc: 'Chạy quảng cáo về trang giới thiệu, retarget và đo lường đăng ký.', price: '', owned: true })}
    ${product({ coverBg: '#7A5C3E', coverText: 'Funnel Affiliate', type: 'Khóa học video · 18 bài · 3,2 giờ', name: 'Kiếm tiền với Funnel Affiliate', desc: 'Chương trình cộng sự: nhận link, chia sẻ, nhận hoa hồng định kỳ.', price: '490.000đ' })}
    ${product({ coverBg: '#3E5C7A', coverText: 'AI Agent cho người bán hàng', type: 'Khóa học video · 22 bài · 4,1 giờ', name: 'AI Agent cho người bán hàng', desc: 'Dựng trợ lý trả lời khách, chốt đơn và chăm sóc sau bán.', price: '1.200.000đ', old: '1.900.000đ', off: 37 })}
    ${product({ coverBg: T.gold, coverText: '120 prompt bán hàng', type: 'Tài liệu · PDF + TXT', name: '120 prompt viết bài bán hàng', desc: 'Dùng ngay với ChatGPT, Claude hoặc Gemini. Cập nhật miễn phí.', price: '199.000đ' })}
  </div>
</div>`;

// ---------- Discovery.dc.html : Khám phá (public) ----------
const commCard = (bg, mark, name, desc, members, price) => `
<div class="card" style="overflow: hidden; display: flex; flex-direction: column;" data-go="about">
  <div style="height: 150px; background: ${bg};"></div>
  <div style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
    <div style="display: flex; align-items: center; gap: 10px;"><div style="width: 36px; height: 36px; border-radius: 10px; background: ${T.ink}; color: #FFFDF9; display: flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800;">${mark}</div><span style="font-weight: 600; font-size: 16px;">${name}</span></div>
    <div style="font-size: 13px; color: ${T.ink2};">${desc}</div>
    <div class="muted" style="font-size: 13px; padding-top: 4px;">${members} thành viên · ${price}</div>
  </div>
</div>`;

const discoveryBody = `
<div style="width: 1440px; height: 960px; overflow: hidden; background: ${T.bg}; display: flex; flex-direction: column;">
  <header style="height: 72px; display: flex; align-items: center; gap: 28px; padding: 0 64px; border-bottom: 1px solid ${T.line}; background: ${T.surface};">
    <div style="display: flex; align-items: center; gap: 8px; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 22px;">
      <svg width="28" height="28" viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="9" cy="13" r="7" fill="${T.accent}"></circle><circle cx="17" cy="13" r="7" fill="${T.teal}" fill-opacity="0.85"></circle></svg>
      Hội Mình
    </div>
    <nav style="display: flex; gap: 24px; font-weight: 500; color: ${T.ink2};"><span style="color: ${T.ink};">Khám phá</span><span data-go="signup-plan">Bảng giá</span><span data-go="signup">Dành cho chủ hội</span><span data-go="login">Đăng nhập</span></nav>
    <span style="flex-grow: 1;"></span>
    <span class="btn btn-primary" data-go="signup">Tạo hội của bạn</span>
    ${avatar('MQ', T.ink, 40, 14)}
  </header>

  <section style="padding: 72px 64px 40px; display: flex; flex-direction: column; align-items: center; gap: 20px; text-align: center;">
    <h1 class="serif" style="margin: 0; font-size: 52px; line-height: 1.1; font-weight: 700; max-width: 760px; text-wrap: pretty;">Học cùng những người đi trước, trong hội của mình.</h1>
    <p style="margin: 0; font-size: 17px; color: ${T.ink2}; max-width: 560px;">Cộng đồng có người dẫn dắt rõ mặt, khóa học theo lộ trình, thanh toán bằng chuyển khoản hay ví Việt Nam.</p>
    <div class="input" style="width: 640px; height: 56px; border-radius: 14px; margin-top: 8px; padding: 0 8px 0 18px; font-size: 16px;">${I.search(20)}<span style="flex-grow: 1;">Tìm cộng đồng, chuyên gia, chủ đề…</span><span class="btn btn-dark">Tìm kiếm</span></div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 8px;">
      <span class="chip on">Nổi bật</span><span class="chip">Kinh doanh</span><span class="chip">Công nghệ và AI</span><span class="chip">Sáng tạo nội dung</span><span class="chip">Sức khỏe</span><span class="chip">Phát triển bản thân</span><span class="chip">Học tập</span><span class="chip">Ngoại ngữ</span>
    </div>
  </section>

  <section style="padding: 0 64px 64px; display: flex; flex-direction: column; gap: 20px;">
    <div style="display: flex; align-items: flex-end; justify-content: space-between;"><div><div class="serif" style="font-size: 26px; font-weight: 700;">Cộng đồng nổi bật</div><div class="muted">Được chọn vì hoạt động thật và người dẫn dắt rõ ràng.</div></div><a href="#">Xem tất cả</a></div>
    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px;">
      ${commCard(T.teal, 'KD', 'Kinh Doanh Online Cùng AI', 'Ứng dụng AI xây dựng doanh nghiệp một người.', '234', 'Miễn phí')}
      ${commCard(T.accent, 'YT', 'Faceless YouTube Foundation', 'Xây kênh không lộ mặt từ ý tưởng đến kiếm tiền.', '1,2k', '199.000đ/tháng')}
      ${commCard('#7A5C3E', 'QT', 'Quản trị cảm xúc', 'Làm chủ cảm xúc để làm chủ cuộc đời, 23 bài theo lộ trình.', '176', '990.000đ/năm')}
    </div>
  </section>
</div>`;

// ---------- Mobile.dc.html : Bảng tin trên điện thoại (390x844) ----------
const mPost = (initials, bg, name, time, cat, catBg, catFg, title, excerpt, likes, comments) => `
<article class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px; border-radius: 14px;">
  <div style="display: flex; align-items: center; gap: 10px;">${avatar(initials, bg, 34, 12)}<div style="flex-grow: 1;"><div style="font-weight: 600; font-size: 14px;">${name}</div><div class="muted" style="font-size: 12px;">${time}</div></div><span class="tag" style="background: ${catBg}; color: ${catFg};">${cat}</span></div>
  <div class="serif" style="font-size: 17px; font-weight: 700; line-height: 1.3;">${title}</div>
  <div style="font-size: 13px; color: ${T.ink2};">${excerpt}</div>
  <div style="display: flex; gap: 18px; color: ${T.ink2}; font-size: 13px; font-weight: 500; padding-top: 4px;"><span style="display: inline-flex; align-items: center; gap: 6px;">${I.heart(18)}${likes}</span><span style="display: inline-flex; align-items: center; gap: 6px;">${I.chat(18)}${comments}</span></div>
</article>`;
const mTab = (icon, label, on) => `<div style="flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0; color: ${on ? T.accent : T.ink3}; font-size: 11px; font-weight: 600;">${icon}${label}</div>`;

const mobileBody = `
<div style="width: 390px; height: 844px; background: ${T.bg}; display: flex; flex-direction: column; overflow: hidden;">
  <header style="padding: 56px 16px 12px; background: ${T.side}; color: #FFFDF9; display: flex; flex-direction: column; gap: 14px;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 36px; height: 36px; border-radius: 10px; background: ${T.accent}; display: flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800;">KD</div>
      <div style="flex-grow: 1; min-width: 0;"><div style="font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Kinh Doanh Online Cùng AI</div><div style="font-size: 12px; color: ${T.sideMuted};">12 đang online</div></div>
      <span style="color: ${T.sideText};">${I.down(18)}</span>
      <span style="position: relative; color: ${T.sideText}; margin-left: 8px;">${I.bell(22)}<span style="position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; border-radius: 999px; background: ${T.accent};"></span></span>
    </div>
    <div style="display: flex; gap: 8px; overflow: hidden;">
      <span class="chip" style="background: #FFFDF9; color: ${T.ink}; border-color: #FFFDF9;">Tất cả</span>
      <span class="chip" style="background: transparent; color: ${T.sideText}; border-color: rgba(255,253,249,0.2);">Thông báo</span>
      <span class="chip" style="background: transparent; color: ${T.sideText}; border-color: rgba(255,253,249,0.2);">Hỏi đáp</span>
      <span class="chip" style="background: transparent; color: ${T.sideText}; border-color: rgba(255,253,249,0.2);">Chia sẻ</span>
    </div>
  </header>
  <div style="flex-grow: 1; overflow: hidden; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
    <div class="card" style="padding: 12px 14px; display: flex; align-items: center; gap: 10px; border-radius: 14px;">${avatar('MQ', T.ink, 32, 12)}<span style="flex-grow: 1; color: ${T.ink3}; font-size: 14px;">Chia sẻ điều gì đó…</span><span style="color: ${T.ink2};">${I.image(20)}</span></div>
    ${mPost('MQ', T.ink, 'Minh Quý', 'Đã ghim · 2 ngày trước', 'Thông báo', T.accentSoft, '#9C3A21', 'Lộ trình Funnel Money Model 2026: bắt đầu từ đâu?', 'Tuần này mình mở lại toàn bộ module 1 cho thành viên miễn phí. Ai mới vào hãy học 5 bài đầu trước.', 24, 8)}
    ${mPost('CT', '#7A5C3E', 'Công Trần', '3 giờ trước', 'Hỏi đáp', T.tealSoft, '#0B6F75', 'Mới thanh toán Premium nhưng chưa thấy khóa học mở?', 'Mình vừa chuyển khoản gói tháng, đã nhận email xác nhận nhưng vào mục Khóa học vẫn thấy khóa.', 3, 2)}
  </div>
  <nav style="display: flex; border-top: 1px solid ${T.line}; background: ${T.surface}; padding-bottom: 18px;">
    ${mTab(I.home(22), 'Bảng tin', true)}
    ${mTab(I.book(22), 'Khóa học', false)}
    ${mTab(I.store(22), 'Cửa hàng', false)}
    ${mTab(I.chat(22), 'Tin nhắn', false)}
    ${mTab(I.user(22), 'Tôi', false)}
  </nav>
</div>`;

// ---------- DirectionB.dc.html : hướng thay thế, low-fi ----------
const box = (w, h, extra = '') => `<div style="width: ${w}; height: ${h}; background: #E5E9EF; border-radius: 8px;${extra}"></div>`;
const directionB = `
<div style="width: 1440px; height: 960px; background: #F4F6F9; color: #1B2733; font-family: 'Open Sans', 'Segoe UI', system-ui, sans-serif; display: flex; overflow: hidden;">
  <aside style="width: 264px; background: #FFFFFF; border-right: 1px solid #DDE3EA; padding: 20px 16px; display: flex; flex-direction: column; gap: 10px;">
    <div style="display: flex; align-items: center; gap: 10px;"><div style="width: 36px; height: 36px; border-radius: 10px; background: #2F6FED;"></div><div style="font-weight: 600;">Kinh Doanh Online Cùng AI</div></div>
    <div style="height: 1px; background: #DDE3EA; margin: 8px 0;"></div>
    <div style="padding: 10px 12px; border-radius: 8px; background: #E8F0FE; color: #2F6FED; font-weight: 600;">Bảng tin</div>
    <div style="padding: 10px 12px; color: #4B5B6B;">Thành viên</div>
    <div style="padding: 10px 12px; color: #4B5B6B;">Sự kiện</div>
    <div style="padding: 10px 12px; color: #4B5B6B;">Khóa học</div>
    <div style="padding: 10px 12px; color: #4B5B6B;">Cửa hàng</div>
    <div style="flex-grow: 1;"></div>
    <div style="height: 40px; border-radius: 8px; background: #2F6FED;"></div>
  </aside>
  <div style="flex-grow: 1; display: flex; flex-direction: column;">
    <div style="height: 64px; background: #FFFFFF; border-bottom: 1px solid #DDE3EA; display: flex; align-items: center; padding: 0 32px; gap: 16px;"><div style="font-weight: 700; font-size: 18px; color: #2F6FED;">Hội Mình</div>${box('420px', '38px')}<div style="flex-grow: 1;"></div>${box('36px', '36px', ' border-radius: 999px;')}</div>
    <div style="padding: 28px 32px; display: flex; gap: 28px;">
      <div style="width: 760px; display: flex; flex-direction: column; gap: 14px;">
        <div style="font-size: 26px; font-weight: 700;">Bảng tin</div>
        <div style="display: flex; gap: 8px;">${box('80px', '30px', ' border-radius: 999px; background: #1B2733;')}${box('100px', '30px', ' border-radius: 999px;')}${box('90px', '30px', ' border-radius: 999px;')}${box('90px', '30px', ' border-radius: 999px;')}</div>
        <div style="background: #FFFFFF; border: 1px solid #DDE3EA; border-radius: 12px; padding: 16px; display: flex; gap: 12px; align-items: center;">${box('40px', '40px', ' border-radius: 999px;')}${box('520px', '18px')}</div>
        <div style="background: #FFFFFF; border: 1px solid #DDE3EA; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 12px;"><div style="display: flex; gap: 10px; align-items: center;">${box('40px', '40px', ' border-radius: 999px;')}${box('160px', '14px')}</div>${box('480px', '22px')}${box('640px', '14px')}${box('560px', '14px')}</div>
        <div style="background: #FFFFFF; border: 1px solid #DDE3EA; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 12px;"><div style="display: flex; gap: 10px; align-items: center;">${box('40px', '40px', ' border-radius: 999px;')}${box('140px', '14px')}</div>${box('420px', '22px')}${box('600px', '14px')}</div>
      </div>
      <div style="width: 320px; display: flex; flex-direction: column; gap: 14px;">
        <div style="background: #FFFFFF; border: 1px solid #DDE3EA; border-radius: 12px; overflow: hidden;">${box('100%', '120px', ' border-radius: 0; background: #2F6FED;')}<div style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">${box('200px', '16px')}${box('260px', '12px')}${box('220px', '12px')}</div></div>
        <div style="background: #FFFFFF; border: 1px solid #DDE3EA; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">${box('140px', '14px')}${box('100%', '40px', ' background: #2F6FED;')}</div>
      </div>
    </div>
    <div style="margin: auto 32px 24px; padding: 12px 16px; border-radius: 10px; background: #FFF8E1; color: #6B5A1E; font-size: 13px; max-width: 700px;">Hướng B (phác thảo): nền sáng lạnh, sidebar trắng, một màu xanh dương làm nhấn, chỉ dùng sans-serif. Gọn và quen mắt hơn nhưng ít cá tính hơn Hướng A.</div>
  </div>
</div>`;

// ---------- Events.dc.html : Sự kiện ----------
const dateBlock = (dow, day, bg, fg) => `<div style="width: 56px; flex-shrink: 0; text-align: center; border-radius: 10px; background: ${bg}; padding: 6px 0;"><div style="font-size: 11px; font-weight: 600; color: ${fg};">${dow}</div><div style="font-size: 22px; font-weight: 800; color: ${fg}; line-height: 1.1; font-family: Montserrat, 'Segoe UI', Arial, sans-serif;">${day}</div></div>`;
const eventRow = ({ dow, day, bg, fg, title, time, kind, host, hostInit, hostBg, going, state }) => {
  const cta = state === 'joined'
    ? `<span class="btn btn-ghost btn-sm" style="color: ${T.teal};">${I.check(14)}Đã đăng ký</span>`
    : state === 'live'
      ? `<span class="btn btn-primary btn-sm">${I.play(14)}Vào phòng</span>`
      : `<span class="btn btn-dark btn-sm">Đăng ký</span>`;
  return `<div class="card" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px;${state === 'live' ? ` border-color: ${T.accent};` : ''}">
    ${dateBlock(dow, day, bg, fg)}
    <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">
      <div style="display: flex; align-items: center; gap: 8px;">${state === 'live' ? `<span class="tag" style="background: ${T.accentSoft}; color: #9C3A21;">Đang diễn ra</span>` : ''}<span style="font-weight: 600; font-size: 15px;" data-go="event">${title}</span></div>
      <div style="display: flex; align-items: center; gap: 14px; font-size: 13px; color: ${T.ink2};">
        <span style="display: inline-flex; align-items: center; gap: 5px;">${I.clock(15)}${time}</span>
        <span style="display: inline-flex; align-items: center; gap: 5px;">${I.video(15)}${kind}</span>
        <span style="display: inline-flex; align-items: center; gap: 6px;">${avatar(hostInit, hostBg, 20, 9)}${host}</span>
      </div>
    </div>
    <span class="muted" style="font-size: 13px; white-space: nowrap;">${going} người tham gia</span>
    ${cta}
  </div>`;
};
const calCell = (n, kind = '') => {
  const s = { pad: `color: ${T.line2};`, today: `background: ${T.ink}; color: #FFFDF9; border-radius: 8px; font-weight: 700;`, dot: '' }[kind] || '';
  return `<div style="position: relative; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 13px; ${s}">${n}${kind === 'dot' ? `<span style="position: absolute; bottom: 4px; width: 5px; height: 5px; border-radius: 999px; background: ${T.accent};"></span>` : ''}</div>`;
};
const calCells = [
  ...['31'].map((n) => calCell(n, 'pad')),
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)).map((n) => calCell(n, n === '14' ? 'today' : ['17', '20', '24', '27'].includes(n) ? 'dot' : '')),
  ...['1', '2', '3', '4'].map((n) => calCell(n, 'pad')),
].join('');

const eventsMain = `
<div style="display: flex; gap: 32px; height: 100%;">
  <div style="width: 780px; display: flex; flex-direction: column; gap: 16px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Sự kiện</h1>
      <div style="display: flex; gap: 8px; margin-left: 12px;"><span class="chip on">Sắp tới</span><span class="chip">Của tôi</span><span class="chip">Đã qua · 18</span></div>
      <span style="flex-grow: 1;"></span>
      <span class="btn btn-primary btn-sm" style="height: 36px;" data-go="event-create">${I.plus(16)}Tạo sự kiện</span>
    </div>

    <div class="th" style="padding-top: 4px;">Hôm nay · Thứ hai, 14/09</div>
    ${eventRow({ dow: 'T2', day: '14', bg: T.accentSoft, fg: '#9C3A21', title: 'Onboarding cho thành viên mới tuần này', time: '20:00 – 21:00', kind: 'Zoom', host: 'Minh Quý', hostInit: 'MQ', hostBg: T.ink, going: 38, state: 'live' })}

    <div class="th" style="padding-top: 8px;">Tuần này</div>
    ${eventRow({ dow: 'T4', day: '17', bg: T.bg, fg: T.ink2, title: 'Q&amp;A tuần: Funnel Money Model', time: '20:00 – 21:30', kind: 'Zoom', host: 'Minh Quý', hostInit: 'MQ', hostBg: T.ink, going: 64, state: 'joined' })}
    ${eventRow({ dow: 'T7', day: '20', bg: T.bg, fg: T.ink2, title: 'Workshop: AI Agent cho người bán hàng', time: '09:00 – 11:30', kind: 'Trực tiếp · TP.HCM', host: 'Hoàng Vũ', hostInit: 'HV', hostBg: T.accent, going: 21, state: 'open' })}

    <div class="th" style="padding-top: 8px;">Tuần sau</div>
    ${eventRow({ dow: 'T4', day: '24', bg: T.bg, fg: T.ink2, title: 'Q&amp;A tuần: Lead magnet và Tripwire', time: '20:00 – 21:30', kind: 'Zoom', host: 'Minh Quý', hostInit: 'MQ', hostBg: T.ink, going: 12, state: 'open' })}
    ${eventRow({ dow: 'CN', day: '27', bg: T.bg, fg: T.ink2, title: 'Cà phê cộng sự: chia sẻ cách kéo 100 đăng ký đầu tiên', time: '09:30 – 11:00', kind: 'YouTube Live', host: 'Hồng Kim', hostInit: 'HK', hostBg: '#7A5C3E', going: 9, state: 'open' })}
  </div>

  <aside style="width: 312px; display: flex; flex-direction: column; gap: 16px;">
    <div class="card" style="padding: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px;"><span style="color: ${T.ink3};">${I.back(16)}</span><span style="font-weight: 700;">Tháng 9, 2026</span><span style="color: ${T.ink3};">${I.right(16)}</span></div>
      <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px;">
        ${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => `<div class="th" style="text-align: center; height: 28px; line-height: 28px;">${d}</div>`).join('')}
        ${calCells}
      </div>
      <div class="muted" style="font-size: 12px; padding-top: 8px; display: flex; align-items: center; gap: 6px;">${I.clock(14)}Giờ Việt Nam (GMT+7)</div>
    </div>

    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="font-weight: 600;">Xem lại buổi trước</div>
      <div style="display: flex; gap: 12px; align-items: center;"><div style="width: 72px; height: 44px; border-radius: 8px; background: #171310; display: flex; align-items: center; justify-content: center; color: #FFFDF9; flex-shrink: 0;">${I.play(16)}</div><div><div style="font-size: 13px; font-weight: 500;">Q&amp;A tuần: Thiết kế Offer</div><div class="muted" style="font-size: 12px;">10/09 · 1 giờ 24 phút</div></div></div>
      <div style="display: flex; gap: 12px; align-items: center;"><div style="width: 72px; height: 44px; border-radius: 8px; background: #171310; display: flex; align-items: center; justify-content: center; color: #FFFDF9; flex-shrink: 0;">${I.play(16)}</div><div><div style="font-size: 13px; font-weight: 500;">Onboarding tuần 1 tháng 9</div><div class="muted" style="font-size: 12px;">07/09 · 52 phút</div></div></div>
      <a href="#" style="font-size: 13px; font-weight: 600;">Tất cả bản ghi</a>
    </div>

    <div class="card" style="padding: 16px; display: flex; align-items: center; gap: 12px;">
      <span style="color: ${T.teal};">${I.calendar(20)}</span>
      <div style="flex-grow: 1; font-size: 13px;">Đồng bộ sang Google Calendar</div>
      <span style="width: 40px; height: 22px; border-radius: 999px; background: ${T.teal}; position: relative; display: inline-block;"><span style="position: absolute; top: 3px; right: 3px; width: 16px; height: 16px; border-radius: 999px; background: #fff;"></span></span>
    </div>
  </aside>
</div>`;

// ---------- Affiliate.dc.html : Xếp hạng cộng sự ----------
const podium = (rank, initials, bg, name, referrals, paid, commission, first = false) => `
<div class="card" style="flex: 1 1 0; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;${first ? ` background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink};` : ''}">
  <div style="width: 32px; height: 32px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; background: ${first ? T.gold : T.bg}; color: ${first ? T.ink : T.ink2};">${rank}</div>
  ${avatar(initials, bg, 56, 18)}
  <div style="font-weight: 700; font-size: 16px;">${name}</div>
  <div style="font-size: 13px; color: ${first ? T.sideText : T.ink2};">${referrals} người giới thiệu · ${paid} trả phí</div>
  <div class="serif" style="font-size: 22px; font-weight: 800; padding-top: 4px;">${commission}</div>
  <div style="font-size: 12px; color: ${first ? T.sideText : T.ink3};">hoa hồng tháng này</div>
</div>`;
const rankRow = (rank, initials, bg, name, handle, referrals, paid, revenue, commission, trend, me = false) => `
<div style="display: grid; grid-template-columns: 56px 2fr 1fr 1fr 1.2fr 1.2fr 80px; align-items: center; gap: 12px; padding: 12px 20px; border-top: 1px solid ${T.line};${me ? ` background: ${T.goldSoft};` : ''}">
  <span style="font-weight: 700; color: ${T.ink2};">${rank}</span>
  <div style="display: flex; align-items: center; gap: 10px;">${avatar(initials, bg, 32, 12)}<div><div style="font-weight: 600;">${name}${me ? ' <span class="muted" style="font-weight: 500;">(bạn)</span>' : ''}</div><div class="muted" style="font-size: 12px;">@${handle}</div></div></div>
  <span>${referrals}</span>
  <span>${paid}</span>
  <span>${revenue}</span>
  <span style="font-weight: 600;">${commission}</span>
  <span style="font-size: 12px; font-weight: 600; color: ${trend.startsWith('+') ? T.teal : trend === '—' ? T.ink3 : '#9C3A21'};">${trend}</span>
</div>`;

const affiliateMain = `
<div style="display: flex; gap: 32px; height: 100%;">
  <div style="width: 780px; display: flex; flex-direction: column; gap: 16px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Xếp hạng cộng sự</h1>
      <div style="display: flex; gap: 8px; margin-left: 12px;"><span class="chip on">Tháng 9</span><span class="chip">Quý 3</span><span class="chip">Từ đầu</span></div>
      <span style="flex-grow: 1;"></span>
      <span class="muted" style="font-size: 13px;">Cập nhật 10 phút trước</span>
    </div>

    <div style="display: flex; gap: 16px;">
      ${podium(2, 'HK', '#7A5C3E', 'Hồng Kim', 19, 11, '1.369.500đ')}
      ${podium(1, 'HV', T.accent, 'Hoàng Vũ', 34, 23, '2.863.500đ', true)}
      ${podium(3, 'KB', '#5C7A3E', 'Kiên Bùi', 12, 8, '996.000đ')}
    </div>

    <div class="card" style="overflow: hidden;">
      <div style="display: grid; grid-template-columns: 56px 2fr 1fr 1fr 1.2fr 1.2fr 80px; gap: 12px; padding: 12px 20px;">
        <span class="th">Hạng</span><span class="th">Cộng sự</span><span class="th">Giới thiệu</span><span class="th">Trả phí</span><span class="th">Doanh thu</span><span class="th">Hoa hồng</span><span class="th">So tháng trước</span>
      </div>
      ${rankRow(4, 'ĐN', T.teal, 'Điền Phạm Ngọc', 'dien-pham-ngoc', 9, 6, '1.494.000đ', '747.000đ', '+2')}
      ${rankRow(5, 'DN', '#3E5C7A', 'Duy Nguyễn', 'duy-nguyen', 8, 5, '1.245.000đ', '622.500đ', '—')}
      ${rankRow(6, 'CT', '#7A5C3E', 'Công Trần', 'cong-tran', 7, 4, '996.000đ', '498.000đ', '+4')}
      ${rankRow(7, 'TL', '#5C3E7A', 'Thu Lan', 'thu-lan', 5, 3, '747.000đ', '373.500đ', '-1')}
      ${rankRow(8, 'MQ', T.ink, 'Minh Quý', 'minhquy', 4, 3, '747.000đ', '373.500đ', '—', true)}
    </div>
  </div>

  <aside style="width: 312px; display: flex; flex-direction: column; gap: 16px;">
    <div class="card" style="padding: 18px; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 8px; color: ${T.accent}; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;">${I.link(16)}Link của bạn</div>
      <div class="input" style="height: 40px; font-size: 13px; color: ${T.ink};"><span style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">hoiminh.vn/minhquy?ref=mq8k2</span>${I.copy(16)}</div>
      <div style="display: flex; gap: 8px;"><span class="btn btn-dark" style="flex: 1 1 0;">Sao chép link</span><span class="btn btn-ghost" data-go="my-affiliate">Ví và rút tiền</span></div>
      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding-top: 10px; border-top: 1px solid ${T.line};">
        <div style="text-align: center;"><div style="font-weight: 700; font-size: 18px;">128</div><div class="muted" style="font-size: 12px;">Lượt bấm</div></div>
        <div style="text-align: center;"><div style="font-weight: 700; font-size: 18px;">4</div><div class="muted" style="font-size: 12px;">Đăng ký</div></div>
        <div style="text-align: center;"><div style="font-weight: 700; font-size: 18px;">3</div><div class="muted" style="font-size: 12px;">Trả phí</div></div>
      </div>
    </div>

    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="font-weight: 600;">Cách tính</div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: ${T.ink2};">${I.wallet(16)}Hoa hồng 50% mỗi kỳ thanh toán</div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: ${T.ink2};">${I.clock(16)}Giữ 14 ngày, rồi gửi yêu cầu rút từ 500.000đ</div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: ${T.ink2};">${I.wallet(16)}Chủ hội chuyển khoản trong 3 ngày làm việc</div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: ${T.ink2};">${I.shield(16)}Không tính tự giới thiệu và hoàn tiền</div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: ${T.ink2};">${I.users(16)}Xếp hạng theo hoa hồng đã duyệt trong kỳ</div>
    </div>

    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-weight: 600;">Tổng cộng sự tháng này</div>
      <div style="display: flex; align-items: baseline; gap: 8px;"><span class="serif" style="font-size: 26px; font-weight: 800;">41</span><span class="muted" style="font-size: 13px;">cộng sự có phát sinh</span></div>
      <div class="prog"><div style="width: 62%;"></div></div>
      <div class="muted" style="font-size: 12px;">62% doanh thu tháng này đến từ giới thiệu</div>
    </div>
  </aside>
</div>`;

// ---------- Messages.dc.html : Tin nhắn ----------
const convo = ({ initials, bg, name, community, preview, time, unread = 0, on = false, auto = false }) => `
<div style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 12px;${on ? ` background: ${T.goldSoft};` : ''}">
  ${avatar(initials, bg, 40, 14)}
  <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
    <div style="display: flex; align-items: center; gap: 8px;"><span style="font-weight: 600; flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</span><span class="muted" style="font-size: 12px; flex-shrink: 0;">${time}</span></div>
    <div class="muted" style="font-size: 12px;">${community}</div>
    <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 13px; color: ${unread ? T.ink : T.ink2}; flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;${unread ? ' font-weight: 600;' : ''}">${auto ? `<span style="color: ${T.ink3};">Tự động · </span>` : ''}${preview}</span>${unread ? `<span style="min-width: 18px; height: 18px; border-radius: 999px; background: ${T.accent}; color: #FFFDF9; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px;">${unread}</span>` : ''}</div>
  </div>
</div>`;
const bubble = (text, mine = false, meta = '', auto = false) => `
<div style="display: flex; flex-direction: column; align-items: ${mine ? 'flex-end' : 'flex-start'}; gap: 4px; max-width: 520px; align-self: ${mine ? 'flex-end' : 'flex-start'};">
  ${auto ? `<span class="tag" style="background: ${T.bg}; color: ${T.ink3}; height: 20px;">${I.spark(12)}Tin nhắn chào tự động</span>` : ''}
  <div style="padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.55; ${mine ? `background: ${T.ink}; color: #FFFDF9; border-bottom-right-radius: 4px;` : `background: ${T.surface}; border: 1px solid ${T.line}; border-bottom-left-radius: 4px;`}">${text}</div>
  ${meta ? `<span class="muted" style="font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">${meta}</span>` : ''}
</div>`;

const messagesMain = `
<div style="display: flex; gap: 20px; height: 100%;">
  <!-- Conversation list -->
  <div class="card" style="width: 340px; display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0;">
    <div style="padding: 16px 16px 12px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; align-items: center;"><h1 class="serif" style="margin: 0; font-size: 22px; font-weight: 800; flex-grow: 1;">Tin nhắn</h1><span style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid ${T.line2}; display: inline-flex; align-items: center; justify-content: center; color: ${T.ink2};">${I.plus(18)}</span></div>
      <div class="input" style="height: 38px;">${I.search(16)}<span>Tìm người…</span></div>
      <div style="display: flex; gap: 6px;"><span class="chip on" style="height: 28px; font-size: 12px;">Tất cả</span><span class="chip" style="height: 28px; font-size: 12px;">Chưa đọc · 3</span><span class="chip" style="height: 28px; font-size: 12px;">Tự động</span></div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 2px; padding: 0 8px 8px; overflow: hidden;">
      ${convo({ initials: 'ĐN', bg: T.teal, name: 'Điền Phạm Ngọc', community: 'Kinh Doanh Online Cùng AI', preview: 'Mình không vào xem được các bài học', time: '22 giờ', unread: 1, on: true })}
      ${convo({ initials: 'CT', bg: '#7A5C3E', name: 'Công Trần', community: 'Kinh Doanh Online Cùng AI', preview: 'Chào Công, chào mừng bạn đến với…', time: '15 giờ', auto: true })}
      ${convo({ initials: 'DN', bg: '#3E5C7A', name: 'Duy Nguyễn', community: 'Kinh Doanh Online Cùng AI', preview: 'Chào Duy, chào mừng bạn đến với…', time: '15 giờ', auto: true })}
      ${convo({ initials: 'HV', bg: T.accent, name: 'Hoàng Vũ', community: 'Cộng sự', preview: 'Tháng này em lên 23 người trả phí rồi anh', time: 'Hôm qua', unread: 2 })}
      ${convo({ initials: 'HK', bg: '#7A5C3E', name: 'Hồng Kim', community: 'Kinh Doanh Online Cùng AI', preview: 'Bạn: Mai mình gửi bản ghi buổi Q&amp;A nhé', time: '3 ngày' })}
      ${convo({ initials: 'TL', bg: '#5C3E7A', name: 'Thu Lan', community: 'Faceless YouTube Foundation', preview: 'Cảm ơn anh, em đã nhận được link', time: '4 ngày' })}
    </div>
  </div>

  <!-- Thread -->
  <div class="card" style="flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
    <div style="display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid ${T.line};">
      ${avatar('ĐN', T.teal, 40, 14)}
      <div style="flex-grow: 1;"><div style="font-weight: 600;">Điền Phạm Ngọc</div><div class="muted" style="font-size: 12px; display: flex; align-items: center; gap: 6px;"><span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E; height: 18px; padding: 0 6px;">Premium</span>Kinh Doanh Online Cùng AI · hoạt động 3 giờ trước</div></div>
      <span class="btn btn-ghost btn-sm" data-go="profile">${I.user(14)}Hồ sơ</span>
      <span style="color: ${T.ink3};">${I.more(20)}</span>
    </div>
    <div style="flex-grow: 1; padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; overflow: hidden;">
      <div style="display: flex; align-items: center; gap: 12px; color: ${T.ink3}; font-size: 12px;"><span style="flex-grow: 1; height: 1px; background: ${T.line};"></span>Hôm qua<span style="flex-grow: 1; height: 1px; background: ${T.line};"></span></div>
      ${bubble('Chào Điền, chào mừng bạn đến với Kinh Doanh Online Cùng AI. Bạn bắt đầu ở mục “Bắt đầu tại đây” nhé, có gì cứ nhắn mình ở đây.', true, `${I.checkcheck(13)}Đã xem · 13/09, 09:12`, true)}
      ${bubble('Mình không vào xem được các bài học. Đã thanh toán gói tháng lúc sáng rồi ạ.', false, '22 giờ trước')}
      <div style="display: flex; align-items: center; gap: 12px; color: ${T.ink3}; font-size: 12px;"><span style="flex-grow: 1; height: 1px; background: ${T.line};"></span>Hôm nay<span style="flex-grow: 1; height: 1px; background: ${T.line};"></span></div>
      ${bubble('Mình kiểm tra thấy giao dịch 249.000đ đã về lúc 09:03 và gói Premium đã mở. Bạn tải lại trang Khóa học giúp mình nhé, nếu vẫn khóa thì gửi ảnh chụp màn hình.', true, `${I.checkcheck(13)}Đã gửi · 10:41`)}
      <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; max-width: 520px;">
        <div style="padding: 8px; border-radius: 16px; background: ${T.surface}; border: 1px solid ${T.line}; border-bottom-left-radius: 4px;"><div style="width: 240px; height: 140px; border-radius: 10px; background: #E9E1D3; display: flex; align-items: center; justify-content: center; color: ${T.ink3};">${I.image(28)}</div></div>
        <span class="muted" style="font-size: 11px;">10:52</span>
      </div>
    </div>
    <div style="padding: 12px 16px; border-top: 1px solid ${T.line}; display: flex; align-items: center; gap: 8px;">
      <span style="width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; color: ${T.ink2};">${I.paperclip(20)}</span>
      <span style="width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; color: ${T.ink2};">${I.image(20)}</span>
      <div class="input" style="flex-grow: 1; height: 44px; border-radius: 12px;"><span>Nhắn cho Điền…</span></div>
      <span class="btn btn-primary" style="width: 44px; height: 44px; padding: 0; border-radius: 12px;">${I.send(18)}</span>
    </div>
  </div>

  <!-- Member panel -->
  <aside class="card" style="width: 280px; padding: 20px; display: flex; flex-direction: column; gap: 14px; flex-shrink: 0;">
    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;">
      ${avatar('ĐN', T.teal, 64, 20)}
      <div style="font-weight: 700; font-size: 16px;">Điền Phạm Ngọc</div>
      <div class="muted" style="font-size: 13px;">@dien-pham-ngoc</div>
      <span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E;">Premium · 249.000đ/tháng</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: ${T.ink2}; padding-top: 12px; border-top: 1px solid ${T.line};">
      <div style="display: flex; align-items: center; gap: 10px;">${I.calendar(16)}Tham gia 13/09/2026</div>
      <div style="display: flex; align-items: center; gap: 10px;">${I.book(16)}Đang học: Funnel Money Model · 12%</div>
      <div style="display: flex; align-items: center; gap: 10px;">${I.users(16)}Giới thiệu bởi Hoàng Vũ</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid ${T.line};">
      <span class="btn btn-ghost btn-sm" style="justify-content: flex-start;">${I.settings(14)}Quản lý thành viên</span>
      <span class="btn btn-ghost btn-sm" style="justify-content: flex-start;">${I.lock(14)}Mở khóa khóa học</span>
      <span class="btn btn-ghost btn-sm" style="justify-content: flex-start;">${I.archive(14)}Lưu trữ hội thoại</span>
    </div>
  </aside>
</div>`;

// ---------- Notifications.dc.html : Thông báo ----------
const notif = ({ initials, bg, icon, iconBg, iconFg, text, meta, time, unread = false, action = '' }) => `
<div style="display: flex; gap: 14px; align-items: flex-start; padding: 14px 20px; border-top: 1px solid ${T.line};${unread ? ` background: ${T.surface};` : ` background: ${T.bg};`}">
  <div style="position: relative; flex-shrink: 0;">${avatar(initials, bg, 40, 14)}<span style="position: absolute; right: -6px; bottom: -6px; width: 22px; height: 22px; border-radius: 999px; background: ${iconBg}; color: ${iconFg}; border: 2px solid ${T.surface}; display: inline-flex; align-items: center; justify-content: center;">${icon}</span></div>
  <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;">
    <div style="font-size: 14px; line-height: 1.45; color: ${T.ink};">${text}</div>
    <div class="muted" style="font-size: 12px;">${meta} · ${time}</div>
  </div>
  ${action ? `<span class="btn btn-ghost btn-sm" style="flex-shrink: 0;">${action}</span>` : ''}
  <span style="width: 8px; height: 8px; border-radius: 999px; background: ${unread ? T.accent : 'transparent'}; flex-shrink: 0; margin-top: 6px;"></span>
</div>`;
const b = (s) => `<strong style="font-weight: 600;">${s}</strong>`;

const notificationsMain = `
<div style="display: flex; gap: 32px; height: 100%;">
  <div style="width: 780px; display: flex; flex-direction: column; gap: 16px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Thông báo</h1>
      <div style="display: flex; gap: 8px; margin-left: 12px;"><span class="chip on">Tất cả</span><span class="chip">Chưa đọc · 5</span><span class="chip">Nhắc đến</span><span class="chip">Cộng sự</span><span class="chip">Hệ thống</span></div>
      <span style="flex-grow: 1;"></span>
      <span class="btn btn-ghost btn-sm">${I.checkcheck(14)}Đánh dấu tất cả đã đọc</span>
    </div>

    <div class="card" style="overflow: hidden;">
      <div class="th" style="padding: 12px 20px 8px;">Hôm nay</div>
      ${notif({ initials: 'CT', bg: '#7A5C3E', icon: I.chat(12), iconBg: T.tealSoft, iconFg: '#0B6F75', text: `${b('Công Trần')} đã bình luận về bài của bạn: “Cảm ơn anh, em đã vào học được rồi ạ”`, meta: 'Kinh Doanh Online Cùng AI · Hỏi đáp', time: '25 phút trước', unread: true, action: 'Trả lời' })}
      ${notif({ initials: 'HV', bg: T.accent, icon: I.dollar(12), iconBg: T.goldSoft, iconFg: '#8A6A1E', text: `Hoa hồng ${b('124.500đ')} từ giới thiệu của bạn đã được duyệt sau 14 ngày giữ`, meta: 'Cộng sự · Kinh Doanh Online Cùng AI', time: '2 giờ trước', unread: true })}
      ${notif({ initials: 'HK', bg: '#7A5C3E', icon: I.at(12), iconBg: T.accentSoft, iconFg: '#9C3A21', text: `${b('Hồng Kim')} đã nhắc đến bạn trong “Ngày 3: đơn đầu tiên từ funnel affiliate”`, meta: 'Kinh Doanh Online Cùng AI · Nhật ký', time: '3 giờ trước', unread: true, action: 'Xem' })}
      ${notif({ initials: 'MQ', bg: T.ink, icon: I.calendar(12), iconBg: T.tealSoft, iconFg: '#0B6F75', text: `Sự kiện ${b('Q&amp;A tuần: Funnel Money Model')} bắt đầu sau 1 giờ`, meta: 'Kinh Doanh Online Cùng AI · Sự kiện', time: '19:00', unread: true, action: 'Vào phòng' })}
      <div class="th" style="padding: 16px 20px 8px;">Hôm qua</div>
      ${notif({ initials: 'ĐN', bg: T.teal, icon: I.userplus(12), iconBg: T.goldSoft, iconFg: '#8A6A1E', text: `${b('Điền Phạm Ngọc')} đã nâng cấp lên ${b('Premium')} qua link của Hoàng Vũ`, meta: 'Chủ cộng đồng · Kinh Doanh Online Cùng AI', time: '09:03', unread: true })}
      ${notif({ initials: 'TL', bg: '#5C3E7A', icon: I.megaphone(12), iconBg: T.accentSoft, iconFg: '#9C3A21', text: `${b('Thu Lan')} đăng bài mới: “Quy trình viết kịch bản bằng AI trong 20 phút”`, meta: 'Faceless YouTube Foundation · Chia sẻ', time: '16:40' })}
      ${notif({ initials: 'HM', bg: T.ink3, icon: I.bell(12), iconBg: T.bg, iconFg: T.ink2, text: `Gói Premium tại ${b('Faceless YouTube Foundation')} sẽ gia hạn vào 20/09, 199.000đ qua MoMo`, meta: 'Hệ thống', time: '08:00' })}
      <div class="th" style="padding: 16px 20px 8px;">Tuần này</div>
      ${notif({ initials: 'DN', bg: '#3E5C7A', icon: I.heart(12), iconBg: T.accentSoft, iconFg: '#9C3A21', text: `${b('Duy Nguyễn')} và 11 người khác đã thích bài “Lộ trình Funnel Money Model 2026”`, meta: 'Kinh Doanh Online Cùng AI · Thông báo', time: 'Thứ 5' })}
    </div>
  </div>

  <aside style="width: 312px; display: flex; flex-direction: column; gap: 16px;">
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
      <div style="font-weight: 600;">Cài đặt nhanh</div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><span style="color: ${T.ink2};">${I.mail(16)}</span><span style="flex-grow: 1;">Email tổng hợp mỗi sáng</span><span style="width: 40px; height: 22px; border-radius: 999px; background: ${T.teal}; position: relative; display: inline-block;"><span style="position: absolute; top: 3px; right: 3px; width: 16px; height: 16px; border-radius: 999px; background: #fff;"></span></span></div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><span style="color: ${T.ink2};">${I.bell(16)}</span><span style="flex-grow: 1;">Đẩy trên điện thoại</span><span style="width: 40px; height: 22px; border-radius: 999px; background: ${T.teal}; position: relative; display: inline-block;"><span style="position: absolute; top: 3px; right: 3px; width: 16px; height: 16px; border-radius: 999px; background: #fff;"></span></span></div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><span style="color: ${T.ink2};">${I.heart(16)}</span><span style="flex-grow: 1;">Báo khi có lượt thích</span><span style="width: 40px; height: 22px; border-radius: 999px; background: ${T.line2}; position: relative; display: inline-block;"><span style="position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 999px; background: #fff;"></span></span></div>
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="font-weight: 600;">Theo cộng đồng</div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><div style="width: 28px; height: 28px; border-radius: 8px; background: ${T.accent};"></div><span style="flex-grow: 1;">Kinh Doanh Online Cùng AI</span><span class="muted" style="font-size: 12px;">Tất cả</span><span style="color: ${T.ink2};">${I.bell(16)}</span></div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><div style="width: 28px; height: 28px; border-radius: 8px; background: ${T.teal};"></div><span style="flex-grow: 1;">Faceless YouTube Foundation</span><span class="muted" style="font-size: 12px;">Chỉ nhắc đến</span><span style="color: ${T.ink2};">${I.at(16)}</span></div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><div style="width: 28px; height: 28px; border-radius: 8px; background: #7A5C3E;"></div><span style="flex-grow: 1;">Quản trị cảm xúc</span><span class="muted" style="font-size: 12px;">Tắt</span><span style="color: ${T.ink3};">${I.belloff(16)}</span></div>
      <a href="#" style="font-size: 13px; font-weight: 600;">Cài đặt chi tiết</a>
    </div>
  </aside>
</div>`;

// ---------- shared bits for settings / billing ----------
const toggle = (on) => `<span style="width: 40px; height: 22px; border-radius: 999px; background: ${on ? T.teal : T.line2}; position: relative; display: inline-block; flex-shrink: 0;"><span style="position: absolute; top: 3px; ${on ? 'right' : 'left'}: 3px; width: 16px; height: 16px; border-radius: 999px; background: #fff;"></span></span>`;
const radio = (on) => `<span style="width: 18px; height: 18px; border-radius: 999px; border: 2px solid ${on ? T.accent : T.line2}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${on ? `<span style="width: 8px; height: 8px; border-radius: 999px; background: ${T.accent};"></span>` : ''}</span>`;
const field = (label, control, hint = '') => `<div style="display: flex; flex-direction: column; gap: 6px;"><span style="font-size: 13px; font-weight: 600;">${label}</span>${control}${hint ? `<span class="muted" style="font-size: 12px;">${hint}</span>` : ''}</div>`;
const inputBox = (value, extra = '') => `<div class="input" style="color: ${T.ink};${extra}"><span style="flex-grow: 1;">${value}</span></div>`;
const statCard = (label, value, sub, subColor = T.ink3) => `<div class="card" style="flex: 1 1 0; padding: 16px 18px; display: flex; flex-direction: column; gap: 4px;"><span class="muted" style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;">${label}</span><span class="serif" style="font-size: 24px; font-weight: 800;">${value}</span><span style="font-size: 12px; color: ${subColor};">${sub}</span></div>`;
const saveBar = (title, sub = '') => `<div style="display: flex; align-items: center; gap: 12px;"><div><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">${title}</h1>${sub ? `<div class="muted" style="font-size: 13px;">${sub}</div>` : ''}</div><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">Hủy</span><span class="btn btn-dark btn-sm">Lưu thay đổi</span></div>`;
const settingsPage = (active, inner) => `<div style="display: flex; gap: 32px; height: 100%;">${settingsNav(active)}<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 20px; max-width: 880px;">${inner}</div></div>`;

// ---------- SettingsOverview.dc.html : Cài đặt · Tổng quan ----------
const bars = [42, 55, 38, 60, 71, 48, 52, 66, 80, 58, 63, 90, 74, 69, 85, 77, 95, 62, 70, 88, 100, 82, 76, 91, 68, 84, 97, 73, 79, 86];
const overviewMain = settingsPage('Tổng quan', `
  <div style="display: flex; align-items: center; gap: 12px;"><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Tổng quan</h1><span style="flex-grow: 1;"></span><div style="display: flex; gap: 8px;"><span class="chip">7 ngày</span><span class="chip on">30 ngày</span><span class="chip">Quý</span></div></div>
  <div style="display: flex; gap: 12px;">
    ${statCard('Thành viên mới', '41', '+12% so với kỳ trước', T.teal)}
    ${statCard('Doanh thu', '18.675.000đ', '+8% so với kỳ trước', T.teal)}
    ${statCard('Đang trả phí', '75', 'Premium 73 · VIP 2')}
    ${statCard('Tỷ lệ hủy', '2,6%', '2 người hủy trong kỳ', '#9C3A21')}
  </div>
  <div class="card" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; align-items: center;"><span style="font-weight: 600;">Doanh thu theo ngày</span><span style="flex-grow: 1;"></span><span class="muted" style="font-size: 12px;">15/08 – 14/09</span></div>
    <div style="display: flex; align-items: flex-end; gap: 6px; height: 120px;">${bars.map((h, i) => `<div style="flex: 1 1 0; height: ${h}%; border-radius: 4px 4px 0 0; background: ${i === bars.length - 1 ? T.accent : T.teal}; opacity: ${i === bars.length - 1 ? 1 : 0.55};"></div>`).join('')}</div>
    <div style="display: flex; justify-content: space-between;" class="muted"><span style="font-size: 11px;">15/08</span><span style="font-size: 11px;">30/08</span><span style="font-size: 11px;">14/09</span></div>
  </div>
  <div style="display: flex; gap: 16px;">
    <div class="card" style="flex: 1 1 0; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; align-items: center;"><span style="font-weight: 600;">Hoàn thiện cộng đồng</span><span style="flex-grow: 1;"></span><span class="muted" style="font-size: 12px;">4/6</span></div>
      <div class="prog"><div style="width: 67%;"></div></div>
      ${[['Thêm logo và mô tả', true], ['Tạo bài viết đầu tiên', true], ['Tạo khóa học đầu tiên', true], ['Kết nối nhận tiền', true], ['Mời 5 thành viên', false], ['Bật tin nhắn chào tự động', false]].map(([t, d]) => `<div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: ${d ? T.ink3 : T.ink};"><span style="width: 20px; height: 20px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; ${d ? `background: ${T.teal}; color: #fff;` : `border: 1.5px solid ${T.line2};`}">${d ? I.check(12) : ''}</span><span style="${d ? 'text-decoration: line-through;' : ''}">${t}</span></div>`).join('')}
    </div>
    <div class="card" style="flex: 1 1 0; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px;">
      <span style="font-weight: 600;">Hoạt động gần đây</span>
      ${[['ĐN', T.teal, '<strong>Điền Phạm Ngọc</strong> nâng cấp Premium', '09:03'], ['CT', '#7A5C3E', '<strong>Công Trần</strong> đặt câu hỏi trong Hỏi đáp', '3 giờ trước'], ['HV', T.accent, '<strong>Hoàng Vũ</strong> giới thiệu 2 thành viên mới', 'Hôm qua'], ['MQ', T.ink, 'Bạn đã tạo sự kiện <strong>Q&amp;A tuần</strong>', 'Hôm qua']].map(([i, bg, t, time]) => `<div style="display: flex; align-items: center; gap: 10px; font-size: 13px;">${avatar(i, bg, 28, 11)}<span style="flex-grow: 1;">${t}</span><span class="muted" style="font-size: 12px;">${time}</span></div>`).join('')}
    </div>
  </div>`);

// ---------- SettingsGeneral.dc.html : Cài đặt · Chung ----------
const generalMain = settingsPage('Chung', `
  ${saveBar('Chung', 'Tên, đường dẫn, mô tả và quy tắc của cộng đồng')}
  <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 18px;">
    <div style="display: flex; gap: 20px; align-items: center;">
      <div style="width: 88px; height: 88px; border-radius: 20px; background: ${T.accent}; color: #FFFDF9; display: flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 30px; flex-shrink: 0;">KD</div>
      <div style="display: flex; flex-direction: column; gap: 8px;"><span style="font-weight: 600;">Logo</span><div style="display: flex; gap: 8px;"><span class="btn btn-ghost btn-sm">${I.image(14)}Tải ảnh lên</span><span class="btn btn-ghost btn-sm">Xóa</span></div><span class="muted" style="font-size: 12px;">PNG hoặc JPG, vuông, tối thiểu 256px</span></div>
    </div>
    ${field('Tên cộng đồng', inputBox('Kinh Doanh Online Cùng AI'))}
    ${field('Đường dẫn', `<div style="display: flex; gap: 8px; align-items: center;"><div class="input" style="color: ${T.ink}; flex-grow: 1;"><span class="muted">hoiminh.vn/</span><span style="flex-grow: 1;">minhquy</span><span style="color: ${T.teal};">${I.check(16)}</span></div><span class="btn btn-ghost" data-go="about">${I.globe(16)}Xem trang giới thiệu</span></div>`, 'Người lạ mở link này sẽ thấy trang giới thiệu hội trước, đổi đường dẫn sẽ làm link cũ ngừng hoạt động')}
    ${field('Mô tả ngắn', inputBox('Ứng dụng AI xây dựng doanh nghiệp một người.'), '120 ký tự, hiện trên trang Khám phá và thẻ chia sẻ')}
    ${field('Danh mục', `<div class="input" style="color: ${T.ink}; width: 320px;"><span style="flex-grow: 1;">Kinh doanh</span>${I.down(16)}</div>`)}
  </div>
  <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; align-items: center;"><span style="font-weight: 600;">Quy tắc cộng đồng</span><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">${I.plus(14)}Thêm quy tắc</span></div>
    ${['Tôn trọng nhau, không công kích cá nhân', 'Không quảng cáo dịch vụ ngoài khi chưa được phép', 'Đặt câu hỏi đúng chuyên mục, có ngữ cảnh rõ ràng'].map((r, i) => `<div style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; background: ${T.bg};"><span style="font-weight: 700; color: ${T.ink3};">${i + 1}</span><span style="flex-grow: 1; font-size: 14px;">${r}</span><span style="color: ${T.ink3};">${I.more(18)}</span></div>`).join('')}
  </div>
  <div class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 14px;">
    <div style="display: flex; align-items: center; gap: 8px;"><span style="font-weight: 600;">Nâng cao</span><span style="flex-grow: 1;"></span>${I.down(18)}</div>
    ${field('Tên miền riêng', `<div style="display: flex; gap: 8px; align-items: center;">${inputBox('hoc.minhquy.vn', ' width: 320px;')}<span class="tag" style="background: ${T.tealSoft}; color: #0B6F75; height: 26px;">${I.check(12)}DNS đã trỏ</span></div>`, 'Trỏ bản ghi CNAME về app.hoiminh.vn, SSL cấp tự động')}
  </div>
  <div style="display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-radius: 12px; border: 1px dashed ${T.line2};"><div style="flex-grow: 1;"><div style="font-weight: 600; color: #9C3A21;">Lưu trữ cộng đồng</div><div class="muted" style="font-size: 12px;">Ẩn khỏi mọi người, giữ toàn bộ dữ liệu, có thể mở lại</div></div><span class="btn btn-ghost btn-sm" style="color: #9C3A21;">Lưu trữ</span></div>`);

// ---------- SettingsPlugins.dc.html : Cài đặt · Tiện ích ----------
const pluginRow = (icon, iconBg, name, desc, on, pro = false, open = '') => `<div class="card" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px;${pro ? ' opacity: 0.75;' : ''}"><div style="display: flex; align-items: center; gap: 14px;"><span style="width: 40px; height: 40px; border-radius: 10px; background: ${iconBg}; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${icon}</span><div style="flex-grow: 1;"><div style="display: flex; align-items: center; gap: 8px;"><span style="font-weight: 600;">${name}</span>${pro ? `<span class="tag" style="background: ${T.bg}; color: ${T.ink3};">Sắp ra mắt</span>` : `<span style="font-size: 12px; font-weight: 600; color: ${on ? T.teal : T.ink3};">${on ? 'Đang bật' : 'Đang tắt'}</span>`}</div><div class="muted" style="font-size: 13px;">${desc}</div></div>${pro ? `<span class="btn btn-ghost btn-sm">Báo tôi khi có</span>` : toggle(on)}</div>${open}</div>`;
const pluginsMain = settingsPage('Tiện ích', `
  <div><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Tiện ích</h1><div class="muted" style="font-size: 13px;">Bật những gì cần, không cần code</div></div>
  ${pluginRow(I.chat(20), T.accent, 'Tin nhắn chào tự động', 'Nhắn riêng cho người vừa tham gia, thay mặt bạn', true, false, `<div style="padding: 14px 16px; border-radius: 10px; background: ${T.bg}; display: flex; flex-direction: column; gap: 10px;"><div style="display: flex; gap: 12px; align-items: center; font-size: 13px;"><span class="muted">Người gửi</span><span style="display: inline-flex; align-items: center; gap: 6px;">${avatar('MQ', T.ink, 22, 9)}Minh Quý</span><span class="muted" style="margin-left: 12px;">Gửi sau</span><span class="chip" style="height: 26px; font-size: 12px;">2 phút ${I.down(12)}</span></div><div style="padding: 12px 14px; border-radius: 10px; background: ${T.surface}; border: 1px solid ${T.line}; font-size: 13px; line-height: 1.55; color: ${T.ink};">Chào {{tên}}, chào mừng bạn đến với {{cộng đồng}}. Bạn bắt đầu ở mục “Bắt đầu tại đây” nhé, có gì cứ nhắn mình ở đây.</div><div class="muted" style="font-size: 12px;">Biến có thể dùng: {{tên}} · {{cộng đồng}} · {{link bắt đầu}}</div></div>`)}
  ${pluginRow(I.check(20), T.teal, 'Tự duyệt tham gia', 'Người xin vào được duyệt ngay, không cần bạn bấm', true)}
  ${pluginRow(I.link(20), '#7A5C3E', 'Liên kết', 'Khối link trong ô giới thiệu: Fanpage, YouTube, Zalo', true)}
  ${pluginRow(I.ext(20), T.ink3, 'Webhook', 'Thêm thành viên từ hệ thống khác qua một địa chỉ nhận', false)}
  ${pluginRow(I.globe(20), '#3E5C7A', 'Pixel Facebook', 'Đo đăng ký và thanh toán để chạy quảng cáo', true)}
  ${pluginRow(I.video(20), '#5C3E7A', 'Video chào', 'Phát một video ở lần đầu thành viên vào', false, true)}
  ${pluginRow(I.spark(20), '#5C7A3E', 'Zapier và Make', 'Nối với 5.000 ứng dụng khác', false, true)}`);

const wdStatus = (s) => ({
  requested: [`Chờ duyệt`, T.goldSoft, '#8A6A1E'], reviewing: ['Đang xử lý', T.tealSoft, '#0B6F75'], paid: ['Đã trả', T.tealSoft, '#0B6F75'],
  rejected: ['Bị từ chối', T.accentSoft, '#9C3A21'], cancelled: ['Đã hủy', T.bg, T.ink3],
  pending: ['Đang giữ', T.goldSoft, '#8A6A1E'], available: ['Có thể rút', T.tealSoft, '#0B6F75'], reversed: ['Đã đảo', T.accentSoft, '#9C3A21'],
}[s]);
const statusTag = (s) => { const [l, bg, fg] = wdStatus(s); return `<span class="tag" style="background: ${bg}; color: ${fg}; width: fit-content;">${l}</span>`; };
const walletBox = (label, value, hint, strong = false) => `<div class="card" style="flex: 1 1 0; padding: 16px 18px; display: flex; flex-direction: column; gap: 4px;${strong ? ` background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink};` : ''}"><span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: ${strong ? T.gold : T.ink3};">${label}</span><span class="serif" style="font-size: 24px; font-weight: 800;">${value}</span><span style="font-size: 12px; color: ${strong ? T.sideText : T.ink3};">${hint}</span></div>`;
const ledgerNotice = (who) => `<div style="display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border-radius: 12px; background: ${T.goldSoft}; color: #5C4A16; font-size: 13px; line-height: 1.5;"><span style="flex-shrink: 0; color: #8A6A1E;">${I.shield(20)}</span><div><strong>Hội Mình không tự chuyển tiền cho cộng sự.</strong> ${who} chuyển khoản bằng app ngân hàng của mình rồi ghi mã tham chiếu vào đây. Số dư cộng sự là sổ cái bất biến (ghi có, khóa, trả lại, ghi nợ, điều chỉnh), không sửa tay được.</div></div>`;

const queueRow = (init, bg, name, email, amount, account, date, status, open = false) => `<div style="display: grid; grid-template-columns: 2fr 1fr 1.4fr 1fr 1fr 110px; gap: 12px; align-items: center; padding: 12px 20px; border-top: 1px solid ${T.line}; font-size: 13px;${open ? ` background: ${T.goldSoft};` : ''}"><div style="display: flex; align-items: center; gap: 10px;">${avatar(init, bg, 32, 12)}<div><div style="font-weight: 600;">${name}</div><div class="muted" style="font-size: 12px;">${email}</div></div></div><span style="font-weight: 700;">${amount}</span><span class="muted">${account}</span><span class="muted">${date}</span>${statusTag(status)}<span class="btn btn-ghost btn-sm" style="width: fit-content; justify-self: end;">${open ? 'Đóng' : 'Xem xét'}</span></div>`;
const reviewPanel = ({ name, amount, email, holder, bank, account, ref }) => `
<div style="padding: 20px; border-top: 1px solid ${T.line}; background: ${T.surface}; display: flex; flex-direction: column; gap: 16px;">
  <div style="display: flex; align-items: center; gap: 12px;"><div style="flex-grow: 1;"><div style="font-weight: 700; font-size: 15px;">${name} · ${amount}</div><div class="muted" style="font-size: 12px;">${email} · tiền đã bị khóa khỏi số dư có thể rút của cộng sự</div></div><span class="tag" style="background: ${T.tealSoft}; color: #0B6F75;">${I.check(11)}Đã mở số tài khoản · ghi vào nhật ký</span></div>
  <div style="display: flex; gap: 20px;">
    <div style="display: grid; grid-template-columns: 130px 1fr; row-gap: 10px; column-gap: 12px; font-size: 14px; flex-grow: 1; align-content: start;">
      <span class="muted">Chủ tài khoản</span><span style="font-weight: 600;">${holder}</span>
      <span class="muted">Ngân hàng</span><span>${bank}</span>
      <span class="muted">Số tài khoản</span><span style="display: inline-flex; align-items: center; gap: 8px;"><code style="font-family: Consolas, monospace; background: ${T.bg}; padding: 2px 8px; border-radius: 6px;">${account}</code><span style="color: ${T.ink3};">${I.copy(14)}</span></span>
      <span class="muted">Số tiền</span><span style="font-weight: 700; font-size: 16px;">${amount}</span>
      <span class="muted">Nội dung gợi ý</span><span style="display: inline-flex; align-items: center; gap: 8px;"><code style="font-family: Consolas, monospace; background: ${T.bg}; padding: 2px 8px; border-radius: 6px;">${ref}</code><span style="color: ${T.ink3};">${I.copy(14)}</span></span>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px; border-radius: 12px; border: 1px solid ${T.line2}; background: ${T.bg}; flex-shrink: 0;"><div style="width: 132px; height: 132px; border-radius: 10px; background: ${T.surface}; border: 1px solid ${T.line2}; display: flex; align-items: center; justify-content: center;">${I.qr(84)}</div><span class="muted" style="font-size: 11px; text-align: center; max-width: 150px;">Quét bằng app ngân hàng, đã điền sẵn số tiền và nội dung</span></div>
  </div>
  <div style="display: flex; gap: 16px; align-items: flex-end; padding-top: 12px; border-top: 1px solid ${T.line};">
    <div style="flex: 1 1 0; display: flex; flex-direction: column; gap: 6px;"><span style="font-size: 13px; font-weight: 600;">Mã tham chiếu chuyển khoản</span><div class="input" style="color: ${T.ink};"><span style="flex-grow: 1;">FT26091412345</span></div></div>
    <span class="btn btn-primary">${I.check(16)}Đã chuyển khoản</span>
    <span style="width: 1px; height: 40px; background: ${T.line};"></span>
    <div style="flex: 1 1 0; display: flex; flex-direction: column; gap: 6px;"><span style="font-size: 13px; font-weight: 600;">Lý do từ chối</span><div class="input"><span>Sai số tài khoản</span></div></div>
    <span class="btn btn-ghost" style="color: #9C3A21;">Từ chối và hoàn về ví</span>
  </div>
</div>`;
const historyRow = (name, amount, date, status, note) => `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr; gap: 12px; align-items: center; padding: 10px 20px; border-top: 1px solid ${T.line}; font-size: 13px;"><span style="font-weight: 500;">${name}</span><span style="font-weight: 600;">${amount}</span><span class="muted">${date}</span>${statusTag(status)}<span class="muted">${note}</span></div>`;

const affiliateTabs = (active) => `<div style="display: flex; gap: 8px;">${[['Cấu hình', 's-affiliate'], ['Yêu cầu rút · 3', 's-affiliate-payouts'], ['Cộng sự · 41', 'affiliate']].map(([l, go]) => `<span class="chip${active === go ? ' on' : ''}" data-go="${go}">${l}</span>`).join('')}</div>`;

// ---------- SettingsAffiliate.dc.html : Cài đặt · Cộng sự ----------
const affiliateSettingsMain = settingsPage('Cộng sự (Affiliate)', `
  ${saveBar('Cộng sự', 'Thưởng cho thành viên giới thiệu bạn bè bằng hoa hồng định kỳ')}
  ${affiliateTabs('s-affiliate')}
  ${ledgerNotice('Bạn')}
  <div style="display: flex; gap: 16px;">
    <div class="card" style="flex: 1.4 1 0; padding: 24px; display: flex; flex-direction: column; gap: 18px;">
      ${field('Mức hoa hồng', `<div style="display: flex; flex-direction: column; gap: 8px;">${[['Tắt', false], ['10%', false], ['20%', false], ['30%', false], ['40% · khuyên dùng', false], ['50%', true]].map(([l, on]) => `<div style="display: flex; align-items: center; gap: 10px; font-size: 14px;${on ? ' font-weight: 600;' : ''}">${radio(on)}${l}</div>`).join('')}</div>`, 'Tính trên mỗi kỳ thanh toán của người được giới thiệu')}
      ${field('Thời gian giữ hoa hồng', `<div class="input" style="color: ${T.ink}; width: 220px;"><span style="flex-grow: 1;">14 ngày</span>${I.down(16)}</div>`, 'Để xử lý hoàn tiền trước khi cộng sự được rút')}
      ${field('Mức rút tối thiểu', `<div class="input" style="color: ${T.ink}; width: 220px;"><span style="flex-grow: 1;">500.000đ</span></div>`, 'Cộng sự chỉ gửi được yêu cầu rút từ mức này')}
    </div>
    <div style="flex: 1 1 0; display: flex; flex-direction: column; gap: 16px;">
      <div class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
        <span style="font-weight: 600;">Bảng xếp hạng cộng sự</span>
        ${[['Mọi thành viên thấy', true], ['Chỉ người đã lấy link', false], ['Tắt bảng xếp hạng', false]].map(([l, on]) => `<div style="display: flex; align-items: center; gap: 10px; font-size: 14px;">${radio(on)}${l}</div>`).join('')}
        <div style="display: flex; align-items: center; gap: 10px; font-size: 14px; padding-top: 12px; border-top: 1px solid ${T.line};"><span style="flex-grow: 1;">Hiện số tiền doanh thu và hoa hồng</span>${toggle(true)}</div>
      </div>
      <div class="card" style="padding: 20px; background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink}; display: flex; flex-direction: column; gap: 10px;">
        <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: ${T.gold};">Tháng này</span>
        <div style="display: flex; gap: 20px;"><div><div class="serif" style="font-size: 22px; font-weight: 800;">41</div><div style="font-size: 12px; color: ${T.sideText};">cộng sự có phát sinh</div></div><div><div class="serif" style="font-size: 22px; font-weight: 800;">62%</div><div style="font-size: 12px; color: ${T.sideText};">doanh thu từ giới thiệu</div></div></div>
        <div style="font-size: 13px; color: ${T.sideText};">Đã trả: 5.790.000đ · chờ bạn chuyển: 2.620.000đ · đang giữ: 1.245.000đ</div>
        <span class="btn btn-primary btn-sm" data-go="s-affiliate-payouts" style="align-self: flex-start;">Xử lý 3 yêu cầu rút</span>
      </div>
    </div>
  </div>`);

// ---------- SettingsFeed.dc.html : Cài đặt · Bảng tin ----------
const catRow = (name, who, posts) => `<div style="display: grid; grid-template-columns: 24px 1.6fr 1.2fr 80px 32px; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid ${T.line};"><span style="color: ${T.line2};">${I.more(16)}</span><span style="font-weight: 500;">${name}</span><div class="chip" style="height: 30px; font-size: 12px; width: fit-content;">${who} ${I.down(12)}</div><span class="muted" style="font-size: 13px;">${posts} bài</span><span style="color: ${T.ink3};">${I.x(16)}</span></div>`;
const feedSettingsMain = settingsPage('Bảng tin', `
  ${saveBar('Bảng tin', 'Tab, chuyên mục và quyền đăng bài')}
  <div class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 10px;">
    <span style="font-weight: 600;">Tab hiển thị</span>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 32px;">${[['Bảng tin', true, true], ['Khóa học', true], ['Sự kiện', true], ['Thành viên', true], ['Xếp hạng cộng sự', true], ['Cửa hàng', true], ['Giới thiệu', true, true], ['Tài nguyên', false]].map(([l, on, lock]) => `<div style="display: flex; align-items: center; gap: 10px; font-size: 14px; padding: 6px 0;"><span style="flex-grow: 1;">${l}</span>${lock ? `<span class="muted" style="font-size: 12px;">luôn bật</span>` : toggle(on)}</div>`).join('')}</div>
  </div>
  <div class="card" style="overflow: hidden;">
    <div style="display: flex; align-items: center; padding: 16px 20px;"><span style="font-weight: 600;">Chuyên mục</span><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">${I.plus(14)}Thêm chuyên mục</span></div>
    <div style="display: grid; grid-template-columns: 24px 1.6fr 1.2fr 80px 32px; gap: 12px; padding: 0 16px 8px;"><span></span><span class="th">Tên</span><span class="th">Ai được đăng</span><span class="th">Số bài</span><span></span></div>
    ${catRow('Thông báo', 'Chỉ quản trị', 24)}${catRow('Hỏi đáp', 'Mọi thành viên', 131)}${catRow('Chia sẻ', 'Mọi thành viên', 87)}${catRow('Nhật ký', 'Mọi thành viên', 56)}${catRow('Câu chuyện', 'Thành viên Premium', 12)}
  </div>
  <div class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; align-items: center; gap: 10px;"><span style="font-weight: 600; flex-grow: 1;">Bắt buộc chọn chuyên mục khi đăng</span>${toggle(true)}</div>
    <div style="display: flex; align-items: center; gap: 10px;"><span style="font-weight: 600; flex-grow: 1;">Duyệt bài của thành viên mới trong 7 ngày đầu</span>${toggle(false)}</div>
  </div>`);

// ---------- SettingsPayout.dc.html : Cài đặt · Thanh toán (nhận tiền) ----------
const payMethodRow = (name, desc, connected, on, logo) => `<div style="display: flex; align-items: center; gap: 14px; padding: 14px 0; border-top: 1px solid ${T.line};"><span style="width: 40px; height: 40px; border-radius: 10px; background: ${logo}; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; flex-shrink: 0; font-family: Montserrat, 'Segoe UI', Arial, sans-serif;">${name.slice(0, 2).toUpperCase()}</span><div style="flex-grow: 1;"><div style="display: flex; align-items: center; gap: 8px;"><span style="font-weight: 600;">${name}</span>${connected ? `<span class="tag" style="background: ${T.tealSoft}; color: #0B6F75;">${I.check(11)}Đã kết nối</span>` : `<span class="tag" style="background: ${T.bg}; color: ${T.ink3};">Chưa kết nối</span>`}</div><div class="muted" style="font-size: 13px;">${desc}</div></div>${connected ? toggle(on) : `<span class="btn btn-ghost btn-sm">Kết nối</span>`}</div>`;
const payoutMain = settingsPage('Thanh toán', `
  <div><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Thanh toán</h1><div class="muted" style="font-size: 13px;">Nhận tiền, cách khách trả và rút về tài khoản</div></div>
  <div class="card" style="padding: 20px 24px; display: flex; align-items: center; gap: 24px;">
    <div style="flex-grow: 1; display: flex; gap: 32px;">
      <div><div class="muted" style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;">Có thể rút</div><div class="serif" style="font-size: 28px; font-weight: 800;">12.430.000đ</div></div>
      <div><div class="muted" style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;">Đang giữ</div><div class="serif" style="font-size: 28px; font-weight: 800; color: ${T.ink2};">3.750.000đ</div><div class="muted" style="font-size: 12px;">giải phóng dần trong 14 ngày</div></div>
      <div><div class="muted" style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;">Đã rút tháng này</div><div class="serif" style="font-size: 28px; font-weight: 800; color: ${T.ink2};">8.000.000đ</div></div>
    </div>
    <span class="btn btn-primary">${I.wallet(18)}Rút tiền</span>
  </div>
  <div class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; align-items: center;"><span style="font-weight: 600;">Tài khoản nhận tiền</span><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">${I.plus(14)}Thêm tài khoản</span></div>
    <div style="display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: 12px; background: ${T.bg};"><span style="width: 44px; height: 30px; border-radius: 6px; background: #1B5E3B; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800;">VCB</span><div style="flex-grow: 1;"><div style="font-weight: 600;">Vietcombank · •••• 4521</div><div class="muted" style="font-size: 12px;">NGUYEN MINH QUY · Mặc định · Đã xác minh</div></div><span class="tag" style="background: ${T.tealSoft}; color: #0B6F75;">${I.shield(11)}Đã xác minh</span><span style="color: ${T.ink3};">${I.more(18)}</span></div>
    <div class="muted" style="font-size: 12px; display: flex; align-items: center; gap: 6px;">${I.clock(14)}Rút tiền được xử lý trong 1 ngày làm việc, tối thiểu 500.000đ, miễn phí</div>
  </div>
  <div class="card" style="padding: 20px 24px; display: flex; flex-direction: column;">
    <div style="padding-bottom: 6px;"><span style="font-weight: 600;">Cách khách thanh toán</span><div class="muted" style="font-size: 13px;">Khách tự chọn ở bước thanh toán, tiền về tài khoản Hội Mình rồi bạn rút</div></div>
    ${payMethodRow('Chuyển khoản QR', 'Khách quét mã, tự kích hoạt khi tiền về qua SePay', true, true, T.ink)}
    ${payMethodRow('MoMo', 'Ví điện tử, xác nhận tức thì', true, true, '#A50064')}
    ${payMethodRow('VNPAY', 'Thẻ nội địa, QR ngân hàng', true, false, '#0A5EB0')}
    ${payMethodRow('PayPal', 'Khách quốc tế trả bằng USD', false, false, '#003087')}
  </div>
  <div class="card" style="overflow: hidden;">
    <div style="display: flex; align-items: center; padding: 16px 20px;"><span style="font-weight: 600;">Lịch sử rút tiền</span><span style="flex-grow: 1;"></span><a href="#" style="font-size: 13px; font-weight: 600;">Xem tất cả</a></div>
    ${[['05/09/2026', '8.000.000đ', 'Vietcombank •••• 4521', 'Đã chuyển'], ['22/08/2026', '6.500.000đ', 'Vietcombank •••• 4521', 'Đã chuyển'], ['08/08/2026', '4.200.000đ', 'Vietcombank •••• 4521', 'Đã chuyển']].map(([d, a, acc, st]) => `<div style="display: grid; grid-template-columns: 1fr 1fr 1.6fr 1fr; gap: 12px; padding: 12px 20px; border-top: 1px solid ${T.line}; font-size: 13px;"><span>${d}</span><span style="font-weight: 600;">${a}</span><span class="muted">${acc}</span><span style="color: ${T.teal}; font-weight: 600;">${st}</span></div>`).join('')}
  </div>
  <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px; background: ${T.goldSoft}; color: #5C4A16; font-size: 13px;">${I.users(16)}<span style="flex-grow: 1;">Hoa hồng cộng sự không bị trừ ở đây. Bạn nhận đủ rồi tự chuyển cho cộng sự khi họ yêu cầu rút.</span><span data-go="s-affiliate-payouts" style="font-weight: 600; color: #8A6A1E; white-space: nowrap;">3 yêu cầu đang chờ</span></div>
  <div class="muted" style="font-size: 12px; display: flex; align-items: center; gap: 6px;">${I.shield(14)}Hội Mình không thu phí giao dịch. Thành viên trả bao nhiêu, bạn nhận đủ bấy nhiêu.</div>`);

// ---------- Revenue.dc.html : Doanh thu ----------
const txRow = (d, init, bg, name, item, method, amount, fee, comm, net, st, stColor) => `<div style="display: grid; grid-template-columns: 90px 1.6fr 1.6fr 1.1fr 1.1fr 1.1fr 1fr; gap: 12px; align-items: center; padding: 12px 20px; border-top: 1px solid ${T.line}; font-size: 13px;"><span class="muted">${d}</span><div style="display: flex; align-items: center; gap: 8px;">${avatar(init, bg, 26, 10)}<span style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</span></div><span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item}</span><span class="muted">${method}</span><span style="font-weight: 600;">${amount}</span><span style="color: #8A6A1E; font-weight: 600;">${comm}</span><span style="font-weight: 600; color: ${stColor};">${st}</span></div>`;
const revenueMain = `
<div style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
  <div style="display: flex; align-items: center; gap: 12px;">
    <h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Doanh thu</h1>
    <div style="display: flex; gap: 8px; margin-left: 12px;"><span class="chip">Hôm nay</span><span class="chip on">30 ngày</span><span class="chip">Quý</span><span class="chip">Tùy chọn</span></div>
    <span style="flex-grow: 1;"></span>
    <span class="btn btn-ghost btn-sm">${I.filter(14)}Lọc</span><span class="btn btn-ghost btn-sm">${I.download(14)}Xuất CSV</span>
  </div>
  <div style="display: flex; gap: 12px;">
    ${statCard('Tổng thu', '18.675.000đ', '75 giao dịch · không phí giao dịch')}
    ${statCard('Đã vào số dư', '18.426.000đ', 'sau 1 hoàn tiền', T.teal)}
    ${statCard('Nợ cộng sự', '3.865.000đ', 'bạn tự chuyển khoản · 31 giao dịch có giới thiệu', '#8A6A1E')}
    ${statCard('Hoàn tiền', '249.000đ', '1 giao dịch', T.ink3)}
  </div>
  <div class="card" style="overflow: hidden;">
    <div style="display: grid; grid-template-columns: 90px 1.6fr 1.6fr 1.1fr 1.1fr 1.1fr 1fr; gap: 12px; padding: 12px 20px;"><span class="th">Ngày</span><span class="th">Thành viên</span><span class="th">Sản phẩm</span><span class="th">Phương thức</span><span class="th">Số tiền</span><span class="th">Nợ cộng sự</span><span class="th">Trạng thái</span></div>
    ${txRow('14/09', 'ĐN', T.teal, 'Điền Phạm Ngọc', 'Premium · tháng', 'Chuyển khoản', '249.000đ', '12.450đ', '124.500đ', '236.550đ', 'Thành công', T.teal)}
    ${txRow('14/09', 'TL', '#5C3E7A', 'Thu Lan', 'Combo 9 khóa học', 'MoMo', '5.000.000đ', '300.000đ', '0đ', '4.700.000đ', 'Thành công', T.teal)}
    ${txRow('13/09', 'HK', '#7A5C3E', 'Hồng Kim', 'Premium · năm', 'VNPAY', '2.490.000đ', '174.300đ', '1.245.000đ', '2.315.700đ', 'Thành công', T.teal)}
    ${txRow('13/09', 'KB', '#5C7A3E', 'Kiên Bùi', 'Funnel Money Model 2026', 'Chuyển khoản', '1.000.000đ', '50.000đ', '500.000đ', '950.000đ', 'Đang chờ', '#8A6A1E')}
    ${txRow('12/09', 'DN', '#3E5C7A', 'Duy Nguyễn', 'Premium · tháng', 'MoMo', '249.000đ', '17.430đ', '0đ', '231.570đ', 'Thành công', T.teal)}
    ${txRow('11/09', 'CT', '#7A5C3E', 'Công Trần', 'Premium · tháng', 'Chuyển khoản', '249.000đ', '12.450đ', 'đảo 124.500đ', '-', 'Hoàn tiền', '#9C3A21')}
    ${txRow('10/09', 'HV', T.accent, 'Hoàng Vũ', '120 prompt viết bài bán hàng', 'PayPal', '199.000đ', '17.910đ', '0đ', '181.090đ', 'Thành công', T.teal)}
  </div>
</div>`;

// ---------- AccountBilling.dc.html : Tài khoản · Gói và thanh toán (thành viên) ----------
const accountNav = (active) => {
  const items = [['Cộng đồng của tôi', 'ws-home'], ['Hồ sơ', 'profile-edit'], ['Cộng sự', 'my-affiliate'], ['Tài khoản', ''], ['Thông báo', 'notifications'], ['Tin nhắn', 'messages'], ['Gói và thanh toán', 'account'], ['Giao diện', '']];
  return `<div style="width: 220px; display: flex; flex-direction: column; gap: 2px; flex-shrink: 0;">${items.map(([t, go]) => `<div data-go="${go}" style="padding: 10px 14px; border-radius: 10px;${t === active ? ` background: ${T.goldSoft}; font-weight: 600;` : ` color: ${T.ink2};`}">${t}</div>`).join('')}</div>`;
};
const subRow = (mark, markBg, comm, plan, price, next, method, actions) => `<div style="display: flex; align-items: center; gap: 16px; padding: 16px 0; border-top: 1px solid ${T.line};"><div style="width: 44px; height: 44px; border-radius: 12px; background: ${markBg}; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; flex-shrink: 0;">${mark}</div><div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px;"><div style="display: flex; align-items: center; gap: 8px;"><span style="font-weight: 600;">${comm}</span><span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E;">${plan}</span></div><div class="muted" style="font-size: 13px;">${price} · gia hạn ${next} · ${method}</div></div>${actions}</div>`;
const accountBillingMain = `
<div style="display: flex; gap: 32px; height: 100%;">
  ${accountNav('Gói và thanh toán')}
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 20px; max-width: 880px;">
    <div><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Gói và thanh toán</h1><div class="muted" style="font-size: 13px;">Các gói bạn đang trả, cách trả và hóa đơn</div></div>
    <div class="card" style="padding: 20px 24px; display: flex; flex-direction: column;">
      <span style="font-weight: 600; padding-bottom: 8px;">Gói đang dùng</span>
      ${subRow('KD', T.accent, 'Kinh Doanh Online Cùng AI', 'Premium', '249.000đ/tháng', '13/10/2026', 'chuyển khoản QR', `<span class="btn btn-ghost btn-sm">Đổi sang năm · tiết kiệm 17%</span><span class="btn btn-ghost btn-sm" style="color: #9C3A21;">Hủy gia hạn</span>`)}
      ${subRow('YT', T.teal, 'Faceless YouTube Foundation', 'Premium', '199.000đ/tháng', '20/09/2026', 'MoMo tự động', `<span class="btn btn-ghost btn-sm">Quản lý</span>`)}
      ${subRow('QT', '#7A5C3E', 'Quản trị cảm xúc', 'Trọn đời', 'Đã trả 990.000đ', 'không cần', 'VNPAY', `<span class="btn btn-ghost btn-sm">Hóa đơn</span>`)}
    </div>
    <div class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; align-items: center;"><span style="font-weight: 600;">Phương thức thanh toán</span><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">${I.plus(14)}Thêm</span></div>
      <div style="display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: 12px; background: ${T.bg};"><span style="width: 44px; height: 30px; border-radius: 6px; background: #A50064; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800;">MoMo</span><div style="flex-grow: 1;"><div style="font-weight: 600;">MoMo · 09•• ••• 431</div><div class="muted" style="font-size: 12px;">Tự động gia hạn · Mặc định</div></div><span style="color: ${T.ink3};">${I.more(18)}</span></div>
      <div style="display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: 12px; background: ${T.bg};"><span style="width: 44px; height: 30px; border-radius: 6px; background: #003087; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800;">PayPal</span><div style="flex-grow: 1;"><div style="font-weight: 600;">PayPal · m•••@gmail.com</div><div class="muted" style="font-size: 12px;">Dùng cho cộng đồng quốc tế</div></div><span style="color: ${T.ink3};">${I.more(18)}</span></div>
      <div class="muted" style="font-size: 12px; display: flex; align-items: center; gap: 6px;">${I.qr(14)}Chuyển khoản QR không cần lưu, mỗi kỳ bạn sẽ nhận nhắc thanh toán trước 3 ngày</div>
    </div>
    <div class="card" style="overflow: hidden;">
      <div style="display: flex; align-items: center; padding: 16px 20px;"><span style="font-weight: 600;">Lịch sử thanh toán</span><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">${I.download(14)}Tải tất cả hóa đơn</span></div>
      <div style="display: grid; grid-template-columns: 1fr 2fr 1.2fr 1fr 1fr 40px; gap: 12px; padding: 0 20px 8px;"><span class="th">Ngày</span><span class="th">Nội dung</span><span class="th">Phương thức</span><span class="th">Số tiền</span><span class="th">Trạng thái</span><span></span></div>
      ${[['13/09/2026', 'Premium · Kinh Doanh Online Cùng AI · tháng', 'Chuyển khoản', '249.000đ', 'Thành công', T.teal], ['20/08/2026', 'Premium · Faceless YouTube Foundation · tháng', 'MoMo', '199.000đ', 'Thành công', T.teal], ['02/08/2026', 'Quản trị cảm xúc · trọn đời', 'VNPAY', '990.000đ', 'Thành công', T.teal], ['20/07/2026', 'Premium · Faceless YouTube Foundation · tháng', 'MoMo', '199.000đ', 'Hoàn tiền', '#9C3A21']].map(([d, c, m, a, s, col]) => `<div style="display: grid; grid-template-columns: 1fr 2fr 1.2fr 1fr 1fr 40px; gap: 12px; align-items: center; padding: 12px 20px; border-top: 1px solid ${T.line}; font-size: 13px;"><span class="muted">${d}</span><span>${c}</span><span class="muted">${m}</span><span style="font-weight: 600;">${a}</span><span style="font-weight: 600; color: ${col};">${s}</span><span style="color: ${T.ink3};">${I.file(16)}</span></div>`).join('')}
    </div>
  </div>
</div>`;

// ---------- Checkout.dc.html : Trang thanh toán (thành viên) ----------
const payOption = (name, desc, on, logo, logoBg) => `<div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; border: 1.5px solid ${on ? T.accent : T.line2}; background: ${on ? T.accentSoft : T.surface};">${radio(on)}<span style="width: 36px; height: 26px; border-radius: 6px; background: ${logoBg}; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; font-family: Montserrat, 'Segoe UI', Arial, sans-serif;">${logo}</span><div style="flex-grow: 1;"><div style="font-weight: 600; font-size: 14px;">${name}</div><div class="muted" style="font-size: 12px;">${desc}</div></div></div>`;
const checkoutBody = `
<div style="width: 1440px; height: 960px; overflow: hidden; background: ${T.bg}; display: flex; flex-direction: column;" data-checkout>
  <header style="height: 64px; display: flex; align-items: center; gap: 16px; padding: 0 64px; border-bottom: 1px solid ${T.line}; background: ${T.surface};">
    <div style="display: flex; align-items: center; gap: 8px; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 20px;"><svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="9" cy="13" r="7" fill="${T.accent}"></circle><circle cx="17" cy="13" r="7" fill="${T.teal}" fill-opacity="0.85"></circle></svg>Hội Mình</div>
    <span style="flex-grow: 1;"></span>
    <span class="muted" style="font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">${I.shield(16)}Thanh toán được bảo vệ · hủy bất cứ lúc nào</span>
  </header>
  <div style="flex-grow: 1; display: flex; justify-content: center; gap: 32px; padding: 40px 64px;">
    <div style="width: 520px; display: flex; flex-direction: column; gap: 16px;">
      <span data-go="feed" style="display: inline-flex; align-items: center; gap: 6px; color: ${T.ink3}; font-size: 13px;">${I.back(16)}Quay lại cộng đồng</span>
      <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; gap: 14px; align-items: center;"><div style="width: 56px; height: 56px; border-radius: 14px; background: ${T.accent}; color: #FFFDF9; display: flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 20px;">KD</div><div><div class="muted" style="font-size: 12px;">Nâng cấp tại Kinh Doanh Online Cùng AI</div><div class="serif" style="font-size: 22px; font-weight: 800;">Gói Premium</div></div></div>
        <div style="display: flex; gap: 10px;">
          <div style="flex: 1 1 0; padding: 14px; border-radius: 12px; border: 1.5px solid ${T.line2};"><div style="display: flex; align-items: center; gap: 8px;">${radio(false)}<span style="font-weight: 600;">Theo tháng</span></div><div style="padding-left: 26px; font-size: 13px; color: ${T.ink2};">249.000đ / tháng</div></div>
          <div style="flex: 1 1 0; padding: 14px; border-radius: 12px; border: 1.5px solid ${T.accent}; background: ${T.accentSoft}; position: relative;"><span class="tag" style="position: absolute; top: -10px; right: 12px; background: ${T.ink}; color: #FFFDF9;">Tiết kiệm 17%</span><div style="display: flex; align-items: center; gap: 8px;">${radio(true)}<span style="font-weight: 600;">Theo năm</span></div><div style="padding-left: 26px; font-size: 13px; color: ${T.ink2};">2.490.000đ / năm · 207.500đ mỗi tháng</div></div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: ${T.ink2}; padding-top: 4px;">
          ${['Mở khóa toàn bộ khóa học và tài nguyên', 'Trở thành cộng sự, hoa hồng 50%', 'Q&amp;A trực tiếp hằng tuần', 'Hủy bất cứ lúc nào, giữ quyền đến hết kỳ'].map((b) => `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: ${T.teal};">${I.check(14)}</span>${b}</div>`).join('')}
        </div>
        <div style="display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid ${T.line};"><div class="input" style="flex-grow: 1; height: 40px;"><span>Mã giảm giá</span></div><span class="btn btn-ghost">Áp dụng</span></div>
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 14px; padding-top: 8px; border-top: 1px solid ${T.line};">
          <div style="display: flex;"><span style="flex-grow: 1; color: ${T.ink2};">Premium · 12 tháng</span><span>2.490.000đ</span></div>
          <div style="display: flex;"><span style="flex-grow: 1; color: ${T.ink2};">Giảm giá</span><span>0đ</span></div>
          <div style="display: flex; align-items: baseline; padding-top: 6px;"><span style="flex-grow: 1; font-weight: 700;">Tổng thanh toán</span><span class="serif" style="font-size: 24px; font-weight: 800;">2.490.000đ</span></div>
        </div>
        <div class="muted" style="font-size: 12px; display: flex; align-items: center; gap: 6px;">${I.users(14)}Bạn được giới thiệu bởi Hoàng Vũ</div>
      </div>
    </div>
    <div style="width: 520px; display: flex; flex-direction: column; gap: 12px; padding-top: 36px;">
      <span style="font-weight: 600;">Chọn cách thanh toán</span>
      ${payOption('Chuyển khoản QR', 'Quét bằng app ngân hàng, kích hoạt tự động dưới 1 phút', true, 'QR', T.ink)}
      <div class="card" style="padding: 20px; display: flex; gap: 20px; align-items: center;">
        <div style="width: 160px; height: 160px; border-radius: 12px; background: ${T.surface}; border: 1px solid ${T.line2}; display: flex; align-items: center; justify-content: center; color: ${T.ink};">${I.qr(96)}</div>
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
          <div><div class="muted" style="font-size: 12px;">Ngân hàng</div><div style="font-weight: 600;">Vietcombank · Hội Mình JSC</div></div>
          <div><div class="muted" style="font-size: 12px;">Số tài khoản</div><div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">0071 000 123 456 <span style="color: ${T.ink3};">${I.copy(14)}</span></div></div>
          <div><div class="muted" style="font-size: 12px;">Nội dung chuyển khoản</div><div style="font-weight: 700; color: ${T.accent}; display: flex; align-items: center; gap: 6px;">HM 8K2QX <span style="color: ${T.ink3};">${I.copy(14)}</span></div></div>
          <div class="muted" style="font-size: 12px;">Giữ đúng nội dung để hệ thống nhận diện</div>
        </div>
      </div>
      ${payOption('MoMo', 'Xác nhận ngay trong ví, có thể bật tự gia hạn', false, 'MoMo', '#A50064')}
      ${payOption('VNPAY', 'Thẻ nội địa hoặc QR ngân hàng', false, 'VNPAY', '#0A5EB0')}
      ${payOption('PayPal', 'Thanh toán bằng USD cho khách quốc tế', false, 'PayPal', '#003087')}
      <span class="btn btn-primary" style="height: 48px; font-size: 15px; margin-top: 6px;">Tôi đã chuyển khoản</span>
      <div class="muted" style="font-size: 12px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;">${I.clock(14)}Đang chờ tiền về… trang sẽ tự chuyển khi nhận được</div>
    </div>
  </div>
</div>`;

// ================= TẦNG CHỦ HỘI (workspace) =================
function wsShell({ active, main }) {
  const item = (key, label) => `<span data-go="${key}" style="padding: 8px 12px; border-radius: 8px; font-weight: 500; ${active === key ? `background: ${T.bg}; color: ${T.ink};` : `color: ${T.ink2};`}">${label}</span>`;
  return `
<div style="${DEMO ? 'width: 100%; min-height: 100vh;' : 'width: 1440px; height: 960px; overflow: hidden;'} background: ${T.bg}; display: flex; flex-direction: column;">
  <header style="height: 64px; display: flex; align-items: center; gap: 20px; padding: 0 64px; border-bottom: 1px solid ${T.line}; background: ${T.surface};">
    <div style="display: flex; align-items: center; gap: 8px; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 20px;"><svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="9" cy="13" r="7" fill="${T.accent}"></circle><circle cx="17" cy="13" r="7" fill="${T.teal}" fill-opacity="0.85"></circle></svg>Hội Mình</div>
    <nav style="display: flex; gap: 4px; margin-left: 12px;">${item('ws-home', 'Hội của tôi')}${item('discovery', 'Khám phá')}${item('account', 'Tài khoản')}</nav>
    <span style="flex-grow: 1;"></span>
    <div style="position: relative; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: ${T.ink2}; border: 1px solid ${T.line2}; background: ${T.surface};" data-go="notifications">${I.bell(20)}<span style="position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 999px; background: ${T.accent};"></span></div>
    <span data-go="account">${avatar('MQ', T.ink, 40, 14)}</span>
  </header>
  <div style="flex-grow: 1; padding: 40px 64px; display: flex; justify-content: center;"><div style="width: 1120px; display: flex; flex-direction: column; gap: 24px;">${main}</div></div>
</div>`;
}

const hoiCard = (mark, bg, name, slug, members, paid, revenue, mode, role = 'Chủ hội', draft = false) => `
<div class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;" data-go="feed">
  <div style="display: flex; align-items: center; gap: 12px;"><div style="width: 48px; height: 48px; border-radius: 14px; background: ${bg}; color: #FFFDF9; display: flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 17px;">${mark}</div><div style="flex-grow: 1; min-width: 0;"><div style="font-weight: 700; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div><div class="muted" style="font-size: 12px;">hoiminh.vn/${slug}</div></div>${draft ? `<span class="tag" style="background: ${T.bg}; color: ${T.ink3};">Nháp</span>` : `<span class="tag" style="background: ${T.tealSoft}; color: #0B6F75;">${mode}</span>`}</div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding-top: 12px; border-top: 1px solid ${T.line};">
    <div><div style="font-weight: 700; font-size: 18px;">${members}</div><div class="muted" style="font-size: 12px;">Thành viên</div></div>
    <div><div style="font-weight: 700; font-size: 18px;">${paid}</div><div class="muted" style="font-size: 12px;">Trả phí</div></div>
    <div><div style="font-weight: 700; font-size: 18px;">${revenue}</div><div class="muted" style="font-size: 12px;">30 ngày</div></div>
  </div>
  <div style="display: flex; align-items: center; gap: 8px;"><span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E;">${role}</span><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm" data-go="s-overview">Cài đặt</span><span class="btn btn-dark btn-sm">Vào hội</span></div>
</div>`;

const wsHomeMain = `
  <div style="display: flex; align-items: flex-end; gap: 16px;">
    <div><h1 class="serif" style="margin: 0; font-size: 32px; font-weight: 800;">Hội của tôi</h1><div class="muted">3 hội bạn làm chủ · 2 hội bạn tham gia</div></div>
    <span style="flex-grow: 1;"></span>
    <span class="btn btn-primary" data-go="ws-create">${I.plus(18)}Tạo hội của bạn</span>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px;">
    ${hoiCard('KD', T.accent, 'Kinh Doanh Online Cùng AI', 'minhquy', '234', '75', '18,7tr', 'Freemium')}
    ${hoiCard('AF', T.teal, 'Cộng sự MMO', 'cong-su-mmo', '58', '58', '6,2tr', 'Thu phí')}
    ${hoiCard('AI', '#7A5C3E', 'AI Agent cho chủ shop', 'ai-agent-shop', '0', '0', '0đ', '', 'Chủ hội', true)}
  </div>
  <div style="display: flex; gap: 20px;">
    <div class="card" style="flex: 1.4 1 0; padding: 20px 24px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; align-items: center;"><span style="font-weight: 600;">Hội bạn tham gia</span><span style="flex-grow: 1;"></span><span data-go="discovery" style="font-size: 13px; font-weight: 600; color: ${T.teal};">Khám phá thêm</span></div>
      ${[['YT', T.teal, 'Faceless YouTube Foundation', 'Premium · gia hạn 20/09', 'Thành viên'], ['QT', '#7A5C3E', 'Quản trị cảm xúc', 'Trọn đời', 'Thành viên']].map(([m, bg, n, s, r]) => `<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid ${T.line};" data-go="feed"><div style="width: 36px; height: 36px; border-radius: 10px; background: ${bg}; color: #FFFDF9; display: flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 13px;">${m}</div><div style="flex-grow: 1;"><div style="font-weight: 600;">${n}</div><div class="muted" style="font-size: 12px;">${s}</div></div><span class="tag" style="background: ${T.bg}; color: ${T.ink2};">${r}</span></div>`).join('')}
    </div>
    <div class="card" style="flex: 1 1 0; padding: 20px 24px; background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink}; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 8px; color: ${T.gold}; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;">${I.spark(16)}Gói nền tảng của bạn</div>
      <div class="serif" style="font-size: 22px; font-weight: 800;">Hội Mình · gói tháng</div>
      <div style="font-size: 13px; color: ${T.sideText};">499.000đ/tháng · gia hạn 01/10/2026 · đầy đủ tính năng, không phí giao dịch</div>
      <div style="font-size: 13px; color: ${T.sideText};">3 hội · 292 thành viên · không giới hạn</div>
      <div style="display: flex; gap: 8px; padding-top: 4px;"><span class="btn btn-ghost btn-sm" style="background: transparent; color: #FFFDF9; border-color: rgba(255,253,249,0.3);">Quản lý gói</span><span class="btn btn-primary btn-sm" data-go="signup-plan">Đổi sang gói năm · 2 tháng miễn phí</span></div>
    </div>
  </div>
  <div class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; align-items: center;"><span style="font-weight: 600;">Đội ngũ</span><span class="muted" style="font-size: 13px; margin-left: 8px;">dùng chung cho mọi hội của bạn</span><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">${I.userplus(14)}Mời người quản trị</span></div>
    <div style="display: flex; gap: 12px;">
      ${[['MQ', T.ink, 'Minh Quý', 'Chủ sở hữu'], ['HV', T.accent, 'Hoàng Vũ', 'Quản trị · Kinh Doanh Online'], ['HK', '#7A5C3E', 'Hồng Kim', 'Điều hành · 2 hội']].map(([i, bg, n, r]) => `<div style="flex: 1 1 0; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: ${T.bg};">${avatar(i, bg, 32, 12)}<div><div style="font-weight: 600; font-size: 13px;">${n}</div><div class="muted" style="font-size: 12px;">${r}</div></div></div>`).join('')}
    </div>
  </div>`;

const wsCreateMain = `
  <div style="display: flex; flex-direction: column; align-items: center; gap: 24px;">
    <div style="text-align: center; display: flex; flex-direction: column; gap: 6px;"><h1 class="serif" style="margin: 0; font-size: 32px; font-weight: 800;">Tạo hội của bạn</h1><div class="muted">Sáu bước, xong trong 2 phút. Mọi thứ đổi được sau.</div></div>
    <div style="display: flex; gap: 8px;">${['Tên', 'Đường dẫn', 'Mô tả', 'Kiểu thu phí', 'Mẫu', 'Xong'].map((s, i) => `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: ${i < 3 ? T.ink : T.ink3};"><span style="width: 22px; height: 22px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; ${i < 3 ? `background: ${T.ink}; color: #FFFDF9;` : `border: 1.5px solid ${T.line2};`}">${i < 3 ? (i === 2 ? '3' : I.check(12)) : i + 1}</span>${s}</span>`).join(`<span style="width: 24px; height: 1px; background: ${T.line2}; align-self: center;"></span>`)}</div>
    <div class="card" style="width: 720px; padding: 32px; display: flex; flex-direction: column; gap: 20px;">
      ${field('Tên hội', inputBox('AI Agent cho chủ shop'))}
      ${field('Đường dẫn', `<div class="input" style="color: ${T.ink};"><span class="muted">hoiminh.vn/</span><span style="flex-grow: 1;">ai-agent-shop</span><span style="color: ${T.teal};">${I.check(16)}</span></div>`, 'Có thể trỏ tên miền riêng sau trong Cài đặt')}
      ${field('Hội này dành cho ai, giúp họ đạt gì?', `<div class="input" style="height: 88px; align-items: flex-start; padding-top: 10px; color: ${T.ink};"><span>Chủ shop nhỏ muốn dựng trợ lý AI trả lời khách, chốt đơn và chăm sóc sau bán mà không cần thuê thêm người.</span></div>`, 'Hiện trên trang Khám phá và trang giới thiệu hội')}
      ${field('Kiểu thu phí', `<div style="display: flex; gap: 10px;">${[['Miễn phí', 'Ai cũng vào', false], ['Freemium', 'Vào miễn phí, có gói nâng cấp', true], ['Thu phí', 'Trả mới vào được', false], ['Trả một lần', 'Trọn đời', false]].map(([t, s, on]) => `<div style="flex: 1 1 0; padding: 12px 14px; border-radius: 12px; border: 1.5px solid ${on ? T.accent : T.line2}; background: ${on ? T.accentSoft : T.surface}; display: flex; flex-direction: column; gap: 2px;"><div style="display: flex; align-items: center; gap: 8px;">${radio(on)}<span style="font-weight: 600; font-size: 13px;">${t}</span></div><span class="muted" style="font-size: 12px; padding-left: 26px;">${s}</span></div>`).join('')}</div>`, 'Chọn Freemium nếu chưa chắc, đổi được bất cứ lúc nào')}
      <div style="display: flex; align-items: center; gap: 12px; padding-top: 8px; border-top: 1px solid ${T.line};"><span class="btn btn-ghost">${I.back(16)}Quay lại</span><span style="flex-grow: 1;"></span><span class="muted" style="font-size: 13px;">Gói Hội Mình: không giới hạn số hội</span><span class="btn btn-primary" data-go="ws-home">Tiếp tục ${I.right(16)}</span></div>
    </div>
  </div>`;

// ================= THÀNH VIÊN MIỄN PHÍ =================
const classroomFreeMain = `
<div style="display: flex; flex-direction: column; gap: 20px; height: 100%;">
  <div style="display: flex; align-items: center; gap: 16px;">
    <span data-go="courses" style="display: inline-flex; align-items: center; gap: 6px; color: ${T.ink3}; font-size: 13px;">${I.back(16)}Khóa học</span>
    <span style="color: ${T.line2};">/</span>
    <span class="serif" style="font-size: 22px; font-weight: 800;" data-go="course">Funnel Money Model 2026</span>
    <span class="tag" style="background: ${T.bg}; color: ${T.ink2};">Bạn đang ở gói Tiêu chuẩn</span>
    <span style="flex-grow: 1;"></span>
    <div style="display: flex; align-items: center; gap: 12px; width: 300px;"><span class="muted" style="font-size: 13px; white-space: nowrap;">5/5 bài miễn phí · xong</span><div class="prog" style="flex-grow: 1;"><div style="width: 100%;"></div></div></div>
  </div>
  <div style="display: flex; gap: 24px; flex-grow: 1; min-height: 0;">
    <div class="card" style="width: 360px; padding: 8px; overflow: hidden; display: flex; flex-direction: column;">
      ${moduleHead('1. Tư duy mô hình tiền', '5 bài · hoàn thành', true)}
      <div style="display: flex; flex-direction: column; gap: 2px; padding: 0 4px;">
        ${lessonRow('1.1 Tiền chảy theo mô hình, không theo may mắn', 'done', '08:10')}
        ${lessonRow('1.2 Ba con số quyết định lãi', 'done', '10:22')}
        ${lessonRow('1.3 Điểm hòa vốn sớm là gì', 'done', '07:45')}
        ${lessonRow('1.4 Ví dụ: shop 1 người thu 30 triệu', 'done', '12:05')}
        ${lessonRow('1.5 Bài tập: vẽ dòng tiền của bạn', 'done', 'Bài tập')}
      </div>
      <div style="margin: 8px 4px 0; padding: 12px 14px; border-radius: 12px; background: ${T.goldSoft}; display: flex; align-items: center; gap: 10px; font-size: 13px; color: #8A6A1E; font-weight: 600;">${I.lock(16)}21 bài còn lại dành cho Premium</div>
      ${moduleHead('2. Thiết kế Offer', '6 bài', false)}
      <div style="display: flex; flex-direction: column; gap: 2px; padding: 0 4px;">${lessonRow('2.1 Khách hàng thực sự mua gì', 'lock', 'Premium')}${lessonRow('2.2 Ba lớp giá trị của một offer', 'lock', 'Premium')}</div>
      ${moduleHead('3. Lead magnet và Tripwire', '7 bài', false)}
      ${moduleHead('4. Scale bằng cộng sự affiliate', '8 bài', false)}
    </div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 16px; min-width: 0;">
      <div style="position: relative; aspect-ratio: 16 / 9; border-radius: 16px; background: #171310; overflow: hidden; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: 0; background: rgba(23,19,16,0.55); backdrop-filter: blur(6px);"></div>
        <div style="position: relative; width: 460px; padding: 28px; border-radius: 16px; background: ${T.surface}; display: flex; flex-direction: column; gap: 12px; text-align: center; align-items: center;">
          <span style="width: 48px; height: 48px; border-radius: 999px; background: ${T.goldSoft}; color: #8A6A1E; display: inline-flex; align-items: center; justify-content: center;">${I.lock(22)}</span>
          <div class="serif" style="font-size: 20px; font-weight: 800; line-height: 1.3;">Bài này nằm trong gói Premium</div>
          <div style="font-size: 14px; color: ${T.ink2};">Mở khóa 21 bài còn lại, tài nguyên, Q&amp;A hằng tuần và quyền làm cộng sự với hoa hồng 50%.</div>
          <div style="display: flex; gap: 8px; padding-top: 4px;"><span class="btn btn-primary" data-go="checkout">Nâng cấp · 249.000đ/tháng</span><span class="btn btn-ghost">Xem quyền lợi</span></div>
          <span class="muted" style="font-size: 12px;">Hủy bất cứ lúc nào · thanh toán bằng chuyển khoản, MoMo, VNPAY</span>
        </div>
      </div>
      <div style="display: flex; align-items: flex-start; gap: 16px;">
        <div style="flex-grow: 1;"><h1 class="serif" style="margin: 0 0 6px; font-size: 24px; font-weight: 800; color: ${T.ink3};">2.1 Khách hàng thực sự mua gì</h1><p style="margin: 0; color: ${T.ink3}; font-size: 14px; max-width: 620px;">Nội dung xem trước: khách không mua sản phẩm, họ mua khoảng cách giữa hiện tại và kết quả họ muốn. Bài này chỉ cách đo khoảng cách đó bằng 3 câu hỏi.</p></div>
      </div>
      <div class="card" style="padding: 16px 20px; display: flex; align-items: center; gap: 14px;">
        ${avatar('MQ', T.ink, 36, 13)}
        <div style="flex-grow: 1; font-size: 13px; color: ${T.ink2};"><strong style="color: ${T.ink};">Minh Quý</strong> · Bạn đã học xong 5 bài miễn phí. Có câu hỏi gì về module 1 thì đăng ở Hỏi đáp, mình trả lời trong 24 giờ.</div>
        <span class="btn btn-ghost btn-sm" data-go="feed">Đến Hỏi đáp</span>
      </div>
    </div>
  </div>
</div>`;

// ================= QUẢN TRỊ HỆ THỐNG (super admin) =================
function saShell({ active, main }) {
  const nav = (key, icon, label, extra = '') => `<div class="nav-item${active === key ? ' on' : ''}" data-go="${key}" style="display: flex; align-items: center; gap: 10px;">${icon}<span style="flex-grow: 1;">${label}</span>${extra}</div>`;
  return `
<div style="${DEMO ? 'width: 100%; min-height: 100vh;' : 'width: 1440px; height: 960px;'} display: flex; background: ${T.bg}; overflow: ${DEMO ? 'visible' : 'hidden'};">
  <aside style="width: 264px; ${DEMO ? 'height: 100vh; position: sticky; top: 0;' : 'height: 960px;'} background: #14110E; color: ${T.sideText}; display: flex; flex-direction: column; padding: 16px 12px; flex-shrink: 0;">
    <div style="display: flex; align-items: center; gap: 10px; padding: 6px 8px 14px; border-bottom: 1px solid rgba(255,253,249,0.08);">
      <svg width="36" height="36" viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="9" cy="13" r="7" fill="${T.accent}"></circle><circle cx="17" cy="13" r="7" fill="${T.teal}" fill-opacity="0.85"></circle></svg>
      <div style="flex-grow: 1;"><div style="color: #FFFDF9; font-weight: 700; font-size: 14px; font-family: Montserrat, 'Segoe UI', Arial, sans-serif;">Hội Mình</div><div style="font-size: 11px; color: ${T.gold}; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;">Quản trị hệ thống</div></div>
    </div>
    <div class="nav-group">Vận hành</div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      ${nav('sa-overview', I.home(20), 'Tổng quan')}
      ${nav('sa-communities', I.users(20), 'Hội')}
      ${nav('sa-users', I.user(20), 'Người dùng')}
      ${nav('sa-payments', I.wallet(20), 'Thanh toán', `<span style="font-size: 11px; font-weight: 600; background: ${T.accent}; color: #FFFDF9; border-radius: 999px; padding: 1px 7px;">3</span>`)}
    </div>
    <div class="nav-group">Cấu hình</div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      ${nav('sa-plans', I.badge(20), 'Gói nền tảng')}
      ${nav('sa-affiliate', I.trophy(20), 'Cộng sự nền tảng')}
      ${nav('sa-flags', I.settings(20), 'Tính năng và giới hạn')}
    </div>
    <div class="nav-group">Giám sát</div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      ${nav('sa-logs', I.file(20), 'Nhật ký và webhook')}
      ${nav('sa-support', I.chat(20), 'Hỗ trợ và khiếu nại')}
    </div>
    <div style="flex-grow: 1;"></div>
    <div style="padding: 12px; border-radius: 10px; background: rgba(255,253,249,0.06); font-size: 12px; color: ${T.sideText}; display: flex; align-items: center; gap: 8px;"><span style="width: 8px; height: 8px; border-radius: 999px; background: ${T.teal};"></span>Hệ thống ổn định · 99,98% tháng này</div>
  </aside>
  <div style="flex-grow: 1; display: flex; flex-direction: column; min-width: 0;">
    <header style="height: 64px; display: flex; align-items: center; gap: 16px; padding: 0 32px; border-bottom: 1px solid ${T.line}; background: ${T.surface};">
      <div class="input" style="width: 420px;">${I.search(18)}<span>Tìm hội, người dùng, giao dịch, email…</span></div>
      <span style="flex-grow: 1;"></span>
      <span class="tag" style="background: ${T.accentSoft}; color: #9C3A21;">Môi trường: Production</span>
      <span data-go="ws-home" class="btn btn-ghost btn-sm">Về Hội của tôi</span>
      ${avatar('MQ', T.ink, 40, 14)}
    </header>
    <div style="flex-grow: 1; overflow: ${DEMO ? 'visible' : 'hidden'}; padding: 28px 32px;">${main}</div>
  </div>
</div>`;
}

const saBars = [30, 34, 31, 40, 44, 42, 50, 48, 55, 61, 58, 63, 70, 66, 72, 78, 74, 80, 85, 82, 88, 91, 86, 94, 90, 96, 93, 98, 95, 100];
const saOverviewMain = `
<div style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
  <div style="display: flex; align-items: center; gap: 12px;"><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Tổng quan hệ thống</h1><span style="flex-grow: 1;"></span><div style="display: flex; gap: 8px;"><span class="chip">Hôm nay</span><span class="chip on">30 ngày</span><span class="chip">Quý</span></div></div>
  <div style="display: flex; gap: 12px;">
    ${statCard('Người dùng', '12.480', '+1.120 trong kỳ', T.teal)}
    ${statCard('Hội đang hoạt động', '318', '+27 hội mới', T.teal)}
    ${statCard('GMV qua nền tảng', '1,84 tỷ đ', 'tổng tiền thành viên đã trả')}
    ${statCard('Doanh thu Hội Mình', '122 triệu đ', 'từ gói tháng và năm · không phí giao dịch', T.teal)}
    ${statCard('Thanh toán lỗi', '17', '0,9% giao dịch · cần xem 3', '#9C3A21')}
  </div>
  <div style="display: flex; gap: 16px;">
    <div class="card" style="flex: 1.6 1 0; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; align-items: center;"><span style="font-weight: 600;">GMV theo ngày</span><span style="flex-grow: 1;"></span><span class="muted" style="font-size: 12px;">15/08 – 14/09</span></div>
      <div style="display: flex; align-items: flex-end; gap: 5px; height: 150px;">${saBars.map((h, i) => `<div style="flex: 1 1 0; height: ${h}%; border-radius: 4px 4px 0 0; background: ${i === saBars.length - 1 ? T.accent : T.teal}; opacity: ${i === saBars.length - 1 ? 1 : 0.55};"></div>`).join('')}</div>
      <div style="display: flex; gap: 16px; font-size: 12px;" class="muted"><span>Chuyển khoản QR 58%</span><span>MoMo 27%</span><span>VNPAY 11%</span><span>PayPal 4%</span></div>
    </div>
    <div class="card" style="flex: 1 1 0; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px;">
      <span style="font-weight: 600;">Cần xử lý</span>
      ${[[I.wallet(14), T.accentSoft, '#9C3A21', '3 giao dịch chuyển khoản chưa khớp nội dung', 'Đối soát', 'sa-payments'], [I.ext(14), T.accentSoft, '#9C3A21', 'Webhook MoMo thất bại 2 lần liên tiếp', 'Xem log', 'sa-logs'], [I.users(14), T.goldSoft, '#8A6A1E', '2 hội bị báo cáo nội dung', 'Xem', 'sa-support'], [I.badge(14), T.tealSoft, '#0B6F75', '5 hội sắp hết 14 ngày dùng thử', 'Nhắc thanh toán', 'sa-communities']].map(([ic, bg, fg, t, a, go]) => `<div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><span style="width: 28px; height: 28px; border-radius: 8px; background: ${bg}; color: ${fg}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${ic}</span><span style="flex-grow: 1;">${t}</span><span data-go="${go}" style="font-size: 12px; font-weight: 600; color: ${T.teal}; white-space: nowrap;">${a}</span></div>`).join('')}
    </div>
  </div>
  <div class="card" style="overflow: hidden;">
    <div style="display: flex; align-items: center; padding: 14px 20px;"><span style="font-weight: 600;">Hội mới trong 7 ngày</span><span style="flex-grow: 1;"></span><span data-go="sa-communities" style="font-size: 13px; font-weight: 600; color: ${T.teal};">Tất cả hội</span></div>
    ${[['NV', '#3E5C7A', 'Ngoại ngữ cùng Vy', 'Trần Thảo Vy', 'Dùng thử', '41', 'Freemium'], ['YG', '#5C7A3E', 'Yoga sáng 6 giờ', 'Lê Hạnh', 'Năm', '128', 'Thu phí'], ['SH', '#5C3E7A', 'Shopee 0 đồng', 'Phạm Đức', 'Dùng thử', '12', 'Miễn phí']].map(([m, bg, n, o, p, mem, mode]) => `<div style="display: grid; grid-template-columns: 2fr 1.4fr 0.8fr 0.8fr 1fr; gap: 12px; align-items: center; padding: 10px 20px; border-top: 1px solid ${T.line}; font-size: 13px;"><div style="display: flex; align-items: center; gap: 10px;"><div style="width: 32px; height: 32px; border-radius: 9px; background: ${bg}; color: #FFFDF9; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; font-family: Montserrat, 'Segoe UI', Arial, sans-serif;">${m}</div><span style="font-weight: 600;">${n}</span></div><span>${o}</span><span class="tag" style="background: ${p === 'Dùng thử' ? T.bg : T.goldSoft}; color: ${p === 'Dùng thử' ? T.ink2 : '#8A6A1E'}; width: fit-content;">${p}</span><span>${mem} thành viên</span><span class="muted">${mode}</span></div>`).join('')}
  </div>
</div>`;

const saCommRow = (m, bg, name, slug, owner, plan, members, rev, status, stColor) => `<div style="display: grid; grid-template-columns: 2.2fr 1.4fr 0.8fr 0.9fr 1.1fr 1fr 1.2fr; gap: 12px; align-items: center; padding: 12px 20px; border-top: 1px solid ${T.line}; font-size: 13px;"><div style="display: flex; align-items: center; gap: 10px;"><div style="width: 34px; height: 34px; border-radius: 9px; background: ${bg}; color: #FFFDF9; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; font-family: Montserrat, 'Segoe UI', Arial, sans-serif;">${m}</div><div><div style="font-weight: 600;">${name}</div><div class="muted" style="font-size: 12px;">hoiminh.vn/${slug}</div></div></div><span>${owner}</span><span class="tag" style="background: ${plan === 'Dùng thử' ? T.bg : T.goldSoft}; color: ${plan === 'Dùng thử' ? T.ink2 : '#8A6A1E'}; width: fit-content;">${plan}</span><span>${members}</span><span style="font-weight: 600;">${rev}</span><span style="font-weight: 600; color: ${stColor};">${status}</span><div style="display: flex; gap: 6px; justify-content: flex-end;"><span class="btn btn-ghost btn-sm" data-go="feed">Xem</span><span class="btn btn-ghost btn-sm">${I.more(14)}</span></div></div>`;
const saCommunitiesMain = `
<div style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
  <div style="display: flex; align-items: center; gap: 12px;">
    <h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Hội</h1>
    <div style="display: flex; gap: 8px; margin-left: 12px;"><span class="chip on">Hoạt động · 318</span><span class="chip">Nháp · 46</span><span class="chip">Lưu trữ · 22</span><span class="chip">Bị khóa · 3</span></div>
    <span style="flex-grow: 1;"></span>
    <span class="btn btn-ghost btn-sm">${I.filter(14)}Lọc</span><span class="btn btn-ghost btn-sm">${I.download(14)}Xuất CSV</span>
  </div>
  <div style="display: flex; gap: 8px;"><div class="input" style="width: 380px;">${I.search(18)}<span>Tìm theo tên hội, đường dẫn, chủ hội…</span></div><span class="chip">Gói nền tảng ${I.down(12)}</span><span class="chip">Kiểu thu phí ${I.down(12)}</span><span class="chip">Sắp xếp: doanh thu ${I.down(12)}</span></div>
  <div class="card" style="overflow: hidden;">
    <div style="display: grid; grid-template-columns: 2.2fr 1.4fr 0.8fr 0.9fr 1.1fr 1fr 1.2fr; gap: 12px; padding: 12px 20px;"><span class="th">Hội</span><span class="th">Chủ hội</span><span class="th">Gói</span><span class="th">Thành viên</span><span class="th">GMV 30 ngày</span><span class="th">Trạng thái</span><span></span></div>
    ${saCommRow('PL', '#7A5C3E', 'Cộng đồng Phạm Thành Long', 'phamthanhlong', 'Phạm Thành Long', 'Năm', '4.120', '312.000.000đ', 'Hoạt động', T.teal)}
    ${saCommRow('KD', T.accent, 'Kinh Doanh Online Cùng AI', 'minhquy', 'Minh Quý', 'Tháng', '234', '18.675.000đ', 'Hoạt động', T.teal)}
    ${saCommRow('YT', T.teal, 'Faceless YouTube Foundation', 'faceless-yt', 'Nguyễn Huân', 'Năm', '1.204', '96.400.000đ', 'Hoạt động', T.teal)}
    ${saCommRow('YG', '#5C7A3E', 'Yoga sáng 6 giờ', 'yoga-6h', 'Lê Hạnh', 'Năm', '128', '9.800.000đ', 'Hoạt động', T.teal)}
    ${saCommRow('NV', '#3E5C7A', 'Ngoại ngữ cùng Vy', 'ngoai-ngu-vy', 'Trần Thảo Vy', 'Dùng thử', '41', '0đ', 'Còn 3 ngày thử', '#8A6A1E')}
    ${saCommRow('SH', '#5C3E7A', 'Shopee 0 đồng', 'shopee-0d', 'Phạm Đức', 'Dùng thử', '12', '0đ', 'Bị báo cáo', '#9C3A21')}
    ${saCommRow('CR', T.ink3, 'Crypto x100', 'crypto-x100', 'Ẩn danh', 'Dùng thử', '380', '0đ', 'Đã khóa', '#9C3A21')}
  </div>
</div>`;

const providerRow = (name, logoBg, mode, health, on, webhook) => `<div style="display: flex; align-items: center; gap: 14px; padding: 14px 0; border-top: 1px solid ${T.line};"><span style="width: 44px; height: 30px; border-radius: 6px; background: ${logoBg}; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; font-family: Montserrat, 'Segoe UI', Arial, sans-serif;">${name.slice(0, 5)}</span><div style="flex-grow: 1;"><div style="display: flex; align-items: center; gap: 8px;"><span style="font-weight: 600;">${name}</span><span class="tag" style="background: ${mode === 'Production' ? T.tealSoft : T.goldSoft}; color: ${mode === 'Production' ? '#0B6F75' : '#8A6A1E'};">${mode}</span></div><div class="muted" style="font-size: 12px;">${webhook}</div></div><span style="font-size: 12px; font-weight: 600; color: ${health.startsWith('OK') ? T.teal : '#9C3A21'}; white-space: nowrap;">${health}</span><span class="btn btn-ghost btn-sm">Cấu hình</span>${toggle(on)}</div>`;
const reconRow = (d, ref, bank, amount, expected, st, stColor, action) => `<div style="display: grid; grid-template-columns: 90px 1.1fr 1.6fr 1fr 1fr 1.2fr 1fr; gap: 12px; align-items: center; padding: 12px 20px; border-top: 1px solid ${T.line}; font-size: 13px;"><span class="muted">${d}</span><span style="font-weight: 700; color: ${T.accent};">${ref}</span><span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bank}</span><span style="font-weight: 600;">${amount}</span><span class="muted">${expected}</span><span style="font-weight: 600; color: ${stColor};">${st}</span><span class="btn btn-ghost btn-sm" style="width: fit-content;">${action}</span></div>`;
const saPaymentsMain = `
<div style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
  <div style="display: flex; align-items: center; gap: 12px;"><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Thanh toán</h1><div style="display: flex; gap: 8px; margin-left: 12px;"><span class="chip on">Cổng và đối soát</span><span class="chip">Giao dịch</span><span class="chip">Hoàn tiền</span><span class="chip">Rút tiền của chủ hội</span></div><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">${I.download(14)}Báo cáo tháng</span></div>
  <div style="display: flex; gap: 16px;">
    <div class="card" style="flex: 1.2 1 0; padding: 18px 20px; display: flex; flex-direction: column;">
      <div style="padding-bottom: 6px;"><span style="font-weight: 600;">Cổng thanh toán</span><div class="muted" style="font-size: 13px;">Bật tắt toàn hệ thống, cấu hình khóa và webhook. Bí mật không hiện lại sau khi lưu.</div></div>
      ${providerRow('SePay', T.ink, 'Production', 'OK · 1.2s', true, 'Webhook nhận 2.310 giao dịch tháng này · lỗi 0')}
      ${providerRow('MoMo', '#A50064', 'Production', 'Lỗi · 2 lần', true, 'Webhook thất bại lúc 09:41 và 09:43 · đang retry')}
      ${providerRow('VNPAY', '#0A5EB0', 'Production', 'OK · 0.8s', true, 'IPN ổn định · chữ ký hợp lệ 100%')}
      ${providerRow('PayPal', '#003087', 'Sandbox', 'Chưa bật', false, 'Đang thử nghiệm · chưa nhận tiền thật')}
    </div>
    <div style="flex: 1 1 0; display: flex; flex-direction: column; gap: 12px;">
      ${statCard('Đối soát hôm nay', '2.084 / 2.087', '3 giao dịch chưa khớp', '#9C3A21')}
      ${statCard('Đang giữ cho chủ hội', '486 triệu đ', 'giải phóng theo hold 14 ngày')}
      ${statCard('Yêu cầu rút tiền chờ duyệt', '11', 'tổng 128 triệu đ · xử lý trong 1 ngày', '#8A6A1E')}
    </div>
  </div>
  <div class="card" style="overflow: hidden;">
    <div style="display: flex; align-items: center; padding: 14px 20px;"><span style="font-weight: 600;">Đối soát chuyển khoản</span><div style="display: flex; gap: 6px; margin-left: 12px;"><span class="chip" style="height: 26px; font-size: 12px;">Khớp · 2.084</span><span class="chip on" style="height: 26px; font-size: 12px;">Chưa khớp · 3</span><span class="chip" style="height: 26px; font-size: 12px;">Trùng · 0</span></div><span style="flex-grow: 1;"></span><span class="muted" style="font-size: 12px;">Nguồn: sao kê SePay, cập nhật 2 phút trước</span></div>
    <div style="display: grid; grid-template-columns: 90px 1.1fr 1.6fr 1fr 1fr 1.2fr 1fr; gap: 12px; padding: 0 20px 8px;"><span class="th">Giờ</span><span class="th">Mã tham chiếu</span><span class="th">Nội dung ngân hàng</span><span class="th">Nhận được</span><span class="th">Kỳ vọng</span><span class="th">Trạng thái</span><span></span></div>
    ${reconRow('09:12', 'HM 8K2QX', 'NGUYEN VAN A ck HM8K2Q', '249.000đ', '249.000đ', 'Sai nội dung', '#8A6A1E', 'Ghép thủ công')}
    ${reconRow('08:55', 'HM 7ZP3M', 'TRAN THI B chuyen tien', '2.490.000đ', '2.490.000đ', 'Thiếu mã', '#8A6A1E', 'Ghép thủ công')}
    ${reconRow('08:31', 'HM 5QW1D', 'LE C HM 5QW1D', '200.000đ', '249.000đ', 'Lệch số tiền', '#9C3A21', 'Liên hệ khách')}
    ${reconRow('08:20', 'HM 4TT9A', 'PHAM D HM 4TT9A', '249.000đ', '249.000đ', 'Đã khớp', T.teal, 'Chi tiết')}
  </div>
</div>`;

const planCol = (name, price, sub, rows, dark = false) => `<div class="card" style="flex: 1 1 0; padding: 22px; display: flex; flex-direction: column; gap: 14px;${dark ? ` background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink};` : ''}"><div><div style="font-weight: 700; font-size: 16px;">${name}</div><div class="serif" style="font-size: 26px; font-weight: 800; padding-top: 4px;">${price}</div><div style="font-size: 12px; color: ${dark ? T.sideText : T.ink3};">${sub}</div></div><div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: ${dark ? T.sideText : T.ink2}; padding-top: 10px; border-top: 1px solid ${dark ? 'rgba(255,253,249,0.15)' : T.line};">${rows.map(([k, v]) => `<div style="display: flex;"><span style="flex-grow: 1;">${k}</span><span style="font-weight: 600; color: ${dark ? '#FFFDF9' : T.ink};">${v}</span></div>`).join('')}</div><span class="btn btn-ghost btn-sm" style="${dark ? 'background: transparent; color: #FFFDF9; border-color: rgba(255,253,249,0.3);' : ''}">Sửa gói</span></div>`;
const saPlansMain = `
<div style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
  <div style="display: flex; align-items: center; gap: 12px;"><div><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Gói nền tảng</h1><div class="muted" style="font-size: 13px;">Hiện chỉ có một gói đầy đủ tính năng, trả theo tháng hoặc năm. Không thu phí giao dịch.</div></div><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">${I.plus(14)}Thêm gói</span></div>
  <div style="display: flex; gap: 16px;">
    <div class="card" style="flex: 1.3 1 0; padding: 24px; background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink}; display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; align-items: center; gap: 10px;"><span style="font-weight: 700; font-size: 18px;">Hội Mình</span><span class="tag" style="background: ${T.gold}; color: ${T.ink};">Gói duy nhất</span><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm" style="background: transparent; color: #FFFDF9; border-color: rgba(255,253,249,0.3);">Sửa gói</span></div>
      <div style="display: flex; gap: 12px;">
        <div style="flex: 1 1 0; padding: 14px 16px; border-radius: 12px; background: rgba(255,253,249,0.08);"><div style="font-size: 12px; color: ${T.sideText};">Theo tháng</div><div class="serif" style="font-size: 26px; font-weight: 800;">499.000đ</div><div style="font-size: 12px; color: ${T.sideText};">118 chủ hội · 58,9tr MRR</div></div>
        <div style="flex: 1 1 0; padding: 14px 16px; border-radius: 12px; background: rgba(255,253,249,0.08);"><div style="font-size: 12px; color: ${T.sideText};">Theo năm · 2 tháng miễn phí</div><div class="serif" style="font-size: 26px; font-weight: 800;">4.990.000đ</div><div style="font-size: 12px; color: ${T.sideText};">63 chủ hội · 26,2tr MRR quy đổi</div></div>
        <div style="flex: 1 1 0; padding: 14px 16px; border-radius: 12px; background: rgba(255,253,249,0.08);"><div style="font-size: 12px; color: ${T.sideText};">Dùng thử</div><div class="serif" style="font-size: 26px; font-weight: 800;">14 ngày</div><div style="font-size: 12px; color: ${T.sideText};">137 đang thử · 41% chuyển trả phí</div></div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 24px; font-size: 13px; color: ${T.sideText}; padding-top: 12px; border-top: 1px solid rgba(255,253,249,0.15);">
        ${['Không giới hạn hội, thành viên, khóa học, video, sự kiện', 'Không thu phí giao dịch', 'Cộng sự và bảng xếp hạng cộng sự', 'Cửa hàng bán khóa học, combo, tài liệu', 'Tên miền riêng', 'Tin nhắn chào tự động và tiện ích', 'Nhận tiền qua chuyển khoản QR, MoMo, VNPAY, PayPal', 'API, webhook và MCP'].map((f) => `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: ${T.teal};">${I.check(14)}</span>${f}</div>`).join('')}
      </div>
    </div>
    <div style="flex: 1 1 0; display: flex; flex-direction: column; gap: 12px;">
      <div style="flex-grow: 1; padding: 24px; border-radius: 16px; border: 1.5px dashed ${T.line2}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; color: ${T.ink3};">${I.plus(28)}<div style="font-weight: 600; color: ${T.ink2};">Gói thấp hơn</div><div style="font-size: 13px; max-width: 220px;">Bổ sung sau khi có nhu cầu. Kiến trúc đã sẵn giới hạn theo gói.</div></div>
    </div>
  </div>
  <div style="display: flex; gap: 16px;">
    <div class="card" style="flex: 1 1 0; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px;">
      <span style="font-weight: 600;">Chương trình cộng sự nền tảng</span>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><span style="flex-grow: 1;">Hoa hồng khi giới thiệu chủ hội mới</span><span class="chip" style="height: 28px; font-size: 12px;">40% · 12 tháng ${I.down(12)}</span></div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><span style="flex-grow: 1;">Hoa hồng khi giới thiệu thành viên vào hội</span><span class="muted" style="font-size: 12px;">do chủ hội tự đặt</span></div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><span style="flex-grow: 1;">Đã trả cho cộng sự nền tảng tháng này</span><span style="font-weight: 600;">18.400.000đ</span></div>
    </div>
    <div class="card" style="flex: 1 1 0; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px;">
      <span style="font-weight: 600;">Tính năng đang bật theo giai đoạn</span>
      ${[['Tin nhắn thời gian thực', 'Tắt · V2', false], ['Phát trực tiếp trong hội', 'Tắt · V2', false], ['Bảng xếp hạng cộng sự', 'Bật cho mọi hội', true], ['Cửa hàng trong hội', 'Bật cho mọi hội', true], ['MCP cho AI', 'Bật cho mọi hội', true]].map(([k, v, on]) => `<div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><span style="flex-grow: 1;">${k}</span><span class="muted" style="font-size: 12px;">${v}</span>${toggle(on)}</div>`).join('')}
    </div>
  </div>
</div>`;


// ================= AFFILIATE: chi trả thủ công (mô hình Tiền Nhà Mình) =================

// ---------- SettingsAffiliatePayouts.dc.html : Chủ hội duyệt rút ----------
const affiliatePayoutsMain = settingsPage('Cộng sự (Affiliate)', `
  <div style="display: flex; align-items: center; gap: 16px;"><div><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Yêu cầu rút của cộng sự</h1><div class="muted" style="font-size: 13px;">Bạn chuyển khoản, hệ thống ghi sổ</div></div><span style="flex-grow: 1;"></span>${affiliateTabs('s-affiliate-payouts')}</div>
  ${ledgerNotice('Bạn')}
  <div style="display: flex; gap: 12px;">
    ${walletBox('Chờ bạn chuyển', '2.620.000đ', '3 yêu cầu · xử lý trong 3 ngày làm việc', true)}
    ${walletBox('Đã trả tháng này', '5.790.000đ', '12 lần chuyển khoản')}
    ${walletBox('Đang giữ 14 ngày', '1.245.000đ', 'chưa được rút, chờ hết hạn hoàn tiền')}
    ${walletBox('Tổng nợ cộng sự', '3.865.000đ', 'chờ chuyển + có thể rút chưa yêu cầu')}
  </div>
  <div class="card" style="overflow: hidden;">
    <div style="display: grid; grid-template-columns: 2fr 1fr 1.4fr 1fr 1fr 110px; gap: 12px; padding: 12px 20px;"><span class="th">Cộng sự</span><span class="th">Số tiền</span><span class="th">Tài khoản nhận</span><span class="th">Gửi lúc</span><span class="th">Trạng thái</span><span></span></div>
    ${queueRow('HV', T.accent, 'Hoàng Vũ', 'hoangvu@gmail.com', '1.500.000đ', 'Vietcombank ••••8812', '14/09 09:20', 'requested')}
    ${queueRow('HK', '#7A5C3E', 'Hồng Kim', 'kimhong.hn@gmail.com', '620.000đ', 'Techcombank ••••3305', '13/09 21:04', 'reviewing', true)}
    ${reviewPanel({ name: 'Hồng Kim', amount: '620.000đ', email: 'kimhong.hn@gmail.com', holder: 'NGUYEN THI HONG KIM', bank: 'Techcombank', account: '19033305118011', ref: 'HM CS HK 0913' })}
    ${queueRow('ĐN', T.teal, 'Điền Phạm Ngọc', 'ngocdien1221@gmail.com', '500.000đ', 'MB Bank ••••0199', '12/09 18:45', 'requested')}
  </div>
  <div class="card" style="overflow: hidden;">
    <div style="display: flex; align-items: center; padding: 14px 20px;"><span style="font-weight: 600;">Đã xử lý gần đây</span><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">${I.download(14)}Xuất đối soát</span></div>
    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr; gap: 12px; padding: 0 20px 8px;"><span class="th">Cộng sự</span><span class="th">Số tiền</span><span class="th">Ngày</span><span class="th">Trạng thái</span><span class="th">Mã tham chiếu / lý do</span></div>
    ${historyRow('Hoàng Vũ', '2.000.000đ', '05/09', 'paid', 'FT26090512873')}
    ${historyRow('Kiên Bùi', '750.000đ', '03/09', 'paid', 'FT26090309112')}
    ${historyRow('Thu Lan', '500.000đ', '01/09', 'rejected', 'Sai tên chủ tài khoản, đã hoàn về ví')}
    ${historyRow('Duy Nguyễn', '600.000đ', '28/08', 'cancelled', 'Cộng sự tự hủy')}
  </div>`);

// ---------- AffiliateWallet.dc.html : Ví cộng sự của thành viên ----------
const commRow = (init, bg, name, plan, base, comm, status, unlock) => `<div style="display: grid; grid-template-columns: 2fr 1.2fr 1fr 1fr 1fr 1.2fr; gap: 12px; align-items: center; padding: 10px 20px; border-top: 1px solid ${T.line}; font-size: 13px;"><div style="display: flex; align-items: center; gap: 8px;">${avatar(init, bg, 26, 10)}<span style="font-weight: 500;">${name}</span></div><span class="muted">${plan}</span><span class="muted">${base}</span><span style="font-weight: 600;">${comm}</span>${statusTag(status)}<span class="muted">${unlock}</span></div>`;
const affiliateWalletMain = `
<div style="display: flex; gap: 32px; height: 100%;">
  ${accountNav('Cộng sự')}
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 20px; max-width: 880px;">
    <div><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Cộng sự</h1><div class="muted" style="font-size: 13px;">Giới thiệu một lần, nhận hoa hồng mỗi kỳ người đó trả phí. Kinh Doanh Online Cùng AI · hoa hồng 50%</div></div>
    <div class="card" style="padding: 18px 20px; display: flex; align-items: center; gap: 12px;">
      <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px;"><span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: ${T.accent};">Link của bạn</span><div class="input" style="color: ${T.ink};"><span style="flex-grow: 1;">hoiminh.vn/minhquy?ref=mq8k2</span>${I.copy(16)}</div></div>
      <div style="display: flex; gap: 20px; padding: 0 12px;">${[['128', 'Lượt bấm'], ['4', 'Đăng ký'], ['3', 'Trả phí']].map(([v, l]) => `<div style="text-align: center;"><div style="font-weight: 700; font-size: 18px;">${v}</div><div class="muted" style="font-size: 12px;">${l}</div></div>`).join('')}</div>
      <span class="btn btn-dark">Sao chép</span>
    </div>
    <div style="display: flex; gap: 12px;">
      ${walletBox('Đang giữ', '373.500đ', 'chờ hết 14 ngày đối soát')}
      ${walletBox('Có thể rút', '1.120.500đ', 'đã trừ phần đang chờ duyệt', true)}
      ${walletBox('Đang chờ duyệt', '500.000đ', 'chủ hội chưa chuyển')}
      ${walletBox('Đã nhận', '2.490.000đ', 'tổng đã về tài khoản của bạn')}
    </div>
    <div style="display: flex; gap: 16px;">
      <div class="card" style="flex: 1 1 0; padding: 20px; display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">${I.wallet(18)}<span style="font-weight: 600;">Tài khoản nhận tiền</span></div>
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; background: ${T.bg};"><span style="width: 40px; height: 28px; border-radius: 6px; background: #1B5E3B; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800;">VCB</span><div style="flex-grow: 1;"><div style="font-weight: 600;">Vietcombank ••••4521</div><div class="muted" style="font-size: 12px;">NGUYEN MINH QUY</div></div><span class="btn btn-ghost btn-sm">Đổi tài khoản</span></div>
        <div class="muted" style="font-size: 12px; display: flex; align-items: center; gap: 6px;">${I.shield(14)}Được mã hóa khi lưu, chỉ hiện 4 số cuối. Chủ hội chỉ mở xem khi xử lý yêu cầu rút.</div>
      </div>
      <div class="card" style="flex: 1 1 0; padding: 20px; display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">${I.download(18)}<span style="font-weight: 600;">Rút tiền</span><span class="muted" style="font-size: 12px; margin-left: auto;">tối thiểu 500.000đ</span></div>
        <div class="input" style="color: ${T.ink}; height: 44px; font-size: 16px; font-weight: 600;"><span style="flex-grow: 1;">1.000.000</span><span class="muted" style="font-weight: 500;">đ</span></div>
        <span class="btn btn-primary">Gửi yêu cầu rút</span>
        <div class="muted" style="font-size: 12px;">Chủ hội Minh Quý chuyển khoản trong 3 ngày làm việc. Bạn có thể hủy khi yêu cầu còn ở trạng thái Chờ duyệt.</div>
      </div>
    </div>
    <div class="card" style="overflow: hidden;">
      <div style="display: flex; align-items: center; padding: 14px 20px;"><span style="font-weight: 600;">Lịch sử rút tiền</span></div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1.4fr 1fr 1.6fr 100px; gap: 12px; padding: 0 20px 8px;"><span class="th">Ngày</span><span class="th">Số tiền</span><span class="th">Tài khoản</span><span class="th">Trạng thái</span><span class="th">Mã tham chiếu / lý do</span><span></span></div>
      ${[['14/09/2026', '500.000đ', 'Vietcombank ••••4521', 'requested', '—', '<span class="btn btn-ghost btn-sm">Hủy yêu cầu</span>'], ['05/09/2026', '2.000.000đ', 'Vietcombank ••••4521', 'paid', 'FT26090512873', ''], ['20/08/2026', '490.000đ', 'Vietcombank ••••4521', 'paid', 'FT26082010021', ''], ['12/08/2026', '500.000đ', 'Vietcombank ••••1188', 'rejected', 'Sai tên chủ tài khoản, đã hoàn về ví', '']].map(([d, a, acc, st, note, act]) => `<div style="display: grid; grid-template-columns: 1fr 1fr 1.4fr 1fr 1.6fr 100px; gap: 12px; align-items: center; padding: 10px 20px; border-top: 1px solid ${T.line}; font-size: 13px;"><span class="muted">${d}</span><span style="font-weight: 600;">${a}</span><span class="muted">${acc}</span>${statusTag(st)}<span class="muted">${note}</span><span style="justify-self: end;">${act}</span></div>`).join('')}
    </div>
    <div class="card" style="overflow: hidden;">
      <div style="display: flex; align-items: center; padding: 14px 20px;"><span style="font-weight: 600;">Hoa hồng gần đây</span><span class="muted" style="font-size: 12px; margin-left: 8px;">chỉ phát sinh khi người được giới thiệu trả phí</span></div>
      <div style="display: grid; grid-template-columns: 2fr 1.2fr 1fr 1fr 1fr 1.2fr; gap: 12px; padding: 0 20px 8px;"><span class="th">Người được giới thiệu</span><span class="th">Gói</span><span class="th">Gốc</span><span class="th">Hoa hồng</span><span class="th">Trạng thái</span><span class="th">Mở khóa</span></div>
      ${commRow('ĐN', T.teal, 'Điền Phạm Ngọc', 'Premium · tháng', '249.000đ', '124.500đ', 'pending', '27/09/2026')}
      ${commRow('HK', '#7A5C3E', 'Hồng Kim', 'Premium · năm', '2.490.000đ', '1.245.000đ', 'available', '27/08/2026')}
      ${commRow('CT', '#7A5C3E', 'Công Trần', 'Premium · tháng', '249.000đ', '124.500đ', 'reversed', 'Hoàn tiền 11/09')}
      ${commRow('KB', '#5C7A3E', 'Kiên Bùi', 'Funnel Money Model 2026', '1.000.000đ', '500.000đ', 'paid', '20/08/2026')}
    </div>
  </div>
</div>`;

// ---------- AdminAffiliate.dc.html : Cộng sự nền tảng (super admin) ----------
const saAffiliateMain = `
<div style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
  <div style="display: flex; align-items: center; gap: 12px;"><div><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Cộng sự nền tảng</h1><div class="muted" style="font-size: 13px;">Người giới thiệu chủ hội mới cho Hội Mình. Cùng một cơ chế chi trả thủ công như chủ hội trả cộng sự trong hội.</div></div><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">${I.download(14)}Xuất đối soát</span></div>
  ${ledgerNotice('Quản trị viên có quyền affiliates:manage')}
  <div style="display: flex; gap: 16px;">
    <div style="flex: 1.5 1 0; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; gap: 12px;">
        ${walletBox('Chờ chuyển', '4.850.000đ', '5 yêu cầu', true)}
        ${walletBox('Đang giữ 30 ngày', '9.120.000đ', '23 hoa hồng chờ đối soát')}
        ${walletBox('Đã trả tháng này', '18.400.000đ', '31 lần chuyển khoản')}
      </div>
      <div class="card" style="overflow: hidden;">
        <div style="display: grid; grid-template-columns: 2fr 1fr 1.4fr 1fr 1fr 110px; gap: 12px; padding: 12px 20px;"><span class="th">Cộng sự</span><span class="th">Số tiền</span><span class="th">Tài khoản nhận</span><span class="th">Gửi lúc</span><span class="th">Trạng thái</span><span></span></div>
        ${queueRow('LH', '#5C7A3E', 'Lê Hạnh', 'hanh.yoga@gmail.com', '1.996.000đ', 'ACB ••••2210', '14/09 08:12', 'requested')}
        ${queueRow('TV', '#3E5C7A', 'Trần Thảo Vy', 'vy.english@gmail.com', '998.000đ', 'Vietinbank ••••7741', '13/09 15:30', 'requested')}
        ${queueRow('NH', T.teal, 'Nguyễn Huân', 'huan@huan.vn', '1.856.000đ', 'Vietcombank ••••5520', '13/09 10:02', 'reviewing', true)}
        ${reviewPanel({ name: 'Nguyễn Huân', amount: '1.856.000đ', email: 'huan@huan.vn', holder: 'NGUYEN VAN HUAN', bank: 'Vietcombank', account: '0071005520931', ref: 'HM AFF NH 0913' })}
      </div>
    </div>
    <div style="flex: 1 1 0; display: flex; flex-direction: column; gap: 12px;">
      <div class="card" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
        <span style="font-weight: 600;">Hoa hồng toàn hệ thống</span>
        ${field('Hoa hồng khi giới thiệu chủ hội', `<div class="input" style="color: ${T.ink};"><span style="flex-grow: 1;">40% · 12 tháng đầu</span>${I.down(16)}</div>`)}
        ${field('Thời gian giữ', `<div class="input" style="color: ${T.ink};"><span style="flex-grow: 1;">30 ngày</span>${I.down(16)}</div>`)}
        ${field('Mức rút tối thiểu', `<div class="input" style="color: ${T.ink};"><span style="flex-grow: 1;">500.000đ</span></div>`)}
        <span class="btn btn-dark btn-sm" style="align-self: flex-start;">Lưu</span>
      </div>
      <div class="card" style="overflow: hidden;">
        <div style="display: flex; align-items: center; padding: 14px 20px;"><span style="font-weight: 600;">Đối tác lớn</span><span class="muted" style="font-size: 12px; margin-left: 8px;">hoa hồng riêng thắng mức chung</span></div>
        ${[['NH', T.teal, 'Nguyễn Huân', '18 chủ hội', '50% · riêng'], ['PL', '#7A5C3E', 'Phạm Thành Long', '11 chủ hội', '40% · chung'], ['LH', '#5C7A3E', 'Lê Hạnh', '6 chủ hội', '40% · chung']].map(([i, bg, n, r, c]) => `<div style="display: flex; align-items: center; gap: 10px; padding: 10px 20px; border-top: 1px solid ${T.line}; font-size: 13px;">${avatar(i, bg, 28, 11)}<span style="flex-grow: 1; font-weight: 500;">${n}</span><span class="muted">${r}</span><span style="font-weight: 600;">${c}</span></div>`).join('')}
      </div>
    </div>
  </div>
</div>`;


// ---------- SignupLanding.dc.html : Tạo hội của bạn (trang đăng ký) ----------
const signupHeader = `<header style="height: 64px; display: flex; align-items: center; padding: 0 64px; gap: 8px;"><svg width="28" height="28" viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="9" cy="13" r="7" fill="${T.accent}"></circle><circle cx="17" cy="13" r="7" fill="${T.teal}" fill-opacity="0.85"></circle></svg><span style="font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 22px; color: #FFFDF9;">Hội Mình</span><span style="flex-grow: 1;"></span><span data-go="discovery" style="color: ${T.sideText}; font-size: 14px; font-weight: 500;">Khám phá</span><span data-go="login" style="color: ${T.sideText}; font-size: 14px; font-weight: 500; margin-left: 24px;">Đăng nhập</span></header>`;
const showcase = (bg, mark, name, sub, side = false) => `<div style="width: ${side ? '260px' : '560px'}; height: ${side ? '240px' : '320px'}; border-radius: 20px; background: ${bg}; position: relative; overflow: hidden; flex-shrink: 0; ${side ? 'opacity: 0.45; filter: blur(0.5px);' : 'box-shadow: 0 30px 60px rgba(0,0,0,0.45);'}"><div style="position: absolute; left: 24px; bottom: 24px; color: #FFFDF9;"><div style="font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: ${side ? '20px' : '34px'}; line-height: 1.1;">${mark}</div>${side ? '' : `<div style="font-size: 14px; opacity: 0.85; margin-top: 6px;">${name}</div>`}</div>${side ? '' : `<div style="position: absolute; top: -18px; right: -18px; padding: 12px 16px; border-radius: 12px; background: #1E8A5A; color: #FFFDF9; box-shadow: 0 10px 30px rgba(0,0,0,0.3);"><div style="font-weight: 700;">${name}</div><div style="font-size: 13px;">${sub}</div></div>`}</div>`;
const signupBody = `
<div style="${DEMO ? 'width: 100%; min-height: 100vh;' : 'width: 1440px; height: 960px; overflow: hidden;'} background: ${T.side}; color: #FFFDF9; display: flex; flex-direction: column;">
  ${signupHeader}
  <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 28px; padding: 48px 64px 40px; text-align: center;">
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <h1 class="serif" style="margin: 0; font-size: 44px; line-height: 1.15; font-weight: 800; max-width: 820px;">Xây một hội quanh đam mê của bạn</h1>
      <div style="font-size: 22px; font-weight: 600; color: ${T.gold};">Dạy học, bán khóa học và nhận tiền bằng chuyển khoản Việt Nam</div>
      <div style="font-size: 15px; color: ${T.sideText};">Một gói duy nhất, đầy đủ tính năng, không thu phí giao dịch</div>
    </div>
    <div style="display: flex; align-items: center; gap: 24px; padding-top: 12px;">
      ${showcase('#5C3E7A', 'Faceless YouTube', '', '', true)}
      ${showcase(T.accent, 'Kinh Doanh Online Cùng AI', 'Kinh Doanh Online Cùng AI', 'Thu 18,7 triệu/tháng')}
      ${showcase('#3E5C7A', 'Yoga sáng 6 giờ', '', '', true)}
    </div>
    <div style="display: flex; align-items: center; gap: 18px; color: ${T.sideMuted};">${I.back(20)}<span style="display: flex; gap: 10px;"><span style="width: 10px; height: 10px; border-radius: 999px; background: ${T.gold};"></span><span style="width: 10px; height: 10px; border-radius: 999px; background: ${T.sideMuted};"></span><span style="width: 10px; height: 10px; border-radius: 999px; background: ${T.sideMuted};"></span><span style="width: 10px; height: 10px; border-radius: 999px; background: ${T.sideMuted};"></span></span>${I.right(20)}</div>
    <span class="btn btn-primary" data-go="signup-plan" style="width: 560px; height: 56px; font-size: 16px; letter-spacing: 0.04em; text-transform: uppercase; border-radius: 12px;">Tạo hội của bạn</span>
    <div style="font-size: 13px; color: ${T.sideMuted};">Dùng thử 14 ngày miễn phí · không cần thẻ</div>
  </div>
</div>`;

// ---------- SignupPlan.dc.html : Chọn gói (một gói, tháng hoặc năm) ----------
const planFeature = (t) => `<div style="display: flex; align-items: center; gap: 10px; font-size: 15px;"><span style="width: 22px; height: 22px; border-radius: 999px; background: #1E8A5A; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${I.check(13)}</span>${t}</div>`;
const signupPlanBody = `
<div style="${DEMO ? 'width: 100%; min-height: 100vh;' : 'width: 1440px; height: 960px; overflow: hidden;'} background: ${T.side}; color: #FFFDF9; display: flex; flex-direction: column;">
  ${signupHeader}
  <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 40px 64px;">
    <h1 class="serif" style="margin: 0; font-size: 40px; font-weight: 800;">Chọn cách thanh toán</h1>
    <div style="position: relative; display: flex; padding: 4px; border-radius: 999px; background: rgba(255,253,249,0.1);">
      <span style="padding: 10px 36px; border-radius: 999px; font-weight: 600; color: ${T.sideText};">Theo tháng</span>
      <span style="padding: 10px 36px; border-radius: 999px; font-weight: 700; background: #FFFDF9; color: ${T.ink};">Theo năm</span>
      <span class="tag" style="position: absolute; top: -14px; right: -8px; background: #1E8A5A; color: #FFFDF9; height: 26px; padding: 0 10px;">2 tháng miễn phí</span>
    </div>
    <div style="width: 560px; border-radius: 20px; background: #2E2823; border: 1px solid rgba(255,253,249,0.08); padding: 32px 36px; display: flex; flex-direction: column; gap: 22px;">
      <div style="display: flex; align-items: baseline; gap: 12px; justify-content: center;"><span class="serif" style="font-size: 34px; font-weight: 800;">Hội Mình</span><span style="font-size: 22px; font-weight: 600;">4.990.000đ/năm</span></div>
      <div style="text-align: center; font-size: 13px; color: ${T.sideText}; margin-top: -14px;">tương đương 416.000đ/tháng · gói tháng 499.000đ</div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${['<strong>Không giới hạn</strong> hội, thành viên, khóa học, video, sự kiện', '<strong>Không thu phí giao dịch</strong>, bạn nhận đủ tiền thành viên trả', 'Nhận tiền qua <strong>chuyển khoản QR, MoMo, VNPAY</strong>, PayPal cho khách quốc tế', 'Cộng sự và bảng xếp hạng cộng sự', 'Cửa hàng bán khóa học, combo, tài liệu', 'Tên miền riêng', 'Tin nhắn chào tự động, tiện ích, API và webhook'].map(planFeature).join('')}
      </div>
      <span class="btn btn-primary" data-go="register" style="height: 54px; font-size: 15px; letter-spacing: 0.04em; text-transform: uppercase; border-radius: 12px;">Dùng thử 14 ngày miễn phí</span>
      <div style="text-align: center; font-size: 13px; color: ${T.sideMuted};">Không cần thẻ. Hết dùng thử, thanh toán bằng chuyển khoản hoặc MoMo, hủy bất cứ lúc nào.</div>
    </div>
  </div>
</div>`;

// ---------- Login.dc.html / Register.dc.html : Đăng nhập, Đăng ký tài khoản ----------
const googleIcon = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"></path><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z"></path><path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.3c-1.7 3.4-1.7 7.4 0 10.8l4-3.1z"></path><path fill="#EA4335" d="M12 4.7c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.1 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-5 6.7-5z"></path></svg>`;
const authInput = (label, value, muted = false, extra = '') => `<div style="display: flex; flex-direction: column; gap: 6px;"><span style="font-size: 13px; font-weight: 600;">${label}</span><div class="input" style="height: 46px; border-radius: 12px; color: ${muted ? T.ink3 : T.ink};"><span style="flex-grow: 1;">${value}</span>${extra}</div></div>`;
const authShell = (form) => `
<div style="${DEMO ? 'width: 100%; min-height: 100vh;' : 'width: 1440px; height: 960px; overflow: hidden;'} display: flex; background: ${T.bg};">
  <aside style="width: 560px; flex-shrink: 0; background: ${T.side}; color: #FFFDF9; display: flex; flex-direction: column; padding: 40px 56px; ${DEMO ? 'min-height: 100vh;' : ''}">
    <div style="display: flex; align-items: center; gap: 8px;"><svg width="28" height="28" viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="9" cy="13" r="7" fill="${T.accent}"></circle><circle cx="17" cy="13" r="7" fill="${T.teal}" fill-opacity="0.85"></circle></svg><span style="font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 22px;">Hội Mình</span></div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 28px;">
      <h1 class="serif" style="margin: 0; font-size: 40px; line-height: 1.15; font-weight: 800;">Hội của mình,<br>do mình dựng.</h1>
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 15px; color: ${T.sideText};">
        ${[[I.book(18), 'Học theo lộ trình, hỏi là có người trả lời'], [I.qr(18), 'Trả bằng chuyển khoản, MoMo hay VNPAY, mở khóa tự động'], [I.trophy(18), 'Giới thiệu bạn bè, nhận hoa hồng mỗi kỳ']].map(([ic, t]) => `<div style="display: flex; align-items: center; gap: 12px;"><span style="width: 36px; height: 36px; border-radius: 10px; background: rgba(255,253,249,0.08); color: ${T.gold}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${ic}</span>${t}</div>`).join('')}
      </div>
      <div style="padding: 18px 20px; border-radius: 14px; background: rgba(255,253,249,0.06); display: flex; flex-direction: column; gap: 10px;">
        <div style="font-size: 14px; line-height: 1.6; color: #FFFDF9;">“Mình tham gia hội qua link của một người bạn, ba tháng sau đã có đơn đầu tiên từ funnel affiliate.”</div>
        <div style="display: flex; align-items: center; gap: 10px;">${avatar('ĐN', T.teal, 32, 12)}<div><div style="font-size: 13px; font-weight: 600;">Điền Phạm Ngọc</div><div style="font-size: 12px; color: ${T.sideMuted};">Thành viên Kinh Doanh Online Cùng AI</div></div></div>
      </div>
    </div>
    <div style="font-size: 12px; color: ${T.sideMuted};">© 2026 Hội Mình · Điều khoản · Quyền riêng tư</div>
  </aside>
  <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 40px;">${form}</div>
</div>`;

const loginBody = authShell(`
<div style="width: 440px; display: flex; flex-direction: column; gap: 20px;">
  <div><h2 class="serif" style="margin: 0 0 6px; font-size: 30px; font-weight: 800;">Đăng nhập</h2><div class="muted">Chưa có tài khoản? <a href="#" data-go="register" style="font-weight: 600;">Đăng ký miễn phí</a></div></div>
  <span class="btn btn-ghost" style="height: 46px; border-radius: 12px; gap: 10px;">${googleIcon}Tiếp tục với Google</span>
  <div style="display: flex; align-items: center; gap: 12px; color: ${T.ink3}; font-size: 12px;"><span style="flex-grow: 1; height: 1px; background: ${T.line};"></span>hoặc dùng email<span style="flex-grow: 1; height: 1px; background: ${T.line};"></span></div>
  ${authInput('Email', 'minhquy@gmail.com')}
  ${authInput('Mật khẩu', '••••••••••', false, `<span style="color: ${T.ink3};">${I.mailopen(16)}</span>`)}
  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px;"><span style="display: inline-flex; align-items: center; gap: 8px;"><span style="width: 18px; height: 18px; border-radius: 5px; background: ${T.ink}; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center;">${I.check(12)}</span>Ghi nhớ đăng nhập</span><a href="#" data-go="forgot" style="font-weight: 600;">Quên mật khẩu?</a></div>
  <span class="btn btn-primary" data-go="feed" style="height: 48px; font-size: 15px; border-radius: 12px;">Đăng nhập</span>
  <div class="muted" style="font-size: 12px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;">${I.shield(14)}Đăng nhập được bảo vệ, tùy chọn xác thực hai lớp trong Tài khoản</div>
</div>`);

const registerBody = authShell(`
<div style="width: 440px; display: flex; flex-direction: column; gap: 18px;">
  <div><h2 class="serif" style="margin: 0 0 6px; font-size: 30px; font-weight: 800;">Tạo tài khoản</h2><div class="muted">Đã có tài khoản? <a href="#" data-go="login" style="font-weight: 600;">Đăng nhập</a></div></div>
  <div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; background: ${T.goldSoft}; font-size: 13px; color: #5C4A16;">${I.users(16)}<span style="flex-grow: 1;">Bạn được <strong>Hoàng Vũ</strong> giới thiệu vào <strong>Kinh Doanh Online Cùng AI</strong></span></div>
  <span class="btn btn-ghost" style="height: 46px; border-radius: 12px; gap: 10px;">${googleIcon}Tiếp tục với Google</span>
  <div style="display: flex; align-items: center; gap: 12px; color: ${T.ink3}; font-size: 12px;"><span style="flex-grow: 1; height: 1px; background: ${T.line};"></span>hoặc dùng email<span style="flex-grow: 1; height: 1px; background: ${T.line};"></span></div>
  ${authInput('Tên hiển thị', 'Nguyễn Minh Quý')}
  ${authInput('Email', 'ban@email.com', true)}
  ${authInput('Mật khẩu', 'Ít nhất 8 ký tự', true, `<span style="color: ${T.ink3};">${I.mailopen(16)}</span>`)}
  <div style="display: flex; gap: 6px;">${[T.teal, T.teal, T.line2, T.line2].map((c) => `<span style="flex: 1 1 0; height: 4px; border-radius: 999px; background: ${c};"></span>`).join('')}</div>
  <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: ${T.ink2};"><span style="width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid ${T.line2}; flex-shrink: 0; margin-top: 2px;"></span><span>Tôi đồng ý với <a href="#" style="font-weight: 600;">Điều khoản</a> và <a href="#" style="font-weight: 600;">Chính sách quyền riêng tư</a> của Hội Mình</span></div>
  <span class="btn btn-primary" data-go="verify-email" style="height: 48px; font-size: 15px; border-radius: 12px;">Tạo tài khoản</span>
  <div class="muted" style="font-size: 12px; text-align: center;">Chúng tôi sẽ gửi email xác minh. Bạn vẫn vào được hội ngay, xác minh trong 7 ngày.</div>
</div>`);

// ---------- ForgotPassword.dc.html / VerifyEmail.dc.html ----------
const otpBox = (d, on = false) => `<span style="width: 56px; height: 60px; border-radius: 12px; border: 1.5px solid ${on ? T.accent : T.line2}; background: ${T.surface}; display: inline-flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 24px; color: ${T.ink};${on ? ` box-shadow: 0 0 0 3px ${T.accentSoft};` : ''}">${d}</span>`;

const forgotBody = authShell(`
<div style="width: 440px; display: flex; flex-direction: column; gap: 20px;">
  <span data-go="login" style="display: inline-flex; align-items: center; gap: 6px; color: ${T.ink3}; font-size: 13px;">${I.back(16)}Về đăng nhập</span>
  <div><h2 class="serif" style="margin: 0 0 6px; font-size: 30px; font-weight: 800;">Quên mật khẩu</h2><div class="muted">Nhập email đã đăng ký, chúng tôi gửi link đặt lại mật khẩu. Link dùng được trong 30 phút.</div></div>
  ${authInput('Email', 'minhquy@gmail.com')}
  <span class="btn btn-primary" data-go="forgot-sent" style="height: 48px; font-size: 15px; border-radius: 12px;">Gửi link đặt lại</span>
  <div style="padding: 14px 16px; border-radius: 12px; background: ${T.bg}; font-size: 13px; color: ${T.ink2}; display: flex; gap: 10px; align-items: flex-start;"><span style="color: ${T.ink3}; flex-shrink: 0;">${I.shield(16)}</span><span>Nếu đăng nhập bằng Google, bạn không có mật khẩu ở Hội Mình. Hãy bấm "Tiếp tục với Google" ở màn Đăng nhập.</span></div>
</div>`);

const forgotSentBody = authShell(`
<div style="width: 440px; display: flex; flex-direction: column; gap: 20px; align-items: center; text-align: center;">
  <span style="width: 72px; height: 72px; border-radius: 999px; background: ${T.tealSoft}; color: #0B6F75; display: inline-flex; align-items: center; justify-content: center;">${I.mailopen(32)}</span>
  <div><h2 class="serif" style="margin: 0 0 8px; font-size: 30px; font-weight: 800;">Kiểm tra hộp thư</h2><div class="muted" style="line-height: 1.6;">Chúng tôi đã gửi link đặt lại mật khẩu tới<br><strong style="color: ${T.ink};">minhquy@gmail.com</strong></div></div>
  <div style="width: 100%; padding: 16px 18px; border-radius: 14px; border: 1px solid ${T.line}; background: ${T.surface}; display: flex; flex-direction: column; gap: 10px; text-align: left;">
    <div style="display: flex; align-items: center; gap: 10px;"><div style="width: 32px; height: 32px; border-radius: 8px; background: ${T.accent}; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; font-family: Montserrat, 'Segoe UI', Arial, sans-serif;">HM</div><div><div style="font-weight: 600; font-size: 13px;">Hội Mình</div><div class="muted" style="font-size: 12px;">Đặt lại mật khẩu cho tài khoản của bạn</div></div><span class="muted" style="font-size: 12px; margin-left: auto;">vừa xong</span></div>
    <div style="font-size: 13px; color: ${T.ink2};">Chào Minh Quý, bấm nút dưới đây để đặt mật khẩu mới. Link hết hạn sau 30 phút.</div>
    <span class="btn btn-dark btn-sm" data-go="reset-password" style="align-self: flex-start;">Đặt mật khẩu mới</span>
  </div>
  <div class="muted" style="font-size: 13px;">Không thấy email? Kiểm tra mục Spam hoặc <a href="#" style="font-weight: 600;">gửi lại</a> sau <strong style="color: ${T.ink};">0:47</strong></div>
  <span data-go="login" style="font-size: 13px; font-weight: 600; color: ${T.teal};">Về đăng nhập</span>
</div>`);

const resetBody = authShell(`
<div style="width: 440px; display: flex; flex-direction: column; gap: 20px;">
  <div><h2 class="serif" style="margin: 0 0 6px; font-size: 30px; font-weight: 800;">Đặt mật khẩu mới</h2><div class="muted">Cho tài khoản <strong style="color: ${T.ink};">minhquy@gmail.com</strong></div></div>
  ${authInput('Mật khẩu mới', '••••••••••••', false, `<span style="color: ${T.ink3};">${I.mailopen(16)}</span>`)}
  <div style="display: flex; gap: 6px; margin-top: -8px;">${[T.teal, T.teal, T.teal, T.line2].map((c) => `<span style="flex: 1 1 0; height: 4px; border-radius: 999px; background: ${c};"></span>`).join('')}</div>
  <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: ${T.ink2}; margin-top: -6px;">
    ${[['Ít nhất 8 ký tự', true], ['Có chữ và số', true], ['Không trùng mật khẩu cũ', true], ['Có ký tự đặc biệt (khuyến nghị)', false]].map(([t, ok]) => `<div style="display: flex; align-items: center; gap: 8px; color: ${ok ? '#0B6F75' : T.ink3};">${ok ? I.check(14) : I.x(14)}${t}</div>`).join('')}
  </div>
  ${authInput('Nhập lại mật khẩu', '••••••••••••')}
  <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${T.ink2};"><span style="width: 18px; height: 18px; border-radius: 5px; background: ${T.ink}; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center;">${I.check(12)}</span>Đăng xuất khỏi các thiết bị khác</div>
  <span class="btn btn-primary" data-go="login" style="height: 48px; font-size: 15px; border-radius: 12px;">Lưu mật khẩu và đăng nhập</span>
</div>`);

const verifyBody = authShell(`
<div style="width: 440px; display: flex; flex-direction: column; gap: 20px; align-items: center; text-align: center;">
  <span style="width: 72px; height: 72px; border-radius: 999px; background: ${T.goldSoft}; color: #8A6A1E; display: inline-flex; align-items: center; justify-content: center;">${I.mail(32)}</span>
  <div><h2 class="serif" style="margin: 0 0 8px; font-size: 30px; font-weight: 800;">Xác minh email</h2><div class="muted" style="line-height: 1.6;">Nhập mã 6 số vừa gửi tới<br><strong style="color: ${T.ink};">minhquy@gmail.com</strong> <a href="#" data-go="register" style="font-weight: 600;">(đổi)</a></div></div>
  <div style="display: flex; gap: 10px;">${otpBox('4')}${otpBox('8')}${otpBox('2')}${otpBox('', true)}${otpBox('')}${otpBox('')}</div>
  <span class="btn btn-primary" data-go="ws-create" style="width: 100%; height: 48px; font-size: 15px; border-radius: 12px;">Xác minh</span>
  <div class="muted" style="font-size: 13px;">Chưa nhận được? <a href="#" style="font-weight: 600;">Gửi lại mã</a> sau <strong style="color: ${T.ink};">0:52</strong> · hoặc bấm link trong email</div>
  <div style="width: 100%; padding: 14px 16px; border-radius: 12px; background: ${T.bg}; font-size: 13px; color: ${T.ink2}; display: flex; gap: 10px; align-items: flex-start; text-align: left;"><span style="color: ${T.ink3}; flex-shrink: 0;">${I.clock(16)}</span><span>Bạn có thể <a href="#" data-go="feed" style="font-weight: 600;">vào hội ngay</a> và xác minh sau. Sau 7 ngày chưa xác minh, tài khoản sẽ bị giới hạn đăng bài và thanh toán.</span></div>
</div>`);

// ---------- CommunityAbout.dc.html : Trang giới thiệu hội (công khai, đích của link hội) ----------
const aboutTab = (label, on = false, lock = false) => `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 12px 4px; border-bottom: 2px solid ${on ? T.ink : 'transparent'}; font-weight: ${on ? 700 : 500}; color: ${on ? T.ink : lock ? T.ink3 : T.ink2}; font-size: 15px;">${label}${lock ? I.lock(14) : ''}</span>`;
const aboutBody = `
<div style="${DEMO ? 'width: 100%; min-height: 100vh;' : 'width: 1440px; height: 1400px; overflow: hidden;'} background: ${T.bg}; display: flex; flex-direction: column;">
  <header style="height: 64px; display: flex; align-items: center; gap: 24px; padding: 0 64px; border-bottom: 1px solid ${T.line}; background: ${T.surface};">
    <div style="display: flex; align-items: center; gap: 8px; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 20px;"><svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="9" cy="13" r="7" fill="${T.accent}"></circle><circle cx="17" cy="13" r="7" fill="${T.teal}" fill-opacity="0.85"></circle></svg>Hội Mình</div>
    <nav style="display: flex; gap: 24px; font-weight: 500; color: ${T.ink2};"><span data-go="discovery">Khám phá</span><span data-go="signup">Dành cho chủ hội</span></nav>
    <span style="flex-grow: 1;"></span>
    <span class="btn btn-ghost" data-go="login">Đăng nhập</span>
    <span class="btn btn-primary" data-go="register">Tham gia hội</span>
  </header>
  <div style="display: flex; justify-content: center; padding: 32px 64px 48px;">
    <div style="width: 1120px; display: flex; gap: 32px; align-items: flex-start;">
      <!-- Main -->
      <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; gap: 20px; border-bottom: 1px solid ${T.line};">${aboutTab('Giới thiệu', true)}${aboutTab('Bảng tin', false, true)}${aboutTab('Khóa học', false, true)}${aboutTab('Sự kiện', false, true)}${aboutTab('Thành viên', false, true)}${aboutTab('Cửa hàng')}</div>
        <div style="position: relative; aspect-ratio: 16 / 9; border-radius: 18px; background: ${T.teal}; overflow: hidden; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; left: 28px; bottom: 28px; color: #FFFDF9;"><div class="serif" style="font-size: 40px; font-weight: 800; line-height: 1.05;">Doanh nghiệp<br>một người</div><div style="font-size: 14px; opacity: 0.85; margin-top: 8px;">Video giới thiệu · 3:12</div></div>
          <div style="width: 72px; height: 72px; border-radius: 999px; background: ${T.accent}; color: #FFFDF9; display: flex; align-items: center; justify-content: center;">${I.play(30)}</div>
        </div>
        <div style="display: flex; gap: 10px;">${[T.teal, T.accent, '#7A5C3E', '#3E5C7A'].map((c, i) => `<div style="width: 120px; height: 68px; border-radius: 10px; background: ${c}; opacity: ${i === 0 ? 1 : 0.55}; ${i === 0 ? `outline: 2px solid ${T.ink}; outline-offset: 2px;` : ''}"></div>`).join('')}</div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <h1 class="serif" style="margin: 0; font-size: 32px; font-weight: 800; line-height: 1.2;">Kinh Doanh Online Cùng AI</h1>
          <p style="margin: 0; font-size: 16px; line-height: 1.7; color: ${T.ink2};">Hội dành cho người muốn xây doanh nghiệp một người bằng AI: có lộ trình học rõ ràng, có người trả lời câu hỏi trong 24 giờ, và có cộng sự để cùng bán. Vào miễn phí, học 5 bài đầu, thấy hợp thì nâng cấp.</p>
        </div>

        <div class="card" style="padding: 22px 24px; display: flex; flex-direction: column; gap: 14px;">
          <div style="font-weight: 700; font-size: 16px;">Bạn nhận được gì khi tham gia</div>
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px;">
            ${[[I.book(18), 'Lộ trình Funnel Money Model 2026', '31 bài, module 1 miễn phí'], [I.chat(18), 'Hỏi đáp có người trả lời', 'Minh Quý và cộng sự, trong 24 giờ'], [I.calendar(18), 'Q&amp;A trực tiếp hằng tuần', 'Tối thứ tư, có bản ghi'], [I.trophy(18), 'Chương trình cộng sự 50%', 'Giới thiệu bạn bè, nhận hoa hồng mỗi kỳ'], [I.store(18), 'Cửa hàng khóa học và tài liệu', 'Combo, prompt, template'], [I.users(18), 'Cộng đồng người làm thật', '234 thành viên, 75 đang trả phí']].map(([ic, t, d]) => `<div style="display: flex; gap: 12px; align-items: flex-start;"><span style="width: 36px; height: 36px; border-radius: 10px; background: ${T.accentSoft}; color: #9C3A21; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${ic}</span><div><div style="font-weight: 600; font-size: 14px;">${t}</div><div class="muted" style="font-size: 13px;">${d}</div></div></div>`).join('')}
          </div>
        </div>

        <div class="card" style="padding: 22px 24px; display: flex; gap: 18px; align-items: center;">
          ${avatar('MQ', T.ink, 64, 20)}
          <div style="flex-grow: 1;"><div style="font-weight: 700; font-size: 16px;">Minh Quý <span class="muted" style="font-weight: 500; font-size: 13px;">· Người dẫn dắt</span></div><div style="font-size: 14px; color: ${T.ink2}; line-height: 1.6; margin-top: 4px;">Làm MMO từ 2016, hiện điều hành hai hội và chương trình Funnel Money Model. Tin rằng một người với AI có thể vận hành một doanh nghiệp nhỏ có lãi.</div></div>
          <span class="btn btn-ghost btn-sm" data-go="profile">Xem hồ sơ</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: baseline; gap: 10px;"><span style="font-weight: 700; font-size: 16px;">Khóa học trong hội</span><span class="muted" style="font-size: 13px;">4 khóa · 96 bài</span></div>
          <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px;">
            ${[[T.accent, 'Funnel Money Model 2026', '31 bài · module 1 miễn phí'], [T.teal, 'Facebook Ads chuyển đổi 2026', '55 bài · Premium'], ['#3E5C7A', 'AI Agent cho người bán hàng', '22 bài · Premium']].map(([c, n, m]) => `<div class="card" style="overflow: hidden;"><div style="height: 96px; background: ${c};"></div><div style="padding: 12px 14px;"><div style="font-weight: 600; font-size: 14px;">${n}</div><div class="muted" style="font-size: 12px;">${m}</div></div></div>`).join('')}
          </div>
        </div>

        <div class="card" style="padding: 22px 24px; display: flex; flex-direction: column; gap: 4px;">
          <div style="font-weight: 700; font-size: 16px; padding-bottom: 8px;">Câu hỏi thường gặp</div>
          ${[['Vào miễn phí thì học được gì?', 'Bảng tin, Hỏi đáp, sự kiện công khai và module 1 của mọi khóa học.'], ['Thanh toán bằng cách nào?', 'Chuyển khoản QR, MoMo hoặc VNPAY. Quyền truy cập mở tự động sau khi tiền về, thường dưới 1 phút.'], ['Hủy gói có mất dữ liệu không?', 'Không. Bạn giữ quyền đến hết kỳ đã trả, tiến độ học được giữ lại nếu quay lại.']].map(([q, a], i) => `<div style="display: flex; flex-direction: column; gap: 4px; padding: 12px 0; border-top: 1px solid ${i ? T.line : 'transparent'};"><div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px;"><span style="flex-grow: 1;">${q}</span>${I.down(16)}</div><div style="font-size: 13px; color: ${T.ink2}; line-height: 1.6;">${a}</div></div>`).join('')}
        </div>
      </div>

      <!-- Rail -->
      <aside style="width: 340px; flex-shrink: 0; display: flex; flex-direction: column; gap: 14px; ${DEMO ? 'position: sticky; top: 24px;' : ''}">
        <div class="card" style="overflow: hidden;">
          <div style="height: 130px; background: ${T.teal}; display: flex; align-items: flex-end; padding: 16px;"><span class="serif" style="color: #FFFDF9; font-size: 22px; font-weight: 800; line-height: 1.1;">Doanh nghiệp<br>một người</span></div>
          <div style="padding: 18px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;"><div style="width: 48px; height: 48px; border-radius: 14px; background: ${T.accent}; color: #FFFDF9; display: flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 17px; margin-top: -42px; border: 3px solid ${T.surface};">KD</div><div><div style="font-weight: 700; font-size: 16px;">Kinh Doanh Online Cùng AI</div><div class="muted" style="font-size: 12px;">hoiminh.vn/minhquy · Kinh doanh</div></div></div>
            <div style="font-size: 13px; color: ${T.ink2};">Ứng dụng AI xây dựng doanh nghiệp một người. Học theo lộ trình, hỏi là có người trả lời.</div>
            <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 10px 0; border-top: 1px solid ${T.line}; border-bottom: 1px solid ${T.line};">
              <div style="text-align: center;"><div style="font-weight: 700; font-size: 18px;">234</div><div class="muted" style="font-size: 12px;">Thành viên</div></div>
              <div style="text-align: center;"><div style="font-weight: 700; font-size: 18px;">12</div><div class="muted" style="font-size: 12px;">Online</div></div>
              <div style="text-align: center;"><div style="font-weight: 700; font-size: 18px;">4</div><div class="muted" style="font-size: 12px;">Khóa học</div></div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;"><div style="display: flex;">${[['MQ', T.ink], ['HV', T.accent], ['HK', '#7A5C3E'], ['ĐN', T.teal], ['KB', '#5C7A3E']].map(([i, bg], k) => `<span style="margin-left: ${k ? '-8px' : '0'}; border: 2px solid ${T.surface}; border-radius: 999px; display: inline-flex;">${avatar(i, bg, 28, 10)}</span>`).join('')}</div><span class="muted" style="font-size: 12px;">và 229 người khác</span></div>
            <div style="display: flex; flex-direction: column; gap: 6px; padding-top: 4px;">
              <div style="display: flex; align-items: baseline; gap: 8px;"><span class="serif" style="font-size: 22px; font-weight: 800;">Miễn phí</span><span class="muted" style="font-size: 13px;">để tham gia</span></div>
              <div class="muted" style="font-size: 13px; display: flex; align-items: center; gap: 6px;">${I.spark(14)}Premium 249.000đ/tháng để mở toàn bộ khóa học</div>
            </div>
            <span class="btn btn-primary" data-go="register" style="height: 48px; font-size: 15px; border-radius: 12px;">Tham gia miễn phí</span>
            <div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; background: ${T.goldSoft}; font-size: 12px; color: #5C4A16;">${I.users(14)}Bạn được <strong style="margin: 0 4px;">Hoàng Vũ</strong> giới thiệu</div>
          </div>
        </div>
        <div class="card" style="padding: 16px 18px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-weight: 600; font-size: 13px;">Liên kết</div>
          ${[['Fanpage MMO for Freedom', 'facebook.com/mmoforfreedom'], ['Kênh YouTube', 'youtube.com/@minhquy'], ['Zalo hỗ trợ', 'zalo.me/minhquy']].map(([t, u]) => `<div style="display: flex; align-items: center; gap: 8px; font-size: 13px;"><span style="color: ${T.ink3};">${I.ext(14)}</span><span style="flex-grow: 1;">${t}</span><span class="muted" style="font-size: 12px;">${u}</span></div>`).join('')}
        </div>
        <div class="muted" style="font-size: 12px; text-align: center;">Vận hành trên <strong style="color: ${T.ink};">Hội Mình</strong> · <span data-go="signup" style="font-weight: 600; color: ${T.teal};">Tạo hội của bạn</span></div>
      </aside>
    </div>
  </div>
</div>`;

// ---------- Profile.dc.html : Hồ sơ thành viên (xem người khác) ----------
const profileTab = (l, on = false) => `<span style="padding: 10px 2px; border-bottom: 2px solid ${on ? T.ink : 'transparent'}; font-weight: ${on ? 700 : 500}; color: ${on ? T.ink : T.ink2}; font-size: 14px;">${l}</span>`;
const miniPost = (cat, catBg, catFg, title, excerpt, likes, comments, time) => `<article class="card" style="padding: 18px 22px; display: flex; flex-direction: column; gap: 8px;"><div style="display: flex; align-items: center; gap: 8px; font-size: 12px;"><span class="tag" style="background: ${catBg}; color: ${catFg};">${cat}</span><span class="muted">${time}</span></div><div class="serif" style="font-size: 18px; font-weight: 700; line-height: 1.3;">${title}</div><div style="font-size: 13px; color: ${T.ink2};">${excerpt}</div><div style="display: flex; gap: 18px; color: ${T.ink2}; font-size: 13px; font-weight: 500; padding-top: 4px;"><span style="display: inline-flex; align-items: center; gap: 6px;">${I.heart(16)}${likes}</span><span style="display: inline-flex; align-items: center; gap: 6px;">${I.chat(16)}${comments}</span></div></article>`;
const profileMain = `
<div style="display: flex; gap: 32px; height: 100%;">
  <div style="width: 740px; display: flex; flex-direction: column; gap: 16px;">
    <div class="card" style="overflow: hidden;">
      <div style="height: 120px; background: ${T.accent};"></div>
      <div style="padding: 0 24px 20px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; align-items: flex-end; gap: 16px; margin-top: -40px;">
          <span style="border: 4px solid ${T.surface}; border-radius: 999px; display: inline-flex;">${avatar('HV', T.accent, 96, 30)}</span>
          <div style="flex-grow: 1; padding-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;"><span class="serif" style="font-size: 24px; font-weight: 800;">Hoàng Vũ</span><span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E;">Cấp 5</span><span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E;">Premium</span><span class="tag" style="background: ${T.tealSoft}; color: #0B6F75;">${I.trophy(11)}Cộng sự hạng 1</span></div>
            <div class="muted" style="font-size: 13px;">@hoang-vu · Tham gia 02/08/2026 · Hoạt động 1 giờ trước</div>
          </div>
          <div style="display: flex; gap: 8px; padding-bottom: 6px;"><span class="btn btn-ghost btn-sm">${I.userplus(14)}Theo dõi</span><span class="btn btn-dark btn-sm" data-go="messages">${I.chat(14)}Nhắn tin</span><span class="btn btn-ghost btn-sm">${I.more(14)}</span></div>
        </div>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: ${T.ink2};">Chạy funnel affiliate cho các khóa học AI. Trước làm content cho agency, giờ làm một mình với 3 con AI agent. Hỏi mình về lead magnet và chuyển đổi.</p>
        <div style="display: flex; gap: 14px; flex-wrap: wrap; font-size: 13px;">
          ${[[I.globe(14), 'hoangvu.vn'], [I.ext(14), 'facebook.com/hoangvu.mmo'], [I.video(14), 'youtube.com/@hoangvu'], [I.chat(14), 'Zalo 09•• ••• 812']].map(([ic, t]) => `<span style="display: inline-flex; align-items: center; gap: 6px; color: ${T.teal}; font-weight: 500;">${ic}${t}</span>`).join('')}
        </div>
        <div style="display: flex; gap: 0; padding-top: 12px; border-top: 1px solid ${T.line};">
          ${[['86', 'Bài viết'], ['412', 'Bình luận'], ['3/4', 'Khóa học'], ['34', 'Người giới thiệu'], ['2', 'Hội tham gia']].map(([v, l]) => `<div style="flex: 1 1 0; text-align: center;"><div style="font-weight: 700; font-size: 18px;">${v}</div><div class="muted" style="font-size: 12px;">${l}</div></div>`).join('')}
        </div>
      </div>
    </div>
    <div style="display: flex; gap: 20px; border-bottom: 1px solid ${T.line};">${profileTab('Bài viết · 86', true)}${profileTab('Bình luận · 412')}${profileTab('Đã thích')}${profileTab('Hội tham gia')}</div>
    ${miniPost('Chia sẻ', T.accentSoft, '#9C3A21', 'Lead magnet 1 trang kéo 41 email trong 3 ngày, mình làm thế nào', 'Không cần landing page dài. Một trang, một lời hứa, một nút. Chi tiết từng bước và file template ở dưới.', 58, 21, '2 ngày trước')}
    ${miniPost('Hỏi đáp', T.tealSoft, '#0B6F75', 'Ai đã thử chạy ads về trang giới thiệu hội thay vì landing riêng chưa?', 'Mình đang so sánh hai luồng, chi phí đăng ký thấy rẻ hơn 30% nhưng tỷ lệ nâng cấp chưa rõ.', 12, 9, '5 ngày trước')}
    ${miniPost('Nhật ký', T.goldSoft, '#8A6A1E', 'Tháng 8: 23 người trả phí qua link, mình học được 3 điều', 'Người ta mua vì tin người giới thiệu, không phải vì giảm giá. Nói thật về kết quả của mình quan trọng hơn mọi kỹ thuật.', 97, 34, '01/09')}
  </div>
  <aside style="width: 312px; display: flex; flex-direction: column; gap: 16px;">
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
      <div style="font-weight: 600;">Tiến độ học</div>
      ${[['Funnel Money Model 2026', 100, true], ['Facebook Ads chuyển đổi 2026', 100, true], ['AI Agent cho người bán hàng', 64, false], ['Kiếm tiền với Funnel Affiliate', 100, true]].map(([n, p, done]) => `<div style="display: flex; flex-direction: column; gap: 6px;"><div style="display: flex; align-items: center; gap: 8px; font-size: 13px;"><span style="flex-grow: 1; font-weight: 500;">${n}</span>${done ? `<span style="color: ${T.teal};">${I.badge(16)}</span>` : `<span class="muted" style="font-size: 12px;">${p}%</span>`}</div><div class="prog"><div style="width: ${p}%;"></div></div></div>`).join('')}
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="font-weight: 600;">Hội cùng tham gia</div>
      ${[['KD', T.accent, 'Kinh Doanh Online Cùng AI', 'Quản trị viên'], ['YT', T.teal, 'Faceless YouTube Foundation', 'Thành viên']].map(([m, bg, n, r]) => `<div style="display: flex; align-items: center; gap: 10px;" data-go="about"><div style="width: 32px; height: 32px; border-radius: 9px; background: ${bg}; color: #FFFDF9; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; font-family: Montserrat, 'Segoe UI', Arial, sans-serif;">${m}</div><div style="flex-grow: 1;"><div style="font-size: 13px; font-weight: 600;">${n}</div><div class="muted" style="font-size: 12px;">${r}</div></div></div>`).join('')}
    </div>
    <div class="card" style="padding: 16px; background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink}; display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; color: ${T.gold}; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;">${I.trophy(14)}Cộng sự tháng 9</div>
      <div class="serif" style="font-size: 20px; font-weight: 800;">Hạng 1 · 34 người giới thiệu</div>
      <div style="font-size: 13px; color: ${T.sideText};">23 người trong số đó đã trả phí</div>
      <span data-go="affiliate" style="font-size: 13px; font-weight: 600; color: ${T.gold};">Xem bảng xếp hạng</span>
    </div>
  </aside>
</div>`;

// ---------- ProfileEdit.dc.html : Tài khoản · Hồ sơ (chỉnh sửa của chính mình) ----------
const profileEditMain = `
<div style="display: flex; gap: 32px; height: 100%;">
  ${accountNav('Hồ sơ')}
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 20px; max-width: 880px;">
    <div style="display: flex; align-items: center; gap: 12px;"><div><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Hồ sơ</h1><div class="muted" style="font-size: 13px;">Một hồ sơ dùng chung cho mọi hội bạn tham gia</div></div><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm" data-go="profile">${I.user(14)}Xem như người khác</span><span class="btn btn-dark btn-sm">Lưu thay đổi</span></div>
    <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 18px;">
      <div style="display: flex; gap: 20px; align-items: center;">
        ${avatar('MQ', T.ink, 88, 28)}
        <div style="display: flex; flex-direction: column; gap: 8px;"><span style="font-weight: 600;">Ảnh đại diện</span><div style="display: flex; gap: 8px;"><span class="btn btn-ghost btn-sm">${I.image(14)}Tải ảnh lên</span><span class="btn btn-ghost btn-sm">Xóa</span></div><span class="muted" style="font-size: 12px;">Vuông, tối thiểu 256px. Hiện ở bài viết, bình luận và bảng xếp hạng.</span></div>
        <div style="margin-left: auto; padding: 12px 14px; border-radius: 12px; background: ${T.bg}; display: flex; flex-direction: column; gap: 4px; min-width: 200px;"><span class="muted" style="font-size: 12px;">Ảnh bìa hồ sơ</span><div style="height: 44px; border-radius: 8px; background: ${T.accent};"></div><span style="font-size: 12px; font-weight: 600; color: ${T.teal};">Đổi ảnh bìa</span></div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
        ${field('Tên hiển thị', inputBox('Minh Quý'))}
        ${field('Tên người dùng', `<div class="input" style="color: ${T.ink};"><span class="muted">@</span><span style="flex-grow: 1;">minhquy</span><span style="color: ${T.teal};">${I.check(16)}</span></div>`, 'Dùng để nhắc đến bạn trong bài viết: @minhquy')}
      </div>
      ${field('Giới thiệu ngắn', `<div class="input" style="height: 88px; align-items: flex-start; padding-top: 10px; color: ${T.ink};"><span>Làm MMO từ 2016, hiện điều hành hai hội và chương trình Funnel Money Model. Tin rằng một người với AI có thể vận hành một doanh nghiệp nhỏ có lãi.</span></div>`, '160/300 ký tự')}
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
        ${field('Địa điểm', inputBox('Hà Nội'))}
        ${field('Nghề nghiệp', inputBox('Sáng lập MMO for Freedom'))}
      </div>
    </div>
    <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; align-items: center;"><span style="font-weight: 600;">Liên kết</span><span style="flex-grow: 1;"></span><span class="btn btn-ghost btn-sm">${I.plus(14)}Thêm liên kết</span></div>
      ${[[I.globe(16), 'Website', 'minhquy.vn'], [I.ext(16), 'Facebook', 'facebook.com/blogminhquy'], [I.video(16), 'YouTube', 'youtube.com/@minhquy'], [I.chat(16), 'Zalo', '09•• ••• 431']].map(([ic, l, v]) => `<div style="display: flex; align-items: center; gap: 12px;"><span style="width: 36px; height: 36px; border-radius: 10px; background: ${T.bg}; color: ${T.ink2}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${ic}</span><span style="width: 90px; font-size: 13px; font-weight: 600;">${l}</span><div class="input" style="flex-grow: 1; color: ${T.ink};"><span style="flex-grow: 1;">${v}</span></div><span style="color: ${T.ink3};">${I.x(16)}</span></div>`).join('')}
    </div>
    <div class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 14px;">
      <span style="font-weight: 600;">Quyền riêng tư</span>
      ${[['Hiện hồ sơ với người chưa tham gia hội', true], ['Hiện tiến độ học trên hồ sơ', true], ['Hiện các hội tôi tham gia', false], ['Cho phép thành viên khác nhắn tin cho tôi', true]].map(([t, on]) => `<div style="display: flex; align-items: center; gap: 10px; font-size: 14px;"><span style="flex-grow: 1;">${t}</span>${toggle(on)}</div>`).join('')}
    </div>
  </div>
</div>`;

// ---------- PostDetail.dc.html : Chi tiết bài viết và bình luận ----------
const comment = ({ init, bg, name, level, time, text, likes, admin = false, pinned = false, image = '', replies = '', more = '' }) => `
<div style="display: flex; gap: 12px; align-items: flex-start;">
  <span data-go="profile" style="display: inline-flex; flex-shrink: 0;">${avatar(init, bg, 36, 13)}</span>
  <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px;">
    ${pinned ? `<div style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #8A6A1E;">${I.pin(12)}Tác giả ghim bình luận này</div>` : ''}
    <div style="padding: 10px 14px; border-radius: 14px; background: ${admin ? T.goldSoft : T.bg}; border-top-left-radius: 4px;">
      <div style="display: flex; align-items: center; gap: 6px; font-size: 13px;"><span style="font-weight: 600;" data-go="profile">${name}</span>${admin ? `<span class="tag" style="background: ${T.ink}; color: #FFFDF9; height: 18px; padding: 0 6px; font-size: 11px;">Quản trị viên</span>` : `<span class="tag" style="background: ${T.surface}; color: #8A6A1E; height: 18px; padding: 0 6px; font-size: 11px;">Cấp ${level}</span>`}</div>
      <div style="font-size: 14px; line-height: 1.6; color: ${T.ink};">${text}</div>
      ${image}
    </div>
    <div style="display: flex; align-items: center; gap: 14px; font-size: 12px; color: ${T.ink3}; padding-left: 6px;"><span>${time}</span><span style="font-weight: 600; color: ${T.ink2};">Thích${likes ? ` · ${likes}` : ''}</span><span style="font-weight: 600; color: ${T.ink2};">Trả lời</span></div>
    ${replies ? `<div style="display: flex; flex-direction: column; gap: 12px; padding-top: 6px; margin-left: 4px; padding-left: 14px; border-left: 2px solid ${T.line};">${replies}</div>` : ''}
    ${more ? `<span style="font-size: 13px; font-weight: 600; color: ${T.ink2}; display: inline-flex; align-items: center; gap: 6px; padding-left: 6px;">${I.down(14)}${more}</span>` : ''}
  </div>
</div>`;
const postDetailMain = `
<div style="display: flex; gap: 32px;">
  <article style="width: 740px; display: flex; flex-direction: column; gap: 20px;">
    <span data-go="feed" style="display: inline-flex; align-items: center; gap: 6px; color: ${T.ink3}; font-size: 13px;">${I.back(16)}Bảng tin</span>
    <div class="card" style="padding: 28px 32px; display: flex; flex-direction: column; gap: 18px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span data-go="profile" style="display: inline-flex;">${avatar('ĐN', T.teal, 44, 15)}</span>
        <div style="flex-grow: 1;"><div style="display: flex; align-items: center; gap: 8px;"><span style="font-weight: 600;" data-go="profile">Điền Phạm Ngọc</span><span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E; height: 20px; padding: 0 6px;">Cấp 2</span><span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E;">Nhật ký</span></div><div class="muted" style="font-size: 13px;">Hôm qua, 21:14 · Kinh Doanh Online Cùng AI · đã chỉnh sửa</div></div>
        <span class="btn btn-ghost btn-sm">${I.ext(14)}Chia sẻ</span><span class="btn btn-ghost btn-sm">${I.pin(14)}</span><span style="color: ${T.ink3};">${I.more(20)}</span>
      </div>
      <h1 class="serif" style="margin: 0; font-size: 30px; line-height: 1.25; font-weight: 800;">Ngày 3: đơn đầu tiên từ funnel affiliate</h1>
      <div class="md">
        <p>Sau khi làm lại lead magnet theo bài 2.3, mình chạy <strong>200.000đ tiền ads</strong> trong 3 ngày và có <strong>41 email</strong>, <strong>1 đơn 490.000đ</strong>. Chưa lãi nhưng tự tin hơn nhiều. Dưới đây là toàn bộ số liệu, ảnh chụp dashboard và 3 điều mình rút ra.</p>
        <figure><div style="border-radius: 14px; overflow: hidden;">${photo('#7A5C3E', '380px')}</div><figcaption>Dashboard quảng cáo sau 3 ngày, chi 200.000đ</figcaption></figure>
        <h2>Bối cảnh: mình làm gì trước đó</h2>
        <p>Hai tuần đầu mình chạy thẳng vào trang bán, tốn <em>gần 600.000đ</em> mà không có đơn nào. Lý do đơn giản: người lạ chưa tin mình, chưa có lý do để đọc hết trang bán.</p>
        <blockquote>Người ta mua vì tin người giới thiệu, không phải vì giảm giá. Câu này của anh <a href="#" data-go="profile">@hoangvu</a> trong buổi Q&amp;A tuần trước đã đổi cách mình làm.</blockquote>
        <h2>Lead magnet mới: một trang, một lời hứa</h2>
        <p>Mình bỏ hết, làm lại theo đúng công thức ở <a href="#" data-go="classroom">bài 2.3</a>:</p>
        <ol>
          <li><strong>Một lời hứa cụ thể</strong>: “Bộ 12 prompt viết bài bán hàng cho shop nhỏ, dùng ngay trong 10 phút”.</li>
          <li><strong>Một ảnh</strong> chụp kết quả thật, không mockup.</li>
          <li><strong>Một nút</strong>: nhập email, nhận ngay qua tin nhắn chào tự động của hội.</li>
        </ol>
        <figure><div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;">${photo('#0E8E96', '150px')}${photo('#D4593A', '150px')}${photo('#3E5C7A', '150px')}</div><figcaption>Trang lead magnet, tin nhắn chào tự động, và đơn đầu tiên trong Doanh thu</figcaption></figure>
        <h3>Số liệu 3 ngày</h3>
        <ul>
          <li>Chi ads: <code>200.000đ</code> · 1.840 lượt xem · 41 email (<em>2,2%</em>)</li>
          <li>Mở tin nhắn chào: 33/41 · bấm link khóa học: 12</li>
          <li>Đơn: 1 × 490.000đ · hoa hồng cộng sự về ví: <strong>245.000đ</strong> (đang giữ 14 ngày)</li>
        </ul>
        <h2>Ba điều mình rút ra</h2>
        <p><strong>1. Tin nhắn chào quan trọng hơn trang bán.</strong> 33 người mở tin nhắn, chỉ 12 người vào trang bán, nhưng 1 người mua đến từ nhóm đã trả lời tin nhắn.</p>
        <p><strong>2. Đừng giảm giá ở lần chạm đầu.</strong> Mình có gắn mã giảm 10% ở email đầu, không ai dùng.</p>
        <p><strong>3. Ghi lại mọi thứ.</strong> <em>Bài nhật ký này</em> chính là nội dung cho tuần sau.</p>
        <figure><div style="border-radius: 14px; overflow: hidden;">${photo('#5C3E7A', '320px')}</div><figcaption>Bảng theo dõi hằng ngày của mình, ai cần mình gửi template</figcaption></figure>
        <hr>
        <p>Tuần sau mình thử tăng ngân sách lên 500.000đ và đổi ảnh. Ai đã chạy tương tự cho mình xin số liệu để so nhé.</p>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; padding-top: 16px; border-top: 1px solid ${T.line};">
        <span class="btn btn-ghost btn-sm" style="color: #9C3A21; border-color: ${T.accentSoft}; background: ${T.accentSoft};">${I.heart(14)}Thích · 17</span>
        <span class="btn btn-ghost btn-sm">${I.chat(14)}6 bình luận</span>
        <span class="btn btn-ghost btn-sm">${I.archive(14)}Lưu</span>
        <span style="flex-grow: 1;"></span>
        <div style="display: flex;">${[['MQ', T.ink], ['HV', T.accent], ['HK', '#7A5C3E']].map(([i, bg], k) => `<span style="margin-left: ${k ? '-8px' : '0'}; border: 2px solid ${T.surface}; border-radius: 999px; display: inline-flex;">${avatar(i, bg, 26, 10)}</span>`).join('')}</div>
        <span class="muted" style="font-size: 12px;">Minh Quý, Hoàng Vũ và 15 người khác</span>
      </div>
    </div>

    <div class="card" style="padding: 24px 32px; display: flex; flex-direction: column; gap: 20px;">
      <div style="display: flex; align-items: center; gap: 12px;"><span style="font-weight: 700; font-size: 16px;">6 bình luận</span><span style="flex-grow: 1;"></span><span class="chip" style="height: 28px; font-size: 12px;">Nhiều tương tác ${I.down(12)}</span></div>
      <div style="display: flex; gap: 12px; align-items: flex-start;">
        ${avatar('MQ', T.ink, 36, 13)}
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 8px;">
          <div class="input" style="height: auto; min-height: 48px; align-items: flex-start; padding: 12px 14px; border-radius: 14px; color: ${T.ink};"><span style="flex-grow: 1;">Chúc mừng đơn đầu tiên. Số 33/41 mở tin nhắn chào là rất cao, bạn viết gì trong tin nhắn đó vậy?</span></div>
          <div style="display: flex; align-items: center; gap: 4px; color: ${T.ink2};"><span style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;">${I.image(18)}</span><span style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;">${I.paperclip(18)}</span><span style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;">${I.at(18)}</span><span style="flex-grow: 1;"></span><span class="btn btn-dark btn-sm">Gửi bình luận</span></div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 18px; padding-top: 6px; border-top: 1px solid ${T.line};">
        ${comment({ init: 'HV', bg: T.accent, name: 'Hoàng Vũ', level: 5, time: '18 giờ', pinned: true, text: 'Rất chuẩn. Bổ sung: đừng đổi ảnh và ngân sách cùng lúc, đổi một thứ mỗi tuần thì mới biết cái nào ăn. Mình gửi bạn bảng theo dõi mình đang dùng.', likes: 9, image: `<div style="margin-top: 8px; width: 260px; border-radius: 10px; overflow: hidden;">${photo('#3E5C7A', '150px')}</div>`, replies:
          comment({ init: 'ĐN', bg: T.teal, name: 'Điền Phạm Ngọc', level: 2, time: '17 giờ', text: 'Cảm ơn anh <a href="#" data-go="profile">@hoangvu</a>, tuần sau em chỉ đổi ngân sách thôi, giữ nguyên ảnh.', likes: 2 }) +
          comment({ init: 'MQ', bg: T.ink, name: 'Minh Quý', level: 7, admin: true, time: '15 giờ', text: 'Bài này mình sẽ đưa vào phần <em>Câu chuyện</em> của hội, cả nhà mới vào đọc bài này trước nhé. <strong>Số liệu thật</strong> luôn thuyết phục hơn lý thuyết.', likes: 14 }),
          more: 'Xem thêm 1 trả lời' })}
        ${comment({ init: 'HK', bg: '#7A5C3E', name: 'Hồng Kim', level: 3, time: '12 giờ', text: 'Cho mình hỏi bạn chạy ads về trang lead magnet trên Hội Mình hay trang ngoài? Mình đang phân vân vì trang ngoài phải làm thêm bước.', likes: 3, replies:
          comment({ init: 'ĐN', bg: T.teal, name: 'Điền Phạm Ngọc', level: 2, time: '11 giờ', text: 'Trang lead magnet mình dựng ngoài, còn tin nhắn chào và khóa học thì ở đây. Sắp tới thử dùng luôn trang giới thiệu hội xem sao.', likes: 1 }) })}
        ${comment({ init: 'KB', bg: '#5C7A3E', name: 'Kiên Bùi', level: 1, time: '3 giờ', text: 'Lưu bài. Đúng cái mình cần cho tuần này 🙏', likes: 0 })}
      </div>
      <span style="font-size: 13px; font-weight: 600; color: ${T.ink2}; display: inline-flex; align-items: center; gap: 6px;">${I.down(14)}Xem thêm 2 bình luận</span>
    </div>
  </article>

  <aside style="width: 312px; display: flex; flex-direction: column; gap: 16px; ${DEMO ? 'position: sticky; top: 24px; align-self: flex-start;' : ''}">
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 10px;">${avatar('ĐN', T.teal, 44, 15)}<div style="flex-grow: 1;"><div style="font-weight: 600;">Điền Phạm Ngọc</div><div class="muted" style="font-size: 12px;">Premium · tham gia 13/09 · 4 bài viết</div></div></div>
      <div style="font-size: 13px; color: ${T.ink2};">Chủ shop phụ kiện, đang học làm funnel affiliate. Viết nhật ký mỗi ngày.</div>
      <div style="display: flex; gap: 8px;"><span class="btn btn-ghost btn-sm" style="flex: 1 1 0;">${I.userplus(14)}Theo dõi</span><span class="btn btn-dark btn-sm" style="flex: 1 1 0;" data-go="messages">${I.chat(14)}Nhắn tin</span></div>
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-weight: 600; font-size: 13px;">Trong bài này</div>
      ${[['Bối cảnh: mình làm gì trước đó', false], ['Lead magnet mới: một trang, một lời hứa', true], ['Số liệu 3 ngày', false], ['Ba điều mình rút ra', false]].map(([t, on]) => `<div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${on ? T.ink : T.ink2}; ${on ? 'font-weight: 600;' : ''}"><span style="width: 3px; height: 16px; border-radius: 999px; background: ${on ? T.accent : T.line};"></span>${t}</div>`).join('')}
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="font-weight: 600; font-size: 13px;">Bài liên quan</div>
      ${[['Lead magnet 1 trang kéo 41 email trong 3 ngày', 'Hoàng Vũ · 58 thích'], ['Tháng 8: 23 người trả phí qua link', 'Hoàng Vũ · 97 thích'], ['Mới thanh toán Premium nhưng chưa thấy khóa học mở?', 'Công Trần · 2 bình luận']].map(([t, m]) => `<div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 13px; font-weight: 600; line-height: 1.4;">${t}</span><span class="muted" style="font-size: 12px;">${m}</span></div>`).join('')}
    </div>
  </aside>
</div>`;

// ---------- Composer.dc.html : Tạo bài viết với nền cho status ngắn ----------
const composerMain = `
<div style="position: relative; height: 100%;">
  <div style="opacity: 0.35; pointer-events: none;">${feedMain}</div>
  <div style="position: absolute; inset: -28px -32px; background: rgba(31,27,23,0.45); display: flex; align-items: flex-start; justify-content: center; padding-top: 48px;">
    <div class="card" style="width: 680px; overflow: hidden; box-shadow: 0 24px 60px rgba(31,27,23,0.25);">
      <div style="display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid ${T.line};"><span style="font-weight: 700; font-size: 16px; flex-grow: 1; text-align: center; padding-left: 20px;">Tạo bài viết</span><span data-go="feed" style="color: ${T.ink3};">${I.x(20)}</span></div>
      <div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 12px;">${avatar('MQ', T.ink, 44, 15)}<div><div style="font-weight: 600;">Minh Quý</div><div style="display: flex; gap: 6px; margin-top: 4px;"><span class="chip" style="height: 26px; font-size: 12px; background: ${T.bg};">Chia sẻ ${I.down(12)}</span><span class="chip" style="height: 26px; font-size: 12px; background: ${T.bg};">${I.users(12)}Mọi thành viên ${I.down(12)}</span></div></div></div>
        <div style="position: relative;">
          ${statusBg('Tuần này mở lại module 1 cho thành viên miễn phí. Ai mới vào, học 5 bài đầu rồi đặt câu hỏi nhé!', STATUS_BGS[0], '300px', '30px')}
          <div style="position: absolute; left: 12px; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 12px; background: rgba(255,253,249,0.92);">
            <span style="width: 40px; height: 40px; border-radius: 10px; background: ${T.ink}; color: #FFFDF9; display: inline-flex; align-items: center; justify-content: center; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 14px; flex-shrink: 0;">Aa</span>
            <span style="width: 40px; height: 40px; border-radius: 10px; border: 1px solid ${T.line2}; display: inline-flex; align-items: center; justify-content: center; color: ${T.ink3}; flex-shrink: 0;">${I.x(18)}</span>
            <span style="width: 1px; height: 28px; background: ${T.line2};"></span>
            <div style="display: flex; gap: 8px; flex-grow: 1; overflow: hidden;">${STATUS_BGS.map((b, i) => swatch(b, i === 0)).join('')}</div>
            <span style="width: 40px; height: 40px; border-radius: 10px; border: 1px solid ${T.line2}; display: inline-flex; align-items: center; justify-content: center; color: ${T.ink2}; flex-shrink: 0;">${I.image(18)}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: ${T.ink3};">${I.check(14)}<span>Nền dùng được vì bài ngắn hơn 130 ký tự và chưa có ảnh · <strong style="color: ${T.ink2};">96/130</strong>. Thêm ảnh hoặc viết dài hơn thì nền tự tắt.</span></div>
        <div style="display: flex; align-items: center; gap: 4px; padding: 10px 12px; border-radius: 12px; border: 1px solid ${T.line2}; color: ${T.ink2};">
          <span style="font-size: 13px; font-weight: 600; flex-grow: 1; color: ${T.ink};">Thêm vào bài viết</span>
          ${[I.image(20), I.video(20), I.poll(20), I.link(20), I.at(20), I.paperclip(20)].map((ic) => `<span style="width: 36px; height: 36px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center;">${ic}</span>`).join('')}
        </div>
        <div style="display: flex; align-items: center; gap: 10px; padding-top: 6px; border-top: 1px solid ${T.line};">
          <span style="font-size: 13px; color: ${T.ink2}; display: inline-flex; align-items: center; gap: 8px;">${I.mail(16)}Gửi email cho tất cả thành viên</span>${toggle(false)}
          <span style="flex-grow: 1;"></span>
          <span class="btn btn-ghost btn-sm" data-go="feed">Hủy</span><span class="btn btn-primary" data-go="feed">Đăng bài</span>
        </div>
      </div>
    </div>
  </div>
</div>`;

// ---------- EventDetail.dc.html : Chi tiết sự kiện ----------
const eventDetailMain = `
<div style="display: flex; gap: 32px;">
  <div style="width: 740px; display: flex; flex-direction: column; gap: 20px;">
    <span data-go="events" style="display: inline-flex; align-items: center; gap: 6px; color: ${T.ink3}; font-size: 13px;">${I.back(16)}Sự kiện</span>
    <div class="card" style="overflow: hidden;">
      <div style="height: 240px; background: ${T.teal}; position: relative; display: flex; align-items: flex-end; padding: 24px;">
        <div style="position: absolute; top: 20px; left: 24px; display: flex; gap: 8px;"><span class="tag" style="background: ${T.accentSoft}; color: #9C3A21; height: 26px; padding: 0 10px;">Đang diễn ra</span><span class="tag" style="background: rgba(255,253,249,0.2); color: #FFFDF9; height: 26px; padding: 0 10px;">${I.video(12)}Zoom</span></div>
        <div style="color: #FFFDF9;"><div class="serif" style="font-size: 32px; font-weight: 800; line-height: 1.15; max-width: 560px;">Q&amp;A tuần: Funnel Money Model</div><div style="font-size: 14px; opacity: 0.85; margin-top: 6px;">Buổi 12 · chuỗi Q&amp;A hằng tuần</div></div>
      </div>
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; gap: 16px;">
          ${dateBlock('T4', '17', T.accentSoft, '#9C3A21')}
          <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;">
            <div style="font-weight: 700; font-size: 16px;">Thứ tư, 17 tháng 9, 2026</div>
            <div style="display: flex; align-items: center; gap: 14px; font-size: 14px; color: ${T.ink2};"><span style="display: inline-flex; align-items: center; gap: 6px;">${I.clock(16)}20:00 – 21:30 · giờ Việt Nam</span><span style="display: inline-flex; align-items: center; gap: 6px;">${I.users(16)}64 đã đăng ký · 38 đang trong phòng</span></div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${T.ink2};">${avatar('MQ', T.ink, 22, 9)}Dẫn dắt bởi <strong data-go="profile">Minh Quý</strong> · cùng <strong data-go="profile">Hoàng Vũ</strong></div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
            <span class="btn btn-primary" style="height: 48px; padding: 0 24px; font-size: 15px;">${I.play(16)}Vào phòng Zoom</span>
            <div style="display: flex; gap: 6px;"><span class="btn btn-ghost btn-sm">${I.calendar(14)}Thêm vào lịch</span><span class="btn btn-ghost btn-sm">${I.ext(14)}Chia sẻ</span><span class="btn btn-ghost btn-sm" style="color: ${T.teal};">${I.check(14)}Đã đăng ký</span></div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; background: ${T.goldSoft}; font-size: 13px; color: #5C4A16;">${I.bell(16)}<span style="flex-grow: 1;">Nhắc trước 1 giờ và khi bắt đầu qua thông báo và email. Link phòng chỉ hiện cho người đã đăng ký.</span><span style="font-weight: 600; color: #8A6A1E; white-space: nowrap;">Đổi nhắc</span></div>
        <div class="md" style="font-size: 15px;">
          <h2 style="font-size: 20px; margin-top: 4px;">Buổi này nói về gì</h2>
          <p>Gỡ trực tiếp offer của 3 thành viên đã gửi trước, rồi trả lời câu hỏi theo thứ tự bình chọn bên dưới. Ai đang ở module 2 nên có mặt.</p>
          <ul>
            <li><strong>20:00</strong> · Tổng kết tuần: 41 câu hỏi ở Hỏi đáp, 3 chủ đề lặp lại nhiều nhất</li>
            <li><strong>20:15</strong> · Gỡ offer: <em>shop phụ kiện</em>, <em>khóa tiếng Anh online</em>, <em>dịch vụ kế toán</em></li>
            <li><strong>21:00</strong> · Hỏi đáp mở theo bình chọn</li>
          </ul>
          <p>Chuẩn bị: mở sẵn <a href="#" data-go="classroom">Offer Canvas</a> của bạn, có gì hỏi thì gửi trước ở dưới để mình sắp thứ tự.</p>
        </div>
        <div style="display: flex; gap: 10px;"><span class="chip">${I.file(16)}Slide buổi 11.pdf</span><span class="chip">${I.file(16)}Offer Canvas.pdf</span><span class="chip">${I.play(16)}Bản ghi buổi 11 · 1 giờ 24 phút</span></div>
      </div>
    </div>

    <div class="card" style="padding: 22px 24px; display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; align-items: center; gap: 10px;"><span style="font-weight: 700; font-size: 16px;">Câu hỏi gửi trước</span><span class="muted" style="font-size: 13px;">· 9 câu, bình chọn để xếp thứ tự</span><span style="flex-grow: 1;"></span><span class="chip" style="height: 28px; font-size: 12px;">Nhiều bình chọn ${I.down(12)}</span></div>
      <div class="input" style="height: 46px; border-radius: 12px;"><span style="flex-grow: 1;">Gửi câu hỏi của bạn cho buổi này…</span><span class="btn btn-dark btn-sm">Gửi</span></div>
      ${[['HK', '#7A5C3E', 'Hồng Kim', 'Offer bảo hành hoàn tiền 30 ngày có làm giảm giá trị cảm nhận không? Em sợ khách nghĩ khóa học không chắc chắn.', 21, true], ['CT', '#7A5C3E', 'Công Trần', 'Mình bán dịch vụ, không bán khóa học. Công thức giá trị áp thế nào khi kết quả phụ thuộc vào khách?', 14, false], ['KB', '#5C7A3E', 'Kiên Bùi', 'Nên đặt giá lẻ 249k hay tròn 250k? Có số liệu nào trong hội chưa ạ?', 8, false]].map(([i, bg, n, q, v, on]) => `<div style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid ${T.line};"><div style="display: flex; flex-direction: column; align-items: center; gap: 2px; width: 44px; flex-shrink: 0; padding: 6px 0; border-radius: 10px; background: ${on ? T.accentSoft : T.bg}; color: ${on ? '#9C3A21' : T.ink2};"><span style="transform: rotate(180deg); display: inline-flex;">${I.down(16)}</span><span style="font-weight: 700; font-size: 14px;">${v}</span></div><div style="flex-grow: 1;"><div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">${avatar(i, bg, 22, 9)}<span style="font-weight: 600;">${n}</span></div><div style="font-size: 14px; color: ${T.ink}; margin-top: 4px; line-height: 1.55;">${q}</div></div></div>`).join('')}
    </div>

    <div class="card" style="padding: 22px 24px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; align-items: center; gap: 10px;"><span style="font-weight: 700; font-size: 16px;">Thảo luận</span><span class="muted" style="font-size: 13px;">· 4</span></div>
      ${comment({ init: 'DN', bg: '#3E5C7A', name: 'Duy Nguyễn', level: 1, time: '2 giờ', text: 'Buổi này có bản ghi không ạ? Tối mình bận đến 21:00.', likes: 2, replies: comment({ init: 'MQ', bg: T.ink, name: 'Minh Quý', level: 7, admin: true, time: '1 giờ', text: 'Có, bản ghi lên trong 24 giờ ở mục Xem lại và trong bài học 2.6.', likes: 5 }) })}
    </div>
  </div>

  <aside style="width: 312px; display: flex; flex-direction: column; gap: 16px; ${DEMO ? 'position: sticky; top: 24px; align-self: flex-start;' : ''}">
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; align-items: center;"><span style="font-weight: 600;">Người tham gia</span><span class="muted" style="font-size: 12px; margin-left: auto;">64 đăng ký</span></div>
      <div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px;">${[['MQ', T.ink], ['HV', T.accent], ['HK', '#7A5C3E'], ['ĐN', T.teal], ['KB', '#5C7A3E'], ['CT', '#7A5C3E'], ['DN', '#3E5C7A'], ['TL', '#5C3E7A'], ['LH', '#5C7A3E'], ['TV', '#3E5C7A'], ['NH', T.teal]].map(([i, bg]) => `<span data-go="profile" style="display: inline-flex;">${avatar(i, bg, 40, 13)}</span>`).join('')}<span style="width: 40px; height: 40px; border-radius: 999px; background: ${T.bg}; color: ${T.ink2}; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">+53</span></div>
      <div class="muted" style="font-size: 12px;">Chỉ thành viên Premium và cộng sự thấy danh sách này.</div>
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="font-weight: 600;">Trong chuỗi này</div>
      ${[['Buổi 11 · Thiết kế Offer', '10/09 · bản ghi', true], ['Buổi 12 · Funnel Money Model', '17/09 · hôm nay', false], ['Buổi 13 · Lead magnet và Tripwire', '24/09 · 12 đăng ký', false]].map(([t, m, done]) => `<div style="display: flex; gap: 10px; align-items: center;"><span style="width: 22px; height: 22px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; ${done ? `background: ${T.teal}; color: #fff;` : `border: 1.5px solid ${T.line2};`}">${done ? I.check(12) : ''}</span><div><div style="font-size: 13px; font-weight: 500;">${t}</div><div class="muted" style="font-size: 12px;">${m}</div></div></div>`).join('')}
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-weight: 600; font-size: 13px;">Dành cho người tổ chức</div>
      <span class="btn btn-ghost btn-sm" style="justify-content: flex-start;" data-go="event-create">${I.settings(14)}Sửa sự kiện</span>
      <span class="btn btn-ghost btn-sm" style="justify-content: flex-start;">${I.mail(14)}Nhắn tất cả người đăng ký</span>
      <span class="btn btn-ghost btn-sm" style="justify-content: flex-start;">${I.download(14)}Xuất danh sách</span>
    </div>
  </aside>
</div>`;

// ---------- ProductDetail.dc.html : Chi tiết sản phẩm trong Cửa hàng ----------
const curriculumLesson = (t, dur, preview = false) => `<div style="display: flex; align-items: center; gap: 12px; padding: 9px 12px; font-size: 14px;"><span style="color: ${preview ? T.teal : T.ink3};">${preview ? I.play(16) : I.lock(16)}</span><span style="flex-grow: 1;">${t}</span>${preview ? `<span class="tag" style="background: ${T.tealSoft}; color: #0B6F75; height: 20px;">Xem thử</span>` : ''}<span class="muted" style="font-size: 12px; width: 44px; text-align: right;">${dur}</span></div>`;
const productDetailMain = `
<div style="display: flex; gap: 32px;">
  <div style="width: 740px; display: flex; flex-direction: column; gap: 20px;">
    <div style="display: flex; align-items: center; gap: 8px; color: ${T.ink3}; font-size: 13px;"><span data-go="store" style="display: inline-flex; align-items: center; gap: 6px;">${I.back(16)}Cửa hàng</span><span>/</span><span>Khóa học</span></div>
    <div style="position: relative; aspect-ratio: 16 / 9; border-radius: 18px; background: ${T.accent}; overflow: hidden; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; left: 28px; bottom: 28px; color: #FFFDF9;"><div class="serif" style="font-size: 40px; font-weight: 800; line-height: 1.05;">Funnel Money<br>Model 2026</div><div style="font-size: 14px; opacity: 0.85; margin-top: 8px;">Video giới thiệu · 2:48</div></div>
      <div style="width: 72px; height: 72px; border-radius: 999px; background: ${T.ink}; color: #FFFDF9; display: flex; align-items: center; justify-content: center;">${I.play(30)}</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; gap: 8px; align-items: center; font-size: 13px;"><span class="tag" style="background: ${T.accentSoft}; color: #9C3A21;">Khóa học video</span><span class="muted">31 bài · 6 giờ 36 phút · cập nhật 09/2026 · tiếng Việt</span></div>
      <h1 class="serif" style="margin: 0; font-size: 32px; font-weight: 800; line-height: 1.2;">Funnel Money Model 2026</h1>
      <p style="margin: 0; font-size: 17px; line-height: 1.6; color: ${T.ink2};">Thiết kế offer, lead magnet và tripwire để hoàn vốn quảng cáo ngay từ đơn đầu, cho người bán một mình.</p>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><span style="display: inline-flex; gap: 2px; color: ${T.gold};">${I.spark(14)}${I.spark(14)}${I.spark(14)}${I.spark(14)}${I.spark(14)}</span><strong>4,9</strong><span class="muted">· 38 đánh giá · 128 thành viên đã sở hữu</span></div>
    </div>

    <div class="card" style="padding: 22px 24px; display: flex; flex-direction: column; gap: 14px;">
      <div style="font-weight: 700; font-size: 16px;">Sau khóa này bạn làm được gì</div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 24px; font-size: 14px;">
        ${['Viết một offer bằng công thức giá trị trong 1 buổi', 'Dựng lead magnet một trang kéo email với chi phí thấp', 'Đặt giá tripwire để hoàn vốn ads ngay đơn đầu', 'Đọc 3 con số quyết định lãi của funnel', 'Thiết kế hoa hồng cộng sự 50% mà vẫn có lãi', 'Có bộ template: Offer Canvas, kịch bản tin nhắn chào, bảng theo dõi'].map((b) => `<div style="display: flex; gap: 10px; align-items: flex-start;"><span style="color: ${T.teal}; flex-shrink: 0; margin-top: 2px;">${I.check(16)}</span>${b}</div>`).join('')}
      </div>
    </div>

    <div class="card" style="overflow: hidden;">
      <div style="display: flex; align-items: center; padding: 18px 24px 10px;"><span style="font-weight: 700; font-size: 16px;">Nội dung khóa học</span><span class="muted" style="font-size: 13px; margin-left: 10px;">4 module · 31 bài · 6 giờ 36 phút</span><span style="flex-grow: 1;"></span><span style="font-size: 13px; font-weight: 600; color: ${T.teal};">Mở tất cả</span></div>
      <div style="padding: 0 12px 12px; display: flex; flex-direction: column; gap: 4px;">
        ${moduleHead('1. Tư duy mô hình tiền', '5 bài · 42 phút · xem thử', true)}
        <div style="display: flex; flex-direction: column; padding: 0 4px;">${curriculumLesson('1.1 Tiền chảy theo mô hình, không theo may mắn', '08:10', true)}${curriculumLesson('1.2 Ba con số quyết định lãi', '10:22', true)}${curriculumLesson('1.3 Điểm hòa vốn sớm là gì', '07:45')}${curriculumLesson('1.4 Ví dụ: shop 1 người thu 30 triệu', '12:05')}${curriculumLesson('1.5 Bài tập: vẽ dòng tiền của bạn', 'Bài tập')}</div>
        ${moduleHead('2. Thiết kế Offer', '6 bài · 1 giờ 2 phút', false)}
        ${moduleHead('3. Lead magnet và Tripwire', '7 bài · 1 giờ 48 phút', false)}
        ${moduleHead('4. Scale bằng cộng sự affiliate', '8 bài · 2 giờ 4 phút', false)}
        ${moduleHead('Tài liệu đi kèm', '5 tệp · PDF, TXT, bảng tính', false)}
      </div>
    </div>

    <div class="card" style="padding: 22px 24px; display: flex; gap: 18px; align-items: center;">
      ${avatar('MQ', T.ink, 64, 20)}
      <div style="flex-grow: 1;"><div style="font-weight: 700; font-size: 16px;">Minh Quý <span class="muted" style="font-weight: 500; font-size: 13px;">· Giảng viên</span></div><div style="font-size: 14px; color: ${T.ink2}; line-height: 1.6; margin-top: 4px;">Làm MMO từ 2016, điều hành hai hội với 290 thành viên. Khóa này đúc từ 12 buổi Q&amp;A gỡ offer thật cho thành viên.</div></div>
      <span class="btn btn-ghost btn-sm" data-go="profile">Xem hồ sơ</span>
    </div>

    <div class="card" style="padding: 22px 24px; display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; align-items: center; gap: 10px;"><span style="font-weight: 700; font-size: 16px;">Thành viên nói gì</span><span class="muted" style="font-size: 13px;">· 38 đánh giá, chỉ người đã học mới đánh giá được</span></div>
      ${[['HV', T.accent, 'Hoàng Vũ', 'Cấp 5', 'Bài 2.3 đáng giá cả khóa. Viết lại offer xong tỷ lệ chốt của mình tăng gấp đôi trong tháng đầu.', '08/2026'], ['ĐN', T.teal, 'Điền Phạm Ngọc', 'Cấp 2', 'Mình không có nền tảng marketing, học xong module 1 và 2 đã có đơn đầu tiên từ funnel. Có số liệu thật trong nhật ký của mình.', '09/2026']].map(([i, bg, n, lv, t, d]) => `<div style="display: flex; gap: 12px; align-items: flex-start; padding-top: 12px; border-top: 1px solid ${T.line};">${avatar(i, bg, 36, 13)}<div style="flex-grow: 1;"><div style="display: flex; align-items: center; gap: 8px; font-size: 13px;"><span style="font-weight: 600;">${n}</span><span class="tag" style="background: ${T.goldSoft}; color: #8A6A1E; height: 18px; padding: 0 6px; font-size: 11px;">${lv}</span><span style="display: inline-flex; gap: 1px; color: ${T.gold};">${I.spark(12)}${I.spark(12)}${I.spark(12)}${I.spark(12)}${I.spark(12)}</span><span class="muted">· ${d}</span></div><div style="font-size: 14px; color: ${T.ink}; line-height: 1.6; margin-top: 4px;">${t}</div></div></div>`).join('')}
      <span style="font-size: 13px; font-weight: 600; color: ${T.ink2}; display: inline-flex; align-items: center; gap: 6px;">${I.down(14)}Xem 36 đánh giá còn lại</span>
    </div>

    <div class="card" style="padding: 22px 24px; display: flex; flex-direction: column; gap: 4px;">
      <div style="font-weight: 700; font-size: 16px; padding-bottom: 8px;">Câu hỏi thường gặp</div>
      ${[['Mình là thành viên Premium thì có phải mua không?', 'Không. Premium mở khóa toàn bộ khóa học trong hội, kể cả khóa này và các khóa ra mắt sau.'], ['Mua lẻ thì học được bao lâu?', 'Trọn đời, kể cả khi bạn rời hội. Cập nhật mới của khóa cũng được nhận.'], ['Chưa hợp thì sao?', 'Hoàn tiền trong 7 ngày nếu bạn xem chưa quá 20% nội dung, gửi yêu cầu ngay trong Gói và thanh toán.']].map(([q, a], i) => `<div style="display: flex; flex-direction: column; gap: 4px; padding: 12px 0; border-top: 1px solid ${i ? T.line : 'transparent'};"><div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px;"><span style="flex-grow: 1;">${q}</span>${I.down(16)}</div><div style="font-size: 13px; color: ${T.ink2}; line-height: 1.6;">${a}</div></div>`).join('')}
    </div>
  </div>

  <aside style="width: 312px; display: flex; flex-direction: column; gap: 14px; ${DEMO ? 'position: sticky; top: 24px; align-self: flex-start;' : ''}">
    <div class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; align-items: baseline; gap: 10px;"><span class="serif" style="font-size: 30px; font-weight: 800;">1.000.000đ</span><span class="muted" style="text-decoration: line-through; font-size: 14px;">1.686.000đ</span><span class="tag" style="background: ${T.ink}; color: #FFFDF9;">-41%</span></div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #9C3A21; font-weight: 600;">${I.clock(14)}Ưu đãi ra mắt còn 2 ngày 14 giờ</div>
      <span class="btn btn-primary" data-go="checkout" style="height: 50px; font-size: 15px; border-radius: 12px;">Mua ngay</span>
      <span class="btn btn-ghost" style="height: 44px; border-radius: 12px;">${I.play(16)}Xem thử 2 bài miễn phí</span>
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: ${T.ink2}; padding-top: 12px; border-top: 1px solid ${T.line};">
        ${[[I.video(15), '31 bài video · 6 giờ 36 phút'], [I.file(15), '5 tài liệu tải về'], [I.clock(15), 'Truy cập trọn đời, cập nhật miễn phí'], [I.chat(15), 'Thảo luận theo từng bài'], [I.badge(15), 'Chứng nhận hoàn thành'], [I.shield(15), 'Hoàn tiền trong 7 ngày']].map(([ic, t]) => `<div style="display: flex; align-items: center; gap: 10px;"><span style="color: ${T.ink3};">${ic}</span>${t}</div>`).join('')}
      </div>
      <div class="muted" style="font-size: 12px; display: flex; align-items: center; gap: 6px;">${I.qr(14)}Chuyển khoản QR, MoMo, VNPAY · mở khóa tự động</div>
    </div>
    <div class="card" style="padding: 18px; background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink}; display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; color: ${T.gold}; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;">${I.spark(14)}Rẻ hơn với Premium</div>
      <div class="serif" style="font-size: 18px; font-weight: 800; line-height: 1.3;">Premium 249.000đ/tháng mở khóa này và 3 khóa khác</div>
      <div style="font-size: 13px; color: ${T.sideText};">Bạn đang ở gói Tiêu chuẩn. Hủy bất cứ lúc nào.</div>
      <span class="btn btn-primary btn-sm" data-go="checkout" style="align-self: flex-start;">Nâng cấp Premium</span>
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-weight: 600; font-size: 13px;">Có trong combo</div>
      <div style="display: flex; gap: 10px; align-items: center;" data-go="store"><div style="width: 44px; height: 44px; border-radius: 10px; background: ${T.ink}; flex-shrink: 0;"></div><div><div style="font-size: 13px; font-weight: 600;">Combo Kinh doanh AI trọn bộ</div><div class="muted" style="font-size: 12px;">9 khóa · 5.000.000đ · tiết kiệm 44%</div></div></div>
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600;">${I.link(14)}Bạn là cộng sự</div>
      <div class="input" style="height: 36px; font-size: 12px; color: ${T.ink};"><span style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">hoiminh.vn/minhquy/fmm-2026?ref=mq8k2</span>${I.copy(14)}</div>
      <div class="muted" style="font-size: 12px;">Hoa hồng 50% · 500.000đ mỗi đơn qua link này</div>
    </div>
  </aside>
</div>`;

// ---------- Courses.dc.html : Thư viện khóa học ----------
const courseCard = ({ bg, name, meta, progress, state, cta }) => `
<div class="card" style="overflow: hidden; display: flex; flex-direction: column;">
  <div data-go="course" style="position: relative; height: 160px; background: ${bg}; display: flex; align-items: flex-end; padding: 16px;">
    <span class="serif" style="color: #FFFDF9; font-size: 22px; font-weight: 800; line-height: 1.15; max-width: 240px;">${name}</span>
    ${state === 'lock' ? `<span class="tag" style="position: absolute; top: 12px; right: 12px; background: ${T.goldSoft}; color: #8A6A1E;">${I.lock(11)}Premium</span>` : state === 'draft' ? `<span class="tag" style="position: absolute; top: 12px; left: 12px; background: ${T.bg}; color: ${T.ink3};">Nháp</span>` : state === 'done' ? `<span class="tag" style="position: absolute; top: 12px; right: 12px; background: ${T.tealSoft}; color: #0B6F75;">${I.badge(11)}Hoàn thành</span>` : ''}
  </div>
  <div style="padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; flex-grow: 1;">
    <div style="font-weight: 600; font-size: 15px;" data-go="course">${name}</div>
    <div class="muted" style="font-size: 12px;">${meta}</div>
    <div style="flex-grow: 1;"></div>
    ${state === 'lock' ? `<span class="btn btn-ghost btn-sm" data-go="checkout">Nâng cấp để mở</span>` : state === 'draft' ? `<span class="btn btn-ghost btn-sm" data-go="course-builder">Tiếp tục soạn</span>` : `<div style="display: flex; align-items: center; gap: 10px;"><div class="prog" style="flex-grow: 1;"><div style="width: ${progress}%;"></div></div><span style="font-size: 12px; font-weight: 600; color: ${progress === 100 ? T.teal : T.ink2};">${progress}%</span></div><span class="btn ${progress > 0 && progress < 100 ? 'btn-dark' : 'btn-ghost'} btn-sm" data-go="${progress === 100 ? 'course' : 'classroom'}">${cta}</span>`}
  </div>
</div>`;
const coursesMain = `
<div style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
  <div style="display: flex; align-items: flex-end; gap: 16px;">
    <div><h1 class="serif" style="margin: 0; font-size: 28px; font-weight: 800;">Khóa học</h1><div class="muted" style="font-size: 13px;">4 khóa · bạn đã hoàn thành 1, đang học 2</div></div>
    <span style="flex-grow: 1;"></span>
    <div style="display: flex; gap: 8px;"><span class="chip on">Tất cả · 5</span><span class="chip">Đang học · 2</span><span class="chip">Hoàn thành · 1</span><span class="chip">Chưa mở · 1</span></div>
    <span class="btn btn-primary btn-sm" style="height: 36px;" data-go="course-create">${I.plus(16)}Tạo khóa học</span>
  </div>
  <div class="card" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px; background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink};">
    <div style="width: 56px; height: 56px; border-radius: 12px; background: ${T.accent}; flex-shrink: 0;"></div>
    <div style="flex-grow: 1;"><div style="font-size: 12px; color: ${T.gold}; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;">Học tiếp</div><div style="font-weight: 700; font-size: 16px;">2.3 Viết offer bằng công thức giá trị</div><div style="font-size: 13px; color: ${T.sideText};">Funnel Money Model 2026 · còn 6 phút của bài này · bạn dừng hôm qua</div></div>
    <span class="btn btn-primary" data-go="classroom">${I.play(16)}Tiếp tục</span>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px;">
    ${courseCard({ bg: T.accent, name: 'Funnel Money Model 2026', meta: '31 bài · 6 giờ 36 phút · cập nhật 09/2026', progress: 27, state: 'learning', cta: 'Tiếp tục' })}
    ${courseCard({ bg: T.teal, name: 'Facebook Ads chuyển đổi 2026', meta: '55 bài · 9 giờ 30 phút', progress: 100, state: 'done', cta: 'Xem lại' })}
    ${courseCard({ bg: '#3E5C7A', name: 'AI Agent cho người bán hàng', meta: '22 bài · 4 giờ 6 phút', progress: 8, state: 'learning', cta: 'Tiếp tục' })}
    ${courseCard({ bg: '#7A5C3E', name: 'Kiếm tiền với Funnel Affiliate', meta: '18 bài · 3 giờ 12 phút · dành cho Premium', progress: 0, state: 'lock', cta: '' })}
    ${courseCard({ bg: '#5C7A3E', name: 'Chương trình Cộng sự MMO', meta: '6 bài · chỉ bạn thấy', progress: 0, state: 'draft', cta: '' })}
  </div>
</div>`;

// ---------- CourseOverview.dc.html : Chi tiết khóa học ----------
const ovModule = (n, title, done, total, mins, open, lessons = '') => `
<div style="border-top: 1px solid ${T.line};">
  <div style="display: flex; align-items: center; gap: 14px; padding: 14px 20px;">
    <span style="width: 34px; height: 34px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; ${done === total ? `background: ${T.tealSoft}; color: #0B6F75;` : done > 0 ? `background: ${T.accentSoft}; color: #9C3A21;` : `background: ${T.bg}; color: ${T.ink3};`}">${done === total ? I.check(16) : n}</span>
    <div style="flex-grow: 1;"><div style="font-weight: 600;">${title}</div><div class="muted" style="font-size: 12px;">${total} bài · ${mins}</div></div>
    <div style="display: flex; align-items: center; gap: 10px; width: 160px;"><div class="prog" style="flex-grow: 1;"><div style="width: ${Math.round((done / total) * 100)}%;"></div></div><span class="muted" style="font-size: 12px; width: 32px; text-align: right;">${done}/${total}</span></div>
    <span style="color: ${T.ink3};">${open ? I.down(18) : I.right(18)}</span>
  </div>
  ${lessons ? `<div style="padding: 0 20px 12px 68px; display: flex; flex-direction: column; gap: 2px;">${lessons}</div>` : ''}
</div>`;
const courseOverviewMain = `
<div style="display: flex; gap: 32px;">
  <div style="width: 740px; display: flex; flex-direction: column; gap: 20px;">
    <span data-go="courses" style="display: inline-flex; align-items: center; gap: 6px; color: ${T.ink3}; font-size: 13px;">${I.back(16)}Khóa học</span>
    <div class="card" style="overflow: hidden;">
      <div style="height: 220px; background: ${T.accent}; display: flex; align-items: flex-end; padding: 24px; position: relative;">
        <span class="tag" style="position: absolute; top: 20px; left: 24px; background: rgba(255,253,249,0.2); color: #FFFDF9; height: 26px; padding: 0 10px;">Khóa học · Premium</span>
        <div style="color: #FFFDF9;"><div class="serif" style="font-size: 34px; font-weight: 800; line-height: 1.1;">Funnel Money Model 2026</div><div style="font-size: 14px; opacity: 0.85; margin-top: 6px;">4 module · 31 bài · 6 giờ 36 phút · Minh Quý</div></div>
      </div>
      <div style="padding: 20px 24px; display: flex; align-items: center; gap: 20px;">
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><span style="font-weight: 600;">Tiến độ 27%</span><span class="muted">· 8/31 bài · còn khoảng 4 giờ 50 phút</span></div>
          <div class="prog" style="height: 8px;"><div style="width: 27%;"></div></div>
          <div class="muted" style="font-size: 12px;">Đang ở bài <strong style="color: ${T.ink};">2.3 Viết offer bằng công thức giá trị</strong> · học lần cuối hôm qua</div>
        </div>
        <span class="btn btn-primary" data-go="classroom" style="height: 48px; padding: 0 24px; font-size: 15px;">${I.play(16)}Tiếp tục học</span>
        <span style="color: ${T.ink3};">${I.more(20)}</span>
      </div>
    </div>

    <div style="display: flex; gap: 20px; border-bottom: 1px solid ${T.line};">${['Nội dung', 'Tài liệu · 5', 'Thảo luận · 42', 'Về khóa học'].map((t, i) => `<span style="padding: 10px 2px; border-bottom: 2px solid ${i === 0 ? T.ink : 'transparent'}; font-weight: ${i === 0 ? 700 : 500}; color: ${i === 0 ? T.ink : T.ink2}; font-size: 14px;">${t}</span>`).join('')}</div>

    <div class="card" style="overflow: hidden;">
      <div style="display: flex; align-items: center; padding: 14px 20px;"><span style="font-weight: 600;">Nội dung khóa học</span><span style="flex-grow: 1;"></span><span style="font-size: 13px; font-weight: 600; color: ${T.teal};">Mở tất cả</span></div>
      ${ovModule(1, 'Tư duy mô hình tiền', 5, 5, '42 phút', false)}
      ${ovModule(2, 'Thiết kế Offer', 2, 6, '1 giờ 2 phút', true, lessonRow('2.1 Khách hàng thực sự mua gì', 'done', '09:12') + lessonRow('2.2 Ba lớp giá trị của một offer', 'done', '11:04') + lessonRow('2.3 Viết offer bằng công thức giá trị', 'now', '12:41') + lessonRow('2.4 Định giá theo kết quả', 'todo', '08:55') + lessonRow('2.5 Bảo hành và đảo ngược rủi ro', 'todo', '07:30') + lessonRow('2.6 Bài tập: Offer Canvas của bạn', 'todo', 'Bài tập'))}
      ${ovModule(3, 'Lead magnet và Tripwire', 0, 7, '1 giờ 48 phút', false)}
      ${ovModule(4, 'Scale bằng cộng sự affiliate', 0, 8, '2 giờ 4 phút', false)}
    </div>

    <div class="card" style="padding: 22px 24px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; align-items: center;"><span style="font-weight: 700; font-size: 16px;">Thảo luận gần đây trong khóa</span><span style="flex-grow: 1;"></span><span style="font-size: 13px; font-weight: 600; color: ${T.teal};">Xem tất cả 42</span></div>
      ${[['HK', '#7A5C3E', 'Hồng Kim', 'Bài 2.3', 'Vế “thời gian” nên tính theo ngày hay theo số buổi học ạ?', '5 giờ trước', 3], ['KB', '#5C7A3E', 'Kiên Bùi', 'Bài 1.5', 'Mình vẽ dòng tiền của shop rồi, ai xem giúp mình với', 'Hôm qua', 6]].map(([i, bg, n, l, t, time, r]) => `<div style="display: flex; gap: 12px; align-items: flex-start; padding-top: 12px; border-top: 1px solid ${T.line};">${avatar(i, bg, 32, 12)}<div style="flex-grow: 1;"><div style="display: flex; align-items: center; gap: 8px; font-size: 13px;"><span style="font-weight: 600;">${n}</span><span class="tag" style="background: ${T.bg}; color: ${T.ink2}; height: 18px; padding: 0 6px; font-size: 11px;">${l}</span><span class="muted">· ${time}</span></div><div style="font-size: 14px; margin-top: 2px;">${t}</div></div><span class="muted" style="font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">${I.chat(14)}${r}</span></div>`).join('')}
    </div>
  </div>

  <aside style="width: 312px; display: flex; flex-direction: column; gap: 16px; ${DEMO ? 'position: sticky; top: 24px; align-self: flex-start;' : ''}">
    <div class="card" style="padding: 18px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="position: relative; width: 72px; height: 72px; border-radius: 999px; background: conic-gradient(${T.teal} 27%, ${T.line} 0); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><div style="width: 56px; height: 56px; border-radius: 999px; background: ${T.surface}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-family: Montserrat, 'Segoe UI', Arial, sans-serif;">27%</div></div>
        <div style="display: flex; flex-direction: column; gap: 2px; font-size: 13px;"><span><strong>8</strong> <span class="muted">bài đã học</span></span><span><strong>1 giờ 46 phút</strong> <span class="muted">đã xem</span></span><span><strong>4 ngày</strong> <span class="muted">học liên tiếp</span></span></div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: ${T.goldSoft}; font-size: 12px; color: #5C4A16;">${I.badge(16)}<span>Hoàn thành 100% để nhận <strong>chứng nhận</strong> có tên bạn và link kiểm tra.</span></div>
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-weight: 600; font-size: 13px;">Tài liệu khóa học</div>
      ${['Offer Canvas.pdf', 'Prompt AI viết offer.txt', 'Bảng theo dõi dòng tiền.xlsx', 'Kịch bản tin nhắn chào.pdf', 'Checklist lead magnet.pdf'].map((f) => `<div style="display: flex; align-items: center; gap: 8px; font-size: 13px;"><span style="color: ${T.ink3};">${I.file(14)}</span><span style="flex-grow: 1;">${f}</span><span style="color: ${T.ink3};">${I.download(14)}</span></div>`).join('')}
    </div>
    <div class="card" style="padding: 16px; display: flex; align-items: center; gap: 12px;">
      ${avatar('MQ', T.ink, 44, 15)}
      <div style="flex-grow: 1;"><div style="font-weight: 600;">Minh Quý</div><div class="muted" style="font-size: 12px;">Giảng viên · trả lời trong 24 giờ</div></div>
      <span class="btn btn-ghost btn-sm" data-go="messages">${I.chat(14)}</span>
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; align-items: center;"><span style="font-weight: 600; font-size: 13px;">Đang học cùng bạn</span><span class="muted" style="font-size: 12px; margin-left: auto;">96 người</span></div>
      <div style="display: flex;">${[['HV', T.accent], ['HK', '#7A5C3E'], ['ĐN', T.teal], ['KB', '#5C7A3E'], ['CT', '#7A5C3E'], ['DN', '#3E5C7A']].map(([i, bg], k) => `<span style="margin-left: ${k ? '-8px' : '0'}; border: 2px solid ${T.surface}; border-radius: 999px; display: inline-flex;">${avatar(i, bg, 32, 11)}</span>`).join('')}<span style="margin-left: -8px; width: 32px; height: 32px; border-radius: 999px; background: ${T.bg}; border: 2px solid ${T.surface}; color: ${T.ink2}; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">+90</span></div>
      <div class="muted" style="font-size: 12px;">23 người đã hoàn thành · Hoàng Vũ nhanh nhất, 9 ngày</div>
    </div>
  </aside>
</div>`;

// ---------- CourseCreate.dc.html : Tạo khóa học (một màn) ----------
const accessOption = (title, sub, on, extra = '') => `<div style="padding: 14px 16px; border-radius: 12px; border: 1.5px solid ${on ? T.accent : T.line2}; background: ${on ? T.accentSoft : T.surface}; display: flex; flex-direction: column; gap: 6px;"><div style="display: flex; align-items: center; gap: 10px;">${radio(on)}<span style="font-weight: 600; font-size: 14px;">${title}</span></div><span class="muted" style="font-size: 12px; padding-left: 28px;">${sub}</span>${extra}</div>`;
const courseCreateMain = `
<div style="display: flex; gap: 32px;">
  <div style="width: 760px; display: flex; flex-direction: column; gap: 20px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span data-go="courses" style="display: inline-flex; align-items: center; gap: 6px; color: ${T.ink3}; font-size: 13px;">${I.back(16)}Khóa học</span>
      <span style="color: ${T.line2};">/</span>
      <h1 class="serif" style="margin: 0; font-size: 26px; font-weight: 800;">Tạo khóa học</h1>
      <span class="tag" style="background: ${T.bg}; color: ${T.ink3};">Nháp · tự lưu</span>
      <span style="flex-grow: 1;"></span>
      <span class="btn btn-ghost btn-sm">Lưu nháp</span>
      <span class="btn btn-dark btn-sm" data-go="course-builder">Tiếp tục: soạn nội dung ${I.right(14)}</span>
    </div>
    <div style="display: flex; gap: 8px;">${['1 · Thông tin', '2 · Quyền truy cập', '3 · Nội dung', '4 · Đăng'].map((t, i) => `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 999px; ${i < 2 ? `background: ${T.ink}; color: #FFFDF9;` : `background: ${T.bg}; color: ${T.ink3};`}">${t}</span>`).join('')}</div>

    <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 18px;">
      <div style="font-weight: 700; font-size: 15px;">Thông tin</div>
      <div style="display: flex; gap: 20px;">
        <div style="width: 280px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 13px; font-weight: 600;">Ảnh bìa</span><div style="aspect-ratio: 16 / 9; border-radius: 12px; background: ${T.accent}; display: flex; align-items: flex-end; padding: 14px;"><span class="serif" style="color: #FFFDF9; font-size: 20px; font-weight: 800; line-height: 1.1;">AI Agent<br>cho chủ shop</span></div><div style="display: flex; gap: 6px;"><span class="btn btn-ghost btn-sm">${I.image(14)}Đổi ảnh</span><span class="btn btn-ghost btn-sm">Tự tạo từ tên</span></div></div>
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 14px;">
          ${field('Tên khóa học', inputBox('AI Agent cho chủ shop'), '23/80 ký tự · hiện trên thẻ và trang bán')}
          ${field('Mô tả ngắn', inputBox('Dựng trợ lý AI trả lời khách, chốt đơn và chăm sóc sau bán trong 7 ngày.'), '1 câu, hiện dưới tên')}
          ${field('Video giới thiệu', `<div class="input" style="color: ${T.ink};">${I.video(16)}<span style="flex-grow: 1;">youtube.com/watch?v=Ab12Cd</span><span class="tag" style="background: ${T.tealSoft}; color: #0B6F75;">${I.check(11)}YouTube</span></div>`, 'Dán link YouTube, TikTok, Facebook, Loom hoặc Bunny')}
        </div>
      </div>
      ${field('Mô tả đầy đủ', `<div style="border: 1px solid ${T.line2}; border-radius: 12px; overflow: hidden;"><div style="display: flex; gap: 2px; padding: 6px 8px; border-bottom: 1px solid ${T.line}; background: ${T.bg};">${['B', 'I', 'H2', 'H3', '• —', '1.', '“ ”', I.link(14), I.image(14)].map((t) => `<span style="min-width: 30px; height: 28px; padding: 0 8px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: ${T.ink2};">${t}</span>`).join('')}<span style="flex-grow: 1;"></span><span class="muted" style="font-size: 11px; align-self: center;">Markdown</span></div><div style="padding: 14px 16px; min-height: 120px; font-size: 14px; line-height: 1.7; color: ${T.ink};"><strong>Sau 7 ngày</strong> bạn có một trợ lý trả lời tin nhắn, gợi ý sản phẩm và nhắc đơn chưa thanh toán.<br><br><em>Dành cho:</em> chủ shop 1 đến 3 người, chưa biết code.<br><br>## Bạn cần gì trước khi học<br>- Một fanpage hoặc Zalo OA đang bán hàng<br>- 2 giờ mỗi ngày trong 7 ngày</div></div>`)}
    </div>

    <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
      <div><div style="font-weight: 700; font-size: 15px;">Ai được học</div><div class="muted" style="font-size: 13px;">Chọn một, đổi được sau. Quyền truy cập tính theo tier (mục Giá và gói).</div></div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;">
        ${accessOption('Mọi thành viên', 'Ai vào hội cũng học được, kể cả gói Tiêu chuẩn', false)}
        ${accessOption('Thành viên Premium', 'Người gói Tiêu chuẩn thấy khóa nhưng bị khóa, có nút nâng cấp', false)}
        ${accessOption('Bán lẻ trong Cửa hàng', 'Ai cũng mua được, kể cả người ngoài hội', false)}
        ${accessOption('Premium miễn phí + bán lẻ cho người khác', 'Cách thường dùng: Premium học luôn, người khác mua lẻ', true, `<div style="display: flex; gap: 10px; padding: 8px 0 0 28px;"><div style="display: flex; flex-direction: column; gap: 4px;"><span class="muted" style="font-size: 12px;">Giá bán lẻ</span><div class="input" style="width: 160px; height: 36px; color: ${T.ink}; font-weight: 600;"><span style="flex-grow: 1;">1.200.000</span><span class="muted">đ</span></div></div><div style="display: flex; flex-direction: column; gap: 4px;"><span class="muted" style="font-size: 12px;">Giá gốc (gạch)</span><div class="input" style="width: 160px; height: 36px; color: ${T.ink};"><span style="flex-grow: 1;">1.900.000</span><span class="muted">đ</span></div></div></div>`)}
      </div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; padding-top: 10px; border-top: 1px solid ${T.line};"><span style="flex-grow: 1;">Cho xem thử module đầu tiên với người chưa có quyền</span>${toggle(true)}</div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;"><span style="flex-grow: 1;">Cộng sự được nhận hoa hồng khi bán lẻ khóa này</span>${toggle(true)}</div>
    </div>

    <div class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; align-items: center; gap: 8px;"><span style="font-weight: 600;">Nâng cao</span><span style="flex-grow: 1;"></span>${I.down(18)}</div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 24px; font-size: 13px;">
        <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Mở bài theo lịch (nhỏ giọt)</span><span class="chip" style="height: 28px; font-size: 12px;">Tắt ${I.down(12)}</span></div>
        <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Cấp chứng nhận khi hoàn thành</span>${toggle(true)}</div>
        <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Bắt buộc học theo thứ tự</span>${toggle(false)}</div>
        <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Ẩn khỏi Cửa hàng và trang giới thiệu</span>${toggle(false)}</div>
      </div>
    </div>
  </div>

  <aside style="width: 292px; display: flex; flex-direction: column; gap: 16px; ${DEMO ? 'position: sticky; top: 24px; align-self: flex-start;' : ''}">
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="font-weight: 600; font-size: 13px;">Xem trước thẻ</div>
      ${courseCard({ bg: T.accent, name: 'AI Agent cho chủ shop', meta: '0 bài · Premium miễn phí · 1.200.000đ', progress: 0, state: 'draft', cta: '' })}
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-weight: 600; font-size: 13px;">Trước khi đăng</div>
      ${[['Tên và ảnh bìa', true], ['Mô tả ngắn', true], ['Chọn quyền truy cập', true], ['Ít nhất 1 module, 1 bài', false], ['Video giới thiệu (nên có)', true]].map(([t, d]) => `<div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${d ? T.ink3 : T.ink};"><span style="width: 18px; height: 18px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; ${d ? `background: ${T.teal}; color: #fff;` : `border: 1.5px solid ${T.line2};`}">${d ? I.check(11) : ''}</span><span style="${d ? 'text-decoration: line-through;' : ''}">${t}</span></div>`).join('')}
    </div>
    <div class="muted" style="font-size: 12px; display: flex; gap: 8px; align-items: flex-start;">${I.spark(14)}<span>Mẹo: đăng khi có 1 module đầy đủ, thêm dần các module sau. Thành viên được báo mỗi khi có bài mới.</span></div>
  </aside>
</div>`;

// ---------- CourseBuilder.dc.html : Soạn nội dung khóa học ----------
const lessonTypeIcon = (t) => ({ video: I.video(14), text: I.file(14), task: I.check(14), file: I.paperclip(14) }[t]);
const builderLesson = (t, title, dur, on = false, preview = false) => `<div style="display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 6px; border-radius: 10px; font-size: 13px; ${on ? `background: ${T.accentSoft};` : ''}"><span style="color: ${T.line2};">${I.more(14)}</span><span style="width: 24px; height: 24px; border-radius: 6px; background: ${on ? '#FFFDF9' : T.bg}; color: ${T.ink2}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${lessonTypeIcon(t)}</span><span style="flex-grow: 1; ${on ? 'font-weight: 600;' : ''}">${title}</span>${preview ? `<span class="tag" style="background: ${T.tealSoft}; color: #0B6F75; height: 18px; padding: 0 5px; font-size: 10px;">Xem thử</span>` : ''}<span class="muted" style="font-size: 11px;">${dur}</span></div>`;
const builderModule = (n, title, count, open, lessons = '') => `<div style="display: flex; flex-direction: column; gap: 2px;"><div style="display: flex; align-items: center; gap: 8px; padding: 10px 8px 6px;"><span style="color: ${T.line2};">${I.more(14)}</span><span style="color: ${T.ink3};">${open ? I.down(14) : I.right(14)}</span><span style="flex-grow: 1; font-weight: 700; font-size: 13px;">${n}. ${title}</span><span class="muted" style="font-size: 11px;">${count} bài</span><span style="color: ${T.ink3};">${I.plus(14)}</span></div>${lessons}</div>`;
const courseBuilderMain = `
<div style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
  <div style="display: flex; align-items: center; gap: 12px;">
    <span data-go="course-create" style="display: inline-flex; align-items: center; gap: 6px; color: ${T.ink3}; font-size: 13px;">${I.back(16)}Thông tin khóa</span>
    <span style="color: ${T.line2};">/</span>
    <h1 class="serif" style="margin: 0; font-size: 22px; font-weight: 800;">AI Agent cho chủ shop</h1>
    <span class="tag" style="background: ${T.bg}; color: ${T.ink3};">Nháp</span>
    <span class="muted" style="font-size: 12px;">Đã lưu 10 giây trước</span>
    <span style="flex-grow: 1;"></span>
    <span class="btn btn-ghost btn-sm" data-go="course">${I.user(14)}Xem như học viên</span>
    <span class="btn btn-primary btn-sm">${I.check(14)}Đăng khóa học</span>
  </div>
  <div style="display: flex; gap: 20px; flex-grow: 1; min-height: 0;">
    <div class="card" style="width: 340px; flex-shrink: 0; padding: 10px; display: flex; flex-direction: column; gap: 4px;">
      <div style="display: flex; align-items: center; padding: 6px 8px 8px;"><span style="font-weight: 600; font-size: 13px; flex-grow: 1;">Nội dung · 3 module · 9 bài</span><span class="muted" style="font-size: 11px;">kéo để sắp xếp</span></div>
      ${builderModule(1, 'Trợ lý AI làm được gì', 4, true, builderLesson('video', 'Trợ lý AI khác chatbot cũ chỗ nào', '07:40', false, true) + builderLesson('video', 'Ba việc giao cho AI ngay hôm nay', '09:12', true, true) + builderLesson('text', 'Chuẩn bị tài khoản và dữ liệu shop', '', false) + builderLesson('task', 'Bài tập: liệt kê 20 câu khách hay hỏi', 'Bài tập'))}
      ${builderModule(2, 'Dựng trợ lý trả lời khách', 3, false)}
      ${builderModule(3, 'Chốt đơn và chăm sóc sau bán', 2, false)}
      <div style="display: flex; gap: 6px; padding: 8px 4px 2px;"><span class="btn btn-ghost btn-sm" style="flex: 1 1 0;">${I.plus(14)}Module</span><span class="btn btn-ghost btn-sm" style="flex: 1 1 0;">${I.plus(14)}Bài</span></div>
      <div style="margin-top: auto; padding: 10px 12px; border-radius: 10px; background: ${T.bg}; font-size: 12px; color: ${T.ink2}; display: flex; gap: 8px; align-items: flex-start;">${I.spark(14)}<span>Có thể nhập nhanh từ danh sách link YouTube, mỗi link thành một bài.</span></div>
    </div>

    <div class="card" style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;">
      <div style="display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid ${T.line};">
        <span class="tag" style="background: ${T.bg}; color: ${T.ink2};">Module 1 · Bài 2</span>
        <div style="display: flex; gap: 6px;">${[['video', 'Video', true], ['text', 'Bài viết', false], ['task', 'Bài tập', false], ['file', 'Tài liệu', false]].map(([t, l, on]) => `<span class="chip" style="height: 28px; font-size: 12px; ${on ? `background: ${T.ink}; color: #FFFDF9; border-color: ${T.ink};` : ''}">${lessonTypeIcon(t)}${l}</span>`).join('')}</div>
        <span style="flex-grow: 1;"></span>
        <span class="btn btn-ghost btn-sm">${I.ext(14)}Xem trước</span><span class="btn btn-dark btn-sm">Lưu bài</span>
      </div>
      <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
        ${field('Tên bài', inputBox('Ba việc giao cho AI ngay hôm nay'))}
        ${field('Video', `<div style="display: flex; gap: 12px;"><div style="width: 200px; aspect-ratio: 16 / 9; border-radius: 10px; background: #171310; display: flex; align-items: center; justify-content: center; color: #FFFDF9; flex-shrink: 0;">${I.play(24)}</div><div style="flex-grow: 1; display: flex; flex-direction: column; gap: 8px;"><div class="input" style="color: ${T.ink};">${I.link(16)}<span style="flex-grow: 1;">youtube.com/watch?v=Xy98Zw</span><span class="tag" style="background: ${T.tealSoft}; color: #0B6F75;">${I.check(11)}YouTube · 9:12</span></div><div class="muted" style="font-size: 12px;">Dán link YouTube, TikTok, Facebook, Loom, Vimeo hoặc Bunny. Video ẩn trên YouTube vẫn phát được. Đặt "Không liệt kê" để người ngoài không tìm thấy.</div></div></div>`)}
        ${field('Nội dung bài', `<div style="border: 1px solid ${T.line2}; border-radius: 12px; overflow: hidden;"><div style="display: flex; gap: 2px; padding: 6px 8px; border-bottom: 1px solid ${T.line}; background: ${T.bg};">${['B', 'I', 'H2', 'H3', '• —', '1.', '“ ”', I.link(14), I.image(14), '</>'].map((t) => `<span style="min-width: 30px; height: 28px; padding: 0 8px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: ${T.ink2};">${t}</span>`).join('')}<span style="flex-grow: 1;"></span><span class="muted" style="font-size: 11px; align-self: center;">Markdown · tự lưu</span></div><div style="padding: 14px 16px; min-height: 140px; font-size: 14px; line-height: 1.7;">Trong bài này bạn giao ba việc cho trợ lý:<br><br>1. <strong>Trả lời giờ mở cửa, phí ship, chính sách đổi trả</strong> — dán 20 câu hỏi ở bài tập trước.<br>2. <em>Gợi ý sản phẩm</em> theo từ khóa khách nhắn.<br>3. Nhắc đơn chưa thanh toán sau 2 giờ.<br><br>## Prompt mẫu<br>Tải ở phần tài liệu bên dưới, đổi tên shop rồi dùng ngay.</div></div>`)}
        <div style="display: flex; gap: 16px;">
          <div style="flex: 1 1 0; display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 13px; font-weight: 600;">Tài liệu đính kèm</span><div style="display: flex; gap: 8px; flex-wrap: wrap;"><span class="chip">${I.file(14)}Prompt mẫu trợ lý.txt<span style="color: ${T.ink3};">${I.x(12)}</span></span><span class="chip">${I.file(14)}20 câu hỏi mẫu.xlsx<span style="color: ${T.ink3};">${I.x(12)}</span></span><span class="chip" style="border-style: dashed;">${I.plus(14)}Thêm tệp</span></div></div>
          <div style="width: 300px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 12px; background: ${T.bg}; font-size: 13px;">
            <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Cho xem thử (không cần quyền)</span>${toggle(true)}</div>
            <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Mở sau khi vào khóa</span><span class="chip" style="height: 26px; font-size: 12px;">Ngay ${I.down(12)}</span></div>
            <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Phải hoàn thành mới qua bài sau</span>${toggle(false)}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

// ---------- EventCreate.dc.html : Tạo sự kiện (chủ hội) ----------
const kindOption = (icon, title, sub, on) => `<div style="flex: 1 1 0; padding: 12px 14px; border-radius: 12px; border: 1.5px solid ${on ? T.accent : T.line2}; background: ${on ? T.accentSoft : T.surface}; display: flex; gap: 10px; align-items: flex-start;">${radio(on)}<div><div style="display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px;">${icon}${title}</div><div class="muted" style="font-size: 12px;">${sub}</div></div></div>`;
const eventCreateMain = `
<div style="display: flex; gap: 32px;">
  <div style="width: 760px; display: flex; flex-direction: column; gap: 20px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span data-go="events" style="display: inline-flex; align-items: center; gap: 6px; color: ${T.ink3}; font-size: 13px;">${I.back(16)}Sự kiện</span>
      <span style="color: ${T.line2};">/</span>
      <h1 class="serif" style="margin: 0; font-size: 26px; font-weight: 800;">Tạo sự kiện</h1>
      <span style="flex-grow: 1;"></span>
      <span class="btn btn-ghost btn-sm">Lưu nháp</span>
      <span class="btn btn-primary btn-sm" data-go="event">${I.check(14)}Đăng sự kiện</span>
    </div>

    <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 18px;">
      <div style="font-weight: 700; font-size: 15px;">Sự kiện gì</div>
      ${field('Tên sự kiện', inputBox('Q&amp;A tuần: Lead magnet và Tripwire'), '38/80 ký tự')}
      <div style="display: flex; gap: 20px;">
        <div style="width: 240px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 13px; font-weight: 600;">Ảnh bìa</span><div style="aspect-ratio: 16 / 9; border-radius: 12px; background: ${T.teal}; display: flex; align-items: flex-end; padding: 12px;"><span class="serif" style="color: #FFFDF9; font-size: 16px; font-weight: 800; line-height: 1.1;">Q&amp;A tuần</span></div><div style="display: flex; gap: 6px;"><span class="btn btn-ghost btn-sm">${I.image(14)}Đổi ảnh</span><span class="btn btn-ghost btn-sm">Dùng ảnh chuỗi</span></div></div>
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 14px;">
          ${field('Thuộc chuỗi', `<div class="input" style="color: ${T.ink};"><span style="flex-grow: 1;">Q&amp;A hằng tuần · buổi 13</span>${I.down(16)}</div>`, 'Chuỗi gom các buổi lại, người đăng ký một lần được nhắc mọi buổi')}
          ${field('Mô tả', `<div style="border: 1px solid ${T.line2}; border-radius: 12px; overflow: hidden;"><div style="display: flex; gap: 2px; padding: 6px 8px; border-bottom: 1px solid ${T.line}; background: ${T.bg};">${['B', 'I', 'H2', '• —', '1.', I.link(14)].map((t) => `<span style="min-width: 30px; height: 28px; padding: 0 8px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: ${T.ink2};">${t}</span>`).join('')}<span style="flex-grow: 1;"></span><span class="muted" style="font-size: 11px; align-self: center;">Markdown</span></div><div style="padding: 12px 14px; min-height: 96px; font-size: 14px; line-height: 1.7;">Gỡ lead magnet của 3 thành viên đã gửi trước, rồi hỏi đáp theo bình chọn.<br><br>- <strong>20:00</strong> Tổng kết tuần<br>- <strong>20:15</strong> Gỡ lead magnet<br>- <strong>21:00</strong> Hỏi đáp mở</div></div>`)}
        </div>
      </div>
    </div>

    <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 18px;">
      <div style="font-weight: 700; font-size: 15px;">Khi nào</div>
      <div style="display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 14px;">
        ${field('Ngày', `<div class="input" style="color: ${T.ink};">${I.calendar(16)}<span style="flex-grow: 1;">Thứ tư, 24/09/2026</span>${I.down(16)}</div>`)}
        ${field('Bắt đầu', `<div class="input" style="color: ${T.ink};">${I.clock(16)}<span style="flex-grow: 1;">20:00</span></div>`)}
        ${field('Kết thúc', `<div class="input" style="color: ${T.ink};"><span style="flex-grow: 1;">21:30</span><span class="muted" style="font-size: 12px;">1 giờ 30</span></div>`)}
      </div>
      <div style="display: flex; gap: 14px; align-items: flex-end;">
        ${field('Múi giờ', `<div class="input" style="color: ${T.ink}; width: 260px;">${I.globe(16)}<span style="flex-grow: 1;">Giờ Việt Nam (GMT+7)</span>${I.down(16)}</div>`, 'Thành viên ở múi giờ khác tự thấy giờ của họ')}
        <div style="display: flex; flex-direction: column; gap: 6px;"><span style="font-size: 13px; font-weight: 600;">Lặp lại</span><div style="display: flex; gap: 6px;">${[['Không', false], ['Hằng tuần', true], ['Hằng tháng', false], ['Tùy chọn', false]].map(([l, on]) => `<span class="chip${on ? ' on' : ''}" style="height: 40px; border-radius: 10px;">${l}</span>`).join('')}</div></div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; background: ${T.tealSoft}; font-size: 13px; color: #0B6F75;">${I.calendar(16)}<span>Sẽ tạo 8 buổi, thứ tư hằng tuần, 24/09 đến 12/11. Mỗi buổi sửa riêng được sau.</span><span style="margin-left: auto; font-weight: 600;">Đổi số buổi</span></div>
    </div>

    <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 18px;">
      <div style="font-weight: 700; font-size: 15px;">Ở đâu</div>
      <div style="display: flex; gap: 10px;">
        ${kindOption(I.video(14), 'Trực tuyến', 'Zoom, Google Meet, YouTube Live', true)}
        ${kindOption(I.globe(14), 'Trực tiếp', 'Có địa chỉ, giới hạn chỗ', false)}
        ${kindOption(I.users(14), 'Kết hợp', 'Vừa tại chỗ vừa phát online', false)}
      </div>
      ${field('Link phòng', `<div class="input" style="color: ${T.ink};">${I.link(16)}<span style="flex-grow: 1;">zoom.us/j/8812349901?pwd=…</span><span class="tag" style="background: ${T.tealSoft}; color: #0B6F75;">${I.check(11)}Zoom</span></div>`, 'Chỉ hiện cho người đã đăng ký, và chỉ từ 15 phút trước giờ bắt đầu')}
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;">
        ${field('Người dẫn dắt', `<div class="input" style="color: ${T.ink}; height: 44px;"><span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px 3px 3px; border-radius: 999px; background: ${T.bg};">${avatar('MQ', T.ink, 22, 9)}<span style="font-size: 13px;">Minh Quý</span></span><span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px 3px 3px; border-radius: 999px; background: ${T.bg};">${avatar('HV', T.accent, 22, 9)}<span style="font-size: 13px;">Hoàng Vũ</span><span style="color: ${T.ink3};">${I.x(12)}</span></span><span style="flex-grow: 1;"></span>${I.plus(16)}</div>`)}
        ${field('Giới hạn chỗ', `<div class="input" style="color: ${T.ink};"><span style="flex-grow: 1;">Không giới hạn</span>${I.down(16)}</div>`, 'Đặt số chỗ nếu Zoom có giới hạn hoặc có tại chỗ')}
      </div>
    </div>

    <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
      <div style="font-weight: 700; font-size: 15px;">Ai được tham gia</div>
      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;">
        ${accessOption('Mọi thành viên', 'Kể cả gói Tiêu chuẩn', false)}
        ${accessOption('Chỉ Premium', 'Người khác thấy nhưng bị khóa, có nút nâng cấp', true)}
        ${accessOption('Công khai', 'Hiện trên trang giới thiệu, người ngoài đăng ký rồi vào hội', false)}
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; padding-top: 12px; border-top: 1px solid ${T.line};">
        <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Cho gửi câu hỏi trước và bình chọn</span>${toggle(true)}</div>
        <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Tự đăng bản ghi vào Xem lại sau buổi</span>${toggle(true)}</div>
        <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Nhắc người đăng ký</span><div style="display: flex; gap: 6px;">${[['1 ngày', true], ['1 giờ', true], ['Khi bắt đầu', true], ['15 phút', false]].map(([l, on]) => `<span class="chip${on ? ' on' : ''}" style="height: 28px; font-size: 12px;">${l}</span>`).join('')}</div></div>
        <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Đăng bài thông báo lên Bảng tin khi tạo</span>${toggle(true)}</div>
        <div style="display: flex; align-items: center; gap: 10px;"><span style="flex-grow: 1;">Gửi email cho tất cả thành viên</span>${toggle(false)}</div>
      </div>
    </div>
  </div>

  <aside style="width: 292px; display: flex; flex-direction: column; gap: 16px; ${DEMO ? 'position: sticky; top: 24px; align-self: flex-start;' : ''}">
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="font-weight: 600; font-size: 13px;">Xem trước</div>
      ${eventRow({ dow: 'T4', day: '24', bg: T.bg, fg: T.ink2, title: 'Q&amp;A tuần: Lead magnet và Tripwire', time: '20:00 – 21:30', kind: 'Zoom', host: 'Minh Quý', hostInit: 'MQ', hostBg: T.ink, going: 0, state: 'open' })}
      <div class="muted" style="font-size: 12px;">Hiện trong Sự kiện, lịch tháng và khối Sự kiện sắp tới trên Bảng tin.</div>
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-weight: 600; font-size: 13px;">Trước khi đăng</div>
      ${[['Tên và mô tả', true], ['Ngày giờ', true], ['Link phòng', true], ['Người dẫn dắt', true], ['Ảnh bìa (nên có)', true]].map(([t, d]) => `<div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${d ? T.ink3 : T.ink};"><span style="width: 18px; height: 18px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; ${d ? `background: ${T.teal}; color: #fff;` : `border: 1.5px solid ${T.line2};`}">${d ? I.check(11) : ''}</span><span style="${d ? 'text-decoration: line-through;' : ''}">${t}</span></div>`).join('')}
    </div>
    <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-weight: 600; font-size: 13px;">Mẫu nhanh</div>
      ${[['Q&amp;A hằng tuần', 'Zoom · 90 phút · Premium'], ['Workshop trực tiếp', 'Tại chỗ · 3 giờ · giới hạn chỗ'], ['Onboarding người mới', 'Zoom · 60 phút · mọi thành viên']].map(([t, m]) => `<div style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: ${T.bg};"><span style="color: ${T.ink3};">${I.calendar(14)}</span><div style="flex-grow: 1;"><div style="font-size: 13px; font-weight: 600;">${t}</div><div class="muted" style="font-size: 11px;">${m}</div></div>${I.right(14)}</div>`).join('')}
    </div>
  </aside>
</div>`;

// ---------- registry ----------
const SCREENS = [
  { key: 'feed', file: 'Main', title: 'Bảng tin', group: 'Thành viên', build: () => shell({ active: 'feed', main: feedMain, height: 1560 }), h: 1560 },
  { key: 'compose', file: 'Composer', title: 'Tạo bài viết (nền cho status ngắn)', group: 'Thành viên', build: () => shell({ active: 'feed', main: composerMain, height: 1560 }), h: 1560 },
  { key: 'post', file: 'PostDetail', title: 'Chi tiết bài viết và bình luận', group: 'Thành viên', build: () => shell({ active: 'feed', main: postDetailMain, height: 2500 }), h: 2500 },
  { key: 'courses', file: 'Courses', title: 'Thư viện khóa học', group: 'Thành viên', build: () => shell({ active: 'courses', main: coursesMain }) },
  { key: 'course', file: 'CourseOverview', title: 'Chi tiết khóa học', group: 'Thành viên', build: () => shell({ active: 'courses', main: courseOverviewMain, height: 1500 }), h: 1500 },
  { key: 'classroom', file: 'Classroom', title: 'Bài học (đã trả phí)', group: 'Thành viên', build: () => shell({ active: 'courses', main: classroomMain }) },
  { key: 'classroom-free', file: 'ClassroomFree', title: 'Bài học (thành viên miễn phí)', group: 'Thành viên', build: () => shell({ active: 'courses', main: classroomFreeMain }) },
  { key: 'store', file: 'Store', title: 'Cửa hàng', group: 'Thành viên', build: () => shell({ active: 'store', main: storeMain }) },
  { key: 'product', file: 'ProductDetail', title: 'Chi tiết sản phẩm', group: 'Thành viên', build: () => shell({ active: 'store', main: productDetailMain, height: 2100 }), h: 2100 },
  { key: 'events', file: 'Events', title: 'Sự kiện', group: 'Thành viên', build: () => shell({ active: 'events', main: eventsMain }) },
  { key: 'event', file: 'EventDetail', title: 'Chi tiết sự kiện', group: 'Thành viên', build: () => shell({ active: 'events', main: eventDetailMain, height: 1500 }), h: 1500 },
  { key: 'affiliate', file: 'Affiliate', title: 'Xếp hạng cộng sự', group: 'Thành viên', build: () => shell({ active: 'affiliate', main: affiliateMain }) },
  { key: 'messages', file: 'Messages', title: 'Tin nhắn', group: 'Thành viên', build: () => shell({ active: 'messages', main: messagesMain }) },
  { key: 'notifications', file: 'Notifications', title: 'Thông báo', group: 'Thành viên', build: () => shell({ active: 'notifications', main: notificationsMain }) },
  { key: 'profile', file: 'Profile', title: 'Hồ sơ thành viên', group: 'Thành viên', build: () => shell({ active: 'members', main: profileMain }), h: 1100 },
  { key: 'profile-edit', file: 'ProfileEdit', title: 'Tài khoản · Hồ sơ (chỉnh sửa)', group: 'Thành viên', build: () => shell({ active: 'account', main: profileEditMain }), h: 1150 },
  { key: 'my-affiliate', file: 'AffiliateWallet', title: 'Tài khoản · Cộng sự (ví và rút tiền)', group: 'Thành viên', build: () => shell({ active: 'affiliate', main: affiliateWalletMain }), h: 1250 },
  { key: 'account', file: 'AccountBilling', title: 'Tài khoản · Gói và thanh toán', group: 'Thành viên', build: () => shell({ active: 'account', main: accountBillingMain }) },
  { key: 'checkout', file: 'Checkout', title: 'Thanh toán gói Premium', group: 'Thành viên', build: () => checkoutBody, standalone: true },
  { key: 'signup', file: 'SignupLanding', title: 'Tạo hội của bạn (đăng ký)', group: 'Chủ hội', build: () => signupBody, standalone: true },
  { key: 'signup-plan', file: 'SignupPlan', title: 'Chọn gói tháng hoặc năm', group: 'Chủ hội', build: () => signupPlanBody, standalone: true },
  { key: 'ws-home', file: 'WorkspaceHome', title: 'Hội của tôi', group: 'Chủ hội', build: () => wsShell({ active: 'ws-home', main: wsHomeMain }), h: 1100 },
  { key: 'ws-create', file: 'WorkspaceCreate', title: 'Tạo hội của bạn', group: 'Chủ hội', build: () => wsShell({ active: 'ws-home', main: wsCreateMain }) },
  { key: 'event-create', file: 'EventCreate', title: 'Tạo sự kiện', group: 'Chủ hội', build: () => shell({ active: 'events', main: eventCreateMain, height: 1700 }), h: 1700 },
  { key: 'course-create', file: 'CourseCreate', title: 'Tạo khóa học', group: 'Chủ hội', build: () => shell({ active: 'courses', main: courseCreateMain, height: 1500 }), h: 1500 },
  { key: 'course-builder', file: 'CourseBuilder', title: 'Soạn nội dung khóa học', group: 'Chủ hội', build: () => shell({ active: 'courses', main: courseBuilderMain, height: 1100 }), h: 1100 },
  { key: 'members', file: 'Members', title: 'Quản trị thành viên', group: 'Chủ hội', build: () => shell({ active: 'members', main: membersMain }) },
  { key: 's-overview', file: 'SettingsOverview', title: 'Cài đặt · Tổng quan', group: 'Chủ hội', build: () => shell({ active: 'settings', main: overviewMain }) },
  { key: 's-general', file: 'SettingsGeneral', title: 'Cài đặt · Chung', group: 'Chủ hội', build: () => shell({ active: 'settings', main: generalMain }), h: 1100 },
  { key: 'settings', file: 'Pricing', title: 'Cài đặt · Giá và gói', group: 'Chủ hội', build: () => shell({ active: 'settings', main: pricingMain }) },
  { key: 's-affiliate', file: 'SettingsAffiliate', title: 'Cài đặt · Cộng sự', group: 'Chủ hội', build: () => shell({ active: 'settings', main: affiliateSettingsMain }) },
  { key: 's-affiliate-payouts', file: 'SettingsAffiliatePayouts', title: 'Cài đặt · Cộng sự · Yêu cầu rút', group: 'Chủ hội', build: () => shell({ active: 'settings', main: affiliatePayoutsMain }), h: 1250 },
  { key: 's-plugins', file: 'SettingsPlugins', title: 'Cài đặt · Tiện ích', group: 'Chủ hội', build: () => shell({ active: 'settings', main: pluginsMain }), h: 1100 },
  { key: 's-feed', file: 'SettingsFeed', title: 'Cài đặt · Bảng tin', group: 'Chủ hội', build: () => shell({ active: 'settings', main: feedSettingsMain }), h: 1100 },
  { key: 's-payout', file: 'SettingsPayout', title: 'Cài đặt · Thanh toán', group: 'Chủ hội', build: () => shell({ active: 'settings', main: payoutMain }), h: 1150 },
  { key: 'revenue', file: 'Revenue', title: 'Doanh thu', group: 'Chủ hội', build: () => shell({ active: 'revenue', main: revenueMain }) },
  { key: 'sa-overview', file: 'AdminOverview', title: 'Hệ thống · Tổng quan', group: 'Quản trị hệ thống', build: () => saShell({ active: 'sa-overview', main: saOverviewMain }) },
  { key: 'sa-communities', file: 'AdminCommunities', title: 'Hệ thống · Hội', group: 'Quản trị hệ thống', build: () => saShell({ active: 'sa-communities', main: saCommunitiesMain }) },
  { key: 'sa-payments', file: 'AdminPayments', title: 'Hệ thống · Thanh toán và đối soát', group: 'Quản trị hệ thống', build: () => saShell({ active: 'sa-payments', main: saPaymentsMain }), h: 1050 },
  { key: 'sa-affiliate', file: 'AdminAffiliate', title: 'Hệ thống · Cộng sự nền tảng', group: 'Quản trị hệ thống', build: () => saShell({ active: 'sa-affiliate', main: saAffiliateMain }), h: 1100 },
  { key: 'sa-plans', file: 'AdminPlans', title: 'Hệ thống · Gói nền tảng', group: 'Quản trị hệ thống', build: () => saShell({ active: 'sa-plans', main: saPlansMain }) },
  { key: 'mobile', file: 'Mobile', title: 'Bảng tin trên điện thoại', group: 'Thành viên', build: () => mobileBody, standalone: true, phone: true },
  { key: 'about', file: 'CommunityAbout', title: 'Trang giới thiệu hội (đích của link hội)', group: 'Công khai', build: () => aboutBody, standalone: true, h: 1400 },
  { key: 'login', file: 'Login', title: 'Đăng nhập', group: 'Công khai', build: () => loginBody, standalone: true },
  { key: 'register', file: 'Register', title: 'Đăng ký tài khoản', group: 'Công khai', build: () => registerBody, standalone: true },
  { key: 'forgot', file: 'ForgotPassword', title: 'Quên mật khẩu', group: 'Công khai', build: () => forgotBody, standalone: true },
  { key: 'forgot-sent', file: 'ForgotSent', title: 'Đã gửi link đặt lại', group: 'Công khai', build: () => forgotSentBody, standalone: true },
  { key: 'reset-password', file: 'ResetPassword', title: 'Đặt mật khẩu mới', group: 'Công khai', build: () => resetBody, standalone: true },
  { key: 'verify-email', file: 'VerifyEmail', title: 'Xác minh email', group: 'Công khai', build: () => verifyBody, standalone: true },
  { key: 'discovery', file: 'Discovery', title: 'Khám phá (công khai)', group: 'Công khai', build: () => discoveryBody, standalone: true },
];

// ---------- canvas artboards ----------
DEMO = false;
const files = {};
for (const s of SCREENS) files[`${s.file}.dc.html`] = doc(s.build());
files['DirectionB.dc.html'] = doc(directionB);
for (const [name, html] of Object.entries(files)) writeFileSync(join(here, name), html, 'utf8');

const rows = [
  ['Main', 'Composer', 'PostDetail'],
  ['Courses', 'CourseOverview', 'Classroom'],
  ['ClassroomFree'],
  ['Store', 'ProductDetail', 'Events'],
  ['EventDetail', 'Affiliate'],
  ['Messages', 'Notifications', 'AccountBilling'],
  ['Profile', 'ProfileEdit', 'Checkout'],
  ['AffiliateWallet', 'SignupLanding'],
  ['SignupPlan', 'WorkspaceHome', 'WorkspaceCreate'],
  ['CourseCreate', 'CourseBuilder', 'EventCreate'],
  ['Members'],
  ['SettingsOverview', 'SettingsGeneral'],
  ['Pricing', 'SettingsAffiliate', 'SettingsAffiliatePayouts'],
  ['SettingsPlugins'],
  ['SettingsFeed', 'SettingsPayout', 'Revenue'],
  ['AdminOverview', 'AdminCommunities', 'AdminPayments'],
  ['AdminPlans', 'AdminAffiliate'],
  ['CommunityAbout'],
  ['Login', 'Register', 'VerifyEmail'],
  ['ForgotPassword', 'ForgotSent', 'ResetPassword'],
];
const artboards = [];
let y = 0;
for (const row of rows) {
  let rowH = 0;
  row.forEach((f, i) => {
    const s = SCREENS.find((x) => x.file === f);
    const h = s.h || 960;
    artboards.push({ file: `${f}.dc.html`, title: s.title, x: i * 1540, y, w: 1440, h });
    rowH = Math.max(rowH, h);
  });
  y += rowH + 140;
}
artboards.push({ file: 'Discovery.dc.html', title: 'Khám phá (công khai)', x: 0, y, w: 1440, h: 960 });
artboards.push({ file: 'Mobile.dc.html', title: 'Bảng tin · điện thoại', x: 1540, y, w: 390, h: 844 });
artboards.push({ file: 'DirectionB.dc.html', title: 'Hướng B · phác thảo', x: 2030, y, w: 1440, h: 960 });

const canvas = {
  artboards,
  annotations: [
    { id: 'huong-a', x: 0, y: -170, w: 560, text: 'Hướng A (đề xuất): giấy ấm, sidebar nâu tối, tiêu đề Montserrat, chữ Open Sans, nhấn cam đất và xanh ngọc, icon Lucide. Ba vai trò: Thành viên (hàng 1–4, gồm góc nhìn miễn phí và trang thanh toán), Chủ hội (hàng 4–7: Hội của tôi, Tạo hội, quản trị và cài đặt), Quản trị hệ thống (hàng 8–9). Hàng cuối: trang công khai, di động, hướng thay thế.' },
    { id: 'so-lieu-mau', x: 1540, y: -120, w: 380, text: 'Số liệu, tên và giá trong các màn hình là dữ liệu mẫu để nhìn bố cục.' },
  ],
  launch: { view: 'canvas' },
};
writeFileSync(join(here, 'canvas.json'), JSON.stringify(canvas, null, 2), 'utf8');
console.log('wrote', Object.keys(files).length, 'artboards + canvas.json');

// ---------- standalone demo: hoi-minh-demo.html ----------
DEMO = true;
const helmetCss = helmet.match(/<style>([\s\S]*?)<\/style>/)[1];
const fontLink = helmet.match(/<link[^>]+>/)[0];
const groups = [...new Set(SCREENS.map((s) => s.group))];
const demoSections = SCREENS.map((s) => `<section class="screen" data-screen="${s.key}" hidden>${s.phone ? `<div style="display: flex; justify-content: center; padding: 40px 0; min-height: calc(100vh - 44px); background: #E9E1D3;"><div style="border-radius: 40px; padding: 12px; background: #111; box-shadow: 0 30px 60px rgba(0,0,0,0.25);"><div style="border-radius: 30px; overflow: hidden;">${s.build()}</div></div></div>` : s.standalone ? `<div style="display: flex; justify-content: center; overflow-x: auto;">${s.build()}</div>` : s.build()}</section>`).join('\n');
const demoHtml = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1440">
<title>Hội Mình · Demo giao diện</title>
${fontLink}
<style>
${helmetCss}
body { min-width: 1440px; }
[hidden] { display: none !important; }
#demo-bar { position: sticky; top: 0; z-index: 50; height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 20px; background: #111; color: #EDE7DC; font-size: 13px; }
#demo-bar select { height: 30px; border-radius: 8px; border: 1px solid #444; background: #1c1c1c; color: #EDE7DC; font: inherit; padding: 0 8px; }
#demo-bar button { height: 30px; border-radius: 8px; border: 1px solid #444; background: #1c1c1c; color: #EDE7DC; font: inherit; padding: 0 10px; cursor: pointer; }
[data-go] { cursor: pointer; }
.screen > div[data-checkout] { width: 100%; height: auto; min-height: calc(100vh - 44px); overflow: visible; }
</style>
</head>
<body>
<div id="demo-bar">
  <strong style="letter-spacing: 0.04em;">HỘI MÌNH · DEMO GIAO DIỆN</strong>
  <span style="opacity: 0.6;">|</span>
  <button id="prev" type="button">‹ Trước</button>
  <select id="pick">${groups.map((g) => `<optgroup label="${g}">${SCREENS.filter((s) => s.group === g).map((s) => `<option value="${s.key}">${s.title}</option>`).join('')}</optgroup>`).join('')}</select>
  <button id="next" type="button">Tiếp ›</button>
  <span style="opacity: 0.6; margin-left: auto;">Ba vai trò: Quản trị hệ thống · Chủ hội · Thành viên. Bấm vào mục ở thanh bên, biểu tượng tin nhắn / thông báo / avatar, hoặc menu cài đặt để chuyển màn hình. Số liệu là dữ liệu mẫu.</span>
</div>
${demoSections}
<script>
(function () {
  var keys = ${JSON.stringify(SCREENS.map((s) => s.key))};
  var pick = document.getElementById('pick');
  function show(key) {
    if (keys.indexOf(key) < 0) return;
    document.querySelectorAll('.screen').forEach(function (el) { el.hidden = el.dataset.screen !== key; });
    pick.value = key;
    try { history.replaceState(null, '', '#' + key); } catch (e) {}
    window.scrollTo(0, 0);
  }
  pick.addEventListener('change', function () { show(pick.value); });
  document.getElementById('prev').addEventListener('click', function () { show(keys[(keys.indexOf(pick.value) - 1 + keys.length) % keys.length]); });
  document.getElementById('next').addEventListener('click', function () { show(keys[(keys.indexOf(pick.value) + 1) % keys.length]); });
  document.addEventListener('click', function (e) {
    var go = e.target.closest && e.target.closest('[data-go]');
    if (go && go.dataset.go) { e.preventDefault(); show(go.dataset.go); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') document.getElementById('next').click();
    if (e.key === 'ArrowLeft') document.getElementById('prev').click();
  });
  show((location.hash || '#feed').slice(1));
})();
</script>
</body>
</html>
`;
writeFileSync(join(here, 'hoi-minh-demo.html'), demoHtml, 'utf8');
console.log('wrote hoi-minh-demo.html with', SCREENS.length, 'screens');
