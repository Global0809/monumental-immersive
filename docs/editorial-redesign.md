# Monumental editorial and spatial refinement

Implemented 27 October 2026 from the supplied world-class redesign brief. The direction is **Culture has a through line**: place → story → connection → personal collection. This release refines the existing application; it does not substitute a new catalogue or a simulated service.

## Recovery and preserved foundations

The primary checkout has `backup/pre-editorial-redesign-2026-10-27` at `d15a2c66bba36cbe1645f5a281cd728ce6547673`. Earlier tunnel backups remain available. The public GitHub mirror had no local changes at the start of release preparation.

| Foundation | Preserved / verified |
| --- | --- |
| React, TypeScript, GSAP, Three.js, Vite | Existing stack; no added runtime dependency or framework migration. |
| Black, warm white, chrome and signal red | Existing tokens retained. Architecture uses quieter mineral surfaces; sculptures retain chrome. |
| Barlow Condensed and DM Sans | Existing locally served fonts retained. Both installed packages include SIL Open Font License 1.1. |
| Catalogue and assets | Existing IDs, imagery, film sources, captions, relationships and credits retained. All 18 motion files were inspected as H.264, 1280×720, eight-second clips. |
| Saved state | Existing saves, playback history, journeys, field notes, moments, capsules and preferences retained; no destructive storage migration. |
| Routing | Existing hash routes, queries, browser history and deployment subdirectory behavior retained. |
| Sound | Existing authored cues, quiet defaults and sound preferences retained; real film playback has audio priority. |
| Accessibility | Semantic content, native modal behavior, keyboard paths, touch alternatives, reduced motion and WebGL fallback retained. |
| Hosting | Existing public Sites project and GitHub Pages destination retained. |

## What changed

- **Navigation:** one primary header and a grouped Index replace overlapping navigation layers. The Index contains every existing route, names the actual destination, traps focus and returns focus on dismissal. Sound Studio remains available.
- **Passage:** a deterministic camera approach now reaches an exact reading plateau before departure. The background stops continuous rendering away from Home. Fewer structural elements, quieter materials, stable panels and larger projected text make each station legible. Mobile gets a native station selector, normal document flow and a quieter text backdrop.
- **World:** the globe and a compact destination decision panel lead to a real featured film. Counts and runtimes come from the catalogue. The miniature Miami scene and relationship tools remain available through clearer, optional entrances. The globe starts still; selection/dragging stops automatic motion.
- **Time Machine:** era selection is persistent and visible. The image caveat precedes the contact sheet; cards are no longer shifted down by an inherited film-strip offset. Period context and publication time remain separate. Capsule dates use readable dates.
- **Cinema and Search:** separate watch/save actions, accurate format and runtime, a complete featured film, one opt-in preview at a time, and compact mobile filtering. Active searches bring the first result into view sooner.
- **Motion:** explicit playback states prevent an errored preview from reporting Ready. Retry, pause and seeking use the actual media element. Other routes use compact links rather than repeatedly embedding the full gallery.
- **Player:** normal viewing fits ordinary laptop heights, volume is exposed, companion tools are optional, and closing returns to the same filter, scroll position and focused control. Narrow-screen controls wrap within 320px. One custom transport is shown in normal mode, with a real captions toggle/language selector; fullscreen uses native controls. Escape exits fullscreen before dismissing the film.
- **Journeys:** a selected starting place is genuinely first, within the viewing budget. Generating reveals and focuses the itinerary after route restoration. Reorder, save, edit, share and pacing controls remain functional. Every stop explains its catalogue connection.
- **My World:** continue watching, saves and journeys precede optional visual tools. The empty state offers a real first story. Passport labels distinguish Saved, Started and Watched. The personal monument starts still, renders a bounded group of 24 pieces and retains access to the full collection.
- **Loading and motion:** a lightweight opening state is available immediately. Only the requested route is warmed alongside the application shell. The tunnel is not fetched on direct editorial entry. Text entrance animation is reserved for display headings; body copy stays readable.

## Verification

Automated results are stored in ignored `test-results/`; screenshot review is in ignored `output/playwright/`. Reproducible browser scripts are tracked under `tests/browser/`.

- `npm test`: **134 passed**, zero failed.
- Updated `verify-ui.mjs`: **97 checks passed**, covering keyboard Index, search/filters, real film playback and resume, saves, journey editing, 19 destination routes, mobile layouts and reduced motion. No uncaught application exceptions.
- `verify-moments.mjs`: **9 checks passed**. A moment saved at 12 seconds resumed at exactly 12.000 seconds. Note editing, reload persistence, transcript seek, remove/Undo and 320px layout were exercised.
- `verify-audio-idle-resume.mjs`: actual 100-second idle suspension and first-interaction resumption succeeded. Native engine instrumentation confirmed film playback reduces master gain to zero and stops ambience; closing restores them. Browser output was muted, so this is lifecycle verification, not a listening review.
- Motion previews: actual time advanced, pause/seek worked, rapid selection retained the correct source, simulated request failure retained its poster and truthful state, and Retry recovered playback.
- Visual review included 1280×720, 1440×900, 768×1024 and 390×844. A separate reviewer identified mobile station-label crowding, excess search chrome and a Time Machine offset; those findings were corrected and recaptured.
- `verify-editorial-resilience.mjs`: **47 checks passed**, including unavailable WebGL, rapid normal-motion route interruption, browser Back with destination queries, 360×800, 844×390 and 720×450 layouts. The station panel moved less than one pixel after native scrolling settled. Two visual findings outside those assertions were corrected: landscape entrance copy now uses two columns, and the Time Machine introduction retains its spacing when its line break is hidden.

## Measured optimization

Six destination photographs now have 960px WebP display derivatives: **559,698 bytes combined**, down from 3,255,346 bytes for the unchanged JPG originals (82.8% reduction). Source attribution remains intact. The originals remain available for future larger responsive variants.

Equivalent fresh-context local production measurements before/after those derivatives:

| Route | Completed transfer before | After | Reduction |
| --- | ---: | ---: | ---: |
| Home | 2,085,921 B | 790,912 B | 62.1% |
| Search | 3,069,269 B | 828,686 B | 73.0% |

The after-image run observed Home LCP 476ms, scene-ready 1,044ms; Search LCP 556ms. A separate four-second instrumented run observed 60.03 WebGL draw-submission frames per second, median gap 16.7ms, p95 16.8ms and maximum 44.5ms. This establishes submission cadence on this machine, not GPU completion or displayed FPS. Direct World and Search do not load the tunnel renderer; Search does not load Three.js. Network-throttled measurements and detailed caveats are retained in the local performance reports.

Performance reports are single-machine laboratory observations. They are not field Core Web Vitals or a guarantee that every device sustains 60fps. The Three.js dependency remains a separately loaded large chunk; it is not hidden by suppressing the build warning.

## Boundaries that remain explicit

The local collection is browser-local until configured account services are connected. Guest-film licensing and attribution remain as supplied. Planned Originals, live programming and Monumental+ remain labeled in development. Payment, account sync, public screening-room presence and production AI services are not invented by this visual release. Journey links carry an itinerary; they are not revocable server-hosted private records. Actual iOS hardware and a production audience load test were not available for this pass.

The existing modular platform providers and safe unconfigured states remain the integration boundary for those services.
