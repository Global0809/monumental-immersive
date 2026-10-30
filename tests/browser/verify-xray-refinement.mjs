import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Run against the local preview or set SITE_URL. Screenshots are visual evidence;
// animated scenes deliberately have no brittle whole-frame pixel comparison.
const base = process.env.SITE_URL || 'http://127.0.0.1:5184/';
const output = process.env.XRAY_OUTPUT || 'output/playwright/xray-refinement';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [], errors = [], captures = [];
const scene = page => page.locator('[data-passage-cutaway]');
const address = path => { const url = new URL(base); url.hash = path; return url.href; };
const check = (name, passed, detail = '') => {
  checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
};

async function ready(page) {
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage);
  await page.evaluate(() => document.fonts.ready);
}

async function capture(page, name, pointer = null) {
  const file = `${output}/${name}.png`;
  await page.screenshot({ path: file });
  captures.push({ name, file, pointer, state: await scene(page).evaluate(element => ({
    active: element.dataset.passageCutaway,
    chapter: element.dataset.passageChapter,
    reading: element.dataset.passageReading,
    drawCalls: Number(element.dataset.passageDrawCalls),
  })) });
}

async function move(page, point) {
  await page.mouse.move(point.x, point.y);
  // Allow the authored opening/closing interpolation to finish before observing.
  await page.waitForTimeout(450);
  return (await scene(page).getAttribute('data-passage-cutaway')) === 'true';
}

async function hoverElement(page, locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('Expected a visible reading surface or control');
  const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  return { point, active: await move(page, point) };
}

async function station(page, title, id) {
  await page.getByRole('button', { name: `Travel to ${title}`, exact: true }).click();
  await page.waitForFunction(id => document.querySelector('[data-passage-reading="true"]')?.dataset.passageChapter === id, id);
  await page.waitForTimeout(500);
}

async function scrollSettled(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const start = performance.now();
    let lastY = scrollY, unchangedSince = start;
    function sample(now) {
      if (Math.abs(scrollY - lastY) > .1) { lastY = scrollY; unchangedSince = now; }
      if (now - unchangedSince >= 250) { resolve(scrollY); return; }
      if (now - start > 5000) { reject(new Error('Native scrolling did not settle')); return; }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
}

async function mediaBounds(page) {
  await page.locator('.flight-media-mask[data-protected="true"]').waitFor();
  return page.locator('.flight-media-mask').evaluate(element => {
    // Read the existing rendered exclusion mask, without importing application
    // modules or instrumenting the WebGL renderer.
    const clip = element.style.clipPath;
    // Chromium inserts spaces after SVG commands when serializing CSS path().
    // Match the second absolute rectangular subpath, retaining its coordinates.
    const number = String.raw`[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?`;
    const match = clip.match(new RegExp(String.raw`Z\s*M\s*(${number})[\s,]+(${number})\s*H\s*(${number})\s*V\s*(${number})\s*H\s*(${number})\s*Z`));
    if (!match) return { parsed: false, clip };
    const [left, top, right, bottom] = match.slice(1).map(Number);
    const closesAtLeft = Number(match[5]) === left;
    return { parsed: closesAtLeft && right > left && bottom > top, left, top, right, bottom, clip };
  });
}

async function scenario(name, options, work) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on('pageerror', error => errors.push({ scenario: name, message: error.message }));
  page.on('console', message => {
    if (/WebGLProgram|shader error|VALIDATE_STATUS/i.test(message.text())) errors.push({ scenario: name, message: message.text() });
  });
  try {
    await page.goto(address('/'), { waitUntil: 'domcontentloaded' });
    await ready(page);
    await work(page);
  } catch (error) {
    check(`${name}: runner`, false, error.stack);
    await page.screenshot({ path: `${output}/failure-${name}.png` }).catch(() => {});
  } finally {
    await context.close();
  }
}

try {
  await scenario('desktop', {}, async page => {
    await page.waitForTimeout(950);
    await capture(page, '00-entrance');
    const wallHits = [];
    // Several fixed viewpoints make edge quality, wall depth and material
    // continuity reviewable. Gaps between real shell pieces may correctly miss.
    const probes = [
      { x: 1220, y: 660 }, { x: 1290, y: 310 },
      { x: 1150, y: 200 }, { x: 1110, y: 735 },
    ];
    for (let index = 0; index < probes.length; index++) {
      const point = probes[index], active = await move(page, point);
      if (active) wallHits.push(point);
      await capture(page, `01-wall-${index + 1}${active ? '-open' : '-gap'}`, point);
    }
    check('Pointer opens a cutaway at multiple real wall positions', wallHits.length >= 2, { probes, wallHits });
    check('Reveal shares the existing Passage canvas', await page.locator('canvas.spatial-world-canvas').count() === 1);
    const wall = wallHits[0] || probes[0];

    const headline = await hoverElement(page, page.locator('.tunnel-hero h1'));
    check('Entrance headline remains outside the cutaway', !headline.active, headline.point);
    const control = await hoverElement(page, page.getByRole('button', { name: 'ENTER THE WORLD', exact: true }));
    check('Entrance action closes the cutaway', !control.active, control.point);
    check('Relay manual settings are absent', await page.locator('.tunnel-relay-control,#tunnel-relay-parts').count() === 0);
    await page.waitForFunction(() => document.querySelector('[data-passage-relay-part]')?.dataset.passageRelayPart !== '');
    await page.waitForTimeout(350);
    await capture(page, '02-relay-component');
    await page.waitForFunction(() => document.querySelector('[data-passage-relay-open]')?.dataset.passageRelayOpen === 'false');
    check('Relay automatically reassembles', await page.locator('[data-passage-relay-part]').getAttribute('data-passage-relay-part') === '');

    await station(page, 'The World', 'world');
    const chapter = page.locator('[data-tunnel-station="world"]');
    const text = await hoverElement(page, chapter.locator('.tunnel-panel-copy p'));
    check('Chapter reading copy remains outside the cutaway', !text.active, text.point);
    const bounds = await mediaBounds(page);
    check('Projected footage publishes a finite exclusion boundary', bounds.parsed && [bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite), bounds);
    if (bounds.parsed) {
      for (const [label, point] of [
        ['center', { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 }],
        ['inner-edge', { x: bounds.right - 12, y: (bounds.top + bounds.bottom) / 2 }],
      ]) {
        check(`Projected footage ${label} excludes the lens`, !(await move(page, point)), point);
        await capture(page, `03-media-${label}`, point);
      }
    }
    await page.getByRole('button', { name: 'Inspect The World exhibit', exact: true }).click();
    check('Object inspection suspends the cutaway', !(await move(page, wall)));
    await page.keyboard.press('Escape');
    check('Escape restores the normal chapter', await chapter.locator('.tunnel-panel').getAttribute('data-expanded') === 'false');

    // Open the player by keyboard with the pointer away from the play button:
    // this catches a stale lens surviving a paused renderer.
    const story = chapter.getByRole('button', { name: /^Play / });
    await story.focus();
    let playerWall = wall, activeBeforePlayer = false;
    for (const point of [wall, { x: 1380, y: 680 }, { x: 1240, y: 735 }, { x: 70, y: 680 }]) {
      if (await move(page, point)) { playerWall = point; activeBeforePlayer = true; break; }
    }
    check('A wall reveal is open before keyboard player activation', activeBeforePlayer, playerWall);
    await page.keyboard.press('Enter');
    await page.locator('.ms-player-dialog:modal').waitFor();
    check('Player suspends the cutaway even when opened by keyboard', !(await move(page, playerWall)));
    await capture(page, '04-player-protection', playerWall);
    await page.getByRole('button', { name: 'Close player', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.ms-player-dialog:modal'));
    check('Closing the player preserves the reading station', await scene(page).getAttribute('data-passage-chapter') === 'world');

    await page.getByRole('button', { name: 'Return to tunnel entrance', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-passage-chapter]')?.dataset.passageChapter === 'entrance' && scrollY < 2);
    const settledY = await scrollSettled(page);
    // Returning scroll intentionally clears the reveal. Re-enter from a known
    // interface point after the final scroll event, then test the original wall.
    await hoverElement(page, page.getByRole('button', { name: 'ENTER THE WORLD', exact: true }));
    check('Cutaway resumes after player and station travel', await move(page, wall), { settledY, wall });
    await capture(page, '05-resumed-wall', wall);
  });

  await scenario('compact', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async page => {
    check('Phone retains the native compact presentation', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true');
    check('Phone omits the cutaway', !(await move(page, { x: 330, y: 570 })));
    check('Phone keeps the chapter content and has no horizontal overflow', await page.locator('.tunnel-panel').count() === 6 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await capture(page, '06-phone');
  });

  await scenario('reduced-motion', { reducedMotion: 'reduce' }, async page => {
    check('Reduced motion omits the cutaway', !(await move(page, { x: 1220, y: 660 })));
    check('Reduced motion retains a readable compact document', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true' && await scene(page).getAttribute('data-passage-life') === 'off');
    await capture(page, '07-reduced-motion');
  });
} finally {
  await browser.close();
  await writeFile(`${output}/verification.json`, JSON.stringify({ base, checks, errors, captures }, null, 2));
}
if (checks.some(result => !result.passed) || errors.length) process.exitCode = 1;
