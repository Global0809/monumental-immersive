import { useEffect, useRef } from 'react';
import './scroll-rail.css';

/** A document scrollbar, not a second scroll controller. Wheel/touch remain native. */
export default function ScrollRail({ path, disabled }: { path: string; disabled: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = rail.current, handle = thumb.current, value = label.current;
    if (!node || !handle || !value || disabled) return;
    const capable = matchMedia('(min-width: 1024px) and (min-height: 660px) and (hover: hover) and (pointer: fine)');
    const forced = matchMedia('(forced-colors: active)');
    let frame = 0, measure = true, available = false, travel = 0, thumbHeight = 48;
    let top = 0, maxScroll = 0, progress = 0, lastPercent = -1, dragId: number | null = null, grip = 0;
    const root = document.documentElement;
    const stopDrag = () => {
      const captured = dragId;
      dragId = null; delete node.dataset.dragging;
      if (captured !== null && node.hasPointerCapture(captured)) node.releasePointerCapture(captured);
    };
    const draw = () => {
      frame = 0;
      if (document.hidden) return;
      // Read first; writes never feed another layout measurement in this frame.
      if (measure) {
        const rect = node.getBoundingClientRect();
        top = rect.top;
        const height = rect.height;
        const pageHeight = document.scrollingElement?.scrollHeight || root.scrollHeight;
        maxScroll = Math.max(0, pageHeight - innerHeight);
        thumbHeight = Math.max(48, Math.min(height, height * innerHeight / pageHeight));
        travel = Math.max(0, height - thumbHeight);
        measure = false;
      }
      const blocked = !!document.querySelector('dialog[open], [aria-modal="true"]') ||
        document.body.style.overflow === 'hidden' || root.style.overflow === 'hidden';
      available = capable.matches && !forced.matches && maxScroll > 8 && travel > 0 && !blocked;
      progress = maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0;
      node.dataset.visible = String(available);
      node.tabIndex = available ? 0 : -1;
      node.setAttribute('aria-hidden', String(!available));
      if (available) root.dataset.scrollRail = 'true';
      else { delete root.dataset.scrollRail; stopDrag(); }
      handle.style.height = `${thumbHeight}px`;
      handle.style.transform = `translate3d(0,${progress * travel}px,0)`;
      node.style.setProperty('--scroll-progress', String(progress));
      const percent = Math.round(progress * 100);
      if (percent !== lastPercent) {
        lastPercent = percent;
        node.setAttribute('aria-valuenow', String(percent));
        value.textContent = `${String(percent).padStart(2, '0')}%`;
      }
    };
    const wake = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(draw); };
    const resize = () => { measure = true; wake(); };
    const seek = (clientY: number) => {
      if (!available || travel <= 0) return;
      const target = Math.max(0, Math.min(1, (clientY - top - grip) / travel));
      window.scrollTo({ top: target * maxScroll, behavior: 'instant' });
      wake();
    };
    const down = (event: PointerEvent) => {
      if (!available || event.button !== 0 || event.pointerType === 'touch') return;
      event.preventDefault();
      node.focus({ preventScroll: true });
      grip = handle.contains(event.target as Node) ? event.clientY - top - progress * travel : thumbHeight / 2;
      dragId = event.pointerId;
      node.setPointerCapture(dragId);
      node.dataset.dragging = 'true';
      seek(event.clientY);
    };
    const move = (event: PointerEvent) => { if (event.pointerId === dragId) seek(event.clientY); };
    const key = (event: KeyboardEvent) => {
      if (!available) return;
      const page = innerHeight * .85;
      const targets: Record<string, number> = {
        ArrowDown: scrollY + 70, ArrowUp: scrollY - 70, PageDown: scrollY + page,
        PageUp: scrollY - page, Home: 0, End: maxScroll, ' ': scrollY + page * (event.shiftKey ? -1 : 1),
      };
      if (!(event.key in targets)) return;
      event.preventDefault();
      window.scrollTo({ top: Math.max(0, Math.min(maxScroll, targets[event.key])), behavior: 'instant' });
      wake();
    };
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; stopDrag(); }
      else resize();
    };
    // Document dimensions change after filtered results, media and font loading.
    const observer = new ResizeObserver(resize);
    observer.observe(document.body);
    const main = document.getElementById('main'); if (main) observer.observe(main);
    const locks = new MutationObserver(wake);
    locks.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    locks.observe(root, { attributes: true, attributeFilter: ['style'] });
    document.addEventListener('toggle', wake, true);
    document.addEventListener('close', wake, true);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('blur', stopDrag);
    capable.addEventListener('change', resize); forced.addEventListener('change', resize);
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', stopDrag);
    node.addEventListener('pointercancel', stopDrag);
    node.addEventListener('lostpointercapture', stopDrag);
    node.addEventListener('keydown', key);
    resize();
    return () => {
      stopDrag(); cancelAnimationFrame(frame); observer.disconnect(); locks.disconnect();
      delete root.dataset.scrollRail;
      node.dataset.visible = 'false'; node.tabIndex = -1; node.setAttribute('aria-hidden', 'true');
      document.removeEventListener('toggle', wake, true);
      document.removeEventListener('close', wake, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', stopDrag);
      capable.removeEventListener('change', resize); forced.removeEventListener('change', resize);
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', stopDrag);
      node.removeEventListener('pointercancel', stopDrag);
      node.removeEventListener('lostpointercapture', stopDrag);
      node.removeEventListener('keydown', key);
    };
  }, [path, disabled]);
  return <div ref={rail} className="scroll-rail" role="scrollbar" aria-label="Page position"
    aria-controls="main" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={0} aria-hidden="true" tabIndex={-1} data-visible="false" data-native-cursor>
    <span className="scroll-rail__track" aria-hidden="true"/>
    <span className="scroll-rail__marks" aria-hidden="true">{Array.from({ length: 21 }, (_, index) => <i key={index}/>)}</span>
    <span ref={thumb} className="scroll-rail__thumb" aria-hidden="true"><i/><span ref={label}>00%</span></span>
  </div>;
}
