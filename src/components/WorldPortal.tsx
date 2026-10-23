import { useEffect } from 'react';
import gsap from 'gsap';
import { places } from '../data/catalogue';
import { go, readRoute } from '../services/router';
import { playSound } from '../services/audio';
import './world-portal.css';

/** A single travelling signal survives the route swap and lands on the selected globe pin. */
export default function WorldPortal({ reducedMotion }: { reducedMotion: boolean }) {
  useEffect(() => {
    let overlay: HTMLDivElement | null = null;
    let timeline: gsap.core.Timeline | null = null;
    let frame = 0;
    let targetId = '';
    let routed = false;
    let generation = 0;
    const clear = () => {
      ++generation; cancelAnimationFrame(frame); timeline?.kill(); timeline = null;
      overlay?.remove(); overlay = null; delete document.documentElement.dataset.worldPortal;
      window.dispatchEvent(new CustomEvent('monumental:portal-end'));
    };
    const navigate = () => {
      routed = true; go('/world', { place: targetId });
      frame = requestAnimationFrame(() => { if (readRoute().path === '/world') window.scrollTo({ top: 0, behavior: 'instant' }); });
      window.dispatchEvent(new CustomEvent('monumental:portal-arrive', { detail: { place: targetId } }));
    };
    const skip = () => { if (!routed && targetId) navigate(); clear(); };
    const start = (event: Event) => {
      const place = places.find(p => p.id === (event as CustomEvent).detail?.place);
      if (!place) return;
      clear(); targetId = place.id; routed = false;
      if (reducedMotion) { navigate(); return; }
      void import('./ExplorePages');
      const currentGeneration = generation;
      document.documentElement.dataset.worldPortal = place.id;
      window.dispatchEvent(new CustomEvent('monumental:portal-depart', { detail: { place: place.id } }));
      playSound('destination');
      overlay = document.createElement('div'); overlay.className = 'world-portal-handoff';
      overlay.innerHTML = '<div class="world-portal-dim"></div><div class="world-portal-aperture" aria-hidden="true"><i></i><i></i><i></i></div><div class="world-portal-signal" aria-hidden="true"></div><div class="world-portal-caption" role="status"><span>FOLLOWING YOUR SIGNAL</span><strong></strong><small></small></div><button class="world-portal-skip">Skip passage</button>';
      overlay.querySelector('strong')!.textContent = place.name;
      overlay.querySelector('small')!.textContent = `${Math.abs(place.lat).toFixed(4)}° ${place.lat >= 0 ? 'N' : 'S'} / ${Math.abs(place.lon).toFixed(4)}° ${place.lon >= 0 ? 'E' : 'W'}`;
      overlay.querySelector('button')!.addEventListener('click', skip);
      document.body.append(overlay);
      const aperture = overlay.querySelector('.world-portal-aperture');
      const signal = overlay.querySelector('.world-portal-signal');
      const source = document.querySelector('.hero-sculpture')?.getBoundingClientRect();
      const origin = source && source.bottom > 0 && source.top < innerHeight ? { x: source.left + source.width * .5, y: source.top + source.height * .5 } : { x: innerWidth * .5, y: innerHeight * .45 };
      gsap.set(aperture, { x: origin.x, y: origin.y, xPercent: -50, yPercent: -50, scale: .55, rotationX: 42, rotationY: -24, opacity: 0 });
      gsap.set(signal, { x: origin.x, y: origin.y, xPercent: -50, yPercent: -50, scale: .6 });
      timeline = gsap.timeline();
      timeline.to(aperture, { x: innerWidth * .5, y: innerHeight * .43, scale: 1, rotationX: 0, rotationY: 0, opacity: 1, duration: .44, ease: 'power3.inOut' }, 0);
      timeline.to(signal, { x: innerWidth * .5, y: innerHeight * .43, scale: 1.5, duration: .44, ease: 'power3.inOut' }, 0);
      timeline.fromTo('.world-portal-caption', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: .24 }, .05);
      timeline.to('.world-portal-dim', { opacity: .95, duration: .25 }, .1);
      timeline.call(navigate, [], .43);
      timeline.to(aperture, { scale: 7, opacity: 0, duration: .62, ease: 'power3.in' }, .43);
      timeline.to('.world-portal-dim', { opacity: 0, duration: .45 }, .66);
      timeline.call(() => {
        const started = performance.now();
        const land = () => {
          if (currentGeneration !== generation || !overlay) return;
          const pin = document.querySelector<HTMLElement>(`.cultural-atlas__marker[data-place="${place.id}"] .cultural-atlas__pin`);
          const panel = document.querySelector('.ex-location-name');
          const visibleBounds = (element: Element | null) => {
            if (!element || getComputedStyle(element).visibility === 'hidden') return null;
            const bounds = element.getBoundingClientRect();
            return bounds.width > 0 && bounds.top >= 0 && bounds.left >= 0 && bounds.bottom <= innerHeight && bounds.right <= innerWidth ? bounds : null;
          };
          const pinBounds = visibleBounds(pin);
          if (!pinBounds && performance.now() - started < 900) { frame = requestAnimationFrame(land); return; }
          const rect = pinBounds || visibleBounds(panel);
          const destination = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: innerWidth * .55, y: innerHeight * .4 };
          timeline?.kill();
          timeline = gsap.timeline({ onComplete: clear });
          timeline.to(signal, { ...destination, scale: .5, duration: .4, ease: 'power3.inOut' });
          timeline.to(signal, { scale: 2.4, opacity: 0, duration: .3 }, .32);
          timeline.to('.world-portal-caption', { opacity: 0, y: -8, duration: .25 }, .35);
        };
        frame = requestAnimationFrame(land);
      }, [], .8);
    };
    const hash = () => { if (overlay) { const route = readRoute(); if (route.path !== '/world' || route.params.get('place') !== targetId) clear(); } };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && overlay) skip(); };
    const visibility = () => { if (document.hidden && overlay) skip(); };
    window.addEventListener('monumental:portal-open', start); window.addEventListener('hashchange', hash); window.addEventListener('keydown', key); document.addEventListener('visibilitychange', visibility);
    return () => { clear(); window.removeEventListener('monumental:portal-open', start); window.removeEventListener('hashchange', hash); window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', visibility); };
  }, [reducedMotion]);
  return null;
}
