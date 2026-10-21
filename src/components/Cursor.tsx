import { useEffect, useRef } from "react";
export default function Cursor({ disabled }: { disabled: boolean }) {
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (disabled || !matchMedia("(pointer:fine)").matches) return;
    let frame = 0, x = 0, y = 0, currentX = 0, currentY = 0, first = true;
    const draw = () => {
      frame = 0;
      const dx = x - currentX, dy = y - currentY;
      currentX += dx * .42; currentY += dy * .42;
      if (ring.current) {
        ring.current.style.transform = `translate3d(${currentX}px,${currentY}px,0)`;
        ring.current.style.setProperty('--velocity', String(Math.min(Math.hypot(dx,dy) / 80,.3)));
      }
      if (Math.abs(dx) + Math.abs(dy) > .15 && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (first) { currentX = x; currentY = y; first = false; }
      const target = e.target as HTMLElement;
      const interactive = target.closest("a,button,[data-cursor]");
      const native = target.closest(
        "input,select,textarea,video,dialog,[popover]:popover-open",
      );
      if (ring.current) {
        ring.current.dataset.active = interactive ? "true" : "false";
        ring.current.dataset.hidden = native ? "true" : "false";
        const label = interactive?.getAttribute('data-cursor') || (target.closest('canvas,.culture-sculpture-stage,.cultural-atlas__viewport') ? 'TURN' : '');
        ring.current.dataset.label = label ? 'true' : 'false';
        ring.current.textContent = label;
      }
      if (!frame)
        frame = requestAnimationFrame(draw);
    };
    const leave = () => {
      if (ring.current) ring.current.dataset.hidden = "true";
      cancelAnimationFrame(frame); frame = 0;
    };
    const down = () => { if (ring.current) ring.current.dataset.pressed = 'true'; };
    const up = () => { if (ring.current) ring.current.dataset.pressed = 'false'; };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    document.addEventListener('pointerdown',down);
    document.addEventListener('pointerup',up);
    window.addEventListener('blur',leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      document.removeEventListener('pointerdown',down);
      document.removeEventListener('pointerup',up);
      window.removeEventListener('blur',leave);
      cancelAnimationFrame(frame);
    };
  }, [disabled]);
  return disabled ? null : (
    <div
      ref={ring}
      className="cursor-ring"
      aria-hidden="true"
      data-hidden="true"
    />
  );
}
