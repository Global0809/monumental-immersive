import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCinematicMaterials } from '../../services/cinematicMaterials';
import { createCinematicRenderer } from '../../services/cinematicRenderer';
import { sampleCinematicLight } from '../../services/cinematicLight';
import { getSpatialPreferences } from '../../services/spatialPreferences';
import { getViewer } from '../../services/viewer';
export type LabSettings={twist:number;spacing:number;resonance:number;wire:boolean;animate:boolean};
export type LabController={set:(settings:LabSettings)=>void;turn:(amount:number)=>void;destroy:()=>void};
export function createKineticScene(host:HTMLElement,initial:LabSettings,onReady:()=>void,onError:()=>void):LabController{
  let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{onError();return {set(){},turn(){},destroy(){}};}
  host.appendChild(renderer.domElement);const canvas=renderer.domElement;canvas.style.touchAction='pan-y';
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
  const cinematic=createCinematicRenderer(renderer),surfaceFinish=createCinematicMaterials();
  const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,40);camera.position.set(0,1.1,10.5);camera.lookAt(0,0,0);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  const geometry=new THREE.TorusGeometry(1.75,.085,12,100),material=new THREE.MeshStandardMaterial({color:0xb3bbb8,metalness:1,roughness:.12,envMapIntensity:.8}),accent=new THREE.MeshBasicMaterial({color:0xff4d32}),group=new THREE.Group();scene.add(group);
  surfaceFinish.apply(material,'metal',.55);
  const rings=Array.from({length:13},(_,i)=>{const mesh=new THREE.Mesh(geometry,i===6?accent:material);group.add(mesh);return mesh;});
  scene.add(new THREE.HemisphereLight(0xffffff,0x080909,.4));const light=new THREE.DirectionalLight(0xffffff,1.3);light.position.set(-3,5,4);scene.add(light);
  let settings={...initial},frame=0,disposed=false,visible=true,lost=false,time=0,last=0,angle=.4,tilt=.15,drag:{x:number;y:number;id:number}|null=null;
  const wake=()=>{if(!disposed&&!lost&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);};
  function draw(now:number){
    frame=0;if(disposed||lost||!visible||document.hidden)return;
    const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
    const reduced=getViewer().reducedMotion||motionPreference.matches;
    if(settings.animate&&!reduced)time+=dt;
    const illumination=sampleCinematicLight(time,reduced);
    light.intensity=1.3*illumination.breath;light.position.x=-3+illumination.drift*.2;
    group.rotation.set(tilt,angle+time*.12,0);
    rings.forEach((ring,i)=>{const u=(i-6)/6;ring.position.y=u*(.3+settings.spacing*.021);ring.rotation.set(Math.PI/2+u*settings.twist*.018,u*settings.twist*.012+Math.sin(time+u*3)*settings.resonance*.004,0);const scale=1-Math.abs(u)*.16+Math.sin(time*1.2+u*4)*settings.resonance*.00065;ring.scale.setScalar(scale);});
    material.wireframe=settings.wire;
    cinematic.render(scene,camera,{enabled:!reduced&&window.innerWidth>=980&&window.innerHeight>=660&&getSpatialPreferences().quality!=='light',strength:.1,lens:0});
    if(settings.animate&&!reduced)wake();
  }
  const resize=()=>{const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();wake();};
  const down=(e:PointerEvent)=>{if(e.button===0)drag={x:e.clientX,y:e.clientY,id:e.pointerId};};
  const move=(e:PointerEvent)=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(e.pointerType==='touch'&&Math.abs(dy)>Math.abs(dx)&&!canvas.hasPointerCapture(e.pointerId))return;if(Math.abs(dx)>4&&!canvas.hasPointerCapture(e.pointerId))canvas.setPointerCapture(e.pointerId);if(!canvas.hasPointerCapture(e.pointerId))return;angle+=dx*.008;tilt=THREE.MathUtils.clamp(tilt+dy*.003,-.6,.6);drag={x:e.clientX,y:e.clientY,id:e.pointerId};wake();};
  const up=(e:PointerEvent)=>{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);drag=null;};
  const visibility=()=>{last=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();};
  const contextLost=(e:Event)=>{e.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;onError();};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('webglcontextlost',contextLost);document.addEventListener('visibilitychange',visibility);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);const observer=new IntersectionObserver(([e])=>{visible=e.isIntersecting;last=0;if(visible)wake();else{cancelAnimationFrame(frame);frame=0;}});observer.observe(host);resize();onReady();
  return {set(next){settings={...next};wake();},turn(amount){angle+=amount;wake();},destroy(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();resizeObserver.disconnect();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('webglcontextlost',contextLost);cinematic.dispose();surfaceFinish.dispose();geometry.dispose();material.dispose();accent.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
}
