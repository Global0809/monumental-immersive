import { useSyncExternalStore } from 'react';
import type { TransitionVariant } from './transitionContours';

export type { TransitionVariant } from './transitionContours';
export const transitionVariants: { id: TransitionVariant; name: string; description: string }[] = [
  { id: 'ink', name: 'Ink', description: 'A liquid edge with pooled contours and fine, irregular recesses.' },
  { id: 'silk', name: 'Silk', description: 'Long, supple folds. A quieter passage with a flowing silhouette.' },
  { id: 'rift', name: 'Rift', description: 'An uneven split with branching cuts and deeper interruptions.' },
  { id: 'facet', name: 'Facet', description: 'Angled planes cut across the page in a sharp, architectural reveal.' },
  { id: 'bloom', name: 'Bloom', description: 'Rounded cells gather into a connected, growing surface.' },
];

type TransitionPreference = Readonly<{ variant: TransitionVariant; review: boolean }>;
const storageKey = 'monumental.transition.preference.v1';
const defaults: TransitionPreference = Object.freeze({ variant: 'ink', review: false });
const listeners = new Set<() => void>();
const isVariant = (value: unknown): value is TransitionVariant => transitionVariants.some(item => item.id === value);
function readPreference(): TransitionPreference {
  if (typeof window === 'undefined') return defaults;
  let variant = defaults.variant, review = defaults.review;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (isVariant(saved?.variant)) variant = saved.variant;
    if (typeof saved?.review === 'boolean') review = saved.review;
  } catch { /* The comparison remains available without browser storage. */ }
  const query = new URLSearchParams(window.location.search);
  const selected = query.get('transition');
  if (isVariant(selected)) variant = selected;
  if (query.has('review')) review = query.get('review') === 'transitions';
  return Object.freeze({ variant, review });
}

let snapshot = readPreference();
function publish(next: TransitionPreference, updateUrl = true) {
  if (snapshot.variant === next.variant && snapshot.review === next.review) return;
  snapshot = Object.freeze(next);
  try { localStorage.setItem(storageKey, JSON.stringify(snapshot)); } catch { /* In-memory choice survives route changes. */ }
  if (updateUrl && typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set('transition', next.variant);
    if (next.review) url.searchParams.set('review', 'transitions');
    else url.searchParams.delete('review');
    // Only the outer query changes. Preserve the hash, its filters, history state,
    // and the exact scroll position; the site's hash router is not invoked.
    window.history.replaceState(window.history.state, '', url);
  }
  listeners.forEach(listener => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => publish(readPreference(), false));
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getTransitionPreference = () => snapshot;
export function useTransitionPreference() {
  return useSyncExternalStore(subscribe, getTransitionPreference, () => defaults);
}
export function setTransitionVariant(variant: TransitionVariant) {
  if (isVariant(variant)) publish({ ...snapshot, variant });
}
export function setTransitionReview(review: boolean) { publish({ ...snapshot, review }); }
