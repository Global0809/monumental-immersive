# Monumental interaction map

This document describes implemented behavior. Content, subscriptions and launch status are documented separately in CONTENT.md and INTEGRATIONS.md.

## Home: a physical invitation

The chrome sculpture is real Three.js geometry. Drag to rotate it with damped inertia. Select a destination signal or its matching list button to update the featured story and World link. Unfold opens the mechanism; Reassemble closes it. Hold Resonate and release to send a stronger pulse. Pause stops idle rotation while leaving direct controls available. Reset returns the object to its initial pose.

With the sculpture focused, Left/Right turn it, Enter unfolds it and Space sends a pulse. Pointer cancellation and leaving the page release held controls. The sculpture reacts to the original interface sounds, but never generates sound without the sound preference being enabled.

The discovery tuner changes the featured collection. Film images react to the pointer; local preview clips start silently after a deliberate hover dwell. Touch visitors have a separate Quick look control. Only one preview plays at a time, and it stops on departure, when offscreen or when the main player opens.

WAVEMAKERS has selectable Puerto Rico, New York and London stops. These change the background and story context of the planned series; they do not claim that episodes are available.

## World: explore actual relationships

The globe has geographic land data, drag rotation, zoom, pause and reset. Destination signals match real catalogue locations. Selecting a place updates the URL, destination context and matching films. Connection arcs correspond to catalogue relationships, with the reason shown in the destination panel. The connections control can hide those arcs.

Every canvas destination has a semantic button and a conventional place selector. If WebGL is unavailable or loses its context, destination discovery remains available through those controls.

## Time Machine: browse eras

Drag the film strip horizontally, choose a contact-sheet image, use the previous/next controls or move the native time dial with arrow keys. Native vertical scrolling stays available on touch devices. Selecting an era changes the matching stories and the route parameters.

Compare two eras side by side, then follow a film or save the current time capsule as an interest. Destination and category filters intersect the era selection. Empty intersections have a reset action. Contemporary destination images are explicitly identified as contemporary context, not historical footage.

## Discover and quick search

The catalogue combines text, category, destination, era and availability filters. Text search waits 280 ms after typing and retains input focus. Filters have removable chips, reset, sorting and grid/list views. Browser Back restores the route state. Composition input is allowed to finish before a new search is committed.

Ctrl/Cmd+K or / opens the command deck. Search films, places and pages; use arrow keys and Enter to choose, or Escape to close and restore focus. These shortcuts do not intercept text fields. The full Index retains the exact requested 13-item navigation.

## Journeys and My World

Choose a time budget, starting place and interest to generate a journey from available free films. Surprise me changes the place and interest. Rename the journey, reorder stops by drag or up/down buttons, remove stops, regenerate or save the route. Play entire journey uses the selected order.

The culture passport derives its places from actual saved and watched stories. Select a place to see the connected collection, collect/remove it or open its World page. My World contains saved films, progress, watch history, journeys, interests, places and the moment notebook.

Guest data normally persists in local browser storage. If storage is denied or full, the session remains usable in memory and shows that data will reset on reload. There is no account or cross-device synchronization in this edition.

## Player and personal moments

The modal player has native video controls plus seek, skip, speed, captions where supplied, fullscreen and picture-in-picture when supported. It resumes ordinary watch requests; explicit shared timestamps and journey starts take precedence over resume. A timestamp of zero is valid.

When a queued film naturally ends, a visible five-second countdown advances to the next stop. Stay here cancels that advance. Hidden pages do not automatically skip ahead. The final film remains ended. Remote-source failures expose retry and a truthful error message.

K toggles playback, J/L skip ten seconds, Left/Right skip five seconds, M mutes and F requests fullscreen. Native video controls, inputs and tab controls keep their own keyboard behavior. Space activates a focused button normally. Escape closes the player and returns focus.

Supplied VTT captions become a searchable transcript. Select a passage to seek to its measured timestamp. Follow along is optional and stops when the visitor manually scrolls or searches. A failed transcript request has its own Retry action.

Keep this moment captures the current timestamp, with an optional 180-character note. Keeping the same second updates its note. Moments can be revisited, edited or removed from My World; removal offers Undo. Share moment copies a route with the exact time and exposes selectable text if clipboard access fails.

Cinema glow samples a tiny local-video frame and updates at a bounded rate. It is omitted for remote media and disabled with reduced motion. The sound layer stays quiet while the player is open.

## Sound identity

All interface sounds are original Web Audio synthesis. There are no audio sample downloads or third-party sound recordings.

| Family | Interaction character |
| --- | --- |
| Magnetic | Tactile selection and contact |
| Glass | Saving and confirmation |
| Transit | Destination movement and navigation |
| Memory | Era selection and time travel |
| Unfold | Mechanical opening and closing |
| Resonance | A charged pulse through the sculpture |

Sound is off by default. Hear this world or the header sound button enables it through an actual user gesture. A saved preference alone never creates audible autoplay. Sound Studio offers six audition pads, a real waveform, master volume and optional scene ambience with a separate mix. Ambience changes between Home, World, Time Machine and the library.

Cues are rate-limited and voice-limited, with gentle gain envelopes, a compressor and stereo placement where supported. The engine pauses when hidden, after inactivity and during film playback. Cross-tab mute is observed. Unsupported browsers show an unavailable state and keep the visual experience usable.

## Shared feedback and access

- Saved actions offer Undo; notices pause while hovered or focused.
- The contextual cursor and surface tilt apply only to fine pointers and full motion.
- The reading indicator and Back to top follow native scrolling.
- Story covers transition into their detail page without owning routing or delaying navigation.
- Press ? or choose Interaction guide in the footer for visible controls and shortcuts.
- Device and in-site reduced-motion preferences are both respected.
- Lazy route or player failures retain navigation and recovery controls.
- Components remove observers, timers, listeners and GPU resources on departure.

## Extending the experience

Use the shared catalogue for new content. Supply measured durations, playable sources, captions, rights, place IDs and period metadata; the existing discovery, World, Time Machine and journey features then connect those records automatically. Use `playSound` for a meaningful action and `data-sound-owned` on the component to avoid doubling the shared click cue. Never couple an animated flourish to a fabricated product state.
