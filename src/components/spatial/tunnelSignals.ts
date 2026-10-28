import * as THREE from 'three';
import type { TunnelLifeFrame } from '../../services/tunnelLife';

const TAU = Math.PI * 2;
const VANE_ROWS = 86;
const VANE_LANES = 6;
const TRAIN_LANES = 8;
const TRAIN_LENGTH = 12;
const TUNNEL_LENGTH = 328;

/** Wall-bound mechanisms use the Passage's existing clock and camera. The
 * travelling signal is a real surface detail, never a screen-space overlay. */
export function createTunnelSignals(scene: THREE.Scene) {
  const root = new THREE.Group();
  root.name = 'passage-living-signals';
  scene.add(root);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const instances: THREE.InstancedMesh[] = [];
  const matrix = new THREE.Object3D();
  const color = new THREE.Color();
  let disposed = false;
  let clock = 0;
  let quietAmount = 0;
  const uniforms = {
    uLifeTime: { value: 0 }, uLifeCameraZ: { value: 14 },
    uLifeStation: { value: -36 }, uLifeRead: { value: 0 },
    uLifeEnergy: { value: 0 }, uLifePointer: { value: new THREE.Vector2() },
    uLifePulse: { value: new THREE.Vector3(99, 0, 0) },
  };
  const common = `
    uniform float uLifeTime, uLifeCameraZ, uLifeStation, uLifeRead, uLifeEnergy;
    uniform vec2 uLifePointer;
    uniform vec3 uLifePulse;
    float lifeWave(float z) {
      float age = uLifePulse.x;
      float front = uLifePulse.y - 4.0 - age * 36.0;
      float distance = (z - front) / 3.8;
      return exp(-distance * distance) * uLifePulse.z
        * (1.0 - smoothstep(4.0, 6.2, age));
    }
    float lifeQuiet(float z) {
      return 1.0 - uLifeRead * (1.0 - smoothstep(4.0, 18.0, abs(z - uLifeStation))) * .86;
    }
    float lifeRange(float z) {
      float depth = uLifeCameraZ - z;
      return smoothstep(-8.0, -2.0, depth) * (1.0 - smoothstep(75.0, 112.0, depth));
    }
    float lifePointer(float angle) {
      vec2 direction = vec2(cos(angle), sin(angle));
      float amount = min(length(uLifePointer), 1.0);
      return pow(max(0.0, dot(direction, normalize(uLifePointer + vec2(.0001)))), 6.0) * amount;
    }
  `;
  const vaneCommon = `${common}
    attribute vec3 aLife;
    float lifeHinge() {
      float passing = exp(-pow((aLife.x - (uLifeCameraZ - 13.0)) / 13.0, 2.0));
      float wave = pow(.5 + .5 * sin(aLife.x * .13 + aLife.y * 1.7 + uLifeTime * .62), 3.0);
      return -.035 - min(.38, (wave * .12 + passing * (.08 + uLifeEnergy * .09)
        + lifePointer(aLife.y) * passing * .1 + lifeWave(aLife.x) * .26) * lifeQuiet(aLife.x));
    }
    vec3 lifeRotate(vec3 p) {
      float angle = lifeHinge(), c = cos(angle), s = sin(angle);
      return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
    }
  `;

  // Each blade is hinged at its leading edge. The maximum opening leaves
  // more than 7.5 world units of clear radius around the camera path.
  const vaneGeometry = new THREE.BoxGeometry(.78, .065, 1.8).translate(0, 0, -.9);
  const edgeGeometry = new THREE.BoxGeometry(.035, .016, 1.62).translate(.358, .044, -.9);
  geometries.push(vaneGeometry, edgeGeometry);
  const vaneMaterial = new THREE.MeshStandardMaterial({ color: 0x646b65, metalness: .89, roughness: .28 });
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  materials.push(vaneMaterial, edgeMaterial);
  const traits = new Float32Array(VANE_ROWS * VANE_LANES * 3);
  for (let i = 0; i < VANE_ROWS * VANE_LANES; i++) {
    const row = Math.floor(i / VANE_LANES), lane = i % VANE_LANES;
    traits.set([15.8 - row * 3.65, lane * TAU / VANE_LANES + row * .058 + .26, row % 7], i * 3);
  }
  vaneGeometry.setAttribute('aLife', new THREE.InstancedBufferAttribute(traits, 3));
  edgeGeometry.setAttribute('aLife', new THREE.InstancedBufferAttribute(traits, 3));
  for (const material of [vaneMaterial, edgeMaterial]) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${vaneCommon}\nvarying float vLifeCharge;`)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = lifeRotate(objectNormal);')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed = lifeRotate(transformed) * max(.001, lifeRange(aLife.x));
          vLifeCharge = (lifeWave(aLife.x) * .85 + lifePointer(aLife.y) * .22 + uLifeEnergy * .12) * lifeQuiet(aLife.x);
        `);
      if (material === edgeMaterial) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLifeCharge;')
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= .42 + vLifeCharge * .8;');
      }
    };
    material.customProgramCacheKey = () => `monumental-life-vanes-v1-${material.type}`;
  }
  const vanes = new THREE.InstancedMesh(vaneGeometry, vaneMaterial, VANE_ROWS * VANE_LANES);
  const edges = new THREE.InstancedMesh(edgeGeometry, edgeMaterial, VANE_ROWS * VANE_LANES);
  vanes.name = 'hinged-alloy-wall-vanes'; edges.name = 'vane-signal-inlays';
  for (let i = 0; i < vanes.count; i++) {
    const angle = traits[i * 3 + 1];
    matrix.position.set(Math.cos(angle) * 8.26, Math.sin(angle) * 8.26, traits[i * 3]);
    matrix.rotation.set(0, 0, angle - Math.PI / 2); matrix.scale.set(1, 1, 1); matrix.updateMatrix();
    vanes.setMatrixAt(i, matrix.matrix); edges.setMatrixAt(i, matrix.matrix);
    color.set(i % 6 === 0 ? 0xaaa79d : 0xff4d32); edges.setColorAt(i, color);
  }
  for (const mesh of [vanes, edges]) { mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; root.add(mesh); instances.push(mesh); }

  // Narrow physical rails carry segmented light trains. All eight rails share
  // one geometry; only their compact signal heads move in the vertex shader.
  const railPositions: number[] = [], railUvs: number[] = [], railIndices: number[] = [];
  const railSteps = 420;
  for (let lane = 0; lane < TRAIN_LANES; lane++) {
    const base = railPositions.length / 3;
    for (let n = 0; n <= railSteps; n++) {
      const z = 18 - n / railSteps * TUNNEL_LENGTH;
      const angle = lane * TAU / TRAIN_LANES + z * .027;
      for (const side of [-1, 1]) {
        const a = angle + side * .0021;
        railPositions.push(Math.cos(a) * 8.04, Math.sin(a) * 8.04, z);
        railUvs.push((side + 1) / 2, n / railSteps);
      }
      if (n < railSteps) { const i = base + n * 2; railIndices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
  }
  const railGeometry = new THREE.BufferGeometry();
  railGeometry.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
  railGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(railUvs, 2)); railGeometry.setIndex(railIndices); geometries.push(railGeometry);
  const railMaterial = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    vertexShader: `${common} varying float vLifeAlpha; void main() {
      vLifeAlpha = lifeRange(position.z) * lifeQuiet(position.z) * (.10 + lifeWave(position.z) * .45);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    fragmentShader: `varying float vLifeAlpha; void main() {
      gl_FragColor = vec4(1.0, .075, .033, vLifeAlpha);
      #include <colorspace_fragment>
    }`,
  });
  railMaterial.forceSinglePass = true; railMaterial.toneMapped = false; materials.push(railMaterial);
  const rails = new THREE.Mesh(railGeometry, railMaterial); rails.name = 'helical-transmission-rails'; root.add(rails);
  const trainGeometry = new THREE.BoxGeometry(.085, .048, .72);
  const trainTraits = new Float32Array(TRAIN_LANES * TRAIN_LENGTH * 3);
  for (let i = 0; i < TRAIN_LANES * TRAIN_LENGTH; i++) trainTraits.set([Math.floor(i / TRAIN_LENGTH), i % TRAIN_LENGTH, (i % TRAIN_LENGTH) / (TRAIN_LENGTH - 1)], i * 3);
  trainGeometry.setAttribute('aTrain', new THREE.InstancedBufferAttribute(trainTraits, 3)); geometries.push(trainGeometry);
  const trainMaterial = new THREE.ShaderMaterial({ uniforms, depthTest: true, depthWrite: true,
    vertexShader: `${common}
      attribute vec3 aTrain; varying vec3 vLifeTint; varying float vLifeVisibility;
      void main() {
        float lane = aTrain.x;
        float z = 18.0 - mod(uLifeTime * (7.2 + mod(lane, 3.0) * .7) + lane * 41.0 - aTrain.y * .92 + 656.0, 328.0);
        float angle = lane * .7853981634 + z * .027;
        float quiet = lifeQuiet(z), range = lifeRange(z);
        float taper = 1.0 - aTrain.z * .82;
        vec3 p = position * vec3(taper, taper, aTrain.y < .5 ? 1.7 : .72);
        p *= range;
        vec3 radial = vec3(cos(angle), sin(angle), 0.0);
        vec3 tangent = vec3(-sin(angle), cos(angle), 0.0);
        vec3 centre = radial * 8.035 + vec3(0.0, 0.0, z);
        vec3 world = centre + tangent * p.x + radial * p.y + normalize(vec3(tangent.xy * .217, 1.0)) * p.z;
        float head = 1.0 - smoothstep(0.0, 2.0, aTrain.y);
        vLifeTint = mix(vec3(1.0, .075, .033), vec3(.86, .84, .76), head);
        vLifeVisibility = (1.0 - aTrain.z * .65) * quiet * range;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: `varying vec3 vLifeTint; varying float vLifeVisibility;
      void main() {
        if (vLifeVisibility < .015) discard;
        gl_FragColor = vec4(vLifeTint * vLifeVisibility, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  trainMaterial.toneMapped = false; materials.push(trainMaterial);
  const trains = new THREE.InstancedMesh(trainGeometry, trainMaterial, TRAIN_LANES * TRAIN_LENGTH);
  trains.name = 'helical-signal-trains'; trains.frustumCulled = false;
  matrix.position.set(0, 0, 0); matrix.rotation.set(0, 0, 0); matrix.scale.set(1, 1, 1); matrix.updateMatrix();
  for (let i = 0; i < trains.count; i++) trains.setMatrixAt(i, matrix.matrix);
  root.add(trains); instances.push(trains);

  // The visitor's pulse visits real tunnel coordinates. Three separated arcs
  // propagate together, opening vanes and charging their inlays as they pass.
  const pulseGeometry = new THREE.TorusGeometry(7.98, .023, 4, 16, Math.PI / 6 * .61);
  const pulseTraits = new Float32Array(36 * 2);
  for (let i = 0; i < 36; i++) pulseTraits.set([i % 12, Math.floor(i / 12)], i * 2);
  pulseGeometry.setAttribute('aPulse', new THREE.InstancedBufferAttribute(pulseTraits, 2)); geometries.push(pulseGeometry);
  const pulseMaterial = new THREE.ShaderMaterial({ uniforms, depthTest: true, depthWrite: false, transparent: true,
    vertexShader: `${common} attribute vec2 aPulse; varying float vLifeAlpha;
      void main() {
        float z = uLifePulse.y - 4.0 - uLifePulse.x * 36.0 + aPulse.y * 1.05;
        float angle = aPulse.x * .5235987756 + z * -.01589;
        float c = cos(angle), s = sin(angle);
        vec3 world = vec3(position.x * c - position.y * s, position.x * s + position.y * c, position.z + z);
        vLifeAlpha = uLifePulse.z * (1.0 - smoothstep(4.0, 6.2, uLifePulse.x))
          * (1.0 - aPulse.y * .31) * lifeRange(z) * lifeQuiet(z) * .78;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: `varying float vLifeAlpha; void main() {
      gl_FragColor = vec4(1.0, .075, .033, vLifeAlpha);
      #include <colorspace_fragment>
    }`,
  });
  pulseMaterial.toneMapped = false; materials.push(pulseMaterial);
  const pulse = new THREE.InstancedMesh(pulseGeometry, pulseMaterial, 36);
  pulse.name = 'travelling-architectural-pulse'; pulse.frustumCulled = false; pulse.visible = false;
  for (let i = 0; i < pulse.count; i++) pulse.setMatrixAt(i, matrix.matrix);
  root.add(pulse); instances.push(pulse);

  return {
    update(frame: TunnelLifeFrame) {
      if (disposed) return;
      root.visible = !frame.compact && !frame.reducedMotion;
      if (!root.visible) return;
      const reading = frame.active >= 0 && frame.progress >= .38 && (frame.progress <= .74 || frame.active === 5);
      // Shared delta advances a local, continuous clock. Changing from travel
      // to reading never jumps the train coordinates or produces an extra RAF.
      clock += Math.min(Math.max(frame.delta, 0), .05) * (frame.inspection ? .12 : reading ? .34 : 1);
      quietAmount += ((reading || frame.inspection ? 1 : 0) - quietAmount)
        * (1 - Math.exp(-Math.min(Math.max(frame.delta, 0), .05) * 9));
      uniforms.uLifeTime.value = clock;
      uniforms.uLifeCameraZ.value = frame.cameraZ;
      uniforms.uLifeStation.value = -36 - Math.max(0, frame.active) * 42;
      uniforms.uLifeRead.value = quietAmount;
      uniforms.uLifeEnergy.value = Math.min(1, Math.max(0, frame.energy));
      uniforms.uLifePointer.value.set(frame.pointer[0], frame.pointer[1]);
      uniforms.uLifePulse.value.set(frame.pulse.age, frame.pulse.originZ, frame.pulse.strength);
      pulse.visible = !frame.inspection && frame.pulse.strength > .01 && frame.pulse.age >= 0 && frame.pulse.age < 6.2;
      // The light preset drops two entire draws rather than producing different
      // motion or positions. Every device keeps the same authored silhouette.
      rails.visible = frame.quality !== 'light';
      edges.visible = frame.quality !== 'light';
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      scene.remove(root);
      for (const instance of instances) instance.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      root.clear();
    },
  };
}
