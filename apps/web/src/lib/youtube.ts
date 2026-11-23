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
  getPlaybackRate?(): number;
  /** Nạp lại video (bỏ phần đã tải) rồi phát từ `startSeconds`. */
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  /**
   * Các lệnh về chất lượng: YouTube không cam kết giữ, nên gọi kiểu có thì dùng. Lệnh đặt mức (`setPlaybackQuality*`)
   * đã thành lệnh rỗng với trình phát nhúng: trang đổi chất lượng bằng cỡ khung (xem `frameScale`).
   */
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

/**
 * Ảnh bìa nét cho khung phát lớn ở trang học, thử lần lượt từ nét nhất: `maxresdefault` (1280x720, 16:9, chỉ có khi video
 * được tải lên từ 720p trở lên), `sddefault` (640x480), rồi `hqdefault` (480x360, luôn có). Bản 480px kéo giãn ra khung
 * rộng cả nghìn điểm ảnh thì mờ, nên chỉ dùng khi không còn bản nào nét hơn.
 */
export function youtubePosterCandidates(videoId: string): string[] {
  return ['maxresdefault', 'sddefault', 'hqdefault'].map((size) => `https://i.ytimg.com/vi/${videoId}/${size}.jpg`);
}

/** Video không có bản ảnh cỡ đó thì YouTube trả về ảnh xám 120x90 thay vì báo lỗi: coi như không có, thử bản kế tiếp. */
export function isMissingYoutubeThumb(naturalWidth: number): boolean {
  return naturalWidth > 0 && naturalWidth <= 120;
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

/** Chiều cao khung hình (điểm ảnh) của từng mức. */
const QUALITY_HEIGHTS: Record<string, number> = {
  tiny: 144, small: 240, medium: 360, large: 480, hd720: 720, hd1080: 1080, hd1440: 1440, hd2160: 2160, hd2880: 2880, highres: 4320,
};

/** hd720 → 720. "Tự động" và mức lạ → 0. */
export function qualityHeight(level: string): number {
  return QUALITY_HEIGHTS[level] ?? 0;
}

/** Tên hiện cho một mức chất lượng của YouTube: hd720 → "720p". Mức lạ thì hiện nguyên mã. */
export function qualityLabel(level: string): string {
  if (!level || level === QUALITY_AUTO || level === 'default' || level === 'unknown') return 'Tự động';
  return QUALITY_LABELS[level] ?? level;
}

/** "Tự động" cho YouTube phát tới ít nhất 720p, kể cả khi trình phát nhỏ (điện thoại, laptop có cột giáo trình). */
export const AUTO_MIN_HEIGHT = 720;
/** Mức cao nhất trang xin được: 4K. Cao hơn thì khung YouTube phải dựng quá lớn so với sức trình duyệt điện thoại. */
export const MAX_QUALITY_HEIGHT = 2160;

/**
 * Danh sách cho mục Chất lượng: "Tự động" đứng đầu, rồi các mức video có, từ cao xuống thấp như YouTube trả về.
 * Bỏ mức lạ và mức trên 4K: trang không xin được các mức đó (xem `frameScale`).
 */
export function qualityOptions(levels: readonly string[]): string[] {
  return [QUALITY_AUTO, ...new Set(levels.filter((l) => qualityHeight(l) > 0 && qualityHeight(l) <= MAX_QUALITY_HEIGHT))];
}

/**
 * Chiều cao khung hình (điểm ảnh thật của màn hình) muốn YouTube phát tới.
 * "Tự động": đủ nét cho vùng video đang hiện (cạnh ngắn nhân mật độ điểm ảnh), thấp nhất 720p. Chọn tay: đúng mức đó.
 * YouTube vẫn tự hạ mức khi mạng yếu; con số này chỉ là trần.
 */
export function qualityTarget(pref: string, shortSide: number, dpr = 1): number {
  const auto = Math.max(AUTO_MIN_HEIGHT, Math.round(shortSide * Math.max(dpr, 1)));
  const wanted = pref === QUALITY_AUTO ? auto : qualityHeight(pref) || auto;
  return Math.min(wanted, MAX_QUALITY_HEIGHT);
}

/**
 * Hệ số phóng khung YouTube. YouTube đã bỏ lệnh chọn chất lượng cho trình phát nhúng (`setPlaybackQuality` thành lệnh
 * rỗng) và tự chọn mức theo cỡ khung: khung cao 340px thì phát 360p, dù người học bấm 1080p. Nên trang dựng khung YouTube
 * gấp `scale` lần cỡ đang hiện rồi thu về vừa trình phát bằng `transform`: YouTube thấy khung đúng cỡ của mức muốn có,
 * người học thấy khung vừa khít như cũ.
 * - `target`: chiều cao muốn phát tới (`qualityTarget`); dư 2% để làm tròn cỡ khung không đẩy xuống mức dưới.
 * - `shortSide`: cạnh ngắn (px CSS) của vùng video đang hiện.
 * - `gain`: YouTube tự nhân cỡ khung thêm bao nhiêu lần (mật độ điểm ảnh), học qua `learnGain`; 1 khi chưa biết.
 * - `allowShrink`: mức chọn tay được dựng khung nhỏ hơn cỡ đang hiện rồi phóng lên, để chọn 360p ở toàn màn hình vẫn là 360p.
 *   "Tự động" không bao giờ thu khung nhỏ hơn cỡ đang hiện.
 */
export function frameScale(target: number, shortSide: number, gain = 1, allowShrink = false): number {
  if (!(shortSide > 0) || !(target > 0)) return 1;
  const k = (target * 1.02) / Math.max(gain, 1) / shortSide;
  return Math.min(Math.max(k, allowShrink ? 0.1 : 1), 20);
}

/**
 * YouTube phát mức cao hơn cả khung lớn nhất trang đưa nó gần đây: YouTube đã tính cỡ khung theo điểm ảnh thật (nhân
 * mật độ điểm ảnh `dpr`). Trả về hệ số mới (bằng `dpr`) để trang thu khung lại, không tốn mạng hơn mức cần; không thì giữ nguyên.
 * Chỉ kết luận khi chắc: mức vượt từ 720p trở lên, khung từ 360px, và video có mức vừa khung mà YouTube đã không chọn.
 * `frameShort`: cạnh ngắn (px CSS) của vùng video trong khung YouTube, lấy cỡ lớn nhất còn ảnh hưởng tới phần đã tải.
 */
export function learnGain(gain: number, reported: string, frameShort: number, levels: readonly string[], dpr: number): number {
  const h = qualityHeight(reported);
  if (dpr <= gain || frameShort < 360 || h < AUTO_MIN_HEIGHT || h <= frameShort * 1.05) return gain;
  return levels.some((l) => qualityHeight(l) > 0 && qualityHeight(l) <= frameShort) ? dpr : gain;
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
