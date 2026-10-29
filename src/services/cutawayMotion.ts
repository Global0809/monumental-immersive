export type CutawayTarget = { surface: string; x: number; y: number; z: number; radius: number };
export type CutawayState = CutawayTarget & { strength: number };

/** One render-clock envelope. Nearby motion follows the actual picked surface;
 * unrelated surfaces close before handing off instead of dragging an open cut
 * through empty space. The returned state is reused, without per-frame timers. */
export function createCutawayMotion() {
  const state: CutawayState = { surface: '', x: 0, y: 0, z: 0, radius: 0, strength: 0 };
  let pending = '', pendingAge = 0;
  function reset() {
    state.surface = ''; state.radius = 0; state.strength = 0;
    pending = ''; pendingAge = 0;
  }
  function acquire(target: CutawayTarget) {
    state.surface = target.surface; state.x = target.x; state.y = target.y; state.z = target.z;
    state.radius = target.radius; state.strength = 0; pending = ''; pendingAge = 0;
  }
  return {
    reset,
    sample(target: CutawayTarget | null, delta: number): CutawayState {
      const dt = Number.isFinite(delta) ? Math.max(0, Math.min(.05, delta)) : 0;
      const valid = target && target.radius > 0 && [target.x, target.y, target.z, target.radius].every(Number.isFinite);
      if (!valid) {
        pending = ''; pendingAge = 0;
        state.strength *= Math.exp(-30 * dt);
        if (state.strength < .006) reset();
        return state;
      }
      if (!state.surface || state.strength < .006) acquire(target);
      const distance = Math.hypot(target.x - state.x, target.y - state.y, target.z - state.z);
      const discontinuity = state.surface !== target.surface || distance > Math.max(5, state.radius * 2.5);
      if (discontinuity) {
        // A fleeting hit at a moving relay's silhouette must not flip the
        // entire reveal between the relay and the distant tunnel behind it.
        if (pending !== target.surface) { pending = target.surface; pendingAge = 0; }
        pendingAge += dt;
        if (pendingAge < .035) return state;
        state.strength *= Math.exp(-55 * dt);
        if (state.strength < .035) acquire(target);
        return state;
      }
      pending = ''; pendingAge = 0;
      // Focus itself stays on the ray/surface intersection. Smoothing screen
      // coordinates upstream avoids a world-space chord cutting inside a wall.
      state.x = target.x; state.y = target.y; state.z = target.z;
      const response = 1 - Math.exp(-22 * dt);
      state.radius += (target.radius - state.radius) * response;
      state.strength += (1 - state.strength) * response;
      return state;
    },
  };
}
