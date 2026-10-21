# Verification — interaction edition, 22 October 2026

## Source and catalogue

- TypeScript passed after the final storage/audio status corrections.
- 24 source tests passed: catalogue relationships, intersected discovery filters, journey budgets, local media/caption references, transcript parsing, bounded moments, note updates/Undo and conservative audio preferences.
- Fourteen catalogue records remain correctly separated into available preview media and planned Originals.

## Functional browser checks

Chrome desktop and simulated narrow viewports were inspected, including 320, 390, 768 and 1440px layouts. Viewport simulation is not a physical-device test.

- The repeatable general UI harness passed 44 navigation, search, category, save, journey, playback and responsive checks. The final production rerun passed all 44 checks, including the mobile route loop.
- Dedicated catalogue checks passed search focus/debounce, composition input, filter reset, browser Back and unknown-runtime sorting.
- Nine transcript/notebook integration flows passed, with nine additional focused edge flows covering timestamp zero, duplicate-note updates, Escape/focus and malformed caption recovery.
- The sculpture passed drag, unfold/reassemble, keyboard controls, hold/release resonance, pause/reset and touch cancellation.
- World passed actual destination selection, drag/zoom, connection filtering, non-WebGL fallback, tablet controls and rapid route changes.
- Time Machine passed range/keyboard selection, horizontal drag with vertical scrolling, contact sheet, comparison and saved capsules.
- Sound Studio and the header remain usable at 320px; mobile preview/save/play actions have separate reachable controls.

## Recovery and access

The focused recovery run initially passed 27 of 28 assertions. Its one defect was a persistence promise in the blocked-storage recovery screen. The copy was corrected; the targeted route-recovery rerun passed 4 of 4 assertions.

Coverage includes read/write-denied storage, quota-only failure, in-memory collections and notes, temporary-only status labels, dismissible warnings, lazy route/player failures, Escape/back focus restoration and advertised shortcuts. Rapid navigation created three cover transitions with a maximum of one active overlay and zero left behind. Reduced motion created no cover overlays.

Windows Playwright WebKit also passed actual MP4 playback, native popover/lazy Sound Studio, Index/search/guide dialogs, focus restoration, 320px layouts, globe drag/zoom, Time Machine keyboard controls, forced WebGL fallback and media-error retry. That WebKit runtime exposes no Web Audio API, and the interface reports it unavailable. This does not verify audio on a physical Safari device.

## Sound verification

The synthesized output was captured as actual 48kHz stereo browser audio and analyzed numerically. Six audition families had distinct envelopes and durations of approximately 0.16–0.59 seconds. Peak amplitude stayed at or below 0.153 in that capture; stereo placement differed by approximately 5dB. Playback suppression produced zero captured interface-audio peak. This is signal analysis, not a claim of human listening or device-speaker evaluation.

Additional lifecycle checks cover first-gesture consent, stored preferences without autoplay, mute, master volume, ambience, rate/voice limits, hidden-page pause and cross-tab mute.

## Natural full-film playback

Both complete guest films played at 1x and reached native ended events, with no seeking, forced ended events or progress edits:

- Big Buck Bunny: 596.566 seconds; 10 dropped frames out of 14,315 (0.07%).
- Sintel: 888.093 seconds; 26 dropped frames out of 21,313 (0.12%).
- Queue source change occurred 5.042 seconds after the first ended event.
- 24 checkpoints, no native waiting/stalled/error events, no uncaught page errors and both history entries completed correctly.
- The remote Blender media server produced 22 recoverable HTTP/2 request failures; Chrome recovered them without a playback stall. External media reliability remains network-dependent.

This run took 25 minutes 55 seconds wall time. Evidence is under `output/playwright/full-playback-2026-10-21T20-16-45-620Z/`. A later pass against the final interaction build is recorded below.

## Performance measurements

Cold local production preview measurements:

| Profile | LCP | Scene initialized | Layout shift | Longest task | Search opened |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop 1440px | 1.26s | 2.12s | 0.0116 |464ms |321ms |
| 390px, 4x CPU | 3.47s | 7.38s | 0.0243 |1,360ms |869ms |
| 390px, 4x CPU, 1.6Mbps/150ms latency | 3.22s | 6.58s | 0.0243 |865ms |625ms |

No page errors or horizontal overflow occurred in those profiles. These are synthetic measurements from an uncompressed local Vite preview, not field Core Web Vitals, a production speed score or a device-lab result. Shader initialization still creates substantial work on a throttled CPU.

Per-icon imports removed an avoidable development-module bottleneck. Independent route modules, Sound Studio and the planned-original section load on demand. The final entry bundle is 465.53kB (146.54kB gzip); Three.js remains a separate 507.65kB chunk (126.99kB gzip), which triggers Vite's standard size advisory.

A mobile geometry/environment reduction was tested in three alternating before/after pairs. It did not improve startup consistently and was reverted, retaining the established visual detail.

## Retired media and caption cleanup

Repeated playback exposed two real resource issues. Explicit pause/source unload now retires decoders and network resources and closes owned Picture-in-Picture. CDP recorded 12/12 native media players destroyed after retirement, compared with 2/12 on the original frozen build. Resume, queue switching, preview stop/departure and StrictMode safety passed.

A strong-retainer heap trace then identified a separate caption path: Document → StyleEngine → TextTrack → track → detached video → detached player dialog. Disabling retired text tracks before unloading released the full tree. The bounded three-cycle control stabilized at 857 DOM nodes and 289 listeners, with all retired video WeakRefs collected; the prior pattern grew 1208→1560→1912 nodes. A subsequent validation against the actual source, without prototype overrides, also held at 857 nodes and 289 listeners across three closes; captions remained showing on each new player and Pause/Play resumed correctly.

The first long-session baseline was stopped after 24 minutes 16 seconds of recorded samples. It included two completed route/player cycles and bursts by 20 minutes 35 seconds, then host-load delays. Its headless browser did not actually hide the original document when another tab was brought forward, so that assertion is recorded as an unsupported test environment rather than a product failure or a successful visibility test. It is not counted as a completed 30-minute pass.

## Final long-session and playback checks

Final production catalogue checks passed all 13 assertions. The transcript/notebook suite passed all nine flows, including 320px layouts and device reduced-motion behavior. The narrow Time Machine render has 44px controls, 10px toolbar labels and 9px frame place labels, with no horizontal overflow.

The final production lifecycle run completed 1,800 seconds, 20 route visits and 47 garbage-collected samples with zero recorded errors or failures. Three post-player Settings checkpoints and final Settings matched exactly at 803 DOM nodes and 299 listeners. Retired video and WebGL weak references were collected; final Settings had no live media or GL contexts. Post-GC heap moved from 8.79 to 9.63MB as more modules and session state warmed, with a 12.04MB maximum. This bounded observation does not prove the absence of every possible memory leak. Headless background-tab visibility remains an unsupported check in this environment.

The final natural queue run also passed: Big Buck Bunny and Sintel both reached real ended events at normal speed, with exact completed histories and the final player stopped. It took 27 minutes 0.67 seconds and recorded 26 checkpoints. The next source loaded 5.043 seconds after the first end, then played at 8.593 seconds including loading. No native in-play waiting, stalled or error events, uncaught page errors, user/harness seeks or speed changes occurred. The application's initial zero-position setup events are retained in the raw report and excluded narrowly from the no-seek assertion.

This concurrent run recorded 290/14,319 dropped frames for Big Buck Bunny (2.03%) and 479/21,313 for Sintel (2.25%), with zero corrupted frames. Twenty-four external request failures recovered through 26 HTTP 206 responses. Playback took longer than the media runtime on this busy host, so the earlier quiet run and this later concurrent run are reported separately. Evidence: `test-results/endurance-final/report.json` and `output/playwright/full-playback-2026-10-21T21-21-03-025Z/observations.json`.

One first audition after inactivity was not observed in the endurance run's one-second sample, although the following gesture resumed normally. A separate instrumented Settings-only run then passed a real 100-second idle and first-click resume: trusted pointerdown called native resume immediately, its promise resolved in 434ms and the queued sound pulse followed 1.4ms later. No errors occurred. The original anomaly was not reproduced and its cause remains unproven; no speculative runtime change was made. Evidence: `test-results/audio-idle-resume/report.json`.

## Limits

This is a functioning streaming and cultural-discovery preview. Production account authentication, cross-device sync, paid entitlements, billing, live ingest and administrative dashboards are not connected. Full assistive-technology, physical-device, production-load and human acoustic evaluations were not performed. Future client uploads still require content review and rights-cleared assets.
