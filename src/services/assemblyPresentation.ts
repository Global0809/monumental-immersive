import { sampleAssemblyDeployment, samplePassageAssembly, type PassageAssembly } from './passageAssembly';
import { type TunnelFrame, tunnelChapterZ, tunnelStationZ } from './tunnelJourney';

/** A visual actuator, advanced by the existing renderer. Native scroll remains
 * authoritative; skipped approaches get a readable build instead of a pop.
 * Departure must always obey clearance immediately, before camera crossing. */
export function createAssemblyPresentation() {
  const phase = new Float64Array(6), ages = new Float64Array(6).fill(-1);
  const poses: PassageAssembly[] = Array.from({ length: 6 }, () => sampleAssemblyDeployment(0));
  let initialized = false;
  return {
    poses, ages,
    step(frame: Pick<TunnelFrame, 'active' | 'progress'>, delta: number, immediate = false, frozen = false) {
      if (frozen) return poses;
      const dt = Math.max(0, Math.min(.05, Number.isFinite(delta) ? delta : 0));
      for (let i = 0; i < 6; i++) {
        const target = samplePassageAssembly(i, frame), before = phase[i];
        const departing = frame.active === i && tunnelChapterZ(i, frame.progress) < tunnelStationZ(i) + 11.5;
        // A carrier can tuck back into its wall bay on reverse scroll. Never
        // leave a wider, lagging assembly on that already retracted carrier.
        if (!initialized || immediate || frame.active !== i || departing || target.deployment < before) phase[i] = target.deployment;
        else {
          const difference = target.deployment - before;
          const change = difference * (1 - Math.exp(-dt * 9));
          // About 1.35s to unfold a skipped full chapter, followed by a short
          // soft seating. No scroll lock, timer, bounce, or camera displacement.
          phase[i] += Math.max(-dt * 1.8, Math.min(dt / 1.35, change));
          if (Math.abs(target.deployment - phase[i]) < .0001) phase[i] = target.deployment;
        }
        if (!initialized || immediate || frame.active !== i || phase[i] < .985) ages[i] = -1;
        else if (ages[i] < 0 && before < .999 && phase[i] >= .999) ages[i] = 0;
        else if (ages[i] >= 0) ages[i] = Math.min(1.25, ages[i] + dt);
        if (phase[i] !== before || poses[i].visible !== target.visible) poses[i] = sampleAssemblyDeployment(phase[i], target.visible);
      }
      initialized = true;
      return poses;
    },
  };
}
