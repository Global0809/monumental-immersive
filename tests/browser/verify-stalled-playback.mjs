import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const base = (process.env.SITE_URL || 'http://127.0.0.1:5184/').replace(/\/?$/, '/');
const output = 'output/playwright/selected-stalled-playback';
const remoteFilm = 'https://video.blender.org/object-storage/web_videos/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40-720.mp4';
// Local test bytes only: this fixture tests source identity and recovery behavior,
// not the availability or full duration of the external film.
const fixture = await readFile('public/media/sintel.mp4');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true, args: ['--mute-audio'] });
const checks = [], errors = [];
const check = (name, detail = '') => { checks.push({ name, passed: true, detail }); console.log('PASS', name, detail); };
async function scenario(name, viewport, run) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  try { await run(page, context); }
  catch (error) { checks.push({ name, passed: false, detail: error.stack }); console.error('FAIL', name, error.message); await page.screenshot({ path: `${output}/${name}-failure.png` }).catch(() => {}); }
  finally { await context.close(); }
}
async function open(page, hash = '#/film/sintel-full') {
  await page.goto(base + hash);
  await page.getByRole('button', { name: /^Watch (now|from)/ }).click();
  await page.locator('.ms-player-dialog video').waitFor();
}
async function ready(page) {
  await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.readyState >= 2);
}

try {
  await scenario('never-progress-mobile', { width: 390, height: 844 }, async (page, context) => {
    const held = [];
    await context.route(remoteFilm, route => { held.push(route); });
    await open(page);
    const recovery = page.getByRole('region', { name: 'Playback recovery' });
    await recovery.waitFor({ state: 'visible' });
    const before = await page.locator('.ms-player-dialog video').evaluate(v => ({ src: v.getAttribute('src'), time: v.currentTime, error: v.error?.code, title: v.getAttribute('aria-label') }));
    assert.equal(before.src, remoteFilm); assert.equal(before.time, 0); assert.equal(before.error, undefined); assert.equal(before.title, 'Sintel');
    assert.ok(held.length > 0);
    assert.equal(await page.locator('.ms-player-error').count(), 0);
    assert.ok(await recovery.getByRole('button', { name: 'Retry film', exact: true }).isVisible());
    assert.ok(await recovery.getByRole('button', { name: 'Watch the available trailer', exact: true }).isVisible());
    await recovery.scrollIntoViewIfNeeded();
    assert.ok(await recovery.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({ path: `${output}/mobile-recovery.png` });
    check('A never-progressing full film offers recovery on mobile without an error or silent source switch');
    await recovery.getByRole('button', { name: 'Watch the available trailer', exact: true }).click();
    await ready(page);
    assert.equal((await page.locator('.ms-player-current-title').innerText()).toLowerCase(), 'sintel · trailer');
    assert.equal(await recovery.count(), 0);
    check('The local trailer opens only after its explicit recovery action');
  });

  await scenario('retry-preserves-position', { width: 1440, height: 1000 }, async (page, context) => {
    let requests = 0;
    await context.route(remoteFilm, route => {
      requests++;
      return route.fulfill({ status: 200, contentType: 'video/mp4', headers: { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes' }, body: fixture });
    });
    await open(page, '#/film/sintel-full?t=6'); await ready(page);
    const video = page.locator('.ms-player-dialog video');
    await video.evaluate(v => { v.pause(); v.currentTime = 18.25; });
    await page.waitForFunction(() => { const v = document.querySelector('.ms-player-dialog video'); return v && !v.seeking && Math.abs(v.currentTime - 18.25) < .1; });
    // A media waiting event isolates the stalled transport from external-server
    // reliability after real decoding and a real native seek have completed.
    await video.evaluate(v => v.dispatchEvent(new Event('waiting')));
    const recovery = page.getByRole('region', { name: 'Playback recovery' });
    await recovery.waitFor({ state: 'visible' });
    const requestsBefore = requests;
    await page.screenshot({ path: `${output}/desktop-recovery.png` });
    await recovery.getByRole('button', { name: 'Retry film', exact: true }).click();
    await page.waitForFunction(() => { const v = document.querySelector('.ms-player-dialog video'); return v && v.readyState >= 2 && v.currentTime >= 18.2 && v.currentTime < 21; });
    await video.evaluate(v => v.pause());
    assert.ok(requests > requestsBefore);
    assert.equal(await video.getAttribute('src'), remoteFilm);
    assert.equal((await page.locator('.ms-player-current-title').innerText()).toLowerCase(), 'sintel');
    assert.equal(await recovery.count(), 0);
    check('Retry retains the selected full-film URL and captured position instead of the original shared timestamp', await video.evaluate(v => v.currentTime));
  });

  await scenario('transient-seek', { width: 1280, height: 900 }, async page => {
    await open(page, '#/film/miami-frequency'); await ready(page);
    const video = page.locator('.ms-player-dialog video');
    await video.evaluate(v => { v.pause(); v.currentTime = 12; });
    await page.waitForFunction(() => { const v = document.querySelector('.ms-player-dialog video'); return v && !v.seeking && Math.abs(v.currentTime - 12) < .1; });
    await video.evaluate(v => v.dispatchEvent(new Event('waiting')));
    await page.waitForTimeout(250);
    await video.evaluate(v => v.dispatchEvent(new Event('canplay')));
    await page.waitForTimeout(12500);
    assert.equal(await page.locator('.ms-player-recovery,.ms-player-error').count(), 0);
    assert.equal(await video.evaluate(v => v.currentTime), 12);
    await page.getByRole('button', { name: 'Play video', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.currentTime > 12.5);
    check('A transient seek clears the recovery timer and playback continues normally');
  });
  assert.equal(errors.length, 0); check('No uncaught browser errors');
} finally {
  await browser.close();
  await writeFile(`${output}/verification.json`, JSON.stringify({ base, checks, errors }, null, 2));
}
if (checks.some(check => !check.passed)) process.exitCode = 1;
