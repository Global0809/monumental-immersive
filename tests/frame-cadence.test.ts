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

test('moderate stalls discard render debt without catch-up bursts or a phase change', () => {
  for (const refresh of [120, 144]) for (const stall of [33, 50, 62]) {
    const cadence = createFrameCadence(), baseline = createFrameCadence();
    const timestamps: number[] = [], uninterrupted: number[] = [];
    const resumeAt = 70 + stall, interval = 1000 / 60, nativeInterval = 1000 / refresh;
    for (let frame = 0; frame < refresh * 10; frame++) {
      const time = frame * nativeInterval;
      if (baseline.ready(time)) uninterrupted.push(time);
      if (time > 70 && time < resumeAt) continue;
      if (cadence.ready(time)) timestamps.push(time);
    }
    const recovery = timestamps.findIndex(time => time >= resumeAt);
    assert.ok(recovery > 0);
    assert.ok(timestamps[recovery] < resumeAt + nativeInterval, 'the first available RAF resumes immediately');
    assert.ok(timestamps[recovery + 1] - timestamps[recovery] >= interval - .75,
      `${refresh} Hz / ${stall} ms: recovery does not repay a missed frame`);
    assert.ok(timestamps.slice(recovery + 1).every((time, i) => time - timestamps[recovery + i] >= nativeInterval * 2 - .001),
      `${refresh} Hz / ${stall} ms: no consecutive native-refresh catch-up frames`);
    assert.ok(timestamps.length <= uninterrupted.length, 'missed frames never increase the 60 Hz render budget');
    assert.deepEqual(timestamps.filter(time => time > resumeAt + 50), uninterrupted.filter(time => time > resumeAt + 50),
      'the existing fractional deadline phase is retained after recovery');
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
