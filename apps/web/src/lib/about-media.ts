// Ảnh và video trang giới thiệu hội: nhận diện link video, ảnh xem trước và địa chỉ nhúng (dùng ở trang giới thiệu và Cài đặt · Chung).
import { parseVideoUrl } from '@hoiminh/contracts';

export const VIDEO_PROVIDER_LABEL: Record<string, string> = { youtube: 'YouTube', vimeo: 'Vimeo', loom: 'Loom', tiktok: 'TikTok', facebook: 'Facebook', bunny: 'Bunny' };
export const VIDEO_SOURCES = 'YouTube, Vimeo, Loom, TikTok, Facebook hoặc Bunny';

export interface VideoInfo {
  provider: string;
  label: string;
  /** Ảnh xem trước lấy thẳng từ nơi chứa video; chỉ YouTube có sẵn, các nơi khác hiện nền tối kèm nút phát. */
  thumb: string | null;
  /** Địa chỉ nhúng, tự phát khi người xem bấm nút. */
  embedSrc: string;
}

/** Trả về null khi link không phải video nhận diện được. */
export function videoInfo(url: string): VideoInfo | null {
  const e = parseVideoUrl(url);
  if (!e) return null;
  return {
    provider: e.provider,
    label: VIDEO_PROVIDER_LABEL[e.provider] ?? 'Video',
    thumb: e.provider === 'youtube' ? `https://i.ytimg.com/vi/${e.externalId}/hqdefault.jpg` : null,
    embedSrc: `${e.embedUrl}${e.embedUrl.includes('?') ? '&' : '?'}autoplay=1`,
  };
}
