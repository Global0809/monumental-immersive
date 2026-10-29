import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { gsap } from 'gsap';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { SpeakerSlash } from '@phosphor-icons/react/dist/csr/SpeakerSlash';
import { places, type Video } from '../../data/catalogue';
import { durationLabel } from '../../services/discovery';
import { href } from '../../services/router';
import { playSound } from '../../services/audio';
import { isLocalMediaSource } from '../../services/mediaPreview';
import { SaveButton } from '../FilmCard';
import './collection-theater.css';

export interface CollectionTheaterProps {
  category: string;
  items: Video[];
  onWatch: (video: Video) => void;
  reducedMotion: boolean;
  onBrowse: () => void;
}

function formatOf(video: Video) {
  if (video.status === 'development') return 'In development';
  if (video.tags.includes('full film')) return 'Complete film';
  if (video.tags.includes('trailer')) return 'Official trailer';
  if (video.tags.includes('motion study')) return 'Motion study';
  return video.category;
}

function titleOf(video: Video) { return video.title.replace(/ · Trailer$/, ''); }

export default function CollectionTheater({ category, items, onWatch, reducedMotion, onBrowse }: CollectionTheaterProps) {
  const titleId = useId();
  const root = useRef<HTMLElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const reflection = useRef<HTMLDivElement>(null);
  const filmstrip = useRef<HTMLDivElement>(null);
  const media = useRef<HTMLVideoElement>(null);
  const previewEpoch = useRef(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const identifier = useRef(Symbol('collection-theater'));
  const [selectedId, setSelectedId] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const selection = useMemo(() => {
    const eligible = items.filter(item => item.status === 'available' && item.src);
    // A complete film leads the screening room; trailers remain in the catalogue.
    const ordered = [...eligible].sort((a, b) => {
      const rank = (item: Video) => item.id === 'sintel-full' ? 0 : item.tags.includes('full film') ? 1 : item.tags.includes('trailer') ? 3 : 2;
      return rank(a) - rank(b);
    });
    const fullIds = new Set(ordered.filter(item => item.tags.includes('full film')).map(item => item.id.replace(/-full$/, '')));
    return ordered.filter(item => !item.tags.includes('trailer') || !fullIds.has(item.id)).slice(0, 6);
  }, [items]);
  const active = selection.find(item => item.id === selectedId) || selection[0];
  const index = active ? selection.findIndex(item => item.id === active.id) : 0;
  const preview = active?.tags.includes('full film')
    ? items.find(item => item.id === active.id.replace(/-full$/, '') && item.tags.includes('trailer') && item.access === 'free')
    : active?.access === 'free' ? active : undefined;
  const canPreview = Boolean(preview?.status === 'available' && isLocalMediaSource(preview.src));

  const stopPreview = () => {
    previewEpoch.current += 1;
    media.current?.pause();
    setPreviewing(false);
    setPreviewReady(false);
  };
  const choose = (id: string) => {
    stopPreview();
    setPreviewFailed(false);
    setSelectedId(id);
    playSound('select', { intensity: .45 });
  };
  const step = (direction: number) => {
    if (selection.length < 2) return;
    choose(selection[(index + direction + selection.length) % selection.length].id);
  };

  useEffect(() => { setSelectedId(''); stopPreview(); setPreviewFailed(false); }, [category]);
  useEffect(() => {
    const strip = filmstrip.current;
    if (!strip || !selectedId) return;
    const selected = strip.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!selected) return;
    const bounds = strip.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    strip.scrollTo({ left: strip.scrollLeft + item.left - bounds.left - (bounds.width - item.width) / 2, behavior: reducedMotion ? 'instant' : 'smooth' });
  }, [active?.id, selectedId, reducedMotion]);
  useEffect(() => {
    const element = screen.current;
    if (!element) return;
    const stopOther = (event: Event) => { if ((event as CustomEvent).detail !== identifier.current) stopPreview(); };
    const visibility = () => { if (document.hidden) stopPreview(); };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || entry.intersectionRatio < .15) stopPreview();
    }, { threshold: [0, .15] });
    observer.observe(element);
    window.addEventListener('monumental:preview', stopOther);
    window.addEventListener('monumental:playback', stopPreview);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer.disconnect();
      window.removeEventListener('monumental:preview', stopOther);
      window.removeEventListener('monumental:playback', stopPreview);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [Boolean(active)]);

  useEffect(() => {
    const video = media.current;
    if (!previewing || !video) return;
    if (preview?.src && video.getAttribute('src') !== preview.src) video.setAttribute('src', preview.src);
    let current = true;
    const epoch = previewEpoch.current;
    void video.play().catch(() => {
      // Pausing or replacing a loading preview rejects play(). That cancellation
      // must not show an error or stop a newly requested preview.
      if (!current || epoch !== previewEpoch.current) return;
      setPreviewFailed(true);
      stopPreview();
    });
    return () => { current = false; video.pause(); video.removeAttribute('src'); video.load(); };
  }, [previewing, preview?.src]);

  useEffect(() => {
    if (!previewing || previewReady) return;
    const epoch = previewEpoch.current;
    const timeout = window.setTimeout(() => {
      if (epoch !== previewEpoch.current) return;
      setPreviewFailed(true);
      stopPreview();
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [previewing, previewReady, preview?.src]);

  useEffect(() => {
    const element = root.current;
    const panel = screen.current;
    const mirrored = reflection.current;
    if (!element || !panel || !mirrored || reducedMotion) return;
    let bounds: DOMRect | null = null;
    let move: (event: PointerEvent) => void = () => {};
    let reset = () => {};
    const ctx = gsap.context(() => {
      const rotateX = gsap.quickTo(panel, 'rotationX', { duration: .65, ease: 'power3.out' });
      const rotateY = gsap.quickTo(panel, 'rotationY', { duration: .65, ease: 'power3.out' });
      const reflectX = gsap.quickTo(mirrored, 'x', { duration: .7, ease: 'power3.out' });
      const reflectOpacity = gsap.quickTo(mirrored, 'opacity', { duration: .7, ease: 'power3.out' });
      move = event => {
        if (event.pointerType !== 'mouse') return;
        bounds ??= element.getBoundingClientRect();
        const x = Math.max(-.5, Math.min(.5, (event.clientX - bounds.left) / bounds.width - .5));
        const y = Math.max(-.5, Math.min(.5, (event.clientY - bounds.top) / bounds.height - .5));
        rotateX(-y * 4);
        rotateY(-5 + x * 7);
        reflectX(x * 12);
        reflectOpacity(.15 + (x + .5) * .08);
      };
      reset = () => { rotateX(0); rotateY(-5); reflectX(0); reflectOpacity(.18); bounds = null; };
      gsap.set(panel, { rotationY: -5, transformPerspective: 1400 });
    }, element);
    const invalidate = () => { bounds = null; };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', reset);
    window.addEventListener('resize', invalidate, { passive: true });
    window.addEventListener('scroll', invalidate, { passive: true });
    return () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', reset);
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('scroll', invalidate);
      ctx.revert();
    };
  }, [reducedMotion, Boolean(active)]);

  useEffect(() => {
    if (!root.current || reducedMotion || !active) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.ct-information', { y: 9, opacity: .35 }, { y: 0, opacity: 1, duration: .45, ease: 'power2.out' });
      gsap.fromTo('.ct-screen-image', { opacity: .4 }, { opacity: 1, duration: .5, ease: 'power2.out' });
    }, root);
    return () => ctx.revert();
  }, [active?.id, reducedMotion]);

  if (!active) return null;
  const location = active.places.map(id => places.find(place => place.id === id)?.name).filter(Boolean).join(' / ');
  const watchLabel = active.tags.includes('full film') ? 'Watch film' : active.tags.includes('trailer') ? 'Watch trailer' : active.tags.includes('motion study') ? 'Watch study' : 'Watch now';
  const startPreview = () => {
    if (!canPreview || document.hidden || document.querySelector('.ms-player-dialog[open]')) return;
    window.dispatchEvent(new CustomEvent('monumental:preview', { detail: identifier.current }));
    setPreviewFailed(false);
    setPreviewing(true);
    playSound('select', { intensity: .35 });
  };

  return <section className={`collection-theater ${category === 'Movies' ? 'collection-theater--gallery' : ''} ${reducedMotion ? 'is-calm' : ''}`} ref={root} aria-labelledby={titleId}>
    <div className="ct-topline"><span><i aria-hidden="true"/>{category.toLowerCase() === 'music' ? 'The listening room' : 'The screening room'}</span><button onClick={onBrowse}>Explore the collection <ArrowDown size={13}/></button></div>
    <div className="ct-stage" tabIndex={0} aria-label="Featured stories. Use the left and right arrow keys to browse." onKeyDown={event => {
      if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || selection.length < 2 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
      event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1);
    }}>
      <div className="ct-architecture" aria-hidden="true"><span/><span/><span/></div>
      <div className="ct-information">
        <span className="ct-format">{formatOf(active)}<span/>{durationLabel(active.duration)}{active.access === 'free' && <><span/>Free to watch</>}</span>
        <h2 id={titleId}>{titleOf(active)}</h2>
        <p>{active.description}</p>
        <span className="ct-origin">{location || active.people.slice(0, 2).join(' / ') || 'Monumental selection'}</span>
        <div className="ct-actions"><button className="button ct-watch" onClick={() => { stopPreview(); onWatch(active); }}><Play size={15} weight="fill"/>{watchLabel}</button><SaveButton video={active} small/></div>
        <a className="ct-story" href={href('/film/' + active.id)} data-transition-film={active.id}>The story behind it <ArrowUpRight size={16}/></a>
      </div>
      <div className="ct-projection" onTouchStart={event => {
        if ((event.target as HTMLElement).closest('button, a') || event.touches.length !== 1) { touch.current = null; return; }
        touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }} onTouchEnd={event => {
        if (!touch.current || !event.changedTouches.length) return;
        const dx = event.changedTouches[0].clientX - touch.current.x;
        const dy = event.changedTouches[0].clientY - touch.current.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx > 0 ? -1 : 1);
        touch.current = null;
      }} onTouchCancel={() => { touch.current = null; }}>
        <div className="ct-screen" ref={screen}>
          <div className="ct-screen-surface" aria-busy={previewing && !previewReady}>
            <img className="ct-screen-image" src={active.poster} alt="" fetchPriority="high"/>
            {previewing && preview && <video key={preview.id} ref={media} src={preview.src} muted playsInline loop preload="none" className={previewReady ? 'is-ready' : ''} aria-label={`Silent ${formatOf(preview).toLowerCase()}: ${preview.title}`} onPlaying={() => setPreviewReady(true)} onError={() => { setPreviewFailed(true); stopPreview(); }}/>} 
            {!previewing && <button className="ct-screen-play" aria-label={`Play ${active.title}`} onClick={() => { stopPreview(); onWatch(active); }}><Play size={22} weight="fill"/></button>}
            {canPreview && <button className="ct-preview" aria-pressed={previewing} onClick={previewing ? stopPreview : startPreview}>{previewing ? <Pause size={12} weight="fill"/> : <Play size={12} weight="fill"/>}{previewing ? previewReady ? 'Stop preview' : 'Cancel preview' : preview?.tags.includes('trailer') ? 'Preview trailer' : 'Silent preview'}<SpeakerSlash size={13}/></button>}
            {previewing && !previewReady && <span className="ct-preview-message ct-preview-message--loading" role="status">Loading silent preview…</span>}
            {previewFailed && <span className="ct-preview-message" role="status">Preview unavailable. Try again or watch the film.</span>}
          </div>
          <div className="ct-screen-edge" aria-hidden="true"/>
          <span className="ct-screen-caption"><span>MONUMENTAL / {String(index + 1).padStart(2, '0')}</span><span>{formatOf(active)}</span></span>
        </div>
        <div className="ct-reflection" ref={reflection} aria-hidden="true"><img src={active.poster} alt=""/></div>
        <div className="ct-floor" aria-hidden="true"/>
      </div>
    </div>
    <div className="ct-selection">
      <div className="ct-selection-heading"><span>Choose your next story</span><div className="ct-pagination"><span aria-hidden="true">{String(index + 1).padStart(2, '0')}<i>/ {String(selection.length).padStart(2, '0')}</i></span><button aria-label="Previous featured story" disabled={selection.length < 2} onClick={() => step(-1)}><ArrowLeft size={17}/></button><button aria-label="Next featured story" disabled={selection.length < 2} onClick={() => step(1)}><ArrowRight size={17}/></button></div></div>
      <div className="ct-filmstrip" ref={filmstrip} aria-label="Featured stories" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));const current=buttons.indexOf(event.target as HTMLButtonElement);const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next]?.click();buttons[next]?.focus({preventScroll:true});}}>{selection.map((item, itemIndex) => <button key={item.id} style={{'--poster-distance':Math.abs(itemIndex-index),'--poster-side':Math.sign(itemIndex-index)} as CSSProperties} onClick={() => choose(item.id)} aria-pressed={item.id === active.id} aria-label={`Feature ${item.title}, ${formatOf(item)}`}><span className="ct-thumbnail"><img src={item.poster} alt="" loading="lazy"/><span>{String(itemIndex + 1).padStart(2, '0')}</span></span><span className="ct-thumbnail-copy"><strong>{titleOf(item)}</strong><small>{formatOf(item)} · {durationLabel(item.duration)}</small></span></button>)}</div>
    </div>
    <span className="ct-sr-only" aria-live="polite">Featured: {active.title}, {index + 1} of {selection.length}.</span>
  </section>;
}
