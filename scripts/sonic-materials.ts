import { sonicScore, type SoundType, type AmbientScene } from '../src/services/sonicScore.ts';

/** Offline sound sculpture: modal metal, shaped pressure, granular bearings and
 * authored stereo reflections. Original synthesis; no sample library or runtime DSP.
 */
export const SAMPLE_RATE = 32000;
const TAU = Math.PI * 2;
function random(seed: number) { return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }; }
function hash(text: string) { let value = 2166136261; for (const c of text) value = Math.imul(value ^ c.charCodeAt(0), 16777619); return value >>> 0; }
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
type Mode = [frequency: number, weight: number, decay: number];
const contactBody: Mode[] = [[142, 1, .042], [329, .45, .034], [761, .2, .022], [1567, .07, .012]];
const casing: Mode[] = [[117, .9, .17], [273, .55, .13], [631, .3, .09], [1219, .11, .07], [2261, .035, .04]];
const chrome: Mode[] = [[159, .7, .32], [337, .5, .28], [713, .33, .24], [1331, .13, .17], [2437, .035, .1]];
const pressure: Mode[] = [[73, .65, .25], [121, .8, .23], [197, .33, .17], [383, .12, .09]];
const memory: Mode[] = [[196, .8, .32], [293.66, .45, .3], [492, .17, .24], [879, .08, .16]];

export function renderCue(type: SoundType): [Float32Array, Float32Array] {
  const spec = sonicScore[type], n = Math.ceil(spec.duration * SAMPLE_RATE);
  const left = new Float32Array(n), right = new Float32Array(n);
  const rng = random(hash('monumental-ii-' + type));
  function add(index: number, value: number, pan = 0) {
    if (index < 0 || index >= n) return;
    left[index] += value * Math.sqrt((1 - pan) * .5);
    right[index] += value * Math.sqrt((1 + pan) * .5);
  }
  function body(at: number, modes: Mode[], gain: number, pan = 0, scale = 1, attack = .004) {
    const start = Math.round(at * SAMPLE_RATE);
    for (const [frequency, weight, decay] of modes) {
      const length = Math.min(n - start, Math.ceil(decay * 7 * SAMPLE_RATE));
      for (let i = 0; i < length; i++) {
        const t = i / SAMPLE_RATE;
        const envelope = (1 - Math.exp(-t / attack)) * Math.exp(-t / decay);
        const phase = TAU * frequency * scale * t;
        const wave = Math.sin(phase) * .75 + Math.sin(phase * 1.0047 + .19 * Math.sin(t * 11)) * .25;
        add(start + i, wave * envelope * weight * gain, pan);
      }
    }
  }
  /** Band-limited pressure gesture, with a moving stereo centre and no pitched sweep. */
  function air(at: number, duration: number, gain: number, low: number, high: number, panFrom = 0, panTo = panFrom, shape: 'impact' | 'swell' | 'draw' = 'swell') {
    const start = Math.round(at * SAMPLE_RATE), length = Math.ceil(duration * SAMPLE_RATE);
    let slow = 0, fast = 0, polish = 0;
    for (let i = 0; i < length && start + i < n; i++) {
      const p = i / length, t = i / SAMPLE_RATE;
      const movingBand = .64 + .36 * Math.sin(Math.PI * p);
      const a = 1 - Math.exp(-TAU * low * movingBand / SAMPLE_RATE);
      const b = 1 - Math.exp(-TAU * high * movingBand / SAMPLE_RATE);
      const x = rng() * 2 - 1; slow += a * (x - slow); fast += b * (x - fast);
      polish += .42 * ((fast - slow) - polish);
      const shapeEnvelope = shape === 'impact' ? (1 - Math.exp(-t / .0015)) * Math.exp(-p * 6)
        : shape === 'draw' ? Math.pow(Math.sin(Math.PI * p), .85) * (.45 + .55 * p)
        : Math.pow(Math.sin(Math.PI * p), 1.6);
      const turbulence = .82 + .1 * Math.sin(t * 137) + .08 * Math.sin(t * 59 + 1.6);
      add(start + i, polish * gain * shapeEnvelope * turbulence, mix(panFrom, panTo, p));
    }
  }
  function latch(at = 0, pan = 0, scale = 1, gain = 1) {
    body(at, contactBody, .51 * gain, pan, scale);
    air(at, .058, .58 * gain, 460, 3900, pan, pan, 'impact');
    body(at + .034, casing, .09 * gain, pan * -.5, scale * .88);
  }
  function weight(at: number, gain = .5, pan = 0, scale = 1) {
    body(at, pressure, gain, pan, scale, .012);
    air(at, .19, gain * .65, 60, 840, pan, pan, 'impact');
  }
  /** Uneven mechanical articulations stay beneath the main gesture. */
  function servo(at: number, duration: number, gain: number, from = -.3, to = .3, backwards = false) {
    air(at, duration, gain * 1.5, 150, 1900, from, to, 'draw');
    const positions = backwards ? [.03, .23, .47, .76] : [.04, .31, .58, .82];
    positions.forEach((p, i) => {
      body(at + p * duration, casing, gain * (.16 + .018 * i), mix(from, to, p), .83 + i * .055, .006);
      air(at + p * duration, .045, gain * .2, 740, 2800, mix(from, to, p), mix(from, to, p), 'impact');
    });
  }
  switch (type) {
    case 'hover': body(0, contactBody, .22, -.04, 1.1); air(.003, .074, .22, 700, 2800, -.12, .1, 'impact'); break;
    case 'select': latch(); weight(.015, .12); break;
    case 'tick': latch(0, 0, 1.24, .65); break;
    case 'drag': air(0, .23, .8, 180, 1650, -.3, .3, 'draw'); body(.04, casing, .1, .1, .83); break;
    case 'save':
      latch(0, -.12, .95); body(.075, memory, .31, .08, 1, .02);
      air(.05, .34, .29, 600, 3200, -.3, .35); body(.17, chrome, .08, .3, 1.1, .04); break;
    case 'remove':
      air(0, .19, .62, 190, 1800, .24, -.18, 'draw'); body(.025, casing, .23, .1, .77);
      latch(.13, -.15, .8, .46); break;
    case 'focus':
      air(0, .22, .78, 450, 2900, -.3, .3); body(.035, chrome, .1, -.15, 1.25, .018);
      latch(.18, .07, 1.1, .8); break;
    case 'error':
      body(0, casing, .27, 0, .72); air(.006, .17, .55, 170, 900, 0, 0, 'impact');
      body(.085, contactBody, .25, .04, .75); break;
    case 'open':
      weight(0, .2, -.1); servo(.02, .4, .76); body(.12, chrome, .16, .22, .94, .03);
      latch(.34, .15, .9, .66); break;
    case 'close':
      servo(0, .22, .5, .3, -.14, true); weight(.145, .32, 0); latch(.17, 0, .78, .7); break;
    case 'navigate':
      latch(0, -.25, .9, .45); air(.018, .43, 1.34, 100, 2850, -.55, .5, 'draw');
      weight(.24, .32, .15, .95); body(.29, chrome, .12, .28, .83, .025); break;
    case 'era':
      air(0, .64, .7, 140, 2100, -.42, .38, 'draw');
      [0, .036, .082, .146, .232, .35].forEach((at, i) => latch(at, -.24 + i * .09, .88 + i * .028, .25 + i * .018));
      body(.4, chrome, .27, .15, .71, .026); weight(.41, .18, 0, .88); break;
    case 'destination':
      weight(0, .27, -.35, .94); air(.03, .77, 1.25, 100, 2600, -.62, .55, 'draw');
      body(.2, chrome, .22, .28, .91, .07); body(.55, memory, .13, .1, .75, .03);
      latch(.65, .23, .93, .44); break;
    case 'activate':
      latch(.01, -.15, .85, .65); weight(.035, .41);
      servo(.055, .63, .58, -.45, .4); body(.16, chrome, .27, .2, .87, .035);
      body(.34, memory, .16, -.18, .75, .06); body(.51, casing, .12, .28, 1.25, .035); break;
    case 'collider':
      air(.01, .49, 1.3, 170, 2900, -.7, 0, 'draw'); air(.04, .46, 1.3, 260, 3200, .7, 0, 'draw');
      body(.03, casing, .14, -.6, .83, .015); body(.06, chrome, .1, .6, 1.08, .02);
      weight(.38, .63); latch(.39, 0, .78, .7); body(.43, chrome, .36, .07, .92, .012);
      air(.44, .5, .8, 170, 1900, 0, -.25); break;
    case 'success':
      latch(0, -.13, .97, .7); body(.095, memory, .34, .1, 1, .018);
      body(.24, chrome, .15, .26, 1.1, .025); air(.06, .4, .4, 260, 2400, -.3, .3); break;
    case 'sculpture-unfold':
      weight(0, .28); servo(.02, .72, .98, -.5, .5);
      body(.12, chrome, .22, -.25, .88, .02); body(.32, chrome, .15, .28, 1.03, .025);
      latch(.65, .18, .91, .65); break;
    case 'sculpture-fold':
      servo(0, .5, .86, .5, -.3, true); body(.12, casing, .19, .3, .83);
      weight(.39, .3); latch(.44, -.12, .75, .7); break;
    case 'sculpture-pulse':
      weight(0, .7); body(.012, chrome, .47, 0, .87, .012);
      air(.01, .35, .75, 130, 2500, -.15, .35, 'impact');
      body(.16, chrome, .1, -.4, 1.16, .04); break;
    case 'sculpture-turn':
      servo(0, .27, .6, -.32, .3); body(.065, chrome, .12, .16, .79); break;
    case 'sculpture-reset':
      servo(0, .39, .65, -.4, .15, true); body(.07, chrome, .16, -.2, .93, .015);
      latch(.31, .1, .93, .83); weight(.32, .21); break;
    case 'portal':
      weight(.01, .37, -.1, .9); servo(.04, .68, .55, -.4, .4);
      air(.08, 1.12, 1.8, 65, 3400, -.65, .6, 'draw');
      body(.18, chrome, .23, -.24, .79, .055); weight(.69, .43, .15, .86);
      body(.81, chrome, .18, .3, .9, .07); break;
    case 'scan':
      latch(0, -.34, 1.21, .38); air(.02, .56, 1.1, 490, 3800, -.6, .6, 'draw');
      body(.11, chrome, .11, -.2, 1.31, .025); body(.4, casing, .19, .3, 1.03, .015);
      latch(.51, .35, 1.08, .35); break;
    case 'signal':
      weight(0, .15); body(.012, memory, .24, -.34, 1.12, .012);
      air(.035, .36, .66, 360, 3200, -.42, .42);
      body(.135, chrome, .23, .3, .98, .016); latch(.29, .12, 1.12, .44); break;
    case 'arrival':
      air(0, .48, .84, 100, 2200, -.25, .25); body(.045, casing, .22, -.15, .9, .035);
      weight(.17, .36); body(.21, memory, .23, .15, .75, .032);
      latch(.32, .08, .86, .38); break;
  }
  // Authored early reflections retain a clear dry centre, followed by a short room tail.
  const dryL = left.slice(), dryR = right.slice();
  const broad = spec.duration > .8;
  const reflections = broad ? [[.019,.12,0],[.037,.09,1],[.063,.065,1],[.099,.04,0],[.147,.025,1]]
    : [[.009,.08,0],[.023,.06,1],[.041,.035,1]];
  for (const [seconds, gain, cross] of reflections) {
    const offset = Math.round(seconds * SAMPLE_RATE);
    for (let i = offset; i < n; i++) {
      left[i] += (cross ? dryR : dryL)[i-offset] * gain;
      right[i] += (cross ? dryL : dryR)[i-offset] * gain * .94;
    }
  }
  finish([left, right], spec.peak, .026);
  return [left, right];
}

function finish(channels: Float32Array[], target: number, tail: number) {
  let peak = 0;
  for (const data of channels) {
    let previous = 0, dc = 0;
    for (let i = 0; i < data.length; i++) {
      const input = Math.tanh(data[i] * 1.3); dc = input - previous + .998 * dc; previous = input;
      const fade = Math.min(1, i / (SAMPLE_RATE * .0018), (data.length - 1 - i) / (SAMPLE_RATE * tail));
      data[i] = dc * Math.max(0, fade); peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  const gain = peak ? target / peak : 0;
  channels.forEach(data => { for (let i = 0; i < data.length; i++) data[i] *= gain; });
}

/** Eight-second continuous sound fields. Noise wraps through a half-second overlap;
 * all modal frequencies and slow movement complete integer cycles over the loop.
 */
export function renderRoom(scene: AmbientScene): [Float32Array, Float32Array] {
  const duration = 8, n = SAMPLE_RATE * duration, cross = SAMPLE_RATE * .5;
  const profiles: Record<AmbientScene, { root: number; air: number; metal: number; pulse: number; openness: number }> = {
    home: { root: 87, air: .26, metal: .05, pulse: 2, openness: 1 },
    world: { root: 65.375, air: .37, metal: .022, pulse: 1, openness: 1.2 },
    time: { root: 92.5, air: .24, metal: .038, pulse: 5, openness: .72 },
    library: { root: 73.375, air: .2, metal: .025, pulse: 1, openness: .65 },
    cinema: { root: 55, air: .22, metal: .018, pulse: 1, openness: .5 },
    music: { root: 110, air: .25, metal: .026, pulse: 4, openness: 1.05 },
    culture: { root: 130.875, air: .33, metal: .018, pulse: 3, openness: .86 },
    collection: { root: 82.375, air: .18, metal: .034, pulse: 1, openness: .7 },
  };
  const profile = profiles[scene], rng = random(hash('room-ii-' + scene));
  const channels = [new Float32Array(n), new Float32Array(n)];
  const shared = Float32Array.from({ length: n + cross }, () => rng() * 2 - 1);
  for (let channel = 0; channel < 2; channel++) {
    const raw = new Float32Array(n + cross); let low = 0, middle = 0, high = 0;
    const upperRoot = Math.round(profile.root * 2.367 * duration) / duration;
    const structure = Math.round(profile.root * 4.191 * duration) / duration;
    for (let i = 0; i < raw.length; i++) {
      const t = i / SAMPLE_RATE, orbit = TAU * t / duration;
      const noise = shared[i] * .72 + (rng() * 2 - 1) * .28;
      low += .018 * (noise - low); middle += .09 * (noise - middle); high += .29 * (noise - high);
      const breath = .66 + .2 * Math.sin(orbit + channel * .55) + .07 * Math.sin(orbit * profile.pulse + 1.8);
      const surface = .55 + .2 * Math.cos(orbit * 2 + channel * .7);
      const field = Math.sin(TAU * profile.root * t + channel * .07) * .029
        + Math.sin(TAU * upperRoot * t + channel * .29) * profile.metal * (.7 + .2 * Math.sin(orbit + .8))
        + Math.sin(TAU * structure * t + channel * .48) * profile.metal * .22;
      raw[i] = field + (middle - low) * profile.air * breath
        + (high - middle) * .045 * profile.openness * surface;
    }
    for (let i = 0; i < n; i++) {
      const blend = i < cross ? .5 - .5 * Math.cos(Math.PI * i / cross) : 1;
      channels[channel][i] = raw[i] * blend + (i < cross ? raw[n+i] * (1-blend) : 0);
    }
    // Condition four milliseconds around the circular join. The half-second
    // overlap already preserves the field; this removes a single noise-sample
    // discontinuity without a fade to silence or a repeated audible pulse.
    const radius = 64, first = channels[channel][n-radius], last = channels[channel][radius];
    for (let j = 0; j <= radius * 2; j++) {
      const p = j / (radius * 2), index = (n-radius+j) % n;
      const blend = Math.sin(Math.PI * p) ** 2;
      channels[channel][index] = mix(channels[channel][index], mix(first, last, p), blend);
    }
  }
  let peak = 0;
  for (const data of channels) for (const sample of data) peak = Math.max(peak, Math.abs(sample));
  const gain = .12 / peak;
  for (const data of channels) for (let i = 0; i < data.length; i++) data[i] *= gain;
  return channels as [Float32Array, Float32Array];
}

export function wav(channels: Float32Array[]) {
  const frames = channels[0].length, bytes = new Uint8Array(44 + frames * channels.length * 2), view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  text(0,'RIFF'); view.setUint32(4,bytes.length-8,true); text(8,'WAVE'); text(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels.length,true); view.setUint32(24,SAMPLE_RATE,true); view.setUint32(28,SAMPLE_RATE*channels.length*2,true); view.setUint16(32,channels.length*2,true); view.setUint16(34,16,true); text(36,'data'); view.setUint32(40,bytes.length-44,true);
  for (let i=0;i<frames;i++) channels.forEach((data,c)=>view.setInt16(44+(i*channels.length+c)*2,Math.round(Math.max(-1,Math.min(1,data[i]))*32767),true));
  return bytes;
}
