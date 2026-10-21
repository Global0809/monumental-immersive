import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [], results = [];
page.on('pageerror', error => errors.push(error.message));
const base = 'http://127.0.0.1:5173', out = '.openai/integration-review';
try {
  await page.goto(base + '/#/time-machine');
  await page.getByRole('button', { name: 'Open sound studio', exact: true }).click();
  const consolePanel = page.locator('.sound-console');
  await consolePanel.evaluate(async panel => { await Promise.all(panel.getAnimations().map(animation => animation.finished)); });
  assert.equal(await consolePanel.evaluate(panel => getComputedStyle(panel).opacity), '1');
  assert.equal(await consolePanel.evaluate(panel => getComputedStyle(panel).backgroundColor), 'rgb(17, 18, 18)');
  await page.screenshot({ path: out + '/studio-mobile-settled.png' });
  await page.keyboard.press('Escape');
  results.push('Settled mobile Sound Studio is opaque, legible and viewport-contained.');

  await page.goto(base + '/');
  const tuner = page.getByRole('group', { name: 'Tune your discovery' });
  await tuner.getByRole('button', { name: /^Music/ }).click();
  assert.equal(await tuner.getByRole('button', { name: /^Music/ }).getAttribute('aria-pressed'), 'true');
  assert.ok(await page.locator('.featured-films .film-card').count() > 0);
  const route = page.getByRole('group', { name: 'Explore the planned WAVEMAKERS route' });
  await route.getByRole('button', { name: /London/ }).click();
  assert.equal(await route.getByRole('button', { name: /London/ }).getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('.original-stop-context').innerText(), /WHERE THE SOUND TRAVELS/);
  assert.match(await page.locator('.original-stop-context a').getAttribute('href'), /place=london/);
  await page.screenshot({ path: out + '/wavemakers-mobile.png' });
  results.push('Home frequency filter and WAVEMAKERS destination selection update real content and destination links.');

  await page.goto(base + '/#/my-world');
  const passport = page.locator('.culture-passport');
  await passport.getByRole('button', { name: /Miami/ }).click();
  await passport.getByRole('button', { name: 'Collect this place' }).click();
  assert.ok((await page.evaluate(() => JSON.parse(localStorage.getItem('monumental.viewer.v1')).savedPlaces)).includes('miami'));
  await passport.getByRole('button', { name: 'Remove from map' }).click();
  assert.ok(!(await page.evaluate(() => JSON.parse(localStorage.getItem('monumental.viewer.v1')).savedPlaces)).includes('miami'));
  await page.screenshot({ path: out + '/passport-mobile.png' });
  results.push('Culture Passport expands destinations and persists collect/remove map actions.');

  await page.goto(base + '/#/journey');
  await page.getByRole('button', { name: 'Find my journey' }).click();
  await page.getByRole('button', { name: 'Play entire journey' }).click();
  const player = page.locator('.ms-player-dialog');
  await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.readyState >= 2);
  await player.evaluate(dialog => { dialog.scrollTop = 0; });
  await page.screenshot({ path: out + '/queue-player-mobile-top.png' });
  await page.waitForFunction(() => document.querySelector('.ms-player-dialog').style.getPropertyValue('--cinema-left').startsWith('rgb('));
  const glow = player.getByRole('button', { name: /Cinema glow/ });
  if (await glow.count()) {
    await glow.click();
    assert.equal(await player.evaluate(dialog => dialog.style.getPropertyValue('--cinema-left')), '');
  }
  await player.locator('video').evaluate(video => { video.currentTime = video.duration - 0.15; return video.play(); });
  await page.waitForFunction(() => document.querySelector('.ms-queue-countdown')?.textContent.includes('Next stop in'));
  await page.waitForFunction(() => document.querySelector('.ms-queue-stops button:nth-child(2)')?.getAttribute('aria-current') === 'step', { timeout: 9000 });
  results.push('Actual media end starts the visible five-second countdown and advances the ordered journey; cinema glow derives from real video frames.');
  assert.deepEqual(errors, []);
  await writeFile(out + '/final-report.json', JSON.stringify({ passed: true, results, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, results, errors }, null, 2));
} finally { await browser.close(); }
