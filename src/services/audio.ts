import { getViewer, subscribeViewer, updateViewer } from './viewer';
import { sonicAsset, sonicScore, sonicScenes, type SoundType, type AmbientScene, type SonicAsset } from './sonicScore';
export type { SoundType, AmbientScene } from './sonicScore';

/** Minimal interface palette. Audio assets are fetched only after explicit opt-in. */
export type SoundOptions = { intensity?: number; pan?: number; pitch?: number; audition?: boolean };
export type SonicPulse = { type: SoundType; intensity: number; pan: number; scene: AmbientScene; timestamp: number };
export type SonicState = { status: 'off' | 'waiting' | 'running' | 'suspended' | 'unavailable'; playback: boolean; scene: AmbientScene };
let context: AudioContext | null = null;
let master: GainNode | null = null;
let effects: GainNode | null = null;
let ambience: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let analyserData: Float32Array<ArrayBuffer> | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const requests = new Set<AbortController>();
let cueEpoch = 0, roomEpoch = 0, roomPending = false, cueSerial = 0, mainSerial = 0;
let playbackActive = false, studyPlaybackActive = false;
const mediaOwnsSound = () => playbackActive || studyPlaybackActive;
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
let ambientSources: AudioBufferSourceNode[] = [];
let ambientNodes: AudioNode[] = [];
let ambientRoot: GainNode | null = null;
let playingScene: AmbientScene | null = null;
const retiringRooms = new Map<() => void, ReturnType<typeof setTimeout>>();
const MASTER_GAIN = .5, ATMOSPHERE_GAIN = .45;
// Environmental movement is visual. Only deliberate actions receive a voice.
// Explicit studio auditions remain available without restoring automatic noise.
const silentAutomatic = new Set<SoundType>(['hover', 'drag', 'tick', 'scan', 'sculpture-turn', 'arrival', 'assembly-release', 'assembly-drive', 'assembly-lock', 'iris-open', 'iris-close', 'threshold-pass']);
let preferences = '';
const clamp = (value: number | undefined, min: number, max: number, fallback: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback;
const now = () => typeof performance === 'undefined' ? 0 : performance.now();

function emitState() {
  const status = unsupported ? 'unavailable' : !getViewer().sound ? 'off' : !context ? 'waiting' : context.state === 'running' ? 'running' : 'suspended';
  if (snapshot.status === status && snapshot.playback === mediaOwnsSound() && snapshot.scene === scene) return;
  snapshot = { status, playback: mediaOwnsSound(), scene };
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
function stopCues() { cueEpoch++; activeCues.forEach(stop => stop()); activeCues.clear(); pendingCue = null; }
function retireRoom(sources: AudioBufferSourceNode[], nodes: AudioNode[], root: GainNode | null, fade: number) {
  if (!sources.length || !context) return;
  if (root) ramp(root.gain, 0, fade / 5);
  sources.forEach(source => { try { source.stop(context!.currentTime + fade); } catch { /* Already ended. */ } });
  const cleanup = () => {
    sources.forEach(source => { try { source.stop(); } catch { /* Already ended. */ } source.disconnect(); });
    nodes.forEach(node => node.disconnect()); retiringRooms.delete(cleanup);
  };
  retiringRooms.set(cleanup, setTimeout(cleanup, (fade + .03) * 1000));
}
function stopAmbient() {
  roomEpoch++; roomPending = false;
  const sources = ambientSources; const nodes = ambientNodes; const root = ambientRoot;
  ambientSources = []; ambientNodes = []; ambientRoot = null; playingScene = null;
  retireRoom(sources, nodes, root, .12);
}
function loadBuffer(name: SonicAsset): Promise<AudioBuffer | null> {
  if (!context || !getViewer().sound || getViewer().masterVolume === 0 || document.hidden || mediaOwnsSound()) return Promise.resolve(null);
  const asset = sonicAsset(name);
  const cached = buffers.get(asset); if (cached) return cached;
  const audio = context, controller = new AbortController(); requests.add(controller);
  const request = fetch(asset, { signal: controller.signal }).then(response => {
    if (!response.ok) throw new Error('Sound asset unavailable');
    return response.arrayBuffer();
  }).then(bytes => audio.decodeAudioData(bytes)).then(buffer => context === audio ? buffer : null).catch(() => {
    if (buffers.get(asset) === request) buffers.delete(asset);
    return null;
  }).finally(() => requests.delete(controller));
  buffers.set(asset, request); return request;
}
function startAmbient() {
  const viewer = getViewer();
  if (!context || !ambience || context.state !== 'running' || !viewer.sound || !viewer.ambient || !viewer.masterVolume || mediaOwnsSound() || document.hidden || (ambientSources.length && playingScene !== null && sonicAsset(`room-${playingScene}`) === sonicAsset(`room-${scene}`)) || roomPending) return;
  const epoch = roomEpoch, audio = context, requestedScene = scene; roomPending = true;
  void loadBuffer(`room-${requestedScene}`).then(buffer => {
    if (epoch !== roomEpoch || context !== audio) return;
    roomPending = false;
    const current = getViewer();
    if (!buffer || !ambience || audio.state !== 'running' || !current.sound || !current.ambient || !current.masterVolume || mediaOwnsSound() || document.hidden) return;
    // Keep the previous room audible while this buffer loads, then crossfade.
    // Rapid chapter jumps retain at most one outgoing room, never a pile of loops.
    retiringRooms.forEach((timer, cleanup) => { clearTimeout(timer); cleanup(); });
    retireRoom(ambientSources, ambientNodes, ambientRoot, .65);
    const root = audio.createGain(); root.gain.value = 0; root.connect(ambience); ambientRoot = root;
    const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1500; filter.Q.value = .4;
    const pan = spatialNode(0);
    const source = audio.createBufferSource(); source.buffer = buffer; source.loop = true;
    source.connect(filter); filter.connect(pan); pan.connect(root);
    playingScene = requestedScene;
    ambientSources = [source]; ambientNodes = [root, filter, pan]; source.start(); ramp(root.gain, .65, .35);
  });
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
  if (master) ramp(master.gain, viewer.sound && !mediaOwnsSound() && !document.hidden ? viewer.masterVolume * MASTER_GAIN : 0);
  if (ambience) ramp(ambience.gain, viewer.ambientMix * ATMOSPHERE_GAIN, 0.15);
  if (!viewer.sound || !viewer.ambient || viewer.masterVolume === 0) stopAmbient(); else startAmbient();
  if (!viewer.sound || viewer.masterVolume === 0) { stopCues(); scheduleSuspend(); }
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
  if (!event.isTrusted || (event instanceof KeyboardEvent && !['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key))) return;
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
    effects = context.createGain(); ambience = context.createGain(); ambience.gain.value = getViewer().ambientMix * ATMOSPHERE_GAIN;
    const highpass = context.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 35; highpass.Q.value = 0.3;
    const limiter = context.createDynamicsCompressor(); limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 6; limiter.attack.value = 0.003; limiter.release.value = 0.18;
    analyser = context.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.65;
    analyserData = new Float32Array(analyser.fftSize);
    effects.connect(master); ambience.connect(master); master.connect(highpass); highpass.connect(limiter); limiter.connect(analyser); analyser.connect(context.destination);
    context.onstatechange = emitState;
    return true;
  } catch { unsupported = true; emitState(); return false; }
}
function prepareAudio(): boolean {
  installLifecycle();
  if (typeof window === 'undefined' || !getViewer().sound || getViewer().masterVolume === 0 || document.hidden || mediaOwnsSound() || unsupported) return false;
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
      if (!getViewer().sound || mediaOwnsSound() || document.hidden) { if (master) ramp(master.gain, 0); return; }
      ramp(master.gain, getViewer().masterVolume * MASTER_GAIN);
      startAmbient(); emitState();
      const queued = pendingCue; pendingCue = null; if (queued) playSound(queued.type, queued.options);
    }).catch(() => { resumePromise = null; emitState(); });
    return false;
  }
  clearTimeout(suspendTimer); ramp(master.gain, getViewer().masterVolume * MASTER_GAIN);
  startAmbient(); emitState(); return context.state === 'running';
}
export function setSoundEnabled(enabled: boolean): void {
  installLifecycle(); updateViewer({ sound: enabled });
  // Enabling must wake the graph even when the activation cue is throttled.
  if (enabled) { clearTimeout(suspendTimer); activity(); prepareAudio(); playSound('activate'); }
}
export function setMasterVolume(volume: number) { installLifecycle(); updateViewer({ masterVolume: clamp(volume, 0, 1, 0.45) }); activity(); prepareAudio(); }
export function setAmbientEnabled(enabled: boolean) { installLifecycle(); updateViewer({ ambient: enabled }); activity(); prepareAudio(); }
export function setAmbientMix(mix: number) { installLifecycle(); updateViewer({ ambientMix: clamp(mix, 0, 1, 0.2) }); activity(); prepareAudio(); }
export function setAmbientScene(next: AmbientScene) {
  if (!sonicScenes.includes(next) || next === scene) return;
  const changesField = sonicAsset(`room-${scene}`) !== sonicAsset(`room-${next}`);
  scene = next;
  if (changesField) { roomEpoch++; roomPending = false; }
  startAmbient(); emitState();
}
/** Compatibility hook for existing visual instruments. Scrolling is silent. */
export function setSonicMotion(_energy: number, _pan = 0): void {}
export function setPlaybackActive(active: boolean): void {
  playbackActive = active;
  if (active) { stopCues(); stopAmbient(); }
  if (master) ramp(master.gain, mediaOwnsSound() || !getViewer().sound || document.hidden ? 0 : getViewer().masterVolume * MASTER_GAIN, 0.015);
  if (!active) startAmbient();
  emitState();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('monumental:playback', { detail: { active } }));
}
/** A user-enabled local sound study owns the score bus without announcing a
 * full-player event (which would suspend the study's own video decoder). */
export function setStudyAudioActive(active: boolean): void {
  studyPlaybackActive = active;
  if (active) { stopCues(); stopAmbient(); }
  if (master) ramp(master.gain, mediaOwnsSound() || !getViewer().sound || document.hidden ? 0 : getViewer().masterVolume * MASTER_GAIN, .015);
  if (!mediaOwnsSound()) startAmbient();
  emitState();
}
/** Reads the real post-dynamics output. It is silent before opt-in and during media. */
export function readSoundLevel() {
  if (!analyser || !analyserData || context?.state !== 'running' || mediaOwnsSound() || !getViewer().sound || document.hidden) return { rms: 0, peak: 0 };
  analyser.getFloatTimeDomainData(analyserData);
  let squares = 0; let peak = 0;
  for (const value of analyserData) { squares += value * value; peak = Math.max(peak, Math.abs(value)); }
  return { rms: Math.sqrt(squares / analyserData.length), peak };
}
/** Borrowed waveform buffer for the studio oscilloscope; do not mutate it. */
export function readSoundWaveform(): Float32Array<ArrayBuffer> | null {
  if (!analyser || !analyserData || context?.state !== 'running' || mediaOwnsSound() || !getViewer().sound || document.hidden) return null;
  analyser.getFloatTimeDomainData(analyserData);
  return analyserData;
}
/** One cached buffer voice per interaction; no synthesis or animation loop. */
export function playSound(type: SoundType = 'select', options: SoundOptions = {}): void {
  if (!Object.hasOwn(sonicScore, type) || typeof document === 'undefined' || mediaOwnsSound() || document.hidden || !getViewer().sound || getViewer().masterVolume === 0) return;
  if (!options.audition && silentAutomatic.has(type)) return;
  const time = now(), quiet = ['select', 'focus', 'open', 'close', 'remove', 'error'].includes(type);
  const cooldown = ['portal', 'signal', 'sculpture-pulse'].includes(type) ? 900 : 180;
  const voiceLimit = options.audition ? 4 : 2;
  if ((!options.audition && (time - (lastCue.get(type) ?? -Infinity) < cooldown || time - lastMain < 180)) || activeCues.size >= voiceLimit) return;
  if (!prepareAudio() || !context || !effects) { if (resumePromise) pendingCue = { type, options }; return; }
  activity(); if (!options.audition) { lastCue.set(type, time); lastMain = time; }
  const epoch = cueEpoch, serial = ++cueSerial, audio = context;
  if (!options.audition) mainSerial = serial;
  const intensity = clamp(options.intensity, .08, 1, quiet ? .7 : .78);
  const panValue = clamp(options.pan, -.18, .18, 0);
  // A consistent timbre across the product; pitch is varied only by a deliberate
  // instrument action, never randomly during ordinary navigation.
  const rate = clamp(options.pitch, .5, 2, 1);
  void loadBuffer(type).then(buffer => {
    if (!buffer || epoch !== cueEpoch || audio !== context || !effects || audio.state !== 'running' || mediaOwnsSound() || document.hidden || !getViewer().sound || getViewer().masterVolume === 0) return;
    // A slow download must never replay an obsolete action after the next interaction.
    if ((!options.audition && serial < mainSerial) || now() - time > (type === 'activate' || options.audition ? 1500 : 450) || activeCues.size >= voiceLimit) return;
    const source = audio.createBufferSource(); source.buffer = buffer; source.playbackRate.value = rate;
    const root = audio.createGain(); root.gain.value = intensity;
    const pan = spatialNode(panValue); source.connect(root); root.connect(pan); pan.connect(effects);
    let ended = false, timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      if (ended) return; ended = true; clearTimeout(timer); source.onended = null;
      try { source.stop(); } catch { /* already ended */ }
      source.disconnect(); root.disconnect(); pan.disconnect(); activeCues.delete(cleanup);
    };
    source.onended = cleanup; activeCues.add(cleanup);
    source.start(audio.currentTime + .003);
    timer = setTimeout(cleanup, (buffer.duration / rate + .1) * 1000);
    if (ambience && !quiet) {
      const t = audio.currentTime, level = getViewer().ambientMix * ATMOSPHERE_GAIN;
      ambience.gain.cancelScheduledValues(t); ambience.gain.setTargetAtTime(level * .38, t, .015);
      ambience.gain.setTargetAtTime(level, t + Math.min(buffer.duration, .55), .22);
    }
    window.dispatchEvent(new CustomEvent<SonicPulse>('monumental:sonic-pulse', { detail: { type, intensity, pan: panValue, scene, timestamp: time } }));
    // Warm only everyday contacts after opt-in, never the entire library.
    if (type === 'activate') ['select','navigate','save','portal'].forEach(cue => { void loadBuffer(cue as SonicAsset); });
  });
}
/** Complete HMR / embedded-app teardown. A later gesture can rebuild the graph. */
export function disposeAudio() {
  clearTimeout(idleTimer); clearTimeout(suspendTimer); stopCues(); stopAmbient(); unsubscribe?.(); unsubscribe = undefined;
  retiringRooms.forEach((timer, cleanup) => { clearTimeout(timer); cleanup(); });
  if (typeof window !== 'undefined') {
    document.removeEventListener('pointerdown', gesture, true); document.removeEventListener('keydown', gesture, true); document.removeEventListener('click', gesture, true);
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pageExit);
  }
  if (context) { context.onstatechange = null; void context.close().catch(() => {}); }
  context = null; master = null; effects = null; ambience = null; analyser = null; analyserData = null; requests.forEach(request => request.abort()); requests.clear(); buffers.clear(); playbackActive = false; studyPlaybackActive = false;
  installed = false; resumePromise = null; unsupported = false; preferences = ''; lastCue.clear(); lastMain = -Infinity; trustedGestureUntil = 0; emitState();
}
if (typeof window !== 'undefined') installLifecycle();
if (import.meta.hot) import.meta.hot.dispose(disposeAudio);
