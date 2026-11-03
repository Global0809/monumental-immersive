import { TUNNEL_STATION_IDS, tunnelStationZ } from './tunnelJourney';

/** The permanent gate planes and their real axial service clearance. The
 * blade backs, front trim, hinge pins and bearings occupy this entire slab.
 * Fixed lining and ribs must not share it as the aperture opens or closes. */
export const PASSAGE_IRIS_PLANES = [-7, ...TUNNEL_STATION_IDS.map((_, index) => tunnelStationZ(index) + 23)] as const;
export const PASSAGE_IRIS_AXIAL_BOUNDS = [-.45, .525] as const;
const clearance = .035;

export function passageIrisSlotOverlaps(z: number, halfDepth: number) {
  return PASSAGE_IRIS_PLANES.some(plane =>
    z + halfDepth > plane + PASSAGE_IRIS_AXIAL_BOUNDS[0] - clearance &&
    z - halfDepth < plane + PASSAGE_IRIS_AXIAL_BOUNDS[1] + clearance);
}
