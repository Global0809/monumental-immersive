// Browser integration probe: real Web Audio output, permission, dynamics, lifecycle and UI.
// Run with the Vite server available: node tests/browser/audio-runtime.mjs
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.MONUMENTAL_TEST_URL || 'http://127.0.0.1:5173';
const artifacts = '.openai/audio-qa';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await browserContext.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  window.__audioContexts = [];
  window.__gainNodes = [];
  const NativeContext = window.AudioContext;
  window.AudioContext = class extends NativeContext {
    constructor(...args) { super(...args); window.__audioContexts.push(this); }
    createGain() { const node = super.createGain(); window.__gainNodes.push(node); return node; }
    createAnalyser() {
      const node = super.createAnalyser();
      const destination = this.createMediaStreamDestination();
      node.connect(destination);
      window.__rawProbe = node;
      window.__captureStream = destination.stream;
      return node;
    }
  };
  window.__pulses = [];
  window.addEventListener('monumental:sonic-pulse', event => window.__pulses.push(event.detail));
});
try {
  await page.goto(base + '/#/settings');
  const studio = page.locator('.settings-page .sound-studio');
  await studio.waitFor();
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const loaded = name => resources.find(item => item.name.includes('/src/services/' + name + '.ts'))?.name;
    window.__audio = await import(loaded('audio')); window.__viewer = await import(loaded('viewer'));
  });
  assert.equal(await page.evaluate(() => window.__audioContexts.length), 0, 'No AudioContext is constructed before opt-in');
  await studio.getByRole('switch', { name: 'Interface sound', exact: true }).click();
  await page.waitForFunction(() => window.__audioContexts[0]?.state === 'running');
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => window.__audioContexts.length), 1, 'Exactly one audio graph');
  await page.evaluate(() => {
    window.__chunks = [];
    window.__recorder = new MediaRecorder(window.__captureStream, { mimeType: 'audio/webm;codecs=opus' });
    window.__recorder.ondataavailable = event => window.__chunks.push(event.data);
    window.__recorder.start();
  });
  const cues = ['Magnetic', 'Glass', 'Transit', 'Memory', 'Unfold', 'Resonance'];
  const measurements = [];
  for (const cue of cues) {
    await page.evaluate(() => { window.__capture = []; window.__captureInterval = setInterval(() => { const data = new Float32Array(256); window.__rawProbe.getFloatTimeDomainData(data); const peak = Math.max(...data.map(Math.abs)); const rms = Math.sqrt(data.reduce((sum, sample) => sum + sample * sample, 0) / data.length); window.__capture.push({ peak, rms }); }, 8); });
    await studio.getByRole('button', { name: 'Audition ' + cue.toLowerCase() + ' sound' }).click();
    await page.waitForTimeout(850);
    const captured = await page.evaluate(() => { clearInterval(window.__captureInterval); return window.__capture; });
    const peak = Math.max(...captured.map(sample => sample.peak));
    const energy = captured.reduce((sum, sample) => sum + sample.rms, 0);
    const activeSamples = captured.filter(sample => sample.rms > 0.00008).length;
    if (!(peak > 0.001)) console.log('Audio failure diagnostic', cue, peak, errors, await page.evaluate(() => ({ state: window.__audio.getSonicState(), context: window.__audioContexts[0]?.state, currentTime: window.__audioContexts[0]?.currentTime, gains: window.__gainNodes.map(node => node.gain.value), viewer: window.__viewer.getViewer(), pulses: window.__pulses, samples: window.__capture.slice(0, 10) })));
    assert.ok(peak > 0.001, cue + ' produces real nonzero output');
    assert.ok(peak < 0.8, cue + ' leaves clipping headroom');
    assert.ok(captured.slice(-8).every(sample => sample.peak < 0.0001), cue + ' has a bounded tail');
    measurements.push({ cue, peak, energy, activeSamples });
  }
  const recording = await page.evaluate(() => new Promise(resolve => {
    window.__recorder.onstop = async () => { const bytes = new Uint8Array(await new Blob(window.__chunks, { type: 'audio/webm' }).arrayBuffer()); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); resolve(btoa(binary)); };
    window.__recorder.stop();
  }));
  await writeFile(artifacts + '/material-auditions.webm', Buffer.from(recording, 'base64'));
  assert.equal(new Set(measurements.map(item => item.energy.toFixed(3))).size, 6, 'All six materials have distinct captured envelopes');

  // One gesture must not stack generic and semantic main cues.
  const duplicate = await page.evaluate(() => { const before = window.__pulses.length; window.__audio.playSound('save'); window.__audio.playSound('select'); window.__audio.playSound('navigate'); return window.__pulses.length - before; });
  assert.equal(duplicate, 1, 'Same-frame generic cues are suppressed after the semantic cue');
  await page.waitForTimeout(800);

  // Media suppression is checked against the actual analyser, not just an API flag.
  await studio.getByRole('switch', { name: 'Ambient atmosphere' }).click();
  await page.waitForTimeout(1400);
  const ambient = await page.evaluate(() => window.__audio.readSoundLevel().rms);
  assert.ok(ambient > 0.00001, 'Opted-in ambient layer produces output');
  await page.evaluate(() => { window.__audio.setPlaybackActive(true); window.__audio.playSound('sculpture-pulse'); });
  await page.waitForTimeout(350);
  const ducked = await page.evaluate(() => { const data = new Float32Array(256); window.__rawProbe.getFloatTimeDomainData(data); return Math.max(...data.map(Math.abs)); });
  assert.ok(ducked < 0.0001, 'Real graph is silent during playback');
  await page.evaluate(() => window.__audio.setPlaybackActive(false));
  await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => window.__audio.readSoundLevel().rms) > 0.00001, 'Ambient returns after playback');
  await studio.getByRole('switch', { name: 'Ambient atmosphere' }).click();
  const mutedPulseCount = await page.evaluate(() => { window.__audio.setMasterVolume(0); const before = window.__pulses.length; window.__audio.playSound('save'); return window.__pulses.length - before; });
  assert.equal(mutedPulseCount, 0, 'Zero master volume does not emit an audible sonic pulse');
  await studio.locator('input[type=range]').first().fill('29');
  assert.equal(await page.evaluate(() => window.__viewer.getViewer().masterVolume), 0.29);
  await page.reload();
  await page.locator('.settings-page .sound-studio').waitFor();
  assert.equal(await page.evaluate(() => window.__audioContexts.length), 0, 'Stored opt-in does not autoplay after reload');
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const loaded = name => resources.find(item => item.name.includes('/src/services/' + name + '.ts'))?.name;
    window.__audio = await import(loaded('audio')); window.__viewer = await import(loaded('viewer'));
  });
  assert.equal(await page.evaluate(() => window.__viewer.getViewer().masterVolume), 0.29, 'Volume persists');
  await page.locator('.settings-page').getByRole('button', { name: 'Audition glass sound' }).click();
  await page.waitForFunction(() => window.__audioContexts[0]?.state === 'running');
  await page.waitForTimeout(750);

  const otherTab = await page.context().newPage();
  await otherTab.goto(base + '/#/settings');
  await otherTab.evaluate(() => { const key = 'monumental.viewer.v1'; const state = JSON.parse(localStorage.getItem(key)); state.sound = false; localStorage.setItem(key, JSON.stringify(state)); });
  await page.waitForFunction(() => window.__viewer.getViewer().sound === false && window.__audioContexts[0]?.state === 'suspended');
  await otherTab.close(); await page.bringToFront();
  await page.locator('.settings-page').getByRole('switch', { name: 'Interface sound', exact: true }).click();
  await page.waitForFunction(() => window.__audioContexts[0]?.state === 'running');
  await page.waitForTimeout(750);

  // Visibility change is deterministic here; return alone must never resume the graph.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => window.__audioContexts[0]?.state === 'suspended');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__audioContexts[0].state), 'suspended');
  await page.locator('.settings-page').getByRole('button', { name: 'Audition magnetic sound' }).click();
  await page.waitForFunction(() => window.__audioContexts[0]?.state === 'running');
  await page.waitForTimeout(500);
  await page.locator('.settings-page .sound-studio').screenshot({ path: artifacts + '/studio-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.settings-page .sound-studio').screenshot({ path: artifacts + '/studio-mobile.png' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Studio mobile creates no horizontal overflow');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.settings-page').getByRole('button', { name: 'Audition glass sound' }).click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.settings-page .sonic-scope path').getAttribute('d'), 'M 0 40 H 600', 'Reduced motion keeps the scope static');
  await page.getByRole('button', { name: 'Open sound studio', exact: true }).click();
  await page.locator('#sound-console').screenshot({ path: artifacts + '/studio-compact-mobile.png' });
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__audio.disposeAudio());
  await page.waitForFunction(() => window.__audioContexts[0]?.state === 'closed');
  const mono = await browser.newPage();
  mono.on('pageerror', error => errors.push(error.message));
  await mono.addInitScript(() => {
    Object.defineProperty(AudioContext.prototype, 'createStereoPanner', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'userActivation', { configurable: true, value: undefined });
  });
  await mono.goto(base + '/#/settings');
  await mono.locator('.settings-page').getByRole('switch', { name: 'Interface sound', exact: true }).click();
  await mono.waitForTimeout(750);
  assert.match(await mono.locator('.settings-page .sonic-monitor-top').innerText(), /Sound is on/, 'Trusted gesture fallback works without UserActivation API');
  await mono.locator('.settings-page').getByRole('button', { name: 'Audition transit sound' }).click();
  await mono.waitForTimeout(750);
  await mono.locator('.settings-page').getByRole('switch', { name: 'Ambient atmosphere', exact: true }).click();
  await mono.waitForTimeout(300); await mono.close();
  assert.deepEqual(errors, [], 'No browser runtime errors');
  const report = { passed: true, measurements, ambientRms: ambient, playbackPeak: ducked, errors, capture: 'material-auditions.webm', note: 'Browser Web Audio recorded to MediaStream; no claim of subjective speaker listening. Visibility lifecycle tested by deterministic visibility event.' };
  await writeFile(artifacts + '/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
