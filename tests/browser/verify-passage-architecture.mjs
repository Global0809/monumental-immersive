import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5184/';
const output = process.env.PASSAGE_OUTPUT || 'output/playwright/reference-tunnel-review';
const chapters = [
  ['world', 'The World'], ['time-machine', 'Time Machine'], ['movies', 'The Cinema'],
  ['music', 'Music'], ['culture', 'Culture'], ['my-world', 'My World'],
];
const checks = [], errors = [], measurements = [], limitations = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
let currentPage;
const address = route => { const url = new URL(base); url.hash = route; return url.href; };
function check(name, value, detail = '') {
  assert.ok(value, `${name}: ${detail}`);
  checks.push({ name, passed: true, detail }); console.log(`PASS ${name}`);
}
function observe(page, name) {
  currentPage = page; page.setDefaultTimeout(20_000);
  page.on('pageerror', error => errors.push({ scenario: name, message: error.message }));
}
async function scenario(name, run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  try { await instrument(context); await run(context); }
  catch (error) {
    checks.push({ name, passed: false, detail: error.stack }); console.error(`FAIL ${name}: ${error.message}`);
    await currentPage?.screenshot({ path: `${output}/failure-${name}.png` }).catch(() => {});
  } finally { await context.close(); }
}
async function instrument(context) {
  await context.addInitScript(() => {
    const videos = [], draws = new WeakMap();
    const createElement = Document.prototype.createElement;
    Document.prototype.createElement = function (...args) {
      const element = createElement.apply(this, args);
      if (String(args[0]).toLowerCase() === 'video') videos.push(element);
      return element;
    };
    for (const kind of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
      const prototype = window[kind]?.prototype;
      if (!prototype) continue;
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const original = prototype[method]; if (!original) continue;
        prototype[method] = function (...args) {
          if (this.canvas?.classList?.contains('spatial-world-canvas')) draws.set(this.canvas, (draws.get(this.canvas) || 0) + 1);
          return original.apply(this, args);
        };
      }
    }
    window.__passageAudit = {
      videos: () => videos.filter(video => video.dataset.passageAmbient === 'true').map(video => ({
        chapter: video.dataset.mediaChapter, status: video.dataset.mediaStatus,
        src: video.currentSrc || video.getAttribute('src') || '', time: video.currentTime,
        paused: video.paused, ready: video.readyState, connected: video.isConnected,
      })),
      draws: () => [...document.querySelectorAll('canvas.spatial-world-canvas')].reduce((sum, canvas) => sum + (draws.get(canvas) || 0), 0),
    };
  });
}
async function ready(page, fallback = false) {
  await page.locator('.tunnel-journey').waitFor();
  if (fallback) await page.locator('.spatial-world--fallback').waitFor();
  else await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
  await page.evaluate(() => document.fonts.ready);
}
function panel(page, id) { return page.locator(`[data-tunnel-station="${id}"] .tunnel-panel`); }
async function station(page, index, compact = false) {
  if (compact && await page.getByRole('combobox', { name: 'Choose Passage station', exact: true }).isVisible()) await page.getByRole('combobox', { name: 'Choose Passage station', exact: true }).selectOption(String(index));
  else await page.getByRole('button', { name: `Travel to ${chapters[index][1]}`, exact: true }).click();
  if (compact) {
    await page.waitForFunction(index => {
      const section = document.querySelectorAll('.tunnel-checkpoint')[index];
      if (!section) return false;
      const target = Math.min(section.getBoundingClientRect().top + scrollY, document.documentElement.scrollHeight - innerHeight);
      return document.querySelector('.tunnel-mobile-station')?.value === String(index) && Math.abs(scrollY - target) < 3;
    }, index);
    await panel(page, chapters[index][0]).getByRole('heading', { level: 2 }).waitFor();
  } else {
    await page.waitForFunction(id => {
      const host = document.querySelector('[data-passage-chapter]'), mount = document.querySelector(`[data-tunnel-station="${id}"]`);
      return host?.dataset.passageChapter === id && host.dataset.passageReading === 'true' && mount?.getAttribute('aria-hidden') === 'false' && !mount.inert;
    }, chapters[index][0]);
    await page.waitForFunction(index => {
      const section = document.querySelectorAll('.tunnel-checkpoint')[index];
      const target = Math.min(section.getBoundingClientRect().top + scrollY + section.offsetHeight * .46, document.documentElement.scrollHeight - innerHeight);
      return Math.abs(scrollY - target) < 2;
    }, index);
  }
  await page.mouse.move(1400, 90).catch(() => {});
}
async function swipe(page, context) {
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 365, y: 690 }] });
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 365, y: 690 - 420 * step / 12 }] });
    await page.waitForTimeout(18);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(450); await session.detach();
}
async function progress(page, index, amount) {
  const target = await page.evaluate(({ index, amount }) => {
    const section = document.querySelectorAll('.tunnel-checkpoint')[index];
    const top = section.getBoundingClientRect().top + scrollY + section.offsetHeight * amount;
    window.scrollTo({ top, behavior: 'instant' });
    return Math.min(top, document.documentElement.scrollHeight - innerHeight);
  }, { index, amount });
  await page.waitForFunction(target => Math.abs(scrollY - target) < 2, target);
  await page.waitForFunction(id => document.querySelector('[data-passage-chapter]')?.dataset.passageChapter === id, chapters[index][0]);
  await page.waitForTimeout(80);
}
async function ambient(page, id, playing = true) {
  await page.waitForFunction(({ id, playing }) => window.__passageAudit.videos().some(video => video.chapter === id && video.src && (playing ? !video.paused && video.ready >= 2 && video.status === 'playing' : video.paused)), { id, playing });
}
async function frameMeasurement(page, name, milliseconds = 1500) {
  const result = await page.evaluate(milliseconds => new Promise(resolve => {
    const host = document.querySelector('[data-passage-draw-calls]');
    if (!host) { resolve({ frames: 0, maxDrawCalls: 0 }); return; }
    const times = [], calls = [], start = performance.now();
    const observer = new MutationObserver(records => {
      if (records.some(record => record.attributeName === 'data-passage-draw-calls')) { times.push(performance.now()); calls.push(Number(host.dataset.passageDrawCalls)); }
    });
    observer.observe(host, { attributes: true, attributeFilter: ['data-passage-draw-calls'] });
    setTimeout(() => {
      observer.disconnect();
      const intervals = times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b);
      resolve({ frames: times.length, durationMs: performance.now() - start, medianIntervalMs: intervals[Math.floor(intervals.length * .5)] || 0,
        p95IntervalMs: intervals[Math.floor(intervals.length * .95)] || 0, maxDrawCalls: Math.max(0, ...calls) });
    }, milliseconds);
  }), milliseconds);
  measurements.push({ name, ...result }); return result;
}
async function resourceSnapshot(page) {
  return page.evaluate(async () => {
    // Reuse the exact loaded dev module URL rather than importing a second GSAP
    // instance whose registry would misleadingly appear empty.
    const triggerModule = performance.getEntriesByType('resource').find(entry => /gsap_ScrollTrigger\.js/.test(entry.name));
    const ScrollTrigger = triggerModule ? (await import(triggerModule.name)).ScrollTrigger : null;
    return { ambientSources: window.__passageAudit.videos().filter(video => video.src).length,
      passageCanvases: document.querySelectorAll('canvas.spatial-world-canvas').length,
      cssScenes: document.querySelectorAll('.tunnel-css-world').length,
      panels: document.querySelectorAll('[data-tunnel-station]').length,
      triggers: ScrollTrigger?.getAll().length ?? null };
  });
}

try {
  await scenario('desktop-journey', async context => {
    const page = await context.newPage(); observe(page, 'desktop');
    await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page);
    check('Desktop opens as the spatial Passage with the existing statement and entrance action', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'false' && await page.locator('.tunnel-hero h1').innerText().then(text => /CULTURE/.test(text) && /BORDERS/.test(text)) && await page.getByRole('button', { name: 'ENTER THE WORLD', exact: true }).isVisible());
    await ambient(page, 'world');
    await page.screenshot({ path: `${output}/00-opening.png` });
    const baseline = await resourceSnapshot(page);
    let readingMediaMask = '';
    for (let index = 0; index < chapters.length; index++) {
      const [id, title] = chapters[index]; await station(page, index); await ambient(page, id);
      const state = await page.evaluate(id => ({ readable: [...document.querySelectorAll('[data-tunnel-station]')].filter(node => node.getAttribute('aria-hidden') === 'false' && !node.inert).map(node => node.dataset.tunnelStation),
        headings: document.querySelectorAll(`#tunnel-heading-${id}`).length, videos: window.__passageAudit.videos().filter(video => video.src && !video.paused).length }), id);
      check(`${title}: one readable chapter, one interface and one moving ambient source`, state.readable.length === 1 && state.readable[0] === id && state.headings === 1 && state.videos === 1, JSON.stringify(state));
      await progress(page, index, .42); const start = await panel(page, id).boundingBox();
      await progress(page, index, .68); const finish = await panel(page, id).boundingBox();
      const delta = Math.max(...['x', 'y', 'width', 'height'].map(key => Math.abs(start[key] - finish[key])));
      check(`${title}: CSS3D content holds exactly still through the reading range`, delta < .75, `${delta.toFixed(4)} px`);
      await progress(page, index, .5); await page.screenshot({ path: `${output}/${String(index + 1).padStart(2, '0')}-${id}.png` });
      await frameMeasurement(page, title, 650);
      if (index === 0) {
        const protection = await page.locator('.flight-media-mask').evaluate(element => ({ enabled: element.dataset.protected === 'true', clip: element.style.clipPath, supported: CSS.supports('clip-path', element.style.clipPath), actual: getComputedStyle(element).clipPath }));
        readingMediaMask = protection.clip;
        check('Projected 3D footage has a supported active exclusion mask for decorative drones', protection.enabled && protection.supported && protection.clip.startsWith('path(evenodd,') && protection.actual !== 'none', JSON.stringify(protection));
      }
    }
    for (const index of [0, 5, 1, 4, 2]) await progress(page, index, .5);
    check('Fast forward/reverse scroll settles on the final requested chapter', await page.locator('[data-passage-chapter]').getAttribute('data-passage-chapter') === 'movies' && await panel(page, 'movies').getByRole('link', { name: 'Enter the cinema', exact: true }).isVisible());
    const keyboardY = await page.evaluate(() => { document.activeElement?.blur(); return scrollY; });
    await page.keyboard.press('PageDown');
    await page.waitForFunction(previous => scrollY > previous + 100, keyboardY);
    check('Keyboard PageDown keeps native control of journey scroll', await page.evaluate(previous => scrollY > previous + 100, keyboardY));
    await page.evaluate(() => new Promise(resolve => {
      let previous = scrollY, stable = 0;
      function sample() { stable = scrollY === previous ? stable + 1 : 0; previous = scrollY; if (stable > 4) resolve(); else requestAnimationFrame(sample); }
      requestAnimationFrame(sample);
    }));
    for (const [index, amount, label] of [[0, .2, '07-world-approach'], [3, .9, '08-music-departure']]) {
      await progress(page, index, amount);
      await page.screenshot({ path: `${output}/${label}.png` });
    }
    await progress(page, 0, .3);
    const travellingMediaMask = await page.locator('.flight-media-mask').evaluate(element => ({ enabled: element.dataset.protected === 'true', clip: element.style.clipPath }));
    check('Media exclusion follows the projected carrier during scroll instead of retaining reading bounds', travellingMediaMask.enabled && travellingMediaMask.clip !== readingMediaMask && !/NaN|Infinity/.test(travellingMediaMask.clip), JSON.stringify(travellingMediaMask));
    await station(page, 2);
    const cinema = panel(page, 'movies'), inspect = cinema.getByRole('button', { name: 'Inspect The Cinema exhibit', exact: true });
    await inspect.click();
    await cinema.getByRole('button', { name: 'Rotate The Cinema sculpture right', exact: true }).click();
    check('Inspect opens and rotation updates the visible angle', await cinema.locator('.tunnel-inspection-heading').innerText().then(text => text.includes('30°')));
    await cinema.getByRole('button', { name: 'Reset', exact: true }).click();
    check('Inspection reset returns to zero', await cinema.getByRole('button', { name: 'Reset', exact: true }).isDisabled());
    await page.keyboard.press('Escape');
    check('Escape closes the exhibit and restores its trigger focus', await inspect.getAttribute('aria-expanded') === 'false' && await inspect.evaluate(element => element === document.activeElement));
    await inspect.click(); await station(page, 3);
    check('Jumping after inspection clears the previous expanded state', await page.locator('.tunnel-panel[data-expanded="true"]').count() === 0 && await panel(page, 'music').getByRole('link', { name: 'Explore music', exact: true }).isVisible());
    await station(page, 2); await ambient(page, 'movies');
    await cinema.getByRole('button', { name: 'Play Sintel', exact: true }).click();
    await page.locator('.ms-player-dialog:modal').waitFor(); await ambient(page, 'movies', false);
    await page.waitForFunction(() => { const video = document.querySelector('.ms-player-dialog video'); return video && !video.paused && video.readyState >= 2 && video.currentTime > .1; }, null, { timeout: 40_000 });
    check('Cinema opens the existing complete-film player while ambient media pauses', await page.locator('.ms-player-dialog video').evaluate(video => video.currentSrc.includes('video.blender.org')));
    const pausedDraws = await page.evaluate(() => window.__passageAudit.draws()); await page.waitForTimeout(400);
    check('Full player suspends actual Passage rendering', await page.evaluate(() => window.__passageAudit.draws()) === pausedDraws);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.ms-player-dialog:modal'));
    await ambient(page, 'movies');
    check('Closing the player resumes its ambient scene without losing the chapter', await page.locator('[data-passage-chapter]').getAttribute('data-passage-chapter') === 'movies');
    await station(page, 0); await panel(page, 'world').getByRole('link', { name: 'Explore the world', exact: true }).click();
    await page.waitForURL(current => current.hash.startsWith('#/world'));
    await page.getByRole('group', { name: 'Choose a destination', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Monumental — The Passage', exact: true }).click(); await ready(page);
    await station(page, 0); await ambient(page, 'world');
    const returned = await resourceSnapshot(page);
    check('Leaving and returning preserves one scene, decoder, six interfaces and scoped trigger count', returned.passageCanvases === 1 && returned.cssScenes === 1 && returned.panels === 6 && returned.ambientSources === 1 && returned.triggers === baseline.triggers, JSON.stringify({ baseline, returned }));
    // Real browser tab visibility; no synthetic visibility override.
    const hidden = await context.newPage(); await hidden.goto('about:blank'); await hidden.bringToFront();
    const actuallyHidden = await page.evaluate(() => document.hidden);
    if (actuallyHidden) {
      await page.waitForTimeout(200); const before = await page.evaluate(() => ({ video: window.__passageAudit.videos().find(video => video.src), draws: window.__passageAudit.draws() }));
      await page.waitForTimeout(500); const after = await page.evaluate(() => ({ video: window.__passageAudit.videos().find(video => video.src), draws: window.__passageAudit.draws() }));
      check('A genuinely hidden browser tab pauses ambient decoding and rendering', after.video.paused && Math.abs(after.video.time - before.video.time) < .1 && after.draws === before.draws);
    } else limitations.push('Headless Chrome kept both tabs visible; hidden-tab dispatch is covered by media lifecycle tests, not a genuine hidden-tab browser observation.');
    await hidden.close(); await page.bringToFront(); await ambient(page, 'world');
  });

  await scenario('saved-collection', async context => {
    await context.addInitScript(() => localStorage.setItem('monumental.viewer.v1', JSON.stringify({ saved: ['sintel-full', 'miami-frequency'] })));
    const page = await context.newPage(); observe(page, 'saved-collection');
    await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page); await station(page, 5);
    await panel(page, 'my-world').getByText('From your collection · 2 saved stories', { exact: true }).waitFor();
    check('My World presents the visitor’s real saved film and collection count', await panel(page, 'my-world').getByRole('button', { name: 'Play Sintel', exact: true }).isVisible());
    await page.waitForTimeout(250); await page.screenshot({ path: `${output}/06-my-world-saved.png` });
    const writer = await context.newPage();
    const storageAddress = new URL('_passage-storage-test', base).href;
    await writer.route(storageAddress, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Collection update test</title>' }));
    await writer.goto(storageAddress);
    await writer.evaluate(() => localStorage.setItem('monumental.viewer.v1', JSON.stringify({ saved: [] })));
    await panel(page, 'my-world').getByText('Your collection starts with a story. An editorial selection to begin.', { exact: true }).waitFor();
    check('A cross-tab collection change restores the honest editorial empty state', await panel(page, 'my-world').getByRole('button', { name: 'Play Tokyo / In Your Own Image', exact: true }).isVisible());
    await writer.close();
  });

  await scenario('compact-phone', async context => {
    await context.close();
    const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
    try {
      await instrument(phoneContext); const page = await phoneContext.newPage(); observe(page, 'phone');
      await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page);
      check('Phone uses the compact architectural presentation', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true');
      for (let index = 0; index < chapters.length; index++) {
        await station(page, index, true); await ambient(page, chapters[index][0]);
        const surface = panel(page, chapters[index][0]);
        check(`Phone ${chapters[index][1]}: usable text, action and a single media host`, await surface.getByRole('heading', { level: 2 }).isVisible() && await surface.locator('.tunnel-enter-room').isVisible() && await page.locator('.passage-ambient-video').count() === 1);
      }
      check('Phone content stays within the viewport', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await station(page, 3, true); await page.screenshot({ path: `${output}/phone-music.png` });
      check('Compact presentation clears the WebGL-only media exclusion mask', await page.locator('.flight-media-mask').getAttribute('data-protected') === 'false' && await page.locator('.flight-media-mask').evaluate(element => element.style.clipPath === ''));
      await page.waitForTimeout(550);
      const y = await page.evaluate(() => scrollY); await swipe(page, phoneContext);
      check('Compact page retains native scrolling', await page.evaluate(old => scrollY > old + 100, y));
    } finally { await phoneContext.close(); }
  });

  await scenario('presentation-resize', async context => {
    const page = await context.newPage(); observe(page, 'resize');
    await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page);
    await station(page, 3); await ambient(page, 'music');
    const originalNodes = await panel(page, 'music').evaluate(element => {
      element.dataset.resizeIdentity = 'original-music-interface';
      return document.querySelectorAll('[data-tunnel-station]').length;
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.tunnel-journey')?.dataset.compact === 'true' && document.querySelector('.tunnel-mobile-station')?.value === '3');
    await ambient(page, 'music');
    const compact = await panel(page, 'music').evaluate(element => ({
      same: element.dataset.resizeIdentity === 'original-music-interface',
      top: element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom,
      viewport: innerHeight,
      readable: !element.closest('[inert]') && element.closest('[data-tunnel-station]')?.getAttribute('aria-hidden') !== 'true',
    }));
    check('Desktop-to-phone resizing preserves the selected chapter and its actual DOM interface', compact.same && compact.readable && compact.bottom > 140 && compact.top < compact.viewport, JSON.stringify(compact));
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => document.querySelector('.tunnel-mobile-station')?.value === '3');
    await page.waitForTimeout(250);
    check('Phone rotation preserves the active chapter with no horizontal overflow', await page.locator('.tunnel-mobile-station').inputValue() === '3' && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => document.querySelector('.tunnel-journey')?.dataset.compact === 'false' && document.querySelector('[data-passage-chapter]')?.dataset.passageChapter === 'music' && document.querySelector('[data-passage-reading]')?.dataset.passageReading === 'true');
    const desktop = await panel(page, 'music').evaluate(element => ({
      same: element.dataset.resizeIdentity === 'original-music-interface',
      mounted: element.closest('[data-tunnel-station]')?.dataset.tunnelMounted === 'true',
      count: document.querySelectorAll('[data-tunnel-station]').length,
    }));
    check('Phone-to-desktop resizing restores the same interface to the 3D scene without duplication', desktop.same && desktop.mounted && desktop.count === originalNodes, JSON.stringify(desktop));
  });

  await scenario('short-landscape', async context => {
    const page = await context.newPage(); observe(page, 'landscape'); await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page);
    await station(page, 4, true);
    check('Short landscape uses compact mode without horizontal overflow', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true' && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const arrival = await panel(page, 'culture').evaluate(surface => {
      const headerBottom = document.querySelector('.site-header').getBoundingClientRect().bottom;
      return { headerBottom, labelTop: surface.querySelector('.tunnel-panel-top > span').getBoundingClientRect().top, inspectTop: surface.querySelector('.tunnel-panel-top button').getBoundingClientRect().top };
    });
    check('Landscape chapter label and Inspect arrive below the fixed header', arrival.labelTop >= arrival.headerBottom && arrival.inspectTop >= arrival.headerBottom, JSON.stringify(arrival));
    await page.screenshot({ path: `${output}/landscape-culture.png` });
    await panel(page, 'culture').locator('.tunnel-enter-room').scrollIntoViewIfNeeded();
    check('Landscape chapter action remains reachable', await panel(page, 'culture').locator('.tunnel-enter-room').isVisible());
    await page.screenshot({ path: `${output}/landscape-culture-action.png` });
  });

  await scenario('portrait-tablet', async context => {
    const page = await context.newPage(); observe(page, 'tablet'); await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page);
    await station(page, 4, true); await ambient(page, 'culture');
    const bounds = await panel(page, 'culture').evaluate(element => {
      const heading = element.querySelector('h2').getBoundingClientRect(), action = element.querySelector('.tunnel-enter-room').getBoundingClientRect();
      return { heading: { left: heading.left, right: heading.right, top: heading.top }, action: { left: action.left, right: action.right, bottom: action.bottom }, width: innerWidth, navTop: document.querySelector('.tunnel-wayfinder').getBoundingClientRect().top, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    check('Portrait tablet uses native-flow chapter content with readable text and reachable action', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true' && bounds.heading.left >= 0 && bounds.heading.right <= bounds.width && bounds.heading.top >= 75 && bounds.action.left >= 0 && bounds.action.right <= bounds.width && bounds.action.bottom <= bounds.navTop && !bounds.overflow, JSON.stringify(bounds));
    await page.screenshot({ path: `${output}/tablet-culture.png` });
    const y = await page.evaluate(() => scrollY); await page.mouse.wheel(0, 380);
    await page.waitForFunction(previous => scrollY > previous + 100, y);
    check('Portrait tablet retains native scrolling through the collection', await page.evaluate(previous => scrollY > previous + 100, y));
  });

  await scenario('small-desktop', async context => {
    const page = await context.newPage(); observe(page, 'small-desktop'); await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page);
    await station(page, 0); await ambient(page, 'world');
    const bounds = await panel(page, 'world').evaluate(element => {
      const heading = element.querySelector('h2').getBoundingClientRect(), action = element.querySelector('.tunnel-enter-room').getBoundingClientRect();
      return { heading: { left: heading.left, right: heading.right, top: heading.top }, action: { left: action.left, right: action.right, bottom: action.bottom }, width: innerWidth, headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom, navTop: document.querySelector('.tunnel-wayfinder').getBoundingClientRect().top };
    });
    check('1280 × 720 desktop preserves spatial mode and readable headline/action', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'false' && bounds.heading.left >= 0 && bounds.heading.right <= bounds.width && bounds.heading.top >= bounds.headerBottom && bounds.action.left >= 0 && bounds.action.right <= bounds.width && bounds.action.bottom <= bounds.navTop, JSON.stringify(bounds));
    await page.screenshot({ path: `${output}/desktop-1280-world.png` });
    await page.evaluate(() => { window.__originalFlightCanvas = document.querySelector('.flight-canvas'); });
    await page.getByRole('button', { name: /^Flight crew/ }).click(); await page.locator('.flight-dialog:modal').waitFor();
    check('Passage crew viewer reuses its canvas and removes the footage exclusion inside the dialog', await page.evaluate(() => document.querySelector('.flight-view .flight-canvas') === window.__originalFlightCanvas && document.querySelector('.flight-view .flight-media-mask')?.dataset.protected === 'false'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.flight-dialog:modal') && document.querySelector('.flight-environment .flight-media-mask')?.dataset.protected === 'true');
    check('Closing the crew viewer restores the same masked canvas and trigger focus', await page.evaluate(() => document.querySelector('.flight-environment .flight-canvas') === window.__originalFlightCanvas && document.activeElement?.classList.contains('flight-invitation')));
  });

  await scenario('reduced-motion', async context => {
    const page = await context.newPage(); observe(page, 'reduced'); await page.emulateMedia({ reducedMotion: 'reduce' });
    const ambientRequests = [];
    page.on('request', request => { if (/\/media\/[^?]*\.mp4(?:\?|$)/.test(request.url())) ambientRequests.push(request.url()); });
    await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page);
    await station(page, 2, true);
    check('Reduced motion retains all six single DOM chapters and poster presentation', await page.locator('.tunnel-panel').count() === 6 && await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true' && await panel(page, 'movies').locator('.tunnel-compact-window img').isVisible());
    check('Reduced motion plays no ambient decoders', await page.evaluate(() => window.__passageAudit.videos().every(video => video.paused)));
    check('Reduced motion requests no ambient video data', ambientRequests.length === 0, JSON.stringify(ambientRequests));
    // Poster textures legitimately demand a frame as remote images arrive.
    // Wait for a bounded quiet window; an actual continuous loop cannot pass.
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    const settled = await page.evaluate(async () => {
      const started = performance.now(); let count = window.__passageAudit.draws(), quietSince = started;
      while (performance.now() - started < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const next = window.__passageAudit.draws();
        if (next !== count) { count = next; quietSince = performance.now(); }
        if (performance.now() - quietSince >= 600) return true;
      }
      return false;
    });
    check('Reduced motion does not continuously render the Passage', settled);
  });

  await scenario('webgl-unavailable', async context => {
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (name, ...args) { return /webgl|experimental-webgl/.test(String(name)) ? null : original.call(this, name, ...args); };
    });
    const page = await context.newPage(); observe(page, 'no-webgl');
    await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page, true);
    check('Unavailable WebGL keeps six readable single DOM interfaces', await page.locator('.tunnel-panel').count() === 6 && await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true');
    await station(page, 3, true); await ambient(page, 'music');
    check('Unavailable WebGL retains a working compact ambient preview and real destination action', await panel(page, 'music').locator('.tunnel-enter-room').isVisible() && await page.locator('.passage-ambient-video').count() === 1);
  });

  await scenario('context-loss', async context => {
    const page = await context.newPage(); observe(page, 'context-loss'); await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page);
    await station(page, 1); await ambient(page, 'time-machine');
    const lost = await page.locator('canvas.spatial-world-canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); const extension = gl?.getExtension('WEBGL_lose_context');
      if (!extension) return false; extension.loseContext(); return true;
    });
    assert.ok(lost, 'Browser must support deliberate WebGL context loss');
    await page.locator('.spatial-world--fallback').waitFor();
    await station(page, 1, true); await ambient(page, 'time-machine');
    check('A lost WebGL context restores compact content and keeps media available', await page.locator('.tunnel-panel').count() === 6 && await panel(page, 'time-machine').getByRole('link', { name: 'Enter the Time Machine', exact: true }).isVisible() && await page.locator('.passage-ambient-video').count() === 1);
  });

  await scenario('blocked-media', async context => {
    const page = await context.newPage(); observe(page, 'blocked-media'); await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/media/break-beat-city.mp4', route => route.abort());
    await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page); await station(page, 1, true);
    await page.waitForFunction(() => window.__passageAudit.videos().some(video => video.chapter === 'time-machine' && video.status === 'failed'));
    check('Blocked media shows the real poster and preserves story controls', await panel(page, 'time-machine').getByText('Preview unavailable. Open the story to watch.', { exact: true }).isVisible() && await panel(page, 'time-machine').locator('.tunnel-compact-window img').evaluate(image => image.complete && image.naturalWidth > 0) && await panel(page, 'time-machine').locator('.tunnel-enter-room').isVisible());
  });
  check('No uncaught exceptions in the combined Passage review', errors.length === 0, JSON.stringify(errors));
} catch (error) { checks.push({ name: 'review-runner', passed: false, detail: error.stack }); console.error(error); }
finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, errors, measurements, limitations }, null, 2));
  await browser.close();
  console.log(`${checks.filter(check => check.passed).length} passed; ${checks.filter(check => !check.passed).length} failed.`);
  if (checks.some(check => !check.passed)) process.exitCode = 1;
}
