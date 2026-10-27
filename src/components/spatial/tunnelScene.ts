import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { createFrameCadence } from '../../services/frameCadence';
import { getSpatialPreferences, subscribeSpatialPreferences } from '../../services/spatialPreferences';
import {
  getTunnelFrame, getTunnelPanels, getTunnelInspection, subscribeTunnelFrame, subscribeTunnelPanels, subscribeTunnelInspection,
  tunnelCompact, tunnelGateOpen, tunnelReadingZ, tunnelStationZ, TUNNEL_STATION_IDS,
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
  let frame = getTunnelFrame(), preferences = getSpatialPreferences(), inspection = getTunnelInspection();
  let width = 1, height = 1, compact = false, ratio = 1;
  let frameRequest = 0, lastTime = 0, elapsed = 0, focus: string | null = null;
  let pointerX = 0, pointerY = 0, currentX = 0, currentY = 0, rotation = 0;
  let travel: Travel | null = null;
  let previousCameraZ = frame.z, travelSpeed = 0;
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
  // A spatial viewport must not become an independent scroll container. Hidden
  // overflow allows focus/scrollIntoView to shift HTML away from the WebGL camera.
  Object.assign(cssRenderer.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none', overflow: 'clip', zIndex: '1' });
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
    mesh(geometry(new THREE.TorusGeometry(radius, tube, 12, segments, arc)), surface, parent);

  const roomEnvironment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(roomEnvironment, .045);
  roomEnvironment.dispose(); pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = .8;
  const chrome = material(new THREE.MeshStandardMaterial({ color: 0xdce0dc, metalness: .99, roughness: .18 }));
  const satin = material(new THREE.MeshStandardMaterial({ color: 0x515a55, metalness: .94, roughness: .32 }));
  const graphite = material(new THREE.MeshStandardMaterial({ color: 0x121513, metalness: .72, roughness: .4 }));
  const mineral = material(new THREE.MeshStandardMaterial({ color: 0x101311, metalness: .16, roughness: .82, envMapIntensity: .3 }));
  const architecturalSatin = material(new THREE.MeshStandardMaterial({ color: 0x252c28, metalness: .58, roughness: .58, envMapIntensity: .3 }));
  const floorSurface = material(new THREE.MeshBasicMaterial({ color: 0x090b0a, toneMapped: false }));
  const signal = material(new THREE.MeshBasicMaterial({ color: RED, toneMapped: false }));
  const packetSurface = material(new THREE.MeshBasicMaterial({ color: 0xb76b56, transparent: true, opacity: .65, depthWrite: false, toneMapped: false }));
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
  const ribShape = geometry(new THREE.TorusGeometry(8.35, .07, 6, 64));
  const ribs: THREE.InstancedMesh<THREE.TorusGeometry, THREE.Material> = new THREE.InstancedMesh(ribShape, mineral, 27);
  const ribMatrix = new THREE.Object3D();
  for (let i = 0; i < 27; i++) {
    ribMatrix.position.set(Math.sin(i * .17) * .2, 0, 16 - i * 9.45);
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
  const structuralRibs = new THREE.InstancedMesh(structuralShape, architecturalSatin, 26 * 3);
  const ribColor = new THREE.Color();
  for (let i = 0; i < 26; i++) for (let side = 0; side < 3; side++) {
    ribMatrix.position.set(Math.sin(i * .43) * .18, 0, 13 - i * 9.45);
    ribMatrix.rotation.set(0, 0, side * Math.PI * 2 / 3 + i * .081 + .12);
    ribMatrix.scale.set(1, .8, 1); ribMatrix.updateMatrix();
    structuralRibs.setMatrixAt(i * 3 + side, ribMatrix.matrix);
    structuralRibs.setColorAt(i * 3 + side, ribColor.setHex((i + side) % 4 === 0 ? 0x474d49 : 0xc5cbc6));
  }
  structuralRibs.instanceMatrix.needsUpdate = true; architecture.add(structuralRibs);
  const struts = new THREE.InstancedMesh(boxShape, mineral, 26 * 4);
  for (let i = 0; i < 26; i++) for (let j = 0; j < 4; j++) {
    const a = j / 4 * Math.PI * 2 + Math.PI / 4;
    ribMatrix.position.set(Math.cos(a) * 7.7, Math.sin(a) * 6.1, 13 - i * 9.45);
    ribMatrix.rotation.set(0, 0, a);
    ribMatrix.scale.set(.36, .18, 1.1); ribMatrix.updateMatrix(); struts.setMatrixAt(i * 4 + j, ribMatrix.matrix);
  }
  struts.instanceMatrix.needsUpdate = true; architecture.add(struts);
  // Deep, matte coffers give the passage mass. Exhibits sit in open bays;
  // the repeated thin rings no longer carry the entire architectural silhouette.
  const vault = new THREE.InstancedMesh(boxShape, mineral, 26 * 3);
  for (let bay = 0; bay < 26; bay++) for (let face = 0; face < 3; face++) {
    const angle = face * Math.PI * 2 / 3 + Math.PI / 2;
    ribMatrix.position.set(Math.cos(angle) * 8.62, Math.sin(angle) * 6.8, 9 - bay * 9.45);
    ribMatrix.rotation.set(0, 0, angle - Math.PI / 2);
    ribMatrix.scale.set(5.2, .38, 7.1); ribMatrix.updateMatrix();
    vault.setMatrixAt(bay * 3 + face, ribMatrix.matrix);
  }
  vault.instanceMatrix.needsUpdate = true; architecture.add(vault);
  const railCurves: THREE.CatmullRomCurve3[] = [];
  for (let rail = 0; rail < 4; rail++) {
    const points: THREE.Vector3[] = [];
    for (let step = 0; step < 64; step++) {
      const a = rail / 4 * Math.PI * 2 + Math.PI / 4 + Math.sin(step * .075) * .04;
      points.push(new THREE.Vector3(Math.cos(a) * 8.2, Math.sin(a) * 6.55, 18 - step * 4));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    railCurves.push(curve);
    mesh(geometry(new THREE.TubeGeometry(curve, 96, rail === 1 ? .016 : .026, 4, false)), rail === 1 ? signal : graphite, architecture);
  }
  // The floor has a few long inlays, never a dense wire grid behind the copy.
  const floor = mesh(geometry(new THREE.PlaneGeometry(18, 270)), floorSurface, architecture);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -5.65, -108);
  for (const x of [-5.7, -3, 3, 5.7]) box(architecture, [.014, .01, 260], [x, -5.635, -108], ivory);
  box(architecture, [.023, .012, 260], [-.12, -5.63, -108], signal);
  box(architecture, [.023, .012, 260], [.12, -5.63, -108], signal);
  const seamPoints: number[] = [];
  for (let i = 0; i < 26; i++) seamPoints.push(-7.3, -5.625, 18 - i * 9.45, 7.3, -5.625, 18 - i * 9.45);
  const seamShape = geometry(new THREE.BufferGeometry()); seamShape.setAttribute('position', new THREE.Float32BufferAttribute(seamPoints, 3));
  architecture.add(new THREE.LineSegments(seamShape, seams));

  // Six mechanical thresholds share one petal profile. Only nearby gates draw;
  // their three instanced surfaces keep the extra structure inexpensive.
  const gateProfile = new THREE.Shape();
  const gatePivot = 6.75, gateArc = .34;
  gateProfile.absarc(-gatePivot, 0, 8.08, -gateArc, gateArc, false);
  gateProfile.lineTo(Math.cos(gateArc) * 5.6 - gatePivot, Math.sin(gateArc) * 5.6);
  gateProfile.absarc(-gatePivot, 0, 5.6, gateArc, -gateArc, true); gateProfile.closePath();
  const gateShape = geometry(new THREE.ExtrudeGeometry(gateProfile, {
    depth: .2, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .035, bevelThickness: .035, curveSegments: 14,
  }));
  const gateSignalShape = geometry(new THREE.TorusGeometry(7.92, .018, 5, 16, .19));
  const gates = TUNNEL_STATION_IDS.map((_, index) => {
    const root = new THREE.Group(); root.position.z = tunnelStationZ(index) + 5; root.scale.y = .81; scene.add(root);
    const leaves = new THREE.InstancedMesh(gateShape, architecturalSatin, 6);
    const mechanisms = new THREE.InstancedMesh(boxShape, graphite, 12);
    const markings = new THREE.InstancedMesh(gateSignalShape, signal, 6);
    for (const part of [leaves, mechanisms, markings]) { part.instanceMatrix.setUsage(THREE.DynamicDrawUsage); part.frustumCulled = false; root.add(part); }
    return { root, leaves, mechanisms, markings, open: -1, phase: index * .17 };
  });
  const mechanismMatrix = new THREE.Object3D();
  function updateGates() {
    for (const gate of gates) {
      const distance = camera.position.z - gate.root.position.z;
      gate.root.visible = !preferences.cutaway && distance > -6 && distance < (compact ? 50 : 80);
      if (!gate.root.visible) continue;
      const open = state.reducedMotion ? 1 : tunnelGateOpen(camera.position.z, gate.root.position.z);
      if (gate.open === open) continue;
      gate.open = open;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + gate.phase;
        const radius = gatePivot + open * 1.95;
        mechanismMatrix.position.set(Math.cos(a) * radius, Math.sin(a) * radius, -open * .85);
        mechanismMatrix.rotation.set(0, open * .48, a + open * .075);
        mechanismMatrix.scale.set(1, 1, 1); mechanismMatrix.updateMatrix(); gate.leaves.setMatrixAt(i, mechanismMatrix.matrix);
        for (let side = 0; side < 2; side++) {
          const angle = a + (side ? .22 : -.22);
          mechanismMatrix.position.set(Math.cos(angle) * (7.55 + open * .55), Math.sin(angle) * (7.55 + open * .55), -.32 - open * .55);
          mechanismMatrix.rotation.set(0, 0, angle); mechanismMatrix.scale.set(.5 + open * 1.3, .105, .16);
          mechanismMatrix.updateMatrix(); gate.mechanisms.setMatrixAt(i * 2 + side, mechanismMatrix.matrix);
        }
        mechanismMatrix.position.set(Math.cos(a) * open * 1.55, Math.sin(a) * open * 1.55, .25 - open * .85);
        mechanismMatrix.rotation.set(0, 0, a - .095); mechanismMatrix.scale.set(1, 1, 1);
        mechanismMatrix.updateMatrix(); gate.markings.setMatrixAt(i, mechanismMatrix.matrix);
      }
      gate.leaves.instanceMatrix.needsUpdate = gate.mechanisms.instanceMatrix.needsUpdate = gate.markings.instanceMatrix.needsUpdate = true;
    }
  }

  // Quiet solid signal packets follow existing rails, never additive sprites.
  // Absolute camera travel drives their phase, including reverse scrolling.
  const packets = new THREE.InstancedMesh(boxShape, packetSurface, 8); packets.frustumCulled = false;
  packets.instanceMatrix.setUsage(THREE.DynamicDrawUsage); architecture.add(packets);
  const packetPosition = new THREE.Vector3(), packetTangent = new THREE.Vector3(), packetAxis = new THREE.Vector3(0, 0, 1);
  const packetMatrix = new THREE.Object3D();
  function updatePackets() {
    packets.visible = !state.reducedMotion && !compact && !preferences.cutaway;
    if (!packets.visible) return;
    for (let i = 0; i < 8; i++) {
      const rail = i % railCurves.length;
      const t = THREE.MathUtils.euclideanModulo(Math.floor(i / 4) * .5 + rail * .071 + (12 - camera.position.z) / 252 * .7, 1);
      railCurves[rail].getPointAt(t, packetPosition); railCurves[rail].getTangentAt(t, packetTangent);
      const distance = camera.position.z - packetPosition.z;
      packetMatrix.position.copy(packetPosition); packetMatrix.quaternion.setFromUnitVectors(packetAxis, packetTangent);
      const shown = distance > 1 && distance < 76;
      packetMatrix.scale.set(shown ? .028 : 0, shown ? .028 : 0, .7 + Math.min(travelSpeed * .025, 1.5));
      packetMatrix.updateMatrix(); packets.setMatrixAt(i, packetMatrix.matrix);
    }
    packets.instanceMatrix.needsUpdate = true;
  }

  const entrance = new THREE.Group(); entrance.position.set(3.25, .1, -11.5); entrance.scale.setScalar(1.32); scene.add(entrance);
  const irisBlades: { root: THREE.Group; angle: number }[] = [];
  const irisProfile = new THREE.Shape();
  irisProfile.moveTo(1.05, -.14); irisProfile.bezierCurveTo(1.28, -.8, 2.01, -1.04, 2.45, -.62);
  irisProfile.bezierCurveTo(2.85, -.16, 2.76, .47, 2.23, .77);
  irisProfile.lineTo(1.54, .38); irisProfile.quadraticCurveTo(1.1, .3, 1.05, -.14);
  const irisShape = geometry(new THREE.ExtrudeGeometry(irisProfile, {
    depth: .18, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .055, bevelThickness: .055, curveSegments: 24,
  }));
  const irisCollars: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const collar = torus(entrance, 2.87 - i * .14, i === 0 ? .105 : .062, i === 1 ? satin : chrome, Math.PI * (i === 0 ? 1.88 : 2));
    collar.position.z = -.5 - i * .3; collar.rotation.z = .65 + i * .45; irisCollars.push(collar);
  }
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7, blade = new THREE.Group(); entrance.add(blade);
    mesh(irisShape, chrome, blade);
    const edge = torus(blade, 2.38, .045, satin, .57, 24); edge.rotation.z = -.2; edge.position.z = .27;
    const pin = mesh(geometry(new THREE.CylinderGeometry(.09, .09, .3, 16)), graphite, blade);
    pin.rotation.x = Math.PI / 2; pin.position.set(2.36, .1, .25);
    irisBlades.push({ root: blade, angle });
  }
  const irisSignal = torus(entrance, 2.98, .022, signal, Math.PI * .49); irisSignal.rotation.z = -.85;
  const irisMechanisms = new THREE.InstancedMesh(boxShape, satin, 14); entrance.add(irisMechanisms);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    mechanismMatrix.position.set(Math.cos(a) * 2.72, Math.sin(a) * 2.72, -.62);
    mechanismMatrix.rotation.set(0, 0, a); mechanismMatrix.scale.set(.2, .075, .7);
    mechanismMatrix.updateMatrix(); irisMechanisms.setMatrixAt(i, mechanismMatrix.matrix);
  }
  function updateEntrance() {
    entrance.visible = camera.position.z > -27;
    if (!entrance.visible) return;
    const open = state.reducedMotion ? 0 : cameraEase(clamp((12 - camera.position.z) / 20));
    entrance.rotation.set(.035 + open * .07, .13 + open * .2, -.08 - open * .12);
    irisBlades.forEach(({ root, angle }, i) => {
      root.position.set(Math.cos(angle) * open * .72, Math.sin(angle) * open * .72, (i % 2) * .055 + open * (i % 2 ? .18 : -.18));
      root.rotation.set(Math.sin(angle) * open * .12, Math.cos(angle) * open * .12, angle + open * .33);
    });
    irisCollars.forEach((collar, i) => { collar.rotation.z = .65 + i * .45 + open * (i % 2 ? -.28 : .3); });
    irisSignal.rotation.z = -.85 - open * .52;
  }

  type InspectionPart = { object: THREE.Object3D; position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3; offset: THREE.Vector3; turn: THREE.Vector3; spread: THREE.Vector3 };
  type Station = { root: THREE.Group; moving: THREE.Group; marker: THREE.Mesh; baseRotation: THREE.Euler; parts: InspectionPart[]; inspection: number; turn: number; picture?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; loaded?: boolean };
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
    // Every inspection starts with captured authored transforms, so opening,
    // closing and rotating cannot accumulate drift over repeated interactions.
    const parts: InspectionPart[] = moving.children.map((object, part) => {
      const offset = new THREE.Vector3(), turn = new THREE.Vector3(), spread = new THREE.Vector3(1, 1, 1);
      if (index === 0) {
        if (part >= 2 && part < 7) { offset.set(0, (part - 4) * .26, (part - 4) * .2); turn.set((part - 4) * .11, .2, (part - 4) * -.09); }
        else if (part >= 7) { offset.copy(object.position).multiplyScalar(.27); }
      } else if (index === 1) {
        offset.set((part - 3.5) * .085, (part - 3.5) * .07, (3.5 - part) * .36);
        turn.set(0, (part - 3.5) * .045, (part - 3.5) * .045);
      } else if (index === 2) {
        if (part < 4) { offset.set((part - 1.5) * .12, -.16, -(part + 1) * .35); turn.set(.08, -.12, part * .07); }
        else { offset.set(0, .14, .72); }
      } else if (index === 3) {
        if (part < 27) { offset.set(object.position.x * .2, Math.sin(part * 1.7) * .22, object.position.z * .2); spread.y = .88; }
        else { spread.setScalar(1.14); offset.y = -.16; }
      } else if (index === 4) {
        offset.set(object.position.x * .3, Math.sin(part * .6) * .22, Math.cos(part * .5) * .22);
        turn.set(0, (part - 5.5) * .075, .16);
      } else {
        offset.set(Math.sin(part * 1.1) * .18, (part - 2.5) * .28, (part - 2.5) * .19);
        turn.set((part - 2.5) * .1, .24, -.14);
      }
      return { object, position: object.position.clone(), rotation: object.rotation.clone(), scale: object.scale.clone(), offset, turn, spread };
    });
    stations.push({ root, moving, marker, picture, parts, baseRotation: moving.rotation.clone(), inspection: 0, turn: 0 });
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
    ribs.material = preferences.cutaway ? ivory : mineral;
    structuralRibs.visible = !preferences.cutaway;
    struts.visible = !preferences.cutaway;
    vault.visible = !preferences.cutaway;
    floor.visible = !preferences.cutaway;
    key.intensity = 1.35 + preferences.light * .016;
    scene.environmentIntensity = .45 + preferences.light * .004;
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
    const isPassage = state.room === 'atrium';
    if (isPassage && !state.reducedMotion && !inspection.expanded) elapsed += dt;
    if (rawDt < 90) { performanceAverage = lerp(performanceAverage, rawDt, .025); performanceSamples++; }
    if (performanceSamples > 170 && performanceAverage > 24 && adaptiveReduction < .3) {
      adaptiveReduction += .15; performanceSamples = 0; performanceAverage = 16.7; resize();
    }
    const ease = 1 - Math.exp(-dt * 7);
    const reading = frame.active >= 0 && frame.progress >= .38 && frame.progress <= .74;
    currentX = lerp(currentX, !isPassage || reading || state.reducedMotion || compact || travel || inspection.expanded ? 0 : pointerX, ease);
    currentY = lerp(currentY, !isPassage || reading || state.reducedMotion || compact || travel || inspection.expanded ? 0 : pointerY, ease);
    let complete: (() => void) | null = null;
    if (travel) {
      const progress = clamp((time - travel.start) / travel.duration);
      camera.position.lerpVectors(travel.from, travel.to, cameraEase(progress));
      if (progress === 1 && !travel.settled) { travel.settled = true; complete = travel.done; travel.done = null; }
    } else {
      // Direct assignment is intentional. Scroll reversal and restored positions
      // stay exactly aligned with the DOM checkpoint, with no second damped track.
      camera.position.z = isPassage ? frame.z : roomZ(state.room);
      camera.position.x = currentX * (state.room === 'atrium' ? .13 : .06) + rotation * .2;
      camera.position.y = currentY * .08;
    }
    look.set(camera.position.x + currentX * .11, camera.position.y + currentY * .06, camera.position.z - 22);
    camera.lookAt(look); camera.updateMatrixWorld();
    movingLight.position.set(-2.5, 3.3, camera.position.z - 8);
    redLight.position.set(4.8, -2.5, camera.position.z - 16);
    travelSpeed = lerp(travelSpeed, Math.min(100, Math.abs(camera.position.z - previousCameraZ) / Math.max(dt, .001)), ease);
    previousCameraZ = camera.position.z;
    updateEntrance(); updateGates(); updatePackets();
    let dominant = -1, nearest = Infinity;
    for (let index = 0; index < stations.length; index++) {
      const distance = camera.position.z - stations[index].root.position.z;
      if (distance > 7 && distance < 34 && Math.abs(distance - 13) < nearest) { dominant = index; nearest = Math.abs(distance - 13); }
    }
    for (let index = 0; index < stations.length; index++) {
      const station = stations[index], distance = camera.position.z - station.root.position.z;
      station.root.visible = distance > -8 && distance < 95;
      if (!station.root.visible) continue;
      const inspecting = inspection.expanded && inspection.station === TUNNEL_STATION_IDS[index];
      const blend = state.reducedMotion ? 1 : 1 - Math.exp(-dt * 8);
      station.inspection = lerp(station.inspection, inspecting ? 1 : 0, blend);
      station.turn = lerp(station.turn, inspecting ? inspection.rotation : 0, blend);
      if (Math.abs(station.inspection - (inspecting ? 1 : 0)) < .001) station.inspection = inspecting ? 1 : 0;
      if (Math.abs(station.turn - (inspecting ? inspection.rotation : 0)) < .001) station.turn = inspecting ? inspection.rotation : 0;
      const articulation = cameraEase(station.inspection);
      station.moving.position.y = state.reducedMotion ? 0 : Math.sin(elapsed * .6 + index) * .065;
      station.moving.rotation.copy(station.baseRotation);
      if (index === 0 || index === 3 || index === 5) station.moving.rotation.y += elapsed * (index === 3 ? -.095 : .065);
      station.moving.rotation.y += station.turn;
      if (dominant === index && !inspection.expanded) {
        station.moving.rotation.y += currentX * .09;
        station.moving.rotation.x += currentY * .055;
      }
      for (const part of station.parts) {
        part.object.position.copy(part.position).addScaledVector(part.offset, articulation);
        part.object.rotation.set(part.rotation.x + part.turn.x * articulation, part.rotation.y + part.turn.y * articulation, part.rotation.z + part.turn.z * articulation);
        part.object.scale.set(part.scale.x * lerp(1, part.spread.x, articulation), part.scale.y * lerp(1, part.spread.y, articulation), part.scale.z * lerp(1, part.spread.z, articulation));
      }
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
    atmosphere.points.visible = isPassage && !state.reducedMotion;
    if (isPassage && !inspection.expanded) atmosphere.update(elapsed, dt, state.reducedMotion);
    updatePanels(); renderer.render(scene, camera);
    if (!compact && !state.reducedMotion) cssRenderer.render(cssScene, camera);
    if (!ready) { ready = true; options.onProject?.([]); options.onReady(); }
    complete?.();
    // Editorial routes have their own globe / film / tools. Render their backdrop
    // once and relinquish the GPU until a route transition actually needs it.
    if ((isPassage && !state.reducedMotion) || (travel && !travel.settled)) requestFrame();
  }

  function pointerMove(event: PointerEvent) {
    if (state.room !== 'atrium' || state.paused || state.reducedMotion || inspection.expanded || !event.isPrimary) return;
    pointerX = event.clientX / width * 2 - 1; pointerY = 1 - event.clientY / height * 2;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('video,input,textarea,select,[contenteditable="true"],[role="dialog"],[data-atmosphere-protected]')) {
      atmosphere.input.move(pointerX, pointerY, event.timeStamp, event.pointerType === 'touch');
    } else atmosphere.input.leave();
    requestFrame();
  }
  function pointerDown(event: PointerEvent) {
    if (state.room !== 'atrium' || event.button !== 0 || state.paused || state.reducedMotion || inspection.expanded || travel || !event.isPrimary) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('a,button,input,textarea,select,label,video,[role="dialog"],[role="slider"],[contenteditable="true"]')) return;
    pointerMove(event); atmosphere.input.press(); if (event.pointerType === 'touch') atmosphere.input.release();
  }
  function pointerUp(event: PointerEvent) { if (event.isPrimary) atmosphere.input.release(); }
  function pointerReset() { pointerX = pointerY = 0; atmosphere.input.reset(); if (state.room === 'atrium') requestFrame(); }
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
  const unsubscribeInspection = subscribeTunnelInspection(next => {
    inspection = next;
    if (next.expanded) { pointerX = pointerY = 0; atmosphere.input.reset(); }
    requestFrame();
  });
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
      if (arrived && next.room === 'atrium') frame = { ...frame, z: 12, active: -1, progress: 0 };
      if (next.paused) { updatePanels(); cancelAnimationFrame(frameRequest); frameRequest = 0; }
      else { cadence.reset(); lastTime = 0; resize(); requestFrame(); }
      finishReduced?.();
    },
    setFocus(id) { focus = id; requestFrame(); },
    setScroll() { if (state.room === 'atrium') requestFrame(); },
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
      cancelAnimationFrame(frameRequest); observer.disconnect(); panelObserver.disconnect(); unsubscribeFrame(); unsubscribePanels(); unsubscribePreferences(); unsubscribeInspection();
      panels.forEach(restorePanel); panels.clear();
      window.removeEventListener('pointermove', pointerMove); window.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointerup', pointerUp); window.removeEventListener('pointercancel', pointerReset);
      window.removeEventListener('pointerout', pointerOut); window.removeEventListener('blur', pointerReset);
      document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('webglcontextlost', contextLost);
      scene.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      atmosphere.dispose(); geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
      environment.dispose(); scene.clear(); cssScene.clear(); renderer.dispose(); renderer.forceContextLoss();
      canvas.remove(); cssRenderer.domElement.remove();
    },
  };
}
