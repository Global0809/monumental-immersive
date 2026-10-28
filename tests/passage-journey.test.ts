import test from 'node:test';
import assert from 'node:assert/strict';
import { PASSAGE_CHAPTERS, type PassageVector } from '../src/services/passageChapters.ts';
import { passagePose, passageStationMotion, passageWeaveMask, passageContentOpacity, passageReading, PASSAGE_READING_START, PASSAGE_READING_END } from '../src/services/passageJourney.ts';
import { TUNNEL_STATION_IDS, tunnelReadingZ } from '../src/services/tunnelJourney.ts';
import { spatialPortals } from '../src/services/spatial.ts';
import { videos } from '../src/data/catalogue.ts';
import { getPassageMedia } from '../src/services/passageMedia.ts';

const distance = (a: PassageVector, b: PassageVector) => Math.hypot(...a.map((value, index) => value - b[index]));
const near = (a: PassageVector, b: PassageVector, epsilon = 1e-8) => assert.ok(distance(a, b) < epsilon, `${a.join(',')} != ${b.join(',')}`);
function carrierLocal(index: number, frame: {active: number; progress: number}, position: PassageVector): PassageVector {
  const carrier = passageStationMotion(index, frame), x = position[0] - carrier.position[0], z = position[2] - carrier.position[2];
  return [x * Math.cos(carrier.rotation[1]) - z * Math.sin(carrier.rotation[1]), position[1] - carrier.position[1], x * Math.sin(carrier.rotation[1]) + z * Math.cos(carrier.rotation[1])];
}

test('Passage specifications preserve six existing routes, catalogue actions and media relationships', () => {
  assert.deepEqual(PASSAGE_CHAPTERS.map(chapter => chapter.id), [...TUNNEL_STATION_IDS]);
  assert.equal(new Set(PASSAGE_CHAPTERS.map(chapter => chapter.environment)).size, 6);
  PASSAGE_CHAPTERS.forEach((chapter, index) => {
    assert.equal(chapter.route, spatialPortals[index].route);
    assert.equal(chapter.title, spatialPortals[index].title);
    assert.ok(videos.some(video => video.id === chapter.feature && video.status === 'available' && video.src));
    assert.equal(getPassageMedia(chapter.id)?.catalogueId, chapter.feature);
    assert.equal(chapter.lines.length, 2);
    assert.ok(chapter.copy.length > 30 && chapter.action.length > 5);
  });
});

test('Camera position and look target are continuous from entrance through all five chapter departures', () => {
  const openingEnd = passagePose({ active: -1, progress: 1 }), firstStart = passagePose({ active: 0, progress: 0 });
  near(openingEnd.position, firstStart.position); near(openingEnd.target, firstStart.target);
  for (let active = 0; active < PASSAGE_CHAPTERS.length - 1; active++) {
    const outgoing = passagePose({ active, progress: 1 }), incoming = passagePose({ active: active + 1, progress: 0 });
    near(outgoing.position, incoming.position); near(outgoing.target, incoming.target);
    assert.equal(outgoing.fov, incoming.fov);
    const before = passagePose({ active, progress: 1 - 1e-5 }), after = passagePose({ active: active + 1, progress: 1e-5 });
    near(before.position, after.position, 1e-6); near(before.target, after.target, 1e-6);
  }
});

test('Every reading interval holds the exact authored position, target and field of view', () => {
  for (let active = 0; active < PASSAGE_CHAPTERS.length; active++) {
    const reference = passagePose({ active, progress: PASSAGE_READING_START });
    assert.equal(reference.position[2], tunnelReadingZ(active));
    assert.equal(reference.target[2], reference.position[2] - 24);
    assert.ok(Math.abs(reference.position[0]) <= .16 && Math.abs(reference.position[1] - .12) <= .08);
    for (let step = 0; step <= 100; step++) {
      const progress = PASSAGE_READING_START + (PASSAGE_READING_END - PASSAGE_READING_START) * step / 100;
      assert.deepEqual(passagePose({ active, progress }), reference);
      assert.equal(passageReading({ active, progress }), true);
      assert.equal(passageContentOpacity(active, { active, progress }), 1);
    }
    assert.ok(distance(passagePose({ active, progress: .1 }).position, reference.position) > 1);
  }
  assert.deepEqual(passagePose({ active: 5, progress: 1 }), passagePose({ active: 5, progress: .5 }));
});

test('Reverse traversal and direct station jumps reconstruct the same camera with no stored animation state', () => {
  const frames = Array.from({ length: 7 * 101 }, (_, step) => ({ active: Math.floor(step / 101) - 1, progress: (step % 101) / 100 }));
  const forwards = frames.map(frame => passagePose(frame));
  for (let index = frames.length - 1; index >= 0; index--) assert.deepEqual(passagePose(frames[index]), forwards[index]);
  for (const active of [5, 0, 4, 1, 3, 2, -1, 5]) {
    assert.deepEqual(passagePose({ active, progress: .5 }), forwards[(active + 1) * 101 + 50]);
  }
});

test('Finite and out-of-range scroll progress always yields a finite, comfortable camera', () => {
  for (const active of [-Infinity, -100, -1, 0, 1, 5, 100, Infinity, NaN]) {
    for (const progress of [-Infinity, -100, 0, .2, .5, .9, 1, 100, Infinity, NaN]) {
      const pose = passagePose({ active, progress });
      assert.ok([...pose.position, ...pose.target, pose.fov].every(Number.isFinite), `Invalid pose at ${active}/${progress}`);
      assert.ok(distance(pose.position, pose.target) > 1, 'Look target cannot coincide with the camera');
      assert.ok(pose.fov >= 40 && pose.fov <= 65);
    }
  }
});

test('Permanent carriers fold out of the centerline before their media planes can meet the camera', () => {
  for (let active = 0; active < PASSAGE_CHAPTERS.length - 1; active++) {
    const chapter = PASSAGE_CHAPTERS[active];
    for (let step = 0; step <= 10000; step++) {
      const progress = PASSAGE_READING_END + (1 - PASSAGE_READING_END) * step / 10000;
      const frame = { active, progress }, camera = passagePose(frame), carrier = passageStationMotion(active, frame);
      const position = carrierLocal(active, frame, camera.position);
      assert.ok(Math.abs(camera.position[0]) <= .16, 'The camera stays in the tunnel rather than swerving around panels');
      if (camera.position[2] - chapter.center[2] <= 3.5) assert.equal(carrier.extend, 0, 'The carrier is fully retracted before the camera arrives');
      const x = position[0] - chapter.media.position[0], z = position[2] - chapter.media.position[2];
      const planeX = x * Math.cos(chapter.media.yaw) - z * Math.sin(chapter.media.yaw);
      const planeZ = x * Math.sin(chapter.media.yaw) + z * Math.cos(chapter.media.yaw);
      if (Math.abs(planeZ) > .2) continue;
      assert.ok(Math.abs(planeX) > chapter.media.width / 2 + .25,
        `${chapter.id} enters screen at progress ${progress.toFixed(5)} / local ${position.map(value => value.toFixed(3))}`);
    }
  }
});

test('Carrier mechanisms remain anchored to physical stations, with reversible finite poses', () => {
  for (let index = 0; index < PASSAGE_CHAPTERS.length; index++) {
    const frames = Array.from({ length: 7 * 101 }, (_, step) => ({ active: Math.floor(step / 101) - 1, progress: (step % 101) / 100 }));
    const motions = frames.map(frame => passageStationMotion(index, frame));
    for (let step = frames.length - 1; step >= 0; step--) {
      const motion = passageStationMotion(index, frames[step]);
      assert.deepEqual(motion, motions[step]);
      assert.ok([...motion.position, ...motion.rotation, motion.extend, motion.reveal, motion.latch].every(Number.isFinite));
      assert.ok(motion.position[2] >= PASSAGE_CHAPTERS[index].center[2] && motion.position[2] <= PASSAGE_CHAPTERS[index].center[2] + .5);
      assert.ok([motion.extend, motion.reveal, motion.latch].every(value => value >= 0 && value <= 1));
    }
    const reading = passageStationMotion(index, { active: index, progress: .5 });
    assert.equal(reading.extend, 1); assert.equal(reading.reveal, 1); assert.equal(reading.visible, true);
    near(reading.rotation, [0, index % 2 === 0 ? -.07 : .07, 0]);
  }
});

test('Camera travels monotonically forward through a continuous tunnel and reverses exactly', () => {
  let priorZ = Infinity;
  for (let active = -1; active < PASSAGE_CHAPTERS.length; active++) {
    for (let step = 0; step <= 500; step++) {
      const pose = passagePose({ active, progress: step / 500 });
      assert.ok(pose.position[2] <= priorZ + 1e-8, 'No unintended backward camera recoil');
      assert.ok(Math.abs(pose.target[0] - pose.position[0]) < .2, 'Comfortable centered horizon');
      assert.equal(pose.target[2], pose.position[2] - 24);
      priorZ = pose.position[2];
    }
  }
});

test('Editorial weave is deterministic, finite, fully hidden at zero and clean at arrival', () => {
  assert.equal(passageWeaveMask(1), 'none');
  const hidden = passageWeaveMask(0);
  assert.ok(hidden.startsWith('polygon('));
  assert.ok([...hidden.matchAll(/([\d.]+)% ([\d.]+)%/g)].every(match => Number(match[2]) === 100));
  for (let step = 0; step <= 100; step++) {
    const reveal = step / 100, mask = passageWeaveMask(reveal);
    assert.equal(mask, passageWeaveMask(reveal));
    assert.doesNotMatch(mask, /NaN|Infinity/);
  }
});

test('Only the current chapter interface is visible and outgoing text is gone before the next threshold', () => {
  for (let active = -1; active < PASSAGE_CHAPTERS.length; active++) {
    for (const progress of [0, .1, .2, .38, .5, .74, .88, 1]) {
      const visible = PASSAGE_CHAPTERS.map((_chapter, index) => passageContentOpacity(index, { active, progress }));
      assert.ok(visible.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
      assert.ok(visible.filter(value => value > 0).length <= 1);
      if (active < 5 && progress >= .88) assert.ok(visible.every(value => value === 0));
    }
  }
});
