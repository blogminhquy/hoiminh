// Tấm chứng chỉ dưới dạng một "cảnh": danh sách hình và chữ trên khung 2000 x 1414 (tỉ lệ A4 ngang).
// Cùng một cảnh được vẽ hai lần: SVG trên màn hình và khi in (CertificateSheet), canvas khi xuất ảnh PNG
// (certificate-canvas). Nhờ vậy ảnh tải về giống tấm đang xem, và mọi họa tiết đều tự vẽ, không tải ảnh ngoài.
// Tệp này thuần tính toán (không DOM): hàm đo chữ được truyền vào, nên test được trên Node.
import { HEX, initialsOf } from '@hoiminh/ui/tokens';
import { courseSummary, fitText, fmtCertificateDate, formatCertificateCode, shortUrl, type FittedText, type Measure, type TextStyle } from './certificate';

export const CERT_W = 2000;
export const CERT_H = 1414;

export interface CertificateData {
  code: string;
  learnerName: string;
  courseTitle: string;
  lessonCount: number;
  totalDurationSeconds: number;
  /** Tên giảng viên (chủ khóa); null thì cột chữ ký ghi tên hội. */
  instructor: string | null;
  community: { name: string; logoMark: string; logoColor: string; logoUrl?: string | null } | null;
  completedAt: string;
  verifyUrl: string;
}

export type Anchor = 'start' | 'middle' | 'end';
export type SceneNode =
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill?: string; stroke?: string; sw?: number; opacity?: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; opacity?: number }
  | { t: 'path'; d: string; fill?: string; stroke?: string; sw?: number; opacity?: number; round?: boolean }
  | { t: 'text'; x: number; y: number; text: string; size: number; weight: number; fill: string; anchor: Anchor; italic?: boolean; tracking?: number; opacity?: number; rotate?: number }
  | { t: 'logo'; x: number; y: number; size: number; r: number; url: string | null; mark: string; color: string };

export interface Scene { width: number; height: number; nodes: SceneNode[]; alt: string }

/** Trộn hai màu của hệ thống: t = 0 ra `b`, t = 1 ra `a`. Dùng cho nền giấy ấm và các sắc nhạt của khung. */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v * t + y[i]! * (1 - t)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

const C = {
  paper: mixHex(HEX.goldSoft, HEX.surface, 0.42),
  paperEdge: mixHex(HEX.goldSoft, HEX.surface, 0.8),
  band: HEX.side,
  gold: HEX.gold,
  goldDeep: mixHex(HEX.goldText, HEX.gold, 0.45),
  goldText: HEX.goldText,
  primary: HEX.primary,
  ink: HEX.ink,
  ink2: HEX.ink2,
  ink3: HEX.ink3,
  onDark: HEX.goldSoft,
} as const;

const CX = CERT_W / 2;
const n1 = (v: number) => Math.round(v * 10) / 10;

/** Khung có bốn góc lõm vào (cung tròn tâm tại `pocket`), kiểu khung chứng chỉ cổ điển. */
function pocketFrame(inset: number, pocket: number, radius: number): string {
  const dx = n1(Math.sqrt(Math.max(0, radius * radius - (inset - pocket) * (inset - pocket))));
  const [l, t, r, b] = [inset, inset, CERT_W - inset, CERT_H - inset];
  const [pl, pt, pr, pb] = [pocket, pocket, CERT_W - pocket, CERT_H - pocket];
  return [
    `M${pl + dx} ${t}`, `H${pr - dx}`, `A${radius} ${radius} 0 0 0 ${r} ${pt + dx}`,
    `V${pb - dx}`, `A${radius} ${radius} 0 0 0 ${pr - dx} ${b}`,
    `H${pl + dx}`, `A${radius} ${radius} 0 0 0 ${l} ${pb - dx}`,
    `V${pt + dx}`, `A${radius} ${radius} 0 0 0 ${pl + dx} ${t}`, 'Z',
  ].join(' ');
}

/** Ngôi sao bốn cánh (cạnh lõm) dùng làm họa tiết góc và điểm nhấn trên các đường kẻ. */
function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.16;
  return `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
}

const diamond = (cx: number, cy: number, r: number) => `M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`;

/** Viền răng cưa mềm của con dấu. */
function scallop(cx: number, cy: number, r: number, teeth: number, depth: number): string {
  const pt = (rad: number, a: number) => `${n1(cx + rad * Math.cos(a))} ${n1(cy + rad * Math.sin(a))}`;
  const step = (Math.PI * 2) / teeth;
  let d = `M${pt(r - depth, -Math.PI / 2)}`;
  for (let i = 0; i < teeth; i++) {
    const a = -Math.PI / 2 + i * step;
    d += ` Q${pt(r + depth * 0.9, a + step / 2)} ${pt(r - depth, a + step)}`;
  }
  return `${d} Z`;
}

/** Vòng hoa văn nhiều cánh chồng nhau (kiểu guilloche trên giấy bạc), in rất nhạt làm hình chìm giữa tấm. */
function rosette(cx: number, cy: number, r: number, petals: number, turns: number): string {
  const steps = 360;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 * turns;
    const rad = r * (0.62 + 0.38 * Math.cos((petals / turns) * a));
    d += `${i ? 'L' : 'M'}${n1(cx + rad * Math.cos(a))} ${n1(cy + rad * Math.sin(a))} `;
  }
  return `${d}Z`;
}

/** Chữ chạy theo cung tròn: mỗi ký tự là một nút chữ đã xoay, nên SVG và canvas vẽ giống hệt nhau. */
function arcText(text: string, cx: number, cy: number, radius: number, side: 'top' | 'bottom', style: TextStyle, fill: string, measure: Measure): SceneNode[] {
  const chars = [...text.normalize('NFC')];
  const gap = (style.tracking ?? 0) * style.size;
  const widths = chars.map((ch) => measure(ch, { ...style, tracking: 0 }) + gap);
  const total = widths.reduce((s, w) => s + w, 0) - gap;
  const out: SceneNode[] = [];
  let acc = 0;
  chars.forEach((ch, i) => {
    const w = widths[i]! - gap;
    const along = (acc + w / 2 - total / 2) / radius;
    const a = side === 'top' ? -Math.PI / 2 + along : Math.PI / 2 - along;
    acc += widths[i]!;
    if (ch === ' ') return;
    out.push({ t: 'text', x: n1(cx + radius * Math.cos(a)), y: n1(cy + radius * Math.sin(a)), text: ch, size: style.size, weight: style.weight, fill, anchor: 'middle', rotate: n1((a * 180) / Math.PI + (side === 'top' ? 90 : -90)) });
  });
  return out;
}

/** Con dấu "Đã hoàn thành": đĩa vàng viền răng cưa, vòng chữ trên nền xanh cổ vịt, dấu tích ở giữa, hai dải ruy băng. */
function seal(cx: number, cy: number, R: number, measure: Measure): SceneNode[] {
  const ring: TextStyle = { size: R * 0.165, weight: 700, tracking: 0.16 };
  const capHalf = ring.size * 0.36;
  const mid = R * 0.66;
  const tail = (dir: 1 | -1, fill: string): SceneNode => ({
    t: 'path', fill,
    d: `M${n1(cx + dir * R * 0.12)} ${n1(cy + R * 0.5)} L${n1(cx + dir * R * 0.62)} ${n1(cy + R * 0.42)} L${n1(cx + dir * R * 0.84)} ${n1(cy + R * 1.34)} L${n1(cx + dir * R * 0.54)} ${n1(cy + R * 1.2)} L${n1(cx + dir * R * 0.3)} ${n1(cy + R * 1.4)} Z`,
  });
  return [
    tail(-1, C.primary), tail(1, C.band),
    { t: 'path', d: scallop(cx, cy, R, 44, R * 0.045), fill: C.gold },
    { t: 'circle', cx, cy, r: R * 0.9, fill: C.band },
    { t: 'circle', cx, cy, r: R * 0.835, stroke: C.gold, sw: 2 },
    { t: 'circle', cx, cy, r: R * 0.49, fill: C.gold },
    { t: 'circle', cx, cy, r: R * 0.49, stroke: C.onDark, sw: 2, opacity: 0.9 },
    ...arcText('ĐÃ HOÀN THÀNH', cx, cy, mid - capHalf, 'top', ring, C.onDark, measure),
    ...arcText('HỘI MÌNH', cx, cy, mid + capHalf, 'bottom', ring, C.onDark, measure),
    { t: 'path', d: sparkle(cx - mid, cy, R * 0.055), fill: C.gold },
    { t: 'path', d: sparkle(cx + mid, cy, R * 0.055), fill: C.gold },
    { t: 'path', d: `M${n1(cx - R * 0.22)} ${n1(cy + R * 0.01)} L${n1(cx - R * 0.07)} ${n1(cy + R * 0.17)} L${n1(cx + R * 0.24)} ${n1(cy - R * 0.17)}`, stroke: C.band, sw: n1(R * 0.085), round: true },
  ];
}

interface Block { gap: number; height: number; draw: (top: number) => SceneNode[] }

/** Một hoặc nhiều dòng chữ căn giữa; `line` là chiều cao dòng tính theo cỡ chữ. */
function textBlock(gap: number, fitted: FittedText, o: { weight: number; fill: string; line: number; italic?: boolean; tracking?: number }): Block {
  const lh = fitted.size * o.line;
  return {
    gap,
    height: lh * fitted.lines.length,
    draw: (top) => fitted.lines.map((text, i): SceneNode => ({
      t: 'text', text, size: fitted.size, weight: o.weight, fill: o.fill, anchor: 'middle', italic: o.italic, tracking: o.tracking,
      // Giãn chữ cộng một khoảng sau ký tự cuối, nên dòng căn giữa phải dịch nửa khoảng đó cho cân.
      x: n1(CX + ((o.tracking ?? 0) * fitted.size) / 2),
      y: n1(top + lh * i + lh / 2 + fitted.size * 0.35),
    })),
  };
}

const one = (text: string, size: number): FittedText => ({ size, lines: [text], truncated: false });

/** Dựng cảnh tấm chứng chỉ từ dữ liệu chứng nhận. `measure` đo bề ngang chữ bằng đúng phông sẽ vẽ. */
export function buildCertificateScene(data: CertificateData, measure: Measure): Scene {
  const nodes: SceneNode[] = [];
  const communityName = data.community?.name?.trim() || 'Hội Mình';
  const date = fmtCertificateDate(data.completedAt);
  const code = formatCertificateCode(data.code);

  // Nền giấy ấm, viền ngoài đậm hơn một chút, hình chìm ở giữa.
  nodes.push({ t: 'rect', x: 0, y: 0, w: CERT_W, h: CERT_H, fill: C.paper });
  nodes.push({ t: 'rect', x: 0, y: 0, w: CERT_W, h: CERT_H, stroke: C.paperEdge, sw: 56 });
  nodes.push({ t: 'path', d: rosette(CX, 640, 520, 12, 5), stroke: C.gold, sw: 1.6, opacity: 0.17 });
  nodes.push({ t: 'path', d: rosette(CX, 640, 400, 16, 7), stroke: C.primary, sw: 1.2, opacity: 0.07 });

  // Khung viền kép: dải xanh cổ vịt ngoài, đường vàng và đường mảnh bên trong cùng lõm ở bốn góc, sao bốn cánh trong hốc góc.
  nodes.push({ t: 'rect', x: 22, y: 22, w: CERT_W - 44, h: CERT_H - 44, stroke: C.gold, sw: 2, opacity: 0.8 });
  nodes.push({ t: 'rect', x: 40, y: 40, w: CERT_W - 80, h: CERT_H - 80, stroke: C.band, sw: 16 });
  nodes.push({ t: 'path', d: pocketFrame(72, 72, 58), stroke: C.gold, sw: 5 });
  nodes.push({ t: 'path', d: pocketFrame(88, 72, 76), stroke: C.primary, sw: 1.5, opacity: 0.55 });
  for (const [x, y] of [[84, 84], [CERT_W - 84, 84], [84, CERT_H - 84], [CERT_W - 84, CERT_H - 84]] as const) {
    nodes.push({ t: 'path', d: sparkle(x, y, 27), fill: C.gold });
    nodes.push({ t: 'circle', cx: x, cy: y, r: 4.5, fill: C.band });
  }

  // Cột nội dung giữa tấm: logo và tên hội, dòng "CHỨNG NHẬN HOÀN THÀNH", tên học viên, tên khóa, mô tả.
  const label = 'CHỨNG NHẬN HOÀN THÀNH';
  const labelStyle: TextStyle = { size: 34, weight: 700, tracking: 0.32 };
  const labelWidth = measure(label, labelStyle);
  const community = fitText(communityName, { maxWidth: 1180, maxSize: 36, minSize: 26, maxLines: 2, weight: 700, multiLineScale: 0.86 }, measure);
  const learner = fitText(data.learnerName, { maxWidth: 1500, maxSize: 124, minSize: 58, maxLines: 2, weight: 800 }, measure);
  const course = fitText(data.courseTitle, { maxWidth: 1440, maxSize: 62, minSize: 36, maxLines: 2, weight: 700, multiLineScale: 0.8 }, measure);

  const blocks: Block[] = [
    {
      gap: 0, height: 100,
      draw: (top) => data.community
        ? [{ t: 'logo', x: CX - 50, y: top, size: 100, r: 28, url: data.community.logoUrl ?? null, mark: data.community.logoMark || initialsOf(communityName), color: data.community.logoColor || C.primary }]
        : [{ t: 'circle', cx: CX - 20, cy: top + 50, r: 36, fill: C.gold }, { t: 'circle', cx: CX + 20, cy: top + 50, r: 36, fill: C.primary, opacity: 0.9 }],
    },
    textBlock(20, community, { weight: 700, fill: C.ink, line: 1.26 }),
    {
      gap: 44, height: 40,
      draw: (top) => {
        const y = top + 20;
        const half = labelWidth / 2 + 34;
        return [
          { t: 'path', d: `M${n1(CX - half - 190)} ${y} H${n1(CX - half)}`, stroke: C.gold, sw: 2.5 },
          { t: 'path', d: `M${n1(CX + half)} ${y} H${n1(CX + half + 190)}`, stroke: C.gold, sw: 2.5 },
          { t: 'path', d: diamond(n1(CX - half), y, 7), fill: C.gold },
          { t: 'path', d: diamond(n1(CX + half), y, 7), fill: C.gold },
          { t: 'text', x: n1(CX + (labelStyle.tracking! * labelStyle.size) / 2), y: y + 12, text: label, size: labelStyle.size, weight: 700, fill: C.goldText, anchor: 'middle', tracking: labelStyle.tracking },
        ];
      },
    },
    textBlock(38, one('Trân trọng trao cho', 30), { weight: 500, fill: C.ink3, line: 1.2 }),
    textBlock(18, learner, { weight: 800, fill: C.band, line: 1.2 }),
    {
      gap: 22, height: 18,
      draw: (top) => {
        const y = top + 9;
        return [
          { t: 'path', d: `M${CX - 210} ${y} H${CX - 26}`, stroke: C.gold, sw: 3 },
          { t: 'path', d: `M${CX + 26} ${y} H${CX + 210}`, stroke: C.gold, sw: 3 },
          { t: 'path', d: sparkle(CX, y, 13), fill: C.gold },
        ];
      },
    },
    textBlock(28, one('đã hoàn thành trọn vẹn khóa học', 30), { weight: 500, fill: C.ink2, line: 1.2 }),
    textBlock(16, course, { weight: 700, fill: C.primary, line: 1.24 }),
    textBlock(22, one(courseSummary(data.lessonCount, data.totalDurationSeconds), 30), { weight: 500, fill: C.ink2, line: 1.2 }),
  ];
  const [top, bottom] = [112, 948];
  const fixed = blocks.reduce((s, b) => s + b.height, 0);
  const gaps = blocks.reduce((s, b) => s + b.gap, 0);
  // Tên dài làm khối chữ cao lên: khoảng cách giữa các khối tự co lại để không chạm hàng chữ ký bên dưới.
  const gapScale = Math.max(0.35, Math.min(1, (bottom - top - fixed) / gaps));
  let y = top + Math.max(0, (bottom - top - fixed - gaps * gapScale) / 2);
  for (const b of blocks) {
    y += b.gap * gapScale;
    nodes.push(...b.draw(n1(y)));
    y += b.height;
  }

  // Hàng dưới: ngày hoàn thành, con dấu, chữ ký giảng viên.
  const column = (cx: number, value: FittedText, caption: string, italic: boolean): SceneNode[] => [
    // Giá trị có thể hai dòng (tên giảng viên dài): dòng cuối nằm sát đường kẻ, dòng trước xếp lên trên.
    ...value.lines.map((text, i): SceneNode => ({ t: 'text', x: cx, y: n1(1110 - (value.lines.length - 1 - i) * value.size * 1.2), text, size: value.size, weight: 600, fill: C.ink, anchor: 'middle', italic })),
    { t: 'path', d: `M${cx - 220} 1136 H${cx + 220}`, stroke: C.ink3, sw: 1.5, opacity: 0.7 },
    { t: 'text', x: n1(cx + (0.2 * 21) / 2), y: 1178, text: caption, size: 21, weight: 600, fill: C.ink3, anchor: 'middle', tracking: 0.2 },
  ];
  const signer = data.instructor?.trim() || communityName;
  nodes.push(...column(390, one(date, 37), 'NGÀY HOÀN THÀNH', false));
  nodes.push(...column(CERT_W - 390, fitText(signer, { maxWidth: 440, maxSize: 40, minSize: 24, maxLines: 2, weight: 600, italic: true, multiLineScale: 0.72, keepSingleAbove: 0.74 }, measure), data.instructor?.trim() ? 'GIẢNG VIÊN' : 'ĐƠN VỊ CẤP', true));
  nodes.push(...seal(CX, 1086, 124, measure));

  // Chân tấm: tên miền, địa chỉ kiểm tra, mã kiểm tra. Lùi vào trong 160 để không chạm cung lõm ở hai góc dưới.
  const footY = 1290;
  nodes.push({ t: 'circle', cx: 171, cy: footY - 8, r: 11, fill: C.gold });
  nodes.push({ t: 'circle', cx: 184, cy: footY - 8, r: 11, fill: C.primary, opacity: 0.9 });
  nodes.push({ t: 'text', x: 206, y: footY, text: 'hoiminh.com', size: 24, weight: 700, fill: C.ink2, anchor: 'start' });
  const codeStyle: TextStyle = { size: 24, weight: 700, tracking: 0.04 };
  const codeWidth = measure(code, codeStyle);
  nodes.push({ t: 'text', x: CERT_W - 160, y: footY, text: code, size: 24, weight: 700, fill: C.ink, anchor: 'end', tracking: 0.04 });
  nodes.push({ t: 'text', x: n1(CERT_W - 160 - codeWidth - 14), y: footY, text: 'Mã kiểm tra', size: 22, weight: 500, fill: C.ink3, anchor: 'end' });
  const verify = fitText(`Kiểm tra tại ${shortUrl(data.verifyUrl)}`, { maxWidth: 900, maxSize: 17, minSize: 12, maxLines: 1, weight: 500 }, measure);
  nodes.push({ t: 'text', x: CX, y: footY - 2, text: verify.lines[0] ?? '', size: verify.size, weight: 500, fill: C.ink3, anchor: 'middle' });

  const alt = `Chứng nhận hoàn thành của ${communityName}: ${data.learnerName} đã hoàn thành khóa học ${data.courseTitle} (${courseSummary(data.lessonCount, data.totalDurationSeconds)}) ngày ${date}${data.instructor ? `, giảng viên ${data.instructor}` : ''}. Mã kiểm tra ${code}.`;
  return { width: CERT_W, height: CERT_H, nodes, alt };
}
