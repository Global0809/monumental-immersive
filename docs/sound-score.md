# Minimal sound palette

This release replaces the mechanical score with six short, original interface gestures and one optional quiet atmosphere. Tactile contact, a small glass confirmation, soft release and filtered air give navigation a consistent, restrained futuristic character. There are no automatic hover ticks, X-ray scans, mechanical impacts, iris drives, arrival chimes or scroll-speed loops. Silence is the normal state between deliberate actions.

## Palette and controls

Sound Studio offers Select, Passage, Memory, Open, Close and Portal, with keyboard auditions 1-6. Existing sound consent and master volume remain in the visitor's control. Quiet and Balanced presets leave atmosphere off. Atmosphere is explicitly optional; a single field continues across chapters instead of repeatedly starting or changing pitch. Existing saved on/off and volume settings are preserved.

The compact PCM bank lives in public/audio/score-v3. The manifest aliases semantic action names to shared assets. Buffers are cached by their resolved asset URL, so several actions using the same voice do not fetch or decode duplicate audio. No audio downloads occur before consent. Old score-v2 assets and their renderer are removed from the shipping tree and preserved by backup/sound-before-minimal-20261030.

## Runtime behaviour

Routine UI sounds have 180ms minimum spacing and at most two simultaneous voices. Panning is limited to a narrow stereo range; pitch is stable unless a visitor deliberately varies an instrument. Explicit musical auditions retain up to four simultaneous voices, so the Rhythm Grid can play chords without interface deduplication dropping notes. The semantic event remains available for synchronized visual feedback.

The previous per-frame Passage score subscription is replaced by chapter-room metadata updates. The compatibility motion hook allocates no voices, timers or audio graphs. Native scrolling, camera movement, mechanical animation and X-ray behaviour remain unchanged.

Films and explicitly enabled sound studies own the audio output. Pending loads cannot restart stale cues after muting, playback, hiding or teardown. Hidden tabs suspend; returning to a visible tab alone does not resume audio. Idle suspension, a gesture-driven resume, silent missing-asset handling and complete resource disposal remain in place. Media soundtrack and user-created sound-tool playback are preserved.

## Verification

237 unit checks pass, including deterministic PCM quality, media/consent lifecycle, silent scrolling, shared buffers and deliberate four-voice studio polyphony. Production TypeScript/Vite builds pass for Sites and GitHub Pages.

23 focused Chromium browser checks pass with no uncaught errors. Six studio auditions produce measured output without clipping; their captured peaks range from 0.032 to 0.087 full scale. Native hover and bidirectional scrolling create no additional audio sources or sonic events. Consent, one optional continuous field, deliberate chapter selection, full-player priority, mute and gesture-driven resume pass. Phone-sized Settings keeps all six controls without horizontal overflow.

Evidence is under output/playwright/minimal-sound, including a browser-output recording and desktop/phone captures. Hidden-tab verification injects document.hidden while exercising the real handlers and AudioContext. Mobile is emulated; physical-device listening was not performed. Measurements describe digital output rather than loudness on a particular speaker or headset.
