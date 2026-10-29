import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceXrayLens, createXrayLens } from '../src/services/xrayLens';

test('material inspection arrives without position jumps, converges and then rests', () => {
  const lens = createXrayLens();
  assert.equal(advanceXrayLens(lens, 320, 250, true, 0), true);
  assert.equal(lens.x, 320); assert.equal(lens.y, 250);
  assert.ok(lens.strength > 0 && lens.strength < 1);
  let previous = lens.x, running = true;
  for (let i = 1; i <= 90; i++) {
    running = advanceXrayLens(lens, 700, 300, true, i * 1000 / 60);
    assert.ok(lens.x >= previous && lens.x <= 700); previous = lens.x;
  }
  assert.equal(running, false); assert.equal(lens.strength, 1);
  assert.equal(lens.x, 700); assert.equal(lens.y, 300);
});

test('leaving fades in a bounded number of frames while dragging and reduced motion clear immediately', () => {
  const lens = createXrayLens();
  for (let i = 0; i < 50; i++) advanceXrayLens(lens, 300, 200, true, i * 16.667);
  const oldX = lens.x;
  assert.equal(advanceXrayLens(lens, -1000, -1000, false, 850), true);
  assert.equal(lens.x, oldX, 'The fading aperture must not fly toward a leave sentinel.');
  for (let i = 1; i < 40; i++) advanceXrayLens(lens, -1000, -1000, false, 850 + i * 16.667);
  assert.equal(lens.strength, 0);
  advanceXrayLens(lens, 900, 700, true, 1600);
  assert.equal(lens.x, 900);
  assert.equal(advanceXrayLens(lens, 900, 700, false, 1616, true), false);
  assert.equal(lens.strength, 0);
  advanceXrayLens(lens, NaN, 0, true, NaN);
  advanceXrayLens(lens, 20, 40, true, 1700);
  assert.ok(Number.isFinite(lens.x + lens.y + lens.strength));
});
