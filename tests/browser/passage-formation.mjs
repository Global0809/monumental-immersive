// Native-scroll regression review of the visible, bounded mechanical reveal.
// node tests/browser/passage-formation.mjs [base] [all|desktop|compact|reduced]
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://127.0.0.1:5184').replace(/\/$/, '');
const selected = process.argv[3] || 'all';
const out = process.env.FORMATION_OUTPUT || 'output/playwright/passage-formation';
const chapters = [['world', 'The World'], ['time-machine', 'Time Machine'], ['movies', 'The Cinema'], ['music', 'Music'], ['culture', 'Culture'], ['my-world', 'My World']];
const report = { base, checkedAt: new Date().toISOString(), checks: [], measurements: [], errors: [], notes: ['Chromium with real WebGL and native document scroll; compact layouts are emulated, not physical-device performance guarantees.'] };
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const check = (name, passed, detail) => { report.checks.push({ name, passed: !!passed, detail }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); assert.ok(passed, name); };
const mount = (page, index) => page.locator(`[data-tunnel-station="${chapters[index][0]}"]`);

async function ready(page) {
  await page.goto(base + '/#/');
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const loaded = name => performance.getEntriesByType('resource').find(item => item.name.includes('/src/services/' + name + '.ts'))?.name || '/src/services/' + name + '.ts';
    window.__formationJourney = await import(loaded('tunnelJourney'));
    window.__formationAssembly = await import(loaded('passageAssembly'));
    window.__formationSamples = [];
    window.__formationSample = index => {
      const el = document.querySelectorAll('[data-tunnel-station]')[index];
      if (!el) return null;
      return { time: performance.now(), phase: Number(el.dataset.assemblyProgress), screen: Number(el.dataset.assemblyScreen), lock: Number(el.dataset.assemblyLock), content: Number(el.dataset.assemblyContent), opacity: Number(el.style.opacity), readable: !el.inert && el.getAttribute('aria-hidden') === 'false', finish: Number(el.dataset.assemblySettle || 0), scroll: scrollY, frame: window.__formationJourney.getTunnelFrame(), calls: Number(document.querySelector('[data-passage-draw-calls]')?.dataset.passageDrawCalls || 0) };
    };
    window.__formationObserve = index => {
      cancelAnimationFrame(window.__formationObserver);
      window.__formationSamples = [];
      const sample = () => { window.__formationSamples.push(window.__formationSample(index)); window.__formationObserver = requestAnimationFrame(sample); };
      sample();
    };
    window.__formationStop = () => { cancelAnimationFrame(window.__formationObserver); return window.__formationSamples; };
  });
}

async function scroll(page, index, progress, delay = 0) {
  const resolvedProgress = await page.evaluate(({ index, progress }) => {
    const section = document.querySelectorAll('.tunnel-checkpoint')[index];
    const sectionTop = section.getBoundingClientRect().top + scrollY;
    const top = Math.min(sectionTop + section.offsetHeight * progress, document.documentElement.scrollHeight - innerHeight);
    window.scrollTo({ top, behavior: 'instant' });
    return (top - sectionTop) / section.offsetHeight;
  }, { index, progress });
  // scrollTo updates scrollY before the passive scroll listener publishes the
  // journey frame. Do not accidentally compare an old pose to an old target.
  await page.waitForFunction(({ index, progress }) => {
    const frame = window.__formationJourney.getTunnelFrame();
    return frame.active === index && Math.abs(frame.progress - progress) < .002;
  }, { index, progress: resolvedProgress });
  if (delay) await page.waitForTimeout(delay);
}
const sample = (page, index) => page.evaluate(index => window.__formationSample(index), index);
async function settled(page, index) {
  await page.waitForFunction(index => {
    const el = document.querySelectorAll('[data-tunnel-station]')[index];
    return Number(el?.dataset.assemblyProgress) > .999 && el.getAttribute('aria-hidden') === 'false' && !el.inert;
  }, index);
}
async function capture(page, name) { await page.screenshot({ path: `${out}/${name}.png` }); }
async function scenario(name, options, work) {
  if (selected !== 'all' && !selected.split(',').includes(name)) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push({ scenario: name, message: error.message }));
  page.on('console', message => { if (/WebGLProgram|shader error|VALIDATE_STATUS/.test(message.text())) report.errors.push({ scenario: name, message: message.text() }); });
  try { await ready(page); await work(page, context); }
  catch (error) { report.checks.push({ name, passed: false, detail: error.stack }); await capture(page, `failure-${name}`).catch(() => {}); }
  finally { await context.close(); }
}

try {
  await scenario('desktop', {}, async page => {
    await capture(page, '00-opening');
    const steps = [0, .06, .12, .18, .24, .30, .34, .38, .5];
    for (let index = 0; index < 6; index++) {
      const observations = [];
      for (const p of steps) {
        await scroll(page, index, p, 260);
        observations.push({ requested: p, ...await sample(page, index) });
        if ([0, 4].includes(index) && [.12, .18, .24, .34].includes(p)) await capture(page, `${index + 1}-${chapters[index][0]}-forming-${String(p).slice(2)}`);
      }
      await settled(page, index);
      const read = await sample(page, index);
      report.measurements.push({ chapter: chapters[index][0], observations, read });
      check(`${chapters[index][1]} unfolds through distinct intermediate states`, observations.filter(x => x.phase > .01 && x.phase < .99).length >= 5 && observations.every((x, i) => i === 0 || x.phase >= observations[i - 1].phase - .005), observations);
      check(`${chapters[index][1]} keeps words hidden until the image and doors clear`, observations.every(x => x.opacity <= .001 || x.screen >= .999) && observations.every(x => !x.readable || x.lock >= .999), observations);
      check(`${chapters[index][1]} finishes at one complete, usable pose`, read.phase === 1 && read.screen === 1 && read.lock === 1 && read.content === 1 && read.readable, read);
      const bounds = await mount(page, index).evaluate(el => {
        const heading = el.querySelector('h2').getBoundingClientRect(), link = el.querySelector('.tunnel-enter-room').getBoundingClientRect();
        return { heading: { x: heading.x, right: heading.right, y: heading.y }, link: { bottom: link.bottom }, width: innerWidth, nav: document.querySelector('.tunnel-wayfinder').getBoundingClientRect().top, clip: el.style.clipPath };
      });
      check(`${chapters[index][1]} preserves readable framing and a bounded draw budget`, bounds.heading.x >= 0 && bounds.heading.right <= bounds.width && bounds.heading.y >= 60 && bounds.link.bottom < bounds.nav && bounds.clip === 'none' && read.calls < 450, { bounds, calls: read.calls });
      await capture(page, `${index + 1}-${chapters[index][0]}-reading`);
      const before = await mount(page, index).boundingBox(); await scroll(page, index, .67, 180); const after = await mount(page, index).boundingBox();
      check(`${chapters[index][1]} holds its reading composition`, Math.max(...['x', 'y', 'width', 'height'].map(k => Math.abs(before[k] - after[k]))) < .8);
    }

    await scroll(page, 4, 0, 300);
    await page.evaluate(() => window.__formationObserve(4));
    await scroll(page, 4, .5);
    await page.waitForTimeout(90); const early = await sample(page, 4);
    check('A skipped approach assembles instead of appearing complete immediately', early.phase < .75 && !early.readable, early);
    await settled(page, 4); await page.waitForTimeout(650);
    const skipped = await page.evaluate(() => window.__formationStop());
    report.measurements.push({ name: 'direct-culture-arrival', samples: skipped });
    const transitions = skipped.slice(1).map((x, i) => ({ dt: x.time - skipped[i].time, change: Math.abs(x.phase - skipped[i].phase) })).filter(x => x.dt < 70);
    check('The skipped approach contains gradual rendered stages without phase jumps', skipped.filter(x => x.phase > .04 && x.phase < .96).length > 12 && transitions.every(x => x.change < .12), { frames: skipped.length, intermediate: skipped.filter(x => x.phase > .04 && x.phase < .96).length, maxPhaseStep: Math.max(...transitions.map(x => x.change)) });
    check('Text never becomes interactive before the completed clamp', skipped.every(x => !x.readable || x.lock >= .999));
    const finish = skipped.filter(x => x.finish >= 0);
    check('The final registration follows completion and advances only once', finish.length > 5 && finish.every((x, i) => x.phase >= .998 && (i === 0 || x.finish >= finish[i - 1].finish)), { first: finish[0], last: finish.at(-1) });
    const stop1 = await sample(page, 4); await page.waitForTimeout(500); const stop2 = await sample(page, 4);
    check('Completed assembly remains stable while the environment continues', stop1.phase === stop2.phase && stop1.screen === stop2.screen && stop1.scroll === stop2.scroll);
    await page.waitForFunction(() => window.__formationSample(4).finish >= 1.2);
    check('Registration retires after its short finishing pass', (await sample(page, 4)).finish >= 1.2);

    await scroll(page, 4, .24);
    await page.waitForFunction(() => Math.abs(window.__formationSample(4).phase - window.__formationAssembly.samplePassageAssembly(4, window.__formationJourney.getTunnelFrame()).deployment) < .003);
    const reversed = await sample(page, 4);
    const expected = await page.evaluate(() => window.__formationAssembly.samplePassageAssembly(4, window.__formationJourney.getTunnelFrame()).deployment);
    check('Reverse scrolling reconstructs a safe partial mechanism', Math.abs(reversed.phase - expected) < .003 && !reversed.readable && reversed.content === 0, { reversed, expected });
    await scroll(page, 4, .5, 1700); await settled(page, 4);
    await scroll(page, 4, .96, 100); const departed = await sample(page, 4);
    check('Fast departure retracts the carrier before the camera passes it', departed.phase < .01 && !departed.readable, departed);
    for (const index of [1, 5, 0, 3]) await scroll(page, index, .5, 55);
    await settled(page, 3);
    check('Rapid multiple skips resolve only the final chapter controls', await page.evaluate(() => [...document.querySelectorAll('[data-tunnel-station]')].filter(el => !el.inert && el.getAttribute('aria-hidden') === 'false').map(el => el.dataset.tunnelStation).join(',') === 'music'));

    await scroll(page, 1, .5); await settled(page, 1);
    const inspect = mount(page, 1).getByRole('button', { name: 'Inspect Time Machine exhibit', exact: true });
    await inspect.click(); await mount(page, 1).getByRole('button', { name: 'Rotate Time Machine sculpture right', exact: true }).click();
    await mount(page, 1).getByRole('button', { name: 'Reset', exact: true }).click(); await page.keyboard.press('Escape');
    check('Inspect, rotation, reset and Escape retain ownership and focus', await inspect.getAttribute('aria-expanded') === 'false' && await inspect.evaluate(el => document.activeElement === el));
    await mount(page, 1).locator('.tunnel-story').click(); await page.locator('.ms-player-dialog:modal').waitFor(); await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.ms-player-dialog:modal'));
    check('Player opens and returns to the fully assembled chapter', await mount(page, 1).locator('.tunnel-enter-room').isVisible() && (await sample(page, 1)).readable);
    await page.evaluate(() => { location.hash = '#/world'; }); await page.waitForTimeout(650); await page.evaluate(() => { location.hash = '#/'; });
    await page.locator('.tunnel-journey[data-ready="true"]').waitFor(); await page.waitForTimeout(400);
    check('Route return keeps one renderer, one CSS scene and six semantic mounts', await page.evaluate(() => document.querySelectorAll('canvas.spatial-world-canvas').length === 1 && document.querySelectorAll('.tunnel-css-world').length === 1 && document.querySelectorAll('[data-tunnel-station]').length === 6));
  });

  await scenario('reverse', {}, async page => {
    for (let index = 0; index < 6; index++) {
      await scroll(page, index, .5); await settled(page, index);
      const closing = [];
      for (const progress of [.36, .30, .24, .18, .10, .02]) {
        await scroll(page, index, progress, 90);
        closing.push(await page.evaluate(index => {
          const visible = window.__formationSample(index);
          const target = window.__formationAssembly.samplePassageAssembly(index, window.__formationJourney.getTunnelFrame());
          return { ...visible, target: target.deployment };
        }, index));
        if (index === 4 && progress === .18) await capture(page, 'culture-reverse-safe-envelope');
      }
      check(`${chapters[index][1]} reverse joints stay within the current carrier clearance`, closing.every(x => x.phase <= x.target + .001 && !x.readable), closing);
      check(`${chapters[index][1]} returns to a closed cassette without stale text`, closing.at(-1).phase < .06 && closing.at(-1).content === 0);
      report.measurements.push({ chapter: chapters[index][0], closing });
    }
  });

  for (const [name, options] of [['compact', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }], ['reduced', { reducedMotion: 'reduce' }]]) {
    await scenario(name, options, async page => {
      for (let index = 0; index < 6; index++) {
        await mount(page, index).scrollIntoViewIfNeeded();
        check(`${name}: ${chapters[index][1]} retains direct readable content and action`, await mount(page, index).locator('h2').isVisible() && await mount(page, index).locator('.tunnel-enter-room').isVisible() && await mount(page, index).evaluate(el => !el.inert));
      }
      check(`${name}: no horizontal overflow or hidden formation gate`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.querySelector('.tunnel-journey').dataset.compact === 'true'));
      await capture(page, `${name}-my-world`);
    });
  }
  check('No runtime or shader compilation errors', report.errors.length === 0, report.errors);
} finally {
  await browser.close();
  await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.checks.filter(x => x.passed).length, total: report.checks.length, errors: report.errors.length, output: out }));
  if (report.checks.some(x => !x.passed)) process.exitCode = 1;
}
