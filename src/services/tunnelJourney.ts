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
  const smooth = (t: number) => t * t * (3 - 2 * t);
  if (p < .38) return lerp(z + 25, z + 12.8, smooth(p / .38));
  // A real reading plateau: the camera does not creep while the visitor reads.
  if (p < .74 || index === TUNNEL_STATION_IDS.length - 1) return z + 12.8;
  return lerp(z + 12.8, tunnelStationZ(index + 1) + 25, smooth((p - .74) / .26));
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

/** A gate clears the camera before arrival and closes only after it is behind us.
 * This field is position based, so reverse scrolling retraces the same movement. */
export function tunnelGateOpen(cameraZ: number, gateZ: number) {
  if (!Number.isFinite(cameraZ) || !Number.isFinite(gateZ)) return 0;
  const distance = cameraZ - gateZ;
  const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
  return smooth((22 - distance) / 12) * (1 - smooth((-distance - 7) / 11));
}

export type TunnelInspection = Readonly<{ station: string | null; expanded: boolean; rotation: number }>;
const closedInspection: TunnelInspection = Object.freeze({ station: null, expanded: false, rotation: 0 });
let inspection = closedInspection;
const inspectionListeners = new Set<(value: TunnelInspection) => void>();
export const getTunnelInspection = () => inspection;
export function setTunnelInspection(next: TunnelInspection) {
  const valid = TUNNEL_STATION_IDS.some(id => id === next.station);
  const normalized = valid && next.expanded
    ? { station: next.station, expanded: true, rotation: Number.isFinite(next.rotation) ? clamp(next.rotation, -Math.PI, Math.PI) : 0 }
    : closedInspection;
  if (normalized.station === inspection.station && normalized.expanded === inspection.expanded && normalized.rotation === inspection.rotation) return;
  inspection = Object.freeze(normalized);
  inspectionListeners.forEach(listener => listener(inspection));
}
export function subscribeTunnelInspection(listener: (value: TunnelInspection) => void) {
  inspectionListeners.add(listener);
  return () => { inspectionListeners.delete(listener); };
}
