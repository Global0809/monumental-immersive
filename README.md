# Monumental — Culture without borders

An immersive cultural streaming preview, built with React, TypeScript, Three.js and GSAP. The visual direction takes the sparse, oversized typography and reactive presence of the supplied Unbelievably Crap reference into an original Monumental identity.

[Open the live preview](https://global0809.github.io/monumental-immersive/).

## Run

```sh
npm install
npm run dev
```

Production: `npm run build`, then `npm run preview`. Catalogue checks: `npm test`.

## Working experience

- Mechanical 3D sculpture with inertia, destination signals, Unfold / Reassemble, hold-to-charge resonance, light response, idle pause and keyboard controls.
- Exact requested navigation: Home, World, Time Machine, Live, Movies, Music, Sports, Gaming, News, Fashion, Culture, Kids and My World.
- World globe with drag, zoom, destination focus, real catalogue connections and accessible fallback controls.
- Time Machine with a draggable film strip, contact sheet, era comparison, keyboard/range selection and saved time capsules.
- Immediate discovery search, combined filters, removable filter chips, sorting and grid/list views. Ctrl/Cmd+K or / opens quick search across stories, destinations and pages.
- Muted, opt-in card previews; saved films with Undo; shared cover transitions; responsive pointer lighting and a contextual cursor.
- Time-budgeted journeys with surprise generation, editable names, drag or arrow reordering, place connections and persistent playback queues.
- Video playback with seek, speed, captions when supplied, fullscreen/PiP where supported, resume, five-second queue continuation, local-frame cinema glow and shareable timestamps.
- Searchable supplied transcripts, cue seeking, optional follow-along, saved timestamps and personal notes in My World.
- Interactive culture passport, favourite places, watch history, continue watching, saved journeys, notes and interests stored locally.
- Original synthesized sound identity: magnetic, glass, transit, memory, mechanical unfold and resonance. Sound Studio provides audition pads, waveform, master volume and optional scene ambience. Sound begins only after opt-in and pauses around film playback.
- Native scrolling, reduced-motion support, touch alternatives and an interaction guide (press ? or use the footer).

See INTERACTIONS.md for the controls and behavior map.

## Content and membership boundaries

This is an early preview using eight original procedural narrated motion studies, two open-cinema trailers and two complete openly licensed guest films. Two Monumental Originals are marked in development. The client has not supplied finished original programming. Credits are visible in the website and documented in ASSETS.md and CONTENT.md.

Sports, Gaming, News and Kids have honest development states; they are available in navigation and can be followed locally. Live broadcasts, dates and venue are not invented. Miami is the launch focus; WAVEMAKERS retains its Puerto Rico → New York → London narrative.

Premium has a designed information page and local interest saving. Production sign-in, cross-device sync, subscriptions, billing, paid entitlements and administrative dashboards are not connected. INTEGRATIONS.md documents the existing server adapter boundary. Browser storage does not grant paid access. No payments are collected in this preview.

## Add content

Use `src/data/catalogue.ts` as the shared source. Add a Video record with a unique id, measured duration, poster, media source, categories, valid place and period IDs, access, status, credits and context. Local assets live in `public/media`; captions in `public/captions`. A new record appears across discovery, search, World, Time Machine and related films through its metadata. Add destination records with accurate coordinates when extending the globe.

The UI groups Film under Movies and Documentary / Art & Design / Food under Culture. Keep explicit content-review requirements for Kids. Available content must have a playable source; planned programming must remain status `development`.

## Main implementation files

- `src/App.tsx`: navigation, homepage, details, guest collections, settings and membership preview.
- `src/components/CatalogueBrowser.tsx`, `JourneyWorkbench.tsx`, `CulturePassport.tsx`: discovery, editable itineraries and places.
- `src/components/PlayerCompanion.tsx`, `MomentNotebook.tsx`: transcripts and personal timestamps.
- `src/components/SoundStudio.tsx`, `ExperienceLayer.tsx`: sound controls and shared interaction feedback.
- `src/components/CultureSculpture.tsx`: original WebGL hero.
- `src/components/ExplorePages.tsx`: World and Time Machine pages.
- `src/components/Atlas.tsx`: geographical globe.
- `src/components/VideoPlayer.tsx`: accessible playback.
- `src/services/`: persistence, discovery, audio, routing and membership adapters.
- `src/styles.css`: shared design and responsive layouts.

## Hosting

This public repository publishes the generated `docs/` folder from `main` through GitHub Pages. Run `npm ci`, `npm test`, and `npm run build:pages`, then commit source and `docs/` together. The build uses `/monumental-immersive/` as its base; the shared asset helper preserves local videos, posters, captions, quick previews and cinema glow under that subpath. Hash routes survive reloads. The original Sites deployment is maintained separately. No account credentials or guest browser data are included in this repository.

## Verification

See VERIFICATION.md for the checks performed on this edition. WebGL, fullscreen, picture-in-picture and remote film availability depend on browser/device support; the UI retains its fallback and error states.
