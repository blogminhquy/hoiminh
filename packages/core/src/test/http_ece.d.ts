// Khai báo kiểu tối thiểu cho thư viện http_ece (chỉ dùng trong test để giải mã Web Push như một trình duyệt).
declare module 'http_ece' {
  import type { ECDH } from 'node:crypto';
  const ece: {
    decrypt(buffer: Buffer, params: { version: 'aes128gcm'; privateKey: ECDH; authSecret: string }): Buffer;
    encrypt(buffer: Buffer, params: Record<string, unknown>): Buffer;
  };
  export default ece;
}
