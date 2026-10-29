import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5184/';
const output = process.env.INSTRUMENT_OUTPUT || 'output/playwright/selected-instruments';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [], errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (/WebGLProgram|GL_INVALID|mergeGeometries/i.test(message.text())) errors.push(message.text()); });
const check = (name, passed, detail = '') => { checks.push({ name, passed, detail }); assert.ok(passed, `${name}: ${detail}`); console.log(`PASS ${name}`); };
async function station(title, id) {
  await page.getByRole('button', { name: `Travel to ${title}`, exact: true }).click();
  await page.waitForFunction(id => document.querySelector('[data-passage-chapter]')?.dataset.passageChapter === id && document.querySelector('[data-passage-reading]')?.dataset.passageReading === 'true', id);
}
try {
  const url = new URL(base); url.hash = '/'; await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage);
  await page.waitForFunction(() => document.querySelector('.flight-environment')?.dataset.activity === 'inspect', { timeout: 25000 });
  check('A drone reaches an authored service-dock inspection phase', true);
  await page.screenshot({ path: `${output}/01-drone-inspection.png` });
  await page.waitForFunction(() => document.querySelector('.flight-environment')?.dataset.activity === 'signal', { timeout: 15000 });
  await page.screenshot({ path: `${output}/02-drone-signal.png` });
  check('The perched drone exchanges a signal before returning to flight', true);

  await station('Music', 'music');
  await page.waitForTimeout(900);
  const scene = page.locator('[data-passage-audio-energy]');
  check('Music is silent before explicit opt-in', Number(await scene.getAttribute('data-passage-audio-energy')) === 0);
  check('Drones remain in quiet flight during reading', await page.locator('.flight-environment').getAttribute('data-activity') === 'fly');
  const listen = page.getByRole('button', { name: 'Listen to the sound study', exact: true });
  await listen.click();
  await page.waitForFunction(() => Number(document.querySelector('[data-passage-audio-energy]')?.dataset.passageAudioEnergy) > .003);
  const samples = [];
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(150); samples.push(Number(await scene.getAttribute('data-passage-audio-energy'))); }
  check('Actual sound energy changes as the local score plays', Math.max(...samples) > .003 && new Set(samples).size > 2, JSON.stringify(samples));
  check('Sound control acknowledges opt-in', await page.getByRole('button', { name: 'Mute the sound study', exact: true }).getAttribute('aria-pressed') === 'true');
  await page.screenshot({ path: `${output}/03-music-reactive.png` });
  await page.getByRole('button', { name: 'Mute the sound study', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-passage-audio-energy]')?.dataset.passageAudioEnergy) === 0);
  check('Mute immediately returns measured movement energy to zero', true);
  await listen.click(); await page.waitForTimeout(400);
  await page.locator('[data-tunnel-station="music"]').getByRole('button', { name: 'Play Island Current', exact: true }).click();
  await page.locator('.ms-player-dialog[open]').waitFor();
  check('Full-player opening preempts the ambient sound study', await listen.getAttribute('aria-pressed') === 'false');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.ms-player-dialog[open]'));
  check('Closing the full player does not unexpectedly restart sound', await listen.getAttribute('aria-pressed') === 'false');
  await listen.click(); await page.waitForFunction(() => Number(document.querySelector('[data-passage-audio-energy]')?.dataset.passageAudioEnergy) > .003);
  await station('Culture', 'culture'); await page.waitForTimeout(400);
  check('Leaving Music mutes the study and leaves one scene renderer', Number(await scene.getAttribute('data-passage-audio-energy')) === 0 && await page.locator('canvas.spatial-world-canvas').count() === 1);
  await page.getByRole('button', { name: 'Inspect Culture exhibit', exact: true }).click();
  await page.getByRole('button', { name: 'Rotate Culture sculpture right', exact: true }).click();
  await page.waitForTimeout(600); await page.screenshot({ path: `${output}/04-culture-inspection.png` });
  check('Tactile Culture object remains under working inspection controls', await page.getByRole('button', { name: 'Close Culture exhibit', exact: true }).getAttribute('aria-expanded') === 'true');
  await page.keyboard.press('Escape');
  for (const [title, id] of [['The World', 'world'], ['Time Machine', 'time-machine'], ['The Cinema', 'movies']]) {
    await station(title, id); await page.waitForTimeout(500);
    await page.getByRole('button', { name: `Inspect ${title} exhibit`, exact: true }).click();
    await page.waitForTimeout(500); await page.screenshot({ path: `${output}/instrument-${id}.png` }); await page.keyboard.press('Escape');
  }
  check('All precision instruments are inspectable through existing chapter controls', true);
  check('No uncaught or geometry/shader errors', errors.length === 0, JSON.stringify(errors));
} catch (error) { checks.push({ name: 'runtime', passed: false, detail: error.stack }); await page.screenshot({ path: `${output}/failure.png` }); process.exitCode = 1; }
finally { await writeFile(`${output}/verification.json`, JSON.stringify({ checks, errors }, null, 2)); await context.close(); await browser.close(); }
