import { sonicScore, type SoundType, type AmbientScene } from '../src/services/sonicScore.ts';

/** Small offline instrument builder: damped modal bodies + filtered granular contact.
 * No sample libraries, generative models, musical arpeggios or runtime DSP loops.
 */
export const SAMPLE_RATE = 32000;
const TAU = Math.PI * 2;
function random(seed: number) { return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }; }
function hash(text: string) { let value = 2166136261; for (const c of text) value = Math.imul(value ^ c.charCodeAt(0), 16777619); return value >>> 0; }
type Mode = [frequency: number, weight: number, decay: number];
// Deliberately inharmonic, low-mid material fingerprints shared by the whole score.
const felt: Mode[] = [[148, 1, .022], [337, .38, .016], [827, .14, .012]];
const shell: Mode[] = [[186, 1, .09], [493, .38, .061], [1127, .2, .037], [2083, .05, .022]];
const chrome: Mode[] = [[173, .65, .21], [463, .42, .26], [947, .2, .19], [1639, .1, .12], [2813, .025, .065]];
const ceramic: Mode[] = [[391, .7, .14], [1061, .22, .17], [2189, .06, .09]];
export function renderCue(type: SoundType): [Float32Array, Float32Array] {
  const spec = sonicScore[type], n = Math.ceil(spec.duration * SAMPLE_RATE);
  const left = new Float32Array(n), right = new Float32Array(n);
  const rng = random(hash(type));
  function add(index: number, value: number, pan = 0) {
    if (index >= n) return;
    left[index] += value * Math.sqrt((1 - pan) * .5);
    right[index] += value * Math.sqrt((1 + pan) * .5);
  }
  function body(at: number, modes: Mode[], gain: number, pan = 0, scale = 1, attack = .0015) {
    const start = Math.floor(at * SAMPLE_RATE);
    for (const [frequency, weight, decay] of modes) {
      const length = Math.min(n - start, Math.ceil(decay * 8 * SAMPLE_RATE));
      for (let i = 0; i < length; i++) {
        const t = i / SAMPLE_RATE;
        const envelope = (1 - Math.exp(-t / attack)) * Math.exp(-t / decay);
        // Closely spaced modes beat gently, rather than sweeping up like a UI beep.
        const wave = Math.sin(TAU * frequency * scale * t) * .84 + Math.sin(TAU * frequency * scale * 1.0031 * t) * .16;
        add(start + i, wave * envelope * weight * gain, pan);
      }
    }
  }
  function contact(at: number, duration: number, gain: number, low: number, high: number, pan = 0, swell = false) {
    const start = Math.floor(at * SAMPLE_RATE), length = Math.ceil(duration * SAMPLE_RATE);
    const a = 1 - Math.exp(-TAU * low / SAMPLE_RATE), b = 1 - Math.exp(-TAU * high / SAMPLE_RATE);
    let slow = 0, fast = 0;
    for (let i = 0; i < length && start + i < n; i++) {
      const x = rng() * 2 - 1; slow += a * (x - slow); fast += b * (x - fast);
      const t = i / SAMPLE_RATE, p = i / length;
      const envelope = swell ? Math.pow(Math.sin(Math.PI * p), 1.5) : (1 - Math.exp(-t / .0007)) * Math.exp(-p * 7);
      // Narrow amplitude irregularity supplies grain, with no piercing top end.
      add(start + i, (fast - slow) * gain * envelope * (.82 + .18 * Math.sin(t * 119)), pan);
    }
  }
  const latch = (at = 0, pan = 0, scale = 1) => { body(at, shell, .44, pan, scale); contact(at, .035, .5, 560, 3700, pan); body(at + .027, felt, .18, pan); };
  const bearing = (at: number, duration: number, gain: number, pan = 0) => contact(at, duration, gain, 190, 1400, pan, true);
  switch (type) {
    case 'hover': contact(0, .038, .4, 700, 2600); body(.004, felt, .12); break;
    case 'select': latch(); break;
    case 'tick': body(0, felt, .45); contact(.001, .025, .35, 850, 3000); break;
    case 'drag': bearing(0, .15, .65); body(.018, felt, .12, -.1); break;
    case 'save': latch(); body(.048, ceramic, .14, .12); contact(.045, .08, .11, 1400, 3500, .1); break;
    case 'remove': body(0, shell, .28, 0, .82); contact(.022, .08, .4, 280, 1800); body(.064, felt, .26); break;
    case 'focus': contact(0, .09, .24, 650, 2200, -.12, true); latch(.082, .1, 1.12); break;
    case 'error': body(0, felt, .5, 0, .72); contact(.006, .1, .28, 180, 850); body(.066, felt, .23, 0, .69); break;
    case 'open': bearing(0, .27, .8, -.15); body(.04, chrome, .12, -.1); latch(.205, .15, .91); break;
    case 'close': bearing(0, .14, .45, .1); latch(.095, -.08, .78); break;
    case 'navigate': contact(0, .023, .35, 700, 2600, -.18); bearing(.015, .27, .8); body(.16, shell, .28, .18, .86); break;
    case 'era':
      // Uneven perforations of a film transport, slowing to a felted stop.
      [.0, .032, .076, .137, .221].forEach((at, i) => { contact(at, .028, .38 - i * .035, 420, 2900, (i - 2) * .07); body(at, felt, .15); });
      bearing(.02, .4, .52); body(.27, chrome, .12, .12, .71); break;
    case 'destination':
      body(0, shell, .25, -.2, .73); bearing(.025, .54, .7, -.15);
      body(.19, chrome, .19, .16, .83, .035); contact(.42, .12, .24, 500, 2300, .22, true); body(.48, ceramic, .075, .15, .87); break;
    case 'activate':
      latch(.01, -.12, .8); body(.105, chrome, .27, .12, .93, .012);
      bearing(.06, .45, .35); body(.27, ceramic, .09, .2, .82); break;
    case 'collider':
      body(0, shell, .3, -.48, .84); body(.068, ceramic, .2, .48, .94);
      bearing(.045, .29, .6, -.22); bearing(.115, .22, .5, .22);
      body(.29, chrome, .34, 0, .91, .004); body(.295, felt, .5); contact(.29, .055, .32, 500, 2700); break;
    case 'success': latch(0, -.1); body(.09, chrome, .23, .1, 1.07); break;
    case 'sculpture-unfold':
      bearing(0, .4, .75); [.045, .106, .19].forEach((at, i) => body(at, chrome, .15, (i - 1) * .27, 1 + i * .025, .018)); body(.29, felt, .23); break;
    case 'sculpture-fold':
      [.0, .061, .104].forEach((at, i) => body(at, shell, .16, (.5 - i) * .18, .92 - i * .045)); bearing(0, .24, .56); latch(.18, 0, .73); break;
    case 'sculpture-pulse': body(0, chrome, .5, 0, .87, .004); body(.012, [[73,.7,.17],[127,.3,.11]], .5); contact(0, .075, .4, 450, 2300); break;
    case 'sculpture-turn': bearing(0, .18, .7, -.1); body(.04, shell, .14, .1, .86); break;
    case 'sculpture-reset': body(0, chrome, .14, -.18, .93); bearing(.015, .2, .45); latch(.145, .12, .93); break;
  }
  // A tiny asymmetric room, not a long wash. Dry contact remains at the center.
  const dryL = left.slice(), dryR = right.slice();
  for (const [seconds, gain, cross] of [[.013,.085,0],[.029,.06,1],[.047,.035,1]]) {
    const offset = Math.round(seconds * SAMPLE_RATE);
    for (let i = offset; i < n; i++) { left[i] += (cross ? dryR : dryL)[i-offset] * gain; right[i] += (cross ? dryL : dryR)[i-offset] * gain; }
  }
  finish([left, right], spec.peak, .012);
  return [left, right];
}
function finish(channels: Float32Array[], target: number, tail: number) {
  let peak = 0;
  for (const data of channels) {
    let previous = 0, dc = 0;
    for (let i = 0; i < data.length; i++) {
      const input = data[i]; dc = input - previous + .992 * dc; previous = input;
      const fade = Math.min(1, i / (SAMPLE_RATE * .001), (data.length - 1 - i) / (SAMPLE_RATE * tail));
      data[i] = dc * Math.max(0, fade); peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  const gain = peak ? target / peak : 0;
  channels.forEach(data => { for (let i = 0; i < data.length; i++) data[i] *= gain; });
}
export function renderRoom(scene: AmbientScene): [Float32Array, Float32Array] {
  const n = SAMPLE_RATE * 6, cross = SAMPLE_RATE * .4;
  const rng = random(hash(scene));
  const roots = { home: 86.5, world: 69.3333333, time: 92.5, library: 61.8333333 };
  const channels = [new Float32Array(n), new Float32Array(n)];
  for (let channel = 0; channel < 2; channel++) {
    const raw = new Float32Array(n + cross); let low = 0, high = 0;
    for (let i = 0; i < raw.length; i++) {
      const t = i / SAMPLE_RATE, noise = rng() * 2 - 1;
      low += .012 * (noise - low); high += .075 * (noise - high);
      const breath = .62 + .15 * Math.sin(TAU * t / 6 + channel * .7);
      const f = roots[scene];
      raw[i] = (high - low) * .19 * breath + Math.sin(TAU*f*t) * .018 + Math.sin(TAU*(f*2.31)*t + channel*.5) * .008;
    }
    for (let i = 0; i < n; i++) {
      const blend = i < cross ? .5 - .5 * Math.cos(Math.PI * i / cross) : 1;
      channels[channel][i] = raw[i] * blend + (i < cross ? raw[n+i] * (1-blend) : 0);
    }
  }
  return channels as [Float32Array, Float32Array];
}
export function wav(channels: Float32Array[]) {
  const frames = channels[0].length, bytes = new Uint8Array(44 + frames * channels.length * 2), view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  text(0,'RIFF'); view.setUint32(4,bytes.length-8,true); text(8,'WAVE'); text(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels.length,true); view.setUint32(24,SAMPLE_RATE,true); view.setUint32(28,SAMPLE_RATE*channels.length*2,true); view.setUint16(32,channels.length*2,true); view.setUint16(34,16,true); text(36,'data'); view.setUint32(40,bytes.length-44,true);
  for (let i=0;i<frames;i++) channels.forEach((data,c)=>view.setInt16(44+(i*channels.length+c)*2,Math.round(Math.max(-1,Math.min(1,data[i]))*32767),true));
  return bytes;
}
