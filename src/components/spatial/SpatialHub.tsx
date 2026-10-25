import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { SpeakerHigh } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import { SpeakerSlash } from '@phosphor-icons/react/dist/csr/SpeakerSlash';
import { videos, type Video } from '../../data/catalogue';
import { durationLabel } from '../../services/discovery';
import { href } from '../../services/router';
import type { SpatialPortal } from './types';
import './spatial-hub.css';

export interface SpatialHubProps {
  entered: boolean;
  ready: boolean;
  unavailable: boolean;
  reducedMotion: boolean;
  portals: SpatialPortal[];
  onEnter(): void;
  onFocus(id: string | null): void;
  onNavigate(id: string): void;
  onRotate(delta: number): void;
  onWatch(video: Video): void;
  sound: boolean;
  soundUnavailable: boolean;
  onToggleSound(): void;
}

/** One semantic navigation layer accompanies the independently rendered space. */
export default function SpatialHub({
  entered, ready, unavailable, reducedMotion, portals,
  onEnter, onFocus, onNavigate, onRotate, onWatch,
  sound, soundUnavailable, onToggleSound,
}: SpatialHubProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const active = portals.find(portal => portal.id === selected) ?? portals[0];
  const availableFilms = videos.filter(video => video.status === 'available' && video.access === 'free' && video.src);
  const featuredIds = ['miami-frequency', 'island-current'];
  const features = [...featuredIds.map(id => availableFilms.find(video => video.id === id)).filter((video): video is Video => Boolean(video)), ...availableFilms]
    .filter((video, index, collection) => collection.findIndex(other => other.id === video.id) === index)
    .slice(0, 2);

  useEffect(() => {
    if (!entered) return;
    // Move keyboard reading into the newly visible space after its reveal.
    const timer = window.setTimeout(() => heading.current?.focus({ preventScroll: true }), reducedMotion ? 0 : 400);
    return () => window.clearTimeout(timer);
  }, [entered, reducedMotion]);

  const navigate = (event: MouseEvent<HTMLAnchorElement>, portal: SpatialPortal) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(portal.id);
  };
  const focus = (id: string) => { setSelected(id); onFocus(id); };

  return <div className="spatial-hub" data-entered={entered} data-reduced-motion={reducedMotion} data-unavailable={unavailable}>
    <div className="spatial-hub-topline" aria-hidden="true">
      <span><i/>{entered ? 'THE OBSERVATORY' : 'THE ENTRANCE'}</span>
    </div>

    <div className="spatial-entry" aria-hidden={entered} inert={entered}>
      <div className="spatial-entry-copy">
        <p className="spatial-eyebrow">Films. Places. People. Possibilities.</p>
        <h1>CULTURE.<br/><span>STEP</span><br/>INSIDE<span className="spatial-title-stop">.</span></h1>
        <p className="spatial-entry-description">An open door to extraordinary stories.<br/>Step inside. Follow what moves you.</p>
        <div className="spatial-entry-actions">
          <button className="spatial-enter" onClick={() => { window.scrollTo({ top: 0, behavior: 'instant' }); onEnter(); }} data-sound-owned data-cursor="ENTER">
            <span>ENTER MONUMENTAL</span><ArrowRight size={23}/>
          </button>
          <a className="spatial-direct-link" href={href('/category/movies')}>Or browse the films <ArrowUpRight size={15}/></a>
        </div>
      </div>
      <div className="spatial-entry-marker" aria-hidden="true"><span>01</span><i/><span>EVERY STORY<br/>OPENS A WORLD.</span></div>
      <div className="spatial-entry-bottom">
        <span>{unavailable ? 'Your journey begins with a doorway.' : ready ? 'The space is yours to explore.' : 'Preparing your entrance…'}</span>
        <span>MONUMENTAL / PREVIEW EDITION</span>
      </div>
    </div>

    <div className="spatial-observatory" aria-hidden={!entered} inert={!entered}>
      <div className="spatial-observatory-heading">
        <p className="spatial-eyebrow">Six doorways. Your way through.</p>
        <h1 ref={heading} tabIndex={-1}>A WORLD<br/><span>WORTH ENTERING.</span></h1>
        <p className="spatial-instructions">{unavailable ? 'Explore the doorways below.' : reducedMotion ? 'Choose a doorway or use the arrows to look around.' : 'Drag to look around. Select a doorway to go further.'}</p>
      </div>

      <div className="spatial-rotation" aria-label="Look around the observatory">
        <button onClick={() => onRotate(-0.3)} aria-label="Look left" title="Look left" disabled={unavailable} data-sound-owned><ArrowLeft size={20}/></button>
        <span aria-hidden="true">LOOK<br/>AROUND</span>
        <button onClick={() => onRotate(0.3)} aria-label="Look right" title="Look right" disabled={unavailable} data-sound-owned><ArrowRight size={20}/></button>
      </div>

      <div className="spatial-room-deck">
        {active && <div className="spatial-room-description" key={active.id}>
          <span className="spatial-room-preview" aria-hidden="true"><img src={active.image} alt="" decoding="async"/><span>0{portals.indexOf(active) + 1}</span></span>
          <div className="spatial-room-copy">
            <span className="spatial-room-caption"><i/>{active.title}</span>
            <p>{active.description}</p>
          </div>
          <div className="spatial-room-access">
            <span className="spatial-room-count">{active.id === 'my-world' ? 'YOUR COLLECTION' : active.id === 'world' ? `${active.count} ${active.count === 1 ? 'DESTINATION' : 'DESTINATIONS'}` : `${active.count} ${active.count === 1 ? 'STORY' : 'STORIES'} TO EXPLORE`}</span>
            <a href={href(active.route)} onClick={event => navigate(event, active)} data-cursor="ENTER">Enter {active.title.replace(/^The /, '')}<ArrowUpRight size={19}/></a>
          </div>
        </div>}
        <nav className="spatial-room-rail" aria-label="Explore Monumental spaces">
          {portals.map((portal, index) => <a
            key={portal.id}
            href={href(portal.route)}
            className={`spatial-room-link ${active?.id === portal.id ? 'is-selected' : ''}`}
            onClick={event => navigate(event, portal)}
            onPointerEnter={() => focus(portal.id)}
            onPointerLeave={() => onFocus(null)}
            onFocus={() => focus(portal.id)}
            onBlur={() => onFocus(null)}
            data-cursor="ENTER"
            aria-label={`Explore ${portal.title}. ${portal.description}`}
          ><span className="spatial-room-thumb" aria-hidden="true"><img src={portal.image} alt="" loading="lazy" decoding="async"/></span><span className="spatial-room-link-copy"><span className="spatial-room-order">0{index + 1}<ArrowUpRight size={15}/></span><strong>{portal.title}</strong></span><span className="spatial-room-rule" aria-hidden="true"/></a>)}
        </nav>
      </div>

      <aside className="spatial-film-vignettes" aria-label="Start with a story">
        <span className="spatial-vignette-label">OR PRESS PLAY</span>
        {features.map(video => <button key={video.id} className="spatial-film-vignette" onClick={() => onWatch(video)} aria-label={`Play ${video.title}, ${durationLabel(video.duration)}`} data-cursor="WATCH">
          <Play size={13} weight="fill"/><span>{video.title}</span><small>{durationLabel(video.duration)}</small>
        </button>)}
      </aside>
    </div>

    <button className="spatial-sound-toggle" onClick={onToggleSound} aria-pressed={sound && !soundUnavailable} disabled={soundUnavailable} data-sound-owned
      aria-label={soundUnavailable ? 'Sound unavailable in this browser' : sound ? 'Turn sound off' : 'Turn sound on'}>
      {sound && !soundUnavailable ? <SpeakerHigh size={17}/> : <SpeakerSlash size={17}/>}
      <span>{soundUnavailable ? 'SOUND UNAVAILABLE' : sound ? 'SOUND ON' : 'SOUND OFF'}</span>
      <span className="spatial-sound-level" aria-hidden="true"><i/><i/><i/><i/></span>
    </button>
    {unavailable && entered && <p className="spatial-fallback-note" role="status">The 3D view isn’t available here. Every destination is still open below.</p>}
  </div>;
}
