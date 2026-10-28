import * as THREE from 'three';

export interface SpiralFieldInput {
  pointerX: number;
  pointerY: number;
  energy: number;
  compact: boolean;
  reducedMotion: boolean;
}

/** A shared, camera-independent current: two draw calls, no per-frame buffers.
 * The clear central corridor is deliberate; the architecture moves around the
 * visitor without moving the document or the camera that presents its content. */
export function createSpiralField() {
  const root = new THREE.Group();
  root.name = 'Monumental spiral current';
  const count = 132;
  const subdivisions = 24;
  let seed = 280106;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const position = new Float32Array((subdivisions + 1) * 2 * 3);
  const indices: number[] = [];
  for (let i = 0; i <= subdivisions; i++) {
    position.set([i / subdivisions, -1, 0, i / subdivisions, 1, 0], i * 6);
    if (i < subdivisions) {
      const j = i * 2;
      indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
  }
  const trails = new Float32Array(count * 4);
  const styles = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    trails.set([random(), random() * Math.PI * 2, random(), 3.8 + random() * 8.5], i * 4);
    styles.set([random(), random()], i * 2);
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aTrail', new THREE.InstancedBufferAttribute(trails, 4));
  geometry.setAttribute('aStyle', new THREE.InstancedBufferAttribute(styles, 2));
  geometry.setIndex(indices);
  geometry.instanceCount = count;

  // Identical current/projection math for filaments and motes keeps depth coherent.
  const current = `
    uniform float uPhase, uEnergy, uOpacity;
    uniform vec2 uPointer;
    varying vec2 vScreen;
    varying float vDepth;
    vec3 currentPoint(float z, float angleSeed, float radiusSeed) {
      float angle = angleSeed + z * .115 - uPhase * .12;
      float radius = 10.5 + radiusSeed * 8.5;
      radius += sin(z * .055 + angleSeed) * .7;
      vec2 p = vec2(cos(angle), sin(angle)) * radius;
      // A slight off-axis centre reads as a flowing corkscrew, not concentric rings.
      p += vec2(sin(z * .041), cos(z * .033)) * 1.15;
      p += uPointer * (.55 + radiusSeed * .3);
      return vec3(p, z);
    }
    void projectCurrent(vec3 p) {
      vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      gl_Position = clip;
      vScreen = clip.xy / max(clip.w, .01);
      vDepth = smoothstep(-71.0, -55.0, p.z) * (1.0 - smoothstep(-1.0, 5.0, p.z));
    }
  `;
  const corridor = `
    uniform float uOpacity;
    varying vec2 vScreen;
    varying float vDepth;
    float corridorVisibility() {
      float distance = length(vScreen * vec2(.86, 1.0));
      return smoothstep(.38, .90, distance) * vDepth * uOpacity;
    }
  `;
  const uniforms = {
    uPhase: { value: 0 },
    uEnergy: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uOpacity: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      attribute vec4 aTrail;
      attribute vec2 aStyle;
      varying float vAcross, vAlong, vSignal, vStrength;
      ${current}
      void main() {
        float head = -65.0 + mod(aTrail.x * 70.0 + uPhase * 2.75, 70.0);
        float z = head - position.x * aTrail.w * (1.0 + uEnergy * .17);
        vec3 p = currentPoint(z, aTrail.y, aTrail.z);
        float angle = aTrail.y + z * .115 - uPhase * .12;
        float width = mix(.012, .026, aStyle.y) * max(10.0 - z, 8.0) / 25.0;
        p.xy += vec2(cos(angle), sin(angle)) * position.y * width;
        projectCurrent(p);
        vAcross = position.y;
        vAlong = position.x;
        vSignal = step(.88, aStyle.x);
        vStrength = mix(.25, .56, aStyle.y);
      }
    `,
    fragmentShader: `
      varying float vAcross, vAlong, vSignal, vStrength;
      ${corridor}
      void main() {
        float edge = 1.0 - smoothstep(.38, 1.0, abs(vAcross));
        float taper = smoothstep(0.0, .12, vAlong) * (1.0 - smoothstep(.64, 1.0, vAlong));
        float alpha = corridorVisibility() * edge * taper * vStrength;
        if (alpha < .003) discard;
        vec3 ink = mix(vec3(.60, .63, .63), vec3(1.0, .302, .196), vSignal);
        gl_FragColor = vec4(ink, alpha);
      }
    `,
  });
  const filaments = new THREE.Mesh(geometry, material);
  filaments.name = 'Spiral filaments';
  filaments.frustumCulled = false;
  filaments.renderOrder = -20;
  root.add(filaments);

  const moteCount = 240;
  const motes = new Float32Array(moteCount * 3);
  const moteTraits = new Float32Array(moteCount * 2);
  for (let i = 0; i < moteCount; i++) {
    motes.set([random(), random() * Math.PI * 2, random()], i * 3);
    moteTraits.set([random(), random()], i * 2);
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motes, 3));
  moteGeometry.setAttribute('aStyle', new THREE.BufferAttribute(moteTraits, 2));
  const moteMaterial = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: false,
    vertexShader: `
      attribute vec2 aStyle;
      varying float vSignal, vStrength;
      ${current}
      void main() {
        float z = -65.0 + mod(position.x * 70.0 + uPhase * 2.75, 70.0);
        projectCurrent(currentPoint(z, position.y, position.z));
        gl_PointSize = mix(1.25, 2.8, aStyle.y) * mix(.65, 1.0, smoothstep(-60.0, -8.0, z));
        vSignal = step(.92, aStyle.x);
        vStrength = mix(.18, .56, aStyle.y);
      }
    `,
    fragmentShader: `
      varying float vSignal, vStrength;
      ${corridor}
      void main() {
        float radius = length(gl_PointCoord - .5) * 2.0;
        float alpha = (1.0 - smoothstep(.18, 1.0, radius)) * corridorVisibility() * vStrength;
        if (alpha < .003) discard;
        gl_FragColor = vec4(mix(vec3(.72, .74, .73), vec3(1.0, .302, .196), vSignal), alpha);
      }
    `,
  });
  const dust = new THREE.Points(moteGeometry, moteMaterial);
  dust.name = 'Depth markers';
  dust.frustumCulled = false;
  dust.renderOrder = -19;
  root.add(dust);

  let phase = 0;
  let energy = 0;
  let disposed = false;
  return {
    root,
    update(_time: number, dt: number, input: SpiralFieldInput) {
      if (disposed) return;
      const elapsed = Math.min(Math.max(dt, 0), .05);
      const follow = 1 - Math.exp(-elapsed * 3.5);
      energy += (THREE.MathUtils.clamp(input.energy, 0, 1) - energy) * follow;
      // Integrating bounded elapsed time avoids a resumed tab jumping through space.
      if (!input.reducedMotion) phase += elapsed * (.72 + energy * .68);
      uniforms.uPhase.value = phase;
      uniforms.uEnergy.value = input.reducedMotion ? 0 : energy;
      uniforms.uOpacity.value = input.reducedMotion ? .42 : input.compact ? .83 : 1;
      if (!input.reducedMotion) {
        uniforms.uPointer.value.x += (THREE.MathUtils.clamp(input.pointerX, -1, 1) - uniforms.uPointer.value.x) * follow;
        uniforms.uPointer.value.y += (THREE.MathUtils.clamp(input.pointerY, -1, 1) - uniforms.uPointer.value.y) * follow;
      }
      geometry.instanceCount = input.compact ? 82 : count;
      moteGeometry.setDrawRange(0, input.compact ? 130 : moteCount);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      material.dispose();
      moteGeometry.dispose();
      moteMaterial.dispose();
      root.clear();
    },
  };
}
