// Dựng bộ nhãn động "Mèo Mình" (hình vẽ gốc của Hội Mình) thành SVG động: nhân vật hoạt hình 2D, chuyển động bằng CSS
// ngay trong tệp SVG nên thẻ <img> vẫn chạy (nhẹ hơn GIF nhiều, nét sắc khi phóng to, nền trong suốt đúng cả ở chế độ tối).
// Nhãn không có chữ; vài ký hiệu (dấu hỏi, chữ Z) vẽ bằng font Baloo 2 (giấy phép SIL OFL) đổi thành đường vẽ.
//
// Chạy lại khi sửa hình (cần mạng để cài hai gói tạm, không thêm vào dự án):
//   mkdir -p /tmp/meo && (cd /tmp/meo && npm init -y && npm i opentype.js@1.3.4 @fontsource/baloo-2@5)
//   NODE_PATH=/tmp/meo/node_modules node scripts/stickers/meo-minh.mjs
// Kết quả ghi vào apps/web/public/stickers/meo-minh/<tên>.svg. Danh sách nhãn và từ khóa gợi ý nằm ở migration 0022;
// thêm nhãn mới vào bộ này thì thêm cả dòng ở đó (migration mới), hoặc tải lên ở Hệ thống · Nhãn dán.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(join(process.env.NODE_PATH ?? process.cwd(), 'x.js'));
const opentype = require('opentype.js');
const fontDir = join(dirname(require.resolve('@fontsource/baloo-2/package.json')), 'files');
const fonts = ['latin', 'vietnamese'].map((s) => opentype.loadSync(join(fontDir, `baloo-2-${s}-800-normal.woff`)));

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'apps', 'web', 'public', 'stickers', 'meo-minh');

// ---- Màu ----
const INK = '#3B2A20';
const CREAM = '#FFF6EA';
const ORANGE = '#F5A04A';
const PINK = '#FF9AA2';
const RED = '#F0524F';

// ---- Chữ thành đường vẽ ----
function glyphOf(ch) {
  for (const f of fonts) {
    const g = f.charToGlyph(ch);
    if (g && g.index !== 0) return { f, g };
  }
  throw new Error(`Font không có ký tự "${ch}"`);
}
function textPath(text, { cx, baseline, maxWidth, size }) {
  const chars = [...text.normalize('NFC')];
  const width = (s) => chars.reduce((w, ch) => { const { f, g } = glyphOf(ch); return w + (g.advanceWidth * s) / f.unitsPerEm; }, 0);
  let s = size;
  while (width(s) > maxWidth) s -= 1;
  let x = cx - width(s) / 2;
  let d = '';
  for (const ch of chars) {
    const { f, g } = glyphOf(ch);
    d += g.getPath(x, baseline, s).toPathData(1);
    x += (g.advanceWidth * s) / f.unitsPerEm;
  }
  return d;
}
/** Ký hiệu rời (dấu hỏi, chữ Z...) cũng vẽ bằng font. */
function glyphMark(text, x, baseline, size, color, cls = '') {
  const d = textPath(text, { cx: x, baseline, maxWidth: 999, size });
  return `<g class="${cls}"><path d="${d}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/><path d="${d}" fill="${color}"/></g>`;
}

// ---- Bộ phận ----
/** Nét viền nâu bo tròn; `w` là độ dày. */
const S = (w = 5) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const heartPath = (cx, cy, r) => `M${cx} ${cy + r * 0.9} C${cx - r * 1.6} ${cy - r * 0.1} ${cx - r * 0.9} ${cy - r * 1.4} ${cx} ${cy - r * 0.5} C${cx + r * 0.9} ${cy - r * 1.4} ${cx + r * 1.6} ${cy - r * 0.1} ${cx} ${cy + r * 0.9} Z`;
const star4 = (cx, cy, r) => `M${cx} ${cy - r} Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z`;
const star5 = (cx, cy, r) => {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.48 : r; pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`); }
  return `M${pts.join(' L')} Z`;
};

const body = () => `
  <path class="tail" d="M160 168 C196 166 204 130 190 112" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
  <path class="tail" d="M160 168 C196 166 204 130 190 112" fill="none" stroke="${ORANGE}" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="96" cy="184" rx="16" ry="11" fill="${CREAM}" ${S()}/>
  <ellipse cx="144" cy="184" rx="16" ry="11" fill="${CREAM}" ${S()}/>
  <ellipse cx="120" cy="152" rx="50" ry="36" fill="${CREAM}" ${S()}/>
  <ellipse cx="120" cy="160" rx="26" ry="18" fill="#FFFFFF" opacity=".85"/>`;

const ears = () => `
  <path d="M60 74 L66 22 L108 50 Z" fill="${CREAM}" ${S()}/>
  <path d="M71 60 L74 36 L95 50 Z" fill="${PINK}"/>
  <path d="M180 74 L174 22 L132 50 Z" fill="${CREAM}" ${S()}/>
  <path d="M169 60 L166 36 L145 50 Z" fill="${PINK}"/>`;

const head = () => `
  <clipPath id="hc"><ellipse cx="120" cy="98" rx="72" ry="60"/></clipPath>
  <ellipse cx="120" cy="98" rx="72" ry="60" fill="${CREAM}"/>
  <g clip-path="url(#hc)">
    <path d="M82 38 Q120 22 158 38 Q148 62 132 58 Q120 70 108 58 Q92 62 82 38 Z" fill="${ORANGE}"/>
    <path d="M42 90 Q58 84 66 96 Q56 106 42 104 Z" fill="${ORANGE}"/>
  </g>
  <ellipse cx="120" cy="98" rx="72" ry="60" fill="none" ${S()}/>
  <path d="M112 40 L114 54 M120 38 L120 54 M128 40 L126 54" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" opacity=".55"/>
  <path d="M46 112 L72 116 M46 124 L72 122 M194 112 L168 116 M194 124 L168 122" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".6"/>`;

const cheeks = (o = 0.75) => `<ellipse cx="80" cy="116" rx="12" ry="7" fill="${PINK}" opacity="${o}"/><ellipse cx="160" cy="116" rx="12" ry="7" fill="${PINK}" opacity="${o}"/>`;
const nose = () => `<path d="M114 108 L126 108 L120 115 Z" fill="${PINK}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;

const openEye = (x, y, r = 1) => `<ellipse cx="${x}" cy="${y}" rx="${9 * r}" ry="${12 * r}" fill="${INK}"/><circle cx="${x + 3 * r}" cy="${y - 4 * r}" r="${3.6 * r}" fill="#fff"/><circle cx="${x - 3 * r}" cy="${y + 4 * r}" r="${1.6 * r}" fill="#fff"/>`;
const EYES = {
  open: () => `<g class="blink">${openEye(95, 96)}${openEye(145, 96)}</g>`,
  happy: () => `<path d="M84 100 Q95 84 106 100 M134 100 Q145 84 156 100" fill="none" ${S(6)}/>`,
  laugh: () => `<path d="M86 88 L102 97 L86 106 M154 88 L138 97 L154 106" fill="none" ${S(6)}/>`,
  closed: () => `<path d="M84 98 Q95 106 106 98 M134 98 Q145 106 156 98" fill="none" ${S(6)}/>`,
  sad: () => `<path d="M84 100 Q95 92 106 100 M134 100 Q145 92 156 100" fill="none" ${S(6)}/><path d="M82 84 L104 78 M158 84 L136 78" ${S()}/>`,
  heart: () => `<g class="beat" style="transform-origin:95px 96px"><path d="${heartPath(95, 96, 13)}" fill="${RED}" ${S(3.5)}/></g><g class="beat" style="transform-origin:145px 96px"><path d="${heartPath(145, 96, 13)}" fill="${RED}" ${S(3.5)}/></g>`,
  star: () => `<g class="twinkle" style="transform-origin:95px 96px"><path d="${star5(95, 96, 15)}" fill="#FFC531" ${S(3.5)}/></g><g class="twinkle" style="transform-origin:145px 96px"><path d="${star5(145, 96, 15)}" fill="#FFC531" ${S(3.5)}/></g>`,
  surprised: () => `<g class="blink"><circle cx="95" cy="96" r="13" fill="#fff" ${S(4)}/><circle cx="95" cy="97" r="7" fill="${INK}"/><circle cx="145" cy="96" r="13" fill="#fff" ${S(4)}/><circle cx="145" cy="97" r="7" fill="${INK}"/></g><path d="M82 74 Q95 66 106 74 M134 74 Q145 66 158 74" fill="none" ${S()}/>`,
  angry: () => `${openEye(95, 98, 0.85)}${openEye(145, 98, 0.85)}<path d="M80 78 L108 90 M160 78 L132 90" ${S(7)}/>`,
  worried: () => `<g class="blink">${openEye(95, 98, 0.85)}${openEye(145, 98, 0.85)}</g><path d="M82 84 L106 76 M158 84 L134 76" ${S()}/>`,
  determined: () => `<g class="blink">${openEye(95, 98, 0.9)}${openEye(145, 98, 0.9)}</g><path d="M80 80 L108 88 M160 80 L132 88" ${S(6)}/>`,
  puzzled: () => `<g class="blink">${openEye(95, 98, 0.8)}${openEye(145, 96, 1.05)}</g><path d="M82 84 L106 86 M134 72 Q146 64 158 72" fill="none" ${S()}/>`,
  wink: () => `${openEye(95, 96)}<path d="M134 98 Q145 86 156 98" fill="none" ${S(6)}/>`,
  sleepy: () => `<path d="M84 100 Q95 106 106 100 M134 100 Q145 106 156 100" fill="none" ${S(5)}/>`,
};
const MOUTHS = {
  cat: () => `<path d="M106 120 Q113 128 120 120 Q127 128 134 120" fill="none" ${S(4)}/>`,
  open: () => `<path d="M104 119 Q120 146 136 119 Z" fill="#8B2E2E" ${S(4)}/><path d="M111 132 Q120 126 129 132 Q120 141 111 132 Z" fill="${PINK}"/>`,
  big: () => `<path d="M100 118 Q120 154 140 118 Z" fill="#8B2E2E" ${S(4)}/><path d="M108 136 Q120 128 132 136 Q120 148 108 136 Z" fill="${PINK}"/>`,
  o: () => `<ellipse cx="120" cy="128" rx="8" ry="10" fill="#8B2E2E" ${S(4)}/>`,
  smallO: () => `<ellipse cx="120" cy="126" rx="5" ry="6" fill="#8B2E2E" ${S(3.5)}/>`,
  smile: () => `<path d="M108 121 Q120 132 132 121" fill="none" ${S(4)}/>`,
  frown: () => `<path d="M108 130 Q120 119 132 130" fill="none" ${S(4)}/>`,
  wavy: () => `<path d="M104 127 Q110 121 116 127 Q122 133 128 127 Q134 121 138 127" fill="none" ${S(4)}/>`,
  cry: () => `<path d="M104 132 Q120 112 136 132 Z" fill="#8B2E2E" ${S(4)}/>`,
};

const paw = (x, y, rx = 13, ry = 11) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${CREAM}" ${S()}/>`;
const arm = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${INK}" stroke-width="22" stroke-linecap="round"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${CREAM}" stroke-width="12" stroke-linecap="round"/>`;
const ARMS = {
  rest: () => `${paw(98, 160)}${paw(142, 160)}`,
  wave: () => `${paw(98, 160)}<g class="wave" style="transform-origin:158px 142px">${arm(158, 142, 200, 92)}${paw(204, 86, 15, 13)}<path d="M198 76 L200 70 M206 74 L209 68" ${S(3)}/></g>`,
  cheer: () => `<g class="cheer-l" style="transform-origin:80px 140px">${arm(80, 140, 42, 74)}${paw(38, 68, 14, 12)}</g><g class="cheer-r" style="transform-origin:160px 140px">${arm(160, 140, 198, 74)}${paw(202, 68, 14, 12)}</g>`,
  heart: () => `<g class="beat" style="transform-origin:120px 158px"><path d="${heartPath(120, 160, 22)}" fill="${RED}" ${S(4.5)}/><path d="M106 148 Q110 142 116 144" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".8"/></g>${paw(96, 166)}${paw(144, 166)}`,
  thumb: () => `${paw(98, 160)}<g class="pump" style="transform-origin:170px 140px">${arm(160, 146, 190, 128)}<rect x="180" y="112" width="32" height="28" rx="11" fill="${CREAM}" ${S()}/><rect x="186" y="88" width="13" height="30" rx="6.5" fill="${CREAM}" ${S()}/></g>`,
  fist: () => `${paw(98, 160)}<g class="pump" style="transform-origin:160px 148px">${arm(158, 142, 200, 98)}<circle cx="204" cy="92" r="15" fill="${CREAM}" ${S()}/><path d="M196 88 L212 88 M196 95 L212 95" ${S(3)}/></g>`,
  pray: () => `<ellipse cx="111" cy="146" rx="11" ry="19" transform="rotate(-14 111 146)" fill="${CREAM}" ${S()}/><ellipse cx="129" cy="146" rx="11" ry="19" transform="rotate(14 129 146)" fill="${CREAM}" ${S()}/><path d="M106 134 L108 128 M134 134 L132 128" ${S(3)}/>`,
  book: () => `<g class="bob"><path d="M74 150 L120 160 L166 150 L166 188 L120 196 L74 188 Z" fill="#4A90D9" ${S()}/><path d="M80 152 L120 161 L120 190 L80 182 Z" fill="#fff" ${S(3.5)}/><path d="M160 152 L120 161 L120 190 L160 182 Z" fill="#fff" ${S(3.5)}/><path d="M88 162 L112 167 M88 170 L112 175 M128 167 L152 162 M128 175 L152 170" stroke="#9BB5D6" stroke-width="3" stroke-linecap="round"/>${paw(72, 168, 11, 10)}${paw(168, 168, 11, 10)}</g>`,
  stop: () => `${paw(98, 160)}<g class="wiggle" style="transform-origin:164px 150px">${arm(158, 142, 198, 110)}<ellipse cx="202" cy="98" rx="17" ry="19" fill="${CREAM}" ${S()}/><path d="M194 86 L194 80 M202 84 L202 77 M210 86 L210 80" ${S(3)}/><circle cx="202" cy="102" r="5" fill="${PINK}"/></g>`,
  cover: () => `${paw(104, 134, 12, 10)}${paw(136, 134, 12, 10)}`,
};

const EXTRAS = {
  hearts: () => [[52, 62, 9, 0], [190, 52, 11, 0.6], [200, 104, 8, 1.2], [40, 110, 7, 1.7]].map(([x, y, r, d]) => `<path class="float" style="animation-delay:${d}s;transform-origin:${x}px ${y}px" d="${heartPath(x, y, r)}" fill="${RED}" stroke="${INK}" stroke-width="2.5"/>`).join(''),
  tears: () => `<path d="M88 104 Q84 140 86 160 L96 160 Q98 140 98 104 Z" fill="#7CC7F2" opacity=".9"/><path d="M152 104 Q156 140 154 160 L144 160 Q142 140 142 104 Z" fill="#7CC7F2" opacity=".9"/>${[0, 0.5].map((d, i) => `<path class="drop" style="animation-delay:${d}s" d="M${i ? 160 : 80} 150 Q${i ? 166 : 74} 160 ${i ? 160 : 80} 166 Q${i ? 154 : 86} 160 ${i ? 160 : 80} 150 Z" fill="#7CC7F2" stroke="${INK}" stroke-width="2"/>`).join('')}`,
  joyTears: () => `<path class="drop" d="M74 92 Q66 100 72 106 Q80 104 74 92 Z" fill="#7CC7F2" stroke="${INK}" stroke-width="2"/><path class="drop" style="animation-delay:.4s" d="M166 92 Q174 100 168 106 Q160 104 166 92 Z" fill="#7CC7F2" stroke="${INK}" stroke-width="2"/>`,
  sweat: () => `<path class="slide" d="M176 50 Q166 66 176 72 Q186 66 176 50 Z" fill="#7CC7F2" stroke="${INK}" stroke-width="3"/>`,
  zzz: () => `${glyphMark('Z', 178, 52, 30, '#7C8CF2', 'zz')}${glyphMark('z', 202, 30, 22, '#7C8CF2', 'zz zz2')}<path d="M44 36 A18 18 0 1 0 60 62 A14 14 0 1 1 44 36 Z" fill="#FFD95A" stroke="${INK}" stroke-width="3"/>`,
  question: () => `${glyphMark('?', 192, 64, 44, '#7C8CF2', 'q1')}${glyphMark('?', 48, 56, 32, '#FFB238', 'q2')}`,
  exclaim: () => `${glyphMark('!', 192, 62, 46, '#FF6B57', 'q1')}${glyphMark('!', 48, 58, 34, '#FFB238', 'q2')}<path class="burst" d="M200 96 L220 92 M196 110 L216 116 M44 96 L24 92 M46 110 L26 116" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  anger: () => `<g class="beat" style="transform-origin:178px 52px"><path d="M170 44 Q178 50 186 44 M170 60 Q178 54 186 60 M170 44 Q176 52 170 60 M186 44 Q180 52 186 60" fill="none" stroke="${RED}" stroke-width="5" stroke-linecap="round"/></g><g class="puff"><circle cx="52" cy="54" r="9" fill="#E4E4E4" stroke="${INK}" stroke-width="2.5"/><circle cx="40" cy="44" r="6" fill="#E4E4E4" stroke="${INK}" stroke-width="2.5"/></g>`,
  sparkles: () => [[44, 60, 12, 0], [196, 50, 14, 0.5], [206, 120, 9, 1], [32, 122, 8, 1.4]].map(([x, y, r, d]) => `<path class="twinkle" style="animation-delay:${d}s;transform-origin:${x}px ${y}px" d="${star4(x, y, r)}" fill="#FFC531" stroke="${INK}" stroke-width="2.5"/>`).join(''),
  confetti: () => [['#FF6B57', 40, 0], ['#4A90D9', 70, 0.4], ['#FFC531', 172, 0.2], ['#5BC48A', 200, 0.7], ['#C77DFF', 120, 1], ['#FF9AA2', 150, 0.9], ['#4A90D9', 24, 1.3], ['#FFC531', 214, 1.5]].map(([c, x, d]) => `<rect class="confetti" style="animation-delay:${d}s;transform-origin:${x + 4}px 20px" x="${x}" y="14" width="8" height="12" rx="2" fill="${c}" stroke="${INK}" stroke-width="1.5"/>`).join(''),
  partyHat: () => `<path d="M104 46 L120 2 L136 46 Z" fill="#C77DFF" ${S(4)}/><path d="M110 30 L130 30 M114 18 L126 18" stroke="#FFC531" stroke-width="4"/><circle cx="120" cy="4" r="6" fill="#FFC531" stroke="${INK}" stroke-width="3"/>`,
  headband: () => `<path d="M50 74 Q120 56 190 74 L188 86 Q120 68 52 86 Z" fill="${RED}" ${S(4)}/><circle cx="120" cy="70" r="9" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="120" cy="70" r="4.5" fill="${RED}"/><path class="flutter" style="transform-origin:190px 78px" d="M188 78 L214 66 L206 82 L216 94 L188 84 Z" fill="${RED}" ${S(3.5)}/>`,
  clock: () => `<g transform="translate(50 54)"><circle r="22" fill="#fff" ${S()}/><circle r="3" fill="${INK}"/><path d="M0 0 L0 -13" ${S(3.5)}/><path class="tick" d="M0 0 L10 6" ${S(3)}/></g>`,
  motion: () => `<path class="burst" d="M206 70 Q214 84 206 98 M216 64 Q228 84 216 104" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
  smallHeart: () => `<path class="float" style="transform-origin:190px 60px" d="${heartPath(190, 60, 10)}" fill="${RED}" stroke="${INK}" stroke-width="2.5"/>${EXTRAS.sparkles().split('</path>').slice(0, 2).join('</path>')}</path>`,
  pencil: () => `<g class="wiggle" style="transform-origin:200px 120px"><path d="M188 150 L210 96 L220 100 L198 154 Z" fill="#FFC531" ${S(3.5)}/><path d="M188 150 L198 154 L190 164 Z" fill="${CREAM}" ${S(3)}/></g>`,
};

// ---- Chuyển động (chạy được trong thẻ <img>, tự dừng khi người dùng bật "giảm chuyển động") ----
const CSS = `
.char{animation:bounce 1.4s ease-in-out infinite;transform-origin:120px 200px}
.bounce-fast .char{animation-duration:.7s}
.shake .char{animation:shake .5s ease-in-out infinite}
.sway .char{animation:sway 2.6s ease-in-out infinite}
.bow .char{animation:bow 1.8s ease-in-out infinite}
.blink{animation:blink 3.2s infinite;transform-origin:120px 96px}
.tail{animation:wag 1.2s ease-in-out infinite;transform-origin:160px 168px}
.wave{animation:wave .9s ease-in-out infinite}
.cheer-l{animation:cheerl .6s ease-in-out infinite}
.cheer-r{animation:cheerr .6s ease-in-out infinite}
.pump{animation:pump .7s ease-in-out infinite}
.wiggle{animation:wiggle .8s ease-in-out infinite}
.beat{animation:beat .8s ease-in-out infinite}
.twinkle{animation:twinkle 1.6s ease-in-out infinite}
.float{animation:float 2.2s ease-in infinite}
.drop{animation:drop 1s ease-in infinite}
.slide{animation:slide 1.6s ease-in infinite}
.zz{animation:zz 2.4s ease-in-out infinite}
.zz2{animation-delay:1.2s}
.q1{animation:hop .9s ease-in-out infinite}
.q2{animation:hop .9s ease-in-out .45s infinite}
.burst{animation:fade 1s ease-in-out infinite}
.puff{animation:puff 1.2s ease-out infinite}
.confetti{animation:confetti 1.8s linear infinite}
.flutter{animation:wiggle .5s ease-in-out infinite}
.tick{animation:spin 2s steps(8) infinite;transform-origin:0 0}
.bob{animation:bob 1.6s ease-in-out infinite}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px) rotate(-2deg)}75%{transform:translateX(4px) rotate(2deg)}}
@keyframes sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes bow{0%,30%,100%{transform:rotate(0)}55%,75%{transform:rotate(9deg) translateY(4px)}}
@keyframes blink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(.12)}}
@keyframes wag{0%,100%{transform:rotate(0)}50%{transform:rotate(-14deg)}}
@keyframes wave{0%,100%{transform:rotate(0)}50%{transform:rotate(-22deg)}}
@keyframes cheerl{0%,100%{transform:rotate(0)}50%{transform:rotate(14deg)}}
@keyframes cheerr{0%,100%{transform:rotate(0)}50%{transform:rotate(-14deg)}}
@keyframes pump{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes wiggle{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@keyframes beat{0%,100%{transform:scale(1)}30%{transform:scale(1.18)}60%{transform:scale(.96)}}
@keyframes twinkle{0%,100%{transform:scale(.6) rotate(0);opacity:.5}50%{transform:scale(1.15) rotate(20deg);opacity:1}}
@keyframes float{0%{transform:translateY(10px) scale(.6);opacity:0}25%{opacity:1}100%{transform:translateY(-30px) scale(1);opacity:0}}
@keyframes drop{0%{transform:translateY(-6px);opacity:0}20%{opacity:1}100%{transform:translateY(26px);opacity:0}}
@keyframes slide{0%{transform:translateY(-4px);opacity:0}25%{opacity:1}100%{transform:translateY(16px);opacity:0}}
@keyframes zz{0%{transform:translate(0,8px);opacity:0}30%{opacity:1}100%{transform:translate(8px,-14px);opacity:0}}
@keyframes hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes fade{0%,100%{opacity:.2}50%{opacity:1}}
@keyframes puff{0%{transform:translate(0,0) scale(.6);opacity:0}30%{opacity:1}100%{transform:translate(-10px,-14px) scale(1.1);opacity:0}}
@keyframes confetti{0%{transform:translateY(-10px) rotate(0);opacity:0}15%{opacity:1}100%{transform:translateY(150px) rotate(300deg);opacity:0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px) rotate(-2deg)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

// ---- Bộ nhãn: tên tệp khớp image_url trong migration 0022 ----
const STICKERS = [
  { slug: 'chao', text: 'Chào cả nhà', color: '#FF6B57', eyes: 'happy', mouth: 'open', arms: 'wave', extras: ['motion'] },
  { slug: 'cam-on', text: 'Cảm ơn nhiều', color: '#FF7FA8', eyes: 'closed', mouth: 'smile', arms: 'pray', extras: ['sparkles'], mood: 'bow' },
  { slug: 'ok', text: 'OK luôn', color: '#3DB46D', eyes: 'wink', mouth: 'open', arms: 'thumb', extras: [] },
  { slug: 'haha', text: 'Haha', color: '#FFB238', eyes: 'laugh', mouth: 'big', arms: 'rest', extras: ['joyTears'], mood: 'shake' },
  { slug: 'huhu', text: 'Huhu', color: '#4A90D9', eyes: 'sad', mouth: 'cry', arms: 'rest', extras: ['tears'] },
  { slug: 'yeu', text: 'Yêu quá', color: '#F0524F', eyes: 'heart', mouth: 'open', arms: 'heart', extras: ['hearts'] },
  { slug: 'wow', text: 'Wow!', color: '#C77DFF', eyes: 'surprised', mouth: 'o', arms: 'cover', extras: ['exclaim'] },
  { slug: 'hoi', text: 'Hả?', color: '#7C8CF2', eyes: 'puzzled', mouth: 'wavy', arms: 'rest', extras: ['question', 'sweat'], mood: 'sway' },
  { slug: 'gian', text: 'Giận rồi', color: '#E0413E', eyes: 'angry', mouth: 'frown', arms: 'rest', extras: ['anger'], mood: 'shake', cheeks: 0.95 },
  { slug: 'co-len', text: 'Cố lên!', color: '#FF6B57', eyes: 'determined', mouth: 'open', arms: 'fist', extras: ['headband'] },
  { slug: 'tuyet', text: 'Tuyệt vời', color: '#F5A623', eyes: 'star', mouth: 'big', arms: 'cheer', extras: ['sparkles'], mood: 'bounce-fast' },
  { slug: 'ngu-ngon', text: 'Ngủ ngon', color: '#7C8CF2', eyes: 'sleepy', mouth: 'smallO', arms: 'rest', extras: ['zzz'], mood: 'sway' },
  { slug: 'xin-loi', text: 'Xin lỗi nha', color: '#4FB3BF', eyes: 'worried', mouth: 'wavy', arms: 'pray', extras: ['sweat'], mood: 'bow' },
  { slug: 'chuc-mung', text: 'Chúc mừng', color: '#C77DFF', eyes: 'happy', mouth: 'big', arms: 'cheer', extras: ['confetti', 'partyHat'], mood: 'bounce-fast' },
  { slug: 'doi-xiu', text: 'Đợi xíu', color: '#F5A04A', eyes: 'wink', mouth: 'cat', arms: 'stop', extras: ['clock'] },
  { slug: 'hoc-bai', text: 'Học bài thôi', color: '#3D8BD9', eyes: 'open', mouth: 'smile', arms: 'book', extras: ['pencil'] },
];

function sticker(s) {
  const front = ['headband', 'partyHat', 'tears', 'joyTears', 'sweat', 'anger'];
  const extrasBack = s.extras.filter((e) => !front.includes(e)).map((e) => EXTRAS[e]()).join('');
  const extrasFront = s.extras.filter((e) => front.includes(e)).map((e) => EXTRAS[e]()).join('');
  // Tay để dưới (rest) vẽ trước đầu; tay giơ lên, tay chắp, ôm sách, ôm tim, che miệng vẽ sau đầu cho khỏi bị che.
  const armsBehind = s.arms === 'rest' ? ARMS.rest() : '';
  const armsFront = s.arms === 'rest' ? '' : ARMS[s.arms]();
  // Không chữ trên nhãn (chủ dự án chốt 27/11/2026): nhìn biểu cảm là hiểu. Khung nhìn ôm sát nhân vật cho to rõ.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 -8 220 220" width="240" height="240">
<style>${CSS}</style>
<g class="${s.mood ?? ''}">
${extrasBack}
<g class="char">
${body()}
${armsBehind}
${ears()}
${head()}
${extrasFront}
${cheeks(s.cheeks)}
${EYES[s.eyes]()}
${nose()}
${MOUTHS[s.mouth]()}
${armsFront}
</g>
</g>
</svg>
`.replace(/\n\s*\n/g, '\n');
}

mkdirSync(outDir, { recursive: true });
for (const s of STICKERS) writeFileSync(join(outDir, `${s.slug}.svg`), sticker(s));
console.log(`Đã dựng ${STICKERS.length} nhãn vào ${outDir}`);
