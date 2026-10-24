import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTransitionContour, transitionExtent, type TransitionVariant } from '../src/services/transitionContours.ts';

const variants: TransitionVariant[] = ['ink', 'silk', 'rift', 'facet', 'bloom'];
const options = { width: 1440, height: 900, frontY: 450, seed: 'go-somewhere' };
type Point = [number, number];
// Parse the actual paint geometry independently, including every island/hole.
function polygons(path: string): Point[][] {
  return path.split('Z').filter(Boolean).map(loop => [...loop.matchAll(/[ML](-?[\d.e+]+) (-?[\d.e+]+)/g)].map(match => [Number(match[1]), Number(match[2])]));
}
function contains(points: Point[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
function painted(loops: Point[][], x: number, y: number) {
  return loops.reduce((inside, loop) => contains(loop, x, y) ? !inside : inside, false);
}

test('every material translates exactly with real scroll and reverses without changing shape', () => {
  for (const variant of variants) {
    const first = buildTransitionContour({ ...options, variant });
    const shifted = buildTransitionContour({ ...options, variant, frontY: options.frontY - 123.125 });
    const a = polygons(first.path), b = polygons(shifted.path);
    assert.equal(a.length, b.length);
    for (let p = 0; p < a.length; p++) {
      assert.equal(a[p].length, b[p].length);
      for (let i = 0; i < a[p].length; i++) {
        assert.equal(a[p][i][0], b[p][i][0]);
        assert.ok(Math.abs(a[p][i][1] - b[p][i][1] - 123.125) < 1e-9);
      }
    }
    for (let y = 140; y < 800; y += 17) for (let x = 0; x <= options.width; x += 23) {
      assert.equal(first.incomingAt(x, y), shifted.incomingAt(x, y - 123.125));
    }
    assert.equal(buildTransitionContour({ ...options, variant }).path, first.path);
    for (let x = 0; x <= options.width; x += 31) assert.ok(Math.abs(first.frontierAt(x) - shifted.frontierAt(x) - 123.125) < 1e-9);
  }
});

test('a point on a document section never slips into another treatment as page and mask scroll together', () => {
  const anchor = 1200;
  for (const variant of variants) for (const documentY of [1080, 1165, 1200, 1260, 1340]) {
    const states = [650, 710, 810, 905].map(scrollY => {
      const contour = buildTransitionContour({ ...options, variant, frontY: anchor - scrollY });
      return Array.from({ length: 31 }, (_, i) => contour.incomingAt(i * 47, documentY - scrollY));
    });
    for (const state of states) assert.deepEqual(state, states[0]);
  }
});

test('DOM treatment samples agree with the exact painted polygons, including pockets and islands', () => {
  for (const variant of variants) for (const frontY of [190.25, 450, 725.75]) {
    const contour = buildTransitionContour({ ...options, frontY, variant });
    const loops = polygons(contour.path);
    assert.ok(loops.every(loop => loop.length >= 3));
    for (let y = .33; y < options.height; y += 9.3) for (let x = .27; x < options.width; x += 11.7) {
      assert.equal(contour.incomingAt(x, y), painted(loops, x, y), `${variant}: paint/sample disagreement at ${x},${y}`);
    }
  }
});

test('rectangle classifications conservatively include internal cavities and narrow frontier crossings', () => {
  for (const variant of variants) {
    const contour = buildTransitionContour({ ...options, variant });
    const loops = polygons(contour.path);
    for (let top = 200; top < 700; top += 39) for (let left = 0; left < options.width - 85; left += 61) {
      const right = left + 85, bottom = top + 57;
      const state = contour.classifyRect(left, top, right, bottom);
      if (state === 'mixed') continue;
      for (let y = top + .3; y < bottom; y += 3.7) for (let x = left + .2; x < right; x += 4.1) {
        assert.equal(painted(loops, x, y), state === 'to', `${variant}: incorrect solid rectangle`);
      }
    }
    if (variant === 'silk') continue;
    let pockets = 0;
    for (const loop of loops) {
      const [x, y] = loop[0];
      if (!loops.some(other => other !== loop && contains(other, x, y))) continue;
      pockets++;
      const left = Math.min(...loop.map(p => p[0])) - 2, right = Math.max(...loop.map(p => p[0])) + 2;
      const top = Math.min(...loop.map(p => p[1])) - 2, bottom = Math.max(...loop.map(p => p[1])) + 2;
      assert.equal(contour.classifyRect(left, top, right, bottom), 'mixed', `${variant}: a fully enclosed cavity was missed`);
    }
    assert.ok(pockets > 0, `${variant}: expected a deliberate internal cutout`);
  }
});

test('five variants have distinct silhouettes and topology rather than settings on one shared wave', () => {
  const masks = variants.map(variant => buildTransitionContour({ ...options, variant }));
  assert.equal(new Set(masks.map(mask => mask.path)).size, 5);
  assert.equal(polygons(masks[1].path).length, 1, 'Silk is a single uninterrupted fold');
  assert.ok(masks[3].pointCount < 30, 'Facet preserves deliberate straight cuts');
  for (let i = 0; i < masks.length; i++) for (let j = i + 1; j < masks.length; j++) {
    let different = 0, samples = 0;
    for (let y = 150; y < 750; y += 9) for (let x = 0; x < 1440; x += 13) {
      samples++; different += Number(masks[i].incomingAt(x, y) !== masks[j].incomingAt(x, y));
    }
    assert.ok(different / samples > .045, `${variants[i]} and ${variants[j]} should look meaningfully different`);
  }
});

test('common extent gives exact clean endpoints with no visible jump at the simplification boundary', () => {
  const extent = transitionExtent(options.width, options.height);
  for (const variant of variants) {
    const empty = buildTransitionContour({ ...options, variant, frontY: options.height + extent });
    const full = buildTransitionContour({ ...options, variant, frontY: -extent });
    assert.equal(empty.path, '');
    assert.equal(full.path, 'M0 0H1440V900H0Z');
    assert.equal(empty.classifyRect(0, 0, 1440, 900), 'from');
    assert.equal(full.classifyRect(0, 0, 1440, 900), 'to');
    const almostEmpty = buildTransitionContour({ ...options, variant, frontY: options.height + extent - .01 });
    const almostFull = buildTransitionContour({ ...options, variant, frontY: -extent + .01 });
    for (let x = 0; x <= options.width; x += 11) {
      assert.equal(almostEmpty.incomingAt(x, options.height), false);
      assert.equal(almostFull.incomingAt(x, 0), true);
      assert.ok(almostEmpty.frontierAt(x) > options.height);
      assert.ok(almostFull.frontierAt(x) < 0);
    }
  }
});

test('shape caching is bounded without changing deterministic revisits or mobile/wide complexity', () => {
  const saved = buildTransitionContour({ ...options, variant: 'ink' }).path;
  for (const width of [320, 390, 768, 1440, 4096, 32768]) for (const variant of variants) {
    const contour = buildTransitionContour({ ...options, width, variant, seed: 'responsive' });
    const extent = transitionExtent(width, options.height);
    assert.ok(contour.pointCount < 1400, `${variant} at ${width}px exceeds its geometry budget`);
    assert.doesNotMatch(contour.path, /NaN|Infinity|undefined/);
    for (const x of [0, width * .1, width / 2, width * .9, width]) {
      assert.ok(Math.abs(contour.frontierAt(x) - options.frontY) < extent);
      assert.equal(contour.incomingAt(x, options.frontY - extent), false);
      assert.equal(contour.incomingAt(x, options.frontY + extent), true);
    }
  }
  assert.equal(buildTransitionContour({ ...options, variant: 'ink' }).path, saved);
  assert.notEqual(buildTransitionContour({ ...options, seed: 'another-chapter', variant: 'ink' }).path, saved);
});

test('malformed dimensions and scroll positions cannot leak invalid SVG values', () => {
  for (const value of [NaN, Infinity, -Infinity, -10, 0]) for (const variant of variants) {
    const contour = buildTransitionContour({ width: value, height: value, frontY: value, seed: 0, variant });
    assert.doesNotMatch(contour.path, /NaN|Infinity|undefined/);
    assert.ok(Number.isFinite(contour.frontierAt(value)));
    assert.equal(typeof contour.incomingAt(value, value), 'boolean');
  }
});
