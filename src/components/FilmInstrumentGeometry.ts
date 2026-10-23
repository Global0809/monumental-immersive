import * as THREE from 'three';

/** Media follows Vite's deployment base; external sources keep their origin. */
export function filmAsset(path: string) {
  return path.startsWith('/') ? `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}` : path;
}

/** A UV-mapped window follows the front face of the existing twisted band. */
export function filmWindowGeometry(band: number) {
  const steps = 40;
  const radius = 1.36 + band * 0.035;
  const phase = band * 1.8;
  const width = band === 0 ? 0.285 : 0.22;
  const start = [-0.12, 0.68, 2.6][band];
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const point = (t: number) => new THREE.Vector3(
    Math.cos(t) * (radius + Math.sin(t * 3 + phase) * 0.075),
    Math.sin(t) * radius * 1.2,
    Math.sin(t * 2 + phase) * 0.27,
  );
  for (let i = 0; i <= steps; i++) {
    const t = start + i / steps * 0.88;
    const center = point(t);
    const tangent = point(t + 0.001).sub(point(t - 0.001)).normalize();
    const radial = new THREE.Vector3(Math.cos(t), Math.sin(t), 0).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, radial).normalize();
    const twist = Math.sin(t * 2 + phase) * 0.7 + 0.24;
    const across = radial.multiplyScalar(Math.cos(twist)).addScaledVector(binormal, Math.sin(twist));
    const normal = new THREE.Vector3().crossVectors(tangent, across).normalize();
    for (let side = 0; side < 2; side++) {
      const p = center.clone().addScaledVector(across, (side ? 1 : -1) * width * (0.85 + 0.2 * Math.sin(t + phase)) / 2).addScaledVector(normal, 0.028);
      positions.push(p.x, p.y, p.z);
      uvs.push(i / steps, side);
    }
    if (i < steps) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
