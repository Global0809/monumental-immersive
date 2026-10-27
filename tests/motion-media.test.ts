import test from 'node:test';
import assert from 'node:assert/strict';
import { motionMediaTransition, motionMediaCanSeek } from '../src/services/motionMedia.ts';

test('failed previews cannot be relabeled ready by late decoder events', () => {
  for (const event of ['loaded', 'play', 'pause', 'waiting'] as const) {
    assert.equal(motionMediaTransition('failed', event), 'failed');
    assert.equal(motionMediaTransition('unsupported', event), 'unsupported');
  }
  assert.equal(motionMediaTransition('failed', 'request'), 'loading');
  assert.equal(motionMediaTransition('loading', 'loaded'), 'ready');
});

test('motion preview scrubbers require an actual decoded duration and usable state', () => {
  for (const state of ['idle', 'loading', 'failed', 'unsupported'] as const) assert.equal(motionMediaCanSeek(state, 8), false);
  for (const state of ['ready', 'playing', 'paused', 'ended'] as const) assert.equal(motionMediaCanSeek(state, 8), true);
  assert.equal(motionMediaCanSeek('ready', 0), false);
  assert.equal(motionMediaCanSeek('ready', Infinity), false);
});
