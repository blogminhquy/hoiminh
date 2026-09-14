// Lớp media: R2 (S3-compatible qua aws4fetch) cho production, Local (thư mục .data/files) cho dev/test.
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

/** Lưu tệp local: API nhận PUT tại /files/upload/<key> và phát tại /files/<key>. */
export class LocalMediaProvider implements MediaProvider {
  readonly kind = 'local' as const;
  constructor(private readonly apiUrl: string, private readonly signingSecret: string) {}
  async presignUpload(objectKey: string, contentType: string, ttlSeconds = 900): Promise<PresignedUpload> {
    const expires = Date.now() + ttlSeconds * 1000;
    const sig = await this.sign(`${objectKey}:${expires}`);
    return { method: 'PUT', url: `${this.apiUrl}/files/upload/${objectKey}?expires=${expires}&sig=${sig}`, headers: { 'Content-Type': contentType }, objectKey, expiresAt: new Date(expires).toISOString() };
  }
  getUrl(objectKey: string): string {
    return `${this.apiUrl}/files/${objectKey}`;
  }
  async getSignedUrl(objectKey: string, ttlSeconds = 3600): Promise<string> {
    const expires = Date.now() + ttlSeconds * 1000;
    return `${this.apiUrl}/files/${objectKey}?expires=${expires}&sig=${await this.sign(`${objectKey}:${expires}`)}`;
  }
  async delete(): Promise<void> {
    /* tệp local được dọn bởi API */
  }
  /** Xác minh chữ ký của URL local. */
  async verify(objectKey: string, expires: string, sig: string): Promise<boolean> {
    if (Number(expires) < Date.now()) return false;
    return (await this.sign(`${objectKey}:${expires}`)) === sig;
  }
  private async sign(message: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(this.signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
  }
}

/** Tạo provider theo cấu hình: đủ biến R2 thì dùng R2, không thì Local. */
export function createMediaProvider(opts: { r2: Partial<R2Config>; apiUrl: string; secret: string }): MediaProvider {
  const r = opts.r2;
  if (r.accountId && r.accessKeyId && r.secretAccessKey && r.bucket) {
    return new R2Provider({ accountId: r.accountId, accessKeyId: r.accessKeyId, secretAccessKey: r.secretAccessKey, bucket: r.bucket, publicBaseUrl: r.publicBaseUrl ?? '' });
  }
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
