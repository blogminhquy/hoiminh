// Lớp media. Ba cách lưu, cùng một interface:
//   - R2Provider: R2 qua giao thức S3 (aws4fetch), trình duyệt tải thẳng lên R2 bằng URL ký. Cần 4 secret R2_*.
//   - R2BindingProvider: R2 qua binding `FILES` của Worker, không cần secret; tệp đi qua API (/files/upload, /files).
//   - LocalMediaProvider: thư mục .data/files cho dev/test.
// Ảnh công khai (bài viết, bình luận, tin nhắn, bìa, avatar) lưu ở dạng WebP: trình duyệt đổi sang WebP trước khi gửi
// (canvas, hoặc bộ mã hóa WebAssembly với Safari). Ảnh nào tới máy chủ vẫn là JPEG/PNG (trình duyệt làm không được,
// client cũ, gọi API trực tiếp) thì CloudflareImageOptimizer (binding `IMAGES` của Worker) chuyển nốt trước khi ghi vào R2.
import { AwsClient } from 'aws4fetch';

/** Cạnh dài tối đa của ảnh công khai, và của avatar/logo. Khớp với bước nén ở trình duyệt (apps/web/src/lib/image-compress.ts). */
export const IMAGE_MAX_SIDE = 1200;
export const AVATAR_MAX_SIDE = 512;
/** Chất lượng WebP (thang 1 đến 100): ảnh bài viết nhìn không khác bản gốc mà nhẹ hơn JPEG cùng cỡ. */
export const WEBP_QUALITY = 80;

/** Chuyển ảnh sang WebP ở máy chủ. Trả null khi không chuyển được: người gọi lưu ảnh gốc, không để hỏng lượt tải lên. */
export interface ImageOptimizer {
  toWebp(bytes: Uint8Array, opts: { maxSide: number; quality?: number }): Promise<Uint8Array | null>;
}

/** Binding Images của Worker (`[images]` trong wrangler.toml). Chỉ khai báo phần dùng tới. */
export interface ImagesBindingLike {
  input(stream: ReadableStream): ImageTransformerLike;
}
export interface ImageTransformerLike {
  transform(options: Record<string, unknown>): ImageTransformerLike;
  output(options: { format: string; quality?: number }): Promise<{ response(): Response }>;
}

/**
 * Cloudflare Images qua binding: thu nhỏ cho vừa `maxSide` (không bao giờ phóng to) rồi xuất WebP.
 * Mỗi ảnh là một lượt chuyển đổi tính vào hạn mức Images của tài khoản; hết hạn mức hay ảnh hỏng thì trả null.
 */
export class CloudflareImageOptimizer implements ImageOptimizer {
  constructor(private readonly images: ImagesBindingLike, private readonly onError?: (err: unknown) => void) {}
  async toWebp(bytes: Uint8Array, opts: { maxSide: number; quality?: number }): Promise<Uint8Array | null> {
    try {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const result = await this.images
        .input(new Blob([copy]).stream())
        .transform({ width: opts.maxSide, height: opts.maxSide, fit: 'scale-down' })
        .output({ format: 'image/webp', quality: opts.quality ?? WEBP_QUALITY });
      const out = new Uint8Array(await result.response().arrayBuffer());
      return out.byteLength > 0 ? out : null;
    } catch (err) {
      this.onError?.(err);
      return null;
    }
  }
}

/** Loại ảnh chuyển được sang WebP. GIF giữ nguyên để không mất chuyển động. */
const WEBP_SOURCES = new Set(['image/jpeg', 'image/png']);

/** Ảnh công khai JPEG/PNG/WebP: object key dùng đuôi .webp khi máy chủ chuyển được (hoặc tệp đã là WebP). */
export function webpKeyFor(mimeType: string, serverConverts: boolean): boolean {
  return mimeType === 'image/webp' || (serverConverts && WEBP_SOURCES.has(mimeType));
}

/**
 * Tệp vừa nhận có cần chuyển sang WebP không: chỉ ảnh công khai JPEG/PNG nằm ở key đuôi .webp.
 * Ảnh đã là WebP (trình duyệt nén sẵn) đi thẳng vào kho, không tốn lượt chuyển đổi.
 */
export function webpTarget(objectKey: string, contentType: string): { maxSide: number } | null {
  if (!objectKey.startsWith('public/') || !objectKey.endsWith('.webp') || !WEBP_SOURCES.has(contentType)) return null;
  return { maxSide: objectKey.startsWith('public/avatar/') ? AVATAR_MAX_SIDE : IMAGE_MAX_SIDE };
}

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
  /** Máy chủ chuyển được ảnh JPEG/PNG sang WebP lúc nhận tệp (cần tệp đi qua API và có binding Images). */
  readonly convertsToWebp: boolean;
  /** Tạo URL tải lên trực tiếp từ trình duyệt. */
  presignUpload(objectKey: string, contentType: string, ttlSeconds?: number): Promise<PresignedUpload>;
  /** URL công khai (file public). */
  getUrl(objectKey: string): string;
  /**
   * URL ký có hạn (file riêng: tài liệu khóa học trả phí, tệp số, tệp đính kèm tin nhắn).
   * Có `downloadName` thì trình duyệt tải tệp về với đúng tên đó thay vì mở ngay trong tab.
   */
  getSignedUrl(objectKey: string, ttlSeconds?: number, downloadName?: string): Promise<string>;
  /** Xóa đối tượng; khóa không còn thì coi như xong, lỗi khác thì ném để người gọi thử lại. */
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
  // Trình duyệt tải thẳng lên R2, máy chủ không chạm vào byte của ảnh nên không chuyển được.
  readonly convertsToWebp = false;
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
  async getSignedUrl(objectKey: string, ttlSeconds = 3600, downloadName?: string): Promise<string> {
    const url = new URL(`${this.endpoint}/${objectKey}`);
    url.searchParams.set('X-Amz-Expires', String(ttlSeconds));
    if (downloadName) url.searchParams.set('response-content-disposition', attachmentDisposition(downloadName));
    const signed = await this.client.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
    return signed.url;
  }
  async delete(objectKey: string): Promise<void> {
    const res = await this.client.fetch(`${this.endpoint}/${objectKey}`, { method: 'DELETE' });
    // Khóa không còn (404) coi như đã xóa; lỗi khác phải ném ra để job xóa tệp thử lại thay vì im lặng để lại tệp mồ côi.
    if (!res.ok && res.status !== 404) throw new Error(`R2 xóa ${objectKey} thất bại (${res.status})`);
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
  /** Bộ chuyển ảnh sang WebP; null thì ảnh lưu đúng như trình duyệt gửi lên. */
  readonly images: ImageOptimizer | null = null;
  get convertsToWebp(): boolean {
    return this.images !== null;
  }
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
  async getSignedUrl(objectKey: string, ttlSeconds = 3600, downloadName?: string): Promise<string> {
    const expires = Date.now() + ttlSeconds * 1000;
    // Tên tải về không nằm trong chữ ký: nó chỉ đổi tên tệp phía người đã cầm URL hợp lệ, và API làm sạch trước khi đặt vào header.
    return `${this.apiUrl}/files/${objectKey}?expires=${expires}&sig=${await this.sign(`${objectKey}:${expires}`)}${downloadName ? `&download=${encodeURIComponent(downloadName)}` : ''}`;
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
  override readonly images: ImageOptimizer | null;
  constructor(bucket: R2BucketLike, apiUrl: string, signingSecret: string, publicBaseUrl = '', images: ImageOptimizer | null = null) {
    super(apiUrl, signingSecret, publicBaseUrl);
    this.store = new R2BucketStore(bucket);
    this.images = images;
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
export function createMediaProvider(opts: { r2: Partial<R2Config>; r2Bucket?: R2BucketLike | null; images?: ImageOptimizer | null; apiUrl: string; secret: string }): MediaProvider {
  const r = opts.r2;
  if (r.accountId && r.accessKeyId && r.secretAccessKey && r.bucket) {
    return new R2Provider({ accountId: r.accountId, accessKeyId: r.accessKeyId, secretAccessKey: r.secretAccessKey, bucket: r.bucket, publicBaseUrl: r.publicBaseUrl ?? '' });
  }
  if (opts.r2Bucket) return new R2BindingProvider(opts.r2Bucket, opts.apiUrl, opts.secret, r.publicBaseUrl ?? '', opts.images ?? null);
  return new LocalMediaProvider(opts.apiUrl, opts.secret);
}

/**
 * Kiểm tra loại tệp cho phép và giới hạn dung lượng (mục 54). Chỉ nhận ảnh và tài liệu: không nhận tệp video ở bất kỳ
 * mục nào, video đưa vào bài viết và bài học bằng cách dán link (YouTube, TikTok, Facebook, Loom, Vimeo, Bunny).
 * Tài liệu tối đa 50MB: Cloudflare (gói tên miền miễn phí) chặn request trên 100MB, còn Worker đọc cả tệp vào 128MB bộ nhớ.
 */
export const UPLOAD_RULES = {
  image: { mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxBytes: 10 * 1024 * 1024 },
  document: { mimes: ['application/pdf', 'text/plain', 'application/zip', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'], maxBytes: 50 * 1024 * 1024 },
} as const;

/** Tệp đính kèm trong tin nhắn: tối đa 5MB (chủ dự án đặt ngày 11/11), nhỏ hơn hẳn tài liệu khóa học vì ai cũng gửi được cho ai. */
export const MESSAGE_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const MESSAGE_FILE_PREFIX = 'private/message_file/';

/** Dung lượng tối đa của một tệp theo nơi lưu (object key), null là chỉ theo UPLOAD_RULES. Dùng lúc API nhận byte thật của tệp. */
export function maxBytesForKey(objectKey: string): number | null {
  return objectKey.startsWith(MESSAGE_FILE_PREFIX) ? MESSAGE_FILE_MAX_BYTES : null;
}

/** Giá trị header Content-Disposition để trình duyệt tải tệp về với tên cho trước (tên có dấu tiếng Việt đi theo RFC 5987). */
export function attachmentDisposition(name: string): string {
  // Bỏ ký tự điều khiển, dấu nháy kép và dấu gạch chéo: chúng phá cú pháp header hoặc bị coi là đường dẫn.
  const clean = [...name].filter((ch) => { const c = ch.charCodeAt(0); return c >= 32 && c !== 127 && ch !== '"' && ch !== '\\' && ch !== '/'; }).join('').slice(0, 200) || 'tep';
  const ascii = [...clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')].map((ch) => (ch.charCodeAt(0) > 126 ? '_' : ch)).join('');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

export function validateUpload(mime: string, size: number): { ok: true; kind: 'image' | 'document' } | { ok: false; reason: string } {
  for (const [kind, rule] of Object.entries(UPLOAD_RULES) as Array<['image' | 'document', { mimes: readonly string[]; maxBytes: number }]>) {
    if (rule.mimes.includes(mime)) return size <= rule.maxBytes ? { ok: true, kind } : { ok: false, reason: `Tệp vượt ${Math.round(rule.maxBytes / 1024 / 1024)}MB` };
  }
  if (mime.startsWith('video/')) return { ok: false, reason: 'Không nhận tệp video. Hãy dán link video (YouTube, TikTok, Facebook…) thay vì tải tệp lên.' };
  return { ok: false, reason: 'Loại tệp không được hỗ trợ' };
}

/** Loại tệp ở dạng so sánh được: chữ thường, bỏ tham số như `; charset=utf-8`. */
export function baseMime(mime: string): string {
  return (mime.split(';')[0] ?? '').trim().toLowerCase();
}

/**
 * Dung lượng tối đa API nhận cho một tệp loại `mime` lưu ở `objectKey`: trần theo loại (UPLOAD_RULES), hạ thêm theo nơi lưu
 * (tệp đính kèm tin nhắn 5MB). Null khi loại tệp không được nhận.
 */
export function maxUploadBytes(mime: string, objectKey: string): number | null {
  const m = baseMime(mime);
  const rule = Object.values(UPLOAD_RULES).find((r) => (r.mimes as readonly string[]).includes(m));
  if (!rule) return null;
  const cap = maxBytesForKey(objectKey);
  return cap === null ? rule.maxBytes : Math.min(rule.maxBytes, cap);
}

const OOXML_MIMES = new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']);

function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  return bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);
}

function ascii(s: string): number[] {
  return [...s].map((ch) => ch.charCodeAt(0));
}

/** Chữ UTF-8 hợp lệ, không có byte 0 (tệp nhị phân đổi đuôi thành .txt). Chỉ xét 64KB đầu để không tốn CPU với tệp lớn. */
function looksLikeText(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, 64 * 1024);
  if (head.includes(0)) return false;
  try {
    // stream: true để một ký tự nhiều byte bị cắt ngang ở mép 64KB không bị coi là lỗi.
    new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Vài byte đầu của tệp có đúng là loại `mime` không. Loại tệp do client tự khai (lúc xin URL và trong header của lượt PUT),
 * nên chỉ tin byte thật: chặn trang HTML đội lốt ảnh (sẽ chạy mã trên tên miền Hội Mình) và video đổi đuôi thành tài liệu.
 */
export function contentMatchesMime(mime: string, bytes: Uint8Array): boolean {
  const m = baseMime(mime);
  if (m === 'image/jpeg') return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (m === 'image/png') return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (m === 'image/gif') return startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'));
  if (m === 'image/webp') return startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8);
  // Chuẩn PDF cho phép vài byte rác trước dấu %PDF-, trình đọc tìm nó trong 1024 byte đầu.
  if (m === 'application/pdf') {
    const head = bytes.subarray(0, 1024);
    const sig = ascii('%PDF-');
    for (let i = 0; i + sig.length <= head.length; i++) if (startsWith(head, sig, i)) return true;
    return false;
  }
  // Word, Excel, PowerPoint đời mới đều là tệp zip.
  if (m === 'application/zip' || OOXML_MIMES.has(m)) return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) || startsWith(bytes, [0x50, 0x4b, 0x07, 0x08]);
  if (m === 'text/plain') return looksLikeText(bytes);
  return false;
}

/** Loại tệp được phát lại đúng như đã lưu: các loại nhận lúc tải lên. */
const SERVABLE_MIMES: ReadonlySet<string> = new Set([...UPLOAD_RULES.image.mimes, ...UPLOAD_RULES.document.mimes]);

/**
 * Header khi phát một tệp người dùng tải lên. `nosniff` buộc trình duyệt theo đúng loại tệp; CSP `sandbox` (mọi loại trừ PDF,
 * vì trình xem PDF của trình duyệt không chạy trong sandbox) để dù tệp có lọt qua kiểm tra cũng không chạy được mã trên
 * tên miền Hội Mình. Tệp cũ lưu với loại lạ (trước khi có kiểm tra lúc tải lên) phát như tệp tải về, không mở trong trang.
 */
export function servingHeaders(storedType: string): Record<string, string> {
  const m = baseMime(storedType);
  const known = SERVABLE_MIMES.has(m);
  const headers: Record<string, string> = {
    'Content-Type': !known ? 'application/octet-stream' : m === 'text/plain' ? 'text/plain; charset=utf-8' : m,
    'X-Content-Type-Options': 'nosniff',
  };
  if (m !== 'application/pdf') headers['Content-Security-Policy'] = "default-src 'none'; sandbox";
  if (!known) headers['Content-Disposition'] = 'attachment';
  return headers;
}
