// Vẽ cảnh chứng chỉ (certificate-scene) lên canvas và xuất PNG, không dùng thư viện ngoài.
// Vẽ thẳng bằng Canvas 2D (không chụp DOM, không nhúng SVG vào ảnh) vì đó là cách chạy đều trên mọi trình duyệt,
// kể cả Safari trên iPhone, và dùng được đúng phông của trang sau khi `document.fonts` tải xong.
import { FONT_DISPLAY, HEX } from '@hoiminh/ui/tokens';
import type { Measure, TextStyle } from './certificate';
import type { Scene, SceneNode } from './certificate-scene';

/** Phông của tấm chứng chỉ: phông tiêu đề của ứng dụng. SVG trên màn hình và canvas dùng chung chuỗi này. */
export const CERT_FONT = FONT_DISPLAY;

export const fontOf = (s: Pick<TextStyle, 'size' | 'weight' | 'italic'>) => `${s.italic ? 'italic ' : ''}${s.weight} ${s.size}px ${CERT_FONT}`;

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** Đo bề ngang chữ bằng canvas với đúng phông sẽ vẽ. Không có canvas (test, trình duyệt lạ) thì ước lượng theo số ký tự. */
export const canvasMeasure: Measure = (text, style) => {
  if (measureCtx === undefined) {
    try { measureCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d'); } catch { measureCtx = null; }
  }
  const spacing = (style.tracking ?? 0) * style.size * [...text].length;
  if (!measureCtx) return [...text].length * style.size * 0.58 + spacing;
  measureCtx.font = fontOf(style);
  return measureCtx.measureText(text).width + spacing;
};

/**
 * Chờ phông của tấm chứng chỉ tải xong (mọi độ đậm dùng trong cảnh, kèm chữ mẫu có dấu để trình duyệt tải cả
 * phần phông tiếng Việt). Quá `timeoutMs` hoặc mất mạng thì thôi chờ: tấm vẫn vẽ được bằng phông dự phòng.
 */
export async function loadCertificateFonts(sample: string, timeoutMs = 4000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const specs = ['500', '600', '700', '800', 'italic 600'];
  const all = Promise.all(specs.map((s) => document.fonts.load(`${s} 40px ${CERT_FONT}`, sample))).then(() => document.fonts.ready);
  await Promise.race([all.then(() => undefined, () => undefined), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

export interface LoadedLogo { image: HTMLImageElement; objectUrl: string }

/**
 * Tải logo hội để vẽ lên canvas. Logo nằm ở tên miền khác (API tệp công khai), vẽ thẳng sẽ làm canvas bị "tainted"
 * và không xuất được ảnh. Nên tải qua fetch có CORS thành Blob rồi mở bằng địa chỉ nội bộ (cùng nguồn với trang).
 * Máy chủ không trả header CORS, mất mạng, hay tệp hỏng: trả null, bên vẽ tự dùng dấu chữ viết tắt thay thế.
 */
export async function loadLogo(url: string, timeoutMs = 6000): Promise<LoadedLogo | null> {
  let objectUrl = '';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('logo'));
      image.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('logo');
    return { image, objectUrl };
  } catch {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    return null;
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function paint(ctx: CanvasRenderingContext2D, n: { fill?: string; stroke?: string; sw?: number }, path?: Path2D): void {
  if (n.fill) { ctx.fillStyle = n.fill; if (path) ctx.fill(path); else ctx.fill(); }
  if (n.stroke) { ctx.strokeStyle = n.stroke; ctx.lineWidth = n.sw ?? 1; if (path) ctx.stroke(path); else ctx.stroke(); }
}

function drawText(ctx: CanvasRenderingContext2D, n: Extract<SceneNode, { t: 'text' }>): void {
  ctx.font = fontOf(n);
  ctx.fillStyle = n.fill;
  ctx.textBaseline = 'alphabetic';
  const spacing = (n.tracking ?? 0) * n.size;
  // ctx.letterSpacing có ở trình duyệt mới; kiểm bằng kiểu giá trị để trình duyệt cũ rơi xuống nhánh tự đặt ký tự.
  const native = typeof (ctx as { letterSpacing?: unknown }).letterSpacing === 'string';
  if (native) ctx.letterSpacing = `${spacing}px`;
  if (!spacing || native) {
    ctx.textAlign = n.anchor === 'middle' ? 'center' : n.anchor === 'end' ? 'right' : 'left';
    ctx.fillText(n.text, 0, 0);
    return;
  }
  // Trình duyệt chưa có ctx.letterSpacing: tự đặt từng ký tự, tính cả khoảng sau ký tự cuối như SVG.
  const chars = [...n.text];
  const widths = chars.map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((s, w) => s + w, 0);
  let x = n.anchor === 'middle' ? -total / 2 : n.anchor === 'end' ? -total : 0;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, x, 0); x += widths[i]!; });
}

function drawLogo(ctx: CanvasRenderingContext2D, n: Extract<SceneNode, { t: 'logo' }>, logo: CanvasImageSource | null): void {
  roundedRect(ctx, n.x, n.y, n.size, n.size, n.r);
  ctx.save();
  ctx.clip();
  const size = logo ? { w: (logo as HTMLImageElement).naturalWidth || (logo as ImageBitmap).width, h: (logo as HTMLImageElement).naturalHeight || (logo as ImageBitmap).height } : null;
  if (logo && size && size.w && size.h) {
    // Phủ kín ô vuông, cắt phần thừa ở giữa (như background-size: cover).
    const scale = Math.max(n.size / size.w, n.size / size.h);
    const [w, h] = [size.w * scale, size.h * scale];
    ctx.fillStyle = HEX.surface;
    ctx.fillRect(n.x, n.y, n.size, n.size);
    ctx.drawImage(logo, n.x + (n.size - w) / 2, n.y + (n.size - h) / 2, w, h);
  } else {
    // Dấu thay thế: chữ viết tắt trên nền màu của hội, như thành phần CommunityMark.
    ctx.fillStyle = n.color;
    ctx.fillRect(n.x, n.y, n.size, n.size);
    ctx.font = fontOf({ size: Math.round(n.size * 0.42), weight: 800 });
    ctx.fillStyle = HEX.surface;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(n.mark, n.x + n.size / 2, n.y + n.size / 2 + n.size * 0.15);
  }
  ctx.restore();
}

/** Vẽ toàn bộ cảnh lên canvas theo đúng thứ tự các nút. `logo` null thì dùng dấu thay thế. */
export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, logo: CanvasImageSource | null): void {
  for (const n of scene.nodes) {
    ctx.save();
    ctx.globalAlpha = 'opacity' in n && n.opacity !== undefined ? n.opacity : 1;
    if (n.t === 'rect') {
      roundedRect(ctx, n.x, n.y, n.w, n.h, n.r ?? 0);
      paint(ctx, n);
    } else if (n.t === 'circle') {
      ctx.beginPath();
      ctx.arc(n.cx, n.cy, n.r, 0, Math.PI * 2);
      paint(ctx, n);
    } else if (n.t === 'path') {
      if (n.round) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
      paint(ctx, n, new Path2D(n.d));
    } else if (n.t === 'text') {
      ctx.translate(n.x, n.y);
      if (n.rotate) ctx.rotate((n.rotate * Math.PI) / 180);
      drawText(ctx, n);
    } else {
      drawLogo(ctx, n, logo);
    }
    ctx.restore();
  }
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh'))), 'image/png');
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Không tạo được ảnh'));
    }
  });
}

/**
 * Xuất tấm chứng chỉ thành PNG đúng kích thước cảnh (2000 x 1414). Nếu logo làm canvas không xuất được
 * (trình duyệt coi ảnh là khác nguồn) thì vẽ lại với dấu thay thế, để việc tải ảnh không bao giờ hỏng vì logo.
 */
export async function renderCertificatePng(scene: Scene, logo: CanvasImageSource | null): Promise<Blob> {
  const attempt = (withLogo: CanvasImageSource | null) => {
    const canvas = document.createElement('canvas');
    canvas.width = scene.width;
    canvas.height = scene.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ vẽ ảnh');
    drawScene(ctx, scene, withLogo);
    return toPng(canvas);
  };
  if (!logo) return attempt(null);
  try {
    return await attempt(logo);
  } catch {
    return attempt(null);
  }
}
