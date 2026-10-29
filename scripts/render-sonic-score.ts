import { mkdir, writeFile } from 'node:fs/promises';
import { sonicScore, sonicScenes, type SoundType } from '../src/services/sonicScore.ts';
import { renderCue, renderRoom, renderTravel, wav, SAMPLE_RATE } from './sonic-materials.ts';

const folder = new URL('../public/audio/score-v2/', import.meta.url);
await mkdir(folder, { recursive: true });
let bytes = 0;
for (const type of Object.keys(sonicScore) as SoundType[]) {
  const file = wav(renderCue(type)); bytes += file.length; await writeFile(new URL(type + '.wav', folder), file);
}
for (const scene of sonicScenes) { const file = wav(renderRoom(scene)); bytes += file.length; await writeFile(new URL('room-' + scene + '.wav', folder), file); }
const travel = wav(renderTravel()); bytes += travel.length; await writeFile(new URL('portal-travel.wav', folder), travel);
// A spaced listening reel for review; not loaded or shipped by the website.
const order: SoundType[] = ['activate','hover','select','save','remove','navigate','portal','iris-open','threshold-pass','iris-close','destination','era','sculpture-unfold','sculpture-fold','scan','signal','arrival','assembly-release','assembly-drive','assembly-lock','sculpture-pulse','collider'];
const length = Math.ceil(order.reduce((sum, type) => sum + sonicScore[type].duration + .6, 0) * SAMPLE_RATE);
const reel = [new Float32Array(length), new Float32Array(length)]; let offset = 0;
for (const type of order) { renderCue(type).forEach((channel, i) => reel[i].set(channel, offset)); offset += Math.ceil((sonicScore[type].duration + .6) * SAMPLE_RATE); }
const review = new URL('../.impeccable/review/sonic-score-v2/', import.meta.url); await mkdir(review,{recursive:true});
await writeFile(new URL('monumental-sound-score.wav',review),wav(reel));
let position = 0;
const cueSheet = order.map(type => { const item = { sound: type, material: sonicScore[type].material, start: +position.toFixed(3), duration: sonicScore[type].duration }; position += sonicScore[type].duration + .6; return item; });
await writeFile(new URL('cue-sheet.json', review), JSON.stringify(cueSheet, null, 2) + '\n');
const metrics = [...Object.keys(sonicScore).map(type => ({ name: type, data: renderCue(type as SoundType) })), ...sonicScenes.map(scene => ({ name: `room-${scene}`, data: renderRoom(scene) })), { name: 'portal-travel', data: renderTravel() }].map(({ name, data }) => {
  let peak = 0, energy = 0, monoEnergy = 0, difference = 0;
  for (let i = 0; i < data[0].length; i++) {
    const l = data[0][i], r = data[1][i]; peak = Math.max(peak, Math.abs(l), Math.abs(r));
    energy += l*l + r*r; monoEnergy += ((l+r)*.5)**2; difference += (l-r)**2;
  }
  const rms = Math.sqrt(energy / (data[0].length * 2));
  return { name, seconds: data[0].length / SAMPLE_RATE, peakDbFS: +(20*Math.log10(peak)).toFixed(2), rmsDbFS: +(20*Math.log10(rms)).toFixed(2), monoRatio: +((Math.sqrt(monoEnergy/data[0].length))/rms).toFixed(3), stereoDifferenceRms: +Math.sqrt(difference/data[0].length).toFixed(5) };
});
await writeFile(new URL('signal-metrics.json', review), JSON.stringify(metrics, null, 2) + '\n');
console.log(`Rendered ${Object.keys(sonicScore).length} cues, ${sonicScenes.length} optional rooms and one motion field; ${(bytes / 1024 / 1024).toFixed(2)} MiB total, loaded only after sound opt-in.`);
