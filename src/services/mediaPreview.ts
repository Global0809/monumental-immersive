import type { Video } from '../data/catalogue';

/** Root and GitHub Pages media paths are local; remote films are never hover-loaded. */
export function isLocalMediaSource(source?: string): boolean {
  return Boolean(source && source.startsWith('/') && !source.startsWith('//') && source.split(/[?#]/, 1)[0].includes('/media/'));
}

export function playableQueueAfter(queue: Video[], currentId: string): Video[] {
  const current = queue.findIndex(item => item.id === currentId);
  if (current < 0) return [];
  return queue.slice(current + 1).filter(item => item.status === 'available' && item.access === 'free' && Boolean(item.src));
}
