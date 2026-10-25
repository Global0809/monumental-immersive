import test from 'node:test';
import assert from 'node:assert/strict';
import { videos, type Video } from '../src/data/catalogue.ts';
import { filterVideos } from '../src/services/discovery.ts';
import { isLocalMediaSource, playableQueueAfter } from '../src/services/mediaPreview.ts';

test('availability separates playable catalogue records from planned programmes', () => {
  const available = filterVideos({ status: 'available', access: 'free' });
  const development = filterVideos({ status: 'development' });
  assert.ok(available.length > 0 && development.length > 0);
  assert.ok(available.every(item => item.status === 'available' && item.access === 'free'));
  assert.ok(development.every(item => item.status === 'development'));
  assert.equal(filterVideos({ status: 'development', duration: 'short' }).length, 0);
  assert.ok(filterVideos({ q: 'full film', status: 'available' }).every(item => item.tags.includes('full film')));
});

test('local preview eligibility works on both root and subdirectory hosting', () => {
  assert.equal(isLocalMediaSource('/media/sintel.mp4'), true);
  assert.equal(isLocalMediaSource('/monumental-immersive/media/sintel.mp4?rev=1'), true);
  assert.equal(isLocalMediaSource('https://video.example/media/film.mp4'), false);
  assert.equal(isLocalMediaSource('//video.example/media/film.mp4'), false);
  assert.equal(isLocalMediaSource('/poster.jpg?redirect=/media/film.mp4'), false);
  assert.equal(isLocalMediaSource(undefined), false);
});

test('auto-continue skips missing media and unplayable planned or premium stops', () => {
  const film = videos.find(item => item.id === 'sintel')!;
  const next = videos.find(item => item.id === 'big-buck-bunny')!;
  const queue: Video[] = [film, { ...film, id: 'planned', status: 'development' }, { ...film, id: 'premium', access: 'premium' }, { ...film, id: 'missing-source', src: undefined }, next];
  assert.deepEqual(playableQueueAfter(queue, film.id).map(item => item.id), [next.id]);
  assert.deepEqual(playableQueueAfter(queue, next.id), []);
  assert.deepEqual(playableQueueAfter(queue, 'unrelated'), []);
});
