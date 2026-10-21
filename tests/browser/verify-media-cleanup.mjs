import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const output = process.env.MEDIA_CLEANUP_OUTPUT || 'test-results/media-cleanup';
const targets = [
  ...(process.env.BASELINE_URL ? [{ name: 'frozen-baseline', url: process.env.BASELINE_URL }] : []),
  { name: 'current-dev', url: process.env.SITE_URL || 'http://127.0.0.1:5173/' },
];
await mkdir(output, { recursive: true });
const reports = [];
for (const target of targets) {
  const report = { ...target, cycles: [], checks: [], errors: [], nativeEvents: [], nativePlayers: [] };
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true, args: ['--mute-audio'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    const audit = window.__mediaCleanup = { entries: [], calls: [] };
    const ids = new WeakMap();
    const track = element => {
      if (!ids.has(element)) { ids.set(element, audit.entries.length); audit.entries.push({ ref: new WeakRef(element) }); }
      return ids.get(element);
    };
    const record = (element, method) => { const id = track(element); audit.calls.push({ id, method, connected: element.isConnected, src: element.getAttribute('src'), currentSrc: element.currentSrc, time: element.currentTime }); };
    for (const method of ['pause', 'load']) { const original = HTMLMediaElement.prototype[method]; HTMLMediaElement.prototype[method] = function (...args) { record(this, method); return original.apply(this, args); }; }
    const remove = Element.prototype.removeAttribute;
    Element.prototype.removeAttribute = function (name) { if (name === 'src' && this instanceof HTMLMediaElement) record(this, 'remove-src'); return remove.call(this, name); };
    new MutationObserver(entries => { for (const entry of entries) for (const node of entry.addedNodes) if (node instanceof Element) { if (node instanceof HTMLMediaElement) track(node); for (const media of node.querySelectorAll('video,audio')) track(media); } }).observe(document, { subtree: true, childList: true });
    // The audit retains only WeakRefs and serializable data, never detached media handles.
    window.__readMediaCleanup = () => ({ calls: audit.calls, elements: audit.entries.map(({ ref }, id) => { const e = ref.deref(); return e ? { id, alive: true, connected: e.isConnected, src: e.getAttribute('src'), currentSrc: e.currentSrc, paused: e.paused, readyState: e.readyState, networkState: e.networkState, time: e.currentTime, label: e.getAttribute('aria-label') } : { id, alive: false }; }) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const cdp = await context.newCDPSession(page);
  await cdp.send('HeapProfiler.enable'); await cdp.send('Performance.enable'); await cdp.send('Media.enable');
  cdp.on('Media.playerCreated', e => report.nativePlayers.push(e));
  cdp.on('Media.playerEventsAdded', e => { for (const event of e.events) report.nativeEvents.push({ playerId: e.playerId, value: event.value }); });
  page.on('pageerror', e => report.errors.push(e.message));
  const check = (name, passed, detail = null) => { report.checks.push({ name, passed, detail }); console.log(target.name, passed ? 'PASS' : 'FAIL', name, detail ? JSON.stringify(detail) : ''); };
  async function snapshot(label) {
    await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(120); await cdp.send('HeapProfiler.collectGarbage');
    const [heap, dom, media] = await Promise.all([cdp.send('Runtime.getHeapUsage'), cdp.send('Memory.getDOMCounters'), page.evaluate(() => window.__readMediaCleanup())]);
    return { label, heapUsed: heap.usedSize, backingStorage: heap.backingStorageSize, dom, ...media };
  }
  async function open() {
    await page.getByRole('button', { name: 'Watch now', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.readyState >= 2);
    const video = page.locator('.ms-player-dialog video');
    if (await video.evaluate(v => v.paused)) await page.getByRole('button', { name: 'Play video', exact: true }).click();
    return video;
  }
  async function close() { await page.getByRole('button', { name: 'Close player' }).click(); await page.locator('.ms-player-dialog').waitFor({ state: 'detached' }); await page.waitForTimeout(120); }
  try {
    await page.goto(target.url + '#/film/miami-frequency'); await page.getByRole('heading', { name: 'Miami, in Frequency', exact: true }).waitFor();
    report.before = await snapshot('before-first-player');
    for (let cycle = 1; cycle <= 6; cycle++) {
      const video = await open(); const start = await video.evaluate(v => v.currentTime);
      await page.waitForFunction(start => document.querySelector('.ms-player-dialog video')?.currentTime >= start + 1.05, start);
      const playing = await video.evaluate(v => ({ time: v.currentTime, readyState: v.readyState, src: v.currentSrc, connected: v.isConnected, paused: v.paused }));
      await close(); const immediate = await page.evaluate(() => window.__readMediaCleanup()); const settled = await snapshot(`cycle-${cycle}`);
      report.cycles.push({ cycle, playing, immediate, settled });
      console.log(target.name, 'cycle', cycle, JSON.stringify({ time: playing.time, heapMB: +(settled.heapUsed / 1048576).toFixed(2), nodes: settled.dom.nodes, listeners: settled.dom.jsEventListeners, media: settled.elements }));
    }
    check('All six live players advance without being unloaded', report.cycles.every(c => c.playing.connected && !c.playing.paused && c.playing.readyState >= 2 && c.playing.src));
    report.afterCycles = await snapshot('after-six-cycles');
    // Chromium may preserve currentSrc as a last-URL string after NETWORK_EMPTY.
    // Source attributes, ready/network state, and CDP destruction establish release.
    const stillDecoded = report.afterCycles.elements.filter(e => e.alive && !e.connected && (e.src || e.readyState > 0 || e.networkState !== 0));
    report.retiredStillDecoded = stillDecoded;
    if (target.name === 'current-dev') {
      check('Retired full-player media has no source or decoded state after GC', stillDecoded.length === 0, stillDecoded);
      const retained = report.afterCycles.elements.filter(e => e.alive && !e.connected);
      check('Retired captioned player trees are collected after GC', retained.length === 0, retained);
    }

    let video = await open(); await video.evaluate(v => { v.pause(); v.currentTime = 12.25; }); await page.waitForFunction(() => Math.abs(document.querySelector('.ms-player-dialog video').currentTime - 12.25) < .2); await close();
    video = await open(); const resumed = await video.evaluate(v => v.currentTime); check('Resume position survives retired-media teardown', resumed >= 12 && resumed < 14, resumed);
    const pip = page.getByRole('button', { name: 'Picture-in-picture', exact: true });
    if (await pip.count()) { await pip.click(); await page.waitForTimeout(150); const entered = await page.evaluate(() => !!document.pictureInPictureElement); await close(); check('Owned picture-in-picture exits on close', !entered || await page.evaluate(() => !document.pictureInPictureElement), { entered }); } else await close();

    await page.goto(target.url + '#/journey'); await page.getByRole('button', { name: 'Find my journey', exact: true }).click(); await page.getByRole('button', { name: 'Play entire journey', exact: true }).click(); await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.readyState >= 2);
    video = page.locator('.ms-player-dialog video'); await video.evaluate(v => { v.pause(); v.currentTime = 9.5; }); const previousLabel = await video.getAttribute('aria-label');
    await page.getByRole('button', { name: /^Journey stop 2:/ }).click();
    await page.waitForFunction(label => { const v = document.querySelector('.ms-player-dialog video'); return v && v.getAttribute('aria-label') !== label && v.readyState >= 2 && v.currentTime > .4; }, previousLabel);
    const switched = await video.evaluate(v => ({ title: v.getAttribute('aria-label'), time: v.currentTime, src: v.currentSrc, connected: v.isConnected, error: v.error?.code || null }));
    check('Queue switch preserves and plays the new connected element', switched.title !== previousLabel && switched.connected && !!switched.src && !switched.error, switched);
    report.queueSnapshot = await page.evaluate(() => window.__readMediaCleanup()); await close();

    await page.goto(target.url + '#/search'); await page.locator('.browse-page').waitFor();
    const card = page.locator('.film-card').filter({ hasText: 'Miami, in Frequency' }).first(); await card.scrollIntoViewIfNeeded(); await card.getByRole('button', { name: 'Preview Miami, in Frequency silently' }).click();
    await page.waitForFunction(() => document.querySelector('.card-video')?.currentTime > .3); await page.mouse.move(5, 5); await page.locator('.card-video').waitFor({ state: 'detached' }); await page.waitForTimeout(100);
    report.previewStop = await page.evaluate(() => window.__readMediaCleanup());
    await card.getByRole('button', { name: 'Preview Miami, in Frequency silently' }).click(); await page.waitForFunction(() => document.querySelector('.card-video')?.currentTime > .3);
    await page.getByRole('link', { name: 'My World', exact: true }).click(); await page.locator('.my-world').waitFor(); await page.waitForTimeout(100);
    report.previewDeparture = await page.evaluate(() => window.__readMediaCleanup()); report.final = await snapshot('after-preview-departure');
    check('Preview stop and route departure remove all active media', await page.locator('video').count() === 0);
    if (target.name === 'current-dev') {
      const pending = report.final.elements.filter(e => e.alive && !e.connected && (e.src || e.readyState > 0 || e.networkState !== 0));
      check('Preview teardown releases retired media sources', pending.length === 0, pending);
      const unsafe = report.final.calls.filter(call => call.method === 'load' && call.connected);
      check('StrictMode replay never explicitly unloads a connected player', unsafe.length === 0, unsafe);
      const destroyed = new Set(report.nativeEvents.filter(e => { try { return JSON.parse(e.value).event === 'kWebMediaPlayerDestroyed'; } catch { return false; } }).map(e => e.playerId));
      check('Every created native media player is destroyed after retirement', destroyed.size === report.nativePlayers.length, { created: report.nativePlayers.length, destroyed: destroyed.size });
    }
    check('No uncaught playback errors', report.errors.length === 0, report.errors);
  } catch (error) { check('Execution', false, error.stack); await page.screenshot({ path: `${output}/${target.name}-failure.png` }).catch(() => {}); }
  finally { await browser.close(); reports.push(report); await writeFile(`${output}/report.json`, JSON.stringify(reports, null, 2)); }
}
console.log('Reports:', output + '/report.json');
// The frozen baseline intentionally documents the defects the current source fixes.
if (reports.some(report => report.name === 'current-dev' && report.checks.some(check => !check.passed))) process.exitCode = 1;
