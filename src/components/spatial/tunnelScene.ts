import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { createFrameCadence } from '../../services/frameCadence';
import { getSpatialPreferences, subscribeSpatialPreferences } from '../../services/spatialPreferences';
import {
  getTunnelFrame, getTunnelPanels, subscribeTunnelFrame, subscribeTunnelPanels,
  tunnelCompact, tunnelReadingZ, tunnelStationZ, TUNNEL_STATION_IDS,
  type TunnelPanelBinding,
} from '../../services/tunnelJourney';
import { createAtmosphere } from './atmosphere';
import { cameraEase } from './cameraPath';
import type { SpatialSceneController, SpatialSceneOptions, SpatialSceneState } from './scene';

const INK = 0x080909, RED = 0xff4d32;
const clamp = (value: number, min = 0, max = 1) => THREE.MathUtils.clamp(value, min, max);
const lerp = THREE.MathUtils.lerp;
const asset = (url: string) => {
  const base = import.meta.env.BASE_URL;
  return url.startsWith('/') && !url.startsWith('//') && !(base !== '/' && url.startsWith(base)) ? `${base}${url.slice(1)}` : url;
};

type Panel = {
  binding: TunnelPanelBinding; object: CSS3DObject; attached: boolean; visible: boolean;
  style: string | null; inert: boolean; aria: string | null; draggable: string | null;
  carrier: THREE.Group; corners: THREE.Group[]; worldHeight: number;
  spatialTransform: string;
};
type Travel = { from: THREE.Vector3; to: THREE.Vector3; start: number; duration: number; room: string; done: (() => void) | null; settled: boolean };

/** One camera renders both the building and its real, accessible HTML exhibits.
 * Native document scroll supplies world coordinates; the scene never owns scrolling. */
export function createTunnelScene(host: HTMLElement, options: SpatialSceneOptions): SpatialSceneController {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: innerWidth >= 980, powerPreference: 'high-performance' });
  } catch {
    options.onUnavailable();
    return { setState() {}, setFocus() {}, setScroll() {}, rotate() {}, travelTo(_id, done) { done(); }, cancelTravel() {}, destroy() {} };
  }
  let disposed = false, unavailable = false, ready = false;
  let state: SpatialSceneState = { entered: false, room: 'atrium', paused: false, reducedMotion: options.reducedMotion };
  let frame = getTunnelFrame(), preferences = getSpatialPreferences();
  let width = 1, height = 1, compact = false, ratio = 1;
  let frameRequest = 0, lastTime = 0, elapsed = 0, innerScroll = 0, focus: string | null = null;
  let pointerX = 0, pointerY = 0, currentX = 0, currentY = 0, rotation = 0;
  let travel: Travel | null = null;
  let performanceAverage = 16.7, performanceSamples = 0, adaptiveReduction = 0;
  const cadence = createFrameCadence();
  const canvas = renderer.domElement;
  canvas.className = 'spatial-world-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', touchAction: 'pan-y', pointerEvents: 'none' });
  host.appendChild(canvas);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.setClearColor(INK, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.FogExp2(INK, .014);
  const camera = new THREE.PerspectiveCamera(46, 1, .12, 130);
  camera.position.set(0, 0, frame.z);
  const look = new THREE.Vector3();
  const cssScene = new THREE.Scene();
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.domElement.className = 'tunnel-css-world';
  Object.assign(cssRenderer.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none', overflow: 'hidden', zIndex: '1' });
  // Keep the single semantic copy inside the main landmark. Native modal and
  // navigation inertness then cover the spatial controls as well as ordinary DOM.
  (document.getElementById('main') || host).appendChild(cssRenderer.domElement);

  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const geometry = <T extends THREE.BufferGeometry>(value: T) => { geometries.add(value); return value; };
  const material = <T extends THREE.Material>(value: T) => { materials.add(value); return value; };
  const mesh = (shape: THREE.BufferGeometry, surface: THREE.Material, parent: THREE.Object3D = scene) => {
    const value = new THREE.Mesh(shape, surface); parent.add(value); return value;
  };
  const boxShape = geometry(new THREE.BoxGeometry(1, 1, 1));
  const box = (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], surface: THREE.Material) => {
    const value = mesh(boxShape, surface, parent); value.scale.set(...size); value.position.set(...position); return value;
  };
  const torus = (parent: THREE.Object3D, radius: number, tube: number, surface: THREE.Material, arc = Math.PI * 2, segments = 72) =>
    mesh(geometry(new THREE.TorusGeometry(radius, tube, 8, segments, arc)), surface, parent);

  const roomEnvironment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(roomEnvironment, .045);
  roomEnvironment.dispose(); pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = .8;
  const chrome = material(new THREE.MeshStandardMaterial({ color: 0xdce0dc, metalness: .99, roughness: .18 }));
  const satin = material(new THREE.MeshStandardMaterial({ color: 0x515a55, metalness: .94, roughness: .32 }));
  const graphite = material(new THREE.MeshStandardMaterial({ color: 0x121513, metalness: .72, roughness: .4 }));
  const floorSurface = material(new THREE.MeshBasicMaterial({ color: 0x090b0a, toneMapped: false }));
  const signal = material(new THREE.MeshBasicMaterial({ color: RED, toneMapped: false }));
  const ivory = material(new THREE.MeshBasicMaterial({ color: 0x9caaa0, transparent: true, opacity: .48, toneMapped: false }));
  const seams = material(new THREE.LineBasicMaterial({ color: 0x58645b, transparent: true, opacity: .23, depthWrite: false }));
  scene.add(new THREE.HemisphereLight(0xe4e9e0, 0x1c1915, .75));
  const key = new THREE.DirectionalLight(0xf2efe7, 3.1); key.position.set(-4, 7, 8); scene.add(key);
  const fill = new THREE.DirectionalLight(0xc5d1d0, 1.7); fill.position.set(7, -1, -9); scene.add(fill);
  const movingLight = new THREE.PointLight(0xe6e4dc, 34, 37, 2); scene.add(movingLight);
  const redLight = new THREE.PointLight(RED, 12, 23, 2); scene.add(redLight);

  // A bounded instanced shell is substantially cheaper than a room-sized collection
  // of independent rings. The small twists create depth without a rotating viewport.
  const architecture = new THREE.Group(); scene.add(architecture);
  const ribShape = geometry(new THREE.TorusGeometry(8.35, .058, 6, 72));
  const ribs: THREE.InstancedMesh<THREE.TorusGeometry, THREE.Material> = new THREE.InstancedMesh(ribShape, satin, 78);
  const ribMatrix = new THREE.Object3D();
  for (let i = 0; i < 78; i++) {
    ribMatrix.position.set(Math.sin(i * .17) * .2, 0, 16 - i * 3.15);
    ribMatrix.rotation.set(0, 0, i * .025);
    ribMatrix.scale.set(1, .81 + Math.sin(i * .21) * .025, 1);
    ribMatrix.updateMatrix(); ribs.setMatrixAt(i, ribMatrix.matrix);
  }
  ribs.instanceMatrix.needsUpdate = true; architecture.add(ribs);
  // Broad broken ribs catch light as separate machined surfaces. They are
  // instanced from one beveled segment, with open gaps framing the exhibits.
  const ribProfile = new THREE.Shape();
  ribProfile.absarc(0, 0, 8.6, 0, 1.26, false);
  ribProfile.lineTo(Math.cos(1.26) * 8.22, Math.sin(1.26) * 8.22);
  ribProfile.absarc(0, 0, 8.22, 1.26, 0, true); ribProfile.closePath();
  const structuralShape = geometry(new THREE.ExtrudeGeometry(ribProfile, {
    depth: .32, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .032, bevelThickness: .035, curveSegments: 20,
  }));
  const structuralRibs = new THREE.InstancedMesh(structuralShape, chrome, 26 * 3);
  const ribColor = new THREE.Color();
  for (let i = 0; i < 26; i++) for (let side = 0; side < 3; side++) {
    ribMatrix.position.set(Math.sin(i * .43) * .18, 0, 13 - i * 9.45);
    ribMatrix.rotation.set(0, 0, side * Math.PI * 2 / 3 + i * .081 + .12);
    ribMatrix.scale.set(1, .8, 1); ribMatrix.updateMatrix();
    structuralRibs.setMatrixAt(i * 3 + side, ribMatrix.matrix);
    structuralRibs.setColorAt(i * 3 + side, ribColor.setHex((i + side) % 4 === 0 ? 0x474d49 : 0xc5cbc6));
  }
  structuralRibs.instanceMatrix.needsUpdate = true; architecture.add(structuralRibs);
  const struts = new THREE.InstancedMesh(boxShape, graphite, 26 * 4);
  for (let i = 0; i < 26; i++) for (let j = 0; j < 4; j++) {
    const a = j / 4 * Math.PI * 2 + Math.PI / 4;
    ribMatrix.position.set(Math.cos(a) * 7.7, Math.sin(a) * 6.1, 13 - i * 9.45);
    ribMatrix.rotation.set(0, 0, a);
    ribMatrix.scale.set(.36, .18, 1.1); ribMatrix.updateMatrix(); struts.setMatrixAt(i * 4 + j, ribMatrix.matrix);
  }
  struts.instanceMatrix.needsUpdate = true; architecture.add(struts);
  for (let rail = 0; rail < 8; rail++) {
    const points: THREE.Vector3[] = [];
    for (let step = 0; step < 64; step++) {
      const a = rail / 8 * Math.PI * 2 + step * .0135 + Math.sin(step * .075) * .1;
      points.push(new THREE.Vector3(Math.cos(a) * 8.2, Math.sin(a) * 6.55, 18 - step * 4));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    mesh(geometry(new THREE.TubeGeometry(curve, 128, rail % 4 === 1 ? .023 : .038, 4, false)), rail % 4 === 1 ? signal : satin, architecture);
  }
  // The floor has a few long inlays, never a dense wire grid behind the copy.
  const floor = mesh(geometry(new THREE.PlaneGeometry(18, 270)), floorSurface, architecture);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -5.65, -108);
  for (const x of [-5.7, -3, 3, 5.7]) box(architecture, [.014, .01, 260], [x, -5.635, -108], ivory);
  box(architecture, [.023, .012, 260], [-.12, -5.63, -108], signal);
  box(architecture, [.023, .012, 260], [.12, -5.63, -108], signal);
  const seamPoints: number[] = [];
  for (let i = 0; i < 50; i++) seamPoints.push(-7.3, -5.625, 18 - i * 5.1, 7.3, -5.625, 18 - i * 5.1);
  const seamShape = geometry(new THREE.BufferGeometry()); seamShape.setAttribute('position', new THREE.Float32BufferAttribute(seamPoints, 3));
  architecture.add(new THREE.LineSegments(seamShape, seams));

  const entrance = new THREE.Group(); entrance.position.set(3.25, .1, -11.5); entrance.scale.setScalar(1.32); scene.add(entrance);
  const irisBlades: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const blade = torus(entrance, 2.2 - i * .055, .17, chrome, Math.PI * 1.68);
    blade.rotation.set(i * .115, i * .15, i * Math.PI * .285);
    blade.position.z = (i - 3) * .21; irisBlades.push(blade);
  }
  const irisSignal = torus(entrance, 2.6, .026, signal, Math.PI * .63); irisSignal.rotation.z = -.85;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const clasp = box(entrance, [.16, .52, .32], [Math.cos(a) * 2.6, Math.sin(a) * 2.6, -.35], satin);
    clasp.rotation.z = a;
  }
  const axis = box(entrance, [.028, 5.65, .028], [0, 0, -.6], satin); axis.rotation.z = .46;

  type Station = { root: THREE.Group; moving: THREE.Group; marker: THREE.Mesh; picture?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; loaded?: boolean };
  const stations: Station[] = [];
  const cageShape = geometry(new THREE.IcosahedronGeometry(1.55, 1));
  const cageEdges = geometry(new THREE.EdgesGeometry(cageShape));
  const cageLine = material(new THREE.LineBasicMaterial({ color: 0xa7b4aa, transparent: true, opacity: .5 }));
  const loader = new THREE.TextureLoader();
  for (let index = 0; index < TUNNEL_STATION_IDS.length; index++) {
    const side = index % 2 === 0 ? 1 : -1;
    const root = new THREE.Group(); root.position.set(side * 3.85, -.05, tunnelStationZ(index) - .5); scene.add(root);
    const moving = new THREE.Group(); root.add(moving);
    const marker = torus(root, 2.8, .022, signal, Math.PI * .42); marker.rotation.z = index * .75 + .1;
    const halo = torus(root, 2.8, .025, satin); halo.rotation.x = .1;
    const base = torus(root, 1.7, .045, satin); base.rotation.x = Math.PI / 2; base.position.y = -2.8;
    box(root, [.03, .03, 1.8], [0, -2.8, -.8], signal);
    let picture: Station['picture'];
    if (index === 0) {
      moving.add(new THREE.LineSegments(cageEdges, cageLine));
      mesh(cageShape, graphite, moving);
      for (let i = 0; i < 5; i++) {
        const ring = torus(moving, 1.95 + i * .11, .065, i === 3 ? signal : chrome);
        ring.rotation.set(i * .47, .3 + i * .35, i * .34);
      }
      const nodeShape = geometry(new THREE.SphereGeometry(.065, 8, 8));
      for (let i = 0; i < 9; i++) {
        const angle = i / 9 * Math.PI * 2, node = mesh(nodeShape, signal, moving);
        node.position.set(Math.cos(angle) * 1.7, Math.sin(angle) * 1.3, Math.sin(angle * 2) * 1.2);
      }
    } else if (index === 1) {
      for (let i = 0; i < 8; i++) {
        const frameGroup = new THREE.Group(); moving.add(frameGroup);
        const size = 3.7 - i * .19;
        for (const x of [-size / 2, size / 2]) box(frameGroup, [.09, size, .13], [x, 0, 0], i === 6 ? signal : chrome);
        for (const y of [-size / 2, size / 2]) box(frameGroup, [size, .09, .13], [0, y, 0], i === 6 ? signal : chrome);
        frameGroup.position.z = -i * .32; frameGroup.rotation.z = -.25 + i * .09;
      }
      moving.rotation.set(.12, -.2, .08);
    } else if (index === 2) {
      for (let i = 0; i < 4; i++) {
        const reel = torus(moving, 1.95 - i * .32, .06, i === 0 ? chrome : satin);
        reel.rotation.set(.2, -.4, 0); reel.position.z = -.4 - i * .1;
      }
      const imageMaterial = material(new THREE.MeshBasicMaterial({ color: 0x343a36, toneMapped: false, side: THREE.DoubleSide }));
      picture = new THREE.Mesh(geometry(new THREE.PlaneGeometry(4.1, 2.3)), imageMaterial);
      picture.rotation.set(-.04, -.18, .035); picture.position.z = .3; moving.add(picture);
      const surround = new THREE.Group(); surround.rotation.copy(picture.rotation); surround.position.copy(picture.position); moving.add(surround);
      for (const x of [-2.13, 2.13]) box(surround, [.12, 2.5, .15], [x, 0, 0], chrome);
      for (const y of [-1.24, 1.24]) box(surround, [4.36, .12, .15], [0, y, 0], chrome);
      for (let i = 0; i < 11; i++) for (const y of [-1.24, 1.24]) box(surround, [.14, .064, .01], [-1.88 + i * .376, y, .082], graphite);
    } else if (index === 3) {
      const columnShape = geometry(new THREE.CylinderGeometry(.075, .075, 1, 8));
      for (let i = 0; i < 27; i++) {
        const a = i / 27 * Math.PI * 2;
        const bar = mesh(columnShape, i % 7 === 0 ? signal : chrome, moving);
        bar.position.set(Math.cos(a) * 1.8, 0, Math.sin(a) * 1.8);
        bar.scale.y = 1 + (Math.sin(a * 3.4) * .5 + .5) * 2.5;
      }
      const orbit = torus(moving, 2.25, .04, satin); orbit.rotation.x = Math.PI / 2;
      moving.rotation.z = -.15;
    } else if (index === 4) {
      for (let i = 0; i < 12; i++) {
        const fold = box(moving, [.11, 3.5, 1.5], [(i - 5.5) * .3, Math.sin(i * .6) * .38, Math.cos(i * .5) * .55], i === 7 ? signal : chrome);
        fold.rotation.set(.08, (i - 5.5) * .135, -.27);
      }
      moving.rotation.set(.15, -.18, .08);
    } else {
      for (let i = 0; i < 6; i++) {
        const shape = torus(moving, 1.2 + i * .15, .11, i === 2 ? signal : chrome, Math.PI * 1.65);
        shape.rotation.set(i * .23, .3 + i * .39, i * .8);
        shape.position.y = (i - 2.5) * .23;
      }
      const pedestal = mesh(geometry(new THREE.CylinderGeometry(1.7, 2, .32, 32)), graphite, root); pedestal.position.y = -2.7;
    }
    stations.push({ root, moving, marker, picture });
  }
  const atmosphere = createAtmosphere(); scene.add(atmosphere.points);

  const panels = new Map<string, Panel>();
  const panelObserver = new ResizeObserver(entries => {
    for (const entry of entries) for (const panel of panels.values()) if (panel.binding.element === entry.target) {
      panel.worldHeight = (panel.binding.element.offsetHeight || 660) * .0117;
    }
    requestFrame();
  });
  function restorePanel(panel: Panel) {
    const { element, fallback } = panel.binding;
    if (panel.attached) {
      // CSS3DRenderer caches this matrix string by object identity. Preserve it
      // across flow mode, because a return at the same station may not rewrite it.
      panel.spatialTransform = element.style.transform;
      cssScene.remove(panel.object); fallback.appendChild(element);
    }
    if (panel.style === null) element.removeAttribute('style'); else element.setAttribute('style', panel.style);
    element.inert = panel.inert;
    if (panel.aria === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', panel.aria);
    if (panel.draggable === null) element.removeAttribute('draggable'); else element.setAttribute('draggable', panel.draggable);
    element.removeAttribute('data-tunnel-mounted'); panel.attached = false; panel.visible = true;
  }
  function syncPanels() {
    const spatial = !compact && !state.reducedMotion && !unavailable;
    for (const panel of panels.values()) {
      const element = panel.binding.element;
      if (!spatial) { if (panel.attached) restorePanel(panel); continue; }
      if (!panel.attached) {
        element.dataset.tunnelMounted = 'true';
        Object.assign(element.style, { position: 'absolute', pointerEvents: 'auto', userSelect: 'text', width: '620px' });
        if (panel.spatialTransform) element.style.transform = panel.spatialTransform;
        panel.object.scale.setScalar(.0117);
        cssScene.add(panel.object); panel.attached = true;
        // CSS3DRenderer will move the actual DOM node during this render.
      }
    }
    cssRenderer.domElement.style.display = spatial ? '' : 'none';
  }
  function registerPanels(bindings: TunnelPanelBinding[]) {
    const active = new Set(bindings.map(binding => binding.id));
    for (const [id, panel] of panels) if (!active.has(id) || bindings.find(binding => binding.id === id)?.element !== panel.binding.element) {
      panelObserver.unobserve(panel.binding.element); restorePanel(panel); scene.remove(panel.carrier); panels.delete(id);
    }
    for (const binding of bindings) {
      if (panels.has(binding.id)) continue;
      const element = binding.element;
      const original = { style: element.getAttribute('style'), inert: element.inert, aria: element.getAttribute('aria-hidden'), draggable: element.getAttribute('draggable') };
      const object = new CSS3DObject(element);
      const side = binding.index % 2 === 0 ? -1 : 1;
      object.position.set(side * 3.15, .12, tunnelStationZ(binding.index));
      object.rotation.y = -side * .065;
      const carrier = new THREE.Group(); scene.add(carrier);
      const corners: THREE.Group[] = [];
      for (let i = 0; i < 4; i++) {
        const corner = new THREE.Group(); carrier.add(corner);
        const x = i % 2 === 0 ? -1 : 1, y = i < 2 ? -1 : 1;
        box(corner, [.62, .055, .1], [-x * .28, 0, 0], chrome);
        box(corner, [.055, .62, .1], [0, -y * .28, 0], chrome);
        box(corner, [.17, .017, .11], [-x * .07, 0, .015], signal);
        corners.push(corner);
      }
      carrier.visible = false;
      panels.set(binding.id, { binding, object, attached: false, visible: true, carrier, corners, worldHeight: 7.7, spatialTransform: '', ...original });
      panelObserver.observe(element);
      // Constructor styles must not leak into the accessible mobile fallback.
      if (compact || state.reducedMotion) restorePanel(panels.get(binding.id)!);
    }
    syncPanels();
    for (const panel of panels.values()) if (panel.attached) panel.worldHeight = (panel.binding.element.offsetHeight || 660) * .0117;
    requestFrame();
  }
  function updatePanels() {
    // Native modal playback already makes its background inert. Keep the
    // opener's last DOM state intact so dialog close can restore focus before
    // React's unpause effect runs; the entire renderer remains stopped.
    if (state.paused) return;
    if (compact || state.reducedMotion) { panels.forEach(panel => { panel.carrier.visible = false; }); return; }
    for (const panel of panels.values()) {
      if (!panel.attached) continue;
      const delta = camera.position.z - tunnelStationZ(panel.binding.index);
      const isVisible = state.room === 'atrium' && delta > 5.5 && delta < 38;
      const readable = isVisible && delta < 27 && delta > 7.8 && !travel && document.documentElement.dataset.spatialPassage !== 'departing';
      const element = panel.binding.element;
      panel.carrier.visible = isVisible;
      if (panel.visible !== isVisible) {
        element.style.visibility = isVisible ? 'visible' : 'hidden'; panel.visible = isVisible;
      }
      if (element.inert !== !readable) element.inert = !readable;
      const aria = readable ? 'false' : 'true'; if (element.getAttribute('aria-hidden') !== aria) element.setAttribute('aria-hidden', aria);
      if (!isVisible) continue;
      const approach = clamp((32 - delta) / 12);
      const departure = clamp((delta - 5.5) / 3.5);
      element.style.opacity = `${Math.min(approach, departure)}`;
      const side = panel.binding.index % 2 === 0 ? -1 : 1;
      panel.object.rotation.y = -side * (.065 + (1 - approach) * .22);
      element.style.setProperty('--tunnel-arrival', `${approach}`);
      panel.carrier.position.copy(panel.object.position); panel.carrier.position.z -= .06;
      panel.carrier.rotation.copy(panel.object.rotation);
      const extension = cameraEase(approach), halfWidth = 3.682, halfHeight = panel.worldHeight / 2 + .055;
      panel.corners.forEach((corner, index) => {
        corner.position.set((index % 2 === 0 ? -1 : 1) * lerp(halfWidth * .62, halfWidth, extension),
          (index < 2 ? -1 : 1) * lerp(.5, halfHeight, extension), 0);
      });
    }
  }

  function requestFrame() {
    if (!frameRequest && !disposed && !unavailable && !state.paused && !document.hidden) frameRequest = requestAnimationFrame(render);
  }
  function resize() {
    if (disposed) return;
    const bounds = host.getBoundingClientRect(); width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
    compact = tunnelCompact(width, height, state.reducedMotion);
    const cap = compact ? 1.1 : preferences.quality === 'light' ? 1 : 1.4;
    ratio = Math.max(.8, Math.min(devicePixelRatio || 1, cap) - adaptiveReduction);
    renderer.setPixelRatio(ratio); renderer.setSize(width, height, false);
    cssRenderer.setSize(width, height);
    camera.aspect = width / height; camera.fov = compact ? 57 : 46; camera.updateProjectionMatrix();
    atmosphere.configure(height, ratio, compact, preferences.quality, preferences.light);
    syncPanels(); requestFrame();
  }
  function updatePreferences() {
    const previous = preferences; preferences = getSpatialPreferences();
    ribs.material = preferences.cutaway ? ivory : satin;
    structuralRibs.visible = !preferences.cutaway;
    struts.visible = !preferences.cutaway;
    floor.visible = !preferences.cutaway;
    key.intensity = 1.9 + preferences.light * .022;
    scene.environmentIntensity = .5 + preferences.light * .006;
    if (previous.quality !== preferences.quality) { adaptiveReduction = 0; resize(); }
    atmosphere.configure(height, ratio, compact, preferences.quality, preferences.light);
    requestFrame();
  }
  function cancelTravel() { if (travel) travel.done = null; travel = null; requestFrame(); }
  function roomZ(room: string) {
    const index = TUNNEL_STATION_IDS.indexOf(room as typeof TUNNEL_STATION_IDS[number]);
    return index < 0 ? getTunnelFrame().z : tunnelReadingZ(index);
  }
  function render(time: number) {
    frameRequest = 0;
    if (disposed || unavailable || state.paused || document.hidden) return;
    if (!cadence.ready(time)) { requestFrame(); return; }
    const rawDt = lastTime ? time - lastTime : 16.7, dt = Math.min(rawDt / 1000, .05); lastTime = time;
    if (!state.reducedMotion) elapsed += dt;
    if (rawDt < 90) { performanceAverage = lerp(performanceAverage, rawDt, .025); performanceSamples++; }
    if (performanceSamples > 170 && performanceAverage > 24 && adaptiveReduction < .3) {
      adaptiveReduction += .15; performanceSamples = 0; performanceAverage = 16.7; resize();
    }
    const ease = 1 - Math.exp(-dt * 7);
    currentX = lerp(currentX, state.reducedMotion || compact || travel ? 0 : pointerX, ease);
    currentY = lerp(currentY, state.reducedMotion || compact || travel ? 0 : pointerY, ease);
    let complete: (() => void) | null = null;
    if (travel) {
      const progress = clamp((time - travel.start) / travel.duration);
      camera.position.lerpVectors(travel.from, travel.to, cameraEase(progress));
      if (progress === 1 && !travel.settled) { travel.settled = true; complete = travel.done; travel.done = null; }
    } else {
      // Direct assignment is intentional. Scroll reversal and restored positions
      // stay exactly aligned with the DOM checkpoint, with no second damped track.
      camera.position.z = state.room === 'atrium' ? frame.z : roomZ(state.room) - innerScroll * 1.1;
      camera.position.x = currentX * (state.room === 'atrium' ? .13 : .06) + rotation * .2;
      camera.position.y = currentY * .08;
    }
    look.set(camera.position.x + currentX * .11, camera.position.y + currentY * .06, camera.position.z - 22);
    camera.lookAt(look); camera.updateMatrixWorld();
    movingLight.position.set(-2.5, 3.3, camera.position.z - 8);
    redLight.position.set(4.8, -2.5, camera.position.z - 16);
    entrance.visible = camera.position.z > -27;
    entrance.rotation.y = .11 + Math.sin(elapsed * .12) * .08;
    irisBlades.forEach((blade, i) => { blade.rotation.z = i * Math.PI * .285 + elapsed * (i % 2 ? .045 : -.035); });
    irisSignal.rotation.z = -.85 - elapsed * .035;
    for (let index = 0; index < stations.length; index++) {
      const station = stations[index], distance = camera.position.z - station.root.position.z;
      station.root.visible = distance > -8 && distance < 95;
      if (!station.root.visible) continue;
      station.moving.position.y = state.reducedMotion ? 0 : Math.sin(elapsed * .6 + index) * .065;
      if (index === 0 || index === 3 || index === 5) station.moving.rotation.y = elapsed * (index === 3 ? -.095 : .065);
      station.marker.rotation.z = index * .75 + .1 + elapsed * .025;
      station.root.scale.setScalar(focus === TUNNEL_STATION_IDS[index] ? 1.015 : 1);
      if (station.picture && !station.loaded && distance < 62) {
        station.loaded = true;
        const url = options.portals[index]?.image;
        if (url) loader.load(asset(url), texture => {
          if (disposed) { texture.dispose(); return; }
          texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
          station.picture!.material.map = texture; station.picture!.material.color.setHex(0xffffff); station.picture!.material.needsUpdate = true; requestFrame();
        });
      }
    }
    atmosphere.points.position.set(0, -2.5, camera.position.z - 12);
    atmosphere.points.visible = !state.reducedMotion;
    atmosphere.update(elapsed, dt, state.reducedMotion);
    updatePanels(); renderer.render(scene, camera);
    if (!compact && !state.reducedMotion) cssRenderer.render(cssScene, camera);
    if (!ready) { ready = true; options.onProject?.([]); options.onReady(); }
    complete?.();
    if (!state.reducedMotion || (travel && !travel.settled)) requestFrame();
  }

  function pointerMove(event: PointerEvent) {
    if (state.paused || state.reducedMotion || !event.isPrimary) return;
    pointerX = event.clientX / width * 2 - 1; pointerY = 1 - event.clientY / height * 2;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('video,input,textarea,select,[contenteditable="true"],[role="dialog"],[data-atmosphere-protected]')) {
      atmosphere.input.move(pointerX, pointerY, event.timeStamp, event.pointerType === 'touch');
    } else atmosphere.input.leave();
    requestFrame();
  }
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || state.paused || state.reducedMotion || travel || !event.isPrimary) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('a,button,input,textarea,select,label,video,[role="dialog"],[role="slider"],[contenteditable="true"]')) return;
    pointerMove(event); atmosphere.input.press(); if (event.pointerType === 'touch') atmosphere.input.release();
  }
  function pointerUp(event: PointerEvent) { if (event.isPrimary) atmosphere.input.release(); }
  function pointerReset() { pointerX = pointerY = 0; atmosphere.input.reset(); requestFrame(); }
  function pointerOut(event: PointerEvent) { if (!event.relatedTarget) pointerReset(); }
  function visibility() {
    lastTime = 0; cadence.reset(); atmosphere.input.reset();
    if (document.hidden) { cancelAnimationFrame(frameRequest); frameRequest = 0; } else requestFrame();
  }
  function contextLost(event: Event) {
    event.preventDefault(); unavailable = true;
    const complete = travel?.done; travel = null;
    cancelAnimationFrame(frameRequest); frameRequest = 0;
    panels.forEach(restorePanel); cssRenderer.domElement.style.display = 'none';
    options.onUnavailable(); complete?.();
  }
  const unsubscribeFrame = subscribeTunnelFrame(next => { frame = next; requestFrame(); });
  const unsubscribePanels = subscribeTunnelPanels(registerPanels);
  const unsubscribePreferences = subscribeSpatialPreferences(updatePreferences);
  const observer = new ResizeObserver(resize); observer.observe(host);
  window.addEventListener('pointermove', pointerMove, { passive: true });
  window.addEventListener('pointerdown', pointerDown, { passive: true });
  window.addEventListener('pointerup', pointerUp, { passive: true });
  window.addEventListener('pointercancel', pointerReset, { passive: true });
  window.addEventListener('pointerout', pointerOut, { passive: true });
  window.addEventListener('blur', pointerReset);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('webglcontextlost', contextLost);
  resize(); registerPanels(getTunnelPanels()); updatePreferences();

  return {
    setState(next) {
      if (disposed) return;
      const arrived = travel?.settled && travel.room === next.room;
      const changed = state.room !== next.room;
      let finishReduced: (() => void) | null = null;
      if (next.reducedMotion && !state.reducedMotion && travel && !travel.settled && !next.paused && !changed && state.entered === next.entered) {
        // Switching the preference mid-flight presents the endpoint immediately,
        // then completes the existing navigation exactly once.
        travel.start = performance.now() - travel.duration;
        travel.settled = true; camera.position.copy(travel.to);
        finishReduced = travel.done; travel.done = null;
      }
      if (next.paused || changed || state.entered !== next.entered) {
        if (travel) travel.done = null; travel = null; atmosphere.input.reset();
      }
      state = { ...next };
      if (arrived || changed) innerScroll = 0;
      if (arrived && next.room === 'atrium') frame = { ...frame, z: 12, active: -1, progress: 0 };
      if (next.paused) { updatePanels(); cancelAnimationFrame(frameRequest); frameRequest = 0; }
      else { cadence.reset(); lastTime = 0; resize(); requestFrame(); }
      finishReduced?.();
    },
    setFocus(id) { focus = id; requestFrame(); },
    setScroll(progress) { innerScroll = clamp(progress, 0, 1); requestFrame(); },
    rotate(delta) { rotation = clamp(rotation + delta, -.8, .8); requestFrame(); },
    travelTo(id, done, duration = 1100) {
      if (disposed) return;
      const valid = id === 'atrium' || TUNNEL_STATION_IDS.includes(id as typeof TUNNEL_STATION_IDS[number]);
      if (!valid || state.reducedMotion || unavailable || !ready || state.paused) { cancelTravel(); done(); return; }
      if (travel) travel.done = null;
      // Explicit Home navigation returns to the entrance, matching the router's
      // scroll-zero behavior. History restoration still uses the scroll frame.
      travel = { from: camera.position.clone(), to: new THREE.Vector3(0, 0, id === 'atrium' ? 12 : roomZ(id)), start: performance.now(), duration: Math.max(1, duration), room: id, done, settled: false };
      pointerX = pointerY = currentX = currentY = rotation = 0; atmosphere.input.reset(); requestFrame();
    },
    cancelTravel,
    destroy() {
      if (disposed) return;
      disposed = true; if (travel) travel.done = null; travel = null;
      cancelAnimationFrame(frameRequest); observer.disconnect(); panelObserver.disconnect(); unsubscribeFrame(); unsubscribePanels(); unsubscribePreferences();
      panels.forEach(restorePanel); panels.clear();
      window.removeEventListener('pointermove', pointerMove); window.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointerup', pointerUp); window.removeEventListener('pointercancel', pointerReset);
      window.removeEventListener('pointerout', pointerOut); window.removeEventListener('blur', pointerReset);
      document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('webglcontextlost', contextLost);
      atmosphere.dispose(); geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
      environment.dispose(); scene.clear(); cssScene.clear(); renderer.dispose(); renderer.forceContextLoss();
      canvas.remove(); cssRenderer.domElement.remove();
    },
  };
}
