import { useSyncExternalStore } from 'react';

export type SpatialPreferences = { view: 'gallery' | 'overhead'; cutaway: boolean; light: number; quality: 'balanced' | 'detail' | 'light'; pinned: string[] };
const defaults: SpatialPreferences = { view: 'gallery', cutaway: false, light: 55, quality: 'balanced', pinned: [] };
export function validateSpatialPreferences(value: unknown): SpatialPreferences {
  const v = value && typeof value === 'object' ? value as Partial<SpatialPreferences> : {};
  return { view: v.view === 'overhead' ? 'overhead' : 'gallery', cutaway: v.cutaway === true,
    light: Number.isFinite(v.light) ? Math.max(15, Math.min(100, v.light!)) : 55,
    quality: v.quality === 'detail' || v.quality === 'light' ? v.quality : 'balanced',
    pinned: Array.isArray(v.pinned) ? [...new Set(v.pinned.filter(id => ['world','time-machine','movies','music','culture','my-world'].includes(id)))].slice(0,6) : [] };
}
const key = 'monumental.spatial-tools.v1';
let current = defaults;
try { current = validateSpatialPreferences(JSON.parse(localStorage.getItem(key) || '{}')); } catch { /* Defaults also work without storage. */ }
const listeners = new Set<() => void>();
export const getSpatialPreferences = () => current;
export function setSpatialPreferences(next: Partial<SpatialPreferences>) {
  current = validateSpatialPreferences({ ...current, ...next });
  try { localStorage.setItem(key, JSON.stringify(current)); } catch { /* Session-only choices. */ }
  listeners.forEach(listener => listener());
}
export function subscribeSpatialPreferences(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const useSpatialPreferences = () => useSyncExternalStore(subscribeSpatialPreferences, getSpatialPreferences, getSpatialPreferences);
export const qualityRatio = (quality: SpatialPreferences['quality'], mobile: boolean) => quality === 'light' ? .85 : quality === 'detail' ? mobile ? 1.5 : 1.75 : mobile ? 1.25 : 1.5;
