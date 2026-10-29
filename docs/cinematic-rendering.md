# Cinematic material and light finish

This refines Monumental's existing chrome, charcoal, warm ivory and signal-red world. The camera path, readable chapter holds, text, catalogue, film actions, sound score and navigation remain unchanged.

## Material and light

`cinematicMaterials.ts` creates deterministic, seamlessly tiled brushed metal, powder-coat and mineral finishes. Bump and roughness share packed, mipmapped textures: one 256-square map and two 128-square maps, allocated only when used. The maximum base texture data per scene is 384 KiB. Original colour maps and shader hooks remain intact. No external image assets or runtime noise generation are required.

`cinematicLight.ts` supplies a slow, continuous architectural breath. Overlapping 8.8, 17.6 and 21-second cycles modulate actual key/rim lights; a 23-second movement produces a very small drift. Exposure and ambient illumination remain stable. Passage edge lights, conduits and nearby spill share the same signal. Reading holds reduce the variation. Existing scene clocks own the effect: pause, inspection, reduced motion and hidden-tab behaviour remain authoritative. A paused globe or collection remains deliberately still until its existing motion control is enabled.

## Lens finish

`cinematicRenderer.ts` adds restrained highlight diffusion and optional peripheral lens softness. The scene renders once through its native antialiasing, tone mapping and media colour handling. A GPU framebuffer copy feeds two small blur passes and one composite pass; it never captures DOM or reads pixels back to the CPU. There is no extra rendering loop or WebGL context.

The Passage uses the fullest treatment during travel. Lens softness returns to zero for reading, inspection and structural X-ray. The active film's projected rectangle is excluded from both the highlight source and the composite, retaining its original pixels. HTML text and controls stay outside the pipeline. The softening is peripheral lens atmosphere, not a claimed depth-of-field simulation.

Atlas, the city miniature, personal sculpture and kinetic lab use much quieter diffusion without lens blur. The Culture sculpture retains native rendering to protect its video bands. Flight retains native rendering and its existing particle intensity; material detail and actual light breathing improve its crew without increasing the previously rejected particle bloom.

## Budget and fallbacks

The full-resolution capture is RGBA8. Both glow targets are quarter resolution, capped at 480 pixels wide, without depth or stencil. Targets above five million pixels use native rendering. Compact/short viewports, reduced motion and the existing Light quality setting avoid these additional passes. The Passage also drops them when its existing adaptive quality controller reaches its lower tier. Textures and targets are scene-owned, reused, resized only as needed and disposed with their scenes. No new shadows, audio assets or dependencies were added.

## Verification

The release has 219 passing unit checks, successful Sites and GitHub Pages production builds, and a clean scoped design detector. `tests/cinematic-light.test.ts` checks light bounds, reduced motion, media rectangles and buffer budgets. `tests/cinematic-materials.test.ts` checks deterministic texture sharing, distinct physical finishes, media protection and idempotent cleanup.

The coordinated Chrome review and targeted correction confirmation produced 36 unique passing browser checks, zero uncaught application/shader errors and 15 captures. Coverage includes desktop and phone layouts, landscape resize, actual breathing at rest, native forward/reverse scroll, direct station jumps, film priority, Globe/city controls, Flight inspection, Music's optional screening room, My World, the material lab, route return, reduced motion, context loss and Light/Balanced quality switching. The review caught retained lab GPU resources; teardown now explicitly releases that context, and the correction passes. An initial startup timeout and incorrect test selectors are retained with their resolutions in the review log.

Evidence is in `output/playwright/cinematic-world/release-report.json` and `verification.md`. Opening and Passage samples rendered 52 frames in about 862 ms in the test environment; this short local observation is not a physical-device frame-rate guarantee. Captures show clear text and media, intact transparent edges and restrained highlights. The existing large Three.js vendor-chunk build warning remains; lazy route loading is preserved.
