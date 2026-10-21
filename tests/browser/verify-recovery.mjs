import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// Run against a running dev or preview server: SITE_URL=http://127.0.0.1:5173/
// Each scenario has a fresh context so rejected lazy imports and guest data cannot leak.
const base = (process.env.SITE_URL || 'http://127.0.0.1:5173/').replace(/\/?$/, '/');
const output = 'test-results/recovery';
const selectedScenarios = process.env.RECOVERY_SCENARIOS?.split(',').map(name => name.trim()).filter(Boolean);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const results = [];
function record(name, passed, detail = null) { results.push({ name, passed, detail }); console.log(passed ? 'PASS' : 'FAIL', name, detail ? JSON.stringify(detail) : ''); }
async function scenario(name, run, options = {}) {
  if (selectedScenarios?.length && !selectedScenarios.includes(name)) return;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  try { await run(page, context); } catch (error) { record(name + ' execution', false, error.message); await page.screenshot({ path: `${output}/${name}-failure.png` }).catch(() => {}); }
  finally { await context.close(); }
}
async function blockStorage(context, mode = 'both') {
  await context.addInitScript(mode => {
    if (mode === 'both') Storage.prototype.getItem = function () { throw new DOMException('Blocked by QA', 'SecurityError'); };
    Storage.prototype.setItem = function () { throw new DOMException('Quota blocked by QA', 'QuotaExceededError'); };
  }, mode);
}
function chunk(name) { return url => { const path = new URL(url).pathname; return path.endsWith(`/components/${name}.tsx`) || new RegExp(`/assets/${name}-[^/]+\\.js$`).test(path); }; }
async function film(page) { await page.goto(base + '#/film/miami-frequency'); await page.getByRole('heading', { name: 'Miami, in Frequency', exact: true }).waitFor(); }
async function collection(page) { await page.getByRole('link', { name: 'My World', exact: true }).click(); await page.locator('.my-world').waitFor(); }

try {
  for (const mode of ['both', 'write']) await scenario(`storage-${mode}`, async (page, context) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await blockStorage(context, mode); await film(page);
    await page.getByRole('button', { name: 'Save Miami, in Frequency', exact: true }).click();
    await page.locator('.storage-status').waitFor();
    record(`${mode}: truthful storage warning`, /reset when you reload/.test(await page.locator('.storage-status').innerText()));
    await collection(page);
    record(`${mode}: guest save survives navigation`, await page.locator('.my-world .film-card').count() === 1);
    record(`${mode}: collection and notebook disclose temporary storage`, /visit only/.test(await page.locator('.guest-label small').innerText()) && /reset when you reload/.test(await page.locator('.notebook-footnote').innerText()));
    await page.getByRole('button', { name: 'Dismiss storage message' }).click();
    record(`${mode}: banner dismissal preserves truthful label`, await page.locator('.storage-status').count() === 0 && /visit only/.test(await page.locator('.guest-label small').innerText()));
    if (mode === 'both') {
      await film(page); await page.getByRole('button', { name: 'Watch now', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.readyState >= 2);
      await page.locator('.ms-player-dialog video').evaluate(v => { v.pause(); v.currentTime = 12; });
      await page.getByRole('button', { name: 'Keep this moment', exact: true }).click();
      await page.getByRole('textbox', { name: 'Moment note', exact: true }).fill('Temporary session note');
      await page.getByRole('button', { name: 'Keep moment', exact: true }).click();
      record('Blocked storage: player labels remain honest', /Progress kept for this visit/.test(await page.locator('.ms-player-dialog').innerText()) && /last only for this visit/.test(await page.locator('.companion-footnote').innerText()));
      await page.keyboard.press('Escape'); await collection(page); await page.locator('.notebook-entry').waitFor();
      record('Blocked storage: note is usable in memory', /Temporary session note/.test(await page.locator('.notebook-entry').innerText()));
      await page.screenshot({ path: `${output}/temporary-collection.png` });
    }
    await page.reload(); await page.locator('.my-world').waitFor();
    record(`${mode}: reload clears temporary data as disclosed`, await page.locator('.my-world .film-card,.notebook-entry').count() === 0);
    record(`${mode}: no uncaught storage errors`, errors.length === 0, errors);
  });

  await scenario('route-chunk', async (page, context) => {
    await blockStorage(context); const blocked = []; const pattern = chunk('ExplorePages');
    await page.route(pattern, route => { blocked.push(route.request().url()); return route.abort('failed'); });
    await film(page); await page.getByRole('link', { name: 'World', exact: true }).click();
    await page.locator('.content-recovery[role=alert]').waitFor();
    const text = await page.locator('.content-recovery').innerText();
    record('Explore chunk failure is contained by route recovery', blocked.length > 0 && await page.getByRole('button', { name: 'Reload experience' }).isVisible());
    record('Recovery avoids a false persistence promise when storage is blocked', !/saved collection stays in this browser/i.test(text), text);
    await page.getByRole('link', { name: 'Go home', exact: false }).click(); await page.locator('.home').waitFor();
    record('Failed route still permits Go home navigation', await page.locator('.home').isVisible());
    await page.getByRole('link', { name: 'World', exact: true }).click(); await page.locator('.content-recovery[role=alert]').waitFor();
    await page.unroute(pattern); await page.getByRole('button', { name: 'Reload experience' }).click(); await page.locator('.ex-world').waitFor();
    record('Reload recovers a previously failed lazy route', await page.locator('.ex-world').isVisible());
  });

  await scenario('player-chunk', async page => {
    const blocked = []; const pattern = chunk('VideoPlayer'); await page.route(pattern, route => { blocked.push(route.request().url()); return route.abort('failed'); });
    await film(page); const watch = page.getByRole('button', { name: 'Watch now', exact: true }); await watch.focus(); await watch.click();
    const recovery = page.getByRole('dialog', { name: 'Playback could not open' }); await recovery.waitFor();
    record('Player chunk failure opens a contained native dialog', blocked.length > 0 && await recovery.evaluate(e => e.open && e.matches(':modal')));
    await page.keyboard.press('Escape'); await recovery.waitFor({ state: 'detached' });
    record('Failed player Escape restores trigger focus', await watch.evaluate(e => e === document.activeElement));
    await watch.click(); await recovery.waitFor(); await page.getByRole('button', { name: 'Back to discovery', exact: true }).click();
    await recovery.waitFor({ state: 'detached' }); record('Failed player Back restores trigger focus', await watch.evaluate(e => e === document.activeElement));
    await page.unroute(pattern); await page.reload(); await watch.waitFor(); await watch.click(); await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.readyState >= 2);
    record('Reload restores actual player after a chunk failure', await page.locator('.ms-player-dialog video').isVisible());
  });

  await scenario('transition-shortcuts', async page => {
    await page.goto(base + '#/search'); await page.locator('.browse-page').waitFor();
    await page.evaluate(() => { window.__transitionAudit = { added: 0, removed: 0, max: 0 }; const a = window.__transitionAudit; new MutationObserver(entries => { for (const e of entries) { for (const n of e.addedNodes) if (n instanceof Element && n.matches('.story-transition-cover')) a.added++; for (const n of e.removedNodes) if (n instanceof Element && n.matches('.story-transition-cover')) a.removed++; } a.max = Math.max(a.max, document.querySelectorAll('.story-transition-cover').length); }).observe(document.body, { childList: true }); });
    for (let i = 0; i < 3; i++) {
      await page.goto(base + '#/search'); await page.locator('.browse-page').waitFor();
      const card = page.locator('.film-card').filter({ hasText: 'Miami, in Frequency' }).first(); await card.scrollIntoViewIfNeeded(); await page.waitForFunction(() => [...document.querySelectorAll('.film-card img')].every(i => i.complete));
      await card.locator('a[data-transition-film]').first().click();
      await page.getByRole('link', { name: 'World', exact: true }).click();
      await page.locator('.ex-world').waitFor();
    }
    await page.waitForTimeout(900); const transitions = await page.evaluate(() => ({ ...window.__transitionAudit, remaining: document.querySelectorAll('.story-transition-cover').length }));
    record('Rapid navigation clears shared-cover overlays', transitions.added > 0 && transitions.remaining === 0 && transitions.added === transitions.removed && transitions.max <= 1, transitions);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto(base + '#/search'); await page.locator('.browse-page').waitFor();
    const count = await page.evaluate(() => window.__transitionAudit.added); const card = page.locator('.film-card').filter({ hasText: 'Miami, in Frequency' }).first(); await card.scrollIntoViewIfNeeded(); await card.locator('a[data-transition-film]').first().click(); await page.locator('.film-detail').waitFor();
    record('Reduced motion creates no shared-cover overlay', await page.evaluate(() => window.__transitionAudit.added) === count);
    await page.getByRole('link', { name: 'Search', exact: true }).focus(); await page.keyboard.press('?'); await page.locator('.keyboard-guide[open]').waitFor(); await page.keyboard.press('Escape');
    record('Guide shortcut and Escape focus work', await page.getByRole('link', { name: 'Search', exact: true }).evaluate(e => e === document.activeElement));
    for (const key of ['/', 'Control+k']) { await page.keyboard.press(key); await page.locator('.command-deck[open]').waitFor(); await page.keyboard.press('Escape'); record(`Advertised search shortcut ${key}`, await page.locator('.command-deck[open]').count() === 0); }
    await page.getByRole('button', { name: 'Watch now', exact: true }).click(); await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.readyState >= 2);
    const video = page.locator('.ms-player-dialog video'); await video.evaluate(v => { v.pause(); v.currentTime = 15; }); await page.locator('.ms-player-stage').focus();
    await page.keyboard.press('j'); await page.waitForFunction(() => Math.abs(document.querySelector('.ms-player-dialog video').currentTime - 5) < .3);
    await page.keyboard.press('l'); await page.waitForFunction(() => Math.abs(document.querySelector('.ms-player-dialog video').currentTime - 15) < .3);
    await page.keyboard.press('ArrowRight'); await page.waitForFunction(() => Math.abs(document.querySelector('.ms-player-dialog video').currentTime - 20) < .3);
    await page.keyboard.press('ArrowLeft'); await page.waitForFunction(() => Math.abs(document.querySelector('.ms-player-dialog video').currentTime - 15) < .3);
    await page.keyboard.press('k'); await page.waitForFunction(() => !document.querySelector('.ms-player-dialog video').paused); await page.keyboard.press('k'); await page.waitForFunction(() => document.querySelector('.ms-player-dialog video').paused);
    record('Guide player shortcuts match actual K/J/L/arrows behavior', true);
  });
} finally {
  await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify({ base, results }, null, 2));
}
const failed = results.filter(result => !result.passed);
console.log(`${results.length - failed.length}/${results.length} recovery checks passed.`);
if (failed.length) process.exitCode = 1;
