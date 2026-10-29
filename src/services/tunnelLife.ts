/** Shared, event-driven controls. Animation values remain owned by the scene. */
export type TunnelLifeFrame = {
  time: number; delta: number; cameraZ: number; active: number; progress: number;
  pointer: readonly [number, number]; energy: number;
  pulse: { age: number; originZ: number; strength: number };
  compact: boolean; reducedMotion: boolean; inspection: boolean; quality: string;
};
export type TunnelLifeState = Readonly<{ relayOpen: boolean; relayPart: number | null; signal: number }>;
let state: TunnelLifeState = Object.freeze({ relayOpen: false, relayPart: null, signal: 0 });
const listeners = new Set<() => void>();
export const getTunnelLife = () => state;
export function subscribeTunnelLife(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function publish(next: TunnelLifeState) { state = Object.freeze(next); listeners.forEach(listener => listener()); }
export function setTunnelRelay(open: boolean) {
  if (open !== state.relayOpen || (!open && state.relayPart !== null)) publish({ ...state, relayOpen: open, relayPart: open ? state.relayPart : null });
}
export function selectTunnelRelayPart(part: number | null) {
  const selected = part !== null && Number.isInteger(part) && part >= 0 && part < 6 ? part : null;
  if (state.relayPart !== selected || (selected !== null && !state.relayOpen)) publish({ ...state, relayOpen: selected !== null || state.relayOpen, relayPart: selected });
}
export function sendTunnelSignal() { publish({ ...state, signal: state.signal + 1 }); }

/** A single pulse can be retriggered without accumulating timers or GPU work.
 * Pausing the scene freezes it; returning from another route resets it. */
export function createTunnelPulse() {
  const value = { age: 8, originZ: 0, strength: 0 };
  return {
    value,
    trigger(z: number) { if (Number.isFinite(z)) { value.age = 0; value.originZ = z; value.strength = 1; } },
    advance(delta: number) {
      if (!Number.isFinite(delta) || delta <= 0) return;
      value.age = Math.min(8, value.age + Math.min(.05, delta));
      if (value.age >= 8) value.strength = 0;
    },
    reset() { value.age = 8; value.strength = 0; },
  };
}
