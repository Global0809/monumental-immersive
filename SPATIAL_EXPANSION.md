# Monumental: 20 spatial additions

The observatory already provided rooms and portals. These additions make the space useful for choosing, investigating, composing and keeping stories. Existing films, routes and collection data remain available within the 3D world.

| # | Addition | Where to try it | What it does |
|---|---|---|---|
| 1 | Observatory floor plan | Home, below the entrance | Select a doorway and enter its existing room. |
| 2 | Overhead camera | Home, floor-plan controls | Move the actual observatory camera above its architecture. |
| 3 | Structural cutaway | Home, Reveal the framework | Inspect the architecture as wireframe while pictures and the chrome instrument retain their materials. |
| 4 | Lighting desk | Home, Room illumination | Adjust the observatory lights and exposure immediately. |
| 5 | Pinned doorways | Home, Pin doorway | Keep favourite room links in this browser. |
| 6 | Guided room tour | Home, Take a guided room tour | Move manually through six rooms, read their purpose and enter any one. |
| 7 | Story constellation | Search or a populated category, Orbit | Select real film posters in a spatial arrangement; keep the existing search, filters, grid and list. Mobile uses a horizontal rail. |
| 8 | Two-film comparison | Orbit, Compare two films | Compare descriptions, places, lengths and catalogue connections; watch, save or open either film. |
| 9 | Destination bridge | World, Two places | Choose a second place, inspect supported catalogue relationships and play a two-film queue. |
| 10 | City story orbit | World, Orbit [destination] | Bring a story forward in a spatial poster fan, then play, save or read it. |
| 11 | Time capsules | Time Machine, Open a time capsule | Unfold a story and distinguish its explored period from the publication date of its edition. |
| 12 | Era relay | Time Machine, Make an era relay | Select periods in order; play or save the first available story from each period. |
| 13 | Unfolding film dossier | Film details, Unfold the story | Open a spread containing context, credits and playable related stories. |
| 14 | Rhythm grid | Settings, Compose a small world | Compose an eight-step phrase with four original synthesized interface instruments, tempo and local pattern saving. |
| 15 | Spatial journey timeline | Journey, after generating a route | See timing and pacing, select stops and move them earlier or later without changing the source films. |
| 16 | Portable journey links | Journey, Copy journey link | Share a bounded snapshot of a title and up to 20 playable film IDs. Recipients get an independent editable draft. |
| 17 | Personal constellation export | My World, Take your constellation home | Download an SVG containing up to 12 saved titles; notes and viewing history are excluded. |
| 18 | Discovery expeditions | My World, Bring something back | Follow four optional tasks whose progress comes from actual saved destinations, films, journeys and playback. |
| 19 | Kinetic material laboratory | Motion, Try the working sculpture | Load a real Three.js instrument; drag or use turn buttons, modify twist/spacing/resonance, inspect topology and try three presets. |
| 20 | Observatory quality controls | Settings, Set the detail | Change the observatory canvas resolution with bounded Light, Balanced and Fine detail presets. Film resolution is unaffected. |

## Implementation

Components live in `src/components/spatial/`, with shared styles in `spatial-expansion.css` and `expansion-scenes.css`. `spatialPreferences.ts` validates and stores scene preferences; `spatialDiscovery.ts` resolves honest catalogue connections, portable itineraries and safe SVG exports. The existing route, viewer, playback, audio and spatial-travel services are reused.

The laboratory loads on demand, rests offscreen or in a hidden tab, and disposes its renderer, geometry, environment and listeners when closed. Its automatic motion is opt-in. New folding and orbit transitions respect reduced motion. The rhythm grid also rests offscreen, on tab hiding, on mute and when film playback takes priority. The 3D world is the sole visitor experience. Legacy experience-mode links are normalized without losing their route or filters.

## Verification and boundaries

- Production TypeScript/Vite build passes; 109 automated tests pass, including new itinerary validation, honest relationship matching, SVG export and bounded scene preferences.
- Desktop and 390px mobile browser checks cover the new controls, real paired/relay playback, comparison, local expedition progress, shared-link restoration, keyboard controls, material presets, mobile overflow and touch-target sizing. Physical touch-device testing was not performed.
- Manual design scan: zero counted anti-patterns. Its palette/type advisories concern the intentionally preserved Monumental palette and compact spatial diagram labels; they are not evidence of runtime correctness.
- Browser testing caught and fixed observatory click-through, SVG icon sizing, shared-link resets, explicit range labels and undersized mobile rhythm pads.
- Savings and preferences remain browser-local. Sharing is a URL snapshot, not a hosted account, revocable room or live presence service. Programme development labels, billing setup and media provenance remain honest. No universal frame-rate claim is made.

## Recovery

Primary source tag `before-twenty-expansions-2026-10-25` preserves the preceding source revision. The original pre-spatial backup remains in the workspace backups directory; the original editorial website is preserved in the backup rather than offered as a visitor mode.
