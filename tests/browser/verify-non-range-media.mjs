import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.SITE_URL || 'http://127.0.0.1:5176/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  if (process.env.SIMULATE_NON_RANGE !== '0') await page.route(/\/(media|motion)\/.*\.mp4/, async route => {
    if (route.request().method() === 'HEAD') await route.fulfill({ status: 200, headers: { 'content-type': 'video/mp4' }, body: '' });
    else await route.continue();
  });
  await page.goto(base + '#/film/miami-frequency');
  await page.getByRole('button', { name: 'Watch now', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  const video = page.locator('.ms-player-dialog video');
  if (await video.evaluate(v => v.paused)) await page.getByRole('button', { name: 'Play video', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > 1);
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
  await page.getByRole('button', { name: 'Forward 10 seconds', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 11);
  assert.ok(await video.evaluate(v => v.currentSrc.startsWith('blob:')));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Watch now', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 11);
  console.log('PASS non-range film playback, forward seek and saved resume');
  await page.keyboard.press('Escape');
  await page.goto(base + '#/motion');
  await page.getByRole('button', { name: 'Play The living atlas preview', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.motion-stage video')?.currentTime > 0);
  const seek = page.getByRole('slider', { name: 'Inspect The living atlas preview frame' });
  await seek.fill('4');
  await page.waitForFunction(() => Math.abs(document.querySelector('.motion-stage video')?.currentTime - 4) < .2);
  assert.ok(await page.locator('.motion-stage video').evaluate(v => v.currentSrc.startsWith('blob:')));
  console.log('PASS non-range motion playback and frame inspection');
} finally { await browser.close(); }
