# Tunnel journey handoff

The current homepage contract is documented in [Continuous mechanical Passage](passage-architecture.md), with the visual system in [DESIGN.md](../DESIGN.md) and the direction contract in [the Passage surface brief](../.impeccable/surfaces/passage.md). Those documents supersede the earlier tunnel and six-room architecture descriptions.

## Current implementation — 28 October 2026

One continuous spiral tunnel carries six alternating wall-mounted displays. Native document scroll is the only journey authority. Camera, physical carrier, twelve-leaf reveal and the single semantic CSS3D mount share a deterministic pose, including an exact 38–74% reading hold. The existing World, Time Machine, Cinema, Music, Culture and My World destinations, catalogue content and available-player actions remain connected.

The station spacing is 42 world units, starting at Z = -36. Entrance and chapter tracks are 160svh and 285svh, with a 59-degree camera field of view. Compact layout applies below 980px width, below 660px height, below 1.4 aspect ratio, or with reduced motion. It retains the tunnel behind ordinary document content and hides the mechanical carriers. These values replace the earlier 135svh/225svh tracks, 34-unit spacing and 46/57-degree camera setup.

The media manifest, one-decoder lifecycle, truthful study captions, contained images, complete-film player and bounded seekable-preview fallback are preserved. The new projected media bounds protect the film plane from the decorative Flight layer. No new raster assets were introduced.

Implementation ownership, responsive behavior, teardown, verification evidence and its limits are recorded in the current architecture document. The final checkpoint records a passing production build, 164 unit/service tests, 57 Passage browser checks, 29 Flight regression checks, no uncaught exceptions and 9,160 clear camera rays. The finish reviewer confirmed both requested fixes and returned **SHIP**; hidden-tab observation and hardware frame-rate limits remain explicit.

## Historical checkpoints

- The original native-scroll tunnel and the 26 October enhancement used station objects, gates, shared CSS3D panels and a single inspection owner. Their build/test reports and earlier finish verdict apply to those versions only.
- The original backup is `backup/pre-tunnel-2026-10-26`. The enhancement backup is `backup/pre-tunnel-enhancement-2026-10-26`, preserving commit `7f25022b7f93d4808c089ad5fc4989506181341a`.
- The next iteration introduced six distinct architectural rooms. Its prior baseline remains `backup/passage-before-architectural-20261028` at `93486a0`.
- The complete architectural-room version immediately before the current reference-directed replacement is `backup/passage-architectural-before-reference-20261028` at `9b3ca949620ce526f7c42f14e36be72a1da1aa82`.

These historical backups explain the evolution and enable recovery. Their geometry, media timing, performance observations and QA counts are not the current implementation contract.
