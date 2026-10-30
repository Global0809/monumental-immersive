import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { createChapterAssemblyKit } from '../src/components/spatial/chapterAssembly';
import { samplePassageAssembly } from '../src/services/passageAssembly';

/** Inspect the actual uploaded armor, finish and rear spine transforms.
 * Hinge pins intentionally meet their neighboring leaf and are excluded.
 * This catches geometry regression rather
 * than merely reasserting the animation's numerical inputs. */
function leaves(root: THREE.Group) {
  const groups = new Map<string, { orientation: THREE.Matrix4; parts: { bounds: THREE.Box3; matrix: THREE.Matrix4 }[] }>();
  root.traverse(object => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    object.geometry.computeBoundingBox();
    (object.userData.assemblyParts as (string | null)[]).forEach((label, index) => {
      if (!label?.startsWith('shutter-') || label.includes('/detail')) return;
      const key = label.split('/')[0], matrix = new THREE.Matrix4(); object.getMatrixAt(index, matrix);
      let group = groups.get(key);
      if (!group) { group = { orientation: matrix.clone(), parts: [] }; groups.set(key, group); }
      if (!label.includes('/')) group.orientation.copy(matrix);
      group.parts.push({ bounds: object.geometry.boundingBox!.clone(), matrix });
    });
  });
  return [...groups].map(([id, group]) => {
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
    group.orientation.decompose(position, quaternion, scale);
    const basis = new THREE.Matrix4().makeRotationFromQuaternion(quaternion), inverse = basis.clone().invert();
    const bounds = new THREE.Box3(), point = new THREE.Vector3();
    for (const part of group.parts) for (const x of [part.bounds.min.x, part.bounds.max.x]) for (const y of [part.bounds.min.y, part.bounds.max.y]) for (const z of [part.bounds.min.z, part.bounds.max.z]) {
      point.set(x, y, z).applyMatrix4(part.matrix).applyMatrix4(inverse); bounds.expandByPoint(point);
    }
    const box = new OBB(bounds.getCenter(new THREE.Vector3()).applyMatrix4(basis), bounds.getSize(new THREE.Vector3()).multiplyScalar(.5), new THREE.Matrix3().setFromMatrix4(basis));
    const parts = group.parts.map(part => new OBB().fromBox3(part.bounds).applyMatrix4(part.matrix));
    return { id, box, parts };
  });
}

test('all chapter shutter leaves stay separated through opening, reading and closing', () => {
  const material = new THREE.MeshBasicMaterial();
  const kit = createChapterAssemblyKit({ steel: material, graphite: material, charcoal: material, red: material, ivory: material });
  try {
    for (let chapter = 0; chapter < 6; chapter++) {
      const root = new THREE.Group(), assembly = kit.create(root, chapter);
      for (let step = 0; step <= 100; step++) {
        assembly.update(samplePassageAssembly(chapter, { active: chapter, progress: step / 100 }), 0);
        const shapes = leaves(root); assert.equal(shapes.length, 12);
        for (let a = 0; a < shapes.length; a++) for (let b = a + 1; b < shapes.length; b++) {
          const overlaps = shapes[a].box.intersectsOBB(shapes[b].box) && shapes[a].parts.some(part => shapes[b].parts.some(other => part.intersectsOBB(other)));
          assert.equal(overlaps, false, `chapter ${chapter}, progress ${step}: ${shapes[a].id} intersects ${shapes[b].id}`);
        }
      }
    }
  } finally { kit.dispose(); material.dispose(); }
});

test('open chassis fits its authored bay and keeps a clear forward editorial plane', () => {
  const material = new THREE.MeshBasicMaterial();
  const kit = createChapterAssemblyKit({ steel: material, graphite: material, charcoal: material, red: material, ivory: material });
  try {
    for (let chapter = 0; chapter < 6; chapter++) {
      const root = new THREE.Group(), assembly = kit.create(root, chapter);
      for (const inspection of [0, 1]) {
        assembly.update(samplePassageAssembly(chapter, { active: chapter, progress: .5 }), inspection);
        root.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(root);
        assert.ok(bounds.min.x > -8.3 && bounds.max.x < 8.3);
        assert.ok(bounds.min.y > -5.4 && bounds.max.y < 5.4);
        assert.ok(bounds.min.z > -2.7 && bounds.max.z < .20);
      }
    }
  } finally { kit.dispose(); material.dispose(); }
});
