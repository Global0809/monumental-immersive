import * as THREE from 'three';

/** A small manufactured service bracket gives the companions a real physical
 * place to perch. One reused dock, no alpha bloom or renderer of its own. */
export function createDroneDock(scene: THREE.Scene) {
  const root = new THREE.Group(); root.name = 'Flight service mechanism'; scene.add(root);
  const graphite = new THREE.MeshStandardMaterial({ color: 0x1b2520, metalness: .75, roughness: .34 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8c9991, metalness: .9, roughness: .28 });
  const red = new THREE.MeshBasicMaterial({ color: 0xff4d32, toneMapped: false });
  const box = new THREE.BoxGeometry(1, 1, 1), ring = new THREE.TorusGeometry(.13, .018, 5, 24);
  function part(material: THREE.Material, p: [number, number, number], s: [number, number, number]) {
    const mesh = new THREE.Mesh(box, material); mesh.position.set(...p); mesh.scale.set(...s); root.add(mesh); return mesh;
  }
  part(graphite, [0, -.10, 0], [.62, .08, .38]);
  part(metal, [0, -.052, 0], [.48, .017, .30]);
  part(graphite, [0, -.27, -.12], [.10, .3, .1]);
  part(metal, [0, -.40, -.12], [.37, .035, .2]);
  part(red, [0, -.045, .14], [.28, .009, .009]);
  const wheel = new THREE.Mesh(ring, metal); wheel.position.set(.21, -.21, .06); root.add(wheel);
  const target = new THREE.Mesh(new THREE.SphereGeometry(.026, 10, 6), red); target.position.set(.21, -.21, .085); root.add(target);
  const signalGeometry = new THREE.BufferGeometry(); signalGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const signalMaterial = new THREE.LineBasicMaterial({ color: 0xff4d32, transparent: true, opacity: .4 });
  const signal = new THREE.Line(signalGeometry, signalMaterial); signal.frustumCulled = false; scene.add(signal);
  const packet = new THREE.Mesh(new THREE.SphereGeometry(.027, 8, 6), red); scene.add(packet);
  root.visible = signal.visible = packet.visible = false;
  return {
    root,
    update(from: THREE.Vector3, to: THREE.Vector3, phase: number, inspect: number, enabled: boolean) {
      root.visible = enabled;
      wheel.rotation.z = inspect * .65;
      target.scale.setScalar(1 + inspect * .4);
      signal.visible = packet.visible = enabled && phase > .015;
      if (!signal.visible) return;
      const positions = signalGeometry.getAttribute('position'); positions.setXYZ(0, from.x, from.y, from.z); positions.setXYZ(1, to.x, to.y, to.z); positions.needsUpdate = true;
      signalMaterial.opacity = phase * .37; packet.position.lerpVectors(from, to, phase); packet.scale.setScalar(.4 + phase * .6);
    },
    destroy() {
      root.removeFromParent(); signal.removeFromParent(); packet.removeFromParent();
      const geometries = new Set<THREE.BufferGeometry>(); root.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
      geometries.add(packet.geometry); geometries.add(signalGeometry); geometries.forEach(g => g.dispose());
      graphite.dispose(); metal.dispose(); red.dispose(); signalMaterial.dispose();
    },
  };
}
