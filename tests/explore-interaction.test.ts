import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDragAxis } from '../src/services/exploreInteraction.ts';

test('a tap and ambiguous diagonal movement do not take over a scrollable explorer', () => {
  assert.equal(resolveDragAxis(6, 3), 'pending');
  assert.equal(resolveDragAxis(15, 15), 'pending');
  assert.equal(resolveDragAxis(-60, 8), 'horizontal');
  assert.equal(resolveDragAxis(12, -65), 'vertical');
});

test('vertical scroll intent remains locked even if the finger later moves sideways', () => {
  const axis = resolveDragAxis(4, 20);
  assert.equal(resolveDragAxis(100, 35, axis), 'vertical');
  const orbit = resolveDragAxis(20, 3);
  assert.equal(resolveDragAxis(30, 80, orbit), 'horizontal');
});
