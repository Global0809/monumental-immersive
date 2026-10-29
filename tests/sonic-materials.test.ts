import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sonicScore, sonicScenes, type SoundType } from '../src/services/sonicScore.ts';
import { renderCue, renderRoom, renderTravel, wav, SAMPLE_RATE } from '../scripts/sonic-materials.ts';

test('every shipped cue matches its authored PCM, has headroom, zero endpoints and bounded DC', () => {
  const fingerprints = new Set<string>();
  for (const type of Object.keys(sonicScore) as SoundType[]) {
    const channels = renderCue(type);
    const bytes = wav(channels);
    assert.deepEqual(Buffer.from(bytes), readFileSync(new URL(`../public/audio/score-v2/${type}.wav`, import.meta.url)), `${type}: stale rendered file`);
    let peak = 0, energy = 0;
    for (const data of channels) {
      assert.equal(data.length, Math.ceil(sonicScore[type].duration * SAMPLE_RATE));
      assert.equal(Math.abs(data[0]), 0); assert.equal(Math.abs(data.at(-1)!), 0);
      let sum = 0;
      for (const sample of data) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; sum += sample; }
      assert.ok(Math.abs(sum / data.length) < .001, `${type}: DC offset`);
    }
    assert.ok(peak <= .651 && peak > .1, `${type}: clipping or silent`);
    assert.ok(Math.sqrt(energy / (channels[0].length * 2)) > .025, `${type}: useful audible body`);
    let monoEnergy = 0; for (let i = 0; i < channels[0].length; i++) monoEnergy += ((channels[0][i] + channels[1][i]) * .5) ** 2;
    assert.ok(monoEnergy / (energy * .5) > .7, `${type}: excessive mono cancellation`);
    fingerprints.add(energy.toFixed(6));
  }
  assert.equal(fingerprints.size, Object.keys(sonicScore).length, 'Cues must not be aliased copies');
});

test('optional room loops remain quiet, stereo and continuous at the wrap', () => {
  for (const scene of sonicScenes) {
    const channels = renderRoom(scene);
    assert.deepEqual(Buffer.from(wav(channels)), readFileSync(new URL(`../public/audio/score-v2/room-${scene}.wav`, import.meta.url)));
    assert.notDeepEqual(channels[0], channels[1]);
    for (const data of channels) {
      let peak = 0, energy = 0, sum = 0;
      for (const sample of data) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; sum += sample; }
      assert.equal(data.length, SAMPLE_RATE * 8);
      assert.ok(peak < .15); assert.ok(Math.abs(data[0] - data.at(-1)!) < .002, `${scene}: audible loop seam`);
      assert.ok(Math.sqrt(energy / data.length) > .015, `${scene}: field must retain audible body`);
      assert.ok(Math.abs(sum/data.length) < .001, `${scene}: DC offset`);
    }
  }
});

test('the motion field is original stereo PCM with a quiet circular join and headroom', () => {
  const channels = renderTravel();
  assert.deepEqual(Buffer.from(wav(channels)), readFileSync(new URL('../public/audio/score-v2/portal-travel.wav', import.meta.url)));
  assert.notDeepEqual(channels[0], channels[1]);
  for (const channel of channels) {
    let peak = 0, sum = 0, energy = 0;
    for (const sample of channel) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); sum += sample; energy += sample * sample; }
    assert.equal(channel.length, SAMPLE_RATE * 4);
    assert.ok(peak <= .291 && peak > .2);
    assert.ok(Math.abs(sum / channel.length) < .001);
    assert.ok(Math.abs(channel[0] - channel.at(-1)!) < .002);
    assert.ok(Math.sqrt(energy / channel.length) > .035);
  }
});
