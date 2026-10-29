import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { createFrameCadence } from '../../services/frameCadence';
import { requestVisualFrame, cancelVisualFrame } from '../../services/visualFrame';
import { createCinematicRenderer } from '../../services/cinematicRenderer';
import { sampleCinematicLight, type CinematicRect } from '../../services/cinematicLight';
import { getSpatialPreferences, subscribeSpatialPreferences } from '../../services/spatialPreferences';
import { getTunnelFrame, getTunnelPanels, getTunnelInspection, subscribeTunnelFrame, subscribeTunnelPanels, subscribeTunnelInspection, tunnelCompact, type TunnelPanelBinding } from '../../services/tunnelJourney';
import { PASSAGE_CHAPTERS } from '../../services/passageChapters';
import { passagePose, passageContentOpacity, passageStationMotion, passageReading } from '../../services/passageJourney';
import { samplePassageAssembly } from '../../services/passageAssembly';
import { acquirePassageMedia, PASSAGE_MEDIA } from '../../services/passageMedia';
import { bindPassageSound } from '../../services/passageSound';
import { getViewer, subscribeViewer } from '../../services/viewer';
import { videos } from '../../data/catalogue';
import { playSound } from '../../services/audio';
import { getPassageMediaBounds, setPassageMediaBounds } from '../../services/passageProtection';
import { createPassageArchitecture } from './passageArchitecture';
import { createTunnelAtmosphere } from './tunnelAtmosphere';
import { createTunnelSignals } from './tunnelSignals';
import { createTunnelRelays } from './tunnelRelays';
import { createTunnelCutaway } from './tunnelCutaway';
import { createTunnelPulse, getTunnelLife, setTunnelRelay, selectTunnelRelayPart, subscribeTunnelLife, type TunnelLifeFrame } from '../../services/tunnelLife';
import { cameraEase } from './cameraPath';
import type { SpatialSceneController, SpatialSceneOptions, SpatialSceneState } from './scene';

type Panel={binding:TunnelPanelBinding;object:CSS3DObject;attached:boolean;style:string|null;inert:boolean;aria:string|null;transform:string;reveal:number};
type Travel={from:THREE.Vector3;to:THREE.Vector3;fromLook:THREE.Vector3;toLook:THREE.Vector3;start:number;duration:number;done:(()=>void)|null;settled:boolean};
const clamp=THREE.MathUtils.clamp;

/** One native-scroll camera renders the tunnel and its accessible DOM.
 * Physical carriers and editorial plates share the same reversible pose. */
export function createTunnelScene(host:HTMLElement,options:SpatialSceneOptions):SpatialSceneController {
  let renderer:THREE.WebGLRenderer;
  try { renderer=new THREE.WebGLRenderer({alpha:false,antialias:innerWidth>=980,powerPreference:'high-performance'}); }
  catch { options.onUnavailable();return {setState(){},setFocus(){},setScroll(){},rotate(){},travelTo(_id,done){done();},cancelTravel(){},destroy(){}}; }
  let disposed=false,unavailable=false,ready=false;
  let state:SpatialSceneState={entered:false,room:'atrium',paused:false,reducedMotion:options.reducedMotion};
  let frame=getTunnelFrame(),inspection=getTunnelInspection(),preferences=getSpatialPreferences();
  let width=1,height=1,compact=false,ratio=1,request=0,lastTime=0,elapsed=0;
  let average=16.7,samples=0,reduction=0,travel:Travel|null=null;
  const pointer:[number,number]=[0,0],pointerTarget:[number,number]=[0,0];
  let previousZ=frame.z,scrollEnergy=0,lightCalm=Number(passageReading(frame));
  let scanHold=0,scanPlayed=false,lastScan=-Infinity,cutawayOptics=0;
  let life=getTunnelLife(),relayHovered=false,pointerPresent=false,pointerPress:{x:number;y:number;id:number;part:number|null;dragged:boolean}|null=null;
  const pulse=createTunnelPulse(),raycaster=new THREE.Raycaster(),rayPoint=new THREE.Vector2();
  let activeTexture:THREE.VideoTexture|null=null,textureEpoch=-1,textureChapter=-1;
  const cadence=createFrameCadence(),canvas=renderer.domElement;
  const cinematic=createCinematicRenderer(renderer),protectedSurfaces:CinematicRect[]=[];
  const protectedMedia:CinematicRect={left:0,top:0,right:0,bottom:0};
  canvas.className='spatial-world-canvas';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{width:'100%',height:'100%',display:'block',touchAction:'pan-y',pointerEvents:'none'});host.appendChild(canvas);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
  renderer.setClearColor(0x080909,1);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x080909);scene.fog=new THREE.FogExp2(0x080909,.021);
  const camera=new THREE.PerspectiveCamera(59,1,.16,165),look=new THREE.Vector3();
  const projectedCorner=new THREE.Vector3();
  const cssScene=new THREE.Scene(),css=new CSS3DRenderer();
  css.domElement.className='tunnel-css-world';
  Object.assign(css.domElement.style,{position:'fixed',inset:'0',pointerEvents:'none',overflow:'clip',zIndex:'1'});
  (document.getElementById('main')||host).appendChild(css.domElement);
  const roomEnvironment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(roomEnvironment,.025);roomEnvironment.dispose();pmrem.dispose();
  scene.environment=environment.texture;scene.environmentIntensity=.9;
  const hemisphere=new THREE.HemisphereLight(0xeee9df,0x171c1c,.58);scene.add(hemisphere);
  const key=new THREE.DirectionalLight(0xffeee0,1.4);key.position.set(-5,9,12);scene.add(key,key.target);
  const fill=new THREE.PointLight(0xe5edf0,35,32,2),accent=new THREE.PointLight(0xff4d32,11,24,2);scene.add(fill,accent);
  const architecture=createPassageArchitecture(scene,wake);
  const atmosphere=createTunnelAtmosphere();scene.add(atmosphere.points);
  const signals=createTunnelSignals(scene),relays=createTunnelRelays(scene);
  const cutaway=createTunnelCutaway(scene,renderer,camera);
  relays.setExploded(life.relayOpen);
  const lifeFrame:TunnelLifeFrame={time:0,delta:0,cameraZ:14,active:-1,progress:0,pointer,energy:0,pulse:pulse.value,compact:false,reducedMotion:false,inspection:false,quality:preferences.quality};
  const mediaLease=acquirePassageMedia(),media=mediaLease.controller;
  const studySound=bindPassageSound(media.getVideo());
  const panels=new Map<string,Panel>(),loadedPosters=new Set<number>();
  let collectionKey='';

  function wake(){if(!request&&!disposed&&!unavailable&&!state.paused&&!document.hidden)request=requestVisualFrame(render);}
  function restorePanel(panel:Panel){
    const el=panel.binding.element;
    if(panel.attached){panel.transform=el.style.transform;cssScene.remove(panel.object);panel.binding.fallback.appendChild(el);}
    if(panel.style===null)el.removeAttribute('style');else el.setAttribute('style',panel.style);
    el.inert=panel.inert;if(panel.aria===null)el.removeAttribute('aria-hidden');else el.setAttribute('aria-hidden',panel.aria);
    el.removeAttribute('data-tunnel-mounted');el.removeAttribute('data-assembly-progress');el.removeAttribute('data-assembly-locked');panel.reveal=-1;panel.attached=false;
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
      panel.reveal=-1;
      cssScene.add(panel.object);panel.attached=true;
    }
    css.domElement.style.display=spatial?'':'none';
  }
  function registerPanels(bindings:TunnelPanelBinding[]){
    for(const [id,panel] of panels)if(!bindings.some(b=>b.id===id&&b.element===panel.binding.element)){restorePanel(panel);panels.delete(id);}
    for(const binding of bindings){
      if(panels.has(binding.id))continue;
      const el=binding.element,original={style:el.getAttribute('style'),inert:el.inert,aria:el.getAttribute('aria-hidden')};
      const panel={binding,object:new CSS3DObject(el),attached:false,transform:'',reveal:-1,...original};panels.set(binding.id,panel);
      if(compact||state.reducedMotion)restorePanel(panel);
    }
    syncPanels();wake();
  }
  function updatePanels(){
    if(state.paused||compact||unavailable)return;
    for(const panel of panels.values()){
      if(!panel.attached)continue;
      const motion=passageStationMotion(panel.binding.index,frame),assembly=samplePassageAssembly(panel.binding.index,frame),spec=PASSAGE_CHAPTERS[panel.binding.index];
      const [x,y,z]=spec.panel.position,s=Math.sin(motion.rotation[1]),c=Math.cos(motion.rotation[1]);
      panel.object.position.set(motion.position[0]+x*c+z*s,motion.position[1]+y,motion.position[2]-x*s+z*c);
      panel.object.rotation.set(...motion.rotation);
      const opacity=state.room==='atrium'?passageContentOpacity(panel.binding.index,frame):0;
      const readable=opacity>.99&&assembly.lock>=.999&&!travel&&document.documentElement.dataset.spatialPassage!=='departing';
      const el=panel.binding.element;el.style.visibility=opacity>.001?'visible':'hidden';el.style.opacity=String(opacity);
      if(panel.reveal!==assembly.deployment){
        // Hardware clears first; whole readable words then resolve together.
        // The semantic interface never becomes a sliced mechanical texture.
        el.style.clipPath='none';el.dataset.assemblyProgress=assembly.deployment.toFixed(3);
        el.dataset.assemblyLocked=String(assembly.lock>=.999);
        panel.reveal=assembly.deployment;
      }
      if(el.inert!==!readable)el.inert=!readable;
      const aria=String(!readable);if(el.getAttribute('aria-hidden')!==aria)el.setAttribute('aria-hidden',aria);
    }
  }
  function updateMediaProtection(){
    if(compact||state.reducedMotion||unavailable||state.room!=='atrium'||frame.active<0||samplePassageAssembly(frame.active,frame).screen<.01){setPassageMediaBounds(null);return;}
    const screen=architecture.chapters[frame.active].media;
    screen.updateWorldMatrix(true,false);
    const w=screen.geometry.parameters.width/2,h=screen.geometry.parameters.height/2;
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const x of [-w,w])for(const y of [-h,h]){
      projectedCorner.set(x,y,0).applyMatrix4(screen.matrixWorld).project(camera);
      const px=(projectedCorner.x+1)*width/2,py=(1-projectedCorner.y)*height/2;
      left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
    }
    setPassageMediaBounds({left:Math.max(0,left-5),top:Math.max(0,top-5),right:Math.min(width,right+5),bottom:Math.min(height,bottom+5)});
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
    if(compact){pulse.reset();pointerPress=null;setTunnelRelay(false);}
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
    const response=1-Math.exp(-dt*10);
    pointer[0]+=(pointerTarget[0]-pointer[0])*response;pointer[1]+=(pointerTarget[1]-pointer[1])*response;
    scrollEnergy+=(Math.min(1,Math.abs(camera.position.z-previousZ)/Math.max(dt,1/120)/45)-scrollEnergy)*(1-Math.exp(-dt*7));previousZ=camera.position.z;
    const chapter=PASSAGE_CHAPTERS[Math.max(0,frame.active)];
    const reading=passageReading(frame);
    lightCalm+=(Number(reading)-lightCalm)*(1-Math.exp(-dt*3.5));
    const illumination=sampleCinematicLight(elapsed,state.reducedMotion||compact,lightCalm);
    // Slow overlapping light cycles describe real surfaces. Exposure and the
    // ambient floor stay constant; reading holds are deliberately quieter.
    key.intensity=1.5*illumination.breath;fill.intensity=30*illumination.breath;accent.intensity=14*illumination.signal;
    key.position.copy(camera.position);key.position.x-=5;key.position.y+=9;key.position.z-=7;key.target.position.copy(look);
    fill.position.copy(look);fill.position.x+=3+illumination.drift*.24;fill.position.y+=2;fill.position.z+=5;
    accent.position.copy(look);accent.position.x+=7;accent.position.y-=2;accent.position.z-=5;
    scene.environmentIntensity=preferences.cutaway?.95:.4+preferences.light*.003;
    studySound.setActive(inPassage&&frame.active===3&&media.getSnapshot().ready&&!compact&&!state.reducedMotion&&!state.paused);
    const spectrum=studySound.sample();
    architecture.update({active:frame.active,progress:frame.progress,elapsed,delta:dt,reducedMotion:state.reducedMotion||compact,compact,quality:preferences.quality,inspection,pointer,energy:scrollEnergy,audio:spectrum});
    host.dataset.passageAudioEnergy=spectrum.rms.toFixed(4);
    const lifeEnabled=inPassage&&!compact&&!state.reducedMotion;
    if(lifeEnabled&&!inspection.expanded)pulse.advance(dt);
    lifeFrame.time=elapsed;lifeFrame.delta=inspection.expanded?0:dt;lifeFrame.cameraZ=camera.position.z;lifeFrame.active=frame.active;lifeFrame.progress=frame.progress;
    lifeFrame.energy=scrollEnergy;lifeFrame.compact=compact||!inPassage;lifeFrame.reducedMotion=state.reducedMotion;lifeFrame.inspection=inspection.expanded;lifeFrame.quality=preferences.quality;
    signals.update(lifeFrame);relays.update(lifeFrame);
    // Project semantic content before hit testing. A stationary cursor must see
    // the current panel placement during native scrolling and station jumps.
    updatePanels();if(!compact&&!state.reducedMotion)css.render(cssScene,camera);
    updateMediaProtection();
    const imageBounds=getPassageMediaBounds(),cursorX=(pointerTarget[0]+1)*width/2,cursorY=(1-pointerTarget[1])*height/2;
    const overImage=!!imageBounds&&cursorX>=imageBounds.left&&cursorX<=imageBounds.right&&cursorY>=imageBounds.top&&cursorY<=imageBounds.bottom;
    const overInterface=pointerPresent&&pointerOverInterface(cursorX,cursorY);
    const hardBlock=!lifeEnabled||overImage||overInterface||inspection.expanded||!!travel||!!pointerPress;
    const cutawayVisible=cutaway.update(pointerTarget,pointerPresent&&!hardBlock,width,height,dt,hardBlock);
    cutawayOptics+=(Number(cutawayVisible)-cutawayOptics)*(1-Math.exp(-dt*10));
    if(cutawayVisible){
      scanHold+=dt;
      if(!scanPlayed&&scanHold>.22){
        scanPlayed=true;
        const now=performance.now();
        if(now-lastScan>6500){lastScan=now;playSound('scan',{intensity:.42,pan:pointerTarget[0]*.45});}
      }
    }else{scanHold=0;scanPlayed=false;}
    host.dataset.passageCutaway=String(cutawayVisible);
    atmosphere.points.visible=inPassage&&!compact&&!state.reducedMotion;
    if(atmosphere.points.visible&&!inspection.expanded)atmosphere.update(elapsed,dt,false,scrollEnergy,pulse.value);
    updateMediaTexture();
    protectedSurfaces.length=0;
    if(imageBounds){
      protectedMedia.left=imageBounds.left/width;protectedMedia.top=imageBounds.top/height;
      protectedMedia.right=imageBounds.right/width;protectedMedia.bottom=imageBounds.bottom/height;
      protectedSurfaces.push(protectedMedia);
    }
    cinematic.render(scene,camera,{
      enabled:inPassage&&!compact&&!state.reducedMotion&&preferences.quality!=='light'&&reduction<.3,
      strength:THREE.MathUtils.lerp(reading?.16:.24,.08,cutawayOptics),
      lens:reading||inspection.expanded?0:(.25+scrollEnergy*.35)*(1-cutawayOptics),
      protectedRects:protectedSurfaces,
    });
    canvas.dataset.cinematicBreath=illumination.breath.toFixed(4);
    host.dataset.passageChapter=frame.active<0?'entrance':chapter.id;
    host.dataset.passageReading=String(passageReading(frame));
    host.dataset.passageDrawCalls=String(renderer.info.render.calls);
    host.dataset.passageLife=lifeEnabled?'active':'off';host.dataset.passageRelayOpen=String(life.relayOpen);host.dataset.passageRelayPart=String(life.relayPart??'');host.dataset.passageSignal=String(life.signal);
    if(!ready){ready=true;options.onProject?.([]);options.onReady();}
    done?.();
    if((inPassage&&!compact&&!state.reducedMotion)||(travel&&!travel.settled))wake();
  }
  function cancelTravel(){if(travel)travel.done=null;travel=null;wake();}
  function lifeAvailable(){return !disposed&&!unavailable&&state.room==='atrium'&&!state.paused&&!state.reducedMotion&&!compact&&!inspection.expanded&&!travel;}
  function isInterface(target:EventTarget|null){return target instanceof Element&&!!target.closest('button,a,video,input,select,textarea,dialog,[role="dialog"],.tunnel-panel,.tunnel-wayfinder,.tunnel-hero-copy,.tunnel-hero-caption,.tunnel-hero-bottom,.tunnel-relay-control,header');}
  function pointerOverInterface(x:number,y:number){
    if(document.querySelector('dialog[open]'))return true;
    try{if(document.querySelector(':popover-open'))return true;}catch{/* Native popovers are not available in older engines. */}
    if(isInterface(document.elementFromPoint(x,y)))return true;
    // Some opening copy intentionally passes pointer events to the scene.
    // Its visible bounds still protect its reading area.
    return frame.active<0&&Array.from(document.querySelectorAll('.tunnel-hero-copy,.tunnel-hero-caption,.tunnel-hero-bottom')).some(element=>{
      const rect=element.getBoundingClientRect();return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
    });
  }
  function relayHit(x:number,y:number){
    if(!lifeAvailable()||frame.active>=0)return false;
    rayPoint.set(x/width*2-1,1-y/height*2);raycaster.setFromCamera(rayPoint,camera);return relays.hitTest(raycaster);
  }
  function pointerMove(event:PointerEvent){
    if(state.room!=='atrium'||state.paused||state.reducedMotion||compact||inspection.expanded)return;
    if(pointerPress&&event.pointerId===pointerPress.id&&pointerPress.part!==null&&event.buttons===1){
      const distance=Math.hypot(event.clientX-pointerPress.x,event.clientY-pointerPress.y);
      if(distance>8){pointerPress.dragged=true;if(getTunnelLife().relayPart!==pointerPress.part)selectTunnelRelayPart(pointerPress.part);relays.setPartPull(Math.min(1,distance/105));pointerPresent=false;return;}
    }
    pointerPresent=event.pointerType==='mouse'&&event.buttons===0;
    pointerTarget[0]=event.clientX/width*2-1;pointerTarget[1]=1-event.clientY/height*2;
    // Keep physical cursor coordinates even over protected UI. If scrolling
    // uncovers the scene beneath it, the next frame resumes at this position.
    if(pointerOverInterface(event.clientX,event.clientY)){
      atmosphere.input.leave();cutaway.reset();scanHold=0;scanPlayed=false;relayHovered=false;host.dataset.passageRelayHover='false';return;
    }
    atmosphere.input.move(pointerTarget[0],pointerTarget[1],event.timeStamp,event.pointerType==='touch');
    relayHovered=relayHit(event.clientX,event.clientY);host.dataset.passageRelayHover=String(relayHovered);host.dataset.passageRelayHoverPart=relayHovered?String(relays.hitPart(raycaster)??''):'';
  }
  function pointerDown(event:PointerEvent){
    clearCutaway();
    pointerPress=null;
    if(event.button!==0||!lifeAvailable()||isInterface(event.target))return;
    atmosphere.input.press();
    if(relayHit(event.clientX,event.clientY))pointerPress={x:event.clientX,y:event.clientY,id:event.pointerId,part:life.relayOpen?relays.hitPart(raycaster):null,dragged:false};
  }
  function pointerUp(event:PointerEvent){
    atmosphere.input.release();const press=pointerPress;pointerPress=null;
    pointerMove(event);
    if(press?.dragged){relays.setPartPull(null);playSound('sculpture-turn');return;}
    if(press&&event.pointerId===press.id&&Math.hypot(press.x-event.clientX,press.y-event.clientY)<6&&!isInterface(event.target)&&relayHit(event.clientX,event.clientY)){
      const current=getTunnelLife();
      if(current.relayOpen){
        const part=relays.hitPart(raycaster);
        if(part!==null){selectTunnelRelayPart(current.relayPart===part?null:part);playSound(current.relayPart===part?'close':'scan',{pan:(part/5-.5)*.8});}
        else{setTunnelRelay(false);playSound('sculpture-fold');}
      }else{setTunnelRelay(true);playSound('sculpture-unfold');}
    }
  }
  function clearCutaway(){pointerPresent=false;scanHold=0;scanPlayed=false;cutaway.reset();host.dataset.passageCutaway='false';}
  function leavePointer(){pointerPresent=false;atmosphere.input.leave();wake();}
  function scrollPointer(){wake();}
  function resetPointer(){atmosphere.input.reset();relays.setPartPull(null);clearCutaway();pointerPress=null;relayHovered=false;host.dataset.passageRelayHover='false';pointerTarget[0]=pointerTarget[1]=pointer[0]=pointer[1]=0;}
  function visibility(){lastTime=0;cadence.reset();resetPointer();if(document.hidden){cancelVisualFrame(request);request=0;}else wake();}
  function contextLost(event:Event){
    event.preventDefault();unavailable=true;cancelVisualFrame(request);request=0;
    const done=travel?.done;travel=null;panels.forEach(restorePanel);css.domElement.style.display='none';
    setPassageMediaBounds(null);options.onUnavailable();done?.();
  }
  const offFrame=subscribeTunnelFrame(next=>{frame=next;if(next.active>=0&&getTunnelLife().relayOpen)setTunnelRelay(false);syncMedia();wake();});
  const offLife=subscribeTunnelLife(()=>{
    const next=getTunnelLife();if(next.signal!==life.signal&&lifeAvailable())pulse.trigger(camera.position.z);
    life=next;relays.setExploded(next.relayOpen);relays.setSelectedPart(next.relayPart);wake();
  });
  const offPanels=subscribeTunnelPanels(registerPanels);
  const offInspection=subscribeTunnelInspection(next=>{inspection=next;resetPointer();wake();});
  const offPreferences=subscribeSpatialPreferences(()=>{const prev=preferences;preferences=getSpatialPreferences();if(prev.quality!==preferences.quality)reduction=0;resize();});
  const offMedia=media.subscribe(()=>{updateMediaTexture();wake();});
  const offViewer=subscribeViewer(syncCollection);
  const observer=new ResizeObserver(resize);observer.observe(host);
  document.addEventListener('visibilitychange',visibility);document.addEventListener('pointerleave',leavePointer);window.addEventListener('scroll',scrollPointer,{passive:true});window.addEventListener('pointermove',pointerMove,{passive:true});window.addEventListener('pointerdown',pointerDown,{passive:true});window.addEventListener('pointerup',pointerUp,{passive:true});window.addEventListener('pointercancel',resetPointer,{passive:true});window.addEventListener('blur',resetPointer);
  canvas.addEventListener('webglcontextlost',contextLost);
  resize();registerPanels(getTunnelPanels());syncMedia();

  return {
    setState(next){
      if(disposed)return;
      let finish:(()=>void)|null=null;
      if(next.reducedMotion&&!state.reducedMotion&&travel&&!travel.settled&&!next.paused&&next.room===state.room){finish=travel.done;travel.done=null;}
      if(next.paused||next.room!==state.room||next.entered!==state.entered||next.reducedMotion!==state.reducedMotion){if(travel)travel.done=null;travel=null;}
      state={...next};if(state.paused||state.reducedMotion||state.room!=='atrium')studySound.setActive(false);if(state.room!=='atrium'){setPassageMediaBounds(null);pulse.reset();setTunnelRelay(false);resetPointer();}syncMedia();
      if(next.paused){resetPointer();cancelVisualFrame(request);request=0;}else{cadence.reset();lastTime=0;resize();}
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
      if(disposed)return;disposed=true;if(travel)travel.done=null;travel=null;setPassageMediaBounds(null);
      cancelVisualFrame(request);observer.disconnect();offFrame();offPanels();offInspection();offPreferences();offMedia();offViewer();offLife();
      panels.forEach(restorePanel);panels.clear();document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pointerleave',leavePointer);window.removeEventListener('scroll',scrollPointer);window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerdown',pointerDown);window.removeEventListener('pointerup',pointerUp);window.removeEventListener('pointercancel',resetPointer);window.removeEventListener('blur',resetPointer);
      canvas.removeEventListener('webglcontextlost',contextLost);
      activeTexture?.dispose();cutaway.destroy();architecture.destroy();atmosphere.dispose();signals.destroy();relays.destroy();pulse.reset();environment.dispose();
      studySound.destroy();media.setSuspended('passage-scene-route',false);media.setSuspended('passage-scene-paused',false);media.setSuspended('passage-scene-reduced',false);mediaLease.release();
      cinematic.dispose();scene.clear();cssScene.clear();renderer.dispose();renderer.forceContextLoss();canvas.remove();css.domElement.remove();
    },
  };
}
