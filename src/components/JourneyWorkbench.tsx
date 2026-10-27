import { useEffect, useMemo, useRef, useState } from 'react';
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
import { places, videos, type Video } from '../data/catalogue';
import { buildJourney, durationLabel } from '../services/discovery';
import { createJourney, getViewer, updateJourney, MAX_SAVED_JOURNEYS } from '../services/viewer';
import { emptyJourneyDraft, journeyMoods as moods, readJourneyDraft, writeJourneyDraft, type JourneyDraft } from '../services/journeyDraft';
import { playSound } from '../services/audio';
import { notify } from '../services/feedback';
import { go, href, readRoute, useRoute } from '../services/router';
import './journey-workbench.css';
import JourneyTimeline from './spatial/JourneyTimeline';
import { connectionReason, decodeItinerary } from '../services/spatialDiscovery';
gsap.registerPlugin(Flip);

function loadDraft(editingId = readRoute().params.get('edit')): JourneyDraft {
  const shared = decodeItinerary(readRoute().params);
  if (shared) return { ...emptyJourneyDraft(), ...shared, generated: true };
  const draft = readJourneyDraft();
  if (!editingId || draft?.editingId === editingId) return draft || emptyJourneyDraft();
  const saved = getViewer().journeys.find(journey => journey.id === editingId);
  if (!saved) return draft || emptyJourneyDraft();
  const playable = saved.videoIds.map(id => videos.find(video => video.id === id)).filter((video): video is Video => Boolean(video && video.status === 'available' && video.access === 'free' && video.src));
  const minutes = [1, 5, 15, 30].find(value => value * 60 >= playable.reduce((sum, video) => sum + video.duration, 0)) || 30;
  return { ...emptyJourneyDraft(), name: saved.name, videoIds: playable.map(video => video.id), generated: true, editingId: saved.id, minutes, journeyMinutes: minutes };
}
export default function JourneyWorkbench({ onPlayJourney }: { onPlayJourney: (videos: Video[], name: string) => void }) {
  const [draft, setDraft] = useState<JourneyDraft>(() => loadDraft());
  const { mood, minutes, journeyMinutes, place, name, generated, emptied, editingId } = draft;
  const journey = useMemo(() => draft.videoIds.map(id => videos.find(video => video.id === id)).filter((video): video is Video => Boolean(video)), [draft.videoIds]);
  const patch = (next: Partial<JourneyDraft>) => setDraft(previous => ({ ...previous, ...next }));
  const [saved, setSaved] = useState(false);
  const [draftStored, setDraftStored] = useState(true);
  const [draftMessage, setDraftMessage] = useState('');
  const [active, setActive] = useState(0);
  const { params } = useRoute();
  const requestedEdit = params.get('edit');
  const sharedKey = params.get('stops');
  const sharedName = params.get('name');
  const requestedPlace = params.get('place');
  useEffect(() => {
    if (requestedEdit || sharedKey) return;
    const destination = places.find(candidate => candidate.id === requestedPlace);
    if (!destination) return;
    setDraft(previous => ({ ...previous, place: destination.id }));
    setDraftMessage(`Starting in ${destination.name}. Choose Find my journey to connect a new route. Any existing draft remains below.`);
  }, [requestedPlace, requestedEdit, sharedKey]);
  useEffect(() => { const shared=decodeItinerary(params); if(shared){setDraft({...emptyJourneyDraft(),...shared,generated:true});setSaved(false);setActive(0);setDraftMessage('A shared itinerary, copied into your own editable draft.');} }, [sharedKey, sharedName]);
  const dragFrom = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const revealResult = useRef(false);
  const reorderMotion = useRef<gsap.core.Timeline | null>(null);
  const motionContext = useRef<gsap.Context | null>(null);
  useEffect(() => { motionContext.current = gsap.context(() => {}, root); return () => { reorderMotion.current?.kill(); motionContext.current?.revert(); }; }, []);
  useEffect(() => { setDraftStored(writeJourneyDraft(draft)); }, [draft]);
  useEffect(() => {
    if (!revealResult.current) return;
    // Let the same-route query cleanup and the router's scroll restoration settle
    // before taking the visitor to the route they just generated.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        revealResult.current = false;
        const target = resultHeading.current ?? root.current?.querySelector<HTMLElement>('.empty-inline');
        if (target) {
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: 'start', behavior: document.documentElement.dataset.motion === 'reduced' ? 'instant' : 'smooth' });
        }
      });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [draft.videoIds, requestedEdit, sharedKey, requestedPlace]);
  useEffect(() => {
    if (!requestedEdit) return;
    if (!getViewer().journeys.some(journey => journey.id === requestedEdit)) { setDraftMessage('That saved journey is no longer available. Your current draft is still here.'); return; }
    setDraft(loadDraft(requestedEdit)); setSaved(false); setActive(0); setDraftMessage('Editing a saved journey. Changes are kept as a local draft until you save.');
  }, [requestedEdit]);
  const total = journey.reduce((sum, video) => sum + video.duration, 0);
  const journeyPlaces = [...new Set(journey.flatMap(v => v.places))].map(id => places.find(p => p.id === id)!).filter(Boolean);
  function generate(surprise = false) {
    revealResult.current = true;
    const nextMood = surprise ? moods[Math.floor(Math.random() * moods.length)] : mood;
    const nextPlace = surprise ? places[Math.floor(Math.random() * places.length)].id : place;
    patch({ mood: nextMood, place: nextPlace, videoIds: buildJourney(nextMood, minutes, nextPlace).map(video => video.id), journeyMinutes: minutes, name: `${nextMood} from ${places.find(p => p.id === nextPlace)?.name}`, generated: true, emptied: false, editingId: null });
    if (requestedEdit || sharedKey || requestedPlace) go('/journey');
    setSaved(false); setActive(0); setDraftMessage('A new route is ready. Rearrange the stops to make it yours.'); playSound('destination');
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= journey.length || from === to) return;
    const next = [...journey]; const [item] = next.splice(from,1); next.splice(to,0,item);
    reorderMotion.current?.kill();
    const calm = document.documentElement.dataset.motion === 'reduced';
    const before = !calm ? Flip.getState(root.current?.querySelectorAll('.journey-stop') || []) : null;
    flushSync(() => { patch({ videoIds: next.map(video => video.id) }); setSaved(false); setActive(to); });
    if (before) motionContext.current?.add(() => { reorderMotion.current = Flip.from(before, { duration: .42, ease: 'power3.out', scale: true, onComplete: () => { reorderMotion.current = null; } }); });
    playSound('tick');
    notify(`${item.title} moved to stop ${to + 1}`);
  }
  function removeStop(video: Video, index: number) {
    const previousIds = draft.videoIds;
    const next = previousIds.filter(id => id !== video.id);
    patch({ videoIds: next, emptied: next.length === 0 }); setSaved(false); setActive(Math.min(active, Math.max(0, next.length - 1)));
    playSound('remove');
    notify(`${video.title} removed from this draft`, 'Undo', () => {
      setDraft(current => {
        if (current.videoIds !== next || current.videoIds.includes(video.id)) return current;
        const restored = [...current.videoIds]; restored.splice(Math.min(index, restored.length), 0, video.id);
        return { ...current, videoIds: restored, emptied: false };
      }); setSaved(false);
    });
  }
  function save(asCopy = false) {
    const updating = editingId && !asCopy;
    const result = updating ? updateJourney(editingId, name, draft.videoIds) : createJourney(name, draft.videoIds);
    if (!result) { notify(updating ? 'The original journey was removed elsewhere. Use Save as new to keep this draft.' : `You have ${MAX_SAVED_JOURNEYS} saved journeys. Remove one in My World, then save again.`); return; }
    patch({ editingId: result.id }); setSaved(true); playSound('save'); notify(updating ? 'Journey updated in My World' : 'Journey saved to My World');
    if (sharedKey || (requestedEdit && requestedEdit !== result.id)) go('/journey', { edit: result.id });
  }
  function startNew() {
    const previous = draft, empty = emptyJourneyDraft();
    setDraft(empty); setSaved(false); setActive(0); setDraftMessage('A fresh draft is ready. Saved journeys in My World are unchanged.');
    if (requestedEdit || sharedKey || requestedPlace) go('/journey');
    notify('Started a new draft', 'Undo', () => setDraft(current => current === empty ? previous : current));
  }
  return <section className="journey-page page-section" ref={root}>
    <div className="page-title-row"><div><h1>TAKE ME<br/><span>SOMEWHERE.</span></h1><p>Choose your time. We’ll connect the stories.<br/>Then shape the order, give it a name and make it yours.</p></div><Compass className="journey-compass" weight="thin"/></div>
    <div className="journey-builder">
      <label>I have<select aria-label="Journey duration" value={minutes} onChange={e => patch({ minutes: Number(e.target.value) })}>{[1,5,15,30].map(m => <option key={m} value={m}>{m} {m === 1 ? 'minute' : 'minutes'}</option>)}</select></label>
      <label>I’m in the mood for<select aria-label="Journey mood" value={mood} onChange={e => patch({ mood: e.target.value })}>{moods.map(m => <option key={m}>{m}</option>)}</select></label>
      <label>Starting in<select aria-label="Journey starting place" value={place} onChange={e => patch({ place: e.target.value })}>{places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button data-sound-owned className="button button-primary" onClick={() => generate()}>Find my journey <ArrowUpRight/></button>
    </div>
    <div className="journey-builder-note"><p>We begin with your interests, then connect you to other free films that fit your time.</p><button data-sound-owned className="text-link" onClick={() => generate(true)}><Shuffle size={18}/> Surprise me</button></div>
    <div className="journey-draft-status"><p role="status">{draftMessage || (generated ? 'Your unfinished journey is ready to continue.' : 'Build a route, then shape the order of its stories.')} <span>{draftStored ? 'Draft kept in this browser.' : 'Draft kept for this visit; browser storage is unavailable.'}</span></p>{generated && <button className="text-link" onClick={startNew}>Start a new draft <Plus size={16}/></button>}</div>
    {!generated && <div className="journey-invitation" aria-hidden="true"><span>ONE FILM</span><div className="journey-invitation-thread"/><span>LEADS TO ANOTHER.</span></div>}
    {generated && journey.length === 0 && <div className="empty-inline" tabIndex={-1}><h2>{emptied ? 'Your journey is empty.' : 'No films fit this time yet.'}</h2><p>{emptied ? 'You’ve removed every stop. Find a new route when you’re ready.' : 'Choose a longer duration to build your journey.'}</p>{emptied && <button className="button button-outline" data-sound-owned onClick={() => generate()}>Find another journey <ArrowUpRight/></button>}</div>}
    {journey.length > 0 && <div className="journey-results">
      <div className="journey-manifest-heading"><div><h2 ref={resultHeading} tabIndex={-1}>Your journey, connected.</h2><p>{journey.length} stories · {Math.floor(total / 60)} min {Math.round(total % 60)} sec of viewing{journeyPlaces.length > 0 ? ` · ${journeyPlaces.length} places` : ''}</p></div><div><span>Within your {journeyMinutes}-minute window</span><div className="journey-duration-track" aria-label={`${Math.round(total)} seconds of ${journeyMinutes * 60} seconds available`}><i style={{ scale: `${Math.min(total / (journeyMinutes * 60),1)} 1` }}/></div><small>Only available stories. No padding.</small></div></div>
      {journeyPlaces.length > 0 && <div className="journey-place-thread" aria-label="Places in this journey">{journeyPlaces.map((p,i) => <a key={p.id} href={href('/world',{place:p.id})}><img src={p.image} alt=""/><span>{p.name}</span>{i < journeyPlaces.length-1 && <ArrowUpRight/>}</a>)}</div>}
      <div className="journey-edit-bar"><label>Give your journey a name<input aria-label="Journey name" value={name} maxLength={80} onChange={e => { patch({ name: e.target.value }); setSaved(false); }}/></label><span>Drag to reorder, or use the arrows.</span></div>
      <details className="journey-pacing"><summary>Shape the pace &amp; share your journey <Plus size={18}/></summary><JourneyTimeline items={journey} name={name} active={active} onSelect={setActive} onMove={move}/></details>
      <ol className="journey-stops">{journey.map((video,i) => <li className={`journey-stop ${active === i ? 'is-active' : ''} ${dragging === i ? 'is-dragging' : ''}`} key={video.id} draggable onDragStart={e => { dragFrom.current = i; setDragging(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain',video.id); }} onDragEnd={() => { dragFrom.current = null; setDragging(null); }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={e => { e.preventDefault(); if (dragFrom.current !== null) move(dragFrom.current,i); dragFrom.current = null; setDragging(null); }} onPointerEnter={() => setActive(i)} onFocusCapture={() => setActive(i)}>
        <span className="journey-stop-number">{String(i + 1).padStart(2,'0')}</span><span className="journey-drag-icon" aria-hidden="true"><DotsSixVertical size={20}/></span><a className="journey-stop-picture" aria-label={`Details: ${video.title}`} href={href('/film/' + video.id)} draggable={false}><img src={video.poster} alt="" draggable={false}/></a><div className="journey-stop-info"><small>{video.category} / {durationLabel(video.duration)}</small><a href={href('/film/' + video.id)}>{video.title}</a><span>{video.places.map(id => places.find(p => p.id === id)?.name).join(' → ') || 'Independent cinema'}</span><p className="journey-stop-connection">{i === 0 ? 'Your opening story' : connectionReason(journey[i - 1], video) || 'Another available story within your time'}</p></div><div className="journey-reorder"><button data-sound-owned disabled={i === 0} aria-label={`Move ${video.title} up`} onClick={() => move(i,i-1)}><ArrowUp size={17}/></button><button data-sound-owned disabled={i === journey.length - 1} aria-label={`Move ${video.title} down`} onClick={() => move(i,i+1)}><ArrowDown size={17}/></button></div><button className="journey-remove" aria-label={`Remove ${video.title} from journey`} onClick={() => removeStop(video, i)}><X size={17}/></button>
      </li>)}</ol>
      <div className="journey-departure"><button className="button button-primary" onClick={() => onPlayJourney(journey,name.trim() || 'My cultural journey')}><Play weight="fill"/> Play entire journey</button><button data-sound-owned className="button button-outline" disabled={saved} onClick={() => save()}>{saved ? <Check/> : <Plus/>}{saved ? 'Saved to My World' : editingId ? 'Update saved journey' : 'Save journey'}</button>{editingId && <button className="text-link journey-copy-save" onClick={() => save(true)}>Save as new</button>}<span>Free films. Your chosen order.<br/>You can pause or skip any stop.</span></div>
    </div>}
  </section>;
}
