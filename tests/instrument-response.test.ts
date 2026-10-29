import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { analyseSpectrum } from '../src/services/audioSpectrum.ts';
import { droneActivity, type DroneActivity } from '../src/services/droneBehaviour.ts';
import { createPassageInstruments } from '../src/components/spatial/passageInstruments.ts';

test('measured silence produces no invented movement energy', () => {
  const target = { rms: 1, bass: 1, mid: 1, treble: 1 };
  assert.deepEqual(analyseSpectrum(new Float32Array(512), new Uint8Array(256), 48000, 512, target), { rms: 0, bass: 0, mid: 0, treble: 0 });
});

test('bass and high-frequency input drive distinct physical bands', () => {
  const wave = new Float32Array(512).fill(.1), bins = new Uint8Array(256);
  bins[1] = bins[2] = 255;
  const low = analyseSpectrum(wave, bins, 48000, 512, { rms: 0, bass: 0, mid: 0, treble: 0 });
  assert.ok(low.bass > low.mid && low.mid > low.treble);
  bins.fill(0); bins.fill(200, 30, 110);
  const high = analyseSpectrum(wave, bins, 48000, 512, { rms: 0, bass: 0, mid: 0, treble: 0 });
  assert.ok(high.treble > .5 && high.bass === 0);
  assert.ok(Math.abs(high.rms - .36) < .001);
});

test('one drone visits a physical dock at a time and returns continuously', () => {
  const output: DroneActivity = { state: 'fly', perch: 0, inspect: 0, signal: 0 };
  for (let t = 0; t < 72; t += .1) {
    const samples = [0, 1, 2, 3].map(i => ({ ...droneActivity(t, i, output) }));
    assert.ok(samples.filter(v => v.perch > 0).length <= 1);
    samples.forEach(v => { for (const value of [v.perch, v.inspect, v.signal]) assert.ok(value >= 0 && value <= 1); });
  }
  for (const boundary of [3, 8, 11, 15, 18]) {
    const before = { ...droneActivity(boundary - .001, 0, output) }, after = droneActivity(boundary + .001, 0, output);
    assert.ok(Math.abs(before.perch - after.perch) < .002);
  }
});

test('five instruments retain bounded geometry across audio and inspection', () => {
  const parents = Array.from({ length: 6 }, () => new THREE.Group());
  const instruments = createPassageInstruments(parents);
  assert.equal(instruments.roots.length, 5);
  const bounds = new THREE.Box3();
  for (let index = 0; index < 5; index++) {
    for (const inspecting of [false, true]) {
      instruments.update({ elapsed: 10, delta: .05, reducedMotion: false, inspecting, active: index, audio: { rms: .8, bass: 1, mid: .7, treble: .5 } });
      bounds.setFromObject(parents[index]);
      assert.ok(Number.isFinite(bounds.min.x) && Number.isFinite(bounds.max.z));
      assert.ok(bounds.getSize(new THREE.Vector3()).length() < 3.2);
    }
  }
  instruments.destroy(); instruments.destroy();
  parents.forEach(parent => assert.equal(parent.children.length, 0));
});
