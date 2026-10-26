/** A single spatial coordinate system for the tunnel, DOM panels and native scroll. */
export const TUNNEL_STATION_IDS = ['world', 'time-machine', 'movies', 'music', 'culture', 'my-world'] as const;
export const TUNNEL_SPACING = 34;
export const tunnelStationZ = (index: number) => -32 - Math.max(0, index) * TUNNEL_SPACING;
export const tunnelReadingZ = (index: number) => tunnelStationZ(index) + 12.8;
export const TUNNEL_HERO_UNITS = 1.35;
export const TUNNEL_CHAPTER_UNITS = 2.25;
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Approach, hold for reading, then pass the physical station. Fully reversible. */
export function tunnelChapterZ(index: number, progress: number) {
  const z = tunnelStationZ(index), p = clamp(progress);
  if (p < .38) return lerp(z + 25, z + 12.8, p / .38);
  if (p < .74) return lerp(z + 12.8, z + 12.2, (p - .38) / .36);
  if (index === TUNNEL_STATION_IDS.length - 1) return z + 12.2;
  return lerp(z + 12.2, tunnelStationZ(index + 1) + 25, (p - .74) / .26);
}

export type TunnelFrame = { z: number; progress: number; active: number; compact: boolean };
let frame: TunnelFrame = { z: 12, progress: 0, active: -1, compact: false };
const frameListeners = new Set<(value: TunnelFrame) => void>();
export const getTunnelFrame = () => frame;
export function setTunnelFrame(next: TunnelFrame) { frame = next; frameListeners.forEach(listener => listener(next)); }
export function subscribeTunnelFrame(listener: (value: TunnelFrame) => void) { frameListeners.add(listener); return () => { frameListeners.delete(listener); }; }

export type TunnelPanelBinding = { id: string; index: number; element: HTMLDivElement; fallback: HTMLElement };
let bindings: TunnelPanelBinding[] = [];
const panelListeners = new Set<(value: TunnelPanelBinding[]) => void>();
export const getTunnelPanels = () => bindings;
export function setTunnelPanels(next: TunnelPanelBinding[]) { bindings = next; panelListeners.forEach(listener => listener(next)); }
export function subscribeTunnelPanels(listener: (value: TunnelPanelBinding[]) => void) { panelListeners.add(listener); return () => { panelListeners.delete(listener); }; }

export const tunnelCompact = (width: number, height: number, reducedMotion = false) => reducedMotion || width < 980 || height < 660;
