import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { CornersOut } from '@phosphor-icons/react/dist/csr/CornersOut';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { videos, type Video } from '../../data/catalogue';
import { href } from '../../services/router';
import { playSound } from '../../services/audio';
import { enterSpatialWorld, spatialPortals, useSpatial } from '../../services/spatial';
import { getTunnelInspection, setTunnelFrame, setTunnelInspection, setTunnelPanels, subscribeTunnelInspection, tunnelChapterZ, tunnelCompact, TUNNEL_CHAPTER_UNITS, TUNNEL_HERO_UNITS } from '../../services/tunnelJourney';
import './tunnel-journey.css';

gsap.registerPlugin(ScrollTrigger);
const asset = (url: string) => url.startsWith('/') ? `${import.meta.env.BASE_URL}${url.slice(1)}` : url;
const chapters = [
  { lines: ['EVERY PLACE.', 'AN OPEN DOOR.'], copy: 'A story can take you somewhere. Turn the globe, choose a destination and meet the people making its culture.', action: 'Explore the world', feature: 'miami-frequency', detail: 'MIAMI → THE WORLD', object: 'A planet of possibilities' },
  { lines: ['THE PAST.', 'STILL IN MOTION.'], copy: 'Move through cultural moments. Follow the music, images and ideas that keep finding new life.', action: 'Enter the Time Machine', feature: 'break-beat-city', detail: 'THEN ↔ NOW', object: 'An archive without an ending' },
  { lines: ['LIGHTS DOWN.', 'WORLDS OPEN.'], copy: 'Independent films and extraordinary perspectives. Find a story, take your seat and stay a little longer.', action: 'Enter the cinema', feature: 'sintel', detail: 'INDEPENDENT FILM', object: 'A window into another world' },
  { lines: ['FOLLOW', 'THE FREQUENCY.'], copy: 'Every sound comes from somewhere. Trace a rhythm back to its people, its streets and its story.', action: 'Explore music', feature: 'island-current', detail: 'SOUND → PLACE → PEOPLE', object: 'Culture has a resonance' },
  { lines: ['LIFE.', 'IN EVERY FORM.'], copy: 'Art on the street. Food around a shared table. Culture lives in the things we make together.', action: 'Discover culture', feature: 'concrete-and-colour', detail: 'ART / FOOD / PEOPLE', object: 'Many perspectives. One connection.' },
  { lines: ['BRING', 'SOMETHING BACK.'], copy: 'Keep the stories that stay with you. Collect places, make a journey and build a world that is yours.', action: 'Open My World', feature: 'tokyo-in-motion', detail: 'YOUR COLLECTION', object: 'Your own Monumental' },
];

function Station({ index, onWatch, compact, reducedMotion }: { index: number; onWatch: (video: Video) => void; compact: boolean; reducedMotion: boolean }) {
  const inspection = useSyncExternalStore(subscribeTunnelInspection, getTunnelInspection);
  const chapter = chapters[index], portal = spatialPortals[index];
  const expanded = inspection.station === portal.id && inspection.expanded;
  const panel = useRef<HTMLElement>(null), inspectionToggle = useRef<HTMLButtonElement>(null), pointerFrame = useRef(0), pointerBounds = useRef<DOMRect | null>(null);
  const film = videos.find(video => video.id === chapter.feature && video.status === 'available');
  const inspectionId = `tunnel-inspection-${portal.id}`;
  function clearReflection() {
    cancelAnimationFrame(pointerFrame.current);
    pointerBounds.current = null;
    if (!panel.current) return;
    panel.current.style.setProperty('--panel-pointer-x', '0');
    panel.current.style.setProperty('--panel-pointer-y', '0');
    panel.current.removeAttribute('data-reflecting');
  }
  function reflect(event: PointerEvent<HTMLElement>) {
    if (compact || reducedMotion || event.pointerType !== 'mouse') return;
    const bounds = pointerBounds.current ??= event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height) * 2 - 1));
    cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = requestAnimationFrame(() => {
      if (!panel.current) return;
      panel.current.dataset.reflecting = 'true';
      panel.current.style.setProperty('--panel-pointer-x', String(x));
      panel.current.style.setProperty('--panel-pointer-y', String(y));
    });
  }
  useEffect(() => { clearReflection(); return () => cancelAnimationFrame(pointerFrame.current); }, [compact, reducedMotion]);
  function toggleInspection() {
    setTunnelInspection({ station: expanded ? null : portal.id, expanded: !expanded, rotation: 0 });
    playSound('select');
  }
  function turnSculpture(direction: number) {
    setTunnelInspection({ station: portal.id, expanded: true, rotation: Math.max(-Math.PI, Math.min(Math.PI, inspection.rotation + direction * Math.PI / 6)) });
    playSound('sculpture-turn');
  }
  return <article ref={panel} className="tunnel-panel" data-expanded={expanded} data-inspection-mode={compact ? 'story' : 'sculpture'} aria-labelledby={`tunnel-heading-${portal.id}`}
    onPointerMove={reflect} onPointerLeave={clearReflection} onPointerCancel={clearReflection} onKeyDown={event => { if (event.key === 'Escape' && expanded) { toggleInspection(); inspectionToggle.current?.focus(); event.stopPropagation(); } }}>
    <div className="tunnel-panel-back" aria-hidden="true"/><div className="tunnel-panel-edge" aria-hidden="true"/>
    <div className="tunnel-material-reflection" aria-hidden="true"/>
    <div className="tunnel-panel-top"><span><b>{String(index + 1).padStart(2, '0')}</b>{portal.title}</span><button ref={inspectionToggle} onClick={toggleInspection} aria-expanded={expanded} aria-controls={inspectionId} aria-label={`${expanded ? 'Close' : 'Inspect'} ${portal.title} exhibit`}><CornersOut size={16}/><span>{expanded ? 'CLOSE EXHIBIT' : 'INSPECT'}</span></button></div>
    <div className="tunnel-panel-heading"><h2 id={`tunnel-heading-${portal.id}`}>{chapter.lines[0]}<br/><span>{chapter.lines[1]}</span></h2></div>
    <div className="tunnel-panel-copy"><p>{chapter.copy}</p><a className="tunnel-enter-room" href={href(portal.route)}>{chapter.action}<ArrowUpRight size={22}/></a></div>
    <div id={inspectionId} className="tunnel-inspection" hidden={!expanded}>
      <div className="tunnel-inspection-heading"><h3>{chapter.object}</h3>{!compact && <span aria-hidden="true">{Math.round(inspection.rotation * 180 / Math.PI)}°</span>}</div>
      {compact ? <p>{film?.description ?? portal.description}</p> : <div className="tunnel-inspection-controls" role="group" aria-label={`Rotate ${portal.title} sculpture`}>
        <span>TURN THE SCULPTURE</span>
        <button onClick={() => turnSculpture(-1)} disabled={inspection.rotation <= -Math.PI} aria-label={`Rotate ${portal.title} sculpture left`}><ArrowLeft size={18}/></button>
        <button onClick={() => turnSculpture(1)} disabled={inspection.rotation >= Math.PI} aria-label={`Rotate ${portal.title} sculpture right`}><ArrowRight size={18}/></button>
        <button className="tunnel-inspection-reset" onClick={() => { setTunnelInspection({ station: portal.id, expanded: true, rotation: 0 }); playSound('select'); }} disabled={Math.abs(inspection.rotation) < .001}><ArrowCounterClockwise size={16}/><span>Reset</span></button>
      </div>}
    </div>
    {film && <button className="tunnel-story" onClick={() => onWatch(film)} data-cursor="PLAY" aria-label={`Play ${film.title}`}>
      <span className="tunnel-story-image"><img src={asset(film.poster)} alt="" loading="lazy" decoding="async"/><span><Play size={18} weight="fill"/></span></span>
      <span className="tunnel-story-copy"><small>PREVIEW FILM · {Math.round(film.duration)} SEC</small><strong>{film.title}</strong><span>Watch the story <ArrowUpRight size={13}/></span></span>
    </button>}
    <div className="tunnel-panel-foot"><span>{chapter.detail}</span><span>MONUMENTAL / {String(index + 1).padStart(2, '0')}</span></div>
  </article>;
}

/** React content exists once; the shared camera carries its portal mounts through
 * the architecture. Compact mode returns the same nodes to document flow. */
export default function SpatialHome({ onWatch, reducedMotion }: {
  onWatch: (video: Video) => void; reducedMotion: boolean; soundUnavailable: boolean;
}) {
  const spatial = useSpatial();
  const root = useRef<HTMLDivElement>(null), hero = useRef<HTMLElement>(null);
  const slots = useRef<(HTMLElement | null)[]>([]), track = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(() => tunnelCompact(document.documentElement.clientWidth, innerHeight, reducedMotion));
  const [active, setActive] = useState(-1);
  const [previewStation, setPreviewStation] = useState<number | null>(null);
  const activeRef = useRef(-1);
  const metrics = useRef<{ top: number; height: number }[]>([]);
  const layoutRefreshFrame = useRef(0), stationJumpFrame = useRef(0);
  const reading = compact || spatial.unavailable;
  useEffect(() => {
    const cancelJump = () => { cancelAnimationFrame(stationJumpFrame.current); stationJumpFrame.current = 0; };
    window.addEventListener('wheel', cancelJump, { passive: true });
    window.addEventListener('touchstart', cancelJump, { passive: true });
    window.addEventListener('pointerdown', cancelJump, { passive: true });
    window.addEventListener('keydown', cancelJump);
    return () => {
      cancelJump();
      window.removeEventListener('wheel', cancelJump);
      window.removeEventListener('touchstart', cancelJump);
      window.removeEventListener('pointerdown', cancelJump);
      window.removeEventListener('keydown', cancelJump);
    };
  }, []);
  useEffect(() => () => setTunnelInspection({ station: null, expanded: false, rotation: 0 }), []);
  useEffect(() => {
    const inspection = getTunnelInspection();
    if (inspection.station && inspection.station !== spatialPortals[active]?.id) setTunnelInspection({ station: null, expanded: false, rotation: 0 });
  }, [active]);
  const mounts = useMemo(() => spatialPortals.map(portal => {
    const node = document.createElement('div'); node.className = 'tunnel-panel-mount'; node.dataset.tunnelStation = portal.id;
    return node;
  }), []);
  useEffect(() => {
    const resize = () => setCompact(tunnelCompact(document.documentElement.clientWidth, innerHeight, reducedMotion));
    resize(); window.addEventListener('resize', resize, { passive: true });
    return () => window.removeEventListener('resize', resize);
  }, [reducedMotion]);
  useLayoutEffect(() => {
    const bindings = mounts.flatMap((element, index) => {
      const fallback = slots.current[index];
      if (!fallback) return [];
      fallback.appendChild(element);
      return [{ id: spatialPortals[index].id, index, element, fallback }];
    });
    setTunnelPanels(bindings);
    return () => { setTunnelPanels([]); mounts.forEach(node => node.remove()); };
  }, [mounts]);
  useLayoutEffect(() => {
    if (!root.current || !hero.current) return;
    const element = root.current, heroElement = hero.current;
    let alive = true, raf = 0;
    function update() {
      if (!alive) return;
      const y = window.scrollY, sampleY = y + (reading ? 85 : 0), points = metrics.current;
      if (!points.length) return;
      let index = -1;
      points.forEach((point, i) => { if (sampleY >= point.top) index = i; });
      let z: number, progress = 0;
      const first = points[0].top;
      if (index < 0) {
        progress = Math.max(0, Math.min(1, sampleY / Math.max(1, first)));
        z = 12 + (-7 - 12) * progress;
      } else {
        index = Math.min(chapters.length - 1, index);
        progress = Math.max(0, Math.min(1, (sampleY - points[index].top) / points[index].height));
        z = tunnelChapterZ(index, progress);
      }
      if (index !== activeRef.current) { activeRef.current = index; setActive(index); }
      setTunnelFrame({ z, active: index, progress, compact: reading });
      const heroProgress = Math.max(0, Math.min(1, y / Math.max(1, first * .72)));
      heroElement.style.setProperty('--hero-progress', String(heroProgress));
      if (!reading) { heroElement.inert = heroProgress > .98; heroElement.setAttribute('aria-hidden', String(heroProgress > .98)); }
      else { heroElement.inert = false; heroElement.removeAttribute('aria-hidden'); }
      track.current?.style.setProperty('--journey-progress', String(Math.min(1, y / Math.max(1, document.documentElement.scrollHeight - innerHeight))));
    }
    function measure() {
      setCompact(tunnelCompact(document.documentElement.clientWidth, innerHeight, reducedMotion));
      metrics.current = slots.current.filter(Boolean).map(slot => {
        const section = slot!.closest<HTMLElement>('.tunnel-checkpoint')!;
        return { top: section.getBoundingClientRect().top + window.scrollY, height: section.offsetHeight };
      });
      update();
    }
    const ctx = gsap.context(() => { ScrollTrigger.create({ trigger: element, start: 'top top', end: 'bottom bottom', onUpdate: update, onRefresh: measure }); }, element);
    const refresh = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { measure(); ScrollTrigger.refresh(); layoutRefreshFrame.current = 0; });
      layoutRefreshFrame.current = raf;
    };
    const resize = new ResizeObserver(refresh); resize.observe(element);
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('scroll', update, { passive: true });
    document.fonts.ready.then(() => { if (alive) refresh(); });
    measure();
    return () => { alive = false; cancelAnimationFrame(raf); if (layoutRefreshFrame.current === raf) layoutRefreshFrame.current = 0; resize.disconnect(); window.removeEventListener('resize', refresh); window.removeEventListener('scroll', update); ctx.revert(); };
  }, [reading, reducedMotion]);
  function goToStation(index: number) {
    cancelAnimationFrame(stationJumpFrame.current);
    setPreviewStation(null);
    setTunnelInspection({ station: null, expanded: false, rotation: 0 });
    enterSpatialWorld(); playSound('select');
    function deliverJump() {
      // Closing an exhibit changes the compact document height. Let its observer
      // finish refreshing before native smooth scrolling takes ownership.
      if (layoutRefreshFrame.current) { stationJumpFrame.current = requestAnimationFrame(deliverJump); return; }
      stationJumpFrame.current = 0;
      if (index < 0) { window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' }); return; }
      const target = slots.current[Math.min(chapters.length - 1, index)]?.closest<HTMLElement>('.tunnel-checkpoint');
      const isReading = tunnelCompact(document.documentElement.clientWidth, innerHeight, reducedMotion) || spatial.unavailable;
      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + (isReading ? 20 : target.offsetHeight * .46), behavior: reducedMotion ? 'instant' : 'smooth' });
    }
    stationJumpFrame.current = requestAnimationFrame(() => { stationJumpFrame.current = requestAnimationFrame(deliverJump); });
  }
  return <div ref={root} className="spatial-home-content tunnel-journey" data-compact={reading} data-ready={spatial.ready} data-travelling={!!spatial.travelling} inert={!!spatial.travelling}
    style={{ '--tunnel-hero-height': `${TUNNEL_HERO_UNITS * 100}svh`, '--tunnel-chapter-height': `${TUNNEL_CHAPTER_UNITS * 100}svh` } as CSSProperties}>
    <div className="tunnel-hero-checkpoint"><section className="tunnel-hero" ref={hero}>
      <div className="tunnel-hero-copy"><h1>CULTURE.<br/><span>WITHOUT</span><br/>BORDERS<span className="tunnel-full-stop">.</span></h1>
        <p>Every film opens a world.<br/>Go inside. See where it takes you.</p>
        <button className="tunnel-entry-button" onClick={() => goToStation(0)} data-cursor="ENTER"><span>ENTER THE WORLD</span><ArrowRight size={23}/></button>
        <a className="tunnel-browse" href={href('/category/movies')}>Browse the films <ArrowUpRight size={14}/></a>
      </div>
      <div className="tunnel-hero-caption" aria-hidden="true"><span>AN OPEN WORLD<br/>OF ENTERTAINMENT</span><i/><span>MONUMENTAL<br/>STREAMS</span></div>
      <div className="tunnel-hero-bottom"><button onClick={() => goToStation(0)}><ArrowDown size={17}/><span>SCROLL INTO THE EXPERIENCE</span></button><span>{spatial.unavailable ? 'Every story is still open.' : spatial.ready ? 'Six stations. Endless connections.' : 'Opening the world…'}</span></div>
    </section></div>
    {chapters.map((chapter, index) => <section key={spatialPortals[index].id} className="tunnel-checkpoint" data-station-index={index} aria-label={`${spatialPortals[index].title} station`}>
      <div className="tunnel-fallback-slot" ref={element => { slots.current[index] = element; }}/>
      {createPortal(<Station index={index} onWatch={onWatch} compact={reading} reducedMotion={reducedMotion}/>, mounts[index])}
      <span className="tunnel-object-caption" aria-hidden="true">{chapter.object}</span>
    </section>)}
    <nav className="tunnel-wayfinder" aria-label="Tunnel stations" data-in-journey={active >= 0}>
      <div className="tunnel-destination-preview" data-visible={previewStation !== null} aria-hidden="true">{previewStation !== null && <><span>{String(previewStation + 1).padStart(2, '0')} / {spatialPortals[previewStation].title}</span><strong>{chapters[previewStation].object}</strong><ArrowUpRight size={18}/></>}</div>
      <button className="tunnel-home-stop" onClick={() => goToStation(-1)} aria-label="Return to tunnel entrance">M<span>THE PASSAGE</span></button>
      <div className="tunnel-stop-list">{spatialPortals.map((portal, index) => <button key={portal.id} onClick={() => goToStation(index)} onPointerEnter={event => { if (event.pointerType === 'mouse') setPreviewStation(index); }} onPointerLeave={() => setPreviewStation(null)} onFocus={() => setPreviewStation(index)} onBlur={() => setPreviewStation(null)} aria-current={active === index ? 'step' : undefined} aria-label={`Travel to ${portal.title}`}><i/><span>{portal.title.replace('The ', '')}</span></button>)}</div>
      <div className="tunnel-step-buttons"><button onClick={() => goToStation(active - 1)} disabled={active < 0} aria-label="Previous station"><ArrowLeft size={18}/></button><span>{String(Math.max(0, active + 1)).padStart(2, '0')} / 06</span><button onClick={() => goToStation(active + 1)} disabled={active === 5} aria-label="Next station"><ArrowRight size={18}/></button></div>
      <div className="tunnel-progress" ref={track} aria-hidden="true"><i/></div>
    </nav>
  </div>;
}
