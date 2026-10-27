import { useEffect, type RefObject } from 'react';

/** A photographic depth layer, independent of the globe camera and native scroll. */
export function useWorldHorizon(root: RefObject<HTMLDivElement | null>, reduced: boolean) {
  useEffect(() => {
    const stage = root.current?.querySelector<HTMLElement>('.world-expedition-stage');
    if (!stage || reduced) return;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    let visible = true;
    let dirty = true;
    let rect = stage.getBoundingClientRect();
    let x = 0, y = 0;
    const render = () => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (dirty) { rect = stage.getBoundingClientRect(); dirty = false; }
      stage.style.setProperty('--world-look-x', `${x.toFixed(2)}px`);
      stage.style.setProperty('--world-look-y', `${y.toFixed(2)}px`);
      stage.style.setProperty('--world-depth', `${Math.min(24, Math.max(0, -rect.top * .035)).toFixed(2)}px`);
    };
    const schedule = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render); };
    const measure = () => { dirty = true; schedule(); };
    const move = (event: PointerEvent) => {
      if (!finePointer.matches || event.pointerType !== 'mouse') return;
      x = Math.max(-8, Math.min(8, ((event.clientX - rect.left) / rect.width - .5) * 16));
      y = Math.max(-5, Math.min(5, ((event.clientY - rect.top) / rect.height - .5) * 10));
      schedule();
    };
    const leave = () => { x = 0; y = 0; schedule(); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) measure(); });
    observer.observe(stage);
    stage.addEventListener('pointermove', move, { passive: true });
    stage.addEventListener('pointerleave', leave);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    document.addEventListener('visibilitychange', measure);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerleave', leave);
      window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', measure);
      ['--world-look-x', '--world-look-y', '--world-depth'].forEach(name => stage.style.removeProperty(name));
    };
  }, [root, reduced]);
}
