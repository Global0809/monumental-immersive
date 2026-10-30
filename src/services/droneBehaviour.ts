export type DroneActivity = { perch: number; inspect: number; signal: number; state: 'fly' | 'approach' | 'inspect' | 'signal' | 'depart' };
const smooth = (x: number) => { const p = Math.max(0, Math.min(1, x)); return p * p * (3 - 2 * p); };
export const DRONE_SERVICE_PERIOD = 26;
export const droneServiceMember = (time: number) => Math.floor((Number.isFinite(time) ? Math.max(0, time) : 0) / DRONE_SERVICE_PERIOD) % 4;

/** One member tends a service dock at a time. Pure phase sampling means paused
 * tabs never queue actions and interruption cannot strand a timed sequence. */
export function droneActivity(time: number, member: number, output: DroneActivity): DroneActivity {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
  const slot = droneServiceMember(safeTime), phase = safeTime % DRONE_SERVICE_PERIOD;
  output.perch = output.inspect = output.signal = 0; output.state = 'fly';
  // Flight is the default. Brief service visits begin only after nine seconds
  // together, and leave nineteen of every twenty-six seconds entirely airborne.
  if (slot !== member || phase < 9 || phase >= 16) return output;
  if (phase < 11) { output.perch = smooth((phase - 9) / 2); output.state = 'approach'; }
  else if (phase < 12.4) { output.perch = 1; output.inspect = Math.sin((phase - 11) / 1.4 * Math.PI); output.state = 'inspect'; }
  else if (phase < 13.2) { output.perch = 1; output.signal = Math.sin((phase - 12.4) / .8 * Math.PI) ** 2; output.state = 'signal'; }
  else { output.perch = 1 - smooth((phase - 13.2) / 2.8); output.state = 'depart'; }
  return output;
}

export type DroneFlightSample = { x: number; y: number; z: number; vx: number; vy: number; vz: number };
// A closed spatial patrol with a rising reveal, near pass, lower return and
// deeper retreat. Catmull tangents keep direction continuous at every waypoint.
const route = [
  [-1.02, -.10, -.85], [-.76, .58, -1.15], [.05, .86, -.50], [.95, .35, .48],
  [.83, -.45, .90], [.05, -.81, .20], [-.80, -.56, -.65], [-1.13, -.05, -1.0],
] as const;
const routeDuration = 22;
const delays = [0, 1.1, 1.5, 2.4];
const axisNames = ['x', 'y', 'z'] as const, speedNames = ['vx', 'vy', 'vz'] as const;

/** Allocation-free authored flight. Adults lead/follow; scouts inherit the
 * route with a delay and make small independent curved excursions. */
export function sampleDroneFlight(time: number, member: number, output: DroneFlightSample) {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0, index = Math.max(0, Math.min(3, Math.floor(member) || 0));
  const phase = (((t - delays[index]) % routeDuration) + routeDuration) % routeDuration / routeDuration * route.length;
  const segment = Math.floor(phase), f = phase - segment, f2 = f * f, f3 = f2 * f;
  const p0 = route[(segment + route.length - 1) % route.length], p1 = route[segment];
  const p2 = route[(segment + 1) % route.length], p3 = route[(segment + 2) % route.length];
  for (let axis = 0; axis < 3; axis++) {
    const a = 2 * p1[axis], b = -p0[axis] + p2[axis];
    const c = 2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis], d = -p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis];
    output[axisNames[axis]] = .5 * (a + b * f + c * f2 + d * f3);
    output[speedNames[axis]] = .5 * (b + 2 * c * f + 3 * d * f2) * route.length / routeDuration;
  }
  if (index >= 2) {
    const phase = t * .91 + index * 2.1;
    output.x += Math.sin(phase) * .29; output.vx += Math.cos(phase) * .29 * .91;
    output.y += Math.sin(phase * 2) * .20; output.vy += Math.cos(phase * 2) * .20 * 1.82;
    output.z += Math.cos(phase) * .31; output.vz -= Math.sin(phase) * .31 * .91;
  }
  return output;
}

type Point3 = { x: number; y: number; z: number };
/** Avoid overlapping silhouettes as curious companions approach the same
 * point. Caller owns screen bounds and applies its existing spring afterward. */
export function separateDroneTargets(points: readonly Point3[], radii: readonly number[]) {
  for (let pass = 0; pass < 2; pass++) for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) {
    const first = points[a], second = points[b], minimum = (radii[a] ?? 0) + (radii[b] ?? 0);
    let dx = second.x - first.x, dy = second.y - first.y;
    const distance = Math.hypot(dx, dy);
    if (!(minimum > 0) || distance >= minimum) continue;
    if (distance < .0001) { dx = (a + b) % 2 ? 1 : -1; dy = 0; }
    else { dx /= distance; dy /= distance; }
    const displacement = (minimum - distance) * .5;
    first.x -= dx * displacement; first.y -= dy * displacement;
    second.x += dx * displacement; second.y += dy * displacement;
  }
}
