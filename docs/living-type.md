# Living opening typography — 30 October 2026

Scope: the opening Passage text shown in the user's screenshot. Preserve the existing words, typeface, line breaks, color identity, scene and actions.

## What moves

- CULTURE / WITHOUT / BORDERS keep the existing staggered depth arrival. A separate inner glyph layer articulates near the pointer, with a bounded seven-pixel lift and modest rotation. A short signal travels through the letters every nine active seconds; the rest of the cycle rests.
- The outlined WITHOUT letters reveal an ivory interior. The two solid lines reveal signal-red ink. The red full stop responds to the same signal. These presentation layers share the existing text source and remain hidden from assistive technology.
- Supporting words have a short sequential entrance and a small local pointer response. Their source copy and normal wrapping remain intact.
- Entry and browse labels turn through two visual faces on hover or keyboard focus. Arrows acknowledge the same action; the browse underline extends. Hit areas remain stationary, and the second visual label is aria-hidden.

## Ownership and runtime

`DepthText.tsx` has an optional `living` variant, used only in this opening. Other headings retain their current behavior. `SpatialHome.tsx` composes the exact text and controls; `living-type.css` separates entrance, live glyph and control-face transforms.

`useLivingType.ts` uses the existing visual-frame dispatcher and TunnelFrame subscription. There is no new scrolling system, WebGL renderer, GSAP ticker, dependency or frame-by-frame React state. Geometry is read together on font, size, arrival or journey changes; pointer frames use cached letter anchors. Frame work stops after a response settles, with one timeout for the next signal. It suspends outside the opening, behind native modals/popovers, during playback and in a hidden tab. Cleanup removes subscriptions, observers, timers, frame requests and owned styles. Compact presentations use a restrained signal and ignore touch tracking; reduced motion keeps the text still.

## Verification

- Production build passes, with the existing large-chunk advisory.
- All 186 existing unit tests pass.
- 32 typography browser checks pass: recurring signal, actual rendered pointer poses and ink, stable heading/action bounds, complete accessible copy, keyboard navigation to World and back, offscreen/modal pause and resume, mobile fit and reduced motion.
- 19 selected-effect and 20 structural-cutaway regression checks pass. No browser page or shader errors were recorded in these runs.
- Scoped detector: zero findings. Independent visual finish review: `disposition: ship`, no material fixes; report recorded alongside the captures.

Evidence: `output/playwright/living-type/verification.json`, its desktop/phone/reduced-motion captures, and `living-type-demo.webm`; regressions in `output/playwright/type-selected/` and `output/playwright/type-xray/`. The optional first video recording attempt lacked Playwright's FFmpeg binary; it was installed, and the complete typography rerun and separate recording succeeded. Physical-device frame rate and a real hidden-tab transition were not newly measured.

Backup: `backup/type-before-20261030` at `38b6638d7da0e8519fa2d0a1d9c2c30f9fb3424c`, the preceding Sites v49 source. No new raster assets.
