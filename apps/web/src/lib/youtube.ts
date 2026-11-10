// Trình phát YouTube của bài học (components/YouTubePlayer.tsx): nạp IFrame Player API một lần cho cả trang,
// kiểu tối thiểu của API, và các hàm thuần cho thanh điều khiển. Hàm thuần tách riêng để test chạy được trên Node.

/** Trạng thái do YouTube báo qua onStateChange. */
export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/** Phần của YT.Player mà trình phát dùng tới. */
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoLoadedFraction(): number;
  getPlayerState(): number;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  getAvailablePlaybackRates(): number[];
  /** Các lệnh về chất lượng: YouTube không cam kết giữ, nên gọi kiểu có thì dùng. */
  getAvailableQualityLevels?(): string[];
  getPlaybackQuality?(): string;
  setPlaybackQuality?(quality: string): void;
  setPlaybackQualityRange?(min: string, max: string): void;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

export interface YTPlayerOptions {
  host?: string;
  videoId: string;
  width?: string;
  height?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: () => void;
    onStateChange?: (e: { data: number }) => void;
    onPlaybackRateChange?: (e: { data: number }) => void;
    onPlaybackQualityChange?: (e: { data: string }) => void;
    onError?: (e: { data: number }) => void;
  };
}

export interface YTNamespace {
  Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Tên miền không gắn cookie theo dõi của YouTube, khớp với `parseVideoUrl`. */
export const YT_HOST = 'https://www.youtube-nocookie.com';

/**
 * Tham số nhúng: tắt thanh điều khiển, phím tắt và nút toàn màn hình của YouTube (trang tự dựng các nút này),
 * `rel=0` để YouTube không gợi ý video kênh khác, `playsinline` để iPhone phát ngay trong trang.
 */
export const YT_PLAYER_VARS = { controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, playsinline: 1, modestbranding: 1 } as const;

let apiPromise: Promise<YTNamespace> | null = null;

/** Nạp IFrame Player API. Gọi nhiều lần vẫn chỉ chèn một thẻ script; lỗi thì lần gọi sau thử lại từ đầu. */
export function loadYouTubeApi(timeoutMs = 15_000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      clearTimeout(timer);
      apiPromise = null;
      script.remove();
      reject(new Error('Không tải được trình phát YouTube'));
    };
    const timer = setTimeout(fail, timeoutMs);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
      else fail();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Ảnh bìa của video. Bản `hqdefault` luôn có; là ảnh 4:3 có viền đen, khung 16:9 cắt đúng phần viền đó. */
export function youtubePoster(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Link dạng /shorts/ là video dọc. */
export function isVerticalVideoUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\/shorts\//.test(url));
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Các tốc độ có trong mục Tốc độ, từ chậm tới nhanh. */
export const SPEED_STEPS = [0.75, 1, 1.25, 1.5, 2] as const;

/** Tốc độ hiện trong mục Tốc độ: chỉ lấy tốc độ mà video cho phép, và luôn có tốc độ đang phát. */
export function speedOptions(available: readonly number[], current = 1): number[] {
  const steps: number[] = SPEED_STEPS.filter((r) => available.length === 0 || available.includes(r));
  if (!steps.includes(current)) steps.push(current);
  return steps.sort((a, b) => a - b);
}

/** 1.25 → "1,25x". */
export function speedLabel(rate: number): string {
  return `${String(rate).replace('.', ',')}x`;
}

/** Mức chất lượng "để YouTube tự chọn theo mạng". */
export const QUALITY_AUTO = 'auto';

const QUALITY_LABELS: Record<string, string> = {
  tiny: '144p', small: '240p', medium: '360p', large: '480p', hd720: '720p', hd1080: '1080p', hd1440: '1440p', hd2160: '2160p (4K)', hd2880: '2880p (5K)', highres: 'Cao nhất',
};

/** Tên hiện cho một mức chất lượng của YouTube: hd720 → "720p". Mức lạ thì hiện nguyên mã. */
export function qualityLabel(level: string): string {
  if (!level || level === QUALITY_AUTO || level === 'default' || level === 'unknown') return 'Tự động';
  return QUALITY_LABELS[level] ?? level;
}

/** Danh sách cho mục Chất lượng: "Tự động" đứng đầu, rồi các mức video có, từ cao xuống thấp như YouTube trả về. */
export function qualityOptions(levels: readonly string[]): string[] {
  return [QUALITY_AUTO, ...new Set(levels.filter((l) => l && l !== QUALITY_AUTO && l !== 'default' && l !== 'unknown'))];
}

/**
 * Video sắp hết: trình phát tự dừng ngay trước giây cuối, nên YouTube không kịp bật màn hình gợi ý video.
 * Ngưỡng tính theo tốc độ phát, vì thời gian được đọc mỗi 250ms. Buổi phát trực tiếp (thời lượng 0) không có điểm hết.
 */
export function nearEnd(current: number, duration: number, rate = 1): boolean {
  return duration > 0 && duration - current <= 0.35 + 0.3 * Math.max(rate, 0.25);
}

/** Lời báo lỗi theo mã của YouTube (onError). */
export function youtubeErrorMessage(code: number): string {
  if (code === 100) return 'Video không còn hoặc đang để riêng tư.';
  if (code === 101 || code === 150) return 'Chủ video chưa cho phép phát video này ở trang khác.';
  return 'Không phát được video này.';
}
