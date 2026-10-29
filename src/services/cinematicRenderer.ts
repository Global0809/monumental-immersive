import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { cinematicBufferSize, cinematicRect, type CinematicRect } from './cinematicLight';

export type CinematicFrame = { enabled?: boolean; strength?: number; lens?: number; protectedRects?: readonly CinematicRect[] };
const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const protection = `uniform vec4 uProtect[4];
float protectedAt(vec2 p){float m=0.;for(int i=0;i<4;i++){vec4 r=uProtect[i];
if(r.z>r.x&&r.w>r.y){vec2 inside=smoothstep(r.xy-vec2(.004),r.xy,p)*(1.-smoothstep(r.zw,r.zw+vec2(.004),p));m=max(m,inside.x*inside.y);}}return m;}`;

/** Display-referred optics after the scene's native antialiasing/tone mapping.
 * GPU-only framebuffer copy preserves toneMapped:false footage exactly. The
 * scene renders once; three small/fullscreen quads add highlight diffusion and
 * restrained peripheral softness. DOM never enters this pipeline. No RAF. */
export function createCinematicRenderer(renderer: THREE.WebGLRenderer) {
  let capture: THREE.FramebufferTexture | null = null, bloomA: THREE.WebGLRenderTarget | null = null, bloomB: THREE.WebGLRenderTarget | null = null;
  let width = 0, height = 0, disposed = false;
  const size = new THREE.Vector2();
  const rectangles = Array.from({ length: 4 }, () => new THREE.Vector4());
  const extract = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    uniforms: { tFrame: { value: null }, uStep: { value: new THREE.Vector2() }, uProtect: { value: rectangles } }, vertexShader: vertex,
    fragmentShader: `varying vec2 vUv;uniform sampler2D tFrame;uniform vec2 uStep;${protection}
vec3 bright(vec2 uv){vec3 c=texture2D(tFrame,uv).rgb;float peak=max(c.r,max(c.g,c.b));float l=dot(c,vec3(.2126,.7152,.0722));
return c*smoothstep(.66,.98,max(l,peak*.91))*(1.-protectedAt(uv));}
void main(){vec3 c=bright(vUv)*.227027;c+=(bright(vUv+uStep*1.384615)+bright(vUv-uStep*1.384615))*.316216;
c+=(bright(vUv+uStep*3.230769)+bright(vUv-uStep*3.230769))*.070270;gl_FragColor=vec4(c,1.);}` });
  const blur = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    uniforms: { tFrame: { value: null }, uStep: { value: new THREE.Vector2() } }, vertexShader: vertex,
    fragmentShader: `varying vec2 vUv;uniform sampler2D tFrame;uniform vec2 uStep;
void main(){vec3 c=texture2D(tFrame,vUv).rgb*.227027;
c+=(texture2D(tFrame,vUv+uStep*1.384615).rgb+texture2D(tFrame,vUv-uStep*1.384615).rgb)*.316216;
c+=(texture2D(tFrame,vUv+uStep*3.230769).rgb+texture2D(tFrame,vUv-uStep*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}` });
  const finish = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    uniforms: { tFrame: { value: null }, tGlow: { value: null }, uPixel: { value: new THREE.Vector2() }, uStrength: { value: .22 }, uLens: { value: 0 }, uProtect: { value: rectangles } }, vertexShader: vertex,
    fragmentShader: `varying vec2 vUv;uniform sampler2D tFrame,tGlow;uniform vec2 uPixel;uniform float uStrength,uLens;${protection}
void main(){vec4 original=texture2D(tFrame,vUv);float safe=1.-protectedAt(vUv);vec4 c=original;
float edge=smoothstep(.30,.73,length((vUv-.5)*vec2(1.,.85)));float radius=uLens*edge*1.75;
if(radius>.01&&safe>.001){vec2 d=uPixel*radius;vec4 soft=(texture2D(tFrame,vUv+vec2(d.x,d.y))+texture2D(tFrame,vUv+vec2(-d.x,d.y))+texture2D(tFrame,vUv+vec2(d.x,-d.y))+texture2D(tFrame,vUv-d))*.25;c=mix(original,soft,min(.62,uLens)*edge*safe);}
vec3 glow=texture2D(tGlow,vUv).rgb*uStrength*safe;
// Highlight halation retains local contrast, with no whole-frame color grade.
c.rgb+=glow*(1.-c.rgb*.62);c.a=max(c.a,max(glow.r,max(glow.g,glow.b)));
c.rgb*=1.-edge*.045*safe;gl_FragColor=mix(c,original,1.-safe);}` });
  const quad = new FullScreenQuad(extract);
  function releaseBuffers() { capture?.dispose(); bloomA?.dispose(); bloomB?.dispose(); capture = null; bloomA = bloomB = null; width = height = 0; }
  function prepare(w: number, h: number) {
    const dims = cinematicBufferSize(w, h); if (!dims) return false;
    if (capture && width === dims.width && height === dims.height) return true;
    releaseBuffers(); width = dims.width; height = dims.height;
    capture = new THREE.FramebufferTexture(width, height); capture.minFilter = capture.magFilter = THREE.LinearFilter;
    const config = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false };
    bloomA = new THREE.WebGLRenderTarget(dims.bloomWidth, dims.bloomHeight, config); bloomB = bloomA.clone();
    extract.uniforms.tFrame.value = capture; extract.uniforms.uStep.value.set(1.65 / dims.bloomWidth, 0);
    blur.uniforms.tFrame.value = bloomA.texture; blur.uniforms.uStep.value.set(0, .85 / dims.bloomHeight);
    finish.uniforms.tFrame.value = capture; finish.uniforms.tGlow.value = bloomB.texture; finish.uniforms.uPixel.value.set(1 / width, 1 / height);
    return true;
  }
  return {
    render(scene: THREE.Scene, camera: THREE.Camera, options: CinematicFrame = {}) {
      if (disposed) return;
      renderer.getDrawingBufferSize(size);
      const enabled = options.enabled !== false && !renderer.getRenderTarget() && cinematicBufferSize(size.x, size.y) !== null;
      if (!enabled) { if (capture) releaseBuffers(); renderer.domElement.dataset.cinematic = 'native'; renderer.render(scene, camera); return; }
      if (!prepare(size.x, size.y)) { renderer.render(scene, camera); return; }
      rectangles.forEach((vector, i) => { const rect = options.protectedRects?.[i]; vector.fromArray(rect ? cinematicRect(rect) : [0, 0, 0, 0]); });
      finish.uniforms.uStrength.value = Math.max(0, Math.min(.42, options.strength ?? .22));
      finish.uniforms.uLens.value = Math.max(0, Math.min(1, options.lens ?? 0));
      const autoReset = renderer.info.autoReset;
      renderer.info.autoReset = false; renderer.info.reset();
      try {
        renderer.render(scene, camera); renderer.copyFramebufferToTexture(capture!);
        quad.material = extract; renderer.setRenderTarget(bloomA); quad.render(renderer);
        quad.material = blur; renderer.setRenderTarget(bloomB); quad.render(renderer);
        quad.material = finish; renderer.setRenderTarget(null); quad.render(renderer);
        renderer.domElement.dataset.cinematic = 'optics';
        renderer.domElement.dataset.cinematicLens = finish.uniforms.uLens.value.toFixed(3);
        renderer.domElement.dataset.cinematicProtected = String(Math.min(4, options.protectedRects?.length || 0));
      } finally { renderer.setRenderTarget(null); renderer.info.autoReset = autoReset; }
    },
    dispose() { if (disposed) return; disposed = true; releaseBuffers(); extract.dispose(); blur.dispose(); finish.dispose(); quad.dispose(); },
  };
}
