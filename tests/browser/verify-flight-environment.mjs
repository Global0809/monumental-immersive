import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5176/';
const output = process.env.FLIGHT_OUTPUT || 'test-results/flight';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const checks = [], errors = [];
let activePage;
function check(name, condition, detail = '') {
  assert.ok(condition, `${name}: ${detail}`);
  checks.push({ name, passed: true, detail }); console.log('PASS ' + name);
}
function url(route) { const result = new URL(base); result.hash = route; return result.href; }
async function instrument(context) {
  // Count the real renderer's draws without adding production telemetry.
  await context.addInitScript(() => {
    let draws = 0;
    const wrapped = new Set();
    for (const kind of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
      const proto = window[kind]?.prototype;
      if (!proto) continue;
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const original = proto[method];
        if (!original || wrapped.has(original)) continue;
        wrapped.add(original);
        proto[method] = function (...args) {
          if (this.canvas?.classList?.contains('flight-canvas')) draws++;
          return original.apply(this, args);
        };
      }
    }
    window.__flightDraws = () => draws;
  });
}
function capture(page) {
  activePage = page; page.setDefaultTimeout(15_000);
  page.on('pageerror', error => errors.push(error.message));
}
async function settled(page) {
  await page.locator('.flight-canvas').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
}
async function state(page, wanted) { await page.waitForFunction(wanted => document.querySelector('.flight-environment')?.dataset.state === wanted, wanted); }
async function drawDelta(page, duration = 500) {
  const before = await page.evaluate(() => window.__flightDraws());
  await page.waitForTimeout(duration);
  return (await page.evaluate(() => window.__flightDraws())) - before;
}
async function pausedDraws(page, name) {
  await page.waitForTimeout(250);
  check(name, await drawDelta(page) === 0);
}
async function swipe(session, page, x = 110, startY = 710, endY = 250) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  for (let i = 1; i <= 12; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + (endY - startY) * i / 12 }] });
    await page.waitForTimeout(18);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(550);
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'no-preference' });
  await instrument(desktop);
  const page = await desktop.newPage(); capture(page);
  await page.goto(url('/world?place=miami'), { waitUntil: 'domcontentloaded' }); await settled(page); await state(page, 'active');
  check('Direct World entry creates one active four-drone environment', await page.locator('.flight-canvas').count() === 1 && await page.locator('.flight-environment').getAttribute('data-drone-count') === '4');
  check('Ambient warp continues to render without scrolling', await drawDelta(page) > 0);
  check('The visual canvas never intercepts pointer input', await page.locator('.flight-canvas').evaluate(canvas => getComputedStyle(canvas).pointerEvents === 'none'));
  await page.screenshot({ path: `${output}/desktop-world.png` });
  await page.evaluate(() => { window.__originalFlightCanvas = document.querySelector('.flight-canvas'); });

  const invitation = page.getByRole('button', { name: /^Flight crew/ });
  await invitation.click(); await page.locator('.flight-dialog:modal').waitFor();
  await page.waitForFunction(() => document.querySelector('.flight-view .flight-canvas') === window.__originalFlightCanvas);
  check('Crew viewer reuses the same canvas inside its native dialog', await page.locator('.flight-canvas').count() === 1);
  await state(page, 'active'); check('Crew viewer renders while the page behind it is modal', await drawDelta(page) > 0);
  const crew = page.getByRole('group', { name: 'Meet the four companions', exact: true });
  check('The family has two parents and two named young explorers', await crew.getByRole('button').count() === 4 && await crew.getByRole('button', { name: /Vela Mother/ }).isVisible() && await crew.getByRole('button', { name: /Atlas Father/ }).isVisible() && await crew.getByRole('button', { name: /Pip Young/ }).isVisible() && await crew.getByRole('button', { name: /Echo Young/ }).isVisible());
  for (const name of ['Atlas', 'Pip', 'Echo', 'Vela']) {
    const member = crew.getByRole('button', { name: new RegExp('^' + name) }); await member.click();
    assert.equal(await member.getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.flight-detail p').innerText(), new RegExp('^' + name));
  }
  check('Each crew member can be selected with its own description', true);
  await page.getByRole('button', { name: 'Play in orbit', exact: true }).click();
  check('Orbit formation is selectable and remains animated', await page.getByRole('button', { name: 'Play in orbit', exact: true }).getAttribute('aria-pressed') === 'true' && await drawDelta(page) > 0);
  await page.mouse.move(920, 370); await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}/desktop-crew-orbit.png` });
  await page.getByRole('button', { name: 'Pause flight', exact: true }).click(); await state(page, 'docked');
  await pausedDraws(page, 'Pause flight stops the actual renderer after settling');
  check('Flight pause persists in local storage', await page.evaluate(() => localStorage.getItem('monumental.flight.docked')) === 'true');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.flight-dialog')?.open);
  check('Escape closes inspection, restores its canvas and returns focus', await page.evaluate(() => document.querySelector('.flight-environment .flight-canvas') === window.__originalFlightCanvas && document.activeElement?.classList.contains('flight-invitation')));
  await page.reload({ waitUntil: 'domcontentloaded' }); await settled(page); await state(page, 'docked');
  await pausedDraws(page, 'Paused flight remains stopped after a page reload');
  await page.evaluate(() => { window.__originalFlightCanvas = document.querySelector('.flight-canvas'); });
  await invitation.click(); await page.locator('.flight-dialog:modal').waitFor();
  await page.getByRole('button', { name: 'Resume flight', exact: true }).click(); await state(page, 'active');
  check('Resume flight restarts movement', await drawDelta(page) > 0);
  await page.getByRole('button', { name: 'Close flight crew', exact: true }).click();

  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Watch', exact: true }).click();
  await page.locator('.browse-page').waitFor(); await settled(page); await state(page, 'active');
  check('Route navigation preserves one persistent flight canvas', await page.evaluate(() => document.querySelector('.flight-canvas') === window.__originalFlightCanvas) && await page.locator('.flight-canvas').count() === 1);
  check('Ordinary desktop filter dialog does not pause flight', await page.locator('.catalogue-filter-dialog').evaluate(el => el.open && !el.matches(':modal')) && await drawDelta(page) > 0);
  const beforeWheel = await page.evaluate(() => scrollY);
  await page.mouse.move(1415, 620); await page.mouse.wheel(0, 600); await page.waitForFunction(y => scrollY > y + 100, beforeWheel);
  check('Watch keeps native scrolling beneath the flight layer', await page.evaluate(y => scrollY > y + 100, beforeWheel));
  await page.getByRole('button', { name: 'Open Index', exact: true }).click(); await page.locator('.index-dialog:modal').waitFor(); await state(page, 'paused');
  await pausedDraws(page, 'Another modal pauses drone and warp rendering');
  check('Another modal hides the decorative flight layer', await page.locator('.flight-environment').evaluate(el => getComputedStyle(el).visibility === 'hidden'));
  await page.getByRole('button', { name: 'Close Index', exact: true }).click(); await state(page, 'active');
  check('Closing the modal resumes flight without adding a canvas', await drawDelta(page) > 0 && await page.locator('.flight-canvas').count() === 1);
  await page.locator('.film-card-actions button.film-card-watch').first().click(); await page.locator('.ms-player-dialog:modal').waitFor(); await state(page, 'paused');
  await page.waitForFunction(() => { const video = document.querySelector('.ms-player-dialog video'); return video && video.readyState >= 2 && video.currentTime > .15 && !video.paused; }, null, { timeout: 30_000 });
  await pausedDraws(page, 'Film playback takes priority over the flight renderer');
  await page.getByRole('button', { name: 'Close player', exact: true }).click(); await state(page, 'active');

  await page.goto(url('/settings'), { waitUntil: 'domcontentloaded' }); await settled(page); await state(page, 'active');
  await page.getByRole('switch', { name: 'Reduce motion', exact: true }).click(); await state(page, 'reduced');
  await pausedDraws(page, 'The site motion setting stops continuous rendering immediately');
  await page.getByRole('switch', { name: 'Reduce motion', exact: true }).click(); await state(page, 'active');

  await page.getByRole('link', { name: 'Monumental — The Passage', exact: true }).click();
  await page.locator('.tunnel-hero').waitFor(); await settled(page); await state(page, 'active');
  check('Home keeps a single continuously moving family beside its existing tunnel', await page.locator('.flight-canvas').count() === 1 && await drawDelta(page) > 0);
  await page.screenshot({ path: `${output}/desktop-home.png` });
  await page.locator('.flight-canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    const loss = gl?.getExtension('WEBGL_lose_context');
    if (!loss) throw new Error('Context-loss test extension unavailable');
    loss.loseContext();
  });
  await page.waitForFunction(() => document.querySelector('.flight-environment')?.dataset.available === 'false');
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Watch', exact: true }).click();
  await page.locator('.browse-page').waitFor();
  check('A lost flight WebGL context leaves navigation and catalogue usable', await page.getByRole('button', { name: /^Flight crew/ }).count() === 0 && await page.locator('.film-card').count() > 0);

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  await instrument(mobile); const phone = await mobile.newPage(); capture(phone);
  await phone.goto(url('/search'), { waitUntil: 'domcontentloaded' }); await settled(phone); await state(phone, 'active');
  const touch = await mobile.newCDPSession(phone), beforeTouch = await phone.evaluate(() => scrollY);
  await swipe(touch, phone); check('Mobile retains real touch scrolling', await phone.evaluate(y => scrollY > y + 100, beforeTouch));
  await phone.getByRole('button', { name: /^Flight crew/ }).tap(); await phone.locator('.flight-dialog:modal').waitFor();
  check('Mobile crew viewer fits the viewport with four accessible choices', await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.flight-dialog').getBoundingClientRect().width <= innerWidth) && await phone.getByRole('group', { name: 'Meet the four companions', exact: true }).getByRole('button').count() === 4);
  await phone.getByRole('button', { name: /^Pip Young/ }).tap();
  await phone.getByRole('button', { name: 'Play in orbit', exact: true }).tap();
  await phone.screenshot({ path: `${output}/mobile-crew.png` });
  await phone.getByRole('button', { name: 'Close flight crew', exact: true }).tap(); await state(phone, 'active');
  await phone.screenshot({ path: `${output}/mobile-watch.png` });

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await instrument(reduced); const quiet = await reduced.newPage(); capture(quiet);
  await quiet.goto(url('/world'), { waitUntil: 'domcontentloaded' }); await settled(quiet); await state(quiet, 'reduced');
  await pausedDraws(quiet, 'OS reduced motion renders a still scene without an ambient loop');
  await quiet.getByRole('button', { name: /^Flight crew/ }).click(); await quiet.locator('.flight-dialog:modal').waitFor();
  await quiet.getByRole('button', { name: /^Echo Young/ }).click();
  check('Reduced motion retains crew inspection and selection', await quiet.getByRole('button', { name: /^Echo Young/ }).getAttribute('aria-pressed') === 'true');
  await pausedDraws(quiet, 'Reduced-motion inspection also settles after selection');
  await quiet.screenshot({ path: `${output}/reduced-crew.png` });
  check('No uncaught exceptions across desktop, mobile and reduced motion', errors.length === 0, JSON.stringify(errors));
} catch (error) {
  checks.push({ name: 'Flight environment flow', passed: false, detail: error.stack }); process.exitCode = 1;
  await activePage?.screenshot({ path: `${output}/failure.png` }).catch(() => {}); console.error(error);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, errors }, null, 2));
  await browser.close(); console.log(`${checks.filter(item => item.passed).length} passed; ${checks.filter(item => !item.passed).length} failed.`);
}
