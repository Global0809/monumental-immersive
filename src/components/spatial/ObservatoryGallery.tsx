import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import gsap from 'gsap';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { PushPin } from '@phosphor-icons/react/dist/csr/PushPin';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { SlidersHorizontal } from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
import { spatialPortals, getSpatialState, setSpatialFocus, requestSpatialTravel } from '../../services/spatial';
import { useSpatialPreferences, setSpatialPreferences } from '../../services/spatialPreferences';
import { go, href } from '../../services/router';
import { playSound } from '../../services/audio';
import './observatory-gallery.css';

const asset = (url: string) => url.startsWith('/') ? `${import.meta.env.BASE_URL}${url.slice(1)}` : url;
const wrap = (index: number) => (index + spatialPortals.length) % spatialPortals.length;
const offset = (index: number, selected: number) => wrap(index - selected + 3) - 3;

/** A bounded room selector. The gallery's movement never accumulates camera
 * rotation in the shared WebGL world, and controls keep their native behavior. */
export default function ObservatoryGallery({ reducedMotion }: { reducedMotion: boolean }) {
  const prefs = useSpatialPreferences();
  const [selected, setSelected] = useState(() => Math.max(0, spatialPortals.findIndex(p => p.id === getSpatialState().focus)));
  const host = useRef<HTMLElement>(null);
  const deck = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const tilt = useRef({ x: (_value: number) => {}, y: (_value: number) => {} });
  const active = spatialPortals[selected];
  const pinned = prefs.pinned.includes(active.id);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      element.dataset.inView = String(entry.isIntersecting && entry.intersectionRatio > .01);
    }, { threshold: [0, .01] });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const ctx = gsap.context(() => {
      tilt.current = {
        x: gsap.quickTo(deck.current, 'rotationX', { duration: .65, ease: 'power3.out' }),
        y: gsap.quickTo(deck.current, 'rotationY', { duration: .65, ease: 'power3.out' }),
      };
    }, host);
    return () => { tilt.current = { x() {}, y() {} }; ctx.revert(); };
  }, [reducedMotion]);

  function choose(index: number, focusTab = false) {
    const next = wrap(index);
    if (next !== selected) { setSelected(next); setSpatialFocus(spatialPortals[next].id); playSound('select'); }
    if (focusTab) tabs.current[next]?.focus({ preventScroll: true });
  }
  function keys(event: KeyboardEvent) {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? spatialPortals.length - 1
      : ['ArrowRight', 'ArrowDown'].includes(event.key) ? selected + 1
      : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? selected - 1 : null;
    if (next === null) return;
    event.preventDefault(); choose(next, true);
  }
  function enter(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    if (!requestSpatialTravel(active.id)) go(active.route);
  }
  function viewSpace(view: 'gallery' | 'overhead') {
    setSpatialPreferences({ view });
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
  }

  return <section ref={host} className="observatory-gallery page-section" aria-labelledby="observatory-tools-title" data-reduced-motion={reducedMotion}
    data-framework={prefs.cutaway} style={{ '--gallery-light': .1 + prefs.light / 150 } as CSSProperties}>
    <header className="room-gallery-heading">
      <h2 id="observatory-tools-title">EVERY DOOR<br/><span>OPENS A WORLD.</span></h2>
      <p>Choose what moves you.<br/>Take a closer look. Then step inside.</p>
    </header>

    <div className="room-gallery-layout">
      <div className="room-gallery-tabs" role="tablist" aria-label="Explore the rooms" onKeyDown={keys}>
        {spatialPortals.map((portal, i) => <button key={portal.id} ref={element => { tabs.current[i] = element; }}
          type="button" role="tab" id={`room-tab-${portal.id}`} aria-selected={selected === i}
          aria-controls="room-gallery-panel" tabIndex={selected === i ? 0 : -1} onClick={() => choose(i)}>
          <span className="room-tab-number">{String(i + 1).padStart(2, '0')}</span>
          <span>{portal.title}</span><ArrowUpRight aria-hidden="true" size={18}/>
        </button>)}
      </div>

      <div className="room-gallery-content" id="room-gallery-panel" role="tabpanel" aria-labelledby={`room-tab-${active.id}`}>
        <div className="room-gallery-stage" onPointerMove={event => {
          if (event.pointerType !== 'mouse' || event.buttons || reducedMotion) return;
          const rect = event.currentTarget.getBoundingClientRect();
          tilt.current.x((.5 - (event.clientY - rect.top) / rect.height) * 4);
          tilt.current.y(((event.clientX - rect.left) / rect.width - .5) * 5);
        }} onPointerLeave={() => { tilt.current.x(0); tilt.current.y(0); }}>
          <div className="room-gallery-floor" aria-hidden="true"/>
          <div className="room-gallery-viewport" aria-hidden="true">
            <div ref={deck} className="room-gallery-deck">
              {spatialPortals.map((portal, i) => {
                const distance = offset(i, selected), depth = Math.abs(distance);
                return <div key={portal.id} className="room-gallery-frame" data-active={distance === 0}
                  style={{ '--room-offset': distance, '--room-depth': depth, zIndex: 6 - depth } as CSSProperties}>
                  <div className="room-gallery-image"><img src={asset(portal.image)} alt="" loading="lazy" draggable={false}/></div>
                  <div className="room-gallery-plaque"><span>{portal.title}</span><ArrowUpRight size={21}/></div>
                  <i className="room-gallery-spine"/>
                </div>;
              })}
            </div>
          </div>
          <a className="room-gallery-enter-preview" href={href(active.route)} onClick={enter} aria-label={`Enter ${active.title.replace(/^The /, '')} from preview`} data-cursor="ENTER"/>
        </div>

        <div className="room-gallery-navigation" aria-label="Browse room previews">
          <span><strong>{String(selected + 1).padStart(2, '0')}</strong> / {String(spatialPortals.length).padStart(2, '0')}</span>
          <div><button type="button" aria-label="Previous room preview" onClick={() => choose(selected - 1)}><ArrowLeft size={20}/></button>
            <button type="button" aria-label="Next room preview" onClick={() => choose(selected + 1)}><ArrowRight size={20}/></button></div>
        </div>

        <div className="room-gallery-story">
          <div><h3>{active.title}</h3><p>{active.description}</p></div>
          <div className="room-gallery-actions">
            <a className="button button-primary" href={href(active.route)} onClick={enter}>Enter {active.title.replace(/^The /, '')}<ArrowUpRight size={19}/></a>
            <button type="button" className="room-gallery-pin" aria-pressed={pinned} onClick={() => {
              setSpatialPreferences({ pinned: pinned ? prefs.pinned.filter(id => id !== active.id) : [...prefs.pinned, active.id] });
              playSound('select');
            }}>{pinned ? <Check size={17}/> : <PushPin size={17}/>} {pinned ? 'Doorway pinned' : 'Pin this doorway'}</button>
          </div>
        </div>
        <span className="room-gallery-sr-only" role="status">{active.title}. Room {selected + 1} of {spatialPortals.length}.</span>
      </div>
    </div>

    <div className="room-gallery-bottom">
      <details className="room-gallery-settings">
        <summary><SlidersHorizontal size={18}/><span>Tune the observatory</span><span className="room-gallery-expand" aria-hidden="true">+</span></summary>
        <div className="room-gallery-settings-grid">
          <div><h3>Change your viewpoint</h3><p>Return to the space from a different angle.</p><div className="room-view-buttons">
            <button type="button" onClick={() => viewSpace('gallery')}>View gallery<ArrowUpRight size={15}/></button>
            <button type="button" onClick={() => viewSpace('overhead')}>View from above<ArrowUpRight size={15}/></button>
          </div></div>
          <div><h3>Look beneath the surface</h3><p>Reveal the architecture around the films.</p><button type="button" className="room-framework" aria-pressed={prefs.cutaway} onClick={() => setSpatialPreferences({ cutaway: !prefs.cutaway })}>
            Framework <span>{prefs.cutaway ? 'On' : 'Off'}</span></button></div>
          <label className="room-light"><span>Room illumination <output>{prefs.light}%</output></span><input aria-label="Room illumination" type="range" min="15" max="100" value={prefs.light} onChange={event => setSpatialPreferences({ light: Number(event.target.value) })}/><small>Light the space around the previews.</small></label>
        </div>
      </details>
      {!!prefs.pinned.length && <nav className="room-gallery-pins" aria-label="Pinned doorways"><span>Your doorways</span>{prefs.pinned.map(id => {
        const portal = spatialPortals.find(p => p.id === id)!;
        return <a key={id} href={href(portal.route)}>{portal.title}<ArrowUpRight size={15}/></a>;
      })}<small>Saved on this browser</small></nav>}
    </div>
  </section>;
}
