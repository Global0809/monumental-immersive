# Passage media verification — 28 October 2026

The manifest in `src/services/passageMedia.ts` is the single association between the six Passage chapters, ambient sources, posters and existing catalogue/player destinations. All sources were checked with FFprobe and contact sheets before selection. Browser decoding, time advancement and dimensions were then confirmed in Chrome.

| Chapter | Ambient source | Native dimensions / FPS | Measured duration | Ambient range | Player destination |
|---|---|---|---|---|---|
| World | `miami-frequency.mp4` | 960 × 540 / 24 | 32.128 s | 6–20 s | `miami-frequency` |
| Time Machine | `break-beat-city.mp4` | 960 × 540 / 24 | 29.293 s | 5–20 s | `break-beat-city` |
| Cinema | `sintel.mp4`, official trailer | 854 × 480 / 24 | 52.208 s | 22–31 s | `sintel-full` |
| Music | `island-current.mp4` | 960 × 540 / 24 | 33.213 s | 6–22 s | `island-current` |
| Culture | `concrete-and-colour.mp4` | 960 × 540 / 24 | 31.953 s | 6–22 s | `concrete-and-colour` |
| My World | `tokyo-in-motion.mp4` | 960 × 540 / 24 | 32.853 s | 6–22 s | `tokyo-in-motion` |

The five contemporary studies are abstract procedural animations, not footage of people, streets, cultural performances or historical events. Their labels and metadata retain this distinction. The complete Sintel film remains the Cinema playback action; only its local official trailer is decoded in the ambient scene. Its original cinematic letterboxing and attribution are preserved.

Destination photographs are independently credited gateway imagery. They must not be presented as frames from the motion studies, historical evidence, or photographs of artists. In particular, the New York photo shows contemporary Manhattan, not the Bronx; the Tokyo photo shows Shinjuku while its study discusses Harajuku; the Culture study concerns Miami Beach, a separate municipality from Miami. `posterCaption` records these distinctions. `sourcePoster` retains the catalogue poster where a room uses a destination photograph instead.

The 18 supplied motion concept previews are concept animations. The initially supplied October 19 WhatsApp video is a UI treatment. The October 16 WhatsApp video is a different Legacy Weekend event pitch and is excluded from Monumental's ambient collection. None supplies approved standalone city, craft or performance footage for the remaining five chapters. Future approved footage can replace a manifest source without rebuilding the camera, geometry or DOM presentations.

## Playback lifecycle

`acquirePassageMedia()` leases one shared HTML video element. The scene can create a VideoTexture from it, while compact mode can attach that same element to one active media host. The final lease release unloads the source and removes listeners. Independent suspension reasons compose, so closing a full player does not override reduced motion or a paused route. The service also observes document visibility and the existing `monumental:playback` event.

Only the active source is requested; reduced motion and other suspension reasons prevent a new source request. A source switch increments `sourceEpoch`, clears decoded readiness and seeks to the verified loop start before reporting a frame ready. Rejected play promises from replaced sources cannot mark a newer source as failed. A failed or blocked source retains its poster until an explicit retry. No animation frame loop or React frame updates are introduced by the media service.

The controller reuses `prepareSeekableMedia` for host compatibility. Range-capable hosts stream the original local URL; hosts without byte ranges receive a finite Blob capped at 16 MiB. All six verified sources are 0.46–4.37 MB. Preparation is lazy, cancelled on chapter replacement, protected against stale completions and released only after detaching the old decoder. A full player or other suspension beginning during preparation prevents decoding when the download completes. This fixes the production host's observable `seekable=[0,0]` behavior despite a fully buffered MP4: the same source as a Blob correctly exposes the complete seekable interval. A forced non-range Chrome check confirmed all six chapter sources seek and advance with one active decoder.

The scene should recreate/dispose its VideoTexture when the source epoch changes, keep poster material visible while `ready` is false, and retain original aspect ratios. Ambient video is always muted; full playback uses the existing player and its sound controls.

## Verification

Eight Node lifecycle checks cover manifest validity, independent suspension, reduced-motion loading, source races, hidden-tab/full-player pause, bounded loops, decode failure and retry, DOM reparenting, asynchronous seekable-source ownership and teardown. A real Chrome decode pass confirmed all six ranges advance, native dimensions match, exactly one video element exists, full-player activation pauses it, a blocked source keeps the correct poster, and final release removes the element.

Seven journey tests additionally check chapter/catalogue consistency, camera and look-target continuity, exact stable reading intervals, deterministic reversing, invalid-input handling, departure clearance around every media plane and clean single-chapter content visibility.

`node tests/browser/verify-passage-architecture.mjs` runs the coordinated browser review against `SITE_URL` (default `http://127.0.0.1:5184/`). The final local run passed 44 checks with no uncaught page errors. It covered the opening and all six stations, stable DOM/CSS3D composition, rapid reversing, Inspect rotation/reset/Escape/focus, player priority and resumption, route return and resource counts, real saved-film selection and cross-tab collection changes, phone touch scrolling, short landscape header clearance, reduced motion, unavailable/lost WebGL and a blocked media request. Opening and six reading-position images, a populated collection, compact images and measured results are saved under `output/passage-review/`.

Measured desktop frame intervals on this machine had medians of 16.6–16.7 ms and 95th percentiles of 16.9–18.2 ms across the six reading positions. Passage draw-call maxima ranged from 35 to 120. These are local browser observations, not a 60 fps guarantee on every device. A separate geometry raycast sampled 3,500 movement segments through the entrance and chapter paths after rear shutters were added; it found no camera centerline intersections with opaque architectural meshes.

Both headless and headed automation kept both browser tabs reported as visible, so genuine OS-hidden-tab behavior could not be observed in that environment. The media unit tests exercise visibility-event pause/resume, and full-player browser tests verify actual decoder and render suspension. Hidden-tab automation is explicitly recorded as a limitation rather than a passing browser check.
