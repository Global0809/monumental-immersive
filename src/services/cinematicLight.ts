/** Authored architectural breathing, sampled by each scene's existing clock.
 * Slow overlapping cycles never flash or touch exposure, camera or content. */
export function sampleCinematicLight(time: number, reduced = false, calm: boolean | number = false) {
  if (reduced || !Number.isFinite(time)) return { breath: 1, signal: 1, drift: 0 };
  const calmAmount = typeof calm === 'boolean' ? Number(calm) : Number.isFinite(calm) ? Math.max(0, Math.min(1, calm)) : 0;
  const t = Math.max(0, time), depth = 1 - calmAmount * .55;
  const breath = Math.sin(t * Math.PI * 2 / 8.8);
  const undertone = Math.sin(t * Math.PI * 2 / 17.6 + .55) - Math.sin(.55);
  return {
    breath: 1 + depth * (.13 * breath + .035 * undertone),
    signal: 1 + depth * (.23 * Math.sin(t * Math.PI * 2 / 8.8 - .7) + .055 * Math.sin(t * Math.PI * 2 / 21)),
    drift: Math.sin(t * Math.PI * 2 / 23) * depth,
  };
}

export type CinematicRect = { left: number; top: number; right: number; bottom: number };
/** CSS/top-left coordinates become the GPU's normalized bottom-left rectangle. */
export function cinematicRect(rect: CinematicRect, width = 1, height = 1): [number, number, number, number] {
  if (!(width > 0 && height > 0) || !Object.values(rect).every(Number.isFinite) || rect.right <= rect.left || rect.bottom <= rect.top) return [0, 0, 0, 0];
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return [clamp(rect.left / width), clamp(1 - rect.bottom / height), clamp(rect.right / width), clamp(1 - rect.top / height)];
}

export function cinematicBufferSize(width: number, height: number) {
  if (!(width > 0 && height > 0) || !Number.isFinite(width * height) || width * height > 5_000_000) return null;
  const scale = Math.min(.25, 480 / width);
  return { width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)), bloomWidth: Math.max(1, Math.round(width * scale)), bloomHeight: Math.max(1, Math.round(height * scale)) };
}
