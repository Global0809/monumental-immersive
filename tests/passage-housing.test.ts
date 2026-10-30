import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPassageArchitecture } from '../src/components/spatial/passageArchitecture';
import { PASSAGE_CHAPTERS } from '../src/services/passageChapters';
import { passageLiningRadius } from '../src/services/passageEnvelope';

const matrix = new THREE.Matrix4(), local = new THREE.Matrix4(), point = new THREE.Vector3();

function corners(object: THREE.Mesh, transform: THREE.Matrix4, visit: (point: THREE.Vector3) => void) {
  object.geometry.computeBoundingBox(); const bounds = object.geometry.boundingBox!;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    point.set(x, y, z).applyMatrix4(transform); visit(point);
  }
}

function inHousing(object: THREE.Object3D, housing: THREE.Group) {
  const bounds = new THREE.Box3(), inverse = housing.matrixWorld.clone().invert();
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    matrix.multiplyMatrices(inverse, child.matrixWorld); corners(child, matrix, vertex => bounds.expandByPoint(vertex));
  });
  return bounds;
}

function update(architecture: ReturnType<typeof createPassageArchitecture>, active: number, progress: number) {
  architecture.update({ active, progress, elapsed: 0, delta: .05, reducedMotion: true,
    inspection: { station: null, expanded: false, rotation: 0 } });
}

test('all six screen drawers retain rear and side clearance throughout their actual travel', () => {
  const scene = new THREE.Scene(), architecture = createPassageArchitecture(scene, () => {});
  try {
    for (let chapter = 0; chapter < 6; chapter++) for (let step = 0; step <= 100; step++) {
      update(architecture, chapter, step / 100); scene.updateMatrixWorld(true);
      const { screen, housing, screenSlides } = architecture.chapters[chapter];
      const display = inHousing(screen, housing), rear = inHousing(housing.children[0], housing);
      const slides = screenSlides.map(slide => inHousing(slide, housing)).sort((a, b) => a.min.x - b.min.x);
      assert.ok(display.min.z > rear.max.z + .15, `${chapter}/${step}: screen back intersects its rear housing`);
      assert.ok(display.min.x > slides[0].max.x + .02, `${chapter}/${step}: screen clips left guide`);
      assert.ok(display.max.x < slides[1].min.x - .02, `${chapter}/${step}: screen clips right guide`);
      assert.equal(screen.rotation.x, 0, 'the drawer stays parallel to its guides');
      assert.ok(display.getSize(new THREE.Vector3()).x > PASSAGE_CHAPTERS[chapter].media.width, 'the bezel remains part of the tested geometry');
    }
  } finally { architecture.destroy(); }
  assert.equal(scene.children.length, 0);
});

test('real carrier components remain inside the expanded tunnel wall during approach and retreat', () => {
  const scene = new THREE.Scene(), architecture = createPassageArchitecture(scene, () => {});
  let inspectedVertices = 0, minimumClearance = Infinity;
  try {
    for (let chapter = 0; chapter < 6; chapter++) for (let step = 0; step <= 100; step++) {
      update(architecture, chapter, step / 100); scene.updateMatrixWorld(true);
      const carrier = architecture.chapters[chapter];
      for (const root of [carrier.root, carrier.armRoot]) root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        // Architectural light spill is intentionally not a solid body.
        if (materials.every(material => material.transparent && !material.depthWrite)) return;
        const inspect = (vertex: THREE.Vector3) => {
          // .70 accounts conservatively for the shell's .34 radial variation
          // and .33 half-thickness, rather than testing against its centerline.
          const clearance = passageLiningRadius(vertex.z) - .70 - Math.hypot(vertex.x, vertex.y);
          minimumClearance = Math.min(minimumClearance, clearance); inspectedVertices++;
          assert.ok(clearance > .02, `${chapter}/${step}: ${object.name || object.geometry.type} pierces wall by ${(-clearance).toFixed(3)}`);
        };
        if (object instanceof THREE.InstancedMesh) {
          for (let instance = 0; instance < object.count; instance++) {
            object.getMatrixAt(instance, local); matrix.multiplyMatrices(object.matrixWorld, local); corners(object, matrix, inspect);
          }
        } else corners(object, object.matrixWorld, inspect);
      });
    }
  } finally { architecture.destroy(); }
  assert.ok(inspectedVertices > 1_000_000, 'clearance covers actual instanced geometry, not only carrier origins');
  assert.ok(minimumClearance > .02);
  assert.equal(scene.children.length, 0);
});
