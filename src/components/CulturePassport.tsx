import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { BookmarkSimple } from '@phosphor-icons/react/dist/csr/BookmarkSimple';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { GlobeHemisphereWest } from '@phosphor-icons/react/dist/csr/GlobeHemisphereWest';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { places, videos, type Video } from '../data/catalogue';
import { getViewer, updateViewer, useViewer, togglePlace } from '../services/viewer';
import { href } from '../services/router';
import { playSound } from '../services/audio';
import { notify } from '../services/feedback';
import './culture-passport.css';

export default function CulturePassport({ onWatch }: { onWatch: (v: Video) => void }) {
  const viewer = useViewer();
  const cards = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const revealFrame = useRef(0);
  const detailId = useId();
  const [selected,setSelected] = useState<string | null>(null);
  const place = places.find(p => p.id === selected);
  const started = (id: string) => videos.some(v => v.places.includes(id) && (viewer.history[v.id]?.time > 0 || viewer.history[v.id]?.completed));
  const watched = (id: string) => videos.some(v => v.places.includes(id) && viewer.history[v.id]?.completed);
  const collection = place ? videos.filter(v => v.places.includes(place.id) && v.status === 'available' && v.access === 'free' && Boolean(v.src)) : [];
  useEffect(() => () => cancelAnimationFrame(revealFrame.current), []);
  function selectPlace(id: string, index: number, pointerClick: boolean) {
    const next = selected === id ? null : id;
    setSelected(next); playSound(next ? 'destination' : 'close', { intensity: .55, pan: (index / Math.max(1, places.length - 1) - .5) * 1.2 });
    cancelAnimationFrame(revealFrame.current);
    if (next && pointerClick) revealFrame.current = requestAnimationFrame(() => {
      const bounds = detail.current?.getBoundingClientRect();
      if (bounds && bounds.top > window.innerHeight - 180) detail.current?.scrollIntoView({ behavior: document.documentElement.dataset.motion === 'reduced' ? 'instant' : 'smooth', block: 'center' });
    });
  }
  function closeDetail() { const index = places.findIndex(place => place.id === selected); setSelected(null); cards.current?.querySelectorAll('button')[index]?.focus({ preventScroll: true }); }
  function collect(id: string, name: string) {
    const added = togglePlace(id); playSound(added ? 'save' : 'remove');
    notify(added ? `${name} added to your map` : `${name} removed from your map`, 'Undo', () => {
      // If another control already changed this place, keep that newer decision.
      if (getViewer().savedPlaces.includes(id) !== added) return;
      updateViewer(state => ({ savedPlaces: added ? state.savedPlaces.filter(placeId => placeId !== id) : [...state.savedPlaces, id] }));
      playSound(added ? 'remove' : 'save');
    });
  }
  return <section className="culture-passport" aria-labelledby={detailId + '-heading'}><div className="passport-introduction"><div><h2 id={detailId + '-heading'}>CULTURE<br/>PASSPORT.</h2><p>Places collected. Connections made.</p></div><span className="passport-counter"><GlobeHemisphereWest weight="thin"/><strong>{String(places.filter(p => started(p.id) || viewer.savedPlaces.includes(p.id)).length).padStart(2,'0')}</strong><span>OF {String(places.length).padStart(2,'0')} PLACES<br/>IN YOUR WORLD</span></span></div>
    <div ref={cards} className="passport-cards" onKeyDown={event => { const buttons = Array.from(cards.current?.querySelectorAll('button') || []); const index = buttons.indexOf(event.target as HTMLButtonElement); if (index < 0) return; const next = event.key === 'ArrowRight' ? (index + 1) % buttons.length : event.key === 'ArrowLeft' ? (index + buttons.length - 1) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1; if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); } if (event.key === 'Escape') { setSelected(null); } }}>{places.map((p,i) => {
      const begun = started(p.id), finished = watched(p.id), saved = viewer.savedPlaces.includes(p.id), collected = begun || saved;
      return <button className={`passport-card ${collected ? 'is-collected' : ''}`} key={p.id} data-sound-owned aria-pressed={selected === p.id} aria-expanded={selected === p.id} aria-controls={detailId} onClick={event => selectPlace(p.id, i, event.detail > 0)}><img src={p.image} alt="" loading="lazy"/><span className="passport-card-top"><small>{String(i+1).padStart(2,'0')} / MONUMENTAL</small>{collected ? <Check size={17}/> : <Plus size={17}/>}</span><span className="passport-seal" aria-hidden="true"><GlobeHemisphereWest weight="thin"/><span>{finished ? 'WATCHED' : begun ? 'STARTED' : saved ? 'SAVED' : 'DISCOVER'}</span></span><strong>{p.name}</strong><span className="passport-card-state">{finished ? 'Watched a story' : begun ? 'Started a story' : saved ? 'Saved place' : 'Find a story'}</span></button>;
    })}</div>
    <div ref={detail} id={detailId} className={`passport-detail ${place ? 'is-open' : ''}`} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeDetail(); } }}>
      {place && <button className="passport-close" onClick={closeDetail} aria-label="Close destination details"><X size={18}/></button>}
      {place && <><div className="passport-detail-place"><span>{place.country}</span><h3>{place.name}</h3><p>{place.tagline}</p><div><a className="text-link" href={href('/world',{place:place.id})}>Explore destination <ArrowUpRight size={17}/></a><button data-sound-owned className="text-link" onClick={() => collect(place.id, place.name)}>{viewer.savedPlaces.includes(place.id) ? <Check size={16}/> : <BookmarkSimple size={16}/>} {viewer.savedPlaces.includes(place.id) ? 'Remove from map' : 'Collect this place'}</button></div></div><div className="passport-detail-stories">{collection.slice(0,3).map(video => <button key={video.id} onClick={() => onWatch(video)}><img src={video.poster} alt=""/><span><small>{viewer.history[video.id]?.completed ? 'Watched' : viewer.saved.includes(video.id) ? 'Saved for later' : 'Discover this story'}</small><strong>{video.title}</strong></span><Play weight="fill" size={17}/></button>)}</div></>}
    </div>
    <p className="passport-local-note">Your passport reflects films you’ve started and places you’ve saved in this browser. Tap a place to follow its stories.</p>
  </section>;
}
