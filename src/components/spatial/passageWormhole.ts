import * as THREE from 'three';

export type PassageWormholeQuality = 'light' | 'auto' | 'balanced' | 'detail';
export type PassageWormholeRect = Readonly<{ left: number; top: number; right: number; bottom: number }>;

const LENGTH = 132, MAX_STREAKS = 1560, RADIAL_SEGMENTS = 96, DEPTH_SEGMENTS = 144;

/** Shared world-space path for the actual hollow surface and moving stars. */
const tubeShader = /* glsl */ `
  const float TAU = 6.28318530718;
  vec2 tubeCentre(float depth) {
    float t = clamp(depth / 132.0, 0.0, 1.0);
    return vec2(5.2 * smoothstep(.10, 1.0, t) + 2.3 * sin(t * 3.5) * t,
      2.0 * sin(t * 2.3) * t + .8 * t * t);
  }
  float tubeRadius(float depth) {
    return mix(17.0, 9.4, smoothstep(0.0, 1.0, clamp(depth / 132.0, 0.0, 1.0)));
  }
  // Bend only the current near the pointer ray, never the shared camera.
  vec2 current(vec2 point, float depth) {
    vec2 pointerRay = uPointer * vec2(uAspect, 1.0) * max(depth, 5.0) * uTanHalfFov;
    vec2 delta = point - pointerRay;
    float radius = 3.5 + max(depth, 0.0) * .095;
    float influence = exp(-dot(delta, delta) / (radius * radius)) * uPointerStrength;
    return (vec2(-delta.y, delta.x) * .14 + uPointer * .65) * influence;
  }
  // One physical displacement field for the wall and every streak endpoint.
  // Near folds travel substantially farther than the almost anchored throat;
  // velocity adds a small torsional wake, without another clock or camera.
  vec3 parallaxPoint(vec2 point, float depth) {
    float nearLayer = 1.0 - smoothstep(8.0, 128.0, depth);
    float weight = .03 + .97 * nearLayer * nearLayer;
    vec2 radial = point - tubeCentre(depth);
    float torsion = clamp(uParallaxVelocity.x * .012 - uParallaxVelocity.y * .008,
      -.034906585, .034906585) * weight;
    float turnCos = cos(torsion) - 1.0, turnSin = sin(torsion);
    vec2 turn = vec2(radial.x * turnCos - radial.y * turnSin,
      radial.x * turnSin + radial.y * turnCos);
    vec2 displacement = -uParallax * vec2(3.3, 2.4) * weight;
    vec2 wake = -uParallaxVelocity * .10 * weight;
    // Lean the actual geometry in Z, with zero displacement near the camera
    // and at the far seam. The input clamp bounds this to .7 world units.
    float leanGate = smoothstep(10.0, 24.0, depth) * (1.0 - smoothstep(105.0, 130.0, depth));
    float lean = clamp(dot(uParallax, radial / max(length(radial), .001)), -1.0, 1.0)
      * .7 * weight * leanGate;
    // Delta form preserves the original point exactly at zero input.
    return vec3(point + turn + displacement + wake, -depth + lean);
  }
`;

const protectionShader = /* glsl */ `
  uniform vec4 uViewport;
  uniform vec2 uScreenSize;
  uniform int uProtectedCount;
  uniform vec4 uProtectedRects[5];
  float protection() {
    vec2 screenUv = (gl_FragCoord.xy - uViewport.xy) / max(uViewport.zw, vec2(1.0));
    screenUv.y = 1.0 - screenUv.y;
    vec2 feather = vec2(22.0) / max(uScreenSize, vec2(1.0));
    float protectedArea = 0.0;
    for (int i = 0; i < 5; i++) {
      if (i >= uProtectedCount) break;
      vec4 rect = uProtectedRects[i];
      vec2 enter = smoothstep(rect.xy - feather, rect.xy + feather, screenUv);
      vec2 leave = 1.0 - smoothstep(rect.zw - feather, rect.zw + feather, screenUv);
      protectedArea = max(protectedArea, enter.x * enter.y * leave.x * leave.y);
    }
    return protectedArea;
  }
`;

/** One tileable multiscale field: RGBA = billows / folds / fine turbulence /
 * wisps. Small precomputed lattices avoid hashing for every octave/pixel.
 * The wall still uses three samples; the detail is baked once, not evaluated
 * as a procedural noise stack over every screen pixel on every frame. */
function cloudTexture() {
  const size = 512, pixels = new Uint8Array(size * size * 4);
  const hash = (x: number, y: number, salt: number) => {
    let value = Math.imul(x + salt * 37, 374761393) ^ Math.imul(y + salt * 17, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };
  const lattice = (cells: number, salt: number) => {
    const data = new Float32Array(cells * cells);
    for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) data[y * cells + x] = hash(x, y, salt);
    const indices = new Uint16Array(size), next = new Uint16Array(size), weights = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const coordinate = i * cells / size, cell = Math.floor(coordinate), f = coordinate - cell;
      indices[i] = cell; next[i] = (cell + 1) % cells;
      weights[i] = f * f * f * (f * (f * 6 - 15) + 10);
    }
    return { cells, data, indices, next, weights };
  };
  const octaves = [lattice(8, 3), lattice(16, 19), lattice(24, 7), lattice(48, 23), lattice(96, 11), lattice(192, 31)];
  const noise = (x: number, y: number, octave: typeof octaves[number]) => {
    const { cells, data, indices, next, weights } = octave;
    const ix = indices[x], iy = indices[y], nextX = next[x], nextY = next[y], sx = weights[x], sy = weights[y];
    const a = data[iy * cells + ix], b = data[iy * cells + nextX];
    const c = data[nextY * cells + ix], d = data[nextY * cells + nextX];
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4;
    const broad = noise(x, y, octaves[0]), billow = noise(x, y, octaves[1]);
    const fold = noise(x, y, octaves[2]), curl = noise(x, y, octaves[3]);
    const fine = noise(x, y, octaves[4]), micro = noise(x, y, octaves[5]);
    pixels[index] = Math.round((broad * .79 + billow * .21) * 255);
    pixels[index + 1] = Math.round((fold * .74 + curl * .26) * 255);
    pixels[index + 2] = Math.round((fine * .72 + micro * .28) * 255);
    pixels[index + 3] = Math.round((curl * .66 + fine * .24 + micro * .10) * 255);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.name = 'Passage wormhole scalar field';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function tubeGeometry() {
  const positions: number[] = [], coordinates: number[] = [], indices: number[] = [];
  for (let ring = 0; ring <= DEPTH_SEGMENTS; ring++) {
    const depth = -4 + (LENGTH + 4) * ring / DEPTH_SEGMENTS;
    for (let side = 0; side <= RADIAL_SEGMENTS; side++) {
      const angle = side / RADIAL_SEGMENTS * Math.PI * 2;
      const t = Math.max(0, Math.min(1, depth / LENGTH)), smooth = t * t * (3 - 2 * t);
      const centreT = Math.max(0, Math.min(1, (t - .1) / .9));
      const centreX = 5.2 * centreT * centreT * (3 - 2 * centreT) + 2.3 * Math.sin(t * 3.5) * t;
      const centreY = 2 * Math.sin(t * 2.3) * t + .8 * t * t;
      const radius = 17 + (9.4 - 17) * smooth;
      positions.push(centreX + Math.cos(angle) * radius, centreY + Math.sin(angle) * radius, -depth);
      coordinates.push(side / RADIAL_SEGMENTS, depth / LENGTH);
      if (ring < DEPTH_SEGMENTS && side < RADIAL_SEGMENTS) {
        const a = ring * (RADIAL_SEGMENTS + 1) + side, b = a + RADIAL_SEGMENTS + 1;
        // Outward winding; BackSide exposes only the hollow interior.
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.name = 'Passage wormhole curved hollow tube 132m';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function streakGeometry() {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.name = 'Passage wormhole GPU instanced streaks';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
  // The shader's across vector is the left perpendicular of tail-to-head,
  // so this winding faces the viewer after its perspective expansion.
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  const seeds = new Float32Array(MAX_STREAKS * 4);
  let seed = 85143;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < MAX_STREAKS; i++) seeds.set([random(), random(), random(), random()], i * 4);
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  geometry.instanceCount = 1180;
  return geometry;
}

/** Real finite geometry in Passage's existing scene and camera. Two draws:
 * a deformed hollow cloud tube and instanced world-space stars. No secondary
 * renderer, scene, camera, full-screen primitive, or render target. */
export function createPassageWormhole(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const field = cloudTexture();
  field.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const protectedRects = Array.from({ length: 5 }, () => new THREE.Vector4(-2, -2, -1, -1));
  const uniforms = {
    uCloud: { value: field }, uViewport: { value: new THREE.Vector4(0, 0, 1, 1) },
    uScreenSize: { value: new THREE.Vector2(1, 1) }, uFlow: { value: 0 }, uEnergy: { value: 0 },
    uPointer: { value: new THREE.Vector2() }, uPointerStrength: { value: 0 }, uAspect: { value: 1 },
    uParallax: { value: new THREE.Vector2() }, uParallaxVelocity: { value: new THREE.Vector2() },
    uTanHalfFov: { value: Math.tan(THREE.MathUtils.degToRad(59 / 2)) },
    uCalm: { value: 0 }, uCompact: { value: 0 }, uDetail: { value: 1 },
    uProtectedRects: { value: protectedRects }, uProtectedCount: { value: 0 },
  };
  const commonVertex = /* glsl */ `
    uniform float uFlow, uEnergy, uPointerStrength, uAspect, uTanHalfFov;
    uniform vec2 uPointer, uParallax, uParallaxVelocity;
    ${tubeShader}
  `;
  const wallGeometry = tubeGeometry();
  const wallMaterial = new THREE.ShaderMaterial({
    name: 'Passage wormhole dimensional wall', uniforms,
    // Queue this atmosphere before opaque metal: its curved, narrowing wall
    // can cross distant straight service bays. Explicit normal-alpha factors
    // preserve the cloud appearance while later metal draws fully cover it,
    // without hiding or repositioning any mechanism or writing cloud depth.
    side: THREE.BackSide, transparent: false, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    fog: false,
    vertexShader: /* glsl */ `
      ${commonVertex}
      uniform sampler2D uCloud;
      varying vec2 vTube;
      varying float vBillow;
      void main() {
        float angle = uv.x * TAU, depth = uv.y * 132.0;
        float phase = depth * .018 + uFlow * .0024;
        float billow = texture2D(uCloud, vec2(uv.x * 2.0, phase)).r;
        float folds = sin(angle * 5.0 + depth * .086 + billow * 3.5) * .64
          + sin(angle * 9.0 - depth * .119 + billow * 2.0) * .26;
        float radius = tubeRadius(depth) + (billow - .5) * 2.6 + folds;
        vec2 point = tubeCentre(depth) + vec2(cos(angle), sin(angle)) * radius;
        point += current(point, depth);
        vTube = vec2(angle, depth);
        vBillow = billow;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(parallaxPoint(point, depth), 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uCloud;
      uniform float uFlow, uEnergy, uCalm, uCompact, uDetail;
      varying vec2 vTube;
      varying float vBillow;
      ${protectionShader}
      float hash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      float segment(vec2 p, vec2 a, vec2 b) {
        vec2 edge = b - a;
        return length(p - a - edge * clamp(dot(p - a, edge) / dot(edge, edge), 0.0, 1.0));
      }
      float glyph(vec2 p, float seed, float aa) {
        float stroke = segment(p, vec2(-.17, -.31), vec2(-.17, .31));
        stroke = min(stroke, segment(p, vec2(-.17, .26), vec2(.18, .10)));
        if (seed > .4) stroke = min(stroke, segment(p, vec2(-.17, -.08), vec2(.18, .04)));
        if (seed < .7) stroke = min(stroke, segment(p, vec2(.18, .10), vec2(.18, -.29)));
        if (seed > .7) stroke = min(stroke, segment(p, vec2(-.17, -.29), vec2(.18, -.29)));
        return 1.0 - smoothstep(.015, .015 + aa, stroke);
      }
      void main() {
        float angle = vTube.x, depth = vTube.y;
        float phase = depth * .018 + uFlow * .0024;
        vec2 domain = vec2(angle / 6.28318530718 * 2.0, phase);
        vec4 first = texture2D(uCloud, domain);
        vec2 curledDomain = domain * vec2(2.0, 1.73)
          + vec2(first.r * .26 + first.g * .055, first.g * .17 - first.r * .04);
        vec4 second = texture2D(uCloud, curledDomain);
        vec4 lightSample = texture2D(uCloud, domain + vec2(.009, .006));
        float lightSlope = (first.r - lightSample.r) * .76 + (first.g - lightSample.g) * .24;
        // Broken diagonal cloud arms and dark porous regions. All material
        // coordinates follow physical tube depth, rather than radial screen UV.
        float arm = pow(.5 + .5 * cos(angle * 2.0 - 1.45 - depth * .014 + (first.r - .5) * 2.0), 2.4);
        float density = first.r * .58 + second.g * .27 + first.b * .15;
        float torn = smoothstep(.26, .64, first.g * .55 + second.r * .45);
        float mass = smoothstep(.27, .77, density + arm * .17) * mix(.30, 1.0, torn);
        float folds = pow(clamp(density + arm * .17, 0.0, 1.0), 2.05);
        float crest = pow(smoothstep(.57, .84, density + arm * .12), 2.0)
          * smoothstep(.44, .76, first.g);
        // A derivative along the authored light direction gives each billow a
        // bright face and a shadow. It costs one extra scalar texture sample.
        float shade = clamp(.65 + lightSlope * 5.6, .22, 1.24) * (.68 + .32 * vBillow);
        vec3 copper = mix(vec3(.012, .004, .002), vec3(.35, .12, .047), folds);
        vec3 slate = mix(vec3(.002, .006, .011), vec3(.085, .155, .225), folds);
        vec3 cloud = mix(slate, copper, smoothstep(.15, .70, arm));
        vec3 color = cloud * (.25 + mass * 1.08) * shade * (.89 + second.b * .22);
        color += mix(vec3(.18, .30, .41), vec3(.76, .56, .36), arm) * crest * .24 * shade;
        color += vec3(.66, .64, .55) * pow(crest, 3.0) * .10;
        // Folded wisps follow the same advecting material as the large billows.
        // Derivative-aware edges and distance rolloff avoid sparkling noise at
        // the throat. These are lit creases, not a separate neon overlay.
        float ridgeField = second.g + (first.a - .5) * .22 + (second.a - .5) * .13;
        float ridgeAA = max(fwidth(ridgeField) * 1.2, .0025);
        float crease = 1.0 - smoothstep(.008, .025 + ridgeAA, abs(ridgeField - .52));
        float detailVisibility = (1.0 - smoothstep(62.0, 113.0, depth)) * uDetail;
        float wisp = crease * smoothstep(.40, .70, first.r) * torn * detailVisibility;
        vec3 rim = mix(vec3(.28, .47, .60), vec3(.80, .61, .39), arm);
        color += rim * wisp * (.095 + crest * .09) * shade;
        // Broad directional cavities retain clean shadows between bright folds.
        color *= .82 + .18 * smoothstep(.22, .70, second.a);
        // Sparse Matrix-like traces are attached to the physical tube wall.
        vec2 codeDomain = vec2(angle / 6.28318530718 * 92.0, (depth + uFlow * .14) * .87);
        vec2 cell = floor(codeDomain);
        cell.x = mod(cell.x, 92.0);
        float codeSeed = hash(cell + 63.7);
        vec2 codePixel = fwidth(codeDomain);
        float codeAA = max(max(codePixel.x, codePixel.y), .008);
        float code = 0.0;
        if (codeSeed > .979 && depth > 14.0 && depth < 100.0 && uCompact < .5) {
          code = glyph((fract(codeDomain) - .5) * vec2(1.32, 1.0), hash(cell + 17.2), codeAA);
          code *= smoothstep(14.0, 30.0, depth) * (1.0 - smoothstep(72.0, 100.0, depth));
        }
        color += vec3(.25, .30, .27) * code * .16;
        float ends = smoothstep(-3.0, 8.0, depth) * (1.0 - smoothstep(112.0, 132.0, depth));
        float abyss = 1.0 - smoothstep(77.0, 132.0, depth) * .77;
        float quiet = (1.0 - uCalm * .12) * (1.0 - uCompact * .12);
        float protectionAmount = protection();
        color *= abyss * quiet * (1.0 + uEnergy * .09) * (1.0 - protectionAmount * .50);
        float alpha = (.23 + mass * .62) * ends * (1.0 - protectionAmount * .88);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const wall = new THREE.Mesh(wallGeometry, wallMaterial);
  wall.name = 'Passage wormhole finite curved tube';
  wall.renderOrder = -40; // First within the opaque queue; its alpha still blends.
  wall.frustumCulled = false; // CPU bounds cannot account for GPU displacement.

  const starsGeometry = streakGeometry();
  const starsMaterial = new THREE.ShaderMaterial({
    name: 'Passage wormhole instanced streaks', uniforms,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */ `
      ${commonVertex}
      uniform vec4 uViewport;
      uniform vec2 uScreenSize;
      attribute vec4 aSeed;
      varying vec2 vStreak;
      varying float vFade;
      varying vec3 vTint;
      vec3 streamPoint(float depth, float angle, float spread) {
        float curvedAngle = angle + sin(depth * .016 + angle * 2.0) * .075;
        vec2 point = tubeCentre(depth) + vec2(cos(curvedAngle), sin(curvedAngle)) * tubeRadius(depth) * spread;
        return parallaxPoint(point + current(point, depth), depth);
      }
      void main() {
        float speed = .74 + aSeed.w * .57;
        float phase = fract(aSeed.x + uFlow / 132.0 * speed);
        float depth = 129.0 - phase * 130.0;
        float angle = aSeed.y * TAU;
        float spread = .16 + sqrt(aSeed.z) * .78;
        float streakLength = (.16 + pow(aSeed.w, 2.0) * 3.35) * (1.0 + uEnergy * .65);
        vec4 headView = modelViewMatrix * vec4(streamPoint(depth, angle, spread), 1.0);
        vec4 tailView = modelViewMatrix * vec4(streamPoint(depth + streakLength, angle, spread), 1.0);
        float visibleDepth = -headView.z;
        vStreak = position.xy;
        vFade = smoothstep(1.0, 9.0, visibleDepth) * (1.0 - smoothstep(105.0, 129.0, visibleDepth));
        vTint = mix(vec3(.56, .68, .77), vec3(.98, .73, .48), step(.61, aSeed.w));
        // Fade against transformed view depth before perspective division.
        // Invisible recycled tips cannot produce camera-plane clip triangles.
        if (visibleDepth <= 1.0 || visibleDepth >= 129.0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }
        vec4 head = projectionMatrix * headView;
        vec4 tail = projectionMatrix * tailView;
        vec2 delta = (head.xy / max(head.w, .1) - tail.xy / max(tail.w, .1)) * uViewport.zw;
        vec2 direction = normalize(delta + vec2(.00001, 0.0));
        // Preserve a small point-like head at depth; world-space anchors and
        // depth remain unchanged, as with any perspective particle billboard.
        float minimumLength = 2.5 * uViewport.w / max(uScreenSize.y, 1.0);
        if (length(delta) < minimumLength) {
          tail.xy = (head.xy / max(head.w, .1) - direction * minimumLength / max(uViewport.zw, vec2(1.0))) * tail.w;
        }
        vec2 across = vec2(-direction.y, direction.x);
        vec4 point = mix(tail, head, position.y);
        float nearAmount = 1.0 - clamp(depth / 132.0, 0.0, 1.0);
        float width = (.50 + aSeed.w * .45 + nearAmount * nearAmount * .52)
          * uViewport.w / max(uScreenSize.y, 1.0);
        point.xy += across * position.x * width * 2.0 / max(uViewport.zw, vec2(1.0)) * point.w;
        gl_Position = point;
        vFade *= .38 + pow(aSeed.w, 2.0) * .95;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uEnergy, uCalm, uCompact;
      varying vec2 vStreak;
      varying float vFade;
      varying vec3 vTint;
      ${protectionShader}
      void main() {
        float width = abs(vStreak.x);
        float core = pow(max(0.0, 1.0 - width), 3.5);
        float halo = pow(max(0.0, 1.0 - width), 1.5) * .06;
        float tail = pow(vStreak.y, .65) * (1.0 - smoothstep(.90, 1.0, vStreak.y));
        float alpha = (core + halo) * tail * vFade * (1.0 - protection() * .98);
        alpha *= (1.0 - uCalm * .18) * (1.0 - uCompact * .15);
        if (alpha < .003) discard;
        gl_FragColor = vec4(vTint * (1.12 + uEnergy * .22), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const stars = new THREE.Mesh(starsGeometry, starsMaterial);
  stars.name = 'Passage wormhole GPU perspective streaks';
  stars.frustumCulled = false;
  stars.renderOrder = -39;
  // Honour the real viewport even when the owner's cinematic pass uses a
  // differently sized target; the effect itself never creates or renders one.
  const readViewport = () => { renderer.getCurrentViewport(uniforms.uViewport.value); };
  wall.onBeforeRender = readViewport;
  stars.onBeforeRender = readViewport;
  const mesh = new THREE.Group();
  mesh.name = 'Passage dimensional wormhole';
  mesh.add(wall, stars);
  scene.add(mesh);
  let compact = false, reducedMotion = false, disposed = false;
  const clamp = THREE.MathUtils.clamp;
  return {
    mesh,
    /** Follow the actual shared camera's Z only; never modify the camera. */
    setCamera(camera: THREE.PerspectiveCamera) {
      if (disposed) return;
      mesh.position.z = camera.position.z;
      uniforms.uAspect.value = camera.aspect;
      uniforms.uTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov * .5));
    },
    /** The owner supplies critically damped position and velocity, separate
     * from the localized pointer current. No allocations or scene transforms. */
    setParallax(x: number, y: number, vx: number, vy: number) {
      if (disposed) return;
      if (reducedMotion) {
        uniforms.uParallax.value.set(0, 0);
        uniforms.uParallaxVelocity.value.set(0, 0);
        return;
      }
      uniforms.uParallax.value.set(Number.isFinite(x) ? clamp(x, -1, 1) : 0, Number.isFinite(y) ? clamp(y, -1, 1) : 0);
      const velocity = uniforms.uParallaxVelocity.value;
      velocity.set(Number.isFinite(vx) ? clamp(vx, -3, 3) : 0, Number.isFinite(vy) ? clamp(vy, -3, 3) : 0);
      if (velocity.lengthSq() > 9) velocity.setLength(3);
    },
    configure(width: number, height: number, isCompact: boolean, quality: PassageWormholeQuality) {
      if (disposed) return;
      compact = isCompact;
      uniforms.uScreenSize.value.set(Math.max(1, width), Math.max(1, height));
      uniforms.uCompact.value = Number(compact);
      uniforms.uDetail.value = quality === 'light' || compact ? .25 : 1;
      starsGeometry.instanceCount = compact ? 340 : quality === 'light' ? 620 : quality === 'detail' ? MAX_STREAKS : 1180;
      readViewport();
    },
    /** Normalized viewport rectangles, with a top-left origin. */
    setProtectedRects(rects: readonly PassageWormholeRect[]) {
      if (disposed) return;
      let count = 0;
      for (let index = 0; index < rects.length && count < 5; index++) {
        const rect = rects[index];
        if (!Number.isFinite(rect.left + rect.top + rect.right + rect.bottom)) continue;
        const left = clamp(rect.left, 0, 1), top = clamp(rect.top, 0, 1);
        const right = clamp(rect.right, 0, 1), bottom = clamp(rect.bottom, 0, 1);
        if (right <= left || bottom <= top) continue;
        protectedRects[count++].set(left, top, right, bottom);
      }
      uniforms.uProtectedCount.value = count;
    },
    update(time: number, travelDistance: number, energy: number, pointer: readonly [number, number], pointerStrength: number, calm: number, reduced: boolean) {
      if (disposed) return;
      reducedMotion = reduced;
      // The controller separates touch fallback from a narrow mouse desktop.
      // Compact controls detail density; the explicit flag owns motion.
      const still = reduced;
      if (still) {
        uniforms.uParallax.value.set(0, 0);
        uniforms.uParallaxVelocity.value.set(0, 0);
      }
      // Pause-aware time plus integrated travel; changing energy cannot jump
      // the phase as it would when multiplying an absolute clock by speed.
      // Hold the last atmospheric pose when changing presentation modes;
      // resetting its phase here made resize/reduced-motion toggles jump.
      if (!still) uniforms.uFlow.value = Math.max(0, time) * 8.4 + Math.max(0, travelDistance) * 1.7;
      uniforms.uEnergy.value = still ? 0 : clamp(energy, 0, 1);
      uniforms.uPointer.value.set(still ? 0 : clamp(pointer[0], -1, 1), still ? 0 : clamp(pointer[1], -1, 1));
      uniforms.uPointerStrength.value = still ? 0 : clamp(pointerStrength, 0, 1);
      uniforms.uCalm.value = clamp(calm, 0, 1);
    },
    stats() {
      return {
        draws: 2, renderTargets: 0, geometries: 2, textures: 1,
        tubeVertices: wallGeometry.getAttribute('position').count,
        tubeTriangles: (wallGeometry.index?.count ?? 0) / 3,
        streakInstances: starsGeometry.instanceCount, length: LENGTH,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(mesh); mesh.clear();
      wallGeometry.dispose(); starsGeometry.dispose();
      wallMaterial.dispose(); starsMaterial.dispose(); field.dispose();
    },
  };
}
