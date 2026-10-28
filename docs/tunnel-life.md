# Living tunnel extension

This extends the continuous mechanical [Passage](passage-architecture.md) with local motion and an interactive model. It retains the existing native scroll journey, six stations, camera, reading holds, catalogue, media provenance and Monumental identity. The `DESIGN.md` token frontmatter and sidecar primitives are unchanged; the design narrative records the added mechanisms and suspension behavior. `PRODUCT.md` and the global stylesheet are unchanged. The surface contract is [Passage](../.impeccable/surfaces/passage.md).

## Visible behavior

The entrance relay has six machined leaves, connecting pistons, hollow collars, broken gimbals and a signal-red core. Opening spreads its leaves and exposes its moving assembly. The Unfold the relay / Fold the relay button carries the shared pressed state and supports keyboard activation. A click on visible relay geometry uses the same state; a pointer drag exceeding the click threshold does not toggle it. Pointer response is local to the model and atmosphere.

Five smaller relays sit at fixed world positions between stations. They become visible during approach and departure, then disappear around the reading composition. Hinged alloy vanes and eight segmented light trains follow the tunnel walls. Send a signal starts a pulse four world units ahead of the current camera, travelling down the tunnel at 36 world units per second. The same pulse opens vanes, charges their inlays and excites the existing particle field. Repeated signals restart one bounded envelope instead of accumulating timers or effects.

## Ownership and lifecycle

| Source | Responsibility |
| --- | --- |
| `src/services/tunnelLife.ts` | Immutable relay/signal snapshots, subscriptions and one pulse envelope; animation state remains outside React. |
| `src/components/spatial/tunnelRelays.ts` | Instanced relay parts, local articulation, five travel anchors, cached raycast bounds and resource disposal. |
| `src/components/spatial/tunnelSignals.ts` | Instanced wall vanes, helical rails, light trains and propagating pulse geometry driven by shared frame values. |
| `src/components/spatial/tunnelScene.ts` | Existing scene-clock integration, input exclusion, click raycasting, route/inspection gating, suspension and cleanup. |
| `src/components/spatial/tunnelAtmosphere.ts` | Existing particle field responds to travel energy and the same world-space signal pulse. |
| `src/components/spatial/SpatialHome.tsx` and `tunnel-journey.css` | Semantic relay and signal controls, pressed feedback and compact/reduced-motion omission. |

The extension creates no additional WebGL renderer or animation-frame loop. Repeated parts share geometry/materials and instanced draws; shader uniforms move the wall effects. The light quality preset omits rail and vane-inlay draws and alternate travel relays. Scene teardown removes the subscription, disposes owned resources and resets the pulse.

During the exact reading interval, local wall activity slows and dims near the active station; the travel relays are hidden. Expanded inspection freezes the pulse, relay transforms, wall clocks and particle update. Existing player/dialog and hidden-document suspension still stop rendering. Route departure resets the pulse and relay state. Controls, links, text panels and dialogs are excluded from pointer raycasting. The source continues to publish media protection for the independent Flight layer.

Compact and reduced-motion modes hide the new geometry and omit its DOM controls. They retain the existing semantic chapters, contained media, native scrolling and ordinary navigation. No new imagery, footage, asset provenance or content claims are introduced.

## Verification and review

The implementation owner reports a successful production build and 166 passing unit/service tests, including pulse retrigger/reset and subscription lifecycle coverage. The saved Passage regression pass contains 57 passing checks, and the focused browser pass contains 22 passing checks for keyboard and 3D relay interaction, drag rejection, bounded repeated signals, reading/media protection, route return, phone and reduced-motion behavior, and absence of uncaught browser errors. A separate geometry pass covers 36,640 rays and 24 hit-test cases with no collisions, malformed bounds or incorrect hit results.

Evidence is retained under `output/playwright/living-tunnel-review/`, `output/playwright/living-tunnel-relays/` and the subsequent regression/final capture directories. This documentation pass inspected the source and recorded artifacts; it did not independently rerun the build or browser suites. Recorded frame intervals describe the test environment and are not a device-independent performance guarantee.

The fresh finish review returned **SHIP** after its two findings were resolved: F01, expose the signal-red core by placing the dark backing behind it; and F02, record the additions and suspension behavior in the design documentation. The reviewer confirmed the core in folded, unfolded and signal states and accepted the updated design narrative, sidecar narrative and surface brief. This verdict closes those two findings only; it is not a new whole-site approval.

The targeted confirmation is retained in `output/playwright/living-tunnel-verdict/verification.json` with `00-opening.png`, `01-relay-open.png` and `02-signal.png`. It covers the corrected core, button opening, physical-model click folding, signal control and zero console errors or warnings at 1440 × 900. The earlier SHIP verdict in the architecture document applies to the continuous-tunnel foundation. These are local implementation and review results; deployment is not asserted here.

The current scoped design detector reported advisory font sizes outside the documented type ramp, including the incumbent entrance clamp and small labels. These are recorded as advisories; this extension does not normalize the existing typography or change shared tokens.
