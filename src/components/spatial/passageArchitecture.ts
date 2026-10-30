import * as THREE from 'three';
import { PASSAGE_CHAPTERS } from '../../services/passageChapters';
import { passageStationMotion, passagePose, passageReading } from '../../services/passageJourney';
import { samplePassageAssembly } from '../../services/passageAssembly';
import { createChapterAssemblyKit, type ChapterAssembly } from './chapterAssembly';
import { createPassageThresholds } from './passageThresholds';
import { createPassageInstruments } from './passageInstruments';
import { createCinematicMaterials } from '../../services/cinematicMaterials';
import { sampleCinematicLight } from '../../services/cinematicLight';
import { createPanelTelemetry } from '../../services/panelTelemetry';
import { passageBayExpansion } from '../../services/passageEnvelope';

type ArchitectureFrame = {
  active: number; progress: number; elapsed: number; reducedMotion: boolean; delta?: number;
  pointer?: readonly [number, number]; energy?: number; compact?: boolean; quality?: string;
  pointerActive?: boolean; cameraZ?: number;
  audio?: { rms: number; bass: number; mid: number; treble: number };
  inspection: { station: string | null; expanded: boolean; rotation: number };
};
type ImageSurface = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
type Link = { body: THREE.Mesh; piston: THREE.Mesh; signal: THREE.Mesh };
type Assembly = {
  root: THREE.Group; media: ImageSurface; screen: THREE.Group; screenSlides: THREE.Mesh[]; exhibit: THREE.Group; movement: THREE.Group;
  housing: THREE.Group; editorial: THREE.Group; editorialBody: THREE.Mesh; editorialEdges: THREE.Mesh[]; editorialFinish: THREE.MeshStandardMaterial;
  mechanics: ChapterAssembly;
  armRoot: THREE.Group; arms: Link[]; motors: THREE.Group[]; hub: THREE.Group;
  target: THREE.Vector3; inspection: number; turn: number;
};

/** One continuous, permanently constructed machine. The scroll controller owns
 * camera and carrier poses. This module owns only materials and local mechanisms. */
export function createPassageArchitecture(scene: THREE.Scene, onInvalidate: () => void) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const instances = new Set<THREE.InstancedMesh>(), cache = new Map<string, THREE.BufferGeometry>();
  const finishes = createCinematicMaterials();
  const loader = new THREE.TextureLoader(), dummy = new THREE.Object3D();
  const scratchA = new THREE.Vector3(), scratchB = new THREE.Vector3(), scratchC = new THREE.Vector3(), direction = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0), worldTarget = new THREE.Vector3();
  const posters: (THREE.Texture | null)[] = PASSAGE_CHAPTERS.map(() => null), activeTextures = [...posters];
  const loadVersions = PASSAGE_CHAPTERS.map(() => 0);
  const collectionMounts: THREE.Group[] = [], collectionSurfaces: ImageSurface[] = [], collectionTextures: (THREE.Texture | null)[] = [null, null, null];
  let destroyed = false, collectionKey = '', collectionVersion = 0, pointerX = 0, pointerY = 0, readingAmount = 0;
  function geometry<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    if (!cache.has(key)) { const g = make(); cache.set(key, g); geometries.add(g); }
    return cache.get(key) as T;
  }
  function material<T extends THREE.Material>(value: T) { materials.add(value); return value; }
  const alloy = material(new THREE.MeshStandardMaterial({ color: 0xb8bfbd, metalness: 1, roughness: .13, envMapIntensity: 1.1 }));
  const ribAlloy = material(new THREE.MeshStandardMaterial({ color: 0x171d19, metalness: .80, roughness: .42, envMapIntensity: .24 }));
  const wallAlloy = material(new THREE.MeshStandardMaterial({ color: 0x101513, metalness: .34, roughness: .79, envMapIntensity: .20 }));
  wallAlloy.userData.passageShell = true;
  const graphite = material(new THREE.MeshStandardMaterial({ color: 0x171b19, metalness: .78, roughness: .38 }));
  const charcoal = material(new THREE.MeshStandardMaterial({ color: 0x0d1110, metalness: .55, roughness: .48 }));
  finishes.apply(alloy, 'metal', .28);
  finishes.apply(ribAlloy, 'metal', 1.15);
  finishes.apply(wallAlloy, 'paint', 1.15);
  finishes.apply(graphite, 'paint', .9);
  finishes.apply(charcoal, 'paint', .7);
  const panelTelemetry = createPanelTelemetry(wallAlloy);
  const red = material(new THREE.MeshBasicMaterial({ color: 0xff4d32, toneMapped: false }));
  const ivory = material(new THREE.MeshBasicMaterial({ color: 0xd5d2c6, toneMapped: false }));
  const darkRed = material(new THREE.MeshBasicMaterial({ color: 0x63251d, toneMapped: false }));
  const unitBox = geometry('box', () => new THREE.BoxGeometry(1, 1, 1));
  const cylinder = geometry('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 10));
  const tunnel = new THREE.Group(); tunnel.name = 'passage-continuous-tunnel'; scene.add(tunnel);
  const thresholds = createPassageThresholds(scene);
  const telemetryState = { time: 0, reading: 0, pointer: [0, 0] as [number, number], pointerActive: false, energy: 0, cameraZ: 14, calm: false, quality: 'balanced' };
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
    const z = 18 - n * 3.65 - (layer === 2 ? 1.35 : 0);
    const r = 8.8 + Math.sin(n * .46) * .34 + passageBayExpansion(z), span = 2 * r * Math.sin(Math.PI / 12) * .95;
    const radius = r + (layer === 2 ? .17 : layer === 1 ? -.13 : 0);
    object.position.set(Math.cos(a) * radius, Math.sin(a) * radius, z);
    object.rotation.z = a + Math.PI / 2;
    if (layer === 0) object.scale.set(span, .19, n % 4 === 0 ? .85 : .36);
    if (layer === 1) object.scale.set(span * (j % 3 === 0 ? .78 : .24), .026, .035);
    if (layer === 2) object.scale.set(span, .66, 2.6);
  }
  const structuralRibs = instanced(tunnel, ribAlloy, ringCount * ringSides, (i, o) => ribTransform(i, o, 0));
  const conduits = instanced(tunnel, red, ringCount * ringSides, (i, o) => ribTransform(i, o, 1));
  const whiteColor = new THREE.Color(0xd5d2c6), redColor = new THREE.Color(0xff4d32);
  for (let i = 0; i < conduits.count; i++) conduits.setColorAt(i, redColor);
  // Use white base material so the per-instance ivory remains neutral.
  const conduitMaterial = material(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  conduits.material = conduitMaterial;
  const wallFaces = instanced(tunnel, wallAlloy, ringCount * ringSides, (i, o) => ribTransform(i, o, 2));
  wallFaces.name = 'passage-led-lining';
  const structuralTint = new THREE.Color();
  for (let i = 0; i < structuralRibs.count; i++) {
    const level = .48 + ((i * 17 + Math.floor(i / ringSides) * 5) % 13) / 24;
    structuralTint.setRGB(level * .94, level, level * .97); structuralRibs.setColorAt(i, structuralTint);
    structuralTint.multiplyScalar(i % 7 === 0 ? .77 : .56); wallFaces.setColorAt(i, structuralTint);
  }

  // Depth-tested light bleed is attached to real conduits, rather than a
  // full-screen bloom pass that would wash out footage and typography.
  const signalUniforms = { uTime: { value: 0 }, uEnergy: { value: 0 }, uRead: { value: 0 }, uBreath: { value: 1 }, uPointer: { value: new THREE.Vector2() }, uCameraZ: { value: 14 } };
  const haloMaterial = material(new THREE.ShaderMaterial({ uniforms: signalUniforms, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;varying vec3 vTint;varying float vDepth;void main(){vUv=uv;vTint=instanceColor;vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);vDepth=world.z;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `varying vec2 vUv;varying vec3 vTint;varying float vDepth;uniform float uEnergy;uniform float uCameraZ;uniform float uRead;uniform float uBreath;void main(){vec2 p=vUv*2.-1.;float glow=exp(-p.y*p.y*5.5)*pow(max(0.,1.-abs(p.x)),.5);float edge=1.-smoothstep(.7,1.,abs(p.y));float charge=(.90+.10*sin(vDepth*.12))*uBreath;float depth=max(0.,uCameraZ-vDepth);float atmosphere=exp(-depth*depth*.00065);gl_FragColor=vec4(vTint,glow*edge*(.085+uEnergy*.035)*charge*atmosphere*(1.-uRead*.48));}`,
  }));
  haloMaterial.forceSinglePass = true;
  const haloPlane = geometry('signal-halo', () => new THREE.PlaneGeometry(1, 1));
  const conduitHalos = new THREE.InstancedMesh(haloPlane, haloMaterial, ringCount * ringSides); instances.add(conduitHalos);
  for (let i = 0; i < conduitHalos.count; i++) {
    ribTransform(i, dummy, 1); dummy.position.z += .20; dummy.scale.y = .28; dummy.scale.z = 1; dummy.scale.x *= 1.12; dummy.updateMatrix(); conduitHalos.setMatrixAt(i, dummy.matrix); conduitHalos.setColorAt(i, i % 5 === 0 ? whiteColor : redColor);
  }
  conduitHalos.instanceMatrix.needsUpdate = true; conduitHalos.computeBoundingSphere(); tunnel.add(conduitHalos);

  const ribbonUniforms = { uTime: { value: 0 }, uEnergy: { value: 0 }, uStation: { value: -36 }, uRead: { value: 0 }, uCameraZ: { value: 14 } };
  const ribbonMaterial = material(new THREE.ShaderMaterial({
    uniforms: ribbonUniforms, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;varying float vDepth;void main(){vUv=uv;vDepth=position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;varying float vDepth;uniform float uTime;uniform float uEnergy;uniform float uStation;uniform float uRead;uniform float uCameraZ;void main(){float pulse=pow(.5+.5*sin(vUv.y*68.-uTime*1.12),18.);float edge=pow(1.-abs(vUv.x*2.-1.),.6);float calm=1.-(1.-smoothstep(4.,20.,abs(vDepth-uStation)))*uRead*.82;float depth=max(0.,uCameraZ-vDepth);float atmosphere=exp(-depth*depth*.00065);vec3 c=mix(vec3(1.,.302,.196),vec3(.92,.90,.84),pulse*.6);gl_FragColor=vec4(c*(.60+pulse*.5+uEnergy*.12),edge*.28*calm*atmosphere);}`,
  }));
  ribbonMaterial.forceSinglePass = true;
  for (let lane = 0; lane < 7; lane++) {
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    const steps = 560;
    for (let n = 0; n <= steps; n++) {
      const z = 22 - n * .6, angle = lane * Math.PI * 2 / 7 + z * .043 + Math.sin(z * .069 + lane) * .13;
      const radius = 7.1 + Math.sin(z * .053 + lane * 2) * .55 + passageBayExpansion(z), width = lane % 3 === 0 ? .018 : .008;
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
    const portal = new THREE.Group(); portal.position.z = -10 - i * 20.5; portal.rotation.set(Math.sin(i * 3) * .10, Math.cos(i * 2) * .10, i * .7);
    const bay = passageBayExpansion(portal.position.z); portal.scale.set(1 + bay / 7.5, 1 + bay / 7.5, 1);
    tunnel.add(portal); portals.push(portal);
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
  instanced(tunnel, graphite, 180, (_i, o) => { const a = random() * Math.PI * 2, radial = 7.5 + random() * 1.5, z = 10 - random() * 310, r = radial + passageBayExpansion(z); o.position.set(Math.cos(a) * r, Math.sin(a) * r, z); o.rotation.set(random() * 2, random() * 3, random() * 3); o.scale.set(.12 + random() * .6, .06 + random() * .1, .2 + random()); });
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
  const machined = material(new THREE.MeshStandardMaterial({ color: 0xd5d9d7, metalness: 1, roughness: .095, envMapIntensity: 1.2 }));
  finishes.apply(machined, 'metal', .2);
  const mechanismKit = createChapterAssemblyKit({ steel: machined, graphite, charcoal, red, ivory });
  const chapters: Assembly[] = PASSAGE_CHAPTERS.map((spec, index) => {
    const root = new THREE.Group(); root.name = `passage-architecture-${spec.id}`; scene.add(root);
    const mechanics = mechanismKit.create(root, index);
    // One solid mounting plate supports the semantic DOM. Its face sits just
    // behind the text, with real thickness visible during the drawer approach.
    const editorial = new THREE.Group(); editorial.name = `${spec.id}-editorial-carrier`; editorial.position.fromArray(spec.panel.position); root.add(editorial);
    const editorialFinish = material(charcoal.clone()); editorialFinish.transparent = true;
    const editorialBody = box(editorial, 0, 0, -.14, 5.94, 7.6, .18, editorialFinish);
    const editorialEdges = [-1, 1].map(side => box(editorial, side * 2.99, 0, -.14, .045, 7.6, .2, editorialFinish));
    const screen = new THREE.Group(); screen.name = `${spec.id}-cultural-window`; screen.position.fromArray(spec.media.position); screen.rotation.y = spec.media.yaw; root.add(screen);
    const w = spec.media.width, h = w * 9 / 16;
    const housing = new THREE.Group(); housing.name = `${spec.id}-recessed-screen-housing`; housing.position.fromArray(spec.media.position); housing.rotation.y = spec.media.yaw; root.add(housing);
    box(housing, 0, 0, -1.43, w + .42, h + .42, .16, charcoal);
    const screenSlides: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      box(housing, side * (w / 2 + .24), 0, -.77, .16, h + .35, 1.48, graphite);
      screenSlides.push(box(housing, side * (w / 2 + .16), 0, -.64, .032, h * .78, 1.25, alloy));
      box(housing, side * (w / 2 + .33), 0, -.72, .014, h * .58, .016, red);
    }
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
    return { root, media, screen, screenSlides, housing, editorial, editorialBody, editorialEdges, editorialFinish, exhibit, movement, mechanics, armRoot, arms, motors, hub, target: new THREE.Vector3(), inspection: 0, turn: 0 };
  });
  // Small, recognisable objects remain inspectable. Their movement is below the
  // camera/assembly transform and can never displace text or playback controls.
  chapters.forEach((chapter, index) => {
    const model = chapter.movement;
    if (index === 5) {
      for (let j = 0; j < 4; j++) { const band = ring(model, .45 + j * .07, .033, j === 1 ? red : alloy, Math.PI * 1.6); band.rotation.set(j * .58, j * .4, j * .65); }
      for (let j = 0; j < 3; j++) {
        const mount = new THREE.Group(); mount.position.set(1.25 + j * 1.6, -3.1, .7); mount.visible = false; chapter.root.add(mount); collectionMounts.push(mount);
        box(mount, 0, 0, -.055, 1.42, .85, .09, graphite); const surface = imageSurface(mount, 1.34, .754); surface.position.z = .005; collectionSurfaces.push(surface);
      }
    }
  });

  const instruments = createPassageInstruments(chapters.map(chapter => chapter.movement));

  function setEditorialSize(index: number, width: number, height: number) {
    const chapter = chapters[index];
    if (!chapter || width <= 0 || height <= 0) return;
    chapter.editorialBody.scale.set(width + .34, height + .26, .18);
    chapter.editorialEdges.forEach((edge, i) => { edge.position.x = (i ? 1 : -1) * (width / 2 + .19); edge.scale.y = height + .26; });
  }

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
    const approach = passagePose(state), cameraZ = state.cameraZ ?? approach.position[2];
    thresholds.update(cameraZ, time, Boolean(state.compact), reducedMotion);
    instruments.update({ elapsed: time, delta: dt, reducedMotion, active, inspecting: inspection.expanded, audio: state.audio });
    const reading = passageReading(state);
    const light = sampleCinematicLight(time, reducedMotion, readingAmount);
    // Breathing belongs to the built light strips, not a changing exposure or
    // particle wash. Shared clock and a narrow amplitude keep the floor steady.
    const signalBreath = 1 + (light.signal - 1) * .42;
    conduitMaterial.color.setScalar(signalBreath);
    red.color.copy(redColor).multiplyScalar(signalBreath);
    signalUniforms.uBreath.value = signalBreath;
    signalUniforms.uTime.value = time; signalUniforms.uEnergy.value = Math.min(1, state.energy || 0); signalUniforms.uPointer.value.set(pointerX, pointerY); signalUniforms.uCameraZ.value = cameraZ;
    readingAmount += ((reading ? 1 : 0) - readingAmount) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 8));
    telemetryState.time = time; telemetryState.reading = readingAmount;
    telemetryState.pointer[0] = pointerX; telemetryState.pointer[1] = pointerY;
    telemetryState.pointerActive = !!state.pointerActive && !inspection.expanded;
    telemetryState.energy = Math.min(1, state.energy || 0); telemetryState.cameraZ = cameraZ;
    telemetryState.calm = reducedMotion || !!state.compact; telemetryState.quality = state.quality || 'balanced';
    panelTelemetry.update(telemetryState); thresholds.updateTelemetry(telemetryState);
    signalUniforms.uRead.value = readingAmount;
    conduitHalos.visible = !state.compact && state.quality !== 'light';
    ribbonUniforms.uTime.value = time; ribbonUniforms.uEnergy.value = Math.min(1, state.energy || 0);
    ribbonUniforms.uStation.value = PASSAGE_CHAPTERS[Math.max(0, active)]?.center[2] ?? -36;
    ribbonUniforms.uRead.value = readingAmount; ribbonUniforms.uCameraZ.value = cameraZ;
    portals.forEach((portal, i) => {
      const distance = cameraZ - portal.position.z; portal.visible = distance > -12 && distance < 130;
      if (!portal.visible) return;
      // The mounting stays in place while the inner and outer rings counter-
      // rotate at distinct rates. Reading content belongs to separate roots.
      portal.rotation.z = i * .7;
      portal.children.forEach((child, layer) => { child.rotation.z = time * (layer ? -.037 : .024); });
    });
    entrance.visible = cameraZ > -18;
    chapters.forEach((chapter, i) => {
      const pose = passageStationMotion(i, state), spec = PASSAGE_CHAPTERS[i], side = i % 2 ? 1 : -1;
      chapter.root.visible = pose.visible&&!state.compact; chapter.armRoot.visible = pose.visible&&!state.compact;
      if (!chapter.root.visible) { dummy.scale.setScalar(0); dummy.updateMatrix(); mechanismGlow.setMatrixAt(i, dummy.matrix); return; }
      chapter.root.position.fromArray(pose.position); chapter.root.rotation.set(...pose.rotation);
      const assembly = samplePassageAssembly(i, state);
      const screenExtension = assembly.screen;
      // A straight drawer stays parallel to its rails. Tilting a full-width
      // screen during retraction drove its back corners into the rear housing.
      // The display cassette packs inside the collapsed chassis, then arrives
      // from behind the armor continuously. No boolean appearance halfway
      // through an already open aperture, and no loose full-size rear slab.
      const cassetteScale = .38 + .62 * assembly.hinges, recess = (1 - screenExtension) * 2.44;
      chapter.screen.scale.setScalar(cassetteScale); chapter.housing.scale.setScalar(cassetteScale);
      chapter.housing.position.set(spec.media.position[0] * cassetteScale, spec.media.position[1] * cassetteScale, spec.media.position[2] - recess);
      chapter.screen.position.set(spec.media.position[0] * cassetteScale, spec.media.position[1] * cassetteScale, spec.media.position[2] - recess - (1 - screenExtension) * .96 * cassetteScale);
      chapter.screen.rotation.x = 0;
      chapter.editorial.visible = assembly.content > .001;
      chapter.editorialFinish.opacity = assembly.content;
      chapter.screenSlides.forEach(slide => { slide.scale.z = .08 + screenExtension * 1.17; slide.position.z = -1.27 + slide.scale.z * .5; });
      const selected = inspection.expanded && inspection.station === spec.id, rate = reducedMotion ? 1 : 1 - Math.exp(-dt * 12);
      chapter.inspection += ((selected ? 1 : 0) - chapter.inspection) * rate; chapter.turn += ((selected ? inspection.rotation : 0) - chapter.turn) * rate;
      const ex = chapter.inspection;
      chapter.exhibit.visible = assembly.lock > .001;
      chapter.exhibit.rotation.y = chapter.turn; chapter.exhibit.scale.setScalar((1 + ex * .5) * assembly.lock);
      // Bring the object into the open space beneath the screen instead of
      // enlarging it against the viewport edge. Media and camera never move.
      chapter.exhibit.position.set(spec.exhibit[0] + (3.35 - spec.exhibit[0]) * ex, spec.exhibit[1] + .40 * ex, spec.exhibit[2]);
      // Freeze the authored orientation progressively; multiplying an absolute
      // elapsed angle would unwind several revolutions when Inspect opens.
      const objectYaw = reducedMotion ? 0 : (chapter.movement.rotation.y + dt * .055 * (1 - ex)) % (Math.PI * 2);
      chapter.movement.rotation.set(Math.sin(time * .18 + i) * .06 * (1 - ex), objectYaw, Math.sin(time * .15 + i) * .04 * (1 - ex));
      chapter.mechanics.update(assembly, ex);
      // A tethered elbow follows the actual shared station transform. The arm
      // never assumes the panel is still on the original straight-axis plane.
      chapter.root.updateMatrixWorld(true); worldTarget.set(side * 7.15, -3.25, -.1).applyMatrix4(chapter.root.matrixWorld);
      dummy.position.copy(worldTarget); dummy.position.z += .48; dummy.rotation.set(0, 0, 0); dummy.scale.set(2.8, 2.2, 1); dummy.updateMatrix(); mechanismGlow.setMatrixAt(i, dummy.matrix);
      if (i === Math.max(0, active)) { contactLight.position.copy(worldTarget); contactLight.position.z += 1.1; contactLight.intensity = (2.4 + signalUniforms.uEnergy.value * 1.5 + Math.abs(pointerX) * .6) * (1 + (light.breath - 1) * .5); }
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
    instruments.destroy(); thresholds.destroy(); panelTelemetry.dispose(); mechanismKit.dispose(); finishes.dispose(); scene.remove(tunnel, contactLight); chapters.forEach(chapter => { scene.remove(chapter.root, chapter.armRoot); });
    instances.forEach(mesh => mesh.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    instances.clear(); geometries.clear(); materials.clear(); textures.clear(); cache.clear();
  }
  function setTelemetryProtection(rects: readonly { left: number; top: number; right: number; bottom: number }[]) {
    panelTelemetry.setProtection(rects); thresholds.setTelemetryProtection(rects);
  }
  return { chapters, entrance, update, setPoster, setActiveTexture, setCollection, setEditorialSize, setTelemetryProtection, destroy };
}
