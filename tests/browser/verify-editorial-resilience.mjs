import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.SITE_URL || 'http://127.0.0.1:5176/';
const output = 'test-results/editorial-resilience';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const results = [], errors = [];
function url(route) { const result = new URL(base); result.hash = route; return result.href; }
function check(name, condition, detail = '') { assert.ok(condition, `${name}: ${detail}`); results.push({ name, passed: true, detail }); console.log('PASS ' + name); }
async function run(name, task) { try { await task(); } catch (error) { results.push({ name, passed: false, detail: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); process.exitCode = 1; } }
async function settled(page) {
  await page.locator('main h1').first().waitFor();
  await page.waitForFunction(() => {
    const stage = document.querySelector('.route-stage');
    return !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert && (!stage || Number(getComputedStyle(stage).opacity) > .98);
  });
}
async function goto(page, route) { await page.goto(url(route), { waitUntil: 'domcontentloaded' }); await settled(page); }
async function shot(page, name) { await page.screenshot({ path: `${output}/${name}.png` }); }
function observe(page, kind) { page.setDefaultTimeout(12_000); page.on('pageerror', error => errors.push({ kind, message: error.message })); }

try {
  await run('WebGL unavailable', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /^(webgl2?|experimental-webgl)$/.test(type) ? null : getContext.call(this, type, ...args); };
    });
    try {
      const page = await context.newPage(); observe(page, 'WebGL unavailable'); await goto(page, '/');
      await page.locator('.spatial-world--fallback').waitFor();
      check('Unavailable WebGL preserves all six Passage chapters', await page.locator('.tunnel-panel').count() === 6);
      check('Fallback Passage becomes document-flow content', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true');
      await page.getByRole('button', { name: 'ENTER THE WORLD', exact: true }).click();
      await page.locator('.tunnel-panel').first().getByRole('link').first().click();
      await page.waitForURL(current => current.hash === '#/world'); await settled(page);
      check('Fallback Passage can enter World', await page.getByRole('heading', { name: 'NO BORDERS.', exact: true }).isVisible());
      await shot(page, 'webgl-unavailable-world');
      await page.getByRole('button', { name: 'Open Index' }).click();
      await page.getByRole('dialog', { name: 'Find your way.' }).getByRole('link', { name: 'All stories', exact: true }).click();
      await page.waitForURL(current => current.hash === '#/search'); await settled(page);
      check('Fallback Index and catalogue remain usable', await page.getByRole('textbox', { name: 'Search catalogue' }).isVisible());
    } finally { await context.close(); }
  });

  await run('Responsive readable layouts', async () => {
    const context = await browser.newContext({ reducedMotion: 'no-preference' });
    try {
      const page = await context.newPage(); observe(page, 'Layout');
      for (const viewport of [{ width: 360, height: 800 }, { width: 844, height: 390 }, { width: 720, height: 450 }]) {
        await page.setViewportSize(viewport);
        for (const route of ['/', '/world', '/time-machine', '/journey']) {
          await goto(page, route);
          const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
          const label = `${viewport.width}x${viewport.height}-${route === '/' ? 'home' : route.slice(1)}`;
          check('No overflow ' + label, dimensions.width <= dimensions.viewport + 1, JSON.stringify(dimensions));
          check('Header controls remain visible ' + label, await page.getByRole('button', { name: 'Open Index' }).isVisible() && await page.getByRole('link', { name: 'Search stories and places' }).isVisible());
          await page.getByRole('button', { name: 'Open Index' }).focus(); await page.keyboard.press('Enter');
          const dialog = page.getByRole('dialog', { name: 'Find your way.' }); await dialog.waitFor();
          await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
          check('Keyboard focus returns ' + label, await page.getByRole('button', { name: 'Open Index' }).evaluate(element => element === document.activeElement));
          await shot(page, label);
        }
      }
    } finally { await context.close(); }
  });

  await run('Rapid route interruption and history', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' });
    try {
      const page = await context.newPage(); observe(page, 'Rapid navigation'); await goto(page, '/');
      const nav = page.getByRole('navigation', { name: 'Primary navigation' });
      // Real consecutive link inputs interrupt earlier travel, without waiting for a flight.
      await nav.getByRole('link', { name: 'World', exact: true }).click();
      await nav.getByRole('link', { name: 'Time Machine', exact: true }).click();
      await nav.getByRole('link', { name: 'Watch', exact: true }).click();
      await page.waitForURL(current => current.hash === '#/search'); await settled(page);
      check('Rapid Home→World→Time→Search settles on latest intent', await page.getByRole('textbox', { name: 'Search catalogue' }).isVisible());
      await page.goBack(); await settled(page);
      check('Back after interrupted travel restores a readable route', await page.locator('main h1').first().isVisible());
      await goto(page, '/world?place=london');
      await page.getByRole('complementary', { name: 'London destination', exact: true }).waitFor();
      await page.getByRole('link', { name: 'Explore through time', exact: true }).click();
      await page.waitForURL(current => current.hash.startsWith('#/time-machine') && new URLSearchParams(current.hash.split('?')[1]).get('place') === 'london'); await settled(page);
      check('World→Time carries its selected destination', new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('place') === 'london');
      await nav.getByRole('link', { name: 'Watch', exact: true }).click();
      await page.waitForURL(current => current.hash === '#/search'); await settled(page); await page.goBack(); await settled(page);
      check('Back preserves destination query on Time Machine', new URL(page.url()).hash.startsWith('#/time-machine') && new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('place') === 'london');
      await page.goBack(); await settled(page);
      check('Second Back restores London destination content', await page.getByRole('complementary', { name: 'London destination', exact: true }).isVisible());
      await goto(page, '/'); await page.getByRole('button', { name: 'Travel to The World', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[aria-label="Travel to The World"]')?.getAttribute('aria-current') === 'step');
      const hold = await page.evaluate(() => new Promise(resolve => {
        let last = scrollY, stable = 0, frames = 0; const samples = [];
        function sample() { const current = scrollY; stable = Math.abs(current - last) < .5 ? stable + 1 : 0; last = current; frames++;
          if (stable >= 20) { const panel = document.querySelector('[aria-labelledby="tunnel-heading-world"]'); if (panel) { const bounds = panel.getBoundingClientRect(); samples.push({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }); } }
          if (samples.length >= 90 || frames > 600) resolve(samples); else requestAnimationFrame(sample);
        } requestAnimationFrame(sample);
      }));
      const spread = hold.length ? Math.max(...hold.map(frame => frame.y)) - Math.min(...hold.map(frame => frame.y)) : Infinity;
      check('Station content holds steady after native scrolling settles', hold.length === 90 && spread < 2, `${hold.length} animation frames; vertical spread ${spread.toFixed(2)}px. This measures the DOM panel, not the camera matrix.`);
      await shot(page, 'station-hold-desktop');
    } finally { await context.close(); }
  });
  check('No uncaught exceptions in resilience flows', errors.length === 0, JSON.stringify(errors));
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, at: new Date().toISOString(), results, errors }, null, 2));
  await browser.close();
  console.log(`${results.filter(row => row.passed).length} passed; ${results.filter(row => !row.passed).length} failed. ${output}/results.json`);
}
