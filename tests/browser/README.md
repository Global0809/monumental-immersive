# Browser verification

Run `npm run build`, then `npm run preview -- --port 5174`. The examples below use PowerShell. Tests create isolated browser profiles and write local evidence; they do not operate the user's normal browser profile. Chrome is the default installed browser channel.

```powershell
$env:SITE_URL = 'http://127.0.0.1:5174/'
node tests/browser/verify-ui.mjs
node tests/browser/verify-moments.mjs
$env:BASE_URL = 'http://127.0.0.1:5174'
node tests/browser/verify-catalogue-interactions.mjs
```

`verify-ui` covers navigation, categories, search, saves, journeys, local playback and narrow layouts. `verify-moments` covers transcripts and saved timestamps. `verify-catalogue-interactions` covers composition input, search debounce, filter reset, Back and sorting. The root `npm test` command validates catalogue/media data, transcript parsing, moments and sound preference persistence.

`verify-recovery.mjs` targets the Vite development server because it blocks named source modules to simulate lazy-loading failures. It also tests blocked storage, recovery focus, shortcuts and transition cleanup. Read its environment options before running.

`verify-media-cleanup.mjs` checks repeated player close, native decoder destruction, caption-tree collection, resume, queue changes, Picture-in-Picture exit and preview retirement. SITE_URL selects the build; BASELINE_URL optionally adds an older-build comparison. It does not require a baseline server by default.

`verify-full-playback.mjs http://127.0.0.1:5174` takes approximately 25 minutes. It plays both complete remote guest films at normal speed, never seeks and records native ended events, queue continuation, frame statistics and history. Keep the served build frozen for the entire run. Remote network availability affects this check.

`verify-production-performance.mjs` measures cold rendering and command response on desktop and simulated narrow/4x-CPU profiles, with an additional network-throttled profile. Set SITE_URL to a production preview. These are synthetic local measurements, not field Core Web Vitals or a device-lab benchmark.

`verify-endurance.mjs` exercises the production build for 30 minutes, including real inactivity and an attempted background-tab transition. Headless browsers that keep the original document visible report that visibility test as unsupported. It samples post-GC heap, event listeners, audio state and connected/detached WebGL contexts. Keep its build frozen during the run.

The audio-runtime and audio-composer scripts capture and numerically analyze synthesized sound. They verify consent, cue separation, stereo response, voice cleanup and silence around playback. The sound-agent scripts are targeted interaction/layout audits from this implementation pass.

`verify-audio-idle-resume.mjs` performs a real 100-second idle on Settings, then checks that the first trusted audition resumes the native context and emits a queued sound pulse. It records activation and native promise timing without replacing application behavior; SITE_URL selects the frozen production preview.

Evidence is generated under `test-results/`, `.openai/*-qa/`, `.openai/integration-review/`, `output/playwright/` and `.playwright-cli/`; those outputs are ignored by source control. See VERIFICATION.md for actual completed checks and their limits.
