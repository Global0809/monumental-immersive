import { PASSAGE_CHAPTERS } from './passageChapters';
import { tunnelChapterZ, tunnelEntranceZ, type TunnelFrame } from './tunnelJourney';

export type PassageAssembly = Readonly<{
  deployment: number; release: number; spine: number; hinges: number;
  leaves: number; screen: number; lock: number; content: number; visible: boolean;
}>;
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : value === Infinity ? 1 : 0;
const ease = (value: number) => { const p = clamp(value); return p * p * p * (p * (p * 6 - 15) + 10); };
const stage = (value: number, start: number, end: number) => ease((value - start) / (end - start));

/** A physical assembly score shared by the machine, its editorial face and
 * sound crossings. All poses are reconstructed from native-scroll coordinates;
 * stopping, reversing and skipping cannot leave a timed sequence behind. */
export function samplePassageAssembly(index: number, frame: Pick<TunnelFrame, 'active' | 'progress'>): PassageAssembly {
  const i = Math.max(0, Math.min(5, Number.isFinite(index) ? Math.floor(index) : 0));
  const active = Math.max(-1, Math.min(5, Number.isFinite(frame.active) ? Math.floor(frame.active) : -1));
  const p = clamp(frame.progress), z = active < 0 ? tunnelEntranceZ(p) : tunnelChapterZ(active, p);
  const distance = z - PASSAGE_CHAPTERS[i].center[2];
  const deployment = (1 - stage(distance, 11.8, 27.5)) * stage(distance, 8, 11.2);
  return {
    deployment,
    release: stage(deployment, .015, .18),
    spine: stage(deployment, .09, .49),
    hinges: stage(deployment, .24, .67),
    leaves: stage(deployment, .40, .82),
    screen: stage(deployment, .61, .94),
    lock: stage(deployment, .86, .995),
    // Content waits for the plates to clear; no text is sliced into shutters.
    content: stage(deployment, .95, .998),
    visible: distance > -26 && distance < 88,
  };
}
