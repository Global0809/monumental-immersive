import { PASSAGE_CHAPTERS } from './passageChapters';
import { tunnelChapterZ, tunnelEntranceZ, type TunnelFrame } from './tunnelJourney';

export type PassageAssembly = Readonly<{
  deployment: number; release: number; spine: number; hinges: number;
  leaves: number; screen: number; lock: number; content: number; visible: boolean;
}>;
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : value === Infinity ? 1 : 0;
const ease = (value: number) => { const p = clamp(value); return p * p * p * (p * (p * 6 - 15) + 10); };
const stage = (value: number, start: number, end: number) => ease((value - start) / (end - start));

/** The one mechanism score. Its input is a linear phase, not an already eased
 * camera distance: easing a camera, then deployment, then each joint made the
 * old sequence race through most of its movement in a few scroll pixels.
 * The renderer may bound this phase during a skipped scroll while retaining
 * the exact same poses for the hardware, editorial face and sound crossings. */
export function sampleAssemblyDeployment(value: number, visible = true): PassageAssembly {
  const deployment = clamp(value);
  return {
    deployment,
    release: stage(deployment, 0, .16),
    spine: stage(deployment, .08, .40),
    hinges: stage(deployment, .20, .52),
    leaves: stage(deployment, .36, .68),
    screen: stage(deployment, .58, .82),
    lock: stage(deployment, .74, .94),
    // Whole words resolve only after the physical doors and screen have cleared.
    content: stage(deployment, .86, 1),
    visible,
  };
}

/** A physical assembly score shared by the machine, its editorial face and
 * sound crossings. All poses are reconstructed from native-scroll coordinates;
 * stopping, reversing and skipping cannot leave a timed sequence behind. */
export function samplePassageAssembly(index: number, frame: Pick<TunnelFrame, 'active' | 'progress'>): PassageAssembly {
  const i = Math.max(0, Math.min(5, Number.isFinite(index) ? Math.floor(index) : 0));
  const active = Math.max(-1, Math.min(5, Number.isFinite(frame.active) ? Math.floor(frame.active) : -1));
  const p = clamp(frame.progress), z = active < 0 ? tunnelEntranceZ(p) : tunnelChapterZ(active, p);
  const distance = z - PASSAGE_CHAPTERS[i].center[2];
  // Adjacent checkpoints meet at a stowed pose. Only this station's approach
  // opens it; using its linear scroll fraction gives every actuation room to
  // read. Retraction remains tied to physical clearance before camera crossing.
  const deployment = active === i ? clamp(p / .38) * stage(distance, 8, 11.2) : 0;
  return sampleAssemblyDeployment(deployment, distance > -26 && distance < 88);
}
