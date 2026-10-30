// Real-browser regression review for articulated carriers and their DOM face.
// node tests/browser/verify-mechanism-clearance.mjs [base] [baseline|verify|approach]
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://127.0.0.1:5184').replace(/\/$/, '');
const mode = process.argv[3] || 'verify';
const out = `output/playwright/mechanism-clearance/${mode}`;
await mkdir(out, { recursive: true });
const chapters = [['world', 'The World'], ['time-machine', 'Time Machine'], ['movies', 'The Cinema'], ['music', 'Music'], ['culture', 'Culture'], ['my-world', 'My World']];
const report = { base, mode, checkedAt: new Date().toISOString(), checks: [], frames: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const check = (name, condition, detail) => { report.checks.push({ name, passed: !!condition, detail }); assert.ok(condition, name); };
const mount = (page, i) => page.locator(`[data-tunnel-station="${chapters[i][0]}"]`);
async function ready(page) {
  await page.goto(base + '/#/');
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const loaded = name => performance.getEntriesByType('resource').find(item => item.name.includes('/src/services/' + name + '.ts'))?.name || '/src/services/' + name + '.ts';
    window.__clearanceJourney = await import(loaded('tunnelJourney'));
    window.__clearanceAssembly = await import(loaded('passageAssembly'));
  });
}
async function progress(page, index, amount) {
  await page.mouse.move(1430, 20);
  await page.evaluate(({ index, amount }) => {
    const section = document.querySelectorAll('.tunnel-checkpoint')[index];
    window.scrollTo({ top: section.getBoundingClientRect().top + scrollY + section.offsetHeight * amount, behavior: 'instant' });
  }, { index, amount });
  await page.waitForTimeout(350);
  return page.evaluate(index => ({ frame: window.__clearanceJourney.getTunnelFrame(), assembly: window.__clearanceAssembly.samplePassageAssembly(index, window.__clearanceJourney.getTunnelFrame()) }), index);
}
async function capture(page, name, webgl = false) {
  await page.screenshot({ path: `${out}/${name}.png` });
  if (webgl) {
    const hide = await page.addStyleTag({ content: '.tunnel-css-world{display:none!important}' });
    await page.screenshot({ path: `${out}/${name}-webgl.png` });
    await hide.evaluate(el => el.remove());
  }
}
async function scenario(name, options, work) {
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
    for (let i = 0; i < (mode === 'approach' ? 1 : mode === 'baseline' ? 2 : 6); i++) {
      for (const p of (mode === 'approach' ? [.23, .24, .25, .26, .27, .31, .34] : [.12, .21, .27, .5])) {
        const sample = await progress(page, i, p); report.frames.push({ chapter: chapters[i][0], requested: p, ...sample });
        await capture(page, `${i + 1}-${chapters[i][0]}-${String(p).slice(2)}`, p === .5);
        check(chapters[i][0] + ' valid assembly at ' + p, Object.values(sample.assembly).every(value => typeof value === 'boolean' || Number.isFinite(value)));
      }
      if (mode === 'approach') continue;
      const state = await mount(page, i).evaluate(el => {
        const heading = el.querySelector('h2').getBoundingClientRect(), link = el.querySelector('.tunnel-enter-room').getBoundingClientRect();
        return { readable: !el.inert && el.getAttribute('aria-hidden') === 'false', opacity: el.style.opacity, heading: { x: heading.x, right: heading.right, y: heading.y }, link: { y: link.y, bottom: link.bottom }, width: innerWidth, nav: document.querySelector('.tunnel-wayfinder').getBoundingClientRect().top };
      });
      check(chapters[i][0] + ' reading face remains usable', state.readable && state.opacity === '1' && state.heading.x >= 0 && state.heading.right <= state.width && state.heading.y >= 60 && state.link.bottom < state.nav, state);
      await page.mouse.move(1090, 180); await page.waitForTimeout(650);
      await capture(page, `${i + 1}-${chapters[i][0]}-hover`);
    }
    if (mode !== 'verify') return;
    const forward = [];
    for (const p of [.12, .21, .27, .5]) forward.push((await progress(page, 1, p)).assembly);
    for (let j = 3; j >= 0; j--) { const reverse = (await progress(page, 1, [.12, .21, .27, .5][j])).assembly; check('Reversal reconstructs assembly ' + j, Object.keys(reverse).every(key => typeof reverse[key] === 'boolean' ? reverse[key] === forward[j][key] : Math.abs(reverse[key] - forward[j][key]) < .003)); }
    for (const i of [5, 0, 3, 1]) {
      await page.getByRole('button', { name: 'Travel to ' + chapters[i][1], exact: true }).click();
      await page.waitForFunction(id => { const el = document.querySelector(`[data-tunnel-station="${id}"]`); return el?.getAttribute('aria-hidden') === 'false' && !el.inert; }, chapters[i][0]);
      check('Jump resolves ' + chapters[i][0], await mount(page, i).evaluate(el => !el.inert));
    }
    const inspect = mount(page, 1).getByRole('button', { name: 'Inspect Time Machine exhibit', exact: true });
    await inspect.click(); await mount(page, 1).getByRole('button', { name: 'Rotate Time Machine sculpture right', exact: true }).click();
    await page.waitForTimeout(400); await capture(page, 'time-machine-inspection');
    await mount(page, 1).getByRole('button', { name: 'Reset', exact: true }).click(); await page.keyboard.press('Escape');
    check('Inspect closes and restores focus', await inspect.getAttribute('aria-expanded') === 'false' && await inspect.evaluate(el => document.activeElement === el));
    await mount(page, 1).locator('.tunnel-story').click(); await page.locator('.ms-player-dialog:modal').waitFor(); await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.ms-player-dialog:modal'));
    check('Player opens and returns to usable chapter', await mount(page, 1).locator('.tunnel-enter-room').isVisible());
  });
  if (mode === 'verify') {
    for (const [name, options] of [['compact', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }], ['reduced', { reducedMotion: 'reduce' }]]) {
      await scenario(name, options, async page => {
        for (let i = 0; i < 6; i++) {
          await mount(page, i).scrollIntoViewIfNeeded();
          check(name + ' content and action ' + chapters[i][0], await mount(page, i).locator('h2').isVisible() && await mount(page, i).locator('.tunnel-enter-room').isVisible());
        }
        await capture(page, name + '-my-world');
        check(name + ' no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      });
    }
  }
  check('No runtime or WebGL errors', report.errors.length === 0, report.errors);
} finally {
  await browser.close(); await writeFile(out + '/results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode, passed: report.checks.filter(x => x.passed).length, total: report.checks.length, errors: report.errors.length, output: out }));
  if (report.checks.some(x => !x.passed)) process.exitCode = 1;
}
