import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { savedConstellations } from '../services/personalConstellation';
import { href } from '../services/router';
import { durationLabel } from '../services/discovery';
import { requestVisualFrame, cancelVisualFrame } from '../services/visualFrame';
import { type Video } from '../data/catalogue';
import './personal-constellation.css';

export default function PersonalConstellation({ saved, savedPlaces, reducedMotion, onChoose, onWatch }:{saved:string[];savedPlaces:string[];reducedMotion:boolean;onChoose:(key:string)=>void;onWatch:(film:Video)=>void}) {
  const groups=useMemo(()=>savedConstellations(saved,savedPlaces),[saved,savedPlaces]);
  const [page,setPage]=useState(0),[selected,setSelected]=useState(''),[paused,setPaused]=useState(false);
  const [compact,setCompact]=useState(()=>window.matchMedia('(max-width: 500px)').matches);
  const root=useRef<HTMLDivElement>(null),satellites=useRef(new Map<string,HTMLButtonElement>()),lines=useRef(new Map<string,SVGLineElement>()),orbitTime=useRef(0);
  const pageSize=compact?2:4,pageCount=Math.ceil(groups.length/pageSize),currentPage=Math.min(page,Math.max(0,pageCount-1));
  const visibleGroups=groups.slice(currentPage*pageSize,currentPage*pageSize+pageSize);
  const active=visibleGroups.find(group=>group.id===selected)||visibleGroups[0];
  const center=(i:number):[number,number]=>visibleGroups.length===1?[50,43]:visibleGroups.length===2?(compact?[[50,23],[50,69]]:[[27,38],[73,52]])[i] as [number,number]:[[27,23],[73,23],[27,69],[73,69]][i] as [number,number];
  useEffect(()=>{
    const query=window.matchMedia('(max-width: 500px)'),update=()=>setCompact(query.matches);
    query.addEventListener('change',update);return()=>query.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    const host=root.current;if(!host)return;
    let frame=0,time=orbitTime.current,previous=0,visible=false,engaged=false,disposed=false,playback=document.body.classList.contains('monumental-player-active'),width=host.clientWidth;
    const canMove=()=>!disposed&&visible&&!document.hidden&&!engaged&&!paused&&!reducedMotion&&!playback;
    const paint=()=>visibleGroups.forEach((group)=>group.films.slice(0,4).forEach((film,index)=>{
      const count=Math.min(group.films.length,4),angle=index/Math.max(1,count)*Math.PI*2+time*.14;
      const radius=Math.min(width<480?55:77,Math.max(40,width*.27-26));
      const x=Math.cos(angle)*radius,y=Math.sin(angle)*(width<480?53:59),z=Math.sin(angle)*18;
      satellites.current.get(film.id)?.style.setProperty('transform',`translate3d(${x}px,${y}px,${z}px)`);
      const line=lines.current.get(film.id);if(line){line.setAttribute('x2',String(x));line.setAttribute('y2',String(y));}
    }));
    const render=(now:number)=>{frame=0;if(!canMove()){previous=0;return;}time+=previous?Math.min(.05,(now-previous)/1000):0;orbitTime.current=time;previous=now;paint();frame=requestVisualFrame(render);};
    const wake=()=>{paint();if(canMove()&&!frame)frame=requestVisualFrame(render);else if(!canMove()){cancelVisualFrame(frame);frame=0;previous=0;}};
    const enter=()=>{engaged=true;wake();},leave=()=>{engaged=host.matches(':focus-within');wake();};
    const focusOut=()=>{queueMicrotask(()=>{engaged=host.matches(':hover,:focus-within');wake();});};
    const media=(event:Event)=>{playback=Boolean((event as CustomEvent<{active?:boolean}>).detail?.active);wake();};
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;wake();});observer.observe(host);
    const resize=new ResizeObserver(()=>{width=host.clientWidth;paint();});resize.observe(host);
    host.addEventListener('pointerenter',enter);host.addEventListener('pointerleave',leave);host.addEventListener('focusin',enter);host.addEventListener('focusout',focusOut);
    document.addEventListener('visibilitychange',wake);window.addEventListener('monumental:playback',media);paint();
    return()=>{disposed=true;cancelVisualFrame(frame);observer.disconnect();resize.disconnect();host.removeEventListener('pointerenter',enter);host.removeEventListener('pointerleave',leave);host.removeEventListener('focusin',enter);host.removeEventListener('focusout',focusOut);document.removeEventListener('visibilitychange',wake);window.removeEventListener('monumental:playback',media);};
  },[visibleGroups.map(group=>group.id+group.films.map(film=>film.id).join(',')).join('|'),paused,reducedMotion]);
  if(!groups.length)return <p className="personal-constellation__empty">Save a film or destination to begin your constellation. Saved journeys remain in the collection below.</p>;
  return <div className="personal-constellation">
    <div className="personal-constellation__sky" data-groups={visibleGroups.length} ref={root} aria-label="Your saved stories grouped around their destinations">
      {pageCount>1&&<span className="personal-constellation__page-status" aria-live="polite">Destinations {currentPage*pageSize+1}–{Math.min(groups.length,(currentPage+1)*pageSize)} of {groups.length}</span>}
      {visibleGroups.map((group,i)=>{const [x,y]=center(i);return <div key={group.id} className={`personal-constellation__cluster ${active?.id===group.id?'is-selected':''}`} style={{left:x+'%',top:y+'%'} as CSSProperties}>
        <svg aria-hidden="true" className="personal-constellation__threads" viewBox="-110 -110 220 220">{group.films.slice(0,4).map(film=><line key={film.id} ref={node=>{if(node)lines.current.set(film.id,node);else lines.current.delete(film.id);}} x1="0" y1="0" x2="0" y2="0"/>)}</svg>
        <button className="personal-constellation__anchor" aria-pressed={active?.id===group.id} aria-label={`Expand ${group.title}: ${group.films.length} saved stories`} onClick={()=>{setSelected(group.id);if(group.savedPlace)onChoose('place:'+group.id);}}><i aria-hidden="true"/><span>{group.title}<small>{group.films.length} saved {group.films.length===1?'story':'stories'}</small></span></button>
        {group.films.slice(0,4).map(film=><button key={film.id} ref={node=>{if(node)satellites.current.set(film.id,node);else satellites.current.delete(film.id);}} className="personal-constellation__story" aria-label={`Inspect saved story ${film.title}`} onClick={()=>{setSelected(group.id);onChoose('film:'+film.id);}}><img src={film.poster} alt=""/><span>{film.title}</span></button>)}
      </div>;})}
    </div>
    <div className="personal-constellation__toolbar"><p>Stories orbit the first destination in their catalogue entry. Hover or focus to hold them still.</p><button aria-label={reducedMotion?'Constellation motion is off for reduced motion':paused?'Start constellation motion':'Pause constellation motion'} aria-pressed={!paused&&!reducedMotion} disabled={reducedMotion} onClick={()=>setPaused(value=>!value)}>{paused||reducedMotion?<Play size={16}/>:<Pause size={16}/>}</button>{pageCount>1&&<><button aria-label="Previous constellation destinations" disabled={currentPage===0} onClick={()=>{setPage(currentPage-1);setSelected('');}}><ArrowLeft/></button><button aria-label="Next constellation destinations" disabled={currentPage===pageCount-1} onClick={()=>{setPage(currentPage+1);setSelected('');}}><ArrowRight/></button></>}</div>
    {active&&<div className="personal-constellation__collection" aria-live="polite"><h3>{active.title}</h3><p>{active.savedPlace?'A destination you saved.':'A destination connected to your saved films.'} {active.films.length>4?'The scene shows four stories; the complete collection is below.':''}</p>{active.films.length?<ul>{active.films.map(film=><li key={film.id}><button onClick={()=>onChoose('film:'+film.id)}><img src={film.poster} alt=""/><span>{film.title}<small>{durationLabel(film.duration)} · {film.status==='available'?'Available':'In development'}</small></span></button>{film.status==='available'&&film.src?<button aria-label={`Watch saved ${film.title}`} onClick={()=>onWatch(film)}><Play size={16} weight="fill"/></button>:<a href={href('/film/'+film.id)} aria-label={`About ${film.title}`}><ArrowUpRight size={17}/></a>}</li>)}</ul>:<a className="text-link" href={href('/world',{place:active.id})}>Find stories from {active.title}<ArrowUpRight size={16}/></a>}</div>}
  </div>;
}
