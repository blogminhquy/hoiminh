// Nhận biết thiết bị từ chuỗi user agent: điện thoại iPhone hay Android, có đang ở trong trình duyệt của một ứng dụng
// khác (Zalo, Facebook, Messenger...) không, và có đang chạy như ứng dụng đã cài ra màn hình chính không.
// Hàm thuần để test được; phần đọc `navigator` nằm ở currentDevice().

export type InAppBrowser = 'zalo' | 'messenger' | 'facebook' | 'instagram' | 'tiktok' | 'line';
export interface Device {
  os: 'ios' | 'android' | 'other';
  /** Điện thoại (không tính máy tính bảng và máy tính). */
  phone: boolean;
  /** Đang mở trong trình duyệt của ứng dụng nào; null là trình duyệt thật (Safari, Chrome...). */
  inApp: InAppBrowser | null;
  /** Đang chạy như ứng dụng đã cài ra màn hình chính. */
  standalone: boolean;
}

export const IN_APP_NAME: Record<InAppBrowser, string> = { zalo: 'Zalo', messenger: 'Messenger', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', line: 'LINE' };

// Thứ tự quan trọng: Messenger cũng mang dấu của Facebook nên phải xét trước.
const IN_APP: Array<[InAppBrowser, RegExp]> = [
  ['zalo', /Zalo/i],
  ['messenger', /Messenger|\bOrca\b|FBAN\/Messenger|FB_IAB\/MESSENGER/i],
  ['facebook', /FBAN|FBAV|FB_IAB|FB4A|FBIOS/],
  ['instagram', /Instagram/i],
  ['tiktok', /musical_ly|Bytedance|TikTok|trill/i],
  ['line', /\bLine\//],
];

export function detectDevice(userAgent: string, opts: { standalone?: boolean } = {}): Device {
  const ua = userAgent || '';
  const ios = /iPhone|iPod/.test(ua);
  const android = /Android/.test(ua);
  return {
    os: ios ? 'ios' : android ? 'android' : 'other',
    // Android: điện thoại có chữ "Mobile" trong user agent, máy tính bảng thì không. iPad không tính là điện thoại.
    phone: ios || (android && /Mobile/.test(ua)),
    inApp: IN_APP.find(([, re]) => re.test(ua))?.[0] ?? null,
    standalone: Boolean(opts.standalone),
  };
}

/** Thiết bị đang dùng. Ngoài trình duyệt (test, dựng sẵn trên máy chủ) thì coi là máy tính. */
export function currentDevice(): Device {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return detectDevice('');
  let standalone = false;
  try {
    standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch { /* trình duyệt cũ không có matchMedia: coi như chưa cài */ }
  return detectDevice(navigator.userAgent, { standalone });
}
