import * as THREE from 'three';
import { acquireXrayPointer, invalidateXrayPointer, readXrayPointer } from './xrayPointer';
import { advanceXrayLens, createXrayLens } from './xrayLens';

const SCAN_RADIUS = 170;
const MAX_OVERLAYS = 28;

function hasVideo(material: THREE.Material) {
  const map = (material as THREE.MeshStandardMaterial).map as THREE.VideoTexture | null | undefined;
  return Boolean(map?.isVideoTexture || material.userData.xrayExcluded);
}

/** A local material reveal; shares the scene renderer and never shades film surfaces. */
export function attachXray(renderer: THREE.WebGLRenderer, materials: THREE.MeshStandardMaterial[], meshes: THREE.Mesh[], requestDraw?: () => void) {
  const cursor = { value: new THREE.Vector2(-10000, -10000) };
  const radius = { value: 0 };
  const resolutionScale = { value: new THREE.Vector2(1, 1) }, strength = { value: 0 };
  const uniforms = 'uniform vec2 scanCursor; uniform float scanRadius; uniform vec2 scanResolutionScale; uniform float scanStrength;\n';
  const mask = `float scanDistance = distance(gl_FragCoord.xy / scanResolutionScale, scanCursor) / max(1.0, scanRadius);
    float scan = (1.0 - smoothstep(.28, 1.0, scanDistance)) * scanStrength;`;
  const originals = [...new Set(materials)].filter(m => !hasVideo(m)).map(m => ({
    m, compile: m.onBeforeCompile, key: m.customProgramCacheKey, programKey: m.customProgramCacheKey(),
  }));
  originals.forEach(({ m, compile, programKey }) => {
    m.onBeforeCompile = (shader, activeRenderer) => {
      compile.call(m, shader, activeRenderer);
      shader.uniforms.scanCursor = cursor;
      shader.uniforms.scanRadius = radius;
      shader.uniforms.scanResolutionScale = resolutionScale;
      shader.uniforms.scanStrength = strength;
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
          vec3 heat = mix(vec3(.025, .008, .006), vec3(.78, .075, .026), scanRim);
          heat = mix(heat, vec3(1.0, .78, .64), pow(scanRim, 5.0));
          heat += vec3(.82, .15, .065) * sectionLine * (.14 + scanRim * .25);
          // Retain a little original reflection so the reveal still feels metallic.
          outgoingLight = mix(outgoingLight, heat + outgoingLight * .12, scan * .94);
        }
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => `${programKey}|monumental-scan-v3`;
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
    uniforms: { scanCursor: cursor, scanRadius: radius, scanResolutionScale: resolutionScale, scanStrength: strength },
    // A tiny clip-depth bias prevents coplanar lines flickering against their
    // own shell, while real nearer film surfaces still occlude the overlay.
    vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position.z-=.000015*gl_Position.w;}',
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

  let dirty = true, disposed = false;
  let bounds = renderer.domElement.getBoundingClientRect();
  let visible = false;
  const lens = createXrayLens(), drawingSize = new THREE.Vector2();
  const invalidate = (layout = false) => {
    dirty = true;
    const input = readXrayPointer();
    // A layout event can move a previously distant paused canvas beneath the
    // stationary cursor. Force one eligible frame before trusting cached bounds.
    // Actual bounds are measured once by that frame, not by each pointer event.
    if (layout || visible || input.x > bounds.left - SCAN_RADIUS && input.x < bounds.right + SCAN_RADIUS && input.y > bounds.top - SCAN_RADIUS && input.y < bounds.bottom + SCAN_RADIUS) requestDraw?.();
  };
  const releasePointer = acquireXrayPointer(invalidate);
  const resizer = new ResizeObserver(() => { dirty = true; invalidateXrayPointer(); });
  resizer.observe(renderer.domElement);
  return {
    /** True only while a local reveal is settling; paused scenes request those
     * bounded frames through their existing scheduler and then rest again. */
    update(enabled = true, now = performance.now()) {
      if (disposed) return false;
      if (dirty) { bounds = renderer.domElement.getBoundingClientRect(); dirty = false; }
      const input = readXrayPointer();
      renderer.getDrawingBufferSize(drawingSize);
      const nearby = input.x > bounds.left - SCAN_RADIUS && input.x < bounds.right + SCAN_RADIUS
        && input.y > bounds.top - SCAN_RADIUS && input.y < bounds.bottom + SCAN_RADIUS;
      const on = enabled && nearby && input.active && !input.pressed;
      const settling = advanceXrayLens(lens, input.x, input.y, on, now, !enabled || input.pressed || input.blocked || document.hidden || bounds.width <= 0 || bounds.height <= 0);
      cursor.value.set(lens.x - bounds.left, bounds.bottom - lens.y);
      resolutionScale.value.set(drawingSize.x / Math.max(1, bounds.width), drawingSize.y / Math.max(1, bounds.height));
      radius.value = SCAN_RADIUS; strength.value = lens.strength;
      const shown = lens.strength > .001;
      if (shown !== visible) { overlays.forEach(overlay => { overlay.visible = shown; }); visible = shown; }
      return settling;
    },
    dispose() {
      if (disposed) return; disposed = true;
      resizer.disconnect();
      releasePointer();
      overlays.forEach(overlay => overlay.removeFromParent());
      geometries.forEach(geometry => geometry.dispose());
      wire.dispose();
      originals.forEach(({ m, compile, key }) => {
        m.onBeforeCompile = compile; m.customProgramCacheKey = key; m.needsUpdate = true;
      });
    },
  };
}
