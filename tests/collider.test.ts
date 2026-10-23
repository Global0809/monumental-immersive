import test from 'node:test';
import assert from 'node:assert/strict';
import { videos } from '../src/data/catalogue.ts';
import { collideCultures, cultureTokens, nearbyCollisions } from '../src/services/collider.ts';

test('two interests intersect against playable catalogue content', () => {
  const result = collideCultures('miami', 'music');
  assert.equal(result.kind, 'intersection');
  assert.deepEqual(result.films.map(v => v.id), ['miami-frequency']);
});
test('music and fashion pairing names the actual shared collection', () => {
  const result = collideCultures('music', 'fashion');
  assert.equal(result.kind, 'collection');
  assert.equal(result.films.length, 2);
  assert.equal(result.films[0].series, result.films[1].series);
  assert.match(result.explanation, /not a claim of historical influence/);
});
test('unsupported pairs and invalid interests do not fabricate a relationship', () => {
  for (const pair of [['design', 'independent-film'], ['miami', 'miami'], ['missing', 'music']]) {
    assert.equal(collideCultures(pair[0], pair[1]).kind, 'empty');
    assert.equal(collideCultures(pair[0], pair[1]).films.length, 0);
  }
});
test('every suggested alternative produces actual results', () => {
  for (const token of cultureTokens) {
    for (const candidate of nearbyCollisions(token.id, 'independent-film')) {
      assert.notEqual(candidate.id, token.id);
      assert.ok(collideCultures(token.id, candidate.id).films.length);
    }
  }
});
test('unreleased programmes and missing media never enter playable collisions', () => {
  const altered = videos.map(v => ({ ...v, status: 'development' as const }));
  assert.equal(collideCultures('miami', 'music', altered).films.length, 0);
  assert.equal(collideCultures('miami', 'music', videos.map(v => ({...v, src: undefined}))).films.length, 0);
});
test('historical subject is different from a fiction film release date', () => {
  assert.equal(collideCultures('history', 'independent-film').films.length, 0);
  assert.deepEqual(collideCultures('history', 'miami').films.map(v => v.id), ['concrete-and-colour']);
});
