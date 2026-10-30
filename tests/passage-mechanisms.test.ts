import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { passageIrisOpening, passageScreenExtension, mechanismAwakening, relayPartIndex, sampleRelayAutomation, type RelayAutomation } from '../src/services/passageMechanisms';
import { passagePose, passageStationMotion } from '../src/services/passageJourney';
import { createPassageThresholds } from '../src/components/spatial/passageThresholds';
import { createTunnelRelays } from '../src/components/spatial/tunnelRelays';
import type { TunnelLifeFrame } from '../src/services/tunnelLife';

test('iris clears before crossing and reconstructs after jumps and reversal', () => {
  const gate = -13;
  const forward = Array.from({ length: 101 }, (_, i) => passageIrisOpening(gate + 35 - i * .45, gate));
  const reverse = Array.from({ length: 101 }, (_, i) => passageIrisOpening(gate + 35 - (100 - i) * .45, gate));
  assert.deepEqual(forward, reverse.reverse());
  assert.equal(passageIrisOpening(gate + 10, gate), 1);
  assert.equal(passageIrisOpening(gate + .16, gate), 1);
  assert.equal(passageIrisOpening(gate - 5, gate), 1);
  assert.equal(passageIrisOpening(gate + 28, gate), 0);
  assert.equal(passageIrisOpening(NaN, gate), 1, 'invalid state fails open');
  for (let i = 1; i < forward.length; i++) assert.ok(forward[i] >= forward[i - 1]);
});

test('screen returns exactly to authored plane across every reading hold', () => {
  for (let active = 0; active < 6; active++) {
    for (const progress of [.38, .42, .52, .62, .74]) {
      const station = passageStationMotion(active, { active, progress });
      assert.equal(passageScreenExtension(station.reveal), 1, `${active}/${progress} holds media steady`);
    }
  }
  assert.equal(passageScreenExtension(0), 0);
  assert.equal(passageScreenExtension(NaN), 0);
});

test('threshold geometry has bounded draw budget and no camera-volume intersections', () => {
  const scene = new THREE.Scene(), thresholds = createPassageThresholds(scene);
  const root = scene.getObjectByName('passage-spiral-thresholds')!;
  const meshes = root.children as THREE.InstancedMesh[];
  assert.equal(meshes.length, 6);
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, 0, -1);
  let samples = 0;
  for (let active = -1; active < 6; active++) for (let step = 0; step <= 32; step++) {
    const pose = passagePose({ active, progress: step / 32 });
    thresholds.update(pose.position[2], 4.5, false, false); scene.updateMatrixWorld(true);
    for (const mesh of meshes) { mesh.computeBoundingSphere(); assert.ok(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)); }
    // Camera clipping volume, including the small authored lateral and height arc.
    for (const x of [-.23, 0, .23]) for (const y of [-.23, 0, .23]) {
      ray.set(new THREE.Vector3(pose.position[0] + x, pose.position[1] + y, pose.position[2] + .18), direction);
      ray.near = 0; ray.far = .52;
      assert.equal(ray.intersectObjects(meshes, false).length, 0, `camera intersects iris ${active}/${step}`); samples++;
    }
  }
  assert.equal(samples, 2079);
  thresholds.update(14, 0, true, false); assert.equal(root.visible, false);
  thresholds.update(14, 0, false, true); assert.equal(root.visible, false);
  thresholds.destroy(); thresholds.destroy(); assert.equal(scene.children.length, 0);
});

test('automatic relay visits every shell and returns to a quiet closed interval', () => {
  const state: RelayAutomation = { open: false, part: null, pull: 0, phase: 0 }, seen = new Set<number>();
  for (let frame = 0; frame <= 960; frame++) {
    assert.equal(sampleRelayAutomation(frame / 60, state), state);
    assert.ok(state.pull >= 0 && state.pull <= 1);
    if (state.part !== null) { assert.equal(state.open, true); if (state.pull > .9) seen.add(state.part); }
    else assert.equal(state.pull, 0);
  }
  assert.deepEqual([...seen], [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(state, { open: false, part: null, pull: 0, phase: 0 });
  assert.equal(sampleRelayAutomation(13, state).open, false);
  assert.equal(sampleRelayAutomation(NaN, state).open, false);
});

test('automatic poses articulate real shells and reassemble without a click', () => {
  const scene = new THREE.Scene(), relays = createTunnelRelays(scene);
  const state: RelayAutomation = { open: false, part: null, pull: 0, phase: 0 };
  const frame: TunnelLifeFrame = { time: 0, delta: 1 / 60, cameraZ: 14, active: -1, progress: 0, pointer: [0, 0], energy: 0,
    pulse: { age: 8, originZ: 0, strength: 0 }, compact: false, reducedMotion: false, inspection: false, quality: 'full' };
  const shells = scene.getObjectByName('relay-shell-components') as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(); let largest = 0;
  for (let tick = 0; tick <= 960; tick++) {
    sampleRelayAutomation(tick / 60, state);
    relays.setExploded(state.open); relays.setSelectedPart(state.part); relays.setPartPull(state.pull); relays.update(frame);
    for (let index = 0; index < 6; index++) { shells.getMatrixAt(index, matrix); position.setFromMatrixPosition(matrix); largest = Math.max(largest, position.length()); }
  }
  assert.ok(largest > 1, 'the existing physical shells genuinely extend');
  for (let index = 0; index < 6; index++) { shells.getMatrixAt(index, matrix); assert.ok(position.setFromMatrixPosition(matrix).length() < .001); }
  relays.destroy(); assert.equal(scene.children.length, 0);
});

test('relay individually extends one selected shell and closes cleanly', () => {
  const scene = new THREE.Scene(), relays = createTunnelRelays(scene);
  const frame: TunnelLifeFrame = { time: 0, delta: 1 / 60, cameraZ: 14, active: -1, progress: 0, pointer: [0, 0], energy: 0,
    pulse: { age: 8, originZ: 0, strength: 0 }, compact: false, reducedMotion: false, inspection: false, quality: 'full' };
  const matrix = new THREE.Matrix4(), pos = new THREE.Vector3();
  const shells = scene.getObjectByName('relay-shell-components') as THREE.InstancedMesh;
  const positions = () => Array.from({ length: 6 }, (_, i) => { shells.getMatrixAt(i, matrix); pos.setFromMatrixPosition(matrix); return pos.clone(); });
  relays.setExploded(true);
  for (let i = 0; i < 160; i++) relays.update(frame);
  const baseline = positions(); relays.setSelectedPart(2);
  relays.setPartPull(.5);
  for (let i = 0; i < 160; i++) relays.update(frame);
  const halfway = positions();
  assert.ok(halfway[2].distanceTo(baseline[2]) > .45 && halfway[2].distanceTo(baseline[2]) < .6, 'drag amount gives bounded continuous extension');
  relays.setPartPull(null);
  for (let i = 0; i < 160; i++) relays.update(frame);
  const selected = positions();
  selected.forEach((value, i) => assert.ok(i === 2 ? value.distanceTo(baseline[i]) > .9 : value.distanceTo(baseline[i]) < .001));
  relays.setSelectedPart(null);
  for (let i = 0; i < 160; i++) relays.update(frame);
  positions().forEach((value, i) => assert.ok(value.distanceTo(baseline[i]) < .001));
  relays.setSelectedPart(4); relays.setExploded(false);
  for (let i = 0; i < 160; i++) relays.update(frame);
  positions().forEach(value => assert.ok(value.length() < .001));
  relays.destroy(); relays.destroy(); assert.equal(scene.children.length, 0);
});

test('mechanical attention has a real quiet interval and invalid selections stay inert', () => {
  assert.equal(mechanismAwakening(9, 0), 0);
  assert.equal(mechanismAwakening(2, 0), 1);
  assert.equal(mechanismAwakening(NaN, 0), 0);
  for (const value of [-1, 6, .5, NaN, Infinity]) assert.equal(relayPartIndex(value), null);
  assert.equal(relayPartIndex(0), 0); assert.equal(relayPartIndex(5), 5);
});
