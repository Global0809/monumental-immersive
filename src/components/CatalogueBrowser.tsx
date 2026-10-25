import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Broadcast } from '@phosphor-icons/react/dist/csr/Broadcast';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { List } from '@phosphor-icons/react/dist/csr/List';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { SlidersHorizontal } from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { places, periods, videos, type Video } from '../data/catalogue';
import { categoryCopy, categoryMap } from '../data/categories';
import { filterVideos } from '../services/discovery';
import { go, href } from '../services/router';
import { updateViewer, useViewer } from '../services/viewer';
import { playSound } from '../services/audio';
import { notify } from '../services/feedback';
import FilmCard from './FilmCard';
import './catalogue-browser.css';
const CollectionTheater = lazy(() => import('./spatial/CollectionTheater'));

const names: Record<string,string> = { place:'Place',period:'Era',duration:'Length',access:'Access',q:'Search' };
export default function CatalogueBrowser({ category, params, onWatch, immersive = false, reducedMotion = false }: { category?: string; params: URLSearchParams; onWatch: (video: Video) => void; immersive?: boolean; reducedMotion?: boolean }) {
  const query = params.get('q') || '';
  const [draft,setDraft] = useState(query);
  const [composing,setComposing] = useState(false);
  const search = useRef<HTMLInputElement>(null);
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
  const filters = { q:query, place:params.get('place') || '', period:params.get('period') || '', access:params.get('access') || '', duration:params.get('duration') || '' };
  const results = filterVideos(filters,source);
  if(sort === 'title') results.sort((a,b)=>a.title.localeCompare(b.title));
  if(sort === 'newest') results.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  if(sort === 'shortest' || sort === 'longest') results.sort((a,b)=> {
    if(!a.duration && !b.duration) return 0;
    if(!a.duration) return 1; if(!b.duration) return -1;
    return sort === 'shortest' ? a.duration-b.duration : b.duration-a.duration;
  });
  const activeFilters = [...params.entries()].filter(([key,value])=>names[key] && value);
  const filterLabel = (key:string,value:string) => key === 'place' ? places.find(p=>p.id===value)?.name || value : key === 'period' ? periods.find(p=>p.id===value)?.label || value : key === 'duration' ? ({short:'Under 3 min',medium:'3–10 min',long:'10+ min'} as Record<string,string>)[value] || value : value;
  return <section className={`browse-page page-section ${hasTheater ? 'browse-page--theater' : ''}`}>
    <div className="page-title-row"><div><h1>{category || 'Discover.'}</h1><p>{category ? categoryCopy[category] : 'Every place, every sound, every story. Find your next connection.'}</p></div>{category && <button data-sound-owned className="button button-outline" aria-pressed={following} onClick={() => { updateViewer({interests:following?viewer.interests.filter(i=>i!==category):[...viewer.interests,category]}); playSound(following?'remove':'save'); notify(following?`Stopped following ${category}`:`${category} added to your interests`); }}>{following?<Check/>:<Plus/>}{following?'Following':'Follow category'}</button>}</div>
    {hasTheater && <Suspense fallback={<div className="collection-theater-loading" aria-label="Preparing the screening room"/>}><CollectionTheater category={category!} items={featured} onWatch={onWatch} reducedMotion={reducedMotion} onBrowse={() => { search.current?.closest('form')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' }); search.current?.focus({ preventScroll: true }); }}/></Suspense>}
    {hasTheater && <div className="spatial-collection-divider"><span>THE COLLECTION</span><span>{source.length} stories to discover</span></div>}
    <form className="search-field" onSubmit={e=>{e.preventDefault();if(composing)return;change('q',draft.trim());search.current?.focus();}}><MagnifyingGlass size={25}/><input ref={search} name="q" value={draft} onChange={e=>setDraft(e.target.value)} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setDraft(e.currentTarget.value);}} placeholder={category?`Search ${category.toLowerCase()}…`:'Search a city, artist, sound or story…'} aria-label="Search catalogue" autoComplete="off"/>{draft && <button type="button" className="search-clear" aria-label="Clear search" onClick={()=>{setDraft('');change('q','');search.current?.focus();}}><X size={20}/></button>}<button type="submit" className="button button-primary">Search <ArrowRight/></button></form>
    <div className="filter-row"><SlidersHorizontal size={19}/><label>Destination<select aria-label="Destination" value={filters.place} onChange={e=>{change('place',e.target.value);playSound('select');}}><option value="">Everywhere</option>{places.map(p=><option key={p.id} value={p.id}>{p.name} ({filterVideos({...filters,place:p.id},source).length})</option>)}</select></label><label>Era<select aria-label="Era" value={filters.period} onChange={e=>{change('period',e.target.value);playSound('era');}}><option value="">Any time</option>{periods.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label>Length<select aria-label="Length" value={filters.duration} onChange={e=>change('duration',e.target.value)}><option value="">Any length</option><option value="short">Under 3 min</option><option value="medium">3–10 min</option><option value="long">10+ min</option></select></label><label>Access<select aria-label="Access" value={filters.access} onChange={e=>change('access',e.target.value)}><option value="">All access</option><option value="free">Free</option><option value="premium">Premium plans</option></select></label>{activeFilters.length>0 && <button className="text-link" onClick={resetFilters}>Reset filters <X/></button>}</div>
    {activeFilters.length>0 && <div className="active-filters" role="group" aria-label="Active filters">{activeFilters.map(([key,value])=><button key={key} aria-label={`Remove ${names[key].toLowerCase()} filter`} onClick={()=>change(key,'')}><span>{names[key]}</span>{filterLabel(key,value)}<X size={12}/></button>)}</div>}
    <div className="results-line"><span role="status" aria-live="polite">{draft.trim()!==query?'Finding connections…':`${results.length} ${results.length===1?'story':'stories'}`}</span><div className="catalogue-tools"><label>Sort<select aria-label="Sort catalogue" value={sort} onChange={e=>change('sort',e.target.value==='curated'?'':e.target.value)}><option value="curated">Curated</option><option value="newest">Newest</option><option value="shortest">Shortest</option><option value="longest">Longest</option><option value="title">A–Z</option></select></label><div role="group" aria-label="Catalogue layout"><button aria-label="Grid view" aria-pressed={!list} onClick={()=>change('view','')}><SquaresFour size={18}/></button><button aria-label="List view" aria-pressed={list} onClick={()=>change('view','list')}><List size={18}/></button></div></div></div>
    {results.length?<div className={`film-grid ${list?'list-view':''}`} aria-label="Catalogue results">{results.map(v=><FilmCard key={v.id} video={v} onWatch={onWatch}/>)}</div>:<div className="empty-collection"><div className="empty-orbit" aria-hidden="true"><Broadcast weight="thin"/></div><h2>{source.length?'No signal here. Yet.':'THE NEXT CHAPTER.'}</h2><p>{source.length?'Try another destination, era or search term.':`Our ${category?.toLowerCase()} collection is being developed. Follow this category to save your interest in My World.`}</p>{source.length && <button className="button button-outline" onClick={resetFilters}>Clear these filters <X size={17}/></button>}<a className="button button-primary" href={href('/search')}>Explore available films <ArrowUpRight/></a></div>}
  </section>;
}
