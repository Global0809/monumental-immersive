import { useSyncExternalStore } from 'react';
import { places } from '../data/catalogue';
import { go } from './router';
import { playSound } from './audio';

const listeners = new Set<() => void>();
let destination = 'miami';
try { const stored = sessionStorage.getItem('monumental.signal.place'); if (places.some(p => p.id === stored)) destination = stored!; } catch { /* Selection still works for this visit. */ }
export function selectDestination(id: string) {
  if (!places.some(p => p.id === id) || id === destination) return;
  destination = id;
  try { sessionStorage.setItem('monumental.signal.place', id); } catch { /* In-memory fallback. */ }
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useDestination = () => useSyncExternalStore(subscribe, () => destination, () => 'miami');
export const getDestination = () => destination;
export function enterWorld(id: string, reducedMotion: boolean) {
  selectDestination(id);
  if (reducedMotion) { playSound('destination'); go('/world', { place: id }); return; }
  window.dispatchEvent(new CustomEvent('monumental:portal-open', { detail: { place: id } }));
}
