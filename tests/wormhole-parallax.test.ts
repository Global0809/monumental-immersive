import test from 'node:test';
import assert from 'node:assert/strict';
import { createWormholeParallax } from '../src/services/wormholeParallax.ts';

test('parallax reaches the same pose at 30, 60, 120 and 144 Hz without overshoot', () => {
  const states = [30, 60, 120, 144].map(rate => {
    const motion = createWormholeParallax();
    let previous = 0;
    for (let frame = 0; frame < rate; frame++) {
      const state = motion.step(1 / rate, 1, -.7);
      assert.ok(state.x >= previous && state.x <= 1);
      previous = state.x;
    }
    return motion.state;
  });
  for (const state of states) {
    assert.ok(state.x > .999);
    for (const key of ['x', 'y', 'vx', 'vy'] as const) assert.ok(Math.abs(state[key] - states[0][key]) < 1e-10);
  }
});

test('release and direction reversal preserve continuity and settle to centre', () => {
  const motion = createWormholeParallax();
  for (let frame = 0; frame < 60; frame++) motion.step(1 / 60, .9, -.8);
  const before = { ...motion.state };
  motion.step(1 / 60, 0, 0);
  assert.ok(motion.state.x > .8 && motion.state.x < before.x, 'release must decay, never snap');
  motion.step(1 / 60, -1, 1);
  assert.ok(Math.hypot(motion.state.x - before.x, motion.state.y - before.y) < .15);
  for (let frame = 0; frame < 120; frame++) motion.step(1 / 60, 0, 0);
  assert.ok(Math.hypot(motion.state.x, motion.state.y, motion.state.vx, motion.state.vy) < 1e-7);
});

test('a frozen clock preserves the exact pose and invalid input stays bounded', () => {
  const motion = createWormholeParallax();
  motion.step(.04, 1, -1);
  const held = { ...motion.state };
  motion.step(0, -1, 1); motion.step(Number.NaN, 1, 1);
  assert.deepEqual(motion.state, held);
  motion.step(60, Number.NaN, Number.POSITIVE_INFINITY);
  for (let frame = 0; frame < 2000; frame++) {
    motion.step(1 / 144, Math.sin(frame * .13) * 10, Math.cos(frame * .17) * 10);
    assert.ok(Object.values(motion.state).every(Number.isFinite));
    assert.ok(Math.abs(motion.state.x) <= 1 && Math.abs(motion.state.y) <= 1);
  }
  motion.reset();
  assert.deepEqual(motion.state, { x: 0, y: 0, vx: 0, vy: 0 });
});
