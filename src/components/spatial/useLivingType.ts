import { useEffect, type RefObject } from 'react';
import { getTunnelFrame, subscribeTunnelFrame } from '../../services/tunnelJourney';
import { cancelVisualFrame, requestVisualFrame } from '../../services/visualFrame';

type LivingTypeOptions = { enabled: boolean; reducedMotion: boolean; compact: boolean };
type Point = { x: number; y: number };
type Glyph = {
  element: HTMLElement; anchor: HTMLElement; center: Point;
  x: number; y: number; rotation: number; tilt: number; energy: number;
};
type Word = { element: HTMLElement; center: Point; y: number };

const GLYPH_PROPERTIES = ['--type-x', '--type-y', '--type-r', '--type-rx', '--type-energy'];
const SIGNAL_PERIOD = 9000;
const SIGNAL_DURATION = 3000;
const SIGNAL_DELAY = 1100;
const POINTER_RADIUS = 150;
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const damp = (value: number, target: number, amount: number) => Math.abs(target - value) < .002 ? target : value + (target - value) * amount;

/** A local response inside the existing arrival letters. The Passage continues
 * to own scroll, the hero transform and its single shared frame dispatcher. */
export function useLivingType(ref: RefObject<HTMLElement | null>, { enabled, reducedMotion, compact }: LivingTypeOptions) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const glyphs: Glyph[] = Array.from(root.querySelectorAll<HTMLElement>('.living-type-glyph'), element => ({
      element, anchor: element.closest<HTMLElement>('.depth-letter') ?? element,
      center: { x: 0, y: 0 }, x: 0, y: 0, rotation: 0, tilt: 0, energy: 0,
    }));
    const words: Word[] = Array.from(root.querySelectorAll<HTMLElement>('.living-type-word'), element => ({ element, center: { x: 0, y: 0 }, y: 0 }));
    const fullStop = root.querySelector<HTMLElement>('.tunnel-full-stop');
    const ownedData = ['livingType', 'livingTypeGlyphs', 'livingTypeWords', 'livingTypeMeasurements', 'livingTypeEnergy', 'livingTypeSignal'];
    let signalEnergy = 0;

    function reset() {
      for (const glyph of glyphs) {
        for (const property of GLYPH_PROPERTIES) glyph.element.style.removeProperty(property);
        glyph.x = glyph.y = glyph.rotation = glyph.tilt = glyph.energy = 0;
      }
      for (const word of words) { word.element.style.removeProperty('--word-y'); word.y = 0; }
      fullStop?.style.removeProperty('--signal-energy');
      signalEnergy = 0;
      root!.dataset.livingTypeEnergy = '0.000';
      root!.dataset.livingTypeSignal = 'idle';
    }
    function removeOwnedState() {
      reset();
      for (const key of ownedData) delete root!.dataset[key];
    }

    reset();
    root.dataset.livingType = reducedMotion ? 'reduced' : 'paused';
    // No observers, pointer handlers, timers or frame requests in reduced mode.
    if (reducedMotion || !enabled || !glyphs.length) return removeOwnedState;

    let disposed = false, visible = false, running = false;
    let frame = 0, timer = 0, geometryDirty = true, measurements = 0;
    let timeline = 0, clockTime = 0, previousFrameTime = 0;
    let tunnel = getTunnelFrame();
    let playback = document.body.classList.contains('monumental-player-active');
    let obscured = false;
    const pointer = { x: 0, y: 0, present: false };
    const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');

    const allowed = () => !disposed && visible && !document.hidden && !playback && !obscured
      && root!.isConnected && !root!.inert && tunnel.active < 0 && (compact || tunnel.progress < .72);

    function advanceClock(now: number) {
      if (running) timeline += Math.max(0, now - clockTime);
      clockTime = now;
    }
    function stopScheduling() {
      if (frame) cancelVisualFrame(frame);
      if (timer) window.clearTimeout(timer);
      frame = timer = 0;
      previousFrameTime = 0;
    }
    function requestFrame() {
      if (running && !frame) frame = requestVisualFrame(draw);
    }
    function sync() {
      if (disposed) return;
      const next = allowed();
      if (next === running) { if (next && geometryDirty) requestFrame(); return; }
      const now = performance.now();
      if (running) advanceClock(now);
      running = next;
      clockTime = now;
      root!.dataset.livingType = next ? 'active' : 'paused';
      if (next) { geometryDirty = true; requestFrame(); }
      else { stopScheduling(); pointer.present = false; reset(); }
    }
    function syncModal() {
      obscured = !!document.querySelector('dialog:modal,[popover]:popover-open');
      sync();
    }
    function invalidateGeometry() {
      if (disposed) return;
      geometryDirty = true;
      requestFrame();
    }

    function measure() {
      // Every layout read precedes every style write. The outer letter is not
      // transformed by this hook, so pointer motion never moves its own target.
      const glyphRects = glyphs.map(glyph => glyph.anchor.getBoundingClientRect());
      const wordRects = words.map(word => word.element.getBoundingClientRect());
      glyphs.forEach((glyph, index) => {
        const rect = glyphRects[index];
        glyph.center.x = rect.left + rect.width / 2 - (glyph.anchor === glyph.element ? glyph.x : 0);
        glyph.center.y = rect.top + rect.height / 2 - (glyph.anchor === glyph.element ? glyph.y : 0);
      });
      words.forEach((word, index) => {
        const rect = wordRects[index];
        word.center.x = rect.left + rect.width / 2;
        word.center.y = rect.top + rect.height / 2 - word.y;
      });
      geometryDirty = false;
      root!.dataset.livingTypeGlyphs = String(glyphRects.filter(rect => rect.width > 0 && rect.height > 0).length);
      root!.dataset.livingTypeWords = String(wordRects.filter(rect => rect.width > 0 && rect.height > 0).length);
      root!.dataset.livingTypeMeasurements = String(++measurements);
    }

    function proximity(center: Point) {
      if (!pointer.present) return 0;
      return smooth(1 - Math.hypot(pointer.x - center.x, pointer.y - center.y) / POINTER_RADIUS);
    }
    function sweep(position: number, phase: number) {
      if (phase < 0 || phase >= SIGNAL_DURATION) return 0;
      const crest = -.16 + phase / SIGNAL_DURATION * 1.32;
      return .25 * smooth(1 - Math.abs(position - crest) / .16);
    }
    function setValue(element: HTMLElement, property: string, previous: number, next: number, unit = '') {
      if (previous !== next) element.style.setProperty(property, `${next.toFixed(3)}${unit}`);
    }
    function scheduleSignal(phase: number) {
      if (timer || !running) return;
      const delay = timeline < SIGNAL_DELAY ? SIGNAL_DELAY - timeline : SIGNAL_PERIOD - phase;
      timer = window.setTimeout(() => { timer = 0; requestFrame(); }, Math.max(16, delay));
    }

    function draw(now: number) {
      frame = 0;
      if (!allowed()) { sync(); return; }
      advanceClock(now);
      const delta = previousFrameTime ? Math.min(64, Math.max(1, now - previousFrameTime)) : 16;
      previousFrameTime = now;
      const damping = 1 - Math.exp(-delta / 105);
      if (geometryDirty) measure();
      const phase = timeline < SIGNAL_DELAY ? -1 : (timeline - SIGNAL_DELAY) % SIGNAL_PERIOD;
      const sweeping = phase >= 0 && phase < SIGNAL_DURATION;
      let settling = false, peak = 0, pointerPeak = 0;

      for (let index = 0; index < glyphs.length; index++) {
        const glyph = glyphs[index];
        const local = proximity(glyph.center);
        pointerPeak = Math.max(pointerPeak, local);
        const authored = sweep(index / Math.max(1, glyphs.length - 1), phase);
        const energy = Math.max(local, authored);
        const directionX = pointer.present ? clamp((pointer.x - glyph.center.x) / 32, -1, 1) : 0;
        const directionY = pointer.present ? clamp((pointer.y - glyph.center.y) / 42, -1, 1) : 0;
        const targetX = directionX * local * (compact ? 1.5 : 3);
        // The .25 authored crest reaches only 1.5px on a compact screen.
        const targetY = -(compact ? 6 : 7) * energy;
        const targetRotation = clamp(directionX * local * 8 + authored * 2, -8, 8);
        const targetTilt = clamp(-directionY * local * 5, -5, 5);
        const x = damp(glyph.x, targetX, damping), y = damp(glyph.y, targetY, damping);
        const rotation = damp(glyph.rotation, targetRotation, damping), tilt = damp(glyph.tilt, targetTilt, damping);
        const nextEnergy = damp(glyph.energy, energy, damping);
        setValue(glyph.element, '--type-x', glyph.x, x, 'px');
        setValue(glyph.element, '--type-y', glyph.y, y, 'px');
        setValue(glyph.element, '--type-r', glyph.rotation, rotation, 'deg');
        setValue(glyph.element, '--type-rx', glyph.tilt, tilt, 'deg');
        setValue(glyph.element, '--type-energy', glyph.energy, nextEnergy);
        settling ||= Math.abs(x - targetX) > .002 || Math.abs(y - targetY) > .002
          || Math.abs(rotation - targetRotation) > .002 || Math.abs(tilt - targetTilt) > .002 || Math.abs(nextEnergy - energy) > .002;
        glyph.x = x; glyph.y = y; glyph.rotation = rotation; glyph.tilt = tilt; glyph.energy = nextEnergy;
        peak = Math.max(peak, nextEnergy);
      }

      for (let index = 0; index < words.length; index++) {
        const word = words[index];
        const authored = sweep(index / Math.max(1, words.length - 1), phase);
        const target = -2 * Math.max(proximity(word.center), authored);
        const next = damp(word.y, target, damping);
        setValue(word.element, '--word-y', word.y, next, 'px');
        settling ||= Math.abs(next - target) > .002;
        word.y = next;
      }

      const signalTarget = Math.max(sweep(1, phase), pointerPeak * .4);
      const nextSignal = damp(signalEnergy, signalTarget, damping);
      if (fullStop) setValue(fullStop, '--signal-energy', signalEnergy, nextSignal);
      settling ||= Math.abs(nextSignal - signalTarget) > .002;
      signalEnergy = nextSignal;
      const measuredEnergy = peak.toFixed(3);
      if (root!.dataset.livingTypeEnergy !== measuredEnergy) root!.dataset.livingTypeEnergy = measuredEnergy;
      const signalState = sweeping ? 'sweep' : 'idle';
      if (root!.dataset.livingTypeSignal !== signalState) root!.dataset.livingTypeSignal = signalState;

      if (sweeping || settling) requestFrame();
      else { previousFrameTime = 0; scheduleSignal(phase); }
    }

    function move(event: PointerEvent) {
      if (event.pointerType === 'touch' || !finePointer.matches) { releasePointer(); return; }
      if (!running) return;
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.present = true;
      requestFrame();
    }
    function releasePointer() {
      if (!pointer.present) return;
      pointer.present = false;
      requestFrame();
    }
    function leave(event: PointerEvent) { if (event.relatedTarget === null) releasePointer(); }
    function touch(event: PointerEvent) { if (event.pointerType === 'touch') releasePointer(); }
    function playbackChange(event: Event) {
      playback = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      sync();
    }
    function arrivalEnded(event: AnimationEvent) {
      if (event.target instanceof Element && event.target.matches('.depth-letter,.living-type-word')) invalidateGeometry();
    }

    const intersection = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      sync();
    }, { threshold: 0 });
    intersection.observe(root);
    const resize = new ResizeObserver(invalidateGeometry);
    resize.observe(root);
    for (const element of root.querySelectorAll<HTMLElement>('h1,.tunnel-hero-copy,.tunnel-hero-caption,.tunnel-hero-bottom')) resize.observe(element);
    // Observe only native modal state. Our many style writes cannot trigger it.
    const modal = new MutationObserver(syncModal);
    modal.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['open'] });
    const unsubscribe = subscribeTunnelFrame(next => {
      if (next.progress !== tunnel.progress || next.active !== tunnel.active || next.compact !== tunnel.compact) geometryDirty = true;
      tunnel = next;
      sync();
    });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerout', leave, { passive: true });
    window.addEventListener('pointercancel', releasePointer, { passive: true });
    window.addEventListener('pointerdown', touch, { passive: true });
    window.addEventListener('blur', releasePointer);
    window.addEventListener('resize', invalidateGeometry, { passive: true });
    window.addEventListener('monumental:playback', playbackChange);
    window.addEventListener('monumental:flight-sync', syncModal);
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('toggle', syncModal, true);
    document.addEventListener('close', syncModal, true);
    document.fonts.addEventListener('loadingdone', invalidateGeometry);
    finePointer.addEventListener('change', releasePointer);
    root.addEventListener('animationend', arrivalEnded);
    void document.fonts.ready.then(() => { if (!disposed) invalidateGeometry(); });
    syncModal();

    return () => {
      disposed = true;
      stopScheduling();
      unsubscribe(); intersection.disconnect(); resize.disconnect(); modal.disconnect();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerout', leave);
      window.removeEventListener('pointercancel', releasePointer);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('blur', releasePointer);
      window.removeEventListener('resize', invalidateGeometry);
      window.removeEventListener('monumental:playback', playbackChange);
      window.removeEventListener('monumental:flight-sync', syncModal);
      document.removeEventListener('visibilitychange', sync);
      document.removeEventListener('toggle', syncModal, true);
      document.removeEventListener('close', syncModal, true);
      document.fonts.removeEventListener('loadingdone', invalidateGeometry);
      finePointer.removeEventListener('change', releasePointer);
      root.removeEventListener('animationend', arrivalEnded);
      removeOwnedState();
    };
  }, [ref, enabled, reducedMotion, compact]);
}
