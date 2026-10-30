# Monumental sound score II

Historical release notes. This mechanical palette was replaced by the [minimal sound palette](sound-score.md). Its assets and renderer remain recoverable from `backup/sound-before-minimal-20261030`; they are no longer shipped.

The score gives the Passage a mechanical, architectural sound vocabulary. Thirty-one short stereo gestures use the same physical materials in different arrangements: magnetic contact, low-mid pressure, articulated chrome, filtered air, optical registration and a restrained memory resonance. These are original deterministic synthesis, not recordings of actual machinery, stock effects or generated sample-library audio.

Portal, scan, signal and arrival established the spatial score. The articulated-portal edition adds assembly release, drive and lock, iris opening and closing, and threshold passage. Existing action names are preserved so saving, removing, opening, closing, searching, selecting eras and sculptural interaction keep their established semantic meaning. Repeated contacts are short; spatial gestures have more body and a controlled tail. No cue exceeds 1.65 seconds.

One four-second circular motion field combines low pressure, detuned bearing modes and irregular brushed-metal airflow. It is shaped continuously from actual scroll velocity and direction rather than retriggering a short whoosh. Only one motion source can exist; it releases at rest and stops for mute, media, hidden tabs and teardown. Its source peak is -10.75 dBFS and RMS is -23.56 dBFS, before the velocity envelope and master mix.

Eight optional, eight-second atmosphere loops cover Home, World, Time, Library, Cinema, Music, Culture and Collection. Each has its own pressure register, texture, spectral opening and slow movement. They are authored environments, not an assertion of audio-reactive music. The runtime controls their activation, chapter changes, motion response, consent, volume and playback priority separately.

## Source and rendering

- `src/services/sonicScore.ts` is the complete cue/scene manifest and versioned asset path.
- `scripts/sonic-materials.ts` contains the deterministic offline instruments and recipes. Damped, slightly beating modal bodies supply material character; shaped noise supplies air and bearings. Short stereo reflections provide depth while preserving a strong mono centre.
- `node --import tsx scripts/render-sonic-score.ts` reproduces all 40 WAV files in `public/audio/score-v2/`. Assets are 32 kHz, 16-bit stereo PCM. The complete bank is 11.26 MiB; the website requests assets individually through its consent-gated cache.
- The script also writes a spaced audition reel, timestamped cue sheet and numerical signal report into `.impeccable/review/sonic-score-v2/`. These review files are not served with the website.
- The previous bank is retained in Git branch `backup/audio-before-20261030`.

## Signal verification

`tests/sonic-materials.test.ts` checks every shipped WAV against its freshly rendered PCM, validates exact duration and finite samples, verifies zero cue endpoints and bounded DC offset, checks meaningful RMS energy, distinct recipes and mono compatibility, and verifies loop continuity.

The rendered cue peaks range from -11.70 to -3.74 dBFS. Whole-file RMS ranges from -25.04 to -15.90 dBFS before the runtime mix. The stereo-to-mono RMS ratio is at least 0.99 across the cues, so small mono speakers retain their body. Room peaks are -18.42 dBFS with approximately -31 to -29.5 dBFS RMS. Each room uses a half-second overlap and a four-millisecond seam conditioning region; the first-to-last sample difference is below 0.002 full scale. Cue endpoints taper cleanly over 26 milliseconds.

Numerical checks establish continuity, headroom and consistency. Subjective headphone and speaker preference remains a separate listening judgement; these measurements are not a claim that the score has been personally auditioned on all devices.
