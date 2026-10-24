/** Keep a 60 Hz rendering budget without rounding 120/144 Hz displays down to 48 Hz.
 * The deadline retains its fractional phase; simulation still uses actual RAF time.
 * A little timestamp tolerance avoids skipping an otherwise normal 60 Hz frame.
 */
export function createFrameCadence(rate = 60) {
  const interval = 1000 / Math.max(1, rate);
  let next = -Infinity;
  return {
    ready(time: number) {
      // Resume immediately after visibility changes or a long main-thread stall.
      if (!Number.isFinite(next) || time - next > interval * 4) next = time;
      if (time + .75 < next) return false;
      next += interval;
      return true;
    },
    reset() { next = -Infinity; },
  };
}
