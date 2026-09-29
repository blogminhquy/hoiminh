import { describe, expect, it, vi } from 'vitest';
import { AVATAR_MAX_SIDE, IMAGE_MAX_SIDE, JPEG_QUALITY, compressForUpload, compressImage, fitWithin, jpegName, maxSideFor, type CompressDeps } from './image-compress';

const source = {} as CanvasImageSource;
const fileOf = (name: string, type: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type });

/** Giải mã/mã hóa giả: ghi lại kích thước được yêu cầu vẽ, trả về blob `outBytes` byte. */
function fakeDeps(dims: { width: number; height: number }, outBytes = 100_000, outType = 'image/jpeg') {
  const release = vi.fn();
  const decode = vi.fn(async (_file: File) => ({ ...dims, source, release }));
  const encode = vi.fn(async (_s: CanvasImageSource, _w: number, _h: number, _q: number): Promise<Blob | null> => new Blob([new Uint8Array(outBytes)], { type: outType }));
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

describe('jpegName', () => {
  it('đổi đuôi tệp sang .jpg', () => {
    expect(jpegName('anh dep.PNG')).toBe('anh dep.jpg');
    expect(jpegName('a.b.webp')).toBe('a.b.jpg');
    expect(jpegName('khong-duoi')).toBe('khong-duoi.jpg');
    expect(jpegName('')).toBe('image.jpg');
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
  it('thu nhỏ ảnh lớn về 1200px và đổi sang JPEG', async () => {
    const { deps, encode } = fakeDeps({ width: 4000, height: 3000 });
    const out = await compressImage(fileOf('IMG_1.PNG', 'image/png', 5_000_000), IMAGE_MAX_SIDE, deps);
    expect(encode).toHaveBeenCalledWith(source, 1200, 900, JPEG_QUALITY);
    expect(out.name).toBe('IMG_1.jpg');
    expect(out.type).toBe('image/jpeg');
    expect(out.size).toBe(100_000);
  });

  it('ảnh nhỏ hơn giới hạn không bị phóng to nhưng vẫn đổi sang JPEG khi nhẹ hơn', async () => {
    const { deps, encode } = fakeDeps({ width: 800, height: 600 }, 60_000);
    const out = await compressImage(fileOf('a.png', 'image/png', 900_000), IMAGE_MAX_SIDE, deps);
    expect(encode).toHaveBeenCalledWith(source, 800, 600, JPEG_QUALITY);
    expect(out.type).toBe('image/jpeg');
    expect(out.size).toBe(60_000);
  });

  it('giữ ảnh gốc khi nén xong lại nặng hơn mà không phải thu nhỏ', async () => {
    const original = fileOf('nho.png', 'image/png', 3_000);
    const { deps } = fakeDeps({ width: 64, height: 64 }, 5_000);
    expect(await compressImage(original, IMAGE_MAX_SIDE, deps)).toBe(original);
  });

  it('đã thu nhỏ thì dùng bản nén dù byte không giảm, để cạnh không vượt giới hạn', async () => {
    const { deps } = fakeDeps({ width: 3000, height: 2000 }, 120_000);
    const out = await compressImage(fileOf('a.jpg', 'image/jpeg', 100_000), IMAGE_MAX_SIDE, deps);
    expect(out.size).toBe(120_000);
    expect(out.type).toBe('image/jpeg');
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

  it('mã hóa không ra được ảnh thì tải ảnh gốc', async () => {
    const original = fileOf('a.png', 'image/png', 1_000_000);
    const { deps, encode } = fakeDeps({ width: 2000, height: 2000 });
    encode.mockResolvedValueOnce(null);
    expect(await compressImage(original, IMAGE_MAX_SIDE, deps)).toBe(original);
  });

  it('trình duyệt trả định dạng khác JPEG thì tải ảnh gốc', async () => {
    const original = fileOf('a.png', 'image/png', 1_000_000);
    const { deps } = fakeDeps({ width: 2000, height: 2000 }, 100, 'image/png');
    expect(await compressImage(original, IMAGE_MAX_SIDE, deps)).toBe(original);
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
    expect(encode).toHaveBeenCalledWith(source, 1200, 900, JPEG_QUALITY);
  });

  it('avatar nén về 512px', async () => {
    const { deps, encode } = fakeDeps({ width: 1254, height: 1254 });
    await compressForUpload(fileOf('me.png', 'image/png', 2_061_641), 'avatar', deps);
    expect(encode).toHaveBeenCalledWith(source, 512, 512, JPEG_QUALITY);
  });

  it('tài liệu và tệp số không đụng tới dù là ảnh', async () => {
    const png = fileOf('so-do.png', 'image/png', 3_000_000);
    const { deps, decode } = fakeDeps({ width: 4000, height: 3000 });
    expect(await compressForUpload(png, 'lesson_resource', deps)).toBe(png);
    expect(await compressForUpload(png, 'digital_product', deps)).toBe(png);
    expect(decode).not.toHaveBeenCalled();
  });
});
