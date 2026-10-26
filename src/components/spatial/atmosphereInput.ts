const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Fixed-size, time-based input envelope; no particle buffers or React state
 * change when the pointer moves. The GPU receives this field once/frame. */
export function createAtmosphereInput() {
  const field = {
    x: 0, y: 0, vx: 0, vy: 0, strength: 0, charge: 0, orbit: 0,
    trail: Array.from({ length: 4 }, () => ({ x: 0, y: 0, strength: 0 })),
    pulse: { x: 0, y: 0, age: 2, power: 0 },
  };
  let targetX = 0, targetY = 0, velocityX = 0, velocityY = 0;
  let active = false, held = false, targetStrength = 1, lastEvent = -1;
  return {
    field,
    move(x: number, y: number, time: number, touch = false) {
      if (![x, y, time].every(Number.isFinite)) return;
      x = clamp(x, -1.1, 1.1); y = clamp(y, -1.1, 1.1);
      if (active && time > lastEvent) {
        const dt = Math.max(.008, (time - lastEvent) / 1000);
        velocityX = (x - targetX) / dt; velocityY = (y - targetY) / dt;
        const limit = Math.min(1, 5 / (Math.hypot(velocityX, velocityY) || 1));
        velocityX *= limit; velocityY *= limit;
      } else {
        field.x = x; field.y = y;
        for (const node of field.trail) { node.x = x; node.y = y; }
      }
      targetX = x; targetY = y; active = true; lastEvent = time;
      targetStrength = touch ? .48 : 1;
    },
    press() { if (active) held = true; },
    release() {
      if (held) {
        field.pulse.x = field.x; field.pulse.y = field.y;
        field.pulse.age = 0; field.pulse.power = .35 + field.charge * .65;
      }
      held = false;
    },
    leave() { active = held = false; velocityX = velocityY = 0; },
    reset() {
      active = held = false; lastEvent = -1; velocityX = velocityY = 0;
      field.vx = field.vy = field.strength = field.charge = 0;
      field.pulse.age = 2; field.pulse.power = 0;
      for (const node of field.trail) node.strength = 0;
    },
    update(seconds: number) {
      const dt = Number.isFinite(seconds) ? clamp(seconds, 0, .05) : 0;
      const follow = 1 - Math.exp(-dt * 24), ease = 1 - Math.exp(-dt * 11);
      field.x += (targetX - field.x) * follow; field.y += (targetY - field.y) * follow;
      field.vx += (velocityX - field.vx) * ease; field.vy += (velocityY - field.vy) * ease;
      velocityX *= Math.exp(-dt * 8); velocityY *= Math.exp(-dt * 8);
      field.strength += ((active ? targetStrength : 0) - field.strength) * ease;
      field.charge += ((held ? 1 : 0) - field.charge) * (1 - Math.exp(-dt * (held ? 3.8 : 9)));
      field.orbit = (field.orbit + dt * field.charge * 1.3) % (Math.PI * 2);
      const energy = Math.min(1, Math.hypot(field.vx, field.vy) * .4) * field.strength;
      let x = field.x, y = field.y, strength = energy;
      for (let i = 0; i < field.trail.length; i++) {
        const node = field.trail[i], lag = 1 - Math.exp(-dt * (13 - i * 1.8));
        node.x += (x - node.x) * lag; node.y += (y - node.y) * lag;
        node.strength += (strength - node.strength) * lag;
        x = node.x; y = node.y; strength = node.strength * .8;
      }
      field.pulse.age = Math.min(2, field.pulse.age + dt);
      if (field.pulse.age >= 1.7) field.pulse.power = 0;
      return field;
    },
  };
}
