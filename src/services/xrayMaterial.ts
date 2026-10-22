import * as THREE from 'three';
import { reactiveField as input } from './reactiveField';

/** Reuses the existing renderer. Only the bounded cursor lens is shaded. */
export function attachXray(renderer: THREE.WebGLRenderer, materials: THREE.MeshStandardMaterial[], meshes: THREE.Mesh[]) {
  const cursor = { value: new THREE.Vector2(-10000, -10000) };
  const radius = { value: 0 };
  const uniforms = 'uniform vec2 scanCursor; uniform float scanRadius;\n';
  const mask = 'float scan = (1.0-smoothstep(scanRadius*.35, max(1.0,scanRadius), distance(gl_FragCoord.xy,scanCursor))) * step(1.0,scanRadius);';
  const originals = materials.map(m => ({ m, compile: m.onBeforeCompile, key: m.customProgramCacheKey }));
  materials.forEach(m => {
    m.onBeforeCompile = shader => {
      shader.uniforms.scanCursor = cursor; shader.uniforms.scanRadius = radius;
      shader.fragmentShader = uniforms + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `${mask}
        float edge = pow(1.0-abs(dot(normalize(normal),normalize(vViewPosition))),1.6);
        float contour = smoothstep(.92,1.0,sin(gl_FragCoord.y*.55));
        vec3 thermal = mix(vec3(.16,.022,.008), vec3(1.0,.23,.065),edge);
        thermal = mix(thermal,vec3(1.0,.88,.66),pow(edge,4.0));
        outgoingLight = mix(outgoingLight,thermal + contour*.075, scan*.93);
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'monumental-scan-v1'; m.needsUpdate = true;
  });
  const wire = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, depthTest:false, wireframe:true,
    uniforms:{scanCursor:cursor, scanRadius:radius},
    vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:uniforms+`void main(){${mask} if(scan<.01) discard;gl_FragColor=vec4(1.0,.35,.15,scan*.36);}`,
  });
  const overlays = meshes.map(mesh => { const overlay = new THREE.Mesh(mesh.geometry,wire); overlay.renderOrder=4; overlay.raycast=()=>{}; mesh.add(overlay); return overlay; });
  let dirty=true, bounds=renderer.domElement.getBoundingClientRect();
  const invalidate=()=>{dirty=true;};
  window.addEventListener('scroll',invalidate,{passive:true});window.addEventListener('resize',invalidate,{passive:true});
  return {
    update(enabled=true) {
      if(dirty){bounds=renderer.domElement.getBoundingClientRect();dirty=false;}
      const ratio=renderer.getPixelRatio();
      const on=enabled&&input.active&&!input.reduced&&!input.blocked;
      cursor.value.set((input.x-bounds.left)*ratio,(bounds.bottom-input.y)*ratio);
      radius.value=on?170*ratio:0;
      overlays.forEach(o=>{o.visible=on;});
    },
    dispose(){window.removeEventListener('scroll',invalidate);window.removeEventListener('resize',invalidate);overlays.forEach(o=>o.removeFromParent());wire.dispose();originals.forEach(({m,compile,key})=>{m.onBeforeCompile=compile;m.customProgramCacheKey=key;});},
  };
}
