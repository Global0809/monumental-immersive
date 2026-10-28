# Monumental — continuous mechanical Passage

The homepage is one continuous spiral tunnel with six side-mounted mechanical carriers. Native document scroll moves the visitor through World, Time Machine, Cinema, Music, Culture and My World in that order. The implementation follows the layout and interaction direction of the user's own [reference tunnel](https://globalgupta13-crypto.github.io/monumental-streams/#vision), while retaining Monumental's palette, Barlow Condensed/DM Sans typography, chapter copy, catalogue, routes and truthful media labels.

The separate architectural rooms from the previous iteration have been replaced. Observatory, archive, cinema, resonance, atelier and collection remain chapter metadata and local material cues; they do not designate separate rooms. The surface brief is [Passage](../.impeccable/surfaces/passage.md); shared visual tokens remain in [DESIGN.md](../DESIGN.md).

## Spatial composition

The entrance places the existing three-line statement and entry action at left, the tunnel's layered mouth around a central vanishing point, and the existing Flight crew toward the right. A continuous lining of spiral ribs, dark wall faces, signal conduits, interrupted rings and restrained light ribbons carries the viewer through the full journey. These are world geometry, not a fixed backdrop behind scrolling cards.

Each station alternates between the left and right wall. Articulated arms bring a layered carrier into a common text-and-film reading composition. Twelve physical leaves fold open while the single semantic text surface uses a matching twelve-strand reveal mask. The carrier then retracts before the camera crosses its plane. Reverse scrolling reconstructs the same camera, carrier and reveal state.

| Chapter | Carrier content | Existing destination | Media and provenance |
| --- | --- | --- | --- |
| World | Geographic instrument and city window | `/world` | Miami destination photograph and Miami, in Frequency motion study |
| Time Machine | Layered archive rings | `/time-machine` | Contemporary Manhattan photograph and an illustrated study of the 1970s |
| Cinema | Larger film window and reel instrument | `/category/movies` | Official Sintel trailer; the story action opens the complete film |
| Music | Record instrument and rhythmic light | `/category/music` | Old San Juan photograph and Island Current illustrated study |
| Culture | Ceramic object and material edges | `/category/culture` | Miami gateway photograph and an illustrated Miami Beach Art Deco study |
| My World | Personal monument and up to three saved posters | `/my-world` | Actual saved-story selection, or an explicitly labelled editorial starting point |

The same station includes its direct destination link, Inspect action, available-story playback action, source note and wayfinder access. Inspection changes the small exhibit and its surrounding mechanisms; it does not move the text or primary media aperture. Rotation uses 30-degree steps within plus or minus 180 degrees, with Reset and Escape to close. Compact inspection opens the real story synopsis.

## One scroll coordinate system

`tunnelJourney.ts` supplies station Z as `-36 - index * 42`. The desktop entrance occupies 160svh (1.6 viewport heights), and each chapter occupies 285svh (2.85 viewport heights). A chapter approaches from station Z + 28, reaches station Z + 11.5 at 38% progress, holds that exact position through 74%, and then departs toward the next station. The final station remains settled through its endpoint. Smoothstep approach and departure have zero endpoint velocity.

`passageJourney.ts` computes the camera and carrier transforms directly from that shared chapter/progress pair. The camera uses a 59-degree field of view, a subtle position-derived lateral curve, and no accumulated travel state. Its actual position and look target are constant throughout the reading interval. Forward, reverse and direct station jumps therefore resolve to the same pose.

Carriers begin approaching within 28 world units, reach their extended position before the reading distance, and retract across the 11.2-to-8-unit clearance interval. At the reading position their alternating side yaw is plus or minus 0.07 radians. They are visually culled outside their local distance range. Camera motion, physical mechanisms and CSS3D content all use these same transforms.

A 470px semantic text mount at world scale 0.012 sits left of a contained media plane. The normal media width is 7.8 world units; Cinema uses 8.6. WebGL and CSS3D render with the same perspective camera, with near/far planes 0.16/165. React mounts each chapter once, and the renderer moves that actual mount between CSS3D and its original fallback slot.

## Ownership and input

- `SpatialHome.tsx` owns semantic chapter content, native scrolling, the scoped GSAP ScrollTrigger, checkpoint measurement, station jumps and existing player callbacks. There is no second scrolling engine or scroll lock.
- `tunnelJourney.ts` owns shared station coordinates, compact classification, frame/panel subscriptions and the single inspection state.
- `passageChapters.ts` owns chapter copy, destinations and local content placement. `passageJourney.ts` owns deterministic camera, carrier and weave-reveal functions.
- `passageArchitecture.ts` owns the continuous tunnel, articulated carriers, inspectable objects, material/light responses, contained image surfaces and saved-poster mounts.
- `tunnelScene.ts` owns the shared WebGL/CSS3D camera, panel attachment/restoration, texture binding, projected media bounds, route travel and resource cleanup.
- `tunnelAtmosphere.ts` owns one world-anchored GPU point cloud. Pointer movement, holds and release pulses affect this air and local mechanisms; they never move the reading camera or controls.
- `passageProtection.ts` publishes the projected media-plane rectangle. `flightScene.ts` consumes it to cut that region out of the decorative Flight layer, alongside its existing DOM-content protection.
- `passageMedia.ts` owns the verified manifest and reference-counted preview controller. Desktop VideoTexture and compact DOM borrow one HTMLVideoElement; only the selected preview decodes.
- `visualFrame.ts` schedules Passage and Flight rendering through one browser animation-frame queue. Each renderer retains its own scene and camera.

Pointer response is excluded from controls and paused during inspection. Station jumps close inspection, wait for pending layout measurement, then use native scrolling. The CSS3D viewport uses `overflow: clip`, avoiding a focus-induced scroll offset between HTML and WebGL. Off-position panels are inert, hidden from the accessibility tree, and unavailable until their reveal is complete. The player retains priority and focus restoration.

## Compact, reduced motion and unavailable WebGL

Compact layout applies when width is below 980px, height is below 660px, aspect ratio is below 1.4, or reduced motion is enabled. The same semantic chapters and media return to normal document flow. The continuous tunnel stays behind them when WebGL is available, while the 3D carriers, arms and their contact light are hidden. The GPU atmosphere and continuous Passage rendering are disabled in compact mode; scroll and layout events still update the scene.

Compact chapters retain their local image-edge treatments, contained media, source captions, destination links and playback actions. Phone navigation uses a station selector plus previous/next controls. Short landscape layouts place media beside content. Presentation-mode and orientation changes preserve the current chapter, progress and focus. Reduced motion uses posters by default, suppresses decorative movement and transitions, and makes station jumps immediate.

Initial WebGL failure or context loss restores readable document content, native scrolling and playback actions. Context loss also clears projected media protection and completes pending navigation. The optional Flight enhancement has its own failure boundary.

## Media truth and hosting

The library still contains five authored abstract or illustrated motion studies, not recorded streets, artists or performances. Destination photographs are introductions to places and are explicitly distinguished from study frames and archival evidence. Cinema uses the authentic local Sintel trailer at 22–31 seconds and opens the existing complete-film player. My World shows actual saved-story state without representing the fixed ambient editorial study as a saved film.

Approved city, artist, performance and making footage is still needed for the documentary-media ambition in the other chapters. No media assets were changed or new rasters introduced by this redesign; existing credits and asset provenance remain applicable.

The active preview pauses for the full player, hidden document, route departure and reduced motion. Blocked or failed media retains a real poster and working story action. Images and video preserve aspect ratio; their surfaces are untonemapped and unfogged.

The existing public-host playback safeguard remains essential: hosts advertising byte ranges retain direct playback; small root-relative previews on hosts without byte ranges use a seekable object URL with a 16 MiB download cap. Remote full films remain streamed. Obsolete preparation is aborted on chapter changes, and object URLs are released after detaching the decoder. A preview becomes ready only after decoding at its actual loop start.

## Runtime and teardown

Repeated structure uses shared geometry/materials and instancing. Posters load for the current and adjacent chapters; saved posters load near the final chapter. The scene uses distance visibility, bounded adaptive pixel ratio, a 60Hz cadence budget, and no dynamic shadows or fullscreen post-processing. Desktop pixel ratio is capped at 1.4, compact and light quality at 1, with an adaptive floor of 0.8.

There are no React state changes per rendered animation frame. Passage rendering pauses during player/dialog suspension and hidden-document periods, and continuous rendering stops on other routes. Cleanup cancels queued frames and travel, removes listeners and observers, releases subscriptions and the media lease, restores panel mounts, and disposes textures, geometry, materials, environment and renderer.

## Living tunnel extension

The existing Passage also carries a six-leaf kinetic relay at the entrance, five smaller relays between stations, hinged wall vanes and light trains on helical rails. The entrance relay opens through the keyboard-accessible Unfold/Fold control or a raycast click on its physical geometry. Send a signal launches one retriggerable pulse through the wall mechanisms and existing particle field at 36 world units per second. The extension shares the current camera, renderer and frame scheduler; station reading holds, semantic panels, media and catalogue behavior remain governed by the architecture above.

`tunnelRelays.ts` owns the relay geometry and local articulation, `tunnelSignals.ts` owns the instanced wall mechanisms, and `tunnelLife.ts` owns event-driven controls and the bounded pulse envelope. Travel relays disappear around reading holds, wall activity calms near the active station, and inspection freezes the additional animation. Compact and reduced-motion modes omit the added mechanisms and their controls. Implementation, verification evidence and the extension's separate review status are recorded in [Living tunnel](tunnel-life.md); the verification record below describes the preceding continuous-tunnel foundation.

## Verification record and limits

The production build and all 164 unit/service tests pass after the two finish-review fixes. The final production-bundle browser pass recorded 57 passing Passage checks and 29 passing Flight regression checks, with no uncaught exceptions. Coverage includes all chapters, exact CSS3D reading holds, fast/reverse travel, inspection/reset/Escape/focus, player priority, route return, saved collections, compact/landscape transitions, reduced motion, WebGL fallback/context loss, blocked media and projected media protection. A separate geometry clearance run recorded 9,160 camera rays with zero intersections.

The finish reviewer requested projected media protection from the Flight layer and suppression of carriers behind compact content. Both are implemented and confirmed in the final recapture. The final verdict is **SHIP**: both requested fixes are resolved, and the initial full review identified no additional material findings. This is a review of the tested implementation, not a guarantee for every browser or device.

Evidence is retained in `output/playwright/reference-tunnel-review/results.json`, `clearance.json` and the adjacent opening, station, approach/departure and compact captures. The browser environment reported both tabs visible, so genuine hidden-tab observation was unavailable; deterministic media lifecycle tests cover that branch. Observed render intervals are environment measurements, not a device-independent frame-rate guarantee. This documentation pass inspected source and supplied verification evidence; it did not independently rerun the build or browser suite.

The immediately preceding architectural-room version is preserved at local branch `backup/passage-architectural-before-reference-20261028`, commit `9b3ca949620ce526f7c42f14e36be72a1da1aa82`.
