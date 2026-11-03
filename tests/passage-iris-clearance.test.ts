import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPassageArchitecture } from '../src/components/spatial/passageArchitecture.ts';
import { PASSAGE_LINING, passageLiningCell } from '../src/services/passageLining.ts';
import { passageBayExpansion } from '../src/services/passageEnvelope.ts';
import { PASSAGE_IRIS_PLANES, PASSAGE_IRIS_AXIAL_BOUNDS } from '../src/services/passageThresholdLayout.ts';

type Obstacle = { id: string; inverse: THREE.Matrix4; minZ: number; maxZ: number };
const unit = new THREE.Box3(new THREE.Vector3(-.5, -.5, -.5), new THREE.Vector3(.5, .5, .5));
function obstacle(id: string, matrix: THREE.Matrix4): Obstacle {
  const bounds = unit.clone().applyMatrix4(matrix);
  return { id, inverse: matrix.clone().invert(), minZ: bounds.min.z, maxZ: bounds.max.z };
}
function instances(mesh: THREE.InstancedMesh) {
  const matrix = new THREE.Matrix4(), world = new THREE.Matrix4();
  return Array.from({ length: mesh.count }, (_, i) => {
    mesh.getMatrixAt(i, matrix); world.multiplyMatrices(mesh.matrixWorld, matrix);
    return obstacle(`${mesh.name}/${i}`, world);
  });
}

/** Reconstruct the original conflicting bodies to demonstrate that the actual
 * triangle test detects the reported bug, rather than only asserting counts. */
function originalConflicts() {
  const object = new THREE.Object3D(), result: Obstacle[] = [];
  for (const row of [8, 54]) for (let lane = row % 3; lane < 12; lane += 3) {
    const cell = passageLiningCell(row, lane), radius = cell.radius + .17;
    object.position.set(Math.cos(cell.angle) * radius, Math.sin(cell.angle) * radius, cell.z);
    object.rotation.set(0, 0, cell.angle + Math.PI / 2);
    object.scale.set(cell.span * PASSAGE_LINING.wallWidth, PASSAGE_LINING.wallThickness, PASSAGE_LINING.wallDepth);
    object.updateMatrix(); result.push(obstacle(`old-panel/${row}/${lane}`, object.matrix));
  }
  for (const row of [20, 66]) for (let lane = 0; lane < 12; lane++) {
    const z = PASSAGE_LINING.start - row * PASSAGE_LINING.pitch, angle = lane * Math.PI / 6 + row * .058;
    const radius = 8.8 + Math.sin(row * .46) * .34 + passageBayExpansion(z);
    object.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    object.rotation.set(0, 0, angle + Math.PI / 2);
    object.scale.set(2 * radius * Math.sin(Math.PI / 12) * .95, .12, row % 4 === 0 ? .4 : .2);
    object.updateMatrix(); result.push(obstacle(`old-rib/${row}/${lane}`, object.matrix));
  }
  return result;
}

test('actual iris triangles never cut occupied LED panels or ribs during opening and reverse', () => {
  const scene = new THREE.Scene(), architecture = createPassageArchitecture(scene, () => {});
  const matrix = new THREE.Matrix4(), local = new THREE.Matrix4(), triangle = new THREE.Triangle();
  const conflicts = originalConflicts(), historicalHits = new Set<string>();
  try {
    scene.updateMatrixWorld(true);
    const blade = scene.getObjectByName('thick-spiral-iris-leaves') as THREE.InstancedMesh;
    const occupied = [...instances(scene.getObjectByName('passage-led-lining') as THREE.InstancedMesh),
      ...instances(scene.getObjectByName('passage-structural-ribs') as THREE.InstancedMesh)];
    const positions = blade.geometry.getAttribute('position'), indices = blade.geometry.index;
    const collides = (body: Obstacle, transform: THREE.Matrix4) => {
      local.multiplyMatrices(body.inverse, transform);
      const count = indices?.count ?? positions.count;
      for (let v = 0; v < count; v += 3) {
        triangle.a.fromBufferAttribute(positions, indices ? indices.getX(v) : v).applyMatrix4(local);
        triangle.b.fromBufferAttribute(positions, indices ? indices.getX(v + 1) : v + 1).applyMatrix4(local);
        triangle.c.fromBufferAttribute(positions, indices ? indices.getX(v + 2) : v + 2).applyMatrix4(local);
        if (unit.intersectsTriangle(triangle)) return true;
      }
      return false;
    };
    for (let gate = 0; gate < PASSAGE_IRIS_PLANES.length; gate++) {
      const plane = PASSAGE_IRIS_PLANES[gate];
      const nearby = occupied.filter(body => body.maxZ >= plane - .06 && body.minZ <= plane + .53);
      const originals = conflicts.filter(body => body.maxZ >= plane - .06 && body.minZ <= plane + .53);
      for (const reverse of [false, true]) for (let n = 0; n <= 24; n++) {
        const step = reverse ? 24 - n : n;
        architecture.update({ active: -1, progress: 0, elapsed: 0, cameraZ: plane + 28 - step * 18 / 24,
          reducedMotion: false, delta: 0, inspection: { station: null, expanded: false, rotation: 0 } });
        for (let leaf = 0; leaf < 8; leaf++) {
          blade.getMatrixAt(gate * 8 + leaf, matrix);
          for (const body of nearby) assert.equal(collides(body, matrix), false, `gate ${gate}, step ${step}, leaf ${leaf}: ${body.id}`);
          if (!reverse) for (const body of originals) if (!historicalHits.has(body.id) && collides(body, matrix)) historicalHits.add(body.id);
        }
      }
    }
    assert.equal([...historicalHits].filter(id => id.startsWith('old-panel')).length, 8);
    assert.equal([...historicalHits].filter(id => id.startsWith('old-rib')).length, 24);
  } finally { architecture.destroy(); }
});

test('shared iris slots contain the real blade, edge, bearing and hinge geometry', () => {
  const scene = new THREE.Scene(), architecture = createPassageArchitecture(scene, () => {});
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  try {
    const root = scene.getObjectByName('passage-spiral-thresholds')!;
    for (let gate = 0; gate < PASSAGE_IRIS_PLANES.length; gate++) {
      const plane = PASSAGE_IRIS_PLANES[gate];
      architecture.update({ active: -1, progress: 0, elapsed: 2.4, cameraZ: plane + 16,
        reducedMotion: false, delta: 0, inspection: { station: null, expanded: false, rotation: 0 } });
      for (const mesh of root.children as THREE.InstancedMesh[]) {
        const perGate = mesh.count / PASSAGE_IRIS_PLANES.length;
        const vertices = mesh.geometry.getAttribute('position');
        for (let part = 0; part < perGate; part++) {
          mesh.getMatrixAt(gate * perGate + part, matrix);
          for (let i = 0; i < vertices.count; i++) {
            point.fromBufferAttribute(vertices, i).applyMatrix4(matrix);
            assert.ok(point.z >= plane + PASSAGE_IRIS_AXIAL_BOUNDS[0] - .0001 && point.z <= plane + PASSAGE_IRIS_AXIAL_BOUNDS[1] + .0001,
              `${mesh.name} exceeds its authored service slot`);
          }
        }
      }
    }
  } finally { architecture.destroy(); }
});
