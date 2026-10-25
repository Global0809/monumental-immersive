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
  destroy: () => void;
};

const INK = 0x080909;
const RED = 0xff4d32;
const LIGHT = 0xefeee9;
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
    return { setState() {}, setFocus() {}, setScroll() {}, rotate() {}, destroy() {} };
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
  renderer.toneMappingExposure = 1.16;
  renderer.setClearColor(INK, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.FogExp2(INK, .022);
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
  scene.environmentIntensity = 1.25;
  environmentScene.dispose();
  pmrem.dispose();

  const chrome = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xd6d8d5, metalness: 1, roughness: .19 }));
  const brushed = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x454947, metalness: .92, roughness: .3 }));
  // Architecture absorbs light; only the chrome instrument and portal rims
  // carry the bright room reflections. This keeps the set genuinely obsidian.
  const stone = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x0d100e, metalness: .12, roughness: .8, envMapIntensity: .08 }));
  const black = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x101312, toneMapped: false }));
  const red = ownMaterial(new THREE.MeshBasicMaterial({ color: RED, toneMapped: false }));
  const softWhite = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xb5b8ae, toneMapped: false }));
  const muted = ownMaterial(new THREE.LineBasicMaterial({ color: 0x29312d, transparent: true, opacity: .7 }));
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = scene) => {
    const result = new THREE.Mesh(geometry, material); parent.add(result); return result;
  };
  const boxGeometry = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const box = (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
    const result = mesh(boxGeometry, material, parent); result.scale.set(...size); result.position.set(...position); return result;
  };
  const torus = (radius: number, tube: number, material: THREE.Material, parent: THREE.Object3D = scene, arc = Math.PI * 2) =>
    mesh(ownGeometry(new THREE.TorusGeometry(radius, tube, 10, 112, arc)), material, parent);

  scene.add(new THREE.HemisphereLight(0xdfe8e5, 0x29221a, .65));
  const key = new THREE.DirectionalLight(0xf2f0e3, 1.8); key.position.set(-8, 12, 8); scene.add(key);
  const side = new THREE.DirectionalLight(0xc1d2d5, 1.6); side.position.set(10, 5, -15); scene.add(side);
  const signal = new THREE.PointLight(RED, 28, 24, 2); signal.position.set(0, 1.7, 4); scene.add(signal);

  // A continuous floor establishes the room's scale, with inlaid rails rather
  // than a floating starfield. Static linework is batched into one draw call.
  const floor = mesh(ownGeometry(new THREE.PlaneGeometry(72, 90)), ownMaterial(new THREE.MeshBasicMaterial({ color: 0x151918, toneMapped: false })));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.02, -12);
  const floorLines: number[] = [];
  for (let x = -24; x <= 24; x += 3) floorLines.push(x, -1, 22, x, -1, -43);
  for (let z = -40; z <= 22; z += 3) floorLines.push(-25, -1, z, 25, -1, z);
  const grid = ownGeometry(new THREE.BufferGeometry()); grid.setAttribute('position', new THREE.Float32BufferAttribute(floorLines, 3));
  scene.add(new THREE.LineSegments(grid, muted));
  for (const x of [-2.7, 2.7]) {
    box(scene, [.022, .012, 60], [x, -.985, -7], red);
    box(scene, [.09, .025, 60], [x - Math.sign(x) * .11, -1, -7], brushed);
  }
  for (let z = -25; z < 18; z += 2.8) box(scene, [5.4, .015, .025], [0, -.98, z], stone);

  // Outside, the visitor sees through a real opening into the collection.
  const entrance = new THREE.Group(); entrance.position.set(0, 4.4, 6.5); scene.add(entrance);
  const entryRings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const ring = torus(5.35 - i * .23, i === 0 ? .19 : .075, i % 2 ? brushed : chrome, entrance);
    ring.position.z = -i * .72; entryRings.push(ring);
  }
  const entrySignal = torus(4.79, .022, red, entrance, Math.PI * 1.22);
  entrySignal.rotation.z = -.09;
  entrySignal.position.z = -1.42;
  const entryLight = torus(5.54, .014, softWhite, entrance, Math.PI * .85);
  entryLight.rotation.z = Math.PI * .08;
  for (const direction of [-1, 1]) {
    box(scene, [.8, 10.3, 1.3], [direction * 5.8, 4.12, 6.5], black);
    box(scene, [.045, 8.1, .055], [direction * 5.35, 4.5, 7.18], red);
    box(scene, [2.4, .4, 4.1], [direction * 5.7, -.81, 6.4], brushed);
  }

  // Repeated structural ribs read as an inhabited architectural space. The
  // center remains open for the existing sculpture and page content.
  const ribGeometry = ownGeometry(new THREE.TorusGeometry(13.4, .105, 6, 64, Math.PI));
  for (const z of [-4, -12, -20, -28]) {
    const rib = mesh(ribGeometry, brushed); rib.position.set(0, -.8, z);
    const crown = box(scene, [18, .045, .045], [0, 10.8, z - .08], softWhite);
    crown.material = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x424e46, toneMapped: false }));
    for (const x of [-12.7, 12.7]) box(scene, [.27, 9, .38], [x, 3.5, z], black);
  }
  box(scene, [34, 16, .9], [0, 5.7, -31], black);
  for (const x of [-15.5, 15.5]) box(scene, [.6, 15, 40], [x, 6, -12], black);
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
    sign.position.set(0, 7.6, -30.51);
  }

  // Suspended gyroscopic instrument: broad metal, reflected environment, and
  // a physical plinth make this an object rather than an icon in a canvas.
  const instrument = new THREE.Group(); instrument.position.set(0, 2.25, -11.7); scene.add(instrument);
  const instrumentRings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const ring = torus(1.62 + i * .18, i === 0 ? .14 : .075, i === 2 ? brushed : chrome, instrument);
    ring.rotation.set(.48 + i * .45, .2 + i * .66, i * .52);
    ring.scale.y = 1.16; instrumentRings.push(ring);
  }
  const orbitSignal = torus(2.34, .017, red, instrument, Math.PI * 1.4); orbitSignal.rotation.x = 1.1;
  const core = mesh(ownGeometry(new THREE.IcosahedronGeometry(.55, 1)), chrome, instrument);
  core.rotation.set(.2, .5, .7);
  const plinth = mesh(ownGeometry(new THREE.CylinderGeometry(2.8, 3.15, .32, 64)), black);
  plinth.position.set(0, -.82, -11.7);
  const plinthLip = torus(2.85, .025, red); plinthLip.rotation.x = Math.PI / 2; plinthLip.position.set(0, -.65, -11.7);
  const groundHalo = torus(4.1, .016, brushed); groundHalo.rotation.x = Math.PI / 2; groundHalo.position.set(0, -.985, -11.7);
  const hanging = mesh(ownGeometry(new THREE.CylinderGeometry(.018, .018, 6.7, 6)), brushed);
  hanging.position.set(0, 7.2, -11.7);

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
  const screenGeometry = ownGeometry(new THREE.PlaneGeometry(3.44, 4.72));
  const frameGeometry = ownGeometry(new THREE.BoxGeometry(3.7, 5.06, .16));
  options.portals.slice(0, 6).forEach((portal, index) => {
    const group = new THREE.Group(); group.position.set(...portalCoordinates[index] as [number, number, number]);
    group.lookAt(0, 2.05, 4.5); scene.add(group);
    const frame = mesh(frameGeometry, chrome, group);
    const pictureMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x39473c, toneMapped: false }));
    const picture = mesh(screenGeometry, pictureMaterial, group); picture.position.z = .086;
    picture.userData.portalId = portal.id; hitTargets.push(picture);
    const highlight = ownMaterial(new THREE.MeshBasicMaterial({ color: RED, toneMapped: false, transparent: true, opacity: .7 }));
    box(group, [3.76, .036, .04], [0, -2.53, .1], highlight);
    box(group, [.032, 5.06, .04], [-1.86, 0, .1], highlight);
    box(group, [.04, 5.06, .04], [1.86, 0, .1], brushed);
    box(group, [3.95, .16, .9], [0, -2.94, 0], black);
    box(group, [.05, .55, .11], [0, -2.69, 0], chrome);
    const anchor = new THREE.Vector3(0, -2.65, .15); group.localToWorld(anchor);
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
      // Crop within the physical portrait window, never distort a film poster.
      const aspect = imageWidth / imageHeight;
      const frameAspect = 3.44 / 4.72;
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

  function requestFrame() {
    if (!disposed && !contextUnavailable && !frameRequest && !document.hidden && !state.paused) frameRequest = requestAnimationFrame(draw);
  }
  function resize() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight); mobile = width < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.fov = mobile ? 58 : 46; camera.updateProjectionMatrix();
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
    const ambient = !state.reducedMotion && (state.room === 'home' || state.room === 'atrium') && scroll < .22;
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
    if (routeBlend < 1 && entryProgress === entryTarget) {
      camera.position.lerpVectors(previousCamera, desiredCamera, smooth(routeBlend));
      currentTarget.lerpVectors(previousTarget, desiredTarget, smooth(routeBlend));
    } else { camera.position.copy(desiredCamera); currentTarget.copy(desiredTarget); }
    camera.lookAt(currentTarget);
    camera.updateMatrixWorld();
    instrument.rotation.y = ambientTime * .065;
    instrument.position.y = 2.25 + (state.reducedMotion ? 0 : Math.sin(ambientTime * .7) * .055);
    orbitSignal.rotation.z = ambientTime * .09;
    core.rotation.y = .5 + ambientTime * .13;
    entrySignal.rotation.z = -.09 + entryProgress * .9;
    for (let index = 0; index < entryRings.length; index++) {
      entryRings[index].scale.setScalar(1 + entryProgress * index * .018);
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
        projectVector.set(0, -2.65, .15).applyMatrix4(screen.group.matrixWorld).project(camera);
        return { id: screen.portal.id, x: (projectVector.x * .5 + .5) * width, y: (-projectVector.y * .5 + .5) * height,
          visible: state.entered && entryProgress > .92 && projectVector.z < 1 && projectVector.z > -1 && Math.abs(projectVector.x) < 1.06 && Math.abs(projectVector.y) < .98 };
      });
      options.onProject(positions);
    }
    if (!ready) { ready = true; options.onReady(); }
    const stillMoving = entryProgress !== entryTarget || routeBlend < 1 || screenMoving || Math.abs(targetRotation - currentRotation) > .0003 || Math.abs(pointerX - currentPointerX) + Math.abs(pointerY - currentPointerY) > .002;
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
    contextUnavailable = true;
    cancelAnimationFrame(frameRequest); frameRequest = 0;
    options.onUnavailable();
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
    rotate(delta) { targetRotation = clamp(targetRotation + delta, -.9, .9); requestFrame(); },
    destroy() {
      if (disposed) return;
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
