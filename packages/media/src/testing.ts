// Bucket R2 và binding Images giả trong bộ nhớ cho test: đủ giao diện mà R2BucketStore và CloudflareImageOptimizer dùng.
import type { ImageTransformerLike, ImagesBindingLike, R2BucketLike } from './index';

export interface FakeBucket extends R2BucketLike {
  objects: Map<string, { bytes: Uint8Array<ArrayBuffer>; contentType: string }>;
}

export function fakeBucket(): FakeBucket {
  const objects = new Map<string, { bytes: Uint8Array<ArrayBuffer>; contentType: string }>();
  return {
    objects,
    async put(key, value, options) {
      const raw = value instanceof ArrayBuffer ? new Uint8Array(value) : value instanceof Uint8Array ? value : new Uint8Array(await new Response(value as ReadableStream).arrayBuffer());
      const bytes = new Uint8Array(new ArrayBuffer(raw.byteLength));
      bytes.set(raw);
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType ?? 'application/octet-stream' });
    },
    async get(key) {
      const o = objects.get(key);
      if (!o) return null;
      return { body: new Blob([o.bytes]).stream(), size: o.bytes.byteLength, httpEtag: `"${key}"`, httpMetadata: { contentType: o.contentType } };
    },
    async delete(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) objects.delete(k);
    },
  };
}

/**
 * Tệp mẫu nhỏ nhất có đúng vài byte đầu của loại `mime` (API kiểm byte đầu lúc nhận tệp), nối thêm `extra` byte 0x01
 * để test phân biệt được các tệp. JPEG mẫu dài đúng 5 byte khi không có `extra`.
 */
export function sampleFile(mime: string, extra = 0): Uint8Array<ArrayBuffer> {
  const ascii = (s: string) => [...s].map((ch) => ch.charCodeAt(0));
  const heads: Record<string, number[]> = {
    'image/jpeg': [0xff, 0xd8, 0xff, 0xe0, 0x00],
    'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'image/gif': ascii('GIF89a'),
    'image/webp': [...ascii('RIFF'), 0x04, 0x00, 0x00, 0x00, ...ascii('WEBP')],
    'application/pdf': ascii('%PDF-1.4\n'),
    'application/zip': [0x50, 0x4b, 0x03, 0x04],
    'text/plain': ascii('ghi chu'),
  };
  const head = heads[mime];
  if (!head) throw new Error(`Chưa có tệp mẫu cho ${mime}`);
  const out = new Uint8Array(new ArrayBuffer(head.length + extra));
  out.set(head);
  out.fill(1, head.length);
  return out;
}

export interface FakeImages extends ImagesBindingLike {
  /** Mỗi lượt chuyển đổi: tham số transform, tham số output và số byte đầu vào. */
  calls: Array<{ transform: Record<string, unknown>; output: { format: string; quality?: number }; inputBytes: number }>;
}

/**
 * Binding Images giả: "ảnh WebP" trả về là chuỗi byte `webp:` nối với số byte đầu vào, đủ để test nhận ra tệp đã đổi.
 * `fail: true` giả lập Cloudflare từ chối (hết hạn mức, ảnh hỏng).
 */
export function fakeImages(opts: { fail?: boolean } = {}): FakeImages {
  const calls: FakeImages['calls'] = [];
  return {
    calls,
    input(stream) {
      let transform: Record<string, unknown> = {};
      const handle: ImageTransformerLike = {
        transform(options) { transform = { ...transform, ...options }; return handle; },
        async output(output) {
          const inputBytes = (await new Response(stream).arrayBuffer()).byteLength;
          if (opts.fail) throw new Error('IMAGES_TRANSFORM_ERROR 9422: hết hạn mức chuyển đổi');
          calls.push({ transform, output, inputBytes });
          return { response: () => new Response(new TextEncoder().encode(`webp:${inputBytes}`), { headers: { 'Content-Type': output.format } }) };
        },
      };
      return handle;
    },
  };
}
