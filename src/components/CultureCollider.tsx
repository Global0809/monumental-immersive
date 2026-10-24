import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { cultureTokens, collideCultures, nearbyCollisions } from '../services/collider';
import { enterWorld } from '../services/exploration';
import { playSound } from '../services/audio';
import type { Video } from '../data/catalogue';
import FilmCard from './FilmCard';
import './culture-collider.css';

export default function CultureCollider({ placeId, onWatch, reducedMotion }: { placeId: string; onWatch: (v: Video) => void; reducedMotion: boolean }) {
  const [slots, setSlots] = useState<[string, string]>([placeId, 'music']);
  const [result, setResult] = useState<[string, string] | null>(null);
  const [slot, setSlot] = useState<0 | 1>(1);
  const [dragging, setDragging] = useState(false);
  const [revision, setRevision] = useState(0);
  const root = useRef<HTMLElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const submit = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => {
      const heading = resultHeading.current;
      if (!heading) return;
      heading.focus({ preventScroll: true });
      window.scrollTo({ top: window.scrollY + heading.getBoundingClientRect().top - 110, behavior: reducedMotion ? 'instant' : 'smooth' });
    }, reducedMotion ? 0 : 480);
    return () => window.clearTimeout(timer);
  }, [result, revision, reducedMotion]);
  useEffect(() => { setSlots([placeId, 'music']); setResult(null); }, [placeId]);
  useEffect(() => {
    if (!result || reducedMotion) return;
    const context = gsap.context(() => {
      const tl = gsap.timeline();
      tl.fromTo('.collider-orbit--a', { x: -34, rotation: -12 }, { x: 0, rotation: 0, duration: .58, ease: 'power3.out' }, 0);
      tl.fromTo('.collider-orbit--b', { x: 34, rotation: 12 }, { x: 0, rotation: 0, duration: .58, ease: 'power3.out' }, 0);
      tl.fromTo('.collider-wave', { scale: .3, opacity: .8 }, { scale: 2.4, opacity: 0, duration: .72, ease: 'power3.out' }, .06);
      tl.fromTo('.collider-results', { y: 20, opacity: .35 }, { y: 0, opacity: 1, duration: .65, ease: 'power3.out' }, .08);
    }, root);
    return () => context.revert();
  }, [result, revision, reducedMotion]);
  function put(id: string, target = slot) {
    if (!cultureTokens.some(t => t.id === id)) return;
    setSlots(current => { const next: [string, string] = [...current]; if (next[1 - target] === id) next[1 - target] = next[target]; next[target] = id; return next; });
    setResult(null); setSlot(target === 0 ? 1 : 0); playSound('select', { pan: target === 0 ? -.38 : .38, intensity: .6 });
  }
  function collide() { if (!slots[0] || !slots[1] || slots[0] === slots[1]) return; setResult([...slots]); setRevision(x => x + 1); playSound('collider'); }
  const collision = result ? collideCultures(...result) : null;
  const label = (id: string) => cultureTokens.find(t => t.id === id)?.label || 'Choose an interest';
  return <section ref={root} className={`culture-collider${dragging ? ' is-dragging' : ''}`} aria-labelledby="collider-title">
    <div className="collider-intro"><h3 id="collider-title">CULTURE<br/><span>COLLIDER.</span></h3><p>Put two worlds together.<br/>Find the story between them.</p></div>
    <div className="collider-workbench">
      <div className="collider-instrument" aria-label="Combine two cultural interests">
        <div className="collider-wave" aria-hidden="true"/>
        {[0, 1].map(i => <div className={`collider-orbit collider-orbit--${i ? 'b' : 'a'}`} key={i} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }} onDrop={e => { e.preventDefault(); put(e.dataTransfer.getData('text/plain'), i as 0 | 1); setDragging(false); }}>
          <button className="collider-slot" data-sound="focus" aria-label={`Choose ${i ? 'second' : 'first'} interest: ${label(slots[i])}`} aria-pressed={slot === i} onClick={() => setSlot(i as 0 | 1)}><small>{i ? 'SECOND WORLD' : 'FIRST WORLD'}</small><strong>{label(slots[i])}</strong><span>{slot === i ? 'Select a token below' : 'Change this world'}</span></button>
        </div>)}
        <span className="collider-cross" aria-hidden="true"><Plus size={25}/></span>
      </div>
      <div className="collider-actions"><button ref={submit} className="button button-primary" onClick={collide} data-sound-owned>Find the connection <ArrowRight size={19}/></button><button className="collider-reset" data-sound="focus" aria-label="Reset Culture Collider" onClick={() => { setSlots([placeId, 'music']); setSlot(1); setResult(null); }}><ArrowsClockwise size={19}/></button><span>Drag a token into either world, or select a world and tap a token.</span></div>
      <div className="collider-tokens" role="group" aria-label={`Choose the ${slot ? 'second' : 'first'} interest`}>
        {cultureTokens.map(t => <button key={t.id} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'copy'; setDragging(true); }} onDragEnd={() => setDragging(false)} aria-pressed={slots.includes(t.id)} onClick={() => put(t.id)} data-sound-owned><span className={`collider-token-mark ${t.kind}`} aria-hidden="true"/>{t.label}</button>)}
      </div>
    </div>
    {collision && <div className="collider-results" key={revision}>
      <div className="collider-result-heading"><div><h4 ref={resultHeading} tabIndex={-1}>{label(result![0])} <span>×</span> {label(result![1])}</h4><p role="status">{collision.explanation}</p></div><button className="icon-button" aria-label="Close connection results" onClick={() => { setResult(null); submit.current?.focus(); }}><X size={20}/></button></div>
      {collision.films.length ? <><div className="collider-films">{collision.films.slice(0, 3).map(v => <FilmCard key={v.id} video={v} onWatch={onWatch}/>)}</div><p className="collider-provenance">Connections are based on the catalogue’s places, themes and collection credits. Film details explain the source material.</p>{result!.some(id => cultureTokens.find(t => t.id === id)?.kind === 'place') && <button data-sound-owned className="text-link" onClick={() => { const id = result!.find(id => cultureTokens.find(t => t.id === id)?.kind === 'place'); if (id) enterWorld(id, reducedMotion); }}>Follow this destination through Monumental <ArrowRight/></button>}</> : <div className="collider-alternatives"><p>{nearbyCollisions(...result!).length ? `Keep ${label(result![0])}. Try a supported connection:` : `No supported pairings for ${label(result![0])} yet. Choose another first world, or browse its films directly.`}</p>{!nearbyCollisions(...result!).length && <a className="button button-outline" href="#/search">Browse the collection <ArrowRight size={16}/></a>}{nearbyCollisions(...result!).map(t => <button data-sound-owned className="button button-outline" key={t.id} onClick={() => { setSlots([result![0], t.id]); setResult([result![0], t.id]); setRevision(x => x + 1); playSound('collider'); }}>{label(result![0])} + {t.label}<ArrowRight size={16}/></button>)}</div>}
    </div>}
  </section>;
}
