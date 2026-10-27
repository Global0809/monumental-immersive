import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { attachXray } from '../services/xrayMaterial';
import { createFrameCadence } from '../services/frameCadence';
import { resolveDragAxis, type DragAxis } from '../services/exploreInteraction';

export interface CitySceneController { select: (index: number | null, immediate?: boolean) => void; dispose: () => void }
interface CityOptions { reducedMotion: boolean; onSelect: (index: number) => void; onProject: (index: number, x: number, y: number, visible: boolean) => void; onUnavailable: () => void }

/** Authored editorial miniature. These are conceptual locations, not geographic reconstructions. */
export function createCityScene(host: HTMLElement, options: CityOptions): CitySceneController {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' }); }
  catch { options.onUnavailable(); return { select() {}, dispose() {} }; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, window.innerWidth < 700 ? 1.25 : 1.5));
  renderer.setClearColor(0x090a0a); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x090a0a, 30, 70);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  const target = new THREE.Vector3(0, .25, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture; scene.environmentIntensity = .62;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe9f2ec, 0x171a16, 2));
  const light = new THREE.DirectionalLight(0xe8eee5, 3); light.position.set(-5, 10, 8); scene.add(light);
  const redLight = new THREE.PointLight(0xff3f25, 22, 20, 2); redLight.position.set(0, 3, 5); scene.add(redLight);
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb6beb8, metalness: .95, roughness: .25 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xc3c9c0, metalness: .7, roughness: .37 });
  const black = new THREE.MeshStandardMaterial({ color: 0x161c18, metalness: .68, roughness: .43 });
  const red = new THREE.MeshStandardMaterial({ color: 0xff4d32, metalness: .42, roughness: .38, emissive: 0x260500 });
  const signal = new THREE.MeshBasicMaterial({ color: 0xff4d32 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x18332f, metalness: .8, roughness: .23 });
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x56605a, transparent: true, opacity: .38 });
  const miniature = new THREE.Group(); scene.add(miniature);
  const boxes = new THREE.BoxGeometry(1, 1, 1);
  const column = new THREE.CylinderGeometry(.07, .07, 1, 8);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const locationGroups: THREE.Group[] = [];
  const clickTargets: THREE.Object3D[] = [];
  const markers = [new THREE.Vector3(-5.15, 1.5, .3), new THREE.Vector3(0, 4.9, -1.25), new THREE.Vector3(5, 2.7, .2)];
  const anchors = [new THREE.Vector3(-5.2, .7, 0), new THREE.Vector3(0, 2, -1.3), new THREE.Vector3(5, .8, .2)];
  function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) { const mesh = new THREE.Mesh(boxes, material); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh); return mesh; }
  function pole(parent: THREE.Object3D, x: number, y: number, z: number, h: number, material: THREE.Material) { const mesh = new THREE.Mesh(column, material); mesh.position.set(x, y, z); mesh.scale.y = h; parent.add(mesh); return mesh; }
  function line(parent: THREE.Object3D, points: THREE.Vector3[], material: THREE.LineBasicMaterial) { const mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material); parent.add(mesh); return mesh; }
  function zone(index: number) { const group = new THREE.Group(); group.userData.location = index; miniature.add(group); locationGroups.push(group); return group; }
  box(miniature, 0, -.25, 0, 17.2, .5, 8.2, black);
  box(miniature, 0, -.53, 0, 16.7, .06, 7.7, chrome);
  box(miniature, 0, .02, 0, 16.5, .045, 7.5, new THREE.MeshStandardMaterial({ color: 0x0e1511, roughness: .7 }));
  // A narrow promenade is the connecting route; the moving signal follows this exact path.
  const route = new THREE.CatmullRomCurve3([new THREE.Vector3(-7, .09, 2.5), new THREE.Vector3(-4, .09, 2.5), new THREE.Vector3(-2, .09, 1.8), new THREE.Vector3(1, .09, 1.8), new THREE.Vector3(3, .09, 2.5), new THREE.Vector3(6.8, .09, 2.5)]);
  miniature.add(new THREE.Mesh(new THREE.TubeGeometry(route, 48, .035, 5, false), red));
  const pulse = new THREE.Mesh(sphere, signal); pulse.scale.setScalar(.085); miniature.add(pulse);
  const pulses: THREE.Mesh[] = [];
  const ringGeometry = new THREE.TorusGeometry(.3, .022, 5, 28);
  anchors.forEach((anchor) => { const ring = new THREE.Mesh(ringGeometry, signal); ring.rotation.x = -Math.PI / 2; ring.position.set(anchor.x, .1, anchor.z + 1.1); miniature.add(ring); pulses.push(ring); });
  // Waterfront: ribbed listening canopy, promenade and a reflective water basin.
  const waterfront = zone(0);
  box(waterfront, -5.3, .06, -.8, 4.4, .08, 3.8, glass);
  box(waterfront, -5.2, .16, .9, 4.6, .2, 1.4, pale);
  box(waterfront, -5.2, .3, 1, 3.9, .07, .9, black);
  for (let i = 0; i < 8; i++) { const z = -2.3 + i * .43; line(waterfront, [new THREE.Vector3(-7.1, .12, z), new THREE.Vector3(-3.6, .12, z)], lineMaterial); }
  const archGeometry = new THREE.TorusGeometry(1, .055, 8, 36, Math.PI);
  for (let i = 0; i < 7; i++) { const arch = new THREE.Mesh(archGeometry, i === 3 ? red : chrome); arch.position.set(-5.2, .34, .63 + i * .13); arch.scale.set(1.48, 1.2, 1); waterfront.add(arch); }
  box(waterfront, -5.2, .57, 1, 1.2, .12, .32, red);
  // An Art Deco-inspired facade, deliberately neither a copy nor a claimed historic venue.
  const facade = zone(1);
  box(facade, 0, .18, -1.3, 3.7, .35, 2.5, pale);
  box(facade, -1.2, 1.75, -1.3, .95, 3.1, 1.75, chrome);
  box(facade, 1.2, 1.75, -1.3, .95, 3.1, 1.75, chrome);
  box(facade, 0, 2.15, -1.4, 1.65, 3.9, 1.9, pale);
  box(facade, 0, 4.3, -1.4, .9, .4, 1.6, chrome);
  box(facade, 0, 4.6, -1.4, .35, .24, 1.3, red);
  box(facade, 0, .95, -.36, .65, 1.45, .05, black);
  for (let row = 0; row < 6; row++) {
    box(facade, -1.18, .8 + row * .42, -.39, .62, .14, .06, black);
    box(facade, 1.18, .8 + row * .42, -.39, .62, .14, .06, black);
    if (row > 2) box(facade, 0, .8 + row * .42, -.41, 1.05, .08, .1, red);
  }
  for (const x of [-.62, -.42, .42, .62]) box(facade, x, 2.6, -.42, .04, 2.55, .1, chrome);
  // A roofless gathering pavilion and long table; no fictional person is introduced.
  const table = zone(2);
  box(table, 5.1, .15, 0, 4.4, .3, 3.4, chrome);
  box(table, 5.1, .32, 0, 4.1, .055, 3.1, black);
  for (const x of [3.3, 6.9]) for (const z of [-1.3, 1.3]) pole(table, x, 1.25, z, 1.9, chrome);
  box(table, 5.1, 2.2, -1.3, 3.75, .12, .14, chrome); box(table, 5.1, 2.2, 1.3, 3.75, .12, .14, chrome);
  for (let i = 0; i < 6; i++) box(table, 3.4 + i * .67, 2.2, 0, .065, .1, 2.65, i === 3 ? red : pale);
  box(table, 5.1, .95, 0, 2.8, .12, .85, red);
  for (const x of [4.05, 6.15]) { box(table, x, .65, 0, .09, .6, .55, chrome); }
  for (let i = 0; i < 3; i++) for (const z of [-.7, .7]) { box(table, 4.2 + i * .9, .59, z, .42, .08, .4, pale); box(table, 4.2 + i * .9, .81, z + Math.sign(z) * .17, .42, .42, .05, chrome); pole(table, 4.2 + i * .9, .43, z, .24, chrome); }
  for (let i = 0; i < 3; i++) { const bowl = new THREE.Mesh(sphere, pale); bowl.position.set(4.2 + i * .9, 1.05, 0); bowl.scale.set(.13, .045, .13); table.add(bowl); }
  // Sparse silhouettes establish miniature scale without inventing documentary detail.
  for (const x of [-7.5, -2.6, 2.5, 7.5]) {
    pole(miniature, x, .92, 2.9, 1.75, black);
    for (let i = 0; i < 5; i++) { const leaf = box(miniature, x, 1.82, 2.9, .7, .025, .13, chrome); leaf.rotation.y = i * Math.PI * .4; leaf.rotation.z = .15; }
  }
  locationGroups.forEach((group, index) => group.traverse(object => { object.userData.location = index; if (object instanceof THREE.Mesh) clickTargets.push(object); }));

  // Each location gets a small, deliberate structural overlay budget.
  const scanMeshes = locationGroups.flatMap(group => {
    const candidates: { mesh: THREE.Mesh; size: number }[] = [];
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.computeBoundingSphere();
      candidates.push({ mesh: object, size: (object.geometry.boundingSphere?.radius || 0) * object.scale.length() });
    });
    return candidates.sort((a, b) => b.size - a.size).slice(0, 8).map(candidate => candidate.mesh);
  });
  const xray = attachXray(renderer, [chrome, pale, black, red, glass], scanMeshes);

  let disposed = false, contextAvailable = true, raf = 0, width = 0, height = 0, inView = true, playingFilm = document.body.classList.contains('monumental-player-active'), dirty = true, active: number | null = null;
  let tween: gsap.core.Tween | undefined;
  const cameraState = { azimuth: .47, elevation: .58, radius: 25, x: 0, y: .5, z: 0 };
  const projected = new THREE.Vector3(), raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const canRender = () => !disposed && contextAvailable && inView && !document.hidden && !playingFilm;
  const cadence = createFrameCadence();
  function updateCamera() {
    target.set(cameraState.x, cameraState.y, cameraState.z);
    camera.position.set(target.x + Math.sin(cameraState.azimuth) * Math.cos(cameraState.elevation) * cameraState.radius, target.y + Math.sin(cameraState.elevation) * cameraState.radius, target.z + Math.cos(cameraState.azimuth) * Math.cos(cameraState.elevation) * cameraState.radius);
    camera.lookAt(target); camera.updateMatrixWorld();
  }
  function frame(time: number) {
    raf = 0;
    if (!canRender()) return;
    if (!cadence.ready(time)) { raf = requestAnimationFrame(frame); return; }
    updateCamera();
    if (!options.reducedMotion) { pulse.position.copy(route.getPointAt((time * .000065) % 1)); pulses.forEach((ring, index) => { const scale = 1 + Math.sin(time * .002 + index) * .08; ring.scale.setScalar(active === index ? scale * 1.6 : scale); }); }
    xray.update(!options.reducedMotion && !playingFilm);
    renderer.render(scene, camera);
    markers.forEach((position, index) => { projected.copy(position).project(camera); options.onProject(index, (projected.x + 1) * width / 2, (1 - projected.y) * height / 2, projected.z < 1 && Math.abs(projected.x) < .93 && Math.abs(projected.y) < .85); });
    dirty = false;
    if (!options.reducedMotion || tween?.isActive()) raf = requestAnimationFrame(frame);
  }
  function invalidate() { dirty = true; if (!raf && canRender()) { cadence.reset(); raf = requestAnimationFrame(frame); } }
  function fit() {
    width = host.clientWidth; height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (active === null && !tween?.isActive()) cameraState.radius = width < 500 ? 34 : 25;
    invalidate();
  }
  function select(index: number | null, immediate = false) {
    active = index;
    const anchor = index === null ? new THREE.Vector3(0, .5, 0) : anchors[index];
    const radius = index === null ? (width < 500 ? 34 : 25) : (width < 500 ? 15.5 : 12.5);
    tween?.kill();
    const values = { x: anchor.x, y: anchor.y, z: anchor.z, radius, azimuth: index === 1 ? .27 : .47, elevation: index === 1 ? .32 : .54 };
    if (options.reducedMotion || immediate) Object.assign(cameraState, values);
    else tween = gsap.to(cameraState, { ...values, duration: .9, ease: 'power3.inOut', overwrite: true, onUpdate: invalidate });
    invalidate();
  }
  let drag: { id: number; x: number; y: number; azimuth: number; moved: boolean; axis: DragAxis } | null = null;
  const canvas = renderer.domElement;
  const down = (event: PointerEvent) => { if (event.button !== 0 || drag) return; tween?.kill(); drag = { id: event.pointerId, x: event.clientX, y: event.clientY, azimuth: cameraState.azimuth, moved: false, axis: 'pending' }; canvas.setPointerCapture(event.pointerId); };
  const move = (event: PointerEvent) => { if (!drag || drag.id !== event.pointerId) return; const delta = event.clientX - drag.x; drag.axis = resolveDragAxis(delta, event.clientY - drag.y, drag.axis); if (drag.axis !== 'horizontal') return; drag.moved = true; cameraState.azimuth = drag.azimuth - delta * .006; invalidate(); };
  const up = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && drag.axis === 'pending' && Math.abs(event.clientY - drag.y) < 8) {
      const bounds = canvas.getBoundingClientRect(); pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickTargets, false)[0]; if (hit) options.onSelect(hit.object.userData.location);
    }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); drag = null;
  };
  const cancel = () => { drag = null; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
  const visibility = () => { if (!canRender()) { cancelAnimationFrame(raf); raf = 0; } else if (dirty || !options.reducedMotion) invalidate(); };
  const playback = (event: Event) => { playingFilm = Boolean((event as CustomEvent).detail?.active); visibility(); };
  const contextLost = (event: Event) => { event.preventDefault(); contextAvailable = false; tween?.kill(); options.onUnavailable(); cancelAnimationFrame(raf); raf = 0; };
  canvas.addEventListener('webglcontextlost', contextLost);
  document.addEventListener('visibilitychange', visibility); window.addEventListener('monumental:playback', playback);
  const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; visibility(); }, { threshold: .01 }); observer.observe(host);
  const resize = new ResizeObserver(fit); resize.observe(host); fit(); select(null, true);
  return { select, dispose() {
    disposed = true; cancelAnimationFrame(raf); tween?.kill(); observer.disconnect(); resize.disconnect();
    xray.dispose();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('webglcontextlost', contextLost);
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('monumental:playback', playback);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { geometries.add(object.geometry); const entries = Array.isArray(object.material) ? object.material : [object.material]; entries.forEach(material => materials.add(material)); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  } };
}
