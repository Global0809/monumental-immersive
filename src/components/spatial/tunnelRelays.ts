import * as THREE from 'three';
import type { TunnelLifeFrame } from '../../services/tunnelLife';
import { tunnelStationZ } from '../../services/tunnelJourney';
import { mechanismAwakening, relayPartIndex } from '../../services/passageMechanisms';

const TAU = Math.PI * 2;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const p = clamp(v); return p * p * (3 - 2 * p); };

/** A small family of tactile relay instruments. The passage renderer owns time,
 * pointer input and scroll. This module owns only local mechanical transforms. */
export function createTunnelRelays(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [];
  const root = new THREE.Group(); root.name = 'tunnel-living-relays'; scene.add(root);
  const hero = new THREE.Group(); hero.name = 'tunnel-hero-relay'; root.add(hero);
  const travel = new THREE.Group(); travel.name = 'tunnel-travel-relays'; root.add(travel);
  const mechanism = new THREE.Group(); hero.add(mechanism);
  const dummy = new THREE.Object3D(), unit = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  const rodStart = new THREE.Vector3(), rodEnd = new THREE.Vector3(), rodDirection = new THREE.Vector3(), rodAxis = new THREE.Vector3(0, 1, 0);
  const hitObjects: THREE.Object3D[] = [], hits: THREE.Intersection[] = [];
  let destroyed = false, expanded = false, opening = 0, phase = 0, pointerX = 0, pointerY = 0, boundsDirty = true;
  let selectedPart: number | null = null;
  let partPull: number | null = null;
  const partAmounts = new Float32Array(6), lastParts = new Float32Array(6);

  const ownGeometry = <T extends THREE.BufferGeometry>(g: T) => { geometries.add(g); return g; };
  const ownMaterial = <T extends THREE.Material>(m: T) => { materials.add(m); return m; };
  const chrome = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xd0d6d3, metalness: 1, roughness: .10, envMapIntensity: 1.2 }));
  const dark = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x151a18, metalness: .76, roughness: .31, envMapIntensity: .75 }));
  const ivory = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xe3e0d3, metalness: .18, roughness: .34 }));
  const brushed = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x646d67, metalness: .86, roughness: .38 }));
  const signal = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xff4d32, emissive: 0xff4d32, emissiveIntensity: .35, metalness: .45, roughness: .3 }));
  const lamp = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xff6148, toneMapped: false }));
  const shellChrome = ownMaterial(chrome.clone());
  shellChrome.userData.passageShell = true;
  brushed.userData.passageInternal = true;

  function contour(points: readonly (readonly [number, number])[], depth: number, bevel: number) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 1 });
    g.translate(0, 0, -depth / 2); return ownGeometry(g);
  }
  // Each shell is an asymmetric machined leaf rather than a slice of a torus.
  // The broad bevel catches the existing scene environment; the cut-in waist
  // exposes the moving piston and core through the assembled silhouette.
  const leaf = contour([[.98, -.24], [1.4, -.4], [1.85, -.29], [2.02, -.08], [1.93, .18], [1.48, .34], [1.03, .23], [1.19, .015]], .23, .045);
  const inlay = contour([[1.39, -.28], [1.78, -.20], [1.88, -.065], [1.82, .095], [1.50, .22], [1.37, .18]], .045, .023);
  const shoulder = contour([[.85, -.13], [1.29, -.21], [1.62, -.10], [1.58, .10], [1.23, .19], [.85, .12]], .18, .025);
  const cylinder = ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  // Hollow collars expose the rotating red core through the entire assembly.
  // A capped cylinder would read as a flat dark disk from the arrival camera.
  const collarGeometry = ownGeometry(new THREE.LatheGeometry([
    new THREE.Vector2(.82, -.5), new THREE.Vector2(1, -.5),
    new THREE.Vector2(1, .5), new THREE.Vector2(.82, .5), new THREE.Vector2(.82, -.5),
  ], 32));
  const smallCylinder = ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 8));
  const box = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const coreGeometry = ownGeometry(new THREE.IcosahedronGeometry(.46, 0));

  function brokenGimbal(radius: number, width: number, depth: number) {
    const shapes: THREE.Shape[] = [];
    for (let sector = 0; sector < 3; sector++) {
      const shape = new THREE.Shape(), start = sector * TAU / 3 + .15, length = TAU / 3 - .42;
      for (let i = 0; i <= 12; i++) { const a = start + length * i / 12; const x = Math.cos(a) * radius, y = Math.sin(a) * radius; i ? shape.lineTo(x, y) : shape.moveTo(x, y); }
      for (let i = 12; i >= 0; i--) { const a = start + length * i / 12; shape.lineTo(Math.cos(a) * (radius - width), Math.sin(a) * (radius - width)); }
      shape.closePath(); shapes.push(shape);
    }
    const g = new THREE.ExtrudeGeometry(shapes, { depth, steps: 1, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 1, curveSegments: 1 });
    g.translate(0, 0, -depth / 2); return ownGeometry(g);
  }
  const gimbalGeometry = brokenGimbal(1.03, .085, .09);
  const innerGimbalGeometry = brokenGimbal(.78, .09, .10);

  function batch(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, count: number, interactive = false) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    instances.push(mesh); parent.add(mesh); if (interactive) hitObjects.push(mesh); return mesh;
  }
  function put(mesh: THREE.InstancedMesh, index: number) { dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix); }
  function finish(mesh: THREE.InstancedMesh) { mesh.instanceMatrix.needsUpdate = true; }
  const shells = batch(mechanism, leaf, shellChrome, 6, true);
  const inlays = batch(mechanism, inlay, ivory, 6, true);
  shells.name = 'relay-shell-components'; inlays.name = 'relay-shell-inlays';
  const shoulders = batch(mechanism, shoulder, dark, 6, true);
  const barrels = batch(mechanism, cylinder, brushed, 6);
  const shafts = batch(mechanism, cylinder, chrome, 6);
  const pivots = batch(mechanism, smallCylinder, dark, 12);
  const indicators = batch(mechanism, box, lamp, 6);
  const internals = batch(mechanism, box, brushed, 30);
  const collars = batch(mechanism, collarGeometry, brushed, 3, true);
  const cage = batch(mechanism, box, ivory, 6);
  const gimbals = [new THREE.Mesh(gimbalGeometry, chrome), new THREE.Mesh(gimbalGeometry, dark), new THREE.Mesh(innerGimbalGeometry, ivory)];
  gimbals.forEach(mesh => { mechanism.add(mesh); hitObjects.push(mesh); });
  const core = new THREE.Mesh(coreGeometry, signal); mechanism.add(core); hitObjects.push(core);
  const rearCore = new THREE.Mesh(cylinder, dark); rearCore.rotation.x = Math.PI / 2; rearCore.scale.set(.37, .18, .37); rearCore.position.z = -.58; mechanism.add(rearCore);

  // The travel family shares five instanced draw calls across every gap.
  // Their world-space anchors never chase the camera or sit in reading scenes.
  const relayCount = 5, travelLeaves = batch(travel, leaf, shellChrome, relayCount * 6);
  const travelInlays = batch(travel, inlay, ivory, relayCount * 6);
  const travelShafts = batch(travel, cylinder, dark, relayCount * 6);
  const travelGimbals = batch(travel, gimbalGeometry, brushed, relayCount);
  const travelCores = batch(travel, coreGeometry, lamp, relayCount);
  const anchors = Array.from({ length: relayCount }, (_, i) => {
    const angle = .65 + i * 2.1;
    return { x: Math.cos(angle) * 6.6, y: Math.sin(angle) * 6.6, z: tunnelStationZ(i) - 16, angle };
  });

  // Immutable assembly details are uploaded once.
  for (let i = 0; i < 3; i++) {
    dummy.position.set(0, 0, -.43 + i * .43); dummy.rotation.set(Math.PI / 2, 0, 0); dummy.scale.set(i === 1 ? .55 : .46, .075, i === 1 ? .55 : .46); put(collars, i);
  }
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    dummy.position.set(Math.cos(a) * .50, Math.sin(a) * .50, -.04); dummy.rotation.set(0, 0, a); dummy.scale.set(.055, .07, .87); put(cage, i);
  }
  finish(collars); finish(cage);

  function writeHero() {
    for (let i = 0; i < 6; i++) {
      const angle = i * TAU / 6, c = Math.cos(angle), s = Math.sin(angle);
      const part = partAmounts[i], spread = opening * .48 + part * .78;
      // Inner and outer sleeves remain connected during an exploded inspection.
      const leafZ = Math.sin(opening * Math.PI / 2) * (i % 2 ? .32 : -.16) + part * .72;
      dummy.position.set(c * spread, s * spread, leafZ); dummy.rotation.set(0, (i % 2 ? -1 : 1) * (opening * .26 + part * .2), angle); dummy.scale.set(1, 1, 1); put(shells, i);
      dummy.position.z += .16; put(inlays, i);
      dummy.position.set(c * spread * .42, s * spread * .42, -.20); dummy.rotation.set(0, 0, angle); dummy.scale.set(1, 1, 1); put(shoulders, i);
      dummy.position.set(c * .93, s * .93, -.025); dummy.rotation.set(0, 0, angle - Math.PI / 2); dummy.scale.set(.088, .61, .088); put(barrels, i);
      rodStart.set(c * 1.1, s * 1.1, .035); rodEnd.set(c * (1.25 + spread), s * (1.25 + spread), leafZ + .14);
      rodDirection.subVectors(rodEnd, rodStart); dummy.position.copy(rodStart).add(rodEnd).multiplyScalar(.5);
      dummy.scale.set(.045, Math.max(.14, rodDirection.length()), .045); dummy.quaternion.setFromUnitVectors(rodAxis, rodDirection.normalize()); put(shafts, i);
      for (let j = 0; j < 2; j++) {
        const radius = j ? 1.25 + spread : .73;
        dummy.position.set(c * radius, s * radius, j ? leafZ + .14 : .05); dummy.rotation.set(Math.PI / 2, 0, 0); dummy.scale.set(.115, .12, .115); put(pivots, i * 2 + j);
      }
      dummy.position.set(c * (1.64 + spread), s * (1.64 + spread), leafZ + .21); dummy.rotation.set(0, 0, angle + Math.PI / 2); dummy.scale.set(.19, .024, .02); put(indicators, i);
      // Real folded cooling fins sit behind each shell; pulling a component
      // reveals material thickness, the piston and the ribbed substructure.
      for (let j = 0; j < 5; j++) {
        const r = 1.06 + j * .125 + spread * .46;
        dummy.position.set(c * r, s * r, -.28 + part * .20); dummy.rotation.set(0, 0, angle);
        dummy.scale.set(.035, .26 + j * .014, .25); put(internals, i * 5 + j);
      }
    }
    finish(shells); finish(inlays); finish(shoulders); finish(barrels); finish(shafts); finish(pivots); finish(indicators); finish(internals);
    boundsDirty = true;
  }
  writeHero();
  let lastOpening = opening;

  function update(frame: TunnelLifeFrame) {
    if (destroyed) return;
    root.visible = !frame.compact && !frame.reducedMotion;
    if (!root.visible) { hero.visible = travel.visible = false; return; }
    const dt = frame.inspection ? 0 : Math.min(.05, Math.max(0, frame.delta));
    phase += dt;
    const follow = 1 - Math.exp(-dt * 7);
    pointerX += (frame.pointer[0] - pointerX) * follow;
    pointerY += (frame.pointer[1] - pointerY) * follow;
    opening += ((expanded ? 1 : 0) - opening) * (1 - Math.exp(-dt * 6));
    if (Math.abs(opening - (expanded ? 1 : 0)) < .0001) opening = expanded ? 1 : 0;
    let partsChanged = false;
    for (let i = 0; i < 6; i++) {
      const target = expanded && selectedPart === i ? partPull ?? 1 : 0;
      partAmounts[i] += (target - partAmounts[i]) * (1 - Math.exp(-dt * 7));
      if (Math.abs(partAmounts[i] - target) < .0001) partAmounts[i] = target;
      if (Math.abs(lastParts[i] - partAmounts[i]) > .00001) { partsChanged = true; lastParts[i] = partAmounts[i]; }
    }
    const departure = smooth((10 - frame.cameraZ) / 10.5);
    hero.visible = frame.active < 0 && frame.cameraZ > -.65 && !frame.inspection;
    if (hero.visible) {
      const presence = smooth((frame.cameraZ + .65) / 5.5);
      hero.position.set(2.6 + departure * 1.35, -.20 + Math.sin(phase * .43) * .085, -6);
      hero.scale.setScalar(presence);
      mechanism.rotation.set(.14 + pointerY * .075, -.20 + pointerX * .11, -.08 + Math.sin(phase * .15) * .045);
      gimbals[0].rotation.set(.7, phase * .22, -.3);
      gimbals[1].rotation.set(-.55, -phase * .17, 1.02);
      gimbals[1].scale.setScalar(.92);
      gimbals[2].rotation.set(phase * .14, .45, phase * -.24);
      core.rotation.set(phase * .09, phase * .16, phase * .05);
      const impulse = frame.pulse.strength * Math.exp(-Math.max(0, frame.pulse.age) * 2.9);
      signal.emissiveIntensity = .28 + .10 * (Math.sin(phase * 1.9) * .5 + .5) + clamp(frame.energy) * .18 + impulse * .65;
      if (Math.abs(lastOpening - opening) > .00001 || partsChanged) { writeHero(); lastOpening = opening; }
    }

    const p = frame.progress;
    const travelWeight = frame.active < 0 || frame.inspection ? 0
      : p < .38 ? 1 - smooth((p - .18) / .17) : smooth((p - .77) / .15);
    travel.visible = travelWeight > .001;
    if (!travel.visible) return;
    for (let i = 0; i < relayCount; i++) {
      const a = anchors[i], distance = frame.cameraZ - a.z;
      const visible = distance > -4 && distance < 64 && !(frame.quality === 'light' && i % 2);
      const scale = visible ? .29 * travelWeight * smooth((distance + 4) / 6) * (1 - smooth((distance - 48) / 16)) : 0;
      unit.position.set(a.x, a.y, a.z); unit.rotation.set(.20 + Math.sin(i * 2) * .35, Math.cos(i * 3) * .4, a.angle + phase * (i % 2 ? .06 : -.06)); unit.scale.setScalar(scale); unit.updateMatrix();
      for (let j = 0; j < 6; j++) {
        const angle = j * TAU / 6, open = .035 + .16 * mechanismAwakening(phase, i * 6 + j);
        dummy.position.set(Math.cos(angle) * open, Math.sin(angle) * open, 0); dummy.rotation.set(0, 0, angle); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); matrix.multiplyMatrices(unit.matrix, dummy.matrix); travelLeaves.setMatrixAt(i * 6 + j, matrix);
        dummy.position.z = .16; dummy.updateMatrix(); matrix.multiplyMatrices(unit.matrix, dummy.matrix); travelInlays.setMatrixAt(i * 6 + j, matrix);
        dummy.position.set(Math.cos(angle), Math.sin(angle), -.06); dummy.rotation.set(0, 0, angle - Math.PI / 2); dummy.scale.set(.08, .8, .08); dummy.updateMatrix(); matrix.multiplyMatrices(unit.matrix, dummy.matrix); travelShafts.setMatrixAt(i * 6 + j, matrix);
      }
      dummy.position.set(0, 0, 0); dummy.rotation.set(.5, phase * .2 + i, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); matrix.multiplyMatrices(unit.matrix, dummy.matrix); travelGimbals.setMatrixAt(i, matrix);
      dummy.rotation.set(phase * .12, i, phase * .21); dummy.scale.setScalar(1 + clamp(frame.energy) * .12); dummy.updateMatrix(); matrix.multiplyMatrices(unit.matrix, dummy.matrix); travelCores.setMatrixAt(i, matrix);
    }
    finish(travelLeaves); finish(travelInlays); finish(travelShafts); finish(travelGimbals); finish(travelCores);
  }

  return {
    update,
    setExploded(open: boolean) { expanded = open; if (!open) { selectedPart = null; partPull = null; } },
    setSelectedPart(index: number | null) { const next = relayPartIndex(index); if (selectedPart !== next) partPull = null; selectedPart = next; },
    setPartPull(amount: number | null) { partPull = amount !== null && Number.isFinite(amount) ? clamp(amount) : null; },
    hitPart(raycaster: THREE.Raycaster): number | null {
      if (destroyed || !root.visible || !hero.visible || hero.scale.x < .08) return null;
      hero.updateWorldMatrix(true, true);
      if (boundsDirty) { shells.computeBoundingSphere(); inlays.computeBoundingSphere(); shoulders.computeBoundingSphere(); boundsDirty = false; }
      hits.length = 0; raycaster.intersectObjects([shells, inlays, shoulders], false, hits);
      const part = relayPartIndex(hits[0]?.instanceId ?? null); hits.length = 0; return part;
    },
    hitTest(raycaster: THREE.Raycaster) {
      if (destroyed || !root.visible || !hero.visible || hero.scale.x < .08) return false;
      hero.updateWorldMatrix(true, true);
      // Hover and click share cached local bounds. Only changing the shell
      // articulation invalidates them; parent motion leaves them valid.
      if (boundsDirty) {
        shells.computeBoundingSphere(); inlays.computeBoundingSphere(); shoulders.computeBoundingSphere();
        boundsDirty = false;
      }
      hits.length = 0; raycaster.intersectObjects(hitObjects, false, hits);
      const hit = hits.length > 0; hits.length = 0; return hit;
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      scene.remove(root); hitObjects.length = 0; hits.length = 0;
      instances.forEach(mesh => mesh.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      root.clear();
    },
  };
}
