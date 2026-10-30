import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
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
import { Waveform } from '@phosphor-icons/react/dist/csr/Waveform';
import { videos, type Video } from '../../data/catalogue';
import { durationLabel } from '../../services/discovery';
import { filmFormat } from '../FilmCard';
import { href } from '../../services/router';
import { assetUrl as asset } from '../../services/assets';
import { playSound } from '../../services/audio';
import { useViewer } from '../../services/viewer';
import { PASSAGE_CHAPTERS as chapters } from '../../services/passageChapters';
import { acquirePassageMedia, type PassageChapterId, type PassageMediaController } from '../../services/passageMedia';
import { enterSpatialWorld, spatialPortals, useSpatial } from '../../services/spatial';
import DepthText from '../DepthText';
import { getPassageSound, subscribePassageSound, setPassageSoundEnabled } from '../../services/passageSound';
import { getTunnelFrame, getTunnelInspection, setTunnelFrame, setTunnelInspection, setTunnelPanels, subscribeTunnelFrame, subscribeTunnelInspection, tunnelChapterZ, tunnelEntranceZ, tunnelCompact, TUNNEL_CHAPTER_UNITS, TUNNEL_HERO_UNITS } from '../../services/tunnelJourney';
import PassageCompactMedia, { PassageMediaCaption } from './passageCompactMedia';
import { useLivingType } from './useLivingType';
import './tunnel-journey.css';
import './living-type.css';

gsap.registerPlugin(ScrollTrigger);
function LivingWords({ text, offset = 0 }: { text: string; offset?: number }) {
  let wordIndex=offset;
  return <>{text.split(/(\s+)/).map((word,index)=>/\s/.test(word)?word:<span className="living-type-word" key={index} style={{'--word-index':wordIndex++} as CSSProperties}>{word}</span>)}</>;
}
function LivingAction({ text }: { text: string }) {
  return <span className="living-action-label"><span className="living-action-face">{text}</span><span className="living-action-reprise" aria-hidden="true">{text}</span></span>;
}
function Station({ index, onWatch, compact, reducedMotion }: { index: number; onWatch: (video: Video) => void; compact: boolean; reducedMotion: boolean }) {
  const inspection = useSyncExternalStore(subscribeTunnelInspection, getTunnelInspection);
  const studySound = useSyncExternalStore(subscribePassageSound, getPassageSound);
  const viewer = useViewer();
  const chapter = chapters[index], portal = spatialPortals[index];
  const expanded = inspection.station === portal.id && inspection.expanded;
  const inspectionToggle = useRef<HTMLButtonElement>(null);
  const savedFilm = chapter.id === 'my-world' ? viewer.saved.map(id => videos.find(video => video.id === id && video.status === 'available')).find(Boolean) : undefined;
  const film = savedFilm ?? videos.find(video => video.id === chapter.feature && video.status === 'available');
  const inspectionId = `tunnel-inspection-${portal.id}`;
  function toggleInspection() {
    setTunnelInspection({ station: expanded ? null : portal.id, expanded: !expanded, rotation: 0 });
    playSound(expanded ? 'close' : 'scan', { intensity: .8 });
  }
  function turnSculpture(direction: number) {
    setTunnelInspection({ station: portal.id, expanded: true, rotation: Math.max(-Math.PI, Math.min(Math.PI, inspection.rotation + direction * Math.PI / 6)) });
    playSound('sculpture-turn');
  }
  useEffect(() => {
    if (!expanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      // Reset disables its own button, which can move browser focus to body.
      // Escape must still close the exhibit, while a real dialog keeps priority.
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return;
      setTunnelInspection({ station: null, expanded: false, rotation: 0 });
      inspectionToggle.current?.focus({ preventScroll: true });
      event.preventDefault();
      playSound('close');
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expanded]);
  return <article className="tunnel-panel" data-environment={chapter.environment} data-text-motion="off" data-reduced-motion={reducedMotion} data-expanded={expanded} data-inspection-mode={compact ? 'story' : 'sculpture'} aria-labelledby={`tunnel-heading-${portal.id}`}
    onKeyDown={event => { if (event.key === 'Escape' && expanded) { toggleInspection(); inspectionToggle.current?.focus(); event.stopPropagation(); } }}>
    <div className="tunnel-panel-top"><span><b>{String(index + 1).padStart(2, '0')}</b>{portal.title}</span><button data-sound-owned ref={inspectionToggle} onClick={toggleInspection} aria-expanded={expanded} aria-controls={inspectionId} aria-label={`${expanded ? 'Close' : 'Inspect'} ${portal.title} exhibit`}><CornersOut size={16}/><span>{expanded ? 'CLOSE EXHIBIT' : 'INSPECT'}</span></button></div>
    {compact && film && <PassageCompactMedia chapter={chapter} film={film} saved={!!savedFilm} reducedMotion={reducedMotion} onWatch={onWatch}/>}
    <div className="tunnel-panel-heading"><h2 id={`tunnel-heading-${portal.id}`} aria-label={chapter.lines.join(' ')}><DepthText text={chapter.lines[0]}/><br/><span><DepthText text={chapter.lines[1]}/></span></h2></div>
    <div className="tunnel-panel-copy"><p>{chapter.copy}</p><a className="tunnel-enter-room" href={href(portal.route)}>{chapter.action}<ArrowUpRight size={22}/></a></div>
    {chapter.id === 'music' && !compact && !reducedMotion && <div className="tunnel-study-sound">
      <button aria-pressed={studySound.enabled} data-sound-owned onClick={() => setPassageSoundEnabled(!studySound.enabled)}><Waveform size={17}/><span>{studySound.enabled ? 'Mute the sound study' : 'Listen to the sound study'}</span></button>
      <small role="status">{studySound.status === 'unavailable' ? 'Sound is unavailable here. The story player is still available.' : studySound.enabled ? 'The turntable responds to the playing score.' : 'An original synthetic score. Enable sound to move the instrument.'}</small>
    </div>}
    <div id={inspectionId} className="tunnel-inspection" hidden={!expanded}>
      <div className="tunnel-inspection-heading"><h3>{chapter.object}</h3>{!compact && <span role="status" aria-label={`Rotation ${Math.round(inspection.rotation * 180 / Math.PI)} degrees`}>{Math.round(inspection.rotation * 180 / Math.PI)}°</span>}</div>
      {compact ? <p>{film?.description ?? portal.description}</p> : <div className="tunnel-inspection-controls" data-sound-owned role="group" aria-label={`Rotate ${portal.title} sculpture`}>
        <span>Turn the sculpture</span>
        <button onClick={() => turnSculpture(-1)} disabled={inspection.rotation <= -Math.PI} aria-label={`Rotate ${portal.title} sculpture left`}><ArrowLeft size={18}/></button>
        <button onClick={() => turnSculpture(1)} disabled={inspection.rotation >= Math.PI} aria-label={`Rotate ${portal.title} sculpture right`}><ArrowRight size={18}/></button>
        <button className="tunnel-inspection-reset" onClick={() => { setTunnelInspection({ station: portal.id, expanded: true, rotation: 0 }); playSound('sculpture-reset'); }} disabled={Math.abs(inspection.rotation) < .001}><ArrowCounterClockwise size={16}/><span>Reset</span></button>
      </div>}
    </div>
    {chapter.id === 'my-world' && <p className="tunnel-collection-state">{savedFilm ? `From your collection · ${viewer.saved.length} saved ${viewer.saved.length === 1 ? 'story' : 'stories'}` : 'Your collection starts with a story. An editorial selection to begin.'}</p>}
    {film && <button className="tunnel-story" onClick={() => onWatch(film)} data-cursor="PLAY" aria-label={`Play ${film.title}`}>
      <span className="tunnel-story-image"><img src={asset(film.poster)} alt="" loading="lazy" decoding="async"/><span><Play size={18} weight="fill"/></span></span>
      <span className="tunnel-story-copy"><small>{filmFormat(film)} · {durationLabel(film.duration)}</small><strong>{film.title}</strong><span>Watch the story <ArrowUpRight size={13}/></span></span>
    </button>}
    {!compact && <PassageMediaCaption chapterId={chapter.id}/>}
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
  useLivingType(hero, { enabled: (spatial.ready || spatial.unavailable) && !spatial.travelling, reducedMotion, compact: reading });
  const mediaController = useRef<PassageMediaController | null>(null);
  useEffect(() => {
    // The document owns selection so ambient media also works without WebGL.
    const lease = acquirePassageMedia();
    mediaController.current = lease.controller;
    lease.controller.setSuspended('passage-dom-reduced', reducedMotion);
    const select = () => {
      const frame = getTunnelFrame();
      lease.controller.activate(chapters[Math.max(0, frame.active)]?.id as PassageChapterId ?? null);
    };
    const unsubscribe = subscribeTunnelFrame(select);
    select();
    return () => {
      unsubscribe();
      lease.controller.activate(null);
      lease.controller.setSuspended('passage-dom-reduced', false);
      mediaController.current = null;
      lease.release();
    };
  }, []);
  useEffect(() => { mediaController.current?.setSuspended('passage-dom-reduced', reducedMotion); }, [reducedMotion]);
  const previousReading = useRef(reading);
  const measuredViewport = useRef({ width: document.documentElement.clientWidth, height: innerHeight });
  const viewportChanged = () => measuredViewport.current.width !== document.documentElement.clientWidth || measuredViewport.current.height !== innerHeight;
  const modeAnchor = useRef<{ index: number; progress: number; focused: HTMLElement | null; focusTop: number } | null>(null);
  function captureModeAnchor() {
    if (modeAnchor.current || !metrics.current.length) return;
    // A viewport change can clamp native scrollY before React has changed the
    // layout. Keep the last authored journey sample, not that temporary value.
    const { active: index, progress } = getTunnelFrame();
    const focused = document.activeElement instanceof HTMLElement && document.activeElement.closest('.tunnel-panel,.tunnel-wayfinder,.tunnel-hero') ? document.activeElement : null;
    modeAnchor.current = { index, progress, focused, focusTop: focused?.getBoundingClientRect().top ?? 0 };
  }
  useLayoutEffect(() => {
    if (previousReading.current !== reading) captureModeAnchor();
    previousReading.current = reading;
  }, [reading]);
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
    const resize = () => {
      const next = tunnelCompact(document.documentElement.clientWidth, innerHeight, reducedMotion);
      if (viewportChanged() || (next || spatial.unavailable) !== previousReading.current) captureModeAnchor();
      setCompact(next);
    };
    resize(); window.addEventListener('resize', resize, { passive: true });
    return () => window.removeEventListener('resize', resize);
  }, [reducedMotion, spatial.unavailable]);
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
    let alive = true, raf = 0, focusFrame = 0;
    function update() {
      if (!alive) return;
      if (viewportChanged() || (tunnelCompact(document.documentElement.clientWidth, innerHeight, reducedMotion) || spatial.unavailable) !== reading) { captureModeAnchor(); return; }
      const y = window.scrollY, sampleY = y + (reading ? 85 : 0), points = metrics.current;
      if (!points.length) return;
      let index = -1;
      points.forEach((point, i) => { if (sampleY >= point.top) index = i; });
      let z: number, progress = 0;
      const first = points[0].top;
      if (index < 0) {
        progress = Math.max(0, Math.min(1, sampleY / Math.max(1, first)));
        z = tunnelEntranceZ(progress);
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
      const nextCompact = tunnelCompact(document.documentElement.clientWidth, innerHeight, reducedMotion);
      if (viewportChanged()) captureModeAnchor();
      if ((nextCompact || spatial.unavailable) !== reading) { captureModeAnchor(); setCompact(nextCompact); return; }
      setCompact(nextCompact);
      measuredViewport.current = { width: document.documentElement.clientWidth, height: innerHeight };
      metrics.current = slots.current.filter(Boolean).map(slot => {
        const section = slot!.closest<HTMLElement>('.tunnel-checkpoint')!;
        return { top: section.getBoundingClientRect().top + window.scrollY, height: section.offsetHeight };
      });
      const anchor = modeAnchor.current;
      if (anchor) {
        modeAnchor.current = null;
        const point = metrics.current[anchor.index];
        const top = point ? point.top + point.height * anchor.progress - (reading ? 85 : 0) : (metrics.current[0]?.top ?? 0) * anchor.progress;
        window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      }
      update();
      if (anchor?.focused) {
        cancelAnimationFrame(focusFrame);
        focusFrame = requestAnimationFrame(() => {
          if (!alive || !anchor.focused?.isConnected) return;
          anchor.focused.focus({ preventScroll: true });
          if (reading && anchor.focused.closest('.tunnel-panel')) {
            const nextTop = anchor.focused.getBoundingClientRect().top;
            if (nextTop < 80 || nextTop > innerHeight - 100) window.scrollBy({ top: nextTop - Math.max(90, Math.min(innerHeight - 130, anchor.focusTop)), behavior: 'instant' });
          }
        });
      }
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
    return () => { alive = false; cancelAnimationFrame(raf); cancelAnimationFrame(focusFrame); if (layoutRefreshFrame.current === raf) layoutRefreshFrame.current = 0; resize.disconnect(); window.removeEventListener('resize', refresh); window.removeEventListener('scroll', update); ctx.revert(); };
  }, [reading, reducedMotion]);
  function goToStation(index: number) {
    cancelAnimationFrame(stationJumpFrame.current);
    setPreviewStation(null);
    setTunnelInspection({ station: null, expanded: false, rotation: 0 });
    enterSpatialWorld(); playSound('portal', { intensity: .82 });
    function deliverJump() {
      // Closing an exhibit changes the compact document height. Let its observer
      // finish refreshing before native smooth scrolling takes ownership.
      if (layoutRefreshFrame.current) { stationJumpFrame.current = requestAnimationFrame(deliverJump); return; }
      stationJumpFrame.current = 0;
      if (index < 0) { window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' }); return; }
      const target = slots.current[Math.min(chapters.length - 1, index)]?.closest<HTMLElement>('.tunnel-checkpoint');
      const isReading = tunnelCompact(document.documentElement.clientWidth, innerHeight, reducedMotion) || spatial.unavailable;
      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + (isReading ? 0 : target.offsetHeight * .46), behavior: reducedMotion ? 'instant' : 'smooth' });
    }
    stationJumpFrame.current = requestAnimationFrame(() => { stationJumpFrame.current = requestAnimationFrame(deliverJump); });
  }
  return <div ref={root} className="spatial-home-content tunnel-journey" data-compact={reading} data-ready={spatial.ready} data-travelling={!!spatial.travelling} inert={!!spatial.travelling}
    style={{ '--tunnel-hero-height': `${TUNNEL_HERO_UNITS * 100}svh`, '--tunnel-chapter-height': `${TUNNEL_CHAPTER_UNITS * 100}svh` } as CSSProperties}>
    <div className="tunnel-hero-checkpoint"><section className="tunnel-hero" data-text-motion="off" ref={hero}>
      <div className="tunnel-hero-copy"><h1 aria-label="CULTURE. WITHOUT BORDERS."><DepthText text="CULTURE." living/><br/><span className="living-type-outline"><DepthText text="WITHOUT" living/></span><br/><DepthText text="BORDERS" living/><span className="tunnel-full-stop" aria-hidden="true">.</span></h1>
        <p className="living-copy"><LivingWords text="Every film opens a world."/><br/><LivingWords text="Go inside. See where it takes you." offset={5}/></p>
        <button className="tunnel-entry-button" data-sound-owned onClick={() => goToStation(0)} data-cursor="ENTER" data-mechanical-press><LivingAction text="ENTER THE WORLD"/><ArrowRight size={23}/></button>
        <a className="tunnel-browse" href={href('/category/movies')}><LivingAction text="Browse the films"/><ArrowUpRight size={14}/></a>
      </div>
      <div className="tunnel-hero-caption" aria-hidden="true"><span>AN OPEN WORLD<br/>OF ENTERTAINMENT</span><i/><span>MONUMENTAL<br/>STREAMS</span></div>
      <div className="tunnel-hero-bottom"><button data-sound-owned onClick={() => goToStation(0)}><ArrowDown size={17}/><span>SCROLL INTO THE EXPERIENCE</span></button><span>{spatial.unavailable ? 'Every story is still open.' : spatial.ready ? 'Six stations. Endless connections.' : 'Opening the world…'}</span></div>
    </section></div>
    {chapters.map((chapter, index) => <section key={spatialPortals[index].id} className="tunnel-checkpoint" data-station-index={index} data-environment={chapter.environment} aria-label={`${spatialPortals[index].title} station`}>
      <div className="tunnel-fallback-slot" ref={element => { slots.current[index] = element; }}/>
      {createPortal(<Station index={index} onWatch={onWatch} compact={reading} reducedMotion={reducedMotion}/>, mounts[index])}
      <span className="tunnel-object-caption" aria-hidden="true">{chapter.object}</span>
    </section>)}
    <nav className="tunnel-wayfinder" data-sound-owned aria-label="Tunnel stations" data-in-journey={active >= 0}>
      <div className="tunnel-destination-preview" data-visible={previewStation !== null} aria-hidden="true">{previewStation !== null && <><span>{String(previewStation + 1).padStart(2, '0')} / {spatialPortals[previewStation].title}</span><strong>{chapters[previewStation].object}</strong><ArrowUpRight size={18}/></>}</div>
      <button className="tunnel-home-stop" onClick={() => goToStation(-1)} aria-label="Return to tunnel entrance">M<span>THE PASSAGE</span></button>
      <select className="tunnel-mobile-station" aria-label="Choose Passage station" value={active} onChange={event => goToStation(Number(event.target.value))}><option value={-1}>The Passage</option>{spatialPortals.map((portal, index) => <option key={portal.id} value={index}>{String(index + 1).padStart(2, '0')} · {portal.title.replace('The ', '')}</option>)}</select>
      <div className="tunnel-stop-list">{spatialPortals.map((portal, index) => <button key={portal.id} onClick={() => goToStation(index)} onPointerEnter={event => { if (event.pointerType === 'mouse') setPreviewStation(index); }} onPointerLeave={() => setPreviewStation(null)} onFocus={() => setPreviewStation(index)} onBlur={() => setPreviewStation(null)} aria-current={active === index ? 'step' : undefined} aria-label={`Travel to ${portal.title}`}><i/><span>{portal.title.replace('The ', '')}</span></button>)}</div>
      <div className="tunnel-step-buttons"><button onClick={() => goToStation(active - 1)} disabled={active < 0} aria-label="Previous station"><ArrowLeft size={18}/></button><span>{String(Math.max(0, active + 1)).padStart(2, '0')} / 06</span><button onClick={() => goToStation(active + 1)} disabled={active === 5} aria-label="Next station"><ArrowRight size={18}/></button></div>
      <div className="tunnel-progress" ref={track} aria-hidden="true"><i/></div>
    </nav>
  </div>;
}
