'use client';

// Module 203510 (MuxPlayerEmbed) → ShowreelPlayer. The reference mounts <mux-player> (theme
// "minimal", PiP / playback-rate / seek buttons hidden, white-on-dark colours) after lazily loading
// the player, showing a plain poster <img> until then. We play our own mp4 through a plain <video>
// and redraw the same chrome: pre-playback 90px round play button, a full-width time range just
// above a 38px control bar (play, time, mute, volume, spacer, quality, fullscreen), controls that
// fade out after 2s of inactivity while playing, and a 470px container breakpoint below which the
// bottom play button and time display are hidden.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { cx } from '@/lib/cx';

export type ShowreelRendition = { label: string; src: string };

export type ShowreelPlayerProps = {
  /** Our own mp4 (replaces the reference `playbackId`). */
  src: string;
  className?: string;
  style?: CSSProperties;
  autoPlay?: boolean;
  muted?: boolean;
  poster?: string;
  placeholder?: string;
  aspectRatio?: number;
  ariaLabel?: string;
  /** Optional extra encodes for the quality menu (reference: Mux rendition menu). Hidden when absent. */
  renditions?: ShowreelRendition[];
};

// Values the reference passes to <mux-player>.
const PRIMARY = '#ffffff';
const SECONDARY = 'rgb(20 20 30 / 78%)';
const ACCENT = 'rgb(255 255 255 / 22%)';
const RANGE_BAR = 'rgb(255 255 255 / 92%)';
const RANGE_TRACK = 'rgb(0 0 0 / 30%)';
const THUMB_BORDER = '1px solid rgb(0 0 0 / 42%)';
const THUMB_SHADOW = '0 0 0 1px rgb(0 0 0 / 22%), 0 1px 3px rgb(0 0 0 / 35%)';

// media-chrome defaults.
const AUTOHIDE_MS = 2000;
const LOADING_DELAY_MS = 500;
const SEEK_OFFSET = 10;
const BREAKPOINT_SM = 470;

const GRADIENT_STEPS =
  'hsl(0 0% 0% / 0) 0%, hsl(0 0% 0% / 0.013) 8.1%, hsl(0 0% 0% / 0.049) 15.5%, hsl(0 0% 0% / 0.104) 22.5%, hsl(0 0% 0% / 0.175) 29%, hsl(0 0% 0% / 0.259) 35.3%, hsl(0 0% 0% / 0.352) 41.2%, hsl(0 0% 0% / 0.45) 47.1%, hsl(0 0% 0% / 0.55) 52.9%, hsl(0 0% 0% / 0.648) 58.8%, hsl(0 0% 0% / 0.741) 64.7%, hsl(0 0% 0% / 0.825) 71%, hsl(0 0% 0% / 0.896) 77.5%, hsl(0 0% 0% / 0.951) 84.5%, hsl(0 0% 0% / 0.987) 91.9%, hsl(0 0% 0%) 100%';

const CSS = `
.ff-reel{position:relative;display:block;width:100%;height:100%;overflow:hidden;background:#000;color:${PRIMARY};line-height:0;font:14px/0 "helvetica neue","segoe ui",roboto,arial,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none}
.ff-reel[data-inactive]:not([data-paused]){cursor:none}
.ff-reel video{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain}
.ff-reel-gesture{position:absolute;inset:0}
.ff-reel-chrome{position:absolute;inset:0;pointer-events:none;transition:opacity .25s}
.ff-reel-chrome > *{pointer-events:auto}
.ff-reel[data-inactive]:not([data-paused]) .ff-reel-chrome{opacity:0;transition:opacity 1s}
.ff-reel:not([data-played]) .ff-reel-chrome{display:none}
.ff-reel-gradient{position:absolute;left:0;bottom:0;width:100%;padding-bottom:min(100px,25%);background:linear-gradient(to bottom,${GRADIENT_STEPS});opacity:.8;pointer-events:none!important}
.ff-reel-bar{position:absolute;left:0;right:0;bottom:0;z-index:20;display:flex;padding:6px}
.ff-reel-ctl{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;height:26px;padding:6px;border:0;border-radius:3px;background:${SECONDARY};color:${PRIMARY};font:inherit;line-height:0;cursor:pointer;transition:background .15s linear;outline-offset:-2px}
.ff-reel-ctl:hover{background:${ACCENT}}
.ff-reel-ctl svg{display:block;width:18px;height:14px;fill:currentColor}
.ff-reel-time{white-space:nowrap}
.ff-reel-spacer{flex-grow:1;background:${SECONDARY}}
.ff-reel[data-small] .ff-reel-bottom-play,.ff-reel[data-small] .ff-reel-time{display:none}
.ff-reel-range{position:relative;box-sizing:border-box;display:flex;align-items:center;cursor:pointer;touch-action:none;outline-offset:-2px}
.ff-reel-track{position:relative;width:100%;height:4px;border-radius:1px;background:${RANGE_TRACK};overflow:visible}
.ff-reel-fill{position:absolute;left:0;top:0;bottom:0;border-radius:1px}
.ff-reel-thumb{position:absolute;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;box-sizing:border-box;background:#ffffff;border:${THUMB_BORDER};box-shadow:${THUMB_SHADOW}}
.ff-reel-timerange{position:absolute;left:0;right:0;bottom:35px;z-index:10;height:10px;padding:0 6px}
.ff-reel-timerange .ff-reel-thumb{transform:scale(0);transition:transform .3s}
.ff-reel-timerange:hover .ff-reel-thumb{transform:scale(1)}
.ff-reel-volume{width:min(100%,100px);height:26px;padding:0 10px;border-radius:3px;background:${SECONDARY}}
.ff-reel-center{position:absolute;inset:0;display:grid;overflow:hidden;pointer-events:none;filter:drop-shadow(0 0 2px rgb(0 0 0 / .25)) drop-shadow(0 0 6px rgb(0 0 0 / .25))}
.ff-reel-center button{place-self:center;grid-area:1/1;margin:16px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:40px;padding:0;border:0;background:transparent;color:${PRIMARY};cursor:pointer;pointer-events:auto;line-height:0}
.ff-reel:not([data-small]) .ff-reel-center button{width:90px;height:90px;border-radius:50%;padding:24px;background:#000;transition:background .4s}
.ff-reel:not([data-small]) .ff-reel-center button:hover{background:${ACCENT}}
.ff-reel-center svg{width:100%;height:auto;fill:currentColor;transform:translate(3px,0)}
.ff-reel[data-played] .ff-reel-center button,.ff-reel:not([data-paused]) .ff-reel-center button{animation:.3s linear ff-reel-pre-play-hide;opacity:0;pointer-events:none}
@keyframes ff-reel-pre-play-hide{0%{transform:scale(1);opacity:1}30%{transform:scale(.7)}100%{transform:scale(1.5);opacity:0}}
.ff-reel-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.ff-reel-loading svg{width:min(15%,150px);height:auto;animation:ff-reel-spin 1s linear infinite}
@keyframes ff-reel-spin{to{transform:rotate(360deg)}}
.ff-reel-play-icon,.ff-reel-pause-1,.ff-reel-pause-2{transition:all .3s}
.ff-reel[data-paused] .ff-reel-pause-1{opacity:0}
.ff-reel[data-paused] .ff-reel-pause-2{transform-origin:center center;transform:scaleY(0)}
.ff-reel[data-paused] .ff-reel-play-icon{clip-path:inset(0 0 0 0)}
.ff-reel:not([data-paused]) .ff-reel-play-icon{clip-path:inset(0 0 0 100%)}
.ff-reel-mute path,.ff-reel-mute g{transition:opacity .5s}
.ff-reel-mute .ff-reel-muted{opacity:0}
.ff-reel-mute[data-level='low'] :is(.ff-reel-vol-medium,.ff-reel-vol-high),.ff-reel-mute[data-level='medium'] .ff-reel-vol-high{opacity:0}
.ff-reel-mute[data-level='off'] .ff-reel-unmuted{opacity:0}
.ff-reel-mute[data-level='off'] .ff-reel-muted{opacity:1}
.ff-reel-menu{position:absolute;right:6px;bottom:50px;z-index:30;min-width:140px;box-sizing:border-box;padding:2.5px 10px;border-radius:2px;border:1px solid rgba(0,0,0,.1);background:${PRIMARY};color:#000;line-height:normal}
.ff-reel-menu button{box-sizing:border-box;display:flex;align-items:center;width:100%;min-height:34px;padding:6px 10px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;text-align:left}
.ff-reel-menu button:hover{outline:${ACCENT} solid 1px}
.ff-reel-menu button[aria-checked='true']{font-weight:700}
.ff-reel-menu svg{position:relative;top:1px;width:.9em;height:auto;margin-right:5px;fill:${ACCENT}}
.ff-reel-menu button[aria-checked='false'] svg{opacity:0}
`;

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function volumeLevel(volume: number, muted: boolean) {
  if (muted || volume === 0) return 'off';
  if (volume < 0.5) return 'low';
  if (volume < 0.75) return 'medium';
  return 'high';
}

/** Pointer-driven horizontal range: calls `onChange` with 0..1 while pressed. */
function useRangeDrag(onChange: (ratio: number) => void) {
  return (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const el = event.currentTarget;
    const track = el.querySelector<HTMLElement>('.ff-reel-track') ?? el;
    const apply = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      onChange(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
    };
    el.setPointerCapture(event.pointerId);
    apply(event.clientX);
    const move = (e: PointerEvent) => apply(e.clientX);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
}

function Player({
  src,
  poster,
  autoPlay,
  muted: mutedProp,
  ariaLabel,
  renditions,
}: Pick<ShowreelPlayerProps, 'src' | 'poster' | 'autoPlay' | 'muted' | 'ariaLabel' | 'renditions'>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleTimer = useRef(0);
  const [paused, setPaused] = useState(true);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(mutedProp === true);
  const [volume, setVolume] = useState(1);
  const [waiting, setWaiting] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [inactive, setInactive] = useState(true);
  const [small, setSmall] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [remaining, setRemaining] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quality, setQuality] = useState<string | null>(null);
  const currentSrc = (quality && renditions?.find((r) => r.label === quality)?.src) || src;

  // Video element state → React state.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () => {
      setPaused(video.paused);
      setCurrentTime(video.currentTime);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setMuted(video.muted);
      setVolume(video.volume);
      const ranges = video.buffered;
      setBuffered(ranges.length ? ranges.end(ranges.length - 1) : 0);
    };
    const onPlaying = () => {
      setHasPlayed(true);
      setWaiting(false);
      sync();
    };
    const onWaiting = () => setWaiting(true);
    const onCanPlay = () => setWaiting(false);
    const events = ['play', 'pause', 'timeupdate', 'durationchange', 'loadedmetadata', 'progress', 'volumechange', 'seeked', 'ended'];
    events.forEach((name) => video.addEventListener(name, sync));
    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    sync();
    return () => {
      events.forEach((name) => video.removeEventListener(name, sync));
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, []);

  // Autoplay with sound, falling back to muted when the browser refuses.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || autoPlay !== true) return;
    video.play().catch((error: unknown) => {
      if ((error as DOMException)?.name !== 'NotAllowedError') return;
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [autoPlay]);

  // Loading indicator only after the media-chrome default delay.
  useEffect(() => {
    if (!waiting || paused) {
      setShowLoading(false);
      return;
    }
    const id = window.setTimeout(() => setShowLoading(true), LOADING_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [waiting, paused]);

  // Container breakpoint (media-controller breakpoints="sm:470").
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSmall(entry.contentRect.width < BREAKPOINT_SM));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  const wake = useCallback(() => {
    setInactive(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setInactive(true), AUTOHIDE_MS);
  }, []);

  const sleep = () => {
    window.clearTimeout(idleTimer.current);
    setInactive(true);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 0.25;
  };

  const toggleFullscreen = () => {
    const root = rootRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!root) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    } else {
      video?.webkitEnterFullscreen?.();
    }
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = Math.min(duration, Math.max(0, time));
    setCurrentTime(video.currentTime);
  };

  const onTimeRangeDown = useRangeDrag((ratio) => seekTo(ratio * duration));
  const onVolumeDown = useRangeDrag((ratio) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = ratio;
    video.muted = ratio === 0;
  });

  const onTimeRangeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? SEEK_OFFSET : event.key === 'ArrowLeft' ? -SEEK_OFFSET : 0;
    if (!step) return;
    event.preventDefault();
    seekTo(currentTime + step);
  };

  const onVolumeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 0.025 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -0.025 : 0;
    if (!video || !step) return;
    event.preventDefault();
    video.volume = Math.min(1, Math.max(0, video.volume + step));
    video.muted = video.volume === 0;
  };

  const selectQuality = (label: string | null) => {
    const video = videoRef.current;
    setMenuOpen(false);
    if (!video || label === quality) return;
    const time = video.currentTime;
    const wasPlaying = !video.paused;
    setQuality(label);
    const restore = () => {
      video.currentTime = time;
      if (wasPlaying) video.play().catch(() => {});
    };
    video.addEventListener('loadedmetadata', restore, { once: true });
  };

  const level = volumeLevel(volume, muted);
  const progress = duration ? currentTime / duration : 0;
  const bufferedRatio = duration ? Math.min(1, buffered / duration) : 0;
  const shownVolume = muted ? 0 : volume;
  const timeText = remaining
    ? `-${formatTime(duration - currentTime)} / ${formatTime(duration)}`
    : `${formatTime(currentTime)} / ${formatTime(duration)}`;

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label="video player"
      tabIndex={0}
      className="ff-reel"
      data-paused={paused ? '' : undefined}
      data-played={hasPlayed ? '' : undefined}
      data-inactive={inactive ? '' : undefined}
      data-small={small ? '' : undefined}
      onPointerMove={(event) => {
        if (event.pointerType === 'mouse') wake();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') sleep();
      }}
      onFocus={wake}
    >
      <style>{CSS}</style>
      <video
        ref={videoRef}
        src={currentSrc}
        poster={poster || undefined}
        muted={mutedProp === true || undefined}
        playsInline
        preload="metadata"
        aria-label={ariaLabel}
      />
      <div
        className="ff-reel-gesture"
        onPointerUp={(event) => {
          if (event.pointerType === 'mouse') {
            if (event.button === 0) togglePlay();
          } else if (inactive) {
            wake();
          } else {
            sleep();
          }
        }}
      />
      {showLoading && (
        <div className="ff-reel-loading" aria-hidden>
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="180 300" strokeLinecap="round" />
          </svg>
        </div>
      )}
      <div className="ff-reel-center">
        <button type="button" aria-label={paused ? 'play' : 'pause'} onClick={togglePlay}>
          <svg aria-hidden viewBox="0 0 18 14">
            <path d="M15.5987 6.2911L3.45577 0.110898C2.83667 -0.204202 2.06287 0.189698 2.06287 0.819798V13.1802C2.06287 13.8103 2.83667 14.2042 3.45577 13.8891L15.5987 7.7089C16.2178 7.3938 16.2178 6.6061 15.5987 6.2911Z" />
          </svg>
        </button>
      </div>
      <div className="ff-reel-chrome">
        <div className="ff-reel-gradient" />
        <div
          className="ff-reel-range ff-reel-timerange"
          role="slider"
          tabIndex={0}
          aria-label="seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          onPointerDown={onTimeRangeDown}
          onKeyDown={onTimeRangeKey}
        >
          <div className="ff-reel-track">
            <div className="ff-reel-fill" style={{ width: `${bufferedRatio * 100}%`, background: PRIMARY }} />
            <div className="ff-reel-fill" style={{ width: `${progress * 100}%`, background: RANGE_BAR }} />
            <div className="ff-reel-thumb" style={{ left: `${progress * 100}%` }} />
          </div>
        </div>
        <div className="ff-reel-bar">
          <button type="button" className="ff-reel-ctl ff-reel-bottom-play" aria-label={paused ? 'play' : 'pause'} onClick={togglePlay}>
            <svg aria-hidden viewBox="0 0 18 14">
              <g className="ff-reel-play-icon">
                <path d="M15.5987 6.2911L3.45577 0.110898C2.83667 -0.204202 2.06287 0.189698 2.06287 0.819798V13.1802C2.06287 13.8103 2.83667 14.2042 3.45577 13.8891L15.5987 7.7089C16.2178 7.3938 16.2178 6.6061 15.5987 6.2911Z" />
              </g>
              <g>
                <path className="ff-reel-pause-1" d="M5.90709 0H2.96889C2.46857 0 2.06299 0.405585 2.06299 0.9059V13.0941C2.06299 13.5944 2.46857 14 2.96889 14H5.90709C6.4074 14 6.81299 13.5944 6.81299 13.0941V0.9059C6.81299 0.405585 6.4074 0 5.90709 0Z" />
                <path className="ff-reel-pause-2" d="M15.1571 0H12.2189C11.7186 0 11.313 0.405585 11.313 0.9059V13.0941C11.313 13.5944 11.7186 14 12.2189 14H15.1571C15.6574 14 16.063 13.5944 16.063 13.0941V0.9059C16.063 0.405585 15.6574 0 15.1571 0Z" />
              </g>
            </svg>
          </button>
          <button
            type="button"
            className="ff-reel-ctl ff-reel-time"
            aria-label="playback time"
            onClick={() => setRemaining((value) => !value)}
          >
            {timeText}
          </button>
          <button type="button" className="ff-reel-ctl ff-reel-mute" data-level={level} aria-label={level === 'off' ? 'unmute' : 'mute'} onClick={toggleMute}>
            <svg aria-hidden viewBox="0 0 18 14">
              <g className="ff-reel-unmuted">
                <path d="M6.76786 1.21233L3.98606 3.98924H1.19937C0.593146 3.98924 0.101743 4.51375 0.101743 5.1607V6.96412L0 6.99998L0.101743 7.03583V8.83926C0.101743 9.48633 0.593146 10.0108 1.19937 10.0108H3.98606L6.76773 12.7877C7.23561 13.2547 8 12.9007 8 12.2171V1.78301C8 1.09925 7.23574 0.745258 6.76786 1.21233Z" />
                <path className="ff-reel-vol-low" d="M10 3.54781C10.7452 4.55141 11.1393 5.74511 11.1393 6.99991C11.1393 8.25471 10.7453 9.44791 10 10.4515L10.7988 11.0496C11.6734 9.87201 12.1356 8.47161 12.1356 6.99991C12.1356 5.52821 11.6735 4.12731 10.7988 2.94971L10 3.54781Z" />
                <path className="ff-reel-vol-medium" d="M12.3778 2.40086C13.2709 3.76756 13.7428 5.35806 13.7428 7.00026C13.7428 8.64246 13.2709 10.233 12.3778 11.5992L13.2106 12.1484C14.2107 10.6185 14.739 8.83796 14.739 7.00016C14.739 5.16236 14.2107 3.38236 13.2106 1.85156L12.3778 2.40086Z" />
                <path className="ff-reel-vol-high" d="M15.5981 0.75L14.7478 1.2719C15.7937 2.9919 16.3468 4.9723 16.3468 7C16.3468 9.0277 15.7937 11.0082 14.7478 12.7281L15.5981 13.25C16.7398 11.3722 17.343 9.211 17.343 7C17.343 4.789 16.7398 2.6268 15.5981 0.75Z" />
              </g>
              <g className="ff-reel-muted">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M4.39976 4.98924H1.19937C1.19429 4.98924 1.17777 4.98961 1.15296 5.01609C1.1271 5.04369 1.10174 5.09245 1.10174 5.1607V8.83926C1.10174 8.90761 1.12714 8.95641 1.15299 8.984C1.17779 9.01047 1.1943 9.01084 1.19937 9.01084H4.39977L7 11.6066V2.39357L4.39976 4.98924ZM7.47434 1.92006C7.4743 1.9201 7.47439 1.92002 7.47434 1.92006V1.92006ZM6.76773 12.7877L3.98606 10.0108H1.19937C0.593146 10.0108 0.101743 9.48633 0.101743 8.83926V7.03583L0 6.99998L0.101743 6.96412V5.1607C0.101743 4.51375 0.593146 3.98924 1.19937 3.98924H3.98606L6.76786 1.21233C7.23574 0.745258 8 1.09925 8 1.78301V12.2171C8 12.9007 7.23561 13.2547 6.76773 12.7877Z"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M15.2677 9.30323C15.463 9.49849 15.7796 9.49849 15.9749 9.30323C16.1701 9.10796 16.1701 8.79138 15.9749 8.59612L14.2071 6.82841L15.9749 5.06066C16.1702 4.8654 16.1702 4.54882 15.9749 4.35355C15.7796 4.15829 15.4631 4.15829 15.2678 4.35355L13.5 6.1213L11.7322 4.35348C11.537 4.15822 11.2204 4.15822 11.0251 4.35348C10.8298 4.54874 10.8298 4.86532 11.0251 5.06058L12.7929 6.82841L11.0251 8.59619C10.8299 8.79146 10.8299 9.10804 11.0251 9.3033C11.2204 9.49856 11.537 9.49856 11.7323 9.3033L13.5 7.53552L15.2677 9.30323Z"
                />
              </g>
            </svg>
          </button>
          <div
            className="ff-reel-range ff-reel-volume"
            role="slider"
            tabIndex={0}
            aria-label="volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(shownVolume * 100)}
            onPointerDown={onVolumeDown}
            onKeyDown={onVolumeKey}
          >
            <div className="ff-reel-track">
              <div className="ff-reel-fill" style={{ width: `${shownVolume * 100}%`, background: RANGE_BAR }} />
              <div className="ff-reel-thumb" style={{ left: `${shownVolume * 100}%` }} />
            </div>
          </div>
          <div className="ff-reel-spacer" />
          {renditions && renditions.length > 0 && (
            <>
              <button
                type="button"
                className="ff-reel-ctl"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="quality"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <svg aria-hidden viewBox="0 0 18 14">
                  <path d="M2.25 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6.75 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                </svg>
              </button>
              {menuOpen && (
                <div className="ff-reel-menu" role="menu" onKeyDown={(event) => event.key === 'Escape' && setMenuOpen(false)}>
                  {[{ label: 'Auto', value: null as string | null }, ...renditions.map((r) => ({ label: r.label, value: r.label }))].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitemradio"
                      aria-checked={quality === item.value}
                      onClick={() => selectQuality(item.value)}
                    >
                      <svg viewBox="0 0 14 18" aria-hidden>
                        <path
                          fillRule="evenodd"
                          d="M12.252 3.48c-.115.033-.301.161-.425.291-.059.063-1.407 1.815-2.995 3.894s-2.897 3.79-2.908 3.802c-.013.014-.661-.616-1.672-1.624-.908-.905-1.702-1.681-1.765-1.723-.401-.27-.783-.211-1.176.183a1.285 1.285 0 0 0-.261.342.582.582 0 0 0-.082.35c0 .165.01.205.08.35.075.153.213.296 2.182 2.271 1.156 1.159 2.17 2.159 2.253 2.222.189.143.338.196.539.194.203-.003.412-.104.618-.299.205-.193 6.7-8.693 6.804-8.903a.716.716 0 0 0 .085-.345c.01-.179.005-.203-.062-.339-.124-.252-.45-.531-.746-.639a.784.784 0 0 0-.469-.027"
                        />
                      </svg>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <button
            type="button"
            className="ff-reel-ctl"
            aria-label={fullscreen ? 'exit fullscreen mode' : 'enter fullscreen mode'}
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <svg viewBox="0 0 18 14" aria-hidden>
                <path d="M5.39655 -0.0200195L5.38955 2.38748C5.38795 2.94488 4.93315 3.39708 4.37565 3.39538L0.0103463 3.38278L0.00744629 4.38278L4.37285 4.39538C5.48345 4.39858 6.38635 3.50088 6.38965 2.39028L6.39665 -0.0200195H5.39655Z" />
                <path d="M12.6411 2.36891L12.6479 0.0078125H11.6479L11.6411 2.36601C11.6379 3.47651 12.5356 4.37951 13.6462 4.38271L18.0116 4.39531L18.0145 3.39531L13.6491 3.38271C13.0917 3.38111 12.6395 2.92641 12.6411 2.36891Z" />
                <path d="M12.6034 14.0204L12.6104 11.613C12.612 11.0556 13.0668 10.6034 13.6242 10.605L17.9896 10.6176L17.9925 9.61759L13.6271 9.60499C12.5165 9.60179 11.6136 10.4995 11.6104 11.6101L11.6034 14.0204H12.6034Z" />
                <path d="M5.359 11.6315L5.3522 13.9926H6.3522L6.359 11.6344C6.3622 10.5238 5.4645 9.62088 4.3539 9.61758L-0.0115043 9.60498L-0.0144043 10.605L4.351 10.6176C4.9084 10.6192 5.3607 11.074 5.359 11.6315Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 18 14" aria-hidden>
                <path d="M1.00745 4.39539L1.01445 1.98789C1.01605 1.43049 1.47085 0.978289 2.02835 0.979989L6.39375 0.992589L6.39665 -0.007411L2.03125 -0.020011C0.920646 -0.023211 0.0176463 0.874489 0.0144463 1.98509L0.00744629 4.39539H1.00745Z" />
                <path d="M17.0144 2.03431L17.0076 4.39541H18.0076L18.0144 2.03721C18.0176 0.926712 17.1199 0.0237125 16.0093 0.0205125L11.6439 0.0078125L11.641 1.00781L16.0064 1.02041C16.5638 1.02201 17.016 1.47681 17.0144 2.03431Z" />
                <path d="M16.9925 9.60498L16.9855 12.0124C16.9839 12.5698 16.5291 13.022 15.9717 13.0204L11.6063 13.0078L11.6034 14.0078L15.9688 14.0204C17.0794 14.0236 17.9823 13.1259 17.9855 12.0153L17.9925 9.60498H16.9925Z" />
                <path d="M0.985626 11.9661L0.992426 9.60498H-0.0074737L-0.0142737 11.9632C-0.0174737 13.0738 0.880226 13.9767 1.99083 13.98L6.35623 13.9926L6.35913 12.9926L1.99373 12.98C1.43633 12.9784 0.983926 12.5236 0.985626 11.9661Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShowreelPlayer({
  src,
  className,
  style,
  autoPlay,
  muted,
  poster,
  placeholder,
  aspectRatio,
  ariaLabel = 'Video',
  renditions,
}: ShowreelPlayerProps) {
  // The reference shows the poster <img> until the player module has loaded; we have no module
  // to load, so the player takes over right after mount (same markup on the server render).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sectionStyle: CSSProperties = {
    border: 0,
    display: 'block',
    width: '100%',
    aspectRatio: aspectRatio ?? undefined,
    ...(placeholder ? { backgroundImage: `url(${placeholder})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
    ...style,
  };

  return (
    <section aria-busy={!ready} aria-label={ariaLabel} className={cx(className)} style={sectionStyle}>
      {ready ? (
        <Player src={src} poster={poster ?? placeholder} autoPlay={autoPlay} muted={muted} ariaLabel={ariaLabel} renditions={renditions} />
      ) : poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="block w-full max-w-full" decoding="async" loading="lazy" src={poster} />
      ) : null}
    </section>
  );
}
