import { tunnelStationZ } from './tunnelJourney';

const centers = Array.from({ length: 6 }, (_, index) => tunnelStationZ(index));

/** Real service bays leave room for a complete parked or deployed carrier.
 * The shell, its inner hardware and the inspection ray share this envelope. */
export function passageBayExpansion(z: number) {
  let distance = Infinity;
  for (const center of centers) distance = Math.min(distance, Math.abs(z - center));
  const t = Math.max(0, Math.min(1, (distance - 10) / 12));
  return 4.4 * (1 - t * t * t * (t * (t * 6 - 15) + 10));
}

export function passageLiningRadius(z: number) {
  return 8.97 + passageBayExpansion(z);
}

// Dynamic GPU rails use the same authored bays as the CPU shell and ray probe.
export const passageEnvelopeGLSL = `
float passageBayExpansion(float z) {
  float distance = ${centers.map(center => `abs(z - (${center.toFixed(1)}))`).reduce((a, b) => `min(${a}, ${b})`)};
  float t = clamp((distance - 10.0) / 12.0, 0.0, 1.0);
  return 4.4 * (1.0 - t*t*t*(t*(t*6.0-15.0)+10.0));
}`;
