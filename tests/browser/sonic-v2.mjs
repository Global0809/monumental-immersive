// Real Chromium / Web Audio verification. Existing standalone browser-harness style.
// Vite must be serving the current source: node tests/browser/sonic-v2.mjs [base]
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = (process.argv[2] || process.env.MONUMENTAL_TEST_URL || 'http://127.0.0.1:5184').replace(/\/$/, '');
const out = 'output/playwright/sonic-v2';
await mkdir(out, { recursive: true });
const report = { base, startedAt: new Date().toISOString(), passed: false, checks: [], measurements: [], errors: [], audioRequests: [], notes: [
  'Native Web Audio was measured and recorded after the real browser output analyser; no subjective speaker-listening claim.',
  'The visibility test dispatches deterministic visibility state changes; the runtime and native AudioContext are not mocked.',
] };
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true, args: ['--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror', error => report.errors.push(error.message));
page.on('request', request => { if (/\/audio\//.test(request.url())) report.audioRequests.push(request.url()); });
await page.addInitScript(() => {
  const trace = window.__sonicQA = { contexts: [], gains: [], filters: [], panners: [], sources: [], pulses: [] };
  const NativeContext = window.AudioContext;
  window.AudioContext = class extends NativeContext {
    constructor(...args) { super(...args); trace.contexts.push(this); }
    createGain() { const node = super.createGain(); trace.gains.push(node); return node; }
    createBiquadFilter() { const node = super.createBiquadFilter(); trace.filters.push(node); return node; }
    createStereoPanner() { const node = super.createStereoPanner(); trace.panners.push(node); return node; }
    createBufferSource() {
      const node = super.createBufferSource(); const record = { node, started: false, ended: false, disconnected: false }; trace.sources.push(record);
      const start = node.start.bind(node); node.start = (...args) => { start(...args); record.started = true; };
      const disconnect = node.disconnect.bind(node); node.disconnect = (...args) => { disconnect(...args); record.disconnected = true; };
      node.addEventListener('ended', () => { record.ended = true; }); return node;
    }
    createAnalyser() {
      const node = super.createAnalyser(); const destination = this.createMediaStreamDestination();
      node.connect(destination); trace.analyser = node; trace.stream = destination.stream; return node;
    }
  };
  window.addEventListener('monumental:sonic-pulse', event => trace.pulses.push(event.detail));
});
const check = (name, condition, detail) => { assert.ok(condition, name); report.checks.push({ name, ...(detail === undefined ? {} : { detail }) }); };
const wait = ms => page.waitForTimeout(ms);
async function bindRuntime() {
  await page.evaluate(async () => {
    const entries = performance.getEntriesByType('resource');
    const loaded = name => entries.find(item => item.name.includes('/src/services/' + name + '.ts'))?.name;
    window.__audio = await import(loaded('audio')); window.__viewer = await import(loaded('viewer'));
    window.__score = await import(loaded('sonicScore'));
  });
}
async function measure(duration = 500) {
  return page.evaluate(async duration => {
    const frames = [], data = new Float32Array(256);
    const timer = setInterval(() => {
      window.__sonicQA.analyser.getFloatTimeDomainData(data);
      frames.push({ peak: Math.max(...data.map(Math.abs)), rms: Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length) });
    }, 10);
    await new Promise(resolve => setTimeout(resolve, duration)); clearInterval(timer);
    return { peak: Math.max(0, ...frames.map(frame => frame.peak)), energy: frames.reduce((sum, frame) => sum + frame.rms, 0), tail: frames.slice(-8), frames: frames.length };
  }, duration);
}
const liveLoops = () => page.evaluate(() => window.__sonicQA.sources.filter(source => source.started && !source.ended && !source.disconnected && source.node.loop).length);

try {
  await page.goto(base + '/#/settings');
  const studio = page.locator('.settings-page .sound-studio');
  await studio.waitFor(); await bindRuntime();
  check('No audio graph or audio requests before consent', await page.evaluate(() => window.__sonicQA.contexts.length === 0) && report.audioRequests.length === 0);
  await studio.getByRole('switch', { name: 'Interface sound', exact: true }).click();
  await page.waitForFunction(() => window.__sonicQA.contexts[0]?.state === 'running'); await wait(2000);
  check('Opt-in creates one native audio graph', await page.evaluate(() => window.__sonicQA.contexts.length === 1));
  await page.evaluate(() => {
    const qa = window.__sonicQA; qa.chunks = [];
    qa.recorder = new MediaRecorder(qa.stream, { mimeType: 'audio/webm;codecs=opus' });
    qa.recorder.ondataavailable = event => qa.chunks.push(event.data); qa.recorder.start();
  });
  const pads = studio.locator('.sonic-instruments button');
  const padCount = await pads.count();
  for (let i = 0; i < padCount; i++) {
    const name = await pads.nth(i).getAttribute('aria-label');
    const before = await page.evaluate(() => window.__sonicQA.pulses.length);
    const capture = measure(2100); await pads.nth(i).click(); const stats = await capture;
    const emitted = await page.evaluate(before => window.__sonicQA.pulses.slice(before), before);
    check(name + ': audible output and bounded tail', stats.peak > .005 && stats.peak < .8 && stats.tail.every(frame => frame.peak < .0001), stats);
    check(name + ': one semantic cue', emitted.length === 1, emitted.map(pulse => pulse.type));
    report.measurements.push({ name, ...stats });
  }
  const recording = await page.evaluate(() => new Promise(resolve => {
    const qa = window.__sonicQA;
    qa.recorder.onstop = async () => { const bytes = new Uint8Array(await new Blob(qa.chunks).arrayBuffer()); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); resolve(btoa(binary)); };
    qa.recorder.stop();
  }));
  await writeFile(out + '/browser-audition-capture.webm', Buffer.from(recording, 'base64'));
  check('Audition envelopes are distinct', new Set(report.measurements.map(item => item.energy.toFixed(4))).size === padCount);

  const hoverLink = page.locator('.primary-navigation a').filter({ hasText: 'Watch' }).first();
  await page.mouse.move(30, 400); await wait(550);
  const hoverBox = await hoverLink.boundingBox(); const hoverStart = await page.evaluate(() => window.__sonicQA.pulses.length);
  await page.mouse.move(hoverBox.x + hoverBox.width / 2, hoverBox.y + hoverBox.height / 2); await wait(25);
  await page.mouse.move(30, 400); await wait(200);
  check('Passing a control does not trigger a hover cue', await page.evaluate(before => window.__sonicQA.pulses.slice(before).every(pulse => pulse.type !== 'hover'), hoverStart));
  await page.mouse.move(hoverBox.x + hoverBox.width / 2, hoverBox.y + hoverBox.height / 2); await wait(250);
  check('Intentional navigation hover produces one contact', await page.evaluate(before => window.__sonicQA.pulses.slice(before).filter(pulse => pulse.type === 'hover').length === 1, hoverStart));
  await page.mouse.move(30, 400); await wait(550);

  const sameFrame = await page.evaluate(() => { const before = window.__sonicQA.pulses.length; window.__audio.playSound('save'); window.__audio.playSound('select'); window.__audio.playSound('navigate'); return before; });
  await wait(1000);
  check('A single gesture does not stack generic and semantic cues', await page.evaluate(before => window.__sonicQA.pulses.length - before, sameFrame) === 1);

  await studio.getByRole('slider', { name: /Master volume/ }).fill('100');
  const stressCapture = measure(2200);
  await page.evaluate(async () => {
    for (const type of ['portal', 'collider', 'destination', 'sculpture-pulse', 'sculpture-unfold']) {
      window.__audio.playSound(type, { intensity: 1, audition: true }); await new Promise(resolve => setTimeout(resolve, 90));
    }
  });
  const stress = await stressCapture;
  check('Rapid full-volume interactions retain output headroom', stress.peak > .02 && stress.peak < .9, stress);
  await studio.getByRole('slider', { name: /Master volume/ }).fill('45');

  await studio.getByRole('switch', { name: 'Ambient atmosphere', exact: true }).click(); await wait(1600);
  check('Atmosphere is a real bounded loop after explicit opt-in', await liveLoops() === 1 && (await measure(300)).energy > .0001);
  for (const scene of await page.evaluate(() => window.__score.sonicScenes)) {
    await page.evaluate(scene => window.__audio.setAmbientScene(scene), scene); await wait(850);
    check('Scene ' + scene + ' resolves to one active loop', await liveLoops() === 1 && await page.evaluate(scene => window.__audio.getSonicState().scene === scene, scene));
  }
  const motion = await page.evaluate(async () => {
    const read = () => ({ filters: window.__sonicQA.filters.map(node => node.frequency.value), pans: window.__sonicQA.panners.map(node => node.pan.value) });
    window.__audio.setSonicMotion(0, 0); await new Promise(resolve => setTimeout(resolve, 400)); const still = read();
    for (let i = 0; i < 10; i++) { window.__audio.setSonicMotion(1, .7); await new Promise(resolve => setTimeout(resolve, 40)); } const moving = read();
    window.__audio.setSonicMotion(0, 0); return { still, moving };
  });
  check('Travel energy changes the atmosphere without another graph', JSON.stringify(motion.still) !== JSON.stringify(motion.moving) && await page.evaluate(() => window.__sonicQA.contexts.length === 1), motion);

  await page.getByRole('link', { name: 'Watch', exact: true }).first().click();
  await page.getByRole('button', { name: 'Play Miami, in Frequency', exact: true }).click();
  await page.locator('.ms-player-dialog video').waitFor();
  await page.waitForFunction(() => window.__audio.getSonicState().playback); await wait(300);
  const playback = await measure(300);
  check('Opening the actual player silences interface and atmosphere', playback.peak < .0001 && await liveLoops() === 0, playback);
  const focusedPulses = await page.evaluate(() => { const before = window.__sonicQA.pulses.length; window.__audio.playSound('portal'); return before; });
  await wait(250); check('Film focus suppresses new interface cues', await page.evaluate(before => window.__sonicQA.pulses.length === before, focusedPulses));
  await page.getByRole('button', { name: 'Close player', exact: true }).click(); await wait(1200);
  check('Closing the actual player restores one atmosphere loop', await liveLoops() === 1 && (await measure(300)).energy > .0001);

  await page.evaluate(() => { location.hash = '#/settings'; }); await studio.waitFor();
  await studio.getByRole('slider', { name: /Master volume/ }).fill('0'); await wait(350);
  const zero = await measure(250); check('Zero master volume is silent and stops atmosphere', zero.peak < .0001 && await liveLoops() === 0);
  await studio.getByRole('slider', { name: /Master volume/ }).fill('45'); await wait(900);
  await studio.getByRole('switch', { name: 'Ambient atmosphere', exact: true }).click(); await wait(300);
  check('Atmosphere can be disabled separately', await liveLoops() === 0);
  await studio.getByRole('switch', { name: 'Interface sound', exact: true }).click(); await wait(350);
  check('Sound off suspends the graph', await page.evaluate(() => window.__sonicQA.contexts[0].state === 'suspended'));
  await studio.getByRole('switch', { name: 'Interface sound', exact: true }).click(); await wait(2000);

  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => window.__sonicQA.contexts[0].state === 'suspended');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); }); await wait(200);
  check('Returning to the tab alone cannot resume audio', await page.evaluate(() => window.__sonicQA.contexts[0].state === 'suspended'));
  await pads.first().click(); await page.waitForFunction(() => window.__sonicQA.contexts[0].state === 'running'); await wait(1900);
  check('A genuine subsequent gesture resumes audio', await page.evaluate(() => window.__sonicQA.contexts[0].state === 'running'));

  await studio.getByRole('switch', { name: 'Ambient atmosphere', exact: true }).click();
  await page.evaluate(() => { location.hash = '#/'; });
  await page.locator('.tunnel-journey[data-ready="true"]').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.spatialPassage); await wait(1000);
  async function actionCue(control, type, name) {
    const before = await page.evaluate(() => window.__sonicQA.pulses.length);
    await control.click(); await wait(1150);
    const pulses = await page.evaluate(before => window.__sonicQA.pulses.slice(before), before);
    check(name, pulses.filter(pulse => pulse.type === type).length === 1 && !pulses.some(pulse => ['select', 'navigate'].includes(pulse.type)), pulses.map(pulse => pulse.type));
  }
  await actionCue(page.getByRole('button', { name: 'Unfold the relay', exact: true }), 'sculpture-unfold', 'Relay opening has its own mechanical cue');
  await actionCue(page.getByRole('button', { name: 'Inspect relay component 3', exact: true }), 'scan', 'Component inspection uses the optical scan cue');
  await actionCue(page.getByRole('button', { name: 'Reassemble', exact: true }), 'sculpture-fold', 'Relay reassembly has its own closure cue');
  await actionCue(page.getByRole('button', { name: 'Send a signal', exact: true }), 'signal', 'Sending a real tunnel signal emits its telemetry cue');
  const chapterScenes = ['world', 'time', 'cinema', 'music', 'culture', 'collection'];
  for (let i = 0; i < chapterScenes.length; i++) {
    const before = await page.evaluate(() => window.__sonicQA.pulses.length);
    await page.locator('.tunnel-stop-list button').nth(i).click();
    await page.waitForFunction(scene => window.__audio.getSonicState().scene === scene, chapterScenes[i]); await wait(1600);
    const pulses = await page.evaluate(before => window.__sonicQA.pulses.slice(before), before);
    check('Passage chapter ' + chapterScenes[i] + ' selects its atmosphere and portal', await liveLoops() === 1 && pulses.some(pulse => pulse.type === 'portal'), pulses.map(pulse => pulse.type));
  }

  for (const route of ['/world', '/time-machine', '/my-world', '/settings']) {
    await page.evaluate(route => { location.hash = '#' + route; }, route); await wait(650);
  }
  await studio.waitFor(); check('Route changes reuse one audio graph', await page.evaluate(() => window.__sonicQA.contexts.length === 1));
  await studio.screenshot({ path: out + '/sound-studio-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 }); await wait(350);
  check('Mobile studio fits the viewport', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await studio.screenshot({ path: out + '/sound-studio-mobile.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await wait(100);
  check('Reduced motion keeps the audio scope still', await studio.locator('.sonic-scope path').getAttribute('d') === 'M 0 40 H 600');
  await page.getByRole('button', { name: 'Open Index', exact: true }).click();
  await page.locator('#monumental-index').getByRole('button', { name: 'Sound Studio', exact: true }).click();
  const compact = page.locator('#sound-console'); await compact.waitFor(); await wait(300);
  check('Mobile sound popover remains contained', await compact.evaluate(element => { const box = element.getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1; }));
  await compact.screenshot({ path: out + '/sound-studio-compact.png' }); await page.keyboard.press('Escape');

  const assetNames = await page.evaluate(() => [...Object.keys(window.__score.sonicScore), ...window.__score.sonicScenes.map(scene => 'room-' + scene)]);
  for (const name of assetNames) {
    const response = await context.request.get(base + '/audio/score-v2/' + name + '.wav');
    const bytes = await response.body(); check('Asset ' + name + ' is available WAV', response.ok() && bytes.subarray(0, 4).toString() === 'RIFF');
  }
  await page.evaluate(() => window.__audio.disposeAudio());
  await page.waitForFunction(() => window.__sonicQA.contexts[0].state === 'closed');
  check('Audio disposal closes the native graph', await liveLoops() === 0);
  check('No browser runtime errors', report.errors.length === 0, report.errors);
  report.passed = true;
} catch (error) {
  report.failure = error.stack || String(error);
  report.failureState = await page.evaluate(() => ({ url: location.href, sonic: window.__audio?.getSonicState(), viewer: window.__viewer?.getViewer(), pulses: window.__sonicQA?.pulses.slice(-20) })).catch(() => null);
  await page.screenshot({ path: out + '/failure.png' }).catch(() => {}); throw error;
} finally {
  await writeFile(out + '/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, errors: report.errors, failure: report.failure, report: out + '/report.json' }, null, 2));
  await browser.close();
}
