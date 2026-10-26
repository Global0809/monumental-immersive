import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TUNNEL_STATION_IDS, TUNNEL_SPACING,
  tunnelStationZ, tunnelReadingZ, tunnelChapterZ, tunnelCompact,
  tunnelGateOpen, getTunnelInspection, setTunnelInspection, subscribeTunnelInspection,
} from '../src/services/tunnelJourney';
import { spatialPortals } from '../src/services/spatial';

const near = (actual: number, expected: number, message: string, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} ≠ ${expected}`);
};

test('six route stations have distinct ordered positions and readable camera clearance', () => {
  assert.equal(TUNNEL_STATION_IDS.length, 6);
  assert.equal(new Set(TUNNEL_STATION_IDS).size, 6);
  assert.deepEqual([...TUNNEL_STATION_IDS], spatialPortals.map(portal => portal.id));
  const stations = TUNNEL_STATION_IDS.map((_, index) => tunnelStationZ(index));
  const readings = TUNNEL_STATION_IDS.map((_, index) => tunnelReadingZ(index));
  assert.equal(new Set(stations).size, 6);
  assert.equal(new Set(readings).size, 6);
  for (let index = 0; index < stations.length; index++) {
    assert.ok(Number.isFinite(stations[index]) && Number.isFinite(readings[index]));
    assert.ok(readings[index] > stations[index], 'reading position stays in front of its station');
    assert.ok(readings[index] - stations[index] < TUNNEL_SPACING, 'reading position cannot overlap the preceding station');
    if (index) {
      assert.ok(stations[index] < stations[index - 1]);
      assert.ok(readings[index] < readings[index - 1]);
      near(stations[index - 1] - stations[index], TUNNEL_SPACING, 'stations use consistent physical separation');
    }
  }
});

test('approach, reading and departure boundaries join continuously through every station', () => {
  const epsilon = 1e-8;
  for (let index = 0; index < TUNNEL_STATION_IDS.length; index++) {
    near(tunnelChapterZ(index, .38), tunnelReadingZ(index), 'approach reaches the shared reading position');
    for (const boundary of [.38, .74]) {
      const atBoundary = tunnelChapterZ(index, boundary);
      near(tunnelChapterZ(index, boundary - epsilon), atBoundary, 'no jump entering a phase', 1e-5);
      near(tunnelChapterZ(index, boundary + epsilon), atBoundary, 'no jump leaving a phase', 1e-5);
    }
    if (index + 1 < TUNNEL_STATION_IDS.length) {
      near(tunnelChapterZ(index, 1), tunnelChapterZ(index + 1, 0), 'chapter handoff keeps the same camera position');
    }
  }
});

test('native scroll advances monotonically and reversing it retraces the same positions', () => {
  const samples = TUNNEL_STATION_IDS.flatMap((_, index) =>
    Array.from({ length: 101 }, (_, step) => ({ index, progress: step / 100 })),
  );
  const forward = samples.map(({ index, progress }) => tunnelChapterZ(index, progress));
  for (let index = 0; index < forward.length; index++) {
    assert.ok(Number.isFinite(forward[index]));
    if (index) assert.ok(forward[index] <= forward[index - 1], 'forward scrolling never moves backward');
  }
  assert.ok(forward.at(-1)! < forward[0], 'the journey makes spatial progress');
  const reverse = [...samples].reverse().map(({ index, progress }) => tunnelChapterZ(index, progress));
  assert.deepEqual(reverse, [...forward].reverse(), 'return travel has no hysteresis or hidden state');
  for (let index = 1; index < reverse.length; index++) {
    assert.ok(reverse[index] >= reverse[index - 1], 'reverse scrolling never moves forward');
  }
});

test('the final chapter holds its reading position instead of exiting into empty space', () => {
  const finalIndex = TUNNEL_STATION_IDS.length - 1;
  const hold = tunnelChapterZ(finalIndex, .74);
  assert.ok(hold > tunnelStationZ(finalIndex), 'the final panel stays in front of the camera');
  assert.ok(hold <= tunnelReadingZ(finalIndex), 'the hold follows the reading approach');
  for (let step = 74; step <= 100; step++) {
    near(tunnelChapterZ(finalIndex, step / 100), hold, 'the final departure phase is stationary');
  }
  assert.ok(tunnelChapterZ(finalIndex - 1, 1) < tunnelChapterZ(finalIndex - 1, .74), 'earlier chapters still advance toward the next station');
});

test('out-of-range chapter progress clamps at its physical endpoints', () => {
  for (let index = 0; index < TUNNEL_STATION_IDS.length; index++) {
    for (const progress of [-Infinity, -100, -1, -.001]) {
      assert.equal(tunnelChapterZ(index, progress), tunnelChapterZ(index, 0));
    }
    for (const progress of [1.001, 2, 100, Infinity]) {
      assert.equal(tunnelChapterZ(index, progress), tunnelChapterZ(index, 1));
    }
  }
});

test('compact mode responds independently to width, height and reduced motion', () => {
  assert.equal(tunnelCompact(980, 660), false, 'the desktop boundary remains desktop');
  assert.equal(tunnelCompact(979, 1080), true, 'narrow screens receive the compact layout');
  assert.equal(tunnelCompact(1920, 659), true, 'short screens receive the compact layout');
  assert.equal(tunnelCompact(979, 659), true);
  assert.equal(tunnelCompact(1920, 1080), false);
  assert.equal(tunnelCompact(1920, 1080, true), true, 'reduced motion uses compact mode regardless of viewport');
});

test('gates clear the camera before passage and reverse deterministically', () => {
  for (const gate of [-27, -61, -197]) {
    assert.equal(tunnelGateOpen(gate + 23, gate), 0);
    for (let distance = 10; distance >= -7; distance--) assert.equal(tunnelGateOpen(gate + distance, gate), 1);
    assert.equal(tunnelGateOpen(gate - 19, gate), 0);
    const positions = Array.from({ length: 161 }, (_, i) => gate + 30 - i * .4);
    const values = positions.map(position => tunnelGateOpen(position, gate));
    assert.ok(values.every(value => value >= 0 && value <= 1));
    assert.deepEqual([...positions].reverse().map(position => tunnelGateOpen(position, gate)), [...values].reverse());
    for (let i = 1; i < values.length; i++) assert.ok(Math.abs(values[i] - values[i - 1]) < .06, 'gate motion has no position discontinuity');
  }
  assert.equal(tunnelGateOpen(NaN, 0), 0);
});

test('inspection has one owner, bounded rotation, and no updates after unsubscribe', () => {
  setTunnelInspection({ station: null, expanded: false, rotation: 0 });
  let notifications = 0;
  const unsubscribe = subscribeTunnelInspection(() => notifications++);
  try {
    setTunnelInspection({ station: 'world', expanded: true, rotation: 0 });
    const stable = getTunnelInspection();
    setTunnelInspection({ station: 'world', expanded: true, rotation: 0 });
    assert.equal(getTunnelInspection(), stable);
    assert.equal(notifications, 1);
    setTunnelInspection({ station: 'music', expanded: true, rotation: 100 });
    assert.deepEqual(getTunnelInspection(), { station: 'music', expanded: true, rotation: Math.PI });
    setTunnelInspection({ station: 'music', expanded: true, rotation: NaN });
    assert.equal(getTunnelInspection().rotation, 0);
    setTunnelInspection({ station: 'unknown', expanded: true, rotation: 1 });
    assert.deepEqual(getTunnelInspection(), { station: null, expanded: false, rotation: 0 });
    unsubscribe();
    const count = notifications;
    setTunnelInspection({ station: 'culture', expanded: true, rotation: -.3 });
    assert.equal(notifications, count);
  } finally {
    unsubscribe();
    setTunnelInspection({ station: null, expanded: false, rotation: 0 });
  }
});
