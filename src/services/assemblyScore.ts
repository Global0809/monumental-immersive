import { samplePassageAssembly, type PassageAssembly } from './passageAssembly';
import type { TunnelFrame } from './tunnelJourney';

export type AssemblySound = 'assembly-release' | 'assembly-drive' | 'assembly-lock' | 'sculpture-fold';
export type AssemblySoundOutput = (type: AssemblySound, pan: number, intensity: number) => void;
type Actuation = { field: keyof Pick<PassageAssembly, 'release' | 'hinges' | 'screen' | 'lock'>; threshold: number; open: AssemblySound; close: AssemblySound; intensity: number };
const actuations: readonly Actuation[] = [
  { field: 'release', threshold: .58, open: 'assembly-release', close: 'assembly-lock', intensity: .61 },
  { field: 'hinges', threshold: .3, open: 'assembly-drive', close: 'sculpture-fold', intensity: .7 },
  { field: 'screen', threshold: .38, open: 'assembly-drive', close: 'sculpture-fold', intensity: .63 },
  { field: 'lock', threshold: .68, open: 'assembly-lock', close: 'assembly-release', intensity: .79 },
];
const foldingActuations = [...actuations].reverse();

/** Short actuations at real mechanism crossings. No queued score or timer: a
 * fast scroll coalesces to the last significant physical action in that sample.
 * A stage must leave a small hysteresis band before it can sound again. */
export function createAssemblyScore(output: AssemblySoundOutput) {
  let previous: TunnelFrame | null = null, lastCue = -Infinity;
  let lastLockStation = -1, lastLock = -Infinity;
  const state = new Map<string, boolean>();
  function baseline(index: number, pose: PassageAssembly) {
    actuations.forEach(({ field, threshold }) => state.set(`${index}/${field}`, pose[field] >= threshold));
  }
  return {
    sample(frame: TunnelFrame, now: number, allowed: boolean) {
      const last = previous; previous = frame;
      if (frame.active < 0 || frame.active > 5) return;
      const index = frame.active, pose = samplePassageAssembly(index, frame);
      if (!last || !allowed || frame.compact || frame.compact !== last.compact) { baseline(index, pose); return; }
      if (last.active !== index) baseline(index, samplePassageAssembly(index, last));
      const opening = pose.deployment >= samplePassageAssembly(index, last).deployment;
      let selected: Actuation | undefined;
      // Ascending stage order during opening, descending during folding. The
      // latest crossed stage wins, including an instantaneous station jump.
      const sequence = opening ? actuations : foldingActuations;
      for (const action of sequence) {
        const key = `${index}/${action.field}`, old = state.get(key) ?? false, value = pose[action.field];
        const next = value > action.threshold + .035 ? true : value < action.threshold - .035 ? false : old;
        state.set(key, next);
        if (next !== old && next === opening) selected = action;
      }
      if (!selected || now - lastCue < 165 || !Number.isFinite(now)) return;
      lastCue = now;
      const type = opening ? selected.open : selected.close;
      const side = index % 2 ? .35 : -.35;
      output(type, side * (opening ? 1 : -1), selected.intensity * (opening ? 1 : .82));
      if (opening && selected.field === 'lock') { lastLockStation = index; lastLock = now; }
    },
    lockedRecently(index: number, now: number) { return lastLockStation === index && now - lastLock < 1000; },
    reset() { previous = null; state.clear(); lastCue = -Infinity; lastLockStation = -1; lastLock = -Infinity; },
  };
}
