import { mkdir, writeFile } from 'node:fs/promises';
import { sonicScore, sonicScenes, type SoundType } from '../src/services/sonicScore.ts';
import { renderCue, renderRoom, wav, SAMPLE_RATE } from './sonic-materials.ts';

const folder = new URL('../public/audio/score-v1/', import.meta.url);
await mkdir(folder, { recursive: true });
let bytes = 0;
for (const type of Object.keys(sonicScore) as SoundType[]) {
  const file = wav(renderCue(type)); bytes += file.length; await writeFile(new URL(type + '.wav', folder), file);
}
for (const scene of sonicScenes) { const file = wav(renderRoom(scene)); bytes += file.length; await writeFile(new URL('room-' + scene + '.wav', folder), file); }
// A spaced listening reel for review; not loaded or shipped by the website.
const order: SoundType[] = ['activate','select','save','remove','navigate','destination','era','sculpture-unfold','sculpture-pulse','collider'];
const length = Math.ceil(order.reduce((sum, type) => sum + sonicScore[type].duration + .6, 0) * SAMPLE_RATE);
const reel = [new Float32Array(length), new Float32Array(length)]; let offset = 0;
for (const type of order) { renderCue(type).forEach((channel, i) => reel[i].set(channel, offset)); offset += Math.ceil((sonicScore[type].duration + .6) * SAMPLE_RATE); }
const review = new URL('../.impeccable/review/sonic-score/', import.meta.url); await mkdir(review,{recursive:true});
await writeFile(new URL('monumental-sound-score.wav',review),wav(reel));
console.log(`Rendered ${Object.keys(sonicScore).length} cues and ${sonicScenes.length} optional room loops; ${(bytes / 1024 / 1024).toFixed(2)} MiB total, loaded only after sound opt-in.`);
