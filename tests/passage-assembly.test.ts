import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleAssemblyDeployment, samplePassageAssembly } from '../src/services/passageAssembly.ts';
import { passageContentOpacity } from '../src/services/passageJourney.ts';

const stages = ['deployment','release','spine','hinges','leaves','screen','lock','content'] as const;
test('each reading position has a complete stable assembly and readable content', () => {
  for (let index = 0; index < 6; index++) {
    const reference = samplePassageAssembly(index, { active: index, progress: .38 });
    for (const stage of stages) assert.equal(reference[stage], 1, `${index}/${stage}`);
    for (let step = 38; step <= (index === 5 ? 100 : 74); step++) {
      const frame = { active: index, progress: step / 100 };
      assert.deepEqual(samplePassageAssembly(index, frame), reference);
      assert.equal(passageContentOpacity(index, frame), 1);
    }
  }
});

test('readable copy waits until the plates and screen have cleared the content aperture', () => {
  for (let index = 0; index < 6; index++) for (let step = 0; step <= 1000; step++) {
    const frame = { active: index, progress: step / 1000 }, state = samplePassageAssembly(index, frame);
    if (state.content > .001) {
      assert.equal(state.leaves, 1); assert.equal(state.hinges, 1); assert.equal(state.screen, 1);
    }
    if (state.lock < .5) assert.equal(state.content, 0);
  }
});

test('assembly reconstructs exactly on reverse, jumps and malformed progress', () => {
  const frames = Array.from({ length: 701 }, (_, step) => ({ active: Math.floor(step / 101) - 1, progress: (step % 101) / 100 }));
  for (let index = 0; index < 6; index++) {
    const forward = frames.map(frame => samplePassageAssembly(index, frame));
    for (let step = frames.length - 1; step >= 0; step--) assert.deepEqual(samplePassageAssembly(index, frames[step]), forward[step]);
    for (const value of [NaN, Infinity, -Infinity, -100, 0, 100]) {
      const state = samplePassageAssembly(index, { active: value, progress: value });
      for (const stage of stages) assert.ok(Number.isFinite(state[stage]) && state[stage] >= 0 && state[stage] <= 1);
    }
  }
});

test('mechanical stages precede the image and fold before crossing the carrier', () => {
  for (let index = 0; index < 6; index++) {
    let previous = 0;
    for (let step = 0; step <= 380; step++) {
      const state = samplePassageAssembly(index, { active: index, progress: step / 1000 });
      assert.ok(state.deployment >= previous - 1e-10); previous = state.deployment;
      assert.ok(state.release >= state.spine && state.spine >= state.hinges);
      assert.ok(state.hinges >= state.leaves && state.leaves >= state.screen);
    }
    if (index < 5) assert.equal(samplePassageAssembly(index, { active: index, progress: 1 }).deployment, 0);
  }
});

test('approach gives the mechanism a linear phase instead of compounding camera easing', () => {
  for (let index = 0; index < 6; index++) for (let step = 0; step <= 38; step++) {
    const progress = step / 100;
    assert.ok(Math.abs(samplePassageAssembly(index, { active: index, progress }).deployment - progress / .38) < 1e-10);
  }
});

test('major actuations have visible travel intervals and a deliberate order', () => {
  const primary = ['spine', 'hinges', 'leaves', 'screen', 'lock'] as const;
  let previousMiddle = -1;
  for (const field of primary) {
    const phases = Array.from({ length: 1001 }, (_, index) => index / 1000);
    const start = phases.find(phase => sampleAssemblyDeployment(phase)[field] >= .1)!;
    const end = phases.find(phase => sampleAssemblyDeployment(phase)[field] >= .9)!;
    const middle = phases.find(phase => sampleAssemblyDeployment(phase)[field] >= .5)!;
    assert.ok(end - start >= .10, `${field} must not snap through its main travel`);
    assert.ok(middle > previousMiddle, `${field} has its own mechanical beat`);
    previousMiddle = middle;
  }
  assert.equal(sampleAssemblyDeployment(0).content, 0);
  assert.equal(sampleAssemblyDeployment(1).content, 1);
});

test('adjacent chapter boundaries keep every mechanism stowed without a pose discontinuity', () => {
  const boundaries = [
    [{ active: -1, progress: 1 }, { active: 0, progress: 0 }],
    ...Array.from({ length: 5 }, (_, active) => [{ active, progress: 1 }, { active: active + 1, progress: 0 }]),
  ];
  for (const [before, after] of boundaries) for (let index = 0; index < 6; index++) {
    const a = samplePassageAssembly(index, before), b = samplePassageAssembly(index, after);
    assert.deepEqual(a, b);
  }
});

test('resolved phase preserves exact endpoints, malformed input safety and clear apertures', () => {
  for (const value of [NaN, -Infinity, -1, 0, .2, .6, .9, 1, 2, Infinity]) {
    const state = sampleAssemblyDeployment(value, false);
    assert.equal(state.visible, false);
    for (const field of stages) assert.ok(Number.isFinite(state[field]) && state[field] >= 0 && state[field] <= 1);
    if (state.content > 0) {
      assert.equal(state.leaves, 1); assert.equal(state.screen, 1); assert.equal(state.hinges, 1);
    }
  }
});
