# Scroll erosion

Monumental uses one shared, scroll-controlled SVG surface to reveal black, warm off-white, paper and signal-red chapters. The system preserves native scrolling and the existing React content, media players and Three.js scenes.

## Files and responsibilities

- `src/components/ScrollErosion.tsx` owns route measurements, active chapter selection, palette paint, foreground coordination and cleanup.
- `src/components/scroll-erosion.css` connects existing opaque section surfaces to the shared field, paints editorial text, and preserves protected interface islands.
- `src/services/erosionContour.ts` samples a seeded two-dimensional material and traces its changing contour. It caches at most four bounded fields.
- `src/services/erosionChapters.ts` maps existing route sections to palette changes and declares protected surfaces.
- `src/App.tsx` mounts the controller once alongside the existing shared visual layers.
- `tests/erosion-contour.test.ts` checks geometry, reversibility, exact endpoints and bounded complexity.
- `src/services/frameCadence.ts` shares the phase-preserving 60 Hz budget with the background, sculpture, atlas, personal monument, city scene and sound visualizer.

## One field for surfaces and text

The fixed SVG sits behind the page content and cannot receive pointer events. Existing participating section backgrounds become transparent while the enhancement is available. Videos, photographs, chrome scenes and controls remain ordinary DOM or WebGL content above it.

The contour is reused as SVG background paint clipped to actual editorial glyphs. This allows one line of text to have two coordinated foreground colors while the frontier crosses it. There is no second React application, text-content clone, screenshot texture or color filter over footage. An IntersectionObserver limits geometry reads to visible text. Conservative material-tile bounds identify the few lines actually touching the frontier; only those receive a locally sized raster image. Other text uses solid colors, including during a transition. Full-viewport SVG data URLs are no longer regenerated and inherited throughout the document every scroll frame.

The geometry combines a broad asymmetric progression field with domain-warped two-dimensional lobes, tears and elongated fine fibers. Scrolling changes a threshold through that fixed material. Marching squares traces connected regions, including actual overhangs, cavities and narrow necks; they are not manually placed circular holes beside a wave. Quadratic paths remove sampling corners while preserving fine torn details. A pixel that is revealed remains revealed as progress increases. Reversing to the same progress recovers the same material state, and elapsed time never reshapes it.

Both macro geometry and fine detail are two-dimensional, so the larger silhouette also changes as pockets join and necks erode. Cached noise lattices, incremental material rows, conservative tile bounds and a pooled tracing graph bound allocation and processing. Rows outside the active frontier skip full contour processing. Nearby materials may be prepared during a bounded browser idle window, one field per callback. At progress zero the incoming mask is empty; at progress one it is a solid viewport rectangle. SVG supplies the crisp antialiased edge. `edgeSoftness` is retained as bounded renderer metadata; this SVG implementation does not blur the boundary.

Text alignment continues briefly while the existing entrance, hover and scroll animations settle. During this bounded alignment pass, contour geometry and encoded paint remain cached at the actual scroll position. Mask coordinates compensate for axis-aligned text scaling, and background-position transitions are disabled so color cannot lag behind the letters. Icons and rules sample the same two-dimensional material, including its cavities.

Whole-title inline links inherit their heading's paint, preserving ordinary link wrapping. A wrapped inline emphasis span uses a cached SVG strip: each native line fragment samples the same viewport field at its own rectangle. Its existing ink, muted or accent role stays intact. Typography completion events request one final alignment pass after the existing kinetic text settles. No text or interactive DOM is cloned.

## Configure an existing chapter

Add or adjust an entry returned by `erosionChapters(path)`. Its selector identifies existing content rather than a spacer or pinned scene.

```ts
chapter('.story-context', 'warm', 'story-context', {
  start: 0.88,
  end: -0.1,
  macroAmplitude: 0.15,
  detailAmount: 1,
})
```

`start` and `end` describe the section top's position in viewport heights. The example develops over approximately 98% of a viewport's scroll distance. Available parameters also include `fromTheme`, `toTheme`, `seed`, `direction`, `edgeSoftness` and `enabled`. Omitted `fromTheme` follows the preceding accepted chapter. Theme names are `black`, `charcoal`, `paper`, `warm` and `red`.

Measurements sort anchors in document order, separate neighboring transitions, and skip transitions with less than 55% of a viewport's usable scroll distance. This keeps short pages short. Dynamic Journey results, filtered collections and optional sections participate when their real layout supports them. Existing Motion sections provide a later chapter on other routes. Footer transitions may be omitted when insufficient scroll distance remains.

## Protect a surface

Use `data-erosion-protect` on a component that must keep its original material and interface palette. The controller treats the whole subtree as one protected island. Existing exclusions cover media, globe and sculpture interfaces, forms, playback controls, comparisons and interactive editing surfaces.

Protection does not inherently create an opaque background. A previously transparent component with light text must receive an intentional dark surface in the protection CSS, or remain part of the coordinated foreground treatment. Keep authored photographs, gradients and existing opaque card surfaces intact. Do not apply blanket inversion or color filters.

## Lifecycle and accessibility

The controller reads actual `scrollY`, including hash-router restoration. Anchor positions use layout offsets so the existing route entrance's temporary transforms do not pollute measurements. Resize observation, child-content changes, image loads, settled fonts, page-transition completion and portal completion request a bounded refresh. Per-frame React state updates are not used.

GSAP setup is scoped to this controller. Route changes and motion-setting changes disconnect its observers, remove its listeners and markers, cancel its queued frames, and revert only its own context. Hidden tabs and active film playback suppress ongoing draw work. Returning to the page or closing a film refreshes the current layout and scroll state.

Both the site's motion preference and the device preference feed the existing `reducedMotion` prop. Reduced motion replaces the eroded contour with a simple section boundary. Unsupported text clipping leaves the original authored presentation available. Forced-color mode removes the decorative field and restores system text colors. Normal text selection, focus, links, media and keyboard navigation remain semantic DOM behavior.

## Verification

Automated geometry checks cover stable seeds after reversal, different seed output, clean endpoints, asymmetric broad variation, monotonic material occupancy, mirrored direction, actual reentrant contours, bounded mobile and desktop path complexity, finite malformed inputs, and zero-detail behavior.

Geometry tests do not establish visual fidelity, actual browser compositing or device performance. Release verification should inspect 0%, 25%, 50%, 75% and 100% progress; slow and fast scrolling; repeated reversals; restored route positions; dynamic content; mobile layouts; reduced motion; and the unchanged film/globe/sculpture controls. Full-width protected photography can conceal part of a frontier, so inspect the visible transition into Home's portal section directly. Browser evidence and reference-comparison results belong to the release check rather than being inferred from these unit tests.

### Release check — 24 October 2026

- Reviewed the supplied recording's 5–16 second sequence and compared its broad asymmetric silhouette, sharp tears and two solid treatments with the Home transition.
- Captured Home at 0%, 25%, 50%, 75% and 100%. Returning to the midpoint produced the identical SVG path. Native back navigation restored both scroll position and contour exactly.
- Inspected Home plus 19 other routes, including all eight categories. Each had one shared field, usable real-content transition ranges, no horizontal overflow and no media pixels assigned editorial text paint.
- Checked a 390px mobile viewport and reduced-motion emulation. Portrait contour height is bounded by both viewport width and height. Reduced motion produced a straight sectional boundary.
- Search destination filtering refreshed the ranges; generating and reordering an itinerary worked; globe destination selection and zoom worked; the film player opened and its video had no color filter. No browser console errors were captured in this pass.
- All 39 automated tests passed, including six contour tests. Evidence is saved locally under `.impeccable/review/erosion/` (not part of the published site).

These checks used the Chromium in-app browser and emulated mobile dimensions; physical iOS/Android device performance has not been measured.

### Fluid contour refinement — 24 October 2026

- Replaced the translated height profile with a fixed two-dimensional material field, tuned against `Screen Recording 2026-10-23 202648.mp4`.
- Rechecked Home at five progress positions, exact path recovery after reversal, and stationary contour stability. Rechecked all 20 routes for field ownership, horizontal overflow and media protection.
- Inspected wrapped destination titles, animated title alignment, the selected collection filter, and mobile multiline emphasis. Verified the 390px World midpoint and reduced-motion fallback.
- Evidence for this refinement is saved under `.impeccable/review/erosion-fluid/`. The seven contour tests include reentrant geometry and monotonic reveal checks.
- All 40 automated tests passed. The production typecheck/build passed, and the final browser check captured no console errors.

### Fluidity and frame budget refinement — 24 October 2026

- The broad outline now comes from a two-dimensional macro field, with softer pockets, small tears and narrow channels. It does not translate one fixed height profile upward.
- Detailed text masking is limited to the frontier. The checked Home midpoint needed three local paint targets out of 56 marked text nodes; offscreen paint is released.
- Particle counts are exactly halved: desktop 280 to 140, touch 96 to 48. Connection budgets are halved; code ribbons are approximately halved with whole-column rounding. A reusable glyph atlas avoids repeated font rasterization.
- Removed the old 20/40 Hz background cadence and 30 Hz sound waveform cadence. Shared 60 Hz scheduling retains fractional phase on 120/144 Hz screens, without the old 144-to-48 fps skip pattern. Scenes still use elapsed time and retain visibility/playback/reduced-motion pauses.
- Contour-only Node measurements at 1440 by 900 improved from 2.65 ms median / 4.65 ms p95 to 1.29 / 1.92 ms. These are CPU geometry timings, not end-to-end browser frame rates. First cold midpoint setup/JIT remains around 36 ms; ordinary subsequent chapter entry preparation measured 1.6–3.9 ms.
- All 45 automated tests passed, including nine contour checks and three display-cadence tests. Browser checks use desktop and mobile emulation; a 60 Hz budget does not guarantee 60 rendered frames per second on every GPU, browser or device.
