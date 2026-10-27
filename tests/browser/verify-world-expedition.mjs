import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5176/';
const output = 'test-results/world-expedition';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const checks = [], errors = [];
let activePage;
function check(name, condition, detail = '') {
  assert.ok(condition, `${name}: ${detail}`);
  checks.push({ name, passed: true, detail }); console.log('PASS ' + name);
}
function url(route) { const result = new URL(base); result.hash = route; return result.href; }
async function ready(page) {
  await page.getByRole('group', { name: 'Choose a destination', exact: true }).waitFor();
  await page.locator('.cultural-atlas__viewport canvas').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert && Number(getComputedStyle(document.querySelector('.route-stage')).opacity) > .99);
}
function destination(page, name) { return page.getByRole('group', { name: 'Choose a destination', exact: true }).getByRole('button', { name: `Go to ${name}`, exact: true }); }
async function selected(page, id, name) {
  await page.waitForURL(current => new URLSearchParams(current.hash.split('?')[1]).get('place') === id);
  await page.getByRole('complementary', { name: `${name} destination`, exact: true }).waitFor();
  await page.waitForFunction(id => {
    const image = document.querySelector('.world-horizon img');
    return image?.complete && image.naturalWidth > 0 && image.getAttribute('src')?.includes(`/${id}.webp`);
  }, id);
  assert.equal(await destination(page, name).getAttribute('aria-pressed'), 'true');
}
async function swipe(session, page, x, startY, endY) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  for (let i = 1; i <= 12; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + (endY - startY) * i / 12 }] });
    await page.waitForTimeout(18);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(650);
}
function captureErrors(page) { page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(15_000); activePage = page; }

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'no-preference' });
  const page = await desktop.newPage(); captureErrors(page);
  await page.goto(url('/world?place=miami'), { waitUntil: 'domcontentloaded' }); await ready(page);
  await selected(page, 'miami', 'Miami');
  check('World begins with a loaded destination and one globe canvas', await page.locator('.cultural-atlas__viewport canvas').count() === 1);
  check('Desktop checks use normal motion', await page.locator('html').getAttribute('data-motion') === 'full');
  await page.screenshot({ path: `${output}/desktop-miami.png` });

  const london = destination(page, 'London'); await london.scrollIntoViewIfNeeded();
  const beforeSelection = await page.evaluate(() => scrollY);
  await london.click(); await selected(page, 'london', 'London');
  const scrollRange = await page.evaluate(() => new Promise(resolve => {
    const samples = []; const end = performance.now() + 900;
    function sample() { samples.push(scrollY); if (performance.now() < end) requestAnimationFrame(sample); else resolve({ min: Math.min(...samples), max: Math.max(...samples) }); }
    requestAnimationFrame(sample);
  }));
  check('London selection coordinates URL, destination card and photograph', await page.getByRole('complementary', { name: 'London destination', exact: true }).getByRole('heading', { name: 'London', exact: true }).isVisible());
  check('Selecting a destination preserves the current reading position', Math.abs(scrollRange.min - beforeSelection) < 3 && Math.abs(scrollRange.max - beforeSelection) < 3, JSON.stringify({ beforeSelection, ...scrollRange }));

  await destination(page, 'Miami').click(); await selected(page, 'miami', 'Miami');
  await destination(page, 'Miami').focus(); await page.keyboard.press('ArrowRight');
  await selected(page, 'puerto-rico', 'Puerto Rico');
  check('ArrowRight chooses and focuses the next destination', await destination(page, 'Puerto Rico').evaluate(element => element === document.activeElement));
  await destination(page, 'London').click(); await selected(page, 'london', 'London');

  await page.getByRole('button', { name: 'Save London', exact: true }).click();
  check('Saving a destination updates the visible state and persisted collection', await page.getByRole('button', { name: 'Unsave London', exact: true }).getAttribute('aria-pressed') === 'true' && await page.evaluate(() => JSON.parse(localStorage.getItem('monumental.viewer.v1')).savedPlaces.includes('london')));
  await page.getByRole('button', { name: 'Unsave London', exact: true }).click();
  check('Removing a destination reverses both save states', await page.getByRole('button', { name: 'Save London', exact: true }).getAttribute('aria-pressed') === 'false' && await page.evaluate(() => !JSON.parse(localStorage.getItem('monumental.viewer.v1')).savedPlaces.includes('london')));

  const aside = page.getByRole('complementary', { name: 'London destination', exact: true });
  await aside.getByRole('button', { name: 'Explore London', exact: true }).click();
  await page.waitForFunction(() => { const bounds = document.querySelector('.world-featured')?.getBoundingClientRect(); return bounds && bounds.top >= -2 && bounds.top < 190 && scrollY > 200; });
  check('Explore London scrolls to its featured story', await page.getByRole('region', { name: 'Featured story from London', exact: true }).isVisible());
  await page.getByRole('button', { name: 'Watch this story', exact: true }).click();
  await page.locator('.ms-player-dialog:modal').waitFor();
  await page.waitForFunction(() => { const video = document.querySelector('.ms-player-dialog video'); return video && video.readyState >= 2 && video.currentTime > .15 && !video.paused; }, null, { timeout: 30_000 });
  check('The featured story opens a real playing film', await page.locator('.ms-player-dialog video').evaluate(video => !!video.currentSrc && video.currentTime > .15));
  await page.getByRole('button', { name: 'Close player', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('dialog:modal'));
  const wheelStart = await page.evaluate(() => scrollY);
  await page.mouse.move(1260, 450); await page.mouse.wheel(0, 420);
  await page.waitForFunction(y => scrollY > y + 100, wheelStart);
  check('Closing the player leaves native page scrolling unlocked', await page.evaluate(y => scrollY > y + 100, wheelStart));

  await destination(page, 'Miami').scrollIntoViewIfNeeded();
  // Rapid real clicks interrupt the globe flight; the latest destination wins.
  for (const name of ['Miami', 'New York', 'Tokyo', 'London']) await destination(page, name).click();
  await selected(page, 'london', 'London'); await page.waitForTimeout(1100);
  check('Rapid choices settle on the latest destination with one canvas', page.url().includes('place=london') && await destination(page, 'London').getAttribute('aria-pressed') === 'true' && await page.locator('.cultural-atlas__viewport canvas').count() === 1 && await page.locator('main').evaluate(element => !element.inert));
  await page.screenshot({ path: `${output}/desktop-london.png` });

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const phone = await mobile.newPage(); captureErrors(phone);
  await phone.goto(url('/world?place=miami'), { waitUntil: 'domcontentloaded' }); await ready(phone);
  const touch = await mobile.newCDPSession(phone);
  const touchStart = await phone.evaluate(() => scrollY); await swipe(touch, phone, 382, 730, 230);
  check('Mobile World retains real vertical touch scrolling', await phone.evaluate(y => scrollY > y + 100, touchStart));
  await destination(phone, 'London').scrollIntoViewIfNeeded(); await destination(phone, 'London').tap();
  await selected(phone, 'london', 'London');
  check('Touch selection changes the city and photograph', await destination(phone, 'London').getAttribute('aria-pressed') === 'true');
  check('Phone layout fits its viewport and retains one globe', await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && await phone.locator('.cultural-atlas__viewport canvas').count() === 1);
  await phone.screenshot({ path: `${output}/mobile-london.png`, fullPage: true });
  await phone.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await phone.screenshot({ path: `${output}/mobile-london-top.png` });

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const quiet = await reduced.newPage(); captureErrors(quiet);
  await quiet.goto(url('/world?place=miami'), { waitUntil: 'domcontentloaded' }); await ready(quiet);
  check('World respects reduced motion', await quiet.locator('.ex-world').evaluate(element => element.classList.contains('ex-reduced')));
  await destination(quiet, 'London').click(); await selected(quiet, 'london', 'London');
  await quiet.getByRole('complementary', { name: 'London destination', exact: true }).getByRole('button', { name: 'Explore London', exact: true }).click();
  check('Reduced motion retains destination selection and direct story access', await quiet.evaluate(() => scrollY > 200) && await quiet.getByRole('region', { name: 'Featured story from London', exact: true }).isVisible());
  check('No uncaught exceptions across desktop, phone and reduced motion', errors.length === 0, JSON.stringify(errors));
} catch (error) {
  checks.push({ name: 'World expedition flow', passed: false, detail: error.stack }); process.exitCode = 1;
  await activePage?.screenshot({ path: `${output}/failure.png` }).catch(() => {}); console.error(error);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, errors }, null, 2));
  await browser.close(); console.log(`${checks.filter(item => item.passed).length} passed; ${checks.filter(item => !item.passed).length} failed.`);
}
