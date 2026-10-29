/** One pointer owner for material X-rays, including immersive routes where the
 * 2D ReactiveWorld layer is intentionally absent. No animation loop or React state. */
export type XrayPointer = Readonly<{ x: number; y: number; active: boolean; pressed: boolean; blocked: boolean }>;
const protectedTargets = 'a,button,input,textarea,select,video,img,picture,iframe,[contenteditable="true"],[role="button"],[role="slider"],[data-xray-protect],dialog[open]';
const listeners = new Set<(layout: boolean) => void>();
let x = -10000, y = -10000, inside = false, pressed = false, active = false, blocked = false, dirty = true, installed = false;
let lastValidation = -Infinity;
const snapshot = { x, y, active, pressed, blocked };
export const xrayTargetAllowed = (target: Element | null) => Boolean(target && !target.closest(protectedTargets));
const notify = (layout = false) => listeners.forEach(listener => listener(layout));

function validate() {
  let overlay = Boolean(document.querySelector('dialog[open],.ms-player-dialog[open]'));
  try { overlay ||= Boolean(document.querySelector(':popover-open')); } catch { /* Older engines have no native popovers. */ }
  const inViewport = inside && x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight;
  blocked = overlay || Boolean(inViewport && !xrayTargetAllowed(document.elementFromPoint(x, y)));
  active = inViewport && !pressed && !document.hidden && !blocked;
  dirty = false; lastValidation = performance.now();
}
function move(event: PointerEvent) {
  if (!event.isPrimary || event.pointerType === 'touch') return;
  x = event.clientX; y = event.clientY; inside = true;
  pressed = event.buttons !== 0; dirty = true; validate(); notify();
}
function down(event: PointerEvent) {
  if (!event.isPrimary) return;
  x = event.clientX; y = event.clientY; pressed = true; active = false; inside = false; dirty = true; notify();
}
function release() { pressed = false; active = false; inside = false; dirty = true; notify(); }
function up(event: PointerEvent) {
  if (!event.isPrimary) return;
  x = event.clientX; y = event.clientY; pressed = false; inside = event.pointerType !== 'touch'; dirty = true;
  validate(); notify();
}
function leave(event: PointerEvent) { if (!event.relatedTarget) release(); }
function visibility() { if (document.hidden) release(); }
function layout() { dirty = true; notify(true); }

export function readXrayPointer(): XrayPointer {
  // A moving scene may put a protected surface under a stationary pointer.
  // One hit-test is shared by every renderer, capped at about 20 Hz.
  if (dirty || inside && performance.now() - lastValidation > 48) validate();
  snapshot.x = x; snapshot.y = y; snapshot.active = active; snapshot.pressed = pressed; snapshot.blocked = blocked;
  return snapshot;
}
export function invalidateXrayPointer() { layout(); }
export function acquireXrayPointer(invalidate: (layout: boolean) => void) {
  listeners.add(invalidate);
  if (!installed) {
    installed = true;
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true, capture: true });
    window.addEventListener('pointerup', up, { passive: true, capture: true });
    window.addEventListener('pointercancel', release, { passive: true, capture: true });
    window.addEventListener('pointerout', leave, { passive: true });
    window.addEventListener('blur', release); window.addEventListener('keydown', release);
    window.addEventListener('scroll', layout, { passive: true, capture: true });
    window.addEventListener('resize', layout, { passive: true });
    window.visualViewport?.addEventListener('resize', layout); window.visualViewport?.addEventListener('scroll', layout);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('toggle', layout, true); document.addEventListener('close', layout, true);
  }
  let released = false;
  return () => {
    if (released) return; released = true; listeners.delete(invalidate);
    if (listeners.size || !installed) return;
    installed = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', release, true);
    window.removeEventListener('pointerout', leave); window.removeEventListener('blur', release); window.removeEventListener('keydown', release);
    window.removeEventListener('scroll', layout, true); window.removeEventListener('resize', layout);
    window.visualViewport?.removeEventListener('resize', layout); window.visualViewport?.removeEventListener('scroll', layout);
    document.removeEventListener('visibilitychange', visibility);
    document.removeEventListener('toggle', layout, true); document.removeEventListener('close', layout, true);
    x = y = -10000; inside = pressed = active = blocked = false; dirty = true; lastValidation = -Infinity;
  };
}
