const clamp = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

/** Reconstructs the threshold from position, including reverse and instant jumps.
 * The opening completes ten metres before its plane, leaving camera clearance. */
export function passageIrisOpening(cameraZ: number, gateZ: number) {
  if (!Number.isFinite(cameraZ) || !Number.isFinite(gateZ)) return 1;
  return 1 - smooth((cameraZ - gateZ - 10) / 18);
}

/** The front surface returns to the exact authored reading plane. No spring,
 * elapsed time or overshoot can displace footage during a reading hold. */
export function passageScreenExtension(reveal: number) {
  return smooth((clamp(reveal) - .14) / .72);
}

export function relayPartIndex(index: number | null) {
  return index !== null && Number.isInteger(index) && index >= 0 && index < 6 ? index : null;
}

export type RelayAutomation = { open: boolean; part: number | null; pull: number; phase: number };
/** One quiet mechanical sequence, sampled from visible scene time. No timers,
 * audio or UI state are needed, and each shell returns before the next moves. */
export function sampleRelayAutomation(time: number, output: RelayAutomation) {
  const phase = Number.isFinite(time) ? Math.max(0, time) % 16 : 0;
  output.phase = phase; output.open = phase >= 1.2 && phase < 12;
  output.part = null; output.pull = 0;
  if (phase >= 2.8 && phase < 11.2) {
    const step = (phase - 2.8) / 1.4;
    output.part = Math.min(5, Math.floor(step));
    const local = step - Math.floor(step);
    output.pull = smooth(local / .35) * (1 - smooth((local - .65) / .35));
  }
  return output;
}

/** Once per cycle, one local mechanism unfolds, attends, then returns. */
export function mechanismAwakening(time: number, index: number) {
  if (!Number.isFinite(time)) return 0;
  const cycle = ((time + index * 2.71) % 19 + 19) % 19;
  return smooth(cycle / 1.4) * (1 - smooth((cycle - 2.7) / 1.9));
}
