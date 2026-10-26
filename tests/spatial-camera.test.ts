import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { cameraEase, doorwayFlight, doorwayPose, portalPositions } from '../src/components/spatial/cameraPath';
import { createAtmosphere } from '../src/components/spatial/atmosphere';

test('every portal flight arrives at its persistent room composition on desktop and mobile', () => {
  for (const mobile of [false, true]) for (let i = 0; i < portalPositions.length; i++) {
    const room = doorwayPose(i, mobile);
    const path = doorwayFlight(new Vector3(0, 2.65, 5.1), room.position, i);
    assert.ok(path.getPoint(cameraEase(1)).distanceTo(room.position) < 1e-10);
    assert.ok(room.target.distanceTo(new Vector3(...portalPositions[i])) < 1e-10);
    const front = new Vector3(0, 2.05, 4.5).sub(room.target).normalize();
    assert.ok(room.position.clone().sub(room.target).dot(front) > 5, 'arrival remains in front of the screen');
  }
});
test('camera easing never reverses, overshoots or snaps at arrival', () => {
  assert.equal(cameraEase(-1), 0); assert.equal(cameraEase(2), 1);
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const value = cameraEase(i / 1000);
    assert.ok(value >= previous && value <= 1);
    previous = value;
  }
  assert.ok(cameraEase(.001) < 1e-7);
  assert.ok(1 - cameraEase(.999) < 1e-7);
});
test('central doorway paths pass beside the sculpture and retarget from the actual camera', () => {
  const start = new Vector3(0, 2.65, 5.1);
  for (const i of [2, 3]) {
    const path = doorwayFlight(start, doorwayPose(i, false).position, i);
    for (let p = 0; p <= 1; p += .01) {
      const point = path.getPoint(p);
      assert.ok(Math.hypot(point.x, point.z + 11.7) > 2.65, 'path clears the chrome sculpture');
    }
    const interrupted = path.getPoint(.46);
    const replacement = doorwayFlight(interrupted, doorwayPose(0, false).position, 0);
    assert.ok(replacement.getPoint(0).equals(interrupted));
  }
});
test('atmosphere is deterministic, depth tested and bounded for device quality', () => {
  const a = createAtmosphere(), b = createAtmosphere();
  assert.deepEqual(a.points.geometry.attributes.position.array, b.points.geometry.attributes.position.array);
  assert.equal(a.points.material.depthTest, true);
  assert.equal(a.points.material.depthWrite, false);
  for (const [mobile, quality, expected] of [[false,'light',100],[true,'balanced',150],[false,'balanced',240],[false,'detail',320]] as const) {
    a.configure(700, 1.5, mobile, quality, 55);
    assert.equal(a.points.geometry.drawRange.count, expected);
  }
  a.dispose(); b.dispose();
});
