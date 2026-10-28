import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type DroneMember = {
  id: 'vela' | 'atlas' | 'pip' | 'echo';
  name: string;
  role: string;
  root: THREE.Group;
  /** Local +Z is forward. Move this group to turn the optical assembly. */
  gimbal: THREE.Group;
  /** Turbines turn around their local Y axes. No animation is owned here. */
  rotors: THREE.Object3D[];
  signal: THREE.MeshStandardMaterial;
  span: number;
};

export type DroneFamily = {
  root: THREE.Group;
  members: DroneMember[];
  dispose: () => void;
};

/** Four small manufactured aircraft, with one material vocabulary and distinct
 * silhouettes. Geometry is shared; the caller owns lighting, flight, and timing. */
export function createDroneFamily(): DroneFamily {
  const root = new THREE.Group();
  root.name = 'Monumental flight companions';
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const geo = <T extends THREE.BufferGeometry>(value: T): T => { geometries.add(value); return value; };
  const mat = <T extends THREE.Material>(value: T): T => { materials.add(value); return value; };

  const ceramic = mat(new THREE.MeshStandardMaterial({ color: 0xe8e8e1, metalness: .48, roughness: .24, envMapIntensity: 1.15 }));
  const chrome = mat(new THREE.MeshStandardMaterial({ color: 0xcfd4d0, metalness: .96, roughness: .19, envMapIntensity: 1.3 }));
  const titanium = mat(new THREE.MeshStandardMaterial({ color: 0x59645f, metalness: .86, roughness: .3 }));
  const graphite = mat(new THREE.MeshStandardMaterial({ color: 0x121817, metalness: .66, roughness: .34 }));
  const optic = mat(new THREE.MeshStandardMaterial({ color: 0x1b2725, metalness: .92, roughness: .11, envMapIntensity: 1.5 }));
  const bladeSurface = mat(new THREE.MeshStandardMaterial({ color: 0x59655f, metalness: .78, roughness: .34, side: THREE.DoubleSide }));

  const box = geo(new THREE.BoxGeometry(1, 1, 1));
  const sphere = geo(new THREE.SphereGeometry(1, 24, 12));
  const shroud = geo(new THREE.TorusGeometry(1, .16, 8, 32));
  const rim = geo(new THREE.TorusGeometry(1, .033, 5, 32));
  const lensRim = geo(new THREE.TorusGeometry(1, .1, 6, 28));
  const hub = geo(new THREE.CylinderGeometry(.052, .034, .045, 12));

  const mesh = (shape: THREE.BufferGeometry, surface: THREE.Material, parent: THREE.Object3D,
    position: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) => {
    const object = new THREE.Mesh(shape, surface);
    object.position.set(...position); object.scale.set(...scale); parent.add(object);
    return object;
  };

  // Beveled continuous shells retain their silhouette at small display sizes.
  // Shape coordinates are an aircraft plan; their local top becomes +Y.
  const shell = (kind: DroneMember['id']) => {
    const shape = new THREE.Shape();
    if (kind === 'vela') {
      shape.moveTo(0, .36);
      shape.bezierCurveTo(.17, .35, .25, .14, .29, -.04);
      shape.bezierCurveTo(.33, -.25, .2, -.29, 0, -.22);
      shape.bezierCurveTo(-.2, -.29, -.33, -.25, -.29, -.04);
      shape.bezierCurveTo(-.25, .14, -.17, .35, 0, .36);
    } else if (kind === 'atlas') {
      shape.moveTo(-.17, .3); shape.lineTo(.17, .3); shape.lineTo(.32, .13);
      shape.lineTo(.3, -.18); shape.lineTo(.15, -.3); shape.lineTo(-.15, -.3);
      shape.lineTo(-.3, -.18); shape.lineTo(-.32, .13); shape.closePath();
    } else if (kind === 'pip') {
      shape.moveTo(0, .31);
      shape.bezierCurveTo(.24, .31, .3, .14, .28, -.06);
      shape.bezierCurveTo(.24, -.3, -.24, -.3, -.28, -.06);
      shape.bezierCurveTo(-.3, .14, -.24, .31, 0, .31);
    } else {
      shape.moveTo(0, .35);
      shape.bezierCurveTo(.08, .33, .2, .13, .32, -.17);
      shape.quadraticCurveTo(.34, -.25, .24, -.23);
      shape.lineTo(0, -.13); shape.lineTo(-.24, -.23);
      shape.quadraticCurveTo(-.34, -.25, -.32, -.17);
      shape.bezierCurveTo(-.2, .13, -.08, .33, 0, .35);
    }
    const result = geo(new THREE.ExtrudeGeometry(shape, {
      depth: .065, bevelEnabled: true, bevelSegments: 3, bevelSize: .034,
      bevelThickness: .033, steps: 1, curveSegments: 10,
    }));
    result.center(); result.rotateX(Math.PI / 2);
    return result;
  };

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(.035, -.014); bladeShape.lineTo(.125, -.035);
  bladeShape.quadraticCurveTo(.164, -.033, .16, -.008);
  bladeShape.lineTo(.05, .02); bladeShape.closePath();
  const blade = geo(new THREE.ShapeGeometry(bladeShape));
  blade.rotateX(-Math.PI / 2);

  const finShape = new THREE.Shape();
  finShape.moveTo(-.08, 0); finShape.lineTo(.08, 0);
  finShape.lineTo(-.035, .13); finShape.quadraticCurveTo(-.07, .15, -.08, .12); finShape.closePath();
  const fin = geo(new THREE.ExtrudeGeometry(finShape, { depth: .014, bevelEnabled: true, bevelSize: .004, bevelThickness: .004, bevelSegments: 1, steps: 1 }));
  fin.rotateY(Math.PI / 2);

  const matrix = new THREE.Object3D();
  const members: DroneMember[] = [];
  const definitions = [
    { id: 'vela', name: 'Vela', role: 'Female guide', scale: 1, duct: .163, offset: .43, z: -.055 },
    { id: 'atlas', name: 'Atlas', role: 'Male guide', scale: 1.04, duct: .172, offset: .43, z: -.03 },
    { id: 'pip', name: 'Pip', role: 'Young scout', scale: .59, duct: .16, offset: .405, z: -.04 },
    { id: 'echo', name: 'Echo', role: 'Young scout', scale: .55, duct: .156, offset: .42, z: -.09 },
  ] as const;

  for (const definition of definitions) {
    const memberRoot = new THREE.Group(); memberRoot.name = definition.name;
    memberRoot.scale.setScalar(definition.scale); root.add(memberRoot);
    const signal = mat(new THREE.MeshStandardMaterial({ color: 0xff4d32, emissive: 0xff4d32, emissiveIntensity: .42, metalness: .32, roughness: .32 }));
    const hull = shell(definition.id);
    mesh(hull, graphite, memberRoot, [0, -.039, 0], [1.045, .7, 1.035]);
    mesh(hull, definition.id === 'atlas' ? chrome : ceramic, memberRoot, [0, .012, 0]);
    mesh(hull, definition.id === 'atlas' ? graphite : titanium, memberRoot, [0, .077, -.025], [.59, .18, .66]);

    // A thin continuous seam, rather than an oversized glowing body outline.
    const seamCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.14, .087, -.09), new THREE.Vector3(-.07, .099, -.15),
      new THREE.Vector3(.07, .099, -.15), new THREE.Vector3(.14, .087, -.09),
    ]);
    mesh(geo(new THREE.TubeGeometry(seamCurve, 15, .006, 4, false)), signal, memberRoot);

    const rotors: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const x = side * definition.offset;
      const arm = mesh(box, titanium, memberRoot, [side * .31, -.013, definition.z], [.25, .037, .084]);
      arm.rotation.y = side * -.13;
      const duct = new THREE.Group(); duct.position.set(x, 0, definition.z); memberRoot.add(duct);
      const casing = mesh(shroud, definition.id === 'atlas' ? titanium : ceramic, duct, [0, 0, 0], [definition.duct, definition.duct, definition.duct * .72]);
      casing.rotation.x = Math.PI / 2;
      const lip = mesh(rim, chrome, duct, [0, .023, 0], [definition.duct * .99, definition.duct * .99, definition.duct * .99]);
      lip.rotation.x = Math.PI / 2;
      const turbine = new THREE.Group(); turbine.position.y = -.005; duct.add(turbine);
      const blades = new THREE.InstancedMesh(blade, bladeSurface, 5);
      for (let j = 0; j < 5; j++) {
        matrix.position.set(0, 0, 0); matrix.rotation.set(0, j / 5 * Math.PI * 2, -.09);
        matrix.scale.setScalar(definition.duct / .163); matrix.updateMatrix(); blades.setMatrixAt(j, matrix.matrix);
      }
      blades.instanceMatrix.needsUpdate = true; turbine.add(blades);
      mesh(hub, graphite, turbine, [0, .008, 0]); rotors.push(turbine);
      const tip = mesh(box, signal, duct, [side * definition.duct, .014, 0], [.012, .012, .065]);
      tip.rotation.y = side * .12;
    }

    // One optical instrument, articulated as a unit. It is deliberately not a face.
    const gimbal = new THREE.Group(); gimbal.name = `${definition.name} optical gimbal`;
    gimbal.position.set(0, -.023, definition.id === 'atlas' ? .274 : .285); memberRoot.add(gimbal);
    mesh(sphere, graphite, gimbal, [0, 0, 0], [.093, .075, .073]);
    mesh(lensRim, chrome, gimbal, [0, 0, .053], [.059, .059, .059]);
    mesh(sphere, optic, gimbal, [0, 0, .06], [.052, .052, .016]);
    mesh(lensRim, signal, gimbal, [0, 0, .075], [.022, .022, .022]);

    const finCount = definition.id === 'pip' ? 1 : 2;
    for (let index = 0; index < finCount; index++) {
      const side = finCount === 1 ? 0 : index === 0 ? -1 : 1;
      const vane = mesh(fin, definition.id === 'atlas' ? chrome : titanium, memberRoot,
        [side * .106, .067, -.17], [1, definition.id === 'echo' ? .7 : 1, 1]);
      vane.rotation.z = side * -.24;
    }

    // Small underside skids ground the silhouette when the drones hover close.
    for (const side of [-1, 1]) {
      const skid = mesh(box, graphite, memberRoot, [side * .15, -.111, -.04], [.024, .024, .23]);
      skid.rotation.x = -.06;
    }

    // Bake only stationary parts into a handful of material batches. Keep the
    // member's scale outside the baked coordinates, and preserve all articulation.
    memberRoot.updateWorldMatrix(true, true);
    const localFromWorld = memberRoot.matrixWorld.clone().invert();
    const articulated = new Set<THREE.Object3D>([gimbal, ...rotors]);
    const batches = new Map<THREE.Material, { pieces: THREE.BufferGeometry[]; sources: THREE.Mesh[] }>();
    memberRoot.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) return;
      for (let ancestor: THREE.Object3D | null = object; ancestor && ancestor !== memberRoot; ancestor = ancestor.parent) {
        if (articulated.has(ancestor)) return;
      }
      const source = object.geometry;
      const piece = source.index ? source.toNonIndexed() : source.clone();
      piece.applyMatrix4(new THREE.Matrix4().multiplyMatrices(localFromWorld, object.matrixWorld));
      let batch = batches.get(object.material);
      if (!batch) {
        batch = { pieces: [], sources: [] };
        batches.set(object.material, batch);
      }
      batch.pieces.push(piece); batch.sources.push(object);
    });
    batches.forEach((batch, surface) => {
      const merged = mergeGeometries(batch.pieces, false);
      batch.pieces.forEach(piece => piece.dispose());
      if (!merged) return;
      batch.sources.forEach(source => source.removeFromParent());
      mesh(geo(merged), surface, memberRoot);
    });

    members.push({
      id: definition.id, name: definition.name, role: definition.role, root: memberRoot,
      gimbal, rotors, signal, span: (definition.offset + definition.duct * 1.16) * 2 * definition.scale,
    });
  }

  let disposed = false;
  return {
    root, members,
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      root.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      geometries.forEach(shape => shape.dispose());
      materials.forEach(surface => surface.dispose());
      root.clear();
    },
  };
}
