# Catalogue and editorial model

`src/data/catalogue.ts` is the central content source. The same records drive browsing, search, categories, destinations, periods, programme relationships and recommendations. Arrays of `places` contain stable place IDs; `period` contains a period ID. A video's publication date is independent from the period it concerns.

The preview contains eight newly created illustrated motion essays, two authentic Blender Foundation trailers and two complete Blender Foundation films. They are a review collection, not finished Monumental Originals. The eight essays and two trailers are local H.264/AAC MP4 files. The two complete films stream directly from Blender's official server and require an internet connection. Their publication dates identify the official hosted edition's 2018 upload; their period filters refer to the original 2008 and 2010 film eras. The motion essays contain computer-generated English narration, original abstract visuals, a quiet synthetic score and separately selectable English captions. Their photographs are gateway illustrations; the films themselves contain original abstract animation.

WAVEMAKERS and THE STORY BEHIND THE STORY are development records with no `src`, no invented runtime and no invented publication or release date. The Valid ID journey remains **Puerto Rico → New York → London**. Miami is the platform's opening cultural gateway; it is not a replacement for that programme journey. Better Late Than Never is identified only as the EP anchoring Valid ID's opening artist campaign. No artist biography, approval, appearance or partnership is implied.

## Add a video

1. Put a licensed, browser-compatible video in `public/media/`, or configure an authorised playback service for protected programmes. Put its poster and any WebVTT file in the corresponding public folders.
2. Inspect the actual file with `ffprobe -v error -show_entries format=duration -of json path/to/video.mp4`. Use the resulting runtime in seconds rather than an editorial estimate.
3. Add one `Video` record to `videos`. Reference existing place and period IDs, or add accurate definitions to `places` and `periods` first.
4. Record the asset source, rights, attribution and any editorial caveats in `ASSETS.md`. Verify that spoken names, geography and historic claims match the source.
5. Open the title, test actual playback and captions, then check that it appears in the appropriate combined searches and related discoveries.

Example (use real supplied media before setting `status: 'available'`):

```ts
{
  id: 'a-stable-title-id',
  title: 'The approved programme title',
  description: 'A factual synopsis that accurately describes the supplied film.',
  category: 'Documentary',
  places: ['miami'],
  period: 'now',
  publishedAt: '2026-10-20', // Actual publication date; not a future release promise.
  people: ['An approved contributor name'],
  duration: 184.64, // Measured seconds from the actual file.
  poster: '/media/a-stable-title-id.jpg',
  src: '/media/a-stable-title-id.mp4',
  captions: '/captions/a-stable-title-id.vtt',
  access: 'free',
  status: 'available',
  series: 'An approved series name',
  episode: 1,
  credit: 'The supplied copyright and licensing credit.',
  context: 'Any important archival, illustrative or editorial clarification.',
  tags: ['community', 'creative process'],
}
```

For a planned title, use `status: 'development'`, `duration: 0`, `publishedAt: ''` and omit `src` and `captions`. An `access: 'premium'` label is metadata, not media protection: production protected sources must be issued by the server after entitlement checks.

## Reproduce the original motion studies

The optional build tools are included in `scripts/preview/`. They are content production tools and are not part of the browser runtime. `generate_media.py` regenerates the eight original local films and their WebVTT captions using Windows Speech Synthesis, Python with Pillow and NumPy, and FFmpeg on PATH. It uses Windows Arial fonts and writes temporary audio to `.work/preview-media/`. Run it from the project directory with a Python environment containing those dependencies:

```powershell
python scripts/preview/generate_media.py
python scripts/preview/verify_media.py
```

The second command compacts larger procedural clips, probes the real files, checks caption cue endpoints, updates `duration` values in the central catalogue and refreshes the measured inventory in `ASSETS.md`. It expects the two supplied local trailer files to remain present. The original trailer and photo download URLs are recorded in the source manifest. Regeneration replaces the eight preview films and their captions; it does not download media, alter the trailers or create client original episodes. Narration timing can vary with the installed Windows voice, so always rerun verification after regeneration.

## Geography and period rules

- **Miami:** city marker at 25.7617, −80.1918. The gateway may include Greater Miami stories, but the Art Deco essay explicitly concerns the separate municipality of Miami Beach.
- **Puerto Rico:** island territory marker at 18.2208, −66.5901. The gateway photo depicts Old San Juan. It is not labelled a city or an independent country.
- **New York:** city marker at 40.7128, −74.0060. The hip-hop essay concerns the Bronx; the city gateway photo depicts Manhattan and is labelled accordingly.
- **London:** city marker at 51.5074, −0.1278. The historical essay concerns east London's early 1990s music context. The skyline photo is an illustration, not archival evidence.
- **Tokyo:** metropolis marker at 35.6762, 139.6503. The fashion essay discusses Harajuku; the city photograph shows Shinjuku.
- **Rio de Janeiro:** city marker at −22.9068, −43.1729. The samba essay distinguishes Rio from Bahia rather than treating all Brazilian music as one local tradition.

1930s, 1970s and 1990s filters select newly created explanatory illustrations concerning those periods. They do not imply historic footage. The 2000s and 2010s open-cinema filters concern the trailers' publication eras; their fictional worlds have no real historical setting. `now` groups contemporary editorial studies and planned original programming.

## Editorial associations

City Signals episodes share a format and a theme of human connection. Time Studies episodes share an explanatory historical format. A shared tag such as `rhythm` is a transparent thematic relationship, not evidence that an artist worked in every linked city. The Shared Table is a fictional visual poem associated editorially with the Miami gateway; it makes no claim about a restaurant, chef or recipe.

## Factual context sources

- Art Deco: [City of Miami Beach architectural history](https://www.miamibeachfl.gov/architecture/art-deco/) and [Greater Miami Convention & Visitors Bureau](https://www.miamiandbeaches.com/l/attractions/art-deco-district/2116). Support the 1930s context and the geometric, symmetrical, curved design vocabulary.
- Early hip-hop: [Library of Congress, Early Hip-Hop at the Library of Congress](https://blogs.loc.gov/music/2023/08/early-hip-hop-at-the-library-of-congress/). Supports the carefully qualified 1973 Bronx / DJ Kool Herc reference. The programme does not imply he appears in it.
- London: [V&A, Meet the artists amplifying east London's lost sounds](https://www.vam.ac.uk/blog/east/meet-the-artists-lost-sounds-east-london). Supports the connection among local music spaces, pirate radio and the 1989–1994 period.
- Puerto Rico: [Discover Puerto Rico, Music and Dance](https://www.discoverpuertorico.com/es/la-isla/musica-y-baile). Supports the distinction between bomba's movement/percussion conversation and plena's narrative focus.
- Tokyo: [Tokyo's official Harajuku guide](https://www.gotokyo.org/en/destinations/western-tokyo/harajuku/index.html). Supports the fashion and self-expression context. No claim of a particular designer's participation is made.
- Rio and Bahia: [UNESCO, Samba de Roda of the Recôncavo of Bahia](https://ich.unesco.org/en/RL/samba-de-roda-of-the-recncavo-of-bahia-00101). Supports the migration connection and influence on urban samba in Rio; the score does not imitate or claim to document an authentic performance.

Sources were checked on 20 October 2026 in the user's timezone. Photo capture dates vary and are not presented as current live views. This application does not display invented weather, events, popularity figures or release dates.
