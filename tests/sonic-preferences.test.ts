import test from 'node:test';
import assert from 'node:assert/strict';
import { getViewer, updateViewer } from '../src/services/viewer.ts';

test('new sound preferences are silent by default and finite', () => {
  const viewer = getViewer();
  assert.equal(viewer.sound, false);
  assert.equal(viewer.ambient, false);
  assert.equal(viewer.masterVolume, 0.45);
  assert.equal(viewer.ambientMix, 0.2);
});
test('old saved viewer records acquire conservative sound defaults', () => {
  const next = updateViewer({ saved: ['existing-story'], sound: true, masterVolume: undefined, ambientMix: undefined, ambient: undefined });
  assert.deepEqual(next.saved, ['existing-story']);
  assert.equal(next.sound, true);
  assert.equal(next.masterVolume, 0.45);
  assert.equal(next.ambientMix, 0.2);
  assert.equal(next.ambient, false);
});
test('corrupt or out-of-range audio settings never escape their bounds', () => {
  assert.equal(updateViewer({ masterVolume: Infinity }).masterVolume, 0.45);
  assert.equal(updateViewer({ ambientMix: NaN }).ambientMix, 0.2);
  assert.equal(updateViewer({ masterVolume: 25 }).masterVolume, 1);
  assert.equal(updateViewer({ ambientMix: -8 }).ambientMix, 0);
  const stable = updateViewer({ masterVolume: 0.29, ambientMix: 0.14, ambient: true });
  assert.equal(stable.masterVolume, 0.29);
  assert.equal(stable.ambientMix, 0.14);
  assert.equal(stable.ambient, true);
});
