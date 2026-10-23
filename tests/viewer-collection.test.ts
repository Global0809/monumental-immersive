import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createJourney,
  getViewer,
  MAX_SAVED_JOURNEYS,
  removeJourney,
  saveProgress,
  togglePlace,
  toggleSaved,
  updateViewer,
} from '../src/services/viewer.ts';

const stored = new Map<string, string>();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
    },
  },
});
const persisted = () => JSON.parse(stored.get('monumental.viewer.v1')!);

test('a full journey collection rejects a new save without losing existing journeys', () => {
  updateViewer({ journeys: Array.from({ length: MAX_SAVED_JOURNEYS - 1 }, (_, index) => ({
    id: `journey-${index}`, name: `Journey ${index}`, videoIds: ['miami-frequency'],
  })) });
  const last = createJourney('Last available space', ['miami-frequency']);
  assert.ok(last);
  assert.equal(getViewer().journeys.length, MAX_SAVED_JOURNEYS);
  assert.equal(persisted().journeys.at(-1).id, last.id);

  const fullCollection = getViewer();
  const fullStorage = stored.get('monumental.viewer.v1');
  assert.equal(createJourney('Cannot fit', ['miami-frequency']), null);
  assert.equal(getViewer(), fullCollection);
  assert.equal(stored.get('monumental.viewer.v1'), fullStorage);

  removeJourney('journey-0');
  const retried = createJourney('Now there is room', ['miami-frequency']);
  assert.ok(retried);
  assert.equal(getViewer().journeys.length, MAX_SAVED_JOURNEYS);
  assert.equal(persisted().journeys.at(-1).id, retried.id);
});

test('progress and sound writes keep unchanged collection identities and persist the new values', () => {
  updateViewer({
    saved: ['miami-frequency'], savedPlaces: ['miami'], interests: ['Music'],
    journeys: [{ id: 'music', name: 'Music in Miami', videoIds: ['miami-frequency'] }],
    moments: [{ id: 'moment', videoId: 'miami-frequency', time: 2, note: 'Opening', createdAt: 1 }],
    history: {}, sound: false,
  });
  const before = getViewer();
  saveProgress('miami-frequency', 3, 30.278);
  const afterProgress = getViewer();
  for (const key of ['saved', 'savedPlaces', 'journeys', 'interests', 'moments'] as const) {
    assert.equal(afterProgress[key], before[key], `${key} should not rebuild for progress`);
  }
  assert.notEqual(afterProgress.history, before.history);
  assert.equal(persisted().history['miami-frequency'].time, 3);

  const afterSound = updateViewer({ sound: true, masterVolume: 0.32 });
  for (const key of ['saved', 'savedPlaces', 'journeys', 'interests', 'moments', 'history'] as const) {
    assert.equal(afterSound[key], afterProgress[key], `${key} should not rebuild for sound`);
  }
  assert.equal(persisted().sound, true);
  assert.equal(persisted().masterVolume, 0.32);
});

test('explicit collection changes still validate, persist, and leave the previous snapshot intact', () => {
  updateViewer({ saved: ['miami-frequency'], savedPlaces: ['miami'] });
  const before = getViewer();
  assert.equal(toggleSaved('miami-frequency'), false);
  assert.equal(togglePlace('london'), true);
  assert.deepEqual(before.saved, ['miami-frequency']);
  assert.deepEqual(before.savedPlaces, ['miami']);
  assert.deepEqual(persisted().saved, []);
  assert.deepEqual(persisted().savedPlaces, ['miami', 'london']);

  const normalized = updateViewer({ saved: ['miami-frequency', 'miami-frequency'], moments: undefined });
  assert.deepEqual(normalized.saved, ['miami-frequency']);
  assert.deepEqual(normalized.moments, []);
  assert.deepEqual(persisted().moments, []);
});
