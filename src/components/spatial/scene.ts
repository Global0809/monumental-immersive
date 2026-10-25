import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createFrameCadence } from '../../services/frameCadence';

export type SpatialScenePortal = { id: string; title: string; route: string; image: string };
export type SpatialProjection = { id: string; x: number; y: number; visible: boolean };
export type SpatialSceneOptions = {
  portals: SpatialScenePortal[];
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onReady: () => void;
  onUnavailable: () => void;
  onProject?: (positions: SpatialProjection[]) => void;
};
export type SpatialSceneState = { entered: boolean; room: string; paused: boolean; reducedMotion: boolean };
export type SpatialSceneController = {
  setState: (state: SpatialSceneState) => void;
  setFocus: (id: string | null) => void;
  setScroll: (progress: number) => void;
  rotate: (delta: number) => void;
  travelTo: (id: string, onComplete: () => void) => void;
  cancelTravel: () => void;
  destroy: () => void;
};

const INK = 0x080909;
const RED = 0xff4d32;
const asset = (url: string) => {
  const base = import.meta.env.BASE_URL;
  if (!url.startsWith('/') || url.startsWith('//') || (base !== '/' && url.startsWith(base))) return url;
  return `${base}${url.slice(1)}`;
};
const smooth = (value: number) => value * value * (3 - 2 * value);
const clamp = THREE.MathUtils.clamp;

/** One physical set, shared by every route. No postprocessing, shadow maps, or
 * duplicate application render: only the architecture is drawn here. */
export function createSpatialScene(host: HTMLElement, options: SpatialSceneOptions): SpatialSceneController {
  let disposed = false;
  let contextUnavailable = false;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });
  } catch {
    options.onUnavailable();
    return { setState() {}, setFocus() {}, setScroll() {}, rotate() {}, travelTo(_id, done) { done(); }, cancelTravel() {}, destroy() {} };
  }
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'spatial-world-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.touchAction = 'pan-y';
  host.appendChild(canvas);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.setClearColor(INK, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.FogExp2(INK, .017);
  const camera = new THREE.PerspectiveCamera(46, 1, .08, 110);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const ownGeometry = <T extends THREE.BufferGeometry>(value: T) => { geometries.add(value); return value; };
  const ownMaterial = <T extends THREE.Material>(value: T) => { materials.add(value); return value; };
  const ownTexture = <T extends THREE.Texture>(value: T) => { textures.add(value); return value; };

  const environmentScene = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, .035);
  scene.environment = environment.texture;
  scene.environmentIntensity = .95;
  environmentScene.dispose();
  pmrem.dispose();

  const chrome = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xe6e8e4, metalness: 1, roughness: .14 }));
  const brushed = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x373c39, metalness: .94, roughness: .3 }));
  // Architecture absorbs light; only the chrome instrument and portal rims
  // carry the bright room reflections. This keeps the set genuinely obsidian.
  const black = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x090b0a, toneMapped: false }));
  const red = ownMaterial(new THREE.MeshBasicMaterial({ color: RED, toneMapped: false }));
  const softWhite = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xb5b8ae, toneMapped: false }));
  const muted = ownMaterial(new THREE.LineBasicMaterial({ color: 0x424943, transparent: true, opacity: .42 }));
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = scene) => {
    const result = new THREE.Mesh(geometry, material); parent.add(result); return result;
  };
  const boxGeometry = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const box = (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
    const result = mesh(boxGeometry, material, parent); result.scale.set(...size); result.position.set(...position); return result;
  };
  const torus = (radius: number, tube: number, material: THREE.Material, parent: THREE.Object3D = scene, arc = Math.PI * 2) =>
    mesh(ownGeometry(new THREE.TorusGeometry(radius, tube, 10, 112, arc)), material, parent);

  scene.add(new THREE.HemisphereLight(0xdfe8e5, 0x151610, .34));
  const key = new THREE.DirectionalLight(0xf2f0e3, 2.3); key.position.set(-8, 12, 8); scene.add(key);
  const side = new THREE.DirectionalLight(0xc1d2d5, 2.1); side.position.set(10, 5, -15); scene.add(side);
  const signal = new THREE.PointLight(RED, 17, 19, 2); signal.position.set(0, 1.7, 4); scene.add(signal);

  // Broad radial inlays and soft pools of light anchor the building. There is
  // deliberately no construction grid: the floor reads as polished stone.
  const floor = mesh(ownGeometry(new THREE.PlaneGeometry(72, 90)), ownMaterial(new THREE.MeshBasicMaterial({ color: 0x101311, toneMapped: false })));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.02, -12);
  const floorLines: number[] = [];
  for (const radius of [4.4, 7.8, 13.6, 21.5]) {
    for (let i = 0; i < 144; i++) {
      const a = i / 144 * Math.PI * 2, b = (i + 1) / 144 * Math.PI * 2;
      floorLines.push(Math.cos(a) * radius, -1, Math.sin(a) * radius - 11.7,
        Math.cos(b) * radius, -1, Math.sin(b) * radius - 11.7);
    }
  }
  const inlay = ownGeometry(new THREE.BufferGeometry()); inlay.setAttribute('position', new THREE.Float32BufferAttribute(floorLines, 3));
  scene.add(new THREE.LineSegments(inlay, muted));

  // A shared procedural radial texture supplies contact shadows and reflected
  // illumination without shadow maps, screen-space effects, or image assets.
  function radialTexture(stops: [number, string][]) {
    const image = document.createElement('canvas'); image.width = image.height = 128;
    const context = image.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
      stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
      context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    }
    return ownTexture(new THREE.CanvasTexture(image));
  }
  const glowTexture = radialTexture([[0, 'rgba(255,255,255,.55)'], [.22, 'rgba(255,255,255,.28)'], [1, 'rgba(255,255,255,0)']]);
  const shadowTexture = radialTexture([[0, 'rgba(0,0,0,.9)'], [.4, 'rgba(0,0,0,.66)'], [1, 'rgba(0,0,0,0)']]);
  const groundPlane = ownGeometry(new THREE.PlaneGeometry(1, 1));
  function pool(x: number, z: number, width: number, depth: number, color: number, opacity: number, shadow = false) {
    const material = ownMaterial(new THREE.MeshBasicMaterial({ map: shadow ? shadowTexture : glowTexture, color, transparent: true,
      opacity, depthWrite: false, toneMapped: false, blending: shadow ? THREE.NormalBlending : THREE.AdditiveBlending }));
    const plane = mesh(groundPlane, material); plane.rotation.x = -Math.PI / 2; plane.position.set(x, shadow ? -.982 : -.99, z); plane.scale.set(width, depth, 1);
    return plane;
  }
  pool(0, -11.7, 13, 11, 0xc9d8ca, .2);
  pool(0, -11.7, 8, 6.5, 0x000000, .9, true);
  pool(0, 5.9, 13, 9, RED, .19);
  for (const x of [-2.45, 2.45]) {
    box(scene, [.023, .012, 18.8], [x, -.985, 2.7], red);
    box(scene, [.1, .023, 18.8], [x - Math.sign(x) * .1, -1, 2.7], brushed);
  }

  // An annular architectural section, with actual depth and bevels, is reused
  // for the threshold and structural arches. This is geometry, not linework.
  function archGeometry(inner: number, outer: number, arc: number, depth: number) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, arc, false);
    shape.lineTo(Math.cos(arc) * inner, Math.sin(arc) * inner);
    shape.absarc(0, 0, inner, arc, 0, true); shape.closePath();
    return ownGeometry(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .045, bevelSize: .045, bevelSegments: 2, curveSegments: 36, steps: 1 }));
  }
  const entrance = new THREE.Group(); entrance.position.set(0, 4.45, 6.5); scene.add(entrance);
  const outerCasing = torus(5.83, .31, brushed, entrance); outerCasing.scale.z = 1.75;
  const outerLip = torus(5.92, .055, chrome, entrance); outerLip.position.z = .5;
  const innerRim = torus(4.57, .07, chrome, entrance); innerRim.position.z = -.46;
  const bladeGeometry = archGeometry(4.58, 5.79, Math.PI * .155, .26);
  const entryBlades: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const blade = mesh(bladeGeometry, i % 3 === 0 ? chrome : brushed, entrance);
    blade.rotation.z = i / 12 * Math.PI * 2;
    blade.position.z = -.08 + (i % 2) * .06;
    entryBlades.push(blade);
  }
  const entrySignal = torus(4.69, .026, red, entrance, Math.PI * 1.36);
  entrySignal.rotation.z = -.26; entrySignal.position.z = .38;
  const entryLight = torus(5.98, .018, softWhite, entrance, Math.PI * .73);
  entryLight.rotation.z = Math.PI * .15; entryLight.position.z = .3;
  for (const direction of [-1, 1]) {
    box(scene, [1.3, 7.1, 2], [direction * 6.1, 2.48, 6.1], black);
    box(scene, [1.8, .3, 4.1], [direction * 5.7, -.83, 6.4], brushed);
  }
  const ribGeometry = archGeometry(12.7, 13.18, Math.PI, .76);
  const ribInnerGeometry = archGeometry(12.67, 12.71, Math.PI, .04);
  for (const z of [-4.3, -14.5, -25]) {
    const rib = mesh(ribGeometry, brushed); rib.position.set(0, -.93, z);
    const inner = mesh(ribInnerGeometry, chrome); inner.position.set(0, -.93, z + .78);
  }
  box(scene, [34, 17, .9], [0, 6, -32], black);
  for (const x of [-15.5, 15.5]) box(scene, [.7, 16, 42], [x, 6, -12], black);
  // Recessed vertical slots reveal the hall's depth without bathing it in gray.
  const wallLight = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x747c70, toneMapped: false }));
  for (const x of [-11.8, -8.2, 8.2, 11.8]) box(scene, [.045, 7.7, .015], [x, 3.7, -31.52], wallLight);
  const signCanvas = document.createElement('canvas'); signCanvas.width = 1536; signCanvas.height = 256;
  const signContext = signCanvas.getContext('2d');
  if (signContext) {
    signContext.fillStyle = '#b5b8ae'; signContext.textAlign = 'center';
    signContext.font = '600 148px "Barlow Condensed", sans-serif';
    signContext.fillText('M O N U M E N T A L', 768, 154);
    signContext.fillStyle = '#ff4d32'; signContext.font = '22px monospace';
    signContext.fillText('THE WORLD IS OPEN   /   CULTURE WITHOUT BORDERS', 768, 218);
    const signTexture = ownTexture(new THREE.CanvasTexture(signCanvas)); signTexture.colorSpace = THREE.SRGBColorSpace;
    const sign = mesh(ownGeometry(new THREE.PlaneGeometry(22, 3.67)), ownMaterial(new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, opacity: .72, depthWrite: false, toneMapped: false })));
    sign.position.set(0, 7.6, -31.51);
  }

  // A continuous, twisted ribbon knot gives the observatory its own object.
  // Broad polished faces and fine rounded edges catch the studio environment;
  // its topology is authored once, and only the group transform animates.
  const instrument = new THREE.Group(); instrument.position.set(0, 2.25, -11.7); scene.add(instrument);
  function ribbonGeometry() {
    const segments = 240, sides = 12, positions: number[] = [], indices: number[] = [];
    const point = (t: number) => new THREE.Vector3((1.6 + .61 * Math.cos(3 * t)) * Math.cos(2 * t),
      (1.6 + .61 * Math.cos(3 * t)) * Math.sin(2 * t), .72 * Math.sin(3 * t));
    const axis = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments * Math.PI * 2, center = point(t);
      const tangent = point(t + .001).sub(point(t - .001)).normalize();
      const across = new THREE.Vector3().crossVectors(tangent, axis).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, across).normalize();
      const twist = t * 2 + .35 * Math.sin(t * 3), cos = Math.cos(twist), sin = Math.sin(twist);
      const u = across.clone().multiplyScalar(cos).addScaledVector(normal, sin);
      const v = normal.clone().multiplyScalar(cos).addScaledVector(across, -sin);
      for (let j = 0; j < sides; j++) {
        const angle = j / sides * Math.PI * 2;
        // Superellipse cross section: flat ribbon faces with softened edges.
        const a = Math.cos(angle), b = Math.sin(angle);
        const w = Math.sign(a) * Math.pow(Math.abs(a), .36) * (.34 + .045 * Math.sin(t * 3));
        const h = Math.sign(b) * Math.pow(Math.abs(b), .6) * .045;
        const vertex = center.clone().addScaledVector(u, w).addScaledVector(v, h);
        positions.push(vertex.x, vertex.y, vertex.z);
        if (i < segments) {
          const here = i * sides + j, next = i * sides + (j + 1) % sides;
          indices.push(here, next, here + sides, next, next + sides, here + sides);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    return ownGeometry(geometry);
  }
  const sculpture = mesh(ribbonGeometry(), chrome, instrument); sculpture.rotation.set(.18, -.23, .2);
  const orbitSignal = torus(2.65, .016, red, instrument, Math.PI * .66); orbitSignal.rotation.set(1.44, .2, -.9);
  const plinth = mesh(ownGeometry(new THREE.CylinderGeometry(2.7, 3.05, .34, 80)), black);
  plinth.position.set(0, -.82, -11.7);
  const plinthLip = torus(2.75, .018, chrome); plinthLip.rotation.x = Math.PI / 2; plinthLip.position.set(0, -.65, -11.7);
  const plinthSignal = torus(2.78, .024, red, scene, Math.PI * .6); plinthSignal.rotation.x = Math.PI / 2; plinthSignal.position.set(0, -.72, -11.7);

  const portalCoordinates = [
    [-8.8, 2.05, -5.4], [-6.7, 2.05, -13.6], [-2.65, 2.05, -20],
    [2.65, 2.05, -20], [6.7, 2.05, -13.6], [8.8, 2.05, -5.4],
  ];
  const screens: { portal: SpatialScenePortal; group: THREE.Group; frame: THREE.Mesh; light: THREE.MeshBasicMaterial; marker: THREE.Vector3 }[] = [];
  const hitTargets: THREE.Mesh[] = [];
  const loader = new THREE.TextureLoader();
  const rasterPosters: Record<string, string> = {
    world: '/media/miami.jpg', 'time-machine': '/motion/02-time-machine.jpg',
    movies: '/media/sintel.jpg', music: '/media/puerto-rico.jpg',
    culture: '/motion/06-deco-atlas.jpg', 'my-world': '/media/tokyo.jpg',
  };
  const screenWidth = 4.9, screenHeight = 3.18;
  const screenGeometry = ownGeometry(new THREE.PlaneGeometry(screenWidth, screenHeight));
  const frameGeometry = ownGeometry(new THREE.BoxGeometry(5.13, 3.42, .23));
  options.portals.slice(0, 6).forEach((portal, index) => {
    const group = new THREE.Group(); group.position.set(...portalCoordinates[index] as [number, number, number]);
    group.lookAt(0, 2.05, 4.5); scene.add(group);
    const frame = mesh(frameGeometry, brushed, group);
    const pictureMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x39473c, toneMapped: false }));
    const picture = mesh(screenGeometry, pictureMaterial, group); picture.position.z = .122;
    picture.userData.portalId = portal.id; hitTargets.push(picture);
    const highlight = ownMaterial(new THREE.MeshBasicMaterial({ color: RED, toneMapped: false, transparent: true, opacity: .7 }));
    box(group, [5.14, .028, .04], [0, -1.72, .15], highlight);
    box(group, [5.14, .022, .04], [0, 1.72, .15], chrome);
    box(group, [.023, .38, .04], [-2.58, -1.54, .15], highlight);
    box(group, [3.8, .13, 1.1], [0, -2.97, 0], black);
    box(group, [.12, 1.22, .17], [0, -2.32, -.04], brushed);
    const anchor = new THREE.Vector3(0, -1.94, .15);
    pool(group.position.x, group.position.z, 6.5, 3.3, 0x000000, .73, true);
    pool(group.position.x, group.position.z + .3, 5, 4.4, RED, .12);
    screens.push({ portal, group, frame, light: highlight, marker: anchor });
    const fallback = rasterPosters[portal.id];
    const source = portal.image;
    function loadPoster(url: string, canFallback: boolean) {
      loader.load(asset(url), texture => {
      if (disposed) { texture.dispose(); return; }
      const image = texture.image as { width: number; height: number; naturalWidth?: number; naturalHeight?: number };
      const isSvg = /\.svg(?:[?#]|$)/i.test(url);
      const imageWidth = image.naturalWidth || image.width || (isSvg ? 1600 : 0);
      const imageHeight = image.naturalHeight || image.height || (isSvg ? 900 : 0);
      if (!imageWidth || !imageHeight) {
        texture.dispose();
        if (canFallback && fallback) loadPoster(fallback, false);
        return;
      }
      if (isSvg) {
        // Dimensionless SVGs can decode successfully yet upload a zero-size
        // texture. Supply a viewport and rasterize the same artwork once.
        const raster = document.createElement('canvas');
        const scale = Math.min(1, 1024 / imageWidth, 1024 / imageHeight);
        raster.width = Math.max(1, Math.round(imageWidth * scale));
        raster.height = Math.max(1, Math.round(imageHeight * scale));
        const context = raster.getContext('2d');
        try {
          if (!context) throw new Error('Raster context unavailable');
          image.width = imageWidth; image.height = imageHeight;
          context.drawImage(texture.image, 0, 0, raster.width, raster.height);
          // Both editorial posters have solid painted backgrounds. A decoded
          // but blank bitmap needs the real film-still fallback below.
          if (!context.getImageData(1, 1, 1, 1).data[3]) throw new Error('Empty SVG raster');
          texture.image = raster; texture.needsUpdate = true;
        } catch {
          texture.dispose();
          if (canFallback && fallback) loadPoster(fallback, false);
          return;
        }
      }
      ownTexture(texture); texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      // Crop within the physical film window, never distort a film poster.
      const aspect = imageWidth / imageHeight;
      const frameAspect = screenWidth / screenHeight;
      if (aspect > frameAspect) { texture.repeat.x = frameAspect / aspect; texture.offset.x = (1 - texture.repeat.x) / 2; }
      else { texture.repeat.y = aspect / frameAspect; texture.offset.y = (1 - texture.repeat.y) / 2; }
      pictureMaterial.map = texture; pictureMaterial.color.setHex(0xffffff); pictureMaterial.needsUpdate = true; requestFrame();
      }, undefined, () => { if (!disposed && canFallback && fallback) loadPoster(fallback, false); });
    }
    if (source) loadPoster(source, source !== fallback);
  });

  let state: SpatialSceneState = { entered: false, room: 'home', paused: false, reducedMotion: options.reducedMotion };
  let width = 1, height = 1, mobile = false;
  let frameRequest = 0, ready = false, lastTime = 0, ambientTime = 0;
  let entryProgress = 0, entryFrom = 0, entryTarget = 0, entryStart = 0;
  let focus: string | null = null, hover: string | null = null;
  let targetRotation = 0, currentRotation = 0, scroll = 0;
  let pointerX = 0, pointerY = 0, currentPointerX = 0, currentPointerY = 0;
  let isDragging = false, pointerDownX = 0, pointerDownY = 0, lastPointerX = 0;
  let moved = false, routeBlend = 1;
  const cameraOutside = new THREE.Vector3();
  const targetOutside = new THREE.Vector3();
  const cameraInside = new THREE.Vector3(0, 2.6, 5.1);
  const targetInside = new THREE.Vector3(0, 2.25, -12);
  const routeTarget = new THREE.Vector3(0, 2.25, -12);
  const currentTarget = new THREE.Vector3();
  const previousCamera = new THREE.Vector3();
  const previousTarget = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const projectVector = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const cadence = createFrameCadence(60);
  type Travel = {
    start: number; from: THREE.Vector3; targetFrom: THREE.Vector3; to: THREE.Vector3; targetTo: THREE.Vector3;
    fromFov: number; done: (() => void) | null; settled: boolean;
  };
  let travel: Travel | null = null;

  function cancelTravel() {
    if (!travel) return;
    travel.done = null; travel = null;
    previousCamera.copy(camera.position); previousTarget.copy(currentTarget);
    routeBlend = state.reducedMotion ? 1 : 0;
    camera.fov = mobile ? 58 : 46; camera.updateProjectionMatrix();
    requestFrame();
  }

  function requestFrame() {
    if (!disposed && !contextUnavailable && !frameRequest && !document.hidden && !state.paused) frameRequest = requestAnimationFrame(draw);
  }
  function resize() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight); mobile = width < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    if (!travel) camera.fov = mobile ? 58 : 46;
    camera.updateProjectionMatrix();
    requestFrame();
  }
  function draw(time: number) {
    frameRequest = 0;
    if (disposed || contextUnavailable || state.paused || document.hidden) return;
    if (!cadence.ready(time)) { requestFrame(); return; }
    const dt = Math.min(.05, lastTime ? (time - lastTime) / 1000 : .016); lastTime = time;
    const ease = state.reducedMotion ? 1 : 1 - Math.exp(-dt * 7.5);
    if (entryProgress !== entryTarget) {
      const t = clamp((time - entryStart) / 1850, 0, 1);
      entryProgress = THREE.MathUtils.lerp(entryFrom, entryTarget, smooth(t));
      if (t === 1) entryProgress = entryTarget;
    }
    routeBlend = Math.min(1, routeBlend + dt / .95);
    currentPointerX += (pointerX - currentPointerX) * ease;
    currentPointerY += (pointerY - currentPointerY) * ease;
    currentRotation += (targetRotation - currentRotation) * ease;
    const ambient = !travel && !state.reducedMotion && (state.room === 'home' || state.room === 'atrium') && scroll < .22;
    if (ambient) ambientTime += dt;

    cameraOutside.set(mobile ? 0 : -3.8, mobile ? 3.3 : 3.7, mobile ? 27.5 : 23);
    targetOutside.set(mobile ? 0 : -6.6, mobile ? 4.2 : 3.2, 1);
    const angle = currentRotation;
    cameraInside.set(Math.sin(angle) * 6.4, 2.65 + scroll * .65, 5.1 + (1 - Math.cos(angle)) * 2.5 - scroll * 1.25);
    targetInside.copy(routeTarget);
    // Existing route content remains central; architecture turns only enough
    // to convey travelling to another part of the same building.
    targetInside.x += Math.sin(angle) * 6;
    desiredCamera.lerpVectors(cameraOutside, cameraInside, entryProgress);
    desiredTarget.lerpVectors(targetOutside, targetInside, entryProgress);
    if (!state.reducedMotion) {
      desiredCamera.x += currentPointerX * .27;
      desiredCamera.y += currentPointerY * .13;
      desiredTarget.x += currentPointerX * .13;
    }
    let completeTravel: (() => void) | null = null;
    if (travel) {
      const progress = state.reducedMotion ? 1 : clamp((time - travel.start) / 850, 0, 1);
      const eased = smooth(progress);
      camera.position.lerpVectors(travel.from, travel.to, eased);
      currentTarget.lerpVectors(travel.targetFrom, travel.targetTo, eased);
      camera.fov = THREE.MathUtils.lerp(travel.fromFov, mobile ? 54 : 42, eased);
      camera.updateProjectionMatrix();
      if (progress === 1 && !travel.settled) {
        travel.settled = true; completeTravel = travel.done; travel.done = null;
      }
    } else if (routeBlend < 1 && entryProgress === entryTarget) {
      camera.position.lerpVectors(previousCamera, desiredCamera, smooth(routeBlend));
      currentTarget.lerpVectors(previousTarget, desiredTarget, smooth(routeBlend));
    } else { camera.position.copy(desiredCamera); currentTarget.copy(desiredTarget); }
    camera.lookAt(currentTarget);
    camera.updateMatrixWorld();
    instrument.rotation.y = ambientTime * .065;
    instrument.position.y = 2.25 + (state.reducedMotion ? 0 : Math.sin(ambientTime * .7) * .055);
    orbitSignal.rotation.z = ambientTime * .09;
    entrySignal.rotation.z = -.26 + entryProgress * .65;
    for (let index = 0; index < entryBlades.length; index++) {
      entryBlades[index].rotation.z = index / 12 * Math.PI * 2 + entryProgress * .18;
      entryBlades[index].scale.setScalar(1 + entryProgress * .085);
    }
    let screenMoving = false;
    screens.forEach(screen => {
      const active = screen.portal.id === (focus || hover || state.room);
      screen.light.opacity = active ? 1 : .44;
      const wantedScale = active ? 1.035 : 1;
      const nextScale = THREE.MathUtils.lerp(screen.group.scale.x, wantedScale, ease);
      screen.group.scale.setScalar(nextScale);
      if (Math.abs(nextScale - wantedScale) > .0005) screenMoving = true;
    });
    renderer.render(scene, camera);
    if (options.onProject) {
      const positions = screens.map(screen => {
        projectVector.copy(screen.marker).applyMatrix4(screen.group.matrixWorld).project(camera);
        return { id: screen.portal.id, x: (projectVector.x * .5 + .5) * width, y: (-projectVector.y * .5 + .5) * height,
          visible: state.entered && entryProgress > .92 && projectVector.z < 1 && projectVector.z > -1 && Math.abs(projectVector.x) < 1.06 && Math.abs(projectVector.y) < .98 };
      });
      options.onProject(positions);
    }
    if (!ready) { ready = true; options.onReady(); }
    // Navigation fires only after the final camera frame is presented. Keep
    // that composition until route state arrives, avoiding a one-frame jump.
    if (completeTravel) completeTravel();
    const stillMoving = (travel ? !travel.settled : entryProgress !== entryTarget || routeBlend < 1) || screenMoving || Math.abs(targetRotation - currentRotation) > .0003 || Math.abs(pointerX - currentPointerX) + Math.abs(pointerY - currentPointerY) > .002;
    if (ambient || stillMoving) requestFrame();
  }

  function intersect(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(hitTargets, false)[0]?.object.userData.portalId as string | undefined;
  }
  function pointerMove(event: PointerEvent) {
    if (state.paused) return;
    pointerX = event.clientX / width * 2 - 1; pointerY = 1 - event.clientY / height * 2;
    if (isDragging && state.entered) {
      if (Math.abs(event.clientX - pointerDownX) + Math.abs(event.clientY - pointerDownY) > 7) moved = true;
      if (moved && Math.abs(event.clientX - pointerDownX) > Math.abs(event.clientY - pointerDownY)) {
        targetRotation = clamp(targetRotation - (event.clientX - lastPointerX) * .0019, -.9, .9);
      }
      lastPointerX = event.clientX;
    } else if (state.entered) {
      const nextHover = intersect(event) || null;
      if (nextHover !== hover) { hover = nextHover; canvas.style.cursor = hover ? 'pointer' : 'grab'; }
    }
    requestFrame();
  }
  function pointerDown(event: PointerEvent) {
    if (!state.entered || state.paused || event.button !== 0) return;
    cancelTravel();
    isDragging = true; moved = false; pointerDownX = lastPointerX = event.clientX; pointerDownY = event.clientY;
    canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
  }
  function pointerUp(event: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = 'grab';
    if (!moved && event.type !== 'pointercancel') {
      const selected = intersect(event); if (selected) options.onSelect(selected);
    }
    requestFrame();
  }
  function pointerLeave() { pointerX = pointerY = 0; hover = null; requestFrame(); }
  function visibility() { lastTime = 0; cadence.reset(); if (document.hidden) { cancelAnimationFrame(frameRequest); frameRequest = 0; } else requestFrame(); }
  function contextLost(event: Event) {
    event.preventDefault();
    // A queued navigation must remain usable even if its visual path fails.
    const complete = travel?.done; if (travel) travel.done = null; travel = null;
    contextUnavailable = true;
    cancelAnimationFrame(frameRequest); frameRequest = 0;
    options.onUnavailable();
    complete?.();
  }
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('pointerleave', pointerLeave);
  canvas.addEventListener('webglcontextlost', contextLost);
  document.addEventListener('visibilitychange', visibility);
  const observer = new ResizeObserver(resize); observer.observe(host); resize();

  return {
    setState(next) {
      if (disposed) return;
      const roomChanged = state.room !== next.room;
      const entryChanged = state.entered !== next.entered;
      if (roomChanged || entryChanged || next.paused) cancelTravel();
      if (entryChanged) {
        entryFrom = entryProgress; entryTarget = next.entered ? 1 : 0; entryStart = performance.now();
        if (next.reducedMotion) entryProgress = entryTarget;
      }
      if (roomChanged) {
        previousCamera.copy(camera.position); previousTarget.copy(currentTarget);
        // The first state often changes home -> atrium before the first frame.
        // There is no previous camera composition to travel from at that point.
        routeBlend = !ready || next.reducedMotion ? 1 : 0;
        const selected = screens.find(screen => screen.portal.id === next.room);
        routeTarget.set(selected ? selected.group.position.x * .4 : 0, 2.25, selected ? Math.min(-9, selected.group.position.z) : -12);
        targetRotation = 0;
      }
      state = { ...next };
      if (state.reducedMotion) { entryProgress = entryTarget; routeBlend = 1; }
      if (state.paused) { cancelAnimationFrame(frameRequest); frameRequest = 0; }
      else { lastTime = 0; cadence.reset(); requestFrame(); }
    },
    setFocus(id) { focus = id; requestFrame(); },
    setScroll(progress) { scroll = clamp(progress, 0, 1); requestFrame(); },
    rotate(delta) { cancelTravel(); targetRotation = clamp(targetRotation + delta, -.9, .9); requestFrame(); },
    travelTo(id, onComplete) {
      if (disposed) return;
      const selected = screens.find(screen => screen.portal.id === id);
      if (!selected || state.reducedMotion || contextUnavailable || !ready || state.paused) { cancelTravel(); onComplete(); return; }
      // Repeated choices replace the pending callback and begin at the actual
      // rendered camera. The endpoint always faces the front of the screen.
      if (travel) travel.done = null;
      const front = new THREE.Vector3(0, 0, 1).applyQuaternion(selected.group.quaternion);
      const destination = selected.group.position.clone().addScaledVector(front, mobile ? 5.9 : 5.1);
      destination.y += .12;
      travel = { start: performance.now(), from: camera.position.clone(), targetFrom: currentTarget.clone(),
        to: destination, targetTo: selected.group.position.clone(), fromFov: camera.fov, done: onComplete, settled: false };
      focus = id; hover = null; pointerX = pointerY = 0; requestFrame();
    },
    cancelTravel,
    destroy() {
      if (disposed) return;
      if (travel) travel.done = null; travel = null;
      disposed = true; cancelAnimationFrame(frameRequest); observer.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('pointerleave', pointerLeave); canvas.removeEventListener('webglcontextlost', contextLost);
      document.removeEventListener('visibilitychange', visibility);
      geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
      environment.dispose(); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
