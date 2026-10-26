import * as THREE from 'three';
import { portalPositions } from './cameraPath';

/** One world-space point cloud. The soft halo lives inside each sprite, so
 * photographs and chrome never pass through a full-screen bloom filter. */
export function createAtmosphere() {
  const count = 320;
  const positions = new Float32Array(count * 3);
  const traits = new Float32Array(count * 3);
  let seed = 74021;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      // Local air volumes keep each doorway inhabited after the camera docks.
      // These positions remain fixed in the building, not attached to the lens.
      const origin = new THREE.Vector3(...portalPositions[(i / 2) % portalPositions.length]);
      const front = new THREE.Vector3(0, 2.05, 4.5).sub(origin).normalize();
      const right = new THREE.Vector3(front.z, 0, -front.x);
      origin.addScaledVector(front, 1.3 + random() * 8).addScaledVector(right, (random() - .5) * 8);
      origin.y = .4 + random() * 6.8;
      positions.set(origin.toArray(), i * 3);
    } else positions.set([(random() - .5) * 31, .25 + random() * 9.5, -23 + random() * 42], i * 3);
    traits.set([random() * Math.PI * 2, .055 + random() ** 3 * .17, random()], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aTraits', new THREE.BufferAttribute(traits, 3));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uHeight: { value: 700 }, uPixelRatio: { value: 1 }, uLight: { value: 1 } },
    vertexShader: `
      attribute vec3 aTraits;
      uniform float uTime, uHeight, uPixelRatio;
      varying float vEnergy, vTint, vDepth;
      void main() {
        vec3 p = position;
        float phase = aTraits.x;
        // Slow, coherent air currents rather than noisy per-frame wandering.
        p.x += sin(uTime * .13 + p.z * .12 + phase) * .34;
        p.y += sin(uTime * .17 + phase) * .26;
        p.z += cos(uTime * .09 + p.x * .18 + phase) * .32;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        float depth = -view.z;
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(aTraits.y * uHeight * projectionMatrix[1][1] / max(depth, .5), 2.0 * uPixelRatio, 44.0 * uPixelRatio);
        vDepth = smoothstep(.65, 2.2, depth) * (1.0 - smoothstep(27.0, 44.0, depth));
        vEnergy = .72 + .18 * sin(uTime * .3 + phase);
        vTint = aTraits.z;
      }
    `,
    fragmentShader: `
      uniform float uLight;
      varying float vEnergy, vTint, vDepth;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.0;
        if (r > 1.0) discard;
        float halo = exp(-r * r * 5.0) * .18;
        float core = exp(-r * r * 85.0) * .86;
        float alpha = (core + halo) * (1.0 - smoothstep(.7, 1.0, r)) * vDepth * vEnergy * uLight;
        vec3 chrome = vec3(.82, .88, .85);
        vec3 signal = vec3(1.0, .302, .196);
        vec3 color = mix(chrome, signal, step(.73, vTint));
        color = mix(color, vec3(1.0, .94, .84), core * .42);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  material.toneMapped = false;
  const points = new THREE.Points(geometry, material);
  points.name = 'Monumental / suspended light';
  points.frustumCulled = false;
  return {
    points,
    configure(height: number, ratio: number, mobile: boolean, quality: string, light: number) {
      geometry.setDrawRange(0, quality === 'light' ? 100 : mobile ? 150 : quality === 'detail' ? count : 240);
      material.uniforms.uHeight.value = height * ratio;
      material.uniforms.uPixelRatio.value = ratio;
      material.uniforms.uLight.value = .85 + light / 200;
    },
    update(time: number) { material.uniforms.uTime.value = time; },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}
