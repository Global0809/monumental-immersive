import * as THREE from 'three';
import { PASSAGE_CHAPTERS } from '../../services/passageChapters';

type PassageArchitectureFrame = {
  active: number; progress: number; elapsed: number; reducedMotion: boolean;
  delta?: number;
  inspection: { station: string | null; expanded: boolean; rotation: number };
};
type ImageSurface = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
type ChapterArchitecture = { root: THREE.Group; media: ImageSurface; exhibit: THREE.Group };
type MovingPart = { node: THREE.Object3D; axis: 'x' | 'y' | 'z'; base: number; amount: number; rate: number; phase: number };
type InspectionPart = { node: THREE.Object3D; base: THREE.Vector3; offset: THREE.Vector3 };

/** A set of actual rooms, all expressed in the shared chapter's local space.
 * The scene owns the camera, lights and clock; this module never starts a loop. */
export function createPassageArchitecture(scene: THREE.Scene, onInvalidate: () => void) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const instances = new Set<THREE.InstancedMesh>();
  const geometryCache = new Map<string, THREE.BufferGeometry>();
  const materialCache = new Map<string, THREE.Material>();
  const secondaryImages: ImageSurface[][] = PASSAGE_CHAPTERS.map(() => []);
  const posters: (THREE.Texture | null)[] = PASSAGE_CHAPTERS.map(() => null);
  const activeTextures: (THREE.Texture | null)[] = PASSAGE_CHAPTERS.map(() => null);
  const loadVersions = PASSAGE_CHAPTERS.map(() => 0);
  const motions: MovingPart[][] = PASSAGE_CHAPTERS.map(() => []);
  const inspectionParts: InspectionPart[][] = PASSAGE_CHAPTERS.map(() => []);
  const exhibitMotion: THREE.Group[] = [];
  const exhibitBases: THREE.Vector3[] = [];
  const inspectionBlend = PASSAGE_CHAPTERS.map(() => 0);
  const inspectionTurn = PASSAGE_CHAPTERS.map(() => 0);
  const rearShutters: [THREE.Mesh, THREE.Mesh][] = [];
  const collectionMounts: THREE.Group[] = [];
  const collectionSurfaces: ImageSurface[] = [];
  const collectionTextures: (THREE.Texture | null)[] = [null, null, null];
  let collectionVersion = 0, collectionKey = '';
  const entrancePetals: { root: THREE.Group; angle: number }[] = [];
  const entranceCollars: THREE.Group[] = [];
  const imageLoader = new THREE.TextureLoader();
  const dummy = new THREE.Object3D();
  const black = 0x080909, red = 0xff4d32;
  let destroyed = false;

  function geometry<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    let result = geometryCache.get(key);
    if (!result) { result = make(); geometryCache.set(key, result); geometries.add(result); }
    return result as T;
  }
  function standard(key: string, options: THREE.MeshStandardMaterialParameters) {
    if (!materialCache.has(key)) {
      const result = new THREE.MeshStandardMaterial(options);
      materialCache.set(key, result); materials.add(result);
    }
    return materialCache.get(key) as THREE.MeshStandardMaterial;
  }
  function basic(key: string, options: THREE.MeshBasicMaterialParameters) {
    if (!materialCache.has(key)) {
      const result = new THREE.MeshBasicMaterial(options);
      materialCache.set(key, result); materials.add(result);
    }
    return materialCache.get(key) as THREE.MeshBasicMaterial;
  }
  const metal = standard('metal', { color: 0x777e7b, metalness: .94, roughness: .25 });
  const graphite = standard('graphite', { color: 0x171a19, metalness: .57, roughness: .46 });
  const dark = standard('dark', { color: 0x111414, metalness: .25, roughness: .69 });
  const ink = standard('ink', { color: black, roughness: .83 });
  const warm = standard('warm', { color: 0x51514b, roughness: .91, metalness: .03 });
  const floorMaterial = standard('floor', { color: 0x141615, roughness: .94, metalness: .04 });
  const warmPlaster = standard('warm-plaster', { color: 0x79766c, roughness: .94, metalness: .02 });
  const paper = standard('paper', { color: 0xada89a, roughness: .95, side: THREE.DoubleSide });
  const ceramic = standard('ceramic', { color: 0xbbb8ac, roughness: .37, metalness: .06 });
  const signal = basic('signal', { color: red, toneMapped: false });
  const softLight = basic('soft-light', { color: 0xb3afa2, toneMapped: false });
  const dimSignal = standard('dim-signal', { color: 0x6e251b, emissive: red, emissiveIntensity: .35, roughness: .52 });

  // A shared deterministic microrelief gives the mineral and paper surfaces scale.
  // It is a small static texture, never regenerated during scroll or inspection.
  const grainCanvas = document.createElement('canvas'); grainCanvas.width = grainCanvas.height = 128;
  const grainContext = grainCanvas.getContext('2d');
  if (grainContext) {
    const pixels = grainContext.createImageData(128, 128);
    let seed = 41731;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const value = 125 + (seed % 35);
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
    }
    grainContext.putImageData(pixels, 0, 0);
    const grain = new THREE.CanvasTexture(grainCanvas); grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
    grain.repeat.set(8, 8); textures.add(grain);
    warm.bumpMap = grain; warm.bumpScale = .035; paper.bumpMap = grain; paper.bumpScale = .019;
    warmPlaster.bumpMap = grain; warmPlaster.bumpScale = .035;
  }
  const boxGeometry = geometry('unit-box', () => new THREE.BoxGeometry(1, 1, 1));
  const sphereGeometry = geometry('sphere', () => new THREE.SphereGeometry(1, 24, 16));
  function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) {
    const result = new THREE.Mesh(boxGeometry, material); result.position.set(x, y, z); result.scale.set(w, h, d); parent.add(result); return result;
  }
  function tube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material, closed = false, segments = 64) {
    const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', .35);
    const shape = new THREE.TubeGeometry(curve, segments, radius, 6, closed); geometries.add(shape);
    const result = new THREE.Mesh(shape, material); parent.add(result); return result;
  }
  function ring(parent: THREE.Object3D, radius: number, thickness: number, material: THREE.Material, arc = Math.PI * 2) {
    const shape = geometry(`torus-${radius}-${thickness}-${arc}`, () => new THREE.TorusGeometry(radius, thickness, 8, 72, arc));
    const result = new THREE.Mesh(shape, material); parent.add(result); return result;
  }
  function frame(parent: THREE.Object3D, w: number, h: number, depth: number, material: THREE.Material, edge = .15) {
    const group = new THREE.Group(); parent.add(group);
    box(group, 0, h / 2 + edge / 2, 0, w + edge * 2, edge, depth, material);
    box(group, 0, -h / 2 - edge / 2, 0, w + edge * 2, edge, depth, material);
    box(group, -w / 2 - edge / 2, 0, 0, edge, h, depth, material);
    box(group, w / 2 + edge / 2, 0, 0, edge, h, depth, material);
    return group;
  }
  function repeatedBoxes(parent: THREE.Object3D, list: { position: number[]; scale: number[]; rotation?: number[] }[], material: THREE.Material) {
    const mesh = new THREE.InstancedMesh(boxGeometry, material, list.length); instances.add(mesh);
    list.forEach((item, i) => {
      dummy.position.fromArray(item.position); dummy.scale.fromArray(item.scale);
      dummy.rotation.set(item.rotation?.[0] || 0, item.rotation?.[1] || 0, item.rotation?.[2] || 0);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); parent.add(mesh); return mesh;
  }
  function floor(parent: THREE.Object3D, width: number, depth: number, z: number, material = floorMaterial) {
    box(parent, 0, -5.1, z, width, .65, depth, material);
    // Lit joints give the floor a readable scale without reflective post-processing.
    const joints = [-1, 1].map(side => ({ position: [side * (width / 2 - .8), -4.765, z], scale: [.025, .014, depth - 2] }));
    repeatedBoxes(parent, joints, dimSignal);
  }
  function imageSurface(parent: THREE.Object3D, width: number, height: number): ImageSurface {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false, side: THREE.FrontSide });
    materials.add(material);
    const result = new THREE.Mesh(geometry(`image-${width}-${height}`, () => new THREE.PlaneGeometry(width, height)), material);
    result.material.color.set(0x141819); parent.add(result); return result;
  }
  function containImage(surface: ImageSurface, texture: THREE.Texture | null) {
    // Fit the actual image geometry inside its architectural aperture. A shared
    // poster can have several different apertures without mutating texture UVs.
    const source = texture?.image as {
      videoWidth?: number; videoHeight?: number; naturalWidth?: number;
      naturalHeight?: number; width?: number; height?: number;
    } | undefined;
    const width = source?.videoWidth || source?.naturalWidth || source?.width || 0;
    const height = source?.videoHeight || source?.naturalHeight || source?.height || 0;
    if (!width || !height) { surface.scale.set(1, 1, 1); return; }
    const imageAspect = width / height;
    const apertureAspect = surface.geometry.parameters.width / surface.geometry.parameters.height;
    surface.scale.set(Math.min(1, imageAspect / apertureAspect), Math.min(1, apertureAspect / imageAspect), 1);
  }
  function smallImage(index: number, parent: THREE.Object3D, x: number, y: number, z: number, width: number, yaw: number) {
    const mount = new THREE.Group(); mount.position.set(x, y, z); mount.rotation.y = yaw; parent.add(mount);
    const height = width * 9 / 16;
    box(mount, 0, 0, -.18, width + .3, height + .3, .3, dark);
    frame(mount, width, height, .25, graphite, .075);
    const surface = imageSurface(mount, width, height); surface.position.z = .015;
    secondaryImages[index].push(surface); return mount;
  }
  function inspectPiece(index: number, node: THREE.Object3D, offset: THREE.Vector3) {
    inspectionParts[index].push({ node, base: node.position.clone(), offset });
  }
  function sway(index: number, node: THREE.Object3D, axis: 'x' | 'y' | 'z', amount: number, rate: number, phase = 0) {
    motions[index].push({ node, axis, base: node.rotation[axis], amount, rate, phase });
  }

  const chapters: ChapterArchitecture[] = PASSAGE_CHAPTERS.map((spec, index) => {
    const root = new THREE.Group(); root.name = `passage-architecture-${spec.id}`;
    root.position.fromArray(spec.center); root.rotation.y = spec.yaw; scene.add(root);
    const screen = new THREE.Group(); screen.position.fromArray(spec.media.position); screen.rotation.y = spec.media.yaw;
    screen.name = `${spec.id}-cultural-window`; root.add(screen);
    const w = spec.media.width, h = w * 9 / 16;
    if (index === 0) {
      // A deep mineral reveal: the image occupies a recess in the observatory.
      box(screen, 0, 0, -.62, w + .9, h + .9, 1.1, warm);
      frame(screen, w + .12, h + .12, .72, graphite, .13).position.z = -.22;
      box(screen, 0, 0, -.015, w, h, .05, ink);
    } else if (index === 1) {
      // Offset paper margins disclose depth through parallax between layers.
      box(screen, 0, 0, -.3, w + .15, h + .15, .45, ink);
      for (let n = 0; n < 3; n++) {
        const margin = frame(screen, w + n * .22, h + n * .2, .09, n === 1 ? graphite : paper, .065);
        margin.position.set(n * .08, n * .06, -.08 - n * .34);
      }
    } else if (index === 2) {
      // Cinema lets the light occupy the room without a monitor-like metal bezel.
      box(screen, 0, 0, -.04, w + .04, h + .04, .08, ink);
    } else if (index === 3) {
      box(screen, 0, 0, -.06, w, h, .12, ink);
      for (const side of [-1, 1]) {
        box(screen, 0, side * (h / 2 + .055), 0, w + .38, .09, .16, metal);
        box(screen, side * (w / 2 - .22), h / 2 + 1.8, -.03, .026, 3.5, .026, metal);
      }
    } else if (index === 4) {
      box(screen, 0, 0, -.14, w + .5, h + .5, .28, paper);
      frame(screen, w + .05, h + .05, .16, warmPlaster, .16);
      box(screen, 0, 0, -.01, w, h, .04, ink);
    } else {
      box(screen, 0, 0, -.2, w + .2, h + .2, .35, dark);
      frame(screen, w, h, .28, graphite, .065);
      box(screen, 0, -h / 2 - .085, .035, w, .02, .045, softLight);
    }
    const media = imageSurface(screen, w, h); media.position.z = .035;
    const leftShutter = box(root, -8, .5, -14, 16.02, 22, .65, ink);
    const rightShutter = box(root, 8, .5, -14, 16.02, 22, .65, ink);
    leftShutter.name = `${spec.id}-rear-threshold-left`; rightShutter.name = `${spec.id}-rear-threshold-right`;
    rearShutters.push([leftShutter, rightShutter]);
    const exhibit = new THREE.Group(); exhibit.name = `${spec.id}-inspection`; exhibit.position.fromArray(spec.exhibit); root.add(exhibit);
    exhibitBases[index] = exhibit.position.clone();
    const animated = new THREE.Group(); exhibit.add(animated); exhibitMotion[index] = animated;
    return { root, media, exhibit };
  });

  // WORLD — an expansive observatory with high, interrupted meridians.
  {
    const { root } = chapters[0], exhibit = exhibitMotion[0];
    floor(root, 30, 31, -1);
    const columns: { position: number[]; scale: number[] }[] = [];
    for (const side of [-1, 1]) for (let n = 0; n < 4; n++) {
      columns.push({ position: [side * (n % 2 ? 13.8 : 12.8), 3, 11 - n * 7.8], scale: [1.15, 15.7, 1.4] });
    }
    repeatedBoxes(root, columns, warm);
    const columnContacts: { position: number[]; scale: number[] }[] = [];
    columns.forEach(column => {
      columnContacts.push({ position: [column.position[0], -4.72, column.position[2]], scale: [1.48, .1, 1.72] });
      for (const level of [-1.5, 3.5, 8.5]) columnContacts.push({ position: [column.position[0], level, column.position[2]], scale: [1.158, .032, 1.408] });
    });
    repeatedBoxes(root, columnContacts, ink);
    // The large canopy is open between ribs, so the raised ceiling is visible.
    for (let n = 0; n < 5; n++) {
      const rib = ring(root, 13.6, n === 0 ? .16 : .065, n === 0 ? metal : graphite, Math.PI);
      rib.position.set(0, 1.8, 9 - n * 5.9);
    }
    const geographic = new THREE.Group(); geographic.position.set(4, -4.7, -3); root.add(geographic);
    for (let n = 0; n < 3; n++) { const orbit = ring(geographic, 4.8 + n * 2.35, .025, n === 0 ? signal : metal, Math.PI * 1.6); orbit.rotation.x = -Math.PI / 2; orbit.rotation.z = n * .45; }
    const globe = new THREE.Mesh(sphereGeometry, dark); globe.scale.setScalar(1.42); exhibit.add(globe);
    for (let n = 0; n < 5; n++) {
      const meridian = ring(exhibit, 1.49, .019, n === 0 ? signal : metal); meridian.rotation.y = n * Math.PI / 5;
      inspectPiece(0, meridian, new THREE.Vector3(Math.cos(n) * .2, .12 * n, Math.sin(n) * .18));
    }
    for (let n = -1; n <= 1; n++) {
      const latitude = ring(exhibit, Math.sqrt(1.49 ** 2 - (n * .7) ** 2), .012, metal);
      latitude.rotation.x = Math.PI / 2; latitude.position.y = n * .7;
    }
    // Actual catalogue destinations: Miami, London, New York, Puerto Rico, Tokyo.
    [[25.76, -80.19], [51.51, -.13], [40.71, -74], [18.46, -66.11], [35.68, 139.69]].forEach(([lat, lon]) => {
      const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
      const marker = new THREE.Mesh(sphereGeometry, signal); marker.scale.setScalar(.07);
      marker.position.set(1.51 * Math.cos(a) * Math.sin(b), 1.51 * Math.sin(a), 1.51 * Math.cos(a) * Math.cos(b)); exhibit.add(marker);
    });
    box(root, 2.8, -4.82, 3, 4.6, .2, 3.6, dark);
    smallImage(0, root, 12.1, 2.7, -10.3, 7.5, -.38);
    // Behind the entrance this window gives the opening a real inhabited destination.
    box(root, -11.8, 3.2, -7, .35, 12.5, 12, graphite);
    box(root, -11.55, 2, -5, .025, 8, .1, softLight);
    sway(0, exhibit, 'y', .26, .12);
  }

  // TIME MACHINE — successive deep frames; each opening reveals the next layer.
  {
    const { root } = chapters[1], exhibit = exhibitMotion[1]; floor(root, 25, 31, -.5);
    for (let n = 0; n < 6; n++) {
      const threshold = frame(root, 21 - n * .65, 12.7 - n * .4, .48, n % 2 === 0 ? paper : graphite, n % 2 === 0 ? .24 : .11);
      threshold.position.set(n % 2 ? .85 : -.45, .1 + n * .12, 11 - n * 4.1);
      threshold.rotation.z = (n % 2 ? 1 : -1) * .012;
    }
    const shelves: { position: number[]; scale: number[] }[] = [];
    for (let side = -1; side <= 1; side += 2) for (let n = 0; n < 7; n++) {
      shelves.push({ position: [side * 11.4, -4.1 + n * 1.8, -3], scale: [1.8, .08, 18] });
    }
    repeatedBoxes(root, shelves, paper);
    const leaves: { position: number[]; scale: number[]; rotation: number[] }[] = [];
    for (let n = 0; n < 15; n++) leaves.push({ position: [10.5 + (n % 3) * .25, 1.3 + Math.floor(n / 5) * .45, 6 - n * .92], scale: [.08, 3.7 + (n % 3) * .3, 1.7], rotation: [0, -.12 + n * .014, 0] });
    repeatedBoxes(root, leaves, warm);
    for (let n = 0; n < 5; n++) {
      const artifact = frame(exhibit, 2.2 + n * .1, 1.7 + n * .06, .1, n % 2 ? paper : metal, .055);
      artifact.position.set((n - 2) * .14, n * .07, -(n - 2) * .29); artifact.rotation.z = (n - 2) * .045;
      inspectPiece(1, artifact, new THREE.Vector3((n - 2) * .19, .1 * n, -(n - 2) * .24));
    }
    const rail = tube(root, [new THREE.Vector3(-10, -4.65, 12), new THREE.Vector3(-10.2, -4.65, 1), new THREE.Vector3(-9.1, -4.65, -13)], .025, signal);
    rail.name = 'archive-continuity';
    smallImage(1, root, 10.6, 2.3, -8.2, 5.2, -.35);
    sway(1, exhibit, 'y', .12, .14, .7);
  }

  // CINEMA — a single large luminous image and a low, stepped dark room.
  {
    const { root } = chapters[2], exhibit = exhibitMotion[2]; floor(root, 31, 33, -2, ink);
    const screen = PASSAGE_CHAPTERS[2].media;
    const proscenium = frame(root, 15.5, 10.4, 1.2, graphite, .75); proscenium.position.set(3.7, .7, -3.7);
    const outer = frame(root, 21, 14.5, .6, dark, .4); outer.position.set(1, 1.3, -7.2);
    box(root, 10.95, .5, 4.8, 2, 12.2, 6, ink);
    box(root, -12.7, 1, 4, 2.4, 13.5, 7.2, ink);
    const steps: { position: number[]; scale: number[] }[] = [];
    for (let n = 0; n < 6; n++) steps.push({ position: [2.5, -5 + n * .105, 8.5 - n * 2], scale: [22, .2, 2.1] });
    repeatedBoxes(root, steps, graphite);
    const aisle: { position: number[]; scale: number[] }[] = [];
    for (let n = 0; n < 6; n++) for (const side of [-1, 1]) aisle.push({ position: [side === -1 ? -7.7 : 12.7, -4.87 + n * .105, 9.4 - n * 2], scale: [.3, .018, .035] });
    repeatedBoxes(root, aisle, dimSignal);
    // Static, economical illumination from the screen; no dynamic shadows or bloom.
    const spillMaterial = basic('cinema-spill', { color: 0xd9d2bc, transparent: true, opacity: .045, depthWrite: false, side: THREE.DoubleSide });
    const spill = new THREE.Mesh(geometry('cinema-spill-plane', () => new THREE.PlaneGeometry(13.5, 10)), spillMaterial);
    spill.rotation.x = -Math.PI / 2; spill.position.set(screen.position[0], -4.7, 2.6); root.add(spill);
    for (let n = 0; n < 2; n++) {
      const reel = new THREE.Group(); reel.position.set((n - .5) * 1.65, .05, n * -.12); exhibit.add(reel);
      ring(reel, .82, .105, metal); ring(reel, .23, .085, metal);
      const spokes: { position: number[]; scale: number[]; rotation: number[] }[] = [];
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; spokes.push({ position: [Math.cos(a) * .5, Math.sin(a) * .5, 0], scale: [.58, .08, .07], rotation: [0, 0, a] }); }
      repeatedBoxes(reel, spokes, graphite); inspectPiece(2, reel, new THREE.Vector3((n - .5) * .5, .1, n * .3));
      sway(2, reel, 'z', .25, .16, n);
    }
    box(root, 4.3, -4.75, 3, 4.8, .3, 2, dark);
  }

  /** A true dimensional sheet, with an authored cross-section and thickness-like
   * folded rim. The three music surfaces have different spatial phrasing. */
  function ribbon(parent: THREE.Object3D, points: THREE.Vector3[], width: number, material: THREE.Material, twist: number) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', .5);
    const segments = 72, positions: number[] = [], uv: number[] = [], indices: number[] = [];
    const tangent = new THREE.Vector3(), across = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, p = curve.getPoint(t); tangent.copy(curve.getTangent(t));
      across.crossVectors(tangent, up).normalize(); across.applyAxisAngle(tangent, Math.sin(t * Math.PI * 2) * twist);
      for (const side of [-1, 1]) { const v = p.clone().addScaledVector(across, side * width / 2); positions.push(v.x, v.y, v.z); uv.push(t, side > 0 ? 1 : 0); }
      if (i < segments) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const shape = new THREE.BufferGeometry(); shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); shape.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); shape.setIndex(indices); shape.computeVertexNormals(); geometries.add(shape);
    const mesh = new THREE.Mesh(shape, material); parent.add(mesh); return mesh;
  }
  // MUSIC — three expressive acoustic ribbons with substantial, open space.
  {
    const { root } = chapters[3], exhibit = exhibitMotion[3]; floor(root, 29, 33, -1);
    const ribbonMaterial = standard('ribbon', { color: 0x777d79, metalness: .83, roughness: .33, side: THREE.DoubleSide });
    const ribbonWarm = standard('ribbon-warm', { color: 0xaaa69a, metalness: .47, roughness: .5, side: THREE.DoubleSide });
    const paths = [
      [[-12, 5.5, 13], [-8, 9.2, 5], [1, 8.3, -3], [11, 5.8, -8], [13, 2, -13]],
      [[14, -2.9, 11], [13, 2.8, 4], [12, 6.2, -3], [4, 8, -9], [-8, 6.1, -14]],
      [[-12, -3.9, 9], [-13, 1, 1], [-12, 5.1, -5], [-3, 6.2, -11], [9, 4.9, -15]],
    ];
    paths.forEach((points, n) => {
      const group = new THREE.Group(); root.add(group);
      const vectors = points.map(p => new THREE.Vector3(...p as [number, number, number]));
      ribbon(group, vectors, 1.2 + n * .25, n === 1 ? ribbonWarm : ribbonMaterial, .55 + n * .1);
      tube(group, vectors, .045, n === 0 ? metal : graphite, false, 72);
      sway(3, group, n === 0 ? 'z' : 'y', .014, .37 + n * .07, n * 1.3);
    });
    const hangers: { position: number[]; scale: number[] }[] = [];
    for (let n = 0; n < 4; n++) hangers.push({ position: [11.6, 8.5, 7 - n * 6], scale: [.025, 7.5, .025] });
    repeatedBoxes(root, hangers, metal);
    for (let n = 0; n < 3; n++) {
      const shell = new THREE.Group(); exhibit.add(shell);
      const a = n * Math.PI / 3, path: THREE.Vector3[] = [];
      for (let k = 0; k <= 16; k++) { const t = k / 16 * Math.PI * 1.65; path.push(new THREE.Vector3(Math.cos(t) * (1.25 + n * .15), Math.sin(t) * .7, Math.sin(t * 1.5 + a) * .33 + n * .13)); }
      ribbon(shell, path, .28, ribbonMaterial, .5);
      inspectPiece(3, shell, new THREE.Vector3(0, (n - 1) * .35, (n - 1) * .2));
    }
    sway(3, exhibit, 'z', .045, .46);
    box(root, 3, -4.8, 3, 4.6, .25, 2.6, graphite);
  }

  // CULTURE — the scale contracts into plaster, thick paper, fabric and a table.
  {
    const { root } = chapters[4], exhibit = exhibitMotion[4]; floor(root, 25, 29, -1);
    box(root, 12.15, -.2, -3, .8, 9.2, 19, warmPlaster);
    box(root, -12.5, -.2, -5, .8, 9.2, 15, warmPlaster);
    box(root, 2, 5.4, -3, 23.5, .6, 21, warmPlaster);
    // Slim roof cuts suggest daylight, while the foreground stays calm for text.
    const skylights: { position: number[]; scale: number[] }[] = [];
    for (let n = 0; n < 4; n++) skylights.push({ position: [8.7 - n * 3.2, 5.07, -4], scale: [.09, .025, 15] });
    repeatedBoxes(root, skylights, softLight);
    const clothGeometry = geometry('atelier-cloth', () => {
      const result = new THREE.PlaneGeometry(3.8, 7.3, 12, 16), pos = result.getAttribute('position');
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, Math.sin(x * 4.2) * .1 + Math.sin(y * .8 + x) * .06); }
      result.computeVertexNormals(); return result;
    });
    const cloth = new THREE.Mesh(clothGeometry, paper); cloth.position.set(10.7, .7, 5.1); cloth.rotation.y = -.36; root.add(cloth);
    box(root, 10.7, 4.55, 5.1, 4.4, .07, .07, metal);
    sway(4, cloth, 'y', .018, .21, .6);
    const table = new THREE.Group(); table.position.set(4, -3.8, 4.6); table.rotation.y = -.14; root.add(table);
    box(table, 0, 0, 0, 6.5, .28, 2.35, warm);
    for (const side of [-1, 1]) box(table, side * 2.25, -.5, 0, .3, 1.08, 1.75, graphite);
    const vesselGeometry = geometry('ceramic-vessel', () => new THREE.LatheGeometry([
      new THREE.Vector2(.32, -.5), new THREE.Vector2(.4, -.45), new THREE.Vector2(.47, -.1), new THREE.Vector2(.5, .25), new THREE.Vector2(.45, .42), new THREE.Vector2(.4, .45), new THREE.Vector2(.39, .4), new THREE.Vector2(.43, .2), new THREE.Vector2(.4, -.1), new THREE.Vector2(.31, -.4),
    ], 28));
    const vessel = new THREE.Mesh(vesselGeometry, ceramic); vessel.position.set(-.65, .02, .2); exhibit.add(vessel);
    const folded = new THREE.Group(); folded.position.set(.65, -.49, 0); exhibit.add(folded);
    for (let n = 0; n < 4; n++) { const leaf = box(folded, .05 * n, n * .07, 0, 1.3, .035, .9, paper); leaf.rotation.y = n * .15; }
    inspectPiece(4, vessel, new THREE.Vector3(-.3, .2, .1)); inspectPiece(4, folded, new THREE.Vector3(.3, .3, 0));
    // A slim side recess is an authored material detail, not another fake content card.
    frame(root, 2.2, 4.5, .45, graphite, .1).position.set(-10.7, .1, -6.8);
  }

  // MY WORLD — a quiet collecting room, incorporating earlier material memories.
  {
    const { root } = chapters[5], exhibit = exhibitMotion[5]; floor(root, 28, 30, -1);
    const shelfParts: { position: number[]; scale: number[] }[] = [];
    for (let n = 0; n < 4; n++) {
      shelfParts.push({ position: [12, -3.8 + n * 2.6, -5], scale: [2.4, .12, 20] });
      shelfParts.push({ position: [-12.5, -3.8 + n * 2.6, -5], scale: [1.5, .12, 18] });
    }
    repeatedBoxes(root, shelfParts, paper);
    const uprights: { position: number[]; scale: number[] }[] = [];
    for (let n = 0; n < 5; n++) for (const side of [-1, 1]) uprights.push({ position: [side === -1 ? -13.1 : 13.1, .2, 4 - n * 4.5], scale: [.15, 10.6, .16] });
    repeatedBoxes(root, uprights, graphite);
    // Empty dimensional sleeves leave room for genuine saved content in the product.
    const sleeves: { position: number[]; scale: number[]; rotation: number[] }[] = [];
    for (let n = 0; n < 9; n++) sleeves.push({ position: [11.55, -3.05 + (n % 3) * 2.6, 3 - Math.floor(n / 3) * 5.7], scale: [.08, 1.6, 1.25], rotation: [0, -.12, 0] });
    repeatedBoxes(root, sleeves, warm);
    const canopy = ring(root, 12, .07, metal, Math.PI); canopy.position.set(0, 1.2, -8);
    for (let n = 0; n < 3; n++) {
      const band = ring(exhibit, 1.1 + n * .27, .105, n === 1 ? warm : metal, Math.PI * 1.65);
      band.rotation.set(n * .42, (n - 1) * .65, n * .55);
      inspectPiece(5, band, new THREE.Vector3((n - 1) * .28, n * .2, .1 * n));
    }
    box(root, 3, -4.62, 3, 5.6, .55, 3.6, warm);
    box(root, 3, -4.32, 3, 5.6, .025, 3.6, graphite);
    const landing = frame(root, 22, 12.5, .35, graphite, .13); landing.position.set(0, .5, -13);
    smallImage(5, root, 11.25, 1, -10, 4.5, -.4);
    // Actual saved posters, supplied by the shared viewer store, occupy a quiet
    // shelf. Nothing is invented or shown as saved when the collection is empty.
    for (let n = 0; n < 3; n++) {
      const mount = new THREE.Group(); mount.name = `saved-story-${n + 1}`;
      mount.position.set(.5 + n * 3, 4.55, -2); mount.visible = false; root.add(mount); collectionMounts.push(mount);
      box(mount, 0, 0, -.11, 2.42, 1.44, .18, dark);
      frame(mount, 2.3, 1.3, .16, graphite, .045);
      box(mount, 0, -.76, .02, 2.65, .07, .6, paper);
      const surface = imageSurface(mount, 2.3, 1.3); surface.position.z = .01; collectionSurfaces.push(surface);
    }
    sway(5, exhibit, 'y', .12, .12, .8);
  }

  // OPENING — a deep, layered iris with real thickness and a framed destination.
  const entrance = new THREE.Group(); entrance.name = 'passage-entrance'; entrance.position.set(3.3, .2, -8); scene.add(entrance);
  const entranceBase = new THREE.Group(); entrance.add(entranceBase);
  // A continuous load-bearing housing makes the iris a threshold rather than
  // floating ornaments. Its deep inner return remains visible during approach.
  const housingShape = new THREE.Shape(); housingShape.absarc(0, 0, 6.2, 0, Math.PI * 2, false);
  const apertureHole = new THREE.Path(); apertureHole.absarc(0, 0, 5.15, 0, Math.PI * 2, true); housingShape.holes.push(apertureHole);
  const housingGeometry = geometry('entrance-housing', () => new THREE.ExtrudeGeometry(housingShape, { depth: 1.35, bevelEnabled: true, bevelSize: .07, bevelThickness: .06, bevelSegments: 2, curveSegments: 64, steps: 1 }));
  const housing = new THREE.Mesh(housingGeometry, graphite); housing.position.z = -1.28; entranceBase.add(housing);
  const portalRadii = [5.45, 5.75, 6.15];
  portalRadii.forEach((radius, n) => {
    const collar = new THREE.Group(); collar.position.z = -n * .62; entranceBase.add(collar); entranceCollars.push(collar);
    ring(collar, radius, n === 1 ? .22 : .14, n === 1 ? metal : graphite);
    const edge = ring(collar, radius - .14, .022, n === 0 ? signal : softLight, Math.PI * 1.1); edge.rotation.z = n * 1.5;
  });
  const petalShape = new THREE.Shape();
  petalShape.moveTo(4.94, -.58); petalShape.bezierCurveTo(5.18, -.97, 5.7, -1.2, 6.08, -1.07);
  petalShape.bezierCurveTo(6.29, -.45, 6.33, .37, 6.17, .98);
  petalShape.bezierCurveTo(5.9, .66, 5.51, .38, 5.04, .43);
  petalShape.bezierCurveTo(4.99, .1, 4.92, -.23, 4.94, -.58); petalShape.closePath();
  const petalGeometry = geometry('entrance-petal', () => new THREE.ExtrudeGeometry(petalShape, { depth: .22, bevelEnabled: true, bevelSize: .035, bevelThickness: .045, bevelSegments: 2, steps: 1, curveSegments: 18 }));
  for (let n = 0; n < 12; n++) {
    const group = new THREE.Group(); const angle = n / 12 * Math.PI * 2; group.rotation.z = angle;
    entranceBase.add(group); const blade = new THREE.Mesh(petalGeometry, n % 4 === 0 ? metal : graphite); blade.position.z = .11; group.add(blade);
    const mechanism = box(group, 6.25, 0, -.5, .8, .18, 1.1, dark); mechanism.rotation.z = -.16;
    entrancePetals.push({ root: group, angle });
  }
  // Asymmetric near edges establish a human-scale foreground, while the iris is the middle ground.
  box(entrance, 7.8, 0, 3.5, 1.8, 17, 3.2, warm);
  box(entrance, -9.4, 0, 1, 1.25, 17.5, 5, graphite);
  box(entrance, 0, -6.5, 1, 18, .7, 12, floorMaterial);
  box(entrance, 7.8, -6.1, 3.5, 2.1, .1, 3.5, ink);
  for (const level of [-2.5, 1.9, 6.3]) box(entrance, 7.8, level, 3.5, 1.81, .028, 3.21, ink);
  box(entrance, 7, 1, 5.12, .025, 11, .035, softLight);
  const apertureRibs = ring(entrance, 6.5, .045, graphite, Math.PI * 1.6); apertureRibs.position.z = -2; apertureRibs.rotation.z = -.8;

  function setPoster(index: number, url: string) {
    if (destroyed || !chapters[index] || !url) return;
    const version = ++loadVersions[index];
    imageLoader.load(url, texture => {
      if (destroyed || version !== loadVersions[index]) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false; textures.add(texture);
      const old = posters[index]; posters[index] = texture;
      if (!activeTextures[index]) {
        chapters[index].media.material.map = texture; chapters[index].media.material.color.set(0xffffff); chapters[index].media.material.needsUpdate = true;
        containImage(chapters[index].media, texture);
      }
      secondaryImages[index].forEach(surface => { surface.material.map = texture; surface.material.color.set(0xffffff); surface.material.needsUpdate = true; containImage(surface, texture); });
      if (old) { textures.delete(old); old.dispose(); }
      onInvalidate();
    }, undefined, () => { if (!destroyed) onInvalidate(); });
  }
  function setActiveTexture(index: number, texture: THREE.Texture | null) {
    if (destroyed || !chapters[index]) return;
    activeTextures[index] = texture;
    const material = chapters[index].media.material, map = texture || posters[index];
    containImage(chapters[index].media, map);
    if (material.map === map) return;
    material.map = map; material.color.set(map ? 0xffffff : 0x141819); material.needsUpdate = true; onInvalidate();
  }
  function setCollection(posterUrls: string[]) {
    if (destroyed) return;
    const urls = posterUrls.filter(Boolean).slice(0, 3), key = JSON.stringify(urls);
    if (key === collectionKey) return;
    collectionKey = key; const version = ++collectionVersion;
    collectionMounts.forEach((mount, index) => {
      mount.visible = false;
      const previous = collectionTextures[index];
      collectionTextures[index] = null; collectionSurfaces[index].material.map = null;
      collectionSurfaces[index].material.needsUpdate = true;
      if (previous) { textures.delete(previous); previous.dispose(); }
    });
    urls.forEach((url, index) => imageLoader.load(url, texture => {
      if (destroyed || version !== collectionVersion) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false; textures.add(texture); collectionTextures[index] = texture;
      const surface = collectionSurfaces[index]; surface.material.map = texture; surface.material.color.set(0xffffff); surface.material.needsUpdate = true;
      containImage(surface, texture); collectionMounts[index].visible = true; onInvalidate();
    }, undefined, () => { if (!destroyed && version === collectionVersion) onInvalidate(); }));
    onInvalidate();
  }
  function update(frameState: PassageArchitectureFrame) {
    if (destroyed) return;
    const { active, progress, elapsed, reducedMotion, inspection } = frameState;
    const entryProgress = active < 0 ? THREE.MathUtils.smoothstep(progress, .12, 1) : 1;
    entrance.visible = active <= 0;
    entrancePetals.forEach(({ root, angle }) => {
      root.rotation.z = angle + entryProgress * .085;
      root.position.set(Math.cos(angle) * entryProgress * .68, Math.sin(angle) * entryProgress * .68, -entryProgress * .12);
    });
    entranceCollars.forEach((collar, index) => { collar.rotation.z = entryProgress * (index % 2 ? -.045 : .04); });
    chapters.forEach((chapter, index) => {
      chapter.root.visible = Math.abs(index - Math.max(0, active)) <= 1;
      // These are physical rear partitions: they conceal the next room during
      // reading, then open with scroll before the camera crosses the threshold.
      const rearOpen = index < active ? 1 : index === active ? THREE.MathUtils.smoothstep(progress, .74, .96) : 0;
      rearShutters[index][0].position.x = -8 - rearOpen * 17;
      rearShutters[index][1].position.x = 8 + rearOpen * 17;
      const selected = inspection.expanded && inspection.station === PASSAGE_CHAPTERS[index].id;
      const blendRate = reducedMotion ? 1 : 1 - Math.exp(-Math.min(.05, Math.max(0, frameState.delta ?? 1 / 60)) * 10);
      inspectionBlend[index] += ((selected ? 1 : 0) - inspectionBlend[index]) * blendRate;
      inspectionTurn[index] += ((selected ? inspection.rotation : 0) - inspectionTurn[index]) * blendRate;
      if (!chapter.root.visible) return;
      // Inspection and environmental motion live on different transform owners.
      chapter.exhibit.position.copy(exhibitBases[index]); chapter.exhibit.rotation.y = inspectionTurn[index];
      chapter.exhibit.scale.setScalar(1 + inspectionBlend[index] * .14);
      inspectionParts[index].forEach(part => part.node.position.copy(part.base).addScaledVector(part.offset, inspectionBlend[index]));
      motions[index].forEach(part => {
        // The outer inspection transform is exclusively controlled by the user;
        // authored sway belongs to child groups or environmental surfaces.
        if (part.node === chapter.exhibit) return;
        part.node.rotation[part.axis] = part.base + (reducedMotion ? 0 : Math.sin(elapsed * part.rate + part.phase) * part.amount * (1 - inspectionBlend[index]));
      });
    });
  }
  function destroy() {
    if (destroyed) return; destroyed = true;
    chapters.forEach(chapter => scene.remove(chapter.root)); scene.remove(entrance);
    instances.forEach(item => item.dispose()); instances.clear();
    geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
    geometries.clear(); materials.clear(); textures.clear(); geometryCache.clear(); materialCache.clear();
  }
  return { chapters, entrance, update, setPoster, setActiveTexture, setCollection, destroy };
}
