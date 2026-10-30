// Bounded real-browser review of the shared cinematic rendering upgrade.
// node tests/browser/cinematic-world.mjs [base] [all|desktop|remaining|finish|quality|compact|reduced|fallback]
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://127.0.0.1:5184').replace(/\/$/, '');
const mode = process.argv[3] || 'all', out = 'output/playwright/cinematic-world';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const report = { checkedAt: new Date().toISOString(), base, checks: [], captures: [], measurements: [], errors: [], notes: [
  'Real Chrome/WebGL with mobile viewport and touch emulation. These checks do not establish physical-device frame rates.',
  'GPU resource counts are instrumented WebGL allocations, not graphics-driver memory measurements.',
] };
const check = (name, result, detail) => { assert.ok(result, name + (detail ? ': ' + JSON.stringify(detail) : '')); report.checks.push({ name, passed: true, detail }); };
const wait = (page, ms = 500) => page.waitForTimeout(ms);
const address = route => base + '/#' + route;

async function instrument(context) {
  await context.addInitScript(() => {
    const probe = window.__cinematicQA = { contexts: [], sampling: false, rafTimes: [] };
    const contexts = new WeakMap(); let rafTime = null;
    const nativeRAF = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => nativeRAF(time => {
      const old = rafTime; rafTime = time;
      if (probe.sampling && probe.rafTimes.at(-1) !== time) probe.rafTimes.push(time);
      try { return callback(time); } finally { rafTime = old; }
    });
    const nativeContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      const gl = nativeContext.apply(this, args);
      if (gl && /^(webgl2?|experimental-webgl)$/.test(String(args[0])) && !contexts.has(gl)) {
        const item = { canvas: this, gl, frames: [], draws: 0, textures: new Set(), framebuffers: new Set(), lost: false };
        this.addEventListener('webglcontextlost', () => { item.lost = true; });
        contexts.set(gl, item); probe.contexts.push(item);
      }
      return gl;
    };
    for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Type) continue;
      for (const [kind, plural] of [['Texture', 'textures'], ['Framebuffer', 'framebuffers']]) {
        const create = Type.prototype['create' + kind], remove = Type.prototype['delete' + kind];
        Type.prototype['create' + kind] = function(...args) { const resource = create.apply(this, args); contexts.get(this)?.[plural].add(resource); return resource; };
        Type.prototype['delete' + kind] = function(resource) { contexts.get(this)?.[plural].delete(resource); return remove.call(this, resource); };
      }
      for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const draw = Type.prototype[name]; if (!draw) continue;
        Type.prototype[name] = function(...args) {
          const item = contexts.get(this);
          if (item && probe.sampling) { item.draws++; if (rafTime !== null && item.frames.at(-1) !== rafTime) item.frames.push(rafTime); }
          return draw.apply(this, args);
        };
      }
    }
    // Browser-local fixture exercises the personal renderer without pretending
    // that anonymous visitors already own a collection.
    localStorage.setItem('monumental.viewer.v1', JSON.stringify({ saved: ['miami-frequency', 'island-current'], savedPlaces: ['miami', 'puerto-rico'], journeys: [], history: {}, sound: false, reducedMotion: false }));
  });
}
async function readyHome(page, fallback = false) {
  await page.locator('.tunnel-journey').waitFor();
  await page.locator(fallback ? '.spatial-world--fallback' : '.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
  await page.evaluate(() => document.fonts.ready); await wait(page, 650);
}
async function route(page, path, selector = 'h1') {
  await page.evaluate(path => { location.hash = '#' + path; }, path);
  await page.locator(selector).first().waitFor(); await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await wait(page, 700);
}
async function station(page, index) {
  const labels = ['The World', 'Time Machine', 'The Cinema', 'Music', 'Culture', 'My World'];
  await page.getByRole('button', { name: 'Travel to ' + labels[index], exact: true }).click();
  await page.waitForFunction(index => {
    const ids = ['world', 'time-machine', 'movies', 'music', 'culture', 'my-world'];
    return document.querySelector('[data-passage-chapter]')?.getAttribute('data-passage-chapter') === ids[index] && document.querySelector('[data-passage-reading]')?.getAttribute('data-passage-reading') === 'true';
  }, index); await wait(page, 750);
}
async function progress(page, index, amount) {
  await page.evaluate(({ index, amount }) => { const section = document.querySelectorAll('.tunnel-checkpoint')[index]; scrollTo({ top: section.getBoundingClientRect().top + scrollY + section.offsetHeight * amount, behavior: 'instant' }); }, { index, amount });
  await wait(page, 130);
}
async function resources(page) {
  return page.evaluate(() => window.__cinematicQA.contexts.map(item => ({ connected: item.canvas.isConnected, class: item.canvas.className, parent: item.canvas.parentElement?.className || '', textures: item.textures.size, framebuffers: item.framebuffers.size, liveTextures: [...item.textures].filter(value => value && item.gl.isTexture(value)).length, liveFramebuffers: [...item.framebuffers].filter(value => value && item.gl.isFramebuffer(value)).length, lost: item.lost, dataset: { ...item.canvas.dataset } })));
}
async function sample(page, name, ms = 850) {
  await page.evaluate(() => { const p = window.__cinematicQA; p.rafTimes.length = 0; p.contexts.forEach(item => { item.frames.length = 0; item.draws = 0; }); p.sampling = true; p.started = performance.now(); });
  await wait(page, ms);
  const value = await page.evaluate(() => {
    const p = window.__cinematicQA; p.sampling = false;
    return { elapsed: performance.now() - p.started, contexts: p.contexts.filter(item => item.canvas.isConnected).map(item => ({ class: item.canvas.className, parent: item.canvas.parentElement?.className || '', frames: item.frames.length, draws: item.draws, textures: item.textures.size, framebuffers: item.framebuffers.size, dataset: { ...item.canvas.dataset } })) };
  });
  report.measurements.push({ name, ...value }); return value;
}
async function capture(page, name) {
  const png = await page.screenshot({ path: `${out}/${name}.png` });
  const pixels = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vf', 'scale=96:60', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], { input: png, maxBuffer: 1024 * 1024 }).stdout;
  let dark = 0, bright = 0, light = 0;
  for (let i = 0; i < pixels.length; i += 3) { const l = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2]; light += l; dark += l < 40 ? 1 : 0; bright += l > 240 ? 1 : 0; }
  report.captures.push({ name, darkFraction: dark / (pixels.length / 3), clippedWhiteFraction: bright / (pixels.length / 3), averageLuminance: light / (pixels.length / 3) });
}
async function protectedDOM(page, selector) {
  return page.locator(selector).first().evaluate(el => {
    const bad = []; for (let node = el; node instanceof HTMLElement; node = node.parentElement) { const css = getComputedStyle(node); if (css.filter !== 'none') bad.push({ tag: node.tagName, class: node.className, filter: css.filter }); }
    const r = el.getBoundingClientRect(); return { bad, visible: r.width > 0 && r.height > 0 };
  });
}
async function scenario(name, options, work) {
  if (mode === 'all' && ['remaining', 'finish', 'quality'].includes(name)) return;
  if (mode !== 'all' && !mode.split(',').includes(name)) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options }); await instrument(context);
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push({ scenario: name, message: error.message }));
  page.on('console', message => { if (/WebGLProgram|VALIDATE_STATUS|shader error|shader failed|GL_INVALID|GLSL/i.test(message.text())) report.errors.push({ scenario: name, message: message.text() }); });
  try { await work(page, context); }
  catch (error) { report.checks.push({ name, passed: false, detail: error.stack }); await page.screenshot({ path: `${out}/failure-${name}.png` }).catch(() => {}); }
  finally { await context.close(); }
}

async function remainingDesktop(page, original) {
    const breath = [];
    for (let i = 0; i < 7; i++) { breath.push(Number(await page.locator('canvas.spatial-world-canvas').getAttribute('data-cinematic-breath'))); await wait(page, 300); }
    check('Shared light breath changes gently while the camera remains at rest', Math.max(...breath) - Math.min(...breath) > .002 && breath.every(value => value > .85 && value < 1.15), breath);
    await route(page, '/category/music', '.catalogue-feature'); await capture(page, 'music');
    check('Music preserves its featured media and working screening entrance', await page.locator('.catalogue-feature img').isVisible() && await page.getByRole('button', { name: 'Enter the screening room', exact: false }).isVisible());
    await page.getByRole('button', { name: 'Enter the screening room', exact: false }).click(); await page.locator('.collection-theater').waitFor(); await wait(page, 400);
    check('Music screening opens only when requested', await page.locator('.collection-theater').count() === 1);

    await route(page, '/my-world', '.personal-monument'); await page.locator('.personal-monument__arrangement').getByRole('button', { name: 'Orbit', exact: true }).click(); await page.locator('.personal-monument__scene').scrollIntoViewIfNeeded(); await page.locator('.personal-monument__scene.is-ready').waitFor(); await wait(page, 400); await capture(page, 'personal-monument'); await sample(page, 'personal-monument');
    check('Saved content still creates the personal monument', await page.locator('.personal-monument__piece').count() === 4 && await page.locator('.personal-monument__scene canvas').count() === 1);
    await route(page, '/motion', '#material-lab'); await page.getByRole('button', { name: 'Open working sculpture', exact: false }).click(); await page.locator('.kinetic-lab-canvas canvas').waitFor(); await page.locator('.kinetic-lab-canvas').scrollIntoViewIfNeeded(); await wait(page, 400);
    await capture(page, 'material-lab'); await sample(page, 'material-lab');
    await page.getByRole('button', { name: 'Turn sculpture right', exact: true }).click(); await page.getByRole('button', { name: 'Inspect topology', exact: true }).click();
    check('Material experiment controls retain their state', await page.getByRole('button', { name: 'Chrome surface', exact: true }).getAttribute('aria-pressed') === 'true');
    await page.getByRole('button', { name: 'Close experiment', exact: false }).click(); await wait(page, 350);
    check('Closing the lab releases its canvas', await page.locator('.kinetic-lab-canvas canvas').count() === 0);
    await finalDesktop(page, original);
}

async function finalDesktop(page, original) {
    await route(page, '/'); await readyHome(page); const returned = await resources(page);
    check('Route roundtrip retains one shared Passage and flight renderer', returned.filter(item => item.connected).length === original.filter(item => item.connected).length && await page.locator('canvas.spatial-world-canvas').count() === 1, { original, returned });
    check('Detached route scenes release their framebuffers', returned.filter(item => !item.connected).every(item => item.framebuffers === 0 || item.lost), returned.filter(item => !item.connected));
    await qualityChecks(page);
}

async function qualityChecks(page) {
    await route(page, '/settings', '[aria-label="Tunnel render quality"]');
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await route(page, '/'); await readyHome(page);
    check('Light quality uses the native renderer without cinematic passes', await page.locator('canvas.spatial-world-canvas').getAttribute('data-cinematic') === 'native');
    await route(page, '/settings', '[aria-label="Tunnel render quality"]');
    await page.getByRole('group', { name: 'Tunnel render quality' }).getByRole('button', { name: 'Balanced', exact: true }).click();
    await route(page, '/'); await readyHome(page);
    check('Returning to Balanced restores optics without a duplicate canvas', await page.locator('canvas.spatial-world-canvas').getAttribute('data-cinematic') === 'optics' && await page.locator('canvas.spatial-world-canvas').count() === 1);
}

try {
  await scenario('desktop', {}, async page => {
    await page.goto(address('/')); await readyHome(page); await capture(page, 'opening');
    check('Opening retains its headline and direct action', await page.locator('.tunnel-hero h1').getAttribute('aria-label') === 'CULTURE. WITHOUT BORDERS.' && await page.locator('.tunnel-entry-button').isVisible());
    const openingText = await protectedDOM(page, '.tunnel-hero h1'); check('Cinematic focus does not blur accessible opening text', !openingText.bad.length, openingText);
    check('Desktop Passage activates the bounded optical finish', await page.locator('canvas.spatial-world-canvas').getAttribute('data-cinematic') === 'optics');
    await sample(page, 'opening'); const original = await resources(page);
    await station(page, 1); await capture(page, 'passage-time');
    const title = page.locator('[data-tunnel-station="time-machine"] h2'), first = await title.boundingBox(); await wait(page, 1000); const second = await title.boundingBox();
    check('Breathing light does not move the settled reading composition', ['x', 'y', 'width', 'height'].every(key => Math.abs(first[key] - second[key]) < .8));
    const readingText = await protectedDOM(page, '[data-tunnel-station="time-machine"] h2'); check('Chapter copy remains unfiltered and readable', !readingText.bad.length, readingText);
    check('The actual film surface is excluded from bloom and focus', Number(await page.locator('canvas.spatial-world-canvas').getAttribute('data-cinematic-protected')) >= 1);
    await sample(page, 'passage-time');
    await progress(page, 1, .22); const pose = await page.locator('.tunnel-css-world > div > div').evaluate(el => el.style.transform); await progress(page, 1, .6); await progress(page, 1, .22);
    const reversed = await page.locator('.tunnel-css-world > div > div').evaluate(el => el.style.transform);
    check('Reverse native scroll reconstructs the same panel placement', pose === reversed, { pose, reversed });
    for (const i of [5, 0, 3, 1]) await station(page, i);
    check('Fast station jumps retain one camera and six chapter interfaces', await page.locator('canvas.spatial-world-canvas').count() === 1 && await page.locator('.tunnel-panel').count() === 6);
    await page.locator('[data-tunnel-station="time-machine"] .tunnel-story').click(); await page.locator('.ms-player-dialog:modal').waitFor(); await wait(page, 450);
    const playing = await sample(page, 'full-player');
    check('Full playback pauses the Passage and flight rendering', playing.contexts.filter(item => item.class === 'spatial-world-canvas' || item.class === 'flight-canvas').every(item => item.frames <= 1), playing.contexts);
    const playerStyle = await protectedDOM(page, '.ms-player-dialog video'); check('Film footage is not affected by page focus filters', !playerStyle.bad.length, playerStyle);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.ms-player-dialog:modal'));
    await wait(page, 500); await capture(page, 'autonomous-flight');
    check('Autonomous family keeps four models without a separate crew interface', await page.locator('.flight-environment .flight-canvas').count() === 1 && await page.locator('.flight-environment').getAttribute('data-drone-count') === '4' && await page.locator('.flight-dialog,.flight-invitation').count() === 0);

    await route(page, '/world', '.cultural-atlas__viewport canvas'); await capture(page, 'world'); await sample(page, 'world');
    check('Desktop globe receives the restrained optical finish', await page.locator('.cultural-atlas__viewport canvas').getAttribute('data-cinematic') === 'optics' && Number(await page.locator('.cultural-atlas__viewport canvas').getAttribute('data-cinematic-lens')) === 0);
    await page.getByRole('button', { name: 'Zoom globe in', exact: true }).click(); await page.getByRole('button', { name: 'Zoom globe out', exact: true }).click(); await wait(page, 700);
    check('Globe zoom remains reversible with a usable destination', await page.locator('.cultural-atlas__zoom span').textContent() === '1.00×' && await page.getByRole('button', { name: 'Explore Miami', exact: true }).first().isVisible());
    await page.locator('.city-entry-link').click(); await page.locator('.city-canvas canvas').waitFor(); await page.locator('.city-scene').scrollIntoViewIfNeeded(); await wait(page, 650); await capture(page, 'miami-miniature'); await sample(page, 'miami-miniature');
    check('Miniature remains a working scene with equivalent location buttons', await page.locator('.city-canvas canvas').count() === 1 && await page.locator('.city-location-list>button').count() === 3);
    await route(page, '/time-machine'); await capture(page, 'time-machine'); await sample(page, 'time-machine');
    check('Time Machine keeps its editorial content and native scrolling', await page.locator('h1').first().isVisible() && await page.evaluate(() => document.documentElement.scrollHeight > innerHeight));
    await route(page, '/category/movies', '.collection-theater'); await capture(page, 'cinema');
    const poster = await protectedDOM(page, '.ct-screen-image'); check('Category poster retains its original colours without a global filter', !poster.bad.length, poster);
    await page.getByRole('button', { name: 'Next featured story', exact: true }).click(); await wait(page, 350);
    check('Spatial story selection remains interactive', await page.locator('.ct-filmstrip [aria-pressed="true"]').count() === 1);
    await remainingDesktop(page, original);
  });
  await scenario('remaining', {}, async page => {
    await page.goto(address('/')); await readyHome(page); const original = await resources(page);
    await remainingDesktop(page, original);
  });
  await scenario('finish', {}, async page => {
    await page.goto(address('/')); await readyHome(page); const original = await resources(page);
    await route(page, '/motion', '#material-lab'); await page.getByRole('button', { name: 'Open working sculpture', exact: false }).click(); await page.locator('.kinetic-lab-canvas canvas').waitFor(); await wait(page, 400);
    await page.getByRole('button', { name: 'Close experiment', exact: false }).click(); await wait(page, 350);
    await finalDesktop(page, original);
  });
  await scenario('quality', {}, async page => {
    await page.goto(address('/')); await readyHome(page); await qualityChecks(page);
  });
  await scenario('compact', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async page => {
    await page.goto(address('/')); await readyHome(page); await capture(page, 'mobile-opening');
    check('Phone uses compact layout without horizontal overflow', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true' && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await sample(page, 'mobile-opening'); await route(page, '/world', '.cultural-atlas__viewport canvas'); await capture(page, 'mobile-world'); await sample(page, 'mobile-world');
    check('Compact globe avoids postprocessing framebuffers', await page.locator('.cultural-atlas__viewport canvas').getAttribute('data-cinematic') === 'native');
    check('Mobile globe remains one responsive canvas', await page.locator('.cultural-atlas__viewport canvas').count() === 1 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.setViewportSize({ width: 844, height: 390 }); await wait(page, 500);
    check('Landscape resize keeps usable content and viewport width', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) && await page.locator('.cultural-atlas__viewport canvas').count() === 1);
  });
  await scenario('reduced', { reducedMotion: 'reduce' }, async page => {
    await page.goto(address('/')); await readyHome(page); await wait(page, 1000); const reduced = await sample(page, 'reduced-opening'); await capture(page, 'reduced-opening');
    check('Reduced motion rests the scene instead of continuing light animation', reduced.contexts.filter(item => item.class === 'spatial-world-canvas' || item.class === 'flight-canvas').every(item => item.frames <= 1), reduced.contexts);
    check('Reduced motion preserves readable stationary chapter content', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true' && await page.locator('.tunnel-panel').count() === 6);
    check('Reduced motion keeps the Passage on native rendering', await page.locator('canvas.spatial-world-canvas').getAttribute('data-cinematic') === 'native');
    await route(page, '/world', '.cultural-atlas__viewport canvas'); await wait(page, 800); await sample(page, 'reduced-world'); await capture(page, 'reduced-world');
  });
  await scenario('fallback', {}, async page => {
    await page.goto(address('/')); await readyHome(page);
    await page.evaluate(() => window.__cinematicQA.contexts.find(item => item.canvas.className === 'spatial-world-canvas')?.gl.getExtension('WEBGL_lose_context')?.loseContext());
    await page.locator('.spatial-world--fallback').waitFor(); await wait(page, 400);
    check('Context loss preserves six accessible chapter interfaces', await page.locator('.tunnel-panel').count() === 6 && await page.locator('.tunnel-entry-button').isVisible());
    await capture(page, 'context-loss-fallback');
  });
  check('No uncaught application or shader errors', report.errors.length === 0, report.errors);
} finally {
  await browser.close(); await writeFile(`${out}/report-${mode}.json`, JSON.stringify(report, null, 2));
  const failures = report.checks.filter(item => !item.passed);
  console.log(JSON.stringify({ passed: !failures.length && !report.errors.length, checks: report.checks.length, failures, errors: report.errors, report: `${out}/report-${mode}.json` }, null, 2));
  if (failures.length || report.errors.length) process.exitCode = 1;
}
