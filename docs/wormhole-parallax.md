# Wormhole depth parallax — 2026-11-03

The Passage's atmosphere responds to the mouse as a spatial volume. Nearby cloud folds and light trails move farther than the nearly anchored distant throat. A restrained rotational wake and shallow depth lean follow pointer velocity. Both cloud geometry and trail endpoints use the same displacement field; the shared reading camera, mechanisms, media and DOM controls keep their authored positions.

## Ownership and limits

- `wormholeParallax.ts` advances one critically damped position/velocity state from the existing scene clock. It allocates nothing per frame, starts exactly at rest, and smoothly returns to centre on pointer leave/cancel. Changing a target or holding the mouse button cannot reset the visible position.
- `passageWormhole.ts` applies a depth-dependent 3D field before perspective projection. Near gains are 3.3/2.4 scene units, falling to 3% at the throat; velocity torsion is limited to two degrees, wake to 0.3 units, and depth lean to 0.7 units with camera-end fades. Invisible recycled streak tips are rejected before projection.
- `tunnelScene.ts` keeps global parallax separate from the localized X-ray/current hit target. Crossing copy or controls does not switch the parallax off. Inspection and suspended scenes hold the current pose; touch-compact/reduced motion use zero parallax. A narrow desktop with a fine hovering pointer retains background motion and parallax while its content uses the compact layout and lower rendering detail. Returning between compact and full mode preserves the atmospheric flow phase.
- Clouds retain the v65 early alpha-blending order and disabled depth writes. Opaque metal fully covers the atmosphere, and trails still test against structural depth. The enhancement retains two draws, one scalar texture and the existing renderer/loop.

## Smoothness corrections

`frameCadence.ts` discards missed deadlines after short stalls instead of repaying them in consecutive high-refresh frames. The existing fractional 60 Hz deadline grid remains intact on 120/144 Hz screens. Pointer releases no longer hard-zero the rendered input; resume does not create false scroll acceleration from stale camera depth. Canvas dimensions are written only when size/resolution changes, using a single drawing-buffer resize. Detailed interface hit testing occurs on the render frame rather than on every raw pointer event.

## Verification

The production build and all 262 unit tests pass, including response equivalence at 30/60/120/144 Hz, pause/release/reversal continuity, invalid input, and moderate-stall frame recovery.

The full focused browser run passes 55/55 checks with zero runtime/shader errors; the six-chapter clearance suite passes 55/55. The GPU probe observes actual `uParallax` and `uParallaxVelocity` uploads for both draws, reaching approximately -0.833/+0.833 on the left/right sweep while camera, panel and scroll stay fixed. Tests cover UI crossing, click-hold/release, smooth leave decay, inspection/hidden-state freezing, narrow-desktop active flow, touch/reduced zero motion and the prior metal-occlusion regression.

The submitted-frame sample measured 210 frames over 3,531.7 ms, median 16.7 ms and p95 22.3 ms, with exactly two wormhole draws and stable shader compilation counts. This is a headless-browser submission measurement, not a physical-device guarantee. Visual evidence is in `output/playwright/wormhole-parallax-final/`, including center/left/right and narrow-desktop views. The narrow-window review also found the opening scroll prompt beneath the bottom navigator: its compact hero now accounts for the header height.

After that CSS correction, the scoped narrow-desktop confirmation passes 7/7 checks with zero errors. The scroll prompt ends at 782px while the fixed navigator begins at 830px, leaving 48px clearance. Evidence: `output/playwright/wormhole-parallax-narrow-final/`.
