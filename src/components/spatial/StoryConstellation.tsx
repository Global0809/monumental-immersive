import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { ArrowsLeftRight } from '@phosphor-icons/react/dist/csr/ArrowsLeftRight';
import { places, type Video } from '../../data/catalogue';
import { durationLabel } from '../../services/discovery';
import { connectionReason } from '../../services/spatialDiscovery';
import { href } from '../../services/router';
import { SaveButton } from '../FilmCard';
import './spatial-expansion.css';
export default function StoryConstellation({items,onWatch}:{items:Video[];onWatch:(v:Video)=>void}) {
  const [id,setId]=useState(items[0]?.id||'');
  const [rotation,setRotation]=useState(0);
  const [compare,setCompare]=useState(false);
  const [otherId,setOtherId]=useState('');
  const orbit=useRef<HTMLDivElement>(null);
  const active=items.find(v=>v.id===id)||items[0];
  useEffect(()=>{const el=orbit.current, card=el?.querySelector<HTMLElement>('[aria-pressed="true"]');if(el&&card&&matchMedia('(max-width:760px)').matches)el.scrollTo({left:Math.max(0,card.offsetLeft-el.clientWidth/2+card.offsetWidth/2),behavior:document.documentElement.dataset.motion==='reduced'?'instant':'smooth'});},[active?.id]);
  if(!active)return null;
  const index=items.indexOf(active), other=items.find(v=>v.id===otherId&&v.id!==active.id)||items.find(v=>v.id!==active.id);
  const visibleItems=items.slice(Math.floor(index/20)*20,Math.floor(index/20)*20+20);
  const choose=(step:number)=>setId(items[(index+step+items.length)%items.length].id);
  return <section className="story-constellation expansion-panel" aria-label="Spatial film collection">
    <div className="expansion-controls"><button className="button button-outline" onClick={()=>choose(-1)} aria-label="Previous constellation story"><ArrowLeft/></button><span aria-live="polite">{index+1} / {items.length} stories</span><button className="button button-outline" onClick={()=>choose(1)} aria-label="Next constellation story"><ArrowRight/></button><label>Turn the collection<input type="range" min="-35" max="35" value={rotation} onChange={e=>setRotation(Number(e.target.value))}/></label><button className="button button-outline" disabled={!other} aria-expanded={compare} onClick={()=>setCompare(!compare)}><ArrowsLeftRight/> {compare?'Close comparison':'Compare two films'}</button></div>
    <div className="constellation-universe"><div ref={orbit} className="constellation-orbit" style={{'--orbit-turn':`${rotation}deg`} as CSSProperties}>
      <svg viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">{visibleItems.map((v,i)=>{const angle=i/visibleItems.length*Math.PI*2;return <path key={v.id} d={`M500 250L${500+Math.cos(angle)*380} ${250+Math.sin(angle)*180}`} className={v.id===active.id||connectionReason(active,v)?'connected':''}/>;})}</svg>
      {visibleItems.map((v,i)=>{const angle=i/visibleItems.length*Math.PI*2;return <button key={v.id} className="constellation-star" style={{left:`${50+Math.cos(angle)*38}%`,top:`${50+Math.sin(angle)*36}%`,'--star-depth':v.id===active.id?'65px':'0px'} as CSSProperties} aria-pressed={v.id===active.id} onClick={()=>setId(v.id)}><img src={v.poster} alt=""/><span>{v.title}</span></button>;})}
      <span className="constellation-center">FOLLOW<br/>YOUR CURIOSITY</span>
    </div></div>
    <div className={compare?'expansion-split':'constellation-single'}>{[active,...(compare&&other?[other]:[])].map((v,i)=><article className="expansion-detail" key={i}>{i===1&&<label>Compare with<select aria-label="Compare with film" value={other!.id} onChange={e=>setOtherId(e.target.value)}>{items.filter(v=>v.id!==active.id).map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>}<small>{v.category} · {v.duration?durationLabel(v.duration):'In development'}</small><h3>{v.title}</h3><p>{v.description}</p><p>{v.places.map(id=>places.find(p=>p.id===id)?.name).join(' / ')||'Independent cinema'}</p><div className="expansion-actions">{v.status==='available'&&v.src&&<button className="button button-primary" onClick={()=>onWatch(v)}><Play/> Watch</button>}<SaveButton video={v}/><a href={href('/film/'+v.id)} className="expansion-link">Story details<ArrowUpRight/></a></div></article>)}</div>
    {compare&&other&&<p className="expansion-note">{connectionReason(active,other)||'Two different perspectives. No documented catalogue relationship is available.'} · These connections describe catalogue themes, not a claim of historical influence.</p>}
    <p className="expansion-note">Select a poster or use Previous / Next. The ordinary grid and list remain available above.</p>
  </section>;
}
