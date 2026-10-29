# Passage structural cutaway — 30 October 2026

This records the original structural-cutaway release. The later [X-ray stability correction](xray-stability.md) replaces the scroll-reset behaviour described below and restores shared material inspection on immersive routes.

The active Passage X-ray now reveals a finite volume of the tunnel's construction. It replaces the grainy, wobbling screen mask and bright unlit rods with a scene-lit material section. Existing composition, catalogue, typography, navigation, media and inspection controls are retained.

## Construction and ownership

- `tunnelCutaway.ts` intersects the pointer ray with the tunnel lining or the six actual entrance relay shells. The cut is positioned in world space; it does not erase every object under a flat screen circle. A narrow antialiased satin lip follows the shell surface. No noise, luminous ring, filter, extra canvas or post-processing pass is added.
- Recessed graphite housings, titanium support flanges, muted red cable runs and metal collars share the existing scene lighting and fog. Seven nearby rows are submitted in four instanced batches: 756 instances / 25,872 triangles when active. The full 90-row layout is retained only as CPU matrices; uploads and culling bounds change only when the selected row window changes. The bay root is hidden when inactive or inspecting a relay.
- `tunnelRelays.ts` gives shell leaves their own material. Cutting a leaf preserves its pistons, fins and gimbals. Existing unfold, direct pull, selection, reassembly and keyboard controls retain their state ownership.
- `tunnelScene.ts` drives the probe in the existing render loop. Opening copy/captions, chapter panels, navigation, controls and projected footage are excluded. Scrolling, pointer leave/down, inspection, route changes, hidden-tab reset and player suspension clear the probe. A new real pointer move can reopen it after travel. There is no second scroll controller or per-frame React update.
- Shader callbacks, material cache keys and alpha-to-coverage state are restored during cleanup; owned geometry, materials, instance buffers and listeners are released. Compact and reduced-motion modes keep the established readable presentation and omit the pointer cutaway.

## Verification

- Production build passes; the existing large-chunk advisory remains.
- All 186 unit tests pass, including four tests for world-space hit alignment, bounded rejection, media material exclusion, reset/re-entry, material restoration/disposal and the seven-row upload budget.
- `tests/browser/verify-xray-refinement.mjs`: 20 checks pass at desktop 1440×900, phone 390×844 and reduced motion. Includes multiple wall locations, headline and footage exclusion, relay reassembly, Inspect/Escape, keyboard player opening, return travel and reactivation. No page or shader errors recorded.
- `tests/browser/verify-selected-effects.mjs`: 19 regression checks pass, including actual shell dragging, fixed button hit targets, station travel, destination-preserving portal and compact/reduced-motion behavior.
- Scoped Impeccable detector: zero findings. Independent finish review: `disposition: ship`, no material fixes, based on before/after wall, relay, footage, player, phone and reduced-motion captures plus source review.

Local evidence: `output/playwright/xray-refinement/`, `output/playwright/xray-selected/`, `output/xray-finish-review.md`, `output/xray-detector.json`, and build/unit logs. Captures show genuine browser-rendered geometry; they are not mockups. This is a bounded Passage refinement, not a fresh audit of every route. Hardware-specific frame rate and real hidden-tab behavior are not newly certified by this pass.

## Recovery

Source backup branch: `backup/xray-before-20261030`, at `22f57d9257c6dd188483e2ba6101868f68468e0b` (the preceding Sites v48 source). No new raster assets or runtime dependencies were introduced.
