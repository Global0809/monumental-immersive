import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { SpeakerHigh } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import { SpeakerSlash } from '@phosphor-icons/react/dist/csr/SpeakerSlash';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Waveform } from '@phosphor-icons/react/dist/csr/Waveform';
import { Planet } from '@phosphor-icons/react/dist/csr/Planet';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { Magnet } from '@phosphor-icons/react/dist/csr/Magnet';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowsOut } from '@phosphor-icons/react/dist/csr/ArrowsOut';
import { ArrowsIn } from '@phosphor-icons/react/dist/csr/ArrowsIn';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { useViewer } from '../services/viewer';
import { createFrameCadence } from '../services/frameCadence';
import { getSonicState, playSound, readSoundWaveform, setAmbientEnabled, setAmbientMix, setMasterVolume, setSoundEnabled, subscribeSonicState, type SonicPulse, type SoundType } from '../services/audio';
import './sound-studio.css';

const materials: { name: string; type: SoundType; note: string; icon: typeof Magnet }[] = [
  { name: 'Select', type: 'select', note: 'A brief, soft contact', icon: Magnet },
  { name: 'Passage', type: 'navigate', note: 'A quiet breath of air', icon: ArrowUpRight },
  { name: 'Memory', type: 'save', note: 'A clear glass tone', icon: Sparkle },
  { name: 'Open', type: 'open', note: 'A gentle outward lift', icon: ArrowsOut },
  { name: 'Close', type: 'close', note: 'A soft settling note', icon: ArrowsIn },
  { name: 'Portal', type: 'portal', note: 'A spacious, fading tone', icon: Planet },
];

function SonicScope({ calm, enabled }: { calm: boolean; enabled: boolean }) {
  const path = useRef<SVGPathElement>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element || !enabled || calm) { path.current?.setAttribute('d', 'M 0 40 H 600'); return; }
    let frame = 0; let visible = true; let flat = false;
    const cadence = createFrameCadence();
    const draw = (time: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (cadence.ready(time)) {
        const samples = readSoundWaveform();
        if (samples) {
          const points = Array.from({ length: 128 }, (_, i) => {
            const value = Math.max(-1, Math.min(1, samples[i * 2] * 5));
            return (i ? 'L' : 'M') + ((i / 127) * 600).toFixed(1) + ' ' + (40 - value * 34).toFixed(1);
          });
          path.current?.setAttribute('d', points.join(' '));
          flat = false;
        } else if (!flat) { path.current?.setAttribute('d', 'M 0 40 H 600'); flat = true; }
      }
      frame = requestAnimationFrame(draw);
    };
    const restart = () => { cancelAnimationFrame(frame); cadence.reset(); if (visible && !document.hidden) frame = requestAnimationFrame(draw); };
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
  const [lastVoice, setLastVoice] = useState('Choose a sound to listen.');
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
  const status = unavailable ? 'Audio unavailable in this browser' : engine.playback ? 'Quiet during playback' : !viewer.sound ? 'Sound is off' : viewer.masterVolume === 0 ? 'Volume is at zero' : engine.status === 'waiting' || engine.status === 'suspended' ? 'Ready for your next touch' : 'Sound is on';
  function audition(type: SoundType, index: number) {
    // The pad never opts the visitor in on their behalf.
    if (!viewer.sound) { setLastVoice('Turn sound on to try the instruments.'); return; }
    if (viewer.masterVolume === 0) { setLastVoice('Raise the volume to hear this instrument.'); return; }
    if (engine.playback || unavailable) return;
    playSound(type, { intensity: 0.85, pan: (index % 3 - 1) * 0.12, audition: true });
  }
  return <section className={'sound-studio' + (compact ? ' sound-studio--compact' : '') + (calm ? ' sound-studio--calm' : '')} data-sound-owned aria-labelledby={id + '-title'} onKeyDown={event => { if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || (event.target as HTMLElement).matches('input, textarea, select, [contenteditable=true]')) return; const index = Number(event.key) - 1; if (/^[1-6]$/.test(event.key) && materials[index]) { event.preventDefault(); audition(materials[index].type, index); } }}>
    <div className="sonic-heading"><div><h2 id={id + '-title'}>{compact ? 'SOUND STUDIO.' : <>FEEL THE<br/>FREQUENCY.</>}</h2><p>Soft contact, air and glass. A little sound, with room for silence.</p></div><button className={'sonic-power' + (viewer.sound && !unavailable ? ' is-on' : '')} role="switch" aria-label="Interface sound" disabled={unavailable} aria-checked={viewer.sound && !unavailable} onClick={() => setSoundEnabled(!viewer.sound)}>{viewer.sound && !unavailable ? <SpeakerHigh size={24}/> : <SpeakerSlash size={24}/>}<span>{unavailable ? '—' : viewer.sound ? 'ON' : 'OFF'}</span></button></div>
    <div className="sonic-monitor"><div className="sonic-monitor-top"><span className={viewer.sound && engine.status === 'running' && !engine.playback ? 'is-live' : ''}><i/>{status}</span><span>{viewer.sound && !unavailable ? (viewer.ambient ? engine.scene.toUpperCase() + ' / STEREO' : 'STEREO') : 'SILENT'}</span></div><SonicScope enabled={viewer.sound && engine.status === 'running' && !engine.playback} calm={calm}/><div className="sonic-monitor-bottom"><span>{active ? 'NOW RESONATING' : 'TOUCH AN INSTRUMENT'}</span><strong>{lastVoice}<Waveform size={15}/></strong></div></div>
    <div className="sonic-mix"><label className="sonic-slider" htmlFor={id + '-volume'}><span>Master volume <output htmlFor={id + '-volume'}>{Math.round(viewer.masterVolume * 100)}%</output></span><input id={id + '-volume'} type="range" min="0" max="100" step="1" value={Math.round(viewer.masterVolume * 100)} aria-valuetext={Math.round(viewer.masterVolume * 100) + ' percent'} onChange={event => setMasterVolume(Number(event.target.value) / 100)}/></label><div className="sonic-ambient"><span><strong>Atmosphere</strong><small>An optional, soft background tone.</small></span><button className={'sonic-switch' + (viewer.ambient ? ' is-on' : '')} role="switch" aria-checked={viewer.ambient} aria-label="Ambient atmosphere" disabled={!viewer.sound || unavailable} onClick={() => setAmbientEnabled(!viewer.ambient)}><span/></button></div>{viewer.ambient && <label className="sonic-slider sonic-ambient-mix" htmlFor={id + '-mix'}><span>Atmosphere mix <output htmlFor={id + '-mix'}>{Math.round(viewer.ambientMix * 100)}%</output></span><input id={id + '-mix'} type="range" min="0" max="100" step="1" value={Math.round(viewer.ambientMix * 100)} aria-valuetext={Math.round(viewer.ambientMix * 100) + ' percent'} onChange={event => setAmbientMix(Number(event.target.value) / 100)} disabled={!viewer.sound || unavailable}/></label>}</div>
    <div className="sonic-instruments" aria-label="Audition the interface sounds">{materials.map((material, index) => <button key={material.type} className={active === material.type ? 'is-resonating' : ''} onClick={() => audition(material.type, index)} disabled={!viewer.sound || engine.playback || engine.status === 'unavailable'} aria-label={'Audition ' + material.name.toLowerCase() + ' sound'}><material.icon size={24} weight="thin"/><span><strong>{material.name}</strong><small>{material.note}</small></span><Play size={13} weight="fill"/></button>)}</div>
    <div className="sonic-presets" aria-label="Sound mix presets"><span>SHAPE YOUR MIX</span><button aria-pressed={viewer.masterVolume === .2 && !viewer.ambient} onClick={() => { setMasterVolume(.2); setAmbientEnabled(false); setLastVoice('Quiet mix. Brief actions, softly.'); }}>Quiet</button><button aria-pressed={viewer.masterVolume === .45 && !viewer.ambient} onClick={() => { setMasterVolume(.45); setAmbientEnabled(false); setLastVoice('Balanced mix. Clear, restrained feedback.'); }}>Balanced</button><button disabled={!viewer.sound || unavailable} aria-pressed={viewer.masterVolume === .45 && viewer.ambient && viewer.ambientMix === .15} onClick={() => { setMasterVolume(.45); setAmbientMix(.15); setAmbientEnabled(true); setLastVoice('Atmosphere mix. A subtle field behind deliberate actions.'); }}>Atmosphere</button><button className="sonic-reset" onClick={() => { setMasterVolume(.45); setAmbientMix(.2); setAmbientEnabled(false); setLastVoice('Mix reset. Your sound on/off choice is unchanged.'); }}><ArrowCounterClockwise size={14}/>Reset mix</button></div>
    {!compact && <p className="sonic-keyboard-note">With a control in the studio focused, keys 1–6 play the sounds. Mix settings stay in this browser.</p>}
    <p className="sonic-footnote">{compact ? 'Hovering and scrolling stay silent. Atmosphere is optional. Films take priority.' : 'Brief sounds mark deliberate actions. Hovering and scrolling stay silent. Sound is opt-in, and films always take priority.'}{compact && <a href="#/settings" onClick={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.currentTarget.closest<HTMLElement>('[popover]')?.hidePopover();
    }}>Experience settings <ArrowUpRight size={12}/></a>}</p>
    <span className="sonic-announcement" role="status">{status}</span>
  </section>;
}
export default SoundStudio;
