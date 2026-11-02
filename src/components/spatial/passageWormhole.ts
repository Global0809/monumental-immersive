import * as THREE from 'three';

export type PassageWormholeQuality = 'light' | 'auto' | 'balanced' | 'detail';
export type PassageWormholeRect = Readonly<{ left: number; top: number; right: number; bottom: number }>;

/** A camera-independent view into the current, rendered by the Passage renderer.
 * One bounded cloud target and one opaque resolve; no new animation clock.
 * Opaque scene surfaces drawn afterwards naturally cover this distant backdrop. */
export function createPassageWormhole(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const protectedRects = Array.from({ length: 4 }, () => new THREE.Vector4(-2, -2, -1, -1));
  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uFlow: { value: 0 },
    uEnergy: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uPointerStrength: { value: 0 },
    uCalm: { value: 0 },
    uCompact: { value: 0 },
    uOctaves: { value: 4 },
    uProtectedRects: { value: protectedRects },
    uProtectedCount: { value: 0 },
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const material = new THREE.ShaderMaterial({
    name: 'Passage organic wormhole',
    uniforms,
    transparent: false,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NoBlending,
    toneMapped: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * .5 + .5;
        gl_Position = vec4(position.xy, .9999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uResolution, uPointer;
      uniform float uFlow, uEnergy, uPointerStrength, uCalm, uCompact;
      uniform int uOctaves, uProtectedCount;
      uniform vec4 uProtectedRects[4];
      varying vec2 vUv;

      const float TAU = 6.28318530718;
      float hash13(vec3 p) {
        p = fract(p * .1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float hash12(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
              mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
              mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      // Four value-noise octaves maximum. The coarse field warps later octaves
      // into billowing edges without a second fbm stack or ray-marching loop.
      vec3 clouds(vec3 p) {
        float sum = 0.0, weight = .53, total = 0.0, coarse = 0.0, detail = 0.0;
        mat3 turn = mat3(.00, .80, .60, -.80, .36, -.48, -.60, -.48, .64);
        for (int octave = 0; octave < 4; octave++) {
          if (octave >= uOctaves) break;
          float n = noise(p);
          if (octave == 0) coarse = n;
          detail = n;
          sum += n * weight;
          total += weight;
          p = turn * p * 2.03 + vec3(3.7, 8.2, 1.4) + (n - .5) * .63;
          weight *= .49;
        }
        return vec3(sum / total, coarse, detail);
      }
      float segment(vec2 p, vec2 a, vec2 b) {
        vec2 edge = b - a;
        float t = clamp(dot(p - a, edge) / dot(edge, edge), 0.0, 1.0);
        return length(p - a - edge * t);
      }
      float glyph(vec2 p, float seed, float aa) {
        float stroke = segment(p, vec2(-.18, -.30), vec2(-.18, .30));
        stroke = min(stroke, segment(p, vec2(-.18, .30), vec2(.18, .12)));
        if (seed > .45) stroke = min(stroke, segment(p, vec2(-.18, -.09), vec2(.17, .08)));
        if (seed < .72) stroke = min(stroke, segment(p, vec2(.17, .08), vec2(.17, -.28)));
        if (seed > .70) stroke = min(stroke, segment(p, vec2(-.18, -.28), vec2(.15, -.28)));
        return 1.0 - smoothstep(.013, .013 + aa, stroke);
      }
      float protection() {
        vec2 topUv = vec2(vUv.x, 1.0 - vUv.y);
        vec2 feather = vec2(24.0) / max(uResolution, vec2(1.0));
        float protectedArea = 0.0;
        for (int i = 0; i < 4; i++) {
          if (i >= uProtectedCount) break;
          vec4 rect = uProtectedRects[i];
          vec2 enter = smoothstep(rect.xy - feather, rect.xy + feather, topUv);
          vec2 leave = 1.0 - smoothstep(rect.zw - feather, rect.zw + feather, topUv);
          protectedArea = max(protectedArea, enter.x * enter.y * leave.x * leave.y);
        }
        return protectedArea;
      }
      void main() {
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        vec2 p = (vUv - .5) * vec2(aspect, 1.0) * 2.0;
        // The pointer only bends this current locally. It never changes the
        // camera, the foreground projection or the position of a reading panel.
        vec2 pointer = uPointer * vec2(aspect, 1.0);
        vec2 delta = p - pointer;
        float influence = exp(-dot(delta, delta) * 2.8) * uPointerStrength;
        p += (vec2(-delta.y, delta.x) * .075 + delta * .025) * influence;
        p -= vec2(.035, .075);
        float radius = length(p);
        float logRadius = log(max(radius, .035));
        float angle = atan(p.y, p.x);
        float spiral = angle + logRadius * .79;
        // Sampling against a continuously decreasing longitudinal coordinate
        // moves each cloud and star from the core out towards the visitor.
        float depth = logRadius * 2.25 - uFlow;
        vec3 field = clouds(vec3(cos(spiral) * 2.8, sin(spiral) * 2.8, depth));
        float arm = .5 + .5 * sin(spiral * 2.0 + field.y * 3.4 + depth * .31);
        float density = smoothstep(.36, .84, field.x + arm * .12);
        float folds = 1.0 - abs(field.x * 2.0 - 1.0);
        float lightEdge = pow(clamp(density, 0.0, 1.0), 2.6);
        float cloudWall = smoothstep(.115, .31, radius);
        float abyss = smoothstep(.085, .185, radius + (field.y - .5) * .026);
        float warmth = smoothstep(-.39, .59, sin(spiral + field.y * 2.4 + .35));
        vec3 copper = mix(vec3(.025, .008, .004), vec3(.42, .135, .045), lightEdge);
        vec3 slate = mix(vec3(.008, .014, .020), vec3(.095, .135, .165), lightEdge);
        vec3 cloudColor = mix(slate, copper, warmth);
        vec3 color = vec3(.0031, .0046, .0051);
        float shadow = .30 + .70 * smoothstep(.21, .71, field.y);
        color += cloudColor * (.16 + density * 1.23) * shadow * cloudWall;
        // Soft ivory light inside the densest folds creates volume, avoiding a
        // flat plasma gradient or a neon outline around the dark central void.
        float silver = pow(density, 5.0) * (.25 + .75 * folds);
        color += vec3(.48, .43, .34) * silver * .20 * cloudWall;
        float haze = exp(-abs(radius - .25) * 7.5) * (.35 + .65 * density);
        color += mix(vec3(.024, .038, .049), vec3(.11, .052, .024), warmth) * haze;

        // A sparse, jittered cylindrical star field: no reset plane, uniform
        // burst, screen-space dot grid or repeating concentric speed rings.
        float starAngle = angle / TAU + logRadius * .014;
        vec2 starDomain = vec2(starAngle * 154.0, (logRadius - uFlow * .82) * 6.8);
        vec2 starCell = floor(starDomain), starUv = fract(starDomain);
        starCell.x = mod(starCell.x, 154.0);
        float seed = hash12(starCell + 29.7);
        float starExists = step(mix(.903, .94, uCompact), seed);
        float jitter = hash12(starCell + 72.8);
        float x = starUv.x - mix(.23, .77, jitter);
        float y = starUv.y - .68;
        float angularAA = max(308.0 / (TAU * max(radius, .035) * uResolution.y), .006);
        float width = mix(.018, .043, jitter);
        float line = 1.0 - smoothstep(width, width + angularAA, abs(x));
        float streakLength = mix(.10, .42, jitter) * (1.0 + uEnergy * .55);
        float tail = smoothstep(-streakLength, -.025, y) * (1.0 - smoothstep(-.005, .044, y));
        float head = exp(-abs(y) * 87.0) * (1.0 - smoothstep(width * .7, width * 2.8 + angularAA, abs(x)));
        float halo = exp(-abs(x) * 15.0 - abs(y) * 22.0) * .14;
        float starFade = smoothstep(.12, .27, radius) * min(1.0, radius * .74 + .15);
        vec3 starColor = mix(vec3(.68, .73, .72), vec3(1.0, .70, .43), step(.58, jitter));
        color += starColor * (line * tail * .91 + head * 1.3 + halo) * starExists * starFade * (1.04 + uEnergy * .22);

        // Faint angular marks travel on the same curved surface as the clouds.
        // Their irregular spacing and small area read as traces in the current.
        vec2 glyphDomain = vec2((angle / TAU + logRadius * .021) * 31.0, (logRadius - uFlow * .58) * 9.0);
        vec2 glyphCell = floor(glyphDomain);
        glyphCell.x = mod(glyphCell.x, 31.0);
        float glyphSeed = hash12(glyphCell + 93.2);
        vec2 glyphUv = (fract(glyphDomain) - .5) * vec2(1.45, 1.0);
        float glyphAA = 18.0 / (max(radius, .035) * uResolution.y) + .007;
        float trace = glyph(glyphUv, hash12(glyphCell + 18.4), glyphAA);
        trace *= step(.954, glyphSeed) * smoothstep(.28, .65, radius) * (1.0 - smoothstep(1.3, 2.7, radius));
        color += mix(vec3(.15, .18, .18), vec3(.34, .14, .059), step(.98, glyphSeed)) * trace * .29 * (1.0 - uCompact * .65);

        color *= mix(.29, 1.0, abyss);
        float edge = 1.0 - smoothstep(.67, 1.42, length((vUv - .5) * 1.42));
        color *= mix(.68, 1.0, edge);
        // Preserve the surrounding cloud walls even during a reading hold.
        color *= (1.0 - uCalm * .13) * (1.0 - uCompact * .18);
        color = mix(color, vec3(.004, .005, .006) + color * .20, protection() * .77);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  // Cloud detail is deliberately softer than the foreground hardware. Compute
  // it at a bounded resolution, then resolve once into the main scene.
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter, generateMipmaps: false,
  });
  const fieldScene = new THREE.Scene(), fieldCamera = new THREE.Camera();
  const fieldMesh = new THREE.Mesh(geometry, material); fieldMesh.frustumCulled = false;
  fieldScene.add(fieldMesh);
  const resolve = new THREE.ShaderMaterial({
    uniforms: { tField: { value: target.texture } },
    depthTest: false, depthWrite: false, transparent: false, blending: THREE.NoBlending,
    vertexShader: material.vertexShader,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tField;
      void main(){gl_FragColor=texture2D(tField,vUv);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, resolve);
  mesh.name = 'Passage distant wormhole';
  mesh.frustumCulled = false;
  mesh.renderOrder = -10000;
  scene.add(mesh);

  let compact = false;
  let disposed = false;
  const clamp = THREE.MathUtils.clamp;
  return {
    mesh,
    configure(width: number, height: number, isCompact: boolean, quality: PassageWormholeQuality) {
      if (disposed) return;
      compact = isCompact;
      uniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height));
      const limit = compact ? 384 : quality === 'light' ? 512 : quality === 'detail' ? 960 : 768;
      const scale = Math.min(1, limit / Math.max(width, height));
      target.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
      uniforms.uCompact.value = Number(compact);
      uniforms.uOctaves.value = compact || quality === 'light' ? 2 : quality === 'detail' ? 4 : 3;
    },
    /** Rectangles use normalized viewport coordinates with a top-left origin. */
    setProtectedRects(rects: readonly PassageWormholeRect[]) {
      if (disposed) return;
      let count = 0;
      for (let index = 0; index < rects.length && count < 4; index++) {
        const rect = rects[index];
        if (!Number.isFinite(rect.left + rect.top + rect.right + rect.bottom) || rect.right <= rect.left || rect.bottom <= rect.top) continue;
        protectedRects[count].set(clamp(rect.left, 0, 1), clamp(rect.top, 0, 1), clamp(rect.right, 0, 1), clamp(rect.bottom, 0, 1));
        count++;
      }
      uniforms.uProtectedCount.value = count;
    },
    update(time: number, travelDistance: number, energy: number, pointer: readonly [number, number], pointerStrength: number, calm: number, reduced: boolean) {
      if (disposed) return;
      const still = compact || reduced;
      // The owner supplies a pause-aware clock and an integrated scroll boost.
      // Never multiply an absolute time by changing energy: that makes jumps.
      uniforms.uFlow.value = still ? 0 : Math.max(0, time) * .23 + Math.max(0, travelDistance) * .42;
      uniforms.uEnergy.value = still ? 0 : clamp(energy, 0, 1);
      uniforms.uPointer.value.set(still ? 0 : clamp(pointer[0], -1, 1), still ? 0 : clamp(pointer[1], -1, 1));
      uniforms.uPointerStrength.value = still ? 0 : clamp(pointerStrength, 0, 1);
      uniforms.uCalm.value = clamp(calm, 0, 1);
      const previousTarget = renderer.getRenderTarget();
      try { renderer.setRenderTarget(target); renderer.render(fieldScene, fieldCamera); }
      finally { renderer.setRenderTarget(previousTarget); }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      resolve.dispose(); target.dispose(); fieldScene.clear();
    },
  };
}
