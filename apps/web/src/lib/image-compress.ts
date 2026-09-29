// Nén ảnh ngay trong trình duyệt trước khi tải lên: đổi sang JPEG, cạnh dài tối đa 1200px (avatar 512px).
// Ảnh chụp điện thoại hay ảnh AI thường 2–10 MB và hơn 1200px; sau nén còn vài chục đến vài trăm KB,
// tải nhanh hơn và R2 không phải chứa bản gốc. Đây là tối ưu phía người dùng, không phải ràng buộc:
// server vẫn kiểm tra như cũ (validateUpload: ảnh tối đa 10 MB).

export type UploadPurpose = 'post_image' | 'avatar' | 'cover' | 'lesson_resource' | 'digital_product' | 'message_image' | 'comment_image';

export const IMAGE_MAX_SIDE = 1200;
export const AVATAR_MAX_SIDE = 512;
export const JPEG_QUALITY = 0.82;

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

/** Đổi đuôi tên tệp sang .jpg. */
export function jpegName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '');
  return `${base || 'image'}.jpg`;
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
  encode(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob | null>;
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
  async encode(source, width, height, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // JPEG không có kênh trong suốt: đổ nền trắng trước, nếu không PNG trong suốt sẽ ra nền đen.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  },
};

/**
 * Thu nhỏ về `maxSide` và đổi sang JPEG. Trả lại đúng tệp gốc khi: không phải JPEG/PNG/WebP (GIF, tài liệu),
 * giải mã hoặc mã hóa lỗi, trình duyệt không xuất được JPEG, hoặc bản nén nặng hơn bản gốc mà ảnh chưa cần thu nhỏ.
 */
export async function compressImage(file: File, maxSide: number, deps: CompressDeps = browserDeps): Promise<File> {
  if (!COMPRESSIBLE.has(file.type)) return file;
  let decoded: DecodedImage | undefined;
  try {
    decoded = await deps.decode(file);
    const { width, height, resized } = fitWithin(decoded.width, decoded.height, maxSide);
    const blob = await deps.encode(decoded.source, width, height, JPEG_QUALITY);
    if (!blob || blob.type !== 'image/jpeg') return file;
    if (!resized && blob.size >= file.size) return file;
    return new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified });
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
