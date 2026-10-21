# Asset and source manifest

All rights and identity labels below are intentional. Demonstration films are separated from planned Monumental Originals. No approved artist photograph, finished Valid ID episode or Monumental Original trailer was supplied. Nothing in the preview represents an endorsement by a person or institution named in a source.

## Original preview films

`public/media/miami-frequency.mp4`, `concrete-and-colour.mp4`, `island-current.mp4`, `break-beat-city.mp4`, `london-after-hours.mp4`, `tokyo-in-motion.mp4`, `rio-rhythm.mp4`, and `shared-table.mp4` were created for this build on 20 October 2026. They use original procedural animation, newly written narration, computer-generated English speech (the installed Windows speech synthesizer), and original synthesised ambient scores. No sampled commercial recordings, artist photographs or historic footage are included. Each English WebVTT caption track transcribes its narration and identifies the ambient score. These are contemporary illustrated essays, not authentic recordings of the cultural genres discussed. All project-created procedural artwork, scripts, narration text and original score elements may be used as part of this project.

`public/media/deco.svg`, `breakbeat.svg`, `table.svg`, `wavemakers.svg`, and `story.svg` are original SVG concept illustrations created for the preview. WAVEMAKERS and THE STORY BEHIND THE STORY artwork is conceptual; it does not impersonate an approved artist asset.

## Open cinema guest selections

### Big Buck Bunny — official trailer

- Author and required attribution: **© Blender Foundation | peach.blender.org**.
- Project and license source: [Big Buck Bunny — About and license](https://peach.blender.org/about/). The primary source currently specifies [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/).
- Media source: [Official iPhone trailer file](https://download.blender.org/peach/trailer/trailer_iphone.m4v).
- Local file: `public/media/big-buck-bunny.mp4`; runtime **33.041995 seconds**; H.264 video, 480 × 270, AAC audio.
- Changes: MP4 container remux with fast-start metadata, without re-encoding the audio or video. Local poster `big-buck-bunny.jpg` is a still extracted at 15 seconds; the extracted still is covered by the same attribution license. Film title, identity, original content and embedded credits are preserved.
- This is a trailer, not the complete short. Release-era collection: 2000s. No real destination or historical story setting is claimed.

### Sintel — official trailer

- Author and required attribution: **© Blender Foundation | www.sintel.org**.
- Project and license source: [Sintel — Sharing](https://durian.blender.org/sharing/), [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/).
- Media source: [Official 480p trailer](https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4).
- Local file: `public/media/sintel.mp4`; runtime **52.208333 seconds**; H.264 video, 854 × 480, AAC audio.
- Changes: MP4 container remux with fast-start metadata, without re-encoding the audio or video. Local poster `sintel.jpg` is a still extracted at 8 seconds, under the same attribution license. Film title, identity, original content and embedded credits are preserved.
- This is a trailer, not the complete short. Release-era collection: 2010s. No real destination or historical story setting is claimed. Fantasy action is noted in the catalogue.

Official primary license pages and media files were fetched successfully. Both local trailer files were probed for codec, dimensions and runtime. Google sample bucket URLs returned HTTP 403 during research and are not used.

### Big Buck Bunny and Sintel — complete films

Two additional catalogue entries stream the complete films directly from the official Blender Video server. They are separate from the local trailers and retain each film's own identity, score and complete credits. They are free guest selections, with no affiliation with Monumental Originals and no geographical destination labels. They require an internet connection; no full-film media is bundled in the project.

- **Big Buck Bunny**: © Blender Foundation | peach.blender.org, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) as declared on the [project license page](https://peach.blender.org/about/). [Official video page](https://video.blender.org/videos/watch/bf1f3fb5-b119-4f9f-9930-8e20e892b898); [official 720p MP4](https://video.blender.org/object-storage/web_videos/bf1f3fb5-b119-4f9f-9930-8e20e892b898-720.mp4). `ffprobe` verified **596.566 seconds**, H.264 1280 × 720 and AAC audio. The official API records publication of this hosted edition on **27 October 2018**; the film itself is from **2008**. No edits or re-encoding. Uses the separately credited trailer still as its poster.
- **Sintel**: © Blender Foundation | www.sintel.org, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) as declared on the [project license page](https://durian.blender.org/sharing/). [Official video page](https://video.blender.org/videos/watch/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40); [official 720p MP4](https://video.blender.org/object-storage/web_videos/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40-720.mp4). `ffprobe` verified **888.092993 seconds**, H.264 1688 × 720 and AAC audio. The official API records publication of this hosted edition on **26 October 2018**; the film itself is from **2010**. No edits or re-encoding. Uses the separately credited trailer still as its poster.

The hosted video API's license field is unspecified for these legacy uploads; the explicit primary project license pages govern the same films. The two local trailers remain available if external streaming is unavailable. No quality menu is advertised merely because the source service has other encodes; this application selects one verified source per entry.

## Destination photographs

These are accurately identified geographic illustrations, not images of the featured artists or stills from the generated films. Photographs were downloaded byte-for-byte as the Wikimedia image service supplied them. The website may crop them visually with CSS; no edits to the downloaded files were made. The source file's license continues to apply to each photograph; it does not relicense unrelated application code. Attribution is also exported in `src/data/sources.ts` for the viewer-facing credits.

### london

- Local file: `public/media/london.jpg`.
- Source: [London_Skyline_(125508655).jpeg](https://commons.wikimedia.org/wiki/File:London_Skyline_(125508655).jpeg).
- Author: **Ilya Grigorik**.
- License: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0).
- Source description: 500px provided description: London Skyline [#sunset ,#architecture ,#cityscape ,#london ,#uk ,#skyline ,#financial district ,#thames ,#london bridge ,#london shard]
- Modifications: none to the downloaded thumbnail file.

### miami

- Local file: `public/media/miami.jpg`.
- Source: [Miami,_Florida,_Skyline_4.jpg](https://commons.wikimedia.org/wiki/File:Miami,_Florida,_Skyline_4.jpg).
- Author: **Wilfredor**.
- License: [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en).
- Source description: Miami, Florida, Skyline
- Modifications: none to the downloaded thumbnail file.

### new-york

- Local file: `public/media/new-york.jpg`.
- Source: [View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu_(cropped).jpg](https://commons.wikimedia.org/wiki/File:View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu_(cropped).jpg).
- Author: **Dllu**.
- License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0).
- Source description: View of the Empire State Building in New York City from the Top of the Rock at 30 Rockefeller Plaza during sunset. The tower was illuminated in green in honor of Climate Week NYC.[1]
- Modifications: none to the downloaded thumbnail file.

### rio

- Local file: `public/media/rio.jpg`.
- Source: [Cidade_Maravilhosa.jpg](https://commons.wikimedia.org/wiki/File:Cidade_Maravilhosa.jpg).
- Author: **Rafael Rabello de Barros**.
- License: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0).
- Source description: Rio !
- Modifications: none to the downloaded thumbnail file.

### puerto-rico

- Local file: `public/media/puerto-rico.jpg`.
- Source: [2013_Old_San_Juan_01.JPG](https://commons.wikimedia.org/wiki/File:2013_Old_San_Juan_01.JPG).
- Author: **Farragutful**.
- License: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0).
- Source description: Old San Juan, Puerto Rico from San Juan Bay.
- Modifications: none to the downloaded thumbnail file.

### tokyo

- Local file: `public/media/tokyo.jpg`.
- Source: [Skyscrapers_of_Shinjuku_2009_January.jpg](https://commons.wikimedia.org/wiki/File:Skyscrapers_of_Shinjuku_2009_January.jpg).
- Author: **Morio**.
- License: [CC BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/).
- Source description: View of Shinjuku skyscrapers and Mount Fuji as seen from the Bunkyo Civic Center in Tokyo
- Modifications: none to the downloaded thumbnail file.

## Cultural context and geographical precision

See `CONTENT.md` for editorial context sources, exact coordinate pairs, period semantics, and cautions about related-but-different places (Miami/Miami Beach; Puerto Rico/Old San Juan; New York/Bronx/Manhattan; Tokyo/Harajuku/Shinjuku; Rio/Bahia). These source institutions are references, not claimed partners.

## Asset boundary

No proprietary logos, celebrity likenesses or unlicensed music were downloaded. The words Valid ID, WAVEMAKERS, Better Late Than Never and THE STORY BEHIND THE STORY are used only in the relationships supplied in the brief. Historical people are discussed as sources or context and are not presented as participants. Trailer access is free. Any eventual paid original must use licensed source files and server-authorised playback.

## Verified local media inventory

| Title ID | Measured runtime | File size | Captions |
|---|---:|---:|---|
| `miami-frequency` | 32.128 s | 2.06 MB | English |
| `concrete-and-colour` | 31.953 s | 0.46 MB | English |
| `island-current` | 33.213 s | 2.08 MB | English |
| `break-beat-city` | 29.293 s | 1.87 MB | English |
| `london-after-hours` | 31.948 s | 2.04 MB | English |
| `tokyo-in-motion` | 32.853 s | 2.10 MB | English |
| `rio-rhythm` | 31.518 s | 2.77 MB | English |
| `shared-table` | 33.078 s | 0.49 MB | English |
| `big-buck-bunny` | 33.042 s | 3.90 MB | No track supplied |
| `sintel` | 52.208 s | 4.37 MB | No track supplied |

All ten bundled videos were verified with ffprobe as H.264 video plus AAC audio. All eight WebVTT files were checked for header, cue count and cue ends within the actual video duration. Local media folder total: **25.47 MB**, including photographs, concept SVGs and extracted poster stills. The two complete external films were separately probed at their official URLs; they are not included in this local size.
