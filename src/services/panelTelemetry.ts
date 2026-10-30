import * as THREE from 'three';

export type PanelTelemetryFrame = {
  time: number; reading?: number | boolean; pointer?: readonly [number, number]; pointerActive?: boolean;
  energy?: number; cameraZ?: number; calm?: boolean; quality?: string | number; enabled?: boolean;
};
export type PanelTelemetryProtection = { left: number; top: number; right: number; bottom: number };

// Authored 5×7 glyphs: numbers and arithmetic, not an animated noise texture.
export const PANEL_GLYPHS = '0123456789ABCDEF+-=:/[]>';
const bitmaps = [
  [14,17,19,21,25,17,14], [4,12,4,4,4,4,14], [14,17,1,2,4,8,31], [30,1,1,14,1,1,30],
  [2,6,10,18,31,2,2], [31,16,16,30,1,1,30], [14,16,16,30,17,17,14], [31,1,2,4,8,8,8],
  [14,17,17,14,17,17,14], [14,17,17,15,1,1,14], [14,17,17,31,17,17,17], [30,17,17,30,17,17,30],
  [14,17,16,16,16,17,14], [30,17,17,17,17,17,30], [31,16,16,30,16,16,31], [31,16,16,30,16,16,16],
  [0,4,4,31,4,4,0], [0,0,0,31,0,0,0], [0,0,31,0,31,0,0], [0,4,4,0,4,4,0],
  [1,2,2,4,8,8,16], [14,8,8,8,8,8,14], [14,2,2,2,2,2,14], [0,8,4,2,4,8,0],
];

export function buildPanelGlyphAtlas() {
  const width = 128, height = 64, data = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) data[pixel * 4 + 3] = 255;
  bitmaps.forEach((rows, glyph) => rows.forEach((bits, row) => {
    for (let column = 0; column < 5; column++) if (bits & (1 << (4 - column))) {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        const offset = (((Math.floor(glyph / 8) * 16 + 1 + (6 - row) * 2 + y) * width)
          + (glyph % 8) * 16 + 3 + column * 2 + x) * 4;
        data[offset] = data[offset + 1] = data[offset + 2] = 255;
      }
    }
  }));
  return { width, height, data };
}

let atlas: THREE.DataTexture | null = null, atlasUsers = 0;
function acquireAtlas() {
  if (!atlas) {
    const source = buildPanelGlyphAtlas();
    atlas = new THREE.DataTexture(source.data, source.width, source.height, THREE.RGBAFormat);
    atlas.name = 'Monumental panel glyphs'; atlas.colorSpace = THREE.NoColorSpace;
    atlas.magFilter = THREE.LinearFilter; atlas.minFilter = THREE.LinearMipmapLinearFilter;
    atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping; atlas.generateMipmaps = true;
    atlas.needsUpdate = true;
  }
  atlasUsers++;
  return atlas;
}
function releaseAtlas() { if (--atlasUsers === 0) { atlas?.dispose(); atlas = null; } }
const clamp = (value: number | undefined, min: number, max: number, fallback = min) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback;

const varyingDeclarations = `
varying vec2 vPanelUv;
varying float vPanelFace;
varying float vPanelSeed;
varying vec4 vPanelProjection;
`;
const fragmentDeclarations = `${varyingDeclarations}
uniform sampler2D uPanelAtlas;
uniform float uPanelTime, uPanelReading, uPanelEnergy, uPanelCameraZ, uPanelCalm, uPanelQuality;
uniform vec3 uPanelPointer;
uniform vec4 uPanelProtected[4];
uniform int uPanelProtectedCount;
float panelHash(float n){return fract(sin(n*12.9898+78.233)*43758.5453);}
float panelBand(float position,float center,float width){
  float aa=max(fwidth(position),.0007);
  return 1.-smoothstep(width,width+aa,abs(position-center));
}
float panelGlyph(float glyph,vec2 p){
  // Padded cells and mipmaps keep the strokes stable while the camera travels.
  vec2 at=(vec2(mod(glyph,8.),floor(glyph/8.))*16.+vec2(3.,1.)+p*vec2(10.,14.))/vec2(128.,64.);
  return texture2D(uPanelAtlas,at).r;
}
float panelCalculation(float column,float row,float seed,float tick){
  float a=floor(panelHash(seed+row*19.+tick)*80.)+10.;
  float b=floor(panelHash(seed+row*31.+tick+8.)*80.)+10.;
  float sum=a+b;
  if(column<1.)return floor(panelHash(seed)*16.);
  if(column<2.)return mod(row,16.);
  if(column<3.)return 19.;
  if(column<4.)return floor(a/10.);
  if(column<5.)return mod(a,10.);
  if(column<6.)return 16.;
  if(column<7.)return floor(b/10.);
  if(column<8.)return mod(b,10.);
  if(column<9.)return 18.;
  if(column<10.)return floor(sum/100.);
  if(column<11.)return mod(floor(sum/10.),10.);
  return mod(sum,10.);
}
`;

const emission = `
#include <emissivemap_fragment>
// Physical faces own the display. The other faces retain their authored alloy.
float panelDistance=abs(vPanelProjection.w-uPanelCameraZ);
if(vPanelFace>.5 && panelDistance<55.){
  vec2 p=vPanelUv;
  float panelInset=smoothstep(.035,.06,p.x)*(1.-smoothstep(.94,.965,p.x))
    *smoothstep(.045,.075,p.y)*(1.-smoothstep(.925,.955,p.y));
  if(panelInset>.001){
    float lod=1.-smoothstep(28.+uPanelQuality*10.,55.,panelDistance);
    float seed=vPanelSeed;
    float rowSpeed=.06*(1.-uPanelReading*.72)*(1.-uPanelCalm);
    float rowTravel=uPanelTime*rowSpeed;
    float tick=floor(uPanelTime*1.8+seed*7.);
    // Body arithmetic is organized in fixed-width fields, with a fixed header.
    vec2 body=vec2((p.x-.085)/.83,(p.y-.16)/.58);
    vec2 cells=vec2(body.x*12.,body.y*5.+rowTravel);
    vec2 cell=fract(cells);
    float row=floor(cells.y), column=floor(cells.x);
    float bodyMask=step(0.,body.x)*step(body.x,1.)*step(0.,body.y)*step(body.y,1.);
    float glyph=0.;
    // Skip atlas fetches for distant, very small glyphs rather than shimmer.
    if(bodyMask>.5 && panelDistance<44. && cell.x>.12 && cell.x<.88 && cell.y>.1 && cell.y<.9){
      float glyphIndex=panelCalculation(column,row,seed,tick);
      glyph=panelGlyph(glyphIndex,(cell-vec2(.12,.1))/vec2(.76,.8));
      glyph*=1.-smoothstep(30.,44.,panelDistance);
      glyph*=mix(.58,1.,panelHash(row*7.+seed));
    }
    float header=0.;
    vec2 head=vec2((p.x-.085)/.65*10.,(p.y-.80)/.075);
    if(head.x>=0. && head.x<10. && head.y>=0. && head.y<1. && panelDistance<49.){
      float col=floor(head.x), index=floor(panelHash(seed+col*3.)*16.);
      if(col<1.)index=21.; else if(col>8.)index=22.; else if(col>4. && col<6.)index=19.;
      vec2 local=vec2(fract(head.x),head.y);
      if(local.x>.14 && local.x<.86) header=panelGlyph(index,vec2((local.x-.14)/.72,local.y));
    }
    float rules=panelBand(p.y,.775,.0017)+panelBand(p.y,.125,.0012);
    rules+=panelBand(p.x,.06,.0012)*.35+panelBand(p.x,.94,.0012)*.35;
    float grid=panelBand(fract(body.y*5.),.02,.008)*bodyMask*.065;
    float progress=.2+.7*panelHash(seed+floor(uPanelTime*.28));
    float stripe=panelBand(p.y,.103,.004)*step(.085,p.x)*step(p.x,.085+progress*.83);
    float status=step(.82,p.x)*step(p.x,.91)*step(.817,p.y)*step(p.y,.856);
    float scanPosition=fract(uPanelTime*.12+seed);
    float scan=exp(-pow((p.y-scanPosition)*17.,2.))*(1.-uPanelCalm)*.12;
    vec2 screen=vPanelProjection.xy/max(vPanelProjection.z,.0001);
    float hotspot=exp(-dot(screen-uPanelPointer.xy,screen-uPanelPointer.xy)*15.)*uPanelPointer.z;
    vec2 screenUv=vec2(screen.x*.5+.5,.5-screen.y*.5);
    float clearText=1.;
    for(int protectedIndex=0;protectedIndex<4;protectedIndex++){
      if(protectedIndex>=uPanelProtectedCount)break;
      vec4 bounds=uPanelProtected[protectedIndex];
      vec2 outside=max(max(bounds.xy-screenUv,screenUv-bounds.zw),vec2(0.));
      clearText=min(clearText,smoothstep(0.,.035,length(outside)));
    }
    float brightness=(.39+uPanelEnergy*.08+hotspot*.24)*(1.-uPanelReading*.35)*(1.-uPanelCalm*.24);
    vec3 ink=vec3(.86,.85,.81)*(glyph*.76+header*.92+rules*.14+grid+scan*(glyph+rules)*.6);
    ink+=vec3(1.,.074,.033)*(status*.42+stripe*.33);
    diffuseColor.rgb*=mix(1.,.32,panelInset*.72*lod);
    totalEmissiveRadiance+=ink*brightness*panelInset*lod*mix(.035,1.,clearText);
  }
}
`;

/** One material patch and one shared glyph atlas. The Passage's existing clock
 * is the sole owner of time; this module never schedules work or uploads frames. */
export function createPanelTelemetry(material: THREE.MeshStandardMaterial, options: { surface?: 'lining' | 'iris' } = {}) {
  const surface = options.surface ?? 'lining', originalCompile = material.onBeforeCompile;
  const originalKey = material.customProgramCacheKey, priorKey = originalKey.call(material);
  const previousData = material.userData.panelTelemetry;
  const uniforms = {
    uPanelAtlas: { value: acquireAtlas() }, uPanelTime: { value: 0 }, uPanelReading: { value: 0 },
    uPanelEnergy: { value: 0 }, uPanelCameraZ: { value: 14 }, uPanelCalm: { value: 0 },
    uPanelQuality: { value: 1 }, uPanelPointer: { value: new THREE.Vector3(0, 0, 0) },
    uPanelProtected: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
    uPanelProtectedCount: { value: 0 },
  };
  let disposed = false;
  const compile: typeof originalCompile = function(shader, renderer) {
    originalCompile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = varyingDeclarations + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec3 panelOrigin=vec3(0.);
      #ifdef USE_INSTANCING
        panelOrigin=instanceMatrix[3].xyz;
      #endif
      vPanelSeed=fract(sin(${surface === 'iris' ? 'panelOrigin.z*17.17' : 'dot(panelOrigin,vec3(2.31,3.77,1.19))'}+19.17)*43758.5453);
      ${surface === 'iris' ? `
        // Normalize authored blade coordinates, then tuck the display inside
        // the taper so the metal perimeter and bevel stay untouched.
        vec2 bladeUv=(position.xy-vec2(2.45,-2.24))/vec2(5.6,3.03);
        float lower=mix(.60,.17,smoothstep(.05,.80,bladeUv.x));
        vPanelUv=vec2((bladeUv.x-.10)/.80,(bladeUv.y-lower)/max(.12,.79-lower));
        vPanelFace=step(.8,normal.z);
      ` : 'vPanelUv=uv; vPanelFace=step(.5,normal.y);'}
      vec4 panelWorld=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        panelWorld=instanceMatrix*panelWorld;
      #endif
      panelWorld=modelMatrix*panelWorld;
      vPanelProjection=vec4(gl_Position.xy,gl_Position.w,panelWorld.z);
    `);
    shader.fragmentShader = fragmentDeclarations + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', emission);
  };
  const cacheKey = () => `${priorKey}|monumental-panel-telemetry-v1:${surface}`;
  material.onBeforeCompile = compile; material.customProgramCacheKey = cacheKey;
  material.userData.panelTelemetry = { surface, uniforms }; material.needsUpdate = true;
  return {
    uniforms,
    setProtection(rects: readonly PanelTelemetryProtection[]) {
      if (disposed) return;
      let count = 0;
      for (let index = 0; index < rects.length && count < 4; index++) {
        const rect = rects[index];
        if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top) || !Number.isFinite(rect.right) || !Number.isFinite(rect.bottom)) continue;
        const left = clamp(rect.left, 0, 1), top = clamp(rect.top, 0, 1), right = clamp(rect.right, 0, 1), bottom = clamp(rect.bottom, 0, 1);
        if (right <= left || bottom <= top) continue;
        uniforms.uPanelProtected.value[count++].set(left, top, right, bottom);
      }
      uniforms.uPanelProtectedCount.value = count;
    },
    update(frame: PanelTelemetryFrame) {
      if (disposed) return;
      const calm = Boolean(frame.calm || frame.enabled === false);
      uniforms.uPanelTime.value = calm ? 0 : clamp(frame.time, 0, 1e6);
      uniforms.uPanelReading.value = typeof frame.reading === 'boolean' ? Number(frame.reading) : clamp(frame.reading, 0, 1);
      uniforms.uPanelEnergy.value = calm ? 0 : clamp(frame.energy, 0, 1);
      uniforms.uPanelCameraZ.value = clamp(frame.cameraZ, -1e5, 1e5, 14);
      uniforms.uPanelCalm.value = Number(calm);
      uniforms.uPanelQuality.value = typeof frame.quality === 'number' ? clamp(frame.quality, 0, 1, 1) : frame.quality === 'light' ? .45 : frame.quality === 'balanced' ? .75 : 1;
      const pointer = frame.pointer, active = !calm && frame.pointerActive && pointer?.every(Number.isFinite);
      uniforms.uPanelPointer.value.set(clamp(pointer?.[0], -1, 1, 0), clamp(pointer?.[1], -1, 1, 0), active ? 1 : 0);
    },
    dispose() {
      if (disposed) return; disposed = true;
      // Later cutaway hooks own their cleanup; do not overwrite a newer patch.
      if (material.onBeforeCompile === compile) material.onBeforeCompile = originalCompile;
      if (material.customProgramCacheKey === cacheKey) material.customProgramCacheKey = originalKey;
      if (material.userData.panelTelemetry?.uniforms === uniforms) {
        if (previousData === undefined) delete material.userData.panelTelemetry;
        else material.userData.panelTelemetry = previousData;
      }
      material.needsUpdate = true; releaseAtlas();
    },
  };
}
