// Actual GPU-program and interaction review for the non-destructive pointer.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://127.0.0.1:5184').replace(/\/$/, '');
const mode = process.argv[3] || 'all';
const out = process.env.LAYERS_OUTPUT || `output/playwright/passage-layers/${mode}`;
await mkdir(out, { recursive: true });
const report = { base, mode, checkedAt: new Date().toISOString(), checks: [], errors: [], observations: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const check = (name, passed, detail) => { report.checks.push({ name, passed: !!passed, detail }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); assert.ok(passed, name); };

async function instrument(context) {
  await context.addInitScript(() => {
    localStorage.setItem('monumental.spatial-tools.v1', JSON.stringify({ cutaway: true, light: 55, quality: 'balanced', pinned: [] }));
    const shaders = new WeakMap(), programs = new WeakMap(), contexts = new Map(), locations = new WeakMap();
    const state = gl => { if (!contexts.has(gl)) contexts.set(gl, { canvas: gl.canvas, active: null, used: new Set(), draws: 0 }); return contexts.get(gl); };
    const program = value => { if (!programs.has(value)) programs.set(value, { shaders: new Set(), source: '', parallax: null, draws: 0 }); return programs.get(value); };
    for (const type of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
      const proto = window[type]?.prototype; if (!proto) continue;
      const wrap = (name, observe) => { const native = proto[name]; if (!native) return; proto[name] = function(...args) { const result = native.apply(this, args); observe(this, args, result); return result; }; };
      wrap('shaderSource', (_gl, [shader, source]) => shaders.set(shader, source));
      wrap('attachShader', (_gl, [p, shader]) => program(p).shaders.add(shader));
      wrap('linkProgram', (_gl, [p]) => { program(p).source = [...program(p).shaders].map(s => shaders.get(s) || '').join('\n'); });
      wrap('useProgram', (gl, [p]) => { state(gl).active = p ? program(p) : null; });
      wrap('getUniformLocation', (_gl, [p, name], location) => { if (location) locations.set(location, { program: program(p), name }); });
      const vector = (location, values) => { const item = locations.get(location); if (item?.name === 'uParallax') item.program.parallax = values; };
      wrap('uniform2f', (_gl, [location, x, y]) => vector(location, [x, y]));
      wrap('uniform2fv', (_gl, [location, values, offset = 0]) => vector(location, Array.from(values).slice(offset, offset + 2)));
      for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) wrap(name, gl => {
        const entry = state(gl); entry.draws++; if (entry.active) { entry.used.add(entry.active); entry.active.draws++; }
      });
    }
    window.__layersGPU = () => [...contexts.values()].filter(s => s.canvas.isConnected && s.draws).map(s => ({
      canvas: s.canvas.className, draws: s.draws, programs: [...s.used].map(p => ({
        name: /#define SHADER_NAME ([^\n]+)/.exec(p.source)?.[1] || 'unnamed',
        forbidden: /\b(?:uSection|vSectionWorld|scanCursor|scanStrength|vScanPosition)\b/.test(p.source),
        parallax: p.parallax, draws: p.draws,
      })),
    }));
  });
}
async function ready(page) {
  await page.goto(base + '/#/');
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
  await page.evaluate(() => document.fonts.ready);
}
async function scroll(page, index, progress) {
  await page.evaluate(({ index, progress }) => {
    const section = document.querySelectorAll('.tunnel-checkpoint')[index];
    scrollTo({ top: section.getBoundingClientRect().top + scrollY + section.offsetHeight * progress, behavior: 'instant' });
  }, { index, progress });
  await page.waitForTimeout(550);
}
async function sweep(page, locator = page.locator('canvas.spatial-world-canvas')) {
  const rect = await locator.boundingBox(); assert.ok(rect);
  const start = [rect.x + rect.width * .18, rect.y + rect.height * .42];
  await page.mouse.move(...start); await page.waitForTimeout(450);
  await page.mouse.move(rect.x + rect.width * .82, rect.y + rect.height * .58, { steps: 9 }); await page.waitForTimeout(450);
  await page.mouse.down(); await page.mouse.move(rect.x + rect.width * .62, rect.y + rect.height * .46, { steps: 7 }); await page.mouse.up();
  await page.waitForTimeout(250);
}
async function gpuCheck(page, label) {
  const data = await page.evaluate(() => window.__layersGPU());
  check(`${label}: actual submitted programs contain no cursor-cutaway or X-ray shader`, data.length > 0 && data.every(s => s.programs.every(p => !p.forbidden)), data);
  return data;
}
const capture = (page, name) => page.screenshot({ path: `${out}/${name}.png` });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await instrument(context); const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (/WebGLProgram|shader error|VALIDATE_STATUS/.test(m.text())) report.errors.push(m.text()); });
  if (mode !== 'narrow') {
  await ready(page); await capture(page, '00-opening');
  for (const [index, progress, name] of [[0, .10, 'world-approach'], [4, .10, 'culture-approach'], [4, .22, 'culture-open']]) {
    await scroll(page, index, progress); await sweep(page); await gpuCheck(page, name); await capture(page, name);
  }
  if (mode !== 'baseline') {
    await scroll(page, 0, .5);
    await page.waitForFunction(() => {
      const station = document.querySelector('[data-tunnel-station="world"]');
      return station && !station.inert && Number(station.dataset.assemblyProgress) === 1;
    });
    const fixed = await page.locator('[data-tunnel-station="world"]').getAttribute('style');
    await page.mouse.move(90, 500); await page.waitForTimeout(650);
    const left = await page.evaluate(() => window.__layersGPU().flatMap(s => s.programs).filter(p => p.parallax).map(p => p.parallax[0]));
    await page.mouse.move(1350, 500); await page.waitForTimeout(650);
    const right = await page.evaluate(() => window.__layersGPU().flatMap(s => s.programs).filter(p => p.parallax).map(p => p.parallax[0]));
    check('Mouse still controls actual wormhole parallax without moving the content', left.length >= 2 && left.every(x => x < -.3) && right.every(x => x > .3) && fixed === await page.locator('[data-tunnel-station="world"]').getAttribute('style'), { left, right });
    await page.getByRole('button', { name: 'Inspect The World exhibit', exact: true }).click();
    await page.getByRole('button', { name: 'Close The World exhibit', exact: true }).waitFor(); await page.keyboard.press('Escape');
    check('Normal exhibit Inspect and Escape remain available', await page.getByRole('button', { name: 'Inspect The World exhibit', exact: true }).getAttribute('aria-expanded') === 'false');
    for (const [index, progress] of [[4,.28], [4,.12], [1,.10], [0,.10]]) { await scroll(page, index, progress); await sweep(page); }
    await gpuCheck(page, 'Reversed Passage'); await capture(page, 'reverse-world');
    check('Old saved framework preference cannot expose a toggle or enable the cutaway', await page.getByRole('button', { name: /framework|x.?ray/i }).count() === 0 && await page.evaluate(() => !document.querySelector('[data-passage-cutaway="true"]')));

    await page.evaluate(() => { location.hash = '#/world?place=miami'; });
    await page.locator('.cultural-atlas canvas').waitFor(); await page.waitForTimeout(1000);
    await sweep(page, page.locator('.cultural-atlas canvas')); await gpuCheck(page, 'World globe'); await capture(page, 'world-globe');
    const save = page.getByRole('button', { name: 'Save Miami', exact: true }); if (await save.count()) await save.click();
    await page.locator('.city-entry-link').click();
    await page.locator('.city-canvas canvas').waitFor(); await page.waitForTimeout(600);
    await sweep(page, page.locator('.city-canvas canvas')); await gpuCheck(page, 'Miami miniature');
    await page.getByRole('button', { name: 'Back to globe', exact: true }).click();
    await page.evaluate(() => { location.hash = '#/my-world'; });
    await page.locator('.personal-monument').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Orbit', exact: true }).click();
    await page.locator('.personal-monument__scene canvas').waitFor(); await page.waitForTimeout(500);
    await sweep(page, page.locator('.personal-monument__scene canvas')); await gpuCheck(page, 'Personal monument');
    await page.getByRole('button', { name: 'Rotate sculpture right', exact: true }).click();
    check('Personal monument retains its rotation controls', await page.getByRole('button', { name: 'Rotate sculpture left', exact: true }).isEnabled());
    await capture(page, 'personal-monument');
    const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(name => /xrayMaterial|xrayPointer|xrayLens|tunnelCutaway|structuralReveal/.test(name)));
    check('No removed X-ray service is loaded by these routes', loaded.length === 0, loaded);
  }
  }

  if (mode !== 'baseline') {
    // The supplied references are narrow crops. Test their full viewport sizes
    // as well: those intentionally use the compact DOM layout, not clipped 3D UI.
    for (const viewport of [{ width: 779, height: 784 }, { width: 669, height: 773 }]) {
      const name = `${viewport.width}x${viewport.height}`;
      await page.setViewportSize(viewport); await ready(page); await sweep(page);
      await gpuCheck(page, `Narrow ${name}`); await capture(page, `narrow-${name}-opening`);
      const picker = page.getByRole('combobox', { name: 'Choose Passage station', exact: true });
      if (await picker.isVisible()) await picker.selectOption('0');
      else await page.getByRole('button', { name: 'Travel to The World', exact: true }).click();
      await page.waitForFunction(() => {
        const station = document.querySelector('[data-tunnel-station="world"]');
        return document.querySelector('[data-passage-chapter]')?.getAttribute('data-passage-chapter') === 'world' &&
          station && station.getAttribute('aria-hidden') !== 'true' && !station.inert;
      });
      const layout = await page.locator('[data-tunnel-station="world"] .tunnel-panel').evaluate(element => {
        const bounds = element.querySelector('h2').getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
          compact: document.querySelector('.tunnel-journey')?.getAttribute('data-compact') };
      });
      check(`Narrow ${name} keeps its complete readable chapter`, layout.compact === 'true' && layout.left >= -1 && layout.right <= layout.width + 1 && !layout.overflow, layout);
      await capture(page, `narrow-${name}-world`);
    }
  }
  check('No runtime or shader errors during layer review', report.errors.length === 0, report.errors);
  await context.close();
} catch (e) { report.checks.push({ name: 'Review completed', passed: false, detail: e.stack }); }
finally { await browser.close(); await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.checks.filter(c => c.passed).length, total: report.checks.length, errors: report.errors.length, out })); if (report.checks.some(c => !c.passed)) process.exitCode = 1; }
