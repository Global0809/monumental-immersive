# Passage refinement — 29 October 2026

This pass refines the existing [selected effects](selected-effects.md). It preserves the Monumental identity, six-chapter journey, native scroll, exact reading hold, catalogue and media provenance. `PRODUCT.md`, the token-bearing `DESIGN.md` and `.impeccable/design.json` remain unchanged. The [Passage surface brief](../.impeccable/surfaces/passage.md) remains the direction contract.

## Refined behavior

| Area | Result | Principal source |
| --- | --- | --- |
| Inspection composition | Opening an exhibit keeps the headline and reading panel anchored. The object moves into the space beneath the footage; the adjacent rotation controls stay above navigation on the verified desktop and laptop layouts. Escape closes inspection and restores focus. | `src/components/spatial/SpatialHome.tsx`, `src/components/spatial/tunnel-journey.css`, `src/components/spatial/passageArchitecture.ts` |
| Tunnel depth and reading calm | Moving carrier ribs have bounds covering their assembly travel. Distant conduit glow and ribbons attenuate with depth, fog separates the distant structure, and reading positions soften the local light. Light quality omits conduit halos. Architecture and Flight use the shared reading predicate, including the final chapter. | `src/components/spatial/passageArchitecture.ts`, `src/components/spatial/tunnelScene.ts`, `src/components/spatial/flightScene.ts` |
| Headings and relay controls | Animated letters have an uninterrupted accessible reading layer; complete heading labels preserve natural announcements. Relay disclosure exposes expanded state, described shell buttons and selection feedback. Reassemble returns focus to the opening control. The relay helper panel participates in Flight content protection, refreshed after its bounds change. | `src/components/DepthText.tsx`, `src/components/depth-text.css`, `src/components/spatial/SpatialHome.tsx`, `src/components/spatial/tunnel-journey.css` |
| World story windows | Each window identifies the actual format or motion study. Development entries retain their status and cannot present a playback control without an available source. | `src/components/Atlas.tsx`, `src/components/discovery-spatial.css` |
| Cinema preview | Loading is visible and cancellable. A preview that is still not ready after 12 seconds exposes recovery and a retry; the ordinary story playback action remains available. Cancellation cannot promote an older request into a new error. | `src/components/spatial/CollectionTheater.tsx`, `src/components/spatial/collection-theater.css` |
| Saved constellation | Screens at or below 500px show two destination groups per page; wider screens show four. A visible range describes the current page. Selection stays on that page, and removing saved data clamps pagination to the remaining real destinations. Pause preserves the orbit phase so Resume continues from the held position. Each destination still shows up to four orbiting stories with its complete readable collection below. | `src/components/PersonalConstellation.tsx`, `src/components/personal-constellation.css` |
| Full-player recovery | After 12 seconds without playback progress during loading or buffering, the player offers Retry film without silently replacing the source. Retry captures the current position and retains the selected full film. An available trailer opens only through its explicit recovery action. Progress and transient seeks reset the recovery timer. | `src/components/VideoPlayer.tsx`, `src/components/player.css` |

## Preserved boundaries

The camera, semantic content and protected footage keep their existing ownership. No Passage renderer, animation loop, decoder or generated raster asset was added. Existing chapter routes, conventional controls, silent default, explicit sound consent, reduced-motion and compact fallbacks remain in place. The authored geometry and synthetic score remain clearly distinct from documentary or archival media.

This pass changes local composition and behavior without normalizing shared design tokens. The pre-refinement backup is `backup/selected-effects-polish-before-20261029`.

## Verification and finish review

The following saved artifacts were inspected during documentation. Counts describe the named local runs; this documentation pass did not rerun them.

| Evidence | Recorded result and scope |
| --- | --- |
| `output/polish-tests.log` | 182 tests pass, zero failures. |
| `output/polish-build-final.log` | Production build passes. Vite retains its warning for a minified chunk larger than 500 kB. |
| `output/playwright/passage-polish-final/verification.json` | 40 checks pass across desktop and laptop: six anchored headings, complete inspection clearance, Escape focus return, final-chapter reading calm and fast-jump return to a single Passage canvas. No captured errors. |
| `output/playwright/polish-selected-final/verification.json` | 19 selected-effects checks pass, with no captured errors. |
| `output/playwright/polish-relay-correction/verification.json` | The 19 selected-effects checks pass again after the relay protection correction, with no captured errors. `component-extracted.png` is the correction screenshot reviewed at finish. |
| `output/playwright/polish-instruments-final/verification.json` | 13 instrument, drone and audio-lifecycle checks pass, with no captured errors. |
| `output/playwright/discovery-polish/targeted-checks.json` | 37 completed checks cover dense saved collections at 1440, 768, 390 and 320px, page ranges, removal, World labels, overflow and Cinema loading/cancel/retry. No captured errors. |
| `output/playwright/discovery-polish/motion-checks.json` | Three checks confirm that Pause preserves the orbit angle, holds position and resumes movement. |
| `output/playwright/selected-stalled-playback/verification.json` | Five checks pass for stalled full-film recovery, explicit trailer choice, retry source/position preservation, transient-seek recovery and absence of uncaught browser errors. |
| `output/polish-design-detector.json` | 232 advisory findings remain recorded; no primary finding. This is not a zero-advisory claim. |

The independent finish review found one actionable P2 issue: the Flight crew could cross the relay helper instruction. The correction adds the helper to existing content protection and refreshes that protection after disclosure changes. The follow-up reviewer returned **PASS — P2 resolved**, confirming that the complete instruction is unobstructed in the corrected screenshot. The original review had no other actionable findings; the follow-up verdict is scoped to this correction.

The earlier fast-jump run reported two failures because its selector counted both the scene host and its canvas. The corrected selector targets the canvas specifically; the final 40-check artifact passes. Earlier evidence is retained rather than recast as a passing run.

Successful playback of the complete external Sintel stream remains unverified. The recovery checks establish usable behavior when a source stalls; they do not establish that the external source was repaired. Real hidden-tab behavior is also not fully browser-verified. Local screenshots and frame samples do not guarantee 60 fps on physical low-powered hardware.

## Delivery status

This refinement is a locally built, tested and reviewed release candidate. Publication and verification of this refinement are subsequent release steps; no new public version is claimed here.

The preceding selected-effects implementation was published as Sites version 47 from source `bf95fcabce89625608d52cbf0f662623b52218ef`; its GitHub release commit is `8f61bd2d88598c0fd1b9b004d27d2590d44a32de`. That completed release is distinct from this candidate.
