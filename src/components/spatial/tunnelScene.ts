import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { createFrameCadence } from '../../services/frameCadence';
import { requestVisualFrame, cancelVisualFrame } from '../../services/visualFrame';
import { getSpatialPreferences, subscribeSpatialPreferences } from '../../services/spatialPreferences';
import { getTunnelFrame, getTunnelPanels, getTunnelInspection, subscribeTunnelFrame, subscribeTunnelPanels, subscribeTunnelInspection, tunnelCompact, type TunnelPanelBinding } from '../../services/tunnelJourney';
import { PASSAGE_CHAPTERS, passageLocalToWorld } from '../../services/passageChapters';
import { passagePose, passageContentOpacity } from '../../services/passageJourney';
import { acquirePassageMedia, PASSAGE_MEDIA } from '../../services/passageMedia';
import { getViewer, subscribeViewer } from '../../services/viewer';
import { videos } from '../../data/catalogue';
import { createPassageArchitecture } from './passageArchitecture';
import { createAtmosphere } from './atmosphere';
import { cameraEase } from './cameraPath';
import type { SpatialSceneController, SpatialSceneOptions, SpatialSceneState } from './scene';

type Panel={binding:TunnelPanelBinding;object:CSS3DObject;attached:boolean;style:string|null;inert:boolean;aria:string|null;transform:string};
type Travel={from:THREE.Vector3;to:THREE.Vector3;fromLook:THREE.Vector3;toLook:THREE.Vector3;start:number;duration:number;done:(()=>void)|null;settled:boolean};
const clamp=THREE.MathUtils.clamp;

/** One authored camera renders the building and its single accessible DOM.
 * Rooms use local coordinates; visibility and activation use journey progress. */
export function createTunnelScene(host:HTMLElement,options:SpatialSceneOptions):SpatialSceneController {
  let renderer:THREE.WebGLRenderer;
  try { renderer=new THREE.WebGLRenderer({alpha:false,antialias:innerWidth>=980,powerPreference:'high-performance'}); }
  catch { options.onUnavailable();return {setState(){},setFocus(){},setScroll(){},rotate(){},travelTo(_id,done){done();},cancelTravel(){},destroy(){}}; }
  let disposed=false,unavailable=false,ready=false;
  let state:SpatialSceneState={entered:false,room:'atrium',paused:false,reducedMotion:options.reducedMotion};
  let frame=getTunnelFrame(),inspection=getTunnelInspection(),preferences=getSpatialPreferences();
  let width=1,height=1,compact=false,ratio=1,request=0,lastTime=0,elapsed=0;
  let average=16.7,samples=0,reduction=0,travel:Travel|null=null;
  let activeTexture:THREE.VideoTexture|null=null,textureEpoch=-1,textureChapter=-1;
  const cadence=createFrameCadence(),canvas=renderer.domElement;
  canvas.className='spatial-world-canvas';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{width:'100%',height:'100%',display:'block',touchAction:'pan-y',pointerEvents:'none'});host.appendChild(canvas);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
  renderer.setClearColor(0x080909,1);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x080909);scene.fog=new THREE.FogExp2(0x080909,.009);
  const camera=new THREE.PerspectiveCamera(46,1,.16,100),look=new THREE.Vector3();
  const cssScene=new THREE.Scene(),css=new CSS3DRenderer();
  css.domElement.className='tunnel-css-world';
  Object.assign(css.domElement.style,{position:'fixed',inset:'0',pointerEvents:'none',overflow:'clip',zIndex:'1'});
  (document.getElementById('main')||host).appendChild(css.domElement);
  const roomEnvironment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(roomEnvironment,.025);roomEnvironment.dispose();pmrem.dispose();
  scene.environment=environment.texture;scene.environmentIntensity=.9;
  const hemisphere=new THREE.HemisphereLight(0xeee9df,0x171c1c,.7);scene.add(hemisphere);
  const key=new THREE.DirectionalLight(0xffeee0,1.4);key.position.set(-5,9,12);scene.add(key,key.target);
  const fill=new THREE.PointLight(0xe5edf0,35,32,2),accent=new THREE.PointLight(0xff4d32,11,24,2);scene.add(fill,accent);
  const architecture=createPassageArchitecture(scene,wake);
  const atmosphere=createAtmosphere();scene.add(atmosphere.points);
  const mediaLease=acquirePassageMedia(),media=mediaLease.controller;
  const panels=new Map<string,Panel>(),loadedPosters=new Set<number>();
  let collectionKey='';

  function wake(){if(!request&&!disposed&&!unavailable&&!state.paused&&!document.hidden)request=requestVisualFrame(render);}
  function restorePanel(panel:Panel){
    const el=panel.binding.element;
    if(panel.attached){panel.transform=el.style.transform;cssScene.remove(panel.object);panel.binding.fallback.appendChild(el);}
    if(panel.style===null)el.removeAttribute('style');else el.setAttribute('style',panel.style);
    el.inert=panel.inert;if(panel.aria===null)el.removeAttribute('aria-hidden');else el.setAttribute('aria-hidden',panel.aria);
    el.removeAttribute('data-tunnel-mounted');panel.attached=false;
  }
  function syncPanels(){
    const spatial=!compact&&!unavailable&&!state.reducedMotion;
    for(const panel of panels.values()){
      if(!spatial){if(panel.attached)restorePanel(panel);continue;}
      if(panel.attached)continue;
      const spec=PASSAGE_CHAPTERS[panel.binding.index],el=panel.binding.element;
      el.dataset.tunnelMounted='true';
      Object.assign(el.style,{position:'absolute',pointerEvents:'auto',userSelect:'text',width:`${spec.panel.width}px`});
      if(panel.transform)el.style.transform=panel.transform;
      panel.object.scale.setScalar(spec.panel.scale);
      panel.object.position.set(...passageLocalToWorld(spec,spec.panel.position));panel.object.rotation.y=spec.yaw;
      cssScene.add(panel.object);panel.attached=true;
    }
    css.domElement.style.display=spatial?'':'none';
  }
  function registerPanels(bindings:TunnelPanelBinding[]){
    for(const [id,panel] of panels)if(!bindings.some(b=>b.id===id&&b.element===panel.binding.element)){restorePanel(panel);panels.delete(id);}
    for(const binding of bindings){
      if(panels.has(binding.id))continue;
      const el=binding.element,original={style:el.getAttribute('style'),inert:el.inert,aria:el.getAttribute('aria-hidden')};
      const panel={binding,object:new CSS3DObject(el),attached:false,transform:'',...original};panels.set(binding.id,panel);
      if(compact||state.reducedMotion)restorePanel(panel);
    }
    syncPanels();wake();
  }
  function updatePanels(){
    if(state.paused||compact||unavailable)return;
    for(const panel of panels.values()){
      if(!panel.attached)continue;
      const opacity=state.room==='atrium'?passageContentOpacity(panel.binding.index,frame):0;
      const readable=opacity>.55&&!travel&&document.documentElement.dataset.spatialPassage!=='departing';
      const el=panel.binding.element;el.style.visibility=opacity>.001?'visible':'hidden';el.style.opacity=String(opacity);
      if(el.inert!==!readable)el.inert=!readable;
      const aria=String(!readable);if(el.getAttribute('aria-hidden')!==aria)el.setAttribute('aria-hidden',aria);
    }
  }
  function preparePosters(){
    const active=Math.max(0,frame.active);
    for(let i=Math.max(0,active-1);i<=Math.min(5,active+1);i++)if(!loadedPosters.has(i)){
      loadedPosters.add(i);architecture.setPoster(i,PASSAGE_MEDIA[i].poster);
    }
    if(active>=4)syncCollection();
  }
  function syncCollection(){
    if(frame.active<4)return;
    const posters=getViewer().saved.flatMap(id=>{const film=videos.find(item=>item.id===id&&item.status==='available');return film?[film.poster]:[];}).slice(0,3);
    const next=posters.join('|');if(next===collectionKey)return;collectionKey=next;architecture.setCollection(posters);wake();
  }
  function syncMedia(){
    media.setSuspended('passage-scene-route',state.room!=='atrium');
    media.setSuspended('passage-scene-paused',state.paused);
    media.setSuspended('passage-scene-reduced',state.reducedMotion);
    preparePosters();
  }
  function updateMediaTexture(){
    const snapshot=media.getSnapshot(),index=PASSAGE_MEDIA.findIndex(m=>m.chapterId===snapshot.chapterId);
    const canShow=snapshot.ready&&frame.active>=0&&!unavailable&&!compact&&!state.reducedMotion&&state.room==='atrium';
    if(!canShow||snapshot.sourceEpoch!==textureEpoch||textureChapter!==index){
      if(textureChapter>=0)architecture.setActiveTexture(textureChapter,null);
      activeTexture?.dispose();activeTexture=null;textureEpoch=-1;textureChapter=-1;
    }
    if(canShow&&!activeTexture&&index>=0){
      activeTexture=new THREE.VideoTexture(media.getVideo());activeTexture.colorSpace=THREE.SRGBColorSpace;
      activeTexture.minFilter=THREE.LinearFilter;activeTexture.magFilter=THREE.LinearFilter;activeTexture.generateMipmaps=false;
      textureEpoch=snapshot.sourceEpoch;textureChapter=index;architecture.setActiveTexture(index,activeTexture);
    }
  }
  function resize(){
    if(disposed)return;
    const bounds=host.getBoundingClientRect();width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);
    compact=tunnelCompact(width,height,state.reducedMotion);
    ratio=Math.max(.8,Math.min(devicePixelRatio||1,compact?1:preferences.quality==='light'?1:1.4)-reduction);
    renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);css.setSize(width,height);
    camera.aspect=width/height;camera.updateProjectionMatrix();
    atmosphere.configure(height,ratio,compact,preferences.quality,Math.min(45,preferences.light));
    syncPanels();updateMediaTexture();wake();
  }
  function render(time:number){
    request=0;if(disposed||unavailable||state.paused||document.hidden)return;
    if(!cadence.ready(time)){wake();return;}
    const raw=lastTime?time-lastTime:16.7,dt=Math.min(raw/1000,.05);lastTime=time;
    const inPassage=state.room==='atrium';
    if(inPassage&&!state.reducedMotion&&!inspection.expanded)elapsed+=dt;
    if(raw<90){average=THREE.MathUtils.lerp(average,raw,.025);samples++;}
    if(samples>180&&average>25&&reduction<.3){reduction+=.15;samples=0;average=16.7;resize();}
    let done:(()=>void)|null=null;
    if(travel){
      const t=clamp((time-travel.start)/travel.duration,0,1),ease=cameraEase(t);
      camera.position.lerpVectors(travel.from,travel.to,ease);look.lerpVectors(travel.fromLook,travel.toLook,ease);
      if(t===1&&!travel.settled){travel.settled=true;done=travel.done;travel.done=null;}
    }else{
      const pose=passagePose(frame);camera.position.set(...pose.position);look.set(...pose.target);
      if(camera.fov!==pose.fov){camera.fov=pose.fov;camera.updateProjectionMatrix();}
    }
    camera.lookAt(look);camera.updateMatrixWorld();
    const chapter=PASSAGE_CHAPTERS[Math.max(0,frame.active)];
    key.position.copy(camera.position);key.position.x-=5;key.position.y+=9;key.position.z-=7;key.target.position.copy(look);
    fill.position.copy(look);fill.position.x+=3;fill.position.y+=2;fill.position.z+=5;
    accent.position.copy(look);accent.position.x+=7;accent.position.y-=2;accent.position.z-=5;
    scene.environmentIntensity=preferences.cutaway?.95:.4+preferences.light*.003;
    architecture.update({active:frame.active,progress:frame.progress,elapsed,delta:dt,reducedMotion:state.reducedMotion||compact,inspection});
    atmosphere.points.position.set(...passageLocalToWorld(chapter,[0,-3,0]));atmosphere.points.rotation.y=chapter.yaw;
    atmosphere.points.visible=inPassage&&!compact&&!state.reducedMotion;
    if(atmosphere.points.visible&&!inspection.expanded)atmosphere.update(elapsed,dt,false);
    updateMediaTexture();updatePanels();renderer.render(scene,camera);
    if(!compact&&!state.reducedMotion)css.render(cssScene,camera);
    host.dataset.passageChapter=frame.active<0?'entrance':chapter.id;
    host.dataset.passageReading=String(frame.active>=0&&frame.progress>=.38&&(frame.progress<=.74||frame.active===5));
    host.dataset.passageDrawCalls=String(renderer.info.render.calls);
    if(!ready){ready=true;options.onProject?.([]);options.onReady();}
    done?.();
    if((inPassage&&!compact&&!state.reducedMotion)||(travel&&!travel.settled))wake();
  }
  function cancelTravel(){if(travel)travel.done=null;travel=null;wake();}
  function pointerMove(event:PointerEvent){
    if(state.room!=='atrium'||state.paused||state.reducedMotion||compact||inspection.expanded)return;
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest('button,a,video,input,select,textarea,[role="dialog"]')){atmosphere.input.leave();return;}
    atmosphere.input.move(event.clientX/width*2-1,1-event.clientY/height*2,event.timeStamp,event.pointerType==='touch');
  }
  function resetPointer(){atmosphere.input.reset();}
  function visibility(){lastTime=0;cadence.reset();resetPointer();if(document.hidden){cancelVisualFrame(request);request=0;}else wake();}
  function contextLost(event:Event){
    event.preventDefault();unavailable=true;cancelVisualFrame(request);request=0;
    const done=travel?.done;travel=null;panels.forEach(restorePanel);css.domElement.style.display='none';
    options.onUnavailable();done?.();
  }
  const offFrame=subscribeTunnelFrame(next=>{frame=next;syncMedia();wake();});
  const offPanels=subscribeTunnelPanels(registerPanels);
  const offInspection=subscribeTunnelInspection(next=>{inspection=next;resetPointer();wake();});
  const offPreferences=subscribeSpatialPreferences(()=>{const prev=preferences;preferences=getSpatialPreferences();if(prev.quality!==preferences.quality)reduction=0;resize();});
  const offMedia=media.subscribe(()=>{updateMediaTexture();wake();});
  const offViewer=subscribeViewer(syncCollection);
  const observer=new ResizeObserver(resize);observer.observe(host);
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pointermove',pointerMove,{passive:true});window.addEventListener('blur',resetPointer);
  canvas.addEventListener('webglcontextlost',contextLost);
  resize();registerPanels(getTunnelPanels());syncMedia();

  return {
    setState(next){
      if(disposed)return;
      let finish:(()=>void)|null=null;
      if(next.reducedMotion&&!state.reducedMotion&&travel&&!travel.settled&&!next.paused&&next.room===state.room){finish=travel.done;travel.done=null;}
      if(next.paused||next.room!==state.room||next.entered!==state.entered||next.reducedMotion!==state.reducedMotion){if(travel)travel.done=null;travel=null;}
      state={...next};syncMedia();
      if(next.paused){cancelVisualFrame(request);request=0;}else{cadence.reset();lastTime=0;resize();}
      finish?.();
    },
    setFocus(){wake();},setScroll(){if(state.room==='atrium')wake();},rotate(){wake();},
    travelTo(id,done,duration=1100){
      const index=PASSAGE_CHAPTERS.findIndex(c=>c.id===id);
      if(disposed)return;
      if((id!=='atrium'&&index<0)||state.reducedMotion||compact||unavailable||!ready||state.paused){cancelTravel();done();return;}
      if(travel)travel.done=null;
      // A short forward departure preserves the current composition. Returning
      // to the Passage always uses its restored native scroll pose.
      const forward=look.clone().sub(camera.position).normalize();
      travel={from:camera.position.clone(),to:camera.position.clone().addScaledVector(forward,3),fromLook:look.clone(),toLook:look.clone().addScaledVector(forward,3),
        start:performance.now(),duration:Math.max(1,duration),done,settled:false};resetPointer();wake();
    },cancelTravel,
    destroy(){
      if(disposed)return;disposed=true;if(travel)travel.done=null;travel=null;
      cancelVisualFrame(request);observer.disconnect();offFrame();offPanels();offInspection();offPreferences();offMedia();offViewer();
      panels.forEach(restorePanel);panels.clear();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pointermove',pointerMove);window.removeEventListener('blur',resetPointer);
      canvas.removeEventListener('webglcontextlost',contextLost);
      activeTexture?.dispose();architecture.destroy();atmosphere.dispose();environment.dispose();
      media.setSuspended('passage-scene-route',false);media.setSuspended('passage-scene-paused',false);media.setSuspended('passage-scene-reduced',false);mediaLease.release();
      scene.clear();cssScene.clear();renderer.dispose();renderer.forceContextLoss();canvas.remove();css.domElement.remove();
    },
  };
}
