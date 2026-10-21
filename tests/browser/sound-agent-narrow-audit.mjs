import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
  await page.goto('http://127.0.0.1:5173/#/settings');
  await page.locator('.sound-studio:not(.sound-studio--compact) .sonic-heading').scrollIntoViewIfNeeded();
  const bounds = await page.locator('.sound-studio:not(.sound-studio--compact) .sonic-heading').evaluate(el => {
    const control = el.querySelector('.sonic-power').getBoundingClientRect();
    return { document: document.documentElement.scrollWidth, viewport: innerWidth, controlLeft: control.left, controlRight: control.right };
  });
  assert.ok(bounds.document <= bounds.viewport);
  assert.ok(bounds.controlLeft >= 0 && bounds.controlRight <= bounds.viewport);
  await page.screenshot({ path: '.openai/integration-review/studio-settings-320.png' });
  await page.getByRole('button', { name: 'Open sound studio', exact: true }).click();
  await page.locator('.sound-console').evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished)); });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '.openai/integration-review/studio-compact-320.png' });
  console.log(JSON.stringify({ passed: true, bounds }));
} finally { await browser.close(); }
