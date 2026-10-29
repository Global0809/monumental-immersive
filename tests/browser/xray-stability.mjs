// Local browser regression probe for pointer ownership and X-ray teardown.
// node tests/browser/xray-stability.mjs [baseline|final] [base] [all|passage|models|compact|reduced]
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const phase = process.argv[2] || 'final', base = process.argv[3] || 'http://127.0.0.1:5184', mode = process.argv[4] || 'all';
const output = `output/playwright/xray-stability/${phase}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const report = { phase, time: new Date().toISOString(), checks: [], observations: [], errors: [], captures: [], notes: ['Chrome desktop and emulated touch/reduced motion; no claim of physical-device performance. Actual WebGL uniforms are observed without changing application state.'] };
const check = (name, passed, detail) => report.checks.push({ name, passed: !!passed, detail });
const observe = (name, detail) => report.observations.push({ name, detail });
const wait = (page, ms = 450) => page.waitForTimeout(ms);
const route = async (page, path, selector) => { await page.evaluate(path => { location.hash = '#' + path; }, path); await page.locator(selector).first().waitFor(); await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await wait(page, 700); };
async function instrument(context) {
  await context.addInitScript(() => {
    const records = window.__xrayQA = [], contexts = new WeakMap(), names = new WeakMap();
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      const gl = get.apply(this, args);
      if (gl && /^(webgl2?|experimental-webgl)$/.test(String(args[0])) && !contexts.has(gl)) { const r = { canvas: this, uniforms: {}, changes: 0, draws: 0 }; records.push(r); contexts.set(gl, r); }
      return gl;
    };
    for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Type) continue;
      const getLocation = Type.prototype.getUniformLocation;
      Type.prototype.getUniformLocation = function(program, name) { const location = getLocation.call(this, program, name); if (location) names.set(location, name); return location; };
      for (const method of ['uniform1f', 'uniform2f', 'uniform2fv', 'uniform4f', 'uniform4fv']) {
        const native = Type.prototype[method];
        Type.prototype[method] = function(location, ...args) {
          const name = names.get(location), record = contexts.get(this);
          if (record && ['scanRadius', 'scanStrength', 'scanCursor', 'scanResolutionScale', 'uSection'].includes(name)) { record.uniforms[name] = args.length === 1 && typeof args[0] !== 'number' ? Array.from(args[0]) : args.length === 1 ? args[0] : args; record.changes++; }
          return native.call(this, location, ...args);
        };
      }
      for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const native = Type.prototype[method]; if (!native) continue; Type.prototype[method] = function(...args) { const record = contexts.get(this); if (record) record.draws++; return native.apply(this, args); }; }
    }
    localStorage.setItem('monumental.viewer.v1', JSON.stringify({ saved: ['miami-frequency', 'island-current'], savedPlaces: ['miami', 'puerto-rico'], journeys: [], history: {}, sound: false, reducedMotion: false }));
  });
}
async function state(page, selector) {
  return page.evaluate(selector => {
    const canvas = document.querySelector(selector), r = window.__xrayQA.find(item => item.canvas === canvas);
    return r ? { uniforms: r.uniforms, changes: r.changes, draws: r.draws, dataset: { ...canvas.dataset }, rect: canvas.getBoundingClientRect().toJSON(), pixelWidth: canvas.width, connected: canvas.isConnected } : null;
  }, selector);
}
async function center(page, locator, dx = 0, dy = 0) { const b = await locator.boundingBox(); if (!b) throw Error('No visible bounds'); const point = { x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 + dy }; await page.mouse.move(point.x, point.y); await wait(page); return point; }
async function capture(page, name) { await page.screenshot({ path: `${output}/${name}.png` }); report.captures.push(name); }
async function home(page) { await page.goto(base + '/#/'); await page.locator('.tunnel-journey[data-ready="true"]').waitFor(); await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage); await wait(page, 700); }
async function passageActive(page) { return await page.locator('[data-passage-cutaway]').getAttribute('data-passage-cutaway') === 'true'; }
async function mediaBounds(page) {
  await page.locator('.flight-media-mask[data-protected="true"]').waitFor();
  return page.locator('.flight-media-mask').evaluate(element => {
    const number = String.raw`[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?`;
    const match = element.style.clipPath.match(new RegExp(String.raw`Z\s*M\s*(${number})[\s,]+(${number})\s*H\s*(${number})\s*V\s*(${number})\s*H\s*(${number})\s*Z`));
    return match ? { left: Number(match[1]), top: Number(match[2]), right: Number(match[3]), bottom: Number(match[4]) } : null;
  });
}
function scanOn(value) { return Number(value?.uniforms.scanStrength ?? value?.uniforms.scanRadius ?? 0) > .001; }
function alignedScan(value, point) {
  if (!value || !scanOn(value)) return false;
  const ratio = 'scanResolutionScale' in value.uniforms ? 1 : value.pixelWidth / value.rect.width, cursor = value.uniforms.scanCursor;
  return cursor && Math.abs(cursor[0] - (point.x - value.rect.left) * ratio) < 2 && Math.abs(cursor[1] - (value.rect.bottom - point.y) * ratio) < 2;
}
async function scenario(name, options, work) {
  if (mode === 'all' && name === 'model-exit') return;
  if (mode !== 'all' && !mode.split(',').includes(name)) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options }); await instrument(context);
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push({ scenario: name, error: error.message }));
  page.on('console', msg => { if (/WebGLProgram|VALIDATE_STATUS|shader error|GL_INVALID/i.test(msg.text())) report.errors.push({ scenario: name, error: msg.text() }); });
  try { await work(page); } catch (e) { check(name + ' runner', false, e.stack); await capture(page, 'failure-' + name).catch(() => {}); }
  finally { await context.close(); }
}
try {
  await scenario('passage', {}, async page => {
    await home(page); const wallPoints = [{ x: 1220, y: 660 }, { x: 1290, y: 310 }, { x: 1150, y: 200 }, { x: 1110, y: 735 }];
    const hits = [];
    for (const p of wallPoints) { await page.mouse.move(p.x, p.y); await wait(page); if (await passageActive(page)) hits.push(p); }
    observe('Passage wall probes', { hits }); check('Passage reveal opens on real wall surfaces', hits.length >= 2);
    const wall = hits[0] || wallPoints[0]; await page.mouse.move(wall.x, wall.y); await wait(page); await capture(page, 'passage-wall');
    const swept = [];
    for (const p of wallPoints.concat(wallPoints.slice().reverse())) { await page.mouse.move(p.x, p.y); await wait(page, 45); swept.push(await state(page, 'canvas.spatial-world-canvas')); }
    observe('Fast sweep world-space section samples', swept.map(s => s?.uniforms.uSection));
    await page.mouse.move(wall.x, wall.y); await wait(page); await page.mouse.down(); await wait(page, 150);
    check('Press-and-hold suspends the Passage cutaway', !(await passageActive(page)));
    await page.mouse.move(wall.x - 110, wall.y - 40, { steps: 8 }); await wait(page, 150); check('Dragging does not reactivate the Passage cutaway', !(await passageActive(page))); await page.mouse.up();
    await center(page, page.locator('.tunnel-hero h1')); check('Opening typography owns its hit region', !(await passageActive(page)));
    await page.mouse.move(wall.x, wall.y); await wait(page); await page.mouse.wheel(0, 180); await wait(page, 700); observe('Stationary pointer after scroll', { active: await passageActive(page), scrollY: await page.evaluate(() => scrollY) });
    await page.getByRole('button', { name: 'Travel to The World', exact: true }).click(); await page.waitForFunction(() => document.querySelector('[data-passage-reading="true"]')?.dataset.passageChapter === 'world'); await wait(page, 650);
    const chapter = page.locator('[data-tunnel-station="world"]'); await center(page, chapter.locator('.tunnel-panel-copy p')); check('Chapter copy excludes the Passage reveal', !(await passageActive(page)));
    const bounds = await mediaBounds(page); check('Projected media has a finite protection region', bounds && Object.values(bounds).every(Number.isFinite), bounds);
    if (bounds) { for (const x of [(bounds.left + bounds.right) / 2, bounds.right - 8]) { await page.mouse.move(x, (bounds.top + bounds.bottom) / 2); await wait(page); check('Projected media point remains outside the cutaway: ' + Math.round(x), !(await passageActive(page))); } await capture(page, 'passage-media-edge'); }
    await page.getByRole('button', { name: 'Inspect The World exhibit', exact: true }).click(); await page.mouse.move(wall.x, wall.y); await wait(page); check('Inspection suspends the background cutaway', !(await passageActive(page))); await page.keyboard.press('Escape');
    await chapter.getByRole('button', { name: /^Play / }).click(); await page.locator('.ms-player-dialog:modal').waitFor(); await page.mouse.move(wall.x, wall.y); await wait(page); check('Full player suspends the Passage reveal', !(await passageActive(page))); await page.keyboard.press('Escape');
    await route(page, '/world', '.cultural-atlas__viewport canvas'); check('Leaving Passage clears its cutaway', !(await passageActive(page)));
  });
  await scenario('models', {}, async page => {
    await page.goto(base + '/#/world'); const atlas = page.locator('.cultural-atlas__viewport canvas'); await atlas.waitFor(); await wait(page, 1400);
    const p = await center(page, atlas, -95, 60); let active = await state(page, '.cultural-atlas__viewport canvas'); observe('Paused Atlas hover scan', active); check('Paused Atlas responds to local pointer hover', scanOn(active)); await capture(page, 'atlas-hover');
    await wait(page, 550); const rested = await state(page, '.cultural-atlas__viewport canvas'); await wait(page, 250); const settled = await state(page, '.cultural-atlas__viewport canvas'); check('Paused Atlas rests after its local reveal settles', rested.draws === settled.draws, { before: rested.draws, after: settled.draws });
    await page.mouse.down(); await page.mouse.move(p.x + 60, p.y - 25, { steps: 8 }); await wait(page); const dragging = await state(page, '.cultural-atlas__viewport canvas'); observe('Atlas held drag', dragging); check('Held globe drag suppresses the scan', !scanOn(dragging)); await page.mouse.up();
    await center(page, page.getByRole('button', { name: 'Zoom globe in', exact: true })); const control = await state(page, '.cultural-atlas__viewport canvas'); check('Globe controls clear the local scan', !scanOn(control));
    const scrollPoint = await center(page, atlas, -80, 60); await page.mouse.wheel(0, 120); await wait(page, 700); const scrolled = await state(page, '.cultural-atlas__viewport canvas'); observe('Atlas stationary-pointer scroll', scrolled); check('Stationary pointer remains aligned while the globe scrolls underneath', alignedScan(scrolled, scrollPoint), { scrolled, scrollPoint });
    await page.mouse.wheel(0, 450); await wait(page, 700); const leftByScroll = await state(page, '.cultural-atlas__viewport canvas'); check('Scrolling a paused globe away clears its old scan', !scanOn(leftByScroll)); await capture(page, 'atlas-scroll');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await wait(page); await page.getByRole('button', { name: 'Open Index', exact: true }).focus(); await center(page, atlas, -95, 60); await page.keyboard.press('Enter'); await page.locator('#monumental-index:modal').waitFor(); await wait(page);
    const covered = await state(page, '.cultural-atlas__viewport canvas'); observe('Atlas while menu open', covered); check('Keyboard-opened dialog clears a scan on a paused model', !scanOn(covered)); await page.keyboard.press('Escape');
    await page.locator('.city-entry-link').click(); await page.locator('.city-canvas canvas').waitFor(); await page.locator('.city-scene').scrollIntoViewIfNeeded(); await wait(page); await center(page, page.locator('.city-canvas canvas'), -70, 30); const city = await state(page, '.city-canvas canvas'); observe('City miniature pointer scan', city); check('City miniature receives the local scan', scanOn(city)); await capture(page, 'city-hover');
    await route(page, '/my-world', '.personal-monument'); await page.locator('.personal-monument__arrangement').getByRole('button', { name: 'Orbit', exact: true }).click(); await page.locator('.personal-monument__scene.is-ready').waitFor(); await page.locator('.personal-monument__scene').scrollIntoViewIfNeeded(); await wait(page);
    const sculpture = page.locator('.personal-monument__scene canvas'); await center(page, sculpture, -20, 0); const personal = await state(page, '.personal-monument__scene canvas'); observe('Paused personal sculpture hover', personal); check('Paused personal sculpture responds to local hover', scanOn(personal)); await capture(page, 'personal-hover');
    await page.mouse.move(1380, 780); await wait(page, 650); const outside = await state(page, '.personal-monument__scene canvas'); check('Leaving a paused model clears its scan', !scanOn(outside), outside);
    await route(page, '/category/movies', '.collection-theater'); await capture(page, 'category-no-stale-scan'); check('Route change keeps one live background renderer', await page.locator('canvas.spatial-world-canvas').count() <= 1);
  });
  await scenario('model-exit', {}, async page => {
    await page.goto(base + '/#/my-world'); await page.locator('.personal-monument__arrangement').getByRole('button', { name: 'Orbit', exact: true }).click(); await page.locator('.personal-monument__scene.is-ready').waitFor(); await page.locator('.personal-monument__scene').scrollIntoViewIfNeeded(); await wait(page);
    await center(page, page.locator('.personal-monument__scene canvas'), -20, 0); check('Paused model has a live scan before exit', scanOn(await state(page, '.personal-monument__scene canvas')));
    await page.mouse.move(1380, 780); await wait(page, 650); const outside = await state(page, '.personal-monument__scene canvas'); check('Leaving a paused model clears its scan', !scanOn(outside), outside); await capture(page, 'personal-exit');
  });
  for (const [name, options] of [['compact', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }], ['reduced', { reducedMotion: 'reduce' }]]) {
    await scenario(name, options, async page => { await home(page); await page.mouse.move(330, 570); await wait(page); check(name + ' omits automatic Passage cutaway', !(await passageActive(page))); check(name + ' preserves all six chapter interfaces', await page.locator('.tunnel-panel').count() === 6); await route(page, '/world', '.cultural-atlas__viewport canvas'); await center(page, page.locator('.cultural-atlas__viewport canvas')); const scan = await state(page, '.cultural-atlas__viewport canvas'); check(name + ' keeps model scan off', !scanOn(scan)); check(name + ' has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await capture(page, name + '-world'); });
  }
} finally {
  await browser.close(); await writeFile(`${output}/report-${mode}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ phase, checks: report.checks.length, failed: report.checks.filter(c => !c.passed), errors: report.errors, report: `${output}/report-${mode}.json` }, null, 2));
  if (phase !== 'baseline' && (report.checks.some(c => !c.passed) || report.errors.length)) process.exitCode = 1;
}
