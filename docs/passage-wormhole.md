# Continuous Passage wormhole

Reference: the user's `WhatsApp Video 2026-11-02 at 7.21.07 PM.mp4` (2.68 seconds). Reviewed successive frames: a dark throat, spiraling copper and slate cloud walls, and elongated points flowing out toward the viewer. The reference is visual guidance, not a shipped media asset.

The Passage retains its architecture, chrome, six chapters, camera poses, native scroll and media. A procedural background reveals flowing space through the architecture's openings. Ivory and restrained copper carry the light; subtle glyph streams belong to the vortex rather than a screen-space dashboard.

## Ownership and budget

- `passageWormhole.ts`: a bounded procedural field (768px maximum dimension in auto quality, 960px detail, 512px light, 384px compact) and one opaque, non-depth-writing background triangle in the existing Three scene. Two inexpensive draws and one render target; no added canvas, video decoder, texture download, or animation loop.
- `tunnelScene.ts`: existing elapsed clock, smoothed pointer and scroll energy drive the background. Scroll adds continuous travel distance instead of changing absolute phase on a chapter jump. It never changes the camera.
- The background renders before opaque geometry. Media screens and editorial backing retain their original colours. Existing normalized UI rectangles attenuate the background under opening copy and navigation.
- Inspection freezes the clock. Paused players/dialogs and hidden tabs inherit the scene's suspension. Compact and reduced-motion presentations show a static version, preserving the existing rendering budget and reading behaviour.
- Geometry/material resources are disposed with the scene. The effect does not add listeners or timers.
- Outer lining panels have wider physical openings (1.75 units deep, previously 2.6). The carrier mechanisms, ribs and service-bay clearances are unchanged. These apertures reveal the distant flow without applying transparency to metal or films.

## Verification

The production build and 17 camera/material/light unit checks passed. The focused native Chromium review passed 20 checks: idle flow with unchanged camera/scroll, mouse response/reset, stable reading positions, inspection suspension, simulated hidden-tab suspension without catch-up jumps, fast/reverse scrolling, route return without duplicate interfaces, compact and reduced-motion modes, and no runtime/shader errors. The existing mechanism suite also passed all 55 checks across six chapters, approach/read positions, inspection, playback and compact/reduced views. The scoped design detector found no findings; an independent visual review confirmed readable media and content.

Captures: `output/playwright/passage-wormhole/01-opening-time-a.png` through `06-reduced.png`; machine-readable evidence: `results.json` in the same directory. Initial bright-field tuning and video-assisted captures are superseded by the final video-off review. The shader stays behind the existing architecture rather than replacing the entire Passage with an unobstructed nebula.

Local browser rAF sample: 120 frames, median 5.6ms, p95 5.9ms. This measures browser callback cadence, not GPU completion or a physical-device 60fps guarantee. Hidden visibility was simulated. Previous source is preserved on `backup/wormhole-before-20261102`.
