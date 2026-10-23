import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import './page-transition.css';

type Passage = { title:string; kind:string; axis:'x'|'y'; count:number; turn:number };
const passages:Record<string,Passage> = {
  '/':{title:'MONUMENTAL',kind:'assemble',axis:'y',count:6,turn:0},
  '/world':{title:'WORLD',kind:'orbit',axis:'x',count:2,turn:90},
  '/time-machine':{title:'TIME MACHINE',kind:'rewind',axis:'x',count:6,turn:-75},
  '/live':{title:'LIVE',kind:'broadcast',axis:'y',count:2,turn:0},
  '/category/movies':{title:'MOVIES',kind:'cinema',axis:'y',count:2,turn:0},
  '/category/music':{title:'MUSIC',kind:'equalizer',axis:'y',count:12,turn:0},
  '/category/sports':{title:'SPORTS',kind:'velocity',axis:'x',count:5,turn:-25},
  '/category/gaming':{title:'GAMING',kind:'voxel',axis:'y',count:12,turn:45},
  '/category/news':{title:'NEWS',kind:'dispatch',axis:'x',count:5,turn:0},
  '/category/fashion':{title:'FASHION',kind:'pleat',axis:'y',count:10,turn:35},
  '/category/culture':{title:'CULTURE',kind:'weave',axis:'x',count:8,turn:45},
  '/category/kids':{title:'KIDS',kind:'play',axis:'y',count:6,turn:-30},
  '/my-world':{title:'MY WORLD',kind:'constellation',axis:'x',count:2,turn:20},
  '/premium':{title:'MONUMENTAL+',kind:'vault',axis:'x',count:2,turn:90},
  '/journey':{title:'FOLLOW YOUR CURIOSITY',kind:'journey',axis:'x',count:4,turn:-20},
  '/search':{title:'FIND YOUR FREQUENCY',kind:'focus',axis:'y',count:4,turn:0},
  '/settings':{title:'MAKE IT YOURS',kind:'calibrate',axis:'x',count:3,turn:120},
  '/credits':{title:'BEHIND THE FRAME',kind:'credits',axis:'y',count:4,turn:0},
  '/motion':{title:'IN MOTION',kind:'frames',axis:'y',count:5,turn:-12},
};
function passageFor(path:string):Passage {
  if(path.startsWith('/film/'))return {title:path.includes('wavemakers')?'WAVEMAKERS':'THE STORY CONTINUES',kind:'cinema',axis:'y',count:2,turn:0};
  return passages[path] || {title:'KEEP EXPLORING',kind:'assemble',axis:'y',count:6,turn:0};
}

function Geometry({kind}:{kind:string}) {
  switch(kind){
    case 'orbit':return <><circle cx="300" cy="300" r="212"/><ellipse cx="300" cy="300" rx="92" ry="212"/><ellipse cx="300" cy="300" rx="212" ry="72" transform="rotate(-30 300 300)"/><path d="M88 300H512M300 88V512"/></>;
    case 'rewind':return <><circle cx="300" cy="300" r="205"/>{Array.from({length:24},(_,i)=><path key={i} d="M300 102V125" transform={`rotate(${i*15} 300 300)`}/>)}<path d="M300 170V300L210 365M175 260L120 300L175 340M235 260L180 300L235 340"/></>;
    case 'equalizer':return <>{Array.from({length:13},(_,i)=><path key={i} d={`M${90+i*35} ${300-40-(i*47)%160}V${300+40+(i*47)%160}`}/>)}</>;
    case 'cinema':return <><rect x="90" y="150" width="420" height="300"/><path d="M90 220H510M130 150L180 220M230 150L280 220M330 150L380 220M430 150L480 220M265 275L355 325L265 375Z"/></>;
    case 'velocity':return <>{[0,1,2,3,4].map(i=><path key={i} d={`M${90+i*25} ${180+i*60}L${370+i*25} ${110+i*60}`}/>)}</>;
    case 'voxel':return <>{[0,1,2].map(i=><path key={i} d={`M300 ${110+i*80}L470 ${200+i*80}L300 ${290+i*80}L130 ${200+i*80}ZM300 ${290+i*80}V${355+i*35}`}/>)}</>;
    case 'dispatch':return <><path d="M120 160H480M120 240H360M120 320H480M120 400H280"/><rect x="395" y="220" width="85" height="60"/></>;
    case 'pleat':return <>{Array.from({length:9},(_,i)=><path key={i} d={`M${100+i*50} 100Q${250+i*20} 300 ${100+i*50} 500`}/>)}</>;
    case 'weave':return <>{Array.from({length:7},(_,i)=><g key={i}><path d={`M100 ${150+i*50}Q300 ${50+i*50} 500 ${150+i*50}`}/><path d={`M${150+i*50} 100Q${50+i*50} 300 ${150+i*50} 500`}/></g>)}</>;
    case 'play':return <><circle cx="220" cy="220" r="95"/><circle cx="390" cy="285" r="65"/><path d="M180 440L280 295L370 455Z"/></>;
    case 'constellation':return <><path d="M120 350L230 170L330 320L470 160L445 435L120 350"/>{[[120,350],[230,170],[330,320],[470,160],[445,435]].map(([x,y])=><circle key={x} cx={x} cy={y} r="13"/>)}</>;
    case 'vault':return <><rect x="120" y="100" width="360" height="400" rx="8"/><circle cx="300" cy="300" r="110"/><path d="M300 190V410M190 300H410M222 222L378 378M378 222L222 378"/></>;
    case 'journey':return <><path d="M90 430C140 200 280 480 300 280S430 170 510 100"/>{[[90,430],[300,280],[510,100]].map(([x,y])=><circle key={x} cx={x} cy={y} r="13"/>)}</>;
    case 'focus':return <><path d="M100 240V100H240M360 100H500V240M500 360V500H360M240 500H100V360M230 300H370M300 230V370"/><circle cx="300" cy="300" r="105"/></>;
    case 'calibrate':return <>{[110,160,210].map((r,i)=><circle key={r} cx="300" cy="300" r={r} strokeDasharray={`${80+i*40} 35`}/>)}</>;
    case 'frames':return <>{[0,1,2,3].map(i=><rect key={i} x={110+i*25} y={110+i*25} width={380-i*50} height={380-i*50} transform={`rotate(${i*8-12} 300 300)`}/>)}</>;
    case 'broadcast':return <>{[35,95,155,215].map(r=><circle key={r} cx="300" cy="300" r={r}/>)}</>;
    case 'credits':return <>{[0,1,2,3,4].map(i=><path key={i} d={`M${130+i%2*60} ${140+i*80}H${470-i%2*60}`}/>)}</>;
    default:return <path d="M110 455V145L300 330L490 145V455M170 455V290L300 420L430 290V455"/>;
  }
}

/** Destination-specific passages. Never intercepts a click or waits to navigate. */
export default function PageTransition({path,reducedMotion}:{path:string;reducedMotion:boolean}) {
  const host=useRef<HTMLDivElement>(null);const previous=useRef(path);const scene=passageFor(path);
  useLayoutEffect(()=>{
    if(previous.current===path)return;previous.current=path;
    if(document.documentElement.dataset.worldPortal)return;
    const overlay=host.current;const stage=document.querySelector('.route-stage');if(!overlay||!stage)return;
    let completed=false;
    const finish=()=>{completed=true;overlay.dataset.active='false';};
    const context=gsap.context(()=>{
      if(reducedMotion){gsap.fromTo(stage,{opacity:.8},{opacity:1,duration:.14,clearProps:'opacity'});return;}
      // Preserve the existing poster-to-story handoff when a film card initiated it.
      const carried=path.startsWith('/film/')&&Boolean(document.querySelector('.story-transition-cover'));
      overlay.dataset.active='true';
      const panels=Array.from(overlay.querySelectorAll('.passage-panel'));
      const title=overlay.querySelectorAll('.passage-title span');
      const drawing=overlay.querySelector('.passage-geometry');
      const strokes=overlay.querySelectorAll<SVGGeometryElement>('.passage-geometry path,.passage-geometry circle,.passage-geometry rect,.passage-geometry ellipse');
      const tl=gsap.timeline({onComplete:finish,defaults:{ease:'power3.inOut'}});
      gsap.set(overlay,{opacity:1});
      gsap.set(panels,{xPercent:0,yPercent:0,scale:1,rotation:0,opacity:carried?0:1});
      if(!carried){
        const common={duration:.65,stagger:{amount:.16,from:'center' as const},ease:'power4.inOut'};
        if(['orbit','broadcast','constellation','play','calibrate'].includes(scene.kind)){
          tl.to(panels,{...common,scale:0,rotation:scene.turn,stagger:.055},.12);
        }else if(scene.kind==='voxel'){
          tl.to(panels,{...common,scale:0,rotation:45,stagger:{amount:.22,from:'random'}},.1);
        }else if(scene.kind==='focus'){
          tl.to(panels,{...common,xPercent:i=>i%2?115:-115,scale:.85},.12);
        }else if(scene.kind==='vault'){
          tl.to(panels,{...common,xPercent:i=>i?110:-110,rotationY:i=>i?-70:70,transformOrigin:i=>i?'100% 50%':'0% 50%'},.13);
        }else{
          const property=scene.axis==='x'?'xPercent':'yPercent';
          const directional=['rewind','velocity','dispatch','journey','credits'].includes(scene.kind);
          tl.to(panels,{...common,[property]:(i:number)=>directional?(scene.kind==='credits'?-450:-125):(i%2?115:-115),skewX:scene.kind==='velocity'?-16:scene.kind==='rewind'?8:0,rotationX:scene.kind==='pleat'?35:0},.14);
        }
      }
      gsap.set(drawing,{rotation:-scene.turn*.5,scale:scene.kind==='focus'?1.6:.65,opacity:0});
      tl.to(drawing,{rotation:scene.turn*.5,scale:1,opacity:carried?.12:.52,duration:.42,ease:'power3.out'},0);
      strokes.forEach((stroke,i)=>{const length=stroke.getTotalLength();gsap.set(stroke,{strokeDasharray:length,strokeDashoffset:length});tl.to(stroke,{strokeDashoffset:0,duration:.46,ease:'power2.out'},Math.min(.1,i*.008));});
      tl.fromTo(title,{yPercent:110,rotation:scene.kind==='rewind'?-8:0,opacity:0},{yPercent:0,rotation:0,opacity:carried?0:1,duration:.42,stagger:{amount:.1},ease:'power4.out'},.02);
      tl.to(title,{yPercent:scene.kind==='credits'?-120:-40,opacity:0,duration:.26,stagger:{amount:.06},ease:'power2.in'},.44);
      tl.to(drawing,{scale:scene.kind==='orbit'?1.65:1.14,rotation:scene.turn,opacity:0,duration:.35,ease:'power2.in'},.43);
      if(!carried){
        const horizontal=['rewind','velocity','dispatch','journey'].includes(scene.kind);
        tl.fromTo(stage,{opacity:.45,x:horizontal?22:0,y:horizontal?0:18,scale:scene.kind==='focus'?1.025:.985},{opacity:1,x:0,y:0,scale:1,duration:.64,ease:'power3.out',clearProps:'transform,opacity'},.12);
      }
      tl.set(overlay,{opacity:0},.96);
    },overlay);
    const cancel=()=>{context.revert();finish();};
    const hide=()=>{if(document.hidden)cancel();};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')cancel();};
    document.addEventListener('visibilitychange',hide);window.addEventListener('keydown',escape);
    return()=>{context.revert();if(!completed)finish();document.removeEventListener('visibilitychange',hide);window.removeEventListener('keydown',escape);};
  },[path,reducedMotion]);
  return <div ref={host} className={`page-passage passage-${scene.kind}`} data-active="false" data-passage={scene.kind} aria-hidden="true">
    <div className="passage-panels">{Array.from({length:scene.count},(_,i)=><div className="passage-panel" key={i}/>)}</div>
    <svg className="passage-geometry" viewBox="0 0 600 600" fill="none" stroke="currentColor" strokeWidth="1"><Geometry kind={scene.kind}/></svg>
    <div className="passage-title">{scene.title.split(' ').map((word,i)=><div key={i}><span>{word}</span></div>)}</div>
  </div>;
}
