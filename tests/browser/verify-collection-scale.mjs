import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.SITE_URL || 'http://127.0.0.1:5176/';
const output = 'test-results/collection-scale';
await mkdir(output, { recursive: true });
// IDs verified against catalogue.seed.ts. Fixture stays in this isolated context.
const fixture = {
  savedPlaces: ['miami', 'puerto-rico', 'new-york', 'london', 'tokyo', 'rio'],
  saved: ['miami-frequency', 'island-current'],
  journeys: Array.from({ length: 25 }, (_, index) => ({ id: `scale-check-${index + 1}`, name: `Scale journey ${String(index + 1).padStart(2, '0')}`, videoIds: ['miami-frequency', 'island-current'] })),
  history: {}, sound: false, reducedMotion: false,
};
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' });
await context.addInitScript(value => { if (!localStorage.getItem('monumental.viewer.v1')) localStorage.setItem('monumental.viewer.v1', JSON.stringify(value)); }, fixture);
const page = await context.newPage(); page.setDefaultTimeout(15_000);
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
function check(name, condition, detail = '') { assert.ok(condition, name + ': ' + detail); checks.push({ name, passed: true, detail }); console.log('PASS ' + name); }
function url(route) { const target = new URL(base); target.hash = route; return target.href; }
const monument = page.locator('.personal-monument');
const pieces = monument.locator('.personal-monument__piece');
const detail = monument.locator('.personal-monument__detail');
const scene = monument.locator('.personal-monument__scene');
async function openCollection() {
  await page.goto(url('/my-world'), { waitUntil: 'domcontentloaded' }); await monument.waitFor();
  await scene.scrollIntoViewIfNeeded(); await monument.locator('.personal-monument__scene.is-ready').waitFor();
}
try {
  await openCollection();
  check('All 33 collection pieces remain in the list', await pieces.count() === 33);
  check('Large fixture includes 6 anchors, 2 segments and 25 journeys', await pieces.filter({ hasText: 'Destination anchor' }).count() === 6 && await pieces.filter({ hasText: 'Film segment' }).count() === 2 && await pieces.filter({ hasText: 'Journey thread' }).count() === 25);
  check('Sculpture starts with automatic rotation off', await monument.getByRole('button', { name: 'Start sculpture rotation', exact: true }).getAttribute('aria-pressed') === 'false');
  const oldCanvas = await scene.locator('canvas').elementHandle();
  await pieces.filter({ hasText: 'Scale journey 25' }).click();
  await detail.getByRole('heading', { name: 'Scale journey 25', exact: true }).waitFor();
  await monument.getByText('Showing pieces 25–33 of 33.', { exact: false }).waitFor();
  await scene.scrollIntoViewIfNeeded(); await monument.locator('.personal-monument__scene.is-ready').waitFor();
  check('Selecting piece 33 loads its 3D group and details', await oldCanvas.evaluate(element => !element.isConnected) && await scene.locator('canvas').count() === 1 && await detail.locator('.personal-monument__journey li').count() === 2);
  check('Selection does not truncate the readable list', await pieces.count() === 33);
  await page.screenshot({ path: `${output}/desktop-group-two.png` });
  const filters = monument.locator('[aria-label="Filter sculpture pieces"]');
  await filters.getByRole('button', { name: 'Journeys', exact: true }).click();
  check('Journey filter retains all 25 journeys', await pieces.count() === 25);
  await filters.getByRole('button', { name: 'Films', exact: true }).click();
  check('Film filter exposes both saved films', await pieces.count() === 2);
  await filters.getByRole('button', { name: 'All pieces', exact: true }).click();
  await monument.getByRole('button', { name: 'Column', exact: true }).click();
  await monument.getByRole('button', { name: 'Reset arrangement', exact: true }).click();
  check('Reset restores Orbit without deleting collection pieces', await monument.getByRole('button', { name: 'Orbit', exact: true }).getAttribute('aria-pressed') === 'true' && await pieces.count() === 33);
  await page.reload(); await scene.scrollIntoViewIfNeeded(); await monument.locator('.personal-monument__scene.is-ready').waitFor();
  check('Large collection persists through reload', await pieces.count() === 33 && await monument.getByRole('button', { name: 'Start sculpture rotation', exact: true }).getAttribute('aria-pressed') === 'false');

  // Complete films are saved through ordinary catalogue controls, not the fixture.
  await page.goto(url('/search'), { waitUntil: 'domcontentloaded' });
  await page.locator('.film-grid[aria-label="Catalogue results"]').waitFor();
  for (const title of ['Sintel', 'Big Buck Bunny']) {
    await page.getByRole('button', { name: `Save ${title}`, exact: true }).click();
    check(`Normal catalogue UI saves ${title}`, await page.getByRole('button', { name: `Remove ${title}`, exact: true }).getAttribute('aria-pressed') === 'true');
  }
  await openCollection();
  check('Ordinary saves extend the large collection to 35', await pieces.count() === 35);
  for (const title of ['Sintel', 'Big Buck Bunny']) {
    await pieces.filter({ has: page.getByText(title, { exact: true }) }).click();
    await detail.getByRole('heading', { name: title, exact: true }).waitFor();
    const label = await detail.locator('.personal-monument__film-meta').innerText();
    check(`${title} sculpture detail identifies a Complete film`, label.includes('Complete film') && !label.includes('Available preview'), label);
  }
  const dismiss = page.getByRole('button', { name: 'Dismiss message', exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await scene.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${output}/mobile-sculpture.png` });
  await detail.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${output}/mobile-complete-film.png` });
  check('Mobile retains the full 35-piece list', await pieces.count() === 35);
  const widths = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  check('Mobile collection does not overflow horizontally', widths.page <= widths.viewport + 1, JSON.stringify(widths));
  check('No uncaught application errors', errors.length === 0, JSON.stringify(errors));
} catch (error) {
  checks.push({ name: 'Collection scale flow', passed: false, detail: error.stack }); process.exitCode = 1;
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {}); console.error(error);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, at: new Date().toISOString(), fixture, checks, errors }, null, 2));
  await browser.close(); console.log(`${checks.filter(item => item.passed).length} checks passed; ${checks.filter(item => !item.passed).length} failed.`);
}
