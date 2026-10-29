import * as THREE from 'three';

/** The probe intersects the lining in world space. A finite inspection volume
 * exposes one bay, rather than erasing every surface beneath a screen circle. */
export function liningIntersection(ray: THREE.Ray, target: THREE.Vector3) {
  const { origin: o, direction: d } = ray, r = 8.97;
  const a = d.x * d.x + d.y * d.y;
  if (a < .0001) return false;
  const b = o.x * d.x + o.y * d.y, c = o.x * o.x + o.y * o.y - r * r;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return false;
  const t = (-b + Math.sqrt(discriminant)) / a;
  if (t < .1 || t > 56) return false;
  ray.at(t, target);
  return target.z < 20 && target.z > -313;
}

const declarations = 'uniform vec4 uSection; varying vec3 vSectionWorld;\n';
const worldVertex = `#include <project_vertex>
  vec4 sectionPosition=vec4(transformed,1.);
  #ifdef USE_INSTANCING
    sectionPosition=instanceMatrix*sectionPosition;
  #endif
  vSectionWorld=(modelMatrix*sectionPosition).xyz;`;
const distanceField = 'float sectionDistance=length(vSectionWorld-uSection.xyz)-uSection.w;';

export function createTunnelCutaway(scene: THREE.Scene, _renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
  const section = { value: new THREE.Vector4(0, 0, 0, 0) };
  const patched = new Set<THREE.Material>();
  const originals: { material: THREE.MeshStandardMaterial; compile: THREE.MeshStandardMaterial['onBeforeCompile']; key: THREE.MeshStandardMaterial['customProgramCacheKey']; alpha: boolean }[] = [];
  const relayShells: THREE.Mesh[] = [];
  function bindMaterials() {
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial) || !material.userData.passageShell || material.map) continue;
        if (object.name === 'relay-shell-components' && !relayShells.includes(object)) relayShells.push(object);
        if (patched.has(material)) continue;
        patched.add(material);
        const compile = material.onBeforeCompile, key = material.customProgramCacheKey, prior = key.call(material);
        originals.push({ material, compile, key, alpha: material.alphaToCoverage });
        // MSAA covers a sub-pixel cut edge. No screen-door noise, transparency
        // sorting, bright ring, or second rendering pass is involved.
        material.alphaToCoverage = true;
        material.onBeforeCompile = (shader, activeRenderer) => {
          compile.call(material, shader, activeRenderer);
          shader.uniforms.uSection = section;
          shader.vertexShader = 'varying vec3 vSectionWorld;\n' + shader.vertexShader.replace('#include <project_vertex>', worldVertex);
          shader.fragmentShader = declarations + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
            if(uSection.w>.001){${distanceField}
              float aa=max(fwidth(sectionDistance),.001);
              float coverage=smoothstep(-aa,aa,sectionDistance);
              if(coverage<.001)discard;
              diffuseColor.a*=coverage;
            }`);
          shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
            if(uSection.w>.001){${distanceField}
              float edgeWidth=max(fwidth(sectionDistance)*1.6,.018);
              float bevel=1.-smoothstep(0.,edgeWidth*2.2,sectionDistance);
              // A satin cut lip follows the actual shell, never the empty air.
              outgoingLight=mix(outgoingLight,outgoingLight*.4+vec3(.27,.28,.25),bevel*.65);
            }
            #include <opaque_fragment>`);
        };
        material.customProgramCacheKey = () => prior + '|monumental-section-v3'; material.needsUpdate = true;
      }
    });
  }

  const root = new THREE.Group(); root.name = 'passage-service-bays'; root.visible = false; scene.add(root);
  const geometries = new Set<THREE.BufferGeometry>(), materials: THREE.MeshStandardMaterial[] = [], batches: THREE.InstancedMesh[] = [];
  function interior(color: number, metalness: number, roughness: number) {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness, envMapIntensity: .65, alphaToCoverage: true });
    material.onBeforeCompile = shader => {
      shader.uniforms.uSection = section;
      shader.vertexShader = 'varying vec3 vSectionWorld;\n' + shader.vertexShader.replace('#include <project_vertex>', worldVertex);
      shader.fragmentShader = declarations + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
        ${distanceField}
        if(uSection.w<.001||sectionDistance>.85)discard;`);
    };
    material.customProgramCacheKey = () => 'monumental-service-bay-v3'; materials.push(material); return material;
  }
  const titanium = interior(0x818781, .82, .34), graphite = interior(0x222a26, .62, .52);
  const insulation = interior(0x742c23, .27, .61), fastener = interior(0xc4c5b9, .88, .27);
  const rows = 90, lanes = 12, visibleRows = 7;
  const templates = new Map<THREE.InstancedMesh, { matrices: Float32Array; instancesPerRow: number }>();
  function batch(geometry: THREE.BufferGeometry, material: THREE.Material, instancesPerBay: number) {
    const instancesPerRow = lanes * instancesPerBay;
    geometries.add(geometry); const mesh = new THREE.InstancedMesh(geometry, material, visibleRows * instancesPerRow);
    mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    templates.set(mesh, { matrices: new Float32Array(rows * instancesPerRow * 16), instancesPerRow });
    batches.push(mesh); root.add(mesh); return mesh;
  }
  const rails = batch(new THREE.BoxGeometry(1, 1, 1), titanium, 2);
  const housings = batch(new THREE.BoxGeometry(1, 1, 1), graphite, 1);
  const cables = batch(new THREE.CylinderGeometry(1, 1, 1, 10), insulation, 2);
  const collars = batch(new THREE.CylinderGeometry(1, 1, 1, 12), fastener, 4);
  const dummy = new THREE.Object3D(), start = new THREE.Vector3(), end = new THREE.Vector3(), direction = new THREE.Vector3(), axis = new THREE.Vector3(0, 1, 0);
  function put(mesh: THREE.InstancedMesh, index: number) { dummy.updateMatrix(); dummy.matrix.toArray(templates.get(mesh)!.matrices, index * 16); }
  for (let row = 0; row < rows; row++) for (let lane = 0; lane < lanes; lane++) {
    const index = row * lanes + lane, angle = lane * Math.PI / 6 + row * .058;
    const radius = 8.8 + Math.sin(row * .46) * .34, z = 18 - row * 3.65 - 1.35;
    const c = Math.cos(angle), s = Math.sin(angle), span = 2 * radius * Math.sin(Math.PI / 12) * .95;
    // Twin flanges and a recessed chassis follow the same bay pitch as the
    // outer wall. Their depth, fixings and cable routing survive camera travel.
    for (let side = 0; side < 2; side++) {
      dummy.position.set(c * (radius + .78), s * (radius + .78), z + (side ? 1.17 : -1.17));
      dummy.rotation.set(0, 0, angle + Math.PI / 2); dummy.scale.set(span, .16, .12); put(rails, index * 2 + side);
    }
    dummy.position.set(c * (radius + 1.12), s * (radius + 1.12), z);
    dummy.rotation.set(0, 0, angle + Math.PI / 2); dummy.scale.set(span * .92, .11, 2.4); put(housings, index);
    for (let cable = 0; cable < 2; cable++) {
      const offset = (cable ? 1 : -1) * .32;
      start.set(c * (radius + .88) - s * offset, s * (radius + .88) + c * offset, z - 1.75);
      end.copy(start); end.z += 3.5; direction.subVectors(end, start);
      dummy.position.copy(start).add(end).multiplyScalar(.5); dummy.quaternion.setFromUnitVectors(axis, direction.normalize());
      dummy.scale.set(.055, 3.5, .055); put(cables, index * 2 + cable);
      for (let mount = 0; mount < 2; mount++) {
        dummy.position.copy(start); dummy.position.z = z + (mount ? 1.17 : -1.17);
        dummy.scale.set(.085, .12, .085); put(collars, index * 4 + cable * 2 + mount);
      }
    }
  }
  let firstVisibleRow = -1;
  function selectRows(z: number) {
    const focusRow = Math.round((18 - 1.35 - z) / 3.65);
    const first = THREE.MathUtils.clamp(focusRow - Math.floor(visibleRows / 2), 0, rows - visibleRows);
    if (first === firstVisibleRow) return;
    firstVisibleRow = first;
    // Full world-coordinate templates stay on the CPU. Only this seven-row
    // window reaches the GPU; stable focus and relay inspection upload nothing.
    for (const mesh of batches) {
      const { matrices, instancesPerRow } = templates.get(mesh)!;
      const offset = first * instancesPerRow * 16;
      mesh.count = visibleRows * instancesPerRow;
      mesh.instanceMatrix.array.set(matrices.subarray(offset, offset + mesh.count * 16));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }
  bindMaterials();
  const raycaster = new THREE.Raycaster(), point = new THREE.Vector2(), focus = new THREE.Vector3(), view = new THREE.Vector3();
  const hits: THREE.Intersection[] = [];
  let strength = 0;
  function reset() { strength = 0; section.value.w = 0; root.visible = false; }
  return {
    bindMaterials, reset,
    update(pointer: readonly [number, number], enabled: boolean, _width: number, height: number, delta: number) {
      if (!enabled) { reset(); return false; }
      point.set(pointer[0], pointer[1]); raycaster.setFromCamera(point, camera);
      hits.length = 0;
      for (const mesh of relayShells) {
        let visible = true; for (let parent: THREE.Object3D | null = mesh; parent; parent = parent.parent) if (!parent.visible) visible = false;
        if (visible) { mesh.updateWorldMatrix(true, false); mesh.raycast(raycaster, hits); }
      }
      hits.sort((a, b) => a.distance - b.distance);
      const relay = hits[0];
      if (relay) focus.copy(relay.point);
      else if (!liningIntersection(raycaster.ray, focus)) { reset(); return false; }
      if (!relay) selectRows(focus.z);
      view.copy(focus).applyMatrix4(camera.matrixWorldInverse);
      const focalLength = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      const radius = relay ? .88 : THREE.MathUtils.clamp(155 * -view.z / focalLength, 1.2, 3.9);
      strength += (1 - strength) * (1 - Math.exp(-Math.min(.05, delta) * 16));
      section.value.set(focus.x, focus.y, focus.z, radius * strength);
      root.visible = !relay && strength > .01;
      return strength > .01;
    },
    destroy() {
      for (const entry of originals) { entry.material.onBeforeCompile = entry.compile; entry.material.customProgramCacheKey = entry.key; entry.material.alphaToCoverage = entry.alpha; entry.material.needsUpdate = true; }
      scene.remove(root); batches.forEach(mesh => mesh.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); templates.clear(); patched.clear(); relayShells.length = 0;
    },
  };
}
