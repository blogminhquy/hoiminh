import { describe, expect, it } from 'vitest';
import { LocalMediaProvider, R2BindingProvider, R2BucketStore, R2Provider, createMediaProvider, validateUpload } from './index';
import { fakeBucket } from './testing';

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
});
