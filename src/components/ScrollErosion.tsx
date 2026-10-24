import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { buildErosionContour } from '../services/erosionContour';
import { erosionChapters, erosionProtected, type ErosionChapter, type ErosionTheme } from '../services/erosionChapters';
import './scroll-erosion.css';

gsap.registerPlugin(ScrollTrigger);
type Palette = { surface: string; ink: string; muted: string; accent: string; line: string };
type MeasuredChapter = ErosionChapter & { element: HTMLElement; top: number; fromTheme: ErosionTheme; startY: number; endY: number };
type Ink = { element: HTMLElement; role: 'ink' | 'muted' | 'accent' };
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
      paper: { surface: token('--paper', '#e8e8e1'), ink, muted: '#444640', accent: '#a52c19', line: '#0b0c0b50' },
      warm: { surface: text, ink, muted: '#444640', accent: '#a52c19', line: '#0b0c0b50' },
      red: { surface: red, ink, muted: '#27211e', accent: ink, line: '#0b0c0b70' },
    };
    let width = innerWidth, height = innerHeight, chapters: MeasuredChapter[] = [];
    let inks: Ink[] = [], protectedNodes: HTMLElement[] = [], rules: HTMLElement[] = [];
    let frame = 0, refreshFrame = 0, disposed = false, needsScan = true, lastKey = '';
    let playingFilm = document.body.classList.contains('monumental-player-active');
    const markedInk = new Set<HTMLElement>(), markedProtect = new Set<HTMLElement>(), markedRule = new Set<HTMLElement>();
    const context = gsap.context(() => {}, root);
    const config = erosionChapters(path);

    function schedule() {
      if (!frame && !disposed && !document.hidden && !playingFilm) frame = requestAnimationFrame(draw);
    }
    function refresh() {
      if (disposed || refreshFrame || playingFilm || document.hidden) return;
      refreshFrame = requestAnimationFrame(() => { refreshFrame = 0; measure(); schedule(); });
    }
    function scan() {
      // Declarative opt-outs plus existing protected islands. Never mutate their children.
      protectedNodes = Array.from(root!.querySelectorAll<HTMLElement>(erosionProtected)).filter(el => !el.parentElement?.closest(erosionProtected));
      protectedNodes.forEach(el => { if (!el.hasAttribute('data-erosion-protect')) { el.dataset.erosionProtect = ''; markedProtect.add(el); } });
      inks = [];
      root!.querySelectorAll<HTMLElement>(paintSelector).forEach(el => {
        if (el.closest(erosionProtected) || !Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) return;
        // Classify once from the authored presentation, before adding our paint.
        const color = getComputedStyle(el).color;
        const rgb = color.match(/[\d.]+/g)?.map(Number) || [239,238,233];
        const role: Ink['role'] = el.dataset.erosionInk as Ink['role'] || (rgb[0] > rgb[1] * 1.45 ? 'accent' : rgb[0] < 200 && rgb[0] > 60 ? 'muted' : 'ink');
        el.dataset.erosionInk = role; markedInk.add(el); inks.push({ element: el, role });
      });
      rules = Array.from(root!.querySelectorAll<HTMLElement>('section,.results-line,.tab-row,.category-index>a,.film-meta,.notebook-entry,.world-stats'))
        .filter(el => !el.closest(erosionProtected));
      rules.forEach(el => { el.dataset.erosionRule = ''; markedRule.add(el); });
      needsScan = false;
    }
    function measure() {
      width = innerWidth; height = innerHeight;
      if (needsScan) scan();
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
    }
    function svgPaint(d: string, from: string, to: string) {
      const image = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path fill="${from}" d="M0 0H${width}V${height}H0Z"/><path fill="${to}" fill-rule="evenodd" d="${d}"/></svg>`;
      return `url("data:image/svg+xml,${encodeURIComponent(image)}")`;
    }
    function draw() {
      frame = 0;
      if (disposed || document.hidden || playingFilm) return;
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
      const contour = current && !reducedMotion ? buildErosionContour({ width, height, progress, seed: current.seed, direction: current.direction, macroAmplitude: current.macroAmplitude, detailAmount: current.detailAmount, edgeSoftness: current.edgeSoftness }) : null;
      const d = contour?.path ?? (current && reducedMotion ? `M0 ${straightY}H${width}V${height}H0Z` : `M0 0H${width}V${height}H0Z`);
      const at = (x: number, pointY: number) => (current?.direction === 'down' && !reducedMotion ? pointY <= (contour?.frontierAt(x) ?? straightY) : pointY >= (contour?.frontierAt(x) ?? straightY)) ? to : from;
      const key = `${current?.seed ?? settled}:${progress.toFixed(5)}:${width}:${height}:${reducedMotion}`;
      if (!current && key === lastKey) return;
      // Batch geometry reads before style writes. Offscreen copy receives paint on entry.
      const visibleInk = inks.flatMap(item => {
        if (!item.element.isConnected) return [];
        const rect = item.element.getBoundingClientRect();
        return rect.bottom >= -60 && rect.top <= height + 60 && rect.width ? [{ ...item, rect }] : [];
      });
      const visibleRules = rules.map(element => ({ element, rect: element.getBoundingClientRect() })).filter(({rect}) => rect.bottom >= 0 && rect.top <= height);
      if (key !== lastKey) {
        base.current!.setAttribute('fill', from.surface);
        reveal.current!.setAttribute('fill', to.surface);
        reveal.current!.setAttribute('d', d);
        (['ink','muted','accent'] as const).forEach(role => {
          root!.style.setProperty(`--erosion-${role}-solid`, to[role]);
          if (current) root!.style.setProperty(`--erosion-${role}-paint`, svgPaint(d, from[role], to[role]));
        });
        root!.dataset.erosionPaint = current ? 'split' : 'solid';
        root!.style.setProperty('--erosion-line-solid', to.line);
        doc.dataset.erosionTheme = current?.toTheme ?? settled;
        doc.dataset.erosionActive = current ? 'true' : 'false';
        field!.dataset.progress = progress.toFixed(4);
        field!.dataset.seed = current?.seed ?? 'settled';
        field!.dataset.from = current?.fromTheme ?? settled;
        field!.dataset.to = current?.toTheme ?? settled;
        lastKey = key;
      }
      visibleInk.forEach(({ element, rect, role }) => {
        element.style.setProperty('--erosion-ink-position', `${-rect.left}px ${-rect.top}px`);
        // currentColor also gives icons, underlines, and focus decorations suitable contrast.
        element.style.setProperty('--erosion-current-ink', at(rect.left + rect.width / 2, rect.top + rect.height / 2)[role]);
      });
      visibleRules.forEach(({ element, rect }) => element.style.setProperty('--erosion-rule', at(rect.left + rect.width / 2, rect.top).line));
    }

    // All setup and destruction is scoped to this effect; no global trigger kills.
    measure(); draw();
    doc.dataset.erosion = 'ready';
    context.add(() => { ScrollTrigger.create({ trigger: root, start: 0, end: () => Math.max(1, ScrollTrigger.maxScroll(window)), onUpdate: schedule, onRefresh: refresh }); });
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
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('monumental:portal-end', refresh);
    const visibility = () => { if (!document.hidden) refresh(); else { cancelAnimationFrame(frame); frame = 0; } };
    const playback = (event: Event) => {
      playingFilm = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      if (playingFilm) { cancelAnimationFrame(frame); frame = 0; cancelAnimationFrame(refreshFrame); refreshFrame = 0; }
      else refresh();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('monumental:playback', playback);
    void document.fonts.ready.then(() => { if (!disposed) refresh(); });
    refresh();
    return () => {
      disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(refreshFrame);
      mutation.disconnect(); passageObserver.disconnect(); resize.disconnect(); context.revert();
      root.removeEventListener('load', refresh, true);
      window.removeEventListener('scroll', schedule); window.removeEventListener('resize', refresh);
      window.removeEventListener('monumental:portal-end', refresh);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('monumental:playback', playback);
      markedInk.forEach(el => { delete el.dataset.erosionInk; el.style.removeProperty('--erosion-ink-position'); el.style.removeProperty('--erosion-current-ink'); });
      markedProtect.forEach(el => delete el.dataset.erosionProtect);
      markedRule.forEach(el => { delete el.dataset.erosionRule; el.style.removeProperty('--erosion-rule'); });
      ['--erosion-paint-size','--erosion-ink-paint','--erosion-muted-paint','--erosion-accent-paint','--erosion-ink-solid','--erosion-muted-solid','--erosion-accent-solid','--erosion-line-solid'].forEach(p => root.style.removeProperty(p));
      delete root.dataset.erosionPaint;
      delete doc.dataset.erosion; delete doc.dataset.erosionTheme; delete doc.dataset.erosionActive;
    };
  }, [path, reducedMotion]);
  return <svg ref={svg} className="erosion-field" aria-hidden="true" focusable="false" preserveAspectRatio="none"><rect ref={base} width="100%" height="100%"/><path ref={reveal} fillRule="evenodd"/></svg>;
}
