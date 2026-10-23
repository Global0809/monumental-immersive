import { places, videos, type Video } from '../data/catalogue';

export type CultureToken = { id: string; label: string; kind: 'place' | 'interest'; matches: (video: Video) => boolean };
export const cultureTokens: CultureToken[] = [
  { id: 'music', label: 'Music', kind: 'interest', matches: v => v.category === 'Music' || v.tags.includes('rhythm') },
  { id: 'fashion', label: 'Fashion', kind: 'interest', matches: v => v.category === 'Fashion' },
  { id: 'design', label: 'Design', kind: 'interest', matches: v => v.category === 'Art & Design' || v.tags.includes('architecture') },
  { id: 'independent-film', label: 'Independent film', kind: 'interest', matches: v => v.category === 'Film' || v.category === 'Movies' || v.tags.includes('independent') },
  { id: 'food', label: 'Food', kind: 'interest', matches: v => v.category === 'Food' },
  { id: 'history', label: 'History', kind: 'interest', matches: v => v.tags.includes('history') },
  ...places.map(p => ({ id: p.id, label: p.name, kind: 'place' as const, matches: (v: Video) => v.places.includes(p.id) })),
];
export type Collision = { kind: 'intersection' | 'collection' | 'theme' | 'empty'; explanation: string; films: Video[] };
export function collideCultures(first: string, second: string, source: Video[] = videos): Collision {
  const a = cultureTokens.find(t => t.id === first), b = cultureTokens.find(t => t.id === second);
  const empty: Collision = { kind: 'empty', explanation: 'This preview collection does not yet support that connection. Try one of the combinations below.', films: [] };
  if (!a || !b || a.id === b.id) return empty;
  const available = source.filter(v => v.status === 'available' && Boolean(v.src));
  const intersection = available.filter(v => a.matches(v) && b.matches(v));
  if (intersection.length) return { kind: 'intersection', explanation: `These stories match both ${a.label} and ${b.label} in the catalogue.`, films: intersection };
  const left = available.filter(a.matches), right = available.filter(b.matches);
  for (const x of left) for (const y of right) {
    if (x.id === y.id) continue;
    if (x.series && x.series === y.series) return { kind: 'collection', explanation: `A curatorial connection: both belong to ${x.series}. These are two perspectives in the same preview collection, not a claim of historical influence.`, films: [x, y] };
    const shared = x.tags.find(tag => !['preview', 'motion study', 'history', 'originals', 'in development'].includes(tag) && y.tags.includes(tag));
    if (shared) return { kind: 'theme', explanation: `A shared theme: ${shared}. This pairing follows the catalogue’s editorial tags; it does not establish a historical influence.`, films: [x, y] };
  }
  return empty;
}
export function nearbyCollisions(first: string, second: string) {
  return cultureTokens.filter(t => t.id !== first && t.id !== second && collideCultures(first, t.id).films.length).slice(0, 3);
}
