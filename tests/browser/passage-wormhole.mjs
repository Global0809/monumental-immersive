import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:5184/';
const output = process.env.WORMHOLE_OUTPUT || 'output/playwright/passage-wormhole';
const recordVideo = process.env.WORMHOLE_VIDEO === '1';
const failFast = process.env.WORMHOLE_FAIL_FAST === '1';
const selectedScenarios = new Set((process.env.WORMHOLE_SCENARIOS || '').split(',').filter(Boolean));
const checks = [], errors = [], measurements = [], limitations = [];
const chapters = ['entrance', 'world', 'time-machine', 'movies', 'music', 'culture', 'my-world'];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const address = route => { const url = new URL(base); url.hash = route; return url.href; };
const canvas = page => page.locator('canvas.spatial-world-canvas');
const persistResults = () => writeFile(`${output}/results.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), scenarios: [...selectedScenarios], checks, errors, measurements, limitations }, null, 2));
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
        frames: [], programRecords: new Set(), buffer: null, vaos: new Map(), depthClears: new Map(),
        // Initial WebGL defaults; every subsequent state mutation is observed.
        drawState: { blend: false, depthTest: false, depthWrite: true, depthFunc: 513,
          blendEquationRGB: 32774, blendEquationAlpha: 32774,
          blendSrcRGB: 1, blendDstRGB: 0, blendSrcAlpha: 1, blendDstAlpha: 0 },
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
        id: id(program), shaders: new Set(), links: 0, matrices: {}, vectors: {}, vectorUploads: {}, scalars: {}, draws: 0,
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
        sky: /background|sky|environment/i.test(/#define SHADER_NAME ([^\n]+)/.exec(combined)?.[1] || '') || /gl_Position\.z\s*=\s*gl_Position\.w/.test(vertex),
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
      const drawState = { ...state.drawState }, depthEpoch = state.depthClears.get(framebuffer) || 0;
      const signature = `${program.id}:${vao}:${framebuffer}:${method}:${count}:${instances}:${Number(drawState.blend)}:${Number(drawState.depthWrite)}:${Number(drawState.depthTest)}:${depthEpoch}`;
      if (description.wormhole) frame.wormhole[signature] = { program: program.id, name: description.name, vao, framebuffer,
        method, count, instances, projection, view, perspective: description.perspective,
        fullscreen: description.fullscreen, elementBuffer: id(vaoState(state).elementBuffer),
        order: frame.calls, drawState, depthEpoch, vectors: { ...program.vectors }, vectorUploads: { ...program.vectorUploads }, flow: program.scalars.uFlow,
        instanceAttributes: [...vaoState(state).attributes.values()].filter(attribute => attribute.divisor > 0).length,
        vertexBuffers: [...new Set([...vaoState(state).attributes.values()].map(attribute => id(attribute.buffer)))],
      };
      else frame.baseline[signature] = { vao, program: program.id, name: description.name, framebuffer,
        projection, perspective: description.perspective, sky: description.sky,
        order: frame.baseline[signature]?.order ?? frame.calls, lastOrder: frame.calls,
        drawState, depthEpoch };
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
      const capability = (gl, name, enabled) => {
        if (name === gl.BLEND) contextState(gl).drawState.blend = enabled;
        if (name === gl.DEPTH_TEST) contextState(gl).drawState.depthTest = enabled;
      };
      wrap('enable', (gl, [name]) => capability(gl, name, true));
      wrap('disable', (gl, [name]) => capability(gl, name, false));
      wrap('depthMask', (gl, [value]) => { contextState(gl).drawState.depthWrite = value; });
      wrap('depthFunc', (gl, [value]) => { contextState(gl).drawState.depthFunc = value; });
      wrap('blendEquation', (gl, [value]) => {
        Object.assign(contextState(gl).drawState, { blendEquationRGB: value, blendEquationAlpha: value });
      });
      wrap('blendEquationSeparate', (gl, [rgb, alpha]) => {
        Object.assign(contextState(gl).drawState, { blendEquationRGB: rgb, blendEquationAlpha: alpha });
      });
      wrap('blendFunc', (gl, [source, destination]) => {
        Object.assign(contextState(gl).drawState, { blendSrcRGB: source, blendDstRGB: destination, blendSrcAlpha: source, blendDstAlpha: destination });
      });
      wrap('blendFuncSeparate', (gl, [sourceRGB, destinationRGB, sourceAlpha, destinationAlpha]) => {
        Object.assign(contextState(gl).drawState, { blendSrcRGB: sourceRGB, blendDstRGB: destinationRGB, blendSrcAlpha: sourceAlpha, blendDstAlpha: destinationAlpha });
      });
      const depthClear = gl => {
        const state = contextState(gl), framebuffer = id(state.framebuffer);
        state.depthClears.set(framebuffer, (state.depthClears.get(framebuffer) || 0) + 1);
      };
      wrap('clear', (gl, [mask]) => { if (mask & gl.DEPTH_BUFFER_BIT) depthClear(gl); });
      wrap('clearBufferfv', (gl, [buffer]) => { if (buffer === gl.DEPTH) depthClear(gl); });
      wrap('clearBufferfi', (gl, [buffer]) => { if (buffer === gl.DEPTH_STENCIL) depthClear(gl); });
      wrap('getUniformLocation', (gl, [program, name], location) => {
        if (location) uniformLocations.set(location, { program: programState(program), name });
      });
      wrap('uniformMatrix4fv', (gl, [location, transpose, values]) => {
        const uniform = uniformLocations.get(location);
        if (uniform && /^(projectionMatrix|viewMatrix)$/.test(uniform.name)) uniform.program.matrices[uniform.name] = Array.from(values);
      });
      const observeVector = (location, values) => {
        const uniform = uniformLocations.get(location);
        if (!uniform || !/^(uParallax|uParallaxVelocity)$/.test(uniform.name)) return;
        uniform.program.vectors[uniform.name] = values;
        uniform.program.vectorUploads[uniform.name] = (uniform.program.vectorUploads[uniform.name] || 0) + 1;
      };
      wrap('uniform2f', (gl, [location, x, y]) => observeVector(location, [x, y]));
      wrap('uniform2fv', (gl, [location, values, offset = 0]) => observeVector(location, Array.from(values).slice(offset, offset + 2)));
      wrap('uniform1f', (gl, [location, value]) => {
        const uniform = uniformLocations.get(location);
        if (uniform?.name === 'uFlow') uniform.program.scalars.uFlow = value;
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
      parallax: (since = null) => active().flatMap(state => {
        const frames = state.frames.filter(frame => frame.wormholeCalls > 0 && (since === null || frame.time >= since));
        const selected = since === null ? frames.slice(-1) : frames;
        return selected.map(frame => ({ time: frame.time, rafTime: frame.rafTime,
          draws: Object.values(frame.wormhole).map(draw => ({ name: draw.name, vectors: draw.vectors,
            projection: draw.projection, uploads: draw.vectorUploads, flow: draw.flow,
          })),
        }));
      }),
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
      gpuParallax: window.__wormholeAudit.parallax(),
      scrollY, camera: camera?.style.transform || '', chapter: host?.dataset.passageChapter,
      reading: host?.dataset.passageReading, panelTransform: activePanel?.style.transform || '',
      canvasCount: document.querySelectorAll('canvas.spatial-world-canvas').length,
      cssScenes: document.querySelectorAll('.tunnel-css-world').length,
      panels: document.querySelectorAll('[data-tunnel-station]').length,
    };
  });
}

const parallaxDraws = value => value.gpuParallax?.at(-1)?.draws || [];
const parallaxPosition = value => parallaxDraws(value).find(draw => /dimensional wall/i.test(draw.name))?.vectors.uParallax || [];
const vectorDistance = (a, b) => a.length === 2 && b.length === 2 ? Math.hypot(a[0] - b[0], a[1] - b[1]) : Infinity;
const parallaxValues = value => parallaxDraws(value).map(draw => ({ name: draw.name, vectors: draw.vectors }));
const validParallax = value => parallaxDraws(value).length === 2 && parallaxDraws(value).every(draw => {
  const position = draw.vectors.uParallax || [], velocity = draw.vectors.uParallaxVelocity || [];
  return position.length === 2 && velocity.length === 2 && position.every(Number.isFinite) && velocity.every(Number.isFinite) &&
    position.every(axis => Math.abs(axis) <= 1.001) && Math.hypot(...velocity) <= 3.001 &&
    draw.uploads.uParallax >= 1 && draw.uploads.uParallaxVelocity >= 1;
});
const maxParallaxStep = frames => {
  const positions = frames.map(frame => parallaxPosition({ gpuParallax: [frame] })).filter(value => value.length === 2);
  return Math.max(0, ...positions.slice(1).map((position, index) => vectorDistance(position, positions[index])));
};
const sameReadingFrame = (a, b) => a.camera !== '' && a.camera === b.camera && a.panelTransform === b.panelTransform &&
  a.chapter === b.chapter && a.reading === 'true' && b.reading === 'true' && Math.abs(a.scrollY - b.scrollY) < 1;

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
  const wall = submitted.find(draw => /dimensional wall/i.test(draw.name));
  const streaks = submitted.find(draw => /instanced streaks/i.test(draw.name));
  // Compare within this perspective scene and framebuffer. Post-processing,
  // sky/background passes and transparent ornaments are deliberately excluded.
  const opaqueStructure = (frame?.baseline || []).filter(draw => wall &&
    draw.framebuffer === wall.framebuffer && draw.projection === wall.projection &&
    draw.perspective && !draw.sky && draw.drawState.depthTest && draw.drawState.depthWrite && !draw.drawState.blend);
  const occlusion = { wall, streaks, opaqueStructureCount: opaqueStructure.length,
    firstOpaqueOrder: Math.min(...opaqueStructure.map(draw => draw.order)),
    lastOpaqueOrder: Math.max(...opaqueStructure.map(draw => draw.lastOrder)),
    opaqueDepthEpochs: [...new Set(opaqueStructure.map(draw => draw.depthEpoch))],
  };
  measurements.push({ name: `${label} actual GL atmosphere and metal compositing order`, ...occlusion });
  await writeFile(`${output}/${label}-gpu-draw-order.json`, JSON.stringify({ ...occlusion, opaqueStructure }, null, 2));
  check(`${label} draws the cloud wall before opaque structure in the same scene`,
    wall && opaqueStructure.length >= 5 && opaqueStructure.every(draw => wall.order < draw.order && wall.depthEpoch === draw.depthEpoch), occlusion);
  const wallState = wall?.drawState;
  check(`${label} alpha blends the cloud wall without writing structural depth`, wallState &&
    wallState.blend && wallState.depthTest && !wallState.depthWrite && [513, 515].includes(wallState.depthFunc) &&
    wallState.blendEquationRGB === 32774 && wallState.blendEquationAlpha === 32774 &&
    wallState.blendSrcRGB === 770 && wallState.blendDstRGB === 771 &&
    wallState.blendSrcAlpha === 1 && wallState.blendDstAlpha === 771, occlusion);
  const streakState = streaks?.drawState;
  check(`${label} depth tests streaks against the already drawn opaque structure`, streakState &&
    streakState.blend && streakState.depthTest && !streakState.depthWrite && [513, 515].includes(streakState.depthFunc) &&
    streaks.framebuffer === wall.framebuffer && streaks.projection === wall.projection &&
    opaqueStructure.length >= 5 && opaqueStructure.every(draw => streaks.order > draw.lastOrder && streaks.depthEpoch === draw.depthEpoch), occlusion);
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
  if (selectedScenarios.size && !selectedScenarios.has(name)) return;
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
    if (failFast) throw error;
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
    const inspectionHeld = await state(page);
    check('Exhibit inspection freezes wormhole time', inspectionHeld.time === inspected.time, inspected.time);
    check('Exhibit inspection freezes actual GPU parallax and velocity uniforms', validParallax(inspected) && validParallax(inspectionHeld) &&
      JSON.stringify(parallaxValues(inspected)) === JSON.stringify(parallaxValues(inspectionHeld)), { inspected: parallaxValues(inspected), held: parallaxValues(inspectionHeld) });
    await page.keyboard.press('Escape');
    await page.waitForFunction(time => Number(document.querySelector('canvas.spatial-world-canvas')?.dataset.wormholeTime) > time + .15, inspected.time);
    check('Closing inspection resumes the flow', (await state(page)).time > inspected.time);

    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const hidden = await state(page); await page.waitForTimeout(650); const held = await state(page);
    check('Simulated hidden visibility freezes time and WebGL drawing', held.time === hidden.time && held.draws === hidden.draws, { hidden, held });
    check('Hidden visibility retains the last submitted GPU parallax without advancing it', validParallax(hidden) && validParallax(held) &&
      JSON.stringify(parallaxValues(hidden)) === JSON.stringify(parallaxValues(held)), { hidden: parallaxValues(hidden), held: parallaxValues(held) });
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

  await scenario('desktop-parallax', {}, async page => {
    await station(page, 'The World', 'world');
    await page.mouse.move(720, 450, { steps: 8 }); await page.waitForTimeout(850);
    const center = await state(page);
    check('Both rendered wormhole passes receive bounded GPU parallax uniforms', validParallax(center) &&
      Math.hypot(...parallaxPosition(center)) < .08, parallaxValues(center));
    await screenshot(page, '07-parallax-center');

    const started = await page.evaluate(() => performance.now());
    await page.mouse.move(120, 490, { steps: 12 }); await page.waitForTimeout(750);
    const left = await state(page); await screenshot(page, '08-parallax-left');
    await page.mouse.move(1320, 490, { steps: 18 }); await page.waitForTimeout(750);
    const right = await state(page); await screenshot(page, '09-parallax-right');
    const sweep = await page.evaluate(since => window.__wormholeAudit.parallax(since), started);
    measurements.push({ name: 'Pointer center and side views at The World reading hold', center, left, right,
      maximumSubmittedStep: maxParallaxStep(sweep), note: 'Screenshots retain the live flow clock; only pointer input changes. They are not frozen-time pixel comparisons.' });
    await writeFile(`${output}/desktop-parallax-sweep.json`, JSON.stringify(sweep, null, 2));
    check('Pointer left and right reach signed actual GPU parallax in both passes', validParallax(left) && validParallax(right) &&
      parallaxDraws(left).every(draw => draw.vectors.uParallax[0] < -.35) &&
      parallaxDraws(right).every(draw => draw.vectors.uParallax[0] > .35), { left: parallaxValues(left), right: parallaxValues(right) });
    check('Parallax preserves the reading camera, DOM panel and native scroll', sameReadingFrame(center, left) && sameReadingFrame(center, right), { center, left, right });
    check('GPU parallax uses bounded velocity and intermediate rendered positions', sweep.length >= 8 &&
      sweep.every(frame => validParallax({ gpuParallax: [frame] })) &&
      sweep.some(frame => frame.draws.some(draw => Math.hypot(...(draw.vectors.uParallaxVelocity || [])) > .08)) &&
      maxParallaxStep(sweep) < .35, { renderedSamples: sweep.length, maximumSubmittedStep: maxParallaxStep(sweep) });

    const index = await page.getByRole('button', { name: 'Open Index', exact: true }).boundingBox();
    assert.ok(index, 'The visible Index button supplies the UI-crossing target');
    const crossingStarted = await page.evaluate(() => performance.now());
    await page.mouse.move(index.x + index.width / 2, index.y + index.height / 2, { steps: 12 });
    await page.waitForTimeout(650);
    const overUI = await state(page);
    const crossing = await page.evaluate(since => window.__wormholeAudit.parallax(since), crossingStarted);
    check('Crossing onto interface controls preserves directional GPU parallax', validParallax(overUI) &&
      parallaxDraws(overUI).every(draw => draw.vectors.uParallax[0] > .45 && draw.vectors.uParallax[1] > .45) &&
      crossing.every(frame => parallaxPosition({ gpuParallax: [frame] })[0] > .3) && sameReadingFrame(center, overUI),
    { overUI: parallaxValues(overUI), renderedSamples: crossing.length });

    await page.mouse.move(1320, 500, { steps: 12 }); await page.waitForTimeout(750);
    const beforePress = await state(page), pressStarted = await page.evaluate(() => performance.now());
    await page.mouse.down(); await page.waitForTimeout(320); const pressed = await state(page);
    await page.mouse.up(); await page.waitForTimeout(320); const released = await state(page);
    const press = await page.evaluate(since => window.__wormholeAudit.parallax(since), pressStarted);
    check('Click hold and release retain GPU parallax without snapping or resetting', [beforePress, pressed, released].every(validParallax) &&
      vectorDistance(parallaxPosition(beforePress), parallaxPosition(pressed)) < .06 &&
      vectorDistance(parallaxPosition(pressed), parallaxPosition(released)) < .06 && maxParallaxStep(press) < .12 &&
      sameReadingFrame(center, released), { before: parallaxValues(beforePress), pressed: parallaxValues(pressed), released: parallaxValues(released), maximumSubmittedStep: maxParallaxStep(press) });

    const leaveStarted = await page.evaluate(() => performance.now());
    await page.mouse.move(-30, 500); await page.waitForTimeout(1100);
    const leftPage = await state(page), decay = await page.evaluate(since => window.__wormholeAudit.parallax(since), leaveStarted);
    const startMagnitude = Math.hypot(...parallaxPosition(released));
    const decayMagnitudes = decay.map(frame => Math.hypot(...parallaxPosition({ gpuParallax: [frame] })));
    await writeFile(`${output}/desktop-parallax-interactions.json`, JSON.stringify({ crossing, press, decay }, null, 2));
    check('Leaving the viewport eases GPU parallax through intermediate positions to rest', validParallax(leftPage) && decay.length >= 8 &&
      decayMagnitudes.some(value => value > startMagnitude * .15 && value < startMagnitude * .85) &&
      Math.hypot(...parallaxPosition(leftPage)) < .06 && maxParallaxStep(decay) < .35 && sameReadingFrame(center, leftPage),
    { before: parallaxValues(released), after: parallaxValues(leftPage), renderedSamples: decay.length, maximumSubmittedStep: maxParallaxStep(decay) });
    limitations.push('Pointer side-view screenshots use the live animation clock and unchanged reading camera/DOM. GPU uniform histories establish input continuity; these captures do not isolate parallax with a frozen-time image difference.');
  });

  await scenario('narrow-desktop', { viewport: { width: 1100, height: 900 }, hasTouch: false }, async page => {
    const input = await page.evaluate(() => ({
      fineHover: matchMedia('(hover: hover) and (pointer: fine)').matches,
      coarse: matchMedia('(pointer: coarse)').matches,
      compactLayout: document.querySelector('.tunnel-journey')?.getAttribute('data-compact'),
    }));
    check('Narrow desktop uses compact content layout with a fine hover pointer', input.fineHover && !input.coarse && input.compactLayout === 'true', input);
    await page.mouse.move(550, 450); await page.waitForTimeout(500);
    const first = await state(page); await page.waitForTimeout(700); const second = await state(page);
    const flowBefore = parallaxDraws(first), flowAfter = parallaxDraws(second);
    check('Narrow desktop keeps flow active in the actual GPU uniforms', first.mode === 'flow' && second.mode === 'flow' &&
      second.time > first.time + .2 && second.draws > first.draws && flowBefore.length === 2 && flowAfter.length === 2 &&
      flowAfter.every(draw => Number.isFinite(draw.flow) && draw.flow > flowBefore.find(before => before.name === draw.name)?.flow + .03),
    { first: flowBefore, second: flowAfter, firstTime: first.time, secondTime: second.time });
    const hintClearance = await page.evaluate(() => {
      const hint = document.querySelector('.tunnel-hero-bottom button').getBoundingClientRect();
      const nav = document.querySelector('.tunnel-wayfinder').getBoundingClientRect();
      return { hintTop: hint.top, hintBottom: hint.bottom, hintHeight: hint.height, navigationTop: nav.top };
    });
    check('Narrow desktop scroll hint clears the fixed wayfinder', hintClearance.hintHeight > 0 && hintClearance.hintTop >= 0 &&
      hintClearance.hintBottom <= hintClearance.navigationTop - 8, hintClearance);
    await screenshot(page, '10-narrow-desktop-opening');
    await page.mouse.move(100, 450, { steps: 10 }); await page.waitForTimeout(750); const left = await state(page);
    await page.mouse.move(1000, 450, { steps: 14 }); await page.waitForTimeout(750); const right = await state(page);
    check('Narrow desktop mouse drives signed GPU parallax in both wormhole passes', validParallax(left) && validParallax(right) &&
      parallaxDraws(left).every(draw => draw.vectors.uParallax[0] < -.35) &&
      parallaxDraws(right).every(draw => draw.vectors.uParallax[0] > .35), { left: parallaxValues(left), right: parallaxValues(right) });
    await page.getByRole('button', { name: 'Travel to The World', exact: true }).click();
    await page.waitForFunction(() => {
      const mount = document.querySelector('[data-tunnel-station="world"]');
      // Compact cards restore ordinary DOM semantics: aria-hidden is absent,
      // whereas a mounted CSS3D panel explicitly sets it to "false".
      return document.querySelector('[data-passage-chapter]')?.getAttribute('data-passage-chapter') === 'world' &&
        mount && mount.getAttribute('aria-hidden') !== 'true' && !mount.inert;
    });
    await page.waitForTimeout(550);
    const card = page.locator('[data-tunnel-station="world"] .tunnel-panel');
    const layout = await card.evaluate(element => {
      const heading = element.querySelector('h2'), bounds = heading.getBoundingClientRect();
      return { transform: getComputedStyle(element).transform, text: heading.textContent,
        heading: { left: bounds.left, right: bounds.right, width: bounds.width, height: bounds.height },
        viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    check('Narrow desktop retains readable normal DOM cards without horizontal overflow', await card.isVisible() &&
      layout.transform === 'none' && /EVERY PLACE/i.test(layout.text) && layout.heading.width >= 200 && layout.heading.height >= 20 &&
      layout.heading.left >= -1 && layout.heading.right <= layout.viewport + 1 && !layout.overflow, layout);
    const retained = await state(page);
    check('Narrow desktop retains one renderer and all six chapter interfaces', retained.canvasCount === 1 && retained.cssScenes === 1 && retained.panels === 6, retained);
    measurements.push({ name: 'Narrow desktop fine-pointer compact layout', input, layout, left: parallaxValues(left), right: parallaxValues(right) });
    await screenshot(page, '11-narrow-desktop-world');
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
      await page.mouse.move(options.viewport ? 350 : 1320, 400); await page.waitForTimeout(250);
      const stillParallax = await state(page);
      check(`${name} keeps actual GPU parallax and velocity at zero after pointer input`, validParallax(stillParallax) &&
        parallaxDraws(stillParallax).every(draw => [...draw.vectors.uParallax, ...draw.vectors.uParallaxVelocity].every(value => value === 0)), parallaxValues(stillParallax));
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
