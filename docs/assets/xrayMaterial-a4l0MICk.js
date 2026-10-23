import{r as i}from"./reactiveField-CI8632qh.js";import{Vector2 as D,ShaderMaterial as F,EdgesGeometry as V,WireframeGeometry as K,BufferGeometry as W,BufferAttribute as j,LineSegments as O}from"./three-Dcbj-bkz.js";const m=170,k=28;function B(a){return!!(a.map?.isVideoTexture||a.userData.xrayExcluded)}function X(a,S,z){const g={value:new D(-1e4,-1e4)},v={value:0},p={value:a.getPixelRatio()},R=`uniform vec2 scanCursor; uniform float scanRadius; uniform float scanPixelRatio;
`,P=`float scanDistance = distance(gl_FragCoord.xy, scanCursor) / max(1.0, scanRadius);
    float scan = (1.0 - smoothstep(.28, 1.0, scanDistance)) * step(1.0, scanRadius);`,b=[...new Set(S)].filter(e=>!B(e)).map(e=>({m:e,compile:e.onBeforeCompile,key:e.customProgramCacheKey,programKey:e.customProgramCacheKey()}));b.forEach(({m:e,compile:o,programKey:n})=>{e.onBeforeCompile=(t,r)=>{o.call(e,t,r),t.uniforms.scanCursor=g,t.uniforms.scanRadius=v,t.uniforms.scanPixelRatio=p,t.vertexShader=`varying vec3 vScanPosition;
`+t.vertexShader,t.vertexShader=t.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
 vScanPosition = transformed;`),t.fragmentShader=R+`varying vec3 vScanPosition;
`+t.fragmentShader,t.fragmentShader=t.fragmentShader.replace("#include <opaque_fragment>",`${P}
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
        #include <opaque_fragment>`)},e.customProgramCacheKey=()=>`${n}|monumental-scan-v2`,e.needsUpdate=!0});const C=[...new Set(z)].filter(e=>{const o=Array.isArray(e.material)?e.material:[e.material];return!e.userData.xrayExcluded&&!o.some(B)}).slice(0,k),u=Math.min(1600,Math.floor(14e3/Math.max(1,C.length))),y=new Map,E=new F({transparent:!0,depthWrite:!1,depthTest:!0,toneMapped:!1,uniforms:{scanCursor:g,scanRadius:v,scanPixelRatio:p},vertexShader:"void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",fragmentShader:R+`void main(){${P}
      if(scan < .015) discard;
      vec3 tint = mix(vec3(.98,.20,.09), vec3(1.0,.78,.64), scan * .32);
      gl_FragColor = vec4(tint, scan * .40);
    }`}),A=C.map(e=>{let o=y.get(e.geometry);if(!o){const t=e.geometry.getAttribute("position").count<=48?new V(e.geometry,16):new K(e.geometry),r=t.getAttribute("position"),_=r.count/2;if(_>u){const d=new Float32Array(u*6);for(let f=0;f<u;f++){const h=Math.floor(f*_/u)*2;for(let c=0;c<2;c++){const w=f*6+c*3;d[w]=r.getX(h+c),d[w+1]=r.getY(h+c),d[w+2]=r.getZ(h+c)}}o=new W,o.setAttribute("position",new j(d,3)),t.dispose()}else o=t;y.set(e.geometry,o)}const n=new O(o,E);return n.renderOrder=4,n.raycast=()=>{},n.visible=!1,e.add(n),n});let x=!0,s=a.domElement.getBoundingClientRect(),L=!1;const l=()=>{x=!0},M=new ResizeObserver(l);return M.observe(a.domElement),window.addEventListener("scroll",l,{passive:!0}),window.addEventListener("resize",l,{passive:!0}),{update(e=!0){x&&(s=a.domElement.getBoundingClientRect(),x=!1);const o=a.getPixelRatio(),n=i.x>s.left-m&&i.x<s.right+m&&i.y>s.top-m&&i.y<s.bottom+m,t=e&&n&&i.active&&!i.reduced&&!i.blocked;g.value.set((i.x-s.left)*o,(s.bottom-i.y)*o),p.value=o,v.value=t?m*o:0,t!==L&&(A.forEach(r=>{r.visible=t}),L=t)},dispose(){M.disconnect(),window.removeEventListener("scroll",l),window.removeEventListener("resize",l),A.forEach(e=>e.removeFromParent()),y.forEach(e=>e.dispose()),E.dispose(),b.forEach(({m:e,compile:o,key:n})=>{e.onBeforeCompile=o,e.customProgramCacheKey=n,e.needsUpdate=!0})}}}export{X as attachXray};
