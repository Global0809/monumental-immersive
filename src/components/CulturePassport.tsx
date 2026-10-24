import { useState } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { BookmarkSimple } from '@phosphor-icons/react/dist/csr/BookmarkSimple';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { GlobeHemisphereWest } from '@phosphor-icons/react/dist/csr/GlobeHemisphereWest';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { places, videos, type Video } from '../data/catalogue';
import { useViewer, togglePlace } from '../services/viewer';
import { href } from '../services/router';
import { playSound } from '../services/audio';
import { notify } from '../services/feedback';
import './culture-passport.css';

export default function CulturePassport({ onWatch }: { onWatch: (v: Video) => void }) {
  const viewer = useViewer();
  const [selected,setSelected] = useState<string | null>(null);
  const place = places.find(p => p.id === selected);
  const visited = (id: string) => videos.some(v => v.places.includes(id) && viewer.history[v.id]?.time > 0);
  const collection = place ? videos.filter(v => v.places.includes(place.id) && v.status === 'available') : [];
  return <section className="culture-passport" aria-labelledby="passport-heading"><div className="passport-introduction"><div><h2 id="passport-heading">CULTURE<br/>PASSPORT.</h2><p>Places collected. Connections made.</p></div><span className="passport-counter"><GlobeHemisphereWest weight="thin"/><strong>{String(places.filter(p => visited(p.id) || viewer.savedPlaces.includes(p.id)).length).padStart(2,'0')}</strong><span>OF 06 PLACES<br/>IN YOUR WORLD</span></span></div>
    <div className="passport-cards">{places.map((p,i) => {
      const explored = visited(p.id), saved = viewer.savedPlaces.includes(p.id), collected = explored || saved;
      return <button className={`passport-card ${collected ? 'is-collected' : ''}`} key={p.id} data-sound-owned aria-pressed={selected === p.id} aria-expanded={selected === p.id} aria-controls="passport-detail" onClick={() => { setSelected(v => v === p.id ? null : p.id); playSound(selected === p.id ? 'close' : 'destination',{intensity:.55,pan:(i/5-.5)*1.2}); }}><img src={p.image} alt="" loading="lazy"/><span className="passport-card-top"><small>{String(i+1).padStart(2,'0')} / MONUMENTAL</small>{collected ? <Check size={17}/> : <Plus size={17}/>}</span><span className="passport-seal" aria-hidden="true"><GlobeHemisphereWest weight="thin"/><span>{explored ? 'EXPLORED' : saved ? 'COLLECTED' : 'DISCOVER'}</span></span><strong>{p.name}</strong><span className="passport-card-state">{explored ? 'Explored through film' : saved ? 'On your map' : 'A new connection awaits'}</span></button>;
    })}</div>
    <div id="passport-detail" className={`passport-detail ${place ? 'is-open' : ''}`}>
      {place && <><div className="passport-detail-place"><span>{place.country}</span><h3>{place.name}</h3><p>{place.tagline}</p><div><a className="text-link" href={href('/world',{place:place.id})}>Explore destination <ArrowUpRight size={17}/></a><button data-sound-owned className="text-link" onClick={() => { const added = togglePlace(place.id); playSound(added ? 'save' : 'remove'); notify(added ? `${place.name} added to your map` : `${place.name} removed from your map`, 'Undo', () => { const restored = togglePlace(place.id); playSound(restored ? 'save' : 'remove'); }); }}>{viewer.savedPlaces.includes(place.id) ? <Check size={16}/> : <BookmarkSimple size={16}/>} {viewer.savedPlaces.includes(place.id) ? 'Remove from map' : 'Collect this place'}</button></div></div><div className="passport-detail-stories">{collection.slice(0,3).map(video => <button key={video.id} onClick={() => onWatch(video)}><img src={video.poster} alt=""/><span><small>{viewer.history[video.id]?.completed ? 'Watched' : viewer.saved.includes(video.id) ? 'Saved for later' : 'Discover this story'}</small><strong>{video.title}</strong></span><Play weight="fill" size={17}/></button>)}</div></>}
    </div>
    <p className="passport-local-note">Your passport reflects films you’ve started and places you’ve saved in this browser. Tap a place to follow its stories.</p>
  </section>;
}
