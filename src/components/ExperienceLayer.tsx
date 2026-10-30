import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { playSound, setAmbientScene, type SoundType } from '../services/audio';
import { passageRoom, routeSoundRoom } from '../services/passageSonic';
import { getTunnelFrame, subscribeTunnelFrame } from '../services/tunnelJourney';
import type { Notice } from '../services/feedback';
import './experience.css';
import { usePersistentStorage } from '../services/viewer';

export default function ExperienceLayer({ path, reducedMotion }: { path: string; reducedMotion: boolean }) {
  const progress = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState<(Notice & { id: number }) | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [noticePaused, setNoticePaused] = useState(false);
  const persistentStorage = usePersistentStorage();
  const [storageNoticeDismissed, setStorageNoticeDismissed] = useState(false);

  useEffect(() => { if (persistentStorage) setStorageNoticeDismissed(false); }, [persistentStorage]);

  useEffect(() => {
    setAmbientScene(routeSoundRoom(path));
    if (path !== '/') return;
    let room = passageRoom(getTunnelFrame().active);
    setAmbientScene(room);
    const update = () => {
      const next = passageRoom(getTunnelFrame().active);
      if (next !== room) { room = next; setAmbientScene(room); }
    };
    // Chapter metadata supports the optional atmosphere. Native scrolling,
    // mechanical assembly and idle movement do not trigger interface sounds.
    return subscribeTunnelFrame(update);
  }, [path]);

  useEffect(() => {
    const receive = (e: Event) => { setNoticePaused(false); setNotice({ ...(e as CustomEvent<Notice>).detail, id: Date.now() }); };
    window.addEventListener('monumental:notice', receive);
    return () => window.removeEventListener('monumental:notice', receive);
  }, []);
  useEffect(() => {
    if (!notice || noticePaused) return;
    const timeout = window.setTimeout(() => setNotice(null), notice.undo ? 8000 : 4500);
    return () => clearTimeout(timeout);
  }, [notice,noticePaused]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const total = document.documentElement.scrollHeight - innerHeight;
      progress.current?.style.setProperty('--progress', String(total > 0 ? scrollY / total : 0));
      setScrolled(scrollY > innerHeight * .7);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = new ResizeObserver(schedule);
    resize.observe(document.body);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    update();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, []);

  useEffect(() => {
    const excluded = (el: Element) => el.closest('.ms-player-dialog,.sound-studio,.rhythm-grid');
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !(e.target instanceof Element)) return;
      const control = e.target.closest<HTMLElement>('button,a,summary');
      if (!control || excluded(control) || control.closest('[data-sound-owned]') || control.matches(':disabled,[aria-disabled="true"]')) return;
      const label = (control.getAttribute('aria-label') || control.textContent || '').toLowerCase();
      const explicit = control.dataset.sound as SoundType | undefined;
      const disclosure = control.tagName === 'SUMMARY' ? control.closest('details') : null;
      const type: SoundType = explicit || (disclosure ? disclosure.open ? 'close' : 'open' : control.tagName === 'A' && control.getAttribute('href')?.startsWith('#/') ? 'navigate' : /close|cancel|dismiss/.test(label) ? 'close' : /inspect|reveal|framework/.test(label) ? 'focus' : /open|index|search/.test(label) ? 'open' : 'select');
      const pan = e.detail > 0 ? Math.max(-.55, Math.min(.55, e.clientX / innerWidth * 1.1 - .55)) : 0;
      // Router and scene listeners may claim this same click later in the
      // bubble. Let their semantic sound win regardless of effect mount order.
      queueMicrotask(() => { if (!e.defaultPrevented) playSound(type, { pan }); });
    };
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, []);

  useEffect(() => {
    if (reducedMotion || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    let frame = 0;
    let target: HTMLElement | null = null;
    let x = 0, y = 0;
    const reset = () => { target?.style.removeProperty('--surface-x'); target?.style.removeProperty('--surface-y'); target?.style.removeProperty('--tilt-x'); target?.style.removeProperty('--tilt-y'); target = null; };
    const draw = () => {
      frame = 0;
      if (!target) return;
      const bounds = target.getBoundingClientRect();
      const px = (x - bounds.left) / bounds.width, py = (y - bounds.top) / bounds.height;
      target.style.setProperty('--surface-x', `${px * 100}%`);
      target.style.setProperty('--surface-y', `${py * 100}%`);
      target.style.setProperty('--tilt-x', `${(py - .5) * -3}deg`);
      target.style.setProperty('--tilt-y', `${(px - .5) * 3}deg`);
    };
    const move = (e: PointerEvent) => {
      const next = (e.target as Element).closest<HTMLElement>('.film-image,.portal,.hero-feature,.category-index a,.journey-stop');
      if (next !== target) { reset(); target = next; }
      x = e.clientX; y = e.clientY;
      if (!frame && target) frame = requestAnimationFrame(draw);
    };
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', reset);
    return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', reset); cancelAnimationFrame(frame); reset(); };
  }, [reducedMotion, path]);

  return <>
    <div ref={progress} className="reading-progress" aria-hidden="true"><span/></div>
    {!persistentStorage && !storageNoticeDismissed && <div className="storage-status" role="status"><strong>Saved for this visit.</strong><span>Browser storage is unavailable. Your collection and notes will reset when you reload.</span><button aria-label="Dismiss storage message" onClick={()=>setStorageNoticeDismissed(true)}><X size={17}/></button></div>}
    <button className={`back-to-top ${scrolled ? 'is-visible' : ''}`} tabIndex={scrolled ? 0 : -1} aria-label="Back to top" onClick={() => scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' })}><ArrowUp size={18}/></button>
    <div className="notice-region" aria-live="polite" aria-atomic="true">
      {notice && <div className="experience-notice" key={notice.id} onPointerEnter={()=>setNoticePaused(true)} onPointerLeave={event=>{if(!event.currentTarget.contains(document.activeElement))setNoticePaused(false);}} onFocusCapture={()=>setNoticePaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setNoticePaused(false);}}><Check size={18}/><span>{notice.message}</span>{notice.undo && <button data-sound-owned onClick={() => { notice.undo?.(); setNotice(null); }}>{notice.action || 'Undo'}</button>}<button className="notice-close" aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={16}/></button></div>}
    </div>
  </>;
}
