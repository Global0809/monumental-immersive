import type { CatalogueSnapshot, Period, Place, Video } from './domain';

type RecordValue = Record<string, unknown>;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_RECORDS = 5000;

function fail(path: string): never { throw new Error(`Invalid catalogue: ${path}`); }
function record(value: unknown, path: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path);
  return value as RecordValue;
}
function text(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > 20000 || (!allowEmpty && !value.trim())) return fail(path);
  return value;
}
function identifier(value: unknown, path: string): string {
  const result = text(value, path);
  if (result.length > 100 || !ID.test(result)) return fail(path);
  return result;
}
function number(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return fail(path);
  return value;
}
function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_RECORDS) return fail(path);
  return value;
}
function strings(value: unknown, path: string, ids = false): string[] {
  const result = list(value, path).map((item, i) => ids ? identifier(item, `${path}[${i}]`) : text(item, `${path}[${i}]`));
  if (new Set(result).size !== result.length) return fail(`${path} duplicates`);
  return result;
}

/** Public HTTPS URLs or local paths; never executable, credentialed or protocol-relative URLs. */
export function isPublicResourceUrl(value: string): boolean {
  if (!value || value.trim() !== value || /[\u0000-\u001f\u007f\\]/.test(value) || value.startsWith('//')) return false;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      const url = new URL(value);
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    }
    const path = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    if (!path || path.startsWith('//') || /[\u0000-\u001f\u007f\\]/.test(path) || path.split('/').includes('..')) return false;
    return /^[./a-z0-9_-]/i.test(path) && !path.includes(':');
  } catch { return false; }
}
function resource(value: unknown, path: string): string {
  const result = text(value, path);
  if (!isPublicResourceUrl(result)) return fail(path);
  return result;
}
function unique<T extends { id: string }>(items: T[], path: string): T[] {
  if (new Set(items.map(item => item.id)).size !== items.length) return fail(`${path} duplicate IDs`);
  return items;
}

function parsePlace(value: unknown, i: number): Place {
  const path = `places[${i}]`, place = record(value, path);
  return {
    id: identifier(place.id, `${path}.id`), name: text(place.name, `${path}.name`),
    country: text(place.country, `${path}.country`), kind: text(place.kind, `${path}.kind`),
    lat: number(place.lat, `${path}.lat`, -90, 90), lon: number(place.lon, `${path}.lon`, -180, 180),
    description: text(place.description, `${path}.description`), image: resource(place.image, `${path}.image`),
    tagline: text(place.tagline, `${path}.tagline`),
  };
}
function parsePeriod(value: unknown, i: number): Period {
  const path = `periods[${i}]`, period = record(value, path);
  return { id: identifier(period.id, `${path}.id`), label: text(period.label, `${path}.label`), description: text(period.description, `${path}.description`) };
}
function parseVideo(value: unknown, i: number): Video {
  const path = `videos[${i}]`, video = record(value, path);
  if (video.access !== 'free' && video.access !== 'premium') return fail(`${path}.access`);
  if (video.status !== 'available' && video.status !== 'development') return fail(`${path}.status`);
  const parsed: Video = {
    id: identifier(video.id, `${path}.id`), title: text(video.title, `${path}.title`), description: text(video.description, `${path}.description`),
    category: text(video.category, `${path}.category`), places: strings(video.places, `${path}.places`, true),
    period: identifier(video.period, `${path}.period`), publishedAt: text(video.publishedAt, `${path}.publishedAt`, true),
    people: strings(video.people, `${path}.people`), duration: number(video.duration, `${path}.duration`, 0, 86400),
    poster: resource(video.poster, `${path}.poster`), access: video.access, status: video.status,
    credit: text(video.credit, `${path}.credit`), tags: strings(video.tags, `${path}.tags`),
  };
  for (const key of ['src', 'captions'] as const) if (video[key] !== undefined) parsed[key] = resource(video[key], `${path}.${key}`);
  for (const key of ['series', 'context'] as const) if (video[key] !== undefined) parsed[key] = text(video[key], `${path}.${key}`);
  if (video.episode !== undefined) {
    parsed.episode = number(video.episode, `${path}.episode`, 1, 100000);
    if (!Number.isInteger(parsed.episode)) return fail(`${path}.episode`);
  }
  if (parsed.publishedAt) {
    const timestamp = Date.parse(parsed.publishedAt);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.publishedAt) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== parsed.publishedAt) return fail(`${path}.publishedAt`);
  }
  if (parsed.status === 'development' && (parsed.src || parsed.captions || parsed.duration !== 0)) return fail(`${path} development media`);
  if (parsed.status === 'available' && (parsed.duration <= 0 || !parsed.publishedAt || (parsed.access === 'free' && !parsed.src))) return fail(`${path} availability`);
  if (parsed.access === 'premium' && (parsed.src || parsed.captions)) return fail(`${path} private media in public catalogue`);
  return parsed;
}

/** Builds only allowlisted public fields and validates before any live catalogue is changed. */
export function parseCatalogueSnapshot(value: unknown): CatalogueSnapshot {
  const input = record(value, 'snapshot');
  if (input.schemaVersion !== 1) return fail('schemaVersion');
  const snapshot: CatalogueSnapshot = {
    schemaVersion: 1, revision: text(input.revision, 'revision'),
    places: unique(list(input.places, 'places').map(parsePlace), 'places'),
    periods: unique(list(input.periods, 'periods').map(parsePeriod), 'periods'),
    videos: unique(list(input.videos, 'videos').map(parseVideo), 'videos'),
  };
  const places = new Set(snapshot.places.map(place => place.id));
  const periods = new Set(snapshot.periods.map(period => period.id));
  for (const video of snapshot.videos) {
    if (!periods.has(video.period)) return fail(`video ${video.id} unknown period`);
    if (video.places.some(id => !places.has(id))) return fail(`video ${video.id} unknown place`);
  }
  return snapshot;
}

/** Temporary editorial contract, separate from the extensible domain schema. */
export function assertPreviewCompatibility(snapshot: CatalogueSnapshot, authored: CatalogueSnapshot): void {
  for (const key of ['places', 'periods'] as const) {
    if (snapshot[key].map(item => item.id).join('|') !== authored[key].map(item => item.id).join('|')) return fail(`${key} require an editorial scene migration`);
  }
  if (authored.videos.some(item => !snapshot.videos.some(video => video.id === item.id))) return fail('authored story links must be retained');
  if (authored.places.some((place, i) => snapshot.places[i].image !== place.image)) return fail('destination imagery requires a credits migration');
}
