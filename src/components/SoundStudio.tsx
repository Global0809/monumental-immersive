import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { SpeakerHigh } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import { SpeakerSlash } from '@phosphor-icons/react/dist/csr/SpeakerSlash';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Waveform } from '@phosphor-icons/react/dist/csr/Waveform';
import { Planet } from '@phosphor-icons/react/dist/csr/Planet';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { Disc } from '@phosphor-icons/react/dist/csr/Disc';
import { Magnet } from '@phosphor-icons/react/dist/csr/Magnet';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowsOut } from '@phosphor-icons/react/dist/csr/ArrowsOut';
import { useViewer } from '../services/viewer';
import { getSonicState, playSound, readSoundWaveform, setAmbientEnabled, setAmbientMix, setMasterVolume, setSoundEnabled, subscribeSonicState, type SonicPulse, type SoundType } from '../services/audio';
import './sound-studio.css';

const materials: { name: string; type: SoundType; note: string; icon: typeof Magnet }[] = [
  { name: 'Magnetic', type: 'select', note: 'A tactile connection', icon: Magnet },
  { name: 'Glass', type: 'save', note: 'A clear confirmation', icon: Sparkle },
  { name: 'Transit', type: 'destination', note: 'A change of world', icon: Planet },
  { name: 'Memory', type: 'era', note: 'A turn through time', icon: Disc },
  { name: 'Unfold', type: 'sculpture-unfold', note: 'Space opening up', icon: ArrowsOut },
  { name: 'Resonance', type: 'sculpture-pulse', note: 'A physical response', icon: Waveform },
];

function SonicScope({ calm, enabled }: { calm: boolean; enabled: boolean }) {
  const path = useRef<SVGPathElement>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element || !enabled || calm) { path.current?.setAttribute('d', 'M 0 40 H 600'); return; }
    let frame = 0; let visible = true; let last = 0;
    const draw = (time: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (time - last > 33) {
        last = time;
        const samples = readSoundWaveform();
        if (samples) {
          const points = Array.from({ length: 128 }, (_, i) => {
            const value = Math.max(-1, Math.min(1, samples[i * 2] * 11));
            return (i ? 'L' : 'M') + ((i / 127) * 600).toFixed(1) + ' ' + (40 - value * 34).toFixed(1);
          });
          path.current?.setAttribute('d', points.join(' '));
        } else path.current?.setAttribute('d', 'M 0 40 H 600');
      }
      frame = requestAnimationFrame(draw);
    };
    const restart = () => { cancelAnimationFrame(frame); if (visible && !document.hidden) frame = requestAnimationFrame(draw); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; restart(); });
    observer.observe(element); document.addEventListener('visibilitychange', restart); restart();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', restart); };
  }, [calm, enabled]);
  return <div ref={host} className="sonic-scope" aria-hidden="true"><div className="sonic-scope-rule"/><svg viewBox="0 0 600 80" preserveAspectRatio="none"><path ref={path} d="M 0 40 H 600"/></svg><span>L</span><span>R</span></div>;
}

/** Embed the full studio in Settings, or compact inside a user-opened sound panel. */
export function SoundStudio({ compact = false }: { compact?: boolean }) {
  const viewer = useViewer();
  const engine = useSyncExternalStore(subscribeSonicState, getSonicState, getSonicState);
  const [lastVoice, setLastVoice] = useState('Your world, with sound.');
  const [active, setActive] = useState<SoundType | null>(null);
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId(); const calm = viewer.reducedMotion || systemReduced; const unavailable = engine.status === 'unavailable';
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(preference.matches);
    preference.addEventListener('change', update);
    const pulse = (event: Event) => {
      const detail = (event as CustomEvent<SonicPulse>).detail;
      setActive(detail.type);
      setLastVoice(materials.find(material => material.type === detail.type)?.name || detail.type.replace(/sculpture-|-/g, ' '));
      clearTimeout(timer.current); timer.current = setTimeout(() => setActive(null), 650);
    };
    window.addEventListener('monumental:sonic-pulse', pulse);
    return () => { clearTimeout(timer.current); preference.removeEventListener('change', update); window.removeEventListener('monumental:sonic-pulse', pulse); };
  }, []);
  const status = unavailable ? 'Audio unavailable in this browser' : engine.playback ? 'Quiet while your film plays' : !viewer.sound ? 'Sound is off' : engine.status === 'waiting' || engine.status === 'suspended' ? 'Ready for your next touch' : viewer.masterVolume === 0 ? 'Volume is at zero' : 'Sound is on';
  function audition(type: SoundType, index: number) {
    // The pad never opts the visitor in on their behalf.
    if (!viewer.sound) { setLastVoice('Turn sound on to try the instruments.'); return; }
    if (viewer.masterVolume === 0) { setLastVoice('Raise the volume to hear this instrument.'); return; }
    playSound(type, { intensity: 0.85, pan: (index % 3 - 1) * 0.35 });
  }
  return <section className={'sound-studio' + (compact ? ' sound-studio--compact' : '') + (calm ? ' sound-studio--calm' : '')} data-sound-owned aria-labelledby={id + '-title'}>
    <div className="sonic-heading"><div><h2 id={id + '-title'}>{compact ? 'SOUND STUDIO.' : <>FEEL THE<br/>FREQUENCY.</>}</h2><p>Original sounds. A world that answers back.</p></div><button className={'sonic-power' + (viewer.sound && !unavailable ? ' is-on' : '')} role="switch" aria-label="Interface sound" disabled={unavailable} aria-checked={viewer.sound && !unavailable} onClick={() => setSoundEnabled(!viewer.sound)}>{viewer.sound && !unavailable ? <SpeakerHigh size={24}/> : <SpeakerSlash size={24}/>}<span>{unavailable ? '—' : viewer.sound ? 'ON' : 'OFF'}</span></button></div>
    <div className="sonic-monitor"><div className="sonic-monitor-top"><span className={viewer.sound && engine.status === 'running' && !engine.playback ? 'is-live' : ''}><i/>{status}</span><span>{viewer.sound && !unavailable ? 'STEREO' : 'SILENT'}</span></div><SonicScope enabled={viewer.sound && engine.status === 'running' && !engine.playback} calm={calm}/><div className="sonic-monitor-bottom"><span>{active ? 'NOW RESONATING' : 'TOUCH AN INSTRUMENT'}</span><strong>{lastVoice}<Waveform size={15}/></strong></div></div>
    <div className="sonic-mix"><label className="sonic-slider" htmlFor={id + '-volume'}><span>Master volume <output htmlFor={id + '-volume'}>{Math.round(viewer.masterVolume * 100)}%</output></span><input id={id + '-volume'} type="range" min="0" max="100" step="1" value={Math.round(viewer.masterVolume * 100)} aria-valuetext={Math.round(viewer.masterVolume * 100) + ' percent'} onChange={event => setMasterVolume(Number(event.target.value) / 100)}/></label><div className="sonic-ambient"><span><strong>Atmosphere</strong><small>A quiet tone that changes with your world.</small></span><button className={'sonic-switch' + (viewer.ambient ? ' is-on' : '')} role="switch" aria-checked={viewer.ambient} aria-label="Ambient atmosphere" disabled={!viewer.sound || unavailable} onClick={() => setAmbientEnabled(!viewer.ambient)}><span/></button></div>{viewer.ambient && <label className="sonic-slider sonic-ambient-mix" htmlFor={id + '-mix'}><span>Atmosphere mix <output htmlFor={id + '-mix'}>{Math.round(viewer.ambientMix * 100)}%</output></span><input id={id + '-mix'} type="range" min="0" max="100" step="1" value={Math.round(viewer.ambientMix * 100)} aria-valuetext={Math.round(viewer.ambientMix * 100) + ' percent'} onChange={event => setAmbientMix(Number(event.target.value) / 100)} disabled={!viewer.sound || unavailable}/></label>}</div>
    <div className="sonic-instruments" aria-label="Audition the interface sounds">{materials.map((material, index) => <button key={material.type} className={active === material.type ? 'is-resonating' : ''} onClick={() => audition(material.type, index)} disabled={!viewer.sound || engine.playback || engine.status === 'unavailable'} aria-label={'Audition ' + material.name.toLowerCase() + ' sound'}><material.icon size={24} weight="thin"/><span><strong>{material.name}</strong><small>{material.note}</small></span><Play size={13} weight="fill"/></button>)}</div>
    <p className="sonic-footnote">{compact ? 'Sound follows your actions. Films take priority.' : 'Made from original synthesis: magnetic clicks, glass harmonics, transport air and physical resonance. Sound starts with your permission, rests when you leave and stays quiet during films.'}{compact && <a href="#/settings">Experience settings <ArrowUpRight size={12}/></a>}</p>
    <span className="sonic-announcement" role="status">{status}</span>
  </section>;
}
export default SoundStudio;
