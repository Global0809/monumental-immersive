import test from 'node:test';
import assert from 'node:assert/strict';
import { createPassageScore, passageRoom, routeSoundRoom } from '../src/services/passageSonic';
import type { TunnelFrame } from '../src/services/tunnelJourney';

function harness() {
  const rooms: string[] = [], motion: [number, number][] = [], arrivals: boolean[] = [];
  const timers = new Set<() => void>();
  const score = createPassageScore({
    room: room => rooms.push(room), motion: (energy, pan) => motion.push([energy, pan]), arrival: compact => arrivals.push(compact),
    schedule: callback => { timers.add(callback); return () => { timers.delete(callback); }; },
  });
  return { score, rooms, motion, arrivals, settle() { for (const callback of [...timers]) { timers.delete(callback); callback(); } }, timers };
}
const frame = (active: number, progress: number, z: number, compact = false): TunnelFrame => ({ active, progress, z, compact });

test('the six Passage rooms and deep routes have their own coordinated soundstage', () => {
  assert.deepEqual([-1, 0, 1, 2, 3, 4, 5].map(passageRoom), ['home', 'world', 'time', 'cinema', 'music', 'culture', 'collection']);
  assert.equal(routeSoundRoom('/category/music'), 'music');
  assert.equal(routeSoundRoom('/film/sintel'), 'cinema');
  assert.equal(routeSoundRoom('/time-machine'), 'time');
  assert.equal(routeSoundRoom('/journey'), 'collection');
});

test('restored positions and unprompted layout refreshes never announce arrivals', () => {
  const h = harness();
  h.score.sample(frame(3, .5, -150), 100);
  h.score.sample(frame(4, .5, -192), 200);
  h.settle();
  assert.deepEqual(h.rooms, ['music', 'culture']);
  assert.equal(h.arrivals.length, 0);
  assert.ok(h.motion.every(([energy]) => energy === 0));
});

test('a scroll departure creates bounded motion, and an arrival happens only in a settled reading position', () => {
  const h = harness();
  h.score.sample(frame(-1, 0, 14), 0);
  h.score.arm(100);
  h.score.sample(frame(0, .2, -15), 130);
  assert.equal(h.timers.size, 0);
  assert.ok(h.motion.at(-1)![0] > 0 && h.motion.at(-1)![0] <= 1);
  h.score.sample(frame(0, .46, -24.5), 200);
  assert.equal(h.timers.size, 1);
  h.settle();
  h.score.sample(frame(0, .58, -24.5), 260);
  h.settle();
  assert.deepEqual(h.arrivals, [false]);
  assert.equal(h.motion.at(-1)![0], 0, 'reading plateau is quiet even while native scroll continues');
});

test('fast jumps cancel intermediate room arrivals and resolve only the destination', () => {
  const h = harness();
  h.score.sample(frame(-1, 0, 14), 0); h.score.arm(100);
  h.score.sample(frame(0, .5, -24.5), 120);
  h.score.sample(frame(2, .5, -108.5), 150);
  h.score.sample(frame(5, .5, -234.5), 180);
  assert.equal(h.timers.size, 1);
  h.settle();
  assert.deepEqual(h.rooms, ['home', 'world', 'cinema', 'collection']);
  assert.deepEqual(h.arrivals, [false]);
});

test('reverse travel reverses stereo drift; hidden, resized and disposed scopes cancel work', () => {
  const h = harness();
  h.score.sample(frame(2, .8, -110), 0); h.score.arm(100);
  h.score.sample(frame(1, .5, -66.5), 150);
  assert.ok(h.motion.at(-1)![1] > 0);
  h.score.sample(frame(1, .5, -66.5), 160, false);
  h.settle(); assert.equal(h.arrivals.length, 0);
  h.score.arm(200); h.score.sample(frame(0, .5, -24.5), 250);
  h.score.sample(frame(0, .5, -24.5, true), 280);
  h.settle(); assert.equal(h.arrivals.length, 0);
  h.score.arm(300); h.score.sample(frame(1, .2, -60, true), 340);
  h.score.dispose(); h.settle();
  assert.equal(h.arrivals.length, 0); assert.deepEqual(h.motion.at(-1), [0, 0]);
});
