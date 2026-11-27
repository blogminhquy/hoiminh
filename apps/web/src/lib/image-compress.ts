// Nén ảnh ngay trong trình duyệt trước khi tải lên: đổi sang WebP, cạnh dài tối đa 1200px (avatar 512px).
// Ảnh chụp điện thoại hay ảnh AI thường 2 đến 10 MB và hơn 1200px; sau nén còn vài chục đến vài trăm KB,
// tải nhanh hơn và R2 không phải chứa bản gốc. Thứ tự đổi sang WebP:
//   1. canvas của trình duyệt (Chrome, Edge, Firefox, Android);
//   2. trình duyệt không tự xuất được WebP (Safari): bộ mã hóa WebAssembly nạp riêng (webp-encoder.ts), vẫn chạy trên máy người dùng;
//   3. cả hai không được: gửi JPEG, máy chủ chuyển nốt bằng Cloudflare Images lúc nhận tệp (packages/media, route PUT /files/upload).
// Chỉ bước 3 tốn lượt chuyển đổi Cloudflare Images (gói miễn phí 5.000 lượt mỗi tháng).
// Đây là tối ưu phía người dùng, không phải ràng buộc: server vẫn kiểm tra như cũ (validateUpload: ảnh tối đa 10 MB).

/** `sticker`: ảnh nhãn dán (quản trị hệ thống tải lên), giữ nguyên byte gốc để GIF, WebP động không mất chuyển động. */
export type UploadPurpose = 'post_image' | 'avatar' | 'cover' | 'lesson_resource' | 'digital_product' | 'message_image' | 'message_file' | 'comment_image' | 'sticker';

export const IMAGE_MAX_SIDE = 1200;
export const AVATAR_MAX_SIDE = 512;
export const JPEG_QUALITY = 0.82;
/** Chất lượng WebP, khớp WEBP_QUALITY (80 trên thang 100) ở packages/media. */
export const WEBP_QUALITY = 0.8;
export type OutputType = 'image/webp' | 'image/jpeg';

/** Định dạng nén được. GIF bị loại để giữ chuyển động; định dạng lạ để server quyết. */
const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Cạnh dài tối đa theo mục đích tải lên; null = không đụng tới byte gốc (tài liệu bài học, tệp số). */
export function maxSideFor(purpose: UploadPurpose): number | null {
  switch (purpose) {
    case 'avatar': return AVATAR_MAX_SIDE;
    case 'post_image':
    case 'comment_image':
    case 'message_image':
    case 'cover': return IMAGE_MAX_SIDE;
    default: return null;
  }
}

/** Kích thước sau khi thu nhỏ cho vừa `maxSide`, giữ tỷ lệ, không bao giờ phóng to. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number; resized: boolean } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height, resized: false };
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), resized: true };
}

/** Đổi đuôi tên tệp theo định dạng xuất: .webp hoặc .jpg. */
export function outputName(name: string, type: OutputType): string {
  const base = name.replace(/\.[^./\\]+$/, '');
  return `${base || 'image'}.${type === 'image/webp' ? 'webp' : 'jpg'}`;
}
/** Đổi đuôi tên tệp sang .jpg. */
export function jpegName(name: string): string {
  return outputName(name, 'image/jpeg');
}

export interface DecodedImage {
  width: number;
  height: number;
  source: CanvasImageSource;
  /** Giải phóng bộ nhớ sau khi dùng xong. */
  release?: () => void;
}

/** Hai bước phụ thuộc trình duyệt, tách ra để test bằng bản giả. */
export interface CompressDeps {
  decode(file: File): Promise<DecodedImage>;
  /** Xuất ảnh theo `type`. Trình duyệt không hỗ trợ định dạng đó thì trả blob loại khác (thường là PNG) hoặc null. */
  encode(source: CanvasImageSource, width: number, height: number, quality: number, type: OutputType): Promise<Blob | null>;
  /** Mã hóa WebP không nhờ canvas, dùng khi `encode` không xuất được WebP. Không có, trả null hoặc lỗi thì xuất JPEG. */
  encodeWebpSoftware?(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob | null>;
}

/** Vẽ ảnh lên canvas mới ở kích thước đích. `background` là màu nền đổ trước khi vẽ; bỏ trống thì giữ nền trong suốt. */
function drawToCanvas(source: CanvasImageSource, width: number, height: number, background?: string): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return { canvas, ctx };
}

async function decodeWithImage(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { width: img.naturalWidth, height: img.naturalHeight, source: img, release: () => URL.revokeObjectURL(url) };
}

/** Đã thấy canvas của trình duyệt này không xuất được WebP (Safari trả về PNG): các ảnh sau bỏ qua lượt thử vô ích đó. */
let canvasLacksWebp = false;

const browserDeps: CompressDeps = {
  async decode(file) {
    // createImageBitmap giải mã nhanh và tự xoay ảnh chụp điện thoại theo EXIF; không dùng được thì rơi xuống <img>.
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { width: bitmap.width, height: bitmap.height, source: bitmap, release: () => bitmap.close() };
      } catch { /* thử bằng <img> */ }
    }
    return decodeWithImage(file);
  },
  async encode(source, width, height, quality, type) {
    // JPEG không có kênh trong suốt: đổ nền trắng trước, nếu không PNG trong suốt sẽ ra nền đen. WebP giữ được nền trong suốt.
    if (type === 'image/webp' && canvasLacksWebp) return null;
    const drawn = drawToCanvas(source, width, height, type === 'image/jpeg' ? '#fff' : undefined);
    if (!drawn) return null;
    const blob = await new Promise<Blob | null>((resolve) => drawn.canvas.toBlob(resolve, type, quality));
    if (type === 'image/webp' && blob && blob.type !== 'image/webp') canvasLacksWebp = true;
    return blob;
  },
  async encodeWebpSoftware(source, width, height, quality) {
    const drawn = drawToCanvas(source, width, height);
    if (!drawn) return null;
    const pixels = drawn.ctx.getImageData(0, 0, width, height);
    // Nạp lúc cần: chỉ trình duyệt không tự xuất được WebP mới tải bộ mã hóa (vài trăm KB), và chỉ tải một lần.
    const { encodeWebp } = await import('./webp-encoder');
    return encodeWebp(pixels, quality);
  },
};

/** Gọi bộ mã hóa WebP dự phòng. Mọi trục trặc (không có, lỗi tải, lỗi mã hóa, ra tệp rỗng) đều thành null để rơi xuống JPEG. */
async function softwareWebp(deps: CompressDeps, source: CanvasImageSource, width: number, height: number): Promise<Blob | null> {
  if (!deps.encodeWebpSoftware) return null;
  try {
    const blob = await deps.encodeWebpSoftware(source, width, height, WEBP_QUALITY);
    return blob && blob.type === 'image/webp' && blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/**
 * Thu nhỏ về `maxSide` và đổi sang WebP: bằng canvas, không được thì bằng bộ mã hóa WebAssembly, vẫn không được thì đổi sang JPEG.
 * Trả lại đúng tệp gốc khi:
 * không phải JPEG/PNG/WebP (GIF, tài liệu), giải mã hoặc mã hóa lỗi, hoặc ảnh gốc đã là WebP, chưa cần thu nhỏ mà bản nén lại nặng hơn.
 * Ảnh JPEG/PNG nhỏ vẫn được đổi sang WebP để mọi ảnh trong hội cùng một định dạng.
 */
export async function compressImage(file: File, maxSide: number, deps: CompressDeps = browserDeps): Promise<File> {
  if (!COMPRESSIBLE.has(file.type)) return file;
  let decoded: DecodedImage | undefined;
  try {
    decoded = await deps.decode(file);
    const { width, height, resized } = fitWithin(decoded.width, decoded.height, maxSide);
    const native = await deps.encode(decoded.source, width, height, WEBP_QUALITY, 'image/webp');
    // Trình duyệt không xuất được WebP (Safari trả về PNG): thử bộ mã hóa WebAssembly trước khi chịu dùng JPEG.
    const webp = native && native.type === 'image/webp' ? native : await softwareWebp(deps, decoded.source, width, height);
    if (webp) {
      if (file.type === 'image/webp' && !resized && webp.size >= file.size) return file;
      return new File([webp], outputName(file.name, 'image/webp'), { type: 'image/webp', lastModified: file.lastModified });
    }
    // Không cách nào ra được WebP: dùng JPEG như trước, máy chủ sẽ chuyển sang WebP bằng Cloudflare Images.
    const jpeg = await deps.encode(decoded.source, width, height, JPEG_QUALITY, 'image/jpeg');
    if (!jpeg || jpeg.type !== 'image/jpeg') return file;
    if (!resized && jpeg.size >= file.size) return file;
    return new File([jpeg], outputName(file.name, 'image/jpeg'), { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    decoded?.release?.();
  }
}

/** Nén theo mục đích tải lên; tài liệu và tệp số đi qua nguyên vẹn. */
export function compressForUpload(file: File, purpose: UploadPurpose, deps?: CompressDeps): Promise<File> {
  const max = maxSideFor(purpose);
  return max === null ? Promise.resolve(file) : compressImage(file, max, deps);
}
