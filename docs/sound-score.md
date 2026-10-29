# Monumental sound score

The score treats the website as an instrument built from chrome bands, felted mechanisms and film transport. Short contacts make small actions certain; larger gestures carry weight and depth. Silence is part of the arrangement. There is no musical success jingle, perpetual hover chatter or scroll soundtrack.

## Materials and meaning

- **Detent:** a dry, damped mechanical contact for selections.
- **Keepsake:** a clasp followed by a small ceramic resonance for saving; removal releases the clasp instead.
- **Transit:** low structural weight, narrow friction and a small spatial landing for destinations.
- **Splice:** uneven film perforations decelerating into a stop for era changes.
- **Chrome:** inharmonic metal modes for sculpture opening, closing, turning, alignment and resonance. Each is separately authored.
- **Confluence:** two contacts approach from opposite stereo positions, then join into one resonant body for the Culture Collider.
- **Signature:** a single latch opening into Monumental's metal resonance when the visitor enables sound.

Twenty-one original cues share a modal family but have distinct envelopes, contacts, space and duration. Five subtle repeatable pitch/gain variations prevent identical repetition. Four optional six-second room textures change with the existing Home/World/Time/library scene state; these are authored synthesis, not location recordings.

## Implementation

`scripts/sonic-materials.ts` is the offline instrument builder. Damped inharmonic bodies, filtered contact noise, granular bearings and short asymmetric reflections are rendered as 32 kHz stereo PCM WAV files. Run `node --import tsx scripts/render-sonic-score.ts` after changing the score. It also exports a listening reel under `.impeccable/review/sonic-score/`.

`src/services/sonicScore.ts` names the materials and resolves assets with Vite's base path, including GitHub Pages. `audio.ts` loads and decodes only after opt-in, caches each buffer, and plays one source/gain/panner chain per cue. No runtime sample synthesis, convolution, new audio dependency or per-frame audio work is added. All files total about 4.4 MiB; optional room loops account for most of it. Initial opt-in warms only four small everyday contacts after the signature; the rest load on demand.

Main cues suppress incidental contacts, at most five voices overlap, stale downloads never replay old actions, and ordinary cues expire after 450 ms if a network request takes too long. The atmosphere gently recedes beneath meaningful cues. The existing master volume, compressor, hidden-tab suspension, idle suspension and film-priority gate remain authoritative. Muting or opening a film invalidates pending decodes as well as stopping active cues. Fast off/on toggles cancel obsolete suspension timers.

`ExperienceLayer` keeps major-card/navigation hover cues behind a 90 ms dwell and 450 ms spacing. Semantic handlers own their audio explicitly, including save/remove/Undo, city selection, collider and sculpture controls. Keyboard and touch activation use the same action cues; hover is mouse-only. There is no sound on scrolling or ordinary text.

## Verification

The material tests compare every shipped WAV with the deterministic renderer and check finite samples, headroom, endpoint silence, low DC and loop continuity. Lifecycle tests exercise opt-in, zero-volume behavior, fast mute toggles, movie priority, async cancellation and cache reuse. Browser verification must also check Sound Studio auditions, volume/mute controls and native playback on a real device. Speaker/headphone loudness remains dependent on the listener's hardware volume.
