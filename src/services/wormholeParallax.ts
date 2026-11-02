export type WormholeParallaxState = Readonly<{ x: number; y: number; vx: number; vy: number }>;

/** Exact critically damped response, advanced only by the owning scene clock.
 * Position and velocity remain continuous across target changes and releases.
 * A paused clock makes no changes; reset is reserved for static presentations. */
export function createWormholeParallax() {
  const state = { x: 0, y: 0, vx: 0, vy: 0 };
  const target = (value: number) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  return {
    state: state as WormholeParallaxState,
    step(delta: number, x: number, y: number): WormholeParallaxState {
      if (!Number.isFinite(delta) || delta <= 0) return state;
      const dt = Math.min(delta, .05), omega = 12, decay = Math.exp(-omega * dt);
      const tx = target(x), ty = target(y);
      const ex = state.x - tx, ey = state.y - ty;
      const cx = state.vx + omega * ex, cy = state.vy + omega * ey;
      state.x = tx + (ex + cx * dt) * decay;
      state.y = ty + (ey + cy * dt) * decay;
      state.vx = (state.vx - omega * cx * dt) * decay;
      state.vy = (state.vy - omega * cy * dt) * decay;
      return state;
    },
    reset() { state.x = state.y = state.vx = state.vy = 0; },
  };
}
