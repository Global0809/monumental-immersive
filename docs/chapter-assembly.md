# Passage: articulated carriers and portal score

The six existing chapter carriers now unfold as physical assemblies. The design keeps Monumental's chrome, charcoal, ivory and signal red, the native-scroll camera, catalogue, preview actions and inspection controls. The prior release is retained at `backup/assembly-before-20261030`.

## Mechanical sequence

`src/services/passageAssembly.ts` reconstructs every stage from the same actual scroll coordinates used by the camera. Locks release, telescoping rails extend, the chassis articulates, six double-jointed armor doors fold away, the recessed screen advances and the corner clamps register. Reverse scrolling reconstructs those movements; a jump resolves directly to the correct pose. No timed sequence continues after scrolling stops.

`src/components/spatial/chapterAssembly.ts` makes the construction visible: beveled plates, recessed inserts, vent tracks, hinge knuckles, driven struts, cables, guide rails, fasteners and locking jaws. Parts share material/geometry batches. The six carriers share geometry and materials; distant carriers are culled, unchanged poses skip matrix uploads, and disposal releases the batches and shared geometry.

`passageArchitecture.ts` attaches those mechanics to the existing carrier transform and uses the shared screen stage. Inspection still owns a separate exhibit transform. `tunnelScene.ts` keeps WebGL and CSS3D on the same camera and carrier coordinates. The old twelve-strand text mask is no longer applied: plates clear the aperture before whole words appear. Completed chapters retain the existing stable reading interval and original text/media coordinates.

### Clearance correction

The compressed shutter dimensions now follow their available aperture instead of overlapping neighboring columns and opposing rows. Offset return hinges give the folded backs physical separation. The cassette retracts parallel to its rails and packs inside the stowed chassis; it emerges continuously rather than switching visibility halfway through opening. Right-mounted exhibits sit inboard of the support motor.

`passageEnvelope.ts` defines widened service bays shared by the lining, ribs, moving vanes, light rails, X-ray interiors and inspection ray. A measured solid mounting surface behind the accessible DOM removes the floating-strip appearance and resolves with the same content opacity. No blanket depth-test override, artificial frontmost render order or additional animation loop is used.

The clearance review is recorded in `output/playwright/mechanism-clearance/`: baseline, final six-chapter review and finer approach samples. The final browser run passed 55 checks plus eight approach samples without runtime or shader errors. Actual instanced shutter bounds are tested throughout opening and closing for all six chapters. Compact/reduced motion, reverse scrolling, jumps, Inspect/reset/Escape and player return were checked. These results describe the reviewed Chromium viewports, not every possible device.

## Whole-portal sound

The sound vocabulary follows physical actions throughout the Passage: aperture drives, pressure crossings, travel, assembly release/articulation/clamping, optical inspection, relay movement, signals and arrivals. The continuous travel field responds to real movement, independently of optional room ambience. It releases when movement stops. Chapter atmospheres remain optional.

The three assembly cues are original offline stereo synthesis: `assembly-release`, `assembly-drive` and `assembly-lock`. `assemblyScore.ts` emits them at shared mechanical-stage crossings, with reverse-folding responses, hysteresis and a minimum spacing. Fast scrolling coalesces stages rather than queuing every skipped actuation. A final physical clamp suppresses a redundant arrival accent.

The portal extension adds `iris-open`, `iris-close`, `threshold-pass` and one looped `portal-travel` field. These are original authored synthesis, not film sound effects or recordings of real machinery. `scripts/sonic-materials.ts` preserves their editable recipes; `sonicScore.ts` is the asset manifest. Sound Studio exposes nine auditions, including Iris, Drive and Lock, with keys 1–9.

Sound remains opt-in. The existing master volume, mute, optional ambience, film/study priority, hidden-tab suspension and resource cleanup remain authoritative. ExperienceLayer gates scroll sound during inspection, reduced motion and playback. No additional React frame state, rendering loop or scroll authority is introduced.

## Verification

Evidence is recorded in `output/playwright/chapter-assembly/release-report.json`. The production build and 212 unit checks pass. The coordinated browser review covers all six reading compositions, approach and folding silhouettes, forward/reverse travel, jumps, inspection, player, route return, compact, reduced motion and WebGL fallback. Screenshots show the complete headline, copy and primary action clear of the armor. An independent finish review found no material visual issue; the scoped design detector reports no findings.

Real Web Audio checks confirm iris and crossing events, release → drive → screen drive → lock, a single motion voice with ambience off, reverse folding, one resolved lock on a fast skip, quiet reading, film priority and mute suspension. `mechanism-and-score.webm` records the WebGL mechanism with the actual post-dynamics audio in one synchronized stream; semantic DOM text is outside that diagnostic canvas capture. Measured recorded peak is -8.4 dBFS. Nine Sound Studio auditions, keyboard 9, mobile popup scrolling and its Settings link pass.

Compared with the prior published build, World reading fell from 179 to 153 draw calls and Time Machine from 185 to 159 in the same review configuration. This is a rendering-cost measurement, not a physical-device frame-rate guarantee. The all-chapter check also passes at 1174 × 809, matching the user's screenshot proportions. Test-harness assumptions about desktop fallback navigation and the lazy-loaded Studio were corrected; their focused reruns pass.

The browser captures are Chromium with phone/landscape emulation. Numerical audio measurement and captured audio verify output and timing; they do not establish subjective headphone preference or physical-device frame rate. Existing uncached direct chapter jumps can briefly show an empty media housing while its real poster loads; neighboring posters prepare ahead during normal travel. No new imagery or unsupported media claims were introduced. Final check totals are recorded in the release report.
