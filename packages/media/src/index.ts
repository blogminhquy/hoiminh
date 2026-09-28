// Lớp media. Ba cách lưu, cùng một interface:
//   - R2Provider: R2 qua giao thức S3 (aws4fetch), trình duyệt tải thẳng lên R2 bằng URL ký. Cần 4 secret R2_*.
//   - R2BindingProvider: R2 qua binding `FILES` của Worker, không cần secret; tệp đi qua API (/files/upload, /files).
//   - LocalMediaProvider: thư mục .data/files cho dev/test.
import { AwsClient } from 'aws4fetch';

export interface PresignedUpload {
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
  objectKey: string;
  expiresAt: string;
}

export interface MediaProvider {
  readonly kind: 'r2' | 'local';
  /** Tên ngắn để hiện ở /health và Hệ thống · Tổng quan. */
  readonly label: string;
  /** Tạo URL tải lên trực tiếp từ trình duyệt. */
  presignUpload(objectKey: string, contentType: string, ttlSeconds?: number): Promise<PresignedUpload>;
  /** URL công khai (file public). */
  getUrl(objectKey: string): string;
  /** URL ký có hạn (file riêng: tài liệu khóa học trả phí, tệp số). */
  getSignedUrl(objectKey: string, ttlSeconds?: number): Promise<string>;
  delete(objectKey: string): Promise<void>;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

/** Cloudflare R2 qua giao thức S3 với chữ ký v4. */
export class R2Provider implements MediaProvider {
  readonly kind = 'r2' as const;
  readonly label = 'R2 (S3)';
  private readonly client: AwsClient;
  private readonly endpoint: string;
  constructor(private readonly cfg: R2Config) {
    this.client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: 's3', region: 'auto' });
    this.endpoint = `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}`;
  }
  async presignUpload(objectKey: string, contentType: string, ttlSeconds = 900): Promise<PresignedUpload> {
    const url = new URL(`${this.endpoint}/${objectKey}`);
    url.searchParams.set('X-Amz-Expires', String(ttlSeconds));
    const signed = await this.client.sign(new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }), { aws: { signQuery: true } });
    return { method: 'PUT', url: signed.url, headers: { 'Content-Type': contentType }, objectKey, expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() };
  }
  getUrl(objectKey: string): string {
    return `${this.cfg.publicBaseUrl.replace(/\/$/, '')}/${objectKey}`;
  }
  async getSignedUrl(objectKey: string, ttlSeconds = 3600): Promise<string> {
    const url = new URL(`${this.endpoint}/${objectKey}`);
    url.searchParams.set('X-Amz-Expires', String(ttlSeconds));
    const signed = await this.client.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
    return signed.url;
  }
  async delete(objectKey: string): Promise<void> {
    await this.client.fetch(`${this.endpoint}/${objectKey}`, { method: 'DELETE' });
  }
}

/**
 * Kho đối tượng tối giản mà API dùng để nhận/phát tệp khi tệp đi qua API (binding R2 hoặc đĩa local).
 * Khai báo cấu trúc, không import kiểu của Cloudflare: `R2Bucket` của Workers khớp với interface này.
 */
export interface ObjectStore {
  put(key: string, bytes: ArrayBuffer | Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream | ArrayBuffer | Uint8Array; contentType: string; size: number | null; etag: string | null } | null>;
  delete(key: string): Promise<void>;
}

/** Binding R2 của Worker (`[[r2_buckets]]` trong wrangler.toml). Chỉ khai báo phần dùng tới. */
export interface R2BucketLike {
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream | string | null, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; size: number; httpEtag: string; httpMetadata?: { contentType?: string } } | null>;
  delete(keys: string | string[]): Promise<void>;
}

/** Bọc binding R2 thành ObjectStore. */
export class R2BucketStore implements ObjectStore {
  constructor(private readonly bucket: R2BucketLike) {}
  async put(key: string, bytes: ArrayBuffer | Uint8Array, contentType: string): Promise<void> {
    await this.bucket.put(key, bytes, { httpMetadata: { contentType } });
  }
  async get(key: string) {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return { body: obj.body, contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream', size: obj.size, etag: obj.httpEtag };
  }
  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}

/**
 * Provider cho tệp đi qua API: URL tải lên và URL tệp riêng đều ký HMAC có hạn, API kiểm chữ ký rồi
 * đọc/ghi vào `store`. Dùng chung cho binding R2 (production, không cần secret) và đĩa local (dev).
 */
export abstract class ProxiedMediaProvider implements MediaProvider {
  abstract readonly kind: 'r2' | 'local';
  abstract readonly label: string;
  /** Kho lưu do API dùng; null nghĩa là API tự lo (đĩa local). */
  abstract readonly store: ObjectStore | null;
  constructor(protected readonly apiUrl: string, private readonly signingSecret: string, protected readonly publicBaseUrl = '') {}
  async presignUpload(objectKey: string, contentType: string, ttlSeconds = 900): Promise<PresignedUpload> {
    const expires = Date.now() + ttlSeconds * 1000;
    const sig = await this.sign(`${objectKey}:${expires}`);
    return { method: 'PUT', url: `${this.apiUrl}/files/upload/${objectKey}?expires=${expires}&sig=${sig}`, headers: { 'Content-Type': contentType }, objectKey, expiresAt: new Date(expires).toISOString() };
  }
  getUrl(objectKey: string): string {
    // Có domain public gắn vào bucket thì phát thẳng từ CDN Cloudflare; không thì qua API.
    return this.publicBaseUrl ? `${this.publicBaseUrl.replace(/\/$/, '')}/${objectKey}` : `${this.apiUrl}/files/${objectKey}`;
  }
  async getSignedUrl(objectKey: string, ttlSeconds = 3600): Promise<string> {
    const expires = Date.now() + ttlSeconds * 1000;
    return `${this.apiUrl}/files/${objectKey}?expires=${expires}&sig=${await this.sign(`${objectKey}:${expires}`)}`;
  }
  async delete(objectKey: string): Promise<void> {
    await this.store?.delete(objectKey);
  }
  /** Xác minh chữ ký của URL. */
  async verify(objectKey: string, expires: string, sig: string): Promise<boolean> {
    if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
    return (await this.sign(`${objectKey}:${expires}`)) === sig;
  }
  private async sign(message: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(this.signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
  }
}

/** R2 qua binding của Worker: không cần R2_ACCESS_KEY_*, tệp đi qua API rồi vào bucket. */
export class R2BindingProvider extends ProxiedMediaProvider {
  readonly kind = 'r2' as const;
  readonly label = 'R2 (binding)';
  readonly store: ObjectStore;
  constructor(bucket: R2BucketLike, apiUrl: string, signingSecret: string, publicBaseUrl = '') {
    super(apiUrl, signingSecret, publicBaseUrl);
    this.store = new R2BucketStore(bucket);
  }
}

/** Lưu tệp local: API nhận PUT tại /files/upload/<key> và ghi vào .data/files, phát tại /files/<key>. */
export class LocalMediaProvider extends ProxiedMediaProvider {
  readonly kind = 'local' as const;
  readonly label = 'đĩa local';
  readonly store = null;
  constructor(apiUrl: string, signingSecret: string) {
    super(apiUrl, signingSecret);
  }
}

/**
 * Tạo provider theo cấu hình. Ưu tiên: đủ 4 biến R2_* → S3 (tải thẳng lên R2, hợp tệp lớn);
 * có binding → R2 qua API (không cần secret); không có gì → đĩa local.
 */
export function createMediaProvider(opts: { r2: Partial<R2Config>; r2Bucket?: R2BucketLike | null; apiUrl: string; secret: string }): MediaProvider {
  const r = opts.r2;
  if (r.accountId && r.accessKeyId && r.secretAccessKey && r.bucket) {
    return new R2Provider({ accountId: r.accountId, accessKeyId: r.accessKeyId, secretAccessKey: r.secretAccessKey, bucket: r.bucket, publicBaseUrl: r.publicBaseUrl ?? '' });
  }
  if (opts.r2Bucket) return new R2BindingProvider(opts.r2Bucket, opts.apiUrl, opts.secret, r.publicBaseUrl ?? '');
  return new LocalMediaProvider(opts.apiUrl, opts.secret);
}

/** Kiểm tra loại tệp cho phép và giới hạn dung lượng (mục 80). */
export const UPLOAD_RULES = {
  image: { mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxBytes: 10 * 1024 * 1024 },
  document: { mimes: ['application/pdf', 'text/plain', 'application/zip', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], maxBytes: 100 * 1024 * 1024 },
} as const;

export function validateUpload(mime: string, size: number): { ok: true; kind: 'image' | 'document' } | { ok: false; reason: string } {
  for (const [kind, rule] of Object.entries(UPLOAD_RULES) as Array<['image' | 'document', { mimes: readonly string[]; maxBytes: number }]>) {
    if (rule.mimes.includes(mime)) return size <= rule.maxBytes ? { ok: true, kind } : { ok: false, reason: `Tệp vượt ${Math.round(rule.maxBytes / 1024 / 1024)}MB` };
  }
  return { ok: false, reason: 'Loại tệp không được hỗ trợ' };
}
