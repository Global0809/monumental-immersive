import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssemblyScore, type AssemblySound } from '../src/services/assemblyScore';
import { createPassageScore } from '../src/services/passageSonic';
import { tunnelChapterZ, type TunnelFrame } from '../src/services/tunnelJourney';

const frame = (progress: number, active = 0, compact = false): TunnelFrame => ({ active, progress, compact, z: tunnelChapterZ(active, progress) });
function harness() {
  const events: { type: AssemblySound; pan: number; intensity: number }[] = [];
  const score = createAssemblyScore((type, pan, intensity) => events.push({ type, pan, intensity }));
  return { score, events };
}

test('mechanical releases, drive stages and final registration follow real assembly crossings', () => {
  const h = harness();
  for (let step = 0; step <= 38; step++) h.score.sample(frame(step / 100), step * 100, true);
  assert.deepEqual(h.events.map(e => e.type), ['assembly-release', 'assembly-drive', 'assembly-drive', 'assembly-lock']);
  assert.ok(h.events.every(e => e.pan < 0 && e.intensity >= .5 && e.intensity <= .8));
  const count = h.events.length;
  for (let step = 38; step <= 74; step++) h.score.sample(frame(step / 100), step * 100, true);
  assert.equal(h.events.length, count, 'The entire reading plateau has no extra actuation.');
});

test('reverse scrolling reconstructs the mechanical closures without a delayed sequence', () => {
  const h = harness(); h.score.sample(frame(.5), 0, true);
  for (let step = 38; step >= 0; step--) h.score.sample(frame(step / 100), (39 - step) * 150, true);
  assert.deepEqual(h.events.map(e => e.type), ['assembly-release', 'sculpture-fold', 'sculpture-fold', 'assembly-lock']);
  assert.ok(h.events.every(e => e.pan > 0));
  const count = h.events.length;
  h.score.sample(frame(0), 9000, true);
  assert.equal(h.events.length, count);
});

test('fast traversal coalesces skipped stages to one registration and never replays the skipped actions', () => {
  const h = harness(); h.score.sample(frame(0), 0, true); h.score.sample(frame(.5), 200, true);
  assert.deepEqual(h.events.map(e => e.type), ['assembly-lock']);
  for (const time of [400, 800, 1600]) h.score.sample(frame(.5), time, true);
  assert.equal(h.events.length, 1);
  assert.equal(h.score.lockedRecently(0, 850), true);
  assert.equal(h.score.lockedRecently(0, 1800), false);
});

test('restored, hidden, reduced, inspection and resized samples stay silent and establish a fresh baseline', () => {
  const h = harness(); h.score.sample(frame(.5), 0, true);
  h.score.sample(frame(0), 200, false); h.score.sample(frame(.5), 400, false);
  h.score.sample(frame(.5), 600, true);
  h.score.sample(frame(0, 0, true), 800, true); h.score.sample(frame(.5, 0, true), 1000, true);
  h.score.sample(frame(.5), 1200, true);
  assert.equal(h.events.length, 0);
  h.score.reset(); h.score.sample(frame(.5), 2000, true);
  assert.equal(h.events.length, 0);
});

test('a final assembly lock replaces the ordinary arrival rather than doubling it', () => {
  const events: string[] = [], timers = new Set<() => void>();
  const score = createPassageScore({ room() {}, motion() {}, arrival: () => events.push('arrival'), mechanism: type => events.push(type), schedule(callback) { timers.add(callback); return () => { timers.delete(callback); }; } });
  score.sample(frame(0), 0); score.arm(100); score.sample(frame(.5), 200);
  for (const callback of timers) callback();
  assert.deepEqual(events, ['assembly-lock']);
  score.dispose();
});

test('short bursts and sub-threshold pointerless jitter cannot produce an actuation avalanche', () => {
  const h = harness(); h.score.sample(frame(0), 0, true);
  for (let step = 1; step <= 40; step++) h.score.sample(frame(step / 100), step * 2, true);
  assert.ok(h.events.length <= 1, 'The shared minimum interval bounds fast scroll crossings.');
});
