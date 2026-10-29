import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPassageArchitecture } from '../src/components/spatial/passageArchitecture.ts';
import { PASSAGE_CHAPTERS } from '../src/services/passageChapters.ts';
import { passagePose, passageReading } from '../src/services/passageJourney.ts';

test('inspection brings every object into a clear space below its original screen', () => {
  const scene = new THREE.Scene(), architecture = createPassageArchitecture(scene, () => {});
  const camera = new THREE.PerspectiveCamera(59, 1440 / 900, .16, 165);
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  for (let active = 0; active < 6; active++) {
    const chapter = PASSAGE_CHAPTERS[active], pose = passagePose({ active, progress: .5 });
    camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
    for (const rotation of [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
      const frame = { active, progress: .5, elapsed: 3, delta: .05, reducedMotion: false,
        inspection: { station: chapter.id, expanded: true, rotation } };
      for (let tick = 0; tick < 40; tick++) architecture.update(frame);
      scene.updateMatrixWorld(true);
      const assembly = architecture.chapters[active];
      bounds.setFromObject(assembly.movement, true);
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        point.set(x, y, z).project(camera);
        const px = (point.x + 1) * 720, py = (1 - point.y) * 450;
        left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py);
      }
      assert.ok(left > 560 && right < 1390, `${chapter.id} stays in its right-hand stage: ${left}–${right}`);
      assert.ok(top > 545 && bottom < 825, `${chapter.id} avoids the image and bottom navigation: ${top}–${bottom}`);
      assert.equal(assembly.media.material.opacity, 1, 'inspection never fades footage');
      assert.ok(assembly.ribs.boundingSphere!.radius >= 9, 'moving ribs retain conservative culling bounds');
    }
  }
  architecture.destroy();
  assert.equal(scene.children.length, 0);
});

test('the final station retains its quiet reading state to the end of native scroll', () => {
  for (const progress of [.38, .74, .8, .9, 1]) assert.equal(passageReading({ active: 5, progress }), true);
  assert.equal(passageReading({ active: 4, progress: .9 }), false);
});
