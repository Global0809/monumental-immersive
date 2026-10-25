import test from 'node:test';
import assert from 'node:assert/strict';
import { videos, places, periods } from '../src/data/catalogue.ts';
import { createDiscoveryContext, parseDiscoveryAnswer } from '../src/platform/discovery-context.ts';

const context = createDiscoveryContext({ revision: 'test-1', videos, places, periods });
const valid = () => ({ schemaVersion: 1, catalogueRevision: 'test-1', recommendations: [
  { storyId: 'miami-frequency', reason: 'An illustrated introduction to Miami.', sourceIds: ['miami-frequency'] },
] });

test('public grounding preserves credits and time distinctions, omitting media and private fields', () => {
  const miami = context.sources.find(source => source.id === 'miami-frequency')!;
  assert.equal(miami.credit, videos.find(video => video.id === miami.id)!.credit);
  assert.equal(miami.period.id, videos.find(video => video.id === miami.id)!.period);
  assert.equal(miami.publishedAt, '2026-10-20');
  assert.equal(context.sources.length, videos.length);
  const source = JSON.stringify(context);
  for (const field of ['"src":', '"captions":', '"history":', '"moments":', '"account":']) assert.ok(!source.includes(field));
  assert.equal(context.sources.find(source => source.id === 'wavemakers-valid-id')!.status, 'development');
});

test('future discovery answers reject stale revisions, invented references, duplicates and unreleased films', () => {
  assert.equal(parseDiscoveryAnswer(valid(), context).recommendations.length, 1);
  assert.throws(() => parseDiscoveryAnswer({ ...valid(), catalogueRevision: 'old' }, context));
  for (const change of [
    { storyId: 'imaginary-film' }, { storyId: 'wavemakers-valid-id' },
    { sourceIds: ['invented-source'] }, { sourceIds: [] }, { reason: '' },
  ]) assert.throws(() => parseDiscoveryAnswer({ ...valid(), recommendations: [{ ...valid().recommendations[0], ...change }] }, context));
  assert.throws(() => parseDiscoveryAnswer({ ...valid(), recommendations: [...valid().recommendations, ...valid().recommendations] }, context));
});

test('grounding validation never accepts generated external actions and does not authorize paid access', () => {
  const response = valid();
  const parsed = parseDiscoveryAnswer({ ...response, actions: ['purchase'], recommendations: [
    { ...response.recommendations[0], url: 'https://untrusted.example', canWatch: true },
  ] }, context);
  assert.deepEqual(parsed, response);
  const paid = { ...context, sources: context.sources.map(source => ({ ...source, access: 'premium' as const })) };
  assert.deepEqual(parseDiscoveryAnswer(response, paid), response);
});
