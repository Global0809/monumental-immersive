import { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { playSound } from '../services/audio';
import { motionMediaTransition, motionMediaLabels, motionMediaCanSeek } from '../services/motionMedia';
import { prepareSeekableMedia } from '../services/seekableMedia';
import './motion-showcase.css';
const films = [
 ['01-living-atlas','The living atlas','A world of culture, connected.','/world'],
 ['02-time-machine','Step into another decade','Follow the moments that moved us.','/time-machine'],
 ['03-connections','Every story has a connection','People, places and the stories between them.','/journey'],
 ['04-catalogue-player','Find your next story','Discover the preview collection.','/search'],
 ['05-premium-vault','Beyond the ordinary','A visual concept for Monumental+.','/premium'],
 ['06-deco-atlas','A different view of the world','Explore a city through its creative character.','/world'],
 ['07-bauhaus-categories','Culture in every shape','Follow your curiosity across categories.','/category/culture'],
 ['08-culture-passport','Collect a world of your own','Your places, stories and discoveries.','/my-world'],
 ['09-brand-chrome','Made to be Monumental','An identity in constant motion.','/world'],
 ['10-living-membrane','Enter the unexpected','A study of form, rhythm and possibility.','/world'],
 ['11-sound-aurora','Feel the frequency','Discover the original interface sound palette.','/settings'],
 ['12-cursor-language','A world that answers back','An exploration of responsive interaction.','/settings'],
 ['13-mobile-app','Built for touch','A concept for culture on the move.','/my-world'],
 ['14-search-filters','Find your frequency','A place. A film. A new direction.','/search'],
 ['15-miami-isometric','Miami, up close','Explore our opening cultural gateway.','/world?place=miami'],
 ['16-story-paper','The story behind the story','A visual direction for the planned original.','/film/story-behind-the-story'],
 ['17-wavemakers-lines','WAVEMAKERS','An original series in development.','/film/wavemakers-valid-id'],
 ['18-take-me-somewhere','Take me somewhere','Turn your available time into a journey.','/journey'],
];
const selections: Record<string,number[]> = { '/':[8,0,1,16,17], '/world':[0,5,14,2], '/time-machine':[1,5], '/search':[13,3,6], '/premium':[4], '/my-world':[7,12], '/settings':[10,11,9], '/journey':[17,2], '/live':[2,0] };


const asset = (name: string) => `${import.meta.env.BASE_URL}motion/${name}`;
const conceptIndex = () => Math.max(0, films.findIndex(film => film[0] === new URLSearchParams(location.hash.split('?')[1] || '').get('concept')));

export default function MotionShowcase({ path, reducedMotion }: { path: string; reducedMotion: boolean }) {
  if (path === '/motion') return <MotionGallery reducedMotion={reducedMotion}/>;
  const ids = selections[path] || (path.includes('wavemakers') ? [16] : path.startsWith('/film/') ? [15, 3] : path.startsWith('/category/') ? [6, 3] : []);
  if (!ids.length) return null;
  const film = films[ids[0]];
  return <section className="motion-context page-section" aria-label="Related motion concept">
    <a className="motion-context-image" href={`#/motion?concept=${film[0]}`} aria-label={`View ${film[1]} motion concept`}><img src={asset(film[0] + '.jpg')} alt="" loading="lazy"/><Play size={24} weight="fill"/></a>
    <div><h2>{film[1]}</h2><p>{film[2]} A motion concept from the creative laboratory.</p></div>
    <a className="text-link" href={`#/motion?concept=${film[0]}`}>Watch the concept <ArrowUpRight size={18}/></a>
  </section>;
}

function MotionGallery({ reducedMotion }: { reducedMotion: boolean }) {
  const [selected, setSelected] = useState(conceptIndex);
  const [state, dispatch] = useReducer(motionMediaTransition, 'idle');
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState('');
  const stage = useRef<HTMLDivElement>(null);
  const media = useRef<HTMLVideoElement>(null);
  const generation = useRef(0);
  const film = films[selected];
  const failed = state === 'failed' || state === 'unsupported';
  const canSeek = motionMediaCanSeek(state, duration);

  useEffect(() => {
    const sync = () => setSelected(conceptIndex());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    generation.current += 1;
    setRequested(false); setElapsed(0); setDuration(0); setMessage(''); dispatch('reset');
  }, [selected]);

  useEffect(() => {
    const element = media.current;
    if (!element || !requested) return;
    const epoch = ++generation.current;
    let alive = true;
    const abort = new AbortController();
    let lease: Awaited<ReturnType<typeof prepareSeekableMedia>> | undefined;
    if (!element.canPlayType('video/mp4; codecs="avc1.64001f"')) {
      dispatch('unsupported');
      setMessage('This browser cannot decode this preview. The poster and concept description remain available.');
      return;
    }
    dispatch('request');
    // Only the requested clip owns a prepared source. Range-capable hosts stay
    // streamed; the shared helper bounds the local Blob fallback on other hosts.
    void (async () => {
      const prepared = await prepareSeekableMedia(asset(film[0] + '.mp4'), abort.signal);
      if (!alive || epoch !== generation.current || media.current !== element) { prepared.release(); return; }
      lease = prepared;
      element.src = prepared.src;
      element.load();
      const bounds = stage.current?.getBoundingClientRect();
      // Preparing a source may outlast the visitor's attention or another film
      // opening. Do not restart a preview that visibility handling already paused.
      if (document.hidden || document.querySelector('.ms-player-dialog[open]') || !bounds || bounds.bottom <= 0 || bounds.top >= innerHeight) return;
      await element.play();
    })().catch((error: unknown) => {
      if (!alive || epoch !== generation.current || media.current !== element) return;
      const name = error instanceof Error ? error.name : '';
      if (name === 'AbortError') return;
      if (name === 'NotAllowedError') { dispatch('loaded'); setMessage('Your browser paused automatic playback. Press Play to continue.'); }
      else { dispatch('failed'); setMessage('The preview could not be played. Retry the film, or explore its concept below.'); }
    });
    return () => {
      alive = false; generation.current += 1; abort.abort();
      // Detach the native decoder before revoking a Blob it may still be using.
      element.pause(); element.removeAttribute('src'); element.load();
      lease?.release();
    };
  }, [requested, attempt, selected]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const pause = () => media.current?.pause();
    const observer = new IntersectionObserver(([entry]) => { if (!entry?.isIntersecting) pause(); }, { threshold: 0 });
    observer.observe(element);
    const visibility = () => { if (document.hidden) pause(); };
    const playback = (event: Event) => { if ((event as CustomEvent).detail?.active) pause(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('monumental:playback', playback);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('monumental:playback', playback); };
  }, []);
  useEffect(() => { if (reducedMotion) media.current?.pause(); }, [reducedMotion]);

  function start() {
    setMessage('');
    if (!requested || failed) { setRequested(true); setAttempt(value => value + 1); return; }
    const element = media.current;
    if (element) void element.play().catch((error: unknown) => {
      if (media.current !== element || (error instanceof Error && error.name === 'AbortError')) return;
      dispatch('failed'); setMessage('The preview could not be played. Please retry.');
    });
  }
  function choose(index: number) {
    const next = (index + films.length) % films.length;
    if (next === selected) return;
    media.current?.pause();
    setRequested(false); dispatch('reset'); setSelected(next); playSound('select');
    const url = new URL(location.href); url.hash = `/motion?concept=${films[next][0]}`;
    history.replaceState(history.state, '', url);
  }
  function inspectFrame(time: number) {
    if (!media.current || !canSeek) return;
    media.current.pause(); media.current.currentTime = time; setElapsed(time);
  }
  const toggleLabel = failed ? 'Retry preview' : state === 'playing' ? 'Pause preview' : 'Play preview';
  return <section className="motion-showcase motion-showcase--full page-section" aria-label="Experience in motion">
    <header className="motion-heading"><div><h1>Ideas in motion.</h1><p>{films.length} short visual treatments. An open sketchbook for the Monumental experience.</p></div><button className="text-link" onClick={() => document.getElementById('material-lab')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' })}>Try the working sculpture <ArrowRight size={18}/></button></header>
    <div className="motion-layout"><div className="motion-screen">
      <div ref={stage} className={`motion-stage ${failed ? 'has-error' : ''}`} data-media-state={state}>
        <img className="motion-poster" src={asset(film[0] + '.jpg')} alt=""/>
        {requested && <video key={`${film[0]}-${attempt}`} ref={media} muted loop playsInline preload="metadata" aria-label={`${film[1]} motion concept`}
          className={duration > 0 && !failed ? 'is-decoded' : ''}
          onLoadedMetadata={event => { if (event.currentTarget === media.current) setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0); }}
          onLoadedData={event => { if (event.currentTarget === media.current) dispatch('loaded'); }}
          onPlaying={event => { if (event.currentTarget !== media.current) return; dispatch('play'); setMessage(''); }} onPause={event => { if (event.currentTarget === media.current) dispatch('pause'); }} onWaiting={event => { if (event.currentTarget === media.current) dispatch('waiting'); }} onEnded={event => { if (event.currentTarget === media.current) dispatch('ended'); }}
          onError={event => { if (event.currentTarget !== media.current) return; const code = event.currentTarget.error?.code; if (code === 1) return; dispatch('failed'); setMessage(code === 2 ? 'This preview could not load over your connection. Retry when you are ready.' : 'This preview could not be loaded or decoded. Retry, or explore the idea below.'); }}
          onTimeUpdate={event => { if (event.currentTarget === media.current) setElapsed(event.currentTarget.currentTime); }}/>}
        <div className="motion-status"><i className={state === 'playing' ? 'is-playing' : ''}/><span>{motionMediaLabels[state]}</span><span>Silent concept film</span></div>
        {(state === 'idle' || failed) && <div className="motion-stage-invitation"><button className="motion-stage-play" aria-label={`${failed ? 'Retry' : 'Play'} ${film[1]} preview`} onClick={start}>{failed ? <ArrowCounterClockwise size={24}/> : <Play size={24} weight="fill"/>}<span>{failed ? 'Retry preview' : 'Play concept'}</span></button>{failed && <p role="status">{message}</p>}</div>}
        {state === 'loading' && <div className="motion-loading" role="status">Preparing preview…</div>}
        {canSeek && <div className="motion-progress" aria-hidden="true"><span style={{ transform: `scaleX(${elapsed / duration})` }}/></div>}
      </div>
      <div className="motion-caption"><div><h2>{film[1]}</h2><p>{film[2]}</p></div><a className="text-link" href={'#' + film[3]}>Explore the idea <ArrowUpRight size={18}/></a></div>
      <div className="motion-controls">
        <button onClick={() => choose(selected - 1)} aria-label="Previous motion film"><ArrowLeft size={19}/></button>
        <button className="motion-play" onClick={() => { if (state === 'playing') media.current?.pause(); else start(); }} aria-label={toggleLabel}>{state === 'playing' ? <Pause size={16} weight="fill"/> : failed ? <ArrowCounterClockwise size={16}/> : <Play size={16} weight="fill"/>}<span>{toggleLabel}</span></button>
        <button onClick={() => choose(selected + 1)} aria-label="Next motion film"><ArrowRight size={19}/></button>
        <label className="motion-scrubber"><span className="sr-only">Inspect a frame</span><input type="range" min="0" max={duration || 1} step="0.05" value={Math.min(elapsed, duration || 1)} disabled={!canSeek} aria-label={`Inspect ${film[1]} preview frame`} aria-valuetext={canSeek ? `${elapsed.toFixed(1)} seconds of ${duration.toFixed(1)} seconds` : 'Preview not loaded'} onChange={event => inspectFrame(Number(event.target.value))}/><output>{canSeek ? `${elapsed.toFixed(1)} / ${duration.toFixed(1)}s` : '— / —'}</output></label>
      </div>
      {message && !failed && <p className="motion-note" role="status">{message}</p>}
    </div>
    <div className="motion-index" role="group" aria-label="Choose a motion film" onKeyDown={event => { const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button')); const index = buttons.indexOf(event.target as HTMLButtonElement); if (index < 0) return; const next = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : null; if (next === null) return; event.preventDefault(); const bounded = Math.max(0, Math.min(buttons.length - 1, next)); choose(bounded); buttons[bounded]?.focus(); }}>
      {films.map((item, index) => <button key={item[0]} aria-pressed={selected === index} onClick={() => choose(index)}><span>{String(index + 1).padStart(2, '0')}</span><img src={asset(item[0] + '.jpg')} loading="lazy" alt=""/><strong>{item[1]}</strong>{selected === index && <Play size={13} weight="fill"/>}</button>)}
    </div></div>
    <p className="motion-note">These supplied concept films explore visual directions, including experiences still in development. They are distinct from the working experiments below.</p>
  </section>;
}
