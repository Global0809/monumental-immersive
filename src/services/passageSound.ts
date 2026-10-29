import { getViewer, subscribeViewer } from './viewer';
import { setSoundEnabled, setStudyAudioActive } from './audio';
import { analyseSpectrum, SILENT_SPECTRUM, type AudioSpectrum } from './audioSpectrum';

export type PassageSoundState = { enabled: boolean; status: 'off' | 'ready' | 'playing' | 'unavailable' };
const listeners = new Set<() => void>();
let snapshot: PassageSoundState = Object.freeze({ enabled: false, status: 'off' });
let binding: ReturnType<typeof createBinding> | undefined;
type MediaGraph = { context: AudioContext; source: MediaElementAudioSourceNode; gain: GainNode; analyser: AnalyserNode };
const graphs = new WeakMap<HTMLVideoElement, MediaGraph>();
function emit(enabled: boolean, status: PassageSoundState['status']) {
  if (snapshot.enabled === enabled && snapshot.status === status) return;
  snapshot = Object.freeze({ enabled, status }); listeners.forEach(fn => fn());
}
export const getPassageSound = () => snapshot;
export function subscribePassageSound(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

/** Called only from a deliberate user gesture. Ambient film previews remain
 * muted until this control is used; source and loop still belong to Passage. */
export function setPassageSoundEnabled(enabled: boolean) {
  if (!enabled) { binding?.disable(); emit(false, 'off'); return; }
  if (!binding) { emit(false, 'unavailable'); return; }
  setSoundEnabled(true);
  void binding.enable();
}

function createBinding(video: HTMLVideoElement) {
  const cached = graphs.get(video);
  let context: AudioContext | null = cached?.context ?? null, source: MediaElementAudioSourceNode | null = cached?.source ?? null;
  let analyser: AnalyserNode | null = cached?.analyser ?? null, gain: GainNode | null = cached?.gain ?? null;
  let wave: Float32Array<ArrayBuffer> | null = analyser ? new Float32Array(analyser.fftSize) : null;
  let frequencies: Uint8Array<ArrayBuffer> | null = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  let requested = false, available = false, destroyed = false, epoch = 0, ownsPlayback = false;
  const value: AudioSpectrum = { ...SILENT_SPECTRUM };
  function zero() { value.rms = value.bass = value.mid = value.treble = 0; return value; }
  function mute() {
    video.muted = true; zero();
    if (gain && context && context.state !== 'closed') gain.gain.setTargetAtTime(0, context.currentTime, .015);
    // Let the ordinary interface score resume only when no full player owns it.
    if (ownsPlayback) { ownsPlayback = false; setStudyAudioActive(false); }
  }
  function sync() {
    if (destroyed) return;
    const viewer = getViewer();
    const audible = requested && available && viewer.sound && viewer.masterVolume > 0 && !document.hidden && context?.state === 'running';
    if (!audible) { mute(); if (requested) emit(true, 'ready'); return; }
    video.muted = false; video.volume = 1;
    gain!.gain.setTargetAtTime(Math.min(.65, viewer.masterVolume), context!.currentTime, .035);
    if (!ownsPlayback) { ownsPlayback = true; setStudyAudioActive(true); }
    emit(true, video.paused ? 'ready' : 'playing');
  }
  function disable() { requested = false; epoch++; mute(); void context?.suspend().catch(() => {}); emit(false, 'off'); }
  async function enable() {
    if (destroyed || !available) { emit(false, 'unavailable'); return; }
    requested = true; const turn = ++epoch;
    try {
      if (!context) {
        const currentSource = new URL(video.currentSrc || video.src, location.href);
        // Only the verified local studies are connected. External video playback
        // is never rerouted through a graph that could silence a CORS source.
        if (currentSource.origin !== location.origin && currentSource.protocol !== 'blob:') throw new Error('Not a local preview');
        const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Context) throw new Error('AudioContext unavailable');
        context = new Context({ latencyHint: 'interactive' });
        analyser = context.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = .65;
        gain = context.createGain(); gain.gain.value = 0;
        source = context.createMediaElementSource(video); source.connect(gain); gain.connect(analyser); analyser.connect(context.destination);
        graphs.set(video, { context, source, gain, analyser });
        wave = new Float32Array(analyser.fftSize); frequencies = new Uint8Array(analyser.frequencyBinCount);
      }
      await context.resume();
      if (destroyed || turn !== epoch || !requested) return;
      sync();
    } catch {
      requested = false; mute(); emit(false, 'unavailable');
    }
  }
  const unsubscribe = subscribeViewer(() => { if (!getViewer().sound) disable(); else sync(); });
  const status = () => sync();
  const hidden = () => { if (document.hidden) disable(); };
  const playback = (event: Event) => { if ((event as CustomEvent<{ active?: boolean }>).detail?.active) disable(); };
  video.addEventListener('playing', status); video.addEventListener('pause', status); video.addEventListener('emptied', status);
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener('monumental:playback', playback);
  return {
    video,
    enable, disable,
    setActive(active: boolean) {
      if (available === active) return;
      available = active;
      if (!active) disable(); else sync();
    },
    sample(): AudioSpectrum {
      if (!requested || !available || !context || context.state !== 'running' || !analyser || !wave || !frequencies || video.paused || video.muted || document.hidden || !getViewer().sound) return zero();
      analyser.getFloatTimeDomainData(wave); analyser.getByteFrequencyData(frequencies);
      return analyseSpectrum(wave, frequencies, context.sampleRate, analyser.fftSize, value);
    },
    destroy() {
      if (destroyed) return; disable(); destroyed = true; unsubscribe();
      video.removeEventListener('playing', status); video.removeEventListener('pause', status); video.removeEventListener('emptied', status);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('monumental:playback', playback);
      // The decoder is leased across scene remounts. A MediaElementSource may
      // only be created once for that element; keep its silent graph until the
      // decoder's owner releases it, then dispose it through release below.
      void context?.suspend().catch(() => {});
      context = null; source = null; gain = null; analyser = null; wave = null; frequencies = null;
    },
  };
}

/** Called by the media owner only when its last decoder lease is released. */
export function releasePassageSound(video: HTMLVideoElement) {
  if (binding?.video === video) { binding.destroy(); binding = undefined; emit(false, 'off'); }
  const graph = graphs.get(video); if (!graph) return;
  graph.source.disconnect(); graph.gain.disconnect(); graph.analyser.disconnect(); void graph.context.close().catch(() => {}); graphs.delete(video);
}

/** One scene binding, one existing video, no second decoder or animation loop. */
export function bindPassageSound(video: HTMLVideoElement) {
  binding?.destroy();
  const current = createBinding(video); binding = current;
  return {
    setActive: current.setActive, sample: current.sample,
    destroy() { current.destroy(); if (binding === current) { binding = undefined; emit(false, 'off'); } },
  };
}
