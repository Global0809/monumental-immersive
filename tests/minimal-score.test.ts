import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { minimalAssets, sonicAsset, sonicScore, sonicScenes, type MinimalAsset, type SoundType } from '../src/services/sonicScore.ts';
import { renderMinimalAsset, minimalWav, MINIMAL_SAMPLE_RATE } from '../scripts/render-minimal-score.ts';

test('all existing actions resolve to the seven small new assets, never legacy sound files', () => {
  assert.equal(Object.keys(sonicScore).length, 31);
  const urls = new Set<string>();
  for (const type of Object.keys(sonicScore) as SoundType[]) {
    const url = sonicAsset(type); urls.add(url);
    assert.ok(url.startsWith('/audio/score-v3/'));
    assert.equal(sonicScore[type].duration, minimalAssets[sonicScore[type].asset].duration);
  }
  for (const scene of sonicScenes) urls.add(sonicAsset(`room-${scene}`));
  urls.add(sonicAsset('portal-travel'));
  assert.equal(urls.size, 7);
  assert.equal(sonicAsset('portal-travel'), sonicAsset('room-home'));
  assert.deepEqual(readdirSync(new URL('../public/audio/score-v3/', import.meta.url)).sort(), Object.keys(minimalAssets).map(name => `${name}.wav`).sort());
});

test('new PCM is deterministic, short, clean, centre-focused and has ample headroom', () => {
  let bytes = 0;
  const fingerprints = new Set<string>();
  for (const name of Object.keys(minimalAssets) as MinimalAsset[]) {
    const channels = renderMinimalAsset(name), pcm = minimalWav(channels);
    const shipped = readFileSync(new URL(`../public/audio/score-v3/${name}.wav`, import.meta.url));
    assert.deepEqual(Buffer.from(pcm), shipped, `${name}: source and shipped PCM differ`);
    assert.deepEqual(Buffer.from(minimalWav(renderMinimalAsset(name))), shipped, `${name}: nondeterministic recipe`);
    fingerprints.add(createHash('sha256').update(shipped).digest('hex')); bytes += shipped.length;
    assert.equal(channels[0].length, Math.ceil(minimalAssets[name].duration * MINIMAL_SAMPLE_RATE));
    let peak = 0, energy = 0, mono = 0;
    for (const channel of channels) {
      let sum = 0;
      for (let i = 0; i < channel.length; i++) {
        const sample = channel[i]; assert.ok(Number.isFinite(sample)); sum += sample;
        peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
        if (i) assert.ok(Math.abs(sample - channel[i - 1]) < .07, `${name}: discontinuous transient`);
      }
      assert.ok(Math.abs(sum / channel.length) < .00003, `${name}: DC offset`);
      if (name !== 'hush') { assert.equal(Math.abs(channel[0]), 0); assert.equal(Math.abs(channel.at(-1)!), 0); }
    }
    for (let i = 0; i < channels[0].length; i++) mono += ((channels[0][i] + channels[1][i]) * .5) ** 2;
    assert.ok(peak <= minimalAssets[name].peak + .00001 && peak >= minimalAssets[name].peak - .00001);
    const rms = Math.sqrt(energy / (channels[0].length * 2));
    assert.ok(name === 'hush' ? rms > .002 && rms < .012 : rms > .015 && rms < .15, `${name}: unsuitable loudness`);
    assert.ok(Math.sqrt(mono / (energy * .5)) > .98, `${name}: excessive stereo width`);
  }
  assert.equal(fingerprints.size, 7);
  assert.ok(bytes < 1_100_000, 'The entire score, including optional air, stays around one megabyte.');
});

test('the optional room field is continuous through the loop with no click or silent reset', () => {
  for (const data of renderMinimalAsset('hush')) {
    const seam = data[0] - data.at(-1)!;
    assert.ok(Math.abs(seam) < .002);
    assert.ok(Math.abs(seam - (data[1] - data[0])) < .0015);
    assert.ok(Math.abs(seam - (data.at(-1)! - data.at(-2)!)) < .0015);
    let low = Infinity, high = 0;
    for (let start = 0; start < data.length; start += MINIMAL_SAMPLE_RATE / 2) {
      let energy = 0;
      for (let i = start; i < start + MINIMAL_SAMPLE_RATE / 2; i++) energy += data[i] ** 2;
      const rms = Math.sqrt(energy / (MINIMAL_SAMPLE_RATE / 2)); low = Math.min(low, rms); high = Math.max(high, rms);
    }
    assert.ok(high / low < 1.5, 'Air should remain smooth rather than pulse between silence and noise.');
  }
});
