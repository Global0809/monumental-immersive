import * as THREE from 'three';
import { reactiveField as input } from './reactiveField';

const SCAN_RADIUS = 170;
const MAX_OVERLAYS = 28;

function hasVideo(material: THREE.Material) {
  const map = (material as THREE.MeshStandardMaterial).map as THREE.VideoTexture | null | undefined;
  return Boolean(map?.isVideoTexture || material.userData.xrayExcluded);
}

/** A local material reveal; shares the scene renderer and never shades film surfaces. */
export function attachXray(renderer: THREE.WebGLRenderer, materials: THREE.MeshStandardMaterial[], meshes: THREE.Mesh[]) {
  const cursor = { value: new THREE.Vector2(-10000, -10000) };
  const radius = { value: 0 };
  const pixelRatio = { value: renderer.getPixelRatio() };
  const uniforms = 'uniform vec2 scanCursor; uniform float scanRadius; uniform float scanPixelRatio;\n';
  const mask = `float scanDistance = distance(gl_FragCoord.xy, scanCursor) / max(1.0, scanRadius);
    float scan = (1.0 - smoothstep(.28, 1.0, scanDistance)) * step(1.0, scanRadius);`;
  const originals = [...new Set(materials)].filter(m => !hasVideo(m)).map(m => ({
    m, compile: m.onBeforeCompile, key: m.customProgramCacheKey, programKey: m.customProgramCacheKey(),
  }));
  originals.forEach(({ m, compile, programKey }) => {
    m.onBeforeCompile = (shader, activeRenderer) => {
      compile.call(m, shader, activeRenderer);
      shader.uniforms.scanCursor = cursor;
      shader.uniforms.scanRadius = radius;
      shader.uniforms.scanPixelRatio = pixelRatio;
      shader.vertexShader = 'varying vec3 vScanPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vScanPosition = transformed;');
      shader.fragmentShader = uniforms + 'varying vec3 vScanPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `${mask}
        if (scan > .001) {
          float scanRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 1.65);
          // Object-space sections stay attached to the form as it turns.
          float section = vScanPosition.y * 7.0 + vScanPosition.z * 1.8;
          float sectionDistance = abs(fract(section + .5) - .5);
          float sectionWidth = max(fwidth(section) * 1.15, .012);
          float sectionLine = 1.0 - smoothstep(sectionWidth, sectionWidth * 2.0, sectionDistance);
          float fineScan = .5 + .5 * sin(gl_FragCoord.y / max(1.0, scanPixelRatio) * 1.05);
          vec3 heat = mix(vec3(.025, .008, .006), vec3(.78, .075, .026), scanRim);
          heat = mix(heat, vec3(1.0, .78, .64), pow(scanRim, 5.0));
          heat += vec3(.82, .15, .065) * sectionLine * (.14 + scanRim * .25);
          heat += fineScan * vec3(.018, .006, .003);
          // Retain a little original reflection so the reveal still feels metallic.
          outgoingLight = mix(outgoingLight, heat + outgoingLight * .12, scan * .94);
        }
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => `${programKey}|monumental-scan-v2`;
    m.needsUpdate = true;
  });

  const solids = [...new Set(meshes)].filter(mesh => {
    const entries = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    return !mesh.userData.xrayExcluded && !entries.some(hasVideo);
  }).slice(0, MAX_OVERLAYS);
  const edgeBudget = Math.min(1600, Math.floor(14000 / Math.max(1, solids.length)));
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const wire = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
    uniforms: { scanCursor: cursor, scanRadius: radius, scanPixelRatio: pixelRatio },
    vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: uniforms + `void main(){${mask}
      if(scan < .015) discard;
      vec3 tint = mix(vec3(.98,.20,.09), vec3(1.0,.78,.64), scan * .32);
      gl_FragColor = vec4(tint, scan * .40);
    }`,
  });
  const overlays = solids.map(mesh => {
    let geometry = geometries.get(mesh.geometry);
    if (!geometry) {
      const edges = mesh.geometry.getAttribute('position').count <= 48
        ? new THREE.EdgesGeometry(mesh.geometry, 16)
        : new THREE.WireframeGeometry(mesh.geometry);
      const positions = edges.getAttribute('position');
      const segments = positions.count / 2;
      if (segments > edgeBudget) {
        // Sample evenly across the whole object, rather than clipping one side.
        const sampled = new Float32Array(edgeBudget * 6);
        for (let i = 0; i < edgeBudget; i++) {
          const start = Math.floor(i * segments / edgeBudget) * 2;
          for (let endpoint = 0; endpoint < 2; endpoint++) {
            const offset = i * 6 + endpoint * 3;
            sampled[offset] = positions.getX(start + endpoint);
            sampled[offset + 1] = positions.getY(start + endpoint);
            sampled[offset + 2] = positions.getZ(start + endpoint);
          }
        }
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(sampled, 3));
        edges.dispose();
      } else geometry = edges;
      geometries.set(mesh.geometry, geometry);
    }
    const overlay = new THREE.LineSegments(geometry, wire);
    // Depth is essential: the sculpture's nearer film windows remain unobstructed.
    overlay.renderOrder = 4;
    overlay.raycast = () => {};
    overlay.visible = false;
    mesh.add(overlay);
    return overlay;
  });

  let dirty = true;
  let bounds = renderer.domElement.getBoundingClientRect();
  let visible = false;
  const invalidate = () => { dirty = true; };
  const resizer = new ResizeObserver(invalidate);
  resizer.observe(renderer.domElement);
  window.addEventListener('scroll', invalidate, { passive: true });
  window.addEventListener('resize', invalidate, { passive: true });
  return {
    update(enabled = true) {
      if (dirty) { bounds = renderer.domElement.getBoundingClientRect(); dirty = false; }
      const ratio = renderer.getPixelRatio();
      const nearby = input.x > bounds.left - SCAN_RADIUS && input.x < bounds.right + SCAN_RADIUS
        && input.y > bounds.top - SCAN_RADIUS && input.y < bounds.bottom + SCAN_RADIUS;
      const on = enabled && nearby && input.active && !input.reduced && !input.blocked;
      cursor.value.set((input.x - bounds.left) * ratio, (bounds.bottom - input.y) * ratio);
      pixelRatio.value = ratio;
      radius.value = on ? SCAN_RADIUS * ratio : 0;
      if (on !== visible) { overlays.forEach(overlay => { overlay.visible = on; }); visible = on; }
    },
    dispose() {
      resizer.disconnect();
      window.removeEventListener('scroll', invalidate);
      window.removeEventListener('resize', invalidate);
      overlays.forEach(overlay => overlay.removeFromParent());
      geometries.forEach(geometry => geometry.dispose());
      wire.dispose();
      originals.forEach(({ m, compile, key }) => {
        m.onBeforeCompile = compile; m.customProgramCacheKey = key; m.needsUpdate = true;
      });
    },
  };
}
