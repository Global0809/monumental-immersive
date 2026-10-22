import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { playSound } from '../services/audio';
import './motion-showcase.css';
const films = [
 ['01-living-atlas','The living atlas','A world of culture, connected.','/world'],
 ['02-time-machine','Step into another decade','Follow the moments that moved us.','/time-machine'],
 ['03-connections','Every story has a connection','People, places and the stories between them.','/journey'],
 ['04-catalogue-player','Find your next story','Discover the preview collection.','/search'],
 ['05-premium-vault','Beyond the ordinary','A visual concept for Monumental+.','/premium'],
 ['06-deco-atlas','A different view of the world','Explore a city through its creative character.','/world'],
 ['07-bauhaus-categories','Culture in every shape','Follow your curiosity across categories.','/category/culture'],
 ['08-culture-passport','Collect a world of your own','Your places, stories and discoveries.','/my-world'],
 ['09-brand-chrome','Made to be Monumental','An identity in constant motion.','/world'],
 ['10-living-membrane','Enter the unexpected','A study of form, rhythm and possibility.','/world'],
 ['11-sound-aurora','Feel the frequency','Discover the original interface sound palette.','/settings'],
 ['12-cursor-language','A world that answers back','An exploration of responsive interaction.','/settings'],
 ['13-mobile-app','Built for touch','A concept for culture on the move.','/my-world'],
 ['14-search-filters','Find your frequency','A place. A film. A new direction.','/search'],
 ['15-miami-isometric','Miami, up close','Explore our opening cultural gateway.','/world?place=miami'],
 ['16-story-paper','The story behind the story','A visual direction for the planned original.','/film/story-behind-the-story'],
 ['17-wavemakers-lines','WAVEMAKERS','An original series in development.','/film/wavemakers-valid-id'],
 ['18-take-me-somewhere','Take me somewhere','Turn your available time into a journey.','/journey'],
];
const selections: Record<string,number[]> = { '/':[8,0,1,16,17], '/world':[0,5,14,2], '/time-machine':[1,5], '/search':[13,3,6], '/premium':[4], '/my-world':[7,12], '/settings':[10,11,9], '/journey':[17,2], '/live':[2,0] };
const asset = (name:string) => `${import.meta.env.BASE_URL}motion/${name}`;
export default function MotionShowcase({ path, reducedMotion }: { path:string; reducedMotion:boolean }) {
 const selectedFilms = path === '/motion' ? films : (selections[path] || (path.includes('wavemakers') ? [16] : path.startsWith('/film/') ? [15,3] : path.startsWith('/category/') ? [6,3] : [])).map(i=>films[i]);
 const [selected,setSelected]=useState(0); const [paused,setPaused]=useState(reducedMotion); const [visible,setVisible]=useState(false); const [blocked,setBlocked]=useState(false); const [active,setActive]=useState(false); const [failed,setFailed]=useState(false);
 const host=useRef<HTMLElement>(null);const media=useRef<HTMLVideoElement>(null);const progress=useRef<HTMLSpanElement>(null);
 const film=selectedFilms[selected] || selectedFilms[0];
 useEffect(()=>{if(reducedMotion)setPaused(true);},[reducedMotion]);
 useEffect(()=>{const el=host.current;if(!el)return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:.15});observer.observe(el);const visibility=()=>setBlocked(document.hidden || Boolean(document.querySelector('.ms-player-dialog[open]')));const playback=(e:Event)=>setBlocked(document.hidden || (e as CustomEvent).detail.active);document.addEventListener('visibilitychange',visibility);window.addEventListener('monumental:playback',playback);visibility();return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('monumental:playback',playback);};},[]);
 useEffect(()=>{setFailed(false);setActive(false);if(progress.current)progress.current.style.transform='scaleX(0)';},[selected]);
 useEffect(()=>{const v=media.current;if(!v||!film)return;if(visible&&!paused&&!blocked&&!failed){if(!v.getAttribute('src'))v.src=asset(film[0]+'.mp4');void v.play().catch(()=>setPaused(true));}else v.pause();return()=>{v.pause();if(!v.isConnected){v.removeAttribute("src");v.load();}};},[visible,paused,blocked,selected,failed,film]);
 useEffect(()=>{if(reducedMotion||!visible)return;const ctx=gsap.context(()=>gsap.fromTo('.motion-caption',{y:12,opacity:.2},{y:0,opacity:1,duration:.45,ease:'power3.out'}),host);return()=>ctx.revert();},[selected,reducedMotion,visible]);
 const Heading = path === "/motion" ? "h1" : "h2";
 if(!film)return null;
 function choose(index:number){setSelected((index+selectedFilms.length)%selectedFilms.length);playSound('select');}
 return <section ref={host} className={'motion-showcase page-section'+(path==='/motion'?' motion-showcase--full':'')} aria-label="Experience in motion">
 <header className="motion-heading"><div><span className="eyebrow">MONUMENTAL / IN MOTION</span><Heading>{path==='/motion'?'A WORLD OF':'SEE WHAT'}<br/><em>{path==='/motion'?'POSSIBILITIES.':'MOVES US.'}</em></Heading></div><p>Explore the ideas behind the experience.<br/>Motion concepts. Real possibilities.</p>{path!=='/motion'&&<a href="#/motion" className="text-link">Explore all 18 films ↗</a>}</header>
 <div className="motion-layout"><div className="motion-screen"><div className="motion-stage" data-cursor="WATCH"><video ref={media} key={film[0]} poster={asset(film[0]+'.jpg')} muted loop playsInline preload="none" aria-label={film[1]+' motion concept'} onPlay={()=>setActive(true)} onPause={()=>setActive(false)} onError={()=>{setFailed(true);setActive(false);}} onTimeUpdate={e=>{const v=e.currentTarget;if(progress.current&&v.duration)progress.current.style.transform=`scaleX(${v.currentTime/v.duration})`;}}/><div className="motion-status"><i className={active?'is-playing':''}/>{active?'IN MOTION':'STILL FRAME'}<span>08 SEC / LOOP</span></div><div className="motion-progress"><span ref={progress}/></div></div>
 <div className="motion-caption"><div><span className="motion-number">{String(selected+1).padStart(2,'0')} / {String(selectedFilms.length).padStart(2,'0')}</span><h3>{film[1]}</h3><p>{film[2]}</p></div><a className="text-link" href={'#'+film[3]}>Explore this idea ↗</a></div>
 <div className="motion-controls" data-sound-owned>{selectedFilms.length>1&&<button onClick={()=>choose(selected-1)} aria-label="Previous motion film">←</button>}<button className="motion-play" aria-label={failed?'Retry motion preview':paused?'Play motion preview':'Pause motion preview'} aria-pressed={!paused} onClick={()=>{if(failed){setFailed(false);media.current?.removeAttribute('src');setPaused(false);}else setPaused(v=>!v);playSound('select');}}>{failed?'↻ Retry loop':paused?'▶ Play loop':'Ⅱ Pause loop'}</button>{selectedFilms.length>1&&<button onClick={()=>choose(selected+1)} aria-label="Next motion film">→</button>}<span>{failed?'Preview unavailable. Try Play again.':'Concept film · Silent preview'}</span></div></div>
 {selectedFilms.length>1&&<div className="motion-index" aria-label="Choose a motion film">{selectedFilms.map((f,i)=><button key={f[0]} aria-pressed={selected===i} onClick={()=>choose(i)} data-sound-owned><span>{String(i+1).padStart(2,'0')}</span><img src={asset(f[0]+'.jpg')} loading="lazy" alt=""/><strong>{f[1]}</strong><span aria-hidden="true">↗</span></button>)}</div>}</div><p className="motion-note">Visual concepts supplied for this preview. Some scenes illustrate future experiences; available features are accessible through “Explore this idea”.</p></section>;
}
