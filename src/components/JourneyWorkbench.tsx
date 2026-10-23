import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Compass } from '@phosphor-icons/react/dist/csr/Compass';
import { DotsSixVertical } from '@phosphor-icons/react/dist/csr/DotsSixVertical';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Shuffle } from '@phosphor-icons/react/dist/csr/Shuffle';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { places, type Video } from '../data/catalogue';
import { buildJourney, durationLabel } from '../services/discovery';
import { createJourney, MAX_SAVED_JOURNEYS } from '../services/viewer';
import { playSound } from '../services/audio';
import { notify } from '../services/feedback';
import { href } from '../services/router';
import './journey-workbench.css';
gsap.registerPlugin(Flip);

const moods = ['Music', 'Culture', 'Fashion', 'Film', 'Art & Design', 'Food'];
export default function JourneyWorkbench({ onPlayJourney }: { onPlayJourney: (videos: Video[], name: string) => void }) {
  const [mood, setMood] = useState('Music');
  const [minutes, setMinutes] = useState(5);
  const [journeyMinutes, setJourneyMinutes] = useState(5);
  const [place, setPlace] = useState('miami');
  const [journey, setJourney] = useState<Video[]>([]);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [emptied, setEmptied] = useState(false);
  const [active, setActive] = useState(0);
  const dragFrom = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const reorderMotion = useRef<gsap.core.Timeline | null>(null);
  useEffect(() => () => { reorderMotion.current?.kill(); }, []);
  const total = journey.reduce((sum, video) => sum + video.duration, 0);
  const journeyPlaces = [...new Set(journey.flatMap(v => v.places))].map(id => places.find(p => p.id === id)!).filter(Boolean);
  function generate(surprise = false) {
    const nextMood = surprise ? moods[Math.floor(Math.random() * moods.length)] : mood;
    const nextPlace = surprise ? places[Math.floor(Math.random() * places.length)].id : place;
    if (surprise) { setMood(nextMood); setPlace(nextPlace); }
    setJourney(buildJourney(nextMood, minutes, nextPlace));
    setJourneyMinutes(minutes);
    setName(`${nextMood} from ${places.find(p => p.id === nextPlace)?.name}`);
    setSaved(false); setGenerated(true); setEmptied(false); setActive(0); playSound('destination');
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= journey.length || from === to) return;
    const next = [...journey]; const [item] = next.splice(from,1); next.splice(to,0,item);
    reorderMotion.current?.kill();
    const calm = document.documentElement.dataset.motion === 'reduced';
    const before = !calm ? Flip.getState(root.current?.querySelectorAll('.journey-stop') || []) : null;
    flushSync(() => { setJourney(next); setSaved(false); setActive(to); });
    if (before) reorderMotion.current = Flip.from(before, { duration: .42, ease: 'power3.out', scale: true, onComplete: () => { reorderMotion.current = null; } });
    playSound('tick');
    notify(`${item.title} moved to stop ${to + 1}`);
  }
  return <section className="journey-page page-section" ref={root}>
    <div className="page-title-row"><div><h1>TAKE ME<br/><span>SOMEWHERE.</span></h1><p>A little time. A little curiosity. A journey made from real films in the collection.</p></div><Compass className="journey-compass" weight="thin"/></div>
    <div className="journey-builder">
      <label>I have<select aria-label="Journey duration" value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{[1,5,15,30].map(m => <option key={m} value={m}>{m} {m === 1 ? 'minute' : 'minutes'}</option>)}</select></label>
      <label>I’m in the mood for<select aria-label="Journey mood" value={mood} onChange={e => setMood(e.target.value)}>{moods.map(m => <option key={m}>{m}</option>)}</select></label>
      <label>Starting in<select aria-label="Journey starting place" value={place} onChange={e => setPlace(e.target.value)}>{places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button data-sound-owned className="button button-primary" onClick={() => generate()}>Find my journey <ArrowUpRight/></button>
    </div>
    <div className="journey-builder-note"><p>We begin with your interests, then connect you to other free films that fit your time.</p><button data-sound-owned className="text-link" onClick={() => generate(true)}><Shuffle size={18}/> Surprise me</button></div>
    {!generated && <div className="journey-invitation" aria-hidden="true"><span>ONE FILM</span><div className="journey-invitation-thread"/><span>LEADS TO ANOTHER.</span></div>}
    {generated && journey.length === 0 && <div className="empty-inline"><h2>{emptied ? 'Your journey is empty.' : 'No films fit this time yet.'}</h2><p>{emptied ? 'You’ve removed every stop. Find a new route when you’re ready.' : 'Choose a longer duration to build your journey.'}</p>{emptied && <button className="button button-outline" data-sound-owned onClick={() => generate()}>Find another journey <ArrowUpRight/></button>}</div>}
    {journey.length > 0 && <div className="journey-results">
      <div className="journey-manifest-heading"><div><span className="journey-manifest-label">YOUR CULTURAL ITINERARY</span><h2>{durationLabel(total).toUpperCase()}.<br/><span>{journey.length} DIFFERENT PERSPECTIVES.</span></h2></div><div><span>{journeyPlaces.length} connected places</span><div className="journey-duration-track" aria-label={`${Math.round(total)} seconds of ${journeyMinutes * 60} seconds available`}><i style={{ scale: `${Math.min(total / (journeyMinutes * 60),1)} 1` }}/></div><small>Built for {journeyMinutes} {journeyMinutes === 1 ? 'minute' : 'minutes'}</small></div></div>
      {journeyPlaces.length > 0 && <div className="journey-place-thread" aria-label="Places in this journey">{journeyPlaces.map((p,i) => <a key={p.id} href={href('/world',{place:p.id})}><img src={p.image} alt=""/><span>{p.name}</span>{i < journeyPlaces.length-1 && <ArrowUpRight/>}</a>)}</div>}
      <div className="journey-edit-bar"><label>Give your journey a name<input aria-label="Journey name" value={name} maxLength={80} onChange={e => { setName(e.target.value); setSaved(false); }}/></label><span>Drag to reorder, or use the arrows.</span></div>
      <ol className="journey-stops">{journey.map((video,i) => <li className={`journey-stop ${active === i ? 'is-active' : ''} ${dragging === i ? 'is-dragging' : ''}`} key={video.id} draggable onDragStart={e => { dragFrom.current = i; setDragging(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain',video.id); }} onDragEnd={() => { dragFrom.current = null; setDragging(null); }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={e => { e.preventDefault(); if (dragFrom.current !== null) move(dragFrom.current,i); dragFrom.current = null; setDragging(null); }} onPointerEnter={() => setActive(i)} onFocusCapture={() => setActive(i)}>
        <span className="journey-stop-number">{String(i + 1).padStart(2,'0')}</span><span className="journey-drag-icon" aria-hidden="true"><DotsSixVertical size={20}/></span><a className="journey-stop-picture" aria-label={`Details: ${video.title}`} href={href('/film/' + video.id)} draggable={false}><img src={video.poster} alt="" draggable={false}/></a><div className="journey-stop-info"><small>{video.category} / {durationLabel(video.duration)}</small><a href={href('/film/' + video.id)}>{video.title}</a><span>{video.places.map(id => places.find(p => p.id === id)?.name).join(' → ') || 'Independent cinema'}</span></div><div className="journey-reorder"><button data-sound-owned disabled={i === 0} aria-label={`Move ${video.title} up`} onClick={() => move(i,i-1)}><ArrowUp size={17}/></button><button data-sound-owned disabled={i === journey.length - 1} aria-label={`Move ${video.title} down`} onClick={() => move(i,i+1)}><ArrowDown size={17}/></button></div><button className="journey-remove" aria-label={`Remove ${video.title} from journey`} onClick={() => { if(journey.length === 1) setEmptied(true); setJourney(items => items.filter(v => v.id !== video.id)); setSaved(false); }}><X size={17}/></button>
      </li>)}</ol>
      <div className="journey-departure"><button className="button button-primary" onClick={() => onPlayJourney(journey,name.trim() || 'My cultural journey')}><Play weight="fill"/> Play entire journey</button><button data-sound-owned className="button button-outline" disabled={saved} onClick={() => { const created = createJourney(name,journey.map(v => v.id)); if (!created) { notify(`You have ${MAX_SAVED_JOURNEYS} saved journeys. Remove one in My World, then save again.`); return; } setSaved(true); playSound('save'); notify('Journey saved to My World'); }}>{saved ? <Check/> : <Plus/>}{saved ? 'Saved to My World' : 'Save journey'}</button><span>Free films. Your chosen order.<br/>You can pause or skip any stop.</span></div>
    </div>}
  </section>;
}
