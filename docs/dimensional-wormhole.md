# Dimensional wormhole revision

The previous release used a flat, low-resolution procedural backdrop behind dense tunnel metal. The user rejected that appearance and requested an actual reactive Three.js environment closer to their supplied 2.68-second wormhole reference.

This revision replaces that backdrop with a depth-tested curved throat and spatial light currents. Sparse LED housings and structural ribs retain the Passage's mechanical identity while exposing substantially more of the surrounding flow. Existing chapter content, camera poses, media, and navigation remain authoritative.

## Installed guidance

Installed `threejs-shaders`, `threejs-geometry`, and `threejs-performance` from `CloudAI-X/threejs-skills` into the user's shared Codex skill directory. Their examples target newer Three.js releases; this implementation keeps the project's existing Three.js 0.180 dependency and uses its supported APIs.

## Shared scene implementation

- `passageWormhole.ts`: a finite curved, displaced tube (132 scene units), GPU-instanced perspective light trails, seeded scalar texture, local cursor current, and a continuous pause-aware flow phase. Both geometries use the existing camera, depth buffer and renderer; there is no fullscreen wormhole plane, additional render target, separate animation loop, or camera mutation.
- `passageLining.ts` and `passageArchitecture.ts`: shared sparse housing coordinates, 360 LED housings instead of 1,080, narrower panels and fewer ribs/conduits. The complete carriers, reading compositions and iris remain intact.
- `tunnelCutaway.ts`: X-ray targets actual installed panels instead of inventing a cylindrical surface over the new gaps. Internal service details follow the same occupancy specification.
- `tunnelScene.ts`: pointer easing, current camera synchronization, pause-aware update and five shared media/editorial protection rectangles. Footage and DOM text retain their own appearance.

The wormhole adds two draws, two geometries and one small scalar texture. Balanced desktop uses 1,180 streak instances; light mode 620; compact 340. Compact and reduced-motion modes retain a still, composed scene. Its resources are disposed through the existing scene lifecycle.

## Verification

The browser probe checks compiled perspective shader programs and actual GL submissions (indexed wall plus instanced streaks), not only application diagnostic attributes. It checks the same scene framebuffer and projection, stable camera holds, fast forward/reverse scroll, inspection pause/resume, route lifecycle, compact layout and reduced motion. Visibility testing simulates `document.hidden`; it does not claim an operating-system background-tab test.

Final checks on 2026-11-02:

- Production build and TypeScript pass. Vite retains its existing large Three.js chunk notice.
- 22 targeted unit checks pass for journey, lighting, materials and cutaway geometry.
- 55/55 browser regression checks pass across all six chapter approaches/reading positions, inspection, playback, compact and reduced layouts; zero runtime errors.
- 30/30 focused wormhole checks pass after the final material refinement; zero runtime or shader errors. Compiled GPU evidence shows one indexed curved wall and one instanced streak submission, using the scene projection and framebuffer.
- Actual rendered-frame submission sample: 212 frames over 3,533.8 ms, median 16.7 ms, p95 22.2 ms. This is a short headless-browser submission measurement, not a physical-device or universal 60-FPS guarantee. The scene had 142 existing draws plus the two wormhole draws.
- Opening, World, Music and compact screenshots reviewed directly; independent review found no obvious new carrier clipping, media overdraw or content collision. The first clouds were too creamy/stretched, so the final material uses darker porous masses, directional billow shading, restrained highlights and clearer narrow streaks.

Evidence: `output/playwright/passage-wormhole-volume-final/` (six screenshots, results and compiled shader evidence) and `output/playwright/mechanism-clearance/verify/` (all six chapters and interaction checks). The existing entrance iris intentionally remains in front of the distant throat. Compact/reduced presentations are static. Prior release source is retained at `backup/volume-before-20261102`.
