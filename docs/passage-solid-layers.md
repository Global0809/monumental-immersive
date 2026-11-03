# Solid Passage layers and X-ray removal

This release preserves the staged assembly and detailed wormhole from Sites v67 (`a1157c09609bbaa794fb9172a826fa92ffc4c917`).

## Physical layer correction

Actual iris triangles intersected eight LED wall panels and 24 structural rib segments during gate travel. `passageThresholdLayout.ts` now defines the seven shared gate planes and their complete axial service clearance. The lining and structural ribs reserve those spaces; attached conduits and halos follow the same filtered rib layout. Sixteen of 360 LED cells are omitted conservatively around the moving hardware, leaving 344 intact. Iris shape, materials, timing and neighboring blade arrangement remain unchanged.

`passage-iris-clearance.test.ts` reproduces the original intersections using real triangle/box tests, then checks the corrected geometry through forward and reverse motion at every gate. It also checks that blade, trim, bearing and pin vertices fit the reserved service slab. This corrects geometry ownership; it does not hide collisions using render order, transparency or disabled depth testing.

## Cursor X-ray retired

The Passage no longer creates a cutaway controller, service-bay interior, material discard shader, scan sound or lens modulation. Material X-ray hooks and rendering work are removed from the globe, cultural sculpture, city scene and personal monument. The site-wide canvas now runs `ambientField.ts` for ambient particles only; structural tracing and the inspection lens are deleted.

Framework controls, their styling, persisted cutaway preference and old wireframe behavior are removed. Legacy stored `cutaway: true` is ignored during validation. Unused X-ray services and dedicated obsolete tests are deleted. Normal pointer parallax, ambient reactions, drag rotation, object Inspect, film playback and accessible controls remain.

## Checks

The production TypeScript/Vite build and all 258 current unit tests pass. Browser evidence in `output/playwright/passage-layers/` checks actual submitted GPU programs for absence of cutaway uniforms, pointer sweeps, retained parallax, stable text, inspection, reverse travel, ignored legacy preferences, globe/city/personal scenes and compact layouts. Baseline captures were taken after X-ray removal but before the geometry correction, making clear that the physical overlap required a separate fix. Bright solid end caps remain legitimate parts of the original panel housings; they are not cursor cutouts.
