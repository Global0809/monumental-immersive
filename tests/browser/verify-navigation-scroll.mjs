import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5197/';
const output = 'test-results/navigation-scroll';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' });
const page = await context.newPage(); page.setDefaultTimeout(15_000);
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
function check(name, condition, detail = '') { assert.ok(condition, `${name}: ${detail}`); checks.push({ name, passed: true, detail }); console.log('PASS ' + name); }
function url(route) { const result = new URL(base); result.hash = route; return result.href; }
async function settled() {
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert && Number(getComputedStyle(document.querySelector('.route-stage')).opacity) > .99);
}
try {
  await page.goto(url('/world?place=miami'), { waitUntil: 'domcontentloaded' });
  const connection = page.locator('.ex-connection-link').first();
  await connection.waitFor(); await connection.scrollIntoViewIfNeeded();
  const initialY = await page.evaluate(() => scrollY);
  check('Regression runs with normal motion', await page.locator('html').getAttribute('data-motion') === 'full');
  check('Connection begins deep in the page', initialY > 500, `${initialY}px`);
  await connection.click();
  await page.waitForURL(current => current.hash === '#/world?place=puerto-rico');
  // This used to move partway, snap back to initialY, and stay there.
  await page.waitForFunction(() => scrollY < 120);
  check('Intentional World query allows its smooth scroll to finish', await page.evaluate(() => scrollY < 120));
  await page.goBack();
  await page.waitForURL(current => current.hash === '#/world?place=miami');
  await page.waitForFunction(expected => Math.abs(scrollY - expected) < 4, initialY);
  check('Query history restores the original reading position', await page.evaluate(expected => Math.abs(scrollY - expected) < 4, initialY), `${initialY}px`);
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Watch', exact: true }).click();
  await page.waitForURL(current => current.hash === '#/search'); await settled();
  check('New route still begins at the top', await page.evaluate(() => scrollY < 4));
  await page.goBack(); await page.waitForURL(current => current.hash === '#/world?place=miami'); await settled();
  await page.waitForFunction(expected => Math.abs(scrollY - expected) < 4, initialY);
  check('Cross-page Back still restores the same reading position', await page.evaluate(expected => Math.abs(scrollY - expected) < 4, initialY));

  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Time Machine', exact: true }).click();
  check('A real header click starts pending departure', await page.locator('html').getAttribute('data-spatial-passage') === 'departing');
  // The same cancelable event emitted by router.go/CommandDeck. Deliver it
  // immediately, so this regression targets the race instead of typing speed.
  const consumed = await page.evaluate(() => !window.dispatchEvent(new CustomEvent('monumental:navigate', {
    detail: { path: '/world', params: { place: 'london' } }, cancelable: true,
  })));
  await page.waitForURL(current => current.hash === '#/world?place=london'); await settled();
  check('Newest same-path query cancels flight and commits London', consumed && await page.getByRole('complementary', { name: 'London destination', exact: true }).isVisible());
  const stability = await page.evaluate(() => new Promise(resolve => {
    const until = performance.now() + 1500; let invalid = null;
    function sample() {
      if (location.hash !== '#/world?place=london' || document.querySelector('main')?.inert) invalid = { hash: location.hash, inert: document.querySelector('main')?.inert };
      if (performance.now() >= until) resolve(invalid); else requestAnimationFrame(sample);
    } requestAnimationFrame(sample);
  }));
  check('Cancelled departure cannot fire later or trap the page', stability === null, JSON.stringify(stability));
  await page.getByRole('button', { name: 'Open Index' }).click();
  await page.getByRole('dialog', { name: 'Find your way.' }).waitFor(); await page.keyboard.press('Escape');
  check('Navigation remains interactive after cancellation', await page.getByRole('button', { name: 'Open Index' }).evaluate(element => element === document.activeElement));
  await page.screenshot({ path: `${output}/latest-query.png` });
  check('No uncaught exceptions', errors.length === 0, JSON.stringify(errors));
} catch (error) {
  checks.push({ name: 'Navigation scroll flow', passed: false, detail: error.stack }); process.exitCode = 1;
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {}); console.error(error);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, errors }, null, 2));
  await browser.close(); console.log(`${checks.filter(check => check.passed).length} passed; ${checks.filter(check => !check.passed).length} failed.`);
}
