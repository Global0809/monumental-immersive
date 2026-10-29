export type XrayLens = { x: number; y: number; strength: number; time: number };
export const createXrayLens = (): XrayLens => ({ x: 0, y: 0, strength: 0, time: -1 });

/** Critically bounded follow with a separate opacity envelope. The lens keeps
 * its physical radius; it never snaps shut or balloons while following input. */
export function advanceXrayLens(lens: XrayLens, x: number, y: number, on: boolean, now: number, hardOff = false) {
  if (!Number.isFinite(x + y + now)) { lens.strength = 0; lens.time = -1; return false; }
  const dt = lens.time < 0 ? 1 / 60 : Math.max(0, Math.min(.05, (now - lens.time) / 1000));
  lens.time = now;
  if (hardOff) { lens.strength = 0; return false; }
  if (on && lens.strength < .001) { lens.x = x; lens.y = y; }
  if (on) {
    const follow = 1 - Math.exp(-dt * 27);
    lens.x += (x - lens.x) * follow; lens.y += (y - lens.y) * follow;
  }
  const target = on ? 1 : 0;
  lens.strength += (target - lens.strength) * (1 - Math.exp(-dt * (on ? 16 : 22)));
  if (Math.abs(target - lens.strength) < .001) lens.strength = target;
  const moving = on && Math.hypot(x - lens.x, y - lens.y) > .15;
  if (on && !moving) { lens.x = x; lens.y = y; }
  return moving || lens.strength !== target;
}
