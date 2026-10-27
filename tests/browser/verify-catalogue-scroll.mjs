import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5176/';
const output = 'test-results/catalogue-scroll';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const checks = [], errors = [];
let activePage;
function check(name, condition, detail = '') {
  assert.ok(condition, `${name}: ${detail}`); checks.push({ name, passed: true, detail }); console.log('PASS ' + name);
}
function url(route) { const result = new URL(base); result.hash = route; return result.href; }
async function ready(page) {
  await page.locator('.browse-page').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert && Number(getComputedStyle(document.querySelector('.route-stage')).opacity) > .99);
}
async function wheel(page, amount = 600) {
  const size = page.viewportSize(); await page.mouse.move(size.width - 22, Math.round(size.height / 2));
  await page.mouse.wheel(0, amount); await page.waitForTimeout(250);
}
async function wheelMoves(page, name) {
  const before = await page.evaluate(() => scrollY); await wheel(page);
  await page.waitForFunction(y => scrollY > y + 100, before);
  check(name, await page.evaluate(y => scrollY > y + 100, before));
}
async function lockState(page) {
  return page.evaluate(() => ({ y: scrollY, body: getComputedStyle(document.body).overflowY, root: getComputedStyle(document.documentElement).overflowY, modal: !!document.querySelector('dialog:modal') }));
}
async function modalLocks(page, name) {
  const before = await lockState(page); await wheel(page);
  const after = await lockState(page);
  check(name, before.modal && (before.body === 'hidden' || before.root === 'hidden') && Math.abs(before.y - after.y) < 2, JSON.stringify({ before, after }));
}
async function swipe(session, page, x = 110, startY = 700, endY = 220) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  for (let i = 1; i <= 12; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + (endY - startY) * i / 12 }] });
    await page.waitForTimeout(18);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(700);
}
try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  const page = await desktop.newPage(); activePage = page; page.setDefaultTimeout(12_000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url('/world'), { waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Watch', exact: true }).click();
  await page.waitForURL(current => current.hash === '#/search'); await ready(page);
  check('Regression runs with normal motion', await page.locator('html').getAttribute('data-motion') === 'full');
  check('Desktop filters are visible ordinary content', await page.locator('.catalogue-filter-dialog').evaluate(el => el.open && !el.matches(':modal')));
  await wheelMoves(page, 'Watch scrolls with the mouse wheel after primary navigation');
  await page.locator('main').focus(); const beforeKey = await page.evaluate(() => scrollY);
  await page.keyboard.press('PageDown'); await page.waitForFunction(y => scrollY > y + 100, beforeKey);
  check('Watch scrolls with PageDown', await page.evaluate(y => scrollY > y + 100, beforeKey));

  await page.getByRole('link', { name: 'Search stories and places', exact: true }).click();
  await page.locator('.command-deck:modal').waitFor();
  check('Quick search opens beside nonmodal desktop filters', await page.getByRole('combobox', { name: 'Search everything' }).isVisible());
  await page.getByRole('button', { name: 'Close quick search', exact: true }).click();
  await page.locator('main').focus(); await page.keyboard.press('?');
  await page.locator('.keyboard-guide:modal').waitFor();
  check('Keyboard guide opens beside nonmodal desktop filters', await page.getByRole('button', { name: 'Close interaction guide' }).isVisible());
  await page.getByRole('button', { name: 'Close interaction guide' }).click();

  await page.getByRole('button', { name: 'Open Index', exact: true }).click();
  await page.locator('.index-dialog:modal').waitFor(); await modalLocks(page, 'Index intentionally locks background scrolling');
  await page.getByRole('button', { name: 'Close Index', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('dialog:modal'));
  await wheelMoves(page, 'Closing Index restores Watch scrolling');

  for (const category of ['movies', 'music']) {
    await page.goto(url('/category/' + category), { waitUntil: 'domcontentloaded' }); await ready(page);
    await wheelMoves(page, `${category} collection scrolls with the mouse wheel`);
  }
  await page.goto(url('/search'), { waitUntil: 'domcontentloaded' }); await ready(page);
  await page.locator('.film-card-actions button.film-card-watch').first().click();
  await page.locator('.ms-player-dialog:modal').waitFor(); await modalLocks(page, 'Film player intentionally locks background scrolling');
  await page.getByRole('button', { name: 'Close player', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('dialog:modal'));
  await wheelMoves(page, 'Closing the player restores Watch scrolling');
  await page.screenshot({ path: `${output}/desktop-scroll.png` });

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const phone = await mobile.newPage(); activePage = phone; phone.setDefaultTimeout(12_000);
  phone.on('pageerror', error => errors.push(error.message));
  const touch = await mobile.newCDPSession(phone);
  await phone.goto(url('/search'), { waitUntil: 'domcontentloaded' }); await ready(phone);
  await phone.waitForFunction(() => !document.querySelector('.catalogue-filter-dialog')?.hasAttribute('open'));
  const beforeTouch = await phone.evaluate(() => scrollY); await swipe(touch, phone);
  check('Mobile Watch scrolls with a real touch gesture', await phone.evaluate(y => scrollY > y + 100, beforeTouch));
  await phone.getByRole('button', { name: /^Filters/ }).click();
  await phone.locator('.catalogue-filter-dialog:modal').waitFor();
  const locked = await lockState(phone); await swipe(touch, phone, 10, 120, 45);
  check('Mobile filter sheet intentionally locks the page behind it', locked.modal && (locked.body === 'hidden' || locked.root === 'hidden') && await phone.evaluate(y => Math.abs(scrollY - y) < 2, locked.y));
  await phone.getByRole('button', { name: 'Close filters', exact: true }).click();
  await phone.waitForFunction(() => !document.querySelector('dialog:modal'));
  const afterClose = await phone.evaluate(() => scrollY); await swipe(touch, phone);
  check('Closing mobile filters restores touch scrolling', await phone.evaluate(y => scrollY > y + 100, afterClose));

  await phone.getByRole('button', { name: /^Filters/ }).click(); await phone.locator('.catalogue-filter-dialog:modal').waitFor();
  await phone.setViewportSize({ width: 1280, height: 800 });
  await phone.waitForFunction(() => { const panel = document.querySelector('.catalogue-filter-dialog'); return panel?.open && !panel.matches(':modal') && getComputedStyle(document.body).overflowY !== 'hidden' && getComputedStyle(document.documentElement).overflowY !== 'hidden'; });
  check('Resizing an open mobile sheet creates unlocked inline desktop filters', !(await lockState(phone)).modal);
  await wheelMoves(phone, 'Resized catalogue remains scrollable');
  check('No uncaught exceptions', errors.length === 0, JSON.stringify(errors));
} catch (error) {
  checks.push({ name: 'Catalogue scrolling flow', passed: false, detail: error.stack }); process.exitCode = 1;
  await activePage?.screenshot({ path: `${output}/failure.png` }).catch(() => {}); console.error(error);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, errors }, null, 2));
  await browser.close(); console.log(`${checks.filter(item => item.passed).length} passed; ${checks.filter(item => !item.passed).length} failed.`);
}
