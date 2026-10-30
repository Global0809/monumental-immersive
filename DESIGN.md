---
name: Monumental Streams
description: A living atlas of entertainment
colors:
  signal: "#ff4d32"
  signal-hover: "#ff7d65"
  background: "#080909"
  surface: "#111212"
  text: "#efeee9"
  muted: "#a9aaa6"
  line: "#ffffff25"
  paper: "#e8e8e1"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(90px, 10.3vw, 173px)"
    fontWeight: 600
    lineHeight: 0.79
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(42px, 5.4vw, 84px)"
    fontWeight: 600
    lineHeight: 0.92
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans Variable, sans-serif"
    lineHeight: 1.65
  action:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  action: "2px"
  circular: "50%"
spacing:
  compact: "8px"
  control: "16px"
  card: "24px"
  section-desktop: "85px"
  section-mobile: "55px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.background}"
    rounded: "{rounded.action}"
    padding: "14px 22px"
    typography: "{typography.action}"
  button-primary-hover:
    backgroundColor: "{colors.signal-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.action}"
    padding: "14px 22px"
  button-light:
    backgroundColor: "{colors.text}"
    textColor: "{colors.background}"
    rounded: "{rounded.action}"
    padding: "14px 22px"
---

# Design System: Monumental Streams

## Overview

**Creative North Star: "A Living Atlas of Culture"**

The implemented world combines assertive editorial typography with physical, interactive objects. A dark stage and bright signal accent frame the content; the continuous mechanical Passage, geographic globe and overlapping era frames supply depth. Inspectable construction, precise instruments and connected story windows extend that world while preserving its reading surfaces and catalogue truth. This records the implemented design rather than prescribing a new direction.

The cinematic finish adds fine material roughness, slow architectural light breathing and restrained highlight diffusion. Peripheral lens softness is limited to Passage travel; reading holds, semantic text and active film pixels remain clear. Supporting objects use quieter optics, with native rendering for compact, reduced-motion and Light quality modes. See `docs/cinematic-rendering.md` for the shared implementation and performance boundaries.

**Key Characteristics:**
The structural reveal retains physical surface ownership while smoothing entry, exit and handoff. Scrolling keeps pointer tracking active; text, controls and media remain hard exclusions. Shared model inspection works independently of the optional 2D background and wakes paused scenes only while settling. See `docs/xray-stability.md`.

- Monumental condensed headlines with occasional outlined words.
- Thin rules, square media, deliberate negative space and visible content provenance.
- A single warm signal accent for selected state, forward action and cultural connections.
- Direct conventional controls accompany immersive interactions.

## Colors

Signal is the primary action and selection color. Background and Surface separate page regions with small tonal changes; Text and Muted carry reading hierarchy. Paper creates a contrasting discovery section. Thin translucent Line dividers organize navigation and editorial rows. The 3D objects use reflective neutral metal, subdued illumination and restrained signal-colored traces.

## Typography

Barlow Condensed gives headlines, film titles, destinations and era numerals their compact vertical scale. DM Sans carries descriptions, buttons, controls and metadata. Display text is generally uppercase; explanatory text remains sentence case. Small tracked labels are secondary information, never a replacement for a readable primary control or content caveat.

The Passage entrance headline uses three lines with an outlined middle line and a signal-colored final stop. Its local desktop scale is clamp(78px, 8.4vw, 138px), with a 0.84 line height; this surface override does not replace the shared display token. Content page titles use a separate fluid scale. On mobile the headline scales to the viewport, while longer film and destination titles wrap. Film cards pair a compact category/duration row with a larger title and quieter place line.

## Layout

The fixed header is 82px on desktop and 70px on narrow screens. The bottom navigation presents all thirteen primary destinations on desktop; below 760px it shows Home, World, Time Machine and My World, with the full ordered Index available in the header.

Desktop sections use roughly 5.2% side margins and generous vertical spacing. Home is a native-scroll journey through World, Time Machine, Cinema, Music, Culture and My World within one continuous spiral tunnel. The entrance places the existing statement and direct action at left, a layered vanishing point at center and the existing Flight crew toward the right. Alternating wall carriers settle into a consistent text-and-film composition. Browse grids become two columns; World story results become one column on narrow screens. World places the globe beside a destination panel on desktop and stacks them on mobile. Time Machine uses overlapping perspective frames with a native range input and previous/next buttons.

The Passage entrance spans 160svh and each desktop chapter 285svh. Text, film and mechanisms share one camera, with an exact reading hold from 38% through 74% of chapter progress. The 470px semantic text mount sits left of the contained media plane. The same DOM returns to ordinary document flow below 980px width, below 660px height, below a 1.4 aspect ratio, or with reduced motion. Compact retains the tunnel background when WebGL is available, hides the carriers and uses contained media with readable captions and direct controls. Orientation and presentation-mode changes preserve chapter, progress and focus.

The code has feature-specific width breakpoints at 500, 760, 800, 980, 1100, 1200 and 1700px, alongside the Passage height and aspect-ratio boundaries above. Preserve content readability instead of assuming a single global breakpoint controls every scene.

## Elevation & Depth

Most interface surfaces stay flat, separated by tone and thin rules. Depth comes from real Three.js geometry, photography, film-frame overlap and restrained transform responses. The header and bottom navigation use translucent backgrounds with blur. The globe's labels remain semantic buttons over the canvas.

Motion is purposeful: native scroll moves the Passage camera, unfolds its carriers and reveals its editorial plates; globe rotation exposes geography; choosing an era rearranges film frames and changes results. Twelve physical carrier leaves and the semantic text's twelve-strand mask open together. Scroll reversal reconstructs the same pose. Pointer response affects local mechanisms and world-anchored air without displacing readable text, media or controls. The carriers retract before the camera crosses their plane. Rendering pauses when suspended or hidden. Reduced motion suppresses automatic movement and the cursor follower. Interface sound is opt-in, persistent and silent during video playback.

The selected extension adds counter-rotating structural layers, occasional mechanical awakening, thick iris leaves and narrow signal edges. A pointer lens cuts only designated shell materials to reveal actual internal geometry. Curved particle currents, shell extraction, recessed screen travel and precision instruments use the incumbent scene rather than introducing another camera. Headline letters arrive with staggered depth, then settle without transforms. Audio-driven movement measures the explicitly enabled local score; ordinary mechanical rotation is separate from that measured response.

**The Passage Mechanism Rule.** Local relay articulation, structural reveals and wall signals share the existing camera and frame scheduler. Automatic motion calms during chapter reading, freezes during inspection and pauses under player/dialog or hidden-document suspension. Compact and reduced-motion presentations retain semantic content and omit the animated Passage mechanisms.

## Shapes

Media and editorial containers are square. Main action buttons have very small corner rounding. Circular controls are reserved for discrete actions such as play, save, previous and next. Orbits, rails, film perforations and thin directional arrows connect the spatial exploration pages without turning every panel into an ornamental object.

Mechanical depth comes from visible wall thickness, recessed screens, hinge pins, sleeves and layered material. Signal-red edges remain thin, while chrome, dark metal, stoneware and paper carry the larger surfaces.

## Components

- **Actions:** signal-filled primary, fine outlined secondary and light-filled alternate buttons. Hover changes tone; the shared primitive retains its small pressed response. Spatial mechanical actions keep the hit target fixed and compress only the existing face/content. Keyboard focus has a 2px signal outline with a 5px offset.
- **Film cards:** full-bleed image, visible programme-status label, save action, available-only play action, progress line, category/duration and linked title. Photographs and film imagery keep their content notes.
- **Search and filters:** native inputs/selects with transparent surfaces and thin dividers. Query and filters are reflected in hash-route parameters.
- **Navigation:** compact fixed chrome, a full-screen native Index dialog and active signal marks. The full Index keeps the exact product order.
- **Passage:** alternating mechanical carriers hold one semantic editorial panel, contained media and a small inspectable object. Layered dark plates protect text contrast within the bright tunnel. Inspect changes the object and surrounding frame, while the reading content stays fixed. The wayfinder provides direct station jumps, previous/next and return to entrance; compact uses a station selector. Source captions distinguish motion studies, destination photographs, the official trailer and actual saved stories.
- **Passage mechanisms:** a six-leaf entrance relay opens through a keyboard-accessible Unfold/Fold button or a click on its 3D geometry. Open shells can be selected and pulled individually, with numbered buttons and Reassemble providing equivalent direct controls. Five smaller relays accompany travel; hinged wall vanes and helical light trains stay within the tunnel. Send a signal sends one bounded pulse through those mechanisms and the curved particle current. The local controls use the incumbent square action language and signal accent. Their motion never changes the reading camera, semantic content or protected media plane.
- **Passage instruments:** the globe, open-work timepiece, projector, turntable and stoneware/paper study use the existing Inspect, left/right rotation, Reset and Escape controls. Music offers an explicit Listen/Mute action for its original synthetic score; measured frequency bands move the instrument only while that score is active.
- **Globe:** geographic data, draggable rotation, destination labels, pause/reset controls and a destination list. Place selection updates both URL state and content. Connected story windows show real catalogue entries with separate story and available-playback actions.
- **Time Machine:** overlapping archive frames, shallow internal layers, bounded parallax, a visible era rail, keyboard-operable slider and optional category/destination filters. Modern imagery with historical context is explicitly identified.
- **Cinema:** spatially arranged existing posters select the featured story through buttons and keyboard controls. The featured story keeps its visible format, status and playback action.
- **My World:** saved films orbit their catalogue destinations, with actual saved destinations represented even when empty. Hover/focus and Pause hold the constellation still; its readable collection lists every saved story even when the scene shows only four per destination.
- **Forward portals:** a verified destination or story identity remains visible through supported route travel, and destination parameters survive arrival. Enter now, Escape and reduced-motion routing remain available; a carried transition does not stack a second competing cover animation.
- **Player:** a native modal dialog over the app, with real media state, resume position, captions where supplied and browser-supported fullscreen/Picture-in-Picture.

## Do's and Don'ts

### Do

- Do keep the shared catalogue and page controls connected.
- Do preserve the exact thirteen-category Index and dedicated World and Time Machine pages.
- Do keep status, credits, focus and content caveats readable on mobile.
- Do retain sound consent, reduced motion, native scroll and non-WebGL controls.

### Don'ts

- Don't replace content discovery with inert decorative interactions.
- Don't imply planned programmes, subscriptions or broadcasts are already available.
- Don't turn contemporary destination imagery into claimed archival footage.
- Don't overwrite the existing design language with unrelated effects when adding content.

## Interaction edition

Opening typography acts as part of the Passage's signal system. Separate inner glyph layers articulate near the pointer while the existing letter wrappers retain arrival ownership. An occasional signal reveals ivory inside the outline line and red ink inside solid type. Supporting words move less than display letters. Entry and browse labels turn inside fixed targets, including on keyboard focus. Keep the exact words and readable resting state; suspend decorative motion when hidden, obscured or beyond the entrance, and use the static reduced-motion presentation. See [Living opening type](docs/living-type.md).

The Passage structural reveal is a finite world-space cut into physical shell materials. A narrow satin edge reveals recessed supports, graphite housings, cable runs and collars under the existing scene lighting. Keep this machinery behind the shell, use a bounded nearby instance pool, and exclude copy, controls and footage. Clear the reveal during travel, inspection and playback; compact and reduced-motion presentations omit it. Avoid grainy masks, fluorescent wire cages, bright outlining and full-screen color filters. See [X-ray refinement](docs/xray-refinement.md).

The Passage now unfolds side-mounted displays inside a continuous mechanical spiral, while the globe exposes actual catalogue connections. The Time Machine supports a contact sheet and direct era comparison. These interactions retain conventional controls beside spatial gestures. The homepage's silent previews, inspection controls, saved-story state and direct destination routes stay connected to the existing catalogue.

The six carriers transform through staged lock release, telescopic extension, articulated armor, screen deployment and clamping. Beveled plates, recessed vents, hinge pins, pistons and cable runs belong to the actual mechanism. Shared instanced geometry supplies detail without one draw call per part. Whole words appear only after the armor clears; readable text is never cut into shutter fragments. Camera, CSS3D and audio crossings use the same native-scroll position, with stable reading holds and exact reversal. See [Chapter assembly](docs/chapter-assembly.md).

The sound identity uses six short, restrained gestures: soft contact, airy passage, warm glass confirmation, release, a focused portal and gentle resistance. Semantic actions share this small palette. Hover, scrolling, X-ray and automatic mechanism movement are silent. Sound Studio exposes six auditions, the actual output waveform and an optional quiet atmosphere that stays consistent across chapters. Preserve consent, mute and deliberate musical tools; films and explicitly enabled sound studies own playback. See [Sound score](docs/sound-score.md).

Motion uses damped spatial movement, short route arrivals, cover transitions and GSAP Flip for journey reordering. A contextual cursor and subtle pointer lighting apply only on suitable pointer devices. Native scrolling, focus behavior and reduced-motion preferences remain primary.

The player extends into searchable supplied transcripts and a personal moment notebook. All status copy distinguishes available media, planned Originals and browser-local guest collections. Touch layouts retain distinct save, play and quick-preview controls, and the mobile header keeps four reachable actions without shrinking them to icon-sized hit areas.

## World panoramic expedition

World now brings the existing globe and destination photograph into a single wide scene. A photographic destination rail selects the same URL-backed place as the globe; the name, horizon, story collection, save state and available playback remain connected. The horizon has a short destination reveal and bounded pointer/scroll depth without moving the globe camera or intercepting native scrolling. The globe retains its own single WebGL canvas. Mobile stacks the globe and arrival composition and uses a native horizontal destination rail; keyboard arrows select places without scrolling the document. Reduced motion removes horizon movement.

## Flight companions and spiral current

Vela and Atlas are the two parent drones; Pip and Echo are the smaller scouts. Their authored ceramic, chrome and graphite bodies share a manufacturing language, with different shell profiles, articulated optics and ducted turbines. Spring-following flight, banking, cursor curiosity and delayed parent-following give the family coordinated behavior. They are ambient companions, not a claim of AI assistance.

One lightweight transparent renderer carries the family and a two-draw-call helical field across all spatial routes. Forward movement continues at rest; pointer position bends the current and native scroll supplies a short bounded acceleration. The page and globe cameras remain independent. Media, headings, prose and controls are clipped out of this decorative layer; it cannot intercept pointer input. The Passage scene also publishes the projected bounds of its WebGL media plane so Flight cannot cross the displayed film. The Flight crew control opens a native modal using the same canvas, with individual identities, escort/orbit formations and a persistent pause choice. The Passage renderer pauses behind this viewer.

Cap pixel ratio, share geometry and materials, merge static drone parts, and lower detail on compact devices. Pause under film playback, other dialogs, popovers and hidden tabs; show a static portrait for OS or site reduced motion. No fullscreen bloom, extra sound or camera motion is added. A WebGL failure removes this optional enhancement without blocking navigation or films.

Environmental behavior lets one crew member approach a service dock, perch, inspect, exchange a signal and return to flight. Reading positions keep the crew in quiet flight. The sequence is sampled from the existing shared clock, so interruption cannot queue a chain of delayed actions. The full selection, controls, fallback behavior and qualified verification record are documented in [Selected effects](docs/selected-effects.md).
