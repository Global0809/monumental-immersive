/**
 * Natural full-film integration check. Run against a frozen production preview:
 *   node tests/browser/verify-full-playback.mjs http://127.0.0.1:5174
 * Takes about 25 minutes (35 minute deadline). Never seeks, changes playback
 * speed, synthesizes ended, or edits progress. Only isolated guest journey
 * storage is seeded; the actual My World button starts playback.
 */
import { chromium } from 'playwright';
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:5174';
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const out = path.resolve('output/playwright/full-playback-' + runId);
await mkdir(out, { recursive: true });
const logPath = path.join(out, 'events.jsonl');
const startedAt = Date.now();
const events = [];
const errors = [];
const ids = ['big-buck-bunny-full', 'sintel-full'];
// Explicit journey starts assign currentTime=0 during metadata setup. Browsers
// may emit a seek pair for that no-op before playback; no media is skipped.
const initialZeroSeek = event => event.kind === 'media-event' &&
  ['seeking', 'seeked'].includes(event.type) && event.time === 0 &&
  !events.some(prior => prior.kind === 'media-event' && prior.instance === event.instance &&
    ['play', 'playing'].includes(prior.type) && prior.browserMs < event.browserMs);
const playbackSeeks = () => events.filter(event => event.kind === 'media-event' &&
  ['seeking', 'seeked'].includes(event.type) && !initialZeroSeek(event));
let serialWrites = Promise.resolve();
function record(event) {
  const row = { ...event, wallMs: Date.now() - startedAt, iso: new Date().toISOString() };
  events.push(row);
  serialWrites = serialWrites.then(() => appendFile(logPath, JSON.stringify(row) + '\n'));
  if (!(row.kind === 'media-response' && row.status < 400) && !(row.kind === 'media-event' && row.type === 'suspend')) console.log(JSON.stringify(row));
  return row;
}
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.on('pageerror', error => { errors.push(error.message); record({ kind: 'pageerror', error: error.message }); });
page.on('requestfailed', request => {
  if (request.resourceType() === 'media' || /\.mp4/.test(request.url())) record({ kind: 'media-request-failed', url: request.url(), error: request.failure()?.errorText });
});
page.on('response', response => {
  if (response.request().resourceType() === 'media' || /\.mp4/.test(response.url())) record({ kind: 'media-response', url: response.url(), status: response.status(), range: response.headers()['content-range'] });
});
await page.exposeFunction('fullPlaybackEvent', record);
await page.addInitScript(({ ids }) => {
  localStorage.setItem('monumental.viewer.v1', JSON.stringify({
    saved: [], savedPlaces: [], history: {}, interests: [],
    journeys: [{ id: 'full-playback-verification', name: 'Full-film playback verification', videoIds: ids }],
    sound: false, masterVolume: 0.45, ambient: false, ambientMix: 0.2, reducedMotion: true,
  }));
  const seen = new WeakSet();
  let instance = 0;
  const readVideo = video => {
    const q = video.getVideoPlaybackQuality?.();
    return {
      title: video.getAttribute('aria-label'), src: video.currentSrc || video.src,
      time: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : null,
      paused: video.paused, ended: video.ended, playbackRate: video.playbackRate,
      readyState: video.readyState, networkState: video.networkState, muted: video.muted,
      visibility: document.visibilityState, error: video.error ? { code: video.error.code, message: video.error.message } : null,
      quality: q ? { totalVideoFrames: q.totalVideoFrames, droppedVideoFrames: q.droppedVideoFrames, corruptedVideoFrames: q.corruptedVideoFrames } : null,
      buffered: Array.from({ length: video.buffered.length }, (_, i) => [video.buffered.start(i), video.buffered.end(i)]),
    };
  };
  window.fullPlaybackRead = () => ({
    visibility: document.visibilityState,
    video: document.querySelector('.ms-player-dialog video') ? readVideo(document.querySelector('.ms-player-dialog video')) : null,
    history: JSON.parse(localStorage.getItem('monumental.viewer.v1') || '{}').history || {},
    currentStop: document.querySelector('[aria-label="Journey queue"] [aria-current="step"]')?.getAttribute('aria-label'),
    autoContinue: document.querySelector('[aria-label="Auto-continue journey"]')?.getAttribute('aria-checked'),
    countdown: document.querySelector('.ms-queue-countdown')?.textContent,
    endedPanel: Boolean(document.querySelector('.ms-player-ended')),
  });
  const attach = () => document.querySelectorAll('video').forEach(video => {
    if (seen.has(video)) return;
    seen.add(video);
    video.muted = true;
    video.defaultMuted = true;
    const n = ++instance;
    ['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'pause', 'waiting', 'stalled', 'suspend', 'error', 'ended', 'seeking', 'seeked', 'ratechange'].forEach(type => {
      video.addEventListener(type, () => {
        if (!video.closest('.ms-player-dialog')) return;
        window.fullPlaybackEvent({ kind: 'media-event', type, instance: n, browserMs: performance.now(), ...readVideo(video) });
      });
    });
  });
  new MutationObserver(attach).observe(document, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => window.fullPlaybackEvent({ kind: 'visibility', value: document.visibilityState }));
  document.addEventListener('DOMContentLoaded', attach);
}, { ids });

let result;
try {
  await page.goto(base + '/#/my-world', { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByRole('button', { name: 'Start journey', exact: true }).click();
  await page.locator('.ms-player-dialog video').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const v = document.querySelector('.ms-player-dialog video');
    return v && v.readyState >= 2;
  }, undefined, { timeout: 60000 });
  const first = await page.evaluate(() => window.fullPlaybackRead());
  if (first.video.paused) {
    try {
      await page.getByRole('button', { name: 'Play video', exact: true }).click({ timeout: 3000 });
      record({ kind: 'initial-play-gesture', reason: 'Native autoplay was paused; direct Play control used.' });
    } catch (error) {
      // Autoplay can begin between the paused snapshot and the control lookup.
      // Accept only actual playback; never force the media clock or play state.
      if ((await page.evaluate(() => window.fullPlaybackRead())).video?.paused !== false) throw error;
      record({ kind: 'autoplay-started', reason: 'Native autoplay began while the Play control was resolving.' });
    }
  }
  await page.waitForFunction(() => document.querySelector('.ms-player-dialog video')?.currentTime > 0, undefined, { timeout: 60000 });
  record({ kind: 'started', base, output: out, snapshot: await page.evaluate(() => window.fullPlaybackRead()) });
  await page.screenshot({ path: path.join(out, 'started.png') });
  let nextCheckpoint = Date.now() + 60000;
  const deadline = startedAt + 35 * 60 * 1000;
  let finalSnapshot;
  while (Date.now() < deadline) {
    // Short sleeps keep checkpoint/control/error handling responsive; no media manipulation.
    await new Promise(resolve => setTimeout(resolve, 1000));
    finalSnapshot = await page.evaluate(() => window.fullPlaybackRead());
    const v = finalSnapshot.video;
    if (finalSnapshot.visibility !== 'visible') throw new Error('Playback document became hidden.');
    if (v?.playbackRate !== 1) throw new Error('Playback rate was not 1x.');
    if (v?.error) throw new Error('Native media error: ' + JSON.stringify(v.error));
    if (playbackSeeks().length) throw new Error('Seeking occurred during natural playback check.');
    if (Date.now() >= nextCheckpoint) {
      record({ kind: 'checkpoint', snapshot: finalSnapshot });
      nextCheckpoint += 60000;
    }
    const ended = events.filter(e => e.kind === 'media-event' && e.type === 'ended');
    if (ended.length >= 2) {
      await new Promise(resolve => setTimeout(resolve, 6000));
      finalSnapshot = await page.evaluate(() => window.fullPlaybackRead());
      const sequence = ended.map(e => e.title);
      const firstEnd = ended[0];
      const secondStart = events.find(e => e.kind === 'media-event' && e.type === 'playing' && e.title === 'Sintel');
      const advanceDelayMs = secondStart ? secondStart.wallMs - firstEnd.wallMs : null;
      const checks = {
        naturalEndedOrder: JSON.stringify(sequence) === JSON.stringify(['Big Buck Bunny', 'Sintel']),
        historyCompleted: ids.every(id => finalSnapshot.history[id]?.completed && finalSnapshot.history[id].time >= finalSnapshot.history[id].duration - 0.5),
        autoContinueEnabled: finalSnapshot.autoContinue === 'true',
        automaticAdvanceAfterCountdown: advanceDelayMs !== null && advanceDelayMs >= 4500 && advanceDelayMs < 30000,
        finalFilmStopped: finalSnapshot.video?.ended === true && finalSnapshot.endedPanel,
        noSeeking: playbackSeeks().length === 0,
        alwaysNormalSpeed: !events.some(e => e.kind === 'media-event' && e.playbackRate !== 1),
        noPageErrors: errors.length === 0,
      };
      result = { status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', elapsedSeconds: (Date.now() - startedAt) / 1000, checks, advanceDelayMs, ended, finalSnapshot, errors, artifacts: out };
      await page.screenshot({ path: path.join(out, 'naturally-completed.png') });
      break;
    }
  }
  if (!result) throw new Error('35 minute deadline expired before both natural ended events.');
} catch (error) {
  result = { status: 'failed', elapsedSeconds: (Date.now() - startedAt) / 1000, error: error.stack || String(error), snapshot: await page.evaluate(() => window.fullPlaybackRead?.()).catch(() => null), errors, artifacts: out };
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
} finally {
  const firstEnd = events.find(e => e.kind === 'media-event' && e.type === 'ended' && e.title === 'Big Buck Bunny');
  const nextLoad = events.find(e => e.kind === 'media-event' && e.type === 'loadstart' && e.title === 'Sintel');
  result.diagnostics = {
    browser: browser.version(),
    checkpointCount: events.filter(e => e.kind === 'checkpoint').length,
    initialZeroPositionEvents: events.filter(initialZeroSeek),
    sourceAdvanceAfterEndMs: firstEnd && nextLoad ? nextLoad.wallMs - firstEnd.wallMs : null,
    networkFailures: events.filter(e => e.kind === 'media-request-failed'),
    nativePlaybackInterruptions: events.filter(e => e.kind === 'media-event' && ['waiting', 'stalled', 'error'].includes(e.type)),
  };
  record({ kind: 'result', ...result });
  await serialWrites;
  await writeFile(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
  await browser.close();
}
process.exitCode = result.status === 'passed' ? 0 : 1;
