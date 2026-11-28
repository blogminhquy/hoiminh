// Nguồn của một lượt bấm link affiliate: đọc từ trang giới thiệu (referrer), tham số trên link và dấu hiệu trình
// duyệt trong ứng dụng (Zalo, Facebook, TikTok mở link bằng trình duyệt riêng và thường không gửi referrer).
// Hàm thuần, dùng chung cho API (lúc ghi lượt bấm) và Web (nhãn trong báo cáo).

export const TRAFFIC_SOURCES = ['facebook', 'zalo', 'youtube', 'tiktok', 'instagram', 'google', 'email', 'hoiminh', 'direct', 'other'] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

export const TRAFFIC_SOURCE_LABEL: Record<TrafficSource, string> = {
  facebook: 'Facebook',
  zalo: 'Zalo',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  google: 'Google',
  email: 'Email',
  hoiminh: 'Trong Hội Mình',
  direct: 'Truy cập trực tiếp',
  other: 'Nguồn khác',
};

/** Nhãn của một nguồn đã lưu; dòng cũ (chưa phân loại) hoặc giá trị lạ hiện là "Nguồn khác". */
export function trafficSourceLabel(source: string | null | undefined): string {
  return (TRAFFIC_SOURCES as readonly string[]).includes(source ?? '') ? TRAFFIC_SOURCE_LABEL[source as TrafficSource] : TRAFFIC_SOURCE_LABEL.other;
}

/** Mã chỗ đặt link của chính Hội Mình (tham số `pl` trên link): chữ thường, số, gạch ngang, gạch dưới, chấm; tối đa 64 ký tự. */
export const PLACEMENT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** Đọc mã chỗ đặt từ link trang đích. Không có hoặc sai dạng thì null. */
export function placementOf(landingUrl: string | null | undefined): string | null {
  const raw = paramOf(landingUrl, 'pl')?.trim().toLowerCase();
  return raw && PLACEMENT_PATTERN.test(raw) ? raw : null;
}

function urlOf(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function paramOf(landingUrl: string | null | undefined, name: string): string | null {
  return urlOf(landingUrl)?.searchParams.get(name) ?? null;
}

/** Tên miền khớp đúng hoặc là tên miền con: `m.facebook.com` khớp `facebook.com`. */
function hostIs(host: string, ...domains: string[]): boolean {
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

const BY_HOST: Array<[TrafficSource, string[]]> = [
  ['facebook', ['facebook.com', 'fb.com', 'fb.me', 'messenger.com']],
  ['zalo', ['zalo.me', 'zalo.vn', 'zaloapp.com']],
  ['youtube', ['youtube.com', 'youtu.be']],
  ['tiktok', ['tiktok.com']],
  ['instagram', ['instagram.com']],
  ['email', ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'mail.yahoo.com']],
  ['google', ['google.com', 'google.com.vn']],
];

const BY_UTM: Array<[TrafficSource, RegExp]> = [
  ['facebook', /^(facebook|fb|messenger)$/],
  ['zalo', /^zalo$/],
  ['youtube', /^(youtube|yt)$/],
  ['tiktok', /^tiktok$/],
  ['instagram', /^(instagram|ig)$/],
  ['google', /^google$/],
];

/**
 * Phân loại nguồn một lượt bấm. Thứ tự: link đặt trên Hội Mình (`pl`, hoặc referrer chính là Hội Mình), rồi tham số
 * nhận diện mà các nền tảng tự gắn vào link (fbclid, gclid, ttclid, zarsrc), rồi tên miền của referrer, rồi utm, rồi
 * dấu hiệu trình duyệt trong ứng dụng. Không có gì để đọc thì là truy cập trực tiếp.
 * `appUrl` là địa chỉ của Hội Mình, để nhận ra link được bấm từ chính các trang Hội Mình.
 */
export function classifyTrafficSource(input: { referrer?: string | null; landingUrl?: string | null; userAgent?: string | null; appUrl?: string | null }): TrafficSource {
  const landing = urlOf(input.landingUrl);
  const ref = urlOf(input.referrer);
  const refHost = ref?.hostname.toLowerCase() ?? '';
  const appHost = urlOf(input.appUrl)?.hostname.toLowerCase() ?? '';
  const ua = input.userAgent ?? '';
  const param = (name: string) => landing?.searchParams.get(name)?.trim().toLowerCase() || null;

  if (placementOf(input.landingUrl) || (appHost && refHost === appHost)) return 'hoiminh';
  if (param('fbclid')) return 'facebook';
  if (param('zarsrc')) return 'zalo';
  if (param('ttclid')) return 'tiktok';
  if (param('gclid') || param('gbraid') || param('wbraid')) return 'google';
  if (refHost) {
    for (const [source, domains] of BY_HOST) if (hostIs(refHost, ...domains)) return source;
  }
  const medium = param('utm_medium');
  if (medium === 'email' || medium === 'e-mail') return 'email';
  const utm = param('utm_source');
  if (utm) {
    for (const [source, re] of BY_UTM) if (re.test(utm)) return source;
  }
  // Trình duyệt trong ứng dụng thường không gửi referrer, nhưng tự xưng trong user-agent.
  if (/\bZalo\b/i.test(ua)) return 'zalo';
  if (/FBAN|FBAV|FB_IAB|Messenger/i.test(ua)) return 'facebook';
  if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) return 'tiktok';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (refHost || utm) return 'other';
  return 'direct';
}
