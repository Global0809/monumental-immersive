import { requestVisualFrame, cancelVisualFrame } from '../../services/visualFrame';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createFrameCadence } from '../../services/frameCadence';
import { getSpatialPreferences, subscribeSpatialPreferences } from '../../services/spatialPreferences';
import { createDroneFamily } from './droneModels';
import { createSpiralField } from './spiralField';
import { getTunnelFrame, tunnelCompact } from '../../services/tunnelJourney';
import { passageReading } from '../../services/passageJourney';
import { getPassageMediaBounds, subscribePassageMediaBounds } from '../../services/passageProtection';
import { droneActivity, droneServiceMember, sampleDroneFlight, separateDroneTargets, type DroneActivity, type DroneFlightSample } from '../../services/droneBehaviour';
import { createDroneDock } from './droneDock';
import { createCinematicMaterials } from '../../services/cinematicMaterials';
import { sampleCinematicLight } from '../../services/cinematicLight';

export type FlightFormation = 'escort' | 'orbit';
type FlightState = { home: boolean; reducedMotion: boolean; paused: boolean; inspecting: boolean; docked: boolean; formation: FlightFormation; selected: string };
export type FlightController = { mount(parent: HTMLElement): void; setState(state: FlightState): void; destroy(): void };
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

/** Fixed camera, moving world: nothing here can displace the page or consume input. */
export function createFlightScene(initialHost: HTMLElement, unavailable: () => void): FlightController {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { unavailable(); return { mount() {}, setState() {}, destroy() {} }; }
  let host = initialHost, disposed = false, lost = false;
  let state: FlightState = { home: false, reducedMotion: false, paused: false, inspecting: false, docked: false, formation: 'escort', selected: 'vela' };
  let width = 1, height = 1, compact = false, request = 0, last = 0, elapsed = 0;
  let pointerX = 0, pointerY = 0, px = 0, py = 0, energy = 0, scrollEnergy = 0, previousScroll = scrollY;
  let pointerPresent = false, pointerInterest = 0;
  let previousScrollTime = performance.now(), protectionRequest = 0, protectedNodes: Element[] = [];
  let preferences = getSpatialPreferences(), qualityPenalty = 0, slowFrames = 0;
  let hero = false;
  const cadence = createFrameCadence();
  const canvas = renderer.domElement;
  const mediaMask=document.createElement('div');mediaMask.className='flight-media-mask';
  Object.assign(mediaMask.style,{position:'absolute',inset:'0',pointerEvents:'none'});
  canvas.className = 'flight-canvas'; canvas.setAttribute('aria-hidden', 'true');
  initialHost.appendChild(mediaMask);mediaMask.appendChild(canvas);
  renderer.setClearColor(0x080909, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, .1, 160);
  camera.position.z = 10;
  const environmentScene = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, .025);
  environmentScene.dispose(); pmrem.dispose(); scene.environment = environment.texture;
  scene.environmentIntensity = .95;
  const key = new THREE.DirectionalLight(0xf4f1e8, 3.6); key.position.set(-3, 6, 9); scene.add(key);
  const fill = new THREE.DirectionalLight(0xb7c6c1, 1.3); fill.position.set(5, 1, 4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff7658, .7); rim.position.set(1, -3, -2); scene.add(rim);
  const family = createDroneFamily(); scene.add(family.root);
  const surfaceFinish = createCinematicMaterials(), finished = new Set<THREE.Material>();
  family.root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial) || finished.has(material) || material.roughness < .16 || material.emissiveIntensity > 0 && material.emissive.getHex() !== 0) continue;
      finished.add(material); surfaceFinish.apply(material, material.metalness > .75 ? 'metal' : 'paint', .5);
    }
  });
  const serviceDock = createDroneDock(scene), dockPosition = new THREE.Vector3();
  const activities: DroneActivity[] = Array.from({ length: 4 }, () => ({ perch: 0, inspect: 0, signal: 0, state: 'fly' }));
  const rotorTurns = [0, 0, 0, 0];
  const bodyScales = family.members.map(member => member.root.scale.x);
  const spiral = createSpiralField(); scene.add(spiral.root);
  const velocities = family.members.map(() => new THREE.Vector3());
  const targets = family.members.map(() => new THREE.Vector3());
  const flightSamples: DroneFlightSample[] = family.members.map(() => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
  const attention = [0, 0, 0, 0], radii = [0, 0, 0, 0];
  const homeOffsets = [[-.9, .6], [.9, -.25], [-.55, -.95], [1.5, .9]];
  const inspectOffsets = [[0, 0], [0, 0], [0, 0], [0, 0]];
  const scales = [1, 1, 1, 1];
  let positioned = false;

  function wake() { if (!request && !disposed && !lost && !state.paused && !document.hidden) request = requestVisualFrame(render); }
  function protectPassageMedia(){
    const r=state.home&&!state.inspecting?getPassageMediaBounds():null;
    mediaMask.style.clipPath=r?`path(evenodd, "M0 0H${width}V${height}H0Z M${r.left} ${r.top}H${r.right}V${r.bottom}H${r.left}Z")`:'';
    mediaMask.dataset.protected=String(!!r);
  }
  function resize() {
    if (disposed) return;
    const bounds = host.getBoundingClientRect();
    width = Math.max(1, bounds.width); height = Math.max(1, bounds.height); compact = width < 760;
    renderer.setPixelRatio(Math.max(.7, Math.min(devicePixelRatio || 1, preferences.quality === 'light' ? .85 : compact ? 1 : 1.2) - qualityPenalty));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    positioned = false; protectPassageMedia();scheduleProtection(); wake();
  }

  // Cut real media out of the decorative canvas. Rebuild only on layout/scroll,
  // never during the render loop. Overlapping boxes are merged before evenodd.
  function protect() {
    protectionRequest = 0;
    if (state.inspecting) { canvas.style.clipPath = ''; return; }
    hero = state.home && scrollY < innerHeight * .42;
    const rects: {x: number;y: number;r: number;b: number}[] = [];
    for (const node of protectedNodes) {
      const r = node.getBoundingClientRect();
      if (r.width < 28 || r.height < 24 || r.bottom <= 0 || r.top >= height || r.right <= 0 || r.left >= width) continue;
      const box = { x: Math.max(0, r.left - 3), y: Math.max(0, r.top - 3), r: Math.min(width, r.right + 3), b: Math.min(height, r.bottom + 3) };
      for (let i = rects.length - 1; i >= 0; i--) {
        const other = rects[i];
        if (box.x < other.r && box.r > other.x && box.y < other.b && box.b > other.y) {
          box.x = Math.min(box.x, other.x); box.y = Math.min(box.y, other.y); box.r = Math.max(box.r, other.r); box.b = Math.max(box.b, other.b); rects.splice(i, 1); i = rects.length;
        }
      }
      rects.push(box);
    }
    let path = `M0 0H${width}V${height}H0Z`;
    for (const r of rects) path += `M${r.x.toFixed(1)} ${r.y.toFixed(1)}H${r.r.toFixed(1)}V${r.b.toFixed(1)}H${r.x.toFixed(1)}Z`;
    canvas.style.clipPath = `path(evenodd, "${path}")`;
  }
  function scheduleProtection() { if (!protectionRequest && !disposed) protectionRequest = requestAnimationFrame(protect); }
  function collectProtection() {
    // Spatial galleries animate their children inside fixed bounds. Protect
    // those bounded surfaces once, rather than reading moving posters each frame.
    protectedNodes = [...document.querySelectorAll('main video,main img,main .film-image,main .cultural-atlas__viewport,main .ct-filmstrip,main .ct-screen-surface,main .personal-constellation__sky,main input,main textarea,main select,main h1,main h2,main h3,main p,main button,main a,main [data-flight-protected]')];
    scheduleProtection();
  }
  function render(time: number) {
    request = 0;
    if (disposed || lost || state.paused || document.hidden) return;
    if (!cadence.ready(time)) { wake(); return; }
    const rawDt = last ? (time - last) / 1000 : 1 / 60;
    const dt = Math.min(rawDt, .035); last = time;
    const still = state.reducedMotion || state.docked;
    if (!still) elapsed += dt;
    const illumination = sampleCinematicLight(elapsed, state.reducedMotion);
    key.intensity = 3.6 * illumination.breath;
    rim.intensity = .7 * illumination.signal;
    key.position.x = -3 + illumination.drift * .24;
    if (!still && rawDt > .026 && rawDt < .12) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 100 && qualityPenalty < .3) { qualityPenalty += .15; slowFrames = 0; resize(); }
    const smooth = 1 - Math.exp(-dt * 4.5);
    px = lerp(px, still ? 0 : pointerX, smooth); py = lerp(py, still ? 0 : pointerY, smooth);
    pointerInterest = lerp(pointerInterest, !still && pointerPresent ? 1 : 0, 1 - Math.exp(-dt * 5));
    energy = lerp(energy, still ? 0 : scrollEnergy, smooth); scrollEnergy *= Math.exp(-dt * 2.5);
    const viewH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 10, viewW = viewH * camera.aspect;
    const t = state.reducedMotion ? 0 : elapsed;
    // A readable hero formation; afterwards the family flies in the edge corridor.
    const centerX = state.inspecting ? 0 : hero ? compact ? .46 : .55 : compact ? .78 : .73;
    const centerY = state.inspecting ? -.08 : hero ? compact ? -.43 : -.02 : state.home ? .51 : -.24;
    const adultScale = state.inspecting ? Math.min(5.2, viewW * (compact ? .24 : .16)) : hero ? (compact ? .55 : 1.03) : state.home ? .38 : compact ? .32 : .52;
    if (state.inspecting) for (let i = 0; i < 4; i++) {
      inspectOffsets[i][0] = viewW * (compact ? [-.23, .23, -.2, .22][i] : [-.3, -.09, .15, .32][i]);
      inspectOffsets[i][1] = compact ? [1.35, 1.25, -1.4, -1.35][i] : [.55, -.25, .5, -.25][i];
    }
    const offsets = state.inspecting ? inspectOffsets : homeOffsets;
    const spread = state.inspecting ? 1 : hero ? .85 : .49;
    const passage = getTunnelFrame();
    const reading = state.home && passageReading(passage);
    const tending = !still && !state.inspecting && !reading && !compact && state.formation === 'escort';
    const tendingMember = droneServiceMember(t);
    const selectedActivity = droneActivity(tending ? t : 17, tending ? tendingMember : -1, activities[tendingMember]);
    const dockMargin = family.members[tendingMember].span * adultScale * .65;
    dockPosition.set(
      clamp(centerX * viewW / 2 + homeOffsets[tendingMember][0] * spread, -viewW / 2 + dockMargin, viewW / 2 - dockMargin),
      clamp(centerY * viewH / 2 + homeOffsets[tendingMember][1] * spread - .2 * adultScale, -viewH / 2 + dockMargin + .25, viewH / 2 - dockMargin - .9), 0);
    serviceDock.root.position.copy(dockPosition); serviceDock.root.scale.setScalar(adultScale);
    for (let i = 0; i < 4; i++) {
      const member = family.members[i], target = targets[i];
      const routine = droneActivity(tending ? t : 17, tending ? i : -1, activities[i]);
      const flight = sampleDroneFlight(t, i, flightSamples[i]);
      let x = offsets[i][0] * spread, y = offsets[i][1] * spread;
      const excursion = state.inspecting ? .28 : compact ? .34 : hero ? .88 : reading ? .46 : .70;
      x += flight.x * excursion;
      y += flight.y * excursion * .82;
      let z = flight.z * (state.inspecting ? .32 : reading ? .6 : .92);
      if (state.formation === 'orbit' && !still) {
        const angle = t * .26 + [0, Math.PI, Math.PI / 2, Math.PI * 1.5][i] + (i >= 2 ? Math.sin(t * .4 + i) * .04 : 0);
        x = Math.cos(angle) * (state.inspecting ? viewW * .31 : spread * 1.25);
        y = Math.sin(angle) * (state.inspecting ? 1.8 : spread * .8);
        z = Math.sin(angle) * (state.inspecting ? 1.2 : .6);
      }
      target.set(centerX * viewW / 2 + x, centerY * viewH / 2 + y, z);
      attention[i] = 0;
      if (!still) {
        const dx = px * viewW / 2 - target.x, dy = py * viewH / 2 - target.y;
        const distance = Math.hypot(dx, dy), interest = Math.exp(-distance * distance * .27) * pointerInterest;
        const standOff = (i < 2 ? .85 : .65) * adultScale + .22;
        const approach = (distance - standOff) / Math.max(.001, distance) * interest * (i < 2 ? .48 : .69);
        attention[i] = interest;
        target.x += dx * approach; target.y += dy * approach;
        target.z += interest * (i < 2 ? .18 : .28);
      }
      if (routine.perch > 0) {
        target.x = lerp(target.x, dockPosition.x, routine.perch);
        target.y = lerp(target.y, dockPosition.y + .08 * adultScale, routine.perch);
        target.z = lerp(target.z, dockPosition.z, routine.perch);
      }
      radii[i] = member.span * adultScale * .42 + .045;
    }
    separateDroneTargets(targets, radii);
    for (let i = 0; i < 4; i++) {
      const member = family.members[i], target = targets[i], velocity = velocities[i], routine = activities[i], flight = flightSamples[i];
      // Perspective-aware bounds also protect nearer fly-bys on short screens.
      const margin = member.span * adultScale * .65;
      const perspective = (camera.position.z - target.z) / camera.position.z;
      const halfW = viewW * perspective / 2, halfH = viewH * perspective / 2;
      target.x = clamp(target.x, -halfW + margin, halfW - margin);
      target.y = clamp(target.y, -halfH + margin + .4, halfH - margin - .6);
      if (!positioned || state.reducedMotion) { member.root.position.copy(target); velocity.set(0, 0, 0); }
      else if (state.docked) { velocity.set(0, 0, 0); }
      else {
        const stiffness = i < 2 ? 36 : 31, damping = Math.exp(-dt * (i < 2 ? 7.6 : 6.5));
        velocity.x = (velocity.x + (target.x - member.root.position.x) * stiffness * dt) * damping;
        velocity.y = (velocity.y + (target.y - member.root.position.y) * stiffness * dt) * damping;
        velocity.z = (velocity.z + (target.z - member.root.position.z) * stiffness * dt) * damping;
        member.root.position.addScaledVector(velocity, dt);
      }
      const selected = state.inspecting && state.selected === member.id;
      scales[i] = still ? adultScale : lerp(scales[i], adultScale * (selected ? 1.11 : 1), smooth);
      member.root.scale.setScalar(scales[i] * bodyScales[i]);
      const heading = clamp(velocity.x * .48 + flight.vx * .30, -.65, .65);
      const bank = clamp(-velocity.x * .40 - flight.vx * .16, -.4, .4);
      const pitch = .34 + clamp(velocity.y * .16 - velocity.z * .11, -.16, .16);
      const turn = state.reducedMotion ? 1 : 1 - Math.exp(-dt * 5.5);
      member.root.rotation.x = lerp(member.root.rotation.x, lerp(pitch, .07, routine.perch), turn);
      member.root.rotation.y = lerp(member.root.rotation.y, lerp(-.24 + heading, -.1, routine.perch), turn);
      member.root.rotation.z = lerp(member.root.rotation.z, bank * (1 - routine.perch), turn);
      const gazeX = clamp((px * viewW / 2 - member.root.position.x) * .34, -.55, .55) * attention[i];
      const gazeY = clamp((py * viewH / 2 - member.root.position.y) * -.24, -.3, .3) * attention[i];
      member.gimbal.rotation.y = lerp(member.gimbal.rotation.y, gazeX * (1 - routine.perch) + routine.inspect * .45, turn);
      member.gimbal.rotation.x = lerp(member.gimbal.rotation.x, gazeY * (1 - routine.perch) + routine.inspect * .38, turn);
      const reply = i === (tendingMember + 1) % 4 ? selectedActivity.signal * .28 : 0;
      member.signal.emissiveIntensity = selected ? .8 : .32 + routine.signal * .38 + reply + attention[i] * .10 + Math.sin(t * 1.8 + i) * .035;
      if (!still) rotorTurns[i] += dt * ((i < 2 ? 11 : 14) + Math.min(3, velocity.length() * 2)) * (1 - routine.perch * .88);
      for (let r = 0; r < member.rotors.length; r++) member.rotors[r].rotation.y = rotorTurns[i] * (r ? -1 : 1);
    }
    const activity = activities[tendingMember];
    serviceDock.update(family.members[tendingMember].root.position, family.members[(tendingMember + 1) % 4].root.position, activity.signal, activity.inspect, tending && activity.state !== 'fly');
    initialHost.dataset.activity = tending ? activity.state : 'fly';
    positioned = true;
    // The same phase survives routes. The camera and DOM are never moved by it.
    // Passage architecture supplies its own depth and air. The overlay current
    // belongs to the editorial routes; it must never stripe the cultural screens.
    spiral.root.visible = !state.home || state.inspecting;
    const passageCompact = tunnelCompact(width, height, state.reducedMotion);
    family.root.visible = !state.home || !passageCompact || state.inspecting;
    if (spiral.root.visible) spiral.update(elapsed, still ? 0 : dt, { pointerX: px, pointerY: py, energy: energy * .75, compact, reducedMotion: still });
    renderer.render(scene, camera);
    const status = state.reducedMotion ? 'reduced' : state.docked ? 'docked' : 'active';
    if (initialHost.dataset.state !== status) initialHost.dataset.state = status;
    if (!still && (!state.home || !passageCompact || state.inspecting)) wake();
  }
  function move(event: PointerEvent) {
    if (!event.isPrimary || state.paused || state.reducedMotion || state.docked || event.pointerType === 'touch') return;
    if (event.buttons) { resetPointer(); return; }
    pointerPresent = true;
    const bounds = state.inspecting ? host.getBoundingClientRect() : { left: 0, top: 0 };
    pointerX = clamp((event.clientX - bounds.left) / width * 2 - 1, -1, 1);
    pointerY = clamp(1 - (event.clientY - bounds.top) / height * 2, -1, 1);
    wake();
  }
  function resetPointer() { pointerX = pointerY = 0; pointerPresent = false; }
  function leave(event: PointerEvent) { if (!event.relatedTarget) resetPointer(); }
  function scroll() {
    const now = performance.now();
    scrollEnergy = Math.min(1.5, Math.abs(scrollY - previousScroll) / Math.max(16, now - previousScrollTime) * .2);
    previousScroll = scrollY; previousScrollTime = now; scheduleProtection();
  }
  function visibility() {
    last = 0; cadence.reset(); resetPointer();
    if (document.hidden) { cancelVisualFrame(request); request = 0; initialHost.dataset.state = 'paused'; }
    else wake();
  }
  function lostContext(event: Event) { event.preventDefault(); lost = true; cancelVisualFrame(request); request = 0; unavailable(); }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const main = document.getElementById('main');
  const contentObserver = new ResizeObserver(() => { collectProtection(); });
  if (main) contentObserver.observe(main);
  const unsubscribe = subscribeSpatialPreferences(() => { preferences = getSpatialPreferences(); qualityPenalty = 0; resize(); });
  const unsubscribeMedia=subscribePassageMediaBounds(protectPassageMedia);
  window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('pointerout', leave, { passive: true });
  window.addEventListener('blur', resetPointer); window.addEventListener('scroll', scroll, { passive: true });
  document.addEventListener('visibilitychange', visibility); document.addEventListener('load', collectProtection, true);
  canvas.addEventListener('webglcontextlost', lostContext);
  collectProtection(); resize();
  return {
    mount(parent) {
      if (disposed || parent === host || !parent) return;
      resizeObserver.unobserve(host); host = parent; host.appendChild(mediaMask); resizeObserver.observe(host); resize();
    },
    setState(next) {
      if (disposed) return;
      const changed = state.home !== next.home || state.inspecting !== next.inspecting;
      state = { ...next };
      protectPassageMedia();
      if (changed) { resetPointer(); positioned = false; }
      collectProtection();
      if (state.paused) { cancelVisualFrame(request); request = 0; initialHost.dataset.state = 'paused'; }
      else { last = 0; cadence.reset(); scheduleProtection(); wake(); }
    },
    destroy() {
      if (disposed) return; disposed = true;
      cancelVisualFrame(request); cancelAnimationFrame(protectionRequest); resizeObserver.disconnect(); contentObserver.disconnect(); unsubscribe();unsubscribeMedia();
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerout', leave); window.removeEventListener('blur', resetPointer);
      window.removeEventListener('scroll', scroll); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('load', collectProtection, true);
      canvas.removeEventListener('webglcontextlost', lostContext); surfaceFinish.dispose(); family.dispose(); serviceDock.destroy(); spiral.dispose(); environment.dispose(); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();mediaMask.remove();
    },
  };
}
