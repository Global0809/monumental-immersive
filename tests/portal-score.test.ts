import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortalScore, type PortalSound } from '../src/services/portalScore';
import type { TunnelFrame } from '../src/services/tunnelJourney';

const frame = (z: number, compact = false): TunnelFrame => ({ z, compact, active: -1, progress: 0 });
function harness() {
  const cues: Array<{ type: PortalSound; pan: number; intensity: number }> = [];
  return { cues, score: createPortalScore((type, pan, intensity) => cues.push({ type, pan, intensity })) };
}

test('opening iris, physical crossing and reverse closure have distinct bounded cues', () => {
  const { score, cues } = harness();
  score.sample(frame(14), 0, true);
  score.sample(frame(5), 1000, true);
  score.sample(frame(-8), 2000, true);
  score.sample(frame(5), 3000, true);
  score.sample(frame(14), 4000, true);
  assert.deepEqual(cues.map(cue => cue.type), ['iris-open', 'threshold-pass', 'threshold-pass', 'iris-close']);
  assert.equal(cues[1].pan, -cues[2].pan);
  assert.ok(cues.every(cue => cue.intensity <= .7 && Math.abs(cue.pan) < .3));
});

test('fast tunnel skips produce a single nearby cue, not all crossed gates', () => {
  const { score, cues } = harness();
  score.sample(frame(14), 0, true);
  score.sample(frame(-230), 1000, true);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].type, 'threshold-pass');
  score.sample(frame(-231), 1010, true);
  score.sample(frame(-230), 1020, true);
  assert.equal(cues.length, 1);
});

test('restoration, denied motion, compact switches and settled reading positions are silent', () => {
  const { score, cues } = harness();
  score.sample(frame(-24.5), 0, true);
  score.sample(frame(-24.5), 1000, true);
  score.sample(frame(-66.5), 2000, false);
  score.sample(frame(-66.5), 3000, true);
  score.sample(frame(-108.5, true), 4000, true);
  score.sample(frame(-150.5, true), 5000, true);
  score.sample(frame(-150.5), 6000, true);
  assert.equal(cues.length, 0);
  score.reset(); score.sample(frame(14), 7000, true);
  assert.equal(cues.length, 0);
});
