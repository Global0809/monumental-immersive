import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5184/';
const output = process.env.WORMHOLE_OUTPUT || 'output/playwright/passage-wormhole';
const recordVideo = process.env.WORMHOLE_VIDEO === '1';
const checks = [], errors = [], measurements = [], limitations = [];
const chapters = ['entrance', 'world', 'time-machine', 'movies', 'music', 'culture', 'my-world'];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const address = route => { const url = new URL(base); url.hash = route; return url.href; };
const canvas = page => page.locator('canvas.spatial-world-canvas');
const persistResults = () => writeFile(`${output}/results.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, errors, measurements, limitations }, null, 2));
process.once('SIGINT', async () => { await persistResults(); await browser.close(); process.exit(130); });

function check(name, passed, detail = '') {
  checks.push({ name, passed: !!passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  assert.ok(passed, `${name}: ${JSON.stringify(detail)}`);
}

async function instrument(context) {
  await context.addInitScript(() => {
    const draws = new WeakMap();
    for (const kind of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
      const prototype = window[kind]?.prototype;
      if (!prototype) continue;
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const original = prototype[method];
        if (!original) continue;
        prototype[method] = function (...args) {
          if (this.canvas?.classList?.contains('spatial-world-canvas')) draws.set(this.canvas, (draws.get(this.canvas) || 0) + 1);
          return original.apply(this, args);
        };
      }
    }
    window.__wormholeAudit = { draws: () => [...document.querySelectorAll('canvas.spatial-world-canvas')].reduce((sum, element) => sum + (draws.get(element) || 0), 0) };
  });
}

async function ready(page) {
  // A cold development shader compile can exceed ordinary interaction waits.
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
  await canvas(page).waitFor({ state: 'attached' });
  await page.waitForFunction(() => Number.isFinite(Number(document.querySelector('canvas.spatial-world-canvas')?.dataset.wormholeTime)) && !!document.querySelector('canvas.spatial-world-canvas')?.dataset.wormholeMode);
  await page.evaluate(() => document.fonts.ready);
}

async function state(page) {
  return page.evaluate(() => {
    const element = document.querySelector('canvas.spatial-world-canvas');
    const host = document.querySelector('[data-passage-chapter]');
    const camera = document.querySelector('.tunnel-css-world')?.firstElementChild?.firstElementChild;
    const activePanel = document.querySelector(`[data-tunnel-station="${host?.dataset.passageChapter}"]`);
    return {
      time: Number(element?.dataset.wormholeTime), energy: Number(element?.dataset.wormholeEnergy),
      mode: element?.dataset.wormholeMode, pointer: (element?.dataset.wormholePointer || '').split(',').map(Number),
      wormholeDraws: Number(element?.dataset.wormholeDraws), draws: window.__wormholeAudit.draws(),
      scrollY, camera: camera?.style.transform || '', chapter: host?.dataset.passageChapter,
      reading: host?.dataset.passageReading, panelTransform: activePanel?.style.transform || '',
      canvasCount: document.querySelectorAll('canvas.spatial-world-canvas').length,
      cssScenes: document.querySelectorAll('.tunnel-css-world').length,
      panels: document.querySelectorAll('[data-tunnel-station]').length,
    };
  });
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${output}/${name}.png` });
}

async function station(page, title, id) {
  await page.getByRole('button', { name: `Travel to ${title}`, exact: true }).click();
  await page.waitForFunction(id => {
    const host = document.querySelector('[data-passage-chapter]');
    const mount = document.querySelector(`[data-tunnel-station="${id}"]`);
    return host?.dataset.passageChapter === id && host.dataset.passageReading === 'true' && mount?.getAttribute('aria-hidden') === 'false' && !mount.inert;
  }, id);
  await page.waitForTimeout(550);
}

async function sampleFrames(page) {
  const sample = await page.evaluate(() => new Promise(resolve => {
    const intervals = []; let last = performance.now(), request = 0, done = false;
    const finish = () => {
      if (done) return; done = true; cancelAnimationFrame(request); clearTimeout(timeout);
      intervals.sort((a, b) => a - b);
      resolve({ count: intervals.length, medianMs: intervals[Math.floor(intervals.length * .5)] || 0, p95Ms: intervals[Math.floor(intervals.length * .95)] || 0 });
    };
    const timeout = setTimeout(finish, 7000);
    const tick = now => { intervals.push(now - last); last = now; if (intervals.length >= 120) finish(); else request = requestAnimationFrame(tick); };
    request = requestAnimationFrame(tick);
  }));
  measurements.push({ name: 'Desktop requestAnimationFrame cadence (headless, no fixed FPS assertion)', ...sample });
  console.log(`FRAME SAMPLE ${JSON.stringify(sample)}`);
  await persistResults();
  check('Desktop supplies a bounded browser frame sample', sample.count >= 20, sample);
}

async function scenario(name, options, run) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference',
    ...(recordVideo && name === 'desktop-flow' ? { recordVideo: { dir: `${output}/video`, size: { width: 1440, height: 900 } } } : {}),
    ...options,
  });
  await instrument(context);
  const page = await context.newPage(); page.setDefaultTimeout(12_000); page.setDefaultNavigationTimeout(20_000);
  page.on('pageerror', error => { errors.push({ scenario: name, message: error.message }); console.error(`BROWSER ERROR ${name}: ${error.message}`); });
  page.on('console', message => {
    if (/WebGLProgram|VALIDATE_STATUS|shader error|shader failed|GL_INVALID|GLSL|CONTEXT_LOST_WEBGL/i.test(message.text())) {
      errors.push({ scenario: name, message: message.text() }); console.error(`SHADER ERROR ${name}: ${message.text()}`);
    }
  });
  let timeout;
  try {
    await Promise.race([
      (async () => { await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page); await run(page); })(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`${name} exceeded the 65-second scenario budget`)), 65_000); }),
    ]);
  } catch (error) {
    checks.push({ name: `${name} completed`, passed: false, detail: error.stack });
    console.error(`FAIL ${name}: ${error.message}`);
    await screenshot(page, `failure-${name}`).catch(() => {});
  } finally {
    clearTimeout(timeout);
    const video = page.video();
    await context.close();
    if (video) measurements.push({ name: `${name} video`, path: await video.path() });
    await persistResults();
  }
}

try {
  await scenario('desktop-flow', {}, async page => {
    await page.mouse.move(720, 450);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
    await page.waitForTimeout(650);
    const first = await state(page); await screenshot(page, '01-opening-time-a');
    await page.waitForTimeout(1400);
    const second = await state(page); await screenshot(page, '02-opening-time-b');
    measurements.push({ name: 'Opening idle samples', first, second });
    check('Desktop wormhole advances while the user is idle', first.mode === 'flow' && second.time > first.time + .35, { first: first.time, second: second.time });
    check('Idle flow preserves native scroll and the journey camera', Math.abs(second.scrollY - first.scrollY) < 1 && first.camera !== '' && first.camera === second.camera && first.chapter === second.chapter, { first, second });
    check('Backdrop reports the bounded field and resolve draws in the existing Passage renderer', first.wormholeDraws === 2 && second.wormholeDraws === 2 && second.canvasCount === 1 && second.cssScenes === 1 && second.panels === 6, second);

    await page.mouse.move(1260, 500, { steps: 8 }); await page.waitForTimeout(450);
    const pointer = await state(page);
    check('Mouse input reaches the restrained wormhole drift', pointer.pointer.length === 2 && pointer.pointer.every(Number.isFinite) && Math.hypot(...pointer.pointer) > .15, pointer.pointer);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
    await page.waitForTimeout(180);
    check('Leaving the page resets wormhole pointer influence', (await state(page)).pointer.every(value => Math.abs(value) < .001));

    await station(page, 'The World', 'world');
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
    const worldA = await state(page); await screenshot(page, '03-world');
    await page.waitForTimeout(750); const worldB = await state(page);
    check('Reading holds retain stable camera and content while the backdrop flows', worldB.time > worldA.time && worldA.camera === worldB.camera && worldA.panelTransform === worldB.panelTransform && Math.abs(worldA.scrollY - worldB.scrollY) < 1, { worldA, worldB });
    await sampleFrames(page);

    await page.getByRole('button', { name: 'Inspect The World exhibit', exact: true }).click();
    await page.getByRole('button', { name: 'Close The World exhibit', exact: true }).waitFor();
    await page.waitForTimeout(200);
    const inspected = await state(page); await page.waitForTimeout(700);
    check('Exhibit inspection freezes wormhole time', (await state(page)).time === inspected.time, inspected.time);
    await page.keyboard.press('Escape');
    await page.waitForFunction(time => Number(document.querySelector('canvas.spatial-world-canvas')?.dataset.wormholeTime) > time + .15, inspected.time);
    check('Closing inspection resumes the flow', (await state(page)).time > inspected.time);

    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const hidden = await state(page); await page.waitForTimeout(650); const held = await state(page);
    check('Simulated hidden visibility freezes time and WebGL drawing', held.time === hidden.time && held.draws === hidden.draws, { hidden, held });
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(time => Number(document.querySelector('canvas.spatial-world-canvas')?.dataset.wormholeTime) > time + .1, held.time);
    const resumed = await state(page);
    check('Visibility resumes without a hidden-time jump', resumed.time > held.time && resumed.time - held.time < .5, { held: held.time, resumed: resumed.time });
    limitations.push('Hidden-tab coverage overrides document.hidden and dispatches visibilitychange; it does not claim a genuinely backgrounded operating-system tab.');

    const scrollStart = await state(page);
    await page.mouse.wheel(0, 6100); await page.waitForTimeout(250);
    const forward = await state(page);
    await page.mouse.wheel(0, -3600); await page.waitForTimeout(450);
    const reversed = await state(page);
    measurements.push({ name: 'Fast native scroll and reverse', scrollStart, forward, reversed });
    check('Fast forward and reverse retain finite flow and valid chapter selection', forward.scrollY > scrollStart.scrollY + 100 && reversed.scrollY < forward.scrollY - 100 && chapters.includes(forward.chapter) && chapters.includes(reversed.chapter) && [forward, reversed].every(value => Number.isFinite(value.time) && Number.isFinite(value.energy) && value.energy >= 0 && value.energy <= 1.001 && value.pointer.every(Number.isFinite)), { forward, reversed });
    await station(page, 'Music', 'music'); await screenshot(page, '04-music');

    const beforeAway = await state(page);
    await page.evaluate(() => { window.__wormholeOriginalCanvas = document.querySelector('canvas.spatial-world-canvas'); location.hash = '#/settings'; });
    await page.getByRole('heading', { name: /MAKE IT/i }).waitFor(); await page.waitForTimeout(650);
    const away = await state(page); await page.waitForTimeout(550); const awayHeld = await state(page);
    check('Leaving Passage releases its continuous render work', awayHeld.time === away.time && awayHeld.draws === away.draws, { away, awayHeld });
    await page.evaluate(() => { location.hash = '#/'; }); await ready(page); await page.waitForTimeout(300);
    const returned = await state(page);
    check('Returning retains one renderer and six chapter interfaces without duplicates', returned.canvasCount === 1 && returned.cssScenes === 1 && returned.panels === 6 && returned.wormholeDraws === 2, { beforeAway, returned });
    measurements.push({ name: 'Route resource lifecycle', persistentCanvasReused: await page.evaluate(() => window.__wormholeOriginalCanvas === document.querySelector('canvas.spatial-world-canvas')) });
    await page.waitForFunction(time => Number(document.querySelector('canvas.spatial-world-canvas')?.dataset.wormholeTime) > time + .1, returned.time);
    check('Returning to Passage resumes animation', (await state(page)).time > returned.time);
  });

  for (const [name, options] of [
    ['compact', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
    ['reduced', { reducedMotion: 'reduce' }],
  ]) {
    await scenario(name, options, async page => {
      await page.waitForTimeout(500); const first = await state(page);
      await page.waitForTimeout(850); const second = await state(page);
      check(`${name} presents a static wormhole`, first.mode === 'still' && second.mode === 'still' && first.time === second.time && second.pointer.every(value => value === 0), { first, second });
      check(`${name} retains usable content without overflow`, await page.getByRole('button', { name: 'ENTER THE WORLD', exact: true }).isVisible() && second.panels === 6 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), second);
      await screenshot(page, name === 'compact' ? '05-compact' : '06-reduced');
    });
  }
  check('No runtime or WebGL shader errors', errors.length === 0, errors);
} finally {
  await persistResults();
  await browser.close();
  console.log(`${checks.filter(value => value.passed).length} passed; ${checks.filter(value => !value.passed).length} failed.`);
  if (checks.some(value => !value.passed)) process.exitCode = 1;
}
