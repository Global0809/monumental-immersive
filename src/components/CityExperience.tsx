import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Cube } from '@phosphor-icons/react/dist/csr/Cube';
import { videos, type Video } from '../data/catalogue';
import { href } from '../services/router';
import { durationLabel } from '../services/discovery';
import { playSound } from '../services/audio';
import { SaveButton } from './FilmCard';
import type { CitySceneController } from './city-scene';
import './city-experience.css';

const locations = [
  { name: 'At the water’s edge', kind: 'Waterfront / rhythm', videoId: 'miami-frequency', detail: 'An imagined listening platform. Follow the movement of water into a short study of Miami as a meeting point.' },
  { name: 'A language of lines', kind: 'Design / Miami Beach', videoId: 'concrete-and-colour', detail: 'An architectural interpretation of curves, stepped silhouettes and symmetry. The attached study explores Miami Beach’s Art Deco context.' },
  { name: 'A place at the table', kind: 'Shared table / connection', videoId: 'shared-table', detail: 'A fictional gathering place for an abstract film about food and memory. No real restaurant, chef or tradition is depicted.' },
] as const;

function imageAsset(path: string) {
  const base = import.meta.env.BASE_URL;
  return path.startsWith('/') && base !== '/' && !path.startsWith(base) ? base + path.slice(1) : path;
}

export default function CityExperience({ placeId, reducedMotion, onWatch, openRequest = 0 }: { placeId: string; reducedMotion: boolean; onWatch: (video: Video) => void; openRequest?: number }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const canvasHost = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const markers = useRef<(HTMLButtonElement | null)[]>([]);
  const controller = useRef<CitySceneController | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const handledRequest = useRef(0);
  const activeLocation = selected === null ? null : locations[selected];
  const film = activeLocation ? videos.find(video => video.id === activeLocation.videoId) : undefined;

  useEffect(() => {
    setOpen(false); setSelected(null);
    if (placeId !== 'miami') return;
    const enter = () => { setOpen(true); setTimeout(() => heading.current?.focus({ preventScroll: true }), 0); };
    window.addEventListener('monumental:step-inside', enter);
    return () => window.removeEventListener('monumental:step-inside', enter);
  }, [placeId]);

  useEffect(() => {
    if (placeId !== 'miami' || openRequest <= handledRequest.current) return;
    handledRequest.current = openRequest;
    setOpen(true);
    const frame = requestAnimationFrame(() => {
      document.getElementById('city-experience')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
      heading.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [openRequest, placeId, reducedMotion]);

  useEffect(() => {
    if (!open || !canvasHost.current || placeId !== 'miami') return;
    let disposed = false;
    setReady(false); setUnavailable(false);
    const host = canvasHost.current;
    import('./city-scene').then(({ createCityScene }) => {
      if (disposed) return;
      controller.current = createCityScene(host, {
        reducedMotion,
        onSelect: (index) => { setSelected(index); playSound('select'); },
        onProject: (index, x, y, visible) => {
          const marker = markers.current[index];
          if (!marker) return;
          marker.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
          marker.style.visibility = visible ? 'visible' : 'hidden';
        },
        onUnavailable: () => { if (!disposed) setUnavailable(true); },
      });
      controller.current.select(selectedRef.current, true);
      setReady(true);
    }).catch(() => { if (!disposed) setUnavailable(true); });
    return () => { disposed = true; controller.current?.dispose(); controller.current = null; };
    // Selection is updated separately; changing a stop must not recreate the renderer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placeId, reducedMotion]);

  useEffect(() => { controller.current?.select(selected); }, [selected]);

  if (placeId !== 'miami') return null;
  const select = (index: number | null) => { setSelected(index); playSound('select'); };
  const close = () => { setOpen(false); setSelected(null); playSound('close'); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); };

  return <section id="city-experience" className={`city-experience ${open ? 'is-open' : ''}`} aria-labelledby="city-title" onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(); } }}>
    <div className="city-intro">
      <div><h2 id="city-title">A CITY.<br/><span>THREE WAYS IN.</span></h2><p>Leave the globe for a miniature Miami interpretation. Choose a place. Find the story inside it.</p></div>
      <button ref={trigger} className="button button-outline city-enter" aria-expanded={open} aria-controls="city-workspace" onClick={() => { if (open) close(); else { setOpen(true); playSound('destination'); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); } }}><Cube size={22}/>{open ? 'Return to globe' : 'Step inside Miami'}<ArrowUpRight size={19}/></button>
    </div>
    {open && <div id="city-workspace" className="city-workspace">
      <header className="city-workspace-header"><div><h3 ref={heading} tabIndex={-1}>MIAMI, AT HUMAN SCALE.</h3><p>Illustrated interpretation · Three conceptual places, not a map of real venues.</p></div><button className="text-link" onClick={close}><ArrowLeft/>Back to globe</button></header>
      <nav className="city-breadcrumb" aria-label="Exploration scale"><button onClick={close}>Planet</button><span aria-hidden="true">/</span><button aria-current={selected === null ? 'step' : undefined} onClick={() => select(null)}>Miami</button>{activeLocation && <><span aria-hidden="true">/</span><span aria-current="step">{activeLocation.name}</span></>}{film && <><span aria-hidden="true">/</span><a href={href('/film/' + film.id)}>Story <ArrowUpRight size={12}/></a></>}</nav>
      <div className="city-spatial-layout">
        <div className={`city-scene ${unavailable ? 'is-unavailable' : ''}`}>
          <div className="city-canvas" ref={canvasHost} aria-hidden="true"/>
          {!unavailable && <div className="city-hotspots" role="group" aria-label="Places in the miniature">{locations.map((location, index) => <button ref={element => { markers.current[index] = element; }} key={location.videoId} style={{ visibility: 'hidden' }} className={selected === index ? 'is-selected' : ''} aria-label={`Explore ${location.name}`} aria-pressed={selected === index} onClick={() => select(index)}><i aria-hidden="true"/><span>{location.kind.split(' / ')[0]}</span></button>)}</div>}
          <div className="city-scene-corner"><span>MIAMI / INTERPRETATION</span><button onClick={() => { select(null); controller.current?.select(null); }} aria-label="Reset miniature to overview">Overview <ArrowUpRight size={14}/></button></div>
          {unavailable ? <p className="city-scene-fallback" role="status">The spatial view is unavailable on this device.<br/>Explore all three places using the list below.</p> : !ready ? <p className="city-scene-fallback" role="status">Building your miniature…</p> : <p className="city-scene-help">Drag to orbit · Select a red marker<br/><span>The same places are listed below.</span></p>}
        </div>
        <aside className="city-story" aria-live="polite">
          {film && activeLocation ? <><div className="city-story-image"><img src={imageAsset(film.poster)} alt=""/><span>Original motion study</span></div><div className="city-story-copy"><span className="city-story-location">{activeLocation.kind}</span><h4>{film.title}</h4><p>{activeLocation.detail}</p><span className="city-story-meta">{durationLabel(film.duration)} · {film.category} · Free</span><div className="city-story-actions"><button className="button button-primary" onClick={() => onWatch(film)}><Play weight="fill"/>Play story</button><SaveButton video={film}/></div><a className="text-link" href={href('/film/' + film.id)}>Context & credits <ArrowUpRight/></a></div></> : <div className="city-story-empty"><Cube size={42} weight="thin"/><h4>THE WORLD<br/>GETS CLOSER.</h4><p>At this scale, culture begins with a place: a waterfront, a facade, a table.</p><p>Select a marker or a place below to discover its connected film.</p><button className="text-link" onClick={() => select(0)}>Begin at the water <ArrowRight/></button></div>}
        </aside>
      </div>
      <div className="city-location-list" role="group" aria-label="Explore Miami places">{locations.map((location, index) => <button key={location.videoId} aria-pressed={selected === index} className={selected === index ? 'is-selected' : ''} onClick={() => select(index)}><span className="city-location-number">0{index + 1}</span><span><strong>{location.name}</strong><small>{location.kind}</small></span><ArrowUpRight size={20}/></button>)}</div>
      <p className="city-provenance">This authored miniature connects three available preview studies. It depicts no real venue or person. The design study concerns Miami Beach, a separate municipality within Greater Miami.</p>
    </div>}
  </section>;
}
