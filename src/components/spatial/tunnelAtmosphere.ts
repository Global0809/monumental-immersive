import * as THREE from 'three';
import { createAtmosphereInput } from './atmosphereInput';

/** Continuous world-anchored air through the entire passage. One GPU point
 * cloud shares the camera and input field; no regenerated particle allocations. */
export function createTunnelAtmosphere() {
  const count = 2400;
  const input = createAtmosphereInput();
  const positions = new Float32Array(count * 3);
  const traits = new Float32Array(count * 3);
  let seed = 74021;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < count; i++) {
    const angle=random()*Math.PI*2, radius=1.5+Math.sqrt(random())*6.7;
    positions.set([Math.cos(angle)*radius,Math.sin(angle)*radius,22-random()*340],i*3);
    traits.set([random()*Math.PI*2,.035+random()**2*.065,random()],i*3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aTraits', new THREE.BufferAttribute(traits, 3));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uHeight: { value: 700 }, uPixelRatio: { value: 1 }, uLight: { value: 1 },
      uPointer: { value: new THREE.Vector4() }, uVelocity: { value: new THREE.Vector2() },
      uTrail: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) },
      uPulse: { value: new THREE.Vector4(0, 0, 2, 0) },
      uOrbit: { value: 0 },
      uTravel: { value: 0 }, uSignal: { value: new THREE.Vector3(0, 8, 0) },
    },
    vertexShader: `
      attribute vec3 aTraits;
      uniform float uTime, uHeight, uPixelRatio, uOrbit, uTravel;
      uniform vec3 uSignal;
      uniform vec4 uPointer, uPulse;
      uniform vec2 uVelocity;
      uniform vec3 uTrail[4];
      varying float vEnergy, vTint, vDepth, vReaction, vTravel;
      varying vec2 vDirection;
      void main() {
        vec3 p = position;
        float phase = aTraits.x;
        // Nested currents give neighboring lights a shared fluid motion.
        float stream = sin(p.z * .19 + uTime * .24) + cos(p.y * .32 - uTime * .18);
        float orbitAngle = uTime * .035 + sin(p.z * .025 + uTime * .09) * .13;
        p.xy = mat2(cos(orbitAngle),-sin(orbitAngle),sin(orbitAngle),cos(orbitAngle))*p.xy;
        p.x += sin(p.z * .17 + uTime * .22 + stream) * .34;
        p.y += sin(p.x * .21 - uTime * .19 + phase * .35) * .28;
        p.z += cos(p.x * .16 + uTime * .18 + stream) * .24;
        float signalDistance = (p.z - (uSignal.x - 4.0 - uSignal.y * 36.0)) / 7.0;
        float signal = exp(-signalDistance * signalDistance) * uSignal.z * (1.0 - smoothstep(5.0, 8.0, uSignal.y));
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        float depth = -view.z;
        vec2 projection = vec2(projectionMatrix[0][0], projectionMatrix[1][1]);
        vec2 metric = vec2(projection.y / projection.x, 1.0);
        vec2 screen = view.xy * projection / max(depth, .5);
        vec2 d = (screen - uPointer.xy) * metric;
        float radius = length(d);
        vec2 radial = d / max(radius, .015);
        vec2 tangent = vec2(-radial.y, radial.x);
        float influence = exp(-dot(d, d) * 3.2) * uPointer.z;
        vec2 velocity = uVelocity * metric;
        float speed = min(length(velocity), 4.0);
        float charge = uPointer.w;

        // Hover parts the air; quick sweeps pull it into a curved wake.
        vec2 drift = (radial * .075 + tangent * .14 + velocity * .045) * influence;
        float wake = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 delta = (screen - uTrail[i].xy) * metric;
          float field = exp(-dot(delta, delta) * 8.0) * uTrail[i].z;
          drift += (vec2(-delta.y, delta.x) * .42 + velocity * .026) * field;
          wake += field;
        }

        // Hold gathers nearby light into layered arcs. Release lets it
        // relax back to its real coordinates in the architecture.
        float angle = atan(d.y, d.x) + uOrbit + phase * .4;
        float orbitRadius = .16 + aTraits.z * .18;
        vec2 orbit = vec2(cos(angle), sin(angle)) * orbitRadius;
        drift += (orbit - d) * influence * charge * .94;
        vec2 pulseDelta = (screen - uPulse.xy) * metric;
        float pulseRadius = length(pulseDelta);
        float waveDistance = (pulseRadius - uPulse.z * 1.15) * 8.0;
        float wave = exp(-waveDistance * waveDistance);
        wave *= uPulse.w * (1.0 - smoothstep(.15, 1.6, uPulse.z));
        drift += pulseDelta / max(pulseRadius, .02) * wave * .19;
        float reaction = min(1.0, influence * (.35 + speed * .28 + charge * .65) + wake * .22 + wave + signal * .8);
        view.xy += (drift / metric) * max(depth, .5) / projection;
        view.z += sin(phase + uTime * .7) * influence * charge * .24;
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(aTraits.y * (1.0 + reaction * .7) * uHeight * projection.y / max(depth, .5),
          1.0 * uPixelRatio, 14.0 * uPixelRatio);
        vDepth = smoothstep(.7, 2.0, depth) * (1.0 - smoothstep(65.0, 120.0, depth));
        vEnergy = .85 + .12 * sin(uTime * .45 + phase);
        vReaction = reaction;
        vTravel = uTravel;
        vTint = aTraits.z;
        vDirection = normalize(vec2(drift.x, -drift.y) + vec2(.001, .002));
      }
    `,
    fragmentShader: `
      uniform float uLight;
      varying float vEnergy, vTint, vDepth, vReaction, vTravel;
      varying vec2 vDirection;
      void main() {
        vec2 uv = (gl_PointCoord - .5) * 2.0;
        float r = length(uv);
        if (r > 1.0) discard;
        float halo = exp(-r * r * 12.0) * (.055 + vReaction * .055);
        float core = exp(-r * r * 105.0) * .7;
        vec2 axial = vec2(dot(uv, vDirection), dot(uv, vec2(-vDirection.y, vDirection.x)));
        float glint = exp(-axial.x * axial.x * (14.0 - vTravel * 9.0) - axial.y * axial.y * 160.0) * (vReaction * .1 + vTravel * .12);
        float alpha = (core + halo + glint) * (1.0 - smoothstep(.65, 1.0, r)) * vDepth * vEnergy * uLight;
        vec3 chrome = vec3(.88, .86, .78);
        vec3 signal = vec3(1.0, .302, .196);
        vec3 color = mix(chrome, signal, max(step(.76, vTint), vReaction * .6));
        gl_FragColor = vec4(color, min(alpha, .60));
        #include <colorspace_fragment>
      }
    `,
  });
  material.toneMapped = false;
  const points = new THREE.Points(geometry, material);
  points.name = 'Monumental / passage currents';
  points.frustumCulled = false;
  return {
    points, input,
    configure(height: number, ratio: number, mobile: boolean, quality: string, light: number) {
      geometry.setDrawRange(0, quality === 'light' ? 700 : mobile ? 600 : quality === 'detail' ? count : 1800);
      material.uniforms.uHeight.value = height * ratio;
      material.uniforms.uPixelRatio.value = ratio;
      material.uniforms.uLight.value = .9 + THREE.MathUtils.clamp(light, 0, 100) / 400;
    },
    update(time: number, dt = 1 / 60, reducedMotion = false, travel = 0, signal?: {age:number;originZ:number;strength:number}) {
      if (reducedMotion) input.reset();
      const field = input.update(reducedMotion ? 0 : dt);
      material.uniforms.uTime.value = time;
      material.uniforms.uTravel.value = Math.min(1, Math.max(0, travel));
      material.uniforms.uSignal.value.set(signal?.originZ ?? 0, signal?.age ?? 8, signal?.strength ?? 0);
      material.uniforms.uOrbit.value = field.orbit;
      material.uniforms.uPointer.value.set(field.x, field.y, field.strength, field.charge);
      material.uniforms.uVelocity.value.set(field.vx, field.vy);
      field.trail.forEach((node, i) => material.uniforms.uTrail.value[i].set(node.x, node.y, node.strength));
      material.uniforms.uPulse.value.set(field.pulse.x, field.pulse.y, field.pulse.age, field.pulse.power);
    },
    dispose() { input.reset(); geometry.dispose(); material.dispose(); },
  };
}
