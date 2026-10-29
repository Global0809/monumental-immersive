import * as THREE from 'three';
import { PASSAGE_CHAPTERS } from '../../services/passageChapters';
import { passageIrisOpening } from '../../services/passageMechanisms';

/** Machined spiral apertures. All seven thresholds share six instanced draws;
 * their apertures follow the existing camera position, never a second clock. */
export function createPassageThresholds(scene: THREE.Scene) {
  const root = new THREE.Group(); root.name = 'passage-spiral-thresholds'; scene.add(root);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [], batches: THREE.InstancedMesh[] = [];
  const dummy = new THREE.Object3D();
  // A threshold lies before each reading position, never across a reading image.
  const gates = [-7, ...PASSAGE_CHAPTERS.map(chapter => chapter.center[2] + 23)];
  const last = gates.map(() => Number.NaN);
  const g = <T extends THREE.BufferGeometry>(geometry: T) => { geometries.push(geometry); return geometry; };
  const m = <T extends THREE.Material>(material: T) => { materials.push(material); return material; };
  const shell = m(new THREE.MeshStandardMaterial({ color: 0x424a45, metalness: .9, roughness: .31, envMapIntensity: .7 }));
  shell.userData.passageShell = true;
  const backing = m(new THREE.MeshStandardMaterial({ color: 0x141a17, metalness: .74, roughness: .4 }));
  const bearing = m(new THREE.MeshStandardMaterial({ color: 0x89918a, metalness: .92, roughness: .3 }));
  bearing.userData.passageInternal = true;
  const signal = m(new THREE.MeshBasicMaterial({ color: 0xff4d32, toneMapped: false }));
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(2.65, -.32);
  bladeShape.bezierCurveTo(3.18, -1.22, 5.1, -2.24, 7.55, -2.1);
  bladeShape.bezierCurveTo(7.86, -1.26, 8.05, -.24, 7.84, .79);
  bladeShape.bezierCurveTo(6.46, .26, 4.08, .58, 2.65, .42);
  bladeShape.quadraticCurveTo(2.45, .10, 2.65, -.32);
  const bladeGeometry = g(new THREE.ExtrudeGeometry(bladeShape, { depth: .22, bevelEnabled: true, bevelSize: .055, bevelThickness: .055, bevelSegments: 2, curveSegments: 12, steps: 1 }));
  const edgeShape = new THREE.Shape();
  edgeShape.moveTo(2.78, -.31);
  edgeShape.bezierCurveTo(3.25, -1.17, 5.1, -2.12, 7.45, -2.03);
  edgeShape.lineTo(7.46, -1.995);
  edgeShape.bezierCurveTo(5.1, -2.075, 3.31, -1.13, 2.83, -.285);
  edgeShape.closePath();
  const edgeGeometry = g(new THREE.ShapeGeometry(edgeShape, 20));
  const ringGeometry = g(new THREE.TorusGeometry(8.03, .13, 8, 72, Math.PI * 1.86));
  const ringInnerGeometry = g(new THREE.TorusGeometry(7.72, .07, 6, 72, Math.PI * 1.62));
  const cylinderGeometry = g(new THREE.CylinderGeometry(1, 1, 1, 10));
  function batch(geometry: THREE.BufferGeometry, material: THREE.Material, count: number, name: string) {
    const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    batches.push(mesh); root.add(mesh); return mesh;
  }
  const blades = batch(bladeGeometry, shell, gates.length * 8, 'thick-spiral-iris-leaves');
  const edges = batch(edgeGeometry, signal, gates.length * 8, 'iris-red-machined-edges');
  const outer = batch(ringGeometry, backing, gates.length, 'counter-rotating-outer-bearing');
  const inner = batch(ringInnerGeometry, bearing, gates.length, 'counter-rotating-inner-bearing');
  const pistons = batch(cylinderGeometry, bearing, gates.length * 8, 'iris-radial-actuators');
  const pins = batch(cylinderGeometry, backing, gates.length * 8, 'iris-fixed-hinge-pins');
  let disposed = false;
  function put(mesh: THREE.InstancedMesh, i: number) { dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); }
  function update(cameraZ: number, time: number, compact: boolean, reduced: boolean) {
    if (disposed) return;
    root.visible = !compact && !reduced;
    if (!root.visible) return;
    let leavesChanged = false;
    gates.forEach((z, i) => {
      const distance = cameraZ - z, visible = distance > -5 && distance < 92;
      const opening = visible ? passageIrisOpening(cameraZ, z) : -1;
      const scale = visible ? 1 : 0;
      // Ring bodies counter-rotate; their collars and attachment plane stay fixed.
      dummy.position.set(0, 0, z - .28); dummy.rotation.set(0, 0, i * .31 + time * .045); dummy.scale.setScalar(scale); put(outer, i);
      dummy.position.z = z + .38; dummy.rotation.z = i * .41 - time * .071; put(inner, i);
      if (opening === last[i]) return;
      last[i] = opening; leavesChanged = true;
      for (let j = 0; j < 8; j++) {
        const angle = j * Math.PI / 4 + i * .17, c = Math.cos(angle), s = Math.sin(angle);
        const spread = Math.max(0, opening) * 5.45;
        dummy.position.set(c * spread, s * spread, z + j * .035);
        dummy.rotation.set(0, 0, angle - Math.max(0, opening) * .18); dummy.scale.setScalar(scale); put(blades, i * 8 + j);
        dummy.position.z += .28; put(edges, i * 8 + j);
        dummy.position.set(c * (6.1 + spread * .36), s * (6.1 + spread * .36), z - .27);
        dummy.rotation.set(0, 0, angle - Math.PI / 2); dummy.scale.set(.07 * scale, (2.6 + spread * .72) * scale, .07 * scale); put(pistons, i * 8 + j);
        dummy.position.set(c * 8.05, s * 8.05, z - .1); dummy.rotation.set(Math.PI / 2, 0, 0); dummy.scale.set(.18 * scale, .7 * scale, .18 * scale); put(pins, i * 8 + j);
      }
    });
    outer.instanceMatrix.needsUpdate = inner.instanceMatrix.needsUpdate = true;
    if (leavesChanged) for (const mesh of [blades, edges, pistons, pins]) mesh.instanceMatrix.needsUpdate = true;
  }
  return { update, destroy() {
    if (disposed) return; disposed = true; scene.remove(root);
    batches.forEach(mesh => mesh.dispose()); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); root.clear();
  } };
}
