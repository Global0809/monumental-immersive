import { useEffect, useRef } from "react";
export default function Cursor({ disabled }: { disabled: boolean }) {
  const position = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (disabled || !matchMedia("(pointer:fine)").matches) return;
    let frame = 0, x = 0, y = 0, currentX = 0, currentY = 0, first = true;
    const draw = () => {
      frame = 0;
      const dx = x - currentX, dy = y - currentY;
      currentX += dx * .42; currentY += dy * .42;
      if (ring.current) {
        // The press scale belongs to the inner ring, never this viewport translation.
        if (position.current) position.current.style.transform = `translate3d(${currentX}px,${currentY}px,0)`;
        ring.current.style.setProperty('--velocity', String(Math.min(Math.hypot(dx,dy) / 80,.3)));
      }
      if (Math.abs(dx) + Math.abs(dy) > .15 && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !e.isPrimary) return;
      x = e.clientX;
      y = e.clientY;
      if (first) { currentX = x; currentY = y; first = false; }
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const interactive = target.closest("a,button,[data-cursor]");
      const native = target.closest(
        "input,select,textarea,video,dialog,[popover]:popover-open",
      );
      if (ring.current) {
        ring.current.dataset.active = interactive ? "true" : "false";
        ring.current.dataset.hidden = native ? "true" : "false";
        const label = interactive?.getAttribute('data-cursor') || (target.closest('canvas,.culture-sculpture-stage,.cultural-atlas__viewport') ? 'TURN' : '');
        ring.current.dataset.label = label ? 'true' : 'false';
        // An unchanged text write still emits childList mutations. Shared text
        // effects observe this root, so repeated writes would rescan every move.
        if (ring.current.textContent !== label) ring.current.textContent = label;
      }
      if (!frame)
        frame = requestAnimationFrame(draw);
    };
    const leave = () => {
      if (ring.current) {
        ring.current.dataset.hidden = "true";
        ring.current.dataset.pressed = 'false';
      }
      first = true;
      cancelAnimationFrame(frame); frame = 0;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !e.isPrimary || e.button !== 0) return;
      move(e);
      if (ring.current) ring.current.dataset.pressed = 'true';
    };
    const up = () => { if (ring.current) ring.current.dataset.pressed = 'false'; };
    const visibility = () => { if (document.hidden) leave(); };
    // Capture also observes scene drags that capture the pointer or stop bubbling.
    window.addEventListener("pointermove", move, { passive: true, capture: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener('pointerdown',down,true);
    window.addEventListener('pointerup',up,true);
    window.addEventListener('pointercancel',leave,true);
    window.addEventListener('lostpointercapture',up,true);
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('blur',leave);
    return () => {
      window.removeEventListener("pointermove", move,true);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener('pointerdown',down,true);
      window.removeEventListener('pointerup',up,true);
      window.removeEventListener('pointercancel',leave,true);
      window.removeEventListener('lostpointercapture',up,true);
      document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('blur',leave);
      cancelAnimationFrame(frame);
    };
  }, [disabled]);
  return disabled ? null : (
    <div ref={position} className="cursor-position" aria-hidden="true">
      <div ref={ring} className="cursor-ring" data-hidden="true" />
    </div>
  );
}
