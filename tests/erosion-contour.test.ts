import test from 'node:test';
import assert from 'node:assert/strict';
import { buildErosionContour, prepareErosionContour, prepareErosionContourSlice, type ErosionContourOptions } from '../src/services/erosionContour.ts';

const options = { width: 1440, height: 900, progress: 0.5, seed: 'home-journey' };

test('a seeded contour is stable after scrolling forward and reversing to the same position', () => {
  const initial = buildErosionContour(options);
  for (const progress of [0.7, 1, 0.3, 0.2]) buildErosionContour({ ...options, progress });
  const reversed = buildErosionContour(options);
  assert.equal(initial.path, reversed.path);
  assert.equal(initial.frontierAt(700), reversed.frontierAt(700));
  assert.notEqual(initial.path, buildErosionContour({ ...options, seed: 'world-stories' }).path);
});

test('endpoints are exact empty and solid masks, without residual holes or fragments', () => {
  assert.equal(buildErosionContour({ ...options, progress: 0 }).path, '');
  assert.equal(buildErosionContour({ ...options, progress: -5 }).path, '');
  assert.equal(buildErosionContour({ ...options, progress: 1 }).path, 'M0 0H1440V900H0Z');
  assert.equal(buildErosionContour({ ...options, progress: 8 }).path, 'M0 0H1440V900H0Z');
});

test('the contour has broad asymmetric variation, bounded detail and clean offscreen endpoints', () => {
  const middle = buildErosionContour(options);
  const start = buildErosionContour({ ...options, progress: 0.00001 });
  const end = buildErosionContour({ ...options, progress: 0.99999 });
  const heights = [];
  for (let x = 0; x <= options.width; x += 5) {
    const y = middle.frontierAt(x);
    heights.push(y);
    assert.ok(Math.abs(y - options.height / 2) <= options.height * 0.24);
    assert.ok(start.frontierAt(x) > options.height);
    assert.ok(end.frontierAt(x) < 0);
  }
  assert.ok(Math.max(...heights) - Math.min(...heights) > options.height * 0.08);
  assert.notEqual(middle.frontierAt(200), middle.frontierAt(options.width - 200));
});

test('a fixed material erodes monotonically with scroll and direction mirrors occupancy', () => {
  const earlier = buildErosionContour({ ...options, progress: 0.4 });
  const later = buildErosionContour({ ...options, progress: 0.6 });
  const down = buildErosionContour({ ...options, direction: 'down' });
  const up = buildErosionContour(options);
  for (const x of [0, 37, 500, 1120, 1440]) {
    assert.ok(later.frontierAt(x) < earlier.frontierAt(x));
    assert.equal(down.frontierAt(x), options.height - up.frontierAt(x));
  }
  for (let x = 0; x < options.width; x += 13) for (let y = 0; y < options.height; y += 11) {
    if (earlier.incomingAt(x, y)) assert.ok(later.incomingAt(x, y));
    assert.equal(up.incomingAt(x, y), down.incomingAt(x, options.height - y));
  }
});

test('mobile and wide masks bound SVG complexity and malformed options remain finite', () => {
  for (const width of [390, 760, 1440, 4096, 32768]) {
    const contour = buildErosionContour({ ...options, width });
    assert.ok(contour.pointCount <= (width <= 760 ? 800 : 1600));
    assert.doesNotMatch(contour.path, /NaN|Infinity|undefined/);
  }
  for (const value of [NaN, Infinity, -Infinity, -10, 0]) {
    const contour = buildErosionContour({
      width: value, height: value, progress: 0.5, seed: 'invalid',
      macroAmplitude: value, detailAmount: value, edgeSoftness: value,
    });
    assert.doesNotMatch(contour.path, /NaN|Infinity|undefined/);
    assert.ok(Number.isFinite(contour.frontierAt(value)));
    assert.ok(contour.edgeSoftness >= 0.25 && contour.edgeSoftness <= 1.5);
  }
});

test('the material produces genuine reentrant contours rather than a translated wave', () => {
  const contour = buildErosionContour({ width: 900, height: 700, progress: .5, seed: 'go-somewhere', detailAmount: 1.2, macroAmplitude: .18 });
  let reentrant = false;
  for (let x = 3; x < 900 && !reentrant; x += 3) {
    let entered = false;
    for (let y = 150; y < 550; y += 1) {
      const incoming = contour.incomingAt(x, y);
      if (entered && !incoming) { reentrant = true; break; }
      entered ||= incoming;
    }
  }
  assert.ok(reentrant, 'A vertical slice should encounter a real curl or cavity');
  assert.match(contour.path, /Q/, 'The connected frontier uses continuous curves');
});

test('zero detail and zero amplitude produce a plain frontier without hidden islands', () => {
  const contour = buildErosionContour({ ...options, macroAmplitude: 0, detailAmount: 0 });
  assert.equal(contour.frontierAt(0), options.height / 2);
  assert.equal(contour.frontierAt(options.width), options.height / 2);
  assert.equal(contour.path.match(/M/g)?.length, 1);
});

test('rectangle classification never treats a torn pocket as a solid text surface', () => {
  for (const direction of ['up', 'down'] as const) for (const progress of [.04, .31, .5, .73, .97]) {
    const contour = buildErosionContour({ ...options, progress, direction });
    for (let y = 0; y < 900; y += 37) for (let x = 0; x < 1440; x += 71) {
      const right = Math.min(1440, x + 63), bottom = Math.min(900, y + 49);
      const state = contour.classifyRect(x, y, right, bottom);
      if (state === 'mixed') continue;
      for (let py = y; py <= bottom; py += 3) for (let px = x; px <= right; px += 3) {
        assert.equal(contour.incomingAt(px, py), state === 'to', 'A solid paint decision must include the entire rectangle, not just its corners');
      }
    }
  }
  assert.equal(buildErosionContour({ ...options, progress: 0 }).classifyRect(0, 0, 1440, 900), 'from');
  assert.equal(buildErosionContour({ ...options, progress: 1 }).classifyRect(0, 0, 1440, 900), 'to');
});

test('lazy material preparation and previous visits cannot change the contour', () => {
  const initial = buildErosionContour({ ...options, seed: 'lazy-revisit', progress: .45 });
  for (const progress of [.01, .99, .2, .8]) prepareErosionContour({ ...options, seed: 'lazy-revisit', progress });
  const restored = buildErosionContour({ ...options, seed: 'lazy-revisit', progress: .45 });
  assert.equal(restored.path, initial.path);
  const advanced = buildErosionContour({ ...options, seed: 'lazy-revisit', progress: .58 });
  const displacement = [90, 250, 480, 720, 960, 1200, 1390].map(x => initial.frontierAt(x) - advanced.frontierAt(x));
  assert.ok(Math.max(...displacement) - Math.min(...displacement) > 15, 'Different pieces of the material should erode at different rates, rather than translating an unchanged wave');
});

function tileBandCount(width: number, height: number) {
  const step = Math.max(1.8, width / 580, height / 580);
  return Math.ceil((Math.ceil(height / step) + 2) / 16);
}
function warmAll(input: ErosionContourOptions) {
  const limit = tileBandCount(input.width, input.height);
  for (let calls = 1; calls <= limit; calls++) if (prepareErosionContourSlice(input)) return calls;
  assert.fail('Idle preparation did not finish within one call per tile band');
}
function captureContour(input: ErosionContourOptions) {
  const contour = buildErosionContour(input);
  // Capture values immediately: contours retain a shared field that subsequent
  // idle preparation may fill, so comparing only its live closures is insufficient.
  const samples: boolean[] = [], rectangles: string[] = [], frontiers: number[] = [];
  for (let y = 0; y <= input.height; y += 29) for (let x = 0; x <= input.width; x += 47) {
    samples.push(contour.incomingAt(x, y));
    rectangles.push(contour.classifyRect(x, y, Math.min(x + 63, input.width), Math.min(y + 41, input.height)));
  }
  for (let x = 0; x <= input.width; x += 31) frontiers.push(contour.frontierAt(x));
  return { path: contour.path, pointCount: contour.pointCount, samples, rectangles, frontiers };
}
function evictFields(prefix: string) {
  for (let i = 0; i < 4; i++) prepareErosionContourSlice({ ...options, seed: `${prefix}-${i}` });
}

test('each idle slice warms exactly one cold band and completion means the whole field is ready', () => {
  for (const [width, height] of [[390, 844], [1440, 900], [4096, 900]]) {
    const input = { ...options, width, height, seed: `one-band-${width}`, progress: .5 };
    const expected = tileBandCount(width, height);
    // Changing the requested frontier reprioritizes work without warming multiple
    // bands or forgetting the bands already prepared at the old position.
    for (let call = 1; call <= expected; call++) {
      const progress = [.5, .99, .01, .75, .25][call % 5];
      assert.equal(prepareErosionContourSlice({ ...input, progress }), call === expected);
    }
    assert.equal(prepareErosionContourSlice({ ...input, progress: 0 }), true);
    assert.equal(prepareErosionContourSlice({ ...input, progress: 1 }), true);
  }
});

test('fully sliced preparation preserves cold contour paths and text classifications after distant jumps', () => {
  for (const direction of ['up', 'down'] as const) {
    const input = { ...options, seed: `slice-jumps-${direction}`, direction, macroAmplitude: .18, detailAmount: 1.2 };
    const jumps = [.5, .91, .12, .76, .31, .5];
    const cold = jumps.map(progress => captureContour({ ...input, progress }));
    evictFields(`slice-jumps-eviction-${direction}`);
    assert.equal(warmAll({ ...input, progress: .5 }), tileBandCount(input.width, input.height));
    const ready = jumps.map(progress => captureContour({ ...input, progress }));
    assert.deepEqual(ready, cold, 'Idle warm-up must not alter the contour, its cavities or text decisions');
    assert.equal(prepareErosionContourSlice({ ...input, progress: .91 }), true);
  }
});

test('the first idle slice prioritizes the requested frontier instead of an unrelated edge band', () => {
  for (const progress of [0, .37, .63, 1]) {
    const baseline = { ...options, progress, seed: `priority-baseline-${progress}` };
    prepareErosionContour(baseline);
    const baselineRemaining = warmAll(baseline);
    const sliced = { ...options, progress, seed: `priority-sliced-${progress}` };
    assert.equal(prepareErosionContourSlice(sliced), false);
    prepareErosionContour(sliced);
    // The first slice belongs to the range required by ordinary preparation.
    // If it spent its work elsewhere, one fewer band would remain here.
    assert.equal(warmAll(sliced), baselineRemaining);
  }
});

test('partial idle work, ordinary preflight and cache eviction retain original deterministic geometry', () => {
  const input = { ...options, width: 900, height: 700, seed: 'partial-slice-revisit', progress: .43 };
  const original = captureContour(input);
  evictFields('partial-slice-reset');
  for (let i = 0; i < 3; i++) assert.equal(prepareErosionContourSlice({ ...input, progress: .43 }), false);
  prepareErosionContour({ ...input, progress: .88 });
  assert.deepEqual(captureContour(input), original);
  warmAll(input);
  assert.deepEqual(captureContour(input), original);
  evictFields('partial-slice-final-reset');
  assert.equal(prepareErosionContourSlice(input), false, 'Evicted fields must restart their bounded preparation');
  assert.deepEqual(captureContour(input), original);
  assert.ok(warmAll(input) <= tileBandCount(input.width, input.height));
  assert.equal(prepareErosionContourSlice(input), true);
});
