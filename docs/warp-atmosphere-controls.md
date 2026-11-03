# Warp atmosphere and navigation finish

The outer Passage atmosphere now breathes on an 8.6-second, depth-delayed cycle. The cloud wall and stars use the same radial displacement field, capped at 1.2 world units outward. Camera, physical gates and content remain stationary at their authored poses. Crest illumination follows the pressure wave without changing global exposure.

Fine, broken scan arcs follow the tube coordinates and existing pause-aware clock. Derivative filtering and depth fading limit distant aliasing. The effect uses the existing two draws and scalar-field texture; it adds no renderer, texture fetch, render target or postprocessing pass. Protected content remains excluded. Reduced motion holds a static atmosphere and hidden tabs stop the existing rendering loop.

The cursor uses an exact pointer center, two fine orbit segments and three diminishing trail marks. Trail distances are capped at 12/24/36 pixels and disappear within 245ms after motion stops. Press scale is isolated from pointer position. Native controls, dialogs, video and the scrollbar suppress the decoration; touch, reduced motion and forced colors retain the native cursor. Idle cursor rendering stops.

The desktop scroll rail uses native document scroll position. It supports track clicks, dragging, arrow keys, Page Up/Down, Home/End and Space. Its calibrated rail and percentage readout are presentation of that position, not a second scroll system. Document-size changes refresh its measurements. Mobile, short viewports, forced colors and blocked document scrolling retain the native scrollbar. The rail yields during film playback and modal interaction.

Source scope: `passageWormhole.ts`, `Cursor.tsx`, `cursor.css`, `ScrollRail.tsx`, `scroll-rail.css`, and the shared App mount. No route content, catalogue records, camera path or X-ray functionality is added.

Validation: production TypeScript/Vite build and all 258 existing unit tests pass. Browser captures and GPU/input assertions are recorded in `output/playwright/warp-polish/` with the focused continuation reports from `tests/browser/warp-polish.mjs`.
