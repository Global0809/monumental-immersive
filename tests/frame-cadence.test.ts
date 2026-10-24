import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameCadence } from '../src/services/frameCadence.ts';

test('the 60 Hz budget retains its phase on 60, 120, and 144 Hz displays', () => {
  for (const refresh of [60, 120, 144]) {
    const cadence = createFrameCadence();
    const timestamps = [];
    for (let frame = 0; frame < refresh * 10; frame++) {
      const time = frame * 1000 / refresh;
      if (cadence.ready(time)) timestamps.push(time);
    }
    assert.ok(timestamps.length >= 599 && timestamps.length <= 601, `${refresh} Hz display: ${timestamps.length} renders in 10 seconds`);
    assert.ok(timestamps.slice(1).every((time, i) => time - timestamps[i] < 25), 'No avoidable 30/48 fps frame gaps');
  }
});

test('ordinary 60 Hz timestamp jitter does not drop alternate frames', () => {
  const cadence = createFrameCadence();
  for (let frame = 0; frame < 600; frame++) {
    assert.equal(cadence.ready(frame * 1000 / 60 + Math.sin(frame * 2.7) * .3), true);
  }
});

test('visibility resumes and explicit invalidations draw immediately without catch-up bursts', () => {
  const cadence = createFrameCadence();
  assert.equal(cadence.ready(100), true);
  assert.equal(cadence.ready(104), false);
  assert.equal(cadence.ready(1000), true);
  assert.equal(cadence.ready(1004), false);
  cadence.reset();
  assert.equal(cadence.ready(1005), true);
  assert.equal(cadence.ready(1009), false);
});
