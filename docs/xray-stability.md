# X-ray interaction stability

This corrects the existing Passage cutaway and shared model inspection without changing the site's visual identity, content, destinations or camera journey.

## Reproduced causes and fixes

The immersive application does not mount the old `ReactiveWorld` layer. Model X-rays were still reading its inactive pointer state. Baseline browser probes confirmed that the Atlas and paused personal sculpture retained stale coordinates and zero reveal despite pointer movement. `xrayPointer.ts` now owns one reference-counted pointer collector for the material scenes, independent of that optional page layer.

`xrayLens.ts` separates opacity from the inspection radius. Entry, movement and departure converge through the existing scene frame callbacks, with exact settled endpoints. Paused Atlas, Culture sculpture and personal sculpture request only the frames needed for this settling. Scroll/layout notifications request a frame even when the cached canvas bounds were previously away from the pointer. Canvas coordinates use actual drawing-buffer and CSS dimensions. Coplanar overlay lines receive a small depth bias, and the old screen-space stripe shimmer is removed.

The Passage formerly reset its probe on every scroll event and required another mouse move to restore it. It now retains the physical cursor, projects the current semantic panels before hit testing, and revalidates the content beneath that cursor. Media, text and controls remain hard exclusions. Pressing suspends the reveal; release resumes at the actual release position. Ordinary pointer departure fades out.

`cutawayMotion.ts` provides a bounded probe handoff. Small movements remain attached to real picked surfaces; a brief hysteresis rejects fleeting relay-edge hits. Switching between a relay and the tunnel, or making a large camera jump, closes the old section before acquiring the new one. A missed ray retires rather than disappearing in one frame. The existing seven-row geometry budget is preserved. The cinematic lens/bloom response is also interpolated so inspection does not abruptly change the whole scene's finish.

## Safety and runtime ownership

Protected UI, imagery, films, dialogs and popovers immediately suppress material scans. Pointer cancellation, focus loss and hidden pages clear transient input. Unsupported native-popover selectors have a safe fallback. Touch and reduced-motion presentations retain their existing exclusions. The shared collector has no animation loop; model schedulers own bounded redraws. Cleanup removes listeners, restores shader callbacks, and disposes only owned overlays. No additional dependencies or visual assets were introduced.

## Verification

227 unit checks pass, including deterministic handoffs, surface-miss retirement, frame-rate independence, protected resets, pointer collector ownership and disposal, drag/release behaviour, stationary scroll revalidation, bounded lens settling and the existing camera/media/geometry regressions. The production TypeScript/Vite build passes.

31 unique browser checks pass with no uncaught application or shader errors. The integrated review covers Passage forward/reverse movement, fast sweeps, held drags, protected media and controls, full player and inspection states, Atlas and personal-model hover, city hover, dialogs, route exit, compact touch presentation and reduced motion. Measured stationary-scroll cursor error was zero on both axes. The paused Atlas drawing counter remained unchanged after settling. Ten captures were reviewed for localized reveal and legible content. Evidence and the untouched model baseline are recorded under `output/playwright/xray-stability/`.

One exit assertion initially placed the pointer outside the model but inside its intentional 170px overlapping lens. A targeted check beyond the lens confirmed exact zero strength; this was a test-coordinate correction. Verification used desktop Chrome and phone/reduced-motion emulation, not physical devices. The dormant legacy DOM reveal was source-reviewed; the active immersive rendering paths were exercised.

Recovery branch: `backup/xray-stability-before-20261030`, preserving the preceding cinematic release at `a567bf4c2b5f9725000c3f3a21f5c58ed8c8603f`.
