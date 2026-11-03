import { passageBayExpansion } from './passageEnvelope';
import { passageIrisSlotOverlaps } from './passageThresholdLayout';

/** The sparse housing and its hidden service kit share these physical cells.
 * Keep the original pitch and service-bay radius so parked carriers retain
 * their clearance. Only occupied cells contain a wall or internal hardware. */
export const PASSAGE_LINING = {
  rows: 90, lanes: 12, occupiedPerRow: 4, pitch: 3.65, start: 18, wallOffset: 1.35,
  wallWidth: .80, wallThickness: .66, wallDepth: 1.60,
} as const;

export function passageLiningOccupied(row: number, lane: number) {
  return row >= 0 && row < PASSAGE_LINING.rows && lane >= 0 && lane < PASSAGE_LINING.lanes
    && Number.isInteger(row) && Number.isInteger(lane) && lane % 3 === row % 3
    && !passageIrisSlotOverlaps(PASSAGE_LINING.start - row * PASSAGE_LINING.pitch - PASSAGE_LINING.wallOffset, PASSAGE_LINING.wallDepth / 2);
}

export function passageRibOccupied(row: number) {
  return row >= 0 && row < PASSAGE_LINING.rows && Number.isInteger(row) && row % 2 === 0
    && !passageIrisSlotOverlaps(PASSAGE_LINING.start - row * PASSAGE_LINING.pitch, row % 4 === 0 ? .20 : .10);
}

export function passageLiningCell(row: number, lane: number) {
  const z = PASSAGE_LINING.start - row * PASSAGE_LINING.pitch - PASSAGE_LINING.wallOffset;
  const angle = lane * Math.PI / 6 + row * .058;
  const radius = 8.8 + Math.sin(row * .46) * .34 + passageBayExpansion(z);
  const span = 2 * radius * Math.sin(Math.PI / 12) * .95;
  return { row, lane, z, angle, radius, span };
}

export const PASSAGE_LINING_CELLS = Array.from({ length: PASSAGE_LINING.rows }, (_, row) =>
  Array.from({ length: PASSAGE_LINING.lanes }, (_, lane) => lane)
    .filter(lane => passageLiningOccupied(row, lane))
    .map(lane => passageLiningCell(row, lane))).flat();
