import { CubicBezierCurve3, Vector3 } from 'three';

export const portalPositions: readonly [number, number, number][] = [
  [-8.8, 2.05, -5.4], [-6.7, 2.05, -13.6], [-2.65, 2.05, -20],
  [2.65, 2.05, -20], [6.7, 2.05, -13.6], [8.8, 2.05, -5.4],
];

/** A doorway's arrival shot IS its resting shot. Never return to the lobby
 * after the router mounts the room. Fixed focal length avoids lens breathing. */
export function doorwayPose(index: number, mobile: boolean) {
  const target = new Vector3(...portalPositions[Math.max(0, Math.min(5, index))]);
  const front = new Vector3(0, 2.05, 4.5).sub(target).normalize();
  const position = target.clone().addScaledVector(front, mobile ? 9.4 : 5.8);
  position.y += .12;
  return { position, target };
}

/** Zero velocity and acceleration at both ends; monotonic, no overshoot. */
export function cameraEase(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  return p * p * p * (p * (p * 6 - 15) + 10);
}
/** Approach the central screens along the side of the sculpture, not through it. */
export function doorwayFlight(from: Vector3, to: Vector3, index: number) {
  const side = index < 3 ? -1 : 1;
  const bow = index === 2 || index === 3 ? 3.5 : 1.1;
  const a = from.clone().lerp(to, .28);
  const b = from.clone().lerp(to, .73);
  a.x += side * bow; b.x += side * bow;
  a.y += .22; b.y += .16;
  return new CubicBezierCurve3(from.clone(), a, b, to.clone());
}
export const CAMERA_TRAVEL_MS = 1100;

/** Cross-room moves follow the open aisle, bowing towards the visitor to
 * avoid the central sculpture. They start at the actual rendered camera. */
export function roomFlight(from: Vector3, to: Vector3) {
  const a = from.clone().lerp(to, .28);
  const b = from.clone().lerp(to, .72);
  const crossesCenter = from.x * to.x < 0 && Math.abs(from.x - to.x) > 5;
  if (crossesCenter) {
    a.z = Math.max(a.z, -1.5); b.z = Math.max(b.z, -1.5);
    a.y = Math.max(a.y, 3.1); b.y = Math.max(b.y, 3.1);
  }
  return new CubicBezierCurve3(from.clone(), a, b, to.clone());
}

export function observatoryPose(mobile: boolean, overhead = false) {
  return overhead
    ? { position: new Vector3(0, mobile ? 24 : 26, 4), target: new Vector3(0, 0, -11) }
    : { position: new Vector3(0, 2.65, 5.1), target: new Vector3(0, 2.25, -12) };
}
