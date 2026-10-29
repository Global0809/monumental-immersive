import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Observe rendered motion and real controls, without calling application internals.
// SITE_URL points at either the local preview or a deployed build. TYPE_VIDEO=1
// additionally records one short demonstration, never the entire verification run.
const base = process.env.SITE_URL || 'http://127.0.0.1:5184/';
const output = process.env.TYPE_OUTPUT || 'output/playwright/living-type';
const headline = 'CULTURE. WITHOUT BORDERS.';
const copy = 'Every film opens a world. Go inside. See where it takes you.';
const selectors = {
  hero: '.tunnel-hero',
  glyph: '.tunnel-hero h1 .living-type-glyph',
  word: '.tunnel-hero-copy > p .living-type-word',
  entryLabel: '.tunnel-entry-button .living-action-face',
  browseLabel: '.tunnel-browse .living-action-face',
};
await mkdir(output, { recursive: true });
const checks = [], errors = [], captures = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const address = () => { const url = new URL(base); url.hash = '/'; return url.href; };
const normalize = value => value.replace(/\s+/g, ' ').trim();
const check = (name, passed, detail = '') => {
  checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
};
const difference = (a, b) => Math.max(...a.map((value, index) => Math.abs(value - b[index])));
const pose = sample => [...sample.transform, ...sample.translate];
const meanPose = samples => pose(samples[0]).map((_, index) => samples.reduce((total, sample) => total + pose(sample)[index], 0) / samples.length);
const variation = samples => Math.max(...samples.map(sample => difference(pose(samples[0]), pose(sample))));
const meanInk = samples => samples.reduce((total, sample) => total + sample.ink, 0) / samples.length;
const fixedBox = (before, after) => before && after && ['x', 'y', 'width', 'height'].every(key => Math.abs(before[key] - after[key]) < .5);

async function ready(page) {
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage);
  await page.evaluate(() => document.fonts.ready);
  // The existing entrance animation must finish before measuring the nested live
  // layer. This intentionally waits on animation state rather than its duration.
  await page.waitForFunction(() => {
    const letters = [...document.querySelectorAll('.tunnel-hero .depth-letter')];
    return letters.length > 0 && letters.every(letter => {
      const style = getComputedStyle(letter);
      return new DOMMatrixReadOnly(style.transform).isIdentity && Number(style.opacity) > .99
        && letter.getAnimations().every(animation => animation.playState !== 'running');
    });
  });
}

async function state(page, expected) {
  await page.waitForFunction(expected => document.querySelector('.tunnel-hero')?.dataset.livingType === expected, expected);
}

async function samples(locator, duration = 650) {
  return locator.evaluate((element, duration) => new Promise(resolve => {
    const start = performance.now(), values = [];
    let last = -Infinity;
    const tick = now => {
      if (now - last >= 30) {
        const style = getComputedStyle(element);
        const matrix = new DOMMatrixReadOnly(style.transform);
        const ink = element.querySelector('.living-type-ink');
        values.push({
          transform: Array.from(matrix.toFloat64Array()),
          translate: style.translate === 'none' ? [0, 0, 0] : style.translate.split(/\s+/).map(parseFloat).concat([0, 0]).slice(0, 3),
          ink: ink ? Number(getComputedStyle(ink).opacity) : 0,
          opacity: Number(style.opacity),
          runningAnimations: element.getAnimations().filter(animation => animation.playState === 'running').length,
        });
        last = now;
      }
      if (now - start >= duration) resolve(values);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), duration);
}

async function moveTo(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Expected a rendered target for the pointer');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  return point;
}

async function scrollSettled(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const start = performance.now();
    let last = scrollY, unchangedSince = start;
    const tick = now => {
      if (Math.abs(scrollY - last) > .1) { last = scrollY; unchangedSince = now; }
      if (now - unchangedSince >= 300) return resolve();
      if (now - start > 8000) return reject(new Error('Native smooth scrolling did not settle'));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

async function capture(page, name, pointer = null) {
  const file = `${output}/${name}.png`;
  await page.screenshot({ path: file });
  captures.push({ name, file, pointer, state: await page.locator(selectors.hero).getAttribute('data-living-type') });
}

async function semantics(page, prefix) {
  check(`${prefix}: the semantic headline is unchanged`, await page.getByRole('heading', { level: 1, name: headline, exact: true }).count() === 1);
  check(`${prefix}: the complete supporting copy is unchanged`, normalize(await page.locator('.tunnel-hero-copy > p').innerText()) === copy);
  check(`${prefix}: the original entrance and browse actions remain accessible`,
    await page.getByRole('button', { name: 'ENTER THE WORLD', exact: true }).count() === 1
    && await page.getByRole('link', { name: 'Browse the films', exact: true }).count() === 1
    && (await page.locator('.tunnel-browse').getAttribute('href')).includes('/category/movies'));
}

async function readability(page, prefix) {
  const result = await page.evaluate(() => {
    const elements = [...document.querySelectorAll('.tunnel-hero h1,.tunnel-hero-copy > p,.tunnel-entry-button,.tunnel-browse')];
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      surfaces: elements.map(element => {
        const box = element.getBoundingClientRect(), style = getComputedStyle(element);
        return { tag: element.tagName, x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height, opacity: Number(style.opacity), visibility: style.visibility, fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) };
      }),
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  check(`${prefix}: all opening copy and actions fit without horizontal overflow`, result.overflow <= 1 && result.surfaces.length === 4 && result.surfaces.every(box =>
    box.x >= -1 && box.y >= 0 && box.right <= result.viewport.width + 1 && box.bottom <= result.viewport.height + 1
    && box.width > 0 && box.height > 0 && box.opacity > .99 && box.visibility === 'visible'), result);
  const [, paragraph, entry, browse] = result.surfaces;
  check(`${prefix}: readable copy and usable touch targets remain`, paragraph.fontSize >= 14 && paragraph.lineHeight >= paragraph.fontSize * 1.35 && entry.height >= 44 && browse.height >= 44, { paragraph, entry, browse });
  check(`${prefix}: the headline, copy and actions do not overlap`, result.surfaces.every((box, index) => index === 0 || box.y >= result.surfaces[index - 1].bottom - 1), result.surfaces);
}

async function scenario(name, options, work) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on('pageerror', error => errors.push({ scenario: name, type: 'pageerror', message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error' || /WebGLProgram|shader error|VALIDATE_STATUS/i.test(message.text())) errors.push({ scenario: name, type: 'console', message: message.text() });
  });
  try {
    await page.goto(address(), { waitUntil: 'domcontentloaded' });
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
    await semantics(page, 'Desktop');
    await state(page, 'active');
    const glyph = page.locator(selectors.glyph).nth(2);
    const word = page.locator(selectors.word).nth(2);
    const title = page.locator('.tunnel-hero h1');
    const entry = page.getByRole('button', { name: 'ENTER THE WORLD', exact: true });
    const browse = page.getByRole('link', { name: 'Browse the films', exact: true });
    await page.mouse.move(1390, 730);
    const titleBefore = await title.boundingBox();
    await capture(page, '00-desktop-opening');
    // One complete authored cadence includes its deliberate quiet interval. All
    // later resume checks actively enter a glyph instead of relying on idle phase.
    const away = await samples(glyph, 9000);
    check('Headline has recurring live motion after its entrance settles', variation(away) > .001, { variation: variation(away), observationMilliseconds: 9000 });
    const pointer = await moveTo(page, glyph);
    const near = await samples(glyph, 900);
    const delta = difference(meanPose(away), meanPose(near));
    check('A nearby pointer changes the rendered letter pose', delta > .01, { difference: delta, away: meanPose(away), near: meanPose(near) });
    check('A nearby pointer visibly raises the letter ink overlay', meanInk(near) > meanInk(away) + .01, { away: meanInk(away), near: meanInk(near) });
    check('Living headline motion preserves the heading layout box', fixedBox(titleBefore, await title.boundingBox()), { before: titleBefore, after: await title.boundingBox() });
    await capture(page, '01-headline-cursor-reaction', pointer);

    await moveTo(page, word);
    const copyMotion = await samples(word, 800);
    check('Supporting copy has observable live word motion', variation(copyMotion) > .001, { variation: variation(copyMotion) });
    await capture(page, '02-copy-reaction');
    await page.mouse.move(1390, 730);
    const entryLabel = page.locator(selectors.entryLabel).first();
    const entryBefore = await entry.boundingBox(), idleLabel = await samples(entryLabel);
    await moveTo(page, entry);
    const hoveredLabel = await samples(entryLabel, 850);
    check('Entrance hover animates its inner label', difference(meanPose(idleLabel), meanPose(hoveredLabel)) > .01, { difference: difference(meanPose(idleLabel), meanPose(hoveredLabel)) });
    check('Entrance hover preserves its click target', fixedBox(entryBefore, await entry.boundingBox()), { before: entryBefore, after: await entry.boundingBox() });
    await page.mouse.move(1390, 730);
    // Tab away and back establishes keyboard focus even after pointer activity.
    await entry.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const focusedLabel = await samples(entryLabel, 850);
    check('Keyboard focus animates the entrance label with a fixed hit area', await entry.evaluate(element => element.matches(':focus-visible')) && difference(meanPose(idleLabel), meanPose(focusedLabel)) > .01 && fixedBox(entryBefore, await entry.boundingBox()));
    await capture(page, '03-entrance-keyboard-focus');

    const browseLabel = page.locator(selectors.browseLabel).first();
    const browseBefore = await browse.boundingBox(), idleBrowse = await samples(browseLabel);
    await page.keyboard.press('Tab');
    const focusedBrowse = await samples(browseLabel, 850);
    check('Browse has keyboard-visible focus and a moving inner label', await browse.evaluate(element => element.matches(':focus-visible')) && difference(meanPose(idleBrowse), meanPose(focusedBrowse)) > .01);
    check('Browse focus preserves its link hit area', fixedBox(browseBefore, await browse.boundingBox()));
    await capture(page, '04-browse-keyboard-focus');

    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-passage-reading="true"]')?.dataset.passageChapter === 'world');
    await scrollSettled(page); await state(page, 'paused');
    check('Keyboard Enter still reaches The World station', await page.locator('[data-passage-chapter]').getAttribute('data-passage-chapter') === 'world');
    const offscreen = await samples(glyph), offscreenCopy = await samples(word);
    check('The hidden hero stops changing headline and copy transforms', variation(offscreen) < .0001 && variation(offscreenCopy) < .0001, { headline: variation(offscreen), copy: variation(offscreenCopy) });
    await page.getByRole('button', { name: 'Return to tunnel entrance', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-passage-chapter]')?.dataset.passageChapter === 'entrance' && scrollY < 2);
    await scrollSettled(page); await state(page, 'active');
    await page.mouse.move(1390, 730);
    const returnedAway = (await samples(glyph)).slice(-3);
    await moveTo(page, glyph);
    const returned = await samples(glyph, 900);
    check('Returning to the entrance resumes pointer-reactive type', difference(meanPose(returnedAway), meanPose(returned.slice(-3))) > .01 && meanInk(returned.slice(-3)) > meanInk(returnedAway) + .01, { before: meanInk(returnedAway), after: meanInk(returned.slice(-3)) });

    await page.getByRole('button', { name: /^Flight crew/ }).click();
    await page.locator('.flight-dialog:modal').waitFor(); await state(page, 'paused');
    const modal = await samples(glyph), modalCopy = await samples(word);
    check('The Flight crew modal pauses headline and copy motion', variation(modal) < .0001 && variation(modalCopy) < .0001, { headline: variation(modal), copy: variation(modalCopy) });
    await page.getByRole('button', { name: 'Close flight crew', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.flight-dialog:modal')); await state(page, 'active');
    await page.mouse.move(1390, 730);
    const resumedAway = (await samples(glyph)).slice(-3);
    await moveTo(page, glyph);
    const resumed = await samples(glyph, 900);
    check('Closing Flight crew resumes pointer-reactive type', difference(meanPose(resumedAway), meanPose(resumed.slice(-3))) > .01 && meanInk(resumed.slice(-3)) > meanInk(resumedAway) + .01, { before: meanInk(resumedAway), after: meanInk(resumed.slice(-3)) });
    check('Existing depth-letter entrance layers remain settled', await page.locator('.tunnel-hero .depth-letter').evaluateAll(elements => elements.every(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).isIdentity)));
  });

  await scenario('phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async page => {
    await semantics(page, 'Phone'); await readability(page, 'Phone');
    await capture(page, '05-phone');
  });

  await scenario('reduced-motion-phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }, async page => {
    await state(page, 'reduced'); await semantics(page, 'Reduced-motion phone'); await readability(page, 'Reduced-motion phone');
    const quiet = [];
    for (const selector of [selectors.glyph, selectors.word, selectors.entryLabel, selectors.browseLabel]) {
      const values = await samples(page.locator(selector).first());
      quiet.push({ selector, variation: variation(values), animations: values.some(value => value.runningAnimations > 0) });
    }
    check('Reduced motion leaves headline, copy and both action labels stationary', quiet.every(result => result.variation < .0001 && !result.animations), quiet);
    await capture(page, '06-reduced-motion-phone');
  });

  if (process.env.TYPE_VIDEO === '1') {
    await scenario('motion-demo', { recordVideo: { dir: output, size: { width: 960, height: 600 } } }, async page => {
      await state(page, 'active');
      const started = performance.now();
      await page.mouse.move(1380, 720);
      await samples(page.locator(selectors.glyph).nth(2), 1000);
      await moveTo(page, page.locator(selectors.glyph).nth(2));
      await samples(page.locator(selectors.glyph).nth(2), 1400);
      await moveTo(page, page.locator(selectors.word).nth(2));
      await samples(page.locator(selectors.word).nth(2), 1000);
      await moveTo(page, page.locator('.tunnel-entry-button'));
      const remaining = Math.max(0, 6000 - (performance.now() - started));
      await samples(page.locator(selectors.entryLabel).first(), remaining);
      captures.push({ name: 'motion-demo', file: await page.video().path(), approximateDemonstrationSeconds: 6 });
    });
  }
} finally {
  await browser.close();
  await writeFile(`${output}/verification.json`, JSON.stringify({ base, checks, errors, captures }, null, 2));
}
if (checks.some(result => !result.passed) || errors.length) process.exitCode = 1;
