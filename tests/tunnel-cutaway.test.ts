import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTunnelCutaway, liningIntersection } from '../src/components/spatial/tunnelCutaway.ts';

test('the inspection probe meets the lining at a finite world-space point', () => {
  const target = new THREE.Vector3();
  const ray = new THREE.Ray(new THREE.Vector3(0, 0, 14), new THREE.Vector3(1, 0, -1).normalize());
  assert.equal(liningIntersection(ray, target), true);
  assert.ok(Math.abs(target.x - 8.97) < 1e-9);
  assert.ok(Math.abs(target.z - 5.03) < 1e-9);
  assert.ok(ray.distanceToPoint(target) < 1e-9, 'the reveal stays under the projected cursor');

  ray.origin.set(.7, -.3, -82);
  ray.direction.set(-.75, .35, -1).normalize();
  assert.equal(liningIntersection(ray, target), true);
  assert.ok(Math.abs(Math.hypot(target.x, target.y) - 8.97) < 1e-9);
  assert.ok(ray.distanceToPoint(target) < 1e-9, 'camera drift does not move the reveal off its ray');
  assert.ok(target.z < ray.origin.z, 'the selected bay remains ahead of the camera');
});

test('the probe does not invent a nearby surface at the vanishing point or outside the built tunnel', () => {
  const target = new THREE.Vector3();
  const ray = new THREE.Ray(new THREE.Vector3(0, 0, 14), new THREE.Vector3(0, 0, -1));
  assert.equal(liningIntersection(ray, target), false, 'an axial ray never meets the lining');
  ray.direction.set(.05, 0, -1).normalize();
  assert.equal(liningIntersection(ray, target), false, 'a distant intersection is outside inspection reach');
  ray.origin.set(0, 0, -310); ray.direction.set(.5, 0, -1).normalize();
  assert.equal(liningIntersection(ray, target), false, 'there is no service bay beyond the tunnel');
  ray.origin.set(12, 0, 0); ray.direction.set(1, 0, -1).normalize();
  assert.equal(liningIntersection(ray, target), false, 'a surface behind the ray is not a valid hit');
});

test('service bays stay within the local geometry budget and upload only when the inspected rows change', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(59, 1440 / 900, .16, 165);
  camera.position.set(0, 0, 14); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const controller = createTunnelCutaway(scene, {} as THREE.WebGLRenderer, camera);
  controller.update([.8, .1], true, 1440, 900, 1 / 60);
  const batches: THREE.InstancedMesh[] = [];
  scene.traverse(object => { if (object instanceof THREE.InstancedMesh) batches.push(object); });
  const instances = batches.reduce((sum, mesh) => sum + mesh.count, 0);
  const triangles = batches.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3 * mesh.count, 0);
  assert.ok(instances <= 800, `bounded local instances, got ${instances}`);
  assert.ok(triangles <= 30000, `bounded local triangles, got ${triangles}`);
  const versions = batches.map(mesh => mesh.instanceMatrix.version);
  for (let frame = 0; frame < 60; frame++) controller.update([.8, .1], true, 1440, 900, 1 / 60);
  assert.deepEqual(batches.map(mesh => mesh.instanceMatrix.version), versions, 'a held cursor never reuploads the service geometry');
  const initialDepths = batches.map(mesh => mesh.boundingSphere!.center.z);
  camera.position.z -= 60; camera.updateMatrixWorld();
  controller.update([.8, .1], true, 1440, 900, 1 / 60);
  batches.forEach((mesh, index) => {
    assert.equal(mesh.instanceMatrix.version, versions[index] + 1, 'one upload selects the new row window');
    assert.ok(mesh.boundingSphere!.center.z < initialDepths[index] - 50, 'bounds follow actual distant world coordinates');
  });
  controller.destroy();
});

test('cutaway activation is reversible, protects media, and releases only its own scene resources', () => {
  const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(1, 1, 1);
  const shell = new THREE.MeshStandardMaterial(), coveredShell = new THREE.MeshStandardMaterial({ alphaToCoverage: true });
  const ordinary = new THREE.MeshStandardMaterial();
  const video = new THREE.VideoTexture({ readyState: 0 } as HTMLVideoElement);
  const media = new THREE.MeshStandardMaterial({ map: video });
  shell.userData.passageShell = coveredShell.userData.passageShell = media.userData.passageShell = true;
  const externalMaterials = [shell, coveredShell, ordinary, media];
  const originalCompile = externalMaterials.map(material => material.onBeforeCompile);
  const originalKeys = externalMaterials.map(material => material.customProgramCacheKey);
  const originals = externalMaterials.map(material => new THREE.Mesh(geometry, material));
  scene.add(...originals);
  let externalDisposed = false;
  geometry.addEventListener('dispose', () => { externalDisposed = true; });
  const camera = new THREE.PerspectiveCamera(59, 1440 / 900, .16, 165);
  camera.position.set(0, 0, 14); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const controller = createTunnelCutaway(scene, {} as THREE.WebGLRenderer, camera);
  const assembly = scene.children.find(child => !originals.includes(child as THREE.Mesh))!;
  const ownedGeometry = new Set<THREE.BufferGeometry>(), ownedMaterials = new Set<THREE.Material>();
  assembly.traverse(object => {
    if (object instanceof THREE.Mesh) {
      ownedGeometry.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) ownedMaterials.add(material);
    }
  });
  const disposedGeometry = new Set<THREE.BufferGeometry>(), disposedMaterials = new Set<THREE.Material>();
  ownedGeometry.forEach(item => item.addEventListener('dispose', () => disposedGeometry.add(item)));
  ownedMaterials.forEach(item => item.addEventListener('dispose', () => disposedMaterials.add(item)));

  assert.notEqual(shell.onBeforeCompile, originalCompile[0]);
  assert.notEqual(coveredShell.onBeforeCompile, originalCompile[1]);
  assert.equal(ordinary.onBeforeCompile, originalCompile[2], 'ordinary surfaces are untouched');
  assert.equal(media.onBeforeCompile, originalCompile[3], 'video surfaces are never shader-patched');
  assert.equal(media.map, video);
  assert.equal(shell.alphaToCoverage, true);
  controller.bindMaterials();
  assert.equal(controller.update([.8, .1], true, 1440, 900, 1 / 60), true);
  assert.equal(assembly.visible, true);
  controller.reset();
  assert.equal(assembly.visible, false, 'blocking content closes the reveal immediately');
  assert.equal(controller.update([.8, .1], false, 1440, 900, 1 / 60), false);
  assert.equal(assembly.visible, false);
  assert.equal(controller.update([.8, .1], true, 1440, 900, 1 / 60), true, 're-entry works after suspension');
  assert.equal(controller.update([0, 0], true, 1440, 900, 1 / 60), false, 'moving into empty space retires the old reveal');
  assert.equal(assembly.visible, false);

  controller.destroy();
  assert.deepEqual(scene.children, originals, 'teardown preserves pre-existing scene objects');
  externalMaterials.forEach((material, index) => {
    assert.equal(material.onBeforeCompile, originalCompile[index]);
    assert.equal(material.customProgramCacheKey, originalKeys[index]);
  });
  assert.equal(shell.alphaToCoverage, false);
  assert.equal(coveredShell.alphaToCoverage, true, 'an existing coverage setting is restored faithfully');
  assert.equal(disposedGeometry.size, ownedGeometry.size);
  assert.equal(disposedMaterials.size, ownedMaterials.size);
  assert.equal(externalDisposed, false, 'shared outer geometry belongs to its original owner');
  video.dispose(); geometry.dispose(); externalMaterials.forEach(material => material.dispose());
});
