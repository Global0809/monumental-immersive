import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5184/';
const output = process.env.WORMHOLE_OUTPUT || 'output/playwright/passage-wormhole';
const recordVideo = process.env.WORMHOLE_VIDEO === '1';
const checks = [], errors = [], measurements = [], limitations = [];
const chapters = ['entrance', 'world', 'time-machine', 'movies', 'music', 'culture', 'my-world'];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const address = route => { const url = new URL(base); url.hash = route; return url.href; };
const canvas = page => page.locator('canvas.spatial-world-canvas');
const persistResults = () => writeFile(`${output}/results.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, errors, measurements, limitations }, null, 2));
process.once('SIGINT', async () => { await persistResults(); await browser.close(); process.exit(130); });

function check(name, passed, detail = '') {
  checks.push({ name, passed: !!passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  assert.ok(passed, `${name}: ${JSON.stringify(detail)}`);
}

async function instrument(context) {
  await context.addInitScript(() => {
    // Observe the GPU API itself. Canvas datasets remain useful for interaction
    // state, but cannot establish dimensional geometry or its rendering cost.
    const contexts = new Map(), shaders = new WeakMap(), programs = new WeakMap();
    const objectIds = new WeakMap(), uniformLocations = new WeakMap();
    let nextId = 1, rafTime = null;
    const id = object => {
      if (!object) return 0;
      if (!objectIds.has(object)) objectIds.set(object, nextId++);
      return objectIds.get(object);
    };
    const nativeRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => nativeRAF(time => {
      const previous = rafTime; rafTime = time;
      try { return callback(time); } finally { rafTime = previous; }
    });
    const contextState = gl => {
      if (!contexts.has(gl)) contexts.set(gl, {
        canvas: gl.canvas, draws: 0, program: null, vertexArray: null, framebuffer: null,
        frames: [], programRecords: new Set(), buffer: null, vaos: new Map(),
      });
      return contexts.get(gl);
    };
    const vaoState = state => {
      const key = id(state.vertexArray);
      if (!state.vaos.has(key)) state.vaos.set(key, { attributes: new Map(), elementBuffer: null });
      return state.vaos.get(key);
    };
    const programState = program => {
      if (!program) return null;
      if (!programs.has(program)) programs.set(program, {
        id: id(program), shaders: new Set(), links: 0, matrices: {}, draws: 0,
      });
      return programs.get(program);
    };
    const describeProgram = program => {
      if (program.description) return program.description;
      const sources = [...program.shaders].map(shader => shaders.get(shader)).filter(Boolean);
      const vertex = sources.find(source => source.type === 35633)?.source || '';
      const combined = sources.map(source => source.source).join('\n');
      return program.description = {
        wormhole: /wormhole/i.test(combined),
        name: /#define SHADER_NAME ([^\n]+)/.exec(combined)?.[1] || `program-${program.id}`,
        perspective: /projectionMatrix\s*\*/.test(vertex) && /(?:modelViewMatrix|viewMatrix)\s*\*/.test(vertex),
        // A vertex shader writing clip-space xy directly is the old backdrop.
        fullscreen: /gl_Position\s*=\s*vec4\(\s*position\.xy/.test(vertex),
        vertexSource: vertex,
      };
    };
    const matrixKey = matrix => matrix?.map(value => Number(value.toFixed(5))).join(',') || '';
    const observeDraw = (gl, method, args) => {
      const state = contextState(gl);
      if (!state.canvas?.classList?.contains('spatial-world-canvas')) return;
      state.draws++;
      const program = programState(state.program);
      if (!program) return;
      state.programRecords.add(program); program.draws++;
      const description = describeProgram(program), now = performance.now();
      // Group actual submissions by the owning animation callback timestamp.
      // No independent test rAF loop is counted as a rendered scene frame.
      const key = rafTime === null ? `sync-${Math.floor(now / 4)}` : `raf-${rafTime}`;
      let frame = state.frames.at(-1);
      if (!frame || frame.key !== key) {
        frame = { key, time: now, rafTime, calls: 0, wormholeCalls: 0, instancedCalls: 0,
          wormhole: {}, baseline: {}, baselineFramebuffers: new Set(), baselineProjections: new Set() };
        state.frames.push(frame);
        if (state.frames.length > 240) state.frames.shift();
      }
      frame.calls++;
      const instanced = /Instanced/.test(method);
      const count = method.startsWith('drawArrays') ? args[2] : args[1];
      const instances = instanced ? args.at(-1) : 1;
      const framebuffer = id(state.framebuffer), vao = id(state.vertexArray);
      const projection = matrixKey(program.matrices.projectionMatrix);
      const view = matrixKey(program.matrices.viewMatrix);
      const signature = `${program.id}:${vao}:${framebuffer}:${method}:${count}:${instances}`;
      if (description.wormhole) frame.wormhole[signature] = { program: program.id, name: description.name, vao, framebuffer,
        method, count, instances, projection, view, perspective: description.perspective,
        fullscreen: description.fullscreen, elementBuffer: id(vaoState(state).elementBuffer),
        instanceAttributes: [...vaoState(state).attributes.values()].filter(attribute => attribute.divisor > 0).length,
        vertexBuffers: [...new Set([...vaoState(state).attributes.values()].map(attribute => id(attribute.buffer)))],
      };
      else frame.baseline[signature] = { vao };
      if (description.wormhole) { frame.wormholeCalls++; if (instanced) frame.instancedCalls++; }
      else {
        frame.baselineFramebuffers.add(framebuffer);
        if (projection && description.perspective) frame.baselineProjections.add(projection);
      }
    };
    for (const kind of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
      const prototype = window[kind]?.prototype;
      if (!prototype) continue;
      const wrap = (method, observe) => {
        const original = prototype[method]; if (!original) return;
        prototype[method] = function (...args) {
          const result = original.apply(this, args); observe(this, args, result); return result;
        };
      };
      wrap('createShader', (gl, [type], shader) => shaders.set(shader, { type, source: '', compilations: 0 }));
      wrap('shaderSource', (gl, [shader, source]) => { shaders.get(shader).source = source; });
      wrap('compileShader', (gl, [shader]) => { shaders.get(shader).compilations++; });
      wrap('attachShader', (gl, [program, shader]) => programState(program).shaders.add(shader));
      wrap('linkProgram', (gl, [program]) => { const state = programState(program); state.links++; delete state.description; });
      wrap('useProgram', (gl, [program]) => { contextState(gl).program = program; });
      wrap('getUniformLocation', (gl, [program, name], location) => {
        if (location) uniformLocations.set(location, { program: programState(program), name });
      });
      wrap('uniformMatrix4fv', (gl, [location, transpose, values]) => {
        const uniform = uniformLocations.get(location);
        if (uniform && /^(projectionMatrix|viewMatrix)$/.test(uniform.name)) uniform.program.matrices[uniform.name] = Array.from(values);
      });
      wrap('bindFramebuffer', (gl, [target, framebuffer]) => {
        if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER) contextState(gl).framebuffer = framebuffer;
      });
      wrap('bindVertexArray', (gl, [vao]) => { contextState(gl).vertexArray = vao; });
      wrap('bindBuffer', (gl, [target, buffer]) => {
        const state = contextState(gl);
        if (target === gl.ARRAY_BUFFER) state.buffer = buffer;
        if (target === gl.ELEMENT_ARRAY_BUFFER) vaoState(state).elementBuffer = buffer;
      });
      wrap('vertexAttribPointer', (gl, [index, size, type, normalized, stride, offset]) => {
        const state = contextState(gl), attributes = vaoState(state).attributes;
        attributes.set(index, { ...attributes.get(index), buffer: state.buffer, size, type, stride, offset });
      });
      wrap('vertexAttribDivisor', (gl, [index, divisor]) => {
        const attributes = vaoState(contextState(gl)).attributes;
        attributes.set(index, { ...attributes.get(index), divisor });
      });
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        wrap(method, (gl, args) => observeDraw(gl, method, args));
      }
    }
    const active = () => [...contexts.values()].filter(state => state.canvas?.isConnected && state.canvas.classList.contains('spatial-world-canvas'));
    window.__wormholeAudit = {
      draws: () => active().reduce((sum, state) => sum + state.draws, 0),
      snapshot: (since = 0) => active().map(state => ({
        draws: state.draws,
        programs: [...state.programRecords].filter(program => describeProgram(program).wormhole).map(program => ({
          id: program.id, name: describeProgram(program).name, perspective: describeProgram(program).perspective,
          fullscreen: describeProgram(program).fullscreen, links: program.links, draws: program.draws,
          compilations: [...program.shaders].reduce((sum, shader) => sum + (shaders.get(shader)?.compilations || 0), 0),
          vertexSource: describeProgram(program).vertexSource,
        })),
        frames: state.frames.filter(frame => frame.time >= since).map(frame => ({
          ...frame, wormhole: Object.values(frame.wormhole), baseline: Object.values(frame.baseline),
          baselineFramebuffers: [...frame.baselineFramebuffers], baselineProjections: [...frame.baselineProjections],
        })),
      })),
    };
  });
}

async function ready(page) {
  // A cold development shader compile can exceed ordinary interaction waits.
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
  await canvas(page).waitFor({ state: 'attached' });
  await page.waitForFunction(() => Number.isFinite(Number(document.querySelector('canvas.spatial-world-canvas')?.dataset.wormholeTime)) && !!document.querySelector('canvas.spatial-world-canvas')?.dataset.wormholeMode);
  await page.evaluate(() => document.fonts.ready);
}

async function state(page) {
  return page.evaluate(() => {
    const element = document.querySelector('canvas.spatial-world-canvas');
    const host = document.querySelector('[data-passage-chapter]');
    const camera = document.querySelector('.tunnel-css-world')?.firstElementChild?.firstElementChild;
    const activePanel = document.querySelector(`[data-tunnel-station="${host?.dataset.passageChapter}"]`);
    return {
      time: Number(element?.dataset.wormholeTime), energy: Number(element?.dataset.wormholeEnergy),
      mode: element?.dataset.wormholeMode, pointer: (element?.dataset.wormholePointer || '').split(',').map(Number),
      wormholeDraws: Number(element?.dataset.wormholeDraws), draws: window.__wormholeAudit.draws(),
      scrollY, camera: camera?.style.transform || '', chapter: host?.dataset.passageChapter,
      reading: host?.dataset.passageReading, panelTransform: activePanel?.style.transform || '',
      canvasCount: document.querySelectorAll('canvas.spatial-world-canvas').length,
      cssScenes: document.querySelectorAll('.tunnel-css-world').length,
      panels: document.querySelectorAll('[data-tunnel-station]').length,
    };
  });
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${output}/${name}.png` });
}

async function station(page, title, id) {
  await page.getByRole('button', { name: `Travel to ${title}`, exact: true }).click();
  await page.waitForFunction(id => {
    const host = document.querySelector('[data-passage-chapter]');
    const mount = document.querySelector(`[data-tunnel-station="${id}"]`);
    return host?.dataset.passageChapter === id && host.dataset.passageReading === 'true' && mount?.getAttribute('aria-hidden') === 'false' && !mount.inert;
  }, id);
  await page.waitForTimeout(550);
}

async function gpuEvidence(page, label) {
  const snapshot = await page.evaluate(() => window.__wormholeAudit.snapshot());
  const programs = snapshot.flatMap(context => context.programs);
  const frames = snapshot.flatMap(context => context.frames).filter(frame => frame.wormholeCalls > 0);
  const frame = frames.at(-1);
  const submitted = frame?.wormhole || [];
  const detail = {
    programs: programs.map(({ vertexSource, ...program }) => program),
    lastFrame: frame && { calls: frame.calls, existingSceneCalls: frame.calls - frame.wormholeCalls,
      addedWormholeCalls: frame.wormholeCalls, wormhole: submitted },
  };
  measurements.push({ name: `${label} actual WebGL geometry and program evidence`, ...detail });
  await writeFile(`${output}/${label}-gpu-programs.json`, JSON.stringify(programs, null, 2));
  check(`${label} compiles and submits perspective wormhole shader programs`, programs.length >= 2 &&
    programs.every(program => program.compilations >= 2 && program.links >= 1 && program.draws > 0 && program.perspective && !program.fullscreen), detail);
  check(`${label} submits curved indexed geometry and genuinely instanced streaks`,
    submitted.some(draw => draw.method === 'drawElements' && draw.count > 1000 && draw.elementBuffer > 0) &&
    submitted.some(draw => /Instanced/.test(draw.method) && draw.instances >= 20 && draw.instanceAttributes > 0) &&
    new Set(submitted.map(draw => draw.vao)).size >= 2, detail);
  check(`${label} adds at most three geometry draws in the existing scene framebuffer`,
    frame && frame.wormholeCalls >= 2 && frame.wormholeCalls <= 3 && frame.calls > frame.wormholeCalls &&
    new Set(submitted.map(draw => draw.framebuffer)).size === 1 &&
    submitted.every(draw => frame.baselineFramebuffers.includes(draw.framebuffer) && draw.projection && frame.baselineProjections.includes(draw.projection)) &&
    submitted.every(draw => !frame.baseline.some(existing => existing.vao === draw.vao)), detail);
  return programs;
}

async function sampleFrames(page) {
  const initial = await page.evaluate(() => ({ start: performance.now(), programs: window.__wormholeAudit.snapshot().flatMap(context => context.programs).map(({ id, compilations, links }) => ({ id, compilations, links })) }));
  await page.waitForTimeout(3500);
  const captured = await page.evaluate(start => ({ end: performance.now(), contexts: window.__wormholeAudit.snapshot(start) }), initial.start);
  const frames = captured.contexts.flatMap(context => context.frames).filter(frame => frame.rafTime !== null && frame.wormholeCalls > 0);
  const times = [...new Set(frames.map(frame => frame.rafTime))].sort((a, b) => a - b);
  const intervals = times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b);
  const finalPrograms = captured.contexts.flatMap(context => context.programs).map(({ id, compilations, links }) => ({ id, compilations, links }));
  const sample = { durationMs: captured.end - initial.start, renderedFrames: times.length,
    submittedFramesPerSecond: times.length * 1000 / (captured.end - initial.start),
    medianMs: intervals[Math.floor(intervals.length * .5)] || 0, p95Ms: intervals[Math.floor(intervals.length * .95)] || 0,
    minimumAddedDraws: Math.min(...frames.map(frame => frame.wormholeCalls)),
    maximumAddedDraws: Math.max(...frames.map(frame => frame.wormholeCalls)),
    existingSceneCallsPerFrame: [...new Set(frames.map(frame => frame.calls - frame.wormholeCalls))],
    shaderCompilationsStable: JSON.stringify(initial.programs) === JSON.stringify(finalPrograms),
  };
  measurements.push({ name: 'Desktop actual WebGL scene submission cadence (headless, no fixed FPS assertion)', ...sample });
  limitations.push('Cadence counts animation frames that actually submit wormhole WebGL draws, not empty requestAnimationFrame callbacks. Headless Chrome submission cadence does not establish physical-device GPU completion time or a 60 FPS guarantee.');
  console.log(`SCENE SUBMISSION SAMPLE ${JSON.stringify(sample)}`);
  await persistResults();
  check('Desktop supplies a bounded sample of actually rendered scene frames', sample.renderedFrames >= 8 && sample.maximumAddedDraws <= 3 && sample.minimumAddedDraws >= 2, sample);
  check('Idle animation does not repeatedly compile wormhole shaders', sample.shaderCompilationsStable, { initial: initial.programs, final: finalPrograms });
}

async function scenario(name, options, run) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference',
    ...(recordVideo && name === 'desktop-flow' ? { recordVideo: { dir: `${output}/video`, size: { width: 1440, height: 900 } } } : {}),
    ...options,
  });
  await instrument(context);
  const page = await context.newPage(); page.setDefaultTimeout(12_000); page.setDefaultNavigationTimeout(20_000);
  page.on('pageerror', error => { errors.push({ scenario: name, message: error.message }); console.error(`BROWSER ERROR ${name}: ${error.message}`); });
  page.on('console', message => {
    if (/WebGLProgram|VALIDATE_STATUS|shader error|shader failed|GL_INVALID|GLSL|CONTEXT_LOST_WEBGL/i.test(message.text())) {
      errors.push({ scenario: name, message: message.text() }); console.error(`SHADER ERROR ${name}: ${message.text()}`);
    }
  });
  let timeout;
  try {
    await Promise.race([
      (async () => { await page.goto(address('/'), { waitUntil: 'domcontentloaded' }); await ready(page); await run(page); })(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`${name} exceeded the 65-second scenario budget`)), 65_000); }),
    ]);
  } catch (error) {
    checks.push({ name: `${name} completed`, passed: false, detail: error.stack });
    console.error(`FAIL ${name}: ${error.message}`);
    await screenshot(page, `failure-${name}`).catch(() => {});
  } finally {
    clearTimeout(timeout);
    const video = page.video();
    await context.close();
    if (video) measurements.push({ name: `${name} video`, path: await video.path() });
    await persistResults();
  }
}

try {
  await scenario('desktop-flow', {}, async page => {
    await page.mouse.move(720, 450);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
    await page.waitForTimeout(650);
    const first = await state(page); await screenshot(page, '01-opening-time-a');
    await page.waitForTimeout(1400);
    const second = await state(page); await screenshot(page, '02-opening-time-b');
    measurements.push({ name: 'Opening idle samples', first, second });
    check('Desktop wormhole advances while the user is idle', first.mode === 'flow' && second.time > first.time + .35, { first: first.time, second: second.time });
    check('Idle flow preserves native scroll and the journey camera', Math.abs(second.scrollY - first.scrollY) < 1 && first.camera !== '' && first.camera === second.camera && first.chapter === second.chapter, { first, second });
    check('The wormhole retains the existing Passage renderer and six chapter interfaces', [first, second].every(value => value.wormholeDraws >= 2 && value.wormholeDraws <= 3) && second.canvasCount === 1 && second.cssScenes === 1 && second.panels === 6, second);
    await gpuEvidence(page, 'desktop');

    await page.mouse.move(1260, 500, { steps: 8 }); await page.waitForTimeout(450);
    const pointer = await state(page);
    check('Mouse input reaches the restrained wormhole drift', pointer.pointer.length === 2 && pointer.pointer.every(Number.isFinite) && Math.hypot(...pointer.pointer) > .15, pointer.pointer);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
    await page.waitForTimeout(180);
    check('Leaving the page resets wormhole pointer influence', (await state(page)).pointer.every(value => Math.abs(value) < .001));

    await station(page, 'The World', 'world');
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
    const worldA = await state(page); await screenshot(page, '03-world');
    await page.waitForTimeout(750); const worldB = await state(page);
    check('Reading holds retain stable camera and content while the wormhole flows', worldB.time > worldA.time && worldA.camera === worldB.camera && worldA.panelTransform === worldB.panelTransform && Math.abs(worldA.scrollY - worldB.scrollY) < 1, { worldA, worldB });
    await sampleFrames(page);

    await page.getByRole('button', { name: 'Inspect The World exhibit', exact: true }).click();
    await page.getByRole('button', { name: 'Close The World exhibit', exact: true }).waitFor();
    await page.waitForTimeout(200);
    const inspected = await state(page); await page.waitForTimeout(700);
    check('Exhibit inspection freezes wormhole time', (await state(page)).time === inspected.time, inspected.time);
    await page.keyboard.press('Escape');
    await page.waitForFunction(time => Number(document.querySelector('canvas.spatial-world-canvas')?.dataset.wormholeTime) > time + .15, inspected.time);
    check('Closing inspection resumes the flow', (await state(page)).time > inspected.time);

    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const hidden = await state(page); await page.waitForTimeout(650); const held = await state(page);
    check('Simulated hidden visibility freezes time and WebGL drawing', held.time === hidden.time && held.draws === hidden.draws, { hidden, held });
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(time => Number(document.querySelector('canvas.spatial-world-canvas')?.dataset.wormholeTime) > time + .1, held.time);
    const resumed = await state(page);
    check('Visibility resumes without a hidden-time jump', resumed.time > held.time && resumed.time - held.time < .5, { held: held.time, resumed: resumed.time });
    limitations.push('Hidden-tab coverage overrides document.hidden and dispatches visibilitychange; it does not claim a genuinely backgrounded operating-system tab.');

    const scrollStart = await state(page);
    await page.mouse.wheel(0, 6100); await page.waitForTimeout(250);
    const forward = await state(page);
    await page.mouse.wheel(0, -3600); await page.waitForTimeout(450);
    const reversed = await state(page);
    measurements.push({ name: 'Fast native scroll and reverse', scrollStart, forward, reversed });
    check('Fast forward and reverse retain finite flow and valid chapter selection', forward.scrollY > scrollStart.scrollY + 100 && reversed.scrollY < forward.scrollY - 100 && chapters.includes(forward.chapter) && chapters.includes(reversed.chapter) && [forward, reversed].every(value => Number.isFinite(value.time) && Number.isFinite(value.energy) && value.energy >= 0 && value.energy <= 1.001 && value.pointer.every(Number.isFinite)), { forward, reversed });
    await station(page, 'Music', 'music'); await screenshot(page, '04-music');

    const beforeAway = await state(page);
    await page.evaluate(() => { window.__wormholeOriginalCanvas = document.querySelector('canvas.spatial-world-canvas'); location.hash = '#/settings'; });
    await page.getByRole('heading', { name: /MAKE IT/i }).waitFor(); await page.waitForTimeout(650);
    const away = await state(page); await page.waitForTimeout(550); const awayHeld = await state(page);
    check('Leaving Passage releases its continuous render work', awayHeld.time === away.time && awayHeld.draws === away.draws, { away, awayHeld });
    await page.evaluate(() => { location.hash = '#/'; }); await ready(page); await page.waitForTimeout(300);
    const returned = await state(page);
    check('Returning retains one renderer and six chapter interfaces without duplicates', returned.canvasCount === 1 && returned.cssScenes === 1 && returned.panels === 6 && returned.wormholeDraws >= 2 && returned.wormholeDraws <= 3, { beforeAway, returned });
    measurements.push({ name: 'Route resource lifecycle', persistentCanvasReused: await page.evaluate(() => window.__wormholeOriginalCanvas === document.querySelector('canvas.spatial-world-canvas')) });
    await page.waitForFunction(time => Number(document.querySelector('canvas.spatial-world-canvas')?.dataset.wormholeTime) > time + .1, returned.time);
    check('Returning to Passage resumes animation', (await state(page)).time > returned.time);
  });

  for (const [name, options] of [
    ['compact', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
    ['reduced', { reducedMotion: 'reduce' }],
  ]) {
    await scenario(name, options, async page => {
      await page.waitForTimeout(500); const first = await state(page);
      await page.waitForTimeout(850); const second = await state(page);
      check(`${name} presents a static wormhole`, first.mode === 'still' && second.mode === 'still' && first.time === second.time && second.pointer.every(value => value === 0), { first, second });
      check(`${name} retains usable content without overflow`, await page.getByRole('button', { name: 'ENTER THE WORLD', exact: true }).isVisible() && second.panels === 6 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), second);
      await gpuEvidence(page, name);
      await screenshot(page, name === 'compact' ? '05-compact' : '06-reduced');
    });
  }
  check('No runtime or WebGL shader errors', errors.length === 0, errors);
} finally {
  await persistResults();
  await browser.close();
  console.log(`${checks.filter(value => value.passed).length} passed; ${checks.filter(value => !value.passed).length} failed.`);
  if (checks.some(value => !value.passed)) process.exitCode = 1;
}
