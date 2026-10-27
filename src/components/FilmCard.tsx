import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { SpeakerSlash } from '@phosphor-icons/react/dist/csr/SpeakerSlash';
import { places, type Video } from '../data/catalogue';
import { href } from '../services/router';
import { toggleSaved, updateViewer, useViewer } from '../services/viewer';
import { durationLabel } from '../services/discovery';
import { playSound } from '../services/audio';
import { notify } from '../services/feedback';
import { isLocalMediaSource } from '../services/mediaPreview';
import './film-card.css';

export function SaveButton({ video, small = false }: { video: Video; small?: boolean }) {
  const viewer = useViewer();
  const saved = viewer.saved.includes(video.id);
  return <button data-sound-owned className={small ? 'icon-button save-small' : 'button button-outline'} aria-label={`${saved ? 'Remove' : 'Save'} ${video.title}`} aria-pressed={saved} onClick={() => {
    const added = toggleSaved(video.id);
    playSound(added ? 'save' : 'remove');
    notify(added ? `${video.title} saved to My World` : `${video.title} removed`, 'Undo', () => { updateViewer(state=>({saved:added?state.saved.filter(id=>id!==video.id):[...new Set([...state.saved,video.id])]})); playSound(added ? 'remove' : 'save'); });
  }}>{saved ? <Check size={18}/> : <Plus size={18}/>} {!small && (saved ? 'Saved' : 'Save for later')}</button>;
}

export function filmFormat(video: Video): string {
  if (video.status === 'development') return 'Original series';
  if (video.tags.includes('motion study')) return 'Preview study';
  if (video.tags.includes('trailer')) return 'Official trailer';
  if (video.tags.includes('full film')) return 'Complete film';
  return video.category;
}

export default function FilmCard({ video, onWatch }: { video: Video; onWatch: (video: Video) => void }) {
  const viewer = useViewer();
  const history = viewer.history[video.id];
  const [previewing, setPreviewing] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const media = useRef<HTMLVideoElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLElement>(null);
  const previewEpoch = useRef(0);
  const identifier = useRef(Symbol(video.id));
  const canWatch = video.status === 'available' && Boolean(video.src);
  const canPreview = canWatch && video.access === 'free' && isLocalMediaSource(video.src);
  const completion = history && history.duration > 0 ? Math.min(100, history.time / history.duration * 100) : 0;
  const stop = () => { previewEpoch.current += 1; media.current?.pause(); setPreviewing(false); setReady(false); };
  const start = () => {
    if (!canPreview || document.hidden || document.querySelector('.ms-player-dialog[open]')) return;
    window.dispatchEvent(new CustomEvent('monumental:preview', { detail: identifier.current }));
    setFailed(false); setPreviewing(true);
  };
  useEffect(() => {
    const stopOther = (event: Event) => { if ((event as CustomEvent).detail !== identifier.current) stop(); };
    const playback = () => stop();
    const visibility = () => { if (document.hidden) stop(); };
    const observer = new IntersectionObserver(([entry]) => { if (!entry?.isIntersecting || entry.intersectionRatio < .15) stop(); }, { threshold: [0, .15] });
    if (root.current) observer.observe(root.current);
    window.addEventListener('monumental:preview', stopOther);
    window.addEventListener('monumental:playback', playback);
    document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); window.removeEventListener('monumental:preview', stopOther); window.removeEventListener('monumental:playback', playback); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => { if (viewer.reducedMotion) stop(); }, [viewer.reducedMotion]);
  useEffect(() => {
    const element = media.current;
    if (!previewing || !element) return;
    if (video.src && element.getAttribute('src') !== video.src) element.src = video.src;
    const epoch = previewEpoch.current;
    let active = true;
    const timeout = window.setTimeout(stop, 8000);
    void element.play().catch(() => {
      if (!active || previewEpoch.current !== epoch) return;
      setFailed(true); stop();
    });
    return () => { active = false; clearTimeout(timeout); element.pause(); element.removeAttribute('src'); element.load(); };
  }, [previewing, video.src]);

  return <article ref={root} className={`film-card ${previewing ? 'is-previewing' : ''} ${video.status === 'development' ? 'film-card--planned' : ''}`}>
    <div className="film-image" onPointerLeave={() => { if (previewing) stop(); }}>
      <a href={href('/film/' + video.id)} data-transition-film={video.id} aria-label={`Details: ${video.title}`} data-cursor="STORY">
        <img src={video.poster} alt="" loading="lazy" decoding="async"/>
        {previewing && <video key={video.id} ref={media} className={`card-video ${ready ? 'is-ready' : ''}`} src={video.src} muted playsInline preload="none" aria-hidden="true" onPlaying={() => setReady(true)} onEnded={stop} onTimeUpdate={() => {
          if (media.current && meter.current) meter.current.style.transform = `scaleX(${Math.min(1, media.current.currentTime / Math.min(8, media.current.duration || 8))})`;
        }} onError={() => { setFailed(true); stop(); }}/>}<span className="film-image-shade"/>
      </a>
      {previewing && <span className="card-preview-progress" aria-hidden="true" ref={meter}/>}
      {!previewing && history && <span className="film-progress" aria-label={`${Math.round(completion)}% watched`}><span style={{ width: `${completion}%` }}/></span>}
    </div>
    <div className="film-meta"><span>{filmFormat(video)}{filmFormat(video) !== video.category && <> / {video.category}</>}</span><span>{video.duration ? durationLabel(video.duration) : 'In development'}{history?.completed ? <> · <Check size={12}/> Watched</> : history && completion > 0 ? ` · ${Math.round(completion)}% watched` : ''}</span></div>
    <a className="film-title" data-transition-film={video.id} href={href('/film/' + video.id)}>{video.title}<ArrowUpRight size={20}/></a>
    <span className="film-place">{video.places.map(p => places.find(x => x.id === p)?.name).join(' / ') || 'Independent cinema'}</span>
    <div className="film-card-actions">
      {canWatch ? <button className="film-card-watch" onClick={() => { stop(); onWatch(video); }} aria-label={`Play ${video.title}`}><Play weight="fill" size={15}/><span>{video.tags.includes('full film') ? 'Watch film' : video.tags.includes('trailer') ? 'Watch trailer' : 'Watch study'}</span></button> : <a className="film-card-watch" href={href('/film/' + video.id)}>Explore the original <ArrowUpRight size={16}/></a>}
      {canPreview && <button className="card-preview-toggle" data-sound-owned aria-label={`${previewing ? 'Stop' : 'Preview'} ${video.title} ${previewing ? 'preview' : 'silently'}`} title="A silent 8-second look" aria-pressed={previewing} onClick={() => { if (previewing) stop(); else start(); playSound('select', { intensity: .5 }); }}>{previewing ? <Pause size={15}/> : <SpeakerSlash size={15}/>}<span>{previewing ? 'Stop preview' : 'Quick look'}</span></button>}
      <SaveButton video={video} small/>
    </div>
    {failed && <span className="card-preview-error" role="status">Quick look unavailable. Use the watch control to retry in the player.</span>}
  </article>;
}
