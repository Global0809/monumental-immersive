import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Broadcast } from '@phosphor-icons/react/dist/csr/Broadcast';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { List } from '@phosphor-icons/react/dist/csr/List';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { SlidersHorizontal } from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { places, periods, videos, type Video } from '../data/catalogue';
import { categoryCopy, categoryMap } from '../data/categories';
import { durationLabel, filterVideos } from '../services/discovery';
import { go, href } from '../services/router';
import { updateViewer, usePersistentStorage, useViewer } from '../services/viewer';
import { playSound } from '../services/audio';
import { notify } from '../services/feedback';
import FilmCard, { SaveButton } from './FilmCard';
import './catalogue-browser.css';
const CollectionTheater = lazy(() => import('./spatial/CollectionTheater'));

const names: Record<string,string> = { place:'Place',period:'Era',duration:'Length',access:'Access',q:'Search',status:'Availability' };
export default function CatalogueBrowser({ category, params, onWatch, immersive = false, reducedMotion = false }: { category?: string; params: URLSearchParams; onWatch: (video: Video) => void; immersive?: boolean; reducedMotion?: boolean }) {
  const query = params.get('q') || '';
  const [draft,setDraft] = useState(query);
  const [composing,setComposing] = useState(false);
  const [pickedId,setPickedId] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const pickTrigger = useRef<HTMLButtonElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ownNavigation = useRef<string | null>(null);
  const route = category ? '/category/' + category.toLowerCase() : '/search';
  const paramKey = params.toString();
  const source = category ? videos.filter(video => (categoryMap[category] || []).includes(video.category)) : videos;
  const featured = source.filter(video => video.status === 'available' && video.access === 'free' && !!video.src);
  const hasTheater = immersive && !!category && featured.length > 0;
  const sort = params.get('sort') || 'curated';
  const list = params.get('view') === 'list';
  const viewer = useViewer();
  const persistentStorage = usePersistentStorage();
  const following = !!category && viewer.interests.includes(category);
  function navigate(next: Record<string,string>) {
    ownNavigation.current = href(route,next);
    go(route,next);
  }
  function change(key: string,value: string) {
    const next=Object.fromEntries(params);
    if(key === 'q') { clearTimeout(searchTimer.current); setDraft(value); }
    if(value) next[key]=value; else delete next[key];
    navigate(next);
  }
  function resetFilters() {
    clearTimeout(searchTimer.current); setDraft('');
    navigate(Object.fromEntries([...params].filter(([key]) => key === 'view' || key === 'sort')));
  }
  useEffect(() => {
    // Local filter changes preserve unfinished typing. Back/forward restores the URL's query.
    const isOwnChange = ownNavigation.current === href(route,Object.fromEntries(params));
    ownNavigation.current = null;
    if (!isOwnChange) setDraft(query);
  },[paramKey,route]);
  useEffect(() => {
    if (composing || draft.trim() === query) return;
    searchTimer.current = setTimeout(() => {
      const next = Object.fromEntries(new URLSearchParams(paramKey));
      const text = draft.trim();
      if (text) next.q = text; else delete next.q;
      // A URL acknowledgement must not overwrite characters typed after this commit.
      setDraft(current => current === draft ? text : current);
      navigate(next);
    }, 280);
    return () => clearTimeout(searchTimer.current);
  },[draft,query,paramKey,route,composing]);
  const filters = { q:query, place:params.get('place') || '', period:params.get('period') || '', access:params.get('access') || '', duration:params.get('duration') || '', status:params.get('status') || '' };
  const destinationOptions = places.map(place => ({ ...place, count: filterVideos({ ...filters, place: place.id }, source).length }));
  const showDestinationFilter = Boolean(filters.place) || destinationOptions.some(place => place.count > 0);
  const results = filterVideos(filters,source);
  if(sort === 'title') results.sort((a,b)=>a.title.localeCompare(b.title));
  if(sort === 'newest') results.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  if(sort === 'shortest' || sort === 'longest') results.sort((a,b)=> {
    if(!a.duration && !b.duration) return 0;
    if(!a.duration) return 1; if(!b.duration) return -1;
    return sort === 'shortest' ? a.duration-b.duration : b.duration-a.duration;
  });
  const activeFilters = [...params.entries()].filter(([key,value])=>names[key] && value);
  const filterLabel = (key:string,value:string) => key === 'place' ? places.find(p=>p.id===value)?.name || value : key === 'period' ? periods.find(p=>p.id===value)?.label || value : key === 'duration' ? ({short:'Under 3 min',medium:'3–10 min',long:'10+ min'} as Record<string,string>)[value] || value : key === 'status' ? value === 'available' ? 'Ready to watch' : value === 'development' ? 'In development' : value : value;
  const picks = results.filter(video => video.status === 'available' && video.access === 'free' && video.src);
  const picked = picks.find(video => video.id === pickedId);
  const followControl = category && <button data-sound-owned className="button button-outline" aria-pressed={following} onClick={() => { updateViewer({interests:following?viewer.interests.filter(i=>i!==category):[...viewer.interests,category]}); playSound(following?'remove':'save'); notify(following?`Stopped following ${category}`:`${category} added to your interests`); }}>{following?<Check/>:<Plus/>}{following?'Following':'Follow category'}</button>;
  const relaxations = results.length ? [] : activeFilters.map(([key]) => ({ key, count: filterVideos({...filters,[key]:''},source).length })).filter(item => item.count > 0).slice(0, 3);
  const suggestedRooms = Object.entries(categoryMap).map(([name,categories]) => ({name,items:videos.filter(video => categories.includes(video.category) && video.status === 'available' && video.access === 'free' && video.src)})).filter(room => room.items.length);
  const shortcut = (next: Record<string,string>) => { clearTimeout(searchTimer.current); setDraft(next.q || ''); navigate(next); playSound('select'); };

  if (category && source.length === 0) return <section className="browse-page page-section browse-page--planning">
    <div className="page-title-row"><div><h1>{category}</h1><p>{categoryCopy[category]}</p></div>{followControl}</div>
    <div className="category-development"><span className="status-label">In development</span><h2>A new room.<br/>A story still unfolding.</h2><p>{category === 'Kids' ? 'This collection will open only after its programming has been reviewed for age suitability. There are no approved children’s films to play here yet.' : `There are no approved ${category.toLowerCase()} titles in this preview yet. Follow the category to keep it in your interests, or explore an available collection below.`}</p><p className="category-local-note">{following ? `${category} is in your interests. ` : ''}{persistentStorage ? 'Following is saved in this browser' : 'Following lasts for this visit because browser storage is unavailable'}; it does not subscribe you to notifications.</p><a className="text-link" href={href('/')}>Return to the observatory <ArrowUpRight size={17}/></a></div>
    {category !== 'Kids' && <section className="category-open-rooms" aria-label="Available collections"><div><h3>Meanwhile, the world is open.</h3><span>Available in the preview collection</span></div><div>{suggestedRooms.map(room => <a key={room.name} href={href('/category/' + room.name.toLowerCase())}><img src={room.items[0].poster} alt="" loading="lazy"/><span><strong>{room.name}</strong><small>{room.items.length} ready to watch</small></span><ArrowUpRight size={19}/></a>)}</div></section>}
  </section>;
  return <section className={`browse-page page-section ${hasTheater ? 'browse-page--theater' : ''}`}>
    <div className="page-title-row"><div><h1>{category || 'Discover.'}</h1><p>{category ? categoryCopy[category] : 'Every place, every sound, every story. Find your next connection.'}</p></div>{followControl}</div>
    {hasTheater && <Suspense fallback={<div className="collection-theater-loading" aria-label="Preparing the screening room"/>}><CollectionTheater category={category!} items={featured} onWatch={onWatch} reducedMotion={reducedMotion} onBrowse={() => { search.current?.closest('form')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' }); search.current?.focus({ preventScroll: true }); }}/></Suspense>}
    {hasTheater && <div className="spatial-collection-divider"><span>THE COLLECTION</span><span>{source.length} stories to discover</span></div>}
    <form className="search-field" onSubmit={e=>{e.preventDefault();if(composing)return;change('q',draft.trim());search.current?.focus();}}><MagnifyingGlass size={25}/><input ref={search} name="q" value={draft} onChange={e=>setDraft(e.target.value)} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setDraft(e.currentTarget.value);}} placeholder={category?`Search ${category.toLowerCase()}…`:'Search a city, artist, sound or story…'} aria-label="Search catalogue" autoComplete="off"/>{draft && <button type="button" className="search-clear" aria-label="Clear search" onClick={()=>{setDraft('');change('q','');search.current?.focus();}}><X size={20}/></button>}<button type="submit" className="button button-primary">Search <ArrowRight/></button></form>
    {!category && <div className="catalogue-starting-points"><span>Find your way in</span><button onClick={()=>shortcut({status:'available',duration:'short',access:'free'})}>Under 3 minutes</button><button onClick={()=>shortcut({status:'available',q:'full film',access:'free'})}>A complete film</button><button onClick={()=>shortcut({status:'available',q:'music'})}>Follow a sound</button><button ref={pickTrigger} onClick={()=>{ if (picks.length) {setPickedId(picks[(picks.findIndex(item=>item.id===pickedId)+1)%picks.length].id);playSound('select');}}} disabled={!picks.length}>{picked ? 'Pick another story' : 'Pick a story for me'} <ArrowRight size={13}/></button></div>}
    {!category && <span className="catalogue-announcement" role="status">{picked ? `Selected ${picked.title}, ${durationLabel(picked.duration)}. Play or save it in Your discovery.` : ''}</span>}
    {!category && picked && <article className="catalogue-picked-story" aria-label="Your discovery"><img src={picked.poster} alt=""/><div><span>{picked.tags.includes('motion study')?'Motion study':picked.tags.includes('full film')?'Complete film':picked.tags.includes('trailer')?'Official trailer':picked.category} / {durationLabel(picked.duration)}</span><h2>{picked.title}</h2><p>{picked.description}</p><div><button className="button button-primary" onClick={()=>onWatch(picked)}><Play size={15} weight="fill"/>Watch this story</button><SaveButton video={picked} small/><a className="text-link" href={href('/film/'+picked.id)}>Story & credits <ArrowUpRight size={16}/></a></div></div><button className="catalogue-pick-dismiss" aria-label="Dismiss story suggestion" onClick={()=>{setPickedId('');pickTrigger.current?.focus();}}><X size={18}/></button></article>}
    <div className="filter-row"><SlidersHorizontal size={19}/>{showDestinationFilter && <label>Destination<select aria-label="Destination" value={filters.place} onChange={e=>{change('place',e.target.value);playSound('select');}}><option value="">Everywhere</option>{destinationOptions.map(p=><option key={p.id} value={p.id}>{p.name} ({p.count})</option>)}</select></label>}<label>Era<select aria-label="Era" value={filters.period} onChange={e=>{change('period',e.target.value);playSound('era');}}><option value="">Any time</option>{periods.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label>Length<select aria-label="Length" value={filters.duration} onChange={e=>change('duration',e.target.value)}><option value="">Any length</option><option value="short">Under 3 min</option><option value="medium">3–10 min</option><option value="long">10+ min</option></select></label><label>Availability<select aria-label="Availability" value={filters.status} onChange={e=>change('status',e.target.value)}><option value="">All stories</option><option value="available">Ready to watch</option><option value="development">In development</option></select></label><label>Access<select aria-label="Access" value={filters.access} onChange={e=>change('access',e.target.value)}><option value="">All access</option><option value="free">Free</option><option value="premium">Premium plans</option></select></label>{activeFilters.length>0 && <button className="text-link" onClick={resetFilters}>Reset filters <X/></button>}</div>
    {activeFilters.length>0 && <div className="active-filters" role="group" aria-label="Active filters">{activeFilters.map(([key,value])=><button key={key} aria-label={`Remove ${names[key].toLowerCase()} filter`} onClick={()=>change(key,'')}><span>{names[key]}</span>{filterLabel(key,value)}<X size={12}/></button>)}</div>}
    <div className="results-line"><span role="status" aria-live="polite">{draft.trim()!==query?'Finding connections…':`${results.length} ${results.length===1?'story':'stories'}`}</span><div className="catalogue-tools"><label>Sort<select aria-label="Sort catalogue" value={sort} onChange={e=>change('sort',e.target.value==='curated'?'':e.target.value)}><option value="curated">Curated</option><option value="newest">Newest</option><option value="shortest">Shortest</option><option value="longest">Longest</option><option value="title">A–Z</option></select></label><div role="group" aria-label="Catalogue layout"><button aria-label="Grid view" aria-pressed={!list} onClick={()=>change('view','')}><SquaresFour size={18}/></button><button aria-label="List view" aria-pressed={list} onClick={()=>change('view','list')}><List size={18}/></button></div></div></div>
    {results.length?<div className={`film-grid ${list?'list-view':''}`} aria-label="Catalogue results">{results.map(v=><FilmCard key={v.id} video={v} onWatch={onWatch}/>)}</div>:<div className="empty-collection"><div className="empty-orbit" aria-hidden="true"><Broadcast weight="thin"/></div><h2>No stories match these filters.</h2><p>Try a different combination, or remove one filter below.</p>{relaxations.length > 0 && <div className="catalogue-filter-recovery">{relaxations.map(item=><button key={item.key} onClick={()=>change(item.key,'')}>Remove {names[item.key].toLowerCase()} <span>{item.count} {item.count===1?'story':'stories'}</span><ArrowRight size={14}/></button>)}</div>}<button className="button button-outline" onClick={resetFilters}>Clear these filters <X size={17}/></button><a className="button button-primary" href={href('/search',{status:'available'})}>Explore available films <ArrowUpRight/></a></div>}
  </section>;
}
