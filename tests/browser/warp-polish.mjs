// GPU + native-scroll/cursor review. This script never changes the live catalogue.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] || 'http://127.0.0.1:5184';
const out = process.env.WARP_OUTPUT || 'output/playwright/warp-polish';
await mkdir(out, { recursive: true });
const report = { base, checkedAt: new Date().toISOString(), checks: [], errors: [], observations: [] };
const check = (name, passed, detail) => { report.checks.push({ name, passed: !!passed, detail }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function instrument(context) {
  await context.addInitScript(() => {
    const sources = new WeakMap(), programs = new WeakMap(), locations = new WeakMap(), contexts = new Map();
    const pg = p => { if (!programs.has(p)) programs.set(p, { shaders: new Set(), source: '', breath: null, draws: 0 }); return programs.get(p); };
    const st = gl => { if (!contexts.has(gl)) contexts.set(gl, { canvas: gl.canvas, active: null, used: new Set() }); return contexts.get(gl); };
    for (const type of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
      const proto = window[type]?.prototype; if (!proto) continue;
      const wrap = (name, tap) => { const native = proto[name]; if (!native) return; proto[name] = function(...args) { const result = native.apply(this, args); tap(this, args, result); return result; }; };
      wrap('shaderSource', (_, [s, source]) => sources.set(s, source));
      wrap('attachShader', (_, [p, s]) => pg(p).shaders.add(s));
      wrap('linkProgram', (_, [p]) => { pg(p).source = [...pg(p).shaders].map(s => sources.get(s) || '').join('\n'); });
      wrap('useProgram', (gl, [p]) => { st(gl).active = p ? pg(p) : null; });
      wrap('getUniformLocation', (_, [p, name], location) => { if (location) locations.set(location, { program: pg(p), name }); });
      wrap('uniform1f', (_, [location, value]) => { const u = locations.get(location); if (u?.name === 'uBreathPhase') u.program.breath = value; });
      for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) wrap(name, gl => { const s = st(gl); if (s.active) { s.used.add(s.active); s.active.draws++; } });
    }
    window.__warpGPU = () => [...contexts.values()].filter(s => s.canvas.isConnected).flatMap(s => [...s.used].map(p => ({
      name: /#define SHADER_NAME ([^\n]+)/.exec(p.source)?.[1], breath: p.breath, draws: p.draws,
      scan: p.source.includes('scanCoordinate'), forbidden: /\b(?:uSection|scanCursor|scanStrength|vScanPosition)\b/.test(p.source),
    })));
  });
}
async function pageFor(context) {
  await instrument(context);
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (/WebGLProgram|shader error|VALIDATE_STATUS/.test(m.text())) report.errors.push(m.text()); });
  await page.goto(base + '/#/');
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const gpu = page => page.evaluate(() => window.__warpGPU());
const nativeProgress = page => page.evaluate(() => ({ y: scrollY, max: document.documentElement.scrollHeight - innerHeight, rail: document.querySelector('.scroll-rail')?.getAttribute('aria-valuenow'), visible: document.querySelector('.scroll-rail')?.getAttribute('data-visible') }));
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await pageFor(context);
  const sampleCursor = () => page.evaluate(() => {
    const node = document.querySelector('.signal-cursor'); const m = new DOMMatrix(getComputedStyle(node).transform);
    return { x: m.m41, y: m.m42, hidden: node.dataset.hidden, pressed: node.querySelector('.signal-cursor__reticle').dataset.pressed,
      native: getComputedStyle(document.body).cursor, trails: [...node.querySelectorAll('.signal-cursor__trail')].map(el => { const t = new DOMMatrix(getComputedStyle(el).transform); return { distance: Math.hypot(t.m41, t.m42), opacity: Number(getComputedStyle(el).opacity) }; }) };
  });
  if (!process.env.WARP_REMAINING) {
  await page.mouse.move(1110, 380); await page.waitForTimeout(300);
  const phaseA = await gpu(page); await shot(page, '01-opening-inhale');
  await page.waitForTimeout(4300);
  const phaseB = await gpu(page); await shot(page, '02-opening-exhale');
  const breathsA = phaseA.filter(p => p.breath !== null), breathsB = phaseB.filter(p => p.breath !== null);
  check('Both actual wall and streak shaders breathe while idle', breathsB.length === 2 && breathsA.length === 2 && breathsB.every((p, i) => Math.abs(p.breath - breathsA[i].breath) > .05), { phaseA: breathsA, phaseB: breathsB });
  check('Scan latitudes exist only in wall program and X-ray stays absent', phaseB.filter(p => p.scan).length === 1 && phaseB.every(p => !p.forbidden));
  await page.mouse.move(1000, 490); await page.waitForTimeout(80); const cursorBefore = await sampleCursor();
  await page.mouse.down(); await page.waitForTimeout(100); const cursorDown = await sampleCursor();
  await page.mouse.up(); await page.waitForTimeout(280); const cursorRest = await sampleCursor();
  check('Cursor anchor remains exact on click and hold', Math.abs(cursorBefore.x - 1000) < .1 && Math.abs(cursorBefore.y - 490) < .1 && cursorDown.x === cursorBefore.x && cursorDown.y === cursorBefore.y && cursorDown.pressed === 'true', { cursorBefore, cursorDown });
  check('Native pointer remains available; three trail marks settle', cursorRest.native !== 'none' && cursorRest.trails.length === 3 && cursorRest.trails.every(t => t.opacity === 0 && t.distance <= 36.1), cursorRest);
  await page.mouse.move(340, 520, { steps: 5 }); await page.mouse.move(420, 530, { steps: 3 });
  const cursorMoving = await sampleCursor();
  check('Trail stays bounded during pointer motion', cursorMoving.trails.every((t, i) => t.distance <= 12 + i * 12 + .1), cursorMoving);
  await shot(page, '03-cursor-motion');
  const rail = page.getByRole('scrollbar', { name: 'Page position' }); await rail.waitFor({ state: 'visible' });
  await rail.focus(); await page.keyboard.press('End'); await page.waitForTimeout(500);
  let progress = await nativeProgress(page);
  check('Rail End key reaches native document end', Math.abs(progress.y - progress.max) <= 2 && progress.rail === '100', progress);
  await page.keyboard.press('Home'); await page.waitForTimeout(450); progress = await nativeProgress(page);
  check('Rail Home key returns to zero', progress.y < 2 && progress.rail === '0', progress);
  await page.keyboard.press('PageDown'); await page.waitForTimeout(400); progress = await nativeProgress(page);
  check('Rail PageDown moves by a native viewport step', progress.y > 650 && progress.y < 900, progress);
  const bounds = await rail.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * .4); await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * .6, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(500); progress = await nativeProgress(page);
  check('Rail track and thumb drag set native progress', progress.y / progress.max > .55 && progress.y / progress.max < .66 && Math.abs(Number(progress.rail) - progress.y / progress.max * 100) < 1.1, progress);
  check('Cursor decoration yields to the scrollbar', (await sampleCursor()).hidden === 'true');
  await shot(page, '04-rail-active');
  await rail.focus(); await page.keyboard.press('Home'); await page.waitForTimeout(250);
  // Real command-dialog control proves decoration and scroll rail yield to overlays.
  await page.keyboard.press('Control+k'); await page.locator('dialog[open]').waitFor();
  const input = page.locator('dialog[open] input').first(); await input.hover(); await page.waitForTimeout(300);
  check('Native dialog field suppresses cursor and scroll rail', (await sampleCursor()).hidden === 'true' && (await nativeProgress(page)).visible === 'false');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check('Scroll rail returns after dialog closes', (await nativeProgress(page)).visible === 'true');
  }
  await page.evaluate(() => { location.hash = '#/search'; });
  await page.getByRole('textbox', { name: 'Search catalogue' }).waitFor();
  await page.getByRole('textbox', { name: 'Search catalogue' }).hover(); await page.waitForTimeout(250);
  check('Search fields keep their native pointer', (await sampleCursor()).hidden === 'true');
  await page.evaluate(() => { location.hash = '#/'; }); await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(700);
  check('Small layout keeps native scrollbar and complete content', await page.evaluate(() => !document.documentElement.dataset.scrollRail && getComputedStyle(document.querySelector('.scroll-rail')).display === 'none' && document.documentElement.scrollWidth <= innerWidth));
  await shot(page, '05-mobile-opening');
  await context.close();

  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const reducedPage = await pageFor(reduced); await reducedPage.waitForTimeout(800);
  const frozenA = (await gpu(reducedPage)).filter(p => p.breath !== null); await reducedPage.waitForTimeout(1400);
  const frozenB = (await gpu(reducedPage)).filter(p => p.breath !== null);
  check('Reduced motion freezes the actual breathing uniforms', frozenA.length === 2 && frozenB.length === 2 && frozenB.every((p, i) => p.breath === frozenA[i].breath), { frozenA, frozenB });
  check('Reduced motion omits decorative cursor', await reducedPage.locator('.signal-cursor').count() === 0);
  await shot(reducedPage, '06-reduced-motion'); await reduced.close();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touchPage = await pageFor(mobile); await touchPage.waitForTimeout(600);
  check('Touch has no cursor or custom scrollbar', await touchPage.evaluate(() => getComputedStyle(document.querySelector('.signal-cursor')).display === 'none' && getComputedStyle(document.querySelector('.scroll-rail')).display === 'none' && !document.documentElement.dataset.scrollRail));
  await touchPage.evaluate(() => scrollTo(0, 500)); await touchPage.waitForTimeout(200);
  check('Touch layout retains native document scrolling', await touchPage.evaluate(() => scrollY > 490));
  await mobile.close();
} catch (error) { report.checks.push({ name: 'Review completed', passed: false, detail: error.stack }); console.error(error); }
finally {
  check('No runtime or shader errors', report.errors.length === 0, report.errors);
  await browser.close();
  await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.checks.filter(c => c.passed).length, total: report.checks.length, errors: report.errors.length, out }));
  if (report.checks.some(c => !c.passed)) process.exitCode = 1;
}
