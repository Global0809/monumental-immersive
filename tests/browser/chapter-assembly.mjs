// Focused real-browser review for the reversible chapter mechanism and its score.
// Run against Vite: node tests/browser/chapter-assembly.mjs [base]
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://127.0.0.1:5184').replace(/\/$/, '');
const mode = process.argv[3] || 'all';
const out = 'output/playwright/chapter-assembly';
await mkdir(out, { recursive: true });
const chapters = [['world', 'The World'], ['time-machine', 'Time Machine'], ['movies', 'The Cinema'], ['music', 'Music'], ['culture', 'Culture'], ['my-world', 'My World']];
const report = { base, checkedAt: new Date().toISOString(), checks: [], measurements: [], errors: [], notes: [
  'Chromium with native scrolling, real WebGL and real Web Audio; mobile sizes are emulated.',
  'Captured audio is measured/recorded, not a claim of subjective listening on physical hardware.',
] };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const check = (name, condition, detail) => { assert.ok(condition, name + (detail ? ': ' + JSON.stringify(detail) : '')); report.checks.push({ name, passed: true, detail }); };
const url = route => base + '/#' + route;
const panel = (page, i) => page.locator(`[data-tunnel-station="${chapters[i][0]}"] .tunnel-panel`);
const wait = (page, ms = 130) => page.waitForTimeout(ms);

async function instrument(context) {
  await context.addInitScript(() => {
    const qa = window.__assemblyQA = { contexts: [], pulses: [], videos: [], sources: [] };
    const NativeAudio = window.AudioContext;
    window.AudioContext = class extends NativeAudio {
      constructor(...args) { super(...args); qa.contexts.push(this); }
      createAnalyser() { const node = super.createAnalyser(); const destination = this.createMediaStreamDestination(); node.connect(destination); qa.stream = destination.stream; qa.analyser = node; return node; }
      createBufferSource() {
        const node = super.createBufferSource(), start = node.start.bind(node), stop = node.stop.bind(node);
        const entry = { node, started: false, ended: false }; qa.sources.push(entry);
        node.start = (...args) => { entry.started = true; return start(...args); };
        node.stop = (...args) => stop(...args);
        node.addEventListener('ended', () => { entry.ended = true; }); return node;
      }
    };
    const create = Document.prototype.createElement;
    Document.prototype.createElement = function(...args) { const element = create.apply(this, args); if (String(args[0]).toLowerCase() === 'video') qa.videos.push(element); return element; };
    window.addEventListener('monumental:sonic-pulse', event => qa.pulses.push({ ...event.detail, frame: window.__journey?.getTunnelFrame(), assembly: window.__assembly && window.__journey ? window.__assembly.samplePassageAssembly(window.__journey.getTunnelFrame().active, window.__journey.getTunnelFrame()) : null }));
  });
}
async function ready(page, fallback = false) {
  await page.locator('.tunnel-journey').waitFor();
  await page.locator(fallback ? '.spatial-world--fallback' : '.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage && !document.querySelector('main')?.inert);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const loaded = name => resources.find(item => item.name.includes('/src/services/' + name + '.ts'))?.name || '/src/services/' + name + '.ts';
    window.__journey = await import(loaded('tunnelJourney'));
    window.__assembly = await import(loaded('passageAssembly'));
    window.__audio = await import(loaded('audio'));
    window.__viewer = await import(loaded('viewer'));
  });
}
async function progress(page, index, amount) {
  const target = await page.evaluate(({ index, amount }) => {
    const section = document.querySelectorAll('.tunnel-checkpoint')[index];
    const top = section.getBoundingClientRect().top + scrollY + section.offsetHeight * amount;
    window.scrollTo({ top, behavior: 'instant' }); return Math.min(top, document.documentElement.scrollHeight - innerHeight);
  }, { index, amount });
  await page.waitForFunction(target => Math.abs(scrollY - target) < 2, target); await wait(page, 105);
  return page.evaluate(index => ({ frame: window.__journey.getTunnelFrame(), assembly: window.__assembly.samplePassageAssembly(index, window.__journey.getTunnelFrame()), calls: Number(document.querySelector('[data-passage-draw-calls]')?.dataset.passageDrawCalls || 0) }), index);
}
async function entrance(page, amount) {
  await page.evaluate(amount => { const first = document.querySelector('.tunnel-checkpoint'); window.scrollTo({ top: (first.getBoundingClientRect().top + scrollY) * amount, behavior: 'instant' }); }, amount);
  await wait(page, 120);
}
async function station(page, index, compact = false) {
  const selector = page.getByRole('combobox', { name: 'Choose Passage station' });
  if (compact && await selector.isVisible()) await selector.selectOption(String(index));
  else await page.getByRole('button', { name: 'Travel to ' + chapters[index][1], exact: true }).click();
  if (compact) await page.waitForFunction(index => window.__journey.getTunnelFrame().active === index, index);
  else await page.waitForFunction(id => { const host = document.querySelector('[data-passage-chapter]'), mount = document.querySelector(`[data-tunnel-station="${id}"]`); return host?.dataset.passageChapter === id && host.dataset.passageReading === 'true' && mount?.getAttribute('aria-hidden') === 'false' && !mount.inert; }, chapters[index][0]);
  await wait(page, 350);
}
async function scenario(name, options, work) {
  if (mode === 'visual' && ['mechanical-score', 'studio'].includes(name) || mode === 'audio' && !['mechanical-score', 'studio'].includes(name)) return;
  if (!['all', 'visual', 'audio'].includes(mode) && !mode.split(',').includes(name)) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  await instrument(context); const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push({ scenario: name, message: error.message }));
  page.on('console', message => { if (/WebGLProgram|shader error|VALIDATE_STATUS/.test(message.text())) report.errors.push({ scenario: name, message: message.text() }); });
  try { await work(page, context); }
  catch (error) { report.checks.push({ name, passed: false, detail: error.stack }); await page.screenshot({ path: `${out}/failure-${name}.png` }).catch(() => {}); }
  finally { await context.close(); }
}
async function graphCount(page) {
  return page.evaluate(async () => {
    const loaded = performance.getEntriesByType('resource').find(entry => /gsap_ScrollTrigger\.js/.test(entry.name));
    const triggers = loaded ? (await import(loaded.name)).ScrollTrigger.getAll().length : null;
    return { canvases: document.querySelectorAll('.spatial-world-canvas').length, cssScenes: document.querySelectorAll('.tunnel-css-world').length, mounts: document.querySelectorAll('[data-tunnel-station]').length, triggers };
  });
}
async function startCapture(page) {
  return page.evaluate(() => {
    const qa = window.__assemblyQA, canvas = document.querySelector('canvas.spatial-world-canvas');
    if (!canvas?.captureStream || !qa.stream || !MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) return false;
    const stream = new MediaStream([...canvas.captureStream(24).getVideoTracks(), ...qa.stream.getAudioTracks()]);
    qa.chunks = []; qa.recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 2400000 });
    qa.recorder.ondataavailable = event => { if (event.data.size) qa.chunks.push(event.data); }; qa.recorder.start(250); return true;
  });
}
async function finishCapture(page) {
  const content = await page.evaluate(() => new Promise(resolve => {
    const qa = window.__assemblyQA;
    if (!qa.recorder || qa.recorder.state === 'inactive') return resolve(null);
    qa.recorder.onstop = async () => {
      const bytes = new Uint8Array(await new Blob(qa.chunks, { type: qa.recorder.mimeType }).arrayBuffer());
      let value = ''; for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192));
      resolve(btoa(value)); qa.recorder.stream.getVideoTracks().forEach(track => track.stop());
    }; qa.recorder.stop();
  }));
  if (content) await writeFile(out + '/mechanism-and-score.webm', Buffer.from(content, 'base64'));
}

try {
  await scenario('desktop', {}, async page => {
    await page.goto(url('/')); await ready(page); await wait(page, 700);
    check('Opening copy, native entry and six chapters remain present', await page.locator('.tunnel-hero h1').getAttribute('aria-label') === 'CULTURE. WITHOUT BORDERS.' && await page.locator('.tunnel-panel').count() === 6);
    await page.screenshot({ path: out + '/00-opening.png' }); const initialResources = await graphCount(page);
    for (let i = 0; i < chapters.length; i++) {
      const [id, title] = chapters[i];
      const mid = await progress(page, i, .21);
      const content = await page.locator(`[data-tunnel-station="${id}"]`).evaluate(el => ({ inert: el.inert, opacity: Number(el.style.opacity), clip: el.style.clipPath }));
      check(title + ': staged mechanism before readable content', mid.assembly.release > .9 && mid.assembly.spine > .5 && mid.assembly.screen < .9 && content.inert && content.opacity < .05, { assembly: mid.assembly, content });
      if (i < 2) await page.screenshot({ path: out + '/' + String(i + 1).padStart(2, '0') + '-' + id + '-assembling.png' });
      const read = await progress(page, i, .5);
      check(title + ': all joints settle at their authored reading pose', ['release', 'spine', 'hinges', 'leaves', 'screen', 'lock', 'content'].every(key => read.assembly[key] === 1), read.assembly);
      const bounds = await panel(page, i).evaluate(el => {
        const mount = el.closest('[data-tunnel-station]'), headline = el.querySelector('h2').getBoundingClientRect(), action = el.querySelector('.tunnel-enter-room').getBoundingClientRect();
        return { readable: !mount.inert && mount.getAttribute('aria-hidden') === 'false', clip: mount.style.clipPath, opacity: mount.style.opacity, headline: { x: headline.x, y: headline.y, right: headline.right, bottom: headline.bottom }, action: { x: action.x, y: action.y, right: action.right, bottom: action.bottom }, viewport: [innerWidth, innerHeight], header: document.querySelector('.site-header').getBoundingClientRect().bottom, nav: document.querySelector('.tunnel-wayfinder').getBoundingClientRect().top };
      });
      check(title + ': text and action remain readable without shutter clipping', bounds.readable && bounds.clip === 'none' && bounds.opacity === '1' && bounds.headline.x >= 0 && bounds.headline.right <= bounds.viewport[0] && bounds.headline.y >= bounds.header - 2 && bounds.action.bottom < bounds.nav, bounds);
      await page.screenshot({ path: out + '/' + String(i + 1).padStart(2, '0') + '-' + id + '-reading.png' });
      await progress(page, i, .42); const first = await panel(page, i).boundingBox(); await progress(page, i, .68); const last = await panel(page, i).boundingBox();
      const shift = Math.max(...['x', 'y', 'width', 'height'].map(key => Math.abs(first[key] - last[key])));
      check(title + ': reading interval remains stationary', shift < .75, { pixels: shift });
      report.measurements.push({ chapter: id, approachDrawCalls: mid.calls, readingDrawCalls: read.calls });
      check(title + ': renderer remains within a bounded draw budget', mid.calls < 480 && read.calls < 420, { approach: mid.calls, reading: read.calls });
    }
    const forward = [];
    for (const p of [.12, .18, .24, .30, .5]) forward.push((await progress(page, 1, p)).assembly);
    for (let j = forward.length - 1; j >= 0; j--) { const back = (await progress(page, 1, [.12, .18, .24, .30, .5][j])).assembly; check('Reverse scroll reconstructs stage ' + j, Object.keys(back).every(key => typeof back[key] === 'boolean' ? back[key] === forward[j][key] : Math.abs(back[key] - forward[j][key]) < .003)); }
    for (const index of [5, 0, 4, 1, 3, 2]) { await station(page, index); check('Direct chapter jump resolves ' + chapters[index][0], await panel(page, index).evaluate(el => !el.closest('[data-tunnel-station]').inert)); }
    await station(page, 1);
    const inspect = panel(page, 1).getByRole('button', { name: 'Inspect Time Machine exhibit', exact: true });
    await inspect.click(); await panel(page, 1).getByRole('button', { name: 'Rotate Time Machine sculpture right', exact: true }).click();
    await panel(page, 1).getByRole('button', { name: 'Reset', exact: true }).click(); await page.keyboard.press('Escape');
    check('Inspect, rotation, reset and Escape preserve chapter control ownership', await inspect.getAttribute('aria-expanded') === 'false' && await inspect.evaluate(el => document.activeElement === el));
    await inspect.click(); await station(page, 3);
    check('Chapter navigation safely closes inspection before the next arrival', await page.evaluate(() => !window.__journey.getTunnelInspection().expanded) && await panel(page, 3).evaluate(el => !el.closest('[data-tunnel-station]').inert));
    await station(page, 1);
    await panel(page, 1).locator('.tunnel-story').click(); await page.locator('.ms-player-dialog:modal').waitFor();
    check('Chapter film action still opens the real player', await page.locator('.ms-player-dialog video').count() === 1);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.ms-player-dialog:modal'));
    check('Player closure restores a usable chapter', await panel(page, 1).locator('.tunnel-enter-room').isVisible());
    await page.evaluate(() => { location.hash = '#/world'; }); await wait(page, 900); await page.evaluate(() => { location.hash = '#/'; }); await ready(page); await wait(page, 500);
    const returned = await graphCount(page);
    check('Leaving and returning does not duplicate panels, renderers or scroll triggers', JSON.stringify(returned) === JSON.stringify(initialResources), { initialResources, returned });
  });

  await scenario('mechanical-score', {}, async page => {
    await page.goto(url('/')); await ready(page);
    check('Mechanism audio remains silent without opt-in', await page.evaluate(() => window.__assemblyQA.contexts.length === 0));
    check('No score assets load before sound opt-in', await page.evaluate(() => performance.getEntriesByType('resource').every(entry => !entry.name.includes('/audio/score-v2/'))));
    await page.getByRole('button', { name: 'Turn sound on', exact: true }).click(); await wait(page, 1800);
    await page.mouse.move(1425, 75); await entrance(page, 0); await wait(page, 500);
    const capturing = await startCapture(page);
    const portalStart = await page.evaluate(() => window.__assemblyQA.pulses.length), travelSamples = [];
    for (let i = 0; i <= 24; i++) {
      if (i % 4 === 0) await page.mouse.wheel(0, 1); await entrance(page, i / 24);
      travelSamples.push(await page.evaluate(() => ({ frame: window.__journey.getTunnelFrame(), loopCount: window.__assemblyQA.sources.filter(entry => entry.started && !entry.ended && entry.node.loop).length, level: window.__audio.readSoundLevel(), ambient: window.__viewer.getViewer().ambient })));
    }
    const portalPulses = await page.evaluate(n => window.__assemblyQA.pulses.slice(n), portalStart);
    check('The opening iris and actual threshold crossing have distinct synchronized sounds', ['iris-open', 'threshold-pass'].every(type => portalPulses.some(pulse => pulse.type === type)), portalPulses.map(pulse => pulse.type));
    check('Travel has one reactive voice even with optional atmosphere disabled', travelSamples.some(sample => sample.loopCount === 1 && !sample.ambient && sample.level.rms > .00001) && travelSamples.every(sample => sample.loopCount <= 1), travelSamples.map(sample => ({ loops: sample.loopCount, rms: sample.level.rms, ambient: sample.ambient })));
    check('Travel audio remains below clipping', travelSamples.every(sample => Number.isFinite(sample.level.peak) && sample.level.peak < .99));
    await progress(page, 0, .01); await wait(page, 500);
    const before = await page.evaluate(() => window.__assemblyQA.pulses.length);
    for (let i = 0; i <= 24; i++) { if (i % 5 === 0) await page.mouse.wheel(0, 1); await progress(page, 0, .01 + i * .014); await wait(page, 45); }
    await wait(page, 400);
    const pulses = await page.evaluate(before => window.__assemblyQA.pulses.slice(before), before), mechanical = pulses.filter(pulse => pulse.type.startsWith('assembly-'));
    check('Slow physical deployment emits release, drive and lock cues', ['assembly-release', 'assembly-drive', 'assembly-lock'].every(type => mechanical.some(pulse => pulse.type === type)), mechanical);
    check('Mechanical cues are bounded instead of firing each scroll frame', mechanical.length >= 3 && mechanical.length <= 7, mechanical.map(pulse => pulse.type));
    const paused = await page.evaluate(() => window.__assemblyQA.pulses.length); await wait(page, 1100);
    check('Stopped scrolling does not continue a timed mechanical score', await page.evaluate(n => window.__assemblyQA.pulses.length === n, paused));
    check('Settled chapter reading releases the travel loop completely', await page.evaluate(() => window.__assemblyQA.sources.filter(entry => entry.started && !entry.ended && entry.node.loop).length === 0));
    const reverseStart = await page.evaluate(() => window.__assemblyQA.pulses.length);
    for (let i = 18; i >= 0; i--) { if (i % 5 === 0) await page.mouse.wheel(0, -1); await progress(page, 0, .01 + i * .018); }
    const reverse = await page.evaluate(n => window.__assemblyQA.pulses.slice(n), reverseStart);
    check('Reverse folding produces a bounded mechanical response', reverse.some(pulse => /assembly-|sculpture-fold|close/.test(pulse.type)) && reverse.length <= 8, reverse.map(pulse => pulse.type));
    const fast = await page.evaluate(() => window.__assemblyQA.pulses.length); await page.mouse.wheel(0, 1); await progress(page, 5, .5); await wait(page, 1000);
    const skipped = await page.evaluate(n => window.__assemblyQA.pulses.slice(n), fast);
    check('Fast skipping coalesces stages rather than queuing six transformations', skipped.filter(pulse => /assembly-|arrival/.test(pulse.type)).length <= 2, skipped.map(pulse => pulse.type));
    if (capturing) { await finishCapture(page); report.notes.push('mechanism-and-score.webm records the actual WebGL mechanism and post-dynamics audio in one synchronized stream; DOM labels are excluded from this diagnostic clip.'); }
    await station(page, 1); await panel(page, 1).locator('.tunnel-story').click(); await page.locator('.ms-player-dialog:modal').waitFor(); await wait(page, 400);
    check('The full player takes ownership of sound and retires portal loops', await page.evaluate(() => window.__audio.getSonicState().playback && window.__assemblyQA.sources.filter(entry => entry.started && !entry.ended && entry.node.loop).length === 0));
    const playerPulses = await page.evaluate(() => window.__assemblyQA.pulses.length);
    await page.evaluate(() => { window.__audio.playSound('assembly-lock'); window.__audio.setSonicMotion(1, .5); }); await wait(page, 350);
    check('Mechanical cues cannot leak over full film playback', await page.evaluate(n => window.__assemblyQA.pulses.length === n, playerPulses));
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.ms-player-dialog:modal'));
    await page.getByRole('button', { name: 'Turn sound off', exact: true }).click(); const muted = await page.evaluate(() => window.__assemblyQA.pulses.length);
    await page.mouse.wheel(0, -1); await progress(page, 0, .25); await wait(page, 500);
    check('Muted chapter motion emits no sound', await page.evaluate(n => window.__assemblyQA.pulses.length === n, muted));
    check('Muted score releases loop sources and suspends its audio context', await page.evaluate(() => window.__assemblyQA.sources.filter(entry => entry.started && !entry.ended && entry.node.loop).length === 0 && window.__assemblyQA.contexts.every(context => context.state !== 'running')));
    for (const name of ['assembly-release', 'assembly-drive', 'assembly-lock', 'iris-open', 'iris-close', 'threshold-pass', 'portal-travel']) { const response = await page.request.get(base + '/audio/score-v2/' + name + '.wav'); const bytes = await response.body(); check(name + ' is a real available PCM asset', response.ok() && bytes.subarray(0, 4).toString() === 'RIFF'); }
    report.measurements.push({ chapter: 'world', portalPulses, travelSamples, mechanicalPulses: mechanical, reversePulses: reverse, fastPulses: skipped });
  });

  await scenario('compact', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async page => {
    await page.goto(url('/')); await ready(page); await station(page, 1, true);
    check('Phone keeps six accessible chapters without horizontal overflow', await page.locator('.tunnel-panel').count() === 6 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await panel(page, 1).locator('.tunnel-enter-room').scrollIntoViewIfNeeded();
    check('Phone action and actual preview remain reachable', await panel(page, 1).locator('.tunnel-enter-room').isVisible() && await panel(page, 1).locator('.tunnel-compact-window').isVisible());
    await page.screenshot({ path: out + '/mobile-time-machine.png' });
    await page.setViewportSize({ width: 844, height: 390 }); await wait(page, 400);
    check('Short landscape retains native-flow controls', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true' && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: out + '/landscape.png' });
  });
  await scenario('narrow-desktop', { viewport: { width: 1174, height: 809 } }, async page => {
    await page.goto(url('/')); await ready(page);
    for (let i = 0; i < chapters.length; i++) {
      await station(page, i);
      const bounds = await panel(page, i).evaluate(el => { const h = el.querySelector('h2').getBoundingClientRect(), a = el.querySelector('.tunnel-enter-room').getBoundingClientRect(); return { left: h.left, right: h.right, top: h.top, actionBottom: a.bottom, width: innerWidth, header: document.querySelector('.site-header').getBoundingClientRect().bottom, footer: document.querySelector('.tunnel-wayfinder').getBoundingClientRect().top }; });
      check(chapters[i][1] + ': smaller desktop keeps headline and action inside safe view', bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= bounds.header - 2 && bounds.actionBottom < bounds.footer, bounds);
      if (i === 1) await page.screenshot({ path: out + '/time-machine-1174.png' });
    }
    await station(page, 2); await page.setViewportSize({ width: 390, height: 844 }); await wait(page, 600);
    check('Crossing into compact mode preserves the current Cinema chapter', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true' && await page.evaluate(() => window.__journey.getTunnelFrame().active === 2));
    await page.setViewportSize({ width: 1174, height: 809 }); await wait(page, 750);
    check('Returning to desktop preserves one readable Cinema panel', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'false' && await panel(page, 2).evaluate(el => !el.closest('[data-tunnel-station]').inert) && await page.locator('.tunnel-panel').count() === 6);
  });
  await scenario('reduced', { reducedMotion: 'reduce' }, async page => {
    await page.goto(url('/')); await ready(page); await station(page, 2, true);
    check('Reduced motion uses stationary compact scenes and poster media', await page.locator('.tunnel-journey').getAttribute('data-compact') === 'true' && await panel(page, 2).locator('.tunnel-compact-window img').isVisible() && await page.evaluate(() => window.__assemblyQA.videos.filter(v => v.dataset.passageAmbient === 'true').every(v => v.paused)));
    await page.getByRole('button', { name: 'Turn sound on', exact: true }).click(); await wait(page, 1600); const before = await page.evaluate(() => window.__assemblyQA.pulses.length); await station(page, 4, true);
    check('Reduced-motion navigation does not add mechanical stage sounds', await page.evaluate(n => window.__assemblyQA.pulses.slice(n).every(p => !p.type.startsWith('assembly-')), before));
    await page.screenshot({ path: out + '/reduced-culture.png' });
  });
  await scenario('fallback', {}, async (page, context) => {
    await context.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(name, ...args) { return /webgl|experimental-webgl/.test(String(name)) ? null : original.call(this, name, ...args); }; });
    await page.goto(url('/')); await ready(page, true); await station(page, 0, true);
    check('WebGL failure preserves the same six interfaces and destinations', await page.locator('.tunnel-panel').count() === 6 && await panel(page, 0).locator('.tunnel-enter-room').isVisible());
    await page.screenshot({ path: out + '/webgl-fallback.png' });
  });
  await scenario('studio', {}, async page => {
    await page.goto(url('/')); await ready(page);
    await page.getByRole('button', { name: 'Open Index', exact: true }).click();
    await page.getByRole('button', { name: 'Sound Studio', exact: true }).click();
    const studio = page.locator('#sound-console:popover-open'); await studio.waitFor();
    await studio.locator('.sonic-instruments>button').nth(8).waitFor();
    check('Desktop sound popup contains all nine audition pads', await studio.locator('.sonic-instruments>button').count() === 9);
    const popupBounds = await studio.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom, viewport: [innerWidth, innerHeight] }; });
    check('Desktop sound popup stays within the viewport', popupBounds.left >= 0 && popupBounds.right <= popupBounds.viewport[0] && popupBounds.bottom <= popupBounds.viewport[1], popupBounds);
    await studio.getByRole('switch', { name: 'Interface sound', exact: true }).click(); await wait(page, 1700);
    for (const [name, type] of [['iris', 'iris-open'], ['drive', 'assembly-drive'], ['lock', 'assembly-lock']]) {
      const prior = await page.evaluate(() => window.__assemblyQA.pulses.length);
      await studio.getByRole('button', { name: 'Audition ' + name + ' sound', exact: true }).click(); await wait(page, 1000);
      check('Sound Studio auditions the new ' + name + ' instrument', await page.evaluate(({ n, type }) => window.__assemblyQA.pulses.slice(n).some(pulse => pulse.type === type), { n: prior, type }));
    }
    await studio.getByRole('button', { name: 'Audition drive sound', exact: true }).focus(); await page.keyboard.press('9'); await wait(page, 1000);
    check('Keyboard 9 plays the ninth lock pad', await page.evaluate(() => window.__assemblyQA.pulses.at(-1)?.type === 'assembly-lock'));
    await page.screenshot({ path: out + '/sound-studio-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 }); await wait(page, 500);
    const mobileBounds = await studio.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight, scrollable: el.scrollHeight > el.clientHeight }; });
    await studio.getByRole('button', { name: 'Audition lock sound', exact: true }).scrollIntoViewIfNeeded();
    check('Mobile popup fits and can scroll to all nine instruments', mobileBounds.left >= 0 && mobileBounds.right <= mobileBounds.width && mobileBounds.bottom <= mobileBounds.height && mobileBounds.scrollable && await studio.getByRole('button', { name: 'Audition lock sound', exact: true }).isVisible(), mobileBounds);
    await page.screenshot({ path: out + '/sound-studio-mobile.png' });
    await studio.getByRole('link', { name: 'Experience settings' }).click(); await page.locator('.settings-page .sound-studio').waitFor(); await wait(page, 500);
    check('Settings link closes the popup and opens the full studio', await page.locator('#sound-console:popover-open').count() === 0 && await page.locator('.settings-page .sonic-instruments>button').count() === 9);
    await page.locator('.settings-page .sonic-instruments').scrollIntoViewIfNeeded(); await page.screenshot({ path: out + '/sound-studio-settings.png' });
  });
  check('No uncaught browser or shader errors', report.errors.length === 0, report.errors);
} finally {
  await writeFile(out + '/report-' + mode + '.json', JSON.stringify(report, null, 2));
  await browser.close();
  const failures = report.checks.filter(check => !check.passed);
  console.log(JSON.stringify({ passed: !failures.length && !report.errors.length, checks: report.checks.length, failures, errors: report.errors, report: out + '/report-' + mode + '.json' }, null, 2));
  if (failures.length || report.errors.length) process.exitCode = 1;
}
