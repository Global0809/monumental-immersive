import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.SITE_URL || 'http://127.0.0.1:5176/';
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '#/world?place=miami');
  await page.locator('.cultural-atlas__viewport canvas').waitFor();
  await page.waitForTimeout(1000);
  const resets = await page.evaluate(async () => {
    const canvas = document.querySelector('.cultural-atlas__viewport canvas');
    const proto = HTMLCanvasElement.prototype, original = {}; let writes = 0;
    for (const key of ['width', 'height']) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, key); original[key] = descriptor;
      Object.defineProperty(proto, key, { ...descriptor, set(value) { if (this === canvas) writes++; descriptor.set.call(this, value); } });
    }
    try {
      // Mobile viewport movement must not clear an unchanged drawing buffer.
      for (let i = 0; i < 8; i++) { visualViewport.dispatchEvent(new Event('scroll')); await new Promise(requestAnimationFrame); }
      await new Promise(requestAnimationFrame);
    } finally { for (const [key, descriptor] of Object.entries(original)) Object.defineProperty(proto, key, descriptor); }
    return writes;
  });
  assert.equal(resets, 0); console.log('PASS viewport movement does not reset the canvas (previously 16 writes)');
  const internalScroll = await page.locator('.cultural-atlas__viewport').evaluate(el => { el.scrollTop = 100; el.scrollLeft = 100; return [el.scrollTop, el.scrollLeft]; });
  assert.deepEqual(internalScroll, [0, 0]); console.log('PASS globe does not become an internal scroll container');
  await page.getByRole('button', { name: 'Zoom globe in', exact: true }).click();
  await page.waitForTimeout(90);
  await page.getByRole('button', { name: 'Zoom globe out', exact: true }).click();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('.cultural-atlas__zoom span').textContent(), '1.00×');
  assert.ok(await page.getByRole('button', { name: 'Explore Miami', exact: true }).first().isVisible());
  console.log('PASS zoom can reverse before settling without losing the selected pin');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.cultural-atlas__viewport canvas').count(), 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []); console.log('PASS responsive scene retains one canvas, readable width and no exceptions');
} finally { await browser.close(); }
