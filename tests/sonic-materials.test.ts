import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sonicScore, sonicScenes, type SoundType } from '../src/services/sonicScore.ts';
import { renderCue, renderRoom, wav, SAMPLE_RATE } from '../scripts/sonic-materials.ts';

test('every shipped cue matches its authored PCM, has headroom, zero endpoints and bounded DC', () => {
  const fingerprints = new Set<string>();
  for (const type of Object.keys(sonicScore) as SoundType[]) {
    const channels = renderCue(type);
    const bytes = wav(channels);
    assert.deepEqual(Buffer.from(bytes), readFileSync(new URL(`../public/audio/score-v1/${type}.wav`, import.meta.url)), `${type}: stale rendered file`);
    let peak = 0, energy = 0;
    for (const data of channels) {
      assert.equal(data.length, Math.ceil(sonicScore[type].duration * SAMPLE_RATE));
      assert.equal(Math.abs(data[0]), 0); assert.equal(Math.abs(data.at(-1)!), 0);
      let sum = 0;
      for (const sample of data) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; sum += sample; }
      assert.ok(Math.abs(sum / data.length) < .001, `${type}: DC offset`);
    }
    assert.ok(peak <= .651 && peak > .1, `${type}: clipping or silent`);
    assert.ok(energy > .02, `${type}: useful audible energy`);
    fingerprints.add(energy.toFixed(6));
  }
  assert.equal(fingerprints.size, Object.keys(sonicScore).length, 'Cues must not be aliased copies');
});

test('optional room loops remain quiet, stereo and continuous at the wrap', () => {
  for (const scene of sonicScenes) {
    const channels = renderRoom(scene);
    assert.deepEqual(Buffer.from(wav(channels)), readFileSync(new URL(`../public/audio/score-v1/room-${scene}.wav`, import.meta.url)));
    assert.notDeepEqual(channels[0], channels[1]);
    for (const data of channels) {
      let peak = 0; for (const sample of data) peak = Math.max(peak, Math.abs(sample));
      assert.ok(peak < .15); assert.ok(Math.abs(data[0] - data.at(-1)!) < .01, `${scene}: audible loop seam`);
    }
  }
});
