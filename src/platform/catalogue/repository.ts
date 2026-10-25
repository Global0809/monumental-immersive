import type { CatalogueIndex, CatalogueRepository, CatalogueSnapshot, Video } from './domain';
import { assertPreviewCompatibility, isPublicResourceUrl, parseCatalogueSnapshot } from './validation';

export function createCatalogueIndex(snapshot: CatalogueSnapshot): CatalogueIndex {
  const videosByPlace = new Map<string, Video[]>(snapshot.places.map(place => [place.id, []]));
  const videosByPeriod = new Map<string, Video[]>(snapshot.periods.map(period => [period.id, []]));
  for (const video of snapshot.videos) {
    videosByPeriod.get(video.period)?.push(video);
    for (const id of video.places) videosByPlace.get(id)?.push(video);
  }
  return {
    videos: new Map(snapshot.videos.map(video => [video.id, video])),
    places: new Map(snapshot.places.map(place => [place.id, place])),
    periods: new Map(snapshot.periods.map(period => [period.id, period])),
    videosByPlace,
    videosByPeriod,
  };
}

export class BundledCatalogueRepository implements CatalogueRepository {
  constructor(private readonly snapshot: CatalogueSnapshot) {}
  async load(): Promise<CatalogueSnapshot> { return parseCatalogueSnapshot(this.snapshot); }
}

const MAX_RESPONSE_CHARACTERS = 2_000_000;
export class HttpCatalogueRepository implements CatalogueRepository {
  constructor(
    private readonly endpoint: string,
    private readonly options: { fetch?: typeof fetch; timeoutMs?: number } = {},
  ) {}
  async load(): Promise<CatalogueSnapshot> {
    if (!isPublicResourceUrl(this.endpoint)) throw new Error('Catalogue endpoint must be a safe local path or HTTPS URL');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutMs = Math.min(3000, Math.max(1, this.options.timeoutMs ?? 3000));
    try {
      const request = async () => {
        const response = await (this.options.fetch ?? fetch)(this.endpoint, {
          method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
          headers: { Accept: 'application/json' }, signal: controller.signal,
        });
        if (!response.ok) throw new Error('Catalogue request failed');
        const declaredLength = Number(response.headers.get('content-length') ?? 0);
        if (declaredLength > MAX_RESPONSE_CHARACTERS) throw new Error('Catalogue response too large');
        const body = await response.text();
        if (body.length > MAX_RESPONSE_CHARACTERS) throw new Error('Catalogue response too large');
        return parseCatalogueSnapshot(JSON.parse(body));
      };
      return await Promise.race([
        request(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Catalogue request timed out')); }, timeoutMs); }),
      ]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
}

export type CatalogueLoad = { snapshot: CatalogueSnapshot; source: 'bundled' | 'remote'; reason?: 'unavailable-or-invalid' };
export async function loadCatalogueWithFallback(authored: CatalogueSnapshot, remote?: CatalogueRepository): Promise<CatalogueLoad> {
  const fallback = parseCatalogueSnapshot(authored);
  if (!remote) return { snapshot: fallback, source: 'bundled' };
  try {
    const snapshot = parseCatalogueSnapshot(await remote.load());
    assertPreviewCompatibility(snapshot, fallback);
    return { snapshot, source: 'remote' };
  } catch {
    // Do not expose endpoint query strings, payloads or stack traces in the public UI.
    return { snapshot: fallback, source: 'bundled', reason: 'unavailable-or-invalid' };
  }
}
