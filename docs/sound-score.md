# Monumental sound score II

The sonic identity follows the physical website: magnetic contacts, pressure through a portal, articulated chrome, optical inspection and signals moving through space. Twenty-five original stereo cues replace the heavily damped palette. Eight optional room fields give Home, World, Time, Cinema, Music, Culture, Collection and the wider catalogue distinct atmospheres. Source recipes and mastering evidence are in [Sonic palette](sonic-palette.md).

## Interaction and mix

Small actions have short contacts; portals, destinations, memory and mechanisms receive fuller gestures. Cues pan toward the action. Opening and folding are separate sounds. Deliberate X-ray hover has a restrained scan with 6.5-second spacing. Card/navigation hover waits 90 milliseconds and is spaced at least 450 milliseconds. Semantic handlers own their sounds, preventing duplicate generic clicks.

passageSonic.ts subscribes to the existing journey samples; it never moves the camera or scroll. Chapters select their room, travel opens the atmosphere's spectral range and stereo image, and settled reading positions receive arrivals. Fast jumps skip intermediate arrivals. Restored positions, layout changes and hidden pages do not announce phantom travel. No additional animation loop is introduced.

audio.ts retains one consent-gated AudioContext. Authored 32 kHz WAV buffers load separately and cache on demand. The bank totals 10.26 MiB, with no audio requests before opt-in. Initial activation warms six common cues; optional rooms load only when needed. The old score-v1 assets are removed from the shipping tree and remain in backup/audio-before-20261030.

Master calibration preserves body and transient detail, with final compression. At most five effects play simultaneously. Rooms retain the prior atmosphere while loading, then crossfade over 650 milliseconds; only one incoming and one outgoing loop are retained. Travel updates use smoothed AudioParams, bounded writes and a short decay. Motion cannot allocate audio or leave stale energy while sound is unavailable. Meaningful cues briefly duck the room field.

## Controls and lifecycle

Sound stays off until enabled. Existing mute, volume and atmosphere preferences remain intact. Sound Studio offers six named auditions, a real waveform, room identity and Quiet, Balanced and Immersive mixes. Immersive enables optional atmosphere at 35 percent with 55 percent master volume. Ordinary sound enablement does not silently change atmosphere preferences. Settings stay in this browser.

Films and explicitly enabled local music studies own output: cues and rooms stop, including pending decodes. Hidden tabs suspend; returning to visibility alone does not resume audio. A supported gesture can resume an enabled score. Idle audio suspends. Cleanup closes the context, aborts requests, stops sources and removes listeners and timers. Asset failure is silent and never blocks navigation.

## Verification and limits

- 194 unit checks pass, covering deterministic PCM, headroom/DC/seams, consent, cancellation, room handoffs, media priority and Passage state.
- Production TypeScript and Vite build passes.
- 86 focused Chromium checks pass with zero page errors: real output measurements, six pads, eight rooms, travel filter/pan, relay/inspection actions, six chapter portal/arrival pairs, film priority, volume, mute, hidden-tab recovery, mobile/reduced-motion controls, all 33 audio endpoints and disposal.
- Audition peaks at 45 percent master range from 0.184 to 0.334 full scale. Five overlapping cues at full master peak at 0.875. These are measured browser levels, not claims about physical speaker loudness.
- UI captures and a browser-recorded audio reel: output/playwright/sonic-v2/. Authored audition reel and cue sheet: .impeccable/review/sonic-score-v2/.

No new runtime dependency, synthesis loop, convolution or visual renderer is added. Browser checks cover Chromium with mobile-sized emulation. Physical iOS/Android devices and subjective headphone preference were not independently auditioned.
