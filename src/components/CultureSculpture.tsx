import { useEffect, useId, useRef, useState } from 'react';
import { ArrowsInSimple } from '@phosphor-icons/react/dist/csr/ArrowsInSimple';
import { ArrowsOutSimple } from '@phosphor-icons/react/dist/csr/ArrowsOutSimple';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Waveform } from '@phosphor-icons/react/dist/csr/Waveform';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { playSound } from '../services/audio';
import './sculpture.css';

type CultureSculptureProps = {
  active: number;
  onSelect: (index: number) => void;
  reducedMotion: boolean;
};

const places = ['Miami', 'Puerto Rico', 'New York', 'London', 'Tokyo', 'Rio'];
const TAU = Math.PI * 2;
type SculptureActions = { rotate: (amount: number) => void; reset: () => void; pulse: (strength: number) => void };

// A thick, twisting ribbon with four independently shaded surfaces. Unlike a
// wireframe, these broad faces catch the light as an actual manufactured object.
function ribbonGeometry(radius: number, stretch: number, width: number, phase: number) {
  const steps = 200;
  const positions: number[] = [];
  const indices: number[] = [];
  const point = (t: number) => new THREE.Vector3(
    Math.cos(t) * (radius + Math.sin(t * 3 + phase) * 0.075),
    Math.sin(t) * radius * stretch,
    Math.sin(t * 2 + phase) * 0.27,
  );
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * TAU;
    const center = point(t);
    const tangent = point(t + 0.001).sub(point(t - 0.001)).normalize();
    const radial = new THREE.Vector3(Math.cos(t), Math.sin(t), 0).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, radial).normalize();
    const twist = Math.sin(t * 2 + phase) * 0.7 + 0.24;
    const across = radial.multiplyScalar(Math.cos(twist)).addScaledVector(binormal, Math.sin(twist));
    const normal = new THREE.Vector3().crossVectors(tangent, across).normalize();
    const w = width * (0.85 + 0.2 * Math.sin(t + phase));
    // Duplicate edge vertices per face so the shallow bevel remains crisp.
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
    for (let face = 0; face < 4; face += 1) {
      for (const corner of [corners[face], corners[(face + 1) % 4]]) {
        const p = center.clone().addScaledVector(across, corner[0] * w / 2).addScaledVector(normal, corner[1] * 0.025);
        positions.push(p.x, p.y, p.z);
      }
    }
    if (i < steps) {
      for (let face = 0; face < 4; face += 1) {
        const a = i * 8 + face * 2;
        indices.push(a, a + 8, a + 1, a + 1, a + 8, a + 9);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export default function CultureSculpture({ active, onSelect, reducedMotion }: CultureSculptureProps) {
  const instructionId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const activeRef = useRef(active);
  const selectRef = useRef(onSelect);
  const reducedRef = useRef(reducedMotion);
  const pointHoveredRef = useRef(false);
  const pausedRef = useRef(false);
  const expandedRef = useRef(false);
  const pressureRef = useRef(false);
  const chargeStartedRef = useRef(0);
  const actionsRef = useRef<SculptureActions | null>(null);
  const lastPointerPulseRef = useRef(0);
  const keyChargeCanceledRef = useRef(false);
  const redrawRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [charging, setCharging] = useState(false);
  const [status, setStatus] = useState('');

  function unfold() {
    const next = !expandedRef.current;
    expandedRef.current = next;
    setExpanded(next);
    playSound(next ? 'sculpture-unfold' : 'sculpture-fold');
    setStatus(next ? 'Sculpture unfolded. The core is revealed.' : 'Sculpture reassembled.');
    redrawRef.current?.();
  }
  function charge() {
    if (pressureRef.current) return;
    pressureRef.current = true;
    chargeStartedRef.current = performance.now();
    setCharging(true);
    redrawRef.current?.();
  }
  function resonate() {
    const strength = pressureRef.current ? Math.min(1, 0.4 + (performance.now() - chargeStartedRef.current) / 1250) : 0.65;
    pressureRef.current = false;
    setCharging(false);
    actionsRef.current?.pulse(strength);
    playSound('sculpture-pulse', { intensity: strength });
    setStatus(`Signal sent to ${places[activeRef.current]}.`);
  }
  function cancelCharge() {
    pressureRef.current = false;
    setCharging(false);
    redrawRef.current?.();
  }
  function togglePause() {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    playSound('select');
    setStatus(pausedRef.current ? 'Idle motion paused. You can still explore and rotate.' : 'Idle motion resumed.');
    redrawRef.current?.();
  }
  function reset() {
    actionsRef.current?.reset();
    expandedRef.current = false;
    setExpanded(false);
    cancelCharge();
    playSound('sculpture-reset');
    setStatus('Sculpture returned to its starting position.');
  }

  useEffect(() => {
    const changed = activeRef.current !== active;
    activeRef.current = active;
    if (changed) actionsRef.current?.pulse(0.65);
    redrawRef.current?.();
  }, [active]);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    reducedRef.current = reducedMotion;
    redrawRef.current?.();
  }, [reducedMotion]);

  useEffect(() => {
    const host = hostRef.current;
    const mount = canvasRef.current;
    if (!host || !mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      setFallback(true);
      return;
    }
    const modestHardware = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, modestHardware ? 1.25 : 1.7));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(0, 0.06, 8.9);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    // A black photographic studio retains negative reflections; an unmodified
    // white RoomEnvironment makes the polished bands read as blown-out plastic.
    room.traverse(object => {
      if (object instanceof THREE.Light) object.intensity *= 0.45;
      if (object instanceof THREE.Mesh) {
        const material = object.material;
        if (material instanceof THREE.MeshStandardMaterial) material.color.set(0x080a09);
        if (material instanceof THREE.MeshLambertMaterial) material.emissiveIntensity *= 0.45;
      }
    });
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 1;
    room.dispose();
    pmrem.dispose();

    const sculpture = new THREE.Group();
    sculpture.rotation.set(0.12, -0.22, -0.28);
    scene.add(sculpture);
    const orbitAssembly = new THREE.Group();
    sculpture.add(orbitAssembly);
    const chrome = new THREE.MeshPhysicalMaterial({
      color: 0xb5b8b0, metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08,
    });
    const paleChrome = new THREE.MeshPhysicalMaterial({
      color: 0xe2e3da, metalness: 0.96, roughness: 0.13, clearcoat: 1,
    });
    const darkChrome = new THREE.MeshPhysicalMaterial({
      color: 0x32372f, metalness: 1, roughness: 0.2, clearcoat: 0.7,
    });
    const orange = new THREE.MeshStandardMaterial({ color: 0xff4d32, emissive: 0xff3010, emissiveIntensity: 1.5, roughness: 0.45, metalness: 0.25 });
    const signalMaterial = new THREE.MeshBasicMaterial({ color: 0xff4d32 });

    // Three differently canted continuous metal bands make the silhouette.
    const bands: THREE.Mesh[] = [];
    const bandRotations = [[0.38, 0.12, -0.18], [0.76, 1.12, 0.57], [-0.65, -0.92, -0.28]];
    bandRotations.forEach((rotation, i) => {
      const band = new THREE.Mesh(ribbonGeometry(1.36 + i * 0.035, 1.2, i === 0 ? 0.31 : 0.24, i * 1.8), i === 1 ? paleChrome : chrome);
      band.rotation.set(rotation[0], rotation[1], rotation[2]);
      orbitAssembly.add(band);
      bands.push(band);
    });

    // A curved spinal shell, built from solid ribs of different lengths.
    // Its open faces reveal the core rather than closing into a generic sphere.
    const shell = new THREE.Group();
    shell.rotation.set(0.28, -0.38, 0.18);
    sculpture.add(shell);
    const ribs: THREE.Mesh[] = [];
    for (let i = 0; i < 36; i += 1) {
      const latitude = -1.18 + (i / 35) * 2.36;
      const radius = Math.sqrt(Math.max(0.12, 1 - (latitude / 1.4) ** 2)) * 1.16;
      const points: THREE.Vector3[] = [];
      for (let n = 0; n <= 90; n += 1) {
        const t = -0.38 + (n / 90) * Math.PI * 1.54;
        const skew = latitude * 0.28;
        points.push(new THREE.Vector3(Math.cos(t + skew) * radius, latitude, Math.sin(t + skew) * radius * 0.78));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 0.02, 6, false), i % 9 === 0 ? paleChrome : chrome);
      shell.add(rib);
      ribs.push(rib);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.49, 48, 32), darkChrome);
    core.scale.set(1, 1.12, 1);
    sculpture.add(core);
    const coreSignal = new THREE.Mesh(new THREE.TorusGeometry(0.747, 0.016, 8, 120), orange);
    coreSignal.rotation.x = Math.PI / 2.35;
    sculpture.add(coreSignal);

    // The assembly has an actual interior, revealed by the Unfold control.
    const turbine = new THREE.Group();
    sculpture.add(turbine);
    const innerRings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.59 + i * 0.12, 0.014 + i * 0.004, 8, 72, Math.PI * 1.65), i === 1 ? orange : paleChrome);
      ring.rotation.set(i * 0.75, i * 0.9 + 0.2, i * 1.5);
      turbine.add(ring);
      innerRings.push(ring);
    }
    const corePins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.013, 0.013, 0.1, 5), chrome, 36);
    const pinTransform = new THREE.Object3D();
    for (let i = 0; i < 36; i += 1) {
      const angle = i / 36 * TAU;
      pinTransform.position.set(Math.cos(angle) * 0.63, Math.sin(angle) * 0.63, 0);
      pinTransform.rotation.z = angle - Math.PI / 2;
      pinTransform.updateMatrix();
      corePins.setMatrixAt(i, pinTransform.matrix);
    }
    turbine.add(corePins);

    // Fine exposed engineering details: a meridian collar and six fasteners.
    const collar = new THREE.Mesh(new THREE.TorusGeometry(1.91, 0.018, 8, 160), darkChrome);
    collar.rotation.set(0.74, 0.32, -0.2);
    sculpture.add(collar);
    const accentArc = new THREE.Mesh(new THREE.TorusGeometry(1.915, 0.021, 8, 36, 0.43), orange);
    accentArc.rotation.copy(collar.rotation);
    sculpture.add(accentArc);
    const satellites: THREE.Mesh[] = [];
    const satelliteGroup = new THREE.Group();
    satelliteGroup.rotation.set(0.2, -0.12, 0.28);
    sculpture.add(satelliteGroup);
    for (let i = 0; i < places.length; i += 1) {
      const a = i / places.length * TAU + Math.PI / 7;
      const node = new THREE.Mesh(new THREE.IcosahedronGeometry(0.047, 1), signalMaterial);
      node.position.set(Math.cos(a) * 2.05, Math.sin(a) * 1.96, Math.sin(a * 2) * 0.28);
      satelliteGroup.add(node);
      satellites.push(node);
      const socket = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.009, 6, 24), chrome);
      socket.position.copy(node.position);
      satelliteGroup.add(socket);
    }

    // One authored transmission, from the core to the selected destination.
    // Everything is allocated once; a gesture updates buffer positions only.
    const pathPositions = new Float32Array(40 * 3);
    const pathGeometry = new THREE.BufferGeometry();
    pathGeometry.setAttribute('position', new THREE.BufferAttribute(pathPositions, 3).setUsage(THREE.DynamicDrawUsage));
    const pathMaterial = new THREE.LineBasicMaterial({ color: 0xff704c, transparent: true, opacity: 0, depthWrite: false });
    const signalPath = new THREE.Line(pathGeometry, pathMaterial);
    sculpture.add(signalPath);
    const pulseBeads: THREE.Mesh[] = [];
    const beadGeometry = new THREE.SphereGeometry(0.025, 8, 6);
    for (let i = 0; i < 6; i += 1) {
      const bead = new THREE.Mesh(beadGeometry, new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffe4cc : 0xff4d32, transparent: true, opacity: 0, depthWrite: false }));
      bead.visible = false;
      sculpture.add(bead);
      pulseBeads.push(bead);
    }
    const receivingRingMaterial = new THREE.MeshBasicMaterial({ color: 0xff4d32, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const receivingRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 36), receivingRingMaterial);
    sculpture.add(receivingRing);
    const waveMaterial = new THREE.MeshBasicMaterial({ color: 0xff5c3f, transparent: true, opacity: 0, depthWrite: false });
    const resonanceWave = new THREE.Mesh(new THREE.TorusGeometry(1, 0.008, 6, 96), waveMaterial);
    resonanceWave.rotation.set(0.7, 0.3, -0.2);
    sculpture.add(resonanceWave);

    const key = new THREE.DirectionalLight(0xfff7e6, 2.2);
    key.position.set(-3, 5, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 1.8);
    rim.position.set(4, 1, -3);
    scene.add(rim);
    const ember = new THREE.PointLight(0xff4d32, 5, 6, 2);
    ember.position.set(-2.4, -1.8, 2.4);
    scene.add(ember);

    let disposed = false;
    let visible = true;
    let failed = false;
    let playbackActive = false;
    let frame = 0;
    let width = 1;
    let height = 1;
    let time = 0;
    let previousTime = 0;
    let pointerX = 0;
    let pointerY = 0;
    let rotationX = 0;
    let rotationY = 0;
    let dragRotation = 0;
    let dragTarget = 0;
    let dragPitch = 0;
    let pitchTarget = 0;
    let angularVelocity = 0;
    let lastDragX = 0;
    let lastDragTime = 0;
    let dragDistance = 0;
    let capturedPointer: number | null = null;
    let dragging = false;
    let dragOriginX = 0;
    let dragOriginY = 0;
    let dragStart = 0;
    let activeAngle = activeRef.current * 0.16;
    let opening = 0;
    let pressure = 0;
    let pulseAge = 3;
    let pulseStrength = 0;
    let sonicEnergy = 0;
    let resetPending = false;
    let slowFrames = 0;
    let balancedQuality = modestHardware;
    const projected = new THREE.Vector3();
    const world = new THREE.Vector3();
    const endpoint = new THREE.Vector3();
    const midpoint = new THREE.Vector3();
    const curvePoint = new THREE.Vector3();
    const facingCamera = new THREE.Quaternion();
    const transmissionCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());

    const startPulse = (strength: number) => {
      pulseAge = 0;
      pulseStrength = THREE.MathUtils.clamp(strength, 0.2, 1);
      const selected = satellites[THREE.MathUtils.clamp(activeRef.current, 0, satellites.length - 1)];
      endpoint.copy(selected.position).applyEuler(satelliteGroup.rotation);
      midpoint.copy(endpoint).multiplyScalar(0.52);
      midpoint.z += 0.68;
      transmissionCurve.v1.copy(midpoint);
      transmissionCurve.v2.copy(endpoint);
      receivingRing.position.copy(endpoint);
      for (let i = 0; i < 40; i += 1) {
        transmissionCurve.getPoint(i / 39, curvePoint);
        pathPositions[i * 3] = curvePoint.x;
        pathPositions[i * 3 + 1] = curvePoint.y;
        pathPositions[i * 3 + 2] = curvePoint.z;
      }
      pathGeometry.attributes.position.needsUpdate = true;
      pathGeometry.computeBoundingSphere();
      requestDraw();
    };

    const draw = (now: number) => {
      frame = 0;
      if (disposed || failed || !visible || document.hidden || playbackActive) return;
      // Bound GPU work on 120/144 Hz displays, without slowing gesture input.
      if (previousTime && now - previousTime < 15) { frame = requestAnimationFrame(draw); return; }
      const dt = previousTime ? Math.min((now - previousTime) / 1000, 0.04) : 0.016;
      if (previousTime && now - previousTime > 32 && !balancedQuality) slowFrames += 1;
      if (slowFrames > 150 && !balancedQuality) {
        balancedQuality = true;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        renderer.setSize(width, height);
      }
      previousTime = now;
      const reduced = reducedRef.current;
      const frozen = pointHoveredRef.current;
      const idle = !reduced && !pausedRef.current;
      if (idle && !frozen) time += dt;
      const ease = reduced ? 1 : 1 - Math.exp(-dt * 4.5);
      const morphEase = reduced ? 1 : 1 - Math.exp(-dt * 3.8);
      opening += ((expandedRef.current ? 1 : 0) - opening) * morphEase;
      pressure += ((pressureRef.current ? Math.min(1, (now - chargeStartedRef.current) / 1200) : 0) - pressure) * (reduced ? 1 : 1 - Math.exp(-dt * 7));
      pulseAge = Math.min(3, pulseAge + dt);
      const impulse = pulseStrength * Math.exp(-pulseAge * 3.8);
      sonicEnergy *= Math.exp(-dt * 5);
      const energy = Math.max(impulse, sonicEnergy);
      host.style.setProperty('--charge', pressure.toFixed(3));
      if (!frozen || reduced) {
        if (!dragging && !reduced) {
          dragTarget += angularVelocity * dt;
          angularVelocity *= Math.exp(-dt * 3.6);
        }
        if (reduced) angularVelocity = 0;
        rotationX += ((reduced ? 0 : pointerY * 0.1) - rotationX) * ease;
        rotationY += ((reduced ? 0 : pointerX * 0.15) - rotationY) * ease;
        dragRotation += (dragTarget - dragRotation) * ease;
        dragPitch += (pitchTarget - dragPitch) * ease;
        activeAngle += (activeRef.current * 0.16 - activeAngle) * ease;
      }
      sculpture.rotation.x = 0.12 + rotationX + dragPitch;
      sculpture.rotation.y = -0.22 + rotationY + dragRotation + activeAngle;
      sculpture.position.y = reduced ? 0 : Math.sin(time * 0.56) * 0.045;
      const breathe = reduced ? 0 : Math.sin(time * 0.7) * 0.005;
      orbitAssembly.rotation.y = (reduced ? 0.08 : Math.sin(time * 0.15) * 0.12) + opening * 0.2;
      bands.forEach((band, i) => {
        const spread = opening * (i + 1) * 0.045;
        band.scale.setScalar(1 + spread + breathe + (reduced ? 0 : pressure * 0.035 + energy * 0.018));
        band.rotation.x = bandRotations[i][0] + opening * (i === 1 ? -0.26 : 0.2);
        band.rotation.z = bandRotations[i][2] + opening * (i - 1) * 0.22;
        band.position.z = opening * (i - 1) * 0.16;
      });
      ribs.forEach((rib, i) => {
        const latitude = -1.18 + i / 35 * 2.36;
        const wave = reduced ? 0 : Math.sin(i * 0.28 - pulseAge * 10) * impulse * 0.025;
        rib.position.y = latitude * opening * 0.22;
        rib.scale.set(1 + opening * 0.13 + breathe + wave, 1, 1 + opening * 0.13 + breathe + wave);
        rib.rotation.y = opening * Math.sin(i / 35 * Math.PI) * 0.15;
      });
      shell.rotation.y = -0.38 - opening * 1.9 + (reduced ? 0 : Math.sin(time * 0.18) * 0.035);
      coreSignal.rotation.z = reduced ? 0 : time * 0.035;
      turbine.rotation.y = reduced ? opening * 0.3 : time * 0.055 + opening * 0.3;
      innerRings.forEach((ring, i) => {
        ring.rotation.z = i * 1.5 + (reduced ? 0 : time * 0.045 * (i % 2 ? -1 : 1));
        ring.scale.setScalar(1 + opening * 0.06 + (reduced ? 0 : pressure * 0.09));
      });
      core.scale.set(1 - pressure * 0.035, 1.12 - pressure * 0.035, 1 - pressure * 0.035);
      orange.emissiveIntensity = 1.25 + opening * 0.4 + pressure * 1.5 + energy * 2.2;
      ember.intensity = 5 + pressure * 3 + energy * 4;
      ember.position.x = -2.4 + rotationY * 3.5;
      ember.position.y = -1.8 - rotationX * 3.5;
      key.position.x = -3 + rotationY * 5;
      key.position.y = 5 - rotationX * 3;
      chrome.roughness = 0.14 - pressure * 0.035;
      const flight = pulseAge / 1.1;
      pathMaterial.opacity = reduced ? 0 : Math.max(0, 0.24 * pulseStrength * (1 - pulseAge / 1.8));
      pulseBeads.forEach((bead, i) => {
        const progress = flight - i * 0.045;
        bead.visible = !reduced && progress >= 0 && progress <= 1;
        if (bead.visible) {
          transmissionCurve.getPoint(progress, bead.position);
          (bead.material as THREE.MeshBasicMaterial).opacity = (1 - i / 7) * pulseStrength;
          bead.scale.setScalar(i === 0 ? 1.5 : 1 - i * 0.08);
        }
      });
      const arrival = Math.max(0, (pulseAge - 1.0) / 0.7);
      receivingRing.visible = !reduced && arrival > 0 && arrival < 1;
      receivingRingMaterial.opacity = (1 - arrival) * pulseStrength * 0.75;
      receivingRing.scale.setScalar(1 + arrival * 4);
      facingCamera.copy(sculpture.quaternion).invert().multiply(camera.quaternion);
      receivingRing.quaternion.copy(facingCamera);
      resonanceWave.visible = !reduced && pulseAge < 1;
      resonanceWave.scale.setScalar(0.65 + pulseAge * 1.2);
      waveMaterial.opacity = Math.max(0, 1 - pulseAge) * pulseStrength * 0.28;
      satellites.forEach((node, i) => node.scale.setScalar(i === activeRef.current ? 1.7 : 1));
      renderer.render(scene, camera);
      for (let i = 0; i < satellites.length; i += 1) {
        const button = buttonsRef.current[i];
        if (!button) continue;
        satellites[i].getWorldPosition(world);
        projected.copy(world).project(camera);
        const x = (projected.x * 0.5 + 0.5) * width;
        const y = (-projected.y * 0.5 + 0.5) * height;
        button.style.setProperty('--point-x', `${x.toFixed(1)}px`);
        button.style.setProperty('--point-y', `${y.toFixed(1)}px`);
        button.style.setProperty('--point-depth', `${world.z < -0.6 ? 0.58 : 1}`);
        button.dataset.labelSide = x > width * 0.67 ? 'left' : 'right';
      }
      const rotationSettling = Math.abs(activeAngle - activeRef.current * 0.16) + Math.abs(dragTarget - dragRotation) + Math.abs(pitchTarget - dragPitch) + Math.abs((reduced ? 0 : pointerY * 0.1) - rotationX) + Math.abs((reduced ? 0 : pointerX * 0.15) - rotationY) + Math.abs(angularVelocity) > 0.003;
      const settling = (!frozen && rotationSettling) || Math.abs((expandedRef.current ? 1 : 0) - opening) > 0.003;
      if (resetPending && !settling) resetPending = false;
      if (idle || dragging || pressureRef.current || pressure > 0.005 || pulseAge < 2.1 || sonicEnergy > 0.005 || settling || resetPending) frame = requestAnimationFrame(draw);
    };
    const requestDraw = () => {
      if (!disposed && !frame && visible && !document.hidden && !failed && !playbackActive) frame = requestAnimationFrame(draw);
    };
    redrawRef.current = requestDraw;
    actionsRef.current = {
      rotate: amount => { dragTarget += amount; angularVelocity = 0; pointHoveredRef.current = false; requestDraw(); },
      reset: () => { dragTarget = 0; pitchTarget = 0; angularVelocity = 0; pointHoveredRef.current = false; pointerX = 0; pointerY = 0; resetPending = true; requestDraw(); },
      pulse: startPulse,
    };
    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(bounds.width, 1);
      height = Math.max(bounds.height, 1);
      camera.aspect = width / height;
      // Preserve the complete sculpture on a narrow phone screen.
      camera.position.z = camera.aspect < 0.8 ? 12.3 : camera.aspect < 1.15 ? 10.2 : 8.9;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      requestDraw();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      previousTime = 0;
      if (visible) requestDraw();
      else if (frame) { cancelAnimationFrame(frame); frame = 0; }
    }, { rootMargin: '100px' });
    intersectionObserver.observe(host);
    const visibilityChange = () => {
      previousTime = 0;
      if (document.hidden) { angularVelocity = 0; pressureRef.current = false; setCharging(false); }
      if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
      else requestDraw();
    };
    const pointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest('button') || event.button !== 0 || !event.isPrimary) return;
      dragging = true;
      capturedPointer = event.pointerId;
      angularVelocity = 0;
      dragOriginX = event.clientX;
      dragOriginY = event.clientY;
      lastDragX = event.clientX;
      lastDragTime = event.timeStamp;
      dragDistance = 0;
      dragStart = dragTarget;
      host.classList.add('is-dragging');
      if (event.pointerType !== 'touch') host.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointerX = ((event.clientX - bounds.left) / width - 0.5) * 2;
      pointerY = ((event.clientY - bounds.top) / height - 0.5) * 2;
      if (dragging) {
        if (event.pointerId !== capturedPointer) return;
        const dx = event.clientX - dragOriginX;
        const dy = event.clientY - dragOriginY;
        if (event.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx) + 8) {
          dragging = false;
          angularVelocity = 0;
          host.classList.remove('is-dragging');
        } else {
          const sensitivity = TAU * 0.62 / Math.max(320, width);
          dragTarget = dragStart + dx * sensitivity;
          if (event.pointerType !== 'touch') pitchTarget = THREE.MathUtils.clamp(dy * 0.0014, -0.32, 0.32);
          const delta = Math.max(8, event.timeStamp - lastDragTime) / 1000;
          const instantaneousVelocity = THREE.MathUtils.clamp((event.clientX - lastDragX) * sensitivity / delta, -2.4, 2.4);
          angularVelocity = angularVelocity * 0.55 + instantaneousVelocity * 0.45;
          lastDragX = event.clientX;
          lastDragTime = event.timeStamp;
          dragDistance = Math.max(dragDistance, Math.abs(dx));
        }
      }
      if (!reducedRef.current || dragging) requestDraw();
    };
    const pointerUp = (event: PointerEvent) => {
      if (capturedPointer !== event.pointerId) return;
      const wasDragging = dragging;
      dragging = false;
      capturedPointer = null;
      if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
      if (event.type === 'pointercancel' || event.timeStamp - lastDragTime > 100 || reducedRef.current) angularVelocity = 0;
      if (wasDragging && dragDistance > 18 && event.type !== 'pointercancel') playSound('sculpture-turn', { intensity: Math.min(0.65, 0.25 + Math.abs(angularVelocity) / 5), pan: pointerX * 0.5 });
      host.classList.remove('is-dragging');
      requestDraw();
    };
    const pointerLeave = () => { pointerX = 0; pointerY = 0; if (!dragging) requestDraw(); };
    const contextLost = (event: Event) => {
      event.preventDefault();
      failed = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      setFallback(true);
    };
    const sonicPulse = (event: Event) => {
      if (!visible || document.hidden) return;
      const detail = (event as CustomEvent<{ type?: string; intensity?: number }>).detail;
      if (!detail || !Number.isFinite(detail.intensity)) return;
      // Sound feedback brightens the same mechanism; it never starts new sound.
      sonicEnergy = Math.max(sonicEnergy, THREE.MathUtils.clamp(detail.intensity ?? 0.5, 0, 1) * 0.65);
      requestDraw();
    };
    const playbackChange = (event: Event) => {
      playbackActive = !!(event as CustomEvent<{ active?: boolean }>).detail?.active;
      previousTime = 0;
      if (playbackActive && frame) { cancelAnimationFrame(frame); frame = 0; }
      else requestDraw();
    };
    host.addEventListener('pointerdown', pointerDown);
    host.addEventListener('pointermove', pointerMove);
    host.addEventListener('pointerup', pointerUp);
    host.addEventListener('pointercancel', pointerUp);
    host.addEventListener('pointerleave', pointerLeave);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', visibilityChange);
    window.addEventListener('monumental:sonic-pulse', sonicPulse);
    window.addEventListener('monumental:playback', playbackChange);
    resize();
    setReady(true);
    requestDraw();

    return () => {
      disposed = true;
      redrawRef.current = null;
      actionsRef.current = null;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      window.removeEventListener('monumental:sonic-pulse', sonicPulse);
      window.removeEventListener('monumental:playback', playbackChange);
      host.removeEventListener('pointerdown', pointerDown);
      host.removeEventListener('pointermove', pointerMove);
      host.removeEventListener('pointerup', pointerUp);
      host.removeEventListener('pointercancel', pointerUp);
      host.removeEventListener('pointerleave', pointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach(material => materials.add(material));
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      environment.dispose();
      renderer.dispose();
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={hostRef} className={`culture-sculpture${ready ? ' is-ready' : ''}${fallback ? ' has-fallback' : ''}${expanded ? ' is-unfolded' : ''}${charging ? ' is-charging' : ''}${paused ? ' is-paused' : ''}`} role="group" tabIndex={fallback ? -1 : 0} aria-label="Interactive cultural sculpture" aria-describedby={instructionId} onKeyDown={event => {
      if (event.target !== event.currentTarget || fallback) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        actionsRef.current?.rotate(event.key === 'ArrowLeft' ? -0.24 : 0.24);
        playSound('sculpture-turn', { intensity: 0.35 });
      } else if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) unfold(); }
      else if (event.key === ' ') { event.preventDefault(); if (!event.repeat) resonate(); }
      else if (event.key === 'Escape') { event.preventDefault(); reset(); }
    }}>
      <div ref={canvasRef} className="culture-sculpture__canvas" />
      <div className="culture-sculpture__fallback" aria-hidden="true"><i /><i /><i /><span /></div>
      <div className="culture-sculpture__points">
        {places.map((place, index) => (
          <button
            key={place}
            ref={element => { buttonsRef.current[index] = element; }}
            className={`culture-sculpture__point${active === index ? ' is-active' : ''}`}
            type="button"
            aria-label={`Explore ${place}`}
            aria-pressed={active === index}
            onPointerEnter={() => { pointHoveredRef.current = true; }}
            onPointerLeave={() => { pointHoveredRef.current = false; redrawRef.current?.(); }}
            onClick={() => { if (index === activeRef.current) actionsRef.current?.pulse(0.5); selectRef.current(index); }}
            data-sound-owned="true"
            style={{ '--fallback-x': `${50 + Math.cos(index / 6 * TAU) * 32}%`, '--fallback-y': `${50 + Math.sin(index / 6 * TAU) * 32}%` } as React.CSSProperties}
          >
            <span className="culture-sculpture__point-ring" />
            <span className="culture-sculpture__point-name"><small>{String(index + 1).padStart(2, '0')}</small>{place}</span>
          </button>
        ))}
      </div>
      <div className="culture-sculpture__interaction">
        <p id={instructionId} className="culture-sculpture__instruction"><span />{fallback ? 'Select a destination to explore' : 'Drag to turn. Select a signal to explore.'}<span className="culture-sculpture__keyboard">Arrow keys turn · Enter unfolds · Space pulses</span></p>
        {!fallback && <div className="culture-sculpture__controls" role="group" aria-label="Sculpture controls">
          <button type="button" className="culture-sculpture__tool culture-sculpture__tool--unfold" onClick={unfold} aria-pressed={expanded} data-sound-owned="true">{expanded ? <ArrowsInSimple size={17}/> : <ArrowsOutSimple size={17}/>}<span>{expanded ? 'Reassemble' : 'Unfold'}</span></button>
          <button type="button" className="culture-sculpture__tool culture-sculpture__tool--pulse" aria-label="Resonate. Hold to charge, release to send a signal." data-sound-owned="true" onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); charge(); }} onPointerUp={event => { if (!pressureRef.current) return; lastPointerPulseRef.current = performance.now(); resonate(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={cancelCharge} onKeyDown={event => { if (event.key === ' ' && !event.repeat) { keyChargeCanceledRef.current = false; charge(); } if (event.key === 'Escape') { keyChargeCanceledRef.current = true; cancelCharge(); } }} onKeyUp={event => { if (event.key === ' ' && keyChargeCanceledRef.current) { event.preventDefault(); keyChargeCanceledRef.current = false; } }} onClick={event => { if (event.detail === 0 || performance.now() - lastPointerPulseRef.current > 350) resonate(); }} onBlur={cancelCharge}><Waveform size={17}/><span>{charging ? 'Charging' : 'Resonate'}</span></button>
          <button type="button" className="culture-sculpture__tool culture-sculpture__tool--icon" onClick={togglePause} aria-label={paused ? 'Resume idle motion' : 'Pause idle motion'} aria-pressed={paused} title={paused ? 'Resume idle motion' : 'Pause idle motion'} data-sound-owned="true">{paused ? <Play size={17}/> : <Pause size={17}/>}</button>
          <button type="button" className="culture-sculpture__tool culture-sculpture__tool--icon" onClick={reset} aria-label="Reset sculpture" title="Reset sculpture" data-sound-owned="true"><ArrowCounterClockwise size={17}/></button>
        </div>}
      </div>
      <span className="culture-sculpture__status" aria-live="polite" aria-atomic="true">{status}</span>
    </div>
  );
}
