import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionAnchor } from '../src/services/transitionLayout.ts';

test('chapter travel is physical page travel, with clean visible endpoints', () => {
  const result = transitionAnchor(1800, 700, 200, 6000)!;
  assert.equal(result.anchor, 1800);
  assert.equal(result.anchor - result.startY, 900);
  assert.equal(result.anchor - result.endY, -200);
  for (const scroll of [result.startY, 1200, 1400, result.endY]) {
    const delta = 73.25;
    assert.equal((result.anchor - scroll) - (result.anchor - (scroll + delta)), delta);
  }
});

test('nearby chapter transitions overlap naturally without rescaling or shifting each other', () => {
  const a = transitionAnchor(1800, 700, 200, 6000)!;
  const b = transitionAnchor(2300, 700, 200, 6000, a.anchor)!;
  assert.equal(b.anchor, 2300);
  assert.ok(b.startY < a.endY);
  assert.equal(transitionAnchor(1810, 700, 200, 6000, a.anchor), null);
});

test('short pages stay short and bottom chapters finish without a partial edge', () => {
  assert.equal(transitionAnchor(350, 700, 200, 500), null);
  const first = transitionAnchor(300, 700, 200, 4000)!;
  assert.equal(first.startY, 24);
  const last = transitionAnchor(3900, 700, 200, 4000)!;
  assert.equal(last.endY, 4000);
});
