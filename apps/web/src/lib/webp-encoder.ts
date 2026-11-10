// Bộ mã hóa WebP chạy bằng WebAssembly (libwebp, gói @jsquash/webp), dành cho trình duyệt không tự xuất được WebP
// từ canvas (Safari trên iPhone và máy Mac). Tệp này chỉ được nạp bằng import() động từ image-compress.ts, nên
// Vite tách thành một phần riêng: Chrome, Edge, Firefox, Android không bao giờ tải nó về.
// Chạy trên máy người dùng, không qua dịch vụ nào của Cloudflare, nên không tốn lượt chuyển đổi Cloudflare Images.
//
// Gọi thẳng hai tệp codec thay vì `@jsquash/webp/encode`: tệp đó kéo theo wasm-feature-detect, mà bản 1.10 của thư viện
// này chứa cú pháp `import.source(...)` nhiều trình duyệt báo lỗi cú pháp ngay khi nạp (hỏng cả bộ mã hóa ở chế độ dev,
// còn bản build chỉ thoát nhờ Rollup lược bỏ đoạn không dùng). Việc duy nhất cần ở thư viện đó là dò SIMD, làm ở dưới.
import type { WebPModule } from '@jsquash/webp/codec/enc/webp_enc.js';
import { defaultOptions } from '@jsquash/webp/meta.js';

/** Module WebAssembly nhỏ nhất có dùng lệnh SIMD: trình duyệt nhận nó là hợp lệ thì chạy được bản codec SIMD (nhanh hơn). */
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

let loading: Promise<WebPModule> | undefined;

/** Tải và khởi động codec một lần cho cả phiên. Tải hỏng (rớt mạng) thì lần gọi sau thử lại, không kẹt ở lỗi cũ. */
function loadEncoder(): Promise<WebPModule> {
  if (!loading) {
    const attempt = (async () => {
      const codec = WebAssembly.validate(SIMD_PROBE)
        ? await import('@jsquash/webp/codec/enc/webp_enc_simd.js')
        : await import('@jsquash/webp/codec/enc/webp_enc.js');
      return codec.default({ noInitialRun: true });
    })();
    attempt.catch(() => { if (loading === attempt) loading = undefined; });
    loading = attempt;
  }
  return loading;
}

/** Mã hóa điểm ảnh RGBA thành WebP. `quality` theo thang 0 đến 1 như canvas.toBlob. Giữ được nền trong suốt. */
export async function encodeWebp(pixels: ImageData, quality: number): Promise<Blob> {
  const encoder = await loadEncoder();
  const bytes = encoder.encode(pixels.data, pixels.width, pixels.height, { ...defaultOptions, quality: Math.round(quality * 100) });
  if (!bytes) throw new Error('Không mã hóa được WebP');
  // Sao ra vùng nhớ riêng: `bytes` trỏ vào bộ nhớ của WebAssembly, lần mã hóa sau sẽ ghi đè.
  return new Blob([bytes.slice()], { type: 'image/webp' });
}
