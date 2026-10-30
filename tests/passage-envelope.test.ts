import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { passageBayExpansion, passageLiningRadius } from '../src/services/passageEnvelope.ts';
import { tunnelStationZ } from '../src/services/tunnelJourney.ts';
import { liningIntersection } from '../src/components/spatial/tunnelCutaway.ts';

test('each carrier has a continuous physical bay, without changing the opening tunnel', () => {
  assert.equal(passageBayExpansion(14), 0);
  assert.equal(passageBayExpansion(-7), 0);
  for (let index = 0; index < 6; index++) {
    const center = tunnelStationZ(index);
    for (let z = center - 10; z <= center + 10; z += .25) assert.equal(passageBayExpansion(z), 4.4);
    for (let z = center - 23; z < center + 23; z += .05) {
      assert.ok(Math.abs(passageBayExpansion(z + .05) - passageBayExpansion(z)) < .04, 'no discontinuous wall step');
    }
  }
});

test('inspection meets expanded station walls and transition walls rather than the old cylinder', () => {
  const point = new THREE.Vector3();
  for (let index = 0; index < 6; index++) for (const offset of [-12, 0, 13]) for (const side of [-1, 1]) {
    const origin = new THREE.Vector3(.16, .2, tunnelStationZ(index) + offset);
    const ray = new THREE.Ray(origin, new THREE.Vector3(side, .25, -.2).normalize());
    assert.equal(liningIntersection(ray, point), true);
    assert.ok(ray.distanceToPoint(point) < 1e-8);
    assert.ok(Math.abs(Math.hypot(point.x, point.y) - passageLiningRadius(point.z)) < .0001);
    assert.ok(Math.hypot(point.x, point.y) > 10, 'expanded bay is actually selected');
  }
});
