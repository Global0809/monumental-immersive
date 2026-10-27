import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { ArrowsOut } from '@phosphor-icons/react/dist/csr/ArrowsOut';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { PictureInPicture } from '@phosphor-icons/react/dist/csr/PictureInPicture';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { ShareNetwork } from '@phosphor-icons/react/dist/csr/ShareNetwork';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { SpeakerHigh } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import { SpeakerSlash } from '@phosphor-icons/react/dist/csr/SpeakerSlash';
import { videos, type Video } from "../data/catalogue";
import { getViewer, saveProgress, useViewer, usePersistentStorage } from "../services/viewer";
import { setPlaybackActive } from "../services/audio";
import { requestPlayback, resolveEntitlement } from "../services/membership";
import { href } from '../services/router';
import { isLocalMediaSource, playableQueueAfter } from '../services/mediaPreview';
import { SaveButton, filmFormat } from './FilmCard';
import PlayerCompanion from "./PlayerCompanion";
import "./player.css";

export type VideoPlayerProps = {
  video: Video;
  onClose: () => void;
  onProgress?: () => void;
  onNext?: (id: string) => void;
  related?: Video[];
  queue?: Video[];
  queueName?: string;
  initialTime?: number;
  reducedMotion?: boolean;
};
type Caption = {
  src: string;
  srclang?: string;
  srcLang?: string;
  label?: string;
  default?: boolean;
};
type PlaybackState = "loading" | "ready" | "buffering" | "error" | "ended";

export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`
    : `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

export function VideoPlayer({
  video,
  onClose,
  onProgress,
  onNext,
  related = [],
  queue = [],
  queueName = '',
  initialTime,
  reducedMotion = false,
}: VideoPlayerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const media = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onProgressRef = useRef(onProgress);
  const onCloseRef = useRef(onClose);
  const onNextRef = useRef(onNext);
  onProgressRef.current = onProgress;
  onCloseRef.current = onClose;
  onNextRef.current = onNext;
  const titleId = useId();
  const [source, setSource] = useState<string>();
  const [sourceVideoId, setSourceVideoId] = useState("");
  const [state, setState] = useState<PlaybackState>("loading");
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pipSupported, setPipSupported] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [nativeControls, setNativeControls] = useState(false);
  const [captionIndex, setCaptionIndex] = useState(-1);
  const viewer = useViewer();
  const persistentStorage = usePersistentStorage();
  const [cinemaGlow, setCinemaGlow] = useState(true);
  const [skipFeedback, setSkipFeedback] = useState('');
  const [autoContinue, setAutoContinue] = useState(queue.length > 1);
  const [countdown, setCountdown] = useState(5);
  const [momentLink,setMomentLink] = useState('');
  const queueIndex = queue.findIndex(item => item.id === video.id);
  const playableNext = playableQueueAfter(queue, video.id);
  const queueNext = playableNext[0];
  const videoRef = useRef(video);
  videoRef.current = video;
  const entitlement = resolveEntitlement(video);
  const captionsValue = video.captions as unknown;
  const captions: Caption[] =
    typeof captionsValue === "string"
      ? [{ src: captionsValue, label: "English", srclang: "en" }]
      : Array.isArray(captionsValue)
        ? captionsValue.filter(
            (track): track is Caption => track && typeof track.src === "string",
          )
        : [];
  const nextVideos = (queue.length ? playableNext : related)
    .filter(
      (item) =>
        item.id !== video.id &&
        item.status === "available" &&
        item.access === "free" && Boolean(item.src),
    )
    .slice(0, 3);
  const recoveryTrailer = video.tags.includes('full film') ? videos.find(item => item.id === video.id.replace(/-full$/, '') && item.status === 'available' && item.access === 'free' && item.tags.includes('trailer') && isLocalMediaSource(item.src)) : undefined;

  // A tiny local-video sample gives the surrounding cinema the colour of the actual frame.
  // Remote guest films retain a neutral stage; their servers need not allow pixel sampling.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!cinemaGlow || reducedMotion || !isLocalMediaSource(video.src)) {
      element.style.removeProperty('--cinema-left'); element.style.removeProperty('--cinema-right'); return;
    }
    const sample = document.createElement('canvas'); sample.width = 4; sample.height = 2;
    const brush = sample.getContext('2d', { willReadFrequently: true });
    let blocked = false;
    const sampleFrame = () => {
      const film = media.current;
      if (!film || film.paused || film.readyState < 2 || document.hidden || !brush || blocked) return;
      try {
        brush.drawImage(film, 0, 0, 4, 2);
        const pixels = brush.getImageData(0, 0, 4, 2).data;
        const colour = (x: number) => `rgb(${Math.round((pixels[x * 4] + pixels[(x + 4) * 4]) / 2)} ${Math.round((pixels[x * 4 + 1] + pixels[(x + 4) * 4 + 1]) / 2)} ${Math.round((pixels[x * 4 + 2] + pixels[(x + 4) * 4 + 2]) / 2)} / .28)`;
        element.style.setProperty('--cinema-left', colour(0)); element.style.setProperty('--cinema-right', colour(3));
      } catch { blocked = true; }
    };
    const timer = setInterval(sampleFrame, 300);
    return () => { clearInterval(timer); element.style.removeProperty('--cinema-left'); element.style.removeProperty('--cinema-right'); };
  }, [cinemaGlow, reducedMotion, video.id, video.src]);

  useEffect(() => {
    if (!skipFeedback) return;
    const timer = setTimeout(() => setSkipFeedback(''), 800);
    return () => clearTimeout(timer);
  }, [skipFeedback]);

  useEffect(() => {
    if (state !== 'ended' || !autoContinue || !queueNext || !onNextRef.current) { setCountdown(5); return; }
    let remaining = 5;
    const timer = setInterval(() => {
      // A hidden tab never silently advances a journey.
      if (document.hidden) return;
      remaining -= 1; setCountdown(remaining);
      if (remaining <= 0) { clearInterval(timer); onNextRef.current?.(queueNext.id); }
    }, 1000);
    return () => clearInterval(timer);
  }, [state, autoContinue, queueNext?.id]);

  function seekBy(seconds: number) {
    const element = media.current;
    if (!element || !Number.isFinite(element.duration)) return;
    element.currentTime = Math.max(0, Math.min(element.duration, element.currentTime + seconds));
    setPosition(element.currentTime); setSkipFeedback(`${seconds > 0 ? '+' : '−'}${Math.abs(seconds)} seconds`);
  }

  // A native modal dialog provides focus containment, inert background and Escape support.
  useEffect(() => {
    const element = dialog.current;
    const focusBefore =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("monumental-player-active");
    if (element && !element.open) element.showModal();
    closeButton.current?.focus();
    setPlaybackActive(true);
    document.querySelectorAll("video").forEach((other) => {
      if (other !== media.current) other.pause();
    });
    setPipSupported(
      Boolean(
        document.pictureInPictureEnabled &&
        media.current?.requestPictureInPicture,
      ),
    );
    setFullscreenSupported(
      Boolean(
        document.fullscreenEnabled ||
        (
          media.current as HTMLVideoElement & {
            webkitEnterFullscreen?: () => void;
          }
        )?.webkitEnterFullscreen,
      ),
    );
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("monumental-player-active");
      setPlaybackActive(false);
      focusBefore?.focus({ preventScroll: true });
    };
  }, []);

  // The normal transport lives outside the stage. Fullscreen owns its native
  // transport; listen to actual presentation changes, including iOS video mode.
  useEffect(() => {
    const element = media.current as (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }) | null;
    if (!element) return;
    let wasFullscreen = false;
    const presentation = (event?: Event) => {
      const active = event?.type === 'webkitbeginfullscreen' || (event?.type !== 'webkitendfullscreen' && (document.fullscreenElement === stage.current || document.fullscreenElement === element || Boolean(element.webkitDisplayingFullscreen)));
      setNativeControls(active);
      if (wasFullscreen && !active) stage.current?.focus({ preventScroll: true });
      wasFullscreen = active;
    };
    const trackSelection = () => setCaptionIndex(Array.from(element.textTracks).findIndex(track => track.mode === 'showing'));
    document.addEventListener('fullscreenchange', presentation);
    element.addEventListener('webkitbeginfullscreen', presentation);
    element.addEventListener('webkitendfullscreen', presentation);
    element.textTracks.addEventListener('change', trackSelection);
    element.addEventListener('loadedmetadata', trackSelection);
    presentation(); trackSelection();
    return () => {
      document.removeEventListener('fullscreenchange', presentation);
      element.removeEventListener('webkitbeginfullscreen', presentation);
      element.removeEventListener('webkitendfullscreen', presentation);
      element.textTracks.removeEventListener('change', trackSelection);
      element.removeEventListener('loadedmetadata', trackSelection);
    };
  }, [video.id, attempt]);

  useEffect(() => {
    let cancelled = false;
    const selectedVideo = videoRef.current;
    setSource(undefined);
    setState("loading");
    setError("");
    setNotice("");
    setPosition(0);
    setDuration(0);
    setResumedAt(null);
    setMomentLink('');
    setPaused(true);
    void requestPlayback(selectedVideo)
      .then((url) => {
        if (!cancelled) {
          setSourceVideoId(selectedVideo.id);
          setSource(url);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "This film could not be opened.",
          );
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [video.id, attempt]);

  useEffect(() => {
    const element = media.current;
    if (!element) return;
    const id = video.id;
    const persist = () => {
      // Do not replace a useful saved position before the video has started loading.
      if (element.currentTime > 0 && Number.isFinite(element.duration)) {
        saveProgress(id, element.currentTime, element.duration, element.ended);
        onProgressRef.current?.();
      }
    };
    const hide = () => {
      if (document.hidden) persist();
    };
    const interval = window.setInterval(persist, 10000);
    element.addEventListener("pause", persist);
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", hide);
    return () => {
      persist();
      window.clearInterval(interval);
      element.removeEventListener("pause", persist);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", hide);
      // A removed video can retain its decoder, network request and native controls.
      // Preserve progress first, then release only this retired element. React's
      // development effect replay still has a connected element and must not unload it.
      if (!element.isConnected) {
        // Chromium's caption style registry can otherwise retain a showing
        // TextTrack and its entire detached player tree after the source is cleared.
        for (const track of element.textTracks) track.mode = "disabled";
        if (document.pictureInPictureElement === element) {
          void document.exitPictureInPicture().catch(() => { /* Already closed. */ });
        }
        element.pause();
        element.removeAttribute("src");
        element.load();
      }
    };
  }, [video.id, attempt]);

  useEffect(() => {
    if (state !== "loading" && state !== "buffering") return;
    const timer = window.setTimeout(
      () =>
        setNotice(
          "This is taking a little longer. Check your connection, or try loading the film again.",
        ),
      12000,
    );
    return () => window.clearTimeout(timer);
  }, [state, attempt]);

  function loaded() {
    const element = media.current;
    if (!element) return;
    const actualDuration = Number.isFinite(element.duration)
      ? element.duration
      : 0;
    setDuration(actualDuration);
    element.playbackRate = speed;
    const history = getViewer().history[video.id];
    if (typeof initialTime === 'number' && Number.isFinite(initialTime) && initialTime >= 0 && initialTime < actualDuration) {
      element.currentTime = initialTime; setPosition(initialTime); setResumedAt(initialTime);
    } else if (
      history &&
      !history.completed &&
      history.time > 1 &&
      history.time < actualDuration - 3 &&
      history.time / actualDuration < 0.96
    ) {
      element.currentTime = history.time;
      setResumedAt(history.time);
      setPosition(history.time);
    }
    setState("ready");
  }

  async function togglePlayback() {
    const element = media.current;
    if (!element) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    try {
      await element.play();
      if (media.current === element) setNotice("");
    } catch {
      if (media.current !== element) return;
      setNotice(
        "Press the video’s play control to begin. Your browser may require direct playback.",
      );
    }
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.current?.requestFullscreen)
        await stage.current.requestFullscreen();
      else {
        setNativeControls(true);
        (
          media.current as HTMLVideoElement & {
            webkitEnterFullscreen?: () => void;
          }
        )?.webkitEnterFullscreen?.();
      }
    } catch {
      setNativeControls(false);
      setNotice(
        "Fullscreen is unavailable in this browser. You can continue watching here.",
      );
    }
  }

  function selectCaption(index: number) {
    const tracks = media.current?.textTracks;
    if (!tracks) return;
    Array.from(tracks).forEach((track, i) => { track.mode = i === index ? 'showing' : 'disabled'; });
    setCaptionIndex(index);
  }

  async function pictureInPicture() {
    try {
      if (document.pictureInPictureElement)
        await document.exitPictureInPicture();
      else await media.current?.requestPictureInPicture();
    } catch {
      setNotice("Picture-in-picture is unavailable for this video.");
    }
  }

  async function shareMoment() {
    const link = `${location.origin}${location.pathname}${href('/film/' + video.id, { t: String(Math.floor(media.current?.currentTime || 0)) })}`;
    try { await navigator.clipboard.writeText(link); setNotice(`Link copied at ${formatPlaybackTime(media.current?.currentTime || 0)}. The recipient can start at this moment.`); setMomentLink(''); }
    catch { setMomentLink(link); setNotice('Select and copy this link to share the current moment.'); }
  }

  function keyDown(event: KeyboardEvent<HTMLDialogElement>) {
    const target = event.target as HTMLElement;
    if (event.key === "Tab" && dialog.current) {
      const focusable = Array.from(
        dialog.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),video[controls],[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey ||
      target.closest('input,select,textarea,video,[contenteditable="true"]'))
      return;
    // Space activates a focused control; letter shortcuts remain available from transport buttons.
    if (event.code === 'Space' && target.closest('button,a')) return;
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && target.closest('[role="tablist"]')) return;
    const element = media.current;
    if (!element) return;
    if (event.code === "Space" || event.key.toLowerCase() === "k") {
      event.preventDefault();
      void togglePlayback();
    }
    if (event.key === "ArrowRight" || event.key === "ArrowLeft" || ['j','l'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      const amount = event.key.startsWith('Arrow') ? 5 : 10;
      seekBy(event.key === 'ArrowRight' || event.key.toLowerCase() === 'l' ? amount : -amount);
    }
    if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      element.muted = !element.muted;
    }
    if (event.key.toLowerCase() === "f" && fullscreenSupported) {
      event.preventDefault();
      void fullscreen();
    }
  }

  function onEnded() {
    const element = media.current;
    if (element && Number.isFinite(element.duration))
      saveProgress(video.id, element.duration, element.duration, true);
    onProgressRef.current?.();
    setState("ended");
    setPaused(true);
  }

  function restart() {
    const element = media.current;
    if (!element) return;
    element.currentTime = 0;
    setResumedAt(null);
    setState("ready");
    void togglePlayback();
  }

  return (
    <dialog
      ref={dialog}
      className={`ms-player-dialog ${cinemaGlow ? 'has-cinema-glow' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (nativeControls) {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
          return;
        }
        onCloseRef.current();
      }}
      onKeyDown={keyDown}
      onClick={(event) => {
        if (event.target === dialog.current) onCloseRef.current();
      }}
    >
      <div className="ms-player-shell">
        <header className="ms-player-header">
          <span className="ms-player-current-title" id={titleId}>{video.title}</span>
          <span className="ms-player-preview-label">
            {entitlement.preview ? "Development preview" : filmFormat(video)}
          </span>
          <button
            ref={closeButton}
            type="button"
            className="ms-player-close"
            aria-label="Close player"
            onClick={() => onCloseRef.current()}
          >
            <X size={22} />
          </button>
        </header>
        <div
          ref={stage}
          className="ms-player-stage"
          tabIndex={0}
          aria-label="Video playback area. Space to play or pause, arrows to seek, M to mute, F for fullscreen."
        >
          <video
            key={`${video.id}-${attempt}`}
            ref={media}
            src={sourceVideoId === video.id ? source : undefined}
            poster={video.poster}
            controls={nativeControls}
            tabIndex={nativeControls ? 0 : -1}
            playsInline
            preload="metadata"
            autoPlay
            aria-label={video.title}
            onClick={() => { if (!nativeControls) { stage.current?.focus({ preventScroll: true }); void togglePlayback(); } }}
            onLoadedMetadata={loaded}
            onDurationChange={() => {
              const value = media.current?.duration;
              if (value && Number.isFinite(value)) setDuration(value);
            }}
            onTimeUpdate={() => setPosition(media.current?.currentTime || 0)}
            onVolumeChange={event => { setMuted(event.currentTarget.muted); setVolume(event.currentTarget.volume); }}
            onSeeking={(event) => {
              // Native controls, the scrubber and transcript links can all leave
              // an ended film paused at an earlier frame. Retire its end screen
              // and auto-continue countdown as soon as that seek begins.
              if (event.currentTarget.currentTime < event.currentTarget.duration)
                setState((current) => current === "ended" ? "ready" : current);
            }}
            onPlay={() => {
              setPaused(false);
              setState("ready");
              setNotice("");
            }}
            onPlaying={() => {
              setState("ready");
              setNotice("");
            }}
            onPause={() => setPaused(true)}
            onWaiting={() => setState("buffering")}
            onStalled={() => {
              if (source && !media.current?.paused) setState("buffering");
            }}
            onCanPlay={() => {
              if (state !== "ended") setState("ready");
            }}
            onEnded={onEnded}
            onError={() => {
              if (!source) return;
              const code = media.current?.error?.code;
              setError(
                code === 2
                  ? "The film could not load over this connection. Please try again."
                  : code === 3 || code === 4
                    ? "This media source is unavailable or unsupported by your browser."
                    : "Playback stopped unexpectedly. Please try again.",
              );
              setState("error");
            }}
          >
            {captions.map((track, index) => (
              <track
                key={track.src}
                kind="captions"
                src={track.src}
                srcLang={track.srclang || track.srcLang || "en"}
                label={track.label || "English"}
                default={track.default ?? index === 0}
              />
            ))}
            Your browser does not support HTML video.
          </video>
          {skipFeedback && <div key={skipFeedback} className="ms-player-seek-feedback" aria-live="polite">{skipFeedback}</div>}
          {(state === "loading" || state === "buffering") && (
            <div className="ms-player-loading" role="status">
              <span className="ms-player-spinner" />
              <span>
                {state === "buffering" ? "Buffering…" : "Opening your film…"}
              </span>
            </div>
          )}
          {state === "error" && (
            <div className="ms-player-state ms-player-error" role="alert">
              <WarningCircle size={36} />
              <h2>
                {entitlement.allowed
                  ? "A brief interruption."
                  : "Coming into focus."}
              </h2>
              <p>{error}</p>
              {entitlement.allowed && (
                <button
                  className="ms-player-primary"
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  <ArrowCounterClockwise size={17} />
                  Try again
                </button>
              )}
              {recoveryTrailer && onNext && <button className="ms-player-quiet" type="button" onClick={() => onNext(recoveryTrailer.id)}><Play size={16} weight="fill"/>Watch the available trailer</button>}
              <button
                className="ms-player-quiet"
                type="button"
                onClick={() => onCloseRef.current()}
              >
                Back to discovery
              </button>
            </div>
          )}
          {state === "ended" && (
            <div className="ms-player-state ms-player-ended">
              <Check size={32} />
              <p className="ms-player-eyebrow">
                Another perspective, collected.
              </p>
              <h2>Where to next?</h2>
              {autoContinue && queueNext && <div className="ms-queue-countdown"><span>Next stop in {countdown}s</span><button onClick={() => setAutoContinue(false)}>Stay here</button></div>}
              <div className="ms-player-ended-actions">
                {nextVideos[0] && onNext && (
                  <button
                    type="button"
                    className="ms-player-primary"
                    onClick={() => onNext(nextVideos[0].id)}
                  >
                    Watch {nextVideos[0].title}
                    <ArrowRight size={17} />
                  </button>
                )}
                <button
                  type="button"
                  className="ms-player-quiet"
                  onClick={restart}
                >
                  <ArrowCounterClockwise size={17} />
                  Watch again
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="ms-player-scrubber">
          <input type="range" min={0} max={duration || 1} step={0.1} value={position} disabled={!source || !duration || state === 'error'} aria-label="Seek video" aria-valuetext={`${formatPlaybackTime(position)} of ${formatPlaybackTime(duration)}`} style={{ backgroundSize: `${duration ? position / duration * 100 : 0}% 100%` }} onChange={event => { const time = Number(event.target.value); if (media.current) media.current.currentTime = time; setPosition(time); }}/>
        </div>
        <div className="ms-player-toolbar">
          <div className="ms-player-transport">
            <button className="ms-player-icon-button ms-player-skip" aria-label="Back 10 seconds" disabled={!source || !duration || state === 'error'} onClick={() => seekBy(-10)}><ArrowCounterClockwise size={23}/><span>10</span></button>
            <button
              type="button"
              className="ms-player-icon-button"
              onClick={() => void togglePlayback()}
              aria-label={paused ? "Play video" : "Pause video"}
              disabled={!source || state === "error"}
            >
              {paused ? (
                <Play size={18} weight="fill" />
              ) : (
                <Pause size={18} weight="fill" />
              )}
            </button>
            <button className="ms-player-icon-button ms-player-skip" aria-label="Forward 10 seconds" disabled={!source || !duration || state === 'error'} onClick={() => seekBy(10)}><ArrowClockwise size={23}/><span>10</span></button>
            <span
              className="ms-player-clock"
              aria-label={`${formatPlaybackTime(position)} of ${formatPlaybackTime(duration)}`}
            >
              {formatPlaybackTime(position)}{" "}
              <span>/ {formatPlaybackTime(duration)}</span>
            </span>
            <button type="button" className="ms-player-icon-button" aria-label={muted || volume === 0 ? 'Unmute video' : 'Mute video'} aria-pressed={muted || volume === 0} onClick={() => { if (media.current) { media.current.muted = !media.current.muted; if (media.current.volume === 0) media.current.volume = 1; } }}>{muted || volume === 0 ? <SpeakerSlash size={20}/> : <SpeakerHigh size={20}/>}</button>
            <input className="ms-player-volume" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} aria-label="Video volume" aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} percent`} onChange={event => { if (media.current) { media.current.volume = Number(event.target.value); media.current.muted = false; } }}/>
          </div>
          <div className="ms-player-options">
            <SaveButton video={video} small/>
            <button className="ms-player-icon-button" aria-label="Copy link to this moment" title="Copy link to this moment" onClick={() => void shareMoment()} disabled={!duration}><ShareNetwork size={19}/></button>
            {isLocalMediaSource(video.src) && <button disabled={reducedMotion} className="ms-player-icon-button ms-player-glow-toggle" aria-label="Cinema glow" aria-pressed={cinemaGlow} title="Cinema glow" onClick={() => setCinemaGlow(v => !v)}><Sparkle size={20}/></button>}
            {captions.length === 1 && <button type="button" className="ms-player-icon-button ms-player-captions" aria-label={captionIndex >= 0 ? 'Hide captions' : 'Show captions'} aria-pressed={captionIndex >= 0} title={`${captions[0].label || 'English'} captions`} disabled={!source || state === 'error'} onClick={() => selectCaption(captionIndex >= 0 ? -1 : 0)}><span aria-hidden="true">CC</span></button>}
            {captions.length > 1 && <label className="ms-player-speed">Captions<select aria-label="Captions" value={captionIndex} onChange={event => selectCaption(Number(event.target.value))} disabled={!source || state === 'error'}><option value={-1}>Off</option>{captions.map((track, index) => <option key={track.src} value={index}>{track.label || track.srclang || track.srcLang || `Track ${index + 1}`}</option>)}</select></label>}
            <label className="ms-player-speed">
              Speed
              <select
                aria-label="Playback speed"
                value={speed}
                disabled={!source || state === 'error'}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSpeed(value);
                  if (media.current) media.current.playbackRate = value;
                }}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
            {pipSupported && (
              <button
                type="button"
                className="ms-player-icon-button"
                aria-label="Picture-in-picture"
                title="Picture-in-picture"
                disabled={!source || duration === 0}
                onClick={() => void pictureInPicture()}
              >
                <PictureInPicture size={20} />
              </button>
            )}
            {fullscreenSupported && (
              <button
                type="button"
                className="ms-player-icon-button"
                aria-label="Fullscreen"
                title="Fullscreen"
                onClick={() => void fullscreen()}
              >
                <ArrowsOut size={20} />
              </button>
            )}
          </div>
        </div>

        {notice && (
          <div className="ms-player-notice" role="status">
            {notice}
            {(state === "loading" || state === "buffering") && (
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Reload film
              </button>
            )}
          </div>
        )}
        {momentLink && <input className="ms-moment-link" aria-label="Shareable moment link" value={momentLink} readOnly onFocus={e => e.target.select()}/>}
        {resumedAt !== null && state !== "ended" && (
          <div className="ms-player-resume">
            Resumed at {formatPlaybackTime(resumedAt)}
            <button
              type="button"
              onClick={() => {
                if (media.current) media.current.currentTime = 0;
                setResumedAt(null);
              }}
            >
              Start from the beginning
            </button>
          </div>
        )}
        <details className="ms-player-extras">
          <summary>Film companion & credits <span>Notes, chapters and related stories</span></summary>
        {queue.length > 0 && <section className="ms-journey-queue" aria-label="Journey queue"><div className="ms-queue-heading"><span><small>YOUR JOURNEY / {Math.max(1,queueIndex + 1)} OF {queue.length}</small><strong>{queueName || 'Your cultural journey'}</strong></span><label>Auto-continue<button role="switch" aria-label="Auto-continue journey" aria-checked={autoContinue} onClick={() => setAutoContinue(v => !v)}><i/></button></label></div><div className="ms-queue-stops">{queue.map((item,i) => <button key={item.id} aria-label={`Journey stop ${i + 1}: ${item.title}`} aria-current={item.id === video.id ? 'step' : undefined} onClick={() => { if (item.id !== video.id) onNext?.(item.id); }}><img src={item.poster} alt=""/><span><small>{String(i+1).padStart(2,'0')} / {item.id === video.id ? 'NOW PLAYING' : viewer.history[item.id]?.completed ? 'WATCHED' : item.category}</small><strong>{item.title}</strong></span>{item.id === video.id ? <span className={`ms-queue-meter ${paused ? 'is-paused' : ''}`} aria-hidden="true"><i/><i/><i/></span> : <Play size={16}/>}</button>)}</div></section>}
        <div className="ms-player-details">
          <div>
            <p className="ms-player-eyebrow">
              {video.category} <span>·</span>{" "}
              {duration
                ? `${formatPlaybackTime(duration)} runtime`
                : "Preview film"}
            </p>
            <h1>{video.title}</h1>
            <p className="ms-player-description">{video.description}</p>
            <p className="ms-player-credit">
              {typeof video.credit === "string"
                ? video.credit
                : "Demonstration film. See the asset manifest for attribution."}
            </p>
          </div>
          <div className="ms-player-local">
            <span className="ms-player-status-dot" />
            {persistentStorage ? 'Progress saved on this device' : 'Progress kept for this visit'}
            <p>{persistentStorage ? 'Guest viewing. Your next chapter will be here.' : 'Browser storage is unavailable. Reloading clears this session.'}</p>
          </div>
        </div>
        <PlayerCompanion key={video.id} video={video} position={position} duration={duration} reducedMotion={reducedMotion} onSeek={time => { if(media.current && duration) { const next=Math.min(time,Math.max(0,duration-.1)); media.current.currentTime=next; setPosition(next); } }}/>
        {nextVideos.length > 0 && onNext && (
          <section className="ms-player-related" aria-label="Related films">
            <h2>Keep following the thread</h2>
            <div className="ms-player-related-grid">
              {nextVideos.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onNext(item.id)}
                >
                  <img src={item.poster} alt="" loading="lazy" />
                  <span>
                    <small>{item.category}</small>
                    <strong>{item.title}</strong>
                    <em>
                      {item.tags.includes('full film') ? 'Watch film' : 'Watch preview'} <ArrowRight size={13} />
                    </em>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
        </details>
      </div>
    </dialog>
  );
}

export default VideoPlayer;
