// Trình phát YouTube của bài học. Người học chỉ xem video ngay trong trang, không có lối nào sang YouTube:
//   - Khung YouTube bị khóa tương tác (inert, pointer-events: none) và nằm dưới một lớp chắn nhận mọi lượt bấm.
//   - Khung cao hơn vùng nhìn thấy nên tên video, logo YouTube và dải "Video khác" khi tạm dừng nằm ngoài vùng nhìn.
//   - Trang tự dựng nút phát, tua, âm lượng, toàn màn hình và nút Cài đặt (chất lượng, tốc độ), và tự dừng
//     trước giây cuối để YouTube không bật màn hình gợi ý video.
// Kiểu dáng nằm ở packages/ui/src/styles.css (các lớp .ytl-*).
import { Check, ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Settings, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent } from 'react';
import { QUALITY_AUTO, YT_HOST, YT_PLAYER_VARS, YT_STATE, formatClock, loadYouTubeApi, nearEnd, qualityLabel, qualityOptions, speedLabel, speedOptions, youtubeErrorMessage, youtubePoster, type YTPlayer } from '@/lib/youtube';

type Phase = 'loading' | 'ready' | 'playing' | 'buffering' | 'paused' | 'ended' | 'error';
type FullscreenBox = HTMLDivElement & { webkitRequestFullscreen?: () => void };
type FullscreenDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };

type Menu = 'main' | 'quality' | 'speed' | null;

const LOAD_ERROR = 'Không tải được trình phát YouTube. Kiểm tra mạng rồi thử lại.';
/** Chất lượng người học đã chọn, nhớ ở máy để các bài sau phát đúng mức đó (mạng yếu chỉ cần chọn 360p một lần). */
const QUALITY_KEY = 'hm_video_quality';
const savedQuality = () => {
  try { return window.localStorage.getItem(QUALITY_KEY) || QUALITY_AUTO; } catch { return QUALITY_AUTO; }
};
/** Xin YouTube phát ở một mức chất lượng. "Tự động" là bỏ giới hạn, để YouTube chọn theo mạng. */
const requestQuality = (p: YTPlayer, level: string) => {
  p.setPlaybackQualityRange?.(level, level);
  p.setPlaybackQuality?.(level);
};
const Spinner = () => <span className="inline-block w-9 h-9 rounded-full border-[3px] border-current border-t-transparent animate-spin" />;

export function YouTubePlayer({ videoId, title, vertical = false }: { videoId: string; title: string; vertical?: boolean }) {
  const boxRef = useRef<FullscreenBox>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  /** Trang đã tự dừng ở cuối video: lượt PAUSED theo sau không được tính là người học bấm tạm dừng. */
  const endedRef = useRef(false);
  /** Người học bấm phát khi trình phát chưa tải xong. */
  const wantPlayRef = useRef(false);
  /** Trước mốc này (ms) không lấy vị trí từ YouTube, để thanh kéo không giật về chỗ cũ khi đang tua. */
  const seekHoldRef = useRef(0);
  const seekValueRef = useRef(0);
  const draggingRef = useRef(false);
  /** Video đã phát lần nào chưa: mức chất lượng đã nhớ chỉ xin một lần, ở lượt phát đầu. */
  const playedRef = useRef(false);
  const lastPointerRef = useRef('mouse');
  const idleTimer = useRef<number>();
  const startTimer = useRef<number>();
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [started, setStarted] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [rate, setRate] = useState(1);
  const [active, setActive] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const [posterOk, setPosterOk] = useState(true);
  const [menu, setMenu] = useState<Menu>(null);
  /** Mức YouTube đang phát thật, các mức video có, và mức người học chọn. */
  const [quality, setQuality] = useState('');
  const [levels, setLevels] = useState<string[]>([]);
  const [qualityPref, setQualityPref] = useState(savedQuality);
  const qualityPrefRef = useRef(qualityPref);
  const [rates, setRates] = useState<number[]>([]);

  /** Hiện thanh điều khiển, rồi tự ẩn sau gần 3 giây không động tới. */
  const wake = useCallback(() => {
    setActive(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setActive(false), 2800);
  }, []);

  /**
   * Vài trình duyệt điện thoại chặn phát có tiếng khi lượt chạm không nằm trong khung video. Sau 4 giây chưa chạy thì
   * phát tắt tiếng (luôn được phép) và mời người học bật tiếng.
   */
  const armStartFallback = useCallback(() => {
    window.clearTimeout(startTimer.current);
    startTimer.current = window.setTimeout(() => {
      const p = playerRef.current;
      if (!p) return;
      const state = p.getPlayerState();
      if (state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING) return;
      p.mute();
      p.playVideo();
      setMuted(true);
      setNeedsUnmute(true);
    }, 4000);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let dead = false;
    let player: YTPlayer | null = null;
    playedRef.current = false;
    // Chuột, bàn phím và trình đọc màn hình đều bỏ qua khung YouTube: không bấm được vào link nào bên trong.
    frame.inert = true;
    const mount = document.createElement('div');
    frame.appendChild(mount);
    loadYouTubeApi().then((YT) => {
      if (dead) return;
      player = new YT.Player(mount, {
        host: YT_HOST,
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { ...YT_PLAYER_VARS, origin: window.location.origin, hl: 'vi' },
        events: {
          onReady: () => {
            if (dead || !player) return;
            playerRef.current = player;
            player.getIframe().tabIndex = -1;
            setDuration(player.getDuration() || 0);
            setPhase('ready');
            if (wantPlayRef.current) {
              wantPlayRef.current = false;
              player.playVideo();
              armStartFallback();
            }
          },
          onStateChange: (e) => {
            if (dead) return;
            if (e.data === YT_STATE.PLAYING) {
              window.clearTimeout(startTimer.current);
              // YouTube chỉ biết video có những mức chất lượng nào sau khi bắt đầu phát.
              if (player) {
                setLevels(player.getAvailableQualityLevels?.() ?? []);
                setQuality(player.getPlaybackQuality?.() ?? '');
                setRates(player.getAvailablePlaybackRates());
                if (!playedRef.current && qualityPrefRef.current !== QUALITY_AUTO) requestQuality(player, qualityPrefRef.current);
                playedRef.current = true;
              }
              setStarted(true);
              setWaiting(false);
              setPhase('playing');
            } else if (e.data === YT_STATE.ENDED) {
              endedRef.current = true;
              setPhase('ended');
            } else if (endedRef.current) {
              return;
            } else if (e.data === YT_STATE.BUFFERING) {
              window.clearTimeout(startTimer.current);
              setPhase('buffering');
            } else if (e.data === YT_STATE.PAUSED) {
              setWaiting(false);
              setPhase('paused');
            }
          },
          onPlaybackRateChange: (e) => { if (!dead) setRate(e.data); },
          onPlaybackQualityChange: (e) => {
            if (dead) return;
            setQuality(e.data);
            if (player) setLevels(player.getAvailableQualityLevels?.() ?? []);
          },
          onError: (e) => {
            if (dead) return;
            setError(youtubeErrorMessage(e.data));
            setPhase('error');
          },
        },
      });
    }).catch(() => {
      if (dead) return;
      setError(LOAD_ERROR);
      setPhase('error');
    });
    return () => {
      dead = true;
      window.clearTimeout(startTimer.current);
      window.clearTimeout(idleTimer.current);
      playerRef.current = null;
      try { player?.destroy(); } catch { /* khung đã bị gỡ khỏi trang */ }
      frame.replaceChildren();
    };
  }, [videoId, attempt, armStartFallback]);

  // Đọc vị trí phát mỗi 250ms; sắp hết video thì tự dừng và che bằng màn hình "Xem lại".
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'buffering' && phase !== 'paused') return;
    const tick = () => {
      const p = playerRef.current;
      if (!p) return;
      const total = p.getDuration() || 0;
      const now = p.getCurrentTime() || 0;
      setDuration(total);
      setLoaded(p.getVideoLoadedFraction() || 0);
      if (draggingRef.current || Date.now() < seekHoldRef.current) return;
      setTime(now);
      if (phase === 'playing' && nearEnd(now, total, rate)) {
        endedRef.current = true;
        p.pauseVideo();
        setPhase('ended');
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [phase, rate]);

  useEffect(() => {
    const sync = () => {
      const doc = document as FullscreenDoc;
      setFullscreen(Boolean(boxRef.current) && (doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null) === boxRef.current);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  // Toàn màn hình kiểu phủ kín trang (iPhone không cho phần tử thường vào toàn màn hình thật): khóa cuộn trang nền.
  useEffect(() => {
    if (!pseudoFs) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [pseudoFs]);

  const play = () => {
    setNeedsUnmute(false);
    if (!started) setWaiting(true);
    const p = playerRef.current;
    if (!p) { wantPlayRef.current = true; return; }
    if (endedRef.current) {
      endedRef.current = false;
      seekHoldRef.current = Date.now() + 800;
      p.seekTo(0, true);
      setTime(0);
    }
    p.playVideo();
    if (!started) armStartFallback();
  };

  const toggle = () => {
    if (phase === 'error') return;
    if (phase === 'playing' || phase === 'buffering') playerRef.current?.pauseVideo();
    else play();
    wake();
  };

  const seekBy = (delta: number) => {
    const p = playerRef.current;
    if (!p || !started || phase === 'ended') return;
    const target = Math.max(0, Math.min((p.getCurrentTime() || 0) + delta, Math.max(duration - 1, 0)));
    seekHoldRef.current = Date.now() + 500;
    p.seekTo(target, true);
    setTime(target);
  };

  const onSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const target = Number(e.target.value);
    seekValueRef.current = target;
    draggingRef.current = true;
    setTime(target);
    // Đang kéo thì chỉ tua trong phần đã tải; thả tay (commitSeek) mới cho YouTube tải đoạn mới.
    playerRef.current?.seekTo(target, false);
    wake();
  };
  const commitSeek = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    seekHoldRef.current = Date.now() + 500;
    playerRef.current?.seekTo(seekValueRef.current, true);
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) {
      p.unMute();
      if (volume === 0) { p.setVolume(50); setVolume(50); }
    } else {
      p.mute();
    }
    setMuted(!muted);
    setNeedsUnmute(false);
  };

  const onVolume = (e: ChangeEvent<HTMLInputElement>) => {
    const p = playerRef.current;
    const next = Number(e.target.value);
    if (!p) return;
    p.setVolume(next);
    if (next === 0) p.mute(); else p.unMute();
    setVolume(next);
    setMuted(next === 0);
    setNeedsUnmute(false);
  };

  const chooseRate = (next: number) => {
    playerRef.current?.setPlaybackRate(next);
    setRate(next);
    setMenu(null);
  };

  const chooseQuality = (level: string) => {
    const p = playerRef.current;
    if (p) requestQuality(p, level);
    qualityPrefRef.current = level;
    setQualityPref(level);
    try { window.localStorage.setItem(QUALITY_KEY, level); } catch { /* máy chặn lưu: chỉ áp dụng cho video này */ }
    setMenu(null);
  };

  const toggleFullscreen = () => {
    const box = boxRef.current;
    const doc = document as FullscreenDoc;
    if (!box) return;
    if (pseudoFs) { setPseudoFs(false); return; }
    if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => undefined);
      else doc.webkitExitFullscreen?.();
      return;
    }
    if (box.requestFullscreen) {
      box.requestFullscreen().then(() => {
        // Điện thoại Android: xoay ngang cho video ngang. Trình duyệt không hỗ trợ thì bỏ qua.
        const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        if (!vertical) void orientation?.lock?.('landscape').catch(() => undefined);
      }).catch(() => setPseudoFs(true));
    } else if (box.webkitRequestFullscreen) {
      box.webkitRequestFullscreen();
    } else {
      setPseudoFs(true);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target as HTMLElement).tagName;
    // Thanh kéo tự xử lý phím mũi tên; nút tự nhận Space và Enter.
    if (tag === 'INPUT') return;
    switch (e.key) {
      case ' ': case 'Enter': if (tag === 'BUTTON') return; toggle(); break;
      case 'k': case 'K': toggle(); break;
      case 'ArrowLeft': seekBy(-5); break;
      case 'ArrowRight': seekBy(5); break;
      case 'j': case 'J': seekBy(-10); break;
      case 'l': case 'L': seekBy(10); break;
      case 'm': case 'M': toggleMute(); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'Escape': if (menu) setMenu(null); else if (pseudoFs) setPseudoFs(false); else return; break;
      default: return;
    }
    e.preventDefault();
    wake();
  };

  const onSurfaceClick = () => {
    // Bảng cài đặt đang mở: bấm ra ngoài chỉ đóng bảng, không tạm dừng video.
    if (menu) { setMenu(null); return; }
    // Điện thoại: thanh điều khiển đang ẩn thì lượt chạm đầu chỉ gọi thanh ra, chạm lần nữa mới tạm dừng.
    if (lastPointerRef.current === 'touch' && phase === 'playing' && !active) { wake(); return; }
    toggle();
  };

  const retry = () => {
    endedRef.current = false;
    wantPlayRef.current = false;
    setError('');
    setStarted(false);
    setWaiting(false);
    setMenu(null);
    setPhase('loading');
    setAttempt((n) => n + 1);
  };

  const playing = phase === 'playing' || phase === 'buffering';
  const showBar = started && phase !== 'ended' && phase !== 'error';
  const idle = showBar && phase === 'playing' && !active && !menu;
  const qualityNow = qualityLabel(quality);
  // Để "Tự động" thì hiện kèm mức YouTube đang phát; đã chọn tay thì hiện mức đang phát thật, kể cả khi YouTube chưa đổi kịp.
  const qualityValue = qualityPref === QUALITY_AUTO ? (quality ? `Tự động (${qualityNow})` : 'Tự động') : (quality ? qualityNow : qualityLabel(qualityPref));
  const full = fullscreen || pseudoFs;
  const played = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  const seekStyle = { '--p': `${played}%`, '--l': `${Math.max(played, Math.min(100, loaded * 100))}%` } as CSSProperties;
  const volumeStyle = { '--p': `${muted ? 0 : volume}%`, '--l': '0%' } as CSSProperties;
  const cls = ['ytl', vertical && 'ytl-vertical', full && 'ytl-fs', pseudoFs && 'ytl-fs-pseudo', idle && 'ytl-idle'].filter(Boolean).join(' ');

  return (
    <div ref={boxRef} className={cls} role="group" aria-label={`Video bài học: ${title}`} data-phase={phase} onKeyDown={onKeyDown} onPointerMove={(e) => { if (e.pointerType !== 'touch') wake(); }}>
      <div className="ytl-stage">
        <div ref={frameRef} className="ytl-frame" />
        {(!started || phase === 'ended') && phase !== 'error' && (
          <div className="ytl-cover" aria-hidden="true">
            {posterOk && <img src={youtubePoster(videoId)} alt="" className="ytl-poster" onError={() => setPosterOk(false)} />}
            <span className={phase === 'ended' ? 'ytl-shade ytl-shade-end' : 'ytl-shade'} />
          </div>
        )}
      </div>
      <button
        type="button"
        className="ytl-surface"
        aria-label={phase === 'ended' ? 'Xem lại video' : playing ? 'Tạm dừng video' : 'Phát video'}
        disabled={phase === 'error'}
        onPointerDown={(e) => { lastPointerRef.current = e.pointerType; }}
        onClick={onSurfaceClick}
      />
      {/* Tạm dừng giữa chừng thì không đặt gì lên giữa khung hình: người học thường dừng lại để đọc slide. */}
      {phase !== 'error' && (
        <span className="ytl-center" aria-hidden="true">
          {waiting || phase === 'buffering' ? <Spinner />
            : phase === 'ended' ? <span className="ytl-replay"><RotateCcw size={22} />Xem lại</span>
            : !started ? <span className="ytl-play"><Play size={30} /></span>
            : null}
        </span>
      )}
      {needsUnmute && <button type="button" className="ytl-unmute" onClick={toggleMute}><VolumeX size={18} />Chạm để bật tiếng</button>}
      {showBar && (
        <div className="ytl-bar">
          <input type="range" className="ytl-range" aria-label="Vị trí phát" aria-valuetext={`${formatClock(time)} trên ${formatClock(duration)}`} min={0} max={duration || 0} step="any" value={Math.min(time, duration || 0)} disabled={duration <= 0} style={seekStyle} onChange={onSeek} onPointerUp={commitSeek} onKeyUp={commitSeek} onBlur={commitSeek} />
          <div className="ytl-row">
            <button type="button" className="ytl-btn" aria-label={playing ? 'Tạm dừng' : 'Phát'} onClick={toggle}>{playing ? <Pause size={22} /> : <Play size={22} />}</button>
            <button type="button" className="ytl-btn ytl-wide" aria-label="Lùi 10 giây" title="Lùi 10 giây" onClick={() => seekBy(-10)}><RotateCcw size={20} /></button>
            <button type="button" className="ytl-btn ytl-wide" aria-label="Tới 10 giây" title="Tới 10 giây" onClick={() => seekBy(10)}><RotateCw size={20} /></button>
            <span className="ytl-time">{formatClock(time)} / {formatClock(duration)}</span>
            <span className="flex-grow" />
            <button type="button" className="ytl-btn" aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'} onClick={toggleMute}>{muted ? <VolumeX size={22} /> : <Volume2 size={22} />}</button>
            <input type="range" className="ytl-range ytl-volume ytl-wide" aria-label="Âm lượng" min={0} max={100} step={5} value={muted ? 0 : volume} style={volumeStyle} onChange={onVolume} />
            <button type="button" className="ytl-btn" aria-label="Cài đặt video" title="Chất lượng và tốc độ" aria-haspopup="menu" aria-expanded={menu !== null} onClick={() => setMenu(menu ? null : 'main')}><Settings size={22} /></button>
            <button type="button" className="ytl-btn" aria-label={full ? 'Thoát toàn màn hình' : 'Toàn màn hình'} onClick={toggleFullscreen}>{full ? <Minimize size={22} /> : <Maximize size={22} />}</button>
          </div>
        </div>
      )}
      {showBar && menu && (
        <div className="ytl-menu" role="menu" aria-label={menu === 'quality' ? 'Chất lượng' : menu === 'speed' ? 'Tốc độ' : 'Cài đặt video'}>
          {menu === 'main' && (
            <>
              <button type="button" role="menuitem" className="ytl-menu-item" onClick={() => setMenu('quality')}>Chất lượng<span className="ytl-menu-value">{qualityValue}<ChevronRight size={18} /></span></button>
              <button type="button" role="menuitem" className="ytl-menu-item" onClick={() => setMenu('speed')}>Tốc độ<span className="ytl-menu-value">{speedLabel(rate)}<ChevronRight size={18} /></span></button>
            </>
          )}
          {menu === 'quality' && (
            <>
              <button type="button" className="ytl-menu-item ytl-menu-head" aria-label="Quay lại cài đặt" onClick={() => setMenu('main')}><ChevronLeft size={18} />Chất lượng</button>
              <div className="ytl-menu-grid">
                {qualityOptions(levels).map((level) => (
                  <button key={level} type="button" role="menuitemradio" aria-checked={qualityPref === level} className="ytl-menu-item" onClick={() => chooseQuality(level)}>
                    <span className="ytl-menu-check">{qualityPref === level && <Check size={18} />}</span>{qualityLabel(level)}
                  </button>
                ))}
              </div>
            </>
          )}
          {menu === 'speed' && (
            <>
              <button type="button" className="ytl-menu-item ytl-menu-head" aria-label="Quay lại cài đặt" onClick={() => setMenu('main')}><ChevronLeft size={18} />Tốc độ</button>
              <div className="ytl-menu-grid">
                {speedOptions(rates, rate).map((r) => (
                  <button key={r} type="button" role="menuitemradio" aria-checked={rate === r} className="ytl-menu-item" onClick={() => chooseRate(r)}>
                    <span className="ytl-menu-check">{rate === r && <Check size={18} />}</span>{speedLabel(r)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {phase === 'error' && (
        <div className="ytl-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>Thử lại</button>
        </div>
      )}
    </div>
  );
}
