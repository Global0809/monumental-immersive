import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { typePressure, typeWordAt } from '../services/typeMotion';
import './reactive-typography.css';

const headings = 'h1,h2,[data-text-motion="display"]';
const copy = 'p,li,dt,dd,blockquote,figcaption,label,small';
const controls = 'a,button,summary';
const excluded = '.ms-player-dialog,.player-companion,.spatial-passage,.page-loading,.notice-region,input,textarea,select,[contenteditable],svg,[aria-live],[role="status"],[data-text-motion="off"]';
const hidden = '[aria-hidden="true"],[inert],dialog:not([open])';
type Word = { range: Range; rect: DOMRect; owner: HTMLElement };
type HighlightAPI = { highlights: Map<string, unknown> };
type HighlightWindow = Window & { Highlight?: new (...ranges: Range[]) => unknown };

/** Keeps React's text nodes, selection and accessible names intact. Motion is
 * applied to existing type; the range highlight is only a paint annotation. */
export default function ReactiveTypography({ path, reducedMotion, paused }: {
  path: string; reducedMotion: boolean; paused: boolean;
}) {
  const trace = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.monumental-spatial');
    if (!root || reducedMotion || paused) return;
    root.dataset.typeMotion = 'on';
    const ctx = gsap.context(() => {}, root);
    const registered = new Map<HTMLElement, string>();
    const visible = new Set<HTMLElement>();
    const entered = new WeakSet<HTMLElement>();
    const animations = new Map<HTMLElement, Animation>();
    const drivers = new WeakMap<HTMLElement, { x: (value: number) => void; y: (value: number) => void; angle: (value: number) => void }>();
    const highlightAPI = 'highlights' in CSS ? CSS as unknown as HighlightAPI : null;
    const Highlight = (window as HighlightWindow).Highlight;
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    let alive = true, frame = 0, scanFrame = 0, pointerX = -1000, pointerY = -1000;
    let active: HTMLElement | null = null, pressure: HTMLElement | null = null, words: Word[] = [];
    let geometryDirty = true, blocked = false, lastRange: Range | null = null;
    let xTo = (_value: number) => {}, yTo = (_value: number) => {}, angleTo = (_value: number) => {};
    const available = (el: HTMLElement) => el.isConnected && !el.closest(excluded) && !el.closest(hidden);
    const clearSignal = () => {
      highlightAPI?.highlights.delete('monumental-signal'); lastRange = null;
      active?.removeAttribute('data-type-active'); active?.style.removeProperty('--type-signal'); active = null;
      if (trace.current) trace.current.style.opacity = '0';
    };
    const release = (immediate = false) => {
      if (!pressure) return;
      xTo(0); yTo(0); angleTo(0);
      if (immediate) {
        gsap.killTweensOf(pressure, '--type-x,--type-y,--type-angle');
        ['--type-x', '--type-y', '--type-angle'].forEach(key => pressure?.style.removeProperty(key));
      }
      pressure.removeAttribute('data-type-pressure'); pressure = null;
    };
    const reset = () => { clearSignal(); release(); };
    const arrive = (el: HTMLElement) => {
      if (!available(el) || entered.has(el)) return;
      if (document.documentElement.dataset.spatialPassage) return;
      entered.add(el);
      // Reading text stays still. One arrival belongs to the page title; section
      // headings retain local pointer feedback without staging every paragraph.
      if (!el.matches('h1')) return;
      const animation = el.animate([
        { translate: '0 8px', opacity: .85 },
        { translate: '0 0', opacity: 1 },
      ], {
        duration: 480,
        easing: 'cubic-bezier(.16,1,.3,1)',
      });
      animations.set(el, animation);
      void animation.finished.then(() => { animations.delete(el); geometryDirty = true; }, () => {});
    };
    const intersection = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) { visible.add(el); arrive(el); }
        else { visible.delete(el); animations.get(el)?.cancel(); animations.delete(el); }
      }
      geometryDirty = true;
    }, { threshold: .08 });
    const scan = () => {
      scanFrame = 0;
      if (!alive) return;
      for (const el of registered.keys()) if (!el.isConnected) {
        intersection.unobserve(el); visible.delete(el); animations.get(el)?.cancel();
        animations.delete(el); registered.delete(el);
      }
      root.querySelectorAll<HTMLElement>(headings).forEach(el => {
        if (registered.has(el) || el.closest(excluded) || !el.textContent?.trim()) return;
        // Animate a prose block once, rather than also animating its nested labels.
        if (!el.matches(headings) && el.parentElement?.closest(`${headings},${copy}`)) return;
        registered.set(el, el.getAttribute('data-type-role') || '');
        el.dataset.typeRole = el.matches(headings) ? 'display' : 'copy';
        intersection.observe(el);
      });
      for (const el of visible) arrive(el);
      clearSignal();
      geometryDirty = true;
    };
    const scheduleScan = () => { if (!scanFrame) scanFrame = requestAnimationFrame(scan); };
    const mutation = new MutationObserver(records => {
      // Our CSS variables and highlight attributes never retrigger this observer.
      if (records.some(record => record.type === 'childList' || record.type === 'characterData' || record.type === 'attributes')) scheduleScan();
    });
    mutation.observe(root, { subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['aria-hidden', 'inert', 'open'] });
    mutation.observe(document.documentElement, { attributes: true, attributeFilter: ['data-spatial-passage'] });

    const measureWords = () => {
      words = [];
      // Headings can be pointer-transparent over the 3D scene. Range geometry
      // lets those words react without stealing sculpture drag gestures.
      for (const el of visible) {
        if (!el.matches(headings) || !available(el)) continue;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if ((node.parentElement?.closest('svg,[aria-hidden="true"]'))) continue;
          for (const match of (node.textContent || '').matchAll(/[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*/gu)) {
            const range = document.createRange(); range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
            for (const rect of range.getClientRects()) if (rect.width && rect.height) words.push({ range, rect, owner: el });
          }
        }
      }
      geometryDirty = false;
    };
    const inkFor = (el: HTMLElement) => {
      for (let node: HTMLElement | null = el; node && node !== root; node = node.parentElement) {
        const rgb = getComputedStyle(node).backgroundColor.match(/[\d.]+/g)?.map(Number);
        if (rgb && (rgb.length < 4 || rgb[3] > .85)) {
          return (rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722) > 100 ? '#080909' : '#ff4d32';
        }
      }
      return '#ff4d32';
    };
    const illuminate = (word: Word) => {
      if (active !== word.owner) {
        clearSignal(); active = word.owner; active.dataset.typeActive = 'true';
        active.style.setProperty('--type-signal', inkFor(active));
      }
      if (Highlight && highlightAPI && lastRange !== word.range) {
        highlightAPI.highlights.set('monumental-signal', new Highlight(word.range)); lastRange = word.range;
      }
      if (trace.current) {
        // Font ink boxes can exceed a tight display line. Keep the rule above
        // the next line instead of underlining through its letters.
        const lineHeight = parseFloat(getComputedStyle(word.owner).lineHeight) || word.rect.height;
        const baseline = word.rect.top + Math.min(word.rect.height, lineHeight) + 1;
        trace.current.style.transform = `translate3d(${word.rect.left}px,${baseline}px,0)`;
        trace.current.style.width = `${word.rect.width}px`;
        trace.current.style.opacity = '1';
        trace.current.style.color = active.style.getPropertyValue('--type-signal');
      }
    };
    const directWord = (): Word | null => {
      const doc = document as Document & { caretRangeFromPoint?(x: number, y: number): Range | null;
        caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null };
      const caret = doc.caretPositionFromPoint?.(pointerX, pointerY);
      const fallback = !caret ? doc.caretRangeFromPoint?.(pointerX, pointerY) : null;
      const node = caret?.offsetNode || fallback?.startContainer;
      const offset = caret?.offset ?? fallback?.startOffset;
      if (!node || node.nodeType !== Node.TEXT_NODE || offset === undefined) return null;
      const owner = node.parentElement?.closest<HTMLElement>(`${headings},${copy},${controls},span,strong,em,time`);
      if (!owner || !root.contains(owner) || !available(owner) || owner.closest(':disabled,[aria-disabled="true"]')) return null;
      const indices = typeWordAt(node.textContent || '', offset);
      if (!indices) return null;
      const range = document.createRange(); range.setStart(node, indices[0]); range.setEnd(node, indices[1]);
      const rect = range.getBoundingClientRect();
      // Caret APIs snap to distant text in empty space; reject those guesses.
      if (pointerX < rect.left - 5 || pointerX > rect.right + 5 || pointerY < rect.top - 5 || pointerY > rect.bottom + 5) return null;
      return { owner, range, rect };
    };
    const draw = () => {
      frame = 0;
      if (blocked || document.hidden || !fine.matches || document.documentElement.dataset.spatialPassage || !getSelection()?.isCollapsed) { reset(); return; }
      if (geometryDirty) measureWords();
      let word = directWord();
      const hasDialog = document.querySelector('dialog:modal,[popover]:popover-open');
      // Only the top layer receives type feedback while a menu/dialog is open.
      if (hasDialog && word && !hasDialog.contains(word.owner)) word = null;
      if (!word && !hasDialog) word = words.find(item => available(item.owner) && pointerX >= item.rect.left - 4 && pointerX <= item.rect.right + 4 && pointerY >= item.rect.top - 4 && pointerY <= item.rect.bottom + 4) || null;
      const title = word?.owner.closest<HTMLElement>('[data-type-role="display"]') || null;
      if (title !== pressure) {
        release();
        if (title) {
          pressure = title; title.dataset.typePressure = 'true'; animations.get(title)?.cancel(); animations.delete(title);
          if (!drivers.has(title)) ctx.add(() => {
            drivers.set(title, {
              x: gsap.quickTo(title, '--type-x', { duration: .5, ease: 'power3.out' }),
              y: gsap.quickTo(title, '--type-y', { duration: .5, ease: 'power3.out' }),
              angle: gsap.quickTo(title, '--type-angle', { duration: .5, ease: 'power3.out' }),
            });
          });
          const driver = drivers.get(title)!; xTo = driver.x; yTo = driver.y; angleTo = driver.angle;
        }
      }
      if (title) {
        const rect = title.getBoundingClientRect();
        const field = typePressure(pointerX - rect.left, pointerY - rect.top, rect.width, rect.height);
        xTo(field.x); yTo(field.y); angleTo(field.angle);
      }
      if (word) illuminate(word); else clearSignal();
    };
    const requestDraw = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      pointerX = event.clientX; pointerY = event.clientY; blocked = event.buttons !== 0; requestDraw();
    };
    const down = () => { blocked = true; reset(); };
    const up = () => { blocked = false; requestDraw(); };
    const layout = () => { geometryDirty = true; clearSignal(); release(); };
    const focus = (event: FocusEvent) => {
      const control = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(controls) : null;
      if (!control || !root.contains(control) || !available(control) || !control.matches(':focus-visible')) return;
      const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim() || node.parentElement?.closest('svg,[aria-hidden="true"]')) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        illuminate({ owner: control, range, rect: range.getBoundingClientRect() }); break;
      }
    };
    scan();
    document.fonts.ready.then(() => { if (alive) layout(); });
    const resize = new ResizeObserver(layout); resize.observe(root);
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerup', up, { passive: true });
    document.addEventListener('pointercancel', up, { passive: true });
    document.addEventListener('pointerleave', reset);
    document.addEventListener('focusin', focus); document.addEventListener('focusout', reset);
    document.addEventListener('visibilitychange', reset);
    window.addEventListener('blur', reset); window.addEventListener('scroll', layout, { passive: true });
    window.addEventListener('resize', layout, { passive: true });
    window.addEventListener('monumental:navigate', reset);
    return () => {
      alive = false; cancelAnimationFrame(frame); cancelAnimationFrame(scanFrame); mutation.disconnect(); intersection.disconnect(); resize.disconnect();
      clearSignal(); release(true); ctx.revert(); animations.forEach(animation => animation.cancel());
      registered.forEach((prior, el) => { if (prior) el.setAttribute('data-type-role', prior); else el.removeAttribute('data-type-role'); el.removeAttribute('data-type-pressure'); });
      delete root.dataset.typeMotion;
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerdown', down); document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up); document.removeEventListener('pointerleave', reset);
      document.removeEventListener('focusin', focus); document.removeEventListener('focusout', reset); document.removeEventListener('visibilitychange', reset);
      window.removeEventListener('blur', reset); window.removeEventListener('scroll', layout); window.removeEventListener('resize', layout); window.removeEventListener('monumental:navigate', reset);
    };
  }, [path, reducedMotion, paused]);
  return <span ref={trace} className="type-tracer" aria-hidden="true"><i/><i/></span>;
}
