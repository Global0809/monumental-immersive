import * as THREE from 'three';
import type { PassageAssembly } from '../../services/passageAssembly';

type Palette = { steel: THREE.Material; graphite: THREE.Material; charcoal: THREE.Material; red: THREE.Material; ivory: THREE.Material };
type Part = { joint: THREE.Object3D; local: THREE.Matrix4 };
type Batch = { mesh: THREE.InstancedMesh; parts: Part[] };
export type ChapterAssembly = { update: (pose: PassageAssembly, inspection: number) => void };

/** Physical joints are evaluated in carrier-local space, then uploaded in a
 * handful of material batches. The six carriers share every geometry. No
 * independent timeline, per-part draw call, or elapsed-time transform exists. */
export function createChapterAssemblyKit(palette: Palette) {
  const shape = new THREE.Shape();
  shape.moveTo(-.43, -.5); shape.lineTo(.43, -.5); shape.lineTo(.5, -.43);
  shape.lineTo(.5, .43); shape.lineTo(.43, .5); shape.lineTo(-.43, .5);
  shape.lineTo(-.5, .43); shape.lineTo(-.5, -.43); shape.closePath();
  const plate = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 1, steps: 1 });
  plate.translate(0, 0, -.5);
  const geometries = {
    plate,
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    fastener: new THREE.CylinderGeometry(1, 1, 1, 6),
  };
  const meshes: THREE.InstancedMesh[] = [];
  let disposed = false;

  function create(parent: THREE.Group, index: number): ChapterAssembly {
    const host = new THREE.Group(); host.name = `chapter-${index}-articulated-chassis`; parent.add(host);
    // This graph has no rendered children. Its matrices express the actual
    // hinge hierarchy, independently of the carrier's camera-facing pose.
    const rig = new THREE.Group();
    const buckets = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; parts: Part[] }>();
    const transform = new THREE.Object3D(), matrix = new THREE.Matrix4();
    const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0), rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(), midpoint = new THREE.Vector3(), split = new THREE.Vector3();
    const add = (geometry: keyof typeof geometries, material: keyof Palette, joint: THREE.Object3D,
      position: readonly number[], dimensions: readonly number[], angles: readonly number[] = [0, 0, 0]) => {
      transform.position.set(position[0], position[1], position[2]);
      transform.scale.set(dimensions[0], dimensions[1], dimensions[2]);
      transform.rotation.set(angles[0], angles[1], angles[2]); transform.updateMatrix();
      const part = { joint, local: transform.matrix.clone() }, key = geometry + '/' + material;
      if (!buckets.has(key)) buckets.set(key, { geometry: geometries[geometry], material: palette[material], parts: [] });
      buckets.get(key)!.parts.push(part); return part;
    };
    const joint = (parentJoint = rig) => { const node = new THREE.Group(); parentJoint.add(node); return node; };
    const pin = (node: THREE.Group, x: number, y: number, z: number, radius = .13, span = .38) => {
      add('cylinder', 'graphite', node, [x, y, z], [radius * 1.28, span, radius * 1.28], [0, 0, Math.PI / 2]);
      add('cylinder', 'steel', node, [x, y, z], [radius, span + .10, radius], [0, 0, Math.PI / 2]);
      for (const side of [-1, 1]) add('fastener', 'steel', node, [x + side * (span / 2 + .06), y, z], [radius * .55, .055, radius * .55], [0, 0, Math.PI / 2]);
    };
    const bolt = (node: THREE.Group, x: number, y: number, z: number, radius = .06) =>
      add('fastener', 'steel', node, [x, y, z], [radius, .045, radius], [Math.PI / 2, 0, 0]);

    // Four telescopic corner carriages carry the perimeter, with stationary
    // outer sleeves, polished inner slides, and visible lock jaws.
    const corners = Array.from({ length: 4 }, (_, i) => {
      const sx = i % 2 ? 1 : -1, sy = i < 2 ? -1 : 1, node = joint(), jaw = joint(node), brace = joint(node);
      add('plate', 'graphite', node, [0, 0, -.30], [.68, .72, .40]);
      add('plate', 'steel', node, [0, 0, -.06], [.62, .64, .13]);
      add('plate', 'charcoal', node, [0, 0, .025], [.35, .36, .10]);
      for (const x of [-.22, .22]) for (const y of [-.23, .23]) bolt(node, x, y, .08, .055);
      add('plate', 'steel', jaw, [-sx * .13, -sy * .10, .13], [.37, .26, .18]);
      add('box', 'red', jaw, [-sx * .14, -sy * .10, .23], [.18, .018, .018]);
      pin(node, sx * .02, sy * .03, -.29, .17, .45);
      add('plate', 'graphite', brace, [-sx * .66, 0, -.44], [1.38, .24, .23]);
      add('plate', 'steel', brace, [-sx * .66, .13, -.40], [1.12, .032, .12]);
      return { node, jaw, brace, sx, sy };
    });
    const rails = Array.from({ length: 6 }, (_, i) => {
      const row = i % 2 ? 1 : -1, tier = Math.floor(i / 2), node = joint();
      // These beams have separate housings and narrow guide tracks instead of
      // becoming an undifferentiated flat rectangle.
      add('plate', tier === 1 ? 'graphite' : 'steel', node, [0, 0, 0], [14.8, tier === 1 ? .23 : .12, .22]);
      add('box', 'charcoal', node, [0, row * .09, .12], [13.8, .035, .10]);
      if (tier === 0) {
        add('box', 'red', node, [-4.9 + index * .13, -row * .07, .135], [1.55, .018, .022]);
        add('box', 'ivory', node, [5.3, -row * .07, .135], [.68, .014, .02]);
      }
      for (let n = 0; n < 8; n++) bolt(node, -6.7 + n * 1.91, 0, .15, .043);
      return { node, row, tier };
    });
    const sideColumns = Array.from({ length: 4 }, (_, i) => {
      const sx = i % 2 ? 1 : -1, tier = i < 2 ? 0 : 1, node = joint();
      add('plate', tier ? 'graphite' : 'steel', node, [0, 0, 0], [.16, 9.05, .23]);
      add('box', 'charcoal', node, [-sx * .10, 0, .07], [.045, 8.5, .14]);
      for (let n = 0; n < 6; n++) add('box', 'graphite', node, [sx * .11, -3.65 + n * 1.46, -.15], [.28, .12, .5]);
      return { node, sx, tier };
    });

    // Six double-jointed armor doors fold back around the frame. The second
    // plate folds onto the first, leaving the actual editorial aperture clear.
    const shutters = Array.from({ length: 6 }, (_, i) => {
      const sy = i < 3 ? 1 : -1, column = i % 3 - 1, shoulder = joint(), elbow = joint(shoulder);
      elbow.position.y = -sy * 2.2;
      for (const [node, second] of [[shoulder, false], [elbow, true]] as const) {
        const cy = -sy * 1.10;
        add('plate', 'steel', node, [0, cy, -.015], [4.62, 2.13, .16]);
        add('plate', 'graphite', node, [0, cy, .09], [4.35, 1.88, .11]);
        add('plate', 'charcoal', node, [0, cy, .153], [3.90, 1.40, .025]);
        // A broad sculpted spine, recessed vent slots, exposed hinge knuckles.
        add('plate', 'graphite', node, [0, cy, -.18], [3.90, .32, .24]);
        for (let vent = 0; vent < 4; vent++) add('box', 'steel', node, [-1.08 + vent * .72, cy, .175], [.035, .88, .024]);
        for (const x of [-2.02, 2.02]) for (const y of [-.76, .76]) bolt(node, x, cy + y, .16, .06);
        for (const x of [-1.58, 1.58]) pin(node, x, 0, -.02, .12, .52);
        add('box', second ? 'red' : 'ivory', node, [column * .25, cy + sy * .70, .17], [second ? 1.06 : .36, .022, .025]);
      }
      const cylinder = add('cylinder', 'graphite', rig, [0, 0, 0], [1, 1, 1]);
      const piston = add('cylinder', 'steel', rig, [0, 0, 0], [1, 1, 1]);
      return { shoulder, elbow, column, sy, cylinder, piston };
    });
    const cableParts = Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => add('cylinder', 'graphite', rig, [0, 0, 0], [1, 1, 1])));

    const batches: Batch[] = [...buckets.values()].map(bucket => {
      const mesh = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.parts.length);
      mesh.name = `${host.name}-batch`; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -.7), 12.5);
      host.add(mesh); meshes.push(mesh); return { mesh, parts: bucket.parts };
    });
    const last = new Float64Array(8).fill(-10);
    const cylinderBetween = (part: Part, start: THREE.Vector3, end: THREE.Vector3, radius: number) => {
      v.subVectors(end, start); const length = Math.max(.001, v.length());
      midpoint.copy(start).add(end).multiplyScalar(.5); rotation.setFromUnitVectors(up, v.multiplyScalar(1 / length));
      scale.set(radius, length, radius); part.local.compose(midpoint, rotation, scale);
    };
    const stagger = (value: number, offset: number) => THREE.MathUtils.smoothstep(value, offset, .82 + offset);

    return { update(pose, inspection) {
      if (disposed) return;
      const values = [pose.release, pose.spine, pose.hinges, pose.leaves, pose.screen, pose.lock, inspection, pose.deployment];
      if (values.every((value, i) => Math.abs(last[i] - value) < .00001)) return;
      values.forEach((value, i) => { last[i] = value; });
      const ex = Math.min(1, Math.max(0, inspection));
      const spreadX = 5.75 + pose.spine * 1.92, spreadY = 1.65 + pose.hinges * 3.03;
      corners.forEach(({ node, jaw, brace, sx, sy }, i) => {
        node.position.set(sx * (spreadX + ex * .13), sy * (spreadY + ex * .1), -.30);
        const opening = Math.sin(pose.release * Math.PI / 2) * (1 - pose.lock);
        jaw.position.set(sx * opening * .34, sy * opening * .10, opening * .22);
        jaw.rotation.z = sx * sy * opening * .34;
        brace.rotation.z = sx * sy * (1 - pose.hinges) * .62;
        const cable = cableParts[i];
        for (let segment = 0; segment < cable.length; segment++) {
          const curve = (p: number, point: THREE.Vector3) => point.set(sx * (spreadX - .08 - p * 1.65), sy * (spreadY - .24 - Math.sin(Math.PI * p) * (.40 + (1 - pose.spine) * .75)), -.66 - Math.sin(Math.PI * p) * .28);
          curve(segment / cable.length, a); curve((segment + 1) / cable.length, b); cylinderBetween(cable[segment], a, b, .035);
        }
      });
      rails.forEach(({ node, row, tier }) => {
        node.position.set(0, row * (spreadY + tier * .15 + ex * tier * .08), -.42 - tier * (.34 + pose.spine * .17 + ex * .16));
        node.scale.x = .76 + pose.spine * .24;
        node.rotation.x = row * (1 - pose.hinges) * (.22 + tier * .14);
      });
      sideColumns.forEach(({ node, sx, tier }) => {
        node.position.set(sx * (spreadX + tier * .15 + ex * tier * .08), 0, -.42 - tier * (.53 + ex * .25));
        node.scale.y = .32 + pose.hinges * .68;
        node.rotation.y = sx * (1 - pose.spine) * .36;
      });
      shutters.forEach(({ shoulder, elbow, column, sy }, i) => {
        // Small stagger preserves an authored domino order while the group
        // remains entirely reconstructed from scroll, including fast reversal.
        const fold = stagger(pose.leaves, ((i + index) % 3) * .055);
        shoulder.position.set(column * (3.10 + pose.spine * 1.75), sy * (3.28 + pose.hinges * 1.34), -.12);
        shoulder.rotation.set(sy * fold * 1.32, column * (1 - pose.spine) * .16, 0);
        elbow.rotation.x = sy * fold * 1.81;
      });
      rig.updateMatrixWorld(true);
      shutters.forEach(({ shoulder, cylinder, piston, column, sy }) => {
        a.set(column * (3.1 + pose.spine * 1.75), sy * (spreadY + .22), -1.1);
        b.set(0, -sy * .83, -.21).applyMatrix4(shoulder.matrixWorld);
        split.copy(a).lerp(b, .55);
        cylinderBetween(cylinder, a, split, .11); cylinderBetween(piston, split, b, .063);
      });
      for (const batch of batches) {
        batch.parts.forEach((part, i) => { matrix.multiplyMatrices(part.joint.matrixWorld, part.local); batch.mesh.setMatrixAt(i, matrix); });
        batch.mesh.instanceMatrix.needsUpdate = true;
      }
    } };
  }

  return { create, dispose() { if (disposed) return; disposed = true; meshes.forEach(mesh => mesh.dispose()); Object.values(geometries).forEach(geometry => geometry.dispose()); meshes.length = 0; } };
}
