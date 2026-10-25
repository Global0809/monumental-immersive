import test from 'node:test';
import assert from 'node:assert/strict';
import { spatialRoomForPath, spatialPortals } from '../src/services/spatial.ts';
import { immersiveExperienceUrl } from '../src/services/experienceUrl.ts';

test('the spatial world maps existing routes to rooms without changing routes or film identities', () => {
  assert.equal(spatialRoomForPath('/'), 'atrium');
  assert.equal(spatialRoomForPath('/film/miami-frequency'), 'movies');
  assert.equal(spatialRoomForPath('/world'), 'world');
  assert.equal(spatialRoomForPath('/time-machine'), 'time-machine');
  assert.equal(spatialRoomForPath('/category/music'), 'music');
  assert.equal(spatialRoomForPath('/category/kids'), 'culture');
  assert.equal(spatialRoomForPath('/journey'), 'my-world');
  assert.notEqual(spatialRoomForPath('/missing-page'), 'atrium', 'NotFound retains interactive recovery links and navigation');
  assert.equal(new Set(spatialPortals.map(portal => portal.id)).size, spatialPortals.length);
});
test('legacy mode links enter the immersive site without losing subdirectory paths, filters or timestamps', () => {
  assert.equal(immersiveExperienceUrl('/', '?experience=classic', '#/'), '/#/');
  assert.equal(immersiveExperienceUrl('/monumental-immersive/', '?review=transitions&experience=classic', '#/film/sintel?t=8'), '/monumental-immersive/?review=transitions#/film/sintel?t=8');
  assert.equal(immersiveExperienceUrl('/', '?experience=classic&experience=immersive', '#/search?place=miami'), '/#/search?place=miami');
  assert.equal(immersiveExperienceUrl('/', '', '#/world'), null);
  assert.equal(immersiveExperienceUrl('/', '?review=transitions', '#/'), null);
});
