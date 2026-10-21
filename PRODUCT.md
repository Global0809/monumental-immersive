# Product: Monumental Streams

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing implementation: React 19, TypeScript, Vite, Three.js, GSAP and Phosphor icons. Hash routes support static hosting. Catalogue and discovery logic live separately from presentation. Guest state persists in local storage.

## Users

Viewers who want to watch entertainment and discover the people, destinations, creative categories and eras connected to it. The current edition is a client preview; it does not claim a finished commercial catalogue.

## Product Purpose

Connect streaming and cultural discovery. A viewer can start with a film, a place, an interest or an era, follow related stories, and save a personal path through the catalogue.

## Operating Context

The client is preparing a Miami launch. No date, venue or finished client video catalogue is confirmed. Videos will be added over time. Full administrative and editorial dashboards are deferred; the viewer's My World is in scope now.

## Capabilities and Constraints

- Preserve the exact primary index and order: Home, World, Time Machine, Live, Movies, Music, Sports, Gaming, News, Fashion, Culture, Kids, My World. Search, sound, settings and membership are utilities.
- Home introduces the platform through a destination-linked 3D sculpture, preview films, planned Originals and discovery routes.
- World has a real globe with geographic markers, a selectable destination list, saved places and related catalogue results. It is a dedicated page.
- Time Machine is a dedicated page with an era selector, destination/category filters and related films. Historical context is distinct from film publication or release date.
- Film details, playback, search, saved stories, progress/history, category interests, saved journeys and a Culture Passport use the same catalogue and viewer state.
- Guest data is saved on the current browser. Account sync is not connected. Clearing history leaves saved films intact.
- The free collection is playable. Premium membership is planned; pricing, benefits and launch timing remain open. The service boundary supports server-authorized premium playback, but this preview has no working purchases or customer sign-in.
- Live, Sports, Gaming, News and Kids may have honest development states rather than fabricated broadcasts or programmes. Kids is pending age-reviewed programming.
- Local assets currently use root-relative URLs. Root-domain static hosting is the current supported packaging assumption; a subdirectory deployment requires a full asset-path check.

## Brand Commitments

Monumental Streams connects people, places, culture and entertainment. The user explicitly requested a futuristic, premium, creative, highly interactive website, with the Awwwards Unbelievably Crap site as the redesign reference. The globe and Time Machine are core concepts to preserve.

WAVEMAKERS is an international original format about people shaping culture across borders. Valid ID is the inaugural presenter and featured artist; Better Late Than Never is the opening EP campaign. Its opening journey remains Puerto Rico → New York → London. The Story Behind the Story is a separate planned original series. Miami launch plans do not replace that artist journey.

## Evidence on Hand

`src/data/catalogue.ts` records places, eras, programmes, media sources and development status. `src/data/sources.ts` credits destination photography. The preview includes authored procedural motion studies with synthetic sound and narration, credited Blender Foundation trailers, and complete guest films streamed from Blender's official server. Modern destination photographs are introductions to a place, not film frames or period archival evidence. Content notes are visible in film details and Credits.

## Product Principles

- Discovery must lead to actual content or a clearly described development state.
- Every new item should join the shared catalogue rather than duplicate content across pages.
- Preserve context when moving between place, era and story.
- Show truthful local, unavailable, development and service-setup states.
- Keep a direct route to every core function alongside immersive interactions.

## Accessibility & Inclusion

The implementation provides semantic DOM controls around WebGL, keyboard-accessible destination and era alternatives, native dialog focus containment, visible focus treatment, reduced-motion support, sound off by default and persistent experience preferences. Mobile retains native vertical scrolling and a compact navigation bar plus the full Index menu. Future changes should preserve these mechanisms.
