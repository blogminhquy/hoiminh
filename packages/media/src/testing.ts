// Bucket R2 giả trong bộ nhớ cho test: đủ giao diện binding mà R2BucketStore dùng.
import type { R2BucketLike } from './index';

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
