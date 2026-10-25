import test from 'node:test';
import assert from 'node:assert/strict';
import { videos } from '../src/data/catalogue.ts';
import { emptyJourneyDraft, JOURNEY_DRAFT_KEY, readJourneyDraft, validateJourneyDraft, writeJourneyDraft } from '../src/services/journeyDraft.ts';

const saved = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) } });

test('journey drafts retain chosen film order, name and saved identity across navigation', () => {
  const draft = { ...emptyJourneyDraft(), videoIds: ['island-current', 'miami-frequency'], name: 'My route', generated: true, editingId: 'saved-journey' };
  assert.equal(writeJourneyDraft(draft), true);
  assert.deepEqual(readJourneyDraft(), draft);
});

test('draft validation rejects invented or unplayable references and bounds user-controlled fields', () => {
  const unavailable = videos.find(video => video.status !== 'available');
  const draft = validateJourneyDraft({ name: 'x'.repeat(300), minutes: Infinity, journeyMinutes: -4, mood: 'invented', place: 'invented', videoIds: ['missing', unavailable?.id, 'miami-frequency', 'miami-frequency'], editingId: 'x'.repeat(200) });
  assert.ok(draft);
  assert.equal(draft.name.length, 80);
  assert.equal(draft.minutes, 5);
  assert.equal(draft.journeyMinutes, 5);
  assert.equal(draft.mood, 'Music');
  assert.deepEqual(draft.videoIds, ['miami-frequency']);
  assert.equal(draft.editingId, null);
});

test('corrupt and oversized draft storage fails safely without discarding saved journeys', () => {
  saved.set(JOURNEY_DRAFT_KEY, '{broken');
  assert.equal(readJourneyDraft(), null);
  saved.set(JOURNEY_DRAFT_KEY, 'x'.repeat(20001));
  assert.equal(readJourneyDraft(), null);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => { throw new Error('Unavailable'); }, setItem: () => { throw new Error('Quota'); } } });
  assert.equal(readJourneyDraft(), null);
  assert.equal(writeJourneyDraft(emptyJourneyDraft()), false);
});
