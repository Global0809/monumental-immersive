import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5184/';
const output = process.env.LIFE_OUTPUT || 'output/playwright/living-tunnel-review';
const checks = [], errors = [], measurements = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const address = route => { const url = new URL(base); url.hash = route; return url.href; };
function check(name, value, detail = '') {
  assert.ok(value, `${name}: ${detail}`); checks.push({ name, passed: true, detail }); console.log(`PASS ${name}`);
}
async function scenario(name, options, run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', ...options });
  const page = await context.newPage(); page.setDefaultTimeout(20_000);
  page.on('pageerror', error => errors.push({ scenario: name, message: error.message }));
  page.on('console', message => {
    if (/WebGLProgram|VALIDATE_STATUS|shader error|shader failed|GL_INVALID|GLSL/i.test(message.text())) errors.push({ scenario: name, message: message.text() });
  });
  try { await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page); await run(page, context); }
  catch (error) { checks.push({ name, passed: false, detail: error.stack }); console.error(`FAIL ${name}: ${error.message}`); await page.screenshot({ path: `${output}/failure-${name}.png` }).catch(() => {}); }
  finally { await context.close(); }
}
async function ready(page) {
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
  await page.evaluate(() => document.fonts.ready);
}
const scene = page => page.locator('[data-passage-chapter]');
async function station(page, title, id) {
  await page.getByRole('button', { name: `Travel to ${title}`, exact: true }).click();
  await page.waitForFunction(id => document.querySelector('[data-passage-chapter]')?.dataset.passageChapter === id && document.querySelector('[data-passage-reading]')?.dataset.passageReading === 'true', id);
  await page.waitForTimeout(300);
}
async function sampleFrames(page, label) {
  const observation = await page.evaluate(() => new Promise(resolve => {
    const host = document.querySelector('[data-passage-draw-calls]'), samples = [], start = performance.now();
    let last = start, maximum = 0;
    const observer = new MutationObserver(() => {
      const now = performance.now(); samples.push(now - last); last = now;
      maximum = Math.max(maximum, Number(host.dataset.passageDrawCalls));
    });
    observer.observe(host, { attributes: true, attributeFilter: ['data-passage-draw-calls'] });
    setTimeout(() => { observer.disconnect(); samples.sort((a, b) => a - b); resolve({ count: samples.length, medianMs: samples[Math.floor(samples.length * .5)] || 0, p95Ms: samples[Math.floor(samples.length * .95)] || 0, maximumDrawCalls: maximum }); }, 1500);
  }));
  measurements.push({ label, ...observation }); return observation;
}

try {
  await scenario('desktop-life', {}, async page => {
    await page.waitForFunction(() => document.querySelector('[data-passage-life]')?.dataset.passageLife === 'active');
    const unfold = page.getByRole('button', { name: 'Unfold the relay', exact: true });
    const signal = page.getByRole('button', { name: 'Send a signal', exact: true });
    check('Opening exposes accessible relay and signal controls', await unfold.isVisible() && await signal.isVisible());
    await page.screenshot({ path: `${output}/00-opening.png` });
    const baseline = await scene(page).getAttribute('data-passage-signal');
    await unfold.click();
    await page.waitForFunction(() => document.querySelector('[data-passage-relay-open]')?.dataset.passageRelayOpen === 'true');
    const fold = page.getByRole('button', { name: 'Fold the relay', exact: true });
    check('Unfold action updates the model state and pressed semantics', await fold.getAttribute('aria-pressed') === 'true');
    await page.waitForTimeout(650); await page.screenshot({ path: `${output}/01-relay-open.png` });
    await fold.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-passage-relay-open]')?.dataset.passageRelayOpen === 'false');
    check('Keyboard activation folds the same relay', await unfold.getAttribute('aria-pressed') === 'false');
    await page.waitForTimeout(500);
    let hit = null;
    for (const [x, y] of [[824, 450], [845, 430], [805, 470], [875, 450], [800, 415], [860, 480], [825, 390], [825, 510], [910, 450]]) {
      await page.mouse.move(x, y); await page.waitForTimeout(40);
      if (await scene(page).getAttribute('data-passage-relay-hover') === 'true') { hit = { x, y }; break; }
    }
    check('Visible relay geometry is reachable by actual pointer ray casting', !!hit);
    await page.mouse.down(); await page.mouse.move(hit.x + 35, hit.y + 20, { steps: 5 }); await page.mouse.up();
    check('Dragging across the relay does not accidentally toggle it', await scene(page).getAttribute('data-passage-relay-open') === 'false');
    await page.mouse.click(hit.x, hit.y);
    await page.waitForFunction(() => document.querySelector('[data-passage-relay-open]')?.dataset.passageRelayOpen === 'true');
    check('Clicking the physical relay opens the same accessible control state', await fold.getAttribute('aria-pressed') === 'true');
    await fold.click();
    await signal.click();
    await page.waitForFunction(previous => Number(document.querySelector('[data-passage-signal]')?.dataset.passageSignal) > Number(previous), baseline);
    check('Send a signal starts one scene response without navigating', (await page.url()).endsWith('#/') && await signal.isVisible());
    await page.waitForTimeout(250); await page.screenshot({ path: `${output}/02-signal.png` });
    const first = Number(await scene(page).getAttribute('data-passage-signal'));
    for (let count = 0; count < 6; count++) await signal.click();
    await page.waitForFunction(first => Number(document.querySelector('[data-passage-signal]')?.dataset.passageSignal) === first + 6, first);
    check('Repeated signals remain bounded to the same scene and canvas', await page.locator('canvas.spatial-world-canvas').count() === 1 && await page.locator('.tunnel-css-world').count() === 1);
    const entryPerf = await sampleFrames(page, 'opening after repeated signals');
    check('Additional tunnel effects keep the opening draw budget bounded', entryPerf.maximumDrawCalls > 0 && entryPerf.maximumDrawCalls <= 225, JSON.stringify(entryPerf));

    await station(page, 'The World', 'world');
    check('World reading position retains its protected video and readable interface', await page.locator('.flight-media-mask').getAttribute('data-protected') === 'true' && await page.locator('[data-tunnel-station="world"]').getAttribute('aria-hidden') === 'false');
    check('Opening-only relay controls leave the chapter reading area clear', !(await unfold.isVisible()));
    const stateBefore = await scene(page).getAttribute('data-passage-relay-open');
    const protectedRect = await page.locator('.flight-media-mask').evaluate(element => {
      const numbers = (element.style.clipPath.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      return { style: element.style.clipPath, numbers };
    });
    check('Protected media mask remains finite as living effects run', !!protectedRect.style && protectedRect.numbers.every(Number.isFinite), protectedRect.style);
    await signal.click();
    const heading = await page.locator('#tunnel-heading-world').boundingBox();
    await page.mouse.move(heading.x + heading.width * .5, heading.y + heading.height * .5);
    await page.waitForTimeout(50);
    check('Text pointer interaction does not activate the relay model', await scene(page).getAttribute('data-passage-relay-open') === stateBefore && await scene(page).getAttribute('data-passage-relay-hover') !== 'true');
    await page.screenshot({ path: `${output}/03-world-signal.png` });
    const worldPerf = await sampleFrames(page, 'World active footage and signal');
    check('Active chapter draw budget stays bounded with effects and footage', worldPerf.maximumDrawCalls > 0 && worldPerf.maximumDrawCalls <= 225, JSON.stringify(worldPerf));
    await station(page, 'Music', 'music'); await signal.click(); await page.waitForTimeout(220);
    await page.screenshot({ path: `${output}/04-music.png` });
    await page.getByRole('button', { name: 'Return to tunnel entrance', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-passage-chapter]')?.dataset.passageChapter === 'entrance' && scrollY < 2);
    check('Returning to the entrance restores the same model controls', await unfold.isVisible());
    await unfold.click();
    await page.getByRole('link', { name: 'Browse the films', exact: true }).click();
    await page.waitForURL(url => url.hash === '#/category/movies');
    await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage);
    check('Other routes expose no Passage life controls', await page.getByRole('button', { name: /^(Unfold|Fold) the relay$/ }).count() === 0 && await page.getByRole('button', { name: 'Send a signal', exact: true }).count() === 0);
    await page.getByRole('link', { name: 'Monumental — The Passage', exact: true }).click(); await ready(page);
    await page.waitForFunction(() => document.querySelector('[data-passage-life]')?.dataset.passageLife === 'active');
    check('Returning mounts one scene and one set of interactive controls', await page.locator('canvas.spatial-world-canvas').count() === 1 && await page.getByRole('button', { name: /^(Unfold|Fold) the relay$/ }).count() === 1 && await signal.count() === 1);
  });

  await scenario('phone-life', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async page => {
    check('Phone omits desktop-only relay controls', await page.getByRole('button', { name: /^(Unfold|Fold) the relay$/ }).count() === 0 && await page.getByRole('button', { name: 'Send a signal', exact: true }).count() === 0);
    check('Phone suspends additional scene effects', await scene(page).getAttribute('data-passage-life') === 'off');
    check('Phone retains readable entry and no horizontal overflow', await page.getByRole('button', { name: 'ENTER THE WORLD', exact: true }).isVisible() && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${output}/05-phone.png` });
  });
  await scenario('reduced-life', { reducedMotion: 'reduce' }, async page => {
    check('Reduced motion offers usable content without effects controls', await scene(page).getAttribute('data-passage-life') === 'off' && await page.getByRole('button', { name: 'Send a signal', exact: true }).count() === 0 && await page.locator('.tunnel-panel').count() === 6);
    await page.screenshot({ path: `${output}/06-reduced.png` });
  });
  check('New tunnel interactions produce no uncaught browser errors', errors.length === 0, JSON.stringify(errors));
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, errors, measurements }, null, 2));
  await browser.close();
  console.log(`${checks.filter(check => check.passed).length} passed; ${checks.filter(check => !check.passed).length} failed.`);
  if (checks.some(check => !check.passed)) process.exitCode = 1;
}
