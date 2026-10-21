import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { places } from '../data/catalogue';
import { href } from '../services/router';
import { playSound } from '../services/audio';
gsap.registerPlugin(ScrollTrigger);

const stops = [
  { id: 'puerto-rico', text: 'The opening point of the planned journey. An island whose culture reaches far beyond its shores.', title: 'WHERE THE STORY BEGINS.' },
  { id: 'new-york', text: 'A city shaped by people arriving, creating and carrying their cultures forward. The second stop in the planned journey.', title: 'WHERE WORLDS CROSS.' },
  { id: 'london', text: 'Different roots, shared frequencies. London is the final destination in the planned opening WAVEMAKERS journey.', title: 'WHERE THE SOUND TRAVELS.' },
];
export default function OriginalJourney({ reducedMotion }: { reducedMotion: boolean }) {
  const [active,setActive] = useState(0);
  const root = useRef<HTMLElement>(null);
  const backdrop = useRef<HTMLImageElement>(null);
  const stop = stops[active];
  const place = places.find(p => p.id === stop.id)!;
  useEffect(() => {
    if (reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.original-backdrop', { yPercent: -3 }, { yPercent: 3, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: .8 } });
      gsap.to('.original-side', { y: -50, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: 1 } });
    },root);
    return () => ctx.revert();
  },[reducedMotion]);
  useEffect(() => {
    if (reducedMotion) return;
    const ctx = gsap.context(() => { gsap.fromTo('.original-stop-context', { opacity:.3, y:12 }, { opacity:1,y:0,duration:.45,ease:'power3.out',overwrite:'auto' }); },root);
    return () => ctx.revert();
  },[active,reducedMotion]);
  return <section ref={root} className="original-feature">
    <img ref={backdrop} className="original-backdrop" src={place.image} alt={`${place.name}, contemporary destination photograph`} loading="lazy"/>
    <div className="original-info"><span className="status-label">Monumental Originals · In development</span><h2>WAVE<br/>MAKERS<ArrowUpRight/></h2><p>Some stories don’t stay in one place.</p>
      <div className="original-route" role="group" aria-label="Explore the planned WAVEMAKERS route">{stops.map((s,i) => <span className="original-route-stop" key={s.id}><button data-sound-owned aria-pressed={active === i} onClick={() => { setActive(i); playSound('destination',{pan:(i-1)*.5,intensity:.65}); }}><small>{String(i+1).padStart(2,'0')}</small>{places.find(p=>p.id===s.id)?.name}</button>{i<stops.length-1 && <ArrowRight/>}</span>)}</div>
      <p className="original-description">Valid ID opens a journey through the people and places shaping culture. The first chapter connects to <em>Better Late Than Never.</em></p><a className="button button-light" href={href('/film/wavemakers-valid-id')}>Discover the series <ArrowUpRight/></a>
    </div>
    <div className="original-stop-context"><span>SELECTED STOP / {String(active+1).padStart(2,'0')}</span><h3>{stop.title}</h3><p>{stop.text}</p><a className="text-link" href={href('/world',{place:stop.id})}>Explore {place.name}<ArrowUpRight size={17}/></a><small>Destination imagery. Series in development.</small></div>
    <span className="original-side">Sound travels. Culture follows.</span>
  </section>;
}
