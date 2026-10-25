import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { places, type Video } from '../../data/catalogue';
import { bridgeStories, playableStories } from '../../services/spatialDiscovery';
import { durationLabel } from '../../services/discovery';
import { href } from '../../services/router';
import { SaveButton } from '../FilmCard';
import './spatial-expansion.css';
export default function DestinationBridge({placeId,onWatch,onQueue}:{placeId:string;onWatch:(v:Video)=>void;onQueue?:(v:Video[],name:string)=>void}) {
  const [to,setTo]=useState(places.find(p=>p.id!==placeId)!.id),[index,setIndex]=useState(0),[pair,setPair]=useState(0);
  useEffect(()=>{setIndex(0);setPair(0);if(to===placeId)setTo(places.find(p=>p.id!==placeId)!.id);},[placeId,to]);
  const source=places.find(p=>p.id===placeId)||places[0], target=places.find(p=>p.id===to)!;
  const stories=playableStories().filter(v=>v.places.includes(source.id)), active=stories[index%Math.max(1,stories.length)];
  const bridges=bridgeStories(source.id,to), bridge=bridges[pair%Math.max(1,bridges.length)];
  return <section className="expansion-panel destination-bridge"><h2>TWO PLACES.<br/>ONE POSSIBLE THREAD.</h2><p>Choose another destination. See what the available stories share, then follow both perspectives.</p>
    <div className="bridge-stage"><figure><img src={source.image} alt={source.name}/><figcaption>{source.name}</figcaption></figure><svg viewBox="0 0 240 120" aria-hidden="true"><path d="M0 85Q120 -55 240 85"/><path d="M0 90Q120 25 240 90"/><circle r="5"><animateMotion dur="4s" repeatCount="indefinite" path="M0 85Q120 -55 240 85"/></circle></svg><figure><img src={target.image} alt={target.name}/><figcaption>{target.name}</figcaption></figure></div>
    <div className="expansion-controls"><label>Connect {source.name} to<select value={to} onChange={e=>{setTo(e.target.value);setPair(0);}}>{places.filter(p=>p.id!==source.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{bridges.length>1&&<button className="button button-outline" onClick={()=>setPair((pair+1)%bridges.length)}>Another connection<ArrowRight/></button>}<a className="expansion-link" href={href('/world',{place:to})}>Enter {target.name}<ArrowUpRight/></a></div>
    {bridge?<div className="bridge-explanation"><h3>{bridge.reason}</h3><p>{bridge.a.title} <span>↔</span> {bridge.b.title}</p><small>A catalogue relationship, not evidence of direct historical influence.</small><div className="expansion-actions"><button className="button button-primary" onClick={()=>onQueue?onQueue([bridge.a,bridge.b],`${source.name} to ${target.name}`):onWatch(bridge.a)}><Play/>Play this connection · {durationLabel(bridge.a.duration+bridge.b.duration)}</button></div></div>:<p className="expansion-empty">No supported connection between these available stories yet. Try another place or explore each destination directly.</p>}
    <div className="city-story-orbit"><div><h3>ORBIT {source.name.toUpperCase()}.</h3><p>Select a story to bring it forward.</p></div>{active?<><div className="city-story-fan">{stories.map((v,i)=><button key={v.id} onClick={()=>setIndex(i)} aria-pressed={i===index} style={{'--orbit-offset':i-index} as CSSProperties}><img src={v.poster} alt=""/><strong>{v.title}</strong><span>{durationLabel(v.duration)}</span></button>)}</div><div className="city-orbit-controls"><button aria-label="Previous city story" onClick={()=>setIndex((index+stories.length-1)%stories.length)}><ArrowLeft/></button><span aria-live="polite">{active.title}</span><button aria-label="Next city story" onClick={()=>setIndex((index+1)%stories.length)}><ArrowRight/></button></div><div className="expansion-actions"><button className="button button-primary" onClick={()=>onWatch(active)}><Play/>Watch this story</button><SaveButton video={active}/><a className="expansion-link" href={href('/film/'+active.id)}>Read the context<ArrowUpRight/></a></div></>:<p>No playable stories are available in this destination yet.</p>}</div>
  </section>;
}
