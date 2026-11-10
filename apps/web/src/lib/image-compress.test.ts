import { describe, expect, it, vi } from 'vitest';
import { AVATAR_MAX_SIDE, IMAGE_MAX_SIDE, JPEG_QUALITY, WEBP_QUALITY, compressForUpload, compressImage, fitWithin, jpegName, maxSideFor, outputName, type CompressDeps, type OutputType } from './image-compress';

const source = {} as CanvasImageSource;
const fileOf = (name: string, type: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type });

/**
 * Giải mã/mã hóa giả: ghi lại kích thước được yêu cầu vẽ, trả về blob `outBytes` byte.
 * `webp: true` giống Chrome, Firefox (xuất được WebP); `webp: false` giống Safari (xin WebP thì nhận về PNG, JPEG vẫn xuất được).
 */
function fakeDeps(dims: { width: number; height: number }, outBytes = 100_000, opts: { webp?: boolean } = {}) {
  const canWebp = opts.webp ?? true;
  const release = vi.fn();
  const decode = vi.fn(async (_file: File) => ({ ...dims, source, release }));
  const encode = vi.fn(async (_s: CanvasImageSource, _w: number, _h: number, _q: number, type: OutputType): Promise<Blob | null> => new Blob([new Uint8Array(outBytes)], { type: type === 'image/webp' && !canWebp ? 'image/png' : type }));
  const deps: CompressDeps = { decode, encode };
  return { deps, decode, encode, release };
}

describe('fitWithin', () => {
  it('thu nhỏ cạnh dài về giới hạn, giữ tỷ lệ', () => {
    expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900, resized: true });
    expect(fitWithin(3000, 4000, 1200)).toEqual({ width: 900, height: 1200, resized: true });
    expect(fitWithin(3000, 3000, 1200)).toEqual({ width: 1200, height: 1200, resized: true });
  });

  it('không phóng to ảnh đã nhỏ hơn hoặc bằng giới hạn', () => {
    expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600, resized: false });
    expect(fitWithin(1200, 1200, 1200)).toEqual({ width: 1200, height: 1200, resized: false });
  });

  it('mỗi cạnh ít nhất 1px', () => {
    expect(fitWithin(10_000, 3, 1200)).toEqual({ width: 1200, height: 1, resized: true });
  });
});

describe('outputName', () => {
  it('đổi đuôi tệp theo định dạng xuất', () => {
    expect(outputName('anh dep.PNG', 'image/webp')).toBe('anh dep.webp');
    expect(outputName('a.b.jpg', 'image/webp')).toBe('a.b.webp');
    expect(outputName('khong-duoi', 'image/webp')).toBe('khong-duoi.webp');
    expect(outputName('', 'image/webp')).toBe('image.webp');
    expect(jpegName('a.b.webp')).toBe('a.b.jpg');
  });
});

describe('maxSideFor', () => {
  it('ảnh bài viết, bình luận, tin nhắn, bìa: 1200px; avatar và logo: 512px', () => {
    expect(IMAGE_MAX_SIDE).toBe(1200);
    expect(AVATAR_MAX_SIDE).toBe(512);
    for (const p of ['post_image', 'comment_image', 'message_image', 'cover'] as const) expect(maxSideFor(p)).toBe(1200);
    expect(maxSideFor('avatar')).toBe(512);
  });

  it('tài liệu bài học và tệp số không nén', () => {
    expect(maxSideFor('lesson_resource')).toBeNull();
    expect(maxSideFor('digital_product')).toBeNull();
  });
});

describe('compressImage', () => {
  it('thu nhỏ ảnh lớn về 1200px và đổi sang WebP', async () => {
    const { deps, encode } = fakeDeps({ width: 4000, height: 3000 });
    const out = await compressImage(fileOf('IMG_1.PNG', 'image/png', 5_000_000), IMAGE_MAX_SIDE, deps);
    expect(encode).toHaveBeenCalledTimes(1);
    expect(encode).toHaveBeenCalledWith(source, 1200, 900, WEBP_QUALITY, 'image/webp');
    expect(out.name).toBe('IMG_1.webp');
    expect(out.type).toBe('image/webp');
    expect(out.size).toBe(100_000);
  });

  it('ảnh nhỏ hơn giới hạn không bị phóng to nhưng vẫn đổi sang WebP', async () => {
    const { deps, encode } = fakeDeps({ width: 800, height: 600 }, 60_000);
    const out = await compressImage(fileOf('a.jpg', 'image/jpeg', 900_000), IMAGE_MAX_SIDE, deps);
    expect(encode).toHaveBeenCalledWith(source, 800, 600, WEBP_QUALITY, 'image/webp');
    expect(out.type).toBe('image/webp');
    expect(out.size).toBe(60_000);
  });

  it('JPEG, PNG luôn thành WebP dù byte không giảm, để mọi ảnh trong hội cùng một định dạng', async () => {
    const { deps } = fakeDeps({ width: 64, height: 64 }, 5_000);
    const out = await compressImage(fileOf('nho.png', 'image/png', 3_000), IMAGE_MAX_SIDE, deps);
    expect(out.type).toBe('image/webp');
    expect(out.name).toBe('nho.webp');
  });

  it('ảnh gốc đã là WebP, chưa cần thu nhỏ mà nén lại nặng hơn thì giữ nguyên tệp gốc', async () => {
    const original = fileOf('san.webp', 'image/webp', 3_000);
    const { deps } = fakeDeps({ width: 64, height: 64 }, 5_000);
    expect(await compressImage(original, IMAGE_MAX_SIDE, deps)).toBe(original);
  });

  it('đã thu nhỏ thì dùng bản nén dù byte không giảm, để cạnh không vượt giới hạn', async () => {
    const { deps } = fakeDeps({ width: 3000, height: 2000 }, 120_000);
    const out = await compressImage(fileOf('a.webp', 'image/webp', 100_000), IMAGE_MAX_SIDE, deps);
    expect(out.size).toBe(120_000);
    expect(out.type).toBe('image/webp');
  });

  it('trình duyệt không xuất được WebP (Safari) thì xuất JPEG, máy chủ sẽ chuyển sang WebP', async () => {
    const { deps, encode } = fakeDeps({ width: 4000, height: 3000 }, 100_000, { webp: false });
    const out = await compressImage(fileOf('IMG_2.HEIC.jpg', 'image/jpeg', 5_000_000), IMAGE_MAX_SIDE, deps);
    expect(encode).toHaveBeenNthCalledWith(1, source, 1200, 900, WEBP_QUALITY, 'image/webp');
    expect(encode).toHaveBeenNthCalledWith(2, source, 1200, 900, JPEG_QUALITY, 'image/jpeg');
    expect(out.name).toBe('IMG_2.HEIC.jpg');
    expect(out.type).toBe('image/jpeg');
  });

  it('không xuất được WebP và bản JPEG nặng hơn ảnh chưa cần thu nhỏ thì giữ ảnh gốc', async () => {
    const original = fileOf('nho.png', 'image/png', 3_000);
    const { deps } = fakeDeps({ width: 64, height: 64 }, 5_000, { webp: false });
    expect(await compressImage(original, IMAGE_MAX_SIDE, deps)).toBe(original);
  });

  it('GIF giữ nguyên để không mất chuyển động, không giải mã', async () => {
    const gif = fileOf('vui.gif', 'image/gif', 2_000_000);
    const { deps, decode } = fakeDeps({ width: 4000, height: 3000 });
    expect(await compressImage(gif, IMAGE_MAX_SIDE, deps)).toBe(gif);
    expect(decode).not.toHaveBeenCalled();
  });

  it('tệp không phải ảnh giữ nguyên', async () => {
    const pdf = fileOf('tai-lieu.pdf', 'application/pdf', 4_000_000);
    const { deps, decode } = fakeDeps({ width: 10, height: 10 });
    expect(await compressImage(pdf, IMAGE_MAX_SIDE, deps)).toBe(pdf);
    expect(decode).not.toHaveBeenCalled();
  });

  it('giải mã lỗi thì tải ảnh gốc như cũ', async () => {
    const original = fileOf('hong.png', 'image/png', 1_000_000);
    const { deps, decode } = fakeDeps({ width: 1, height: 1 });
    decode.mockRejectedValueOnce(new Error('không giải mã được'));
    expect(await compressImage(original, IMAGE_MAX_SIDE, deps)).toBe(original);
  });

  it('mã hóa không ra được ảnh nào thì tải ảnh gốc', async () => {
    const original = fileOf('a.png', 'image/png', 1_000_000);
    const { deps, encode } = fakeDeps({ width: 2000, height: 2000 });
    encode.mockResolvedValue(null);
    expect(await compressImage(original, IMAGE_MAX_SIDE, deps)).toBe(original);
    expect(encode).toHaveBeenCalledTimes(2);
  });

  it('luôn giải phóng ảnh đã giải mã, kể cả khi mã hóa lỗi', async () => {
    const ok = fakeDeps({ width: 2000, height: 2000 });
    await compressImage(fileOf('a.png', 'image/png', 1_000_000), IMAGE_MAX_SIDE, ok.deps);
    expect(ok.release).toHaveBeenCalledTimes(1);

    const bad = fakeDeps({ width: 2000, height: 2000 });
    bad.encode.mockRejectedValueOnce(new Error('hết bộ nhớ'));
    await compressImage(fileOf('b.png', 'image/png', 1_000_000), IMAGE_MAX_SIDE, bad.deps);
    expect(bad.release).toHaveBeenCalledTimes(1);
  });
});

describe('compressForUpload', () => {
  it('ảnh bài viết nén về 1200px', async () => {
    const { deps, encode } = fakeDeps({ width: 4000, height: 3000 });
    await compressForUpload(fileOf('a.jpg', 'image/jpeg', 3_000_000), 'post_image', deps);
    expect(encode).toHaveBeenCalledWith(source, 1200, 900, WEBP_QUALITY, 'image/webp');
  });

  it('avatar nén về 512px', async () => {
    const { deps, encode } = fakeDeps({ width: 1254, height: 1254 });
    await compressForUpload(fileOf('me.png', 'image/png', 2_061_641), 'avatar', deps);
    expect(encode).toHaveBeenCalledWith(source, 512, 512, WEBP_QUALITY, 'image/webp');
  });

  it('tài liệu và tệp số không đụng tới dù là ảnh', async () => {
    const png = fileOf('so-do.png', 'image/png', 3_000_000);
    const { deps, decode } = fakeDeps({ width: 4000, height: 3000 });
    expect(await compressForUpload(png, 'lesson_resource', deps)).toBe(png);
    expect(await compressForUpload(png, 'digital_product', deps)).toBe(png);
    expect(decode).not.toHaveBeenCalled();
  });
});
