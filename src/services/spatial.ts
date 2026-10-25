import { useSyncExternalStore } from 'react';
import { videos, places } from '../data/catalogue';
import type { SpatialPortal } from '../components/spatial/types';

const available = videos.filter(video => video.status === 'available');
const poster = (id: string) => videos.find(video => video.id === id)?.poster || places[0].image;
export const spatialPortals: SpatialPortal[] = [
  { id: 'world', title: 'The World', route: '/world', image: places[0].image,
    description: 'Turn the globe. Find the people and stories behind a place.', count: places.length },
  { id: 'time-machine', title: 'Time Machine', route: '/time-machine', image: poster('break-beat-city'),
    description: 'Follow cultural moments across time. Discover their echoes today.', count: available.length },
  { id: 'movies', title: 'The Cinema', route: '/category/movies', image: poster('sintel'),
    description: 'Take a seat inside independent worlds and extraordinary stories.', count: available.filter(video => video.category === 'Film').length },
  { id: 'music', title: 'Music', route: '/category/music', image: poster('island-current'),
    description: 'Follow a sound to its source. Meet the places that give it life.', count: available.filter(video => video.category === 'Music').length },
  { id: 'culture', title: 'Culture', route: '/category/culture', image: poster('concrete-and-colour'),
    description: 'Art, food, design and the everyday things that connect us.', count: available.filter(video => ['Culture','Documentary','Art & Design','Food'].includes(video.category)).length },
  { id: 'my-world', title: 'My World', route: '/my-world', image: poster('tokyo-in-motion'),
    description: 'A place for the films, moments and journeys you keep.', count: 0 },
];

export function spatialRoomForPath(path: string): string {
  if (path === '/') return 'atrium';
  if (path.startsWith('/film/')) return 'movies';
  if (path.startsWith('/category/')) {
    const category = path.slice('/category/'.length);
    return ['movies','music'].includes(category) ? category : 'culture';
  }
  if (path === '/journey' || path === '/settings' || path === '/premium') return 'my-world';
  if (path === '/motion' || path === '/live' || path === '/search' || path === '/credits') return 'movies';
  return spatialPortals.find(portal => portal.route === path)?.id || 'movies';
}

export function spatialPageLabel(path: string): string {
  const portal = spatialPortals.find(item => item.route === path);
  if (portal) return portal.title;
  if (path.startsWith('/film/')) return 'The screening room';
  const labels: Record<string, string> = { '/journey': 'Your journey', '/settings': 'Experience settings', '/premium': 'Monumental+', '/motion': 'Experience in motion', '/live': 'Live', '/search': 'Discover', '/credits': 'Credits' };
  if (labels[path]) return labels[path];
  if (path.startsWith('/category/')) return path.slice('/category/'.length).replace(/(^|-)\w/g, text => text.replace('-', ' ').toUpperCase());
  return 'Monumental';
}

export function spatialEnabled(search: string): boolean {
  return new URLSearchParams(search).get('experience') !== 'classic';
}

export function classicExperienceHref(search: string, hash: string): string {
  const params = new URLSearchParams(search);
  params.set('experience', 'classic');
  return `?${params.toString()}${hash || '#/'}`;
}

type SpatialState = { entered: boolean; ready: boolean; unavailable: boolean; focus: string | null };
let entered = false;
try { entered = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('monumental.spatial.entered') === '1'; } catch { /* A private session still works. */ }
let state: SpatialState = { entered, ready: false, unavailable: false, focus: null };
const listeners = new Set<() => void>();
const update = (next: Partial<SpatialState>) => {
  if (Object.entries(next).every(([key, value]) => state[key as keyof SpatialState] === value)) return;
  state = { ...state, ...next };
  listeners.forEach(listener => listener());
};
export function enterSpatialWorld() {
  try { sessionStorage.setItem('monumental.spatial.entered', '1'); } catch { /* Session-only fallback. */ }
  update({ entered: true });
}
export function resetSpatialEntrance() {
  try { sessionStorage.removeItem('monumental.spatial.entered'); } catch { /* Session-only fallback. */ }
  update({ entered: false, focus: null });
}
export const setSpatialFocus = (focus: string | null) => update({ focus });
export const setSpatialReady = () => update({ ready: true, unavailable: false });
export const setSpatialUnavailable = () => update({ ready: false, unavailable: true });
export const getSpatialState = () => state;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useSpatial = () => useSyncExternalStore(subscribe, getSpatialState, getSpatialState);
export function rotateSpatialWorld(delta: number) {
  if (Number.isFinite(delta)) window.dispatchEvent(new CustomEvent('monumental:spatial-rotate', { detail: delta }));
}
