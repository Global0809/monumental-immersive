import { useEffect, useRef } from 'react';
import './cursor.css';

const NATIVE_SURFACES = 'input,select,textarea,video,dialog,[popover]:popover-open,[contenteditable="true"],.player-controls,[data-native-cursor]';

/** Pointer instrumentation; native cursors and hit targets remain intact. */
export default function Cursor({ disabled }: { disabled: boolean }) {
  const position = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const trails = useRef<Array<HTMLSpanElement | null>>([]);
  useEffect(() => {
    if (disabled) return;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0, x = 0, y = 0, first = true, hidden = true;
    let lastMove = 0, lastFrame = 0, angle = 0, contextDirty = false;
    const trace = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    const eligible = () => finePointer.matches && !document.hidden && !document.pointerLockElement;
    const hideTrails = () => { for (const trail of trails.current) if (trail) trail.style.opacity = '0'; };
    const setContext = (target: Element | null) => {
      const native = target?.closest(NATIVE_SURFACES);
      const action = target?.closest('a,button,[data-cursor]');
      hidden = !target || !!native || !eligible();
      if (position.current) position.current.dataset.hidden = String(hidden);
      if (ring.current) {
        ring.current.dataset.hidden = String(hidden);
        ring.current.dataset.active = String(!!action && !action.matches(':disabled,[aria-disabled="true"]'));
      }
      // Explicit authored labels only: a decorative canvas is not a TURN control.
      const text = !hidden ? (action?.getAttribute('data-cursor') || '').slice(0, 12) : '';
      if (label.current && label.current.textContent !== text) label.current.textContent = text;
      if (hidden) hideTrails();
    };
    const draw = (now: number) => {
      frame = 0;
      if (!eligible() || first) return;
      if (contextDirty) { contextDirty = false; setContext(document.elementFromPoint(x, y)); }
      if (hidden) { hideTrails(); lastFrame = 0; return; }
      const dt = Math.min(48, Math.max(1, lastFrame ? now - lastFrame : 16.67));
      lastFrame = now;
      // Exact viewport translation. Pressure never owns this transform.
      if (position.current) position.current.style.transform = `translate3d(${x}px,${y}px,0)`;
      const age = now - lastMove;
      const fade = Math.max(0, 1 - Math.max(0, age - 35) / 205);
      for (let i = 0; i < trace.length; i++) {
        const point = trace[i], follow = 1 - Math.exp(-dt / (35 + i * 26));
        point.x += (x - point.x) * follow; point.y += (y - point.y) * follow;
        let dx = point.x - x, dy = point.y - y;
        const distance = Math.hypot(dx, dy), limit = 12 + i * 12;
        if (distance > limit) { dx *= limit / distance; dy *= limit / distance; point.x = x + dx; point.y = y + dy; }
        const trail = trails.current[i];
        if (trail) {
          trail.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${angle}rad)`;
          trail.style.opacity = String(fade * Math.min(distance / 7, 1) * (.48 - i * .13));
        }
      }
      // Finite wake: once it disappears this loop sleeps.
      if (age < 245) frame = requestAnimationFrame(draw);
      else { hideTrails(); lastFrame = 0; }
    };
    const wake = () => { if (!frame && eligible() && !first) frame = requestAnimationFrame(draw); };
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !event.isPrimary || !eligible()) return;
      const dx = event.clientX - x, dy = event.clientY - y;
      x = event.clientX; y = event.clientY;
      if (first) { for (const point of trace) { point.x = x; point.y = y; } first = false; }
      else if (Math.hypot(dx, dy) > .5) angle = Math.atan2(dy, dx);
      lastMove = performance.now();
      if (position.current) position.current.dataset.edge = x > innerWidth - 110 ? 'left' : 'right';
      setContext(event.target instanceof Element ? event.target : null);
      wake();
    };
    const leave = () => {
      hidden = true; first = true; lastFrame = 0;
      if (position.current) position.current.dataset.hidden = 'true';
      if (ring.current) { ring.current.dataset.hidden = 'true'; ring.current.dataset.pressed = 'false'; }
      hideTrails(); cancelAnimationFrame(frame); frame = 0;
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'touch') { leave(); return; }
      if (!event.isPrimary || event.button !== 0 || !eligible()) return;
      move(event); if (ring.current) ring.current.dataset.pressed = 'true';
    };
    const up = () => { if (ring.current) ring.current.dataset.pressed = 'false'; };
    const refreshContext = () => { contextDirty = true; wake(); };
    const lostCapture = () => { up(); refreshContext(); };
    const visibility = () => { if (document.hidden) leave(); };
    const pointerLock = () => { if (document.pointerLockElement) leave(); };
    // Capture sees scene drags without changing their pointer ownership.
    window.addEventListener('pointermove', move, { passive: true, capture: true });
    window.addEventListener('pointerover', move, { passive: true, capture: true });
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', leave, true);
    window.addEventListener('lostpointercapture', lostCapture, true);
    window.addEventListener('scroll', refreshContext, { passive: true, capture: true });
    window.addEventListener('hashchange', refreshContext);
    window.addEventListener('resize', refreshContext);
    window.addEventListener('blur', leave);
    document.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('pointerlockchange', pointerLock);
    finePointer.addEventListener('change', leave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerover', move, true);
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', leave, true);
      window.removeEventListener('lostpointercapture', lostCapture, true);
      window.removeEventListener('scroll', refreshContext, true);
      window.removeEventListener('hashchange', refreshContext);
      window.removeEventListener('resize', refreshContext);
      window.removeEventListener('blur', leave);
      document.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerlockchange', pointerLock);
      finePointer.removeEventListener('change', leave);
    };
  }, [disabled]);
  return disabled ? null : <div ref={position} className="cursor-position signal-cursor" data-hidden="true" aria-hidden="true">
    {[0, 1, 2].map(index => <span key={index} ref={element => { trails.current[index] = element; }} className="signal-cursor__trail" />)}
    <div ref={ring} className="cursor-ring signal-cursor__reticle" data-hidden="true">
      <i className="signal-cursor__core" />
      <svg className="signal-cursor__orbit" viewBox="0 0 24 24" focusable="false"><path d="M4.2 7.5A9 9 0 0 1 17 4.5M19.8 16.5A9 9 0 0 1 7 19.5" /></svg>
    </div>
    <span ref={label} className="signal-cursor__label" />
  </div>;
}
