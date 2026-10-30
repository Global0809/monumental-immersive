import * as THREE from 'three';

/** An authored reflection stage, baked once. No live cube-camera or added RAF.
 * Narrow cards give polished edges definition; broad cards keep metal readable.
 * The caller owns the returned target and disposes it with the Passage. */
export function createPassageReflectionEnvironment(renderer: THREE.WebGLRenderer) {
  const stage = new THREE.Scene();
  stage.background = new THREE.Color(0x080a0a);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials: THREE.MeshBasicMaterial[] = [];
  function card(position: [number, number, number], size: [number, number], rgb: [number, number, number]) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(...rgb), side: THREE.DoubleSide, toneMapped: false,
    });
    materials.push(material);
    const panel = new THREE.Mesh(geometry, material);
    panel.position.set(...position); panel.scale.set(size[0], size[1], 1);
    panel.lookAt(0, 0, 0); stage.add(panel);
  }
  card([-7, 5, 3], [3.2, 12], [4.2, 4.05, 3.8]);
  card([7, 2, 1], [.7, 14], [3.5, 3.8, 4.0]);
  card([0, 9, -2], [11, 2.1], [3.6, 3.5, 3.2]);
  card([-4, 1, -8], [1.2, 10], [2.8, 2.6, 2.3]);
  card([5, -2, -7], [.55, 9], [2.1, .34, .17]);
  card([0, -7, 2], [9, 7], [.24, .28, .28]);
  card([1, 1, 9], [4, 6], [.65, .7, .72]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  try { return pmrem.fromScene(stage, .008, .1, 50); }
  finally {
    geometry.dispose(); materials.forEach(material => material.dispose());
    stage.clear(); pmrem.dispose();
  }
}
