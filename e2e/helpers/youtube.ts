// YouTube giả cho e2e: máy chạy thử không ra được YouTube, và bài kiểm tra cần biết chắc trang đã gọi lệnh gì.
// Thay ba thứ: tệp IFrame Player API, trang nhúng (có sẵn link sang YouTube và dải "Video khác" để thử bấm), ảnh bìa.
import type { Page } from '@playwright/test';

export interface FakeYouTubeLog {
  calls: string[];
  created: number;
  iframeClicks: number;
  options: { host?: string; videoId: string; playerVars: Record<string, string | number> } | null;
}

/** Tệp thay cho https://www.youtube.com/iframe_api. Video giả chạy theo đồng hồ thật, dài `__ytDuration` giây. */
const FAKE_API = `(() => {
  const log = (window.__yt = { calls: [], created: 0, iframeClicks: 0, options: null });
  window.addEventListener('message', (e) => { if (e.data === 'fake-yt-click') log.iframeClicks += 1; });
  class Player {
    constructor(el, opts) {
      log.created += 1;
      log.options = { host: opts.host, videoId: opts.videoId, playerVars: opts.playerVars };
      this.opts = opts; this.state = -1; this.t = 0; this.at = 0; this.rate = 1; this.muted = false; this.quality = 'hd720';
      this.duration = window.__ytDuration ?? 120;
      const f = document.createElement('iframe');
      f.src = (opts.host || 'https://www.youtube.com') + '/embed/' + opts.videoId + '?' + new URLSearchParams(opts.playerVars).toString();
      f.width = opts.width; f.height = opts.height; f.allow = 'autoplay; encrypted-media';
      el.replaceWith(f);
      this.iframe = f;
      log.fire = (state) => this._set(state);
      setTimeout(() => opts.events.onReady?.({ target: this }), 30);
    }
    _set(state) { this.state = state; setTimeout(() => this.opts.events.onStateChange?.({ data: state }), 0); }
    _now() { return this.state === 1 ? Math.min(this.duration, this.t + ((performance.now() - this.at) / 1000) * this.rate) : this.t; }
    _mark() { this.t = this._now(); this.at = performance.now(); }
    playVideo() { log.calls.push('playVideo'); if (window.__ytBlockSound && !this.muted) return; this._mark(); this._set(1); }
    pauseVideo() { log.calls.push('pauseVideo'); this._mark(); this._set(2); }
    seekTo(s, ahead) { log.calls.push('seekTo:' + Math.round(s) + ':' + ahead); this.t = s; this.at = performance.now(); }
    getCurrentTime() { return this._now(); }
    getDuration() { return this.duration; }
    getVideoLoadedFraction() { return 0.5; }
    getPlayerState() { return this.state; }
    mute() { log.calls.push('mute'); this.muted = true; }
    unMute() { log.calls.push('unMute'); this.muted = false; }
    setVolume(v) { log.calls.push('volume:' + v); }
    setPlaybackRate(r) { log.calls.push('rate:' + r); this._mark(); this.rate = r; this.opts.events.onPlaybackRateChange?.({ data: r }); }
    getAvailablePlaybackRates() { return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]; }
    getAvailableQualityLevels() { return this.state === -1 ? [] : ['hd1080', 'hd720', 'large', 'medium', 'small', 'tiny', 'auto']; }
    getPlaybackQuality() { return this.quality; }
    setPlaybackQuality() {}
    setPlaybackQualityRange(min, max) { log.calls.push('quality:' + min + ':' + max); this.quality = min === 'auto' ? 'hd720' : min; setTimeout(() => this.opts.events.onPlaybackQualityChange?.({ data: this.quality }), 0); }
    getIframe() { return this.iframe; }
    destroy() { log.calls.push('destroy'); this.iframe.remove(); }
  }
  window.YT = { Player };
  window.onYouTubeIframeAPIReady?.();
})();`;

/** Trang nhúng giả: bố cục như trình phát YouTube (tên video bám mép trên, "Video khác" và logo bám mép dưới). */
const FAKE_EMBED = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; height: 100%; background: #000; color: #fff; font: 16px sans-serif; }
  #video { position: absolute; left: 0; right: 0; top: 50%; aspect-ratio: 16 / 9; transform: translateY(-50%); background: linear-gradient(135deg, #0b6f75, #123e42); display: flex; align-items: center; justify-content: center; font-size: 28px; }
  #title { position: absolute; top: 0; left: 0; right: 0; padding: 16px; background: #c00; color: #fff; }
  #more { position: absolute; bottom: 0; left: 0; right: 0; padding: 24px 16px; background: #c00; }
</style></head><body>
  <a id="title" href="https://www.youtube.com/watch?v=fake" target="_blank">Tên video · Xem trên YouTube</a>
  <div id="video">KHUNG HÌNH VIDEO</div>
  <div id="more">Video khác · <a id="logo" href="https://www.youtube.com/" target="_blank">YouTube</a></div>
  <script>document.addEventListener('click', () => parent.postMessage('fake-yt-click', '*'));</script>
</body></html>`;

const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/** Gắn YouTube giả vào trang. Gọi trước khi mở bài học. */
export async function mockYouTube(page: Page, opts: { duration?: number; blockSound?: boolean } = {}): Promise<void> {
  await page.addInitScript(({ duration, blockSound }) => {
    const w = window as unknown as { __ytDuration?: number; __ytBlockSound?: boolean };
    w.__ytDuration = duration;
    w.__ytBlockSound = blockSound;
  }, { duration: opts.duration ?? 120, blockSound: opts.blockSound ?? false });
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: FAKE_API }));
  await page.route(/^https:\/\/www\.youtube(-nocookie)?\.com\/embed\//, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: FAKE_EMBED }));
  await page.route('https://i.ytimg.com/**', (route) => route.fulfill({ contentType: 'image/png', body: PIXEL }));
}

/** Nhật ký của YouTube giả: các lệnh trang đã gọi, tham số nhúng, số lượt bấm lọt vào trong khung. */
export function youtubeLog(page: Page): Promise<FakeYouTubeLog> {
  return page.evaluate(() => {
    const log = (window as unknown as { __yt: FakeYouTubeLog }).__yt;
    return { calls: [...log.calls], created: log.created, iframeClicks: log.iframeClicks, options: log.options };
  });
}
