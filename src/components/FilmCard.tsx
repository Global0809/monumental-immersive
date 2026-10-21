import { isLocalMedia } from '../services/assets';
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
import './film-card.css';

export function SaveButton({ video, small = false }: { video: Video; small?: boolean }) {
  const viewer = useViewer();
  const saved = viewer.saved.includes(video.id);
  return <button data-sound-owned className={small ? 'icon-button save-small' : 'button button-outline'} aria-label={`${saved ? 'Remove' : 'Save'} ${video.title}`} aria-pressed={saved} onClick={() => {
    const added = toggleSaved(video.id);
    playSound(added ? 'save' : 'close');
    notify(added ? `${video.title} saved to My World` : `${video.title} removed`, 'Undo', () => { updateViewer(state=>({saved:added?state.saved.filter(id=>id!==video.id):[...new Set([...state.saved,video.id])]})); playSound('select'); });
  }}>{saved ? <Check size={18}/> : <Plus size={18}/>} {!small && (saved ? 'Saved' : 'Save for later')}</button>;
}

export default function FilmCard({ video, onWatch }: { video: Video; onWatch: (video: Video) => void }) {
  const viewer = useViewer();
  const progress = viewer.history[video.id];
  const [previewing, setPreviewing] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const media = useRef<HTMLVideoElement>(null);
  const root = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const identifier = useRef(Symbol(video.id));
  const canPreview = video.status === 'available' && video.access === 'free' && isLocalMedia(video.src);
  const completion = progress && progress.duration > 0 ? Math.min(100, progress.time / progress.duration * 100) : 0;

  const stop = () => { clearTimeout(timer.current); media.current?.pause(); setPreviewing(false); setReady(false); };
  const start = () => {
    if (!canPreview || document.hidden || document.querySelector('.ms-player-dialog[open]')) return;
    window.dispatchEvent(new CustomEvent('monumental:preview', { detail: identifier.current }));
    setFailed(false); setPreviewing(true); setPreviewProgress(0);
  };
  useEffect(() => {
    const stopOther = (event: Event) => { if ((event as CustomEvent).detail !== identifier.current) stop(); };
    const playback = () => stop();
    const visibility = () => { if (document.hidden) stop(); };
    const observer = new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); }, { threshold: .15 });
    if (root.current) observer.observe(root.current);
    window.addEventListener('monumental:preview', stopOther);
    window.addEventListener('monumental:playback', playback);
    document.addEventListener('visibilitychange', visibility);
    return () => { clearTimeout(timer.current); observer.disconnect(); window.removeEventListener('monumental:preview', stopOther); window.removeEventListener('monumental:playback', playback); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => { if (viewer.reducedMotion) stop(); }, [viewer.reducedMotion]);
  useEffect(() => {
    const element = media.current;
    if (!previewing || !element) return;
    return () => {
      if (!element.isConnected) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
    };
  }, [previewing]);

  return <article ref={root} className={`film-card ${previewing ? 'is-previewing' : ''}`}>
    <div className="film-image" onPointerEnter={event => {
      if (event.pointerType === 'mouse' && !viewer.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches && canPreview) timer.current = setTimeout(start, 850);
    }} onPointerLeave={stop}>
      <a href={href('/film/' + video.id)} data-transition-film={video.id} aria-label={`Details: ${video.title}`} data-cursor="STORY">
        <img src={video.poster} alt="" loading="lazy"/>
        {previewing && <video ref={media} className={`card-video ${ready ? 'is-ready' : ''}`} src={video.src} muted loop playsInline autoPlay preload="none" aria-hidden="true" onPlaying={() => setReady(true)} onCanPlay={() => { void media.current?.play().catch(() => { setFailed(true); setPreviewing(false); }); }} onTimeUpdate={() => {
          if (media.current && Number.isFinite(media.current.duration)) setPreviewProgress(media.current.currentTime / media.current.duration * 100);
        }} onError={() => { setFailed(true); setPreviewing(false); }}/>}<span className="film-image-shade"/>
      </a>
      <span className="film-type">{video.status === 'development' ? 'In development' : video.tags.includes('motion study') ? 'Preview study' : 'Open cinema'}</span>
      <SaveButton video={video} small/>
      {video.status === 'available' && <button className="film-play" onClick={() => { stop(); onWatch(video); }} data-cursor="WATCH" aria-label={`Play ${video.title}`}><Play weight="fill" size={22}/></button>}
      {canPreview && <button className="card-preview-toggle" data-sound-owned aria-label={`${previewing ? 'Stop' : 'Preview'} ${video.title} ${previewing ? 'preview' : 'silently'}`} aria-pressed={previewing} onClick={() => { clearTimeout(timer.current); if (previewing) stop(); else start(); playSound('select', { intensity: .5 }); }}>{previewing ? <Pause size={11}/> : <Play size={11}/>}<span>{previewing ? 'Previewing' : 'Quick look'}</span>{previewing && <SpeakerSlash size={11}/>}</button>}
      {previewing && <span className="card-preview-progress" aria-hidden="true" style={{ transform: `scaleX(${previewProgress / 100})` }}/>}
      {failed && <span className="card-preview-error" role="status">Open the film to watch</span>}
      {!previewing && progress && <span className="film-progress" aria-label={`${Math.round(completion)}% watched`}><span style={{ width: `${completion}%` }}/></span>}
    </div>
    <div className="film-meta"><span>{video.category}</span><span>{progress?.completed ? <><Check size={11}/> Watched</> : progress && completion > 0 ? `${Math.round(completion)}% watched` : video.duration ? durationLabel(video.duration) : 'Original series'}</span></div>
    <a className="film-title" data-transition-film={video.id} href={href('/film/' + video.id)}>{video.title}<ArrowUpRight size={22}/></a>
    <span className="film-place">{video.places.map(p => places.find(x => x.id === p)?.name).join(' / ') || 'Independent cinema'}</span>
  </article>;
}
