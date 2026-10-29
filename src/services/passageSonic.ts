import type { AmbientScene } from './sonicScore';
import type { TunnelFrame } from './tunnelJourney';

const chapterRooms: readonly AmbientScene[] = ['world', 'time', 'cinema', 'music', 'culture', 'collection'];
export const passageRoom = (active: number): AmbientScene => chapterRooms[active] ?? 'home';
export function routeSoundRoom(path: string): AmbientScene {
  if (path === '/') return 'home';
  if (path === '/world' || path.startsWith('/destination/')) return 'world';
  if (path === '/time-machine') return 'time';
  if (path === '/category/movies' || path.startsWith('/film/')) return 'cinema';
  if (path === '/category/music') return 'music';
  if (path === '/category/culture') return 'culture';
  if (path === '/my-world' || path === '/journey') return 'collection';
  return 'library';
}

type ScoreOutput = {
  room: (room: AmbientScene) => void;
  motion: (energy: number, pan: number) => void;
  arrival: (compact: boolean) => void;
  schedule: (callback: () => void, delay: number) => () => void;
};

/** Listens to the existing journey samples; it never advances scroll or camera.
 * Motion is an impulse to the audio engine's own decay. Arrival waits for a
 * genuine reading position, so fast jumps do not chime at every skipped room. */
export function createPassageScore(output: ScoreOutput) {
  let previous: TunnelFrame | null = null;
  let previousTime = 0, intentUntil = -Infinity, lastMotion = -Infinity;
  let currentRoom: AmbientScene | null = null, travelled = false;
  let arrived = -2, pending = -2, lastArrival = -Infinity;
  let cancelArrival: (() => void) | null = null;
  let disposed = false;
  const clearArrival = () => { cancelArrival?.(); cancelArrival = null; pending = -2; };
  return {
    arm(now: number) { intentUntil = now + 2200; },
    sample(frame: TunnelFrame, now: number, allowed = true) {
      if (disposed) return;
      const room = passageRoom(frame.active);
      if (room !== currentRoom) { currentRoom = room; output.room(room); }
      const last = previous, dt = (now - previousTime) / 1000;
      previous = frame; previousTime = now;
      if (!last) { arrived = frame.active; return; }
      if (!allowed || frame.compact !== last.compact) {
        clearArrival(); travelled = false; arrived = frame.active;
        output.motion(0, 0); return;
      }
      const delta = frame.z - last.z;
      const intended = now < intentUntil;
      if (intended && Math.abs(delta) > .02) travelled = true;
      if (now - lastMotion >= 33) {
        lastMotion = now;
        const energy = intended && dt > 0 && dt < 1 ? Math.min(1, Math.abs(delta) / dt / 38) * (frame.compact ? .45 : 1) : 0;
        output.motion(energy, Math.sign(delta) * .26);
      }
      const reading = frame.active >= 0 && (frame.compact || frame.progress >= .38 && (frame.progress <= .74 || frame.active === 5));
      if (!reading || pending !== -2 && pending !== frame.active) clearArrival();
      if (last.active !== frame.active) arrived = -2;
      if (!intended || !travelled || !reading || arrived === frame.active || pending === frame.active || now - lastArrival < 1700) return;
      pending = frame.active;
      const station = frame.active;
      cancelArrival = output.schedule(() => {
        cancelArrival = null; pending = -2;
        if (disposed || previous?.active !== station) return;
        arrived = station; travelled = false; lastArrival = previousTime;
        output.arrival(frame.compact);
      }, 170);
    },
    dispose() { disposed = true; clearArrival(); output.motion(0, 0); },
  };
}
