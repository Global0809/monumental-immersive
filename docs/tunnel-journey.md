# Tunnel journey handoff

Completed 2026-10-26. The homepage is a native-scroll passage through six interactive stations. Backup tag: `backup/pre-tunnel-2026-10-26`.

## Implementation map

- `src/services/tunnelJourney.ts`: shared station coordinates, reversible scroll-to-camera mapping, frame/panel subscriptions, compact-mode boundary.
- `src/components/spatial/SpatialHome.tsx`: semantic station content, single React portal mount per station, document checkpoints, ScrollTrigger measurement, wayfinder and existing player callbacks.
- `src/components/spatial/tunnelScene.ts`: Three.js architecture, station objects, CSS3D panels, shared camera, route travel, fallback restoration and resource cleanup.
- `src/components/spatial/tunnel-journey.css`: entrance, layered panels, wayfinder, compact flow and reduced-motion styling.
- `src/components/spatial/SpatialExperience.tsx`: lazy scene loading and persistent scene lifecycle; `SpatialNavigator.tsx` integrates route travel. `src/services/spatial.ts` owns station routes. `QualityControls.tsx` and `src/components/KeyboardGuide.tsx` carry supporting control copy.
- `tests/tunnel-journey.test.ts`: station ordering, continuous phase boundaries, forward/reverse travel, final hold, endpoint clamping and compact-mode boundaries.

## One scroll coordinate system

Native document scroll supplies the camera position; there is no separate virtual scroll track. The hero checkpoint is `135svh`, and each desktop chapter is `225svh`. Station Z is `-32 - index * 34`. Each chapter approaches from station Z + 25, reaches Z + 12.8 at 38% progress, moves slowly to Z + 12.2 through 74%, then proceeds to the next station. The final station holds its reading position.

WebGL and CSS3D render with the same perspective camera: desktop FOV 46°, compact FOV 57°, near/far planes 0.12/130. Homepage camera Z is assigned directly from the shared frame, so reversing scroll retraces the same path. The 620px HTML panels use a world scale of 0.0117. React content exists once; the renderer moves its actual mount between CSS3D and its document fallback slot.

| Station | Route | Preview catalogue ID |
| --- | --- | --- |
| The World | `/world` | `miami-frequency` |
| Time Machine | `/time-machine` | `break-beat-city` |
| The Cinema | `/category/movies` | `sintel` |
| Music | `/category/music` | `island-current` |
| Culture | `/category/culture` | `concrete-and-colour` |
| My World | `/my-world` | `tokyo-in-motion` |

Each station has a direct route link, an unfold control and a preview button when its catalogue item is available. The wayfinder provides station jumps, previous/next and return to entrance. Preview playback uses the existing player.

## Fallback and accessibility

Compact document flow applies below 980px width, below 660px height, or with reduced motion; unavailable WebGL also uses the reading layout. The same semantic panels return to their original slots with their original styles and accessibility attributes restored. CSS has additional layout adjustments at 1100px and 760px, plus a short desktop treatment at 700px height.

Off-position desktop panels are hidden or inert and excluded from the accessibility tree until readable. Route departure also disables them. Player pause preserves the opener's DOM state for focus restoration. Reduced motion suppresses automatic scene movement and pointer parallax, disables panel transitions, and uses immediate station scrolling. WebGL context loss restores document content and completes pending navigation.

## Lifecycle and performance

The scene loads dynamically. Repeated tunnel ribs and struts use instancing; distant station objects are culled, and the cinema texture loads on approach. Rendering uses a 60Hz cadence budget, pauses during player playback and hidden-document periods, and becomes event-driven with reduced motion. Pixel ratio is capped at 1.4 on desktop, 1.1 in compact mode or 1 for desktop light quality; sustained frame cost can lower it in 0.15 steps, with a floor of 0.8.

Resize observers and font readiness refresh document measurements. Cleanup cancels RAF and travel callbacks, removes listeners, disconnects observers, unsubscribes shared stores, reverts the GSAP context, restores panel mounts, and disposes geometry, materials, textures, environment and renderer. Panel transform strings are preserved across compact/full transitions because CSS3DRenderer caches object transforms.

## Design comparison

The implementation preserves the recorded signal red, ink background, ivory text, Barlow Condensed/DM Sans pairing, square editorial panels, metallic geometry and direct content controls in `DESIGN.md` and `.impeccable/design.json`. It remains consistent with their native-scroll, reduced-motion, visible-focus and truthful-content principles.

The incumbent documents still describe the older homepage sculpture, staggered featured films and headline entrance. Their homepage scale/motion descriptions and breakpoint list do not document this passage, its shared camera or its 980px/660px compact boundary. That prose drift is advisory and outside this change; `DESIGN.md`, `.impeccable/design.json` and `PRODUCT.md` remain unchanged.

## Verification record

The implementation pass reported a successful production build and 128 passing tests. Browser QA passed at desktop 1280×720 and mobile 390×700, including station navigation, player opening/closing, focus restoration and resizing. Mobile-to-desktop and reduced-to-full motion changes preserve CSS3D transforms. Entering World and explicitly returning Home restores scroll position 0 and full hero opacity. The final runtime error log was empty, and the independent finish review returned **ship** with no material fixes.

These checks are browser verification, not a real-device 60fps guarantee. This documentation pass inspected source and design references; it did not rerun the browser checks.
