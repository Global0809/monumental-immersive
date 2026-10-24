import test from 'node:test';
import assert from 'node:assert/strict';
import { buildErosionContour } from '../src/services/erosionContour.ts';

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

test('scroll progression translates one coherent contour and direction mirrors the reveal', () => {
  const earlier = buildErosionContour({ ...options, progress: 0.4 });
  const later = buildErosionContour({ ...options, progress: 0.6 });
  const down = buildErosionContour({ ...options, direction: 'down' });
  const up = buildErosionContour(options);
  const displacement = later.frontierAt(0) - earlier.frontierAt(0);
  assert.ok(displacement < 0);
  for (const x of [0, 37, 500, 1120, 1440]) {
    assert.ok(Math.abs(later.frontierAt(x) - earlier.frontierAt(x) - displacement) < 1e-8);
    assert.equal(down.frontierAt(x), options.height - up.frontierAt(x));
  }
});

test('mobile and wide masks bound SVG complexity and malformed options remain finite', () => {
  for (const width of [390, 760, 1440, 4096, 32768]) {
    const contour = buildErosionContour({ ...options, width });
    assert.ok(contour.pointCount <= (width <= 760 ? 260 : 500));
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

test('zero detail and zero amplitude produce a plain frontier without hidden islands', () => {
  const contour = buildErosionContour({ ...options, macroAmplitude: 0, detailAmount: 0 });
  assert.equal(contour.frontierAt(0), options.height / 2);
  assert.equal(contour.frontierAt(options.width), options.height / 2);
  assert.equal(contour.path.match(/M/g)?.length, 1);
});
