import * as THREE from 'three';
import { PASSAGE_CHAPTERS } from '../../services/passageChapters';
import { passageStationMotion, passagePose } from '../../services/passageJourney';

type ArchitectureFrame = {
  active: number; progress: number; elapsed: number; reducedMotion: boolean; delta?: number;
  pointer?: readonly [number, number]; energy?: number; compact?: boolean;
  inspection: { station: string | null; expanded: boolean; rotation: number };
};
type ImageSurface = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
type Link = { body: THREE.Mesh; piston: THREE.Mesh; signal: THREE.Mesh };
type Assembly = {
  root: THREE.Group; media: ImageSurface; exhibit: THREE.Group; movement: THREE.Group;
  frames: THREE.Mesh[]; fins: THREE.Group[]; slats: THREE.Group[]; ribs: THREE.InstancedMesh;
  armRoot: THREE.Group; arms: Link[]; motors: THREE.Group[]; hub: THREE.Group;
  target: THREE.Vector3; inspection: number; turn: number; ribInspection: number; leafReveal: number;
};

/** One continuous, permanently constructed machine. The scroll controller owns
 * camera and carrier poses. This module owns only materials and local mechanisms. */
export function createPassageArchitecture(scene: THREE.Scene, onInvalidate: () => void) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const instances = new Set<THREE.InstancedMesh>(), cache = new Map<string, THREE.BufferGeometry>();
  const loader = new THREE.TextureLoader(), dummy = new THREE.Object3D();
  const scratchA = new THREE.Vector3(), scratchB = new THREE.Vector3(), scratchC = new THREE.Vector3(), direction = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0), worldTarget = new THREE.Vector3();
  const posters: (THREE.Texture | null)[] = PASSAGE_CHAPTERS.map(() => null), activeTextures = [...posters];
  const loadVersions = PASSAGE_CHAPTERS.map(() => 0);
  const collectionMounts: THREE.Group[] = [], collectionSurfaces: ImageSurface[] = [], collectionTextures: (THREE.Texture | null)[] = [null, null, null];
  let destroyed = false, collectionKey = '', collectionVersion = 0, pointerX = 0, pointerY = 0;
  function geometry<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    if (!cache.has(key)) { const g = make(); cache.set(key, g); geometries.add(g); }
    return cache.get(key) as T;
  }
  function material<T extends THREE.Material>(value: T) { materials.add(value); return value; }
  const alloy = material(new THREE.MeshStandardMaterial({ color: 0x565e59, metalness: .88, roughness: .29 }));
  const ribAlloy = material(new THREE.MeshStandardMaterial({ color: 0x222925, metalness: .72, roughness: .48, envMapIntensity: .30 }));
  const wallAlloy = material(new THREE.MeshStandardMaterial({ color: 0x101513, metalness: .34, roughness: .79, envMapIntensity: .20 }));
  const graphite = material(new THREE.MeshStandardMaterial({ color: 0x171b19, metalness: .78, roughness: .38 }));
  const charcoal = material(new THREE.MeshStandardMaterial({ color: 0x0d1110, metalness: .55, roughness: .48 }));
  const ceramic = material(new THREE.MeshStandardMaterial({ color: 0xa7a194, metalness: .15, roughness: .48 }));
  const red = material(new THREE.MeshBasicMaterial({ color: 0xff4d32, toneMapped: false }));
  const ivory = material(new THREE.MeshBasicMaterial({ color: 0xd5d2c6, toneMapped: false }));
  const darkRed = material(new THREE.MeshBasicMaterial({ color: 0x63251d, toneMapped: false }));
  const unitBox = geometry('box', () => new THREE.BoxGeometry(1, 1, 1));
  const cylinder = geometry('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 10));
  const sphere = geometry('sphere', () => new THREE.SphereGeometry(1, 20, 12));
  const tunnel = new THREE.Group(); tunnel.name = 'passage-continuous-tunnel'; scene.add(tunnel);
  // Small deterministic brushed variation belongs to the broad structural
  // faces, not the polished carriers or image textures.
  const grainData = new Uint8Array(64 * 64 * 4); let grainSeed = 38217;
  for (let i = 0; i < grainData.length; i += 4) { grainSeed = (Math.imul(grainSeed, 1664525) + 1013904223) >>> 0; const v = 112 + (grainSeed % 48); grainData[i] = grainData[i + 1] = grainData[i + 2] = v; grainData[i + 3] = 255; }
  const grain = new THREE.DataTexture(grainData, 64, 64, THREE.RGBAFormat); grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(3, 12); grain.needsUpdate = true; textures.add(grain);
  ribAlloy.bumpMap = grain; ribAlloy.bumpScale = .025; wallAlloy.bumpMap = grain; wallAlloy.bumpScale = .038;
  function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, depth: number, mat: THREE.Material = alloy) {
    const mesh = new THREE.Mesh(unitBox, mat); mesh.position.set(x, y, z); mesh.scale.set(w, h, depth); parent.add(mesh); return mesh;
  }
  function ring(parent: THREE.Object3D, radius: number, thickness: number, mat: THREE.Material, arc = Math.PI * 2) {
    const g = geometry(`ring-${radius}-${thickness}-${arc}`, () => new THREE.TorusGeometry(radius, thickness, 6, 64, arc));
    const mesh = new THREE.Mesh(g, mat); parent.add(mesh); return mesh;
  }
  function instanced(parent: THREE.Object3D, mat: THREE.Material, count: number, fill: (i: number, object: THREE.Object3D) => void) {
    const mesh = new THREE.InstancedMesh(unitBox, mat, count); instances.add(mesh);
    for (let i = 0; i < count; i++) { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); fill(i, dummy); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); }
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); parent.add(mesh); return mesh;
  }
  // Three instanced draw calls form the entire spiral lining. Tangential ribs
  // alternate depth; the broad dark inner layers make it feel like a structure.
  const ringCount = 90, ringSides = 12;
  function ribTransform(i: number, object: THREE.Object3D, layer: number) {
    const n = Math.floor(i / ringSides), j = i % ringSides, a = j * Math.PI / 6 + n * .058;
    const r = 8.8 + Math.sin(n * .46) * .34, span = 2 * r * Math.sin(Math.PI / 12) * .95;
    const radius = r + (layer === 2 ? .17 : layer === 1 ? -.13 : 0);
    object.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 18 - n * 3.65 - (layer === 2 ? 1.35 : 0));
    object.rotation.z = a + Math.PI / 2;
    if (layer === 0) object.scale.set(span, .19, n % 4 === 0 ? .85 : .36);
    if (layer === 1) object.scale.set(span * (j % 3 === 0 ? .78 : .24), .026, .035);
    if (layer === 2) object.scale.set(span, .66, 2.6);
  }
  const structuralRibs = instanced(tunnel, ribAlloy, ringCount * ringSides, (i, o) => ribTransform(i, o, 0));
  const conduits = instanced(tunnel, red, ringCount * ringSides, (i, o) => ribTransform(i, o, 1));
  const whiteColor = new THREE.Color(0xd5d2c6), redColor = new THREE.Color(0xff4d32);
  for (let i = 0; i < conduits.count; i++) conduits.setColorAt(i, i % 5 === 0 ? whiteColor : redColor);
  // Use white base material so the per-instance ivory remains neutral.
  conduits.material = material(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const wallFaces = instanced(tunnel, wallAlloy, ringCount * ringSides, (i, o) => ribTransform(i, o, 2));
  const structuralTint = new THREE.Color();
  for (let i = 0; i < structuralRibs.count; i++) {
    const level = .48 + ((i * 17 + Math.floor(i / ringSides) * 5) % 13) / 24;
    structuralTint.setRGB(level * .94, level, level * .97); structuralRibs.setColorAt(i, structuralTint);
    structuralTint.multiplyScalar(i % 7 === 0 ? .77 : .56); wallFaces.setColorAt(i, structuralTint);
  }

  // Depth-tested light bleed is attached to real conduits, rather than a
  // full-screen bloom pass that would wash out footage and typography.
  const signalUniforms = { uTime: { value: 0 }, uEnergy: { value: 0 }, uPointer: { value: new THREE.Vector2() }, uCameraZ: { value: 14 } };
  const haloMaterial = material(new THREE.ShaderMaterial({ uniforms: signalUniforms, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;varying vec3 vTint;varying float vDepth;void main(){vUv=uv;vTint=instanceColor;vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);vDepth=world.z;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `varying vec2 vUv;varying vec3 vTint;varying float vDepth;uniform float uTime;uniform float uEnergy;void main(){vec2 p=vUv*2.-1.;float glow=exp(-p.y*p.y*5.5)*pow(max(0.,1.-abs(p.x)),.5);float edge=1.-smoothstep(.7,1.,abs(p.y));float charge=.78+.22*sin(vDepth*.12+uTime*.8);gl_FragColor=vec4(vTint,glow*edge*(.10+uEnergy*.045)*charge);}`,
  }));
  haloMaterial.forceSinglePass = true;
  const haloPlane = geometry('signal-halo', () => new THREE.PlaneGeometry(1, 1));
  const conduitHalos = new THREE.InstancedMesh(haloPlane, haloMaterial, ringCount * ringSides); instances.add(conduitHalos);
  for (let i = 0; i < conduitHalos.count; i++) {
    ribTransform(i, dummy, 1); dummy.position.z += .20; dummy.scale.y = .28; dummy.scale.z = 1; dummy.scale.x *= 1.12; dummy.updateMatrix(); conduitHalos.setMatrixAt(i, dummy.matrix); conduitHalos.setColorAt(i, i % 5 === 0 ? whiteColor : redColor);
  }
  conduitHalos.instanceMatrix.needsUpdate = true; conduitHalos.computeBoundingSphere(); tunnel.add(conduitHalos);

  const ribbonUniforms = { uTime: { value: 0 }, uEnergy: { value: 0 }, uStation: { value: -36 }, uRead: { value: 0 } };
  const ribbonMaterial = material(new THREE.ShaderMaterial({
    uniforms: ribbonUniforms, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;varying float vDepth;void main(){vUv=uv;vDepth=position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;varying float vDepth;uniform float uTime;uniform float uEnergy;uniform float uStation;uniform float uRead;void main(){float pulse=pow(.5+.5*sin(vUv.y*68.-uTime*1.12),18.);float edge=pow(1.-abs(vUv.x*2.-1.),.6);float calm=1.-(1.-smoothstep(1.,7.,abs(vDepth-uStation)))*uRead*.72;vec3 c=mix(vec3(1.,.08,.025),vec3(.92,.86,.69),pulse*.8);gl_FragColor=vec4(c*(.66+pulse*.7+uEnergy*.18),edge*.36*calm);}`,
  }));
  ribbonMaterial.forceSinglePass = true;
  for (let lane = 0; lane < 7; lane++) {
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    const steps = 560;
    for (let n = 0; n <= steps; n++) {
      const z = 22 - n * .6, angle = lane * Math.PI * 2 / 7 + z * .043 + Math.sin(z * .069 + lane) * .13;
      const radius = 7.1 + Math.sin(z * .053 + lane * 2) * .55, width = lane % 3 === 0 ? .018 : .008;
      for (const side of [-1, 1]) { const a = angle + side * width; positions.push(Math.cos(a) * radius, Math.sin(a) * radius, z); uv.push((side + 1) / 2, n / steps); }
      if (n < steps) { const i = n * 2; indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
    const g = new THREE.BufferGeometry(); geometries.add(g); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices);
    tunnel.add(new THREE.Mesh(g, ribbonMaterial));
  }
  // An inexpensive handful of fixed, broad light sheets gives the rim light
  // presence. No full-screen bloom, shadow maps or extra render pass is required.
  const spillMat = material(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;void main(){float a=pow(1.-abs(vUv.x*2.-1.),2.)*pow(1.-vUv.y,2.);gl_FragColor=vec4(.85,.19,.09,a*.075);}',
  }));
  spillMat.forceSinglePass = true;
  const portals: THREE.Group[] = [];
  for (let i = 0; i < 16; i++) {
    const portal = new THREE.Group(); portal.position.z = -10 - i * 20.5; portal.rotation.set(Math.sin(i * 3) * .10, Math.cos(i * 2) * .10, i * .7); tunnel.add(portal); portals.push(portal);
    for (let layer = 0; layer < 2; layer++) {
      const radius = (layer ? 7.39 : 7.5) + (i % 3) * .15, thickness = layer ? .016 : .10, arc = Math.PI * (layer ? .34 : .42);
      const g = geometry(`ring-${radius}-${thickness}-${arc}`, () => new THREE.TorusGeometry(radius, thickness, 6, 64, arc));
      const mesh = new THREE.InstancedMesh(g, layer ? conduits.material : graphite, 4); instances.add(mesh);
      for (let j = 0; j < 4; j++) {
        dummy.position.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, j * Math.PI / 2 + (layer ? .06 : 0)); dummy.updateMatrix(); mesh.setMatrixAt(j, dummy.matrix);
        if (layer) mesh.setColorAt(j, j % 3 ? redColor : whiteColor);
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); portal.add(mesh);
    }
  }
  let seed = 14831; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  instanced(tunnel, graphite, 180, (_i, o) => { const a = random() * Math.PI * 2, r = 7.5 + random() * 1.5; o.position.set(Math.cos(a) * r, Math.sin(a) * r, 10 - random() * 310); o.rotation.set(random() * 2, random() * 3, random() * 3); o.scale.set(.12 + random() * .6, .06 + random() * .1, .2 + random()); });
  const mechanismGlow = new THREE.InstancedMesh(haloPlane, haloMaterial, PASSAGE_CHAPTERS.length); instances.add(mechanismGlow); mechanismGlow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mechanismGlow.frustumCulled = false; tunnel.add(mechanismGlow);
  for (let i = 0; i < mechanismGlow.count; i++) { mechanismGlow.setColorAt(i, i % 2 ? whiteColor : redColor); dummy.position.set(0, 0, -999); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0); dummy.updateMatrix(); mechanismGlow.setMatrixAt(i, dummy.matrix); }
  const contactLight = new THREE.PointLight(0xff4d32, 3, 8, 2); scene.add(contactLight);

  // The entrance is the first thick portal of this same structure, not another
  // room or a separate scroll animation.
  const entrance = new THREE.Group(); entrance.name = 'passage-entrance'; entrance.position.z = -7; tunnel.add(entrance);
  for (let i = 0; i < 3; i++) {
    const mount = new THREE.Group(); mount.position.z = -i * .7; entrance.add(mount);
    ring(mount, 7.65 + i * .21, i === 1 ? .29 : .15, i === 1 ? alloy : graphite);
    const edge = ring(mount, 7.51 + i * .21, .024, i === 0 ? ivory : red, Math.PI * 1.6); edge.rotation.z = i * .9;
  }
  instanced(entrance, alloy, 12, (i, o) => { const a = i * Math.PI / 6; o.position.set(Math.cos(a) * 8.05, Math.sin(a) * 8.05, -.7); o.rotation.z = a; o.scale.set(.65, .3, 2.0); });

  function outline(path: THREE.Shape | THREE.Path, w: number, h: number, corner: number) {
    path.moveTo(-w / 2 + corner, -h / 2); path.lineTo(w / 2 - corner, -h / 2); path.lineTo(w / 2, -h / 2 + corner);
    path.lineTo(w / 2, h / 2 - corner); path.lineTo(w / 2 - corner, h / 2); path.lineTo(-w / 2 + corner, h / 2);
    path.lineTo(-w / 2, h / 2 - corner); path.lineTo(-w / 2, -h / 2 + corner); path.closePath();
  }
  const chassisShape = new THREE.Shape(); outline(chassisShape, 15.8, 10, 1.12);
  const chassisHole = new THREE.Path(); outline(chassisHole, 15.48, 9.68, 1.02); chassisShape.holes.push(chassisHole);
  const chassisGeometry = geometry('chassis', () => new THREE.ExtrudeGeometry(chassisShape, { depth: .24, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 1, steps: 1 }));
  function imageSurface(parent: THREE.Object3D, width: number, height: number): ImageSurface {
    const mat = material(new THREE.MeshBasicMaterial({ color: 0x111513, toneMapped: false, fog: false, side: THREE.FrontSide }));
    const mesh = new THREE.Mesh(geometry(`image-${width}-${height}`, () => new THREE.PlaneGeometry(width, height)), mat); parent.add(mesh); return mesh;
  }
  function containImage(surface: ImageSurface, texture: THREE.Texture | null) {
    const source = texture?.image as { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | undefined;
    const w = source?.videoWidth || source?.naturalWidth || source?.width || 0, h = source?.videoHeight || source?.naturalHeight || source?.height || 0;
    if (!w || !h) { surface.scale.set(1, 1, 1); return; }
    const imageAspect = w / h, aperture = surface.geometry.parameters.width / surface.geometry.parameters.height;
    surface.scale.set(Math.min(1, imageAspect / aperture), Math.min(1, aperture / imageAspect), 1);
  }
  function motor(parent: THREE.Object3D, radius: number) {
    const group = new THREE.Group(); parent.add(group); const body = new THREE.Mesh(cylinder, graphite); body.scale.set(radius, .25, radius); body.rotation.x = Math.PI / 2; group.add(body);
    const trim = ring(group, radius * .91, .025, ivory); trim.position.z = .15; ring(group, radius * .5, .018, red).position.z = .16; return group;
  }
  function arm(parent: THREE.Object3D): Link {
    const body = new THREE.Mesh(cylinder, alloy), piston = new THREE.Mesh(cylinder, graphite), signal = new THREE.Mesh(cylinder, darkRed); parent.add(body, piston, signal); return { body, piston, signal };
  }
  function connect(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
    direction.subVectors(b, a); mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.scale.set(radius, Math.max(.001, direction.length()), radius); mesh.quaternion.setFromUnitVectors(axis, direction.normalize());
  }
  function moveArm(link: Link, a: THREE.Vector3, b: THREE.Vector3) {
    scratchC.copy(a).lerp(b, .64); connect(link.body, a, scratchC, .17); connect(link.piston, scratchC, b, .105); connect(link.signal, a, b, .018);
  }
  const chapters: Assembly[] = PASSAGE_CHAPTERS.map((spec, index) => {
    const root = new THREE.Group(); root.name = `passage-architecture-${spec.id}`; scene.add(root);
    const frames: THREE.Mesh[] = [];
    for (let j = 0; j < 3; j++) { const mesh = new THREE.Mesh(chassisGeometry, j === 1 ? graphite : alloy); root.add(mesh); frames.push(mesh); }
    const fins: THREE.Group[] = [];
    for (let j = 0; j < 4; j++) {
      const fin = new THREE.Group(); root.add(fin); box(fin, 0, 0, 0, .62, .19, .9, graphite); box(fin, 0, .105, 0, .58, .025, .95, j % 2 ? ivory : red); fins.push(fin);
    }
    const ribs = instanced(root, graphite, 14, () => {}); ribs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const slats: THREE.Group[] = [];
    for (let j = 0; j < 12; j++) {
      const slat = new THREE.Group(); root.add(slat); box(slat, 0, -4.75, 0, 1.22, 9.5, .035, charcoal); box(slat, -.60, -4.75, .025, .014, 9.5, .035, alloy); slats.push(slat);
    }
    const screen = new THREE.Group(); screen.name = `${spec.id}-cultural-window`; screen.position.fromArray(spec.media.position); screen.rotation.y = spec.media.yaw; root.add(screen);
    const w = spec.media.width, h = w * 9 / 16;
    box(screen, 0, 0, -.10, w + .10, h + .10, .16, charcoal);
    for (const side of [-1, 1]) { box(screen, 0, side * (h / 2 + .06), -.01, w + .21, .075, .23, alloy); box(screen, side * (w / 2 + .06), 0, -.01, .075, h + .1, .23, graphite); }
    box(screen, -w / 2 + .66, -h / 2 - .125, .02, 1.25, .025, .025, red);
    const media = imageSurface(screen, w, h); media.position.z = .015;
    const spill = new THREE.Mesh(geometry('spill-plane', () => new THREE.PlaneGeometry(5, 3)), spillMat); spill.position.set(spec.media.position[0], -3.8, -.9); spill.rotation.x = -Math.PI * .32; root.add(spill);
    const exhibit = new THREE.Group(); exhibit.name = `${spec.id}-inspection`; exhibit.position.fromArray(spec.exhibit); root.add(exhibit);
    const movement = new THREE.Group(); exhibit.add(movement);
    const armRoot = new THREE.Group(); armRoot.position.fromArray(spec.center); scene.add(armRoot);
    const side = index % 2 ? 1 : -1;
    box(armRoot, side * 8.25, -2.7, -.4, .72, 1.25, 1.0, graphite);
    const arms = [arm(armRoot), arm(armRoot)], motors = [motor(armRoot, .25), motor(armRoot, .23), motor(armRoot, .19)];
    const hub = new THREE.Group(); root.add(hub); hub.position.set(side * 7.15, -3.25, .18);
    ring(hub, .56, .045, alloy, Math.PI * 1.82); ring(hub, .39, .017, red, Math.PI * 1.7).rotation.y = .6;
    const core = new THREE.Mesh(geometry('hub-core', () => new THREE.IcosahedronGeometry(.18, 1)), ivory); hub.add(core);
    return { root, media, exhibit, movement, frames, fins, slats, ribs, armRoot, arms, motors, hub, target: new THREE.Vector3(), inspection: 0, turn: 0, ribInspection: -1, leafReveal: -1 };
  });
  // Small, recognisable objects remain inspectable. Their movement is below the
  // camera/assembly transform and can never displace text or playback controls.
  chapters.forEach((chapter, index) => {
    const model = chapter.movement;
    if (index === 0) {
      const globe = new THREE.Mesh(sphere, graphite); globe.scale.setScalar(.65); model.add(globe);
      for (let j = 0; j < 5; j++) { const meridian = ring(model, .675, .009, j === 0 ? red : alloy); meridian.rotation.y = j * Math.PI / 5; }
      ring(model, .78, .012, ivory, Math.PI * 1.6).rotation.x = 1.0;
    } else if (index === 1) {
      for (let j = 0; j < 4; j++) { const layer = ring(model, .48 + j * .08, .028, j % 2 ? graphite : alloy, Math.PI * 1.72); layer.rotation.set(j * .38, j * .5, j * .4); }
      const core = new THREE.Mesh(geometry('archive-core', () => new THREE.OctahedronGeometry(.23)), ceramic); model.add(core);
    } else if (index === 2) {
      for (const x of [-.30, .30]) {
        const wheel = new THREE.Mesh(geometry('reel', () => new THREE.CylinderGeometry(.34, .34, .075, 32)), graphite); wheel.rotation.x = Math.PI / 2; wheel.position.x = x; model.add(wheel);
        for (let j = 0; j < 5; j++) { const hole = new THREE.Mesh(geometry('reel-hole', () => new THREE.CircleGeometry(.065, 12)), ivory); hole.position.set(x + Math.cos(j * 1.256) * .2, Math.sin(j * 1.256) * .2, .045); model.add(hole); }
      }
      box(model, 0, -.43, 0, .95, .2, .25, alloy);
    } else if (index === 3) {
      for (let j = 0; j < 5; j++) { const record = ring(model, .25 + j * .09, j === 4 ? .025 : .012, j % 2 ? graphite : alloy); record.rotation.x = .3; }
      const centre = new THREE.Mesh(geometry('record-label', () => new THREE.CircleGeometry(.19, 24)), red); centre.rotation.x = .3; model.add(centre);
      ring(model, .73, .012, ivory, Math.PI * 1.4).rotation.y = .55;
    } else if (index === 4) {
      const vase = new THREE.Mesh(geometry('vase', () => new THREE.CylinderGeometry(.2, .35, .8, 9)), ceramic); model.add(vase);
      ring(model, .20, .032, graphite).rotation.x = Math.PI / 2;
      for (let j = 0; j < 3; j++) { const shard = box(model, .5 + j * .06, -.24 + j * .03, -.04 - j * .07, .45, .025, .6, j === 1 ? alloy : ceramic); shard.rotation.y = .3 + j * .2; }
    } else {
      for (let j = 0; j < 4; j++) { const band = ring(model, .45 + j * .07, .033, j === 1 ? red : alloy, Math.PI * 1.6); band.rotation.set(j * .58, j * .4, j * .65); }
      for (let j = 0; j < 3; j++) {
        const mount = new THREE.Group(); mount.position.set(1.25 + j * 1.6, -3.1, .7); mount.visible = false; chapter.root.add(mount); collectionMounts.push(mount);
        box(mount, 0, 0, -.055, 1.42, .85, .09, graphite); const surface = imageSurface(mount, 1.34, .754); surface.position.z = .005; collectionSurfaces.push(surface);
      }
    }
  });

  function configureTexture(texture: THREE.Texture) { texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; textures.add(texture); }
  function setPoster(index: number, url: string) {
    if (destroyed || !chapters[index] || !url) return;
    const version = ++loadVersions[index];
    loader.load(url, texture => {
      if (destroyed || version !== loadVersions[index]) { texture.dispose(); return; }
      configureTexture(texture); const previous = posters[index]; posters[index] = texture;
      if (!activeTextures[index]) { const surface = chapters[index].media; surface.material.map = texture; surface.material.color.set(0xffffff); surface.material.needsUpdate = true; containImage(surface, texture); }
      if (previous) { textures.delete(previous); previous.dispose(); } onInvalidate();
    }, undefined, () => { if (!destroyed) onInvalidate(); });
  }
  function setActiveTexture(index: number, texture: THREE.Texture | null) {
    if (destroyed || !chapters[index]) return;
    activeTextures[index] = texture; const surface = chapters[index].media, map = texture || posters[index]; containImage(surface, map);
    if (surface.material.map === map) return;
    surface.material.map = map; surface.material.color.set(map ? 0xffffff : 0x111513); surface.material.needsUpdate = true; onInvalidate();
  }
  function setCollection(urlsInput: string[]) {
    if (destroyed) return;
    const urls = urlsInput.filter(Boolean).slice(0, 3), key = JSON.stringify(urls); if (key === collectionKey) return;
    collectionKey = key; const version = ++collectionVersion;
    collectionMounts.forEach((mount, i) => { mount.visible = false; collectionSurfaces[i].material.map = null; collectionSurfaces[i].material.needsUpdate = true; const previous = collectionTextures[i]; collectionTextures[i] = null; if (previous) { textures.delete(previous); previous.dispose(); } });
    urls.forEach((url, i) => loader.load(url, texture => {
      if (destroyed || version !== collectionVersion) { texture.dispose(); return; }
      configureTexture(texture); collectionTextures[i] = texture; const surface = collectionSurfaces[i]; surface.material.map = texture; surface.material.color.set(0xffffff); surface.material.needsUpdate = true; containImage(surface, texture); collectionMounts[i].visible = true; onInvalidate();
    }, undefined, () => { if (!destroyed && version === collectionVersion) onInvalidate(); }));
    onInvalidate();
  }

  function update(state: ArchitectureFrame) {
    if (destroyed) return;
    const { active, elapsed, reducedMotion, inspection } = state;
    const time = reducedMotion ? 0 : elapsed, dt = Math.min(.05, Math.max(0, state.delta ?? 1 / 60));
    const pointerRate = reducedMotion ? 1 : 1 - Math.exp(-dt * 8);
    pointerX += ((reducedMotion ? 0 : THREE.MathUtils.clamp(state.pointer?.[0] || 0, -1, 1)) - pointerX) * pointerRate;
    pointerY += ((reducedMotion ? 0 : THREE.MathUtils.clamp(state.pointer?.[1] || 0, -1, 1)) - pointerY) * pointerRate;
    const approach = passagePose(state), cameraZ = approach.position[2];
    signalUniforms.uTime.value = time; signalUniforms.uEnergy.value = Math.min(1, state.energy || 0); signalUniforms.uPointer.value.set(pointerX, pointerY); signalUniforms.uCameraZ.value = cameraZ;
    ribbonUniforms.uTime.value = time; ribbonUniforms.uEnergy.value = Math.min(1, state.energy || 0);
    ribbonUniforms.uStation.value = PASSAGE_CHAPTERS[Math.max(0, active)]?.center[2] ?? -36;
    ribbonUniforms.uRead.value = state.progress > .36 && state.progress < .76 && active >= 0 ? 1 : 0;
    portals.forEach((portal, i) => { const distance = cameraZ - portal.position.z; portal.visible = distance > -12 && distance < 130; if (portal.visible) portal.rotation.z = i * .7 + time * (i % 2 ? -.018 : .022); });
    entrance.visible = cameraZ > -18;
    chapters.forEach((chapter, i) => {
      const pose = passageStationMotion(i, state), spec = PASSAGE_CHAPTERS[i], side = i % 2 ? 1 : -1;
      chapter.root.visible = pose.visible&&!state.compact; chapter.armRoot.visible = pose.visible&&!state.compact;
      if (!chapter.root.visible) { dummy.scale.setScalar(0); dummy.updateMatrix(); mechanismGlow.setMatrixAt(i, dummy.matrix); return; }
      chapter.root.position.fromArray(pose.position); chapter.root.rotation.set(...pose.rotation);
      const selected = inspection.expanded && inspection.station === spec.id, rate = reducedMotion ? 1 : 1 - Math.exp(-dt * 12);
      chapter.inspection += ((selected ? 1 : 0) - chapter.inspection) * rate; chapter.turn += ((selected ? inspection.rotation : 0) - chapter.turn) * rate;
      const ex = chapter.inspection;
      chapter.exhibit.rotation.y = chapter.turn; chapter.exhibit.scale.setScalar(1 + ex * .17);
      // Freeze the authored orientation progressively; multiplying an absolute
      // elapsed angle would unwind several revolutions when Inspect opens.
      const objectYaw = reducedMotion ? 0 : (chapter.movement.rotation.y + dt * .055 * (1 - ex)) % (Math.PI * 2);
      chapter.movement.rotation.set(Math.sin(time * .18 + i) * .06 * (1 - ex), objectYaw, Math.sin(time * .15 + i) * .04 * (1 - ex));
      // Frames open outside the editorial aperture; the front image and controls
      // retain their exact authored position, including during inspection.
      chapter.frames.forEach((frame, j) => { const stretch = 1 + j * .035 + ex * j * .035; frame.scale.set(stretch, stretch, 1); frame.position.set((j - 1) * ex * .16, (j - 1) * ex * .08, -.34 - j * (.52 + ex * .48)); frame.rotation.set(pointerY * j * .007, pointerX * j * .009, (j - 1) * (.012 + ex * .025)); });
      chapter.fins.forEach((fin, j) => { const sx = j % 2 ? 1 : -1, sy = j < 2 ? -1 : 1; fin.position.set(sx * (7.05 + ex * .25), sy * (4.25 + ex * .18), -.2); fin.rotation.set(sy * (.1 + ex * .25) + pointerY * .045, sx * (.25 + ex * .35) + pointerX * .055, sx * sy * .4); });
      if (Math.abs(chapter.ribInspection - ex) > .0001) {
        for (let j = 0; j < 14; j++) { const sx = j < 7 ? -1 : 1; dummy.position.set(sx * (7.92 + ex * .15), ((j % 7) - 3) * .88, -.85); dummy.scale.set(.13, .06, .5 + ex * .7); dummy.rotation.set(0, sx * (.2 + ex * .2), 0); dummy.updateMatrix(); chapter.ribs.setMatrixAt(j, dummy.matrix); }
        chapter.ribs.instanceMatrix.needsUpdate = true; chapter.ribInspection = ex;
      }
      if (Math.abs(chapter.leafReveal - pose.reveal) > .0001) {
        chapter.slats.forEach((slat, j) => { const fold = THREE.MathUtils.smoothstep(pose.reveal, j * .014, .83 + j * .014); slat.position.set(((j + .5) / 12 - .5) * 14.8, 4.76, -.05); slat.rotation.x = fold * Math.PI / 2; slat.visible = fold < .999; });
        chapter.leafReveal = pose.reveal;
      }
      // A tethered elbow follows the actual shared station transform. The arm
      // never assumes the panel is still on the original straight-axis plane.
      chapter.root.updateMatrixWorld(true); worldTarget.set(side * 7.15, -3.25, -.1).applyMatrix4(chapter.root.matrixWorld);
      dummy.position.copy(worldTarget); dummy.position.z += .48; dummy.rotation.set(0, 0, 0); dummy.scale.set(2.8, 2.2, 1); dummy.updateMatrix(); mechanismGlow.setMatrixAt(i, dummy.matrix);
      if (i === Math.max(0, active)) { contactLight.position.copy(worldTarget); contactLight.position.z += 1.1; contactLight.intensity = 2.4 + signalUniforms.uEnergy.value * 1.5 + Math.abs(pointerX) * .6; }
      chapter.target.copy(worldTarget).sub(chapter.armRoot.position);
      scratchA.set(side * 8.25, -2.7, .1); scratchB.copy(scratchA).lerp(chapter.target, .5); scratchB.y -= .58; scratchB.z += 1.1;
      moveArm(chapter.arms[0], scratchA, scratchB); moveArm(chapter.arms[1], scratchB, chapter.target);
      chapter.motors[0].position.copy(scratchA); chapter.motors[1].position.copy(scratchB); chapter.motors[2].position.copy(chapter.target);
      chapter.hub.rotation.set(pointerY * .09, pointerX * .11, time * .13);
    });
    mechanismGlow.instanceMatrix.needsUpdate = true;
    contactLight.visible=!state.compact;
  }
  function destroy() {
    if (destroyed) return; destroyed = true;
    scene.remove(tunnel, contactLight); chapters.forEach(chapter => { scene.remove(chapter.root, chapter.armRoot); });
    instances.forEach(mesh => mesh.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    instances.clear(); geometries.clear(); materials.clear(); textures.clear(); cache.clear();
  }
  return { chapters, entrance, update, setPoster, setActiveTexture, setCollection, destroy };
}
