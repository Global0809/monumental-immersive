import { videos, places } from '../data/catalogue';
import { prepareSeekableMedia } from './seekableMedia';
import { releasePassageSound } from './passageSound';

export type PassageChapterId = 'world' | 'time-machine' | 'movies' | 'music' | 'culture' | 'my-world';
export type PassageMediaKind = 'motion-study' | 'film-trailer';

export interface PassageMediaEntry {
  readonly chapterId: PassageChapterId;
  /** The existing player action retains its catalogue destination. */
  readonly catalogueId: string;
  /** Cinema uses the local official trailer, not the full-film stream, in the room. */
  readonly sourceId: string;
  readonly src: string;
  readonly poster: string;
  readonly sourcePoster: string;
  readonly title: string;
  readonly kind: PassageMediaKind;
  readonly nativeWidth: number;
  readonly nativeHeight: number;
  readonly aspect: number;
  readonly duration: number;
  readonly loopStart: number;
  readonly loopEnd: number;
  readonly caption: string;
  readonly posterCaption: string;
  readonly credit: string;
  readonly fallback: string;
}

function source(id: string) {
  const film = videos.find(video => video.id === id && video.status === 'available' && video.src);
  if (!film?.src) throw new Error(`Passage media source is not available: ${id}`);
  return film as typeof film & { src: string };
}

function entry(chapterId: PassageChapterId, sourceId: string, options: {
  catalogueId?: string; place?: string; nativeWidth?: number; nativeHeight?: number;
  loopStart: number; loopEnd: number; caption: string; posterCaption: string;
}): PassageMediaEntry {
  const film = source(sourceId);
  const nativeWidth = options.nativeWidth ?? 960, nativeHeight = options.nativeHeight ?? 540;
  return Object.freeze({
    chapterId, catalogueId: options.catalogueId ?? sourceId, sourceId,
    src: film.src, sourcePoster: film.poster,
    poster: places.find(place => place.id === options.place)?.image ?? film.poster,
    title: film.title, kind: sourceId === 'sintel' ? 'film-trailer' : 'motion-study',
    nativeWidth, nativeHeight, aspect: nativeWidth / nativeHeight, duration: film.duration,
    loopStart: options.loopStart, loopEnd: options.loopEnd,
    caption: options.caption, posterCaption: options.posterCaption, credit: film.credit,
    fallback: 'Preview unavailable. The image remains visible; use the existing story action to open the player.',
  });
}

/** Probed and visually inspected on 28 October 2026. These five illustrated
 * studies are not documentary, archival or performance recordings. */
export const PASSAGE_MEDIA: readonly PassageMediaEntry[] = Object.freeze([
  entry('world', 'miami-frequency', { place: 'miami', loopStart: 6, loopEnd: 20,
    caption: 'Miami, in Frequency · original motion study',
    posterCaption: 'Miami skyline · destination photograph, not a frame from the motion study.' }),
  entry('time-machine', 'break-beat-city', { place: 'new-york', loopStart: 5, loopEnd: 20,
    caption: 'Made in 2026 · an illustrated study of the 1970s',
    posterCaption: 'Contemporary Manhattan gateway photograph; not the Bronx or archival imagery.' }),
  entry('movies', 'sintel', { catalogueId: 'sintel-full', nativeWidth: 854, nativeHeight: 480, loopStart: 22, loopEnd: 31,
    caption: 'Sintel · official trailer · © Blender Foundation',
    posterCaption: 'A still from the official Sintel trailer. Full playback opens the complete film.' }),
  entry('music', 'island-current', { place: 'puerto-rico', loopStart: 6, loopEnd: 22,
    caption: 'Island Current · illustrated study, original synthetic score',
    posterCaption: 'Old San Juan gateway photograph; not a recorded bomba or plena performance.' }),
  entry('culture', 'concrete-and-colour', { place: 'miami', loopStart: 6, loopEnd: 22,
    caption: 'Made in 2026 · an illustrated study of Miami Beach Art Deco',
    posterCaption: 'Miami skyline gateway photograph; the study concerns Miami Beach, a separate municipality.' }),
  entry('my-world', 'tokyo-in-motion', { place: 'tokyo', loopStart: 6, loopEnd: 22,
    caption: 'Tokyo / In Your Own Image · editorial selection',
    posterCaption: 'Shinjuku skyline gateway photograph; the illustrated cultural study concerns Harajuku.' }),
]);

export function getPassageMedia(id: string | null | undefined): PassageMediaEntry | undefined {
  return PASSAGE_MEDIA.find(media => media.chapterId === id);
}

export type PassageMediaStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'blocked' | 'failed';
export interface PassageMediaSnapshot {
  readonly chapterId: PassageChapterId | null;
  readonly status: PassageMediaStatus;
  readonly sourceEpoch: number;
  /** Only true after the selected source has decoded at its actual loop start. */
  readonly ready: boolean;
}

export interface PassageMediaController {
  activate(id: PassageChapterId | null): void;
  /** Independent callers must use distinct, stable reason names. */
  setSuspended(reason: string, suspended: boolean): void;
  /** Moves the one decoder into the compact presentation; null detaches it. */
  attach(host: HTMLElement | null): void;
  getVideo(): HTMLVideoElement;
  getSnapshot(): PassageMediaSnapshot;
  subscribe(listener: () => void): () => void;
  retry(): void;
  destroy(): void;
}

/** Dependency injection keeps media lifecycle/race checks independent of a GPU. */
export interface PassageMediaEnvironment {
  createVideo(): HTMLVideoElement;
  documentEvents: Pick<Document, 'addEventListener' | 'removeEventListener'>;
  windowEvents: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  isHidden(): boolean;
  isPlayerOpen(): boolean;
  /** Bounded local-preview preparation for hosts that do not support byte ranges. */
  prepareSource?(source: string, signal: AbortSignal): Promise<{ src: string; release(): void }>;
}

export function createPassageMediaController(environment: PassageMediaEnvironment): PassageMediaController {
  const video = environment.createVideo();
  video.muted = true; video.defaultMuted = true; video.playsInline = true;
  video.preload = 'none'; video.loop = false; video.controls = false;
  video.crossOrigin = 'anonymous'; video.tabIndex = -1;
  video.className = 'passage-ambient-video';
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true'); video.dataset.passageAmbient = 'true';
  const listeners = new Set<() => void>();
  const suspension = new Set<string>();
  let selected: PassageMediaEntry | undefined;
  let destroyed = false, playingFilm = environment.isPlayerOpen(), pendingPlay = false, requestedLoad = false;
  let playAttempt = 0, sourceEpoch = 0;
  let preparation: AbortController | undefined;
  let preparedSource: { src: string; release(): void } | undefined;
  let snapshot: PassageMediaSnapshot = Object.freeze({ chapterId: null, status: 'idle', sourceEpoch, ready: false });

  const emit = (status: PassageMediaStatus, ready = snapshot.ready) => {
    const chapterId = selected?.chapterId ?? null;
    if (snapshot.chapterId === chapterId && snapshot.status === status && snapshot.sourceEpoch === sourceEpoch && snapshot.ready === ready) return;
    snapshot = Object.freeze({ chapterId, status, sourceEpoch, ready });
    video.dataset.mediaStatus = status;
    video.dataset.mediaChapter = chapterId ?? '';
    listeners.forEach(listener => listener());
  };
  const mayPlay = () => !destroyed && Boolean(selected) && !suspension.size && !environment.isHidden() && !playingFilm && !environment.isPlayerOpen();
  const terminal = () => snapshot.status === 'failed' || snapshot.status === 'blocked';
  function pause() {
    playAttempt += 1; pendingPlay = false; video.pause();
    if (selected && !terminal()) emit(snapshot.ready ? 'paused' : 'loading');
  }
  function resume() {
    if (!mayPlay()) { pause(); return; }
    if (selected && !requestedLoad && !terminal()) {
      if (environment.prepareSource && !preparedSource) {
        if (preparation) return;
        const abort = new AbortController(), epoch = sourceEpoch;
        preparation = abort;
        void environment.prepareSource(selected.src, abort.signal).then(source => {
          if (destroyed || abort.signal.aborted || epoch !== sourceEpoch) { source.release(); return; }
          preparation = undefined; preparedSource = source;
          // Preparation may finish after sound playback, motion settings or
          // visibility has suspended the scene. Resume rechecks every owner.
          resume();
        }).catch((error: unknown) => {
          if (destroyed || abort.signal.aborted || epoch !== sourceEpoch) return;
          preparation = undefined;
          if ((error as { name?: string })?.name !== 'AbortError') failed();
        });
        return;
      }
      requestedLoad = true; video.preload = 'auto'; video.src = preparedSource?.src ?? selected.src; video.load();
    }
    if (terminal() || !snapshot.ready || pendingPlay || !video.paused) return;
    const request = ++playAttempt, epoch = sourceEpoch;
    pendingPlay = true;
    void video.play().then(() => {
      if (destroyed || epoch !== sourceEpoch || request !== playAttempt) return;
      pendingPlay = false;
      if (!mayPlay()) { pause(); return; }
      emit('playing', true);
    }).catch((error: unknown) => {
      if (destroyed || epoch !== sourceEpoch || request !== playAttempt) return;
      pendingPlay = false;
      // A replacement, pause or browser interruption is not a broken asset.
      if ((error as { name?: string })?.name === 'AbortError' || !mayPlay()) return;
      emit((error as { name?: string })?.name === 'NotAllowedError' ? 'blocked' : 'failed', false);
    });
  }
  function decoded() {
    if (!selected || destroyed || terminal() || video.readyState < 2 || video.seeking) return;
    if (video.currentTime < selected.loopStart - .15) return;
    emit(video.paused ? 'ready' : 'playing', true);
    resume();
  }
  function metadata() {
    if (!selected || destroyed || terminal()) return;
    try { video.currentTime = Math.min(selected.loopStart, Math.max(0, video.duration - .1)); }
    catch { /* A delayed browser metadata event is retried by canplay. */ }
    decoded();
  }
  function canPlay() {
    if (!selected || destroyed || terminal()) return;
    if (video.currentTime < selected.loopStart - .15) { metadata(); return; }
    decoded();
  }
  function loop() {
    if (!selected || destroyed || terminal() || !snapshot.ready || video.seeking) return;
    if (video.currentTime >= Math.min(selected.loopEnd, video.duration - .05) || video.ended) {
      try { video.currentTime = selected.loopStart; } catch { return; }
      if (mayPlay()) resume();
    }
  }
  const playing = () => { if (mayPlay() && !terminal()) decoded(); else video.pause(); };
  const paused = () => { if (selected && snapshot.ready && !terminal()) emit('paused'); };
  const failed = () => { if (selected && !destroyed) { playAttempt += 1; pendingPlay = false; video.pause(); emit('failed', false); } };
  const visibility = () => { if (mayPlay()) resume(); else pause(); };
  const playback = (event: Event) => { playingFilm = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active); visibility(); };
  const mediaEvents = { loadedmetadata: metadata, loadeddata: canPlay, canplay: canPlay, seeked: decoded, timeupdate: loop, ended: loop, playing, pause: paused, error: failed };
  Object.entries(mediaEvents).forEach(([name, listener]) => video.addEventListener(name, listener));
  environment.documentEvents.addEventListener('visibilitychange', visibility);
  environment.windowEvents.addEventListener('monumental:playback', playback);

  function load(id: PassageChapterId | null, force = false) {
    if (destroyed || (!force && snapshot.chapterId === id)) return;
    playAttempt += 1; pendingPlay = false; requestedLoad = false; sourceEpoch += 1;
    // Clear selection before pause so the old source's pause cannot be reported
    // as the new chapter being ready.
    selected = undefined; video.pause();
    video.removeAttribute('src'); video.load();
    preparation?.abort(); preparation = undefined;
    preparedSource?.release(); preparedSource = undefined;
    selected = getPassageMedia(id);
    if (!selected) { video.removeAttribute('poster'); emit('idle', false); return; }
    video.poster = selected.poster;
    emit('loading', false);
    video.preload = 'none';
    resume();
  }
  return {
    activate: load,
    setSuspended(reason, suspended) {
      if (destroyed) return;
      if (suspended) suspension.add(reason); else suspension.delete(reason);
      visibility();
    },
    attach(host) {
      if (destroyed) return;
      if (host) { if (video.parentElement !== host) host.appendChild(video); }
      else video.remove();
      resume();
    },
    getVideo: () => video,
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    retry() { if (selected && terminal()) load(selected.chapterId, true); else resume(); },
    destroy() {
      if (destroyed) return;
      releasePassageSound(video);
      destroyed = true; playAttempt += 1; pendingPlay = false;
      environment.documentEvents.removeEventListener('visibilitychange', visibility);
      environment.windowEvents.removeEventListener('monumental:playback', playback);
      Object.entries(mediaEvents).forEach(([name, listener]) => video.removeEventListener(name, listener));
      video.pause(); video.removeAttribute('src'); video.removeAttribute('poster'); video.load(); video.remove();
      preparation?.abort(); preparation = undefined;
      preparedSource?.release(); preparedSource = undefined;
      selected = undefined; suspension.clear(); sourceEpoch += 1; emit('idle', false); listeners.clear();
    },
  };
}

let shared: { controller: PassageMediaController; references: number } | undefined;

/** Scene and compact DOM lease the same HTMLVideoElement and decoder. */
export function acquirePassageMedia(): { controller: PassageMediaController; release(): void } {
  if (!shared) shared = {
    controller: createPassageMediaController({
      createVideo: () => document.createElement('video'),
      documentEvents: document, windowEvents: window,
      isHidden: () => document.hidden,
      isPlayerOpen: () => Boolean(document.querySelector('.ms-player-dialog[open]')),
      prepareSource: prepareSeekableMedia,
    }), references: 0,
  };
  const lease = shared;
  lease.references += 1;
  let released = false;
  return { controller: lease.controller, release() {
    if (released) return;
    released = true; lease.references -= 1;
    if (lease.references === 0) { lease.controller.destroy(); if (shared === lease) shared = undefined; }
  } };
}
