import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// The audio service is tested through its public API. The fake clock and graph
// model observable resource use without relying on browser autoplay heuristics.
let clock = 0;
let timerId = 0;
const timers = new Map<number, { due: number; callback: () => void }>();
const requests: string[] = [];
const contexts: FakeAudioContext[] = [];
const sources: FakeSource[] = [];
const pulses: Event[] = [];
let holdDecode = false;
let decodeWaiters: Array<(buffer: FakeBuffer) => void> = [];
let activated = true;

class FakeParam {
  value = 0;
  cancelScheduledValues() {}
  cancelAndHoldAtTime() {}
  setValueAtTime(value: number) { this.value = value; }
  setTargetAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
  exponentialRampToValueAtTime(value: number) { this.value = value; }
}
class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  pan = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  connections: unknown[] = [];
  connect(target: unknown) { this.connections.push(target); return target; }
  disconnect() { this.connections = []; }
}
class FakeBuffer {
  readonly duration: number;
  readonly data: Float32Array;
  constructor(readonly numberOfChannels = 1, readonly length = 4000, readonly sampleRate = 8000) {
    this.duration = length / sampleRate;
    this.data = new Float32Array(length);
  }
  getChannelData() { return this.data; }
}
class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  playbackRate = new FakeParam();
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  start() { this.started = true; }
  stop() { this.stopped = true; }
}
class FakeAudioContext {
  state = 'running';
  readonly sampleRate = 8000;
  readonly destination = new FakeNode();
  onstatechange: (() => void) | null = null;
  get currentTime() { return clock / 1000; }
  constructor() { contexts.push(this); }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createStereoPanner() { return new FakeNode(); }
  createOscillator() { return new FakeSource(); }
  createBufferSource() { const source = new FakeSource(); sources.push(source); return source; }
  createBuffer(channels: number, length: number, sampleRate: number) { return new FakeBuffer(channels, length, sampleRate); }
  createAnalyser() {
    return Object.assign(new FakeNode(), { fftSize: 256, smoothingTimeConstant: 0, getFloatTimeDomainData(data: Float32Array) { data.fill(0); } });
  }
  decodeAudioData() {
    return holdDecode ? new Promise<FakeBuffer>(resolve => decodeWaiters.push(resolve)) : Promise.resolve(new FakeBuffer());
  }
  async resume() { this.state = 'running'; this.onstatechange?.(); }
  async suspend() { this.state = 'suspended'; this.onstatechange?.(); }
  async close() { this.state = 'closed'; this.onstatechange?.(); }
}

const documentMock = Object.assign(new EventTarget(), { hidden: false });
const windowMock = Object.assign(new EventTarget(), {
  AudioContext: FakeAudioContext,
  matchMedia: () => ({ matches: false }),
  localStorage: { getItem: () => null, setItem() {} },
});
windowMock.addEventListener('monumental:sonic-pulse', event => pulses.push(event));
const replacements = {
  window: windowMock,
  document: documentMock,
  navigator: { userActivation: { get isActive() { return activated; } } },
  performance: { now: () => clock },
  setTimeout: (callback: () => void, milliseconds = 0) => {
    const id = ++timerId;
    timers.set(id, { due: clock + milliseconds, callback });
    return id;
  },
  clearTimeout: (id: number) => { timers.delete(id); },
  fetch: async (input: string | URL | Request) => {
    requests.push(String(input));
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(32) };
  },
  CustomEvent: class<T> extends Event {
    readonly detail: T;
    constructor(type: string, options: CustomEventInit<T>) { super(type); this.detail = options.detail as T; }
  },
};
const original = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });

const audio = await import('../src/services/audio.ts');
const viewer = await import('../src/services/viewer.ts');

test('sound study suppresses interface score without broadcasting a full-player event', async () => {
  audio.setSoundEnabled(true); await settle();
  const before = sources.length; let playbackEvents = 0;
  const received = () => { playbackEvents++; }; windowMock.addEventListener('monumental:playback', received);
  audio.setStudyAudioActive(true); audio.playSound('save'); await settle();
  assert.equal(sources.length, before); assert.equal(playbackEvents, 0);
  audio.setStudyAudioActive(false); windowMock.removeEventListener('monumental:playback', received);
});

async function settle() { for (let count = 0; count < 20; count++) await Promise.resolve(); }
function advance(milliseconds: number) {
  const end = clock + milliseconds;
  while (true) {
    const next = [...timers.entries()].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
    if (!next) break;
    timers.delete(next[0]);
    clock = next[1].due;
    next[1].callback();
  }
  clock = end;
}
async function finishDecode() {
  holdDecode = false;
  const pending = decodeWaiters;
  decodeWaiters = [];
  for (const resolve of pending) resolve(new FakeBuffer());
  await settle();
}

beforeEach(async () => {
  audio.disposeAudio();
  await settle();
  viewer.updateViewer({ sound: false, ambient: false, masterVolume: 0.45, ambientMix: 0.2 });
  audio.setPlaybackActive(false);
  timers.clear();
  clock = 0;
  requests.length = contexts.length = sources.length = pulses.length = 0;
  decodeWaiters = [];
  holdDecode = false;
  activated = true;
  documentMock.hidden = false;
});

after(() => {
  audio.disposeAudio();
  for (const [key, descriptor] of original) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test('sound stays resource-free before opt-in, including preference changes', async () => {
  audio.playSound('select');
  audio.setMasterVolume(0.8);
  audio.setAmbientEnabled(true);
  audio.playSound('destination');
  await settle();
  assert.equal(contexts.length, 0);
  assert.equal(requests.length, 0);
  assert.equal(sources.length, 0);
});

test('a saved opt-in cannot create audio without a current user activation', async () => {
  activated = false;
  audio.setSoundEnabled(true);
  audio.playSound('select');
  await settle();
  assert.equal(viewer.getViewer().sound, true);
  assert.equal(contexts.length, 0);
  assert.equal(requests.length, 0);
});

test('zero master volume does not load or start a cue', async () => {
  viewer.updateViewer({ sound: true, masterVolume: 0 });
  audio.playSound('select');
  audio.playSound('destination');
  await settle();
  assert.equal(requests.length, 0);
  assert.equal(sources.length, 0);
});

test('rapid off and on cancels the old suspension even when activation is throttled', async () => {
  audio.setSoundEnabled(true);
  await settle();
  assert.equal(contexts.length, 1);
  advance(20);
  audio.setSoundEnabled(false);
  advance(30);
  audio.setSoundEnabled(true);
  await settle();
  advance(100);
  await settle();
  assert.equal(viewer.getViewer().sound, true);
  assert.equal(contexts[0].state, 'running');
  assert.equal(audio.getSonicState().status, 'running');
});

test('film priority stops existing cues and prevents new loads and starts', async () => {
  audio.setSoundEnabled(true);
  await settle();
  assert.ok(sources.some(source => source.started), 'The initial cue must have played for the test to exercise interruption.');
  audio.setPlaybackActive(true);
  const requestCount = requests.length;
  const sourceCount = sources.length;
  advance(200);
  audio.playSound('destination');
  audio.playSound('hover');
  await settle();
  assert.equal(requests.length, requestCount);
  assert.equal(sources.length, sourceCount);
  assert.ok(sources.every(source => !source.started || source.stopped));
  assert.deepEqual(audio.readSoundLevel(), { rms: 0, peak: 0 });
  assert.equal(audio.readSoundWaveform(), null);
});

for (const interruption of ['mute', 'film', 'hidden', 'dispose'] as const) {
  test(`a cue decoding during ${interruption} cannot start after the interruption`, async () => {
    holdDecode = true;
    audio.setSoundEnabled(true);
    await settle();
    assert.ok(decodeWaiters.length > 0, 'The cue must reach asynchronous decode before interruption.');
    if (interruption === 'mute') audio.setSoundEnabled(false);
    if (interruption === 'film') audio.setPlaybackActive(true);
    if (interruption === 'hidden') { documentMock.hidden = true; documentMock.dispatchEvent(new Event('visibilitychange')); }
    if (interruption === 'dispose') audio.disposeAudio();
    await finishDecode();
    assert.equal(sources.filter(source => source.started).length, 0);
    assert.equal(pulses.length, 0);
  });
}

test('turning sound back on does not revive a cue requested before mute', async () => {
  holdDecode = true;
  viewer.updateViewer({ sound: true });
  audio.playSound('destination');
  await settle();
  assert.ok(decodeWaiters.length > 0);
  advance(20);
  audio.setSoundEnabled(false);
  advance(40);
  audio.setSoundEnabled(true);
  await settle();
  await finishDecode();
  assert.ok(pulses.every(event => (event as CustomEvent).detail.type !== 'destination'));
});

test('a decoded cue is reused for subsequent gestures', async () => {
  viewer.updateViewer({ sound: true });
  audio.playSound('select');
  await settle();
  assert.ok(requests.length > 0);
  assert.equal(sources.filter(source => source.started).length, 1);
  const firstLoadCount = requests.length;
  advance(200);
  audio.playSound('select');
  await settle();
  assert.equal(requests.length, firstLoadCount);
  assert.equal(sources.filter(source => source.started).length, 2);
});

test('passage motion cannot allocate audio or timers before consent', async () => {
  for (let index = 0; index < 120; index++) audio.setSonicMotion(index / 120, .8);
  await settle();
  assert.equal(contexts.length, 0);
  assert.equal(requests.length, 0);
  assert.equal(timers.size, 0);
});

test('a pending room handoff keeps the old room until the latest destination is ready', async () => {
  audio.setSoundEnabled(true); audio.setAmbientEnabled(true); await settle();
  const oldRoom = sources.at(-1)!;
  assert.equal(oldRoom.stopped, false);
  holdDecode = true;
  audio.setAmbientScene('music'); await settle();
  audio.setAmbientScene('culture'); await settle();
  assert.equal(oldRoom.stopped, false, 'Do not cut to silence while a room is loading.');
  const count = sources.length;
  await finishDecode();
  assert.equal(sources.length, count + 1, 'Only the last requested room may start.');
  assert.equal(oldRoom.stopped, true);
  assert.equal(audio.getSonicState().scene, 'culture');
});

test('a pending room cannot resume after full-player ownership', async () => {
  audio.setSoundEnabled(true); await settle();
  holdDecode = true; audio.setAmbientScene('cinema'); audio.setAmbientEnabled(true); await settle();
  const count = sources.length;
  audio.setPlaybackActive(true); await finishDecode();
  assert.equal(sources.length, count);
  assert.ok(sources.every(source => !source.started || source.stopped));
});
