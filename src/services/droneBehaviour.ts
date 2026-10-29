export type DroneActivity = { perch: number; inspect: number; signal: number; state: 'fly' | 'approach' | 'inspect' | 'signal' | 'depart' };
const smooth = (x: number) => { const p = Math.max(0, Math.min(1, x)); return p * p * (3 - 2 * p); };

/** One member tends a service dock at a time. Pure phase sampling means paused
 * tabs never queue actions and interruption cannot strand a timed sequence. */
export function droneActivity(time: number, member: number, output: DroneActivity): DroneActivity {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
  const slot = Math.floor(safeTime / 18) % 4, phase = safeTime % 18;
  output.perch = output.inspect = output.signal = 0; output.state = 'fly';
  if (slot !== member || phase > 15) return output;
  if (phase < 3) { output.perch = smooth(phase / 3); output.state = 'approach'; }
  else if (phase < 8) { output.perch = 1; output.inspect = Math.sin((phase - 3) / 5 * Math.PI); output.state = 'inspect'; }
  else if (phase < 11) { output.perch = 1; output.signal = Math.sin((phase - 8) / 3 * Math.PI) ** 2; output.state = 'signal'; }
  else { output.perch = 1 - smooth((phase - 11) / 4); output.state = 'depart'; }
  return output;
}
