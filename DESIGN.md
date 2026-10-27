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

The implemented world combines assertive editorial typography with physical, interactive objects. A dark stage and bright signal accent frame the content; the hero sculpture, geographic globe and overlapping era frames supply depth. This records the shipped design rather than prescribing a new direction.

**Key Characteristics:**
- Monumental condensed headlines with occasional outlined words.
- Thin rules, square media, deliberate negative space and visible content provenance.
- A single warm signal accent for selected state, forward action and cultural connections.
- Direct conventional controls accompany immersive interactions.

## Colors

Signal is the primary action and selection color. Background and Surface separate page regions with small tonal changes; Text and Muted carry reading hierarchy. Paper creates a contrasting discovery section. Thin translucent Line dividers organize navigation and editorial rows. The 3D objects use reflective neutral metal, subdued illumination and restrained signal-colored traces.

## Typography

Barlow Condensed gives headlines, film titles, destinations and era numerals their compact vertical scale. DM Sans carries descriptions, buttons, controls and metadata. Display text is generally uppercase; explanatory text remains sentence case. Small tracked labels are secondary information, never a replacement for a readable primary control or content caveat.

The home headline uses three lines with an outlined final line. Content page titles use a separate fluid scale. On mobile the headline scales to the viewport, while longer film and destination titles wrap. Film cards pair a compact category/duration row with a larger title and quieter place line.

## Layout

The fixed header is 82px on desktop and 70px on narrow screens. The bottom navigation presents all thirteen primary destinations on desktop; below 760px it shows Home, World, Time Machine and My World, with the full ordered Index available in the header.

Desktop sections use roughly 5.2% side margins and generous vertical spacing. Home's three featured films are intentionally staggered. Mobile stacks those films with modest differences in width. Browse grids become two columns; World story results become one column on narrow screens. World places the globe beside a destination panel on desktop and stacks them on mobile. Time Machine uses overlapping perspective frames with a native range input and previous/next buttons.

The code has feature-specific breakpoints at 500, 760, 800, 1100, 1200 and 1700px. Preserve content readability instead of assuming a single global breakpoint controls every scene.

## Elevation & Depth

Most interface surfaces stay flat, separated by tone and thin rules. Depth comes from real Three.js geometry, photography, film-frame overlap and restrained transform responses. The header and bottom navigation use translucent backgrounds with blur. The globe's labels remain semantic buttons over the canvas.

Motion is purposeful: GSAP introduces the home typography; selected destinations update the sculpture and linked story; globe rotation exposes geography; choosing an era rearranges film frames and changes results. Rendering pauses offscreen. Reduced motion suppresses automatic movement and the cursor follower. Interface sound is opt-in, persistent and silent during video playback.

## Shapes

Media and editorial containers are square. Main action buttons have very small corner rounding. Circular controls are reserved for discrete actions such as play, save, previous and next. Orbits, rails, film perforations and thin directional arrows connect the spatial exploration pages without turning every panel into an ornamental object.

## Components

- **Actions:** signal-filled primary, fine outlined secondary and light-filled alternate buttons. Hover changes tone; pressed state translates a pixel. Keyboard focus has a 2px signal outline with a 5px offset.
- **Film cards:** full-bleed image, visible programme-status label, save action, available-only play action, progress line, category/duration and linked title. Photographs and film imagery keep their content notes.
- **Search and filters:** native inputs/selects with transparent surfaces and thin dividers. Query and filters are reflected in hash-route parameters.
- **Navigation:** compact fixed chrome, a full-screen native Index dialog and active signal marks. The full Index keeps the exact product order.
- **Globe:** geographic data, draggable rotation, destination labels, pause/reset controls and a destination list. Place selection updates both URL state and content.
- **Time Machine:** overlapping frames, a visible era rail, keyboard-operable slider and optional category/destination filters. Modern imagery with historical context is explicitly identified.
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

The sculpture now unfolds and resonates, while the globe exposes actual catalogue connections. The Time Machine supports a contact sheet and direct era comparison. These interactions retain conventional controls beside spatial gestures. The homepage's discovery tuner, silent previews and planned-original route make its editorial sections respond to the visitor.

The sound identity is synthesized from six material families, with meaningful selection, travel, memory and mechanical responses. Sound Studio makes volume and optional atmosphere explicit. A real waveform responds to the audio signal. Sound is off until enabled and stays quiet during film playback.

Motion uses damped spatial movement, short route arrivals, cover transitions and GSAP Flip for journey reordering. A contextual cursor and subtle pointer lighting apply only on suitable pointer devices. Native scrolling, focus behavior and reduced-motion preferences remain primary.

The player extends into searchable supplied transcripts and a personal moment notebook. All status copy distinguishes available media, planned Originals and browser-local guest collections. Touch layouts retain distinct save, play and quick-preview controls, and the mobile header keeps four reachable actions without shrinking them to icon-sized hit areas.

## World panoramic expedition

World now brings the existing globe and destination photograph into a single wide scene. A photographic destination rail selects the same URL-backed place as the globe; the name, horizon, story collection, save state and available playback remain connected. The horizon has a short destination reveal and bounded pointer/scroll depth without moving the globe camera or intercepting native scrolling. One WebGL canvas remains on the page. Mobile stacks the globe and arrival composition and uses a native horizontal destination rail; keyboard arrows select places without scrolling the document. Reduced motion removes horizon movement.
