import test from 'node:test';
import assert from 'node:assert/strict';
import { spatialPassagePlan } from '../src/services/spatialNavigation';
import { doorwayPose, observatoryPose, roomFlight } from '../src/components/spatial/cameraPath';
import { go, commitRoute } from '../src/services/router';

test('filters remain local while distinct rooms receive a bounded spatial journey', () => {
  assert.equal(spatialPassagePlan('/world?place=miami', '/world?place=london').duration, 0);
  assert.equal(spatialPassagePlan('/search?q=film', '/search?q=music').changed, false);
  assert.equal(spatialPassagePlan('/category/movies', '/film/sintel').crossRoom, false);
  assert.equal(spatialPassagePlan('/category/movies', '/film/sintel').duration, 230);
  for (const from of ['/', '/world', '/time-machine', '/category/movies', '/my-world']) {
    for (const to of ['/', '/world', '/category/music', '/my-world']) {
      const plan = spatialPassagePlan(from, to);
      assert.ok(plan.duration <= 1000);
      assert.equal(spatialPassagePlan(from, to, true).duration, 0);
    }
  }
});

test('cross-room and return paths start at the rendered pose and end at the resting pose', () => {
  for (const mobile of [false, true]) {
    const positions = [observatoryPose(mobile).position, ...Array.from({length:6}, (_, i) => doorwayPose(i, mobile).position)];
    for (const from of positions) for (const to of positions) {
      const curve = roomFlight(from, to);
      assert.ok(curve.getPoint(0).equals(from));
      assert.ok(curve.getPoint(1).distanceTo(to) < 1e-10);
      const interrupted = curve.getPoint(.43);
      assert.ok(roomFlight(interrupted, to).getPoint(0).equals(interrupted));
      for (let i=0;i<=20;i++) assert.ok(curve.getPoint(i/20).toArray().every(Number.isFinite));
    }
  }
});

test('a cancelled navigation intent does not mutate history; its commit runs once without recursion', () => {
  const events = new EventTarget();
  const location = { hash: '#/world' };
  Object.defineProperty(globalThis, 'window', { configurable:true, value:events });
  Object.defineProperty(globalThis, 'location', { configurable:true, value:location });
  let intents = 0;
  const intercept = (event: Event) => { intents++; event.preventDefault(); };
  events.addEventListener('monumental:navigate', intercept);
  try {
    go('/time-machine', { era:'1970s' });
    assert.equal(location.hash, '#/world');
    commitRoute('/time-machine', { era:'1970s' });
    assert.equal(location.hash, '/time-machine?era=1970s');
    assert.equal(intents, 1);
    events.removeEventListener('monumental:navigate', intercept);
    go('/world', { place:'london' });
    assert.equal(location.hash, '/world?place=london');
  } finally { Reflect.deleteProperty(globalThis, 'window'); Reflect.deleteProperty(globalThis, 'location'); }
});
