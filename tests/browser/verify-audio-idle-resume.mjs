import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// Run only after coordinating with the endurance-test owner. One isolated browser,
// one Settings route, real 100-second idle, and no application source mutations.
const base = (process.env.SITE_URL || 'http://127.0.0.1:5174/').replace(/\/?$/, '/');
const out = process.env.AUDIO_TRACE_OUTPUT || 'test-results/audio-idle-resume';
await mkdir(out, { recursive: true });
const report = { site: base, startedAt: new Date().toISOString(), complete: false, events: [], samples: [], errors: [], notes: [
  'Only the isolated browser output is muted; native AudioContext resumes and synthesized pulses remain real.',
  'Audio API wrappers return the original promises. No source or audio lifecycle behavior is replaced.',
  'Post-idle diagnostic reads use CDP Runtime.evaluate with userGesture:false to avoid adding activation.',
] };
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true, args: ['--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  const trace = window.__audioIdleTrace = { events: [], contexts: [], pulses: 0 };
  function record(kind, data = {}) {
    trace.events.push({ kind, at: new Date().toISOString(), time: performance.now(), visibility: document.visibilityState,
      activation: navigator.userActivation ? { active: navigator.userActivation.isActive, ever: navigator.userActivation.hasBeenActive } : null, ...data });
  }
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'keydown']) {
    document.addEventListener(type, event => record('input', {
      type, trusted: event.isTrusted, key: event.key, pointerType: event.pointerType,
      target: event.target instanceof Element ? event.target.closest('button,a,input')?.getAttribute('aria-label') || event.target.tagName : null,
    }), true);
  }
  document.addEventListener('visibilitychange', () => record('visibilitychange'));
  window.addEventListener('monumental:sonic-pulse', event => { trace.pulses++; record('pulse', { type: event.detail.type, pulses: trace.pulses }); });
  const Native = window.AudioContext;
  if (!Native) { record('audio-unavailable'); return; }
  let serial = 0;
  window.AudioContext = class extends Native {
    constructor(...args) {
      super(...args); this.__traceId = ++serial; trace.contexts.push(new WeakRef(this));
      record('context-created', { id: this.__traceId, state: this.state });
      this.addEventListener('statechange', () => record('statechange', { id: this.__traceId, state: this.state }));
    }
    resume() {
      record('resume-call', { id: this.__traceId, state: this.state });
      const promise = super.resume();
      promise.then(() => record('resume-resolved', { id: this.__traceId, state: this.state }), error => record('resume-rejected', { id: this.__traceId, state: this.state, error: String(error) }));
      return promise;
    }
    suspend() {
      record('suspend-call', { id: this.__traceId, state: this.state });
      const promise = super.suspend();
      promise.then(() => record('suspend-resolved', { id: this.__traceId, state: this.state }), error => record('suspend-rejected', { id: this.__traceId, state: this.state, error: String(error) }));
      return promise;
    }
  };
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
page.setDefaultTimeout(15000);
page.on('pageerror', error => report.errors.push(error.message));
async function inspect(label) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { userGesture: false, returnByValue: true, expression: `(() => {
    const trace = window.__audioIdleTrace;
    return { at: new Date().toISOString(), time: performance.now(), visibility: document.visibilityState,
      activation: navigator.userActivation ? { active: navigator.userActivation.isActive, ever: navigator.userActivation.hasBeenActive } : null,
      states: trace.contexts.map(ref => ref.deref()?.state || 'collected'), pulses: trace.pulses,
      monitor: document.querySelector('.sonic-monitor-top')?.textContent, events: trace.events };
  })()` });
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
  const { events, ...sample } = result.value;
  report.events = events; report.samples.push({ label, ...sample });
  return sample;
}
async function persist() { await writeFile(out + '/report.json', JSON.stringify(report, null, 2)); }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function awaitResume(label, previousPulses, timeout = 4000) {
  const end = Date.now() + timeout;
  let sample;
  do {
    sample = await inspect(label);
    if (sample.states.includes('running') && sample.pulses > previousPulses) return { passed: true, sample };
    await wait(150);
  } while (Date.now() < end);
  return { passed: false, sample };
}
try {
  await page.goto(base + '#/settings');
  await page.getByRole('switch', { name: 'Interface sound', exact: true }).first().click();
  await page.getByRole('slider', { name: /Master volume/ }).first().fill('15');
  await page.getByRole('switch', { name: 'Ambient atmosphere', exact: true }).first().click();
  await page.getByRole('slider', { name: /Atmosphere mix/ }).first().fill('10');
  await page.getByRole('button', { name: 'Audition glass sound', exact: true }).first().click();
  await wait(750);
  const initial = await inspect('before-idle');
  if (!initial.states.includes('running')) throw new Error('Initial opt-in did not start audio');
  await persist();
  console.log(JSON.stringify({ stage: 'idle-start', at: new Date().toISOString(), states: initial.states, pulses: initial.pulses }));
  for (let part = 1; part <= 5; part++) { await wait(20000); console.log(JSON.stringify({ stage: 'idle-progress', seconds: part * 20 })); }
  const idle = await inspect('after-100s-idle');
  report.idleSuspended = idle.states.every(state => state === 'suspended' || state === 'collected');
  console.log(JSON.stringify({ stage: 'idle-settled', states: idle.states, pulses: idle.pulses, activation: idle.activation }));
  await page.getByRole('button', { name: 'Audition magnetic sound', exact: true }).first().click();
  report.firstGesture = await awaitResume('after-first-audition', idle.pulses);
  await persist();
  console.log(JSON.stringify({ stage: 'first-gesture', ...report.firstGesture }));
  if (!report.firstGesture.passed) {
    await page.getByRole('button', { name: 'Audition magnetic sound', exact: true }).first().click();
    report.secondGesture = await awaitResume('after-second-audition', idle.pulses);
    console.log(JSON.stringify({ stage: 'second-gesture', ...report.secondGesture }));
  }
  await inspect('final');
  report.complete = true;
  report.passed = report.idleSuspended && report.firstGesture.passed && report.errors.length === 0;
  await persist();
  console.log(JSON.stringify({ complete: report.complete, passed: report.passed, idleSuspended: report.idleSuspended, firstGesture: report.firstGesture.passed, secondGesture: report.secondGesture?.passed, errors: report.errors, report: out + '/report.json' }));
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.errors.push(error.stack || String(error)); await persist(); throw error;
} finally {
  await browser.close();
  console.log(JSON.stringify({ stage: 'browser-closed', at: new Date().toISOString() }));
}
