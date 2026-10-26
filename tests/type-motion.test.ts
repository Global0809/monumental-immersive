import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typePressure, typeWordAt } from '../src/services/typeMotion';

test('type targeting follows DOM offsets across international names and punctuation', () => {
  assert.deepEqual(typeWordAt('São Paulo', 1), [0, 3]);
  assert.deepEqual(typeWordAt('Don’t expire.', 3), [0, 5]);
  assert.deepEqual(typeWordAt('🎬 東京', 3), [3, 5]);
  assert.deepEqual(typeWordAt('e\u0301lan', 1), [0, 5]);
  assert.equal(typeWordAt('   ', 1), null);
  assert.equal(typeWordAt('Cinema', -1), null);
  assert.equal(typeWordAt('Cinema', 7), null);
  assert.deepEqual(typeWordAt('Cinema', 6), [0, 6]);
});

test('type pressure remains bounded for small targets and off-target pointers', () => {
  assert.deepEqual(typePressure(100, 25, 200, 50), { x: 0, y: 0, angle: 0 });
  for (const [x, y, w, h] of [[-1000, 9000, 200, 40], [100, 100, 0, 0], [0, 0, 300, 60]]) {
    const field = typePressure(x, y, w, h);
    assert.ok(Number.isFinite(field.x) && Math.abs(field.x) <= 5);
    assert.ok(Number.isFinite(field.y) && Math.abs(field.y) <= 3);
    assert.ok(Number.isFinite(field.angle) && Math.abs(field.angle) <= 3.5);
  }
});
