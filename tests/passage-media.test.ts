import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PASSAGE_MEDIA, createPassageMediaController } from '../src/services/passageMedia.ts';

class FakeVideo extends EventTarget {
  muted = false; defaultMuted = false; playsInline = false; preload = ''; loop = false; controls = true;
  crossOrigin = ''; tabIndex = 0; className = ''; dataset: Record<string, string> = {};
  src = ''; poster = ''; currentTime = 0; duration = 0; readyState = 0; seeking = false;
  paused = true; ended = false; parentElement: unknown = null;
  loads = 0; plays = 0; pauses = 0; removed = false;
  nextPlay: Promise<void> | null = null;
  setAttribute() {}
  removeAttribute(name: string) { if (name === 'src') this.src = ''; if (name === 'poster') this.poster = ''; }
  load() { this.loads += 1; this.readyState = 0; this.duration = 0; this.currentTime = 0; }
  play() {
    this.plays += 1; this.paused = false;
    const result = this.nextPlay ?? Promise.resolve(); this.nextPlay = null;
    return result;
  }
  pause() { this.pauses += 1; this.paused = true; this.dispatchEvent(new Event('pause')); }
  remove() { this.removed = true; this.parentElement = null; }
  decode(duration = 33) {
    this.duration = duration; this.readyState = 1; this.dispatchEvent(new Event('loadedmetadata'));
    this.readyState = 2; this.dispatchEvent(new Event('loadeddata'));
  }
}

function setup() {
  const video = new FakeVideo(), documentEvents = new EventTarget(), windowEvents = new EventTarget();
  const state = { hidden: false, player: false };
  const controller = createPassageMediaController({
    createVideo: () => video as unknown as HTMLVideoElement,
    documentEvents: documentEvents as unknown as Document,
    windowEvents: windowEvents as unknown as Window,
    isHidden: () => state.hidden, isPlayerOpen: () => state.player,
  });
  return { video, controller, state, documentEvents, windowEvents };
}

test('Passage manifest keeps catalogue actions and verified local media honestly identified', () => {
  assert.deepEqual(PASSAGE_MEDIA.map(media => media.chapterId), ['world', 'time-machine', 'movies', 'music', 'culture', 'my-world']);
  for (const media of PASSAGE_MEDIA) {
    assert.ok(existsSync(resolve('public', media.src.replace(/^\//, ''))), media.src);
    assert.ok(existsSync(resolve('public', media.poster.replace(/^\//, ''))), media.poster);
    assert.ok(media.loopStart >= 0 && media.loopStart < media.loopEnd && media.loopEnd < media.duration);
    assert.equal(media.aspect, media.nativeWidth / media.nativeHeight);
    assert.ok(media.credit.length > 20);
  }
  assert.equal(PASSAGE_MEDIA.filter(media => media.kind === 'motion-study').length, 5);
  const cinema = PASSAGE_MEDIA[2];
  assert.equal(cinema.sourceId, 'sintel');
  assert.equal(cinema.catalogueId, 'sintel-full');
  assert.match(PASSAGE_MEDIA[1].caption, /Made in 2026/);
  assert.match(PASSAGE_MEDIA[1].posterCaption, /not the Bronx or archival/);
});

test('No ambient data is requested under reduced motion; independent suspension owners compose', async () => {
  const { controller, video } = setup();
  controller.setSuspended('reduced-motion', true);
  controller.setSuspended('route', true);
  controller.activate('world');
  assert.equal(video.preload, 'none');
  assert.equal(video.loads, 1); // Clears the previous source; no selected source load.
  assert.equal(video.plays, 0);
  controller.setSuspended('route', false);
  assert.equal(video.loads, 1);
  controller.setSuspended('reduced-motion', false);
  assert.equal(video.loads, 2);
  video.decode(); await Promise.resolve();
  assert.equal(video.currentTime, 6);
  assert.equal(controller.getSnapshot().status, 'playing');
  assert.equal(video.plays, 1);
  controller.destroy();
});

test('The new chapter does not inherit ready state or a stale source play rejection', async () => {
  const { controller, video } = setup();
  let rejectOld!: (reason: Error) => void;
  video.nextPlay = new Promise((_resolve, reject) => { rejectOld = reject; });
  controller.activate('world'); video.decode();
  const oldEpoch = controller.getSnapshot().sourceEpoch;
  controller.activate('movies');
  assert.equal(controller.getSnapshot().ready, false);
  assert.equal(controller.getSnapshot().chapterId, 'movies');
  assert.equal(controller.getSnapshot().sourceEpoch, oldEpoch + 1);
  rejectOld(new Error('Old source aborted'));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(controller.getSnapshot().status, 'loading');
  video.decode(52.208); await Promise.resolve();
  assert.equal(video.currentTime, 22);
  assert.equal(controller.getSnapshot().status, 'playing');
  controller.destroy();
});

test('Hidden tab and full player suspend the one decoder, then resume the same source', async () => {
  const { controller, video, state, documentEvents, windowEvents } = setup();
  controller.activate('music'); video.decode(); await Promise.resolve();
  const epoch = controller.getSnapshot().sourceEpoch;
  state.hidden = true; documentEvents.dispatchEvent(new Event('visibilitychange'));
  assert.equal(video.paused, true);
  assert.equal(controller.getSnapshot().status, 'paused');
  state.hidden = false; documentEvents.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
  assert.equal(video.paused, false);
  state.player = true;
  windowEvents.dispatchEvent(new CustomEvent('monumental:playback', { detail: { active: true } }));
  assert.equal(video.paused, true);
  state.player = false;
  windowEvents.dispatchEvent(new CustomEvent('monumental:playback', { detail: { active: false } })); await Promise.resolve();
  assert.equal(video.paused, false);
  assert.equal(controller.getSnapshot().sourceEpoch, epoch);
  controller.destroy();
});

test('Ambient loops use their verified range and a failed decode stays failed until retry', async () => {
  const { controller, video } = setup();
  controller.activate('time-machine'); video.decode(); await Promise.resolve();
  video.currentTime = 20.2; video.dispatchEvent(new Event('timeupdate'));
  assert.equal(video.currentTime, 5);
  video.dispatchEvent(new Event('error'));
  assert.equal(controller.getSnapshot().status, 'failed');
  assert.equal(controller.getSnapshot().ready, false);
  video.dispatchEvent(new Event('canplay')); video.dispatchEvent(new Event('playing'));
  assert.equal(controller.getSnapshot().status, 'failed');
  controller.retry();
  assert.equal(controller.getSnapshot().status, 'loading');
  video.decode(); await Promise.resolve();
  assert.equal(controller.getSnapshot().status, 'playing');
  controller.destroy();
});

test('Compact presentation moves the existing element and teardown unloads media and listeners', async () => {
  const { controller, video, state, documentEvents } = setup();
  const host = { appendChild(node: FakeVideo) { node.parentElement = this; } };
  controller.activate('culture'); video.decode(); await Promise.resolve();
  controller.attach(host as unknown as HTMLElement);
  assert.equal(controller.getVideo(), video);
  assert.equal(video.parentElement, host);
  controller.attach(null);
  assert.equal(video.parentElement, null);
  controller.destroy();
  const plays = video.plays;
  state.hidden = true; documentEvents.dispatchEvent(new Event('visibilitychange'));
  state.hidden = false; documentEvents.dispatchEvent(new Event('visibilitychange'));
  video.dispatchEvent(new Event('canplay'));
  assert.equal(video.plays, plays);
  assert.equal(video.src, '');
  assert.equal(video.poster, '');
  assert.equal(video.paused, true);
  assert.equal(controller.getSnapshot().chapterId, null);
});
