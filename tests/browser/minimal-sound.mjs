// Native Web Audio verification of the minimal score and real Settings controls.
// node tests/browser/minimal-sound.mjs [base]
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = (process.argv[2] || 'http://127.0.0.1:5184').replace(/\/$/, '');
const out = 'output/playwright/minimal-sound'; await mkdir(out, { recursive: true });
const report = { base, checks: [], measurements: [], requests: [], errors: [], notes: ['Native browser output measured after the existing analyser; no subjective listening claim.', 'Hidden-tab lifecycle uses deterministic document.hidden injection, with native AudioContext and real visibility handlers.', 'Phone layout is emulated, not physical-device certification.'] };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  const trace = window.__minimalQA = { contexts: [], sources: [], pulses: [], maxVoices: 0 };
  const NativeContext = window.AudioContext;
  window.AudioContext = class extends NativeContext {
    constructor(...args) { super(...args); trace.contexts.push(this); }
    createBufferSource() {
      const source = super.createBufferSource(), record = { source, started: false, ended: false, disconnected: false };
      trace.sources.push(record); const start = source.start.bind(source), disconnect = source.disconnect.bind(source);
      source.start = (...args) => { start(...args); record.started = true; trace.maxVoices = Math.max(trace.maxVoices, trace.sources.filter(r => r.started && !r.ended && !r.disconnected && !r.source.loop).length); };
      source.disconnect = (...args) => { disconnect(...args); record.disconnected = true; };
      source.addEventListener('ended', () => { record.ended = true; }); return source;
    }
    createAnalyser() { const node = super.createAnalyser(), destination = this.createMediaStreamDestination(); node.connect(destination); trace.analyser = node; trace.stream = destination.stream; return node; }
  };
  window.addEventListener('monumental:sonic-pulse', event => trace.pulses.push(event.detail));
});
const page = await context.newPage(); page.setDefaultTimeout(20000);
page.on('pageerror', e => report.errors.push(e.message));
page.on('request', r => { if (r.url().includes('/audio/')) report.requests.push(r.url()); });
const check = (name, passed, detail) => report.checks.push({ name, passed: !!passed, detail });
const wait = ms => page.waitForTimeout(ms);
const state = () => page.evaluate(() => { const t = window.__minimalQA; return { contexts: t.contexts.length, contextState: t.contexts[0]?.state, sources: t.sources.length, pulses: t.pulses.length, loops: t.sources.filter(r => r.started && !r.ended && !r.disconnected && r.source.loop).map(r => t.sources.indexOf(r)), voices: t.sources.filter(r => r.started && !r.ended && !r.disconnected && !r.source.loop).length, maxVoices: t.maxVoices }; });
const measure = (duration = 650) => page.evaluate(async duration => {
  const data = new Float32Array(256), values = [], started = performance.now();
  while (performance.now() - started < duration) { window.__minimalQA.analyser?.getFloatTimeDomainData(data); values.push({ peak: Math.max(...data.map(Math.abs)), rms: Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length) }); await new Promise(resolve => setTimeout(resolve, 10)); }
  return { peak: Math.max(0, ...values.map(v => v.peak)), maxRms: Math.max(0, ...values.map(v => v.rms)), samples: values.length };
}, duration);
async function navigate(path, selector) { await page.evaluate(path => { location.hash = '#' + path; }, path); await page.locator(selector).first().waitFor(); await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await wait(500); }
async function recordStart() { await page.evaluate(() => { const t = window.__minimalQA; t.chunks = []; t.recorder = new MediaRecorder(t.stream, { mimeType: 'audio/webm;codecs=opus' }); t.recorder.ondataavailable = e => { if (e.data.size) t.chunks.push(e.data); }; t.recorder.start(); }); }
async function recordStop() { const b64 = await page.evaluate(async () => { const t = window.__minimalQA; await new Promise(resolve => { t.recorder.onstop = resolve; t.recorder.stop(); }); const bytes = new Uint8Array(await new Blob(t.chunks).arrayBuffer()); let binary = ''; for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384)); return btoa(binary); }); await writeFile(`${out}/six-pad-browser-output.webm`, Buffer.from(b64, 'base64')); }
try {
  await page.goto(base + '/#/settings'); const studio = page.locator('.settings-page .sound-studio'); await studio.waitFor(); await wait(400);
  check('Before consent there is no audio context, fetch or voice', (await state()).contexts === 0 && report.requests.length === 0);
  check('Settings offers the six deliberate sound auditions', await studio.locator('.sonic-instruments button').count() === 6);
  await studio.getByRole('switch', { name: 'Interface sound', exact: true }).click(); await wait(1000);
  check('Explicit sound opt-in starts the native graph', (await state()).contexts === 1 && (await state()).contextState === 'running');
  check('Atmosphere is off by default', (await state()).loops.length === 0 && await studio.getByRole('switch', { name: 'Ambient atmosphere', exact: true }).getAttribute('aria-checked') === 'false');
  await recordStart();
  for (const name of ['select', 'passage', 'memory', 'open', 'close', 'portal']) {
    const pending = measure(850); await studio.getByRole('button', { name: `Audition ${name} sound`, exact: true }).click(); const level = await pending;
    report.measurements.push({ name, ...level }); check(`Deliberate ${name} audition has measurable unclipped output`, level.peak > .00001 && level.peak < .8, level); await wait(120);
  }
  await recordStop(); await page.screenshot({ path: `${out}/settings-desktop.png` });
  check('Only the v3 palette is fetched, with one request per resolved asset', report.requests.length > 0 && report.requests.every(url => url.includes('/audio/score-v3/')) && new Set(report.requests).size === report.requests.length, report.requests);
  await studio.getByRole('switch', { name: 'Ambient atmosphere', exact: true }).click(); await wait(500); const field = (await state()).loops;
  check('Optional atmosphere owns one loop', field.length === 1);
  await navigate('/world', '.cultural-atlas__viewport canvas'); await navigate('/time-machine', 'h1'); await navigate('/settings', '.settings-page .sound-studio');
  check('Route changes retain the same optional field voice', JSON.stringify((await state()).loops) === JSON.stringify(field));
  await studio.getByRole('switch', { name: 'Ambient atmosphere', exact: true }).click(); await wait(350); check('Atmosphere can be stopped independently', (await state()).loops.length === 0);
  await navigate('/', '.tunnel-journey[data-ready="true"]'); await wait(1000); const before = await state();
  for (const p of [[1220, 660], [1290, 310], [1150, 200], [1110, 735]]) { await page.mouse.move(...p); await wait(160); }
  for (const delta of [350, 450, -500, 650, -700]) { await page.mouse.wheel(0, delta); await wait(160); }
  await wait(550); const quiet = await state(); check('Tunnel hovering and bidirectional scrolling add no sound sources or pulses', quiet.sources === before.sources && quiet.pulses === before.pulses, { before, after: quiet });
  const deliberate = measure(900); await page.getByRole('button', { name: 'Travel to The World', exact: true }).click(); const navigation = await deliberate; report.measurements.push({ name: 'chapter-navigation', ...navigation }); check('Deliberate chapter navigation remains audible', navigation.peak > .00001);
  await page.waitForFunction(() => document.querySelector('[data-passage-reading="true"]')?.dataset.passageChapter === 'world'); await wait(500);
  await page.locator('[data-tunnel-station="world"] .tunnel-story').click(); await page.locator('.ms-player-dialog:modal').waitFor(); await wait(400); const playing = await state(); const quietPlayer = await measure(350);
  check('Full player owns audio and silences interface voices', playing.voices === 0 && playing.loops.length === 0 && quietPlayer.peak < .00001, { playing, quietPlayer }); await page.keyboard.press('Escape');
  await navigate('/settings', '.settings-page .sound-studio'); await studio.getByRole('switch', { name: 'Ambient atmosphere', exact: true }).click(); await wait(400);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await wait(350); const hidden = await state();
  check('Hidden-tab lifecycle suspends the graph and releases the field', hidden.contextState === 'suspended' && hidden.loops.length === 0 && hidden.voices === 0, hidden);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }); await wait(200); check('Visibility alone does not resume audio', (await state()).contextState === 'suspended');
  const resumedMeasure = measure(850); await studio.getByRole('button', { name: 'Audition memory sound', exact: true }).click(); const resumed = await resumedMeasure; check('A new deliberate gesture resumes sound', (await state()).contextState === 'running' && resumed.peak > .00001);
  await studio.getByRole('switch', { name: 'Interface sound', exact: true }).click(); await wait(350); const muted = await state(), silent = await measure(350);
  check('Mute releases voices and suspends output', muted.contextState === 'suspended' && muted.loops.length === 0 && muted.voices === 0 && silent.peak < .00001, { muted, silent });
  await page.setViewportSize({ width: 390, height: 844 }); await wait(500); await page.screenshot({ path: `${out}/settings-phone.png` });
  check('Phone Settings keeps all six controls without horizontal overflow', await studio.locator('.sonic-instruments button').count() === 6 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  check('No uncaught browser errors', report.errors.length === 0, report.errors);
} catch (error) { report.checks.push({ name: 'browser runner', passed: false, detail: error.stack }); await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}); }
finally {
  await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); const failed = report.checks.filter(c => !c.passed);
  console.log(JSON.stringify({ checks: report.checks.length, failed, errors: report.errors, report: `${out}/report.json` }, null, 2)); if (failed.length || report.errors.length) process.exitCode = 1;
}
