import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = (process.env.SITE_URL || 'http://127.0.0.1:5175/').replace(/\/?$/, '/');
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '#/world', { waitUntil: 'domcontentloaded' });
  await page.locator('.cultural-atlas__viewport canvas').waitFor();
  // Find a small exposed patch of canvas, avoiding overlaid destination labels.
  const point = await page.locator('.cultural-atlas__viewport canvas').evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    for (let row = 2; row < 8; row++) for (let col = 2; col < 8; col++) {
      const x = rect.left + rect.width * col / 10, y = rect.top + rect.height * row / 10;
      if ([[0, 0], [-8, -8], [-8, 8], [8, -8], [8, 8]].every(([dx, dy]) => document.elementFromPoint(x + dx, y + dy) === canvas)) return { x, y };
    }
    return null;
  });
  assert.ok(point, 'World should expose a draggable canvas patch');
  await page.mouse.move(point.x, point.y);
  await page.waitForTimeout(100);
  const label = await page.locator('.cursor-ring').textContent();
  assert.ok(label, 'Canvas hover should retain its interaction label');
  await page.evaluate(() => {
    window.__cursorStability = { mutations: 0, moves: 0 };
    new MutationObserver(records => { window.__cursorStability.mutations += records.filter(record => record.type === 'childList').length; })
      .observe(document.querySelector('.cursor-ring'), { childList: true });
    document.addEventListener('pointermove', () => { window.__cursorStability.moves++; }, { passive: true });
  });
  for (let index = 0; index < 40; index++) {
    await page.mouse.move(point.x + Math.sin(index) * 5, point.y + Math.cos(index) * 5);
    await page.waitForTimeout(10);
  }
  const audit = await page.evaluate(() => window.__cursorStability);
  assert.equal(audit.moves, 40);
  assert.equal(audit.mutations, 0, 'Stable canvas hover must not emit cursor text mutations that invalidate shared typography');
  assert.equal(await page.locator('.cursor-ring').textContent(), label);
  await page.getByRole('link', { name: 'Search stories and places', exact: true }).hover();
  assert.equal(await page.locator('.cursor-ring').textContent(), '', 'A real target change still clears the canvas label');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, normalMotion: true, ...audit, label, errors }));
  await context.close();
} finally { await browser.close(); }
