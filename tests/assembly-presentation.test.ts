import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssemblyPresentation } from '../src/services/assemblyPresentation.ts';
import { samplePassageAssembly } from '../src/services/passageAssembly.ts';

test('a skipped arrival builds progressively and ends in a stable usable composition', () => {
  for (const fps of [30, 60, 144]) {
    const actuator = createAssemblyPresentation();
    actuator.step({ active: -1, progress: 0 }, 0);
    let previous = 0, finish = false;
    for (let f = 0; f < fps * 4; f++) {
      const poses = actuator.step({ active: 4, progress: .5 }, 1 / fps);
      assert.ok(poses[4].deployment >= previous);
      assert.ok(poses[4].deployment - previous <= 1 / fps / 1.35 + 1e-10);
      if (f < fps) assert.equal(poses[4].content, 0);
      if (actuator.ages[4] >= 0) finish = true;
      previous = poses[4].deployment;
    }
    assert.equal(actuator.poses[4].content, 1);
    assert.ok(finish);
  }
});

test('restore/reduced motion resolve immediately; inspection freezes; departing hardware clears camera', () => {
  const actuator = createAssemblyPresentation();
  actuator.step({ active: 2, progress: .5 }, 0);
  assert.equal(actuator.poses[2].deployment, 1);
  assert.equal(actuator.ages[2], -1);
  actuator.step({ active: 3, progress: .5 }, .016);
  const partial = actuator.poses[3];
  actuator.step({ active: 3, progress: .5 }, .05, false, true);
  assert.equal(actuator.poses[3], partial);
  actuator.step({ active: 3, progress: .5 }, .016, true);
  assert.equal(actuator.poses[3].deployment, 1);
  actuator.step({ active: 3, progress: .9 }, .016);
  assert.equal(actuator.poses[3].deployment, 0);
  actuator.step({ active: 5, progress: .5 }, .016);
  assert.equal(actuator.poses[3].deployment, 0);
});

test('the lock trace retires once and small movements near arrival do not flash it again', () => {
  const actuator = createAssemblyPresentation();
  actuator.step({ active: -1, progress: 0 }, 0);
  for (let f = 0; f < 300; f++) actuator.step({ active: 0, progress: .5 }, 1 / 60);
  assert.equal(actuator.ages[0], 1.25);
  for (let f = 0; f < 60; f++) actuator.step({ active: 0, progress: .378 }, 1 / 60);
  for (let f = 0; f < 60; f++) actuator.step({ active: 0, progress: .5 }, 1 / 60);
  assert.equal(actuator.ages[0], 1.25);
});

test('reverse travel never leaves an expanded mechanism on a retracted carrier', () => {
  const actuator = createAssemblyPresentation();
  actuator.step({ active: 4, progress: .5 }, 0);
  for (const progress of [.35, .28, .21, .04, .3, .16, .5, .96]) {
    const frame = { active: 4, progress };
    const visible = actuator.step(frame, 1 / 144)[4];
    assert.ok(visible.deployment <= samplePassageAssembly(4, frame).deployment);
  }
});
