import { describe, expect, it } from 'vitest';
import { AVATAR_MAX_SIDE, MESSAGE_FILE_MAX_BYTES, attachmentDisposition, maxBytesForKey, CloudflareImageOptimizer, IMAGE_MAX_SIDE, LocalMediaProvider, R2BindingProvider, R2BucketStore, R2Provider, WEBP_QUALITY, createMediaProvider, validateUpload, webpKeyFor, webpTarget, type ImageTransformerLike, type ImagesBindingLike } from './index';
import { fakeBucket, fakeImages } from './testing';

describe('media', () => {
  it('local provider ký và xác minh URL', async () => {
    const p = new LocalMediaProvider('http://localhost:8787', 'secret');
    const up = await p.presignUpload('img/a.png', 'image/png');
    const u = new URL(up.url);
    expect(await p.verify('img/a.png', u.searchParams.get('expires')!, u.searchParams.get('sig')!)).toBe(true);
    expect(await p.verify('img/b.png', u.searchParams.get('expires')!, u.searchParams.get('sig')!)).toBe(false);
    expect(await p.verify('img/a.png', 'abc', u.searchParams.get('sig')!)).toBe(false);
  });
  it('chọn local khi thiếu cấu hình R2 và không có binding', () => {
    expect(createMediaProvider({ r2: {}, apiUrl: 'http://x', secret: 's' }).kind).toBe('local');
  });
  it('có binding thì dùng R2 qua API, không cần secret', async () => {
    const bucket = fakeBucket();
    const p = createMediaProvider({ r2: {}, r2Bucket: bucket, apiUrl: 'https://api.hoiminh.com', secret: 's' });
    expect(p.kind).toBe('r2');
    expect(p).toBeInstanceOf(R2BindingProvider);
    expect(p.getUrl('public/a.png')).toBe('https://api.hoiminh.com/files/public/a.png');
    const up = await p.presignUpload('public/a.png', 'image/png');
    expect(up.url.startsWith('https://api.hoiminh.com/files/upload/public/a.png?')).toBe(true);
    const store = (p as R2BindingProvider).store;
    await store.put('public/a.png', new TextEncoder().encode('hello'), 'image/png');
    const got = await store.get('public/a.png');
    expect(got?.contentType).toBe('image/png');
    expect(await new Response(got!.body as ReadableStream).text()).toBe('hello');
    await p.delete('public/a.png');
    expect(await store.get('public/a.png')).toBeNull();
  });
  it('R2_PUBLIC_BASE_URL đặt thì URL public đi thẳng CDN, URL riêng vẫn qua API có chữ ký', async () => {
    const p = new R2BindingProvider(fakeBucket(), 'https://api.hoiminh.com', 's', 'https://files.hoiminh.com/');
    expect(p.getUrl('public/a.png')).toBe('https://files.hoiminh.com/public/a.png');
    expect(await p.getSignedUrl('private/x.pdf')).toMatch(/^https:\/\/api\.hoiminh\.com\/files\/private\/x\.pdf\?expires=\d+&sig=[0-9a-f]{40}$/);
  });
  it('đủ 4 biến R2_* thì ưu tiên S3 tải thẳng', () => {
    const p = createMediaProvider({ r2: { accountId: 'a', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b' }, r2Bucket: fakeBucket(), apiUrl: 'http://x', secret: 's' });
    expect(p.label).toBe('R2 (S3)');
  });
  it('R2Provider.delete: 204 và 404 là xong, lỗi khác ném ra để job xóa tệp thử lại', async () => {
    const p = new R2Provider({ accountId: 'acc', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b', publicBaseUrl: 'https://f.test' });
    const realFetch = globalThis.fetch;
    try {
      for (const status of [204, 404]) {
        globalThis.fetch = (async () => new Response(null, { status })) as typeof fetch;
        await expect(p.delete('public/a.png')).resolves.toBeUndefined();
      }
      for (const status of [403, 400]) { // 5xx không thử ở đây: aws4fetch tự thử lại 5xx nhiều lần với thời gian chờ tăng dần
        globalThis.fetch = (async () => new Response(null, { status })) as typeof fetch;
        await expect(p.delete('public/a.png')).rejects.toThrow(String(status));
      }
    } finally {
      globalThis.fetch = realFetch;
    }
  });
  it('R2BucketStore trả null khi không có tệp', async () => {
    expect(await new R2BucketStore(fakeBucket()).get('nope')).toBeNull();
  });
  it('validate loại tệp', () => {
    expect(validateUpload('image/png', 100).ok).toBe(true);
    expect(validateUpload('video/mp4', 100).ok).toBe(false);
  });
  it('không nhận tệp video ở bất kỳ định dạng nào, và nói rõ cách thay thế', () => {
    for (const mime of ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']) {
      const v = validateUpload(mime, 1_000);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toContain('dán link video');
    }
  });
});

describe('ảnh WebP', () => {
  it('webpKeyFor: ảnh đã là WebP luôn dùng đuôi .webp; JPEG, PNG chỉ khi máy chủ chuyển được; GIF không bao giờ', () => {
    expect(webpKeyFor('image/webp', false)).toBe(true);
    expect(webpKeyFor('image/jpeg', true)).toBe(true);
    expect(webpKeyFor('image/png', true)).toBe(true);
    expect(webpKeyFor('image/jpeg', false)).toBe(false);
    expect(webpKeyFor('image/gif', true)).toBe(false);
    expect(webpKeyFor('application/pdf', true)).toBe(false);
  });

  it('webpTarget: chỉ ảnh công khai JPEG, PNG ở key đuôi .webp mới cần chuyển, avatar nhỏ hơn ảnh bài viết', () => {
    expect(webpTarget('public/post_image/2026-11-10/abc.webp', 'image/jpeg')).toEqual({ maxSide: IMAGE_MAX_SIDE });
    expect(webpTarget('public/cover/2026-11-10/abc.webp', 'image/png')).toEqual({ maxSide: IMAGE_MAX_SIDE });
    expect(webpTarget('public/avatar/2026-11-10/abc.webp', 'image/jpeg')).toEqual({ maxSide: AVATAR_MAX_SIDE });
    // Đã là WebP: đi thẳng vào kho, không tốn lượt chuyển đổi.
    expect(webpTarget('public/post_image/2026-11-10/abc.webp', 'image/webp')).toBeNull();
    expect(webpTarget('public/post_image/2026-11-10/abc.gif', 'image/gif')).toBeNull();
    expect(webpTarget('public/post_image/2026-11-10/abc.jpg', 'image/jpeg')).toBeNull();
    // Tài liệu bài học và tệp số là tệp riêng: không bao giờ đụng tới byte gốc.
    expect(webpTarget('private/lesson_resource/2026-11-10/so-do.webp', 'image/png')).toBeNull();
  });

  it('CloudflareImageOptimizer thu nhỏ không phóng to, xuất WebP chất lượng 80', async () => {
    const images = fakeImages();
    const out = await new CloudflareImageOptimizer(images).toWebp(new Uint8Array(1234), { maxSide: 1200 });
    expect(new TextDecoder().decode(out!)).toBe('webp:1234');
    expect(images.calls).toEqual([{ transform: { width: 1200, height: 1200, fit: 'scale-down' }, output: { format: 'image/webp', quality: WEBP_QUALITY }, inputBytes: 1234 }]);
  });

  it('Cloudflare từ chối (hết hạn mức, ảnh hỏng) thì trả null và báo lỗi cho người gọi ghi log', async () => {
    const errors: unknown[] = [];
    const out = await new CloudflareImageOptimizer(fakeImages({ fail: true }), (e) => errors.push(e)).toWebp(new Uint8Array(10), { maxSide: 512 });
    expect(out).toBeNull();
    expect(String(errors[0])).toContain('9422');
  });

  it('binding trả về tệp rỗng thì coi như không chuyển được', async () => {
    const handle: ImageTransformerLike = { transform: () => handle, output: async () => ({ response: () => new Response(new Uint8Array(0)) }) };
    const empty: ImagesBindingLike = { input: () => handle };
    expect(await new CloudflareImageOptimizer(empty).toWebp(new Uint8Array(10), { maxSide: 512 })).toBeNull();
  });

  it('chỉ R2 qua binding có bộ chuyển ảnh mới báo convertsToWebp', () => {
    const base = { apiUrl: 'https://api.test', secret: 's'.repeat(32) };
    expect(createMediaProvider({ r2: {}, ...base }).convertsToWebp).toBe(false);
    expect(createMediaProvider({ r2: {}, r2Bucket: fakeBucket(), ...base }).convertsToWebp).toBe(false);
    expect(createMediaProvider({ r2: {}, r2Bucket: fakeBucket(), images: new CloudflareImageOptimizer(fakeImages()), ...base }).convertsToWebp).toBe(true);
    // Đủ 4 biến R2_* thì trình duyệt tải thẳng lên R2, máy chủ không chạm vào byte nên không chuyển được.
    expect(createMediaProvider({ r2: { accountId: 'a', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b' }, r2Bucket: fakeBucket(), images: new CloudflareImageOptimizer(fakeImages()), ...base }).convertsToWebp).toBe(false);
  });
});

describe('tệp đính kèm tin nhắn', () => {
  it('giới hạn 5MB áp theo nơi lưu của tệp', () => {
    expect(MESSAGE_FILE_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(maxBytesForKey('private/message_file/2026-11-11/abc.pdf')).toBe(MESSAGE_FILE_MAX_BYTES);
    expect(maxBytesForKey('private/lesson_resource/2026-11-11/abc.pdf')).toBeNull();
    expect(maxBytesForKey('public/message_image/2026-11-11/abc.webp')).toBeNull();
  });
  it('tên tải về giữ dấu tiếng Việt, không lọt ký tự phá header hay đường dẫn', () => {
    expect(attachmentDisposition('Bảng giá 2026.pdf')).toBe(`attachment; filename="Bang gia 2026.pdf"; filename*=UTF-8''${encodeURIComponent('Bảng giá 2026.pdf')}`);
    const odd = attachmentDisposition('a"b\r\nSet-Cookie: x=1/../c.txt');
    expect(odd).not.toMatch(/[\r\n]/);
    expect(odd).toContain('filename="abSet-Cookie: x=1..c.txt"');
    expect(attachmentDisposition('')).toContain('filename="tep"');
  });
  it('URL ký có tên tải về: qua API là tham số download, qua S3 là response-content-disposition nằm trong chữ ký', async () => {
    const local = new LocalMediaProvider('http://localhost:8787', 'secret');
    const u = new URL(await local.getSignedUrl('private/message_file/x.pdf', 300, 'Báo giá.pdf'));
    expect(u.searchParams.get('download')).toBe('Báo giá.pdf');
    expect(await local.verify('private/message_file/x.pdf', u.searchParams.get('expires')!, u.searchParams.get('sig')!)).toBe(true);
    const s3 = new R2Provider({ accountId: 'acc', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b', publicBaseUrl: '' });
    const signed = new URL(await s3.getSignedUrl('private/message_file/x.pdf', 300, 'Báo giá.pdf'));
    expect(signed.searchParams.get('response-content-disposition')).toContain("filename*=UTF-8''");
    expect(signed.searchParams.get('X-Amz-SignedHeaders')).toBeTruthy();
  });
});
