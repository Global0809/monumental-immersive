import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleCinematicLight, cinematicRect, cinematicBufferSize } from '../src/services/cinematicLight.ts';

test('architectural breath stays slow, bounded and stable under reduced motion', () => {
  let previous = sampleCinematicLight(0);
  for (let t = 0; t < 120; t += 1 / 60) {
    const next = sampleCinematicLight(t);
    assert.ok(next.breath > .8 && next.breath < 1.2 && next.signal > .7 && next.signal < 1.3);
    assert.ok(Math.abs(next.breath - previous.breath) < .003 && Math.abs(next.signal - previous.signal) < .004);
    assert.deepEqual(sampleCinematicLight(t, true), { breath: 1, signal: 1, drift: 0 });
    assert.ok(Math.abs(sampleCinematicLight(t, false, true).breath - 1) <= Math.abs(next.breath - 1) + 1e-10);
    previous = next;
  }
  assert.deepEqual(sampleCinematicLight(Infinity), sampleCinematicLight(0, true));
  const full = sampleCinematicLight(2), quiet = sampleCinematicLight(2, false, true), halfway = sampleCinematicLight(2, false, .5);
  assert.ok(Math.abs(halfway.breath - (full.breath + quiet.breath) / 2) < 1e-10);
  assert.ok(Math.abs(halfway.signal - (full.signal + quiet.signal) / 2) < 1e-10);
});

test('media protection maps screen corners without changing their region', () => {
  assert.deepEqual(cinematicRect({ left: 100, top: 200, right: 500, bottom: 800 }, 1000, 1000), [.1, .19999999999999996, .5, .8]);
  assert.deepEqual(cinematicRect({ left: -.1, top: -.1, right: 2, bottom: 2 }), [0, 0, 1, 1]);
  assert.deepEqual(cinematicRect({ left: NaN, top: 0, right: 1, bottom: 1 }), [0, 0, 0, 0]);
});

test('optics buffers remain bounded and reject oversized or invalid targets', () => {
  const normal = cinematicBufferSize(1920, 1080)!;
  assert.equal(normal.bloomWidth, 480); assert.equal(normal.bloomHeight, 270);
  assert.equal(cinematicBufferSize(7680, 4320), null);
  for (const n of [NaN, Infinity, -10, 0]) assert.equal(cinematicBufferSize(n, 100), null);
});
