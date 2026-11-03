import{Scene as wn,Color as Ut,PlaneGeometry as Yt,PMREMGenerator as sa,MeshBasicMaterial as Pt,DoubleSide as Qt,Mesh as _e,Vector4 as en,MathUtils as rt,Vector2 as at,ShaderMaterial as St,OneMinusSrcAlphaFactor as En,OneFactor as ra,AddEquation as Cn,SrcAlphaFactor as la,CustomBlending as ca,BackSide as ua,AdditiveBlending as Jt,Group as xe,DataTexture as An,RGBAFormat as $n,RepeatWrapping as da,LinearMipmapLinearFilter as jn,LinearFilter as $t,BufferGeometry as dn,Float32BufferAttribute as _t,InstancedBufferGeometry as pa,InstancedBufferAttribute as Kt,Matrix4 as pn,Vector3 as Ce,Quaternion as On,Object3D as Ft,Shape as jt,ExtrudeGeometry as tn,CylinderGeometry as Nt,BoxGeometry as Bt,InstancedMesh as ut,DynamicDrawUsage as mn,Sphere as ma,NoColorSpace as fa,ClampToEdgeWrapping as ha,MeshStandardMaterial as je,ShapeGeometry as va,TorusGeometry as Ot,SphereGeometry as zn,LatheGeometry as bn,CircleGeometry as ga,TextureLoader as ya,SRGBColorSpace as cn,PointLight as Mn,FrontSide as xa,IcosahedronGeometry as Wn,BufferAttribute as In,Points as wa,WebGLRenderer as ba,ACESFilmicToneMapping as Ma,FogExp2 as Pa,PerspectiveCamera as Sa,HemisphereLight as Aa,DirectionalLight as Ta,VideoTexture as Ea}from"./three-Dcbj-bkz.js";import{c as Ca}from"./frameCadence-0BhF1tE2.js";import{r as za,c as an}from"./visualFrame-DhNAzXA9.js";import{createCinematicRenderer as Ia}from"./cinematicRenderer-BvLQGHje.js";import{s as qn}from"./cinematicLight-DvKSBBTj.js";import{a as La,g as Ln}from"./spatialPreferences-BIZFDSPj.js";import{P as gt,k as Fa,l as Zn,v as fn,w as Ra,s as Da,x as ka,j as Ua,g as Ba,t as _a,f as Na,y as Va}from"./passageChapters-D-Jr36q3.js";import{m as Ga,p as Hn,a as sn,b as Xn,g as $a,s as qt}from"./passageProtection-vN7rajox.js";import{S as Fn,a as ja,d as Oa,P as Rn}from"./passageMedia-CESj5-TF.js";import{Q as Wa,B as qa}from"./audio-CWDIDP_i.js";import{p as Za,v as Ha}from"./index-BqefwRPx.js";import{createCinematicMaterials as Xa}from"./cinematicMaterials-DdgqAEVf.js";const un=e=>Number.isFinite(e)?Math.max(0,Math.min(1,e)):e===1/0?1:0,Ya=e=>{const n=un(e);return n*n*n*(n*(n*6-15)+10)},Lt=(e,n,u)=>Ya((e-n)/(u-n));function Pn(e,n=!0){const u=un(e);return{deployment:u,release:Lt(u,0,.16),spine:Lt(u,.08,.4),hinges:Lt(u,.2,.52),leaves:Lt(u,.36,.68),screen:Lt(u,.58,.82),lock:Lt(u,.74,.94),content:Lt(u,.86,1),visible:n}}function Yn(e,n){const u=Math.max(0,Math.min(5,Number.isFinite(e)?Math.floor(e):0)),g=Math.max(-1,Math.min(5,Number.isFinite(n.active)?Math.floor(n.active):-1)),p=un(n.progress),c=(g<0?Fa(p):Zn(g,p))-gt[u].center[2],o=g===u?un(p/.38)*Lt(c,8,11.2):0;return Pn(o,c>-26&&c<88)}const Ka=e=>Number.isFinite(e)?Math.max(0,Math.min(1,e)):0,nn=e=>{const n=Ka(e);return n*n*(3-2*n)};function Qa(e,n){return!Number.isFinite(e)||!Number.isFinite(n)?1:1-nn((e-n-10)/18)}function Dn(e){return e!==null&&Number.isInteger(e)&&e>=0&&e<6?e:null}function Ja(e,n){const u=Number.isFinite(e)?Math.max(0,e)%16:0;if(n.phase=u,n.open=u>=1.2&&u<12,n.part=null,n.pull=0,u>=2.8&&u<11.2){const g=(u-2.8)/1.4;n.part=Math.min(5,Math.floor(g));const p=g-Math.floor(g);n.pull=nn(p/.35)*(1-nn((p-.65)/.35))}return n}function eo(e,n){if(!Number.isFinite(e))return 0;const u=((e+n*2.71)%19+19)%19;return nn(u/1.4)*(1-nn((u-2.7)/1.9))}function to(e){const n=new wn;n.background=new Ut(526858);const u=new Yt(1,1),g=[];function p(c,o,i){const a=new Pt({color:new Ut().setRGB(...i),side:Qt,toneMapped:!1});g.push(a);const r=new _e(u,a);r.position.set(...c),r.scale.set(o[0],o[1],1),r.lookAt(0,0,0),n.add(r)}p([-7,5,3],[3.2,12],[4.2,4.05,3.8]),p([7,2,1],[.7,14],[3.5,3.8,4]),p([0,9,-2],[11,2.1],[3.6,3.5,3.2]),p([-4,1,-8],[1.2,10],[2.8,2.6,2.3]),p([5,-2,-7],[.55,9],[2.1,.34,.17]),p([0,-7,2],[9,7],[.24,.28,.28]),p([1,1,9],[4,6],[.65,.7,.72]);const f=new sa(e);try{return f.fromScene(n,.008,.1,50)}finally{u.dispose(),g.forEach(c=>c.dispose()),n.clear(),f.dispose()}}const rn=132,Sn=1560,Vt=96,gn=144,kn=8.6,no=`
  const float TAU = 6.28318530718;
  vec2 tubeCentre(float depth) {
    float t = clamp(depth / 132.0, 0.0, 1.0);
    return vec2(5.2 * smoothstep(.10, 1.0, t) + 2.3 * sin(t * 3.5) * t,
      2.0 * sin(t * 2.3) * t + .8 * t * t);
  }
  float tubeRadius(float depth) {
    return mix(17.0, 9.4, smoothstep(0.0, 1.0, clamp(depth / 132.0, 0.0, 1.0)));
  }
  // A pressure wave travels along the hollow surface. Offset across the
  // circumference keeps the inhale from reading as a uniform camera zoom.
  float breathPressure(float depth, float angle) {
    float phase = uBreathPhase - depth * .035 + sin(angle * 2.0 - depth * .018) * .18;
    return .5 - .5 * cos(phase);
  }
  float breathExpansion(float depth, float angle) {
    float envelope = smoothstep(-4.0, 8.0, depth) * (1.0 - smoothstep(90.0, 132.0, depth));
    float pressure = breathPressure(depth, angle);
    // Always outside the existing wall, with an exact 1.2m upper bound.
    // The structural tunnel, camera and near/far seams keep their positions.
    return 1.2 * pressure * pressure * (3.0 - 2.0 * pressure) * envelope;
  }
  // Bend only the current near the pointer ray, never the shared camera.
  vec2 current(vec2 point, float depth) {
    vec2 pointerRay = uPointer * vec2(uAspect, 1.0) * max(depth, 5.0) * uTanHalfFov;
    vec2 delta = point - pointerRay;
    float radius = 3.5 + max(depth, 0.0) * .095;
    float influence = exp(-dot(delta, delta) / (radius * radius)) * uPointerStrength;
    return (vec2(-delta.y, delta.x) * .14 + uPointer * .65) * influence;
  }
  // One physical displacement field for the wall and every streak endpoint.
  // Near folds travel substantially farther than the almost anchored throat;
  // velocity adds a small torsional wake, without another clock or camera.
  vec3 parallaxPoint(vec2 point, float depth) {
    float nearLayer = 1.0 - smoothstep(8.0, 128.0, depth);
    float weight = .03 + .97 * nearLayer * nearLayer;
    vec2 radial = point - tubeCentre(depth);
    float torsion = clamp(uParallaxVelocity.x * .012 - uParallaxVelocity.y * .008,
      -.034906585, .034906585) * weight;
    float turnCos = cos(torsion) - 1.0, turnSin = sin(torsion);
    vec2 turn = vec2(radial.x * turnCos - radial.y * turnSin,
      radial.x * turnSin + radial.y * turnCos);
    vec2 displacement = -uParallax * vec2(3.3, 2.4) * weight;
    vec2 wake = -uParallaxVelocity * .10 * weight;
    // Lean the actual geometry in Z, with zero displacement near the camera
    // and at the far seam. The input clamp bounds this to .7 world units.
    float leanGate = smoothstep(10.0, 24.0, depth) * (1.0 - smoothstep(105.0, 130.0, depth));
    float lean = clamp(dot(uParallax, radial / max(length(radial), .001)), -1.0, 1.0)
      * .7 * weight * leanGate;
    // Delta form preserves the original point exactly at zero input.
    return vec3(point + turn + displacement + wake, -depth + lean);
  }
`,Un=`
  uniform vec4 uViewport;
  uniform vec2 uScreenSize;
  uniform int uProtectedCount;
  uniform vec4 uProtectedRects[5];
  float protection() {
    vec2 screenUv = (gl_FragCoord.xy - uViewport.xy) / max(uViewport.zw, vec2(1.0));
    screenUv.y = 1.0 - screenUv.y;
    vec2 feather = vec2(22.0) / max(uScreenSize, vec2(1.0));
    float protectedArea = 0.0;
    for (int i = 0; i < 5; i++) {
      if (i >= uProtectedCount) break;
      vec4 rect = uProtectedRects[i];
      vec2 enter = smoothstep(rect.xy - feather, rect.xy + feather, screenUv);
      vec2 leave = 1.0 - smoothstep(rect.zw - feather, rect.zw + feather, screenUv);
      protectedArea = max(protectedArea, enter.x * enter.y * leave.x * leave.y);
    }
    return protectedArea;
  }
`;function ao(){const n=new Uint8Array(1048576),u=(o,i,a)=>{let r=Math.imul(o+a*37,374761393)^Math.imul(i+a*17,668265263);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967295},g=(o,i)=>{const a=new Float32Array(o*o);for(let C=0;C<o;C++)for(let E=0;E<o;E++)a[C*o+E]=u(E,C,i);const r=new Uint16Array(512),s=new Uint16Array(512),T=new Float32Array(512);for(let C=0;C<512;C++){const E=C*o/512,D=Math.floor(E),v=E-D;r[C]=D,s[C]=(D+1)%o,T[C]=v*v*v*(v*(v*6-15)+10)}return{cells:o,data:a,indices:r,next:s,weights:T}},p=[g(8,3),g(16,19),g(24,7),g(48,23),g(96,11),g(192,31)],f=(o,i,a)=>{const{cells:r,data:s,indices:T,next:C,weights:E}=a,D=T[o],v=T[i],d=C[o],z=C[i],R=E[o],x=E[i],_=s[v*r+D],P=s[v*r+d],K=s[z*r+D],te=s[z*r+d];return(_+(P-_)*R)*(1-x)+(K+(te-K)*R)*x};for(let o=0;o<512;o++)for(let i=0;i<512;i++){const a=(o*512+i)*4,r=f(i,o,p[0]),s=f(i,o,p[1]),T=f(i,o,p[2]),C=f(i,o,p[3]),E=f(i,o,p[4]),D=f(i,o,p[5]);n[a]=Math.round((r*.79+s*.21)*255),n[a+1]=Math.round((T*.74+C*.26)*255),n[a+2]=Math.round((E*.72+D*.28)*255),n[a+3]=Math.round((C*.66+E*.24+D*.1)*255)}const c=new An(n,512,512,$n);return c.name="Passage wormhole scalar field",c.wrapS=c.wrapT=da,c.minFilter=jn,c.magFilter=$t,c.generateMipmaps=!0,c.needsUpdate=!0,c}function oo(){const e=[],n=[],u=[];for(let p=0;p<=gn;p++){const f=-4+(rn+4)*p/gn;for(let c=0;c<=Vt;c++){const o=c/Vt*Math.PI*2,i=Math.max(0,Math.min(1,f/rn)),a=i*i*(3-2*i),r=Math.max(0,Math.min(1,(i-.1)/.9)),s=5.2*r*r*(3-2*r)+2.3*Math.sin(i*3.5)*i,T=2*Math.sin(i*2.3)*i+.8*i*i,C=17+(9.4-17)*a;if(e.push(s+Math.cos(o)*C,T+Math.sin(o)*C,-f),n.push(c/Vt,f/rn),p<gn&&c<Vt){const E=p*(Vt+1)+c,D=E+Vt+1;u.push(E,D,E+1,E+1,D,D+1)}}}const g=new dn;return g.name="Passage wormhole curved hollow tube 132m",g.setAttribute("position",new _t(e,3)),g.setAttribute("uv",new _t(n,2)),g.setIndex(u),g.computeBoundingSphere(),g}function io(){const e=new pa;e.name="Passage wormhole GPU instanced streaks",e.setAttribute("position",new _t([-1,0,0,1,0,0,-1,1,0,1,1,0],3)),e.setIndex([0,2,1,1,2,3]);const n=new Float32Array(Sn*4);let u=85143;const g=()=>(u=Math.imul(u,1664525)+1013904223>>>0,u/4294967296);for(let p=0;p<Sn;p++)n.set([g(),g(),g(),g()],p*4);return e.setAttribute("aSeed",new Kt(n,4)),e.instanceCount=1180,e}function so(e,n){const u=ao();u.anisotropy=Math.min(4,n.capabilities.getMaxAnisotropy());const g=Array.from({length:5},()=>new en(-2,-2,-1,-1)),p={uCloud:{value:u},uViewport:{value:new en(0,0,1,1)},uScreenSize:{value:new at(1,1)},uFlow:{value:0},uEnergy:{value:0},uBreathPhase:{value:0},uPointer:{value:new at},uPointerStrength:{value:0},uAspect:{value:1},uParallax:{value:new at},uParallaxVelocity:{value:new at},uTanHalfFov:{value:Math.tan(rt.degToRad(59/2))},uCalm:{value:0},uCompact:{value:0},uDetail:{value:1},uProtectedRects:{value:g},uProtectedCount:{value:0}},f=`
    uniform float uFlow, uEnergy, uPointerStrength, uAspect, uTanHalfFov, uBreathPhase;
    uniform vec2 uPointer, uParallax, uParallaxVelocity;
    ${no}
  `,c=oo(),o=new St({name:"Passage wormhole dimensional wall",uniforms:p,side:ua,transparent:!1,depthWrite:!1,depthTest:!0,blending:ca,blendEquation:Cn,blendSrc:la,blendDst:En,blendEquationAlpha:Cn,blendSrcAlpha:ra,blendDstAlpha:En,fog:!1,vertexShader:`
      ${f}
      uniform sampler2D uCloud;
      varying vec2 vTube;
      varying float vBillow, vBreath;
      void main() {
        float angle = uv.x * TAU, depth = uv.y * 132.0;
        float phase = depth * .018 + uFlow * .0024;
        float billow = texture2D(uCloud, vec2(uv.x * 2.0, phase)).r;
        float folds = sin(angle * 5.0 + depth * .086 + billow * 3.5) * .64
          + sin(angle * 9.0 - depth * .119 + billow * 2.0) * .26;
        float radius = tubeRadius(depth) + (billow - .5) * 2.6 + folds + breathExpansion(depth, angle);
        vec2 point = tubeCentre(depth) + vec2(cos(angle), sin(angle)) * radius;
        point += current(point, depth);
        vTube = vec2(angle, depth);
        vBillow = billow;
        vBreath = breathPressure(depth, angle);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(parallaxPoint(point, depth), 1.0);
      }
    `,fragmentShader:`
      uniform sampler2D uCloud;
      uniform float uFlow, uEnergy, uCalm, uCompact, uDetail, uBreathPhase;
      varying vec2 vTube;
      varying float vBillow, vBreath;
      ${Un}
      float hash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      float segment(vec2 p, vec2 a, vec2 b) {
        vec2 edge = b - a;
        return length(p - a - edge * clamp(dot(p - a, edge) / dot(edge, edge), 0.0, 1.0));
      }
      float glyph(vec2 p, float seed, float aa) {
        float stroke = segment(p, vec2(-.17, -.31), vec2(-.17, .31));
        stroke = min(stroke, segment(p, vec2(-.17, .26), vec2(.18, .10)));
        if (seed > .4) stroke = min(stroke, segment(p, vec2(-.17, -.08), vec2(.18, .04)));
        if (seed < .7) stroke = min(stroke, segment(p, vec2(.18, .10), vec2(.18, -.29)));
        if (seed > .7) stroke = min(stroke, segment(p, vec2(-.17, -.29), vec2(.18, -.29)));
        return 1.0 - smoothstep(.015, .015 + aa, stroke);
      }
      void main() {
        float angle = vTube.x, depth = vTube.y;
        float phase = depth * .018 + uFlow * .0024;
        vec2 domain = vec2(angle / 6.28318530718 * 2.0, phase);
        vec4 first = texture2D(uCloud, domain);
        vec2 curledDomain = domain * vec2(2.0, 1.73)
          + vec2(first.r * .26 + first.g * .055, first.g * .17 - first.r * .04);
        vec4 second = texture2D(uCloud, curledDomain);
        vec4 lightSample = texture2D(uCloud, domain + vec2(.009, .006));
        float lightSlope = (first.r - lightSample.r) * .76 + (first.g - lightSample.g) * .24;
        // Broken diagonal cloud arms and dark porous regions. All material
        // coordinates follow physical tube depth, rather than radial screen UV.
        float arm = pow(.5 + .5 * cos(angle * 2.0 - 1.45 - depth * .014 + (first.r - .5) * 2.0), 2.4);
        float density = first.r * .58 + second.g * .27 + first.b * .15;
        float torn = smoothstep(.26, .64, first.g * .55 + second.r * .45);
        float mass = smoothstep(.27, .77, density + arm * .17) * mix(.30, 1.0, torn);
        float folds = pow(clamp(density + arm * .17, 0.0, 1.0), 2.05);
        float crest = pow(smoothstep(.57, .84, density + arm * .12), 2.0)
          * smoothstep(.44, .76, first.g);
        // A derivative along the authored light direction gives each billow a
        // bright face and a shadow. It costs one extra scalar texture sample.
        float shade = clamp(.65 + lightSlope * 5.6, .22, 1.24) * (.68 + .32 * vBillow);
        vec3 copper = mix(vec3(.012, .004, .002), vec3(.35, .12, .047), folds);
        vec3 slate = mix(vec3(.002, .006, .011), vec3(.085, .155, .225), folds);
        vec3 cloud = mix(slate, copper, smoothstep(.15, .70, arm));
        vec3 color = cloud * (.25 + mass * 1.08) * shade * (.89 + second.b * .22);
        color += mix(vec3(.18, .30, .41), vec3(.76, .56, .36), arm) * crest * .24 * shade;
        color += vec3(.66, .64, .55) * pow(crest, 3.0) * .10;
        // Folded wisps follow the same advecting material as the large billows.
        // Derivative-aware edges and distance rolloff avoid sparkling noise at
        // the throat. These are lit creases, not a separate neon overlay.
        float ridgeField = second.g + (first.a - .5) * .22 + (second.a - .5) * .13;
        float ridgeAA = max(fwidth(ridgeField) * 1.2, .0025);
        float crease = 1.0 - smoothstep(.008, .025 + ridgeAA, abs(ridgeField - .52));
        float detailVisibility = (1.0 - smoothstep(62.0, 113.0, depth)) * uDetail;
        float wisp = crease * smoothstep(.40, .70, first.r) * torn * detailVisibility;
        vec3 rim = mix(vec3(.28, .47, .60), vec3(.80, .61, .39), arm);
        color += rim * wisp * (.095 + crest * .09) * shade;
        // Light travels with the expanding folds, rather than pumping the
        // exposure of the scene. Shadows and foreground media stay untouched.
        color *= .94 + vBreath * .14;
        color += rim * crest * vBreath * .045;
        // Broad directional cavities retain clean shadows between bright folds.
        color *= .82 + .18 * smoothstep(.22, .70, second.a);
        // Sparse Matrix-like traces are attached to the physical tube wall.
        vec2 codeDomain = vec2(angle / 6.28318530718 * 92.0, (depth + uFlow * .14) * .87);
        vec2 cell = floor(codeDomain);
        cell.x = mod(cell.x, 92.0);
        float codeSeed = hash(cell + 63.7);
        vec2 codePixel = fwidth(codeDomain);
        float codeAA = max(max(codePixel.x, codePixel.y), .008);
        float code = 0.0;
        if (codeSeed > .979 && depth > 14.0 && depth < 100.0 && uCompact < .5) {
          code = glyph((fract(codeDomain) - .5) * vec2(1.32, 1.0), hash(cell + 17.2), codeAA);
          code *= smoothstep(14.0, 30.0, depth) * (1.0 - smoothstep(72.0, 100.0, depth));
        }
        color += vec3(.25, .30, .27) * code * .16;
        // Thin, broken latitude scans are printed on the curved atmosphere.
        // They advance one spacing per breath and dissolve before the throat;
        // derivative-aware rolloff prevents distant arcs from becoming moire.
        float scanCoordinate = depth * .075 - uBreathPhase / 6.28318530718;
        float scanDerivative = max(fwidth(scanCoordinate), .003);
        float scanDistance = abs(fract(scanCoordinate + .5) - .5);
        float scan = 1.0 - smoothstep(.012, .012 + scanDerivative, scanDistance);
        float scanArc = smoothstep(.08, .45, sin(angle * 3.0 + depth * .024));
        float scanVisibility = smoothstep(6.0, 16.0, depth) * (1.0 - smoothstep(65.0, 96.0, depth))
          * (1.0 - smoothstep(.045, .15, scanDerivative));
        color += mix(vec3(.17, .23, .26), vec3(.43, .14, .055), arm)
          * scan * scanArc * scanVisibility * (.085 + vBreath * .055) * (1.0 - uCompact * .55);
        float ends = smoothstep(-3.0, 8.0, depth) * (1.0 - smoothstep(112.0, 132.0, depth));
        float abyss = 1.0 - smoothstep(77.0, 132.0, depth) * .77;
        float quiet = (1.0 - uCalm * .12) * (1.0 - uCompact * .12);
        float protectionAmount = protection();
        color *= abyss * quiet * (1.0 + uEnergy * .09) * (1.0 - protectionAmount * .50);
        float alpha = (.23 + mass * .62) * ends * (1.0 - protectionAmount * .88);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `}),i=new _e(c,o);i.name="Passage wormhole finite curved tube",i.renderOrder=-40,i.frustumCulled=!1;const a=io(),r=new St({name:"Passage wormhole instanced streaks",uniforms:p,transparent:!0,depthWrite:!1,depthTest:!0,blending:Jt,fog:!1,vertexShader:`
      ${f}
      uniform vec4 uViewport;
      uniform vec2 uScreenSize;
      attribute vec4 aSeed;
      varying vec2 vStreak;
      varying float vFade;
      varying vec3 vTint;
      vec3 streamPoint(float depth, float angle, float spread) {
        float curvedAngle = angle + sin(depth * .016 + angle * 2.0) * .075;
        float radius = tubeRadius(depth) + breathExpansion(depth, curvedAngle);
        vec2 point = tubeCentre(depth) + vec2(cos(curvedAngle), sin(curvedAngle)) * radius * spread;
        return parallaxPoint(point + current(point, depth), depth);
      }
      void main() {
        float speed = .74 + aSeed.w * .57;
        float phase = fract(aSeed.x + uFlow / 132.0 * speed);
        float depth = 129.0 - phase * 130.0;
        float angle = aSeed.y * TAU;
        float spread = .16 + sqrt(aSeed.z) * .78;
        float streakLength = (.16 + pow(aSeed.w, 2.0) * 3.35) * (1.0 + uEnergy * .65);
        vec4 headView = modelViewMatrix * vec4(streamPoint(depth, angle, spread), 1.0);
        vec4 tailView = modelViewMatrix * vec4(streamPoint(depth + streakLength, angle, spread), 1.0);
        float visibleDepth = -headView.z;
        vStreak = position.xy;
        vFade = smoothstep(1.0, 9.0, visibleDepth) * (1.0 - smoothstep(105.0, 129.0, visibleDepth));
        vTint = mix(vec3(.56, .68, .77), vec3(.98, .73, .48), step(.61, aSeed.w));
        // Fade against transformed view depth before perspective division.
        // Invisible recycled tips cannot produce camera-plane clip triangles.
        if (visibleDepth <= 1.0 || visibleDepth >= 129.0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }
        vec4 head = projectionMatrix * headView;
        vec4 tail = projectionMatrix * tailView;
        vec2 delta = (head.xy / max(head.w, .1) - tail.xy / max(tail.w, .1)) * uViewport.zw;
        vec2 direction = normalize(delta + vec2(.00001, 0.0));
        // Preserve a small point-like head at depth; world-space anchors and
        // depth remain unchanged, as with any perspective particle billboard.
        float minimumLength = 2.5 * uViewport.w / max(uScreenSize.y, 1.0);
        if (length(delta) < minimumLength) {
          tail.xy = (head.xy / max(head.w, .1) - direction * minimumLength / max(uViewport.zw, vec2(1.0))) * tail.w;
        }
        vec2 across = vec2(-direction.y, direction.x);
        vec4 point = mix(tail, head, position.y);
        float nearAmount = 1.0 - clamp(depth / 132.0, 0.0, 1.0);
        float width = (.50 + aSeed.w * .45 + nearAmount * nearAmount * .52)
          * uViewport.w / max(uScreenSize.y, 1.0);
        point.xy += across * position.x * width * 2.0 / max(uViewport.zw, vec2(1.0)) * point.w;
        gl_Position = point;
        vFade *= .38 + pow(aSeed.w, 2.0) * .95;
      }
    `,fragmentShader:`
      uniform float uEnergy, uCalm, uCompact;
      varying vec2 vStreak;
      varying float vFade;
      varying vec3 vTint;
      ${Un}
      void main() {
        float width = abs(vStreak.x);
        float core = pow(max(0.0, 1.0 - width), 3.5);
        float halo = pow(max(0.0, 1.0 - width), 1.5) * .06;
        float tail = pow(vStreak.y, .65) * (1.0 - smoothstep(.90, 1.0, vStreak.y));
        float alpha = (core + halo) * tail * vFade * (1.0 - protection() * .98);
        alpha *= (1.0 - uCalm * .18) * (1.0 - uCompact * .15);
        if (alpha < .003) discard;
        gl_FragColor = vec4(vTint * (1.12 + uEnergy * .22), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `}),s=new _e(a,r);s.name="Passage wormhole GPU perspective streaks",s.frustumCulled=!1,s.renderOrder=-39;const T=()=>{n.getCurrentViewport(p.uViewport.value)};i.onBeforeRender=T,s.onBeforeRender=T;const C=new xe;C.name="Passage dimensional wormhole",C.add(i,s),e.add(C);let E=!1,D=!1,v=!1;const d=rt.clamp;return{mesh:C,setCamera(z){v||(C.position.z=z.position.z,p.uAspect.value=z.aspect,p.uTanHalfFov.value=Math.tan(rt.degToRad(z.fov*.5)))},setParallax(z,R,x,_){if(v)return;if(D){p.uParallax.value.set(0,0),p.uParallaxVelocity.value.set(0,0);return}p.uParallax.value.set(Number.isFinite(z)?d(z,-1,1):0,Number.isFinite(R)?d(R,-1,1):0);const P=p.uParallaxVelocity.value;P.set(Number.isFinite(x)?d(x,-3,3):0,Number.isFinite(_)?d(_,-3,3):0),P.lengthSq()>9&&P.setLength(3)},configure(z,R,x,_){v||(E=x,p.uScreenSize.value.set(Math.max(1,z),Math.max(1,R)),p.uCompact.value=Number(E),p.uDetail.value=_==="light"||E?.25:1,a.instanceCount=E?340:_==="light"?620:_==="detail"?Sn:1180,T())},setProtectedRects(z){if(v)return;let R=0;for(let x=0;x<z.length&&R<5;x++){const _=z[x];if(!Number.isFinite(_.left+_.top+_.right+_.bottom))continue;const P=d(_.left,0,1),K=d(_.top,0,1),te=d(_.right,0,1),pe=d(_.bottom,0,1);te<=P||pe<=K||g[R++].set(P,K,te,pe)}p.uProtectedCount.value=R},update(z,R,x,_,P,K,te){if(v)return;D=te;const pe=te;if(pe&&(p.uParallax.value.set(0,0),p.uParallaxVelocity.value.set(0,0)),!pe){p.uFlow.value=Math.max(0,z)*8.4+Math.max(0,R)*1.7;const oe=Number.isFinite(z)?Math.max(0,z):0;p.uBreathPhase.value=oe%kn*(Math.PI*2/kn)}p.uEnergy.value=pe?0:d(x,0,1),p.uPointer.value.set(pe?0:d(_[0],-1,1),pe?0:d(_[1],-1,1)),p.uPointerStrength.value=pe?0:d(P,0,1),p.uCalm.value=d(K,0,1)},stats(){return{draws:2,renderTargets:0,geometries:2,textures:1,tubeVertices:c.getAttribute("position").count,tubeTriangles:(c.index?.count??0)/3,streakInstances:a.instanceCount,length:rn}},dispose(){v||(v=!0,e.remove(C),C.clear(),c.dispose(),a.dispose(),o.dispose(),r.dispose(),u.dispose())}}}const Bn=new Ce,ro=new On,_n=new Ce;class lo extends Ft{constructor(n=document.createElement("div")){super(),this.isCSS3DObject=!0,this.element=n,this.element.style.position="absolute",this.element.style.pointerEvents="auto",this.element.style.userSelect="none",this.element.setAttribute("draggable",!1),this.addEventListener("removed",function(){this.traverse(function(u){u.element instanceof u.element.ownerDocument.defaultView.Element&&u.element.parentNode!==null&&u.element.remove()})})}copy(n,u){return super.copy(n,u),this.element=n.element.cloneNode(!0),this}}const Mt=new pn,co=new pn;class uo{constructor(n={}){const u=this;let g,p,f,c;const o={camera:{style:""},objects:new WeakMap},i=n.element!==void 0?n.element:document.createElement("div");i.style.overflow="hidden",this.domElement=i;const a=document.createElement("div");a.style.transformOrigin="0 0",a.style.pointerEvents="none",i.appendChild(a);const r=document.createElement("div");r.style.transformStyle="preserve-3d",a.appendChild(r),this.getSize=function(){return{width:g,height:p}},this.render=function(v,d){const z=d.projectionMatrix.elements[5]*c;d.view&&d.view.enabled?(a.style.transform=`translate( ${-d.view.offsetX*(g/d.view.width)}px, ${-d.view.offsetY*(p/d.view.height)}px )`,a.style.transform+=`scale( ${d.view.fullWidth/d.view.width}, ${d.view.fullHeight/d.view.height} )`):a.style.transform="",v.matrixWorldAutoUpdate===!0&&v.updateMatrixWorld(),d.parent===null&&d.matrixWorldAutoUpdate===!0&&d.updateMatrixWorld();let R,x;d.isOrthographicCamera&&(R=-(d.right+d.left)/2,x=(d.top+d.bottom)/2);const _=d.view&&d.view.enabled?d.view.height/d.view.fullHeight:1,P=d.isOrthographicCamera?`scale( ${_} )scale(`+z+")translate("+s(R)+"px,"+s(x)+"px)"+T(d.matrixWorldInverse):`scale( ${_} )translateZ(`+z+"px)"+T(d.matrixWorldInverse),te=(d.isPerspectiveCamera?"perspective("+z+"px) ":"")+P+"translate("+f+"px,"+c+"px)";o.camera.style!==te&&(r.style.transform=te,o.camera.style=te),D(v,v,d)},this.setSize=function(v,d){g=v,p=d,f=g/2,c=p/2,i.style.width=v+"px",i.style.height=d+"px",a.style.width=v+"px",a.style.height=d+"px",r.style.width=v+"px",r.style.height=d+"px"};function s(v){return Math.abs(v)<1e-10?0:v}function T(v){const d=v.elements;return"matrix3d("+s(d[0])+","+s(-d[1])+","+s(d[2])+","+s(d[3])+","+s(d[4])+","+s(-d[5])+","+s(d[6])+","+s(d[7])+","+s(d[8])+","+s(-d[9])+","+s(d[10])+","+s(d[11])+","+s(d[12])+","+s(-d[13])+","+s(d[14])+","+s(d[15])+")"}function C(v){const d=v.elements;return"translate(-50%,-50%)"+("matrix3d("+s(d[0])+","+s(d[1])+","+s(d[2])+","+s(d[3])+","+s(-d[4])+","+s(-d[5])+","+s(-d[6])+","+s(-d[7])+","+s(d[8])+","+s(d[9])+","+s(d[10])+","+s(d[11])+","+s(d[12])+","+s(d[13])+","+s(d[14])+","+s(d[15])+")")}function E(v){v.isCSS3DObject&&(v.element.style.display="none");for(let d=0,z=v.children.length;d<z;d++)E(v.children[d])}function D(v,d,z,R){if(v.visible===!1){E(v);return}if(v.isCSS3DObject){const x=v.layers.test(z.layers)===!0,_=v.element;if(_.style.display=x===!0?"":"none",x===!0){v.onBeforeRender(u,d,z);let P;v.isCSS3DSprite?(Mt.copy(z.matrixWorldInverse),Mt.transpose(),v.rotation2D!==0&&Mt.multiply(co.makeRotationZ(v.rotation2D)),v.matrixWorld.decompose(Bn,ro,_n),Mt.setPosition(Bn),Mt.scale(_n),Mt.elements[3]=0,Mt.elements[7]=0,Mt.elements[11]=0,Mt.elements[15]=1,P=C(Mt)):P=C(v.matrixWorld);const K=o.objects.get(v);if(K===void 0||K.style!==P){_.style.transform=P;const te={style:P};o.objects.set(v,te)}_.parentNode!==r&&r.appendChild(_),v.onAfterRender(u,d,z)}}for(let x=0,_=v.children.length;x<_;x++)D(v.children[x],d,z)}}}function po(){const e={x:0,y:0,vx:0,vy:0},n=u=>Number.isFinite(u)?Math.max(-1,Math.min(1,u)):0;return{state:e,step(u,g,p){if(!Number.isFinite(u)||u<=0)return e;const f=Math.min(u,.05),c=12,o=Math.exp(-c*f),i=n(g),a=n(p),r=e.x-i,s=e.y-a,T=e.vx+c*r,C=e.vy+c*s;return e.x=i+(r+T*f)*o,e.y=a+(s+C*f)*o,e.vx=(e.vx-c*T*f)*o,e.vy=(e.vy-c*C*f)*o,e},reset(){e.x=e.y=e.vx=e.vy=0}}}function mo(){const e=new Float64Array(6),n=new Float64Array(6).fill(-1),u=Array.from({length:6},()=>Pn(0));let g=!1;return{poses:u,ages:n,step(p,f,c=!1,o=!1){if(o)return u;const i=Math.max(0,Math.min(.05,Number.isFinite(f)?f:0));for(let a=0;a<6;a++){const r=Yn(a,p),s=e[a],T=p.active===a&&Zn(a,p.progress)<fn(a)+11.5;if(!g||c||p.active!==a||T||r.deployment<s)e[a]=r.deployment;else{const E=(r.deployment-s)*(1-Math.exp(-i*9));e[a]+=Math.max(-i*1.8,Math.min(i/1.35,E)),Math.abs(r.deployment-e[a])<1e-4&&(e[a]=r.deployment)}!g||c||p.active!==a||e[a]<.985?n[a]=-1:n[a]<0&&s<.999&&e[a]>=.999?n[a]=0:n[a]>=0&&(n[a]=Math.min(1.25,n[a]+i)),(e[a]!==s||u[a].visible!==r.visible)&&(u[a]=Pn(e[a],r.visible))}return g=!0,u}}}function fo(e){const n=new jt;n.moveTo(-.43,-.5),n.lineTo(.43,-.5),n.lineTo(.5,-.43),n.lineTo(.5,.43),n.lineTo(.43,.5),n.lineTo(-.43,.5),n.lineTo(-.5,.43),n.lineTo(-.5,-.43),n.closePath();const u=new tn(n,{depth:1,bevelEnabled:!0,bevelThickness:.018,bevelSize:.018,bevelSegments:1,steps:1});u.translate(0,0,-.5);const g={plate:u,box:new Bt(1,1,1),cylinder:new Nt(1,1,1,12),fastener:new Nt(1,1,1,6)},p=[];let f=!1;function c(o,i){const a=new xe;a.name=`chapter-${i}-articulated-chassis`,o.add(a);const r=new xe,s=new Map,T=new Ft,C=new pn,E=new Ce,D=new Ce,v=new Ce,d=new Ce(0,1,0),z=new On,R=new Ce,x=new Ce,_=new Ce,P=(l,M,I,F,k,G=[0,0,0],$)=>{T.position.set(F[0],F[1],F[2]),T.scale.set(k[0],k[1],k[2]),T.rotation.set(G[0],G[1],G[2]),T.updateMatrix();const B={joint:I,local:T.matrix.clone(),label:$},Q=l+"/"+M;return s.has(Q)||s.set(Q,{geometry:g[l],material:e[M],parts:[]}),s.get(Q).parts.push(B),B},K=(l=r)=>{const M=new xe;return l.add(M),M},te=(l,M,I,F,k=.13,G=.38)=>{P("cylinder","graphite",l,[M,I,F],[k*1.28,G,k*1.28],[0,0,Math.PI/2]),P("cylinder","steel",l,[M,I,F],[k,G+.1,k],[0,0,Math.PI/2]);for(const $ of[-1,1])P("fastener","steel",l,[M+$*(G/2+.06),I,F],[k*.55,.055,k*.55],[0,0,Math.PI/2])},pe=(l,M,I,F,k=.06)=>P("fastener","steel",l,[M,I,F],[k,.045,k],[Math.PI/2,0,0]),oe=Array.from({length:4},(l,M)=>{const I=M%2?1:-1,F=M<2?-1:1,k=K(),G=K(k),$=K(k);P("plate","graphite",k,[0,0,-.3],[.68,.72,.4]),P("plate","steel",k,[0,0,-.06],[.62,.64,.13]),P("plate","charcoal",k,[0,0,.025],[.35,.36,.1]);for(const B of[-.22,.22])for(const Q of[-.23,.23])pe(k,B,Q,.08,.055);return P("plate","steel",G,[-I*.13,-F*.1,.13],[.37,.26,.18]),P("box","red",G,[-I*.14,-F*.1,.23],[.18,.018,.018]),te(k,I*.02,F*.03,-.29,.17,.45),P("plate","graphite",$,[-I*.66,0,-.44],[1.38,.24,.23]),P("plate","steel",$,[-I*.66,.13,-.4],[1.12,.032,.12]),{node:k,jaw:G,brace:$,sx:I,sy:F}}),ze=Array.from({length:6},(l,M)=>{const I=M%2?1:-1,F=Math.floor(M/2),k=K();P("plate",F===1?"graphite":"steel",k,[0,0,0],[14.8,F===1?.23:.12,.22]),P("box","charcoal",k,[0,I*.09,.12],[13.8,.035,.1]),F===0&&(P("box","red",k,[-4.9+i*.13,-I*.07,.135],[1.55,.018,.022]),P("box","ivory",k,[5.3,-I*.07,.135],[.68,.014,.02]));for(let G=0;G<8;G++)pe(k,-6.7+G*1.91,0,.15,.043);return{node:k,row:I,tier:F}}),me=Array.from({length:4},(l,M)=>{const I=M%2?1:-1,F=M<2?0:1,k=K();P("plate",F?"graphite":"steel",k,[0,0,0],[.16,9.05,.23]),P("box","charcoal",k,[-I*.1,0,.07],[.045,8.5,.14]);for(let G=0;G<6;G++)P("box","graphite",k,[I*.11,-3.65+G*1.46,-.15],[.28,.12,.5]);return{node:k,sx:I,tier:F}}),we=Array.from({length:6},(l,M)=>{const I=M<3?1:-1,F=M%3-1,k=K(),G=K(k),$=K(k);G.position.y=-I*2.2,$.position.y=-I*2.2;for(const Y of[-2.06,2.06])P("plate","graphite",$,[Y,0,0],[.16,.22,1]);for(const[Y,le]of[[k,!1],[G,!0]]){const he=-I*1.1;P("plate","steel",Y,[0,he,-.015],[4.62,2.04,.16],[0,0,0],`shutter-${M}-${le?"distal":"proximal"}`),P("plate","graphite",Y,[0,he,.09],[4.35,1.88,.11],[0,0,0],`shutter-${M}-${le?"distal":"proximal"}/face`),P("plate","charcoal",Y,[0,he,.153],[3.9,1.4,.025],[0,0,0],`shutter-${M}-${le?"distal":"proximal"}/inlay`),P("plate","graphite",Y,[0,he,-.18],[3.9,.32,.24],[0,0,0],`shutter-${M}-${le?"distal":"proximal"}/back`);for(let j=0;j<4;j++)P("box","steel",Y,[-1.08+j*.72,he,.175],[.035,.88,.024]);for(const j of[-2.02,2.02])for(const J of[-.76,.76])pe(Y,j,he+J,.16,.06);for(const j of[-1.58,1.58])te(Y,j,0,-.02,.12,.52);P("box",le?"red":"ivory",Y,[F*.25,he+I*.7,.17],[le?1.06:.36,.022,.025])}const B=[...s.values()].flatMap(Y=>Y.parts).filter(Y=>Y.joint===k||Y.joint===G).map((Y,le)=>(Y.label??=`shutter-${M}-${Y.joint===G?"distal":"proximal"}/detail-${le}`,{part:Y,authored:Y.local.clone()})),Q=P("cylinder","graphite",r,[0,0,0],[1,1,1]),Z=P("cylinder","steel",r,[0,0,0],[1,1,1]),fe=[-1,1].map(()=>P("cylinder","graphite",r,[0,0,0],[1,1,1]));return{shoulder:k,elbow:G,hingeBridge:$,leafParts:B,column:F,sy:I,cylinder:Q,piston:Z,mounts:fe}}),re=Array.from({length:4},()=>Array.from({length:8},()=>P("cylinder","graphite",r,[0,0,0],[1,1,1]))),ue=[...s.values()].map(l=>{const M=new ut(l.geometry,l.material,l.parts.length);return M.name=`${a.name}-batch`,M.instanceMatrix.setUsage(mn),M.userData.assemblyParts=l.parts.map(I=>I.label??null),M.boundingSphere=new ma(new Ce(0,0,-.7),12.5),a.add(M),p.push(M),{mesh:M,parts:l.parts}}),ie=new Float64Array(8).fill(-10),ge=(l,M,I,F)=>{E.subVectors(I,M);const k=Math.max(.001,E.length());x.copy(M).add(I).multiplyScalar(.5),z.setFromUnitVectors(d,E.multiplyScalar(1/k)),R.set(F,k,F),l.local.compose(x,z,R)},ye=(l,M)=>rt.smoothstep(l,M,.82+M);return{update(l,M){if(f)return;const I=[l.release,l.spine,l.hinges,l.leaves,l.screen,l.lock,M,l.deployment];if(I.every(($,B)=>Math.abs(ie[B]-$)<1e-5))return;I.forEach(($,B)=>{ie[B]=$});const F=Math.min(1,Math.max(0,M)),k=5.75+l.spine*1.92,G=1.65+l.hinges*3.03;oe.forEach(({node:$,jaw:B,brace:Q,sx:Z,sy:fe},Y)=>{$.position.set(Z*(k+F*.13),fe*(G+F*.1),-.3);const le=Math.sin(l.release*Math.PI/2)*(1-l.lock);B.position.set(Z*le*.34,fe*le*.1,le*.22),B.rotation.z=Z*fe*le*.34,Q.rotation.z=Z*fe*(1-l.hinges)*.62;const he=re[Y];for(let j=0;j<he.length;j++){const J=(de,Ie)=>Ie.set(Z*(k-.08-de*1.65),fe*(G-.24-Math.sin(Math.PI*de)*(.4+(1-l.spine)*.75)),-.66-Math.sin(Math.PI*de)*.28);J(j/he.length,D),J((j+1)/he.length,v),ge(he[j],D,v,.035)}}),ze.forEach(({node:$,row:B,tier:Q})=>{$.position.set(0,B*(G+Q*.15+F*Q*.08),-.42-Q*(.34+l.spine*.17+F*.16)),$.scale.x=.76+l.spine*.24,$.rotation.x=B*(1-l.hinges)*(.22+Q*.14)}),me.forEach(({node:$,sx:B,tier:Q})=>{$.position.set(B*(k+Q*.15+F*Q*.08),0,-.42-Q*(.53+F*.25)),$.scale.y=.32+l.hinges*.68,$.rotation.y=B*(1-l.spine)*.36}),we.forEach(({shoulder:$,elbow:B,hingeBridge:Q,leafParts:Z,column:fe,sy:Y},le)=>{const he=ye(l.leaves,(le+i)%3*.055),j=G-.45,J=(k-.5)*2/3;$.position.set(fe*J,Y*j,-.12),$.scale.set(J/4.85,1,1);const de=j/4.4;Z.forEach(({part:De,authored:Ne})=>{De.local.copy(Ne);for(const He of[1,5,9,13])De.local.elements[He]*=de}),$.rotation.set(Y*he*Math.PI/2,0,0);const Ie=.78*rt.smoothstep(he,0,.36);B.position.set(0,-Y*j/2,Ie),B.rotation.x=-Y*he*Math.PI,Q.position.set(0,-Y*j/2,Ie/2),Q.scale.z=.18+Ie}),r.updateMatrixWorld(!0),we.forEach(({shoulder:$,cylinder:B,piston:Q,sy:Z,mounts:fe})=>{D.set($.position.x,Z*(G+.22),-1.1),v.set(0,-Z*.83*(G-.45)/4.4,-.21).applyMatrix4($.matrixWorld),_.copy(D).lerp(v,.55),ge(B,D,_,.11),ge(Q,_,v,.063),fe.forEach((Y,le)=>{const he=$.position.x+(le?1:-1)*1.58*$.scale.x;D.set(he,Z*G,-.42),v.set(he,$.position.y,-.14),ge(Y,D,v,.1)})});for(const $ of ue)$.parts.forEach((B,Q)=>{C.multiplyMatrices(B.joint.matrixWorld,B.local),$.mesh.setMatrixAt(Q,C)}),$.mesh.instanceMatrix.needsUpdate=!0}}}return{create:c,dispose(){f||(f=!0,p.forEach(o=>o.dispose()),Object.values(g).forEach(o=>o.dispose()),p.length=0)}}}const Kn=[-7,...Ra.map((e,n)=>fn(n)+23)],Nn=[-.45,.525],Vn=.035;function Qn(e,n){return Kn.some(u=>e+n>u+Nn[0]-Vn&&e-n<u+Nn[1]+Vn)}const ho=[[14,17,21,21,21,17,14],[12,20,4,0,4,4,14],[30,1,1,14,16,16,15],[30,1,1,14,1,1,30],[17,17,17,15,1,0,1],[15,16,16,14,1,1,30],[14,16,16,30,17,17,14],[31,1,2,4,0,8,8],[14,17,17,14,17,17,14],[14,17,17,15,1,1,14],[14,17,17,31,17,17,17],[30,17,17,30,17,17,30],[14,17,16,16,16,17,14],[30,17,17,17,17,17,30],[31,16,16,30,16,16,31],[31,16,16,30,16,16,16],[0,4,4,31,4,4,0],[0,0,0,31,0,0,0],[0,0,31,0,31,0,0],[0,4,4,0,4,4,0],[1,2,2,4,8,8,16],[14,8,8,8,8,8,14],[14,2,2,2,2,2,14],[0,8,4,2,4,8,0]];function vo(){const u=new Uint8Array(32768);for(let g=0;g<8192;g++)u[g*4+3]=255;return ho.forEach((g,p)=>g.forEach((f,c)=>{for(let o=0;o<5;o++)if(f&1<<4-o)for(let i=0;i<2;i++)for(let a=0;a<2;a++){const r=((Math.floor(p/8)*16+1+(6-c)*2+i)*128+p%8*16+3+o*2+a)*4;u[r]=u[r+1]=u[r+2]=255}})),{width:128,height:64,data:u}}let ct=null,Jn=0;function go(){if(!ct){const e=vo();ct=new An(e.data,e.width,e.height,$n),ct.name="Monumental panel glyphs",ct.colorSpace=fa,ct.magFilter=$t,ct.minFilter=jn,ct.wrapS=ct.wrapT=ha,ct.generateMipmaps=!0,ct.needsUpdate=!0}return Jn++,ct}function yo(){--Jn===0&&(ct?.dispose(),ct=null)}const xt=(e,n,u,g=n)=>Number.isFinite(e)?Math.max(n,Math.min(u,e)):g,ea=`
varying vec2 vPanelUv;
varying vec2 vPanelMetric;
varying float vPanelFace;
varying float vPanelSeed;
varying vec4 vPanelProjection;
`,xo=`${ea}
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
`,wo=`
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
    // Constant physical glyph size, independent of the tapered boundary UV.
    vec2 cells=vPanelMetric/vec2(.20,.28)+vec2(0.,rowTravel);
    vec2 cell=fract(cells);
    float row=floor(cells.y), column=floor(cells.x);
    float bodyMask=step(0.,body.x)*step(body.x,1.)*step(0.,body.y)*step(body.y,1.);
    float glyph=0.;
    // Skip atlas fetches for distant, very small glyphs rather than shimmer.
    if(bodyMask>.5 && panelDistance<44. && cell.x>.15 && cell.x<.85 && cell.y>.15 && cell.y<.85){
      float glyphIndex=panelCalculation(mod(column,12.),row,seed,tick);
      glyph=panelGlyph(glyphIndex,(cell-vec2(.15))/vec2(.70));
      glyph*=1.-smoothstep(30.,44.,panelDistance);
      glyph*=mix(.58,1.,panelHash(row*7.+seed));
    }
    float header=0.;
    vec2 head=vPanelMetric/vec2(.20,.28);
    if(p.x>.085 && p.x<.73 && p.y>.80 && p.y<.875 && panelDistance<49.){
      float col=floor(head.x), index=floor(panelHash(seed+col*3.)*16.);
      if(col<1.)index=21.; else if(col>8.)index=22.; else if(col>4. && col<6.)index=19.;
      vec2 local=fract(head);
      if(local.x>.15 && local.x<.85 && local.y>.15 && local.y<.85) header=panelGlyph(index,(local-vec2(.15))/vec2(.70));
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
    float phase=mod(uPanelTime+seed*11.+row*.17,9.5);
    float charge=smoothstep(0.,.55,phase)*(1.-smoothstep(1.25,2.3,phase))*(1.-uPanelCalm);
    charge*=mix(.55,1.,panelHash(column+seed*31.));
    vec3 glyphInk=mix(vec3(.86,.85,.81),vec3(1.,.23,.045),charge);
    vec3 ink=glyphInk*(glyph*.76+header*.92)*(1.+charge*1.8);
    ink+=vec3(.86,.85,.81)*(rules*.14+grid+scan*(glyph+rules)*.6);
    ink+=vec3(1.,.074,.033)*(status*.42+stripe*.33);
    diffuseColor.rgb*=mix(1.,.32,panelInset*.72*lod);
    totalEmissiveRadiance+=ink*brightness*panelInset*lod*mix(.035,1.,clearText);
  }
}
`;function ta(e,n={}){const u=n.surface??"lining",g=e.onBeforeCompile,p=e.customProgramCacheKey,f=p.call(e),c=e.userData.panelTelemetry,o={uPanelAtlas:{value:go()},uPanelTime:{value:0},uPanelReading:{value:0},uPanelEnergy:{value:0},uPanelCameraZ:{value:14},uPanelCalm:{value:0},uPanelQuality:{value:1},uPanelPointer:{value:new Ce(0,0,0)},uPanelProtected:{value:Array.from({length:4},()=>new en)},uPanelProtectedCount:{value:0}};let i=!1;const a=function(s,T){g.call(e,s,T),Object.assign(s.uniforms,o),s.vertexShader=ea+s.vertexShader,s.vertexShader=s.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
      vec3 panelOrigin=vec3(0.);
      #ifdef USE_INSTANCING
        panelOrigin=instanceMatrix[3].xyz;
      #endif
      vPanelSeed=fract(sin(${u==="iris"?"panelOrigin.z*17.17":"dot(panelOrigin,vec3(2.31,3.77,1.19))"}+19.17)*43758.5453);
      ${u==="iris"?`
        // Normalize authored blade coordinates, then tuck the display inside
        // the taper so the metal perimeter and bevel stay untouched.
        vec2 bladeUv=(position.xy-vec2(2.45,-2.24))/vec2(5.6,3.03);
        float lower=mix(.60,.17,smoothstep(.05,.80,bladeUv.x));
        vPanelUv=vec2((bladeUv.x-.10)/.80,(bladeUv.y-lower)/max(.12,.79-lower));
        vPanelMetric=position.xy-vec2(2.45,-2.24);
        vPanelFace=step(.8,normal.z);
      `:`vPanelUv=uv; vPanelFace=step(.5,normal.y);
        vec2 panelSize=vec2(1.);
        #ifdef USE_INSTANCING
          panelSize=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[2].xyz));
        #endif
        vPanelMetric=uv*panelSize;
      `}
      vec4 panelWorld=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        panelWorld=instanceMatrix*panelWorld;
      #endif
      panelWorld=modelMatrix*panelWorld;
      vPanelProjection=vec4(gl_Position.xy,gl_Position.w,panelWorld.z);
    `),s.fragmentShader=xo+s.fragmentShader,s.fragmentShader=s.fragmentShader.replace("#include <emissivemap_fragment>",wo)},r=()=>`${f}|monumental-panel-telemetry-v2:${u}`;return e.onBeforeCompile=a,e.customProgramCacheKey=r,e.userData.panelTelemetry={surface:u,uniforms:o},e.needsUpdate=!0,{uniforms:o,setProtection(s){if(i)return;let T=0;for(let C=0;C<s.length&&T<4;C++){const E=s[C];if(!Number.isFinite(E.left)||!Number.isFinite(E.top)||!Number.isFinite(E.right)||!Number.isFinite(E.bottom))continue;const D=xt(E.left,0,1),v=xt(E.top,0,1),d=xt(E.right,0,1),z=xt(E.bottom,0,1);d<=D||z<=v||o.uPanelProtected.value[T++].set(D,v,d,z)}o.uPanelProtectedCount.value=T},update(s){if(i)return;const T=!!(s.calm||s.enabled===!1);o.uPanelTime.value=T?0:xt(s.time,0,1e6),o.uPanelReading.value=typeof s.reading=="boolean"?Number(s.reading):xt(s.reading,0,1),o.uPanelEnergy.value=T?0:xt(s.energy,0,1),o.uPanelCameraZ.value=xt(s.cameraZ,-1e5,1e5,14),o.uPanelCalm.value=Number(T),o.uPanelQuality.value=typeof s.quality=="number"?xt(s.quality,0,1,1):s.quality==="light"?.45:s.quality==="balanced"?.75:1;const C=s.pointer,E=!T&&s.pointerActive&&C?.every(Number.isFinite);o.uPanelPointer.value.set(xt(C?.[0],-1,1,0),xt(C?.[1],-1,1,0),E?1:0)},dispose(){i||(i=!0,e.onBeforeCompile===a&&(e.onBeforeCompile=g),e.customProgramCacheKey===r&&(e.customProgramCacheKey=p),e.userData.panelTelemetry?.uniforms===o&&(c===void 0?delete e.userData.panelTelemetry:e.userData.panelTelemetry=c),e.needsUpdate=!0,yo())}}}function bo(e){const n=new xe;n.name="passage-spiral-thresholds",e.add(n);const u=[],g=[],p=[],f=new Ft,c=Kn,o=c.map(()=>Number.NaN),i=ie=>(u.push(ie),ie),a=ie=>(g.push(ie),ie),r=a(new je({color:4344389,metalness:.9,roughness:.31,envMapIntensity:.7}));r.userData.passageShell=!0;const s=ta(r,{surface:"iris"}),T=a(new je({color:1317399,metalness:.74,roughness:.4})),C=a(new je({color:12962760,metalness:1,roughness:.11,envMapIntensity:1.15}));C.userData.passageInternal=!0;const E=a(new Pt({color:16731442,toneMapped:!1})),D=new jt;D.moveTo(2.65,-.32),D.bezierCurveTo(3.18,-1.22,5.1,-2.24,7.55,-2.1),D.bezierCurveTo(7.86,-1.26,8.05,-.24,7.84,.79),D.bezierCurveTo(6.46,.26,4.08,.58,2.65,.42),D.quadraticCurveTo(2.45,.1,2.65,-.32);const v=i(new tn(D,{depth:.22,bevelEnabled:!0,bevelSize:.055,bevelThickness:.055,bevelSegments:2,curveSegments:12,steps:1})),d=new jt;d.moveTo(2.78,-.31),d.bezierCurveTo(3.25,-1.17,5.1,-2.12,7.45,-2.03),d.lineTo(7.46,-1.995),d.bezierCurveTo(5.1,-2.075,3.31,-1.13,2.83,-.285),d.closePath();const z=i(new va(d,20)),R=i(new Ot(8.03,.13,8,72,Math.PI*1.86)),x=i(new Ot(7.72,.07,6,72,Math.PI*1.62)),_=i(new Nt(1,1,1,10));function P(ie,ge,ye,l){const M=new ut(ie,ge,ye);return M.name=l,M.instanceMatrix.setUsage(mn),M.frustumCulled=!1,p.push(M),n.add(M),M}const K=P(v,r,c.length*8,"thick-spiral-iris-leaves"),te=P(z,E,c.length*8,"iris-red-machined-edges"),pe=P(R,T,c.length,"counter-rotating-outer-bearing"),oe=P(x,C,c.length,"counter-rotating-inner-bearing"),ze=P(_,C,c.length*8,"iris-radial-actuators"),me=P(_,T,c.length*8,"iris-fixed-hinge-pins");let we=!1;function re(ie,ge){f.updateMatrix(),ie.setMatrixAt(ge,f.matrix)}function ue(ie,ge,ye,l){if(we||(n.visible=!ye&&!l,!n.visible))return;let M=!1;if(c.forEach((I,F)=>{const k=ie-I,G=k>-5&&k<92,$=G?Qa(ie,I):-1,B=G?1:0;if(f.position.set(0,0,I-.28),f.rotation.set(0,0,F*.31+ge*.045),f.scale.setScalar(B),re(pe,F),f.position.z=I+.38,f.rotation.z=F*.41-ge*.071,re(oe,F),$!==o[F]){o[F]=$,M=!0;for(let Q=0;Q<8;Q++){const Z=Q*Math.PI/4+F*.17,fe=Math.cos(Z),Y=Math.sin(Z),le=Math.max(0,$)*5.45;f.position.set(fe*le,Y*le,I+Q*.035),f.rotation.set(0,0,Z-Math.max(0,$)*.18),f.scale.setScalar(B),re(K,F*8+Q),f.position.z+=.28,re(te,F*8+Q),f.position.set(fe*(6.1+le*.36),Y*(6.1+le*.36),I-.27),f.rotation.set(0,0,Z-Math.PI/2),f.scale.set(.07*B,(2.6+le*.72)*B,.07*B),re(ze,F*8+Q),f.position.set(fe*8.05,Y*8.05,I-.1),f.rotation.set(Math.PI/2,0,0),f.scale.set(.18*B,.7*B,.18*B),re(me,F*8+Q)}}}),pe.instanceMatrix.needsUpdate=oe.instanceMatrix.needsUpdate=!0,M)for(const I of[K,te,ze,me])I.instanceMatrix.needsUpdate=!0}return{update:ue,updateTelemetry:s.update,setTelemetryProtection:s.setProtection,destroy(){we||(we=!0,e.remove(n),s.dispose(),p.forEach(ie=>ie.dispose()),u.forEach(ie=>ie.dispose()),g.forEach(ie=>ie.dispose()),n.clear())}}}function Mo(e){const n=new Set,u=new Set,g=new Set,p=[],f=h=>(n.add(h),h),c=h=>(u.add(h),h),o=c(new je({color:10266528,metalness:.93,roughness:.25})),i=c(new je({color:2107429,metalness:.76,roughness:.35}));i.userData.passageShell=!0;const a=c(new je({color:13748924,metalness:.18,roughness:.47})),r=c(new je({color:7825750,metalness:.74,roughness:.35}));r.userData.passageInternal=!0;const s=c(new Pt({color:16731442,toneMapped:!1})),T=c(new je({color:593420,metalness:.2,roughness:.43})),C=f(new Bt(1,1,1)),E=f(new Nt(1,1,1,32)),D=f(new zn(1,32,20)),v=new Map,d=new Ft,z=(h,L,U,O=[0,0,0],ae=[1,1,1])=>{const ne=new _e(L,U);return ne.position.set(...O),ne.scale.set(...ae),h.add(ne),ne},R=(h,L,U,O=i)=>z(h,C,O,L,U),x=(h,L,U,O=o)=>{const ae=`${L}/${U}`;return v.has(ae)||v.set(ae,f(new Ot(L,U,6,64))),z(h,v.get(ae),O)};function _(h,L,U,O,ae){const ne=new ut(L,U,O);g.add(ne);for(let Pe=0;Pe<O;Pe++)d.position.set(0,0,0),d.rotation.set(0,0,0),d.scale.set(1,1,1),ae(Pe,d),d.updateMatrix(),ne.setMatrixAt(Pe,d.matrix);return ne.instanceMatrix.needsUpdate=!0,ne.computeBoundingSphere(),h.add(ne),ne}function P(h){const L=new Map;for(const U of[...h.children]){if(!(U instanceof _e)||U instanceof ut||Array.isArray(U.material))continue;const O=L.get(U.material)||[];O.push(U),L.set(U.material,O)}for(const[U,O]of L){if(O.length<2)continue;const ae=O.map(Pe=>{Pe.updateMatrix();const We=Pe.geometry.clone().applyMatrix4(Pe.matrix);if(!We.index)return We;const Te=We.toNonIndexed();return We.dispose(),Te}),ne=Ga(ae);ae.forEach(Pe=>Pe.dispose()),ne&&(O.forEach(Pe=>Pe.removeFromParent()),z(h,f(ne),U))}}function K(h,L){const U=new xe;return U.name=L,e[h]?.add(U),p.push(U),U}const te=K(0,"Articulated geographic instrument"),pe=z(te,E,i,[0,-.66,0],[.51,.12,.51]);pe.name="Geographic instrument base",R(te,[0,-.48,-.1],[.12,.3,.13],o);const oe=new xe;oe.rotation.z=.35,te.add(oe);const ze=x(oe,.69,.035);ze.rotation.y=Math.PI/2,z(oe,E,r,[0,.58,0],[.045,.26,.045]),z(oe,E,r,[0,-.58,0],[.045,.26,.045]);const me=new xe;oe.add(me);const we=z(me,D,i,[0,0,0],[.54,.54,.54]);we.name="Globe shell";for(let h=0;h<6;h++)x(me,.548,.006,o).rotation.y=h*Math.PI/6;for(const h of[-.68,-.34,0,.34,.68]){const L=x(me,.55*Math.cos(h),.006,h===0?s:o);L.rotation.x=Math.PI/2,L.position.y=.55*Math.sin(h)}const re=f(new zn(.022,8,6));Za.forEach(h=>{const L=rt.degToRad(h.lat),U=rt.degToRad(h.lon);z(me,re,s,[.562*Math.cos(L)*Math.sin(U),.562*Math.sin(L),.562*Math.cos(L)*Math.cos(U)])}),P(me),P(oe),P(te);const ue=K(1,"Open-work archive timepiece"),ie=[[.6,-.09],[.66,-.09],[.68,-.05],[.68,.09],[.66,.13],[.6,.13],[.6,-.09]].map(([h,L])=>new at(h,L)),ge=f(new bn(ie,64)),ye=z(ue,ge,i);ye.rotation.x=Math.PI/2,x(ue,.68,.035),x(ue,.58,.012,a).position.z=.13,_(ue,C,a,60,(h,L)=>{const U=h/60*Math.PI*2;L.position.set(Math.sin(U)*.55,Math.cos(U)*.55,.14),L.rotation.z=-U,L.scale.set(h%5?.006:.015,h%5?.025:.065,.012)});const l=[];[[-.22,.17,.21],[.23,.1,.19],[.03,-.25,.23]].forEach(([h,L,U])=>{const O=new xe;O.position.set(h,L,.02),ue.add(O),l.push(O),x(O,U*.82,.024,r),x(O,U*.35,.018,o),_(O,C,r,18,(ae,ne)=>{const Pe=ae/18*Math.PI*2;ne.position.set(Math.cos(Pe)*U,Math.sin(Pe)*U,0),ne.rotation.z=Pe,ne.scale.set(.045,.025,.045)}),_(O,C,o,6,(ae,ne)=>{const Pe=ae/6*Math.PI*2;ne.position.set(Math.cos(Pe)*U*.48,Math.sin(Pe)*U*.48,0),ne.rotation.z=Pe,ne.scale.set(U*.7,.015,.018)}),P(O)});const M=new xe;M.position.z=.18,ue.add(M),R(M,[0,.19,0],[.014,.4,.013],s),z(M,D,o,[0,0,0],[.045,.045,.025]),P(M),R(ue,[-.08,.11,.16],[.025,.29,.016],a).rotation.z=-.6;const I=z(ue,E,o,[.76,0,.02],[.08,.16,.08]);I.rotation.z=Math.PI/2,P(ue);const F=K(2,"Mechanical cinema projector"),k=new jt;k.moveTo(-.45,-.33),k.lineTo(.4,-.33),k.lineTo(.45,.13),k.lineTo(.27,.3),k.lineTo(-.35,.3),k.lineTo(-.45,.17),k.closePath();const G=f(new tn(k,{depth:.28,bevelEnabled:!0,bevelSegments:2,bevelSize:.035,bevelThickness:.025}));z(F,G,i,[0,-.12,-.14]);const $=[];for(const h of[-.42,.36]){const L=new xe;L.position.set(h,.47,.02),F.add(L),$.push(L),x(L,.29,.025),x(L,.12,.019,r),z(L,D,r,[0,0,.02],[.05,.05,.035]),_(L,C,o,5,(U,O)=>{const ae=U/5*Math.PI*2;O.position.set(Math.cos(ae)*.18,Math.sin(ae)*.18,0),O.rotation.z=ae,O.scale.set(.21,.028,.028)}),P(L)}R(F,[0,-.56,.02],[.92,.1,.51],o);for(const h of[-.32,.3])R(F,[h,-.46,0],[.08,.2,.1],o);const B=new xe;B.position.set(.49,-.06,.08),B.rotation.y=Math.PI/2,F.add(B);for(let h=0;h<4;h++){const L=x(B,.18-h*.014,.027,h===2?a:o);L.position.z=h*.07}z(B,f(new ga(.13,32)),T,[0,0,.23]),x(B,.09,.006,s).position.z=.235,P(B),_(F,C,r,9,(h,L)=>{L.position.set(-.3+h*.075,-.12,.158),L.scale.set(.026,.23,.018)}),P(F);const Q=K(3,"Audio-responsive precision turntable");Q.rotation.x=.55,R(Q,[0,-.08,0],[1.4,.15,1.03],i),R(Q,[0,.002,0],[1.34,.02,.97],o);const Z=new xe;Z.position.set(-.12,.06,0),Q.add(Z),z(Z,E,T,[0,0,0],[.46,.045,.46]);for(let h=0;h<5;h++)x(Z,.24+h*.047,.003,o).rotation.x=Math.PI/2;const fe=z(Z,E,s,[0,.025,0],[.12,.006,.12]);fe.name="Original score label",z(Z,E,o,[0,.045,0],[.018,.055,.018]),R(Z,[.07,.03,0],[.035,.004,.013],a),P(Z);const Y=new xe;Y.position.set(.48,.1,-.28),Q.add(Y),z(Y,E,o,[0,0,0],[.07,.1,.07]),R(Y,[-.12,.065,.22],[.025,.025,.5],o).rotation.y=-.46,R(Y,[-.25,.052,.43],[.07,.06,.13],T),P(Y);const le=[];for(let h=0;h<7;h++){const L=new xe;L.position.set(-.63+h*.21,-.18,.51),Q.add(L),le.push(L),R(L,[0,0,0],[.15,.025,.15],o),R(L,[0,-.028,0],[.065,.035,.065],r),R(L,[0,.015,.04],[.09,.004,.01],s),P(L)}P(Q);const he=K(4,"Stoneware and paper material study"),j=c(new je({color:13024422,metalness:.04,roughness:.88}));j.userData.passageShell=!0;const J=[[0,-.48],[.24,-.48],[.31,-.38],[.33,-.12],[.27,.15],[.2,.31],[.22,.42],[.19,.42],[.17,.31],[.24,.14],[.3,-.12],[.28,-.36],[.2,-.43],[0,-.43]].map(([h,L])=>new at(h,L)),de=f(new bn(J,48)),Ie=de.getAttribute("position");for(let h=0;h<Ie.count;h++){const L=Ie.getX(h),U=Ie.getY(h),O=Ie.getZ(h),ae=1+Math.sin(U*90)*.006+Math.sin(Math.atan2(O,L)*5+U*11)*.003;Ie.setXYZ(h,L*ae,U,O*ae)}de.computeVertexNormals(),z(he,de,j,[-.16,.06,0]);const De=x(he,.205,.014,r);De.rotation.x=Math.PI/2,De.position.set(-.16,.48,0),z(he,E,T,[-.16,-.45,0],[.36,.035,.36]);const Ne=new xe;Ne.position.set(.43,-.28,.08),Ne.rotation.set(-.18,-.28,-.14),he.add(Ne);for(let h=0;h<8;h++)R(Ne,[h*.005,h*.013,0],[.37,.008,.61],h%3===0?a:j);R(Ne,[0,.115,0],[.38,.025,.63],i),R(Ne,[-.12,.13,0],[.009,.004,.49],s),P(Ne),P(he);let He=!1,ot=0,Oe=0,it=0;const ke={globe:0,gears:0,reel:0,platter:0};return{roots:p,update(h){if(He)return;const L=Math.max(0,Math.min(.05,h.delta??1/60)),U=!h.reducedMotion&&!h.inspecting;if(U&&(ke.globe+=L*.07,ke.gears+=L*.18,ke.reel+=L*.4,ke.platter+=L*.34),h.active===0&&(me.rotation.y=ke.globe,oe.rotation.z=.35+(U?Math.sin(h.elapsed*.13)*.035:0)),h.active===1&&(l.forEach((O,ae)=>{O.rotation.z=ke.gears*(ae%2?-1.12:1)}),M.rotation.z=-ke.gears*.12),h.active===2&&$.forEach((O,ae)=>{O.rotation.z=ke.reel*(ae?.85:1)}),h.active===3){Z.rotation.y=ke.platter;const O=U?h.audio??Fn:Fn,ae=1-Math.exp(-L*15);ot+=(O.bass-ot)*ae,Oe+=(O.mid-Oe)*ae,it+=(O.treble-it)*ae,le.forEach((ne,Pe)=>{const We=Pe<2?ot:Pe<5?Oe:it;ne.position.y=-.18+We*.16,ne.rotation.x=We*.45}),Y.rotation.y=-.1+Oe*.07,Q.userData.audioEnergy=O.rms,Q.userData.audioSource="measured-local-study"}},destroy(){He||(He=!0,p.forEach(h=>h.removeFromParent()),g.forEach(h=>h.dispose()),n.forEach(h=>h.dispose()),u.forEach(h=>h.dispose()),n.clear(),u.clear(),g.clear(),v.clear())}}}const na=Array.from({length:6},(e,n)=>fn(n));function kt(e){let n=1/0;for(const g of na)n=Math.min(n,Math.abs(e-g));const u=Math.max(0,Math.min(1,(n-10)/12));return 4.4*(1-u*u*u*(u*(u*6-15)+10))}const Po=`
float passageBayExpansion(float z) {
  float distance = ${na.map(e=>`abs(z - (${e.toFixed(1)}))`).reduce((e,n)=>`min(${e}, ${n})`)};
  float t = clamp((distance - 10.0) / 12.0, 0.0, 1.0);
  return 4.4 * (1.0 - t*t*t*(t*(t*6.0-15.0)+10.0));
}`,$e={rows:90,lanes:12,pitch:3.65,start:18,wallOffset:1.35,wallWidth:.8,wallThickness:.66,wallDepth:1.6};function So(e,n){return e>=0&&e<$e.rows&&n>=0&&n<$e.lanes&&Number.isInteger(e)&&Number.isInteger(n)&&n%3===e%3&&!Qn($e.start-e*$e.pitch-$e.wallOffset,$e.wallDepth/2)}function Ao(e){return e>=0&&e<$e.rows&&Number.isInteger(e)&&e%2===0&&!Qn($e.start-e*$e.pitch,e%4===0?.2:.1)}function To(e,n){const u=$e.start-e*$e.pitch-$e.wallOffset,g=n*Math.PI/6+e*.058,p=8.8+Math.sin(e*.46)*.34+kt(u),f=2*p*Math.sin(Math.PI/12)*.95;return{row:e,lane:n,z:u,angle:g,radius:p,span:f}}const yn=Array.from({length:$e.rows},(e,n)=>Array.from({length:$e.lanes},(u,g)=>g).filter(u=>So(n,u)).map(u=>To(n,u))).flat();function Eo(e,n){const u=new Set,g=new Set,p=new Set,f=new Set,c=new Map,o=Xa(),i=new ya,a=new Ft,r=new Ce,s=new Ce,T=new Ce,C=new Ce,E=new Ce(0,1,0),D=new Ce,v=gt.map(()=>null),d=[...v],z=gt.map(()=>0),R=new An(new Uint8Array([0,0,0,255]),1,1);R.colorSpace=cn,R.needsUpdate=!0,p.add(R);const x=[],_=[],P=[null,null,null];let K=!1,te="",pe=0,oe=0,ze=0,me=0;function we(t,w){if(!c.has(t)){const b=w();c.set(t,b),u.add(b)}return c.get(t)}function re(t){return g.add(t),t}const ue=re(new je({color:12107709,metalness:1,roughness:.13,envMapIntensity:1.1})),ie=re(new je({color:1514777,metalness:.8,roughness:.42,envMapIntensity:.24})),ge=re(new je({color:1053971,metalness:.34,roughness:.79,envMapIntensity:.2}));ge.userData.passageShell=!0;const ye=re(new je({color:1514265,metalness:.78,roughness:.38})),l=re(new je({color:856336,metalness:.55,roughness:.48}));o.apply(ue,"metal",.28),o.apply(ie,"metal",1.15),o.apply(ge,"paint",1.15),o.apply(ye,"paint",.9),o.apply(l,"paint",.7);const M=ta(ge),I=re(new Pt({color:16731442,toneMapped:!1})),F=re(new Pt({color:14013126,toneMapped:!1})),k=re(new Pt({color:6497565,toneMapped:!1})),G=we("box",()=>new Bt(1,1,1)),$=we("cylinder",()=>new Nt(1,1,1,10)),B=new xe;B.name="passage-continuous-tunnel",e.add(B);const Q=bo(e),Z={time:0,reading:0,pointer:[0,0],pointerActive:!1,energy:0,cameraZ:14,calm:!1,quality:"balanced"};function fe(t,w,b,A,N,V,se,Le=ue){const be=new _e(G,Le);return be.position.set(w,b,A),be.scale.set(N,V,se),t.add(be),be}function Y(t,w,b,A,N=Math.PI*2){const V=we(`ring-${w}-${b}-${N}`,()=>new Ot(w,b,6,64,N)),se=new _e(V,A);return t.add(se),se}function le(t,w,b,A){const N=new ut(G,w,b);f.add(N);for(let V=0;V<b;V++)a.position.set(0,0,0),a.rotation.set(0,0,0),a.scale.set(1,1,1),A(V,a),a.updateMatrix(),N.setMatrixAt(V,a.matrix);return N.instanceMatrix.needsUpdate=!0,N.computeBoundingSphere(),t.add(N),N}const he=$e.rows,j=$e.lanes,J=Array.from({length:he*j},(t,w)=>w).filter(t=>Ao(Math.floor(t/j)));function de(t,w,b){const A=Math.floor(t/j),N=t%j,V=N*Math.PI/6+A*.058,se=$e.start-A*$e.pitch,Le=8.8+Math.sin(A*.46)*.34+kt(se),be=2*Le*Math.sin(Math.PI/12)*.95,ve=Le+(b===1?-.13:0);w.position.set(Math.cos(V)*ve,Math.sin(V)*ve,se),w.rotation.z=V+Math.PI/2,b===0&&w.scale.set(be,.12,A%4===0?.4:.2),b===1&&w.scale.set(be*(N%3===0?.78:.24),.026,.035)}const Ie=le(B,ie,J.length,(t,w)=>de(J[t],w,0));Ie.name="passage-structural-ribs";const De=le(B,I,J.length,(t,w)=>de(J[t],w,1)),Ne=new Ut(14013126),He=new Ut(16731442);for(let t=0;t<De.count;t++)De.setColorAt(t,He);const ot=re(new Pt({color:16777215,toneMapped:!1}));De.material=ot;const Oe=le(B,ge,yn.length,(t,w)=>{const b=yn[t],A=b.radius+.17;w.position.set(Math.cos(b.angle)*A,Math.sin(b.angle)*A,b.z),w.rotation.z=b.angle+Math.PI/2,w.scale.set(b.span*$e.wallWidth,$e.wallThickness,$e.wallDepth)});Oe.name="passage-led-lining";const it=new Ut;for(let t=0;t<Ie.count;t++){const w=.48+(t*17+Math.floor(t/j)*5)%13/24;it.setRGB(w*.94,w,w*.97),Ie.setColorAt(t,it)}for(let t=0;t<Oe.count;t++){const w=yn[t],b=w.row*j+w.lane,A=.48+(b*17+w.row*5)%13/24;it.setRGB(A*.94,A,A*.97).multiplyScalar(b%7===0?.77:.56),Oe.setColorAt(t,it)}const ke={uTime:{value:0},uEnergy:{value:0},uRead:{value:0},uBreath:{value:1},uPointer:{value:new at},uCameraZ:{value:14}},h=re(new St({uniforms:ke,transparent:!0,depthWrite:!1,depthTest:!0,blending:Jt,side:Qt,vertexShader:"varying vec2 vUv;varying vec3 vTint;varying float vDepth;void main(){vUv=uv;vTint=instanceColor;vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);vDepth=world.z;gl_Position=projectionMatrix*viewMatrix*world;}",fragmentShader:"varying vec2 vUv;varying vec3 vTint;varying float vDepth;uniform float uEnergy;uniform float uCameraZ;uniform float uRead;uniform float uBreath;void main(){vec2 p=vUv*2.-1.;float glow=exp(-p.y*p.y*5.5)*pow(max(0.,1.-abs(p.x)),.5);float edge=1.-smoothstep(.7,1.,abs(p.y));float charge=(.90+.10*sin(vDepth*.12))*uBreath;float depth=max(0.,uCameraZ-vDepth);float atmosphere=exp(-depth*depth*.00065);gl_FragColor=vec4(vTint,glow*edge*(.085+uEnergy*.035)*charge*atmosphere*(1.-uRead*.48));}"}));h.forceSinglePass=!0;const L=we("signal-halo",()=>new Yt(1,1)),U=new ut(L,h,J.length);f.add(U);for(let t=0;t<U.count;t++)de(J[t],a,1),a.position.z+=.2,a.scale.y=.28,a.scale.z=1,a.scale.x*=1.12,a.updateMatrix(),U.setMatrixAt(t,a.matrix),U.setColorAt(t,t%5===0?Ne:He);U.instanceMatrix.needsUpdate=!0,U.computeBoundingSphere(),B.add(U);const O={uTime:{value:0},uEnergy:{value:0},uStation:{value:-36},uRead:{value:0},uCameraZ:{value:14}},ae=re(new St({uniforms:O,transparent:!0,blending:Jt,depthWrite:!1,side:Qt,vertexShader:"varying vec2 vUv;varying float vDepth;void main(){vUv=uv;vDepth=position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"varying vec2 vUv;varying float vDepth;uniform float uTime;uniform float uEnergy;uniform float uStation;uniform float uRead;uniform float uCameraZ;void main(){float pulse=pow(.5+.5*sin(vUv.y*68.-uTime*1.12),18.);float edge=pow(1.-abs(vUv.x*2.-1.),.6);float calm=1.-(1.-smoothstep(4.,20.,abs(vDepth-uStation)))*uRead*.82;float depth=max(0.,uCameraZ-vDepth);float atmosphere=exp(-depth*depth*.00065);vec3 c=mix(vec3(1.,.302,.196),vec3(.92,.90,.84),pulse*.6);gl_FragColor=vec4(c*(.60+pulse*.5+uEnergy*.12),edge*.28*calm*atmosphere);}"}));ae.forceSinglePass=!0;for(let t=0;t<7;t++){const w=[],b=[],A=[];for(let se=0;se<=560;se++){const Le=22-se*.6,be=t*Math.PI*2/7+Le*.043+Math.sin(Le*.069+t)*.13,ve=7.1+Math.sin(Le*.053+t*2)*.55+kt(Le),Fe=t%3===0?.018:.008;for(const Re of[-1,1]){const mt=be+Re*Fe;w.push(Math.cos(mt)*ve,Math.sin(mt)*ve,Le),b.push((Re+1)/2,se/560)}if(se<560){const Re=se*2;A.push(Re,Re+1,Re+2,Re+1,Re+3,Re+2)}}const V=new dn;u.add(V),V.setAttribute("position",new _t(w,3)),V.setAttribute("uv",new _t(b,2)),V.setIndex(A),B.add(new _e(V,ae))}const ne=re(new St({transparent:!0,depthWrite:!1,blending:Jt,side:Qt,vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"varying vec2 vUv;void main(){float a=pow(1.-abs(vUv.x*2.-1.),2.)*pow(1.-vUv.y,2.);gl_FragColor=vec4(.85,.19,.09,a*.075);}"}));ne.forceSinglePass=!0;const Pe=[];for(let t=0;t<16;t++){const w=new xe;w.position.z=-10-t*20.5,w.rotation.set(Math.sin(t*3)*.1,Math.cos(t*2)*.1,t*.7);const b=kt(w.position.z);w.scale.set(1+b/7.5,1+b/7.5,1),B.add(w),Pe.push(w);for(let A=0;A<2;A++){const N=(A?7.39:7.5)+t%3*.15,V=A?.016:.1,se=Math.PI*(A?.34:.42),Le=we(`ring-${N}-${V}-${se}`,()=>new Ot(N,V,6,64,se)),be=new ut(Le,A?De.material:ye,4);f.add(be);for(let ve=0;ve<4;ve++)a.position.set(0,0,0),a.scale.set(1,1,1),a.rotation.set(0,0,ve*Math.PI/2+(A?.06:0)),a.updateMatrix(),be.setMatrixAt(ve,a.matrix),A&&be.setColorAt(ve,ve%3?He:Ne);be.instanceMatrix.needsUpdate=!0,be.computeBoundingSphere(),w.add(be)}}let We=14831;const Te=()=>(We=Math.imul(We,1664525)+1013904223>>>0,We/4294967296);le(B,ye,180,(t,w)=>{const b=Te()*Math.PI*2,A=7.5+Te()*1.5,N=10-Te()*310,V=A+kt(N);w.position.set(Math.cos(b)*V,Math.sin(b)*V,N),w.rotation.set(Te()*2,Te()*3,Te()*3),w.scale.set(.12+Te()*.6,.06+Te()*.1,.2+Te())});const Je=new ut(L,h,gt.length);f.add(Je),Je.instanceMatrix.setUsage(mn),Je.frustumCulled=!1,B.add(Je);for(let t=0;t<Je.count;t++)Je.setColorAt(t,t%2?Ne:He),a.position.set(0,0,-999),a.rotation.set(0,0,0),a.scale.setScalar(0),a.updateMatrix(),Je.setMatrixAt(t,a.matrix);const Ve=new Mn(16731442,3,8,2);e.add(Ve);const st=new xe;st.name="passage-entrance",st.position.z=-7,B.add(st);for(let t=0;t<3;t++){const w=new xe;w.position.z=-t*.7,st.add(w),Y(w,7.65+t*.21,t===1?.29:.15,t===1?ue:ye);const b=Y(w,7.51+t*.21,.024,t===0?F:I,Math.PI*1.6);b.rotation.z=t*.9}le(st,ue,12,(t,w)=>{const b=t*Math.PI/6;w.position.set(Math.cos(b)*8.05,Math.sin(b)*8.05,-.7),w.rotation.z=b,w.scale.set(.65,.3,2)});function Xe(t,w,b){const A=re(new Pt({color:16777215,map:R,toneMapped:!1,fog:!1,side:xa})),N=new _e(we(`image-${w}-${b}`,()=>new Yt(w,b)),A);return t.add(N),N}function At(t,w){const b=w?.image,A=b?.videoWidth||b?.naturalWidth||b?.width||0,N=b?.videoHeight||b?.naturalHeight||b?.height||0;if(!A||!N){t.scale.set(1,1,1);return}const V=A/N,se=t.geometry.parameters.width/t.geometry.parameters.height;t.scale.set(Math.min(1,V/se),Math.min(1,se/V),1)}function Tt(t,w){const b=new xe;t.add(b);const A=new _e($,ye);A.scale.set(w,.25,w),A.rotation.x=Math.PI/2,b.add(A);const N=Y(b,w*.91,.025,F);return N.position.z=.15,Y(b,w*.5,.018,I).position.z=.16,b}function S(t){const w=new _e($,ue),b=new _e($,ye),A=new _e($,k);return t.add(w,b,A),{body:w,piston:b,signal:A}}function q(t,w,b,A){C.subVectors(b,w),t.position.copy(w).add(b).multiplyScalar(.5),t.scale.set(A,Math.max(.001,C.length()),A),t.quaternion.setFromUnitVectors(E,C.normalize())}function Se(t,w,b){T.copy(w).lerp(b,.64),q(t.body,w,T,.17),q(t.piston,T,b,.105),q(t.signal,w,b,.018)}const Ee=re(new je({color:14014935,metalness:1,roughness:.095,envMapIntensity:1.2}));o.apply(Ee,"metal",.2);const qe=fo({steel:Ee,graphite:ye,charcoal:l,red:I,ivory:F}),ce=gt.map((t,w)=>{const b=new xe;b.name=`passage-architecture-${t.id}`,e.add(b);const A=qe.create(b,w),N=new xe;N.name=`${t.id}-editorial-carrier`,N.position.fromArray(t.panel.position),b.add(N);const V=re(l.clone()),se=fe(N,0,0,-.14,5.94,7.6,.18,V),Le=[-1,1].map(Be=>fe(N,Be*2.99,0,-.14,.045,7.6,.2,V)),be=new xe;be.name=`${t.id}-cultural-window`,be.position.fromArray(t.media.position),be.rotation.y=t.media.yaw,b.add(be);const ve=t.media.width,Fe=ve*9/16,Re=new xe;Re.name=`${t.id}-recessed-screen-housing`,Re.position.fromArray(t.media.position),Re.rotation.y=t.media.yaw,b.add(Re),fe(Re,0,0,-1.43,ve+.42,Fe+.42,.16,l);const mt=[];for(const Be of[-1,1])fe(Re,Be*(ve/2+.24),0,-.77,.16,Fe+.35,1.48,ye),mt.push(fe(Re,Be*(ve/2+.16),0,-.64,.032,Fe*.78,1.25,ue)),fe(Re,Be*(ve/2+.33),0,-.72,.014,Fe*.58,.016,I);fe(be,0,0,-.1,ve+.1,Fe+.1,.16,l);for(const Be of[-1,1])fe(be,0,Be*(Fe/2+.06),-.01,ve+.21,.075,.23,ue),fe(be,Be*(ve/2+.06),0,-.01,.075,Fe+.1,.23,ye);fe(be,-ve/2+.66,-Fe/2-.125,.02,1.25,.025,.025,I);const H=Xe(be,ve,Fe);H.position.z=.015;const Ye=re(new St({transparent:!0,depthWrite:!1,toneMapped:!1,uniforms:{uPhase:{value:0},uSize:{value:new at(ve+.22,Fe+.22)}},vertexShader:"varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",fragmentShader:`varying vec2 vUv; uniform float uPhase; uniform vec2 uSize;
        void main(){
          vec2 d=min(vUv,1.0-vUv)*uSize;
          float edge=1.0-smoothstep(.014,.036,min(d.x,d.y));
          float angle=atan((vUv.y-.5)*uSize.y,(vUv.x-.5)*uSize.x)/6.2831853+.5;
          float tail=fract(angle-uPhase*1.15+1.0);
          float trace=(1.0-smoothstep(.015,.24,tail))*pow(sin(clamp(uPhase,0.0,1.0)*3.1415926),2.0);
          gl_FragColor=vec4(mix(vec3(1.0,.24,.10),vec3(1.0,.86,.68),trace),edge*trace*.58);
          #include <colorspace_fragment>
        }`})),nt=new _e(we(`finish-${ve}`,()=>new Yt(ve+.22,Fe+.22)),Ye);nt.name=`${t.id}-lock-registration`,nt.position.z=.15,nt.visible=!1,be.add(nt);const Ue=new _e(we("spill-plane",()=>new Yt(5,3)),ne);Ue.position.set(t.media.position[0],-3.8,-.9),Ue.rotation.x=-Math.PI*.32,b.add(Ue);const ft=new xe;ft.name=`${t.id}-inspection`,ft.position.fromArray(t.exhibit),b.add(ft);const ht=new xe;ft.add(ht);const tt=new xe;tt.position.fromArray(t.center),e.add(tt);const m=w%2?1:-1;fe(tt,m*8.25,-2.7,-.4,.72,1.25,1,ye);const y=[S(tt),S(tt)],X=[Tt(tt,.25),Tt(tt,.23),Tt(tt,.19)],W=new xe;b.add(W),W.position.set(m*7.15,-3.25,.18),Y(W,.56,.045,ue,Math.PI*1.82),Y(W,.39,.017,I,Math.PI*1.7).rotation.y=.6;const Me=new _e(we("hub-core",()=>new Wn(.18,1)),F);return W.add(Me),{root:b,media:H,screen:be,screenSlides:mt,housing:Re,editorial:N,editorialBody:se,editorialEdges:Le,editorialFinish:V,exhibit:ft,movement:ht,mechanics:A,finish:nt,mediaReady:0,armRoot:tt,arms:y,motors:X,hub:W,target:new Ce,inspection:0,turn:0}});ce.forEach((t,w)=>{const b=t.movement;if(w===5){for(let A=0;A<4;A++)Y(b,.45+A*.07,.033,A===1?I:ue,Math.PI*1.6).rotation.set(A*.58,A*.4,A*.65);for(let A=0;A<3;A++){const N=new xe;N.position.set(1.25+A*1.6,-3.1,.7),N.visible=!1,t.root.add(N),x.push(N),fe(N,0,0,-.055,1.42,.85,.09,ye);const V=Xe(N,1.34,.754);V.position.z=.005,_.push(V)}}});const Ge=Mo(ce.map(t=>t.movement));function ee(t,w,b){const A=ce[t];!A||w<=0||b<=0||(A.editorialBody.scale.set(w+.34,b+.26,.18),A.editorialEdges.forEach((N,V)=>{N.position.x=(V?1:-1)*(w/2+.19),N.scale.y=b+.26}))}function Ae(t){t.colorSpace=cn,t.minFilter=$t,t.magFilter=$t,t.generateMipmaps=!1,p.add(t)}function Ze(t,w){if(K||!ce[t]||!w)return;const b=++z[t];i.load(w,A=>{if(K||b!==z[t]){A.dispose();return}Ae(A);const N=v[t];if(v[t]=A,!d[t]){const V=ce[t].media;V.material.map=A,V.material.color.set(16777215),V.material.needsUpdate=!0,At(V,A)}N&&(p.delete(N),N.dispose()),n()},void 0,()=>{K||n()})}function wt(t,w){if(K||!ce[t])return;d[t]=w;const b=ce[t].media,A=w||v[t]||R;if(At(b,A),b.material.map===A)return;const N=!!b.material.map?.isVideoTexture;b.material.map=A,N!==!!A.isVideoTexture&&(b.material.needsUpdate=!0),n()}function Et(t){if(K)return;const w=t.filter(Boolean).slice(0,3),b=JSON.stringify(w);if(b===te)return;te=b;const A=++pe;x.forEach((N,V)=>{N.visible=!1,_[V].material.map=null,_[V].material.needsUpdate=!0;const se=P[V];P[V]=null,se&&(p.delete(se),se.dispose())}),w.forEach((N,V)=>i.load(N,se=>{if(K||A!==pe){se.dispose();return}Ae(se),P[V]=se;const Le=_[V];Le.material.map=se,Le.material.color.set(16777215),Le.material.needsUpdate=!0,At(Le,se),x[V].visible=!0,n()},void 0,()=>{!K&&A===pe&&n()})),n()}function et(t){if(K)return;const{active:w,elapsed:b,reducedMotion:A,inspection:N}=t,V=A?0:b,se=Math.min(.05,Math.max(0,t.delta??1/60)),Le=A?1:1-Math.exp(-se*8);oe+=((A?0:rt.clamp(t.pointer?.[0]||0,-1,1))-oe)*Le,ze+=((A?0:rt.clamp(t.pointer?.[1]||0,-1,1))-ze)*Le;const be=Hn(t),ve=t.cameraZ??be.position[2];Q.update(ve,V,!!t.compact,A),Ge.update({elapsed:V,delta:se,reducedMotion:A,active:w,inspecting:N.expanded,audio:t.audio});const Fe=sn(t),Re=qn(V,A,me),mt=1+(Re.signal-1)*.42;ot.color.setScalar(mt),I.color.copy(He).multiplyScalar(mt),ke.uBreath.value=mt,ke.uTime.value=V,ke.uEnergy.value=Math.min(1,t.energy||0),ke.uPointer.value.set(oe,ze),ke.uCameraZ.value=ve,me+=((Fe?1:0)-me)*(A?1:1-Math.exp(-se*8)),Z.time=V,Z.reading=me,Z.pointer[0]=oe,Z.pointer[1]=ze,Z.pointerActive=!!t.pointerActive&&!N.expanded,Z.energy=Math.min(1,t.energy||0),Z.cameraZ=ve,Z.calm=A||!!t.compact,Z.quality=t.quality||"balanced",M.update(Z),Q.updateTelemetry(Z),ke.uRead.value=me,U.visible=!t.compact&&t.quality!=="light",O.uTime.value=V,O.uEnergy.value=Math.min(1,t.energy||0),O.uStation.value=gt[Math.max(0,w)]?.center[2]??-36,O.uRead.value=me,O.uCameraZ.value=ve,Pe.forEach((H,Ye)=>{const nt=ve-H.position.z;H.visible=nt>-12&&nt<130,H.visible&&(H.rotation.z=Ye*.7,H.children.forEach((Ue,ft)=>{Ue.rotation.z=V*(ft?-.037:.024)}))}),st.visible=ve>-18,ce.forEach((H,Ye)=>{const nt=Xn(Ye,t),Ue=gt[Ye],ft=Ye%2?1:-1;if(H.root.visible=nt.visible&&!t.compact,H.armRoot.visible=nt.visible&&!t.compact,!H.root.visible){a.scale.setScalar(0),a.updateMatrix(),Je.setMatrixAt(Ye,a.matrix);return}H.root.position.fromArray(nt.position),H.root.rotation.set(...nt.rotation);const ht=t.assemblies?.[Ye]??Yn(Ye,t),tt=ht.screen,m=.38+.62*ht.hinges,y=(1-tt)*2.44;H.screen.scale.setScalar(m),H.housing.scale.setScalar(m),H.housing.position.set(Ue.media.position[0]*m,Ue.media.position[1]*m,Ue.media.position[2]-y),H.screen.position.set(Ue.media.position[0]*m,Ue.media.position[1]*m,Ue.media.position[2]-y-(1-tt)*.96*m),H.screen.rotation.x=0,H.editorial.visible=!0,H.editorial.scale.setScalar(m),H.editorial.position.set(Ue.panel.position[0]*m,Ue.panel.position[1]*m,Ue.panel.position[2]-y),H.media.material.map!==R&&(H.mediaReady=Math.min(1,H.mediaReady+se/.42));const X=rt.smoothstep(ht.screen,.28,.96)*rt.smoothstep(H.mediaReady,0,1);H.media.material.color.setScalar(X);const W=t.assemblyAges?.[Ye]??-1;H.finish.visible=!A&&W>=0&&W<1.2&&ht.content>.99,H.finish.material.uniforms.uPhase.value=Math.max(0,W/1.2),H.screenSlides.forEach(vt=>{vt.scale.z=.08+tt*1.17,vt.position.z=-1.27+vt.scale.z*.5});const Me=N.expanded&&N.station===Ue.id,Be=A?1:1-Math.exp(-se*12);H.inspection+=((Me?1:0)-H.inspection)*Be,H.turn+=((Me?N.rotation:0)-H.turn)*Be;const Ke=H.inspection;H.exhibit.visible=ht.lock>.001,H.exhibit.rotation.y=H.turn,H.exhibit.scale.setScalar((1+Ke*.5)*ht.lock),H.exhibit.position.set(Ue.exhibit[0]+(3.35-Ue.exhibit[0])*Ke,Ue.exhibit[1]+.4*Ke,Ue.exhibit[2]);const It=A?0:(H.movement.rotation.y+se*.055*(1-Ke))%(Math.PI*2);H.movement.rotation.set(Math.sin(V*.18+Ye)*.06*(1-Ke),It,Math.sin(V*.15+Ye)*.04*(1-Ke)),H.mechanics.update(ht,Ke),H.root.updateMatrixWorld(!0),D.set(ft*7.15,-3.25,-.1).applyMatrix4(H.root.matrixWorld),a.position.copy(D),a.position.z+=.48,a.rotation.set(0,0,0),a.scale.set(2.8,2.2,1),a.updateMatrix(),Je.setMatrixAt(Ye,a.matrix),Ye===Math.max(0,w)&&(Ve.position.copy(D),Ve.position.z+=1.1,Ve.intensity=(2.4+ke.uEnergy.value*1.5+Math.abs(oe)*.6)*(1+(Re.breath-1)*.5)),H.target.copy(D).sub(H.armRoot.position),r.set(ft*8.25,-2.7,.1),s.copy(r).lerp(H.target,.5),s.y-=.58,s.z+=1.1,Se(H.arms[0],r,s),Se(H.arms[1],s,H.target),H.motors[0].position.copy(r),H.motors[1].position.copy(s),H.motors[2].position.copy(H.target),H.hub.rotation.set(ze*.09,oe*.11,V*.13)}),Je.instanceMatrix.needsUpdate=!0,Ve.visible=!t.compact}function dt(){K||(K=!0,Ge.destroy(),Q.destroy(),M.dispose(),qe.dispose(),o.dispose(),e.remove(B,Ve),ce.forEach(t=>{e.remove(t.root,t.armRoot)}),f.forEach(t=>t.dispose()),u.forEach(t=>t.dispose()),g.forEach(t=>t.dispose()),p.forEach(t=>t.dispose()),f.clear(),u.clear(),g.clear(),p.clear(),c.clear())}function pt(t){M.setProtection(t),Q.setTelemetryProtection(t)}return{chapters:ce,entrance:st,update:et,setPoster:Ze,setActiveTexture:wt,setCollection:Et,setEditorialSize:ee,setTelemetryProtection:pt,destroy:dt}}const xn=(e,n,u)=>Math.max(n,Math.min(u,e));function Co(){const e={x:0,y:0,vx:0,vy:0,strength:0,charge:0,orbit:0,trail:Array.from({length:4},()=>({x:0,y:0,strength:0})),pulse:{x:0,y:0,age:2,power:0}};let n=0,u=0,g=0,p=0,f=!1,c=!1,o=1,i=-1;return{field:e,move(a,r,s,T=!1){if([a,r,s].every(Number.isFinite)){if(a=xn(a,-1.1,1.1),r=xn(r,-1.1,1.1),f&&s>i){const C=Math.max(.008,(s-i)/1e3);g=(a-n)/C,p=(r-u)/C;const E=Math.min(1,5/(Math.hypot(g,p)||1));g*=E,p*=E}else{e.x=a,e.y=r;for(const C of e.trail)C.x=a,C.y=r}n=a,u=r,f=!0,i=s,o=T?.48:1}},press(){f&&(c=!0)},release(){c&&(e.pulse.x=e.x,e.pulse.y=e.y,e.pulse.age=0,e.pulse.power=.35+e.charge*.65),c=!1},leave(){f=c=!1,g=p=0},reset(){f=c=!1,i=-1,g=p=0,e.vx=e.vy=e.strength=e.charge=0,e.pulse.age=2,e.pulse.power=0;for(const a of e.trail)a.strength=0},update(a){const r=Number.isFinite(a)?xn(a,0,.05):0,s=1-Math.exp(-r*24),T=1-Math.exp(-r*11);e.x+=(n-e.x)*s,e.y+=(u-e.y)*s,e.vx+=(g-e.vx)*T,e.vy+=(p-e.vy)*T,g*=Math.exp(-r*8),p*=Math.exp(-r*8),e.strength+=((f?o:0)-e.strength)*T,e.charge+=((c?1:0)-e.charge)*(1-Math.exp(-r*(c?3.8:9))),e.orbit=(e.orbit+r*e.charge*1.3)%(Math.PI*2);const C=Math.min(1,Math.hypot(e.vx,e.vy)*.4)*e.strength;let E=e.x,D=e.y,v=C;for(let d=0;d<e.trail.length;d++){const z=e.trail[d],R=1-Math.exp(-r*(13-d*1.8));z.x+=(E-z.x)*R,z.y+=(D-z.y)*R,z.strength+=(v-z.strength)*R,E=z.x,D=z.y,v=z.strength*.8}return e.pulse.age=Math.min(2,e.pulse.age+r),e.pulse.age>=1.7&&(e.pulse.power=0),e}}}function zo(){const n=Co(),u=new Float32Array(2400*3),g=new Float32Array(2400*3);let p=74021;const f=()=>(p=Math.imul(p,1664525)+1013904223>>>0,p/4294967296);for(let a=0;a<2400;a++){const r=f()*Math.PI*2,s=1.5+Math.sqrt(f())*6.7;u.set([Math.cos(r)*s,Math.sin(r)*s,22-f()*340],a*3),g.set([f()*Math.PI*2,.035+f()**2*.065,f()],a*3)}const c=new dn;c.setAttribute("position",new In(u,3)),c.setAttribute("aTraits",new In(g,3));const o=new St({transparent:!0,depthWrite:!1,depthTest:!0,blending:Jt,uniforms:{uTime:{value:0},uHeight:{value:700},uPixelRatio:{value:1},uLight:{value:1},uPointer:{value:new en},uVelocity:{value:new at},uTrail:{value:Array.from({length:4},()=>new Ce)},uPulse:{value:new en(0,0,2,0)},uOrbit:{value:0},uTravel:{value:0},uSignal:{value:new Ce(0,8,0)}},vertexShader:`
      attribute vec3 aTraits;
      uniform float uTime, uHeight, uPixelRatio, uOrbit, uTravel;
      uniform vec3 uSignal;
      uniform vec4 uPointer, uPulse;
      uniform vec2 uVelocity;
      uniform vec3 uTrail[4];
      varying float vEnergy, vTint, vDepth, vReaction, vTravel;
      varying vec2 vDirection;
      void main() {
        vec3 p = position;
        float phase = aTraits.x;
        // Nested currents give neighboring lights a shared fluid motion.
        float stream = sin(p.z * .19 + uTime * .24) + cos(p.y * .32 - uTime * .18);
        float orbitAngle = uTime * .035 + sin(p.z * .025 + uTime * .09) * .13;
        p.xy = mat2(cos(orbitAngle),-sin(orbitAngle),sin(orbitAngle),cos(orbitAngle))*p.xy;
        p.x += sin(p.z * .17 + uTime * .22 + stream) * .34;
        p.y += sin(p.x * .21 - uTime * .19 + phase * .35) * .28;
        p.z += cos(p.x * .16 + uTime * .18 + stream) * .24;
        float signalDistance = (p.z - (uSignal.x - 4.0 - uSignal.y * 36.0)) / 7.0;
        float signal = exp(-signalDistance * signalDistance) * uSignal.z * (1.0 - smoothstep(5.0, 8.0, uSignal.y));
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        float depth = -view.z;
        vec2 projection = vec2(projectionMatrix[0][0], projectionMatrix[1][1]);
        vec2 metric = vec2(projection.y / projection.x, 1.0);
        vec2 screen = view.xy * projection / max(depth, .5);
        vec2 d = (screen - uPointer.xy) * metric;
        float radius = length(d);
        vec2 radial = d / max(radius, .015);
        vec2 tangent = vec2(-radial.y, radial.x);
        float influence = exp(-dot(d, d) * 3.2) * uPointer.z;
        vec2 velocity = uVelocity * metric;
        float speed = min(length(velocity), 4.0);
        float charge = uPointer.w;

        // Hover parts the air; quick sweeps pull it into a curved wake.
        vec2 drift = (radial * .075 + tangent * .14 + velocity * .045) * influence;
        float wake = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 delta = (screen - uTrail[i].xy) * metric;
          float field = exp(-dot(delta, delta) * 8.0) * uTrail[i].z;
          drift += (vec2(-delta.y, delta.x) * .42 + velocity * .026) * field;
          wake += field;
        }

        // Hold gathers nearby light into layered arcs. Release lets it
        // relax back to its real coordinates in the architecture.
        float angle = atan(d.y, d.x) + uOrbit + phase * .4;
        float orbitRadius = .16 + aTraits.z * .18;
        vec2 orbit = vec2(cos(angle), sin(angle)) * orbitRadius;
        drift += (orbit - d) * influence * charge * .94;
        vec2 pulseDelta = (screen - uPulse.xy) * metric;
        float pulseRadius = length(pulseDelta);
        float waveDistance = (pulseRadius - uPulse.z * 1.15) * 8.0;
        float wave = exp(-waveDistance * waveDistance);
        wave *= uPulse.w * (1.0 - smoothstep(.15, 1.6, uPulse.z));
        drift += pulseDelta / max(pulseRadius, .02) * wave * .19;
        float reaction = min(1.0, influence * (.35 + speed * .28 + charge * .65) + wake * .22 + wave + signal * .8);
        view.xy += (drift / metric) * max(depth, .5) / projection;
        view.z += sin(phase + uTime * .7) * influence * charge * .24;
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(aTraits.y * (1.0 + reaction * .7) * uHeight * projection.y / max(depth, .5),
          1.0 * uPixelRatio, 14.0 * uPixelRatio);
        vDepth = smoothstep(.7, 2.0, depth) * (1.0 - smoothstep(65.0, 120.0, depth));
        vEnergy = .85 + .12 * sin(uTime * .45 + phase);
        vReaction = reaction;
        vTravel = uTravel;
        vTint = aTraits.z;
        vDirection = normalize(vec2(drift.x, -drift.y) + vec2(.001, .002));
      }
    `,fragmentShader:`
      uniform float uLight;
      varying float vEnergy, vTint, vDepth, vReaction, vTravel;
      varying vec2 vDirection;
      void main() {
        vec2 uv = (gl_PointCoord - .5) * 2.0;
        float r = length(uv);
        if (r > 1.0) discard;
        float halo = exp(-r * r * 12.0) * (.055 + vReaction * .055);
        float core = exp(-r * r * 105.0) * .7;
        vec2 axial = vec2(dot(uv, vDirection), dot(uv, vec2(-vDirection.y, vDirection.x)));
        float glint = exp(-axial.x * axial.x * (14.0 - vTravel * 9.0) - axial.y * axial.y * 160.0) * (vReaction * .1 + vTravel * .12);
        float alpha = (core + halo + glint) * (1.0 - smoothstep(.65, 1.0, r)) * vDepth * vEnergy * uLight;
        vec3 chrome = vec3(.88, .86, .78);
        vec3 signal = vec3(1.0, .302, .196);
        vec3 color = mix(chrome, signal, max(step(.76, vTint), vReaction * .6));
        gl_FragColor = vec4(color, min(alpha, .60));
        #include <colorspace_fragment>
      }
    `});o.toneMapped=!1;const i=new wa(c,o);return i.name="Monumental / passage currents",i.frustumCulled=!1,{points:i,input:n,configure(a,r,s,T,C){c.setDrawRange(0,T==="light"?700:s?600:T==="detail"?2400:1800),o.uniforms.uHeight.value=a*r,o.uniforms.uPixelRatio.value=r,o.uniforms.uLight.value=.9+rt.clamp(C,0,100)/400},update(a,r=1/60,s=!1,T=0,C){s&&n.reset();const E=n.update(s?0:r);o.uniforms.uTime.value=a,o.uniforms.uTravel.value=Math.min(1,Math.max(0,T)),o.uniforms.uSignal.value.set(C?.originZ??0,C?.age??8,C?.strength??0),o.uniforms.uOrbit.value=E.orbit,o.uniforms.uPointer.value.set(E.x,E.y,E.strength,E.charge),o.uniforms.uVelocity.value.set(E.vx,E.vy),E.trail.forEach((D,v)=>o.uniforms.uTrail.value[v].set(D.x,D.y,D.strength)),o.uniforms.uPulse.value.set(E.pulse.x,E.pulse.y,E.pulse.age,E.pulse.power)},dispose(){n.reset(),c.dispose(),o.dispose()}}}const Gn=Math.PI*2,on=86,Rt=6,Zt=8,Dt=12,Io=328;function Lo(e){const n=new xe;n.name="passage-living-signals",e.add(n);const u=[],g=[],p=[],f=new Ft,c=new Ut;let o=!1,i=0,a=0;const r={uLifeTime:{value:0},uLifeCameraZ:{value:14},uLifeStation:{value:-36},uLifeRead:{value:0},uLifeEnergy:{value:0},uLifePointer:{value:new at},uLifePulse:{value:new Ce(99,0,0)}},s=`
    ${Po}
    uniform float uLifeTime, uLifeCameraZ, uLifeStation, uLifeRead, uLifeEnergy;
    uniform vec2 uLifePointer;
    uniform vec3 uLifePulse;
    float lifeWave(float z) {
      float age = uLifePulse.x;
      float front = uLifePulse.y - 4.0 - age * 36.0;
      float distance = (z - front) / 3.8;
      return exp(-distance * distance) * uLifePulse.z
        * (1.0 - smoothstep(4.0, 6.2, age));
    }
    float lifeQuiet(float z) {
      return 1.0 - uLifeRead * (1.0 - smoothstep(4.0, 18.0, abs(z - uLifeStation))) * .86;
    }
    float lifeRange(float z) {
      float depth = uLifeCameraZ - z;
      return smoothstep(-8.0, -2.0, depth) * (1.0 - smoothstep(75.0, 112.0, depth));
    }
    float lifePointer(float angle) {
      vec2 direction = vec2(cos(angle), sin(angle));
      float amount = min(length(uLifePointer), 1.0);
      return pow(max(0.0, dot(direction, normalize(uLifePointer + vec2(.0001)))), 6.0) * amount;
    }
  `,T=`${s}
    attribute vec3 aLife;
    float lifeHinge() {
      float passing = exp(-pow((aLife.x - (uLifeCameraZ - 13.0)) / 13.0, 2.0));
      // Each mechanism attends, adjusts and settles, with a long quiet interval.
      // Seeded phase offsets avoid a uniform wall of continually flapping fins.
      float cycle = mod(uLifeTime + aLife.x * .21 + aLife.y * 2.71 + 760.0, 19.0);
      float awake = smoothstep(0.0, 1.4, cycle) * (1.0 - smoothstep(2.7, 4.6, cycle));
      return -.035 - min(.38, (awake * .23 + passing * (.035 + uLifeEnergy * .09)
        + lifePointer(aLife.y) * passing * .1 + lifeWave(aLife.x) * .26) * lifeQuiet(aLife.x));
    }
    vec3 lifeRotate(vec3 p) {
      float angle = lifeHinge(), c = cos(angle), s = sin(angle);
      return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
    }
  `,C=new Bt(.78,.065,1.8).translate(0,0,-.9),E=new Bt(.035,.016,1.62).translate(.358,.044,-.9);u.push(C,E);const D=new je({color:6581093,metalness:.89,roughness:.28}),v=new Pt({color:16777215,toneMapped:!1});g.push(D,v);const d=new Float32Array(on*Rt*3);for(let l=0;l<on*Rt;l++){const M=Math.floor(l/Rt),I=l%Rt;d.set([15.8-M*3.65,I*Gn/Rt+M*.058+.26,M%7],l*3)}C.setAttribute("aLife",new Kt(d,3)),E.setAttribute("aLife",new Kt(d,3));for(const l of[D,v])l.onBeforeCompile=M=>{Object.assign(M.uniforms,r),M.vertexShader=M.vertexShader.replace("#include <common>",`#include <common>
${T}
varying float vLifeCharge;`).replace("#include <beginnormal_vertex>",`#include <beginnormal_vertex>
objectNormal = lifeRotate(objectNormal);`).replace("#include <begin_vertex>",`#include <begin_vertex>
          transformed = lifeRotate(transformed) * max(.001, lifeRange(aLife.x));
          vLifeCharge = (lifeWave(aLife.x) * .85 + lifePointer(aLife.y) * .22 + uLifeEnergy * .12) * lifeQuiet(aLife.x);
        `),l===v&&(M.fragmentShader=M.fragmentShader.replace("#include <common>",`#include <common>
varying float vLifeCharge;`).replace("#include <color_fragment>",`#include <color_fragment>
diffuseColor.rgb *= .42 + vLifeCharge * .8;`))},l.customProgramCacheKey=()=>`monumental-life-vanes-v2-${l.type}`;const z=new ut(C,D,on*Rt),R=new ut(E,v,on*Rt);z.name="hinged-alloy-wall-vanes",R.name="vane-signal-inlays";for(let l=0;l<z.count;l++){const M=d[l*3+1],I=8.26+kt(d[l*3]);f.position.set(Math.cos(M)*I,Math.sin(M)*I,d[l*3]),f.rotation.set(0,0,M-Math.PI/2),f.scale.set(1,1,1),f.updateMatrix(),z.setMatrixAt(l,f.matrix),R.setMatrixAt(l,f.matrix),c.set(16731442),R.setColorAt(l,c)}for(const l of[z,R])l.instanceMatrix.needsUpdate=!0,l.frustumCulled=!1,n.add(l),p.push(l);const x=[],_=[],P=[],K=420;for(let l=0;l<Zt;l++){const M=x.length/3;for(let I=0;I<=K;I++){const F=18-I/K*Io,k=l*Gn/Zt+F*.027;for(const G of[-1,1]){const $=k+G*.0021,B=8.04+kt(F);x.push(Math.cos($)*B,Math.sin($)*B,F),_.push((G+1)/2,I/K)}if(I<K){const G=M+I*2;P.push(G,G+1,G+2,G+1,G+3,G+2)}}}const te=new dn;te.setAttribute("position",new _t(x,3)),te.setAttribute("uv",new _t(_,2)),te.setIndex(P),u.push(te);const pe=new St({uniforms:r,transparent:!0,depthWrite:!1,depthTest:!0,side:Qt,vertexShader:`${s} varying float vLifeAlpha; void main() {
      vLifeAlpha = lifeRange(position.z) * lifeQuiet(position.z) * (.10 + lifeWave(position.z) * .45);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,fragmentShader:`varying float vLifeAlpha; void main() {
      gl_FragColor = vec4(1.0, .075, .033, vLifeAlpha);
      #include <colorspace_fragment>
    }`});pe.forceSinglePass=!0,pe.toneMapped=!1,g.push(pe);const oe=new _e(te,pe);oe.name="helical-transmission-rails",n.add(oe);const ze=new Bt(.085,.048,.72),me=new Float32Array(Zt*Dt*3);for(let l=0;l<Zt*Dt;l++)me.set([Math.floor(l/Dt),l%Dt,l%Dt/(Dt-1)],l*3);ze.setAttribute("aTrain",new Kt(me,3)),u.push(ze);const we=new St({uniforms:r,depthTest:!0,depthWrite:!0,vertexShader:`${s}
      attribute vec3 aTrain; varying vec3 vLifeTint; varying float vLifeVisibility;
      void main() {
        float lane = aTrain.x;
        float z = 18.0 - mod(uLifeTime * (7.2 + mod(lane, 3.0) * .7) + lane * 41.0 - aTrain.y * .92 + 656.0, 328.0);
        float angle = lane * .7853981634 + z * .027;
        float quiet = lifeQuiet(z), range = lifeRange(z);
        float taper = 1.0 - aTrain.z * .82;
        vec3 p = position * vec3(taper, taper, aTrain.y < .5 ? 1.7 : .72);
        p *= range;
        vec3 radial = vec3(cos(angle), sin(angle), 0.0);
        vec3 tangent = vec3(-sin(angle), cos(angle), 0.0);
        vec3 centre = radial * (8.035 + passageBayExpansion(z)) + vec3(0.0, 0.0, z);
        vec3 world = centre + tangent * p.x + radial * p.y + normalize(vec3(tangent.xy * .217, 1.0)) * p.z;
        float head = 1.0 - smoothstep(0.0, 2.0, aTrain.y);
        vLifeTint = mix(vec3(1.0, .075, .033), vec3(.86, .84, .76), head);
        vLifeVisibility = (1.0 - aTrain.z * .65) * quiet * range;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
      }
    `,fragmentShader:`varying vec3 vLifeTint; varying float vLifeVisibility;
      void main() {
        if (vLifeVisibility < .015) discard;
        gl_FragColor = vec4(vLifeTint * vLifeVisibility, 1.0);
        #include <colorspace_fragment>
      }
    `});we.toneMapped=!1,g.push(we);const re=new ut(ze,we,Zt*Dt);re.name="helical-signal-trains",re.frustumCulled=!1,f.position.set(0,0,0),f.rotation.set(0,0,0),f.scale.set(1,1,1),f.updateMatrix();for(let l=0;l<re.count;l++)re.setMatrixAt(l,f.matrix);n.add(re),p.push(re);const ue=new Ot(7.98,.023,4,16,Math.PI/6*.61),ie=new Float32Array(72);for(let l=0;l<36;l++)ie.set([l%12,Math.floor(l/12)],l*2);ue.setAttribute("aPulse",new Kt(ie,2)),u.push(ue);const ge=new St({uniforms:r,depthTest:!0,depthWrite:!1,transparent:!0,vertexShader:`${s} attribute vec2 aPulse; varying float vLifeAlpha;
      void main() {
        float z = uLifePulse.y - 4.0 - uLifePulse.x * 36.0 + aPulse.y * 1.05;
        float angle = aPulse.x * .5235987756 + z * -.01589;
        float c = cos(angle), s = sin(angle);
        vec3 world = vec3(position.x * c - position.y * s, position.x * s + position.y * c, position.z + z);
        world.xy *= 1.0 + passageBayExpansion(z) / 7.98;
        vLifeAlpha = uLifePulse.z * (1.0 - smoothstep(4.0, 6.2, uLifePulse.x))
          * (1.0 - aPulse.y * .31) * lifeRange(z) * lifeQuiet(z) * .78;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
      }
    `,fragmentShader:`varying float vLifeAlpha; void main() {
      gl_FragColor = vec4(1.0, .075, .033, vLifeAlpha);
      #include <colorspace_fragment>
    }`});ge.toneMapped=!1,g.push(ge);const ye=new ut(ue,ge,36);ye.name="travelling-architectural-pulse",ye.frustumCulled=!1,ye.visible=!1;for(let l=0;l<ye.count;l++)ye.setMatrixAt(l,f.matrix);return n.add(ye),p.push(ye),{update(l){if(o||(n.visible=!l.compact&&!l.reducedMotion,!n.visible))return;const M=l.active>=0&&l.progress>=.38&&(l.progress<=.74||l.active===5);i+=Math.min(Math.max(l.delta,0),.05)*(l.inspection?.12:M?.34:1),a+=((M||l.inspection?1:0)-a)*(1-Math.exp(-Math.min(Math.max(l.delta,0),.05)*9)),r.uLifeTime.value=i,r.uLifeCameraZ.value=l.cameraZ,r.uLifeStation.value=-36-Math.max(0,l.active)*42,r.uLifeRead.value=a,r.uLifeEnergy.value=Math.min(1,Math.max(0,l.energy)),r.uLifePointer.value.set(l.pointer[0],l.pointer[1]),r.uLifePulse.value.set(l.pulse.age,l.pulse.originZ,l.pulse.strength),ye.visible=!l.inspection&&l.pulse.strength>.01&&l.pulse.age>=0&&l.pulse.age<6.2,oe.visible=l.quality!=="light",R.visible=l.quality!=="light"},destroy(){if(!o){o=!0,e.remove(n);for(const l of p)l.dispose();for(const l of u)l.dispose();for(const l of g)l.dispose();n.clear()}}}}const Ht=Math.PI*2,ln=e=>Math.max(0,Math.min(1,e)),Gt=e=>{const n=ln(e);return n*n*(3-2*n)};function Fo(e){const n=new Set,u=new Set,g=[],p=new xe;p.name="tunnel-living-relays",e.add(p);const f=new xe;f.name="tunnel-hero-relay",p.add(f);const c=new xe;c.name="tunnel-travel-relays",p.add(c);const o=new xe;f.add(o);const i=new Ft,a=new Ft,r=new pn,s=new Ce,T=new Ce,C=new Ce,E=new Ce(0,1,0),D=[],v=[];let d=!1,z=!1,R=0,x=0,_=0,P=0,K=!0,te=null,pe=null;const oe=new Float32Array(6),ze=new Float32Array(6),me=S=>(n.add(S),S),we=S=>(u.add(S),S),re=we(new je({color:13686483,metalness:1,roughness:.1,envMapIntensity:1.2})),ue=we(new je({color:1382936,metalness:.76,roughness:.31,envMapIntensity:.75})),ie=we(new je({color:14934227,metalness:.18,roughness:.34})),ge=we(new je({color:6581607,metalness:.86,roughness:.38})),ye=we(new je({color:16731442,emissive:16731442,emissiveIntensity:.35,metalness:.45,roughness:.3})),l=we(new Pt({color:16736584,toneMapped:!1})),M=we(re.clone());M.userData.passageShell=!0,ge.userData.passageInternal=!0;function I(S,q,Se){const Ee=new jt;S.forEach(([ce,Ge],ee)=>ee?Ee.lineTo(ce,Ge):Ee.moveTo(ce,Ge)),Ee.closePath();const qe=new tn(Ee,{depth:q,steps:1,bevelEnabled:!0,bevelSize:Se,bevelThickness:Se,bevelSegments:2,curveSegments:1});return qe.translate(0,0,-q/2),me(qe)}const F=I([[.98,-.24],[1.4,-.4],[1.85,-.29],[2.02,-.08],[1.93,.18],[1.48,.34],[1.03,.23],[1.19,.015]],.23,.045),k=I([[1.39,-.28],[1.78,-.2],[1.88,-.065],[1.82,.095],[1.5,.22],[1.37,.18]],.045,.023),G=I([[.85,-.13],[1.29,-.21],[1.62,-.1],[1.58,.1],[1.23,.19],[.85,.12]],.18,.025),$=me(new Nt(1,1,1,12)),B=me(new bn([new at(.82,-.5),new at(1,-.5),new at(1,.5),new at(.82,.5),new at(.82,-.5)],32)),Q=me(new Nt(1,1,1,8)),Z=me(new Bt(1,1,1)),fe=me(new Wn(.46,0));function Y(S,q,Se){const Ee=[];for(let ce=0;ce<3;ce++){const Ge=new jt,ee=ce*Ht/3+.15,Ae=Ht/3-.42;for(let Ze=0;Ze<=12;Ze++){const wt=ee+Ae*Ze/12,Et=Math.cos(wt)*S,et=Math.sin(wt)*S;Ze?Ge.lineTo(Et,et):Ge.moveTo(Et,et)}for(let Ze=12;Ze>=0;Ze--){const wt=ee+Ae*Ze/12;Ge.lineTo(Math.cos(wt)*(S-q),Math.sin(wt)*(S-q))}Ge.closePath(),Ee.push(Ge)}const qe=new tn(Ee,{depth:Se,steps:1,bevelEnabled:!0,bevelSize:.012,bevelThickness:.012,bevelSegments:1,curveSegments:1});return qe.translate(0,0,-Se/2),me(qe)}const le=Y(1.03,.085,.09),he=Y(.78,.09,.1);function j(S,q,Se,Ee,qe=!1){const ce=new ut(q,Se,Ee);return ce.instanceMatrix.setUsage(mn),ce.frustumCulled=!1,g.push(ce),S.add(ce),qe&&D.push(ce),ce}function J(S,q){i.updateMatrix(),S.setMatrixAt(q,i.matrix)}function de(S){S.instanceMatrix.needsUpdate=!0}const Ie=j(o,F,M,6,!0),De=j(o,k,ie,6,!0);Ie.name="relay-shell-components",De.name="relay-shell-inlays";const Ne=j(o,G,ue,6,!0),He=j(o,$,ge,6),ot=j(o,$,re,6),Oe=j(o,Q,ue,12),it=j(o,Z,l,6),ke=j(o,Z,ge,30),h=j(o,B,ge,3,!0),L=j(o,Z,ie,6),U=[new _e(le,re),new _e(le,ue),new _e(he,ie)];U.forEach(S=>{o.add(S),D.push(S)});const O=new _e(fe,ye);o.add(O),D.push(O);const ae=new _e($,ue);ae.rotation.x=Math.PI/2,ae.scale.set(.37,.18,.37),ae.position.z=-.58,o.add(ae);const ne=5,Pe=j(c,F,M,ne*6),We=j(c,k,ie,ne*6),Te=j(c,$,ue,ne*6),Je=j(c,le,ge,ne),Ve=j(c,fe,l,ne),st=Array.from({length:ne},(S,q)=>{const Se=.65+q*2.1;return{x:Math.cos(Se)*6.6,y:Math.sin(Se)*6.6,z:fn(q)-16,angle:Se}});for(let S=0;S<3;S++)i.position.set(0,0,-.43+S*.43),i.rotation.set(Math.PI/2,0,0),i.scale.set(S===1?.55:.46,.075,S===1?.55:.46),J(h,S);for(let S=0;S<6;S++){const q=S*Ht/6;i.position.set(Math.cos(q)*.5,Math.sin(q)*.5,-.04),i.rotation.set(0,0,q),i.scale.set(.055,.07,.87),J(L,S)}de(h),de(L);function Xe(){for(let S=0;S<6;S++){const q=S*Ht/6,Se=Math.cos(q),Ee=Math.sin(q),qe=oe[S],ce=R*.48+qe*.78,Ge=Math.sin(R*Math.PI/2)*(S%2?.32:-.16)+qe*.72;i.position.set(Se*ce,Ee*ce,Ge),i.rotation.set(0,(S%2?-1:1)*(R*.26+qe*.2),q),i.scale.set(1,1,1),J(Ie,S),i.position.z+=.16,J(De,S),i.position.set(Se*ce*.42,Ee*ce*.42,-.2),i.rotation.set(0,0,q),i.scale.set(1,1,1),J(Ne,S),i.position.set(Se*.93,Ee*.93,-.025),i.rotation.set(0,0,q-Math.PI/2),i.scale.set(.088,.61,.088),J(He,S),s.set(Se*1.1,Ee*1.1,.035),T.set(Se*(1.25+ce),Ee*(1.25+ce),Ge+.14),C.subVectors(T,s),i.position.copy(s).add(T).multiplyScalar(.5),i.scale.set(.045,Math.max(.14,C.length()),.045),i.quaternion.setFromUnitVectors(E,C.normalize()),J(ot,S);for(let ee=0;ee<2;ee++){const Ae=ee?1.25+ce:.73;i.position.set(Se*Ae,Ee*Ae,ee?Ge+.14:.05),i.rotation.set(Math.PI/2,0,0),i.scale.set(.115,.12,.115),J(Oe,S*2+ee)}i.position.set(Se*(1.64+ce),Ee*(1.64+ce),Ge+.21),i.rotation.set(0,0,q+Math.PI/2),i.scale.set(.19,.024,.02),J(it,S);for(let ee=0;ee<5;ee++){const Ae=1.06+ee*.125+ce*.46;i.position.set(Se*Ae,Ee*Ae,-.28+qe*.2),i.rotation.set(0,0,q),i.scale.set(.035,.26+ee*.014,.25),J(ke,S*5+ee)}}de(Ie),de(De),de(Ne),de(He),de(ot),de(Oe),de(it),de(ke),K=!0}Xe();let At=R;function Tt(S){if(d)return;if(p.visible=!S.compact&&!S.reducedMotion,!p.visible){f.visible=c.visible=!1;return}const q=S.inspection?0:Math.min(.05,Math.max(0,S.delta));x+=q;const Se=1-Math.exp(-q*7);_+=(S.pointer[0]-_)*Se,P+=(S.pointer[1]-P)*Se,R+=((z?1:0)-R)*(1-Math.exp(-q*6)),Math.abs(R-(z?1:0))<1e-4&&(R=z?1:0);let Ee=!1;for(let ee=0;ee<6;ee++){const Ae=z&&te===ee?pe??1:0;oe[ee]+=(Ae-oe[ee])*(1-Math.exp(-q*7)),Math.abs(oe[ee]-Ae)<1e-4&&(oe[ee]=Ae),Math.abs(ze[ee]-oe[ee])>1e-5&&(Ee=!0,ze[ee]=oe[ee])}const qe=Gt((10-S.cameraZ)/10.5);if(f.visible=S.active<0&&S.cameraZ>-.65&&!S.inspection,f.visible){const ee=Gt((S.cameraZ+.65)/5.5);f.position.set(2.6+qe*1.35,-.2+Math.sin(x*.43)*.085,-6),f.scale.setScalar(ee),o.rotation.set(.14+P*.075,-.2+_*.11,-.08+Math.sin(x*.15)*.045),U[0].rotation.set(.7,x*.22,-.3),U[1].rotation.set(-.55,-x*.17,1.02),U[1].scale.setScalar(.92),U[2].rotation.set(x*.14,.45,x*-.24),O.rotation.set(x*.09,x*.16,x*.05);const Ae=S.pulse.strength*Math.exp(-Math.max(0,S.pulse.age)*2.9);ye.emissiveIntensity=.28+.1*(Math.sin(x*1.9)*.5+.5)+ln(S.energy)*.18+Ae*.65,(Math.abs(At-R)>1e-5||Ee)&&(Xe(),At=R)}const ce=S.progress,Ge=S.active<0||S.inspection?0:ce<.38?1-Gt((ce-.18)/.17):Gt((ce-.77)/.15);if(c.visible=Ge>.001,!!c.visible){for(let ee=0;ee<ne;ee++){const Ae=st[ee],Ze=S.cameraZ-Ae.z,Et=Ze>-4&&Ze<64&&!(S.quality==="light"&&ee%2)?.29*Ge*Gt((Ze+4)/6)*(1-Gt((Ze-48)/16)):0;a.position.set(Ae.x,Ae.y,Ae.z),a.rotation.set(.2+Math.sin(ee*2)*.35,Math.cos(ee*3)*.4,Ae.angle+x*(ee%2?.06:-.06)),a.scale.setScalar(Et),a.updateMatrix();for(let et=0;et<6;et++){const dt=et*Ht/6,pt=.035+.16*eo(x,ee*6+et);i.position.set(Math.cos(dt)*pt,Math.sin(dt)*pt,0),i.rotation.set(0,0,dt),i.scale.set(1,1,1),i.updateMatrix(),r.multiplyMatrices(a.matrix,i.matrix),Pe.setMatrixAt(ee*6+et,r),i.position.z=.16,i.updateMatrix(),r.multiplyMatrices(a.matrix,i.matrix),We.setMatrixAt(ee*6+et,r),i.position.set(Math.cos(dt),Math.sin(dt),-.06),i.rotation.set(0,0,dt-Math.PI/2),i.scale.set(.08,.8,.08),i.updateMatrix(),r.multiplyMatrices(a.matrix,i.matrix),Te.setMatrixAt(ee*6+et,r)}i.position.set(0,0,0),i.rotation.set(.5,x*.2+ee,0),i.scale.set(1,1,1),i.updateMatrix(),r.multiplyMatrices(a.matrix,i.matrix),Je.setMatrixAt(ee,r),i.rotation.set(x*.12,ee,x*.21),i.scale.setScalar(1+ln(S.energy)*.12),i.updateMatrix(),r.multiplyMatrices(a.matrix,i.matrix),Ve.setMatrixAt(ee,r)}de(Pe),de(We),de(Te),de(Je),de(Ve)}}return{update:Tt,setExploded(S){z=S,S||(te=null,pe=null)},setSelectedPart(S){const q=Dn(S);te!==q&&(pe=null),te=q},setPartPull(S){pe=S!==null&&Number.isFinite(S)?ln(S):null},hitPart(S){if(d||!p.visible||!f.visible||f.scale.x<.08)return null;f.updateWorldMatrix(!0,!0),K&&(Ie.computeBoundingSphere(),De.computeBoundingSphere(),Ne.computeBoundingSphere(),K=!1),v.length=0,S.intersectObjects([Ie,De,Ne],!1,v);const q=Dn(null);return v.length=0,q},hitTest(S){if(d||!p.visible||!f.visible||f.scale.x<.08)return!1;f.updateWorldMatrix(!0,!0),K&&(Ie.computeBoundingSphere(),De.computeBoundingSphere(),Ne.computeBoundingSphere(),K=!1),v.length=0,S.intersectObjects(D,!1,v);const q=v.length>0;return v.length=0,q},destroy(){d||(d=!0,e.remove(p),D.length=0,v.length=0,g.forEach(S=>S.dispose()),n.forEach(S=>S.dispose()),u.forEach(S=>S.dispose()),p.clear())}}}function Ro(){let e=0;return{tick(n,u){return!u||!Number.isFinite(n)?(e=0,!1):e?n<e?!1:(e=n+3e3,!0):(e=n+3e3,!1)},reset(){e=0}}}function Do(){const e={age:8,originZ:0,strength:0};return{value:e,trigger(n){Number.isFinite(n)&&(e.age=0,e.originZ=n,e.strength=1)},advance(n){!Number.isFinite(n)||n<=0||(e.age=Math.min(8,e.age+Math.min(.05,n)),e.age>=8&&(e.strength=0))},reset(){e.age=8,e.strength=0}}}function ko(e){const n=Math.max(0,Math.min(1,e));return n*n*n*(n*(n*6-15)+10)}const Xt=rt.clamp;function Ho(e,n){let u;try{u=new ba({alpha:!1,antialias:innerWidth>=980,powerPreference:"high-performance"})}catch{return n.onUnavailable(),{setState(){},setFocus(){},setScroll(){},rotate(){},travelTo(m,y){y()},cancelTravel(){},destroy(){}}}let g=!1,p=!1,f=!1,c={entered:!1,room:"atrium",paused:!1,reducedMotion:n.reducedMotion},o=Ba(),i=Na(),a=Ln(),r=1,s=1,T=!1,C=1,E=0,D=0,v=0,d=16.7,z=0,R=0,x=null;const _=[0,0],P=[0,0];let K=o.z,te=0,pe=Number(sn(o)),oe=!1,ze=!1,me=!1,we=0,re=0,ue=0;const ie=po(),ge=mo(),ye=matchMedia("(hover: hover) and (pointer: fine)"),l=()=>!c.reducedMotion&&(!T||ye.matches),M=Do(),I={open:!1,part:null,pull:0,phase:0},F=Ro();let k=0,G=null,$=-1,B=-1;const Q=Ca(),Z=u.domElement,fe=Ia(u),Y=[],le=[],he={left:0,top:0,right:0,bottom:0};Z.className="spatial-world-canvas",Z.setAttribute("aria-hidden","true"),Object.assign(Z.style,{width:"100%",height:"100%",display:"block",touchAction:"pan-y",pointerEvents:"none"}),e.appendChild(Z),u.outputColorSpace=cn,u.toneMapping=Ma,u.toneMappingExposure=1.06,u.setClearColor(526601,1);const j=new wn;j.background=new Ut(526601),j.fog=new Pa(526601,.021);const J=new Sa(59,1,.16,165),de=new Ce,Ie=new Ce,De=[],Ne=Array.from({length:4},()=>({left:0,top:0,right:0,bottom:0})),He=new Map,ot=new wn,Oe=new uo;Oe.domElement.className="tunnel-css-world",Object.assign(Oe.domElement.style,{position:"fixed",inset:"0",pointerEvents:"none",overflow:"clip",zIndex:"1"}),(document.getElementById("main")||e).appendChild(Oe.domElement);const it=to(u);j.environment=it.texture,j.environmentIntensity=.9;const ke=new Aa(15657439,1514524,.58);j.add(ke);const h=new Ta(16772832,1.4);h.position.set(-5,9,12),j.add(h,h.target);const L=new Mn(15068656,35,32,2),U=new Mn(16731442,11,24,2);j.add(L,U);const O=Eo(j,q),ae=so(j,u),ne=zo();j.add(ne.points);const Pe=Lo(j),We=Fo(j),Te={time:0,delta:0,cameraZ:14,active:-1,progress:0,pointer:_,energy:0,pulse:M.value,compact:!1,reducedMotion:!1,inspection:!1,quality:a.quality},Je=ja(),Ve=Je.controller,st=Oa(Ve.getVideo()),Xe=new Map,At=new Set,Tt=new ResizeObserver(m=>{for(const y of m){const X=[...Xe.values()].find(Me=>Me.binding.element===y.target);if(!X?.attached)continue;const W=gt[X.binding.index];O.setEditorialSize(X.binding.index,y.contentRect.width*W.panel.scale,y.contentRect.height*W.panel.scale)}q()});let S="";function q(){!E&&!g&&!p&&!c.paused&&!document.hidden&&(E=za(t))}function Se(m){const y=m.binding.element;m.attached&&(m.transform=y.style.transform,ot.remove(m.object),m.binding.fallback.appendChild(y)),m.style===null?y.removeAttribute("style"):y.setAttribute("style",m.style),y.inert=m.inert,m.aria===null?y.removeAttribute("aria-hidden"):y.setAttribute("aria-hidden",m.aria),y.removeAttribute("data-tunnel-mounted"),y.removeAttribute("data-assembly-progress"),y.removeAttribute("data-assembly-locked"),m.reveal=-1,m.attached=!1;for(const X of["screen","lock","content","settle"])y.removeAttribute(`data-assembly-${X}`)}function Ee(){const m=!T&&!p&&!c.reducedMotion;for(const y of Xe.values()){if(!m){y.attached&&Se(y);continue}if(y.attached)continue;const X=gt[y.binding.index],W=y.binding.element;W.dataset.tunnelMounted="true",Object.assign(W.style,{position:"absolute",pointerEvents:"auto",userSelect:"text",width:`${X.panel.width}px`}),y.transform&&(W.style.transform=y.transform),y.object.scale.setScalar(X.panel.scale),O.setEditorialSize(y.binding.index,W.offsetWidth*X.panel.scale,W.offsetHeight*X.panel.scale),y.reveal=-1,ot.add(y.object),y.attached=!0}Oe.domElement.style.display=m?"":"none"}function qe(m){for(const[y,X]of Xe)m.some(W=>W.id===y&&W.element===X.binding.element)||(Tt.unobserve(X.binding.element),Se(X),Xe.delete(y));for(const y of m){if(Xe.has(y.id))continue;const X=y.element,W={style:X.getAttribute("style"),inert:X.inert,aria:X.getAttribute("aria-hidden")},Me={binding:y,object:new lo(X),attached:!1,transform:"",reveal:-1,...W};Xe.set(y.id,Me),Tt.observe(X),(T||c.reducedMotion)&&Se(Me)}Ee(),q()}function ce(){if(!(c.paused||T||p))for(const m of Xe.values()){if(!m.attached)continue;const y=Xn(m.binding.index,o),X=ge.poses[m.binding.index],W=gt[m.binding.index],[Me,Be,Ke]=W.panel.position,It=Math.sin(y.rotation[1]),vt=Math.cos(y.rotation[1]);m.object.position.set(y.position[0]+Me*vt+Ke*It,y.position[1]+Be,y.position[2]-Me*It+Ke*vt),m.object.rotation.set(...y.rotation);const lt=c.room==="atrium"&&m.binding.index===o.active?X.content:0,Ct=lt>.99&&X.lock>=.999&&!x&&document.documentElement.dataset.spatialPassage!=="departing",Qe=m.binding.element;Qe.style.visibility=lt>.001?"visible":"hidden",Qe.style.opacity=String(lt),m.reveal!==X.deployment&&(Qe.style.clipPath="none",Qe.dataset.assemblyProgress=X.deployment.toFixed(3),Qe.dataset.assemblyLocked=String(X.lock>=.999),Qe.dataset.assemblyScreen=X.screen.toFixed(4),Qe.dataset.assemblyLock=X.lock.toFixed(4),Qe.dataset.assemblyContent=X.content.toFixed(4),m.reveal=X.deployment),Qe.dataset.assemblySettle=ge.ages[m.binding.index].toFixed(4),Qe.inert!==!Ct&&(Qe.inert=!Ct);const Wt=String(!Ct);Qe.getAttribute("aria-hidden")!==Wt&&Qe.setAttribute("aria-hidden",Wt)}}function Ge(){if(T||c.reducedMotion||p||c.room!=="atrium"||o.active<0||ge.poses[o.active].screen<.01){qt(null);return}const m=O.chapters[o.active].media;m.updateWorldMatrix(!0,!1);const y=m.geometry.parameters.width/2,X=m.geometry.parameters.height/2;let W=1/0,Me=1/0,Be=-1/0,Ke=-1/0;for(const It of[-y,y])for(const vt of[-X,X]){Ie.set(It,vt,0).applyMatrix4(m.matrixWorld).project(J);const lt=(Ie.x+1)*r/2,Ct=(1-Ie.y)*s/2;W=Math.min(W,lt),Be=Math.max(Be,lt),Me=Math.min(Me,Ct),Ke=Math.max(Ke,Ct)}qt({left:Math.max(0,W-5),top:Math.max(0,Me-5),right:Math.min(r,Be+5),bottom:Math.min(s,Ke+5)})}function ee(){const m=Math.max(0,o.active);for(let y=Math.max(0,m-1);y<=Math.min(5,m+1);y++)At.has(y)||(At.add(y),O.setPoster(y,Rn[y].poster));m>=4&&Et()}function Ae(m){if(!m||De.length===4)return;const y=m.getBoundingClientRect();if(y.width<1||y.height<1||y.bottom<0||y.top>s||y.right<0||y.left>r)return;const X=Ne[De.length];X.left=Xt((y.left-8)/r,0,1),X.right=Xt((y.right+8)/r,0,1),X.top=Xt((y.top-8)/s,0,1),X.bottom=Xt((y.bottom+8)/s,0,1),De.push(X)}function Ze(m){let y=He.get(m);return y?.isConnected||(y=document.querySelector(m)??void 0,y&&He.set(m,y)),y??null}function wt(){if(De.length=0,Ae(Ze(".site-header")),Ae(Ze(".tunnel-wayfinder")),o.active<0)Ae(Ze(".tunnel-hero-copy")),Ae(Ze(".tunnel-hero-caption"));else for(const m of Xe.values())m.attached&&Number(m.binding.element.style.opacity)>.001&&Ae(m.binding.element);O.setTelemetryProtection(De)}function Et(){if(o.active<4)return;const m=qa().saved.flatMap(X=>{const W=Ha.find(Me=>Me.id===X&&Me.status==="available");return W?[W.poster]:[]}).slice(0,3),y=m.join("|");y!==S&&(S=y,O.setCollection(m),q())}function et(){Ve.setSuspended("passage-scene-route",c.room!=="atrium"),Ve.setSuspended("passage-scene-paused",c.paused),Ve.setSuspended("passage-scene-reduced",c.reducedMotion),ee()}function dt(){const m=Ve.getSnapshot(),y=Rn.findIndex(W=>W.chapterId===m.chapterId),X=m.ready&&o.active>=0&&!p&&!T&&!c.reducedMotion&&c.room==="atrium";(!X||m.sourceEpoch!==$||B!==y)&&(B>=0&&O.setActiveTexture(B,null),G?.dispose(),G=null,$=-1,B=-1),X&&!G&&y>=0&&(G=new Ea(Ve.getVideo()),G.colorSpace=cn,G.minFilter=$t,G.magFilter=$t,G.generateMipmaps=!1,$=m.sourceEpoch,B=y,O.setActiveTexture(y,G))}function pt(){if(g)return;const m=r,y=s,X=C,W=e.getBoundingClientRect();r=Math.max(1,W.width),s=Math.max(1,W.height),T=_a(r,s,c.reducedMotion),T&&(F.reset(),M.reset(),me=!1,we=0,ue=0),l()||(ze=!1,ie.reset()),C=Math.max(.8,Math.min(devicePixelRatio||1,T||a.quality==="light"?1:1.4)-R),(r!==m||s!==y||C!==X)&&u.setDrawingBufferSize(r,s,C),(r!==m||s!==y)&&Oe.setSize(r,s),J.aspect=r/s,J.updateProjectionMatrix(),ne.configure(s,C,T,a.quality,Math.min(45,a.light)),ae.configure(r,s,T,a.quality),Ee(),dt(),q()}function t(m){if(E=0,g||p||c.paused||document.hidden)return;if(!Q.ready(m)){q();return}const y=D===0,X=D?m-D:16.7,W=Math.min(X/1e3,.05);D=m;const Me=c.room==="atrium";Me&&l()&&!i.expanded&&(v+=W),X<90&&(d=rt.lerp(d,X,.025),z++),z>180&&d>25&&R<.3&&(R+=.15,z=0,d=16.7,pt());let Be=null;if(x){const zt=Xt((m-x.start)/x.duration,0,1),Tn=ko(zt);J.position.lerpVectors(x.from,x.to,Tn),de.lerpVectors(x.fromLook,x.toLook,Tn),zt===1&&!x.settled&&(x.settled=!0,Be=x.done,x.done=null)}else{const zt=Hn(o);J.position.set(...zt.position),de.set(...zt.target),J.fov!==zt.fov&&(J.fov=zt.fov,J.updateProjectionMatrix())}J.lookAt(de),J.updateMatrixWorld();const Ke=1-Math.exp(-W*10);_[0]+=(P[0]-_[0])*Ke,_[1]+=(P[1]-_[1])*Ke,y&&(K=J.position.z,te=0),te+=(Math.min(1,Math.abs(J.position.z-K)/Math.max(W,1/120)/45)-te)*(1-Math.exp(-W*7)),K=J.position.z;const It=gt[Math.max(0,o.active)],vt=sn(o);pe+=(Number(vt)-pe)*(1-Math.exp(-W*3.5));const lt=qn(v,c.reducedMotion||T,pe);h.intensity=1.5*lt.breath,L.intensity=30*lt.breath,U.intensity=14*lt.signal,h.position.copy(J.position),h.position.x-=5,h.position.y+=9,h.position.z-=7,h.target.position.copy(de),L.position.copy(de),L.position.x+=3+lt.drift*.24,L.position.y+=2,L.position.z+=5,U.position.copy(de),U.position.x+=7,U.position.y-=2,U.position.z-=5,j.environmentIntensity=.65+a.light*.003,j.environmentRotation.y=.24+lt.drift*.035,st.setActive(Me&&o.active===3&&Ve.getSnapshot().ready&&!T&&!c.reducedMotion&&!c.paused);const Ct=st.sample();ge.step(o,W,c.reducedMotion||T,i.expanded||!!x),O.update({active:o.active,progress:o.progress,elapsed:v,delta:W,reducedMotion:c.reducedMotion||T,compact:T,quality:a.quality,inspection:i,pointer:_,pointerActive:oe&&!me,cameraZ:J.position.z,energy:te,audio:Ct,assemblies:ge.poses,assemblyAges:ge.ages}),e.dataset.passageAudioEnergy=Ct.rms.toFixed(4);const Qe=Me&&!T&&!c.reducedMotion;Qe&&!i.expanded&&M.advance(W),F.tick(m,b())&&(M.trigger(J.position.z),k++);const Wt=Qe&&o.active<0;Wt&&b()&&!document.querySelector("dialog[open]")&&(we+=W),Ja(Wt?we:0,I),We.setExploded(I.open),We.setSelectedPart(I.part),We.setPartPull(I.pull),Te.time=v,Te.delta=i.expanded?0:W,Te.cameraZ=J.position.z,Te.active=o.active,Te.progress=o.progress,Te.energy=te,Te.compact=T||!Me,Te.reducedMotion=c.reducedMotion,Te.inspection=i.expanded,Te.quality=a.quality,Pe.update(Te),We.update(Te),ce(),!T&&!c.reducedMotion&&Oe.render(ot,J),wt(),Ge();const yt=$a(),hn=(P[0]+1)*r/2,vn=(1-P[1])*s/2,aa=!!yt&&hn>=yt.left&&hn<=yt.right&&vn>=yt.top&&vn<=yt.bottom,oa=oe&&N(hn,vn);ne.points.visible=Me&&!T&&!c.reducedMotion,ne.points.visible&&!i.expanded&&ne.update(v,W,!1,te,M.value);const bt=!l();bt?ie.reset():Me&&!i.expanded&&ie.step(W,ze?P[0]:0,ze?P[1]:0),ae.setParallax(ie.state.x,ie.state.y,ie.state.vx,ie.state.vy),Me&&!bt&&!i.expanded&&(re+=W*te*.5),Z.dataset.wormholeTime=(bt?0:v).toFixed(3),Z.dataset.wormholeEnergy=te.toFixed(3),Z.dataset.wormholeMode=bt?"still":"flow",Z.dataset.wormholePointer=bt||!oe?"0,0":_.join(","),dt(),Y.length=0,yt&&(he.left=yt.left/r,he.top=yt.top/s,he.right=yt.right/r,he.bottom=yt.bottom/s,Y.push(he)),le.length=0;for(const zt of De)le.push(zt);yt&&le.push(he),ae.mesh.visible=Me,ae.setCamera(J),ae.setProtectedRects(le);const ia=oe&&!T&&!aa&&!oa&&!i.expanded&&!bt?1:0;ue=bt?0:ue+(ia-ue)*(1-Math.exp(-W*9)),ae.update(bt?0:v,bt?0:re,te,_,ue,pe,bt),Z.dataset.wormholeDraws="2",fe.render(j,J,{enabled:Me&&!T&&!c.reducedMotion&&a.quality!=="light"&&R<.3,strength:vt?.16:.24,lens:vt||i.expanded?0:.25+te*.35,protectedRects:Y}),Z.dataset.cinematicBreath=lt.breath.toFixed(4),e.dataset.passageChapter=o.active<0?"entrance":It.id,e.dataset.passageReading=String(sn(o)),e.dataset.passageDrawCalls=String(u.info.render.calls),e.dataset.passageLife=Qe?"active":"off",e.dataset.passageRelayOpen=String(I.open),e.dataset.passageRelayPart=String(I.part??""),e.dataset.passageRelayPhase=I.phase.toFixed(3),e.dataset.passageSignal=String(k),f||(f=!0,n.onProject?.([]),n.onReady()),Be?.(),(Me&&l()||x&&!x.settled)&&q()}function w(){x&&(x.done=null),x=null,q()}function b(){return!g&&!p&&c.room==="atrium"&&!c.paused&&!c.reducedMotion&&!T&&!i.expanded&&!x}function A(m){return m instanceof Element&&!!m.closest('button,a,video,input,select,textarea,dialog,[role="dialog"],.tunnel-panel,.tunnel-wayfinder,.tunnel-hero-copy,.tunnel-hero-caption,.tunnel-hero-bottom,header')}function N(m,y){if(document.querySelector("dialog[open]"))return!0;try{if(document.querySelector(":popover-open"))return!0}catch{}return A(document.elementFromPoint(m,y))?!0:o.active<0&&Array.from(document.querySelectorAll(".tunnel-hero-copy,.tunnel-hero-caption,.tunnel-hero-bottom")).some(X=>{const W=X.getBoundingClientRect();return m>=W.left&&m<=W.right&&y>=W.top&&y<=W.bottom})}function V(m){if(!(c.room!=="atrium"||c.paused||c.reducedMotion||i.expanded)&&(oe=!T&&m.pointerType==="mouse"&&m.buttons===0,ze=m.pointerType==="mouse",P[0]=m.clientX/r*2-1,P[1]=1-m.clientY/s*2,!T)){if(A(m.target)){ne.input.leave();return}ne.input.move(P[0],P[1],m.timeStamp,m.pointerType==="touch")}}function se(m){oe=!1,me=!1,!(m.button!==0||!b()||A(m.target))&&(ne.input.press(),me=!0)}function Le(m){ne.input.release(),me=!1,V(m)}function be(){oe=!1,ze=!1,ne.input.leave(),q()}function ve(){q()}function Fe(){ne.input.reset(),oe=!1,me=!1,ze=!1,P[0]=P[1]=0}function Re(){D=0,Q.reset(),F.reset(),Fe(),document.hidden?(an(E),E=0):q()}function mt(m){m.preventDefault(),p=!0,F.reset(),an(E),E=0;const y=x?.done;x=null,Xe.forEach(Se),Oe.domElement.style.display="none",qt(null),n.onUnavailable(),y?.()}const H=Da(m=>{o=m,et(),q()}),Ye=ka(qe),nt=Ua(m=>{i=m,Fe(),q()}),Ue=La(()=>{const m=a;a=Ln(),m.quality!==a.quality&&(R=0),pt()}),ft=Ve.subscribe(()=>{dt(),q()}),ht=Wa(Et),tt=new ResizeObserver(pt);return tt.observe(e),ye.addEventListener("change",pt),document.addEventListener("visibilitychange",Re),document.addEventListener("pointerleave",be),window.addEventListener("scroll",ve,{passive:!0}),window.addEventListener("pointermove",V,{passive:!0}),window.addEventListener("pointerdown",se,{passive:!0}),window.addEventListener("pointerup",Le,{passive:!0}),window.addEventListener("pointercancel",Fe,{passive:!0}),window.addEventListener("blur",Fe),Z.addEventListener("webglcontextlost",mt),pt(),qe(Va()),et(),{setState(m){if(g)return;let y=null;m.reducedMotion&&!c.reducedMotion&&x&&!x.settled&&!m.paused&&m.room===c.room&&(y=x.done,x.done=null),(m.paused||m.room!==c.room||m.entered!==c.entered||m.reducedMotion!==c.reducedMotion)&&(x&&(x.done=null),x=null),c={...m},(c.paused||c.reducedMotion||c.room!=="atrium")&&(F.reset(),st.setActive(!1)),c.room!=="atrium"&&(qt(null),M.reset(),Fe()),et(),m.paused?(Fe(),an(E),E=0):(Q.reset(),D=0,pt()),y?.()},setFocus(){q()},setScroll(){c.room==="atrium"&&q()},rotate(){q()},travelTo(m,y,X=1100){const W=gt.findIndex(Be=>Be.id===m);if(g)return;if(m!=="atrium"&&W<0||c.reducedMotion||T||p||!f||c.paused){w(),y();return}x&&(x.done=null);const Me=de.clone().sub(J.position).normalize();x={from:J.position.clone(),to:J.position.clone().addScaledVector(Me,3),fromLook:de.clone(),toLook:de.clone().addScaledVector(Me,3),start:performance.now(),duration:Math.max(1,X),done:y,settled:!1},Fe(),q()},cancelTravel:w,destroy(){g||(g=!0,x&&(x.done=null),x=null,qt(null),an(E),tt.disconnect(),Tt.disconnect(),H(),Ye(),nt(),Ue(),ft(),ht(),Xe.forEach(Se),Xe.clear(),document.removeEventListener("visibilitychange",Re),document.removeEventListener("pointerleave",be),window.removeEventListener("scroll",ve),window.removeEventListener("pointermove",V),window.removeEventListener("pointerdown",se),window.removeEventListener("pointerup",Le),window.removeEventListener("pointercancel",Fe),window.removeEventListener("blur",Fe),Z.removeEventListener("webglcontextlost",mt),ye.removeEventListener("change",pt),G?.dispose(),O.destroy(),ae.dispose(),ne.dispose(),Pe.destroy(),We.destroy(),F.reset(),M.reset(),it.dispose(),st.destroy(),Ve.setSuspended("passage-scene-route",!1),Ve.setSuspended("passage-scene-paused",!1),Ve.setSuspended("passage-scene-reduced",!1),Je.release(),fe.dispose(),j.clear(),ot.clear(),u.dispose(),u.forceContextLoss(),Z.remove(),Oe.domElement.remove())}}}export{Ho as createTunnelScene};
