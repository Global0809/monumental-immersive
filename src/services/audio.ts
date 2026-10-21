import { getViewer, subscribeViewer, updateViewer } from './viewer';

/** Original procedural material sounds. No samples, recordings or network requests. */
export type SoundType = 'activate' | 'select' | 'save' | 'destination' | 'era' | 'error'
  | 'hover' | 'navigate' | 'open' | 'close' | 'drag' | 'tick' | 'success' | 'focus'
  | 'sculpture-unfold' | 'sculpture-fold' | 'sculpture-pulse' | 'sculpture-turn' | 'sculpture-reset';
export type AmbientScene = 'home' | 'world' | 'time' | 'library';
export type SoundOptions = { intensity?: number; pan?: number; pitch?: number };
export type SonicPulse = { type: SoundType; intensity: number; pan: number; scene: AmbientScene; timestamp: number };
export type SonicState = { status: 'off' | 'waiting' | 'running' | 'suspended' | 'unavailable'; playback: boolean; scene: AmbientScene };
let context: AudioContext | null = null;
let master: GainNode | null = null;
let effects: GainNode | null = null;
let ambience: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let analyserData: Float32Array<ArrayBuffer> | null = null;
let noise: AudioBuffer | null = null;
let playbackActive = false;
let scene: AmbientScene = 'home';
let unsupported = false;
let installed = false;
let unsubscribe: (() => void) | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let suspendTimer: ReturnType<typeof setTimeout> | undefined;
let resumePromise: Promise<void> | null = null;
let pendingCue: { type: SoundType; options: SoundOptions } | null = null;
let lastMain = -Infinity;
let trustedGestureUntil = 0;
const lastCue = new Map<SoundType, number>();
const listeners = new Set<() => void>();
let snapshot: SonicState = { status: 'off', playback: false, scene: 'home' };
const activeCues = new Set<() => void>();
let ambientSources: OscillatorNode[] = [];
let ambientNodes: AudioNode[] = [];
let ambientRoot: GainNode | null = null;
let preferences = '';
const clamp = (value: number | undefined, min: number, max: number, fallback: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback;
const now = () => typeof performance === 'undefined' ? 0 : performance.now();

function emitState() {
  const status = unsupported ? 'unavailable' : !getViewer().sound ? 'off' : !context ? 'waiting' : context.state === 'running' ? 'running' : 'suspended';
  if (snapshot.status === status && snapshot.playback === playbackActive && snapshot.scene === scene) return;
  snapshot = { status, playback: playbackActive, scene };
  listeners.forEach(listener => listener());
}
export const getSonicState = () => snapshot;
export function subscribeSonicState(listener: () => void) {
  installLifecycle(); listeners.add(listener); emitState();
  return () => { listeners.delete(listener); };
}
function ramp(param: AudioParam, value: number, duration = 0.035) {
  if (!context) return;
  const time = context.currentTime;
  param.cancelScheduledValues(time); param.setTargetAtTime(value, time, duration);
}
function spatialNode(value: number): StereoPannerNode | GainNode {
  // Older engines can still play the authored cue in mono.
  if (context && typeof context.createStereoPanner === 'function') {
    const node = context.createStereoPanner(); node.pan.value = value; return node;
  }
  return context!.createGain();
}
function stopCues() { activeCues.forEach(stop => stop()); activeCues.clear(); pendingCue = null; }
function stopAmbient() {
  const sources = ambientSources; const nodes = ambientNodes; const root = ambientRoot;
  ambientSources = []; ambientNodes = []; ambientRoot = null;
  if (!sources.length || !context) return;
  if (root) ramp(root.gain, 0, 0.025);
  sources.forEach(source => { try { source.stop(context!.currentTime + 0.12); } catch { /* Already ended. */ } });
  setTimeout(() => { sources.forEach(source => source.disconnect()); nodes.forEach(node => node.disconnect()); }, 150);
}
const ambienceNotes: Record<AmbientScene, number[]> = {
  home: [65.406, 98, 196], world: [73.416, 110, 220], time: [61.735, 92.499, 184.997], library: [55, 82.407, 164.814],
};
function startAmbient() {
  if (!context || !ambience || context.state !== 'running' || !getViewer().sound || !getViewer().ambient || playbackActive || document.hidden || ambientSources.length) return;
  const time = context.currentTime;
  const root = context.createGain(); root.gain.value = 0; root.connect(ambience); ambientRoot = root;
  const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 950; filter.Q.value = 0.35; filter.connect(root);
  ambientNodes = [root, filter];
  ambienceNotes[scene].forEach((frequency, index) => {
    const oscillator = context!.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    const gain = context!.createGain(); gain.gain.value = index === 0 ? 0.12 : 0.045;
    const pan = spatialNode((index - 1) * 0.45);
    oscillator.connect(gain); gain.connect(pan); pan.connect(filter);
    oscillator.start(time); ambientSources.push(oscillator); ambientNodes.push(gain, pan);
  });
  // A slow native LFO supplies a gentle breath without a JavaScript audio loop.
  const breath = context.createOscillator(); const depth = context.createGain();
  breath.frequency.value = 0.075; depth.gain.value = 0.18; breath.connect(depth); depth.connect(root.gain); breath.start(time);
  ambientSources.push(breath); ambientNodes.push(depth); ramp(root.gain, 0.72, 1.3);
}
function scheduleSuspend() {
  clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => { if (context?.state === 'running') void context.suspend().then(emitState).catch(() => {}); }, 100);
}
function syncPreferences() {
  const viewer = getViewer();
  const next = [viewer.sound, viewer.masterVolume, viewer.ambient, viewer.ambientMix].join('/');
  if (next === preferences) { emitState(); return; }
  preferences = next;
  if (master) ramp(master.gain, viewer.sound && !playbackActive && !document.hidden ? viewer.masterVolume * 0.36 : 0);
  if (ambience) ramp(ambience.gain, viewer.ambientMix * 0.5, 0.15);
  if (!viewer.sound || !viewer.ambient) stopAmbient(); else startAmbient();
  if (!viewer.sound) { stopCues(); scheduleSuspend(); }
  emitState();
}
function activity() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (master) ramp(master.gain, 0, 0.025);
    stopCues(); stopAmbient(); scheduleSuspend();
  }, 90000);
}
function visibility() {
  if (!document.hidden) return; // Visibility alone never resumes audio.
  clearTimeout(idleTimer); clearTimeout(suspendTimer); stopCues(); stopAmbient();
  if (master && context) { master.gain.cancelScheduledValues(context.currentTime); master.gain.setValueAtTime(0, context.currentTime); }
  void context?.suspend().then(emitState).catch(() => {});
}
function gesture(event: Event) {
  if (!event.isTrusted || (event instanceof KeyboardEvent && !['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))) return;
  trustedGestureUntil = now() + 700;
  if (getViewer().sound && !document.hidden) { activity(); prepareAudio(); }
}
function pageExit() { stopCues(); stopAmbient(); void context?.suspend().then(emitState).catch(() => {}); }
function installLifecycle() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  document.addEventListener('pointerdown', gesture, true); document.addEventListener('keydown', gesture, true); document.addEventListener('click', gesture, true);
  document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', pageExit);
  unsubscribe = subscribeViewer(syncPreferences); syncPreferences();
}
function buildGraph() {
  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) { unsupported = true; emitState(); return false; }
  try {
    context = new Context({ latencyHint: 'interactive' });
    master = context.createGain(); master.gain.value = 0;
    effects = context.createGain(); ambience = context.createGain(); ambience.gain.value = getViewer().ambientMix * 0.5;
    const highpass = context.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 35; highpass.Q.value = 0.3;
    const limiter = context.createDynamicsCompressor(); limiter.threshold.value = -18; limiter.knee.value = 14; limiter.ratio.value = 8; limiter.attack.value = 0.004; limiter.release.value = 0.13;
    analyser = context.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.65;
    analyserData = new Float32Array(analyser.fftSize);
    effects.connect(master); ambience.connect(master); master.connect(highpass); highpass.connect(limiter); limiter.connect(analyser); analyser.connect(context.destination);
    noise = context.createBuffer(1, Math.ceil(context.sampleRate * 1.5), context.sampleRate);
    const data = noise.getChannelData(0); let seed = 78237;
    for (let i = 0; i < data.length; i++) { seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5; data[i] = (seed >>> 0) / 2147483648 - 1; }
    context.onstatechange = emitState;
    return true;
  } catch { unsupported = true; emitState(); return false; }
}
function prepareAudio(): boolean {
  installLifecycle();
  if (typeof window === 'undefined' || !getViewer().sound || document.hidden || playbackActive || unsupported) return false;
  const activated = navigator.userActivation ? navigator.userActivation.isActive : now() < trustedGestureUntil;
  if (!context && (!activated || !buildGraph())) return false;
  if (!context || !master) return false;
  if (context.state === 'suspended') {
    if (!activated) return false;
    clearTimeout(suspendTimer);
    const resuming = context;
    if (!resumePromise) resumePromise = resuming.resume().then(() => {
      if (context !== resuming || !master) return;
      resumePromise = null;
      if (!getViewer().sound || playbackActive || document.hidden) { if (master) ramp(master.gain, 0); return; }
      ramp(master.gain, getViewer().masterVolume * 0.36);
      startAmbient(); emitState();
      const queued = pendingCue; pendingCue = null; if (queued) playSound(queued.type, queued.options);
    }).catch(() => { resumePromise = null; emitState(); });
    return false;
  }
  clearTimeout(suspendTimer); ramp(master.gain, getViewer().masterVolume * 0.36);
  startAmbient(); emitState(); return context.state === 'running';
}
export function setSoundEnabled(enabled: boolean): void {
  installLifecycle(); updateViewer({ sound: enabled });
  if (enabled) { activity(); playSound('activate'); }
}
export function setMasterVolume(volume: number) { installLifecycle(); updateViewer({ masterVolume: clamp(volume, 0, 1, 0.45) }); activity(); prepareAudio(); }
export function setAmbientEnabled(enabled: boolean) { installLifecycle(); updateViewer({ ambient: enabled }); activity(); prepareAudio(); }
export function setAmbientMix(mix: number) { installLifecycle(); updateViewer({ ambientMix: clamp(mix, 0, 1, 0.2) }); activity(); prepareAudio(); }
export function setAmbientScene(next: AmbientScene) {
  if (!Object.hasOwn(ambienceNotes, next) || next === scene) return;
  scene = next; stopAmbient(); startAmbient(); emitState();
}
export function setPlaybackActive(active: boolean): void {
  playbackActive = active;
  if (active) { stopCues(); stopAmbient(); }
  if (master) ramp(master.gain, active || !getViewer().sound || document.hidden ? 0 : getViewer().masterVolume * 0.36, 0.015);
  if (!active) startAmbient();
  emitState();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('monumental:playback', { detail: { active } }));
}
/** Reads the real post-dynamics output. It is silent before opt-in and during media. */
export function readSoundLevel() {
  if (!analyser || !analyserData || context?.state !== 'running' || playbackActive || !getViewer().sound || document.hidden) return { rms: 0, peak: 0 };
  analyser.getFloatTimeDomainData(analyserData);
  let squares = 0; let peak = 0;
  for (const value of analyserData) { squares += value * value; peak = Math.max(peak, Math.abs(value)); }
  return { rms: Math.sqrt(squares / analyserData.length), peak };
}
/** Borrowed waveform buffer for the studio oscilloscope; do not mutate it. */
export function readSoundWaveform(): Float32Array<ArrayBuffer> | null {
  if (!analyser || !analyserData || context?.state !== 'running' || playbackActive || !getViewer().sound || document.hidden) return null;
  analyser.getFloatTimeDomainData(analyserData);
  return analyserData;
}
const aliases: Partial<Record<SoundType, SoundType>> = {
  'sculpture-unfold': 'open', 'sculpture-fold': 'close', 'sculpture-reset': 'focus', 'sculpture-turn': 'tick', success: 'save',
};
/** Material-specific throttles, a voice ceiling and bounded tails prevent event storms. */
export function playSound(type: SoundType = 'select', options: SoundOptions = {}): void {
  if (typeof document === 'undefined' || playbackActive || document.hidden || !getViewer().sound || getViewer().masterVolume === 0) return;
  const time = now(); const kind = aliases[type] || type; const quiet = ['hover', 'tick', 'drag'].includes(kind);
  const cooldown = kind === 'hover' ? 130 : quiet ? 70 : 115;
  if (time - (lastCue.get(type) ?? -Infinity) < cooldown || (!quiet && time - lastMain < 55) || (quiet && time - lastMain < 150) || activeCues.size >= 6) return;
  if (!prepareAudio() || !context || !effects) { if (resumePromise) pendingCue = { type, options }; return; }
  activity(); lastCue.set(type, time); if (!quiet) lastMain = time;
  const intensity = clamp(options.intensity, 0.08, 1, quiet ? 0.38 : 0.7);
  const panValue = clamp(options.pan, -1, 1, 0); const pitch = clamp(options.pitch, 0.5, 2, 1);
  const start = context.currentTime + 0.004;
  const root = context.createGain(); root.gain.value = intensity;
  const pan = spatialNode(panValue); root.connect(pan); pan.connect(effects);
  const sources: AudioScheduledSourceNode[] = []; const nodes: AudioNode[] = [root, pan]; let end = 0.15; let finished = false;
  let timer: ReturnType<typeof setTimeout>;
  const cleanup = () => { if (finished) return; finished = true; clearTimeout(timer); sources.forEach(source => { try { source.stop(); } catch { /* Already stopped. */ } source.disconnect(); }); nodes.forEach(node => node.disconnect()); activeCues.delete(cleanup); };
  activeCues.add(cleanup);
  function tone(from: number, to: number, duration: number, gain: number, delay = 0, wave: OscillatorType = 'sine', attack = 0.006) {
    const oscillator = context!.createOscillator(); const envelope = context!.createGain(); oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from * pitch, start + delay); oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, to * pitch), start + delay + duration);
    envelope.gain.setValueAtTime(0, start + delay); envelope.gain.linearRampToValueAtTime(gain, start + delay + Math.min(attack, duration / 3)); envelope.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);
    oscillator.connect(envelope); envelope.connect(root); oscillator.start(start + delay); oscillator.stop(start + delay + duration + 0.01);
    sources.push(oscillator); nodes.push(envelope); end = Math.max(end, delay + duration + 0.03);
  }
  function air(from: number, to: number, duration: number, gain: number, delay = 0, attack = 0.01) {
    const source = context!.createBufferSource(); source.buffer = noise;
    const filter = context!.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = 1.5; filter.frequency.setValueAtTime(from * pitch, start + delay); filter.frequency.exponentialRampToValueAtTime(to * pitch, start + delay + duration);
    const envelope = context!.createGain(); envelope.gain.setValueAtTime(0, start + delay); envelope.gain.linearRampToValueAtTime(gain, start + delay + Math.min(attack, duration / 2)); envelope.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(root); source.start(start + delay); source.stop(start + delay + duration + 0.01);
    sources.push(source); nodes.push(filter, envelope); end = Math.max(end, delay + duration + 0.03);
  }
  switch (kind) {
    case 'hover': tone(1550, 1220, 0.045, 0.1); air(4300, 2600, 0.035, 0.14); break;
    case 'tick': tone(760, 470, 0.055, 0.22, 0, 'triangle'); air(2400, 1000, 0.035, 0.18); break;
    case 'drag': air(850, 1500, 0.085, 0.18); tone(145, 120, 0.09, 0.12, 0, 'triangle'); break;
    case 'select': tone(220, 78, 0.12, 0.45, 0, 'triangle'); tone(1340, 1280, 0.14, 0.12, 0.005); air(3200, 1200, 0.04, 0.25); break;
    case 'focus': tone(392, 523.25, 0.2, 0.25); tone(1046.5, 1046.5, 0.29, 0.1, 0.04); air(900, 2400, 0.19, 0.12, 0, 0.07); break;
    case 'activate': tone(196, 196, 0.38, 0.25, 0, 'triangle'); tone(587.33, 587.33, 0.43, 0.19, 0.075); tone(1174.66, 1174.66, 0.5, 0.12, 0.15); air(450, 2200, 0.34, 0.15, 0, 0.1); break;
    case 'save': tone(523.25, 523.25, 0.3, 0.26); tone(784, 784, 0.37, 0.2, 0.07); tone(1568, 1568, 0.44, 0.08, 0.12); tone(135, 78, 0.12, 0.2); break;
    case 'open': air(420, 3200, 0.46, 0.33, 0, 0.14); tone(164.8, 329.6, 0.38, 0.24, 0, 'triangle', 0.06); tone(1318.5, 1568, 0.43, 0.09, 0.12); break;
    case 'close': air(2600, 240, 0.28, 0.3, 0, 0.025); tone(240, 70, 0.2, 0.4, 0.025, 'triangle'); tone(930, 520, 0.15, 0.08); break;
    case 'navigate': air(320, 2700, 0.44, 0.38, 0, 0.12); tone(110, 220, 0.4, 0.25, 0, 'triangle', 0.06); tone(880, 1320, 0.3, 0.12, 0.15); if ('pan' in pan) pan.pan.linearRampToValueAtTime(panValue * 0.3, start + 0.4); break;
    case 'destination': air(1800, 420, 0.6, 0.27, 0, 0.1); tone(82.4, 164.8, 0.5, 0.35, 0, 'triangle', 0.08); tone(659.3, 988.8, 0.52, 0.16, 0.11); tone(1318.5, 1318.5, 0.42, 0.08, 0.23); if ('pan' in pan) pan.pan.linearRampToValueAtTime(-panValue * 0.25, start + 0.6); break;
    case 'era': air(2400, 420, 0.32, 0.4, 0, 0.04); tone(196, 98, 0.4, 0.3, 0, 'triangle'); [0.025, 0.08, 0.16].forEach((delay, i) => tone(1450 - i * 230, 520, 0.06, 0.09, delay)); tone(392, 294, 0.4, 0.12, 0.1); break;
    case 'sculpture-pulse': tone(82.4, 41.2, 0.62, 0.46, 0, 'sine', 0.016); [329.6, 571.2, 905.3, 1397.4].forEach((frequency, i) => tone(frequency, frequency * 0.97, 0.58 - i * 0.07, 0.13 / (1 + i * 0.4), i * 0.018)); air(1000, 250, 0.22, 0.25); break;
    case 'error': tone(164.8, 146.8, 0.16, 0.24, 0, 'triangle'); tone(123.5, 110, 0.19, 0.22, 0.14, 'triangle'); air(400, 180, 0.13, 0.13, 0.14); break;
    default: tone(220, 78, 0.12, 0.35, 0, 'triangle'); break;
  }
  timer = setTimeout(cleanup, (end + 0.06) * 1000);
  window.dispatchEvent(new CustomEvent<SonicPulse>('monumental:sonic-pulse', { detail: { type, intensity, pan: panValue, scene, timestamp: time } }));
}
/** Complete HMR / embedded-app teardown. A later gesture can rebuild the graph. */
export function disposeAudio() {
  clearTimeout(idleTimer); clearTimeout(suspendTimer); stopCues(); stopAmbient(); unsubscribe?.(); unsubscribe = undefined;
  if (typeof window !== 'undefined') {
    document.removeEventListener('pointerdown', gesture, true); document.removeEventListener('keydown', gesture, true); document.removeEventListener('click', gesture, true);
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pageExit);
  }
  if (context) { context.onstatechange = null; void context.close().catch(() => {}); }
  context = null; master = null; effects = null; ambience = null; analyser = null; analyserData = null; noise = null;
  installed = false; resumePromise = null; unsupported = false; preferences = ''; lastCue.clear(); lastMain = -Infinity; trustedGestureUntil = 0; emitState();
}
if (typeof window !== 'undefined') installLifecycle();
if (import.meta.hot) import.meta.hot.dispose(disposeAudio);
