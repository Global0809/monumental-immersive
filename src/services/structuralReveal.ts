import { reactiveField as input } from './reactiveField';

// One viewport canvas reveals the real layout. No duplicated video or backdrop filter.
const mediaSelector = 'video,iframe,.motion-stage,.film-image,.film-instrument__preview,[data-xray="off"]';
const quietSelector = `${mediaSelector},input,textarea,select,[contenteditable="true"],dialog,[popover]:popover-open`;
const surfaceSelector = 'main h1,main h2,main h3,main h4,main .portal,main .category-index a,main .film-card,main .ex-era-frame,main .ex-location-photo,main .ex-destinations button,main .ex-connection-link,main .collider-orbit,main .collider-tokens button,main .city-location-list button,main .personal-monument__piece,main .world-stats>span,main .membership-grid>div,main .settings-list>div,main .journey-stop,main .journey-place-thread a,main .motion-index button,main .button,main .text-link';
type Surface = { element: HTMLElement; rect: DOMRect; pageY: number; heading: boolean; round: boolean };
type Letter = { text: string; left: number; pageY: number; width: number; height: number; font: string };

export function mountStructuralReveal(canvas: HTMLCanvasElement, reducedMotion: boolean) {
  input.reduced = reducedMotion;
  input.active = false;
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const ctx: CanvasRenderingContext2D = context;
  if (reducedMotion) { ctx.clearRect(0, 0, canvas.width, canvas.height); return () => {}; }
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const points = Array.from({ length: fine ? 42 : 20 }, (_, i) => ({ x: (i * 167.73 % 997) / 997, y: (i * 239.1 % 991) / 991, depth: .25 + i % 5 / 7 }));
  let width = innerWidth, height = innerHeight, frame = 0, last = 0, time = 0, disposed = false;
  let x = -1000, y = -1000, scan = 0, speed = 0, lastScroll = scrollY;
  let hidden = document.hidden, dirty = true, refresh = true, lastMeasure = -1000;
  let candidates: HTMLElement[] = [], surfaces: Surface[] = [], media: Element[] = [], letters: Letter[] = [];
  let heading: HTMLElement | null = null, pointerTarget: Element | null = null;
  let lastKind = '', lastMediaCount = -1, keyboard = false;

  function schedule() { if (!frame && !hidden && !input.blocked && !disposed) frame = requestAnimationFrame(draw); }
  function resize() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); dirty = true; schedule();
  }
  function allowed(element: Element | null) {
    return fine && !!element?.closest('main') && !element.closest(quietSelector) && !document.querySelector('dialog[open],[popover]:popover-open');
  }
  function move(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return;
    keyboard = false; input.x = event.clientX; input.y = event.clientY;
    pointerTarget = event.target as Element; input.active = allowed(pointerTarget); schedule();
  }
  function leave() { input.active = false; pointerTarget = null; schedule(); }
  function focus(event: FocusEvent) {
    const element = event.target as HTMLElement;
    if (!element.matches(':focus-visible') || !allowed(element)) return;
    const rect = element.getBoundingClientRect(); keyboard = true; pointerTarget = element;
    input.x = rect.left + rect.width / 2; input.y = rect.top + rect.height / 2; input.active = true; schedule();
  }
  function scroll() {
    input.velocity = Math.max(-40, Math.min(40, scrollY - lastScroll));
    lastScroll = scrollY; input.scroll = scrollY; dirty = true; schedule();
  }
  function visibility() {
    hidden = document.hidden;
    if (hidden) { cancelAnimationFrame(frame); frame = 0; input.active = false; }
    else schedule();
  }
  function playback(event: Event) {
    input.blocked = Boolean((event as CustomEvent<{ active: boolean }>).detail.active);
    if (input.blocked) { cancelAnimationFrame(frame); frame = 0; input.active = false; ctx.clearRect(0, 0, width, height); }
    else { dirty = true; schedule(); }
  }
  function readLetters(element: HTMLElement) {
    const result: Letter[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node: Node | null;
    while ((node = walker.nextNode()) && result.length < 110) {
      const parent = node.parentElement;
      if (!parent || parent.closest('[inert]')) continue;
      const style = getComputedStyle(parent);
      const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const text = node.textContent || '';
      for (let i = 0; i < text.length && result.length < 110; i++) {
        if (!text[i].trim()) continue;
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width && rect.height && rect.bottom > 0 && rect.top < height) result.push({ text: style.textTransform === 'uppercase' ? text[i].toUpperCase() : text[i], left: rect.left, pageY: rect.top + scrollY, width: rect.width, height: rect.height, font });
      }
    }
    return result;
  }
  function measure(now: number) {
    if (refresh) {
      candidates = Array.from(document.querySelectorAll<HTMLElement>(surfaceSelector));
      // The sculpture owns its depth-tested material reveal. Keep this 2D layer
      // outside its viewport so curved VideoTexture windows stay clear as well.
      media = Array.from(document.querySelectorAll(`${mediaSelector},.culture-sculpture__canvas`));
      refresh = false; dirty = true;
    }
    if (dirty && now - lastMeasure > 140) {
      surfaces = candidates.filter(element => element.isConnected && !element.closest('[inert],[aria-hidden="true"]')).map(element => {
        const rect = element.getBoundingClientRect();
        return { element, rect, pageY: rect.top + scrollY, heading: element.matches('h1,h2,h3,h4'), round: element.matches('.collider-orbit') };
      }).filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > -230 && rect.top < height + 230).slice(0, 70);
      dirty = false; lastMeasure = now;
      if (heading) letters = readLetters(heading);
    }
    const next = surfaces.find(surface => surface.heading && x > surface.rect.left - 80 && x < surface.rect.right + 80 && y > surface.pageY - scrollY - 60 && y < surface.pageY - scrollY + surface.rect.height + 60)?.element || null;
    if (next !== heading) { heading = next; letters = next ? readLetters(next) : []; }
  }
  function drawSurface(surface: Surface, radius: number) {
    const r = surface.rect, top = surface.pageY - scrollY, bottom = top + r.height;
    if (r.right < x - radius || r.left > x + radius || bottom < y - radius || top > y + radius) return;
    ctx.lineWidth = .8;
    ctx.strokeStyle = `rgba(255,119,91,${.56 * scan})`;
    if (surface.round) {
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath(); ctx.ellipse(r.left + r.width / 2, top + r.height / 2, Math.max(1, r.width / 2 - 9 - ring * 9), Math.max(1, r.height / 2 - 9 - ring * 9), 0, 0, Math.PI * 2); ctx.stroke();
      }
      return;
    }
    // Registration corners reveal the actual boundary without crossing the copy.
    const corner = Math.min(19, r.width / 5, r.height / 4);
    [[r.left, top, 1, 1], [r.right, top, -1, 1], [r.left, bottom, 1, -1], [r.right, bottom, -1, -1]].forEach(([cx, cy, dx, dy]) => {
      ctx.beginPath(); ctx.moveTo(cx + corner * dx, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + corner * dy); ctx.stroke();
    });
    ctx.strokeStyle = `rgba(239,238,233,${.2 * scan})`;
    ctx.beginPath(); ctx.moveTo(r.left + corner, bottom); ctx.lineTo(r.right - corner, bottom); ctx.stroke();
    if (!surface.heading && r.width > 150 && r.height > 90) {
      const depth = 9;
      ctx.strokeStyle = `rgba(255,77,50,${.24 * scan})`;
      ctx.strokeRect(r.left + depth, top - depth, r.width, r.height);
      [[r.left, top], [r.right, top], [r.right, bottom], [r.left, bottom]].forEach(([cx, cy]) => {
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + depth, cy - depth); ctx.stroke();
      });
    }
  }
  function draw(now: number) {
    frame = 0;
    if (hidden || input.blocked || disposed) return;
    const interval = fine && (input.active || scan > .02) ? 1000 / 40 : 1000 / 20;
    if (now - last < interval) { schedule(); return; }
    const dt = Math.min(.06, (now - last) / 1000 || .025); last = now; time += dt;
    if (!keyboard && pointerTarget) { pointerTarget = document.elementFromPoint(input.x, input.y); input.active = allowed(pointerTarget); }
    const forbidden = !!document.querySelector('dialog[open],[popover]:popover-open');
    if (forbidden) input.active = false;
    x += (input.x - x) * .34; y += (input.y - y) * .34;
    scan += ((input.active ? 1 : 0) - scan) * .22;
    speed += (input.velocity - speed) * .12; input.velocity *= .86;
    measure(now);
    // Read media bounds before canvas writes, including transforms during transitions.
    const holes = media.filter(element => element.isConnected && !element.closest('[inert]') && element.checkVisibility()).map(element => element.getBoundingClientRect()).filter(r => r.width && r.height && r.bottom > 0 && r.top < height);
    const kind = forbidden ? 'paused' : !input.active ? 'ambient' : heading ? 'typography' : pointerTarget?.closest('.city-scene,.personal-monument__scene,.culture-sculpture,.cultural-atlas__viewport') ? 'material' : 'structure';
    if (kind !== lastKind) { canvas.dataset.reveal = kind; lastKind = kind; }
    if (holes.length !== lastMediaCount) { canvas.dataset.mediaExclusions = String(holes.length); lastMediaCount = holes.length; }
    ctx.clearRect(0, 0, width, height);
    if (forbidden) { schedule(); return; }
    // A low density field across every route, repelled by the visitor's signal.
    points.forEach((point, i) => {
      let px = point.x * width + Math.sin(time * .15 + i) * 12;
      let py = ((point.y * height - input.scroll * .045 * point.depth + time * 3 * point.depth) % height + height) % height;
      const dx = px - x, dy = py - y, distance = Math.hypot(dx, dy);
      if (input.active && distance < 220) { const force = (1 - distance / 220) * 30; px += dx / (distance || 1) * force; py += dy / (distance || 1) * force; }
      ctx.fillStyle = i % 6 === 0 ? 'rgba(255,93,60,.29)' : 'rgba(228,231,218,.13)';
      ctx.fillRect(px, py, point.depth * 1.6, point.depth * 1.6);
    });
    if (scan > .015 && fine) {
      const radius = keyboard ? 165 : 218 + Math.min(18, Math.abs(speed));
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
      const glow = ctx.createRadialGradient(x, y, 8, x, y, radius);
      glow.addColorStop(0, `rgba(255,77,50,${.045 * scan})`); glow.addColorStop(1, 'rgba(255,77,50,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      // The ground plane unrolls into continuous contour bands; no generic screen grid.
      for (let row = -7; row <= 7; row++) {
        ctx.beginPath();
        for (let col = -12; col <= 12; col++) {
          const px = x + col * 20, distance = Math.abs(col) / 12;
          const py = y + row * 24 + Math.sin(col * .22 + row * .11 + input.scroll * .001 + time * .22) * (15 + Math.abs(row) * 2) + speed * .15;
          col === -12 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          if (col % 4 === 0 && row % 3 === 0 && distance < .8) { ctx.fillStyle = `rgba(239,238,233,${.3 * scan})`; ctx.fillRect(px - 1, py - 1, 2, 2); }
        }
        ctx.strokeStyle = `rgba(255,102,75,${.19 * scan * (1 - Math.abs(row) / 9)})`; ctx.lineWidth = .8; ctx.stroke();
      }
      surfaces.forEach(surface => drawSurface(surface, radius));
      // Use the real font and glyph bounds: outlines follow the editorial typography.
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = .85;
      letters.forEach(letter => {
        const top = letter.pageY - scrollY;
        if (letter.left > x + radius || letter.left + letter.width < x - radius || top > y + radius || top + letter.height < y - radius) return;
        ctx.font = letter.font; ctx.strokeStyle = `rgba(255,123,99,${.6 * scan})`;
        ctx.strokeText(letter.text, letter.left + letter.width / 2, top + letter.height / 2);
      });
      ctx.restore();
      // Feather the reveal itself rather than filtering everything underneath it.
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      const feather = ctx.createRadialGradient(x, y, radius * .52, x, y, radius);
      feather.addColorStop(0, 'rgba(0,0,0,0)'); feather.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = feather; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    }
    // Clear after all drawing: even a neighbouring lens cannot spill onto a film.
    holes.forEach(r => ctx.clearRect(r.left - 5, r.top - 5, r.width + 10, r.height + 10));
    schedule();
  }
  const mutation = new MutationObserver(() => { refresh = true; dirty = true; schedule(); });
  mutation.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
  const observer = new ResizeObserver(() => { dirty = true; schedule(); });
  const main = document.querySelector('main'); if (main) observer.observe(main);
  document.fonts.ready.then(() => { if (!disposed) { dirty = true; heading = null; schedule(); } });
  resize();
  window.addEventListener('resize', resize); window.addEventListener('scroll', scroll, { passive: true });
  document.addEventListener('pointermove', move, { passive: true }); document.addEventListener('pointerleave', leave);
  document.addEventListener('focusin', focus); document.addEventListener('visibilitychange', visibility); window.addEventListener('monumental:playback', playback);
  return () => {
    disposed = true; cancelAnimationFrame(frame); mutation.disconnect(); observer.disconnect();
    window.removeEventListener('resize', resize); window.removeEventListener('scroll', scroll);
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave);
    document.removeEventListener('focusin', focus); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('monumental:playback', playback);
    input.active = false; ctx.clearRect(0, 0, width, height);
  };
}
