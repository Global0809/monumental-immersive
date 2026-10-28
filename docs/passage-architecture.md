# Monumental — architectural Passage

The six chapters were specified together in `src/services/passageChapters.ts` before their rooms, camera poses and editorial presentation were implemented. The existing chapter order, copy, destinations and full-player actions remain intact.

| Chapter | Spatial identity | Approach and arrival | Cultural window |
|---|---|---|---|
| Opening | Thick annular iris, layered leaves, near construction edges | Approach the aperture; typography leaves before the first reading position | A glimpse into the World room |
| World | Tall observatory, city window, meridians and geographic markers | A lateral reveal into a larger volume | Miami photograph and existing Miami motion study |
| Time Machine | Successive deep frames, paper layers, archive shelves | Parallax through offset layers; settle on the primary image | Contemporary New York photograph and illustrated cultural study |
| Cinema | Dark proscenium, stepped floor, restrained screen spill | Reveal the scale of the screen around a foreground edge | Authentic official Sintel trailer, with complete-film playback |
| Music | Three suspended dimensional acoustic ribbons | Follow a gentle bend into an open performance composition | Puerto Rico photograph and existing Island Current study |
| Culture | Warmer plaster, cloth, paper and a shared table | Closer material detail and a lower, intimate arrival | Miami photograph and existing Concrete & Colour study |
| My World | Quiet shelves, collecting surfaces and remembered materials | A comfortable final hold | Actual saved-story selection, or clearly identified editorial starting point |

## Shared ownership

- `SpatialHome.tsx` retains native scrolling and the scoped GSAP ScrollTrigger. There is no second scrolling engine or scroll lock.
- `passageJourney.ts` derives deterministic camera position and look target from that same chapter/progress pair. Progress 0.38–0.74 is an exact reading plateau. The final chapter remains settled through its endpoint.
- Departures bend around the left of each primary image. Forward, reverse and direct jumps calculate the same pose without accumulated animation state.
- `tunnelScene.ts` renders WebGL and the one semantic CSS3D interface with the same camera. Chapter transforms, exhibit inspection and camera movement have separate owners.
- `passageArchitecture.ts` owns reusable geometry/materials and distinct local room compositions. Neighbor visibility follows chapter indices, not camera Z.
- `passageMedia.ts` is the verified manifest and a reference-counted media controller. Desktop VideoTexture and compact DOM borrow the same HTMLVideoElement; only the selected preview decodes.
- `visualFrame.ts` dispatches the Passage and flight crew from one browser animation-frame queue. Compact Passage decoration stops continuous rendering; the existing crew viewer remains available from the entrance.

## Media truth and remaining content dependency

The available library contains five original abstract motion studies, not recorded streets, artists or performances. They remain labelled as studies. The real destination photographs are not represented as frames from those studies. Cinema uses the authentic local Sintel trailer at 22–31 seconds and opens the existing complete-film player.

Approved real city, performance, artist and making footage is still needed to satisfy the brief's documentary-media ambition in the other rooms. The chapter manifest and correctly contained surfaces can accept that footage without rebuilding the environments or camera path. No unsupported historical dates, provenance, people or recorded performances were invented.

## Runtime and fallback

The active preview pauses for the full player, hidden document, route departure and reduced motion. Blocked/failed media retains an actual poster and working story action. Poster and video aspect ratios are contained; colours remain untonemapped and unfogged. Range-capable hosts retain direct playback; hosts without byte ranges use the existing 16 MiB-bounded local preview loader so loop-point seeking works. Chapter changes abort obsolete preparation and release its object URL after detaching the decoder.

The renderer has bounded adaptive resolution, shared geometry/materials, instanced repeated structure, adjacent-room culling, no dynamic shadows or post-processing, and no React state changes per animation frame. Event listeners, frames, media, video textures and GPU resources have scoped teardown.

Compact mode uses the same content and manifest with six authored material treatments. Breakpoint and orientation changes preserve the chapter and reading position. Reduced motion uses posters by default. Initial WebGL failure and context loss retain readable content, native scrolling and playback actions.

## Verification

- 161 unit/service tests, including 15 new Passage camera and media lifecycle checks.
- 44 combined Passage browser checks: all chapters, exact CSS3D holds, fast/reverse scroll, inspection/reset/Escape/focus, player priority, route return, actual saved collections, compact/landscape, reduced motion, WebGL failure/context loss and blocked media.
- No camera centerline collisions across 3,500 sampled path segments, including the opening iris and the moving rear thresholds.
- Separate compact review covered touch, both presentation-mode transitions, orientation, source captions and reachable controls.
- Existing navigation/history suite: 11 checks. Existing World interaction suite: 17 checks.
- Opening and six desktop reading captures: `output/passage-review/`. Compact review: `output/playwright/passage-compact-review/`.

Observed desktop median render intervals were approximately 16.5–16.7 ms in the test environment; this is not a guarantee for every device. The browser automation environment reported both tabs visible even in a headed session, so actual hidden-tab observation was unavailable. Hidden-document media pause/resume is covered by deterministic lifecycle tests and the production visibility listener.

The pre-redesign source is preserved at local Git branch `backup/passage-before-architectural-20261028` (commit `93486a0`).
