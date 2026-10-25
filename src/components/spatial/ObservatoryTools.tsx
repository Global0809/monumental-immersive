import { useState } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { PushPin } from '@phosphor-icons/react/dist/csr/PushPin';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { spatialPortals, setSpatialFocus, rotateSpatialWorld, requestSpatialTravel } from '../../services/spatial';
import { useSpatialPreferences, setSpatialPreferences } from '../../services/spatialPreferences';
import { go, href } from '../../services/router';
import { playSound } from '../../services/audio';
import './spatial-expansion.css';

const positions = [[18,70],[18,35],[39,17],[61,17],[82,35],[82,70]];
export default function ObservatoryTools() {
  const prefs = useSpatialPreferences();
  const [selected, setSelected] = useState(0);
  const [tour, setTour] = useState(false);
  const active = spatialPortals[selected];
  const choose = (i: number) => { setSelected(i); setSpatialFocus(spatialPortals[i].id); playSound('select'); };
  const enter = () => { if (!requestSpatialTravel(active.id)) go(active.route); };
  const pinned = prefs.pinned.includes(active.id);
  return <section className="observatory-tools page-section" aria-labelledby="observatory-tools-title">
    <div className="expansion-heading"><h2 id="observatory-tools-title">THE SPACE<br/><span>IS IN YOUR HANDS.</span></h2><p>Look beneath the surface. Choose your light. Find a doorway worth keeping.</p></div>
    <div className="observatory-console">
      <div className="observatory-map" aria-label="Observatory floor plan">
        <svg viewBox="0 0 600 420" aria-hidden="true"><ellipse cx="300" cy="225" rx="235" ry="175"/><ellipse cx="300" cy="225" rx="155" ry="110"/><path d="M255 420V340 M345 420V340 M300 90V160 M130 200L230 225 M470 200L370 225"/><circle cx="300" cy="225" r="52"/>{positions.map(([x,y],i)=><path key={i} className={selected===i?'active':''} d={`M300 225L${x*6} ${y*4.2}`}/>)}</svg>
        <span className="observatory-map-center">MONUMENTAL<br/>OBSERVATORY</span>
        {spatialPortals.map((portal,i)=><button key={portal.id} style={{left:`${positions[i][0]}%`,top:`${positions[i][1]}%`}} aria-pressed={selected===i} onClick={()=>choose(i)} onFocus={()=>setSpatialFocus(portal.id)}><span>{String(i+1).padStart(2,'0')}</span>{portal.title}{prefs.pinned.includes(portal.id)&&<PushPin size={12}/>}</button>)}
        <small>Spatial guide · select a room</small>
      </div>
      <div className="observatory-control-panel">
        <div className="expansion-choice" role="group" aria-label="Observatory camera">{(['gallery','overhead'] as const).map(view=><button key={view} aria-pressed={prefs.view===view} onClick={()=>setSpatialPreferences({view})}>{view==='gallery'?'Inside the gallery':'Overhead view'}</button>)}</div>
        <button className="expansion-toggle" aria-pressed={prefs.cutaway} onClick={()=>setSpatialPreferences({cutaway:!prefs.cutaway})}>Reveal the framework <span>{prefs.cutaway?'On':'Off'}</span></button>
        <label className="expansion-range">Room illumination <output>{prefs.light}%</output><input aria-label="Room illumination" type="range" min="15" max="100" value={prefs.light} onChange={e=>setSpatialPreferences({light:Number(e.target.value)})}/></label>
        <div className="observatory-selected" aria-live="polite"><h3>{active.title}</h3><p>{active.description}</p><div className="expansion-actions"><button className="button button-primary" onClick={enter}>Enter this room <ArrowUpRight/></button><button className="button button-outline" aria-pressed={pinned} onClick={()=>setSpatialPreferences({pinned:pinned?prefs.pinned.filter(id=>id!==active.id):[...prefs.pinned,active.id]})}>{pinned?<Check/>:<PushPin/>}{pinned?'Pinned':'Pin doorway'}</button></div></div>
        <button className="text-link" aria-expanded={tour} onClick={()=>{setTour(!tour);if(!tour)choose(0);}}>{tour?'Close room tour':'Take a guided room tour'} <ArrowUpRight/></button>
        {tour&&<div className="observatory-tour"><button aria-label="Previous tour room" onClick={()=>{choose((selected+5)%6);rotateSpatialWorld(-.16);}}><ArrowLeft/></button><span>Room {selected+1} of 6 · {active.title}</span><button aria-label="Next tour room" onClick={()=>{choose((selected+1)%6);rotateSpatialWorld(.16);}}><ArrowRight/></button></div>}
      </div>
    </div>
    {!!prefs.pinned.length&&<nav className="pinned-doorways" aria-label="Pinned doorways"><span>Your doorways</span>{prefs.pinned.map(id=>{const p=spatialPortals.find(p=>p.id===id)!;return <a key={id} href={href(p.route)}>{p.title}<ArrowUpRight/></a>;})}<small>Kept on this browser</small></nav>}
  </section>;
}
