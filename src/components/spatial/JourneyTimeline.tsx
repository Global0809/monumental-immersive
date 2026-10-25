import { useState, type CSSProperties } from 'react';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Link } from '@phosphor-icons/react/dist/csr/Link';
import { type Video } from '../../data/catalogue';
import { encodeItinerary } from '../../services/spatialDiscovery';
import { durationLabel } from '../../services/discovery';
import './spatial-expansion.css';
export default function JourneyTimeline({items,name,active,onSelect,onMove}:{items:Video[];name:string;active:number;onSelect:(i:number)=>void;onMove:(a:number,b:number)=>void}){
  const [copy,setCopy]=useState(''),[link,setLink]=useState('');
  let elapsed=0;const stops=items.map(v=>{const start=elapsed;elapsed+=v.duration;return {v,start};});
  async function share(){const url=new URL(location.href);url.hash='/journey?'+encodeItinerary(name,items.map(v=>v.id));setLink(url.href);try{await navigator.clipboard.writeText(url.href);setCopy('Link copied. The recipient gets an independent itinerary.');}catch{setCopy('Select and copy the itinerary link below.');}}
  return <section className="expansion-panel journey-spatial-timeline"><h3>SEE THE PACE OF YOUR JOURNEY.</h3><p>Longer stories occupy more distance. Select a stop to reposition it.</p><div className="journey-time-track">{stops.map(({v,start},i)=><button key={v.id} aria-pressed={i===active} style={{'--stop-length':`${Math.max(100,v.duration*1.7)}px`,'--stop-rise':`${i===active?-12:0}px`} as CSSProperties} onClick={()=>onSelect(i)}><small>{Math.floor(start/60)}:{String(Math.floor(start%60)).padStart(2,'0')}</small><img src={v.poster} alt=""/><strong>{v.title}</strong><span>{durationLabel(v.duration)}</span></button>)}</div><div className="expansion-controls"><button className="button button-outline" disabled={active<=0} onClick={()=>onMove(active,active-1)}><ArrowLeft/>Earlier</button><span aria-live="polite">{items[active]?.title}</span><button className="button button-outline" disabled={active>=items.length-1} onClick={()=>onMove(active,active+1)}>Later<ArrowRight/></button><button className="button button-outline" onClick={share}><Link/>Copy journey link</button></div><p className="expansion-note">The link contains only the journey title and up to 20 film IDs. It is a snapshot, not an account or synced public profile. Very short films have a minimum width for touch.</p>{copy&&<div className="journey-share-result"><p role="status">{copy}</p><input aria-label="Shareable itinerary link" readOnly value={link} onFocus={e=>e.currentTarget.select()}/></div>}</section>;
}
