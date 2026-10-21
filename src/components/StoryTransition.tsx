import { useEffect } from 'react';
import gsap from 'gsap';

/** Carries the selected cover into its story. It never blocks navigation or owns route state. */
export default function StoryTransition({ reducedMotion }: { reducedMotion: boolean }) {
  useEffect(() => {
    if (reducedMotion) return;
    let cover: HTMLDivElement | null = null;
    let motion: gsap.core.Timeline | null = null;
    let frame = 0;
    const clear = () => { cancelAnimationFrame(frame); motion?.kill(); motion = null; cover?.remove(); cover = null; };
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-transition-film]');
      if (!link) return;
      const id = link.dataset.transitionFilm;
      const image = link.closest('.film-card')?.querySelector<HTMLImageElement>('.film-image img');
      if (!image || !image.complete || !id || location.hash.split('?')[0] === `#/film/${id}`) return;
      const bounds = image.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > innerHeight) return;
      clear();
      cover = document.createElement('div'); cover.className = 'story-transition-cover'; cover.setAttribute('aria-hidden','true');
      const replica = image.cloneNode() as HTMLImageElement;
      replica.style.cssText = 'width:100%;height:100%;object-fit:cover;max-width:none'; replica.removeAttribute('loading');
      cover.append(replica); document.body.append(cover);
      gsap.set(cover,{ left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height });
      const started = performance.now();
      const findDestination = () => {
        const target = document.querySelector<HTMLImageElement>(`[data-film-hero="${id}"]`);
        if (!cover) return;
        if (!target && performance.now() - started < 800) { frame = requestAnimationFrame(findDestination); return; }
        if (!target) { clear(); return; }
        // Let the router's scroll restoration settle before measuring the new frame.
        frame = requestAnimationFrame(() => {
          if (!cover || !target.isConnected || location.hash.split('?')[0] !== `#/film/${id}`) { clear(); return; }
          const destination = target.getBoundingClientRect();
          motion = gsap.timeline({ onComplete: clear });
          // Only this fixed overlay changes bounds; the document layout never moves.
          motion.to(cover, { left:destination.left,top:destination.top,width:destination.width,height:destination.height,duration:.48,ease:'power3.inOut' });
          motion.to(cover,{ opacity:0,duration:.16,ease:'power2.out' },.31);
        });
      };
      frame = requestAnimationFrame(findDestination);
    };
    document.addEventListener('click',click,true);
    const hidden = () => { if (document.hidden) clear(); };
    document.addEventListener('visibilitychange',hidden);
    return () => { clear(); document.removeEventListener('click',click,true); document.removeEventListener('visibilitychange',hidden); };
  },[reducedMotion]);
  return null;
}
