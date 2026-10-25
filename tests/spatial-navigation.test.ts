import test from 'node:test';
import assert from 'node:assert/strict';
import { spatialRoomForPath, spatialEnabled, classicExperienceHref, spatialPortals } from '../src/services/spatial.ts';

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
test('classic website escape retains deep links and independent review parameters', () => {
  assert.equal(spatialEnabled(''), true);
  assert.equal(spatialEnabled('?experience=classic'), false);
  assert.equal(classicExperienceHref('?review=transitions','#/film/sintel?t=8'), '?review=transitions&experience=classic#/film/sintel?t=8');
  assert.equal(classicExperienceHref('', ''), '?experience=classic#/');
});
