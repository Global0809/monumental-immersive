import { spatialRoomForPath } from './spatial';

/** Route parameters refine a room; they never trigger a camera journey. */
export function spatialPassagePlan(from: string, to: string, reducedMotion = false) {
  const source = from.split('?')[0] || '/';
  const destination = to.split('?')[0] || '/';
  const changed = source !== destination;
  const room = spatialRoomForPath(destination);
  const crossRoom = spatialRoomForPath(source) !== room;
  return {
    changed, room, crossRoom,
    duration: !changed || reducedMotion ? 0 : crossRoom ? (source === '/' ? 1000 : 820) : 230,
  };
}
