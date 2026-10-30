import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { minimalAssets, type MinimalAsset } from '../src/services/sonicScore.ts';

/** Original deterministic studies: narrow stereo and natural envelopes. No
 * external recordings, sample packs, runtime synthesis or generative service. */
export const MINIMAL_SAMPLE_RATE = 32000;
const TAU = Math.PI * 2;
function random(seed: number) { return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }; }
function seedFor(text: string) { let value = 2166136261; for (const c of text) value = Math.imul(value ^ c.charCodeAt(0), 16777619); return value >>> 0; }
type Channels = [Float32Array, Float32Array];
type Mode = [frequency: number, weight: number, decay: number];

export function renderMinimalAsset(name: MinimalAsset): Channels {
  const spec = minimalAssets[name], frames = Math.ceil(spec.duration * MINIMAL_SAMPLE_RATE);
  const result: Channels = [new Float32Array(frames), new Float32Array(frames)];
  const rng = random(seedFor('monumental-minimal-2026-' + name));
  if (name === 'hush') {
    // Integer-cycle partials form circular air without a pulse or repeated fade.
    for (let mode = 0; mode < 60; mode++) {
      const frequency = Math.round((115 + rng() ** 1.4 * 1050) * spec.duration) / spec.duration;
      const phase = rng() * TAU, spread = (rng() - .5) * .18;
      const amplitude = (.4 + rng() * .6) / Math.pow(frequency, .58);
      for (let i = 0; i < frames; i++) {
        const angle = TAU * frequency * i / MINIMAL_SAMPLE_RATE + phase;
        result[0][i] += Math.sin(angle - spread) * amplitude;
        result[1][i] += Math.sin(angle + spread) * amplitude;
      }
    }
  } else {
    const profiles: Record<Exclude<MinimalAsset, 'hush'>, { low: number; high: number; air: number; modes: Mode[]; attack: number; decay: number }> = {
      touch: { low: 190, high: 1750, air: .58, modes: [[194,.32,.019],[391,.1,.015],[773,.025,.009]], attack: .0038, decay: .024 },
      passage: { low: 170, high: 2100, air: 1, modes: [[146,.045,.11]], attack: .048, decay: .115 },
      confirm: { low: 340, high: 2200, air: .17, modes: [[218,.38,.11],[437,.12,.088],[693,.047,.064],[1121,.012,.038]], attack: .007, decay: .13 },
      release: { low: 230, high: 1570, air: .75, modes: [[178,.14,.035],[397,.035,.028]], attack: .015, decay: .055 },
      portal: { low: 110, high: 1850, air: 1, modes: [[97,.035,.2],[193,.012,.15]], attack: .095, decay: .23 },
      resist: { low: 130, high: 920, air: .45, modes: [[159,.24,.05],[281,.065,.037]], attack: .008, decay: .052 },
    };
    const profile = profiles[name];
    let low = 0, high = 0, polish = 0, silk = 0;
    const lower = 1 - Math.exp(-TAU * profile.low / MINIMAL_SAMPLE_RATE);
    const upper = 1 - Math.exp(-TAU * profile.high / MINIMAL_SAMPLE_RATE);
    for (let i = 0; i < frames; i++) {
      const t = i / MINIMAL_SAMPLE_RATE, p = i / (frames - 1), noise = rng() * 2 - 1;
      low += lower * (noise - low); high += upper * (noise - high);
      polish += .24 * ((high - low) - polish);
      silk += .19 * (polish - silk);
      const attack = 1 - Math.exp(-t / profile.attack);
      const envelope = attack * Math.exp(-t / profile.decay);
      const airEnvelope = name === 'passage' || name === 'portal' ? Math.sin(Math.PI * p) ** 1.8 : envelope;
      let body = 0;
      for (const [frequency, weight, decay] of profile.modes) body += Math.sin(TAU * frequency * t) * weight * attack * Math.exp(-t / decay);
      const shared = silk * profile.air * airEnvelope + body;
      const width = silk * airEnvelope * .018;
      const fade = Math.min(1, i / (MINIMAL_SAMPLE_RATE * .003), (frames - 1 - i) / (MINIMAL_SAMPLE_RATE * .028));
      result[0][i] = (shared + width) * Math.max(0, fade);
      result[1][i] = (shared - width) * Math.max(0, fade);
    }
    // Remove mean without losing the zero endpoints or soft envelope.
    for (const channel of result) {
      let sum = 0, weight = 0;
      for (let i = 0; i < frames; i++) { const w = Math.sin(Math.PI * i / (frames - 1)) ** 2; sum += channel[i]; weight += w; }
      const correction = sum / weight;
      for (let i = 0; i < frames; i++) channel[i] -= correction * Math.sin(Math.PI * i / (frames - 1)) ** 2;
      channel[0] = 0; channel[frames - 1] = 0;
    }
  }
  let peak = 0;
  for (const channel of result) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  const gain = spec.peak / Math.max(peak, .0001);
  for (const channel of result) for (let i = 0; i < frames; i++) channel[i] *= gain;
  return result;
}

export function minimalWav(channels: Channels) {
  const frames = channels[0].length, bytes = new Uint8Array(44 + frames * 4), view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, MINIMAL_SAMPLE_RATE, true); view.setUint32(28, MINIMAL_SAMPLE_RATE * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, bytes.length - 44, true);
  for (let i = 0; i < frames; i++) channels.forEach((channel, side) => view.setInt16(44 + (i * 2 + side) * 2, Math.round(channel[i] * 32767), true));
  return bytes;
}

export async function renderMinimalScore() {
  const folder = new URL('../public/audio/score-v3/', import.meta.url);
  const review = new URL('../.impeccable/review/minimal-score/', import.meta.url);
  await mkdir(folder, { recursive: true }); await mkdir(review, { recursive: true });
  const metrics = []; let bytes = 0;
  const cues = Object.keys(minimalAssets) as MinimalAsset[];
  const reelFrames = Math.ceil(cues.reduce((sum, cue) => sum + minimalAssets[cue].duration + .8, 0) * MINIMAL_SAMPLE_RATE);
  const reel: Channels = [new Float32Array(reelFrames), new Float32Array(reelFrames)]; let offset = 0;
  for (const name of cues) {
    const channels = renderMinimalAsset(name), pcm = minimalWav(channels); bytes += pcm.length;
    await writeFile(new URL(`${name}.wav`, folder), pcm);
    let peak = 0, energy = 0, mono = 0;
    for (let i = 0; i < channels[0].length; i++) {
      const l = channels[0][i], r = channels[1][i]; peak = Math.max(peak, Math.abs(l), Math.abs(r));
      energy += l * l + r * r; mono += ((l + r) * .5) ** 2;
    }
    const rms = Math.sqrt(energy / (channels[0].length * 2));
    metrics.push({ name, start: offset / MINIMAL_SAMPLE_RATE, duration: minimalAssets[name].duration, peakDbFS: +(20 * Math.log10(peak)).toFixed(2), rmsDbFS: +(20 * Math.log10(rms)).toFixed(2), monoRatio: +Math.sqrt(mono / (energy * .5)).toFixed(4), bytes: pcm.length });
    channels.forEach((channel, side) => reel[side].set(channel, offset));
    offset += Math.ceil((minimalAssets[name].duration + .8) * MINIMAL_SAMPLE_RATE);
  }
  await writeFile(new URL('listening-reel.wav', review), minimalWav(reel));
  await writeFile(new URL('metrics.json', review), JSON.stringify(metrics, null, 2) + '\n');
  console.log(JSON.stringify({ assets: cues.length, bytes, cues: metrics }, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await renderMinimalScore();
