// Focused native WebGL review of Passage panel-mounted telemetry.
// node tests/browser/panel-telemetry.mjs [baseline|final|confirmation] [base]
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const phase = process.argv[2] || 'final', base = process.argv[3] || 'http://127.0.0.1:5184';
const out = `output/playwright/panel-telemetry/${phase}`; await mkdir(out, { recursive: true });
const report = { phase, checks: [], samples: [], captures: [], errors: [], notes: ['Native Chrome/WebGL; touch and reduced motion are emulated, not physical-device certification.', 'Hidden state is injected through document.hidden and the real visibility handler.'] };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const check = (name, passed, detail) => report.checks.push({ name, passed: !!passed, detail });
const wait = (p, ms = 500) => p.waitForTimeout(ms);
async function setup(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  await context.addInitScript(() => {
    const probe = window.__panelQA = { records: [], sampling: false }, contextMap = new WeakMap(), locations = new WeakMap(), shaders = new WeakMap(), programs = new WeakMap();
    const nativeGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      const gl = nativeGet.apply(this, args);
      if (gl && /^(webgl2?|experimental-webgl)$/.test(args[0]) && !contextMap.has(gl)) {
        const r = { canvas: this, gl, textures: new Set(), framebuffers: new Set(), draws: 0, instanced: {}, uniforms: {}, sources: [], lost: false };
        this.addEventListener('webglcontextlost', () => { r.lost = true; }); contextMap.set(gl, r); probe.records.push(r);
      }
      return gl;
    };
    for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Type) continue;
      for (const [name, field] of [['Texture', 'textures'], ['Framebuffer', 'framebuffers']]) {
        const create = Type.prototype['create' + name], remove = Type.prototype['delete' + name];
        Type.prototype['create' + name] = function(...args) { const value = create.apply(this, args); contextMap.get(this)?.[field].add(value); return value; };
        Type.prototype['delete' + name] = function(value) { contextMap.get(this)?.[field].delete(value); return remove.call(this, value); };
      }
      const shaderSource = Type.prototype.shaderSource, attachShader = Type.prototype.attachShader;
      Type.prototype.shaderSource = function(shader, source) { shaders.set(shader, source); return shaderSource.call(this, shader, source); };
      Type.prototype.attachShader = function(program, shader) { const list = programs.get(program) || []; list.push(shader); programs.set(program, list); return attachShader.call(this, program, shader); };
      const useProgram = Type.prototype.useProgram;
      Type.prototype.useProgram = function(program) { const r = contextMap.get(this); if (r) { const sources = (programs.get(program) || []).map(s => shaders.get(s) || ''); r.telemetry = sources.some(s => /panelTelemetry|uPanel|telemetryAtlas/i.test(s)); for (const source of sources) if (/panelTelemetry|uPanel|telemetryAtlas/i.test(source) && !r.sources.includes(source)) r.sources.push(source); } return useProgram.call(this, program); };
      const location = Type.prototype.getUniformLocation;
      Type.prototype.getUniformLocation = function(program, name) { const l = location.call(this, program, name); if (l) locations.set(l, name); return l; };
      for (const name of ['uniform1f', 'uniform1i', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform2fv', 'uniform3fv', 'uniform4fv']) {
        const native = Type.prototype[name];
        Type.prototype[name] = function(l, ...args) { const key = locations.get(l), r = contextMap.get(this); if (r && /panel|telemetry|uSection/i.test(key || '')) r.uniforms[key] = args.length === 1 && typeof args[0] !== 'number' ? Array.from(args[0]) : args.length === 1 ? args[0] : args; return native.call(this, l, ...args); };
      }
      for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const native = Type.prototype[name]; if (!native) continue;
        Type.prototype[name] = function(...args) { const r = contextMap.get(this); if (r && probe.sampling) { r.draws++; if (name.includes('Instanced')) { const key = `${r.telemetry ? 'telemetry' : 'ordinary'}:${args.at(-1)}`; r.instanced[key] = (r.instanced[key] || 0) + 1; } } return native.apply(this, args); };
      }
    }
    localStorage.setItem('monumental.viewer.v1', JSON.stringify({ saved: [], savedPlaces: [], journeys: [], history: {}, sound: false, reducedMotion: false }));
  });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (/WebGLProgram|VALIDATE_STATUS|shader error|GL_INVALID/i.test(m.text())) report.errors.push(m.text()); });
  return { context, page };
}
async function home(p) { await p.goto(base + '/#/'); await p.locator('.tunnel-journey[data-ready="true"]').waitFor(); await p.waitForFunction(() => !document.documentElement.dataset.spatialPassage); await p.evaluate(() => document.fonts.ready); await wait(p, 1200); }
async function capture(p, name) { await p.screenshot({ path: `${out}/${name}.png` }); report.captures.push(name); }
async function snapshot(p) { return p.evaluate(() => ({ scrollY, chapter: document.querySelector('[data-passage-chapter]')?.dataset.passageChapter, reading: document.querySelector('[data-passage-reading]')?.dataset.passageReading, drawCalls: document.querySelector('[data-passage-draw-calls]')?.dataset.passageDrawCalls, cutaway: document.querySelector('[data-passage-cutaway]')?.dataset.passageCutaway, records: window.__panelQA.records.map(r => ({ className: r.canvas.className, connected: r.canvas.isConnected, textures: r.textures.size, framebuffers: r.framebuffers.size, draws: r.draws, instanced: r.instanced, uniforms: r.uniforms, lost: r.lost, sourceCount: r.sources.length, dataset: { ...r.canvas.dataset } })) })); }
async function sample(p, name, duration = 900) { await p.evaluate(() => { window.__panelQA.records.forEach(r => { r.draws = 0; r.instanced = {}; }); window.__panelQA.sampling = true; }); const before = await snapshot(p); await wait(p, duration); const after = await snapshot(p); await p.evaluate(() => { window.__panelQA.sampling = false; }); const value = { name, duration, before, after }; report.samples.push(value); return value; }
async function station(p, label, id) { await p.getByRole('button', { name: 'Travel to ' + label, exact: true }).click(); await p.waitForFunction(id => document.querySelector('[data-passage-reading="true"]')?.dataset.passageChapter === id, id); await wait(p, 1000); }
const main = s => s.records.find(r => r.className.includes('spatial-world-canvas'));
async function mediaBounds(p) {
  return p.locator('.flight-media-mask[data-protected="true"]').evaluate(element => {
    const n = String.raw`[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?`;
    const m = element.style.clipPath.match(new RegExp(String.raw`Z\s*M\s*(${n})[\s,]+(${n})\s*H\s*(${n})\s*V\s*(${n})\s*H\s*(${n})\s*Z`));
    return m ? { x: (Number(m[1]) + Number(m[3])) / 2, y: (Number(m[2]) + Number(m[4])) / 2 } : null;
  });
}
try {
  const { context, page } = await setup();
  try {
    await home(page); await capture(page, 'opening'); await sample(page, 'opening');
    if (phase === 'final') { await wait(page, 1100); await capture(page, 'opening-idle'); }
    await station(page, 'The World', 'world'); await capture(page, 'world-reading'); await sample(page, 'world-reading');
    if (phase === 'confirmation') {
      for (const s of report.samples) {
        const current = main(s.after);
        check(s.name + ' protects editorial bounds from LED emission', current.uniforms.uPanelProtectedCount > 0, current.uniforms);
        check(s.name + ' still uses one atlas without new draw calls', current.textures <= (s.name === 'opening' ? 12 : 14) && current.framebuffers === 6 && Number(s.after.drawCalls) <= (s.name === 'opening' ? 113 : 156), { textures: current.textures, framebuffers: current.framebuffers, drawCalls: s.after.drawCalls });
      }
      await station(page, 'Music', 'music'); await capture(page, 'music-reading');
      check('Music editorial bounds remain protected', main(await snapshot(page)).uniforms.uPanelProtectedCount > 0);
    }
    if (phase === 'final') {
      check('One live Passage canvas', await page.locator('canvas.spatial-world-canvas').count() === 1);
      for (const s of report.samples) {
        const before = main(s.before), after = main(s.after);
        check(s.name + ' uploads live telemetry time', Number(after.uniforms.uPanelTime) > Number(before.uniforms.uPanelTime), { before: before.uniforms, after: after.uniforms });
        check(s.name + ' retains one 1080-panel draw for telemetry', after.instanced['telemetry:1080'] > 0 && after.instanced['ordinary:1080'] === after.instanced['telemetry:1080'] * 3, after.instanced);
      }
      const baseline = JSON.parse(await readFile('output/playwright/panel-telemetry/baseline/report.json', 'utf8'));
      for (const s of report.samples) {
        const old = baseline.samples.find(v => v.name === s.name), a = main(s.after), b = main(old.after);
        check(s.name + ' adds at most one atlas and no compositor target', a.textures <= b.textures + 1 && a.framebuffers === b.framebuffers, { before: { textures: b.textures, framebuffers: b.framebuffers }, after: { textures: a.textures, framebuffers: a.framebuffers } });
        check(s.name + ' does not add draw calls', Number(s.after.drawCalls) <= Number(old.after.drawCalls), { before: old.after.drawCalls, after: s.after.drawCalls });
      }
      const chapter = page.locator('[data-tunnel-station="world"]');
      const copy = await chapter.locator('.tunnel-panel-copy p').boundingBox();
      await page.mouse.move(copy.x + copy.width / 2, copy.y + copy.height / 2); await wait(page);
      check('Chapter copy remains outside the structural cutaway', (await snapshot(page)).cutaway === 'false');
      const media = await mediaBounds(page); check('Primary footage has a valid protection region', !!media);
      if (media) { await page.mouse.move(media.x, media.y); await wait(page); check('Primary footage stays outside the structural cutaway', (await snapshot(page)).cutaway === 'false'); }
      const worldScroll = await page.evaluate(() => scrollY);
      await page.mouse.move(1390, 895); await page.mouse.wheel(0, 750); await wait(page, 450); await page.mouse.wheel(0, -750); await wait(page, 900);
      const reversed = await snapshot(page); check('Reverse scroll reconstructs the World reading position', reversed.chapter === 'world' && reversed.reading === 'true' && Math.abs(reversed.scrollY - worldScroll) < 3, reversed); await capture(page, 'world-reversed');
      await station(page, 'Music', 'music'); check('Direct jump resolves into a live valid chapter', (await snapshot(page)).reading === 'true' && Number(main(await snapshot(page)).uniforms.uPanelTime) > 0); await capture(page, 'music-reading');
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await wait(page, 1200);
      const hits = [];
      for (const point of [{ x: 1220, y: 660 }, { x: 1290, y: 310 }, { x: 1150, y: 200 }, { x: 1110, y: 735 }]) {
        await page.mouse.move(point.x, point.y); await wait(page, 400); if ((await snapshot(page)).cutaway === 'true') { hits.push(point); break; }
      }
      check('Existing shell cutaway remains active on wall surfaces', hits.length > 0, hits); await capture(page, 'opening-cutaway');
      await page.mouse.move(75, 200); await wait(page);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      const hidden = await sample(page, 'hidden', 500); check('Hidden tab stops telemetry clock and Passage draws', main(hidden.after).uniforms.uPanelTime === main(hidden.before).uniforms.uPanelTime && main(hidden.after).draws === 0, main(hidden.after));
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }); await wait(page, 250);
      const resumed = await sample(page, 'resumed', 300); check('Visible Passage resumes its one clock', main(resumed.after).uniforms.uPanelTime > main(resumed.before).uniforms.uPanelTime);
      await page.evaluate(() => { location.hash = '#/settings'; }); await page.getByRole('heading', { name: /MAKE IT/i }).waitFor(); await wait(page, 600);
      const away = await sample(page, 'away', 500); check('Leaving Passage suspends its telemetry clock', main(away.after).uniforms.uPanelTime === main(away.before).uniforms.uPanelTime);
      await page.evaluate(() => { location.hash = '#/'; }); await page.locator('.tunnel-journey[data-ready="true"]').waitFor(); await wait(page, 650);
      check('Returning does not accumulate Passage canvases', (await snapshot(page)).records.filter(r => r.connected && r.className.includes('spatial-world-canvas')).length === 1 && await page.locator('canvas.spatial-world-canvas').count() === 1);
    }
  } catch (e) { check('Desktop runner', false, e.stack); await capture(page, 'failure-desktop').catch(() => {}); }
  finally { await context.close(); }
  if (phase === 'final' || phase === 'confirmation') {
    for (const [label, options] of [['compact', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }], ['reduced', { reducedMotion: 'reduce' }]]) {
      const { context, page } = await setup(options);
      try {
        await home(page); const s = await sample(page, label, 650);
        check(label + ' keeps panel telemetry static', main(s.after).uniforms.uPanelTime === 0 && main(s.before).uniforms.uPanelTime === 0, main(s.after).uniforms);
        check(label + ' keeps six accessible chapter interfaces', await page.locator('.tunnel-panel').count() === 6);
        check(label + ' keeps content within the viewport', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await capture(page, label + '-opening');
      } catch (e) { check(label + ' runner', false, e.stack); await capture(page, 'failure-' + label).catch(() => {}); }
      finally { await context.close(); }
    }
  }
} finally {
  await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ phase, checks: report.checks.length, failed: report.checks.filter(c => !c.passed), errors: report.errors, report: `${out}/report.json` }, null, 2));
  if (report.errors.length || report.checks.some(c => !c.passed)) process.exitCode = 1;
}
