import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { buildErosionContour, prepareErosionContour } from '../services/erosionContour';
import { createFrameCadence } from '../services/frameCadence';
import { erosionChapters, erosionProtected, type ErosionChapter, type ErosionTheme } from '../services/erosionChapters';
import './scroll-erosion.css';

gsap.registerPlugin(ScrollTrigger);
type Palette = { surface: string; ink: string; muted: string; accent: string; line: string };
type MeasuredChapter = ErosionChapter & { element: HTMLElement; top: number; fromTheme: ErosionTheme; startY: number; endY: number };
type Ink = {
  element: HTMLElement; role: 'ink' | 'muted' | 'accent'; layoutWidth: number; layoutHeight: number; fragmented: boolean;
  inlineParent?: { element: HTMLElement; width: number; height: number }; inlineRtl?: boolean;
  fragmentCache?: { key: string; image: string; width: number; height: number };
  paintCache?: { key: string; image: string };
};
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const paintSelector = 'h1,h2,h3,h4,p,span,small,strong,em,a,label,summary,dt,dd,li,div';

/** One noninteractive compositor, shared by every route. No application/media clones. */
export default function ScrollErosion({ path, reducedMotion }: { path: string; reducedMotion: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  const base = useRef<SVGRectElement>(null);
  const reveal = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>('.route-stage');
    const field = svg.current;
    if (!root || !field || !base.current || !reveal.current || !CSS.supports('background-clip', 'text')) return;
    const doc = document.documentElement;
    const tokens = getComputedStyle(doc);
    const token = (name: string, fallback: string) => tokens.getPropertyValue(name).trim() || fallback;
    const black = token('--bg', '#080909'), ink = token('--ink', '#0b0c0b');
    const text = token('--text', '#efeee9'), red = token('--accent', '#ff4d32');
    const palettes: Record<ErosionTheme, Palette> = {
      black: { surface: black, ink: text, muted: token('--muted', '#a9aaa6'), accent: red, line: '#ffffff40' },
      charcoal: { surface: token('--surface', '#111212'), ink: text, muted: '#a9aaa6', accent: red, line: '#ffffff40' },
      red: { surface: red, ink, muted: '#27211e', accent: ink, line: '#0b0c0b70' },
    };
    let width = innerWidth, height = innerHeight, chapters: MeasuredChapter[] = [];
    let inks: Ink[] = [], protectedNodes: HTMLElement[] = [], rules: HTMLElement[] = [];
    let frame = 0, refreshFrame = 0, disposed = false, needsScan = true, lastKey = '';
    let alignmentUntil = 0, contourKey = '';
    const cadence = createFrameCadence();
    let contourCache: ReturnType<typeof buildErosionContour> | null = null;
    let idlePreflight = 0, preflightSignature = '';
    let preflightQueue: { key: string; chapter: MeasuredChapter; width: number; height: number }[] = [];
    const preparedFields = new Set<string>();
    let playingFilm = document.body.classList.contains('monumental-player-active');
    const markedInk = new Set<HTMLElement>(), markedProtect = new Set<HTMLElement>(), markedRule = new Set<HTMLElement>();
    const markedCarriers = new Set<HTMLElement>();
    const visibleInks = new Set<Ink>();
    const inkByElement = new Map<Element, Ink>();
    const inkObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const item = inkByElement.get(entry.target);
        if (!item) continue;
        if (entry.isIntersecting) visibleInks.add(item);
        else {
          visibleInks.delete(item);
          delete item.element.dataset.erosionSplit;
          item.element.style.removeProperty('--erosion-local-paint');
          item.paintCache = undefined; item.fragmentCache = undefined;
        }
      }
      schedule();
    }, { rootMargin: '90px 0px' });
    const context = gsap.context(() => {}, root);
    const config = erosionChapters(path);

    const materialKey = (chapter: MeasuredChapter) => JSON.stringify([width, height, chapter.seed, chapter.macroAmplitude ?? .15, chapter.detailAmount ?? 1]);
    function rememberPrepared(key: string) {
      if (preparedFields.has(key)) return;
      preparedFields.add(key);
      if (preparedFields.size > 4) preparedFields.delete(preparedFields.values().next().value!);
    }
    function cancelPreflight() {
      if (idlePreflight) window.cancelIdleCallback(idlePreflight);
      idlePreflight = 0; preflightQueue = []; preflightSignature = '';
    }
    function runPreflight() {
      if (idlePreflight || !preflightQueue.length) return;
      idlePreflight = window.requestIdleCallback(deadline => {
        idlePreflight = 0;
        if (disposed || document.hidden || playingFilm || reducedMotion) { cancelPreflight(); return; }
        // Optional work must never be forced into a busy animation/input frame.
        // If no useful idle window exists, ordinary first-demand rendering wins.
        if (deadline.timeRemaining() < 35) { preflightQueue = []; return; }
        let next = preflightQueue.shift();
        while (next && preparedFields.has(next.key)) next = preflightQueue.shift();
        if (next) {
          prepareErosionContour({ ...next.chapter, width: next.width, height: next.height, progress: 0 });
          rememberPrepared(next.key);
        }
        // At most one field per idle callback, at most two nearby fields queued.
        runPreflight();
      });
    }
    function queuePreflight() {
      if (reducedMotion || disposed || document.hidden || playingFilm || typeof window.requestIdleCallback !== 'function') return;
      const nearby = chapters.filter(chapter => chapter.endY > scrollY && chapter.startY <= scrollY + height * 2.5).slice(0, 2);
      const signature = nearby.map(materialKey).join('|');
      if (signature === preflightSignature) return;
      cancelPreflight(); preflightSignature = signature;
      preflightQueue = nearby.map(chapter => ({ key: materialKey(chapter), chapter, width, height })).filter(item => !preparedFields.has(item.key));
      runPreflight();
    }
    function schedule() {
      if (!frame && !disposed && !document.hidden && !playingFilm) frame = requestAnimationFrame(draw);
    }
    function trackAlignment() {
      // Entrance/scrub/hover motion can outlive scrolling. Follow the DOM briefly;
      // the erosion field itself remains frozen at its exact scroll position.
      if (!reducedMotion) alignmentUntil = performance.now() + 1250;
      schedule();
    }
    function trackPresentation(event: Event) {
      if (event.type === 'transitionrun' && !['transform','translate','scale','rotate'].includes((event as TransitionEvent).propertyName)) return;
      trackAlignment();
    }
    function refresh() {
      if (disposed || refreshFrame || playingFilm || document.hidden) return;
      cancelPreflight();
      refreshFrame = requestAnimationFrame(() => { refreshFrame = 0; measure(); trackAlignment(); });
    }
    function scan() {
      inkObserver.disconnect(); visibleInks.clear(); inkByElement.clear();
      // Declarative opt-outs plus existing protected islands. Never mutate their children.
      protectedNodes = Array.from(root!.querySelectorAll<HTMLElement>(erosionProtected)).filter(el => !el.parentElement?.closest(erosionProtected));
      protectedNodes.forEach(el => { if (!el.hasAttribute('data-erosion-protect')) { el.dataset.erosionProtect = ''; markedProtect.add(el); } });
      markedCarriers.forEach(el => delete el.dataset.erosionCarrier); markedCarriers.clear();
      const carrierLinks = new Map<HTMLElement, HTMLElement>();
      root!.querySelectorAll<HTMLElement>('h1,h2,h3,h4').forEach(heading => {
        const link = heading.firstElementChild as HTMLElement | null;
        if (heading.closest(erosionProtected) || heading.children.length !== 1 || !link?.matches('a') || link.matches(erosionProtected)) return;
        if (heading.textContent?.trim() !== link.textContent?.trim() || getComputedStyle(link).display !== 'inline') return;
        // Paint the heading's single, unfragmented box; the native inline link
        // retains its wrapping, hit area, accessible name and focus behavior.
        heading.dataset.erosionCarrier = ''; markedCarriers.add(heading); carrierLinks.set(heading, link);
      });
      inks = [];
      const nextInk = new Set<HTMLElement>();
      root!.querySelectorAll<HTMLElement>(paintSelector).forEach(el => {
        const source = carrierLinks.get(el);
        if (el.closest(erosionProtected) || (el.closest('[data-erosion-carrier]') && !source)) return;
        if (!source && !Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) return;
        // Classify once from the authored presentation, before adding our paint.
        const color = getComputedStyle(source ?? el).color;
        const rgb = color.match(/[\d.]+/g)?.map(Number) || [239,238,233];
        const role: Ink['role'] = (el.dataset.erosionInk || source?.dataset.erosionInk) as Ink['role'] || (rgb[0] > rgb[1] * 1.45 ? 'accent' : rgb[0] < 200 && rgb[0] > 60 ? 'muted' : 'ink');
        el.dataset.erosionInk = role; nextInk.add(el);
        const item: Ink = { element: el, role, layoutWidth: 0, layoutHeight: 0, fragmented: false };
        inks.push(item); inkByElement.set(el, item); visibleInks.add(item); inkObserver.observe(el);
      });
      markedInk.forEach(el => {
        if (nextInk.has(el)) return;
        delete el.dataset.erosionInk; delete el.dataset.erosionFragment; delete el.dataset.erosionSplit;
        ['--erosion-ink-position','--erosion-local-paint-size','--erosion-current-ink','--erosion-fragment-paint','--erosion-local-paint'].forEach(property => el.style.removeProperty(property));
        markedInk.delete(el);
      });
      nextInk.forEach(el => markedInk.add(el));
      rules = Array.from(root!.querySelectorAll<HTMLElement>('section,.results-line,.tab-row,.category-index>a,.film-meta,.notebook-entry,.world-stats,.empty-inline,.passport-counter'))
        .filter(el => !el.closest(erosionProtected));
      rules.forEach(el => { el.dataset.erosionRule = ''; markedRule.add(el); });
      needsScan = false;
    }
    function measure() {
      cancelPreflight();
      width = innerWidth; height = innerHeight;
      if (needsScan) scan();
      // Preserve subpixel layout sizes; offsetWidth rounds narrow kinetic letters.
      const layoutBoxes = new Map<HTMLElement, { width: number; height: number; style: CSSStyleDeclaration }>();
      const layoutBox = (element: HTMLElement) => {
        const cached = layoutBoxes.get(element); if (cached) return cached;
        const style = getComputedStyle(element);
        const outer = (axis: 'width' | 'height') => {
          const size = Number.parseFloat(style[axis]);
          const edges = axis === 'width' ? ['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'] as const : ['paddingTop','paddingBottom','borderTopWidth','borderBottomWidth'] as const;
          return Number.isFinite(size) ? size + (style.boxSizing === 'border-box' ? 0 : edges.reduce((sum, edge) => sum + (Number.parseFloat(style[edge]) || 0), 0)) : 0;
        };
        const box = { width: outer('width'), height: outer('height'), style }; layoutBoxes.set(element, box); return box;
      };
      inks.forEach(item => {
        const box = layoutBox(item.element), style = box.style;
        item.fragmented = style.display === 'inline' && item.element.getClientRects().length > 1;
        item.layoutWidth = box.width; item.layoutHeight = box.height;
        item.inlineParent = undefined; item.inlineRtl = style.direction === 'rtl';
        if (item.fragmented) {
          item.element.dataset.erosionFragment = '';
          for (let parent = item.element.parentElement; parent && root!.contains(parent); parent = parent.parentElement) {
            const parentBox = layoutBox(parent);
            if (parentBox.width > 0 && parentBox.height > 0 && !['inline','contents'].includes(parentBox.style.display)) {
              item.inlineParent = { element: parent, width: parentBox.width, height: parentBox.height }; break;
            }
          }
        } else {
          delete item.element.dataset.erosionFragment;
          item.element.style.removeProperty('--erosion-fragment-paint'); item.fragmentCache = undefined;
        }
      });
      const max = Math.max(0, document.documentElement.scrollHeight - height);
      const candidates = config.filter(c => c.enabled !== false).flatMap(c => {
        const el = document.querySelector<HTMLElement>(c.selector);
        let top = 0;
        // Layout coordinates are unaffected by the route entrance's temporary scale/translate.
        for (let parent = el; parent; parent = parent.offsetParent as HTMLElement | null) top += parent.offsetTop;
        return el && el.getBoundingClientRect().height > 0 ? [{ ...c, element: el, top }] : [];
      }).sort((a,b) => a.top - b.top);
      let previousTheme: ErosionTheme = 'black', previousEnd = -Infinity;
      chapters = [];
      for (const c of candidates) {
        if (c.toTheme === previousTheme) continue;
        const desiredStart = c.top - height * (c.start ?? 1.02);
        const startY = Math.max(0, desiredStart, previousEnd + height * .12);
        const endY = Math.min(max, Math.max(c.top - height * (c.end ?? .08), startY + height * .7));
        // Short content stays short. Do not compress a wipe into a tiny scroll movement.
        if (endY - startY < height * .55) continue;
        chapters.push({ ...c, fromTheme: c.fromTheme ?? previousTheme, startY, endY });
        previousEnd = endY; previousTheme = c.toTheme;
      }
      field!.setAttribute('viewBox', `0 0 ${width} ${height}`);
      root!.style.setProperty('--erosion-paint-size', `${width}px ${height}px`);
      field!.dataset.chapters = String(chapters.length);
      field!.dataset.ranges = JSON.stringify(chapters.map(c => ({ seed: c.seed, start: Math.round(c.startY), end: Math.round(c.endY), from: c.fromTheme, to: c.toTheme })));
      lastKey = '';
      queuePreflight();
    }
    function localPaint(item: Ink, rect: DOMRect, d: string, from: string, to: string, key: string) {
      const paintKey = `${key}:${from}:${to}:${rect.left}:${rect.top}:${rect.width}:${rect.height}`;
      if (item.paintCache?.key === paintKey) return item.paintCache.image;
      // Rasterize only the letters crossing the frontier, at their local size.
      // No inherited full-viewport bitmap changes across the entire document.
      const image = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}" viewBox="${rect.left} ${rect.top} ${rect.width} ${rect.height}" preserveAspectRatio="none"><path fill="${from}" d="M${rect.left} ${rect.top}h${rect.width}v${rect.height}h${-rect.width}Z"/><path fill="${to}" fill-rule="evenodd" d="${d}"/></svg>`;
      const value = `url("data:image/svg+xml,${encodeURIComponent(image)}")`;
      item.paintCache = { key: paintKey, image: value };
      return value;
    }
    function style(element: HTMLElement, property: string, value: string) {
      if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
    }
    function fragmentedPaint(item: Ink, fragments: DOMRect[], parentRect: DOMRect | undefined, d: string, from: string, to: string, contourKey: string) {
      const safeScale = (scale: number) => Number.isFinite(scale) && scale > .05 ? scale : 1;
      const sx = safeScale(parentRect && item.inlineParent ? parentRect.width / item.inlineParent.width : 1);
      const sy = safeScale(parentRect && item.inlineParent ? parentRect.height / item.inlineParent.height : 1);
      const key = [contourKey, from, to, sx, sy, item.inlineRtl, ...fragments.flatMap(rect => [rect.left, rect.top, rect.width, rect.height])].join(':');
      if (item.fragmentCache?.key === key) return item.fragmentCache;
      const stripWidth = fragments.reduce((sum, rect) => sum + rect.width / sx, 0);
      const stripHeight = Math.max(...fragments.map(rect => rect.height / sy));
      let cursor = item.inlineRtl ? stripWidth : 0;
      // CSS slice lays inline decoration out as one unbroken strip, then cuts it
      // at line breaks. Each strip segment samples its actual viewport rectangle.
      const windows = fragments.map(rect => {
        const localWidth = rect.width / sx, localHeight = rect.height / sy;
        if (item.inlineRtl) cursor -= localWidth;
        const window = `<svg x="${cursor}" y="0" width="${localWidth}" height="${localHeight}" viewBox="${rect.left} ${rect.top} ${rect.width} ${rect.height}" preserveAspectRatio="none" overflow="hidden"><use href="#field"/></svg>`;
        if (!item.inlineRtl) cursor += localWidth;
        return window;
      }).join('');
      const image = `<svg xmlns="http://www.w3.org/2000/svg" width="${stripWidth}" height="${stripHeight}" viewBox="0 0 ${stripWidth} ${stripHeight}"><defs><g id="field"><path fill="${from}" d="M0 0H${width}V${height}H0Z"/><path fill="${to}" fill-rule="evenodd" d="${d}"/></g></defs>${windows}</svg>`;
      item.fragmentCache = { key, image: `url("data:image/svg+xml,${encodeURIComponent(image)}")`, width: stripWidth, height: stripHeight };
      return item.fragmentCache;
    }
    function draw(now = performance.now()) {
      frame = 0;
      if (disposed || document.hidden || playingFilm) return;
      if (!cadence.ready(now)) { schedule(); return; }
      const y = scrollY;
      let current: MeasuredChapter | undefined;
      let settled: ErosionTheme = 'black';
      for (const chapter of chapters) {
        if (y >= chapter.endY) settled = chapter.toTheme;
        else if (y >= chapter.startY) { current = chapter; break; }
        else break;
      }
      const progress = current ? clamp((y - current.startY) / (current.endY - current.startY)) : 1;
      const from = palettes[current?.fromTheme ?? settled], to = palettes[current?.toTheme ?? settled];
      const straightY = current ? Math.max(0, Math.min(height, current.top - y)) : 0;
      const key = `${current?.seed ?? settled}:${progress}:${width}:${height}:${reducedMotion}`;
      queuePreflight();
      if (!current && key === lastKey) return;
      if (key !== contourKey) {
        contourCache = current && !reducedMotion ? buildErosionContour({ width, height, progress, seed: current.seed, direction: current.direction, macroAmplitude: current.macroAmplitude, detailAmount: current.detailAmount, edgeSoftness: current.edgeSoftness }) : null;
        if (contourCache && current && progress > 0 && progress < 1) rememberPrepared(materialKey(current));
        contourKey = key;
      }
      const contour = contourCache;
      const d = contour?.path ?? (current && reducedMotion ? `M0 ${straightY}H${width}V${height}H0Z` : `M0 0H${width}V${height}H0Z`);
      const at = (x: number, pointY: number) => (contour ? contour.incomingAt(x, pointY) : pointY >= straightY) ? to : from;
      // Batch geometry reads before style writes. Offscreen copy receives paint on entry.
      const visibleInk = Array.from(visibleInks).flatMap(item => {
        if (!item.element.isConnected) return [];
        const rect = item.element.getBoundingClientRect();
        if (rect.bottom < -60 || rect.top > height + 60 || !rect.width) return [];
        // Read every wrapped-line rectangle before changing any paint style.
        const region = !current ? 'to' : contour ? contour.classifyRect(rect.left - 1, rect.top - 1, rect.right + 1, rect.bottom + 1) : rect.bottom < straightY ? 'from' : rect.top > straightY ? 'to' : 'mixed';
        const fragments = region === 'mixed' && item.fragmented ? Array.from(item.element.getClientRects()).filter(fragment => fragment.width > 0 && fragment.height > 0) : [];
        const parentRect = region === 'mixed' ? item.inlineParent?.element.getBoundingClientRect() : undefined;
        return [{ ...item, item, rect, fragments, parentRect, region }];
      });
      const visibleRules = rules.map(element => ({ element, rect: element.getBoundingClientRect() })).filter(({rect}) => rect.bottom >= 0 && rect.top <= height);
      if (key !== lastKey) {
        base.current!.setAttribute('fill', from.surface);
        reveal.current!.setAttribute('fill', to.surface);
        reveal.current!.setAttribute('d', d);
        (['ink','muted','accent'] as const).forEach(role => style(root!, `--erosion-${role}-solid`, to[role]));
        const paintState = current ? 'split' : 'solid';
        if (root!.dataset.erosionPaint !== paintState) root!.dataset.erosionPaint = paintState;
        style(root!, '--erosion-line-solid', to.line);
        const theme = current?.toTheme ?? settled, active = current ? 'true' : 'false';
        if (doc.dataset.erosionTheme !== theme) doc.dataset.erosionTheme = theme;
        if (doc.dataset.erosionActive !== active) doc.dataset.erosionActive = active;
        field!.dataset.progress = progress.toFixed(4);
        field!.dataset.seed = current?.seed ?? 'settled';
        field!.dataset.from = current?.fromTheme ?? settled;
        field!.dataset.to = current?.toTheme ?? settled;
        lastKey = key;
      }
      let mixedCount = 0;
      visibleInk.forEach(({ item, element, rect, role, layoutWidth, layoutHeight, fragmented, fragments, parentRect, region }) => {
        if (region !== 'mixed') {
          if (element.hasAttribute('data-erosion-split')) {
            delete element.dataset.erosionSplit;
            element.style.removeProperty('--erosion-local-paint'); element.style.removeProperty('--erosion-fragment-paint');
            item.paintCache = undefined; item.fragmentCache = undefined;
          }
          style(element, '--erosion-current-ink', (region === 'from' ? from : to)[role]);
          return;
        }
        mixedCount++;
        if (!element.hasAttribute('data-erosion-split')) element.dataset.erosionSplit = '';
        // Compensate axis-aligned scale as well as translation, including inherited
        // route scale and the projected height of kinetic letters. No layout changes.
        const scaleX = !fragmented && layoutWidth > 0 ? rect.width / layoutWidth : 1;
        const scaleY = !fragmented && layoutHeight > 0 ? rect.height / layoutHeight : 1;
        const sx = Number.isFinite(scaleX) && scaleX > .05 ? scaleX : 1;
        const sy = Number.isFinite(scaleY) && scaleY > .05 ? scaleY : 1;
        if (current && fragmented && fragments.length > 1) {
          const strip = fragmentedPaint(item, fragments, parentRect, d, from[role], to[role], key);
          style(element, '--erosion-local-paint', strip.image);
          style(element, '--erosion-local-paint-size', `${strip.width}px ${strip.height}px`);
        } else {
          style(element, '--erosion-local-paint', localPaint(item, rect, d, from[role], to[role], key));
          style(element, '--erosion-local-paint-size', `${rect.width / sx}px ${rect.height / sy}px`);
        }
        // currentColor also gives icons, underlines, and focus decorations suitable contrast.
        style(element, '--erosion-current-ink', at(rect.left + rect.width / 2, rect.top + rect.height / 2)[role]);
      });
      field!.dataset.mixedInks = String(mixedCount);
      visibleRules.forEach(({ element, rect }) => {
        style(element, '--erosion-rule', at(rect.left + rect.width / 2, rect.top).line);
        // These two small editorial icons have no text node to inherit paint from.
        if (element.matches('.empty-inline,.passport-counter')) style(element, '--erosion-icon', at(rect.left + 22, rect.top + 22).ink);
      });
      if (current && !reducedMotion && performance.now() < alignmentUntil) schedule();
    }

    // All setup and destruction is scoped to this effect; no global trigger kills.
    measure(); draw();
    doc.dataset.erosion = 'ready';
    context.add(() => { ScrollTrigger.create({ trigger: root, start: 0, end: () => Math.max(1, ScrollTrigger.maxScroll(window)), onUpdate: trackAlignment, onRefresh: refresh }); });
    const resize = new ResizeObserver(refresh);
    resize.observe(root);
    const mutation = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList')) { needsScan = true; refresh(); }
    });
    mutation.observe(root, { childList: true, subtree: true });
    const passage = document.querySelector('.page-passage');
    const passageObserver = new MutationObserver(() => { if (passage?.getAttribute('data-active') === 'false') refresh(); });
    if (passage) passageObserver.observe(passage, { attributes: true, attributeFilter: ['data-active'] });
    root.addEventListener('load', refresh, true);
    // Native scroll also handles hash restoration in the router's following RAF.
    window.addEventListener('scroll', trackAlignment, { passive: true });
    const alignmentEvents = ['pointerover','pointerout','focusin','focusout','transitionrun','animationstart'] as const;
    alignmentEvents.forEach(event => root.addEventListener(event, trackPresentation, { passive: true }));
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('monumental:portal-end', refresh);
    window.addEventListener('monumental:typography-settled', schedule);
    const visibility = () => {
      if (!document.hidden) refresh();
      else { cancelAnimationFrame(frame); frame = 0; cancelAnimationFrame(refreshFrame); refreshFrame = 0; alignmentUntil = 0; cancelPreflight(); }
    };
    const playback = (event: Event) => {
      playingFilm = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      if (playingFilm) { cancelAnimationFrame(frame); frame = 0; cancelAnimationFrame(refreshFrame); refreshFrame = 0; alignmentUntil = 0; cancelPreflight(); }
      else refresh();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('monumental:playback', playback);
    void document.fonts.ready.then(() => { if (!disposed) refresh(); });
    refresh();
    return () => {
      disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(refreshFrame);
      cancelPreflight();
      mutation.disconnect(); passageObserver.disconnect(); resize.disconnect(); inkObserver.disconnect(); context.revert();
      root.removeEventListener('load', refresh, true);
      window.removeEventListener('scroll', trackAlignment); window.removeEventListener('resize', refresh);
      alignmentEvents.forEach(event => root.removeEventListener(event, trackPresentation));
      window.removeEventListener('monumental:portal-end', refresh);
      window.removeEventListener('monumental:typography-settled', schedule);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('monumental:playback', playback);
      markedInk.forEach(el => { delete el.dataset.erosionInk; delete el.dataset.erosionFragment; delete el.dataset.erosionSplit; el.style.removeProperty('--erosion-ink-position'); el.style.removeProperty('--erosion-local-paint-size'); el.style.removeProperty('--erosion-current-ink'); el.style.removeProperty('--erosion-fragment-paint'); el.style.removeProperty('--erosion-local-paint'); });
      markedProtect.forEach(el => delete el.dataset.erosionProtect);
      markedCarriers.forEach(el => delete el.dataset.erosionCarrier);
      markedRule.forEach(el => { delete el.dataset.erosionRule; el.style.removeProperty('--erosion-rule'); el.style.removeProperty('--erosion-icon'); });
      ['--erosion-paint-size','--erosion-ink-paint','--erosion-muted-paint','--erosion-accent-paint','--erosion-ink-solid','--erosion-muted-solid','--erosion-accent-solid','--erosion-line-solid'].forEach(p => root.style.removeProperty(p));
      delete root.dataset.erosionPaint;
      delete doc.dataset.erosion; delete doc.dataset.erosionTheme; delete doc.dataset.erosionActive;
    };
  }, [path, reducedMotion]);
  return <svg ref={svg} className="erosion-field" aria-hidden="true" focusable="false" preserveAspectRatio="none"><rect ref={base} width="100%" height="100%"/><path ref={reveal} fillRule="evenodd"/></svg>;
}
