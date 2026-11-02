# Passage formation and wormhole refinement

The previous source remains recoverable at commit `d9c5f3818866282d4c31a842d9a49c15963c9979` (Sites v66).

## Mechanical reveal

The old score eased camera distance, then deployment, then each joint. That concentrated most mechanical travel into short intervals. `passageAssembly.ts` now maps the approach directly to a linear phase and gives release, rails, hinges, armor, screen, clamps and content their own broader intervals. The stable reading plateau and safe pre-crossing retraction remain intact.

`assemblyPresentation.ts` reconciles that target inside the existing rendering loop. Normal scrolling and reversals remain responsive; a skipped approach unfolds at a bounded speed instead of instantly producing a complete screen. It introduces no additional scroll handler, animation loop, React frame state or scroll lock. First restored positions, compact and reduced-motion content resolve directly. Inspection freezes the mechanism. Closing and departure immediately respect the physical clearance envelope, so a wider mechanism cannot lag behind an already retracted carrier.

The same resolved poses drive the instanced hardware, WebGL screen/backing, accessible CSS3D content and input readiness. The solid editorial drawer deploys before its words appear. The image illuminates as its cassette seats; media loaded later has a short bounded illumination ramp. The screen keeps its aspect ratio, original colour at full illumination and existing player action. A tiny black placeholder map avoids adding a first-image shader variant, while image/video map changes retain Three's required video colour decoding.

After completion, one thin registration trace travels around the physical bezel and retires. It adds one draw only while visible, does not cover the footage, and stays off for reduced motion. Small movements at the reading boundary cannot repeatedly flash it.

## Wormhole

The existing cloud field is now a 512px precomputed multiscale texture with billows, curls, fine turbulence and wisps. Directional copper/slate crests and antialiased filament accents give the folds more definition. Detail fades toward the throat; anisotropy is capped at four. The implementation retains two draws, one texture, three fragment texture samples, the existing mouse parallax and the early cloud/opaque-metal depth ordering. No post-processing pass or renderer was added.

## Verification

The production TypeScript/Vite build passes. Unit coverage includes staged timing, bounded skipped arrivals, restored state, pause, departure clearance, finish retirement, actual instanced shutter separation and screen/housing clearance. Browser evidence is recorded under `output/playwright/passage-formation/` and `output/playwright/wormhole-refinement/`; final run totals are in their reports. Desktop, compact and reduced-motion checks use Chromium, with mobile sizes emulated. These checks do not establish a universal physical-device frame rate.

The complete unit run passed 269/269; after the final closing-envelope correction, the eight affected presentation/housing/shutter checks also pass, including the added reverse-envelope case. Browser formation review passes 57/57 and the final six-chapter reverse-clearance review passes 13/13, without runtime or shader errors. A skipped Culture arrival contains 226 intermediate observed samples, with a maximum observed phase increment of .013. Controls wait for the seated clamp; the finishing trace starts once and retires. Reading draws range from 93 to 170 in that review. Evidence: `output/playwright/passage-formation/results.json` and `output/playwright/passage-formation-reverse/results.json`.

The final wormhole GPU/browser regression passes 56/56 with no runtime or shader errors: actual draw order, depth writes/tests, perspective geometry, two-pass parallax continuity, click/leave behavior, inspection suspension, route cleanup, narrow desktop, touch-compact and reduced motion. Report: `output/playwright/wormhole-formation-final/results.json`.
