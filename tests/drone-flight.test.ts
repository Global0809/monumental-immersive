import test from 'node:test';
import assert from 'node:assert/strict';
import { DRONE_SERVICE_PERIOD, droneActivity, droneServiceMember, sampleDroneFlight, separateDroneTargets, type DroneActivity, type DroneFlightSample } from '../src/services/droneBehaviour.ts';

const flight = (): DroneFlightSample => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
const activity = (): DroneActivity => ({ state: 'fly', perch: 0, inspect: 0, signal: 0 });

test('authored patrol has substantial spatial range, continuous position and velocity, and no allocation per sample', () => {
  const output = flight(), previous = flight();
  for (let member = 0; member < 4; member++) {
    let lowX = Infinity, highX = -Infinity, lowZ = Infinity, highZ = -Infinity;
    for (let frame = 0; frame <= 2640; frame++) {
      const time = frame / 120;
      assert.equal(sampleDroneFlight(time, member, output), output);
      for (const value of Object.values(output)) assert.ok(Number.isFinite(value));
      assert.ok(Math.abs(output.x) < 1.6 && Math.abs(output.y) < 1.2 && Math.abs(output.z) < 1.6);
      assert.ok(Math.hypot(output.vx, output.vy, output.vz) < 1.5, 'authored acceleration does not introduce sudden darts');
      if (frame) {
        assert.ok(Math.hypot(output.x - previous.x, output.y - previous.y, output.z - previous.z) < .02);
        assert.ok(Math.hypot(output.vx - previous.vx, output.vy - previous.vy, output.vz - previous.vz) < .025);
      }
      lowX = Math.min(lowX, output.x); highX = Math.max(highX, output.x); lowZ = Math.min(lowZ, output.z); highZ = Math.max(highZ, output.z);
      Object.assign(previous, output);
    }
    assert.ok(highX - lowX > 1.8, 'the route visibly traverses space instead of hovering in place');
    assert.ok(highZ - lowZ > 1.8, 'depth excursions create natural changes in scale');
  }
  assert.deepEqual(sampleDroneFlight(0, 0, flight()), sampleDroneFlight(22, 0, flight()), 'leader route closes without a position or tangent seam');
  assert.deepEqual(sampleDroneFlight(NaN, NaN, flight()), sampleDroneFlight(0, 0, flight()));
});

test('adults follow the leader with delay while young scouts make independent curved excursions', () => {
  const a = sampleDroneFlight(6.9, 0, flight()), b = sampleDroneFlight(8, 1, flight());
  for (const key of Object.keys(a) as (keyof DroneFlightSample)[]) assert.ok(Math.abs(a[key] - b[key]) < 1e-12);
  const young = sampleDroneFlight(8, 2, flight()), parent = sampleDroneFlight(6.5, 0, flight());
  assert.ok(Math.hypot(young.x - parent.x, young.y - parent.y, young.z - parent.z) > .2);
  assert.deepEqual(sampleDroneFlight(8, 2, flight()), young, 'returning to the same time gives the same authored pose');
});

test('short service visits leave the first nine seconds and most of the journey airborne', () => {
  const output = activity(); let serviceFrames = 0;
  for (let frame = 0; frame < DRONE_SERVICE_PERIOD * 4 * 100; frame++) {
    const time = frame / 100; let busy = 0;
    for (let member = 0; member < 4; member++) {
      assert.equal(droneActivity(time, member, output), output);
      if (output.state !== 'fly') { busy++; assert.equal(member, droneServiceMember(time)); }
      if (time < 9) assert.equal(output.state, 'fly');
      for (const value of [output.perch, output.inspect, output.signal]) assert.ok(value >= 0 && value <= 1);
    }
    assert.ok(busy <= 1); if (busy) serviceFrames++;
  }
  assert.ok(serviceFrames / (DRONE_SERVICE_PERIOD * 4 * 100) < .28, 'no more than 28% of group time is spent tending a mechanism');
  for (const boundary of [9, 11, 12.4, 13.2, 16, 26]) {
    const before = { ...droneActivity(boundary - .0001, 0, output) }, after = droneActivity(boundary + .0001, 0, output);
    assert.ok(Math.abs(before.perch - after.perch) < .001, 'service transitions cannot teleport a drone');
  }
});

test('separation resolves intersecting targets without moving their shared center or depth', () => {
  const points = [{ x: 0, y: 0, z: .3 }, { x: 0, y: 0, z: -.4 }];
  const first = points[0], second = points[1];
  separateDroneTargets(points, [.4, .3]);
  assert.equal(points[0], first); assert.equal(points[1], second);
  assert.ok(Math.hypot(first.x - second.x, first.y - second.y) >= .7 - 1e-12);
  assert.equal(first.x + second.x, 0); assert.equal(first.y + second.y, 0);
  assert.equal(first.z, .3); assert.equal(second.z, -.4);
  const unchanged = structuredClone(points); separateDroneTargets(points, [.4, .3]); assert.deepEqual(points, unchanged);
});
