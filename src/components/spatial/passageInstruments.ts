import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { places } from '../../data/catalogue';
import { SILENT_SPECTRUM, type AudioSpectrum } from '../../services/audioSpectrum';

export type InstrumentFrame = {
  elapsed: number; delta?: number; reducedMotion: boolean; active: number;
  inspecting: boolean; audio?: Readonly<AudioSpectrum>;
};

/** Physical instruments use the chapter's existing inspection transform. Only
 * local moving parts live here: no camera, DOM, loop, timers or audio source. */
export function createPassageInstruments(parents: readonly THREE.Object3D[]) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const instances = new Set<THREE.InstancedMesh>(), roots: THREE.Group[] = [];
  const geo = <T extends THREE.BufferGeometry>(g: T): T => { geometries.add(g); return g; };
  const mat = <T extends THREE.Material>(m: T): T => { materials.add(m); return m; };
  const metal = mat(new THREE.MeshStandardMaterial({ color: 0x9ca7a0, metalness: .93, roughness: .25 }));
  const shell = mat(new THREE.MeshStandardMaterial({ color: 0x202825, metalness: .76, roughness: .35 })); shell.userData.passageShell = true;
  const ivory = mat(new THREE.MeshStandardMaterial({ color: 0xd1cabc, metalness: .18, roughness: .47 }));
  const internal = mat(new THREE.MeshStandardMaterial({ color: 0x776956, metalness: .74, roughness: .35 })); internal.userData.passageInternal = true;
  const red = mat(new THREE.MeshBasicMaterial({ color: 0xff4d32, toneMapped: false }));
  const dark = mat(new THREE.MeshStandardMaterial({ color: 0x090e0c, metalness: .2, roughness: .43 }));
  const unit = geo(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = geo(new THREE.CylinderGeometry(1, 1, 1, 32));
  const sphere = geo(new THREE.SphereGeometry(1, 32, 20));
  const torusCache = new Map<string, THREE.TorusGeometry>();
  const dummy = new THREE.Object3D();
  const mesh = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number] = [0, 0, 0], s: [number, number, number] = [1, 1, 1]) => {
    const result = new THREE.Mesh(g, m); result.position.set(...p); result.scale.set(...s); parent.add(result); return result;
  };
  const box = (parent: THREE.Object3D, p: [number, number, number], s: [number, number, number], m: THREE.Material = shell) => mesh(parent, unit, m, p, s);
  const ring = (parent: THREE.Object3D, r: number, t: number, m: THREE.Material = metal) => {
    const key = `${r}/${t}`;
    if (!torusCache.has(key)) torusCache.set(key, geo(new THREE.TorusGeometry(r, t, 6, 64)));
    return mesh(parent, torusCache.get(key)!, m);
  };
  function repeated(parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, count: number, fn: (i: number, o: THREE.Object3D) => void) {
    const result = new THREE.InstancedMesh(g, m, count); instances.add(result);
    for (let i = 0; i < count; i++) { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); fn(i, dummy); dummy.updateMatrix(); result.setMatrixAt(i, dummy.matrix); }
    result.instanceMatrix.needsUpdate = true; result.computeBoundingSphere(); parent.add(result); return result;
  }
  function batch(parent: THREE.Object3D) {
    const groups = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...parent.children]) {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || Array.isArray(child.material)) continue;
      const list = groups.get(child.material) || []; list.push(child); groups.set(child.material, list);
    }
    for (const [m, list] of groups) {
      if (list.length < 2) continue;
      const parts = list.map(child => { child.updateMatrix(); const copy = child.geometry.clone().applyMatrix4(child.matrix); if (!copy.index) return copy; const flat = copy.toNonIndexed(); copy.dispose(); return flat; });
      const combined = mergeGeometries(parts); parts.forEach(part => part.dispose());
      if (!combined) continue;
      list.forEach(child => child.removeFromParent()); mesh(parent, geo(combined), m);
    }
  }
  function root(index: number, name: string) { const result = new THREE.Group(); result.name = name; parents[index]?.add(result); roots.push(result); return result; }
  // The articulated geographic instrument has true catalogue coordinates on
  // its inner globe, latitude rings, a tilted cradle and a geared base.
  const globe = root(0, 'Articulated geographic instrument');
  const globeBase = mesh(globe, cylinder, shell, [0, -.66, 0], [.51, .12, .51]);
  globeBase.name = 'Geographic instrument base';
  box(globe, [0, -.48, -.10], [.12, .3, .13], metal);
  const cradle = new THREE.Group(); cradle.rotation.z = .35; globe.add(cradle);
  const cradleRing = ring(cradle, .69, .035); cradleRing.rotation.y = Math.PI / 2;
  mesh(cradle, cylinder, internal, [0, .58, 0], [.045, .26, .045]);
  mesh(cradle, cylinder, internal, [0, -.58, 0], [.045, .26, .045]);
  const planet = new THREE.Group(); cradle.add(planet);
  const globeShell = mesh(planet, sphere, shell, [0, 0, 0], [.54, .54, .54]); globeShell.name = 'Globe shell';
  for (let i = 0; i < 6; i++) ring(planet, .548, .006, metal).rotation.y = i * Math.PI / 6;
  for (const latitude of [-.68, -.34, 0, .34, .68]) {
    const lat = ring(planet, .55 * Math.cos(latitude), .006, latitude === 0 ? red : metal); lat.rotation.x = Math.PI / 2; lat.position.y = .55 * Math.sin(latitude);
  }
  const pinGeometry = geo(new THREE.SphereGeometry(.022, 8, 6));
  places.forEach(place => { const lat = THREE.MathUtils.degToRad(place.lat), lon = THREE.MathUtils.degToRad(place.lon); mesh(planet, pinGeometry, red, [.562 * Math.cos(lat) * Math.sin(lon), .562 * Math.sin(lat), .562 * Math.cos(lat) * Math.cos(lon)]); });
  batch(planet); batch(cradle); batch(globe);

  // An open-work timepiece: moving escapement, three geared trains, dial
  // indices and hands. Its face makes no claim about an archival date.
  const timepiece = root(1, 'Open-work archive timepiece');
  const caseProfile = [[.60, -.09], [.66, -.09], [.68, -.05], [.68, .09], [.66, .13], [.60, .13], [.60, -.09]].map(([r, z]) => new THREE.Vector2(r, z));
  const caseGeometry = geo(new THREE.LatheGeometry(caseProfile, 64));
  const casing = mesh(timepiece, caseGeometry, shell); casing.rotation.x = Math.PI / 2;
  ring(timepiece, .68, .035); ring(timepiece, .58, .012, ivory).position.z = .13;
  repeated(timepiece, unit, ivory, 60, (i, o) => { const a = i / 60 * Math.PI * 2; o.position.set(Math.sin(a) * .55, Math.cos(a) * .55, .14); o.rotation.z = -a; o.scale.set(i % 5 ? .006 : .015, i % 5 ? .025 : .065, .012); });
  const gears: THREE.Group[] = [];
  [[-.22, .17, .21], [.23, .10, .19], [.03, -.25, .23]].forEach(([x, y, r]) => {
    const gear = new THREE.Group(); gear.position.set(x, y, .02); timepiece.add(gear); gears.push(gear);
    ring(gear, r * .82, .024, internal); ring(gear, r * .35, .018, metal);
    repeated(gear, unit, internal, 18, (i, o) => { const a = i / 18 * Math.PI * 2; o.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); o.rotation.z = a; o.scale.set(.045, .025, .045); });
    repeated(gear, unit, metal, 6, (i, o) => { const a = i / 6 * Math.PI * 2; o.position.set(Math.cos(a) * r * .48, Math.sin(a) * r * .48, 0); o.rotation.z = a; o.scale.set(r * .7, .015, .018); });
    batch(gear);
  });
  const hand = new THREE.Group(); hand.position.z = .18; timepiece.add(hand);
  box(hand, [0, .19, 0], [.014, .4, .013], red); mesh(hand, sphere, metal, [0, 0, 0], [.045, .045, .025]); batch(hand);
  box(timepiece, [-.08, .11, .16], [.025, .29, .016], ivory).rotation.z = -.6;
  const crown = mesh(timepiece, cylinder, metal, [.76, 0, .02], [.08, .16, .08]); crown.rotation.z = Math.PI / 2;
  batch(timepiece);

  // A compact projector with hollow reel spokes and a barrel made from actual
  // stacked lens elements. The film path is tucked inside the chassis.
  const projector = root(2, 'Mechanical cinema projector');
  const bodyShape = new THREE.Shape(); bodyShape.moveTo(-.45, -.33); bodyShape.lineTo(.4, -.33); bodyShape.lineTo(.45, .13); bodyShape.lineTo(.27, .3); bodyShape.lineTo(-.35, .3); bodyShape.lineTo(-.45, .17); bodyShape.closePath();
  const bodyGeometry = geo(new THREE.ExtrudeGeometry(bodyShape, { depth: .28, bevelEnabled: true, bevelSegments: 2, bevelSize: .035, bevelThickness: .025 }));
  mesh(projector, bodyGeometry, shell, [0, -.12, -.14]);
  const reels: THREE.Group[] = [];
  for (const x of [-.42, .36]) {
    const reel = new THREE.Group(); reel.position.set(x, .47, .02); projector.add(reel); reels.push(reel);
    ring(reel, .29, .025); ring(reel, .12, .019, internal); mesh(reel, sphere, internal, [0, 0, .02], [.05, .05, .035]);
    repeated(reel, unit, metal, 5, (i, o) => { const a = i / 5 * Math.PI * 2; o.position.set(Math.cos(a) * .18, Math.sin(a) * .18, 0); o.rotation.z = a; o.scale.set(.21, .028, .028); }); batch(reel);
  }
  box(projector, [0, -.56, .02], [.92, .1, .51], metal);
  for (const x of [-.32, .3]) box(projector, [x, -.46, 0], [.08, .2, .1], metal);
  const lens = new THREE.Group(); lens.position.set(.49, -.06, .08); lens.rotation.y = Math.PI / 2; projector.add(lens);
  for (let i = 0; i < 4; i++) { const element = ring(lens, .18 - i * .014, .027, i === 2 ? ivory : metal); element.position.z = i * .07; }
  mesh(lens, geo(new THREE.CircleGeometry(.13, 32)), dark, [0, 0, .23]);
  ring(lens, .09, .006, red).position.z = .235; batch(lens);
  repeated(projector, unit, internal, 9, (i, o) => { o.position.set(-.3 + i * .075, -.12, .158); o.scale.set(.026, .23, .018); });
  batch(projector);

  // A real turntable form rather than floating rings. The platter speed is an
  // authored mechanical idle; ONLY the suspended isolators use measured audio.
  const turntable = root(3, 'Audio-responsive precision turntable'); turntable.rotation.x = .55;
  box(turntable, [0, -.08, 0], [1.4, .15, 1.03], shell);
  box(turntable, [0, .002, 0], [1.34, .02, .97], metal);
  const platter = new THREE.Group(); platter.position.set(-.12, .06, 0); turntable.add(platter);
  mesh(platter, cylinder, dark, [0, 0, 0], [.46, .045, .46]);
  for (let i = 0; i < 5; i++) ring(platter, .24 + i * .047, .003, metal).rotation.x = Math.PI / 2;
  const label = mesh(platter, cylinder, red, [0, .025, 0], [.12, .006, .12]); label.name = 'Original score label';
  mesh(platter, cylinder, metal, [0, .045, 0], [.018, .055, .018]);
  box(platter, [.07, .03, 0], [.035, .004, .013], ivory); batch(platter);
  const tonearm = new THREE.Group(); tonearm.position.set(.48, .1, -.28); turntable.add(tonearm);
  mesh(tonearm, cylinder, metal, [0, 0, 0], [.07, .1, .07]);
  box(tonearm, [-.12, .065, .22], [.025, .025, .5], metal).rotation.y = -.46;
  box(tonearm, [-.25, .052, .43], [.07, .06, .13], dark); batch(tonearm);
  const audioPetals: THREE.Group[] = [];
  for (let i = 0; i < 7; i++) {
    const isolator = new THREE.Group(); isolator.position.set(-.63 + i * .21, -.18, .51); turntable.add(isolator); audioPetals.push(isolator);
    box(isolator, [0, 0, 0], [.15, .025, .15], metal);
    box(isolator, [0, -.028, 0], [.065, .035, .065], internal);
    box(isolator, [0, .015, .04], [.09, .004, .01], red); batch(isolator);
  }
  batch(turntable);

  // Hollow lathed stoneware, a cut rim, visible wall thickness and a physical
  // paper folio. This is an authored object study, not an attributed artefact.
  const culture = root(4, 'Stoneware and paper material study');
  const ceramic = mat(new THREE.MeshStandardMaterial({ color: 0xc6bca6, metalness: .04, roughness: .88 })); ceramic.userData.passageShell = true;
  const profile = [[.0, -.48], [.24, -.48], [.31, -.38], [.33, -.12], [.27, .15], [.20, .31], [.22, .42], [.19, .42], [.17, .31], [.24, .14], [.30, -.12], [.28, -.36], [.20, -.43], [.0, -.43]].map(([x, y]) => new THREE.Vector2(x, y));
  const vesselGeometry = geo(new THREE.LatheGeometry(profile, 48));
  const positions = vesselGeometry.getAttribute('position');
  // Small wheel-thrown ridges live in geometry and catch actual light.
  for (let i = 0; i < positions.count; i++) { const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i); const variation = 1 + Math.sin(y * 90) * .006 + Math.sin(Math.atan2(z, x) * 5 + y * 11) * .003; positions.setXYZ(i, x * variation, y, z * variation); }
  vesselGeometry.computeVertexNormals();
  mesh(culture, vesselGeometry, ceramic, [-.16, .06, 0]);
  const lip = ring(culture, .205, .014, internal); lip.rotation.x = Math.PI / 2; lip.position.set(-.16, .48, 0);
  mesh(culture, cylinder, dark, [-.16, -.45, 0], [.36, .035, .36]);
  const folio = new THREE.Group(); folio.position.set(.43, -.28, .08); folio.rotation.set(-.18, -.28, -.14); culture.add(folio);
  for (let i = 0; i < 8; i++) box(folio, [i * .005, i * .013, 0], [.37, .008, .61], i % 3 === 0 ? ivory : ceramic);
  box(folio, [0, .115, 0], [.38, .025, .63], shell); box(folio, [-.12, .13, 0], [.009, .004, .49], red); batch(folio); batch(culture);

  let disposed = false;
  let bass = 0, mid = 0, treble = 0;
  const turns = { globe: 0, gears: 0, reel: 0, platter: 0 };
  return {
    roots,
    update(frame: InstrumentFrame) {
      if (disposed) return;
      const dt = Math.max(0, Math.min(.05, frame.delta ?? 1 / 60));
      const moving = !frame.reducedMotion && !frame.inspecting;
      if (moving) { turns.globe += dt * .07; turns.gears += dt * .18; turns.reel += dt * .4; turns.platter += dt * .34; }
      // Only the current instrument does work. Transform ownership is entirely
      // inside its parent, so selecting Inspect cannot unwind the scene.
      if (frame.active === 0) { planet.rotation.y = turns.globe; cradle.rotation.z = .35 + (moving ? Math.sin(frame.elapsed * .13) * .035 : 0); }
      if (frame.active === 1) { gears.forEach((gear, i) => { gear.rotation.z = turns.gears * (i % 2 ? -1.12 : 1); }); hand.rotation.z = -turns.gears * .12; }
      if (frame.active === 2) reels.forEach((reel, i) => { reel.rotation.z = turns.reel * (i ? .85 : 1); });
      if (frame.active === 3) {
        platter.rotation.y = turns.platter;
        const measured = moving ? frame.audio ?? SILENT_SPECTRUM : SILENT_SPECTRUM, rate = 1 - Math.exp(-dt * 15);
        bass += (measured.bass - bass) * rate; mid += (measured.mid - mid) * rate; treble += (measured.treble - treble) * rate;
        audioPetals.forEach((petal, i) => { const value = i < 2 ? bass : i < 5 ? mid : treble; petal.position.y = -.18 + value * .16; petal.rotation.x = value * .45; });
        tonearm.rotation.y = -.1 + mid * .07;
        turntable.userData.audioEnergy = measured.rms; turntable.userData.audioSource = 'measured-local-study';
      }
    },
    destroy() {
      if (disposed) return; disposed = true; roots.forEach(object => object.removeFromParent());
      instances.forEach(object => object.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      geometries.clear(); materials.clear(); instances.clear(); torusCache.clear();
    },
  };
}
