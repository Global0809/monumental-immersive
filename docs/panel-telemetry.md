# Architectural LED telemetry

The Passage's existing spiral lining and entrance iris leaves become inset LED surfaces. The existing near-black metal, warm ivory and signal red remain the palette. Digit streams, compact calculation rows, status traces and refresh sweeps are decorative authored motion, not a claim about live analytics or operational backend activity.

## Foundation

The 1,080 lining panels and 56 iris leaves retain their instanced geometry and draw batches. A shared, deterministic bitmap glyph atlas supplies both material treatments. The display is added to the physical materials' emissive contribution, not as a screen overlay or a separate panel mesh. Lining UVs stay in each panel's local coordinates; iris UVs follow the original blade shape. Instance seeds keep panels varied without random per-frame texture generation.

The material map remains unset so the existing structural X-ray can still patch these shell materials. Shader hooks compose with the previous material callback and preserve Three's standard chunks. When a shell is cut away, its LED face is removed with it, exposing the same existing interior.

## Behaviour and hierarchy

The existing scene clock drives all movement, including idle activity. No additional requestAnimationFrame, animation timeline, React scroll state, video decoder, texture upload loop or audio cue is added. Cursor proximity gently changes local energy. Reading positions reduce display prominence, and distant geometry drops fine detail. Light-quality mode reduces complexity. Compact and reduced-motion presentations use a static display state; inspection freezes the existing clock. Hidden and paused scenes follow the existing renderer lifecycle.

Cultural footage, poster textures, accessible chapter copy and controls keep their original material and interaction ownership. The optional display does not intercept input. A shared atlas lease is released only after both material owners dispose, and each material restores its prior shader hooks.

Four reusable screen-space bounds follow the actual header, wayfinder and visible editorial DOM after CSS3D projection. Only the display emission fades inside these bounds, with a soft edge; no opaque sheet covers the architecture. This keeps the opening outlined headline and chapter text readable as the camera moves.

## Verification

- TypeScript and all 243 unit tests pass, including six atlas, shader, protection, update and cleanup tests. Production build passes; the pre-existing Three.js chunk-size warning remains.
- Combined browser review: 25 checks pass with no runtime or WebGL errors. Covers idle animation, physical panel instancing, cursor response, X-ray/media composition, direct station jumps, reverse scrolling, hidden-tab and route lifecycle, compact and reduced motion.
- Readability tuning confirmation: 11 checks pass, with opening, World and Music captures reviewed. Header, headline and supporting copy remain readable while unprotected panels retain their activity.
- Opening draw calls remain 113; World reading draw calls remain 156. The addition uses one shared 128 x 64 glyph texture, with no additional framebuffers or geometry draws. Distant fine detail is culled.
- Compact 390 x 844 and reduced-motion browser emulation retain six accessible chapters, static glyphs and no horizontal overflow. These are browser checks, not a physical-device or universal frame-rate guarantee.

Evidence: `output/playwright/panel-telemetry/{baseline,final,confirmation}`. The preceding release is preserved at `backup/panel-telemetry-before-20261030`.
