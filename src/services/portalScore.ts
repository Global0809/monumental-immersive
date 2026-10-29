import { PASSAGE_CHAPTERS } from './passageChapters';
import { passageIrisOpening } from './passageMechanisms';
import type { TunnelFrame } from './tunnelJourney';

export type PortalSound = 'iris-open' | 'iris-close' | 'threshold-pass';
export type PortalSoundOutput = (type: PortalSound, pan: number, intensity: number) => void;
const gates = [-7, ...PASSAGE_CHAPTERS.map(chapter => chapter.center[2] + 23)];

/** Samples the same aperture field as the seven visible irises. Jumps select
 * only the nearest meaningful action, never replay a queue of skipped gates. */
export function createPortalScore(output: PortalSoundOutput) {
  let previous: TunnelFrame | null = null, lastCue = -Infinity;
  const opened = gates.map(() => false);
  const baseline = (z: number) => gates.forEach((gate, i) => { opened[i] = passageIrisOpening(z, gate) > .65; });
  return {
    sample(frame: TunnelFrame, now: number, allowed: boolean) {
      const last = previous; previous = frame;
      if (!last || !allowed || frame.compact || frame.compact !== last.compact || !Number.isFinite(frame.z)) { baseline(frame.z); return; }
      let candidate: { type: PortalSound; distance: number; pan: number; intensity: number } | null = null;
      const direction = Math.sign(frame.z - last.z);
      gates.forEach((gate, i) => {
        const value = passageIrisOpening(frame.z, gate), old = opened[i];
        const next = value > .69 ? true : value < .61 ? false : old;
        opened[i] = next;
        const distance = Math.abs(frame.z - gate);
        const crossed = (last.z > gate && frame.z <= gate) || (last.z < gate && frame.z >= gate);
        const type: PortalSound | null = crossed && distance < 14 ? 'threshold-pass'
          : old !== next && distance < 28 ? next ? 'iris-open' : 'iris-close' : null;
        if (type && (!candidate || distance < candidate.distance)) candidate = {
          type, distance, pan: direction * (i % 2 ? .24 : -.24), intensity: type === 'threshold-pass' ? .58 : .67,
        };
      });
      if (!candidate || now - lastCue < 780 || !Number.isFinite(now)) return;
      lastCue = now;
      const cue = candidate as { type: PortalSound; pan: number; intensity: number };
      output(cue.type, cue.pan, cue.intensity);
    },
    reset() { previous = null; opened.fill(false); lastCue = -Infinity; },
  };
}
