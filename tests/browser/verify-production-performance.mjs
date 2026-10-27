import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = (process.env.SITE_URL || 'http://127.0.0.1:5175/').replace(/\/?$/, '/');
const out = process.env.PERFORMANCE_OUTPUT || 'test-results/production-performance';
const settleMs = Number(process.env.PERFORMANCE_SETTLE_MS || 5000);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--mute-audio'] });
const reports = [], failures = [];
const profiles = [
  { name: 'desktop-cold', width: 1280, height: 720, cpu: 1, route: '/' },
  { name: 'mobile-cold', width: 390, height: 844, cpu: 1, mobile: true, route: '/' },
  { name: 'desktop-4x-cpu-1.6mbps', width: 1280, height: 720, cpu: 4, network: true, route: '/' },
  { name: 'mobile-4x-cpu-1.6mbps', width: 390, height: 844, cpu: 4, network: true, mobile: true, route: '/' },
  { name: 'world-direct-cold', width: 1280, height: 720, cpu: 1, route: '/world' },
  { name: 'search-direct-cold', width: 1280, height: 720, cpu: 1, route: '/search' },
].filter(profile => !process.env.PERFORMANCE_PROFILE || profile.name.includes(process.env.PERFORMANCE_PROFILE));

// Keep loading measurements separate from the instrumented render probe below.
function observeLoading() {
  const quality = window.__quality = { longTasks: [], lcp: null, cls: 0, totalLayoutShift: 0, sceneReady: null, uiReady: null };
  let sessionStart = 0, sessionLast = 0, sessionValue = 0;
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) quality.longTasks.push({ start: entry.startTime, duration: entry.duration });
  }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) quality.lcp = { time: entry.startTime, size: entry.size, element: entry.element?.tagName, text: entry.element?.textContent?.slice(0, 100) };
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      quality.totalLayoutShift += entry.value;
      if (entry.startTime - sessionLast < 1000 && entry.startTime - sessionStart < 5000) sessionValue += entry.value;
      else { sessionStart = entry.startTime; sessionValue = entry.value; }
      sessionLast = entry.startTime; quality.cls = Math.max(quality.cls, sessionValue);
    }
  }).observe({ type: 'layout-shift', buffered: true });
  new MutationObserver(() => {
    if (quality.uiReady === null && document.querySelector('.tunnel-entry-button,.ex-world-title,input[aria-label="Search catalogue"]')) quality.uiReady = performance.now();
    if (quality.sceneReady === null && document.querySelector('.tunnel-journey[data-ready="true"]')) quality.sceneReady = performance.now();
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ready'] });
}
function snapshot() {
  const resources = performance.getEntriesByType('resource').map(e => ({ name: e.name.split('/').pop(), url: e.name, transfer: e.transferSize, decoded: e.decodedBodySize, duration: e.duration, start: e.startTime }));
  const nav = performance.getEntriesByType('navigation')[0];
  return {
    ...window.__quality, observedUntilMs: performance.now(),
    paint: performance.getEntriesByType('paint').map(e => ({ name: e.name, time: e.startTime })), resources,
    documentTransferBytes: nav?.transferSize || 0,
    totalTransferBytes: (nav?.transferSize || 0) + resources.reduce((sum, e) => sum + e.transfer, 0),
    overflow: document.documentElement.scrollWidth > innerWidth,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    compact: document.querySelector('.tunnel-journey')?.getAttribute('data-compact') ?? null,
    passageFallback: !!document.querySelector('.spatial-world--fallback'),
    globeFallback: !!document.querySelector('.cultural-atlas--fallback'),
    canvases: [...document.querySelectorAll('canvas')].map(c => ({ width: c.width, height: c.height, className: c.className })),
  };
}

try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: 1, isMobile: !!profile.mobile, hasTouch: !!profile.mobile });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    const errors = [], consoleErrors = [], requestFailures = [], badResponses = [], inflight = new Set();
    page.on('request', request => inflight.add(request));
    page.on('requestfinished', request => inflight.delete(request));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('requestfailed', request => { inflight.delete(request); requestFailures.push({ url: request.url(), error: request.failure()?.errorText }); });
    page.on('response', response => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
    try {
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
      if (profile.network) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750, connectionType: 'cellular4g' });
      await page.addInitScript(observeLoading);
      await page.goto(base + '#' + profile.route, { waitUntil: 'domcontentloaded', timeout: 90000 });
      if (profile.route === '/') await page.locator('.tunnel-journey[data-ready="true"],.spatial-world--fallback').first().waitFor({ state: 'attached', timeout: 90000 });
      else if (profile.route === '/world') await page.locator('.cultural-atlas__viewport canvas,.cultural-atlas--fallback').first().waitFor({ state: 'attached', timeout: 90000 });
      else await page.getByRole('textbox', { name: 'Search catalogue', exact: true }).waitFor({ timeout: 90000 });
      await page.waitForTimeout(settleMs);
      const metrics = await page.evaluate(snapshot);
      metrics.pendingRequests = [...inflight].map(request => request.url());
      const chunks = metrics.resources.map(e => e.name).filter(name => name.endsWith('.js'));
      const lazyLoading = { chunks, passageRendererLoaded: chunks.some(n => /^tunnelScene-/.test(n)), threeLoaded: chunks.some(n => /^three-/.test(n)), atlasLoaded: chunks.some(n => /^Atlas-/.test(n)), catalogueLoaded: chunks.some(n => /^CatalogueBrowser-/.test(n)) };
      const checks = {
        noHorizontalOverflow: !metrics.overflow,
        homeRendererReady: profile.route !== '/' || metrics.sceneReady !== null,
        directRouteSkipsPassageRenderer: profile.route === '/' || !lazyLoading.passageRendererLoaded,
        directSearchSkipsThree: profile.route !== '/search' || !lazyLoading.threeLoaded,
      };
      await page.screenshot({ path: out + '/' + profile.name + '.png' });
      const interaction = {};
      if (profile.route === '/') {
        const start = performance.now();
        await page.getByRole('link', { name: 'Search stories and places', exact: true }).click();
        await page.getByRole('combobox', { name: 'Search everything', exact: true }).waitFor();
        interaction.quickSearchOpenMs = performance.now() - start;
        const queryStart = performance.now();
        await page.getByRole('combobox', { name: 'Search everything', exact: true }).fill('Miami');
        await page.getByRole('listbox', { name: 'Connections' }).getByRole('option').filter({ hasText: 'Miami' }).first().waitFor();
        interaction.quickSearchResultMs = performance.now() - queryStart;
      } else if (profile.route === '/search') {
        const start = performance.now();
        await page.getByRole('textbox', { name: 'Search catalogue', exact: true }).fill('Miami');
        await page.waitForFunction(() => location.hash.includes('q=Miami') && /^\d+ stor/.test(document.querySelector('.catalogue-result-summary [role="status"]')?.textContent || ''));
        interaction.catalogueQueryMs = performance.now() - start;
        interaction.resultSummary = await page.locator('.catalogue-result-summary [role="status"]').textContent();
      }
      const summary = { name: profile.name, lcpMs: metrics.lcp?.time, fcpMs: metrics.paint.find(e => e.name === 'first-contentful-paint')?.time, uiReadyMs: metrics.uiReady, sceneReadyMs: metrics.sceneReady, cls: metrics.cls, longestTaskMs: Math.max(0, ...metrics.longTasks.map(t => t.duration)), observedBlockingOver50Ms: metrics.longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0), totalTransferBytes: metrics.totalTransferBytes, resources: metrics.resources.length, compact: metrics.compact, checks, interaction, errors, consoleErrors, badResponses };
      for (const [name, passed] of Object.entries(checks)) if (!passed) failures.push(profile.name + ': ' + name);
      if (errors.length || badResponses.length) failures.push(profile.name + ': runtime or response errors');
      reports.push({ profile, metrics, lazyLoading, interaction, summary, errors, consoleErrors, requestFailures, badResponses });
      console.log(JSON.stringify(summary));
    } catch (error) {
      failures.push(profile.name + ': ' + error.message);
      reports.push({ profile, failure: error.message, errors, consoleErrors, requestFailures, badResponses });
      console.log(JSON.stringify({ name: profile.name, failure: error.message }));
    } finally { await context.close(); }
  }

  if (!process.env.PERFORMANCE_SKIP_RENDER_PROBE) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    try {
      await context.addInitScript(() => {
        const audit = window.__renderProbe = { contexts: [], rafTimes: [], sample: false };
        let activeRafTime = null;
        const nativeRaf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = callback => nativeRaf(time => {
          const previous = activeRafTime; activeRafTime = time;
          if (audit.sample && audit.rafTimes.at(-1) !== time) audit.rafTimes.push(time);
          try { return callback(time); } finally { activeRafTime = previous; }
        });
        const nativeGetContext = HTMLCanvasElement.prototype.getContext, seen = new WeakMap();
        HTMLCanvasElement.prototype.getContext = function(...args) {
          const gl = nativeGetContext.apply(this, args);
          if (gl && /^(webgl2?|experimental-webgl)$/.test(String(args[0])) && !seen.has(gl)) {
            const item = { canvas: this, frames: [], draws: 0, outsideRafDraws: 0 };
            seen.set(gl, item); audit.contexts.push(item);
          }
          return gl;
        };
        for (const Constructor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
          if (!Constructor) continue;
          for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
            const native = Constructor.prototype[name];
            if (!native) continue;
            Constructor.prototype[name] = function(...args) {
              const item = seen.get(this);
              if (item && audit.sample) {
                item.draws++;
                if (activeRafTime === null) item.outsideRafDraws++;
                else if (item.frames.at(-1) !== activeRafTime) item.frames.push(activeRafTime);
              }
              return native.apply(this, args);
            };
          }
        }
      });
      const page = await context.newPage();
      await page.goto(base + '#/', { waitUntil: 'domcontentloaded' });
      await page.locator('.tunnel-journey[data-ready="true"]').waitFor({ timeout: 90000 });
      await page.waitForTimeout(3000);
      const cameraBefore = await page.locator('.tunnel-css-world > div > div').evaluate(e => e.style.transform);
      await page.evaluate(() => { window.__renderProbe.started = performance.now(); window.__renderProbe.sample = true; });
      for (let index = 0; index < 8; index++) { await page.mouse.wheel(0, 180); await page.waitForTimeout(250); }
      await page.waitForTimeout(2000);
      const probe = await page.evaluate(() => {
        const a = window.__renderProbe; a.sample = false;
        const elapsedMs = performance.now() - a.started;
        const summarize = times => {
          const gaps = times.slice(1).map((time, index) => time - times[index]).sort((x, y) => x - y);
          return { count: times.length, eventsPerSecond: times.length * 1000 / elapsedMs, medianGapMs: gaps[Math.floor(gaps.length * .5)] ?? null, p95GapMs: gaps[Math.floor(gaps.length * .95)] ?? null, maximumGapMs: gaps.at(-1) ?? null };
        };
        return { elapsedMs, compact: document.querySelector('.tunnel-journey')?.getAttribute('data-compact'), scrollY, browserAnimationFrames: summarize(a.rafTimes), webglDrawSubmissionFrames: a.contexts.map(item => ({ canvas: item.canvas.className, connected: item.canvas.isConnected, draws: item.draws, outsideRafDraws: item.outsideRafDraws, ...summarize(item.frames) })), cameraAfter: document.querySelector('.tunnel-css-world > div > div')?.style.transform };
      });
      probe.cameraBefore = cameraBefore;
      probe.cameraTransformChanged = !!cameraBefore && cameraBefore !== probe.cameraAfter;
      if (!probe.cameraTransformChanged || !probe.webglDrawSubmissionFrames.some(item => item.connected && item.count > 0)) failures.push('render probe: no camera movement or WebGL draw submission evidence');
      await page.screenshot({ path: out + '/render-probe.png' });
      reports.push({ name: 'separate-desktop-render-probe', probe });
      console.log(JSON.stringify({ name: 'separate-desktop-render-probe', probe }));
    } catch (error) { failures.push('render probe: ' + error.message); }
    finally { await context.close(); }
  }
} finally {
  await writeFile(out + '/report.json', JSON.stringify({
    site: base, measuredAt: new Date().toISOString(), browserVersion: browser.version(), settleMs, failures,
    notes: [
      'Single-run synthetic local production preview; not field Core Web Vitals or a statistical performance guarantee.',
      'Loading runs have fresh contexts and disabled browser cache. Shared browser process, OS cache and shader cache are not reset between runs.',
      'Mobile is a 390x844 touch/mobile viewport at DPR 1 in desktop Chrome, not physical mobile hardware.',
      'Network: 150ms latency, 200000 B/s download (1.6 Mbps), 93750 B/s upload; CPU rate 4. Local preview serves uncompressed assets; public-host compression and latency differ.',
      'LCP and maximum CLS session window are observed until readiness plus settling, before interaction. Canvas content is not an LCP candidate.',
      'Observed blocking over 50ms sums long-task excess within the observation interval; it is not Lighthouse TBT. Interaction timings include Playwright command overhead.',
      'Resource Timing totals include document plus completed resources. Cross-origin values can be zero without Timing-Allow-Origin; inflight requests are not counted.',
      'Render probe is a separate instrumented run. Browser rAF differs from per-context animation timestamps containing WebGL draw submissions. Neither proves GPU completion or displayed FPS. CSS3D transform change supplies camera movement evidence.',
      'World readiness means canvas attachment plus settling, not a renderer onReady signal.',
    ], reports,
  }, null, 2));
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({ failures })); process.exitCode = 1; }
