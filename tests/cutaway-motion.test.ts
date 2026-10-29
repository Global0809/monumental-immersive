import test from 'node:test';
import assert from 'node:assert/strict';
import { createCutawayMotion, type CutawayTarget } from '../src/services/cutawayMotion.ts';

const wall: CutawayTarget = { surface: 'lining', x: 8.97, y: 0, z: -20, radius: 3 };

test('a brief raycast miss retires gently and recovers without restarting the probe', () => {
  const motion = createCutawayMotion();
  for (let i = 0; i < 30; i++) motion.sample(wall, 1 / 60);
  const missed = { ...motion.sample(null, 1 / 60) };
  assert.ok(missed.strength > .5 && missed.strength < 1);
  assert.equal(missed.surface, wall.surface); assert.equal(missed.z, wall.z);
  assert.ok(motion.sample(wall, 1 / 60).strength > missed.strength);
  for (let i = 0; i < 20; i++) motion.sample(null, 1 / 60);
  assert.equal(motion.sample(null, 1 / 60).strength, 0, 'retirement reaches an exact quiet endpoint');
});

test('wall to relay handoff closes before relocating the inspection volume', () => {
  const motion = createCutawayMotion();
  for (let i = 0; i < 30; i++) motion.sample(wall, 1 / 60);
  const relay = { surface: 'relay:4', x: 2, y: .3, z: -4, radius: .88 };
  const original = { ...motion.sample(relay, 1 / 60) };
  assert.equal(original.surface, 'lining', 'one transient hit does not switch surfaces');
  assert.ok(original.strength > .99);
  let moved = false;
  for (let i = 0; i < 20; i++) {
    const state = motion.sample(relay, 1 / 60);
    if (state.surface === relay.surface) {
      assert.equal(state.x, relay.x); assert.equal(state.z, relay.z);
      if (!moved) assert.equal(state.strength, 0, 'no open hole teleports to the new surface');
      moved = true;
    } else assert.equal(state.z, wall.z, 'a closing hole never sweeps through unrelated geometry');
  }
  assert.equal(moved, true);
  assert.ok(motion.sample(relay, 1 / 60).strength > .98);
});

test('a transient relay silhouette and large camera jump cannot snap an open cut', () => {
  const motion = createCutawayMotion();
  for (let i = 0; i < 30; i++) motion.sample(wall, 1 / 60);
  const prior = { ...motion.sample({ ...wall, surface: 'relay:9' }, 1 / 60) };
  const recovered = motion.sample(wall, 1 / 60);
  assert.equal(recovered.surface, 'lining'); assert.ok(recovered.strength >= prior.strength);
  const distant = { ...wall, z: wall.z - 60 };
  for (let i = 0; i < 20; i++) {
    const state = motion.sample(distant, 1 / 60);
    if (state.z === distant.z) { assert.equal(state.strength, 0); return; }
    assert.equal(state.z, wall.z);
  }
  assert.fail('the closed probe should reacquire the new chapter');
});

test('protected surfaces reset immediately and invalid inputs stay finite', () => {
  const motion = createCutawayMotion(); motion.sample(wall, 1 / 60);
  motion.reset();
  assert.equal(motion.sample(null, 0).radius, 0); assert.equal(motion.sample(null, 0).strength, 0);
  for (const value of [NaN, Infinity, -Infinity]) {
    const state = motion.sample({ ...wall, x: value }, value);
    assert.ok([state.x, state.y, state.z, state.radius, state.strength].every(Number.isFinite));
    assert.equal(state.strength, 0);
  }
  const sixty = createCutawayMotion(), oneTwenty = createCutawayMotion();
  for (let i = 0; i < 60; i++) sixty.sample(wall, 1 / 60);
  for (let i = 0; i < 120; i++) oneTwenty.sample(wall, 1 / 120);
  assert.ok(Math.abs(sixty.sample(wall, 0).strength - oneTwenty.sample(wall, 0).strength) < 1e-10, 'opening follows elapsed time, not frame count');
});
