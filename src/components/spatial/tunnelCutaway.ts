import * as THREE from 'three';

/** Screen-space inspection exposes real structure behind the lining. Only
 * explicitly marked shell materials are cut; no media, DOM or global filter. */
export function createTunnelCutaway(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const uniforms = { uLens: { value: new THREE.Vector4(-9999, -9999, 0, 1) } };
  const header = 'uniform vec4 uLens;\n';
  const field = `vec2 lensDelta=(gl_FragCoord.xy-uLens.xy)/max(uLens.z,1.); 
    float lensAngle=atan(lensDelta.y,lensDelta.x);
    float lensShape=1.+.045*cos(lensAngle*3.)+.025*sin(lensAngle*5.);
    float lensDistance=length(lensDelta)/lensShape;
    float lens=1.-smoothstep(.82,1.,lensDistance);`;
  const originals: { material: THREE.MeshStandardMaterial; compile: THREE.MeshStandardMaterial['onBeforeCompile']; key: THREE.MeshStandardMaterial['customProgramCacheKey'] }[] = [];
  const patched = new Set<THREE.Material>();
  function bindMaterials() {
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const mat of materials) {
        if (!(mat instanceof THREE.MeshStandardMaterial) || !mat.userData.passageShell || mat.map || patched.has(mat)) continue;
        patched.add(mat);
        const compile = mat.onBeforeCompile, key = mat.customProgramCacheKey, prior = key.call(mat);
        originals.push({ material: mat, compile, key });
        mat.onBeforeCompile = (shader, activeRenderer) => {
          compile.call(mat, shader, activeRenderer); shader.uniforms.uLens = uniforms.uLens;
          shader.fragmentShader = header + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
            if(uLens.z>1.){${field}
              float screenDoor=fract(dot(floor(gl_FragCoord.xy),vec2(.75487766,.56984029)));
              if(lens>screenDoor) discard;
            }`);
        };
        mat.customProgramCacheKey = () => prior + '|passage-structural-cutaway-v1'; mat.needsUpdate = true;
      }
    });
  }
  const root = new THREE.Group(); root.name = 'passage-internal-trusses'; scene.add(root);
  const material = new THREE.ShaderMaterial({ uniforms, transparent: false, depthWrite: true, toneMapped: false,
    vertexShader: `varying vec3 vNormal;varying vec3 vWorld;void main(){vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);vec4 w=modelMatrix*instanceMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: header + `varying vec3 vNormal;varying vec3 vWorld;void main(){${field}if(uLens.z<1.||lens<.02)discard;
      float illumination=.32+.68*abs(dot(normalize(vNormal),normalize(vec3(-.3,.8,.7))));
      vec3 metal=mix(vec3(.36,.39,.37),vec3(.82,.80,.73),illumination);
      float junction=step(.91,fract(vWorld.z*.274));
      gl_FragColor=vec4(mix(metal,vec3(1.,.302,.196),junction*.72),1.);
      #include <colorspace_fragment>
    }` });
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 6);
  const nodeGeometry = new THREE.IcosahedronGeometry(1, 0);
  const beams = new THREE.InstancedMesh(cylinder, material, 90 * 6 * 3);
  const nodes = new THREE.InstancedMesh(nodeGeometry, material, 90 * 6);
  const dummy = new THREE.Object3D(), a = new THREE.Vector3(), b = new THREE.Vector3(), direction = new THREE.Vector3(), axis = new THREE.Vector3(0, 1, 0);
  let index = 0;
  const beam = (start: THREE.Vector3, end: THREE.Vector3, radius: number) => {
    direction.subVectors(end, start); dummy.position.copy(start).add(end).multiplyScalar(.5);
    dummy.quaternion.setFromUnitVectors(axis, direction.clone().normalize()); dummy.scale.set(radius, direction.length(), radius); dummy.updateMatrix(); beams.setMatrixAt(index++, dummy.matrix);
  };
  for (let row = 0; row < 90; row++) for (let lane = 0; lane < 6; lane++) {
    const angle = lane * Math.PI / 3 + row * .058, z = 18 - row * 3.65, r = 9.45;
    a.set(Math.cos(angle) * r, Math.sin(angle) * r, z); b.set(Math.cos(angle + .058) * r, Math.sin(angle + .058) * r, z - 3.65); beam(a, b, .045);
    b.set(Math.cos(angle + Math.PI / 3) * r, Math.sin(angle + Math.PI / 3) * r, z); beam(a, b, .055);
    b.set(Math.cos(angle + Math.PI / 3 + .058) * r, Math.sin(angle + Math.PI / 3 + .058) * r, z - 3.65); beam(a, b, .024);
    dummy.position.copy(a); dummy.quaternion.identity(); dummy.scale.setScalar(.13); dummy.updateMatrix(); nodes.setMatrixAt(row * 6 + lane, dummy.matrix);
  }
  beams.instanceMatrix.needsUpdate = nodes.instanceMatrix.needsUpdate = true;
  beams.computeBoundingSphere(); nodes.computeBoundingSphere(); root.add(beams, nodes); root.visible = false;
  bindMaterials();
  let x = -9999, y = -9999, strength = 0;
  return {
    bindMaterials,
    update(pointer: readonly [number, number], enabled: boolean, width: number, height: number, delta: number) {
      const ratio = renderer.getPixelRatio();
      const follow = 1 - Math.exp(-Math.min(.05, delta) * 22);
      strength += ((enabled ? 1 : 0) - strength) * follow;
      // Cursor coordinates stay exact; only the lens opening is eased.
      if (enabled) { x = (pointer[0] + 1) * width * .5; y = (pointer[1] + 1) * height * .5; }
      const radius = Math.min(185, width * .14, height * .22) * ratio * strength;
      uniforms.uLens.value.set(x * ratio, y * ratio, radius, ratio);
      root.visible = radius > 1;
      return root.visible;
    },
    destroy() {
      for (const entry of originals) { entry.material.onBeforeCompile = entry.compile; entry.material.customProgramCacheKey = entry.key; entry.material.needsUpdate = true; }
      scene.remove(root); beams.dispose(); nodes.dispose(); cylinder.dispose(); nodeGeometry.dispose(); material.dispose(); patched.clear();
    },
  };
}
