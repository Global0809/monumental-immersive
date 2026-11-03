import { reactiveField as input } from './reactiveField';
import { createMatrixField } from './matrixField';
import { createFrameCadence } from './frameCadence';

const mediaSelector = 'video,iframe,.motion-stage,.film-image,.film-instrument__preview,.culture-sculpture__canvas';
const quietSelector = `${mediaSelector},input,textarea,select,[contenteditable="true"],dialog,[popover]:popover-open`;
type CopyZone = { left: number; pageY: number; width: number; height: number };

/** Ambient cursor/scroll-responsive particles only. No surface inspection,
 * text tracing, material cutaway, lens mask or structural overlay is mounted. */
export function mountAmbientField(canvas: HTMLCanvasElement, reducedMotion: boolean) {
  input.reduced = reducedMotion; input.active = false;
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const ctx: CanvasRenderingContext2D = context;
  if (reducedMotion) { ctx.clearRect(0, 0, canvas.width, canvas.height); return () => {}; }
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const drawMatrix = createMatrixField(fine), cadence = createFrameCadence();
  let width = innerWidth, height = innerHeight, frame = 0, last = 0, time = 0, disposed = false;
  let x = -1000, y = -1000, speed = 0, lastScroll = scrollY, hidden = document.hidden;
  let dirty = true, refresh = true, lastMeasure = -1000, geometryUntil = 0, hitDirty = true;
  let pointerTarget: Element | null = null, copy: HTMLElement[] = [], media: Element[] = [];
  let copyZones: CopyZone[] = [], holes: DOMRect[] = [], lastKind = '', lastMediaCount = -1;
  function geometryChanged(duration = 1000) {
    geometryUntil = Math.max(geometryUntil, performance.now() + duration); hitDirty = true; dirty = true;
  }
  function schedule() { if (!frame && !hidden && !input.blocked && !disposed) frame = requestAnimationFrame(draw); }
  function resize() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); geometryChanged(); schedule();
  }
  function allowed(element: Element | null, covered = Boolean(document.querySelector('dialog:modal,[popover]:popover-open'))) {
    return fine && !!element?.closest('main') && !element.closest(quietSelector) && !covered;
  }
  function move(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return;
    input.x = event.clientX; input.y = event.clientY;
    pointerTarget = event.target as Element; input.active = allowed(pointerTarget);
    hitDirty = true; schedule();
  }
  function leave() { input.active = false; pointerTarget = null; schedule(); }
  function scroll() {
    input.velocity = Math.max(-40, Math.min(40, scrollY - lastScroll));
    lastScroll = scrollY; input.scroll = scrollY; geometryChanged(); schedule();
  }
  function visibility() {
    hidden = document.hidden;
    if (hidden) { cancelAnimationFrame(frame); frame = 0; input.active = false; }
    else { last = 0; cadence.reset(); geometryChanged(); schedule(); }
  }
  function playback(event: Event) {
    input.blocked = Boolean((event as CustomEvent<{ active: boolean }>).detail.active);
    if (input.blocked) { cancelAnimationFrame(frame); frame = 0; input.active = false; ctx.clearRect(0, 0, width, height); }
    else { last = 0; cadence.reset(); geometryChanged(); schedule(); }
  }
  function interfaceChanged() { last = 0; cadence.reset(); geometryChanged(); schedule(); }
  function measure(now: number) {
    if (refresh) {
      copy = Array.from(document.querySelectorAll<HTMLElement>('main h1,main h2,main h3,main h4,main p,main a,main button,main label,main input,main textarea,main select'));
      media = Array.from(document.querySelectorAll(mediaSelector)); refresh = false; dirty = true;
    }
    if (!dirty || now - lastMeasure <= 140) return;
    copyZones = copy.filter(element => element.isConnected && !element.closest('[inert],[aria-hidden="true"]')).map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, pageY: rect.top + scrollY, width: rect.width, height: rect.height };
    }).filter(rect => rect.width > 0 && rect.height > 0 && rect.pageY + rect.height > scrollY - 230 && rect.pageY < scrollY + height + 230);
    holes = [];
    for (const element of media) {
      if (!element.isConnected) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) continue;
      if (!element.closest('[inert]') && element.checkVisibility()) holes.push(rect);
    }
    dirty = false; lastMeasure = now;
  }
  function draw(now: number) {
    frame = 0;
    if (hidden || input.blocked || disposed) return;
    if (!cadence.ready(now)) { schedule(); return; }
    const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60;
    last = now; time += dt;
    const forbidden = !!document.querySelector('dialog:modal,[popover]:popover-open');
    if (pointerTarget && (hitDirty || now < geometryUntil)) {
      pointerTarget = document.elementFromPoint(input.x, input.y); input.active = allowed(pointerTarget, forbidden); hitDirty = false;
    }
    if (forbidden) input.active = false;
    const step = dt * 40, pointerEase = 1 - Math.pow(.66, step);
    x += (input.x - x) * pointerEase; y += (input.y - y) * pointerEase;
    speed += (input.velocity - speed) * (1 - Math.pow(.88, step)); input.velocity *= Math.pow(.86, step);
    if (now < geometryUntil) dirty = true;
    measure(now);
    const kind = forbidden ? 'paused' : 'ambient';
    if (kind !== lastKind) { canvas.dataset.reveal = kind; lastKind = kind; }
    if (holes.length !== lastMediaCount) { canvas.dataset.mediaExclusions = String(holes.length); lastMediaCount = holes.length; }
    ctx.clearRect(0, 0, width, height);
    if (forbidden) return;
    drawMatrix(ctx, { width, height, time, scroll: input.scroll, speed, x, y, active: input.active });
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.84)';
    copyZones.forEach(r => ctx.fillRect(r.left - 4, r.pageY - scrollY - 4, r.width + 8, r.height + 8));
    ctx.restore();
    holes.forEach(r => ctx.clearRect(r.left - 5, r.top - 5, r.width + 10, r.height + 10));
    schedule();
  }
  const mutation = new MutationObserver(() => { refresh = true; geometryChanged(); schedule(); });
  mutation.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
  const observer = new ResizeObserver(() => { geometryChanged(); schedule(); });
  const main = document.querySelector('main'); if (main) observer.observe(main);
  document.fonts.ready.then(() => { if (!disposed) { geometryChanged(); schedule(); } });
  const typographySettled = () => { geometryChanged(50); schedule(); };
  resize();
  window.addEventListener('resize', resize); window.addEventListener('scroll', scroll, { passive: true });
  document.addEventListener('pointermove', move, { passive: true }); document.addEventListener('pointerleave', leave);
  document.addEventListener('visibilitychange', visibility); window.addEventListener('monumental:playback', playback);
  window.addEventListener('monumental:typography-settled', typographySettled);
  document.addEventListener('close', interfaceChanged, true); document.addEventListener('toggle', interfaceChanged, true);
  return () => {
    disposed = true; cancelAnimationFrame(frame); mutation.disconnect(); observer.disconnect();
    window.removeEventListener('resize', resize); window.removeEventListener('scroll', scroll);
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave);
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('monumental:playback', playback);
    window.removeEventListener('monumental:typography-settled', typographySettled);
    document.removeEventListener('close', interfaceChanged, true); document.removeEventListener('toggle', interfaceChanged, true);
    input.active = false; ctx.clearRect(0, 0, width, height);
  };
}
